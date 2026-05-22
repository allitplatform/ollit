// =============================================================================
// 유솔 운영 시트 → DB 동기화 (status / scheduled_at / completed_at)
// 2026-05-23 — Stage ②
// =============================================================================
//
// 입력: 유솔홈케어_운영.xlsx (운영 시트 전체)
//
// 사장님 spec:
//   1. status 매핑: 작업완료→완료 / 일정확정→확정 / 기사배정완료→배정 / 접수→미배정 / 취소→취소
//   2. scheduled_at — 고객컨택일자(Y) + 기사약속시간(X) → KST → UTC
//      · X="00:00" → scheduled_at=NULL + status="배정"
//   3. completed_at — 작업완료일 (status=완료일 때만)
//
// 안전 규칙:
//   · DB == 시트 값 → 건너뜀
//   · 역행 금지 — DB=완료 / 시트=확정/배정 → UPDATE 안 함 + 경고 측 측
//   · status='완료' 측 측 변경 — payments 측 X 측 compute_payment 호출
//
// 측 측:
//   node scripts/sync-usol-n-from-sheet.cjs --dry-run   # 측 측 측
//   node scripts/sync-usol-n-from-sheet.cjs --commit    # 실제 UPDATE

const fs = require("fs"), path = require("path");
const XLSX = require("xlsx");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PRINCIPAL_ID = "22222222-2222-2222-2222-222222222006";

const isCommit = process.argv.includes("--commit");
const isDry = !isCommit;
console.log(`\n${"=".repeat(85)}\n시트→DB 동기화 — ${isCommit ? "✅ COMMIT" : "🔍 DRY-RUN"}\n${"=".repeat(85)}\n`);

const STATUS_MAP = {
  "작업완료": "완료",
  "일정확정": "확정",
  "기사배정완료": "배정",
  "접수":     "미배정",
  "취소":     "취소",
};
// status 순위 (역행 catch — DB 측 순위 측 시트 측 측 → 역행)
const STATUS_RANK = { "미배정": 0, "배정": 1, "확정": 2, "진행중": 3, "완료": 4, "취소": 9, "visit_only": 5 };

function cleanStr(v) { return v == null ? "" : String(v).trim(); }

// 시트 측 측 측 측 — Date 객체 측 string 측 측 (cellDates:true 측 Date 측)
function parseSheetDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (!s) return null;
  // "2026.05.23" / "2026-05-23"
  const m = s.match(/^(\d{4})[\.\-](\d{1,2})[\.\-](\d{1,2})/);
  if (m) return new Date(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}T00:00:00+09:00`);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// KST 측 측 측 측 측 → UTC ISO
function buildScheduledAt(customerContactRaw, scheduledTimeRaw) {
  const time = cleanStr(scheduledTimeRaw);
  if (!time || time === "00:00") return { iso: null, statusOverride: "배정" };

  let ymd;
  if (customerContactRaw instanceof Date) {
    // Excel cellDates 측 측 측 측 측 (UTC 측 보임) → KST 측 측 측 catch
    const kst = new Date(customerContactRaw.getTime() + 9 * 3600 * 1000);
    ymd = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
  } else {
    const s = cleanStr(customerContactRaw);
    if (!s) return { iso: null, statusOverride: null };
    const m = s.match(/^(\d{4})[\.\-](\d{1,2})[\.\-](\d{1,2})/);
    if (!m) return { iso: null, statusOverride: null };
    ymd = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  // 시간 측 — "14:00" 측 측 측
  const hmMatch = time.match(/^(\d{1,2}):(\d{2})/);
  if (!hmMatch) return { iso: null, statusOverride: null };
  const hh = hmMatch[1].padStart(2, "0");
  const mm = hmMatch[2];
  const kstIso = `${ymd}T${hh}:${mm}:00+09:00`;
  const d = new Date(kstIso);
  if (isNaN(d.getTime())) return { iso: null, statusOverride: null };
  return { iso: d.toISOString(), statusOverride: null };
}

function buildCompletedAt(completedRaw) {
  if (!completedRaw) return null;
  const d = parseSheetDate(completedRaw);
  if (!d) return null;
  return d.toISOString();
}

(async () => {
  // xlsx 측
  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, "..", "유솔홈케어_운영.xlsx")), { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  console.log(`시트 측 측: ${rows.length}건`);

  // 그룹: 한 task 측 측 row — 측 task 측 측 첫 row 측 측
  //   사장님 spec — task = 주문 단위, 측 task_no = 그룹 첫 row 측 작업코드
  //   다만 측 측 → DB 측 task_no 측 측 → 측 row 측 측 task_no 측 같은 시트 row 측 measurement 첫 measurement
  const sheetByTaskNo = new Map();
  for (const r of rows) {
    const tno = cleanStr(r["작업코드"]);
    if (!tno) continue;
    if (!sheetByTaskNo.has(tno)) sheetByTaskNo.set(tno, r);
  }
  console.log(`측 task_no: ${sheetByTaskNo.size}건\n`);

  // DB 측 측 task 측 측 (.in 측 측 X 측 측 — 측 1000건 측 측 측 측)
  const allTaskNos = Array.from(sheetByTaskNo.keys());
  const chunkSize = 500;
  const dbTasks = [];
  for (let i = 0; i < allTaskNos.length; i += chunkSize) {
    const chunk = allTaskNos.slice(i, i + chunkSize);
    const { data, error } = await sb.from("tasks")
      .select("id, task_no, status, scheduled_at, completed_at")
      .eq("tenant_id", TENANT_ID)
      .eq("principal_id", PRINCIPAL_ID)
      .in("task_no", chunk);
    if (error) { console.error(`DB lookup err (chunk ${i}):`, error.message); continue; }
    if (data) dbTasks.push(...data);
  }
  console.log(`DB 측 catch task: ${dbTasks.length}건 (시트 측 measurement task ${sheetByTaskNo.size - dbTasks.length}건)\n`);

  const dbByTaskNo = new Map(dbTasks.map(t => [t.task_no, t]));

  // 비교
  const updates = {
    status: [],            // { task_no, db, sheet, db_status_for_set }
    scheduledAt: [],       // { task_no, db, sheet }
    completedAt: [],       // { task_no, db, sheet }
    backward: [],          // 역행
    skipUnknownStatus: [], // 시트 status 매핑 X
  };

  for (const [taskNo, sr] of sheetByTaskNo) {
    const db = dbByTaskNo.get(taskNo);
    if (!db) continue;

    const sheetStatusRaw = cleanStr(sr["상태"]);
    const sheetStatus = STATUS_MAP[sheetStatusRaw];
    if (sheetStatusRaw && !sheetStatus) {
      updates.skipUnknownStatus.push({ task_no: taskNo, raw: sheetStatusRaw });
      continue;
    }

    // scheduled_at 측 + statusOverride
    const sched = buildScheduledAt(sr["고객컨택일자"], sr["기사약속시간"]);
    let targetStatus = sheetStatus;
    if (sched.statusOverride && targetStatus && targetStatus !== "완료" && targetStatus !== "취소") {
      // X열 "00:00" → status="배정" 강제
      targetStatus = "배정";
    }

    // 역행 catch
    if (targetStatus && db.status && STATUS_RANK[db.status] > STATUS_RANK[targetStatus]) {
      updates.backward.push({ task_no: taskNo, db_status: db.status, sheet_status: targetStatus });
      continue;
    }

    // status 비교
    if (targetStatus && targetStatus !== db.status) {
      updates.status.push({ task_no: taskNo, db: db.status, sheet: targetStatus });
    }

    // scheduled_at 비교 (UTC ISO string 측 비교)
    const dbSched = db.scheduled_at || null;
    const newSched = sched.iso;
    // 다른 측 catch (NULL ↔ NULL 측 measurement)
    if (dbSched !== newSched) {
      // 측 측 ISO 측 측 측 — JS 측 측 측 ISO 측 측 측 측 measurement → Date 측 measurement
      const sameTime = dbSched && newSched && new Date(dbSched).getTime() === new Date(newSched).getTime();
      if (!sameTime) {
        updates.scheduledAt.push({ task_no: taskNo, db: dbSched, sheet: newSched });
      }
    }

    // completed_at — status='완료' 측 측
    if (targetStatus === "완료") {
      const newCompleted = buildCompletedAt(sr["작업완료일"]);
      if (newCompleted && !db.completed_at) {
        updates.completedAt.push({ task_no: taskNo, db: db.completed_at, sheet: newCompleted });
      }
    }
  }

  // scheduled_at — 값→NULL 측 측 측 측 (X열 "00:00")
  //   db != null && sheet == null → 캘린더 측 측 측 측 측
  const schedToNull = updates.scheduledAt.filter(u => u.db && !u.sheet);
  // status 측 측 — 측 task 측 측 status 측 측 (status 변경 측 + DB 측 status)
  const schedToNullWithStatus = schedToNull.map(u => {
    const inStatusChange = updates.status.find(s => s.task_no === u.task_no);
    const newStatus = inStatusChange ? inStatusChange.sheet : dbByTaskNo.get(u.task_no).status;
    return { ...u, status_after: newStatus };
  });

  // 측 보고
  console.log(`${"=".repeat(85)}\n측 측\n${"=".repeat(85)}`);
  console.log(`  · status 변경:        ${updates.status.length}건`);
  console.log(`  · scheduled_at 변경:  ${updates.scheduledAt.length}건`);
  console.log(`     - 값 → NULL (X열 00:00): ${schedToNull.length}건`);
  console.log(`     - NULL → 값:           ${updates.scheduledAt.filter(u => !u.db && u.sheet).length}건`);
  console.log(`     - 값 → 다른 값:        ${updates.scheduledAt.filter(u => u.db && u.sheet).length}건`);
  console.log(`  · completed_at 채울:  ${updates.completedAt.length}건`);
  console.log(`  · 역행 경고 (SKIP):    ${updates.backward.length}건`);
  console.log(`  · status 미인식 (SKIP): ${updates.skipUnknownStatus.length}건\n`);

  if (schedToNullWithStatus.length > 0) {
    const allBaejung = schedToNullWithStatus.every(u => u.status_after === "배정");
    console.log(`\n[값→NULL ${schedToNullWithStatus.length}건 status 측] 측 5건:`);
    for (const u of schedToNullWithStatus.slice(0, 5)) {
      console.log(`  ${u.task_no}: db=${u.db} → NULL | status_after=${u.status_after}`);
    }
    console.log(`  → 측 ${schedToNullWithStatus.length}건 status_after = "배정"? ${allBaejung ? "✅ 측" : "❌ 측 측 X"}`);
  }

  // 측 5건 측 측
  function show(name, arr) {
    console.log(`\n[${name}] 측 5건:`);
    for (const it of arr.slice(0, 5)) console.log(`  ${JSON.stringify(it)}`);
  }
  show("status 변경", updates.status);
  show("scheduled_at 변경", updates.scheduledAt);
  show("completed_at 채울", updates.completedAt);
  show("역행 경고", updates.backward);
  show("status 미인식", updates.skipUnknownStatus);

  if (isDry) {
    console.log(`\n🔍 DRY-RUN — UPDATE 측 측 X. --commit 측 측 측 측 측 실행.\n`);
    return;
  }

  // ========================== COMMIT ==========================
  console.log(`\n${"=".repeat(85)}\n✅ COMMIT 측 측\n${"=".repeat(85)}\n`);
  // task별 측 update 측 측 (status / scheduled_at / completed_at 같이 측)
  const updateByTaskNo = new Map();
  for (const u of updates.status)       (updateByTaskNo.get(u.task_no) || updateByTaskNo.set(u.task_no, {}).get(u.task_no)).status = u.sheet;
  for (const u of updates.scheduledAt)  (updateByTaskNo.get(u.task_no) || updateByTaskNo.set(u.task_no, {}).get(u.task_no)).scheduled_at = u.sheet;
  for (const u of updates.completedAt)  (updateByTaskNo.get(u.task_no) || updateByTaskNo.set(u.task_no, {}).get(u.task_no)).completed_at = u.sheet;

  let okCount = 0; let errCount = 0;
  const newlyCompletedIds = [];
  for (const [taskNo, patch] of updateByTaskNo) {
    const db = dbByTaskNo.get(taskNo);
    const wasNotCompleted = db.status !== "완료";
    const { error } = await sb.from("tasks").update(patch).eq("id", db.id);
    if (error) { errCount++; console.log(`  ❌ ${taskNo}: ${error.message}`); continue; }
    okCount++;
    if (patch.status === "완료" && wasNotCompleted) newlyCompletedIds.push(db.id);
  }
  console.log(`  ✅ UPDATE 측: ${okCount}건 / 실패: ${errCount}건`);

  // payments backfill — status='완료' 측 바뀐 task 측
  console.log(`\n  payments backfill — status='완료' 측 측: ${newlyCompletedIds.length}건`);
  for (const tid of newlyCompletedIds) {
    const { data: pays } = await sb.from("payments").select("id").eq("task_id", tid);
    if (pays && pays.length > 0) continue;   // 이미 measurement
    const { error } = await sb.rpc("compute_payment", { p_task_id: tid });
    if (error) console.log(`    ❌ ${tid}: ${error.message}`);
  }
})();

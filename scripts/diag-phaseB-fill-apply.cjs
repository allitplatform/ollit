// 파트 A 적용 — scheduled_at NULL 7건 채움 (gcal 우선, CSV fallback, completed_at은 scheduled+2h)
// 사장님 spec:
//   · gcal scheduled_at 우선
//   · 없으면 CSV(컨택일+기사약속시간 / 완료건은 완료일+시간, 시간 없으면 +2h)
//   · completed_at NULL인 완료건도 같은 규칙으로 함께 채움 (기존 422 INSERT spec과 일관 → scheduled+2h)
//   · status는 건드리지 말 것
//   · 전아름·마지혜 2건은 제외 (소스 없음)
const fs = require("fs"), path = require("path");
function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const Papa = require("papaparse");

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CSV_PATH  = path.join(__dirname, "..", "data", "usol_ops_20260524.csv");
const GCAL_PATH = path.join(__dirname, "..", "data", "gcal-index.json");

// 진단 결과 그대로 — 채움 가능 7건 (사장님 확정)
const TARGETS = [
  // [A] 완료 5건
  "YS-260516-070",  // 강소진
  "YS-260424-108",  // 김율
  "YS-260511-019",  // 한유경
  "YS-260425-010",  // 손원주
  "YS-260429-041",  // 박진희
  // [B] 확정 2건
  "YS-260516-092",  // 송지혜
  "YS-260514-045",  // 송현민
];
const EXCLUDED = ["YS-N-260524-009", "YS-N-260524-006"];  // 전아름/마지혜 — 소스 없음

function parseYmd(s) {
  if (!s) return null;
  s = String(s).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m) return { y: +m[1], mo: +m[2], d: +m[3] };
  return null;
}
function parseHm(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: +m[1], mi: +m[2] };
}

(async () => {
  const tStart = Date.now();
  console.log("=".repeat(110));
  console.log("파트 A — scheduled_at NULL 7건 채움");
  console.log("=".repeat(110));

  // 1. CSV / gcal 로드
  const csvRaw = fs.readFileSync(CSV_PATH, "utf8");
  const csvParsed = Papa.parse(csvRaw, { header: true, skipEmptyLines: true });
  const csvByCode = new Map();
  for (const r of csvParsed.data) {
    const c = (r["작업코드"] || "").trim();
    if (c) csvByCode.set(c, r);
  }
  const gcal = JSON.parse(fs.readFileSync(GCAL_PATH, "utf8"));

  // 2. 대상 7건 현재 상태 fetch (백업용)
  const { data: principals } = await sb.from("principals").select("id, code").in("code", ["usol_n", "usol_h"]);
  const pids = principals.map(p => p.id);
  const { data: targets, error: e0 } = await sb.from("tasks")
    .select("id, task_no, status, scheduled_at, completed_at, customer_name, is_legacy")
    .in("task_no", TARGETS)
    .in("principal_id", pids);
  if (e0) throw e0;
  console.log(`\n대상 fetch: ${targets.length}/${TARGETS.length}`);
  if (targets.length !== TARGETS.length) {
    const found = new Set(targets.map(t => t.task_no));
    const missing = TARGETS.filter(c => !found.has(c));
    console.log(`⛔ 누락: ${missing.join(", ")}`);
    process.exit(1);
  }

  // 3. plan 계산 — gcal 우선, CSV fallback
  const plans = [];
  for (const t of targets) {
    const gcalEntry = gcal[t.task_no];
    const gcalAt = gcalEntry?.occurrences?.[0]?.scheduled_at || null;
    const csvRow = csvByCode.get(t.task_no);

    // scheduled_at 결정
    let scheduledAt = null;
    let scheduledSrc = null;
    if (gcalAt) {
      scheduledAt = gcalAt;
      scheduledSrc = "gcal";
    } else if (csvRow) {
      const baseYmd = t.status === "완료"
        ? parseYmd(csvRow["작업완료일"])
        : parseYmd(csvRow["고객컨택일자"]);
      if (baseYmd) {
        const hm = parseHm(csvRow["기사약속시간"]);
        const promiseValid = hm && (hm.h !== 0 || hm.mi !== 0);
        const h = promiseValid ? hm.h : 9;
        const mi = promiseValid ? hm.mi : 0;
        let dt = new Date(Date.UTC(baseYmd.y, baseYmd.mo - 1, baseYmd.d, h - 9, mi, 0));
        if (!promiseValid && t.status === "완료") dt = new Date(dt.getTime() + 2 * 3600 * 1000);
        scheduledAt = dt.toISOString();
        scheduledSrc = "csv";
      }
    }
    if (!scheduledAt) {
      console.log(`⚠️ ${t.task_no} — scheduled_at 산출 실패`);
      continue;
    }

    // completed_at 결정 (완료 + 현재 NULL일 때만, 기존 422 INSERT spec과 동일: scheduled+2h)
    let completedAt = null;
    let completedSrc = null;
    let completedAction = "건드림 X";
    if (t.status === "완료") {
      if (t.completed_at) {
        completedAction = "현재 값 유지";
      } else {
        // 기존 INSERT 스크립트 spec — CSV 완료일+시간이 있으면 그것, 없으면 scheduled+2h
        if (csvRow && parseYmd(csvRow["작업완료일"])) {
          const cy = parseYmd(csvRow["작업완료일"]);
          const hm = parseHm(csvRow["기사약속시간"]);
          const promiseValid = hm && (hm.h !== 0 || hm.mi !== 0);
          const h = promiseValid ? hm.h : 9;
          const mi = promiseValid ? hm.mi : 0;
          let dt = new Date(Date.UTC(cy.y, cy.mo - 1, cy.d, h - 9, mi, 0));
          if (!promiseValid) dt = new Date(dt.getTime() + 2 * 3600 * 1000);
          completedAt = dt.toISOString();
          completedSrc = "csv 완료일+시간";
        } else {
          completedAt = new Date(new Date(scheduledAt).getTime() + 2 * 3600 * 1000).toISOString();
          completedSrc = "scheduled+2h";
        }
        completedAction = `채움 (${completedSrc})`;
      }
    }

    plans.push({
      id: t.id,
      task_no: t.task_no,
      customer: t.customer_name,
      status: t.status,
      before: { scheduled_at: t.scheduled_at, completed_at: t.completed_at },
      after:  { scheduled_at: scheduledAt, completed_at: t.completed_at || completedAt },
      scheduledSrc,
      completedAction,
    });
  }

  console.log("\nplan:");
  for (const p of plans) {
    console.log(`  ${p.task_no} | ${p.customer} | ${p.status}`);
    console.log(`    scheduled_at: ${p.before.scheduled_at || "NULL"} → ${p.after.scheduled_at} (${p.scheduledSrc})`);
    console.log(`    completed_at: ${p.before.completed_at || "NULL"} → ${p.after.completed_at || "NULL"} (${p.completedAction})`);
  }

  // 4. 백업
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `phaseB-scheduled-fill-before-${stamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    targets: targets.map(t => ({
      id: t.id, task_no: t.task_no, customer_name: t.customer_name, status: t.status,
      scheduled_at: t.scheduled_at, completed_at: t.completed_at, is_legacy: t.is_legacy,
    })),
    plans,
  }, null, 2));
  console.log(`\n백업: ${backupFile}`);

  // 5. UPDATE — task별 개별 (스크립트는 7건만 + status 안 건드림)
  console.log("\nUPDATE 시작…");
  for (const p of plans) {
    const patch = { scheduled_at: p.after.scheduled_at };
    if (p.after.completed_at && !p.before.completed_at) {
      patch.completed_at = p.after.completed_at;
    }
    const { error } = await sb.from("tasks").update(patch).eq("id", p.id);
    if (error) {
      console.error(`⛔ ${p.task_no} UPDATE 실패:`, error.message);
      continue;
    }
    console.log(`  ✅ ${p.task_no}`);
  }

  // 6. 검증
  console.log("\n검증:");
  const { data: after } = await sb.from("tasks")
    .select("task_no, status, scheduled_at, completed_at")
    .in("task_no", TARGETS)
    .in("principal_id", pids);
  let okCount = 0;
  for (const a of after) {
    const ok = !!a.scheduled_at;
    if (ok) okCount++;
    console.log(`  ${a.task_no} sched=${a.scheduled_at ? a.scheduled_at.slice(0,16) : "NULL"} comp=${a.completed_at ? a.completed_at.slice(0,16) : "NULL"} ${ok ? "✅" : "⚠️"}`);
  }
  console.log(`\n7건 중 scheduled_at 채워짐: ${okCount}/${TARGETS.length}`);

  // 7. usol 전체 NULL 잔여 확인
  let allUsol = [], from = 0;
  while (true) {
    const { data } = await sb.from("tasks").select("task_no, status, scheduled_at, customer_name")
      .in("principal_id", pids).in("status", ["완료", "확정"]).range(from, from + 999);
    if (!data || data.length === 0) break;
    allUsol = allUsol.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const remaining = allUsol.filter(t => !t.scheduled_at);
  console.log(`\nusol(완료+확정) scheduled_at NULL 잔여: ${remaining.length}건`);
  for (const r of remaining) {
    console.log(`  · ${r.task_no} | ${r.customer_name} | ${r.status} ${EXCLUDED.includes(r.task_no) ? "(spec 제외)" : "⚠️ 예상 외"}`);
  }

  console.log(`\n소요: ${Math.round((Date.now() - tStart) / 1000)}초`);
  console.log("=".repeat(110));
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

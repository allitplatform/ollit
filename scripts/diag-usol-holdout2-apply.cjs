// 유솔 보류 2건 INSERT — 타입 확정 후 적용. 백업 + INSERT + 검증.
// 1) YS-260516-038 (가정집/대형실외기) → work_type='실외기 청소', appliance=NULL, order_type=본작업
// 2) YS-260424-081 (추가선택/벽걸이 → 본작업 교정) → work_type='세척_벽걸이', appliance='벽걸이', order_type=본작업
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
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const HOLDOUT_PATH = path.join(__dirname, "usol-422-holdout-2건.json");
const TENANT = "11111111-1111-1111-1111-111111111111";

// 사장님 확정 매핑
const TYPE_MAP = {
  "YS-260516-038": {
    work_type_id: "0137316f-33d4-4de3-aec1-2d11eeeefee6",  // 실외기 청소
    appliance_type_id: null,
    order_type: "본작업",
    note: "가정집/대형실외기 → 실외기 청소 (본작업)",
  },
  "YS-260424-081": {
    work_type_id: "c530e616-bdcf-4235-9a2e-9db75129a732",  // 세척_벽걸이
    appliance_type_id: "55555555-5555-5555-5555-555555555001",  // 벽걸이
    order_type: "본작업",
    note: "추가선택/벽걸이 → 본작업 세척_벽걸이/벽걸이 교정",
  },
};

function parseYmd(s) {
  if (!s) return null;
  s = String(s).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m) return { y: +m[1], mo: +m[2], d: +m[3], orig: s };
  m = s.match(/^(\d{1,2})\/(\d{1,2})/);
  if (m) return { y: 2026, mo: +m[1], d: +m[2], orig: s, corrected: true };
  return { parseError: true, orig: s };
}
function parseHm(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: +m[1], mi: +m[2] };
}
function toIso(y, mo, d, h = 9, mi = 0) {
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi, 0)).toISOString();
}
function deriveStatus(row, contactYmd, engId) {
  const csvStatus = (row["상태"] || "").trim();
  if (csvStatus === "취소") return "취소";
  if (contactYmd && !contactYmd.parseError) {
    const d = new Date(Date.UTC(contactYmd.y, contactYmd.mo - 1, contactYmd.d));
    const boundary = new Date(Date.UTC(2026, 4, 24));
    return d.getTime() <= boundary.getTime() ? "완료" : "확정";
  }
  if (engId) return "배정";
  return "미배정";
}

(async () => {
  const tStart = Date.now();
  console.log("=".repeat(100));
  console.log("유솔 보류 2건 INSERT — 적용");
  console.log("=".repeat(100));

  // 1. 보류 JSON 로드
  const holdoutData = JSON.parse(fs.readFileSync(HOLDOUT_PATH, "utf8"));
  const holdouts = holdoutData.holdouts;
  console.log(`\n보류 ${holdouts.length}건 로드 — ${holdouts.map(h => h.code).join(", ")}`);

  // 2. 메타 조회 — usol_n principal, category, users
  const { data: principals } = await sb.from("principals").select("id, code");
  const usolN = principals.find(p => p.code === "usol_n");

  // category — 기존 usol_n task에서 가져오기
  const { data: sampleTasks } = await sb.from("tasks").select("category_id").eq("principal_id", usolN.id).limit(1);
  const categoryId = sampleTasks[0].category_id;

  const { data: users } = await sb.from("users").select("id, name").eq("tenant_id", TENANT);
  const userIdByName = new Map((users || []).map(u => [u.name.trim(), u.id]));

  // 3. 사전 검증 — 중복 task_no
  const codes = holdouts.map(h => h.code);
  const { data: dup } = await sb.from("tasks").select("task_no").in("task_no", codes);
  if (dup && dup.length > 0) {
    console.log(`⛔ 중단 — task_no ${dup.length}개가 이미 DB에 존재: ${dup.map(d => d.task_no).join(", ")}`);
    process.exit(1);
  }

  // 4. plan 생성
  const plans = [];
  for (const h of holdouts) {
    const row = h.row;
    const map = TYPE_MAP[h.code];
    if (!map) {
      console.log(`⛔ ${h.code} — TYPE_MAP에 매핑 없음`);
      process.exit(1);
    }

    const contactYmd = parseYmd(row["고객컨택일자"]);
    const completedYmd = parseYmd(row["작업완료일"]);
    const requestYmd = parseYmd(row["요청일자"]);
    const orderYmd = parseYmd(row["주문일시"]);
    const promiseHm = parseHm(row["기사약속시간"]);
    const assignedName = (row["배정기사"] || "").trim();
    const assignedId = assignedName ? (userIdByName.get(assignedName) || null) : null;
    const status = deriveStatus(row, contactYmd, assignedId);

    let scheduledAt = null;
    if (contactYmd && !contactYmd.parseError) {
      const promiseValid = promiseHm && (promiseHm.h !== 0 || promiseHm.mi !== 0);
      const h2 = promiseValid ? promiseHm.h : 9;
      const mi = promiseValid ? promiseHm.mi : 0;
      scheduledAt = toIso(contactYmd.y, contactYmd.mo, contactYmd.d, h2, mi);
    }

    let completedAt = null;
    if (status === "완료" && completedYmd && !completedYmd.parseError) {
      const promiseValid = promiseHm && (promiseHm.h !== 0 || promiseHm.mi !== 0);
      const h2 = promiseValid ? promiseHm.h : 9;
      const mi = promiseValid ? promiseHm.mi : 0;
      let dt = new Date(Date.UTC(completedYmd.y, completedYmd.mo - 1, completedYmd.d, h2 - 9, mi, 0));
      if (!promiseValid) dt = new Date(dt.getTime() + 2 * 3600 * 1000);
      completedAt = dt.toISOString();
    } else if (status === "완료" && scheduledAt) {
      completedAt = new Date(new Date(scheduledAt).getTime() + 2 * 3600 * 1000).toISOString();
    }

    const receivedAt = orderYmd && !orderYmd.parseError ? toIso(orderYmd.y, orderYmd.mo, orderYmd.d, 0, 0) : null;
    const addrConfirm = (row["주소재확인"] || "").trim();
    const address = addrConfirm || (row["주소"] || "").trim();
    const qty = parseInt(row["수량"], 10) || 1;
    const requestNote =
      ((row["배송메세지"] || "").trim()
        ? (row["배송메세지"] || "").trim() + (((row["추천기사"] || "").trim()) ? `\n[추천기사] ${(row["추천기사"]).trim()}` : "")
        : ((row["추천기사"] || "").trim() ? `[추천기사] ${(row["추천기사"]).trim()}` : null)) || null;

    plans.push({
      code: h.code,
      note: map.note,
      task: {
        tenant_id: TENANT,
        task_no: h.code,
        principal_id: usolN.id,
        category_id: categoryId,
        customer_name: (row["수취인명"] || "").trim(),
        phone: (row["수취인연락처1"] || "").trim(),
        address,
        district: (row["지역키워드"] || "").trim() || null,
        channel: (row["채널"] || "").trim() || null,
        external_order_no: (row["주문번호"] || "").trim() || null,
        received_at: receivedAt,
        requested_date: requestYmd && !requestYmd.parseError ? `${requestYmd.y}-${String(requestYmd.mo).padStart(2,"0")}-${String(requestYmd.d).padStart(2,"0")}` : null,
        requested_time: (row["시간구분"] || "").trim() || null,
        assigned_engineer_id: assignedId,
        request_note: requestNote,
        happycall_status: (row["해피콜상태"] || "").trim() || null,
        happycall_memo: (row["해피콜메모"] || "").trim() || null,
        status,
        scheduled_at: scheduledAt,
        completed_at: completedAt,
        is_legacy: true,
      },
      item: {
        work_type_id: map.work_type_id,
        appliance_type_id: map.appliance_type_id,
        qty,
        order_type: map.order_type,
        product_order_id: (row["상품주문번호"] || "").trim() || null,
        unit_price: 0,
      },
    });
  }

  console.log("\nplan:");
  for (const p of plans) {
    console.log(`  · ${p.code} | status=${p.task.status} | ${p.note}`);
    console.log(`      assigned=${p.task.assigned_engineer_id ? "✓" : "✗"} sched=${p.task.scheduled_at ? p.task.scheduled_at.slice(0,16) : "-"} comp=${p.task.completed_at ? p.task.completed_at.slice(0,16) : "-"}`);
  }

  // 5. 백업
  const { count: beforeCount } = await sb.from("tasks").select("id", { count: "exact", head: true }).eq("principal_id", usolN.id);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `usol-holdout2-insert-before-${stamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    before: { usolN_taskCount: beforeCount },
    plans,
  }, null, 2));
  console.log(`\n백업: ${backupFile}`);
  console.log(`  현재 usol_n task: ${beforeCount}`);

  // 6. INSERT (트랜잭션 흉내 — task INSERT 실패 시 즉시 종료, task_items 실패 시 task DELETE 롤백)
  const insertedIds = [];
  try {
    for (const p of plans) {
      const { data: tIns, error: e1 } = await sb.from("tasks").insert(p.task).select("id, task_no").single();
      if (e1) throw new Error(`tasks INSERT 실패 (${p.code}): ${e1.message}`);
      insertedIds.push({ id: tIns.id, code: tIns.task_no });

      const itemRow = { task_id: tIns.id, ...p.item };
      const { error: e2 } = await sb.from("task_items").insert(itemRow);
      if (e2) throw new Error(`task_items INSERT 실패 (${p.code}): ${e2.message}`);
      console.log(`  ✅ ${p.code} INSERT 완료 (task.id=${tIns.id})`);
    }
  } catch (err) {
    console.error(`\n⛔ ${err.message}`);
    console.error(`롤백 — INSERT한 ${insertedIds.length}개 task DELETE…`);
    for (const r of insertedIds) {
      await sb.from("task_items").delete().eq("task_id", r.id);
      await sb.from("tasks").delete().eq("id", r.id);
    }
    console.error("롤백 완료.");
    process.exit(1);
  }

  // 7. 검증
  console.log("\n검증:");
  const { data: vTasks } = await sb.from("tasks").select("task_no, status, principal_id, assigned_engineer_id").in("task_no", codes);
  console.log(`  · tasks INSERT 확인: ${vTasks.length}/${codes.length}`);
  for (const t of vTasks) {
    console.log(`      ${t.task_no} status=${t.status} assigned=${t.assigned_engineer_id ? "✓" : "✗"}`);
  }

  const vTaskIds = vTasks.map(t => t.id).filter(Boolean);
  const { data: vIds2 } = await sb.from("tasks").select("id").in("task_no", codes);
  const { data: vItems } = await sb.from("task_items").select("task_id, work_type_id, appliance_type_id, order_type, qty, unit_price").in("task_id", vIds2.map(x => x.id));
  console.log(`  · task_items INSERT 확인: ${vItems.length}/${codes.length}`);
  for (const it of vItems) {
    console.log(`      task_id=${it.task_id} wt=${it.work_type_id?.slice(0,8)} at=${it.appliance_type_id?.slice(0,8) || "NULL"} order=${it.order_type} qty=${it.qty} up=${it.unit_price}`);
  }

  const { count: afterCount } = await sb.from("tasks").select("id", { count: "exact", head: true }).eq("principal_id", usolN.id);
  const delta = afterCount - beforeCount;
  console.log(`  · usol_n task 수: ${beforeCount} → ${afterCount} (Δ${delta}) ${delta === 2 ? "✅" : "⚠️"}`);
  console.log(`      목표 1327: ${afterCount === 1327 ? "✅" : "⚠️ " + afterCount}`);

  console.log(`\n소요: ${Math.round((Date.now() - tStart) / 1000)}초`);
  console.log("=".repeat(100));
  console.log("완료.");
  console.log("=".repeat(100));
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

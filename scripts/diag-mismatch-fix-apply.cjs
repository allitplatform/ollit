// 적용 스크립트 — 데이터 불일치 30건 + 5/24분 10건 = 40건 일괄 반영.
// 실행 전 백업 JSON 저장 → 그룹별 UPDATE/INSERT/DELETE → 결과 로그.
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

// KST → UTC ISO
function kst(y, m, d, h = 9, mi = 0) {
  return new Date(Date.UTC(y, m - 1, d, h - 9, mi, 0)).toISOString();
}
// scheduled_at + 2h → completed_at
function plus2h(iso) {
  return new Date(new Date(iso).getTime() + 2 * 3600 * 1000).toISOString();
}

// ============================================================
// 대상 정의
// ============================================================
const A_COMPLETE = [
  { task_no: "YS-N-260524-005", cust: "이미경" },                                                  // sched 그대로
  { task_no: "YS-260517-037",   cust: "임수민" },
  { task_no: "YS-260515-024",   cust: "유지은" },
  { task_no: "YS-260515-037",   cust: "김주현" },
  { task_no: "YS-260519-051",   cust: "조윤형" },
  { task_no: "YS-260518-096",   cust: "박병국" },
  { task_no: "YS-260504-029",   cust: "황수연",  newSched: kst(2026, 5, 9, 10) },                   // sched 변경
  { task_no: "YS-260503-001",   cust: "김하진",  newSched: kst(2026, 5, 9, 14) },
  { task_no: "YS-N-260524-004", cust: "홍순택",  newSched: kst(2026, 5, 13, 11) },
  { task_no: "YS-260516-169",   cust: "박정훈",  newSched: kst(2026, 5, 21, 11) },
];

const B_SCHED = [
  { task_no: "YS-260518-086",   cust: "공영미",  newSched: kst(2026, 5, 27, 10) },
  { task_no: "YS-260430-010",   cust: "최민희",  newSched: kst(2026, 5, 4, 10)  },
  { task_no: "YS-260512-021",   cust: "김시윤",  newSched: kst(2026, 5, 18, 10) },
  { task_no: "YS-260516-069",   cust: "오아름",  newSched: kst(2026, 5, 22, 10) },
  { task_no: "YS-N-260524-007", cust: "양재훈",  newSched: kst(2026, 5, 23, 10) },
  { task_no: "YS-N-260524-011", cust: "유은진",  newSched: kst(2026, 5, 26, 10) },
  { task_no: "YS-260428-055",   cust: "강주희",  newSched: kst(2026, 5, 4, 10)  },
  { task_no: "YS-N-260524-003", cust: "손동원",  newSched: kst(2026, 5, 17, 10) },
  { task_no: "YS-N-260524-002", cust: "이서현",  newSched: kst(2026, 5, 19, 10) },
  { task_no: "YS-N-260524-008", cust: "이영수",  newSched: kst(2026, 5, 25, 10) },
  { task_no: "YS-260520-016",   cust: "김복주",  newSched: kst(2026, 5, 25, 16, 30) },
  { task_no: "YS-260518-085",   cust: "주상은",  newSched: kst(2026, 6, 1, 14) },
  { task_no: "YS-260517-039",   cust: "김호연",  newSched: kst(2026, 6, 1, 15, 15) },
  { task_no: "YS-260520-021",   cust: "김종윤",  newSched: kst(2026, 6, 2, 16, 30) },
];

const C_COMP_ONLY = [
  { task_no: "YS-260425-010", cust: "손원주", newComp: kst(2026, 5, 18, 18) },
];

const D_PARTIAL = [
  { task_no: "YS-260501-011", cust: "황우현", newQty: 1 },
];

const E_CANCEL_DELETE_PAY = [
  { task_no: "YS-260512-063", cust: "강유미" },
  { task_no: "YS-260430-023", cust: "윤지영" },
];

const F_REVERT_COMPLETED = [
  { task_no: "YS-260516-162", cust: "이지은", newStatus: "확정", newSched: kst(2026, 5, 31, 9) },
];

const G_INSERT = {
  task_no: "YS-260427-004",
  cust: "한인규",
  phone: "010-4096-1105",
  address: "서울 강서구 마곡서로 133 709동 1101호",
  engineerName: "김동효",
  principalCode: "usol_h",
  categoryCode: "aircon",
  workTypeCode: "clean_wall",
  applianceTypeCode: "wall",
  qty: 1,
  unitPrice: 61479,
  productPrice: 65100,
  scheduledAt: kst(2026, 5, 6, 13),
  completedAt: kst(2026, 5, 6, 15),     // sched + 2h
  requestNote: "벽걸이 하나더 추가, 현장 결재",
};

// 5/24 KST scheduled_at 작업 10건 (전부 확정, payments 있음)
const DAY24 = [
  "YS-260519-015", // 박수호
  "YS-260518-098", // 신유미
  "YS-260516-012", // 김문수
  "YS-260521-013", // 백소영
  "YS-260516-157", // 갈시아
  "YS-260516-158", // 최루리
  "YS-260518-040", // 주연진
  "YS-260515-061", // 유미라
  "YS-260518-049", // 남혜정
  "YS-260517-033", // 임소영
];

const TENANT = "11111111-1111-1111-1111-111111111111";

// ============================================================
// 백업
// ============================================================
async function backupAll() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `mismatch-fix-${stamp}.json`);

  const taskNos = [
    ...A_COMPLETE.map(x => x.task_no),
    ...B_SCHED.map(x => x.task_no),
    ...C_COMP_ONLY.map(x => x.task_no),
    ...D_PARTIAL.map(x => x.task_no),
    ...E_CANCEL_DELETE_PAY.map(x => x.task_no),
    ...F_REVERT_COMPLETED.map(x => x.task_no),
    G_INSERT.task_no,
    ...DAY24,
  ];

  const { data: tasks } = await sb.from("tasks").select("*").in("task_no", taskNos);
  const taskIds = (tasks || []).map(t => t.id);
  const safeIds = taskIds.length ? taskIds : ["00000000-0000-0000-0000-000000000000"];
  const { data: payments }   = await sb.from("payments").select("*").in("task_id", safeIds);
  const { data: task_items } = await sb.from("task_items").select("*").in("task_id", safeIds);

  fs.writeFileSync(file, JSON.stringify({
    timestamp: new Date().toISOString(),
    targets: { A_COMPLETE, B_SCHED, C_COMP_ONLY, D_PARTIAL, E_CANCEL_DELETE_PAY, F_REVERT_COMPLETED, G_INSERT, DAY24 },
    tasks: tasks || [],
    payments: payments || [],
    task_items: task_items || [],
  }, null, 2));

  console.log(`백업 저장: ${file}`);
  console.log(`  tasks=${(tasks || []).length} payments=${(payments || []).length} task_items=${(task_items || []).length}`);
  return { file, tasks: tasks || [] };
}

// ============================================================
// 유틸 — task_no → task row
// ============================================================
async function getTask(task_no) {
  const { data } = await sb.from("tasks").select("*").eq("task_no", task_no).maybeSingle();
  return data;
}
async function hasPayment(taskId) {
  const { data } = await sb.from("payments").select("id").eq("task_id", taskId).limit(1);
  return (data || []).length > 0;
}
async function touchTaskItem(taskId) {
  // task_items.qty를 같은 값으로 UPDATE → AFTER UPDATE trigger fire → compute_payment 측 catch
  const { data: items } = await sb.from("task_items").select("id, qty").eq("task_id", taskId).limit(1);
  if (!items || items.length === 0) return false;
  const { error } = await sb.from("task_items").update({ qty: items[0].qty }).eq("id", items[0].id);
  return !error;
}

// ============================================================
// A. 완료 처리 — payments 있으면 UPDATE만 / 없으면 UPDATE + task_items touch
// ============================================================
async function applyA() {
  console.log("\n【A. 완료 처리 (10건)】");
  let ok = 0, miss = 0;
  for (const x of A_COMPLETE) {
    const t = await getTask(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} ${x.cust} — DB 없음`); miss++; continue; }
    const sched = x.newSched || t.scheduled_at;
    const comp  = plus2h(sched);
    const patch = { status: "완료", completed_at: comp };
    if (x.newSched) patch.scheduled_at = x.newSched;
    const { error } = await sb.from("tasks").update(patch).eq("id", t.id);
    if (error) { console.log(`  ❌ ${x.task_no} ${x.cust} — ${error.message}`); miss++; continue; }
    const hasPay = await hasPayment(t.id);
    if (!hasPay) {
      const fired = await touchTaskItem(t.id);
      const recheck = await hasPayment(t.id);
      console.log(`  ✅ ${x.task_no} ${x.cust} — UPDATE + touch(${fired ? "OK" : "FAIL"}) → pay=${recheck ? "○" : "×"}`);
    } else {
      console.log(`  ✅ ${x.task_no} ${x.cust} — UPDATE (pay 측 catch)`);
    }
    ok++;
  }
  console.log(`  → 성공 ${ok}건 / 실패 ${miss}건`);
}

// ============================================================
// B. scheduled_at만
// ============================================================
async function applyB() {
  console.log("\n【B. 일정만 수정 (14건)】");
  let ok = 0, miss = 0;
  for (const x of B_SCHED) {
    const t = await getTask(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} ${x.cust} — DB 없음`); miss++; continue; }
    const { error } = await sb.from("tasks").update({ scheduled_at: x.newSched }).eq("id", t.id);
    if (error) { console.log(`  ❌ ${x.task_no} ${x.cust} — ${error.message}`); miss++; continue; }
    console.log(`  ✅ ${x.task_no} ${x.cust} → sched=${x.newSched.slice(0,16)}`);
    ok++;
  }
  console.log(`  → 성공 ${ok}건 / 실패 ${miss}건`);
}

// ============================================================
// C. completed_at만
// ============================================================
async function applyC() {
  console.log("\n【C. 완료일 수정 (1건)】");
  let ok = 0, miss = 0;
  for (const x of C_COMP_ONLY) {
    const t = await getTask(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} ${x.cust} — DB 없음`); miss++; continue; }
    const { error } = await sb.from("tasks").update({ completed_at: x.newComp }).eq("id", t.id);
    if (error) { console.log(`  ❌ ${x.task_no} ${x.cust} — ${error.message}`); miss++; continue; }
    console.log(`  ✅ ${x.task_no} ${x.cust} → comp=${x.newComp.slice(0,16)}`);
    ok++;
  }
  console.log(`  → 성공 ${ok}건 / 실패 ${miss}건`);
}

// ============================================================
// D. 부분 취소 — task_items.qty 변경 (trigger fire)
// ============================================================
async function applyD() {
  console.log("\n【D. 부분 취소 (1건)】");
  let ok = 0, miss = 0;
  for (const x of D_PARTIAL) {
    const t = await getTask(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} ${x.cust} — DB 없음`); miss++; continue; }
    const { data: items } = await sb.from("task_items").select("id, order_type, qty").eq("task_id", t.id);
    const mainItem = (items || []).find(it => it.order_type === '본작업') || (items || [])[0];
    if (!mainItem) { console.log(`  ❌ ${x.task_no} — task_item 없음`); miss++; continue; }
    const { error } = await sb.from("task_items").update({ qty: x.newQty }).eq("id", mainItem.id);
    if (error) { console.log(`  ❌ ${x.task_no} ${x.cust} — ${error.message}`); miss++; continue; }
    console.log(`  ✅ ${x.task_no} ${x.cust} → task_item ${mainItem.id.slice(0,8)} qty ${mainItem.qty}→${x.newQty} (trigger fire 측 catch)`);
    ok++;
  }
  console.log(`  → 성공 ${ok}건 / 실패 ${miss}건`);
}

// ============================================================
// E. 취소 + payments DELETE
// ============================================================
async function applyE() {
  console.log("\n【E. 취소 + payments DELETE (2건)】");
  let ok = 0, miss = 0;
  for (const x of E_CANCEL_DELETE_PAY) {
    const t = await getTask(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} ${x.cust} — DB 없음`); miss++; continue; }
    const { error: e1 } = await sb.from("tasks").update({ status: "취소", completed_at: null }).eq("id", t.id);
    if (e1) { console.log(`  ❌ ${x.task_no} task UPDATE — ${e1.message}`); miss++; continue; }
    const { error: e2 } = await sb.from("payments").delete().eq("task_id", t.id);
    if (e2) { console.log(`  ❌ ${x.task_no} payments DELETE — ${e2.message}`); miss++; continue; }
    console.log(`  ✅ ${x.task_no} ${x.cust} → 취소 + payments DELETE`);
    ok++;
  }
  console.log(`  → 성공 ${ok}건 / 실패 ${miss}건`);
}

// ============================================================
// F. 완료 되돌림 + payments DELETE
// ============================================================
async function applyF() {
  console.log("\n【F. 완료 되돌림 + payments DELETE (1건)】");
  let ok = 0, miss = 0;
  for (const x of F_REVERT_COMPLETED) {
    const t = await getTask(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} ${x.cust} — DB 없음`); miss++; continue; }
    const { error: e1 } = await sb.from("tasks").update({ status: x.newStatus, scheduled_at: x.newSched, completed_at: null }).eq("id", t.id);
    if (e1) { console.log(`  ❌ ${x.task_no} task UPDATE — ${e1.message}`); miss++; continue; }
    const { error: e2 } = await sb.from("payments").delete().eq("task_id", t.id);
    if (e2) { console.log(`  ❌ ${x.task_no} payments DELETE — ${e2.message}`); miss++; continue; }
    console.log(`  ✅ ${x.task_no} ${x.cust} → ${x.newStatus} + sched=${x.newSched.slice(0,16)} + payments DELETE`);
    ok++;
  }
  console.log(`  → 성공 ${ok}건 / 실패 ${miss}건`);
}

// ============================================================
// G. 신규 INSERT
// ============================================================
async function applyG() {
  console.log("\n【G. 신규 task INSERT (1건 — 한인규)】");
  const g = G_INSERT;
  const { data: dup } = await sb.from("tasks").select("id").eq("task_no", g.task_no).maybeSingle();
  if (dup) { console.log(`  ❌ ${g.task_no} — 이미 측 catch (skip)`); return; }

  // 측 catch ID lookup
  const [{ data: eng }, { data: prin }, { data: cat }, { data: wt }, { data: at }] = await Promise.all([
    sb.from("users").select("id").eq("name", g.engineerName).maybeSingle(),
    sb.from("principals").select("id").eq("code", g.principalCode).maybeSingle(),
    sb.from("categories").select("id").eq("code", g.categoryCode).maybeSingle(),
    sb.from("work_types").select("id").eq("code", g.workTypeCode).maybeSingle(),
    sb.from("appliance_types").select("id").eq("code", g.applianceTypeCode).maybeSingle(),
  ]);
  if (!eng || !prin || !cat || !wt || !at) {
    console.log(`  ❌ 측 catch ID 측 catch X — eng=${!!eng} prin=${!!prin} cat=${!!cat} wt=${!!wt} at=${!!at}`);
    return;
  }

  // tasks INSERT
  const { data: newTask, error: et } = await sb.from("tasks").insert({
    tenant_id: TENANT,
    task_no: g.task_no,
    principal_id: prin.id,
    category_id: cat.id,
    customer_name: g.cust,
    phone: g.phone,
    address: g.address,
    assigned_engineer_id: eng.id,
    status: "완료",
    scheduled_at: g.scheduledAt,
    completed_at: g.completedAt,
    product_price: g.productPrice,
    request_note: g.requestNote,
  }).select().single();
  if (et) { console.log(`  ❌ tasks INSERT — ${et.message}`); return; }

  // task_items INSERT → trigger 측 catch payments 자동
  const { error: ei } = await sb.from("task_items").insert({
    task_id: newTask.id,
    work_type_id: wt.id,
    appliance_type_id: at.id,
    qty: g.qty,
    unit_price: g.unitPrice,
    order_type: "본작업",
  });
  if (ei) { console.log(`  ❌ task_items INSERT — ${ei.message}`); return; }

  const hasPay = await hasPayment(newTask.id);
  console.log(`  ✅ ${g.task_no} ${g.cust} INSERT 측 catch → pay=${hasPay ? "○" : "×"}`);
}

// ============================================================
// 5/24분 10건 — status='완료' + completed_at = sched+2h
// ============================================================
async function applyDay24() {
  console.log("\n【5/24 측 catch 완료 처리 (10건)】");
  let ok = 0, miss = 0;
  for (const task_no of DAY24) {
    const t = await getTask(task_no);
    if (!t) { console.log(`  ❌ ${task_no} — DB 없음`); miss++; continue; }
    if (!t.scheduled_at) { console.log(`  ❌ ${task_no} — sched 측 catch X`); miss++; continue; }
    const comp = plus2h(t.scheduled_at);
    const { error } = await sb.from("tasks").update({ status: "완료", completed_at: comp }).eq("id", t.id);
    if (error) { console.log(`  ❌ ${task_no} — ${error.message}`); miss++; continue; }
    const hasPay = await hasPayment(t.id);
    if (!hasPay) {
      const fired = await touchTaskItem(t.id);
      const recheck = await hasPayment(t.id);
      console.log(`  ✅ ${task_no} → comp=${comp.slice(0,16)} + touch(${fired ? "OK" : "FAIL"}) → pay=${recheck ? "○" : "×"}`);
    } else {
      console.log(`  ✅ ${task_no} → comp=${comp.slice(0,16)} (pay 측 catch)`);
    }
    ok++;
  }
  console.log(`  → 성공 ${ok}건 / 실패 ${miss}건`);
}

// ============================================================
// main
// ============================================================
(async () => {
  console.log("=".repeat(120));
  console.log("적용 — 데이터 불일치 30건 + 5/24분 10건 = 40건");
  console.log("=".repeat(120));

  await backupAll();

  await applyA();        // 10건 — 완료 처리
  await applyB();        // 14건 — sched만
  await applyC();        //  1건 — comp만
  await applyD();        //  1건 — 부분 취소 (task_items.qty → trigger)
  await applyE();        //  2건 — 취소 + payments DELETE
  await applyF();        //  1건 — 측 catch 측 catch + payments DELETE
  await applyG();        //  1건 — 신규 INSERT
  await applyDay24();    // 10건 — 5/24 완료 처리

  console.log("\n" + "=".repeat(120));
  console.log("적용 완료.");
  console.log("=".repeat(120));
})().catch(e => console.log("FATAL:", e.message, e.stack));

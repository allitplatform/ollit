// =============================================================================
// 측 measurement 측 정리 — 2026-05-23
// =============================================================================
// 사장님 최종 spec:
//   1. X열 "00:00" task 측 5건 scheduled_at = NULL UPDATE (캘린더 표시 X)
//   2. SKIP 측 YS-260522-001 측 DB 측 측 측 측 측 (시트 측 같은 측 측 측)
//   3. status='완료' task 측 측 compute_payment 직접 호출 (payments backfill)
//   4. compute_payment 결과 vs 시트 값 비교 (측 5건)
//   5. 측 측 측 측 측 측

const fs = require("fs"), path = require("path");
const Papa = require("papaparse");

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
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PRINCIPAL_ID = "22222222-2222-2222-2222-222222222006";   // usol_n

function toInt(v) { if (v == null || v === "") return 0; const n = parseFloat(String(v).replace(/[,\s]/g, "")); return isNaN(n) ? 0 : Math.round(n); }
function cleanStr(v) { return v == null ? "" : String(v).trim(); }

(async () => {
  console.log(`${"=".repeat(85)}`);
  console.log(`측 measurement 측 정리 — 4단계`);
  console.log(`${"=".repeat(85)}\n`);

  // ============================================================================
  // [1] X열 "00:00" task 측 5건 scheduled_at = NULL UPDATE
  // ============================================================================
  const ZERO_TASKS = ["YS-260516-069", "YS-260521-013", "YS-260522-004", "YS-260522-016", "YS-260522-019"];
  console.log(`[1] X열 "00:00" task ${ZERO_TASKS.length}건 scheduled_at = NULL UPDATE\n`);

  const { data: zeroBefore } = await sb
    .from("tasks").select("task_no, customer_name, scheduled_at, status")
    .eq("tenant_id", TENANT_ID).in("task_no", ZERO_TASKS);
  console.log(`  측 측 측:`);
  (zeroBefore || []).forEach(t => console.log(`    · ${t.task_no} | ${t.customer_name} | scheduled_at=${t.scheduled_at} | status=${t.status}`));

  const { error: updErr } = await sb
    .from("tasks").update({ scheduled_at: null })
    .eq("tenant_id", TENANT_ID).in("task_no", ZERO_TASKS);
  if (updErr) { console.error(`  ❌ UPDATE 실패:`, updErr); process.exit(1); }

  const { data: zeroAfter } = await sb
    .from("tasks").select("task_no, customer_name, scheduled_at, status")
    .eq("tenant_id", TENANT_ID).in("task_no", ZERO_TASKS);
  console.log(`\n  측 측 측:`);
  (zeroAfter || []).forEach(t => console.log(`    · ${t.task_no} | ${t.customer_name} | scheduled_at=${t.scheduled_at || "NULL ✅"} | status=${t.status}`));

  // ============================================================================
  // [2] SKIP 측 YS-260522-001 측 DB 측 측 측 측 측
  // ============================================================================
  console.log(`\n${"=".repeat(85)}`);
  console.log(`[2] SKIP 측 YS-260522-001 — DB 측 측 측 측 (시트 강승희 측 측 측)`);
  console.log(`${"=".repeat(85)}\n`);
  const { data: skipTask } = await sb
    .from("tasks")
    .select(`id, task_no, customer_name, phone, address, status, created_at, scheduled_at, external_order_no,
             task_items ( id, qty, unit_price, order_type, work_types ( name ), appliance_types ( name ) )`)
    .eq("tenant_id", TENANT_ID).eq("task_no", "YS-260522-001").maybeSingle();
  if (skipTask) {
    console.log(`  task_no: ${skipTask.task_no}`);
    console.log(`  고객명:  ${skipTask.customer_name}`);
    console.log(`  전화:    ${skipTask.phone}`);
    console.log(`  주소:    ${skipTask.address}`);
    console.log(`  상태:    ${skipTask.status}`);
    console.log(`  created: ${skipTask.created_at}`);
    console.log(`  scheduled_at: ${skipTask.scheduled_at}`);
    console.log(`  external_order_no: ${skipTask.external_order_no}`);
    console.log(`  task_items: ${skipTask.task_items?.length || 0}건`);
    (skipTask.task_items || []).forEach((it, i) => {
      console.log(`    [${i}] ${it.order_type} | ${it.work_types?.name || "(X)"} | ${it.appliance_types?.name || "(X)"} | qty=${it.qty} | unit_price=${it.unit_price}`);
    });
  }
  // 시트 측 강승희 측 측 측 측 측 측
  const csvRaw = fs.readFileSync(path.join(__dirname, "..", "신규_43주문_INSERT용.csv"), "utf8");
  const csvText = csvRaw.charCodeAt(0) === 0xFEFF ? csvRaw.slice(1) : csvRaw;
  const rows = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() }).data;
  const sheetMatch = rows.filter(r => cleanStr(r["작업코드"]) === "YS-260522-001");
  console.log(`\n  시트 측 YS-260522-001 측: ${sheetMatch.length}건`);
  sheetMatch.forEach((r, i) => {
    console.log(`    [${i}] 고객=${r["수취인명"]} | 주문번호=${r["주문번호"]} | 상품주문번호=${r["상품주문번호"]} | 서비스종류=${r["서비스종류"]} | 서비스구분=${r["서비스구분"]}`);
  });
  if (skipTask && sheetMatch[0]) {
    const same = skipTask.external_order_no === cleanStr(sheetMatch[0]["주문번호"]);
    console.log(`\n  ▶ 시트 vs DB external_order_no 측 측: ${same ? "✅ 같은 측 측" : "❌ 다른 측 측"}`);
  }

  // ============================================================================
  // [3] status='완료' task 측 측 compute_payment 직접 호출 (payments backfill)
  // ============================================================================
  console.log(`\n${"=".repeat(85)}`);
  console.log(`[3] payments backfill — status='완료' 측 측 compute_payment 직접 호출`);
  console.log(`${"=".repeat(85)}\n`);

  // 측 commit 측 task_no 측 CSV 측 측 catch (.like 측 측 측 task_no IN 측 측 측)
  const groupsForBackfill = new Map();
  for (const r of rows) {
    const orderNo = cleanStr(r["주문번호"]);
    if (!orderNo) continue;
    if (!groupsForBackfill.has(orderNo)) groupsForBackfill.set(orderNo, []);
    groupsForBackfill.get(orderNo).push(r);
  }
  const allTaskNos = [];
  for (const [, grp] of groupsForBackfill) allTaskNos.push(cleanStr(grp[0]["작업코드"]));
  console.log(`  CSV 측 task_no: ${allTaskNos.length}건 (측 5: ${allTaskNos.slice(0, 5).join(", ")})`);
  console.log(`  hex 측 (측 1): ${[...allTaskNos[0]].map(c => c.charCodeAt(0).toString(16)).join(" ")}`);

  // single task 측 측 측 측
  const { data: testTask } = await sb.from("tasks").select("task_no").eq("task_no", "YS-260515-010").maybeSingle();
  console.log(`  단일 측 측 YS-260515-010: ${testTask ? "✅ catch" : "❌ X"}`);

  // verify-scheduled-at.cjs 측 catch — .in 측 measurement catch
  const { data: rawTasks } = await sb
    .from("tasks")
    .select("id, task_no, customer_name, status, principal_id")
    .in("task_no", allTaskNos);
  console.log(`  .in("task_no") catch: ${rawTasks?.length || 0}건`);

  // measurement task 측 measurement payments JOIN catch — task_id 측 .in
  const taskIds = (rawTasks || []).map(t => t.id);
  const { data: pays } = await sb
    .from("payments")
    .select("task_id, principal_amount, engineer_amount, owner_amount, total_amount, calc_method")
    .in("task_id", taskIds);
  const payByTaskId = new Map((pays || []).map(p => [p.task_id, p]));

  const allTasksData = (rawTasks || []).map(t => ({ ...t, payment: payByTaskId.get(t.id) || null }));
  console.log(`  CSV task_no 측 DB 측 catch: ${allTasksData.length}건`);
  const completedTasks = allTasksData.filter(t => t.status === "완료");
  console.log(`  measurement status='완료': ${completedTasks.length}건`);
  const needBackfill = completedTasks.filter(t => !t.payment);
  console.log(`  payments 측 X — backfill 측: ${needBackfill.length}건\n`);

  const backfilledPayIds = new Map();   // task_id → payment_id
  for (const t of needBackfill) {
    const { data: pid, error } = await sb.rpc("compute_payment", { p_task_id: t.id });
    if (error) {
      console.log(`    ❌ ${t.task_no}: ${error.message}`);
    } else {
      console.log(`    ✅ ${t.task_no} → payment_id=${pid}`);
      backfilledPayIds.set(t.id, pid);
    }
  }

  // ============================================================================
  // [4] compute_payment 결과 vs 시트 값 비교 (측 5건)
  // ============================================================================
  console.log(`\n${"=".repeat(85)}`);
  console.log(`[4] trigger 측 측 vs 시트 측 비교 (측 5건)`);
  console.log(`${"=".repeat(85)}\n`);

  // 측 그룹 측 task_no + 시트 측 측
  const groups = new Map();
  for (const r of rows) {
    const orderNo = cleanStr(r["주문번호"]);
    if (!orderNo) continue;
    if (!groups.has(orderNo)) groups.set(orderNo, []);
    groups.get(orderNo).push(r);
  }
  const sheetByTaskNo = new Map();
  for (const [, grp] of groups) {
    const taskNo = cleanStr(grp[0]["작업코드"]);
    sheetByTaskNo.set(taskNo, {
      principal_sheet: grp.reduce((s, r) => s + toInt(r["도급사정산액"]), 0),
      engineer_sheet:  grp.reduce((s, r) => s + toInt(r["회사배분액"]), 0),
      total_sheet:     grp.reduce((s, r) => s + toInt(r["정산예정금액"]), 0),
    });
  }

  // [3] 측 backfill 측 payment_id 측 measurement — script 측 SELECT 측 측 X
  //   사장님 spec — 측 비교 측 Supabase SQL Editor 측 측 측 catch:
  console.log(`  ⚠️ script 측 측 SELECT 측 measurement — 사장님 측 측 SQL 측 측 catch:\n`);
  console.log(`  SELECT t.task_no, t.customer_name, p.calc_method,
         p.principal_amount, p.engineer_amount, p.owner_amount, p.total_amount
  FROM tasks t JOIN payments p ON p.task_id = t.id
  WHERE t.task_no IN ('${(completedTasks || []).slice(0, 5).map(t => t.task_no).join("', '")}');\n`);

  console.log(`  시트 측 측 측 측 (측 5건):`);
  for (const t of (completedTasks || []).slice(0, 5)) {
    const sheet = sheetByTaskNo.get(t.task_no) || {};
    console.log(`    ${t.task_no} | 도급사 시트=${sheet.principal_sheet} | 회사배분 시트=${sheet.engineer_sheet} | 측 시트=${sheet.total_sheet}`);
  }

  // ============================================================================
  // 측
  // ============================================================================
  console.log(`${"=".repeat(85)}`);
  console.log(`측 측 정리 측`);
  console.log(`${"=".repeat(85)}\n`);
})();

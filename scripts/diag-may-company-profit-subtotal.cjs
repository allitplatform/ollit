// 2026-06-02 — 5월 완료 usol_n 회사 수익 진단 (subtotal 기준, 정산 전 예상금액 포함).
//
// 모집단: completed_at KST 5월, status='완료', 활성, usol_n, subtotal>0.
//   파주시 제외 옵션 = poid NULL 측 측.
//
// 분석:
//   1. 회사 배분액 = SUM(subtotal) × 0.85 (task_item 단위, net NULL 건도 subtotal 측 포함)
//   2. 기사 지급 = SUM(payments.engineer_amount) (task 단위)
//      · net NULL task 측 engineer_amount 측 measure 측 catch (안 됐으면 몇 건)
//   3. 회사 수익 = 회사 배분액 - 기사 지급
//   4. 대조 — SUM(owner_amount) vs (배분액 - 기사 지급) 일치 catch
//   5. 참고 — net 기준 (이전 78.2M) vs subtotal 기준 차이
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";
const FACTOR = 0.85;
const MAY_START_UTC = "2026-04-30T15:00:00Z";
const MAY_END_UTC   = "2026-05-31T15:00:00Z";

(async () => {
  console.log("=".repeat(110));
  console.log("5월 완료 usol_n 회사 수익 진단 (subtotal 기준)");
  console.log("=".repeat(110));

  // 1. task_items fetch.
  const PAGE = 1000;
  const all = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await sb.from("task_items")
      .select(`id, task_id, net_amount, subtotal, is_canceled, product_order_id,
               tasks!inner(task_no, customer_name, status, principal_id, completed_at)`)
      .eq("tasks.principal_id", PID)
      .eq("tasks.status", "완료")
      .gte("tasks.completed_at", MAY_START_UTC)
      .lt("tasks.completed_at", MAY_END_UTC)
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  const active = all.filter(it => it.is_canceled !== true);
  const activeSubPos = active.filter(it => Number(it.subtotal) > 0);
  const activeSubPosWithPoid = activeSubPos.filter(it => it.product_order_id);

  console.log(`\n  fetch (cancel 무관)          : ${all.length}건`);
  console.log(`  active (is_canceled 제외)     : ${active.length}건`);
  console.log(`  + subtotal > 0                : ${activeSubPos.length}건`);
  console.log(`  + product_order_id NOT NULL  : ${activeSubPosWithPoid.length}건  (파주시 제외)`);

  // 2. 회사 배분액 = SUM(subtotal) × 0.85.
  function distrib(items, label) {
    const sumSubtotal = items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
    const sumNetWithNet = items
      .filter(it => it.net_amount != null)
      .reduce((s, it) => s + Number(it.net_amount), 0);
    const sumNetAll = items
      .reduce((s, it) => s + (Number(it.net_amount) || 0), 0);
    const companyDistribSub = Math.round(sumSubtotal * FACTOR);
    const companyDistribNet = Math.round(sumNetWithNet * FACTOR);
    const netNullCount = items.filter(it => it.net_amount == null).length;
    console.log(`\n  ─── ${label} ───`);
    console.log(`    items            = ${items.length}건`);
    console.log(`    SUM(subtotal)    = ₩${sumSubtotal.toLocaleString()}`);
    console.log(`    × 0.85 (배분액)   = ₩${companyDistribSub.toLocaleString()}  ★ subtotal 기준 (net NULL 포함)`);
    console.log(`    SUM(net 측 측)    = ₩${sumNetWithNet.toLocaleString()}  (net NOT NULL 측만, ${items.length - netNullCount}건)`);
    console.log(`    × 0.85 (참고)     = ₩${companyDistribNet.toLocaleString()}  ← 78.2M 측 measure (net 기준)`);
    console.log(`    diff (sub - net) = ₩${(companyDistribSub - companyDistribNet).toLocaleString()}  ← net NULL ${netNullCount}건 분`);
    return { items, sumSubtotal, companyDistribSub, sumNetWithNet, companyDistribNet };
  }

  const M_active = distrib(active, "(A) 활성 측 (cancel 측 측 제외)");
  const M_subPos = distrib(activeSubPos, "(B) + subtotal > 0");
  const M_noPaju = distrib(activeSubPosWithPoid, "(C) + poid NOT NULL (파주시 제외)");

  // 3. 기사 지급 + owner_amount — task 단위 payments fetch.
  const taskIds = [...new Set(activeSubPos.map(it => it.task_id))];
  const taskIdsNoPaju = [...new Set(activeSubPosWithPoid.map(it => it.task_id))];

  // payments fetch — task_ids chunk.
  async function fetchPayments(ids) {
    const all = [];
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { data, error } = await sb.from("payments")
        .select("task_id, engineer_amount, principal_amount, owner_amount, product_price, extra_fee, travel_fee, track")
        .in("task_id", chunk);
      if (error) { console.error(error); process.exit(1); }
      if (data) all.push(...data);
    }
    return all;
  }

  console.log("\n  ─── payments fetch ───");
  const payments = await fetchPayments(taskIds);
  const paymentsByTaskId = new Map();
  for (const p of payments) paymentsByTaskId.set(p.task_id, p);
  const hasPayment = taskIds.filter(id => paymentsByTaskId.has(id));
  const noPayment = taskIds.filter(id => !paymentsByTaskId.has(id));
  console.log(`    (B) task 측 unique           : ${taskIds.length}건`);
  console.log(`    payments 측 존재            : ${hasPayment.length}건`);
  console.log(`    payments 측 측 (engineer 측 측 측): ${noPayment.length}건  ← 측 측 측 측 측 측 측`);

  // net NULL task 측 measure 측 catch.
  // task 측 분류 — task 측 task_items 모두 측 net NULL 측, 측 net 측, 측 측 측.
  const taskNetClass = new Map(); // task_id → "all_null" | "mixed" | "all_set"
  for (const it of activeSubPos) {
    const cls = taskNetClass.get(it.task_id);
    const isNull = it.net_amount == null;
    if (cls === undefined) {
      taskNetClass.set(it.task_id, isNull ? "all_null" : "all_set");
    } else if (cls === "all_null" && !isNull) taskNetClass.set(it.task_id, "mixed");
    else if (cls === "all_set" && isNull)     taskNetClass.set(it.task_id, "mixed");
  }
  let cAllNull = 0, cMixed = 0, cAllSet = 0;
  let cAllNullPay = 0, cMixedPay = 0, cAllSetPay = 0;
  for (const [id, cls] of taskNetClass) {
    const hasPay = paymentsByTaskId.has(id);
    if (cls === "all_null") { cAllNull++; if (hasPay) cAllNullPay++; }
    else if (cls === "mixed") { cMixed++; if (hasPay) cMixedPay++; }
    else { cAllSet++; if (hasPay) cAllSetPay++; }
  }
  console.log("\n  ─── net NULL task 측 payments 측 catch ───");
  console.log(`    all_null task (모든 item net NULL) : ${cAllNull}건  → payments 측 ${cAllNullPay}건`);
  console.log(`    mixed task (일부만 net NULL)      : ${cMixed}건  → payments 측 ${cMixedPay}건`);
  console.log(`    all_set task (모든 item net 측)   : ${cAllSet}건  → payments 측 ${cAllSetPay}건`);

  // 4. 기사 지급 / owner 합계 (B = subtotal > 0 task).
  function sumPayments(ids, label) {
    let sumEng = 0, sumPrin = 0, sumOwner = 0, sumProductPrice = 0, sumExtra = 0;
    let n = 0, missing = 0;
    for (const id of ids) {
      const p = paymentsByTaskId.get(id);
      if (!p) { missing++; continue; }
      n++;
      sumEng += Number(p.engineer_amount) || 0;
      sumPrin += Number(p.principal_amount) || 0;
      sumOwner += Number(p.owner_amount) || 0;
      sumProductPrice += Number(p.product_price) || 0;
      sumExtra += Number(p.extra_fee) || 0;
    }
    console.log(`\n  ─── ${label} payments 합계 (${n}건 / 누락 ${missing}건) ───`);
    console.log(`    SUM(engineer_amount)  = ₩${sumEng.toLocaleString()}`);
    console.log(`    SUM(principal_amount) = ₩${sumPrin.toLocaleString()}`);
    console.log(`    SUM(owner_amount)     = ₩${sumOwner.toLocaleString()}`);
    console.log(`    SUM(product_price)    = ₩${sumProductPrice.toLocaleString()}  (usol_n 측 = SUM(subtotal) per task)`);
    console.log(`    SUM(extra_fee)        = ₩${sumExtra.toLocaleString()}`);
    return { sumEng, sumPrin, sumOwner, sumProductPrice, sumExtra, n, missing };
  }

  const sumPay_B = sumPayments(taskIds, "(B) subtotal>0 task");
  const sumPay_C = sumPayments(taskIdsNoPaju, "(C) subtotal>0 + poid NOT NULL task");

  // 5. 회사 수익 = 회사 배분액 - 기사 지급.
  console.log("\n" + "=".repeat(110));
  console.log("회사 수익 종합");
  console.log("=".repeat(110));

  function profit(M, P, label) {
    const profitFromDistrib = M.companyDistribSub - P.sumEng;
    const matchOwner = M.companyDistribSub - P.sumEng;  // 회사 측 = 배분액 - 기사
    console.log(`\n  ─── ${label} ───`);
    console.log(`    회사 배분액 (subtotal × 0.85) : ₩${M.companyDistribSub.toLocaleString()}`);
    console.log(`    기사 지급 (SUM engineer)     : ₩${P.sumEng.toLocaleString()}`);
    console.log(`    회사 수익 (배분 - 기사)       : ₩${profitFromDistrib.toLocaleString()}  ★`);
    console.log(`    SUM(owner_amount)            : ₩${P.sumOwner.toLocaleString()}`);
    console.log(`    diff (수익 - owner)          : ₩${(profitFromDistrib - P.sumOwner).toLocaleString()}`);
    console.log(`    참고 — 기사 + 원청 + 회사    : ₩${(P.sumEng + P.sumPrin + P.sumOwner).toLocaleString()}  (= product_price + extra + travel 측 measure)`);
    console.log(`    payments 누락 task           : ${P.missing}건  ← 측 측 측 측 측 측 측 측 measure 측 X`);
  }
  profit(M_subPos, sumPay_B, "(B) subtotal > 0");
  profit(M_noPaju, sumPay_C, "(C) subtotal > 0 + poid NOT NULL (파주시 제외)");

  // 6. net 기준 (78.2M) 측 차이 측 catch.
  console.log("\n  ─── 참고: net 기준 vs subtotal 기준 차이 (B 기준) ───");
  console.log(`    net 기준 배분액 (이전 78.2M)  : ₩${M_subPos.companyDistribNet.toLocaleString()}`);
  console.log(`    subtotal 기준 배분액           : ₩${M_subPos.companyDistribSub.toLocaleString()}`);
  console.log(`    diff (= net NULL 측 measure 측)   : ₩${(M_subPos.companyDistribSub - M_subPos.companyDistribNet).toLocaleString()}`);
})();

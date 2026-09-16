// 진단 (읽기 전용) — 통합된 keeper 123건의 task 금액 vs task_items SUM vs payment 대조
// 2026-05-25
//
// 입력:
//   scripts/usoln-merge-step2-result-2026-05-24T21-41-47.json   (122건)
//   한유경 YS-260511-019                                          (1단계 1건)
// 출력:
//   콘솔 + scripts/diag-usoln-merge-keeper-amount-결과.json
//
// ★ DB 쓰기 0건 ★

const fs = require("fs"), path = require("path");
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
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

(async () => {
  // keeper task_no 목록 구성
  const step2 = JSON.parse(fs.readFileSync(path.join(__dirname, "usoln-merge-step2-result-2026-05-24T21-41-47.json"), "utf8"));
  const keepers = step2.results.filter(r => !r.skipped && r.keeper).map(r => ({ ext: r.ext, task_no: r.keeper }));
  keepers.push({ ext: "2026051147012351", task_no: "YS-260511-019" }); // 한유경 1단계
  console.log(`대상 keeper: ${keepers.length}건 (step2 122 + 한유경 1)\n`);

  // tasks fetch
  const taskNos = keepers.map(k => k.task_no);
  const { data: p } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  const PID = p.id;

  let tasks = [];
  for (let i = 0; i < taskNos.length; i += 200) {
    const chunk = taskNos.slice(i, i + 200);
    const { data } = await sb
      .from("tasks")
      .select("id, task_no, customer_name, external_order_no, status, product_price, extra_fee, travel_fee, total_amount")
      .eq("principal_id", PID)
      .in("task_no", chunk);
    tasks = tasks.concat(data || []);
  }
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const taskByNo = new Map(tasks.map(t => [t.task_no, t]));

  // items SUM(subtotal)
  const ids = tasks.map(t => t.id);
  let items = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data } = await sb
      .from("task_items")
      .select("task_id, qty, unit_price, subtotal, order_type")
      .in("task_id", chunk);
    items = items.concat(data || []);
  }
  const sumByTask = new Map();
  const itemCountByTask = new Map();
  for (const it of items) {
    sumByTask.set(it.task_id, (sumByTask.get(it.task_id) || 0) + (Number(it.subtotal) || 0));
    itemCountByTask.set(it.task_id, (itemCountByTask.get(it.task_id) || 0) + 1);
  }

  // payments
  let payments = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data } = await sb
      .from("payments")
      .select("task_id, product_price, extra_fee, travel_fee, engineer_amount, principal_amount, owner_amount, is_balanced, calc_method, track, status, computed_at")
      .in("task_id", chunk);
    payments = payments.concat(data || []);
  }
  const pmByTask = new Map();
  for (const pm of payments) {
    if (!pmByTask.has(pm.task_id)) pmByTask.set(pm.task_id, []);
    pmByTask.get(pm.task_id).push(pm);
  }

  // 대조
  const rows = [];
  let taskMismatch = 0;
  let paymentMatchesSum = 0;
  let pmUnbalanced = 0;
  let noPayment = 0;
  let multiPayment = 0;
  let taskAndPmDiverge = 0;  // task.product_price ≠ payment.product_price
  for (const t of tasks) {
    const sumSub = sumByTask.get(t.id) || 0;
    const pms = pmByTask.get(t.id) || [];
    const pm = pms[0] || null;
    if (pms.length === 0) noPayment++;
    if (pms.length > 1)  multiPayment++;
    const taskMatches = Number(t.product_price || 0) === sumSub;
    if (!taskMatches) taskMismatch++;
    if (pm) {
      if (Number(pm.product_price) === sumSub) paymentMatchesSum++;
      if (!pm.is_balanced) pmUnbalanced++;
      if (Number(t.product_price || 0) !== Number(pm.product_price || 0)) taskAndPmDiverge++;
    }
    rows.push({
      task_no: t.task_no,
      ext: t.external_order_no,
      customer: t.customer_name,
      status: t.status,
      task_product_price: t.product_price,
      task_total_amount: t.total_amount,
      sum_subtotal: sumSub,
      item_count: itemCountByTask.get(t.id) || 0,
      task_vs_sum_diff: sumSub - Number(t.product_price || 0),
      payment: pm ? {
        product_price: pm.product_price,
        engineer: pm.engineer_amount,
        principal: pm.principal_amount,
        owner: pm.owner_amount,
        sum: pm.engineer_amount + pm.principal_amount + pm.owner_amount,
        is_balanced: pm.is_balanced,
        calc_method: pm.calc_method,
        track: pm.track,
      } : null,
    });
  }

  // 출력
  console.log("════ 합계 ════");
  console.log(`총 keeper task          : ${tasks.length}`);
  console.log(`task.product_price ≠ SUM(subtotal) : ${taskMismatch}건`);
  console.log(`payment.product_price = SUM(subtotal) : ${paymentMatchesSum}건`);
  console.log(`payment.is_balanced = false           : ${pmUnbalanced}건`);
  console.log(`payment row 0건                       : ${noPayment}건`);
  console.log(`payment row 2건 이상                  : ${multiPayment}건`);
  console.log(`task.product_price ≠ payment.product_price : ${taskAndPmDiverge}건`);
  console.log("");

  // diff 분포
  const diffs = rows.map(r => r.task_vs_sum_diff).sort((a,b) => a-b);
  console.log(`task_vs_sum_diff (sum_subtotal - task.product_price) 분포:`);
  console.log(`  min=${diffs[0]} / max=${diffs[diffs.length-1]} / median=${diffs[Math.floor(diffs.length/2)]}`);
  const negDiff  = diffs.filter(d => d < 0).length;
  const zeroDiff = diffs.filter(d => d === 0).length;
  const posDiff  = diffs.filter(d => d > 0).length;
  console.log(`  negative(추가선택 통합으로 sum 증가): ${posDiff}건 / zero: ${zeroDiff}건 / sum 감소: ${negDiff}건`);

  // 한유경 상세
  const han = rows.find(r => r.task_no === "YS-260511-019");
  if (han) {
    console.log("\n[한유경 YS-260511-019]");
    console.log(`  task.product_price = ${han.task_product_price} / task.total_amount = ${han.task_total_amount}`);
    console.log(`  SUM(subtotal) = ${han.sum_subtotal} / items = ${han.item_count}건`);
    console.log(`  diff = ${han.task_vs_sum_diff} (sum - task)`);
    if (han.payment) {
      console.log(`  payment.product_price = ${han.payment.product_price}`);
      console.log(`  engineer=${han.payment.engineer} principal=${han.payment.principal} owner=${han.payment.owner} sum=${han.payment.sum}`);
      console.log(`  is_balanced=${han.payment.is_balanced} method=${han.payment.calc_method} track=${han.payment.track}`);
    }
  }

  // 샘플 mismatch
  console.log("\n[task ≠ SUM 샘플 (최대 8)]");
  rows.filter(r => r.task_vs_sum_diff !== 0).slice(0, 8).forEach(r => {
    console.log(`  ${r.task_no} (${r.customer}) task=${r.task_product_price} sum=${r.sum_subtotal} diff=${r.task_vs_sum_diff} | pm.balanced=${r.payment?.is_balanced} pm.price=${r.payment?.product_price}`);
  });

  // 저장
  const file = path.join(__dirname, "diag-usoln-merge-keeper-amount-결과.json");
  fs.writeFileSync(file, JSON.stringify({
    generatedAt: new Date().toISOString(),
    summary: {
      keepers: tasks.length,
      task_vs_sum_mismatch: taskMismatch,
      payment_matches_sum:  paymentMatchesSum,
      payment_unbalanced:   pmUnbalanced,
      task_vs_payment_diverge: taskAndPmDiverge,
      no_payment: noPayment,
      multi_payment: multiPayment,
    },
    rows,
  }, null, 2), "utf8");
  console.log(`\n결과 파일: ${file}`);
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

// 1단계 원인 확정 v2 — 단순 fetch
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const PID = "22222222-2222-2222-2222-222222222006";
const CUT = "2026-05-25T00:00:00Z";

(async () => {
  // 1) usol_n task 전체 + items 이중 fetch
  const { data: tasks } = await sb.from("tasks").select("id, task_no, customer_name, external_order_no, created_at, status").eq("principal_id", PID).range(0, 1999);
  const taskById = new Map((tasks || []).map(t => [t.id, t]));
  console.log(`usol_n tasks: ${(tasks || []).length}건`);

  const taskIds = (tasks || []).map(t => t.id);
  // task_items — 500개씩 chunk in
  const allItems = [];
  for (let i = 0; i < taskIds.length; i += 500) {
    const chunk = taskIds.slice(i, i + 500);
    const { data } = await sb.from("task_items").select("id, task_id, qty, unit_price, subtotal, customer_paid_amount, product_order_id, metadata, created_at").in("task_id", chunk).range(0, 9999);
    if (data) allItems.push(...data);
  }
  console.log(`task_items: ${allItems.length}행\n`);

  // 시기 분기 (task.created_at 기준)
  const before = allItems.filter(i => (taskById.get(i.task_id)?.created_at || "") < CUT);
  const after  = allItems.filter(i => (taskById.get(i.task_id)?.created_at || "") >= CUT);
  console.log(`[시기 분기 — task.created_at 기준 cut=${CUT}]`);
  console.log(`  5/24 이전 items: ${before.length}행`);
  console.log(`  5/25 이후 items: ${after.length}행`);

  function classify(items) {
    const q2 = items.filter(i => i.qty >= 2);
    const susp = q2.filter(i => i.customer_paid_amount && i.qty && i.unit_price > (i.customer_paid_amount / i.qty));
    const ok   = q2.filter(i => i.customer_paid_amount && i.qty && i.unit_price <= (i.customer_paid_amount / i.qty));
    const noCp = q2.filter(i => !i.customer_paid_amount);
    return { q2, susp, ok, noCp };
  }
  const bC = classify(before);
  const aC = classify(after);

  console.log("\n" + "=".repeat(100));
  console.log("[A] 시기별 qty>=2 대조");
  console.log("=".repeat(100));
  console.log(`5/24 이전 qty>=2: ${bC.q2.length}행  /  이중곱 ${bC.susp.length}  /  정상 ${bC.ok.length}  /  cp없음 ${bC.noCp.length}`);
  console.log(`5/25 이후 qty>=2: ${aC.q2.length}행  /  이중곱 ${aC.susp.length}  /  정상 ${aC.ok.length}  /  cp없음 ${aC.noCp.length}`);
  if (bC.q2.length > 0) {
    const ratios = bC.q2.filter(i => i.customer_paid_amount).map(i => i.unit_price / (i.customer_paid_amount / i.qty));
    const avg = ratios.reduce((s, r) => s + r, 0) / (ratios.length || 1);
    console.log(`  5/24 이전 평균 unit_price/(cp/qty): ${avg.toFixed(3)}  (1≈단가 / qty≈합계)`);
  }
  if (aC.q2.length > 0) {
    const ratios = aC.q2.filter(i => i.customer_paid_amount).map(i => i.unit_price / (i.customer_paid_amount / i.qty));
    const avg = ratios.reduce((s, r) => s + r, 0) / (ratios.length || 1);
    console.log(`  5/25 이후 평균 unit_price/(cp/qty): ${avg.toFixed(3)}  (1≈단가 / qty≈합계)`);
  }

  console.log("\n" + "=".repeat(100));
  console.log("[B] ★ 5/25 이후 qty>=2 — 전부 이중곱인가 일부만인가");
  console.log("=".repeat(100));
  if (aC.q2.length === 0) {
    console.log(`  5/25 이후 qty>=2 행 0개`);
  } else {
    const pctS = (aC.susp.length / aC.q2.length * 100).toFixed(1);
    const pctO = (aC.ok.length   / aC.q2.length * 100).toFixed(1);
    console.log(`  5/25 이후 qty>=2: 총 ${aC.q2.length}행`);
    console.log(`    · 이중곱 (unit_price > cp/qty): ${aC.susp.length}행 (${pctS}%)`);
    console.log(`    · 정상   (unit_price ≤ cp/qty): ${aC.ok.length}행 (${pctO}%)`);
    console.log(`    · cp 없음                      : ${aC.noCp.length}행`);
    if (aC.ok.length === 0 && aC.susp.length > 0) console.log(`\n  ★ 판정: 5/25 이후 qty>=2는 전부 이중곱 → CSV 양식 일괄 변경 / 파서 일괄 수정 가능`);
    else if (aC.susp.length === 0) console.log(`\n  ★ 판정: 5/25 이후 qty>=2 전부 정상`);
    else console.log(`\n  ★ 판정: 혼재 (이중곱+정상). import 경로 또는 CSV 출처 섞임. 추가 조사 필요`);
  }

  // 5/25 이후 정상 행 샘플
  if (aC.ok.length > 0) {
    console.log(`\n  [정상 행 샘플] 5/25 이후 qty>=2 unit_price ≤ cp/qty:`);
    for (const i of aC.ok.slice(0, 15)) {
      const cpPer = Math.round(i.customer_paid_amount / i.qty);
      const t = taskById.get(i.task_id);
      console.log(`    ${t?.task_no} | qty=${i.qty} | up=${i.unit_price} | sub=${i.subtotal} | cp=${i.customer_paid_amount} | cp/qty=${cpPer} | ext=${t?.external_order_no?.slice(0,16) || "NULL"}`);
    }
  }

  // 5/24 이전 정상 샘플 대조
  console.log(`\n  [5/24 이전 정상 샘플] (10건):`);
  for (const i of bC.ok.slice(0, 10)) {
    const cpPer = Math.round(i.customer_paid_amount / i.qty);
    const t = taskById.get(i.task_id);
    console.log(`    ${t?.task_no} | qty=${i.qty} | up=${i.unit_price} | sub=${i.subtotal} | cp=${i.customer_paid_amount} | cp/qty=${cpPer}`);
  }

  // [D] 같은 주문 내 합계 비교
  console.log("\n" + "=".repeat(100));
  console.log("[D] 5/25 이후 이중곱 task의 주문 단위 합계");
  console.log("=".repeat(100));
  const susExt = new Set(aC.susp.map(i => taskById.get(i.task_id)?.external_order_no).filter(Boolean));
  for (const ext of susExt) {
    const rows = allItems.filter(i => taskById.get(i.task_id)?.external_order_no === ext);
    const sumSub = rows.reduce((s, i) => s + (i.subtotal || 0), 0);
    const sumUp  = rows.reduce((s, i) => s + (i.unit_price || 0), 0);
    const sumCp  = rows.reduce((s, i) => s + (i.customer_paid_amount || 0), 0);
    const taskNo = taskById.get(rows[0]?.task_id)?.task_no;
    console.log(`  ${taskNo} (${rows.length}행) | Σsubtotal=${sumSub.toLocaleString()} | Σup=${sumUp.toLocaleString()} | Σcp=${sumCp.toLocaleString()} | Σup/Σcp=${(sumUp/sumCp).toFixed(3)}`);
  }

  // [C] metadata 패턴 — bulkInsertUsolNOrders는 metadata.external_item_no 채움
  console.log("\n" + "=".repeat(100));
  console.log("[C] INSERT 경로 추적 — 의심 행 metadata");
  console.log("=".repeat(100));
  let withMeta = 0, withoutMeta = 0;
  for (const i of aC.susp) {
    const m = i.metadata || {};
    if (m.external_item_no) withMeta++;
    else withoutMeta++;
  }
  console.log(`  5/25 이후 이중곱 13행 metadata 분석:`);
  console.log(`    external_item_no 있음(bulkInsertUsolNOrders 경로): ${withMeta}행`);
  console.log(`    external_item_no 없음                            : ${withoutMeta}행`);
  console.log(`\n  샘플 5건:`);
  for (const i of aC.susp.slice(0, 5)) {
    const t = taskById.get(i.task_id);
    console.log(`    ${t?.task_no} | poid=${i.product_order_id} | metadata=${JSON.stringify(i.metadata)}`);
  }

  // 비교 — 5/24 이전 정상 행도 metadata 패턴
  console.log(`\n  [대조] 5/24 이전 정상 qty>=2 행 metadata 샘플 (5건):`);
  let beforeMeta = 0, beforeNoMeta = 0;
  for (const i of bC.ok) {
    const m = i.metadata || {};
    if (m.external_item_no) beforeMeta++;
    else beforeNoMeta++;
  }
  console.log(`    external_item_no 있음: ${beforeMeta}행 / 없음: ${beforeNoMeta}행`);
  for (const i of bC.ok.slice(0, 5)) {
    const t = taskById.get(i.task_id);
    console.log(`    ${t?.task_no} | poid=${i.product_order_id} | metadata=${JSON.stringify(i.metadata)}`);
  }
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });

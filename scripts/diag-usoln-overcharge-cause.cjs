// 1단계 원인 확정 — 5/24 이전 vs 5/25 이후 비교 + 5/25 이후 전수 분류 (read-only)
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const PID = "22222222-2222-2222-2222-222222222006";
const CUT = "2026-05-25T00:00:00Z";  // 분기점 (KST 09:00 / UTC 00:00)

(async () => {
  // 1) 전체 usol_n task_items + task.created_at 가져오기 (페이지네이션 안전)
  const all = [];
  let offset = 0;
  while (true) {
    const { data } = await sb.from("task_items").select(
      "id, qty, unit_price, subtotal, customer_paid_amount, product_order_id, created_at, tasks!inner(task_no, principal_id, customer_name, external_order_no, created_at, status)"
    ).eq("tasks.principal_id", PID).range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`[전체 usol_n task_items]: ${all.length}행`);

  // 분기: 5/25 기준
  const before = all.filter(i => i.tasks.created_at < CUT);
  const after  = all.filter(i => i.tasks.created_at >= CUT);
  console.log(`  5/24 이전 created (cut=${CUT}): ${before.length}행`);
  console.log(`  5/25 이후 created                  : ${after.length}행`);

  // qty>=2 분류 함수 — 이중곱 신호: unit_price > customer_paid/qty
  function classify(items) {
    const q2 = items.filter(i => i.qty >= 2);
    const susp = q2.filter(i => i.customer_paid_amount && i.qty && i.unit_price > (i.customer_paid_amount / i.qty));
    const ok   = q2.filter(i => !i.customer_paid_amount || !i.qty || i.unit_price <= (i.customer_paid_amount / i.qty));
    return { q2, susp, ok };
  }

  const beforeC = classify(before);
  const afterC  = classify(after);

  console.log("\n" + "=".repeat(100));
  console.log("[A] 시기별 qty>=2 unit_price 의미 대조");
  console.log("=".repeat(100));

  function showStats(label, c) {
    console.log(`\n  ${label}:`);
    console.log(`    qty>=2 전체: ${c.q2.length}행`);
    console.log(`    이중곱 의심 (unit_price > cp/qty): ${c.susp.length}행`);
    console.log(`    정상 (unit_price <= cp/qty)      : ${c.ok.length}행`);
    if (c.q2.length > 0) {
      // 비율 계산
      const ratios = c.q2.filter(i => i.customer_paid_amount && i.qty).map(i => i.unit_price / (i.customer_paid_amount / i.qty));
      const avg = ratios.reduce((s, r) => s + r, 0) / (ratios.length || 1);
      console.log(`    평균(unit_price / (cp/qty)): ${avg.toFixed(3)}   (1에 가까우면 단가, qty에 가까우면 합계)`);
    }
  }
  showStats("5/24 이전", beforeC);
  showStats("5/25 이후", afterC);

  console.log("\n" + "=".repeat(100));
  console.log("[B] ★ 5/25 이후 qty>=2 전수 — 전부 이중곱인가 / 일부만인가");
  console.log("=".repeat(100));
  console.log(`  5/25 이후 qty>=2 행 총 ${afterC.q2.length}개:`);
  console.log(`    이중곱  : ${afterC.susp.length}행`);
  console.log(`    정상    : ${afterC.ok.length}행`);
  if (afterC.q2.length > 0) {
    const ratio = (afterC.susp.length / afterC.q2.length * 100).toFixed(1);
    console.log(`    이중곱 비율: ${ratio}%`);
    if (afterC.ok.length === 0) {
      console.log(`    ★ 판정: 5/25 이후 qty>=2는 전부 이중곱 → CSV 양식 일괄 변경 가능성 / 파서 일괄 수정 가능`);
    } else if (afterC.susp.length === 0) {
      console.log(`    ★ 판정: 5/25 이후 qty>=2는 전부 정상 — 이중곱은 다른 원인`);
    } else {
      console.log(`    ★ 판정: 5/25 이후 qty>=2 혼재 — import 경로 또는 CSV 출처가 섞임. 추가 조사 필요`);
    }
  }

  // 5/25 이후 정상 행 샘플 (혼재 시)
  if (afterC.ok.length > 0) {
    console.log(`\n  [참고] 5/25 이후 qty>=2 "정상" 행 샘플 (이중곱과 비교용):`);
    for (const i of afterC.ok.slice(0, 10)) {
      const cpPer = i.customer_paid_amount ? Math.round(i.customer_paid_amount / i.qty) : null;
      console.log(`    ${i.tasks.task_no} | qty=${i.qty} | up=${i.unit_price} | sub=${i.subtotal} | cp=${i.customer_paid_amount} | cp/qty=${cpPer} | created=${i.tasks.created_at.slice(0, 10)} | ext=${i.tasks.external_order_no?.slice(0, 16) || "NULL"}`);
    }
  }

  // 5/24 이전 정상 샘플 (대조)
  console.log(`\n  [참고] 5/24 이전 qty>=2 정상 샘플 (10건):`);
  for (const i of beforeC.ok.slice(0, 10)) {
    const cpPer = i.customer_paid_amount ? Math.round(i.customer_paid_amount / i.qty) : null;
    console.log(`    ${i.tasks.task_no} | qty=${i.qty} | up=${i.unit_price} | sub=${i.subtotal} | cp=${i.customer_paid_amount} | cp/qty=${cpPer} | created=${i.tasks.created_at.slice(0, 10)}`);
  }

  // [D] 같은 주문(external_order_no)의 행 합계 비교 — settlement vs customer_paid
  console.log("\n" + "=".repeat(100));
  console.log("[D] 같은 주문(external_order_no) 내 settlement 합 vs customer_paid 합 비교");
  console.log("=".repeat(100));
  // 5/25 이후 이중곱 task의 행들
  const susExtSet = new Set(afterC.susp.map(i => i.tasks.external_order_no).filter(Boolean));
  console.log(`  5/25 이후 이중곱 의심 task의 external_order_no 수: ${susExtSet.size}건`);
  for (const ext of susExtSet) {
    const rows = all.filter(i => i.tasks.external_order_no === ext);
    const sumSub = rows.reduce((s, i) => s + (i.subtotal || 0), 0);
    const sumUp  = rows.reduce((s, i) => s + (i.unit_price || 0), 0);
    const sumCp  = rows.reduce((s, i) => s + (i.customer_paid_amount || 0), 0);
    const taskNo = rows[0]?.tasks.task_no;
    console.log(`  ${taskNo} (ext=${ext}) | 행수=${rows.length} | Σsubtotal=${sumSub.toLocaleString()} | Σunit_price=${sumUp.toLocaleString()} | Σcustomer_paid=${sumCp.toLocaleString()}`);
    console.log(`    → Σunit_price vs Σcp: ${sumUp < sumCp ? '단가합 < 결제합 (정상 수수료)' : 'unit_price가 비정상적으로 큼'}`);
  }

  // [C] INSERT 경로 추적 — 5/25 이후 행이 어느 import path인지
  // bulkInsertUsolNOrders는 metadata에 external_item_no를 넣음 (usolNTasksDb.js:608-610)
  // 5/25 이후 의심 행의 metadata 확인
  console.log("\n" + "=".repeat(100));
  console.log("[C] INSERT 경로 추적 — 5/25 이후 의심 행의 metadata");
  console.log("=".repeat(100));
  const taskIds = [...new Set(afterC.susp.map(i => i.id))];
  const { data: meta } = await sb.from("task_items").select("id, task_id, metadata, product_order_id").in("id", taskIds);
  for (const r of (meta || [])) {
    console.log(`  item_id=${r.id.slice(0, 8)} | product_order_id=${r.product_order_id} | metadata=${JSON.stringify(r.metadata)}`);
  }
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });

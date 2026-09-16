// 1단계 원인 확정 v3 — inner join 패턴 (이전 성공 방식)
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const PID = "22222222-2222-2222-2222-222222222006";
const CUT = "2026-05-25T00:00:00Z";

(async () => {
  // 1) 페이지네이션 with inner join — 1000행씩
  const all = [];
  for (let off = 0; off < 5000; off += 1000) {
    const { data, error } = await sb.from("task_items")
      .select("id, task_id, qty, unit_price, subtotal, customer_paid_amount, product_order_id, metadata, tasks!inner(task_no, principal_id, customer_name, external_order_no, created_at, status)")
      .eq("tasks.principal_id", PID)
      .range(off, off + 999);
    if (error) { console.error("FETCH ERR", error); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`전체 usol_n task_items (페이지네이션): ${all.length}행`);

  const before = all.filter(i => i.tasks.created_at < CUT);
  const after  = all.filter(i => i.tasks.created_at >= CUT);
  console.log(`  5/24 이전: ${before.length}행`);
  console.log(`  5/25 이후: ${after.length}행`);

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
  console.log("[A] 시기별 qty>=2 unit_price 의미 대조");
  console.log("=".repeat(100));
  console.log(`5/24 이전 qty>=2: ${bC.q2.length}행  /  이중곱 ${bC.susp.length}  /  정상 ${bC.ok.length}  /  cp없음 ${bC.noCp.length}`);
  console.log(`5/25 이후 qty>=2: ${aC.q2.length}행  /  이중곱 ${aC.susp.length}  /  정상 ${aC.ok.length}  /  cp없음 ${aC.noCp.length}`);
  if (bC.q2.length > 0) {
    const r = bC.q2.filter(i => i.customer_paid_amount).map(i => i.unit_price / (i.customer_paid_amount / i.qty));
    const avg = r.reduce((s, x) => s + x, 0) / (r.length || 1);
    console.log(`  5/24 이전 평균 비율 unit_price/(cp/qty): ${avg.toFixed(3)}  (1≈단가)`);
  }
  if (aC.q2.length > 0) {
    const r = aC.q2.filter(i => i.customer_paid_amount).map(i => i.unit_price / (i.customer_paid_amount / i.qty));
    const avg = r.reduce((s, x) => s + x, 0) / (r.length || 1);
    console.log(`  5/25 이후 평균 비율 unit_price/(cp/qty): ${avg.toFixed(3)}  (qty에 가까울수록 합계)`);
  }

  console.log("\n" + "=".repeat(100));
  console.log("[B] ★ 5/25 이후 qty>=2 — 전부 이중곱인가 / 일부만인가");
  console.log("=".repeat(100));
  if (aC.q2.length === 0) console.log(`  5/25 이후 qty>=2 행 0개`);
  else {
    console.log(`  5/25 이후 qty>=2 총 ${aC.q2.length}행`);
    console.log(`    이중곱: ${aC.susp.length}행 (${(aC.susp.length / aC.q2.length * 100).toFixed(1)}%)`);
    console.log(`    정상  : ${aC.ok.length}행 (${(aC.ok.length / aC.q2.length * 100).toFixed(1)}%)`);
    console.log(`    cp없음: ${aC.noCp.length}행`);
    if (aC.ok.length === 0 && aC.susp.length > 0)
      console.log(`\n  ★ 판정: 5/25 이후 qty>=2 전부 이중곱 → 파서 일괄 수정 가능`);
    else if (aC.susp.length === 0)
      console.log(`\n  ★ 판정: 5/25 이후 qty>=2 전부 정상`);
    else
      console.log(`\n  ★ 판정: 혼재 — import 경로 또는 CSV 출처 섞임. 추가 조사 필요`);
  }

  if (aC.ok.length > 0) {
    console.log(`\n  [5/25 이후 정상 행 샘플] qty>=2 unit_price ≤ cp/qty:`);
    for (const i of aC.ok.slice(0, 15)) {
      const cpPer = Math.round(i.customer_paid_amount / i.qty);
      console.log(`    ${i.tasks.task_no} | qty=${i.qty} | up=${i.unit_price} | sub=${i.subtotal} | cp=${i.customer_paid_amount} | cp/qty=${cpPer} | ext=${i.tasks.external_order_no?.slice(0, 16) || "NULL"} | created=${i.tasks.created_at.slice(0, 10)}`);
    }
  }

  console.log(`\n  [5/24 이전 정상 샘플] (10건):`);
  for (const i of bC.ok.slice(0, 10)) {
    const cpPer = Math.round(i.customer_paid_amount / i.qty);
    console.log(`    ${i.tasks.task_no} | qty=${i.qty} | up=${i.unit_price} | sub=${i.subtotal} | cp=${i.customer_paid_amount} | cp/qty=${cpPer} | created=${i.tasks.created_at.slice(0, 10)}`);
  }

  console.log("\n" + "=".repeat(100));
  console.log("[C] INSERT 경로 — metadata.external_item_no 패턴");
  console.log("=".repeat(100));
  function metaStats(arr, label) {
    let wm = 0, nm = 0;
    for (const i of arr) {
      if (i.metadata && i.metadata.external_item_no) wm++; else nm++;
    }
    console.log(`  ${label}: external_item_no 있음=${wm} / 없음=${nm}`);
  }
  metaStats(aC.susp, "5/25 이후 이중곱");
  metaStats(aC.ok,   "5/25 이후 정상  ");
  metaStats(bC.ok,   "5/24 이전 정상  ");
  console.log(`\n  [의심 13행 metadata 샘플]`);
  for (const i of aC.susp.slice(0, 13)) {
    console.log(`    ${i.tasks.task_no} | poid=${i.product_order_id} | metadata=${JSON.stringify(i.metadata)}`);
  }
  console.log(`\n  [5/24 이전 정상 metadata 샘플 (5건)]`);
  for (const i of bC.ok.slice(0, 5)) {
    console.log(`    ${i.tasks.task_no} | poid=${i.product_order_id} | metadata=${JSON.stringify(i.metadata)}`);
  }

  console.log("\n" + "=".repeat(100));
  console.log("[D] 같은 주문 내 합계 비교 — 의심 task의 ext_order_no별");
  console.log("=".repeat(100));
  const susExt = new Set(aC.susp.map(i => i.tasks.external_order_no).filter(Boolean));
  for (const ext of susExt) {
    const rows = all.filter(i => i.tasks.external_order_no === ext);
    const sumSub = rows.reduce((s, i) => s + (i.subtotal || 0), 0);
    const sumUp  = rows.reduce((s, i) => s + (i.unit_price || 0), 0);
    const sumCp  = rows.reduce((s, i) => s + (i.customer_paid_amount || 0), 0);
    const taskNo = rows[0]?.tasks.task_no;
    console.log(`  ${taskNo} (${rows.length}행) | Σsub=₩${sumSub.toLocaleString()} | Σup=₩${sumUp.toLocaleString()} | Σcp=₩${sumCp.toLocaleString()} | Σup/Σcp=${(sumUp/sumCp).toFixed(3)}`);
  }
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });

// 진단 — task_items.subtotal qty 부풀림 (수량>1 작업)
// 2026-05-24
const fs = require("fs"), path = require("path");
const XLSX = require("xlsx");

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

const norm = (v) => v == null ? "" : String(v).trim();
const toInt = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
};

(async () => {
  const usolNId = "22222222-2222-2222-2222-222222222006";

  // 시트 로드
  const wb = XLSX.readFile(path.join(__dirname, "유솔홈케어_운영.xlsx"), { cellDates: false });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false });
  const sheetByOrd = new Map();
  for (const r of rows) {
    const k = norm(r["상품주문번호"]);
    if (k) sheetByOrd.set(k, r);
  }

  // DB tasks/task_items
  const tasksById = new Map();
  let from = 0;
  while (true) {
    const { data } = await sb.from("tasks").select("id, task_no, customer_name, status").eq("principal_id", usolNId).range(from, from + 999);
    if (!data?.length) break;
    for (const t of data) tasksById.set(t.id, t);
    if (data.length < 1000) break;
    from += 1000;
  }
  const taskIds = [...tasksById.keys()];

  const items = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    const ids = taskIds.slice(i, i + 200);
    const { data } = await sb.from("task_items").select("id, task_id, product_order_id, order_type, qty, unit_price, subtotal, net_amount, customer_paid_amount").in("task_id", ids);
    if (data) items.push(...data);
  }
  console.log(`usol_n task_items 총: ${items.length}건`);

  // [1] qty > 1
  const qtyGt1 = items.filter(it => Number(it.qty) > 1);
  console.log(`\n[1] qty > 1 task_items: ${qtyGt1.length}건`);

  // qty 분포
  const qtyDist = {};
  for (const it of qtyGt1) {
    const q = Number(it.qty);
    qtyDist[q] = (qtyDist[q] || 0) + 1;
  }
  console.log(`    qty 분포:`);
  for (const [q, c] of Object.entries(qtyDist).sort((a, b) => +a[0] - +b[0])) {
    console.log(`      qty=${q}: ${c}건`);
  }

  // [2] subtotal vs 시트 정산예정금액 불일치
  let mismatch = 0;
  let matched = 0;
  let noSheet = 0;
  let mismatchExactQtyMul = 0;   // 정확히 qty 배수만큼 부풀림
  const samples = [];

  for (const it of qtyGt1) {
    const ord = norm(it.product_order_id);
    if (!ord) { noSheet++; continue; }
    const sR = sheetByOrd.get(ord);
    if (!sR) { noSheet++; continue; }
    const sheetSettle = toInt(sR["정산예정금액"]);
    if (sheetSettle == null) { noSheet++; continue; }
    const dbSub = Number(it.subtotal) || 0;
    if (dbSub === sheetSettle) {
      matched++;
    } else {
      mismatch++;
      if (dbSub === sheetSettle * Number(it.qty)) mismatchExactQtyMul++;
      if (samples.length < 10) {
        const t = tasksById.get(it.task_id);
        samples.push({
          task_no: t?.task_no,
          customer: t?.customer_name,
          ord,
          qty: it.qty,
          unit_price: it.unit_price,
          subtotal: dbSub,
          sheet_settle: sheetSettle,
          ratio: dbSub / sheetSettle,
          order_type: it.order_type,
        });
      }
    }
  }

  console.log(`\n[2] subtotal vs 시트 정산예정금액 비교 (qty>1 ${qtyGt1.length}건 중):`);
  console.log(`    · 일치              : ${matched}`);
  console.log(`    · 불일치            : ${mismatch}`);
  console.log(`    · 그중 정확히 qty 배: ${mismatchExactQtyMul}`);
  console.log(`    · 시트 없음/skip    : ${noSheet}`);
  console.log(`\n  샘플 10건:`);
  console.log(`  ${"task_no".padEnd(18)} ${"고객".padEnd(10)} ${"qty".padStart(3)} ${"unit_price".padStart(10)} ${"subtotal".padStart(10)} ${"시트정산".padStart(10)} ${"ratio".padStart(6)} order_type`);
  for (const s of samples) {
    console.log(`  ${s.task_no.padEnd(18)} ${s.customer.padEnd(10)} ${String(s.qty).padStart(3)} ${String(s.unit_price).padStart(10)} ${String(s.subtotal).padStart(10)} ${String(s.sheet_settle).padStart(10)} ${s.ratio.toFixed(2).padStart(6)} ${s.order_type}`);
  }

  // [3] net_amount vs 시트 네이버정산금액
  let netMatch = 0, netMismatch = 0, netNullDb = 0;
  const netSamples = [];
  for (const it of qtyGt1) {
    const ord = norm(it.product_order_id);
    if (!ord) continue;
    const sR = sheetByOrd.get(ord);
    if (!sR) continue;
    const sheetNet = toInt(sR["네이버정산금액"]);
    const dbNet = it.net_amount;
    if (dbNet == null) { netNullDb++; continue; }
    if (sheetNet == null) continue;
    if (Number(dbNet) === sheetNet) netMatch++;
    else {
      netMismatch++;
      if (netSamples.length < 5) {
        const t = tasksById.get(it.task_id);
        netSamples.push({ task_no: t?.task_no, qty: it.qty, db_net: dbNet, sheet_net: sheetNet, ratio: Number(dbNet) / sheetNet });
      }
    }
  }
  console.log(`\n[3] net_amount vs 시트 네이버정산금액 (qty>1):`);
  console.log(`    · 일치        : ${netMatch}`);
  console.log(`    · 불일치      : ${netMismatch}`);
  console.log(`    · DB net=NULL : ${netNullDb}`);
  if (netSamples.length) {
    console.log(`    불일치 샘플:`);
    for (const s of netSamples) console.log(`      ${s.task_no} qty=${s.qty} db_net=${s.db_net} sheet=${s.sheet_net} ratio=${s.ratio.toFixed(2)}`);
  }

  // [5] 나눠떨어지지 않는 케이스
  let notDivisible = 0;
  const notDivList = [];
  for (const it of qtyGt1) {
    const ord = norm(it.product_order_id);
    if (!ord) continue;
    const sR = sheetByOrd.get(ord);
    if (!sR) continue;
    const sheetSettle = toInt(sR["정산예정금액"]);
    if (sheetSettle == null) continue;
    const qty = Number(it.qty);
    if (sheetSettle % qty !== 0) {
      notDivisible++;
      if (notDivList.length < 5) {
        const t = tasksById.get(it.task_id);
        notDivList.push({ task_no: t?.task_no, qty, sheet_settle: sheetSettle, mod: sheetSettle % qty, suggested_unit: Math.round(sheetSettle / qty) });
      }
    }
  }
  console.log(`\n[5] 시트 정산예정금액 ÷ qty 나눠떨어짐 검사:`);
  console.log(`    · 나눠떨어지지 않음: ${notDivisible}건`);
  if (notDivList.length) {
    console.log(`    샘플:`);
    for (const n of notDivList) console.log(`      ${n.task_no} qty=${n.qty} sheet=${n.sheet_settle} mod=${n.mod} suggested_unit=${n.suggested_unit}`);
  }

  // 황예원 측 catch
  console.log(`\n[황예원] 측 catch`);
  const hwang = (items.filter(it => {
    const t = tasksById.get(it.task_id);
    return t?.customer_name === "황예원";
  }));
  for (const it of hwang) {
    const t = tasksById.get(it.task_id);
    const ord = it.product_order_id;
    const sR = ord ? sheetByOrd.get(ord) : null;
    console.log(`  ${t?.task_no} | ord=${ord} | qty=${it.qty} unit=${it.unit_price} sub=${it.subtotal} net=${it.net_amount} | 시트정산=${sR?.["정산예정금액"]} 네이버=${sR?.["네이버정산금액"]} | ${it.order_type}`);
  }

  console.log(`\n진단 완료.`);
})().catch(e => console.log("FATAL:", e.message, e.stack));

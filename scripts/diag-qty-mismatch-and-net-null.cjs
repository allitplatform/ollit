// 2026-06-02 — 진단 (읽기 only): (1) 수량 2배 차이 63건 + (2) net NULL 완료 40건.
//
// 5월 완료 작업 (usol_n, completed_at KST 5월, status='완료', 활성) 측 catch.
//
// (1) 수량 2배 차이 63건:
//   · task_no / 서비스 / quantity / net / subtotal / unit_price
//   · xlsx 정산예정금액 측 대조 → DB net 측 측 vs xlsx 측 측
//   · net=2×subtotal / subtotal=2×net 패턴별 분류
//   · qty 측 net·subtotal 측 측 측 측 측 measure 측
//
// (2) net NULL 완료 40건:
//   · task_no / 서비스 / subtotal / completed_at / poid
//   · xlsx 측 측 (정산 측 측 net 입력 누락) vs 측 측 (정산 전)
//   · poid NULL 측 별도 catch (파주시 등)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const XLSX = require("xlsx");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";
const MAY_START_UTC = "2026-04-30T15:00:00Z";
const MAY_END_UTC   = "2026-05-31T15:00:00Z";

function kstYmd(utcIso) {
  if (!utcIso) return null;
  const d = new Date(utcIso);
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

(async () => {
  // xlsx 측 poid → 정산예정금액 / 정산완료일.
  const wb = XLSX.readFile(path.join(__dirname, "..", "네이버정산.xlsx"));
  const ws = wb.Sheets["Sheet1"];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  const header = rows[0];
  const idxPoid = header.indexOf("상품주문번호");
  const idxSettled = header.indexOf("정산완료일");
  const idxAmount = header.indexOf("정산예정금액");
  const idxBuyer = header.indexOf("구매자명");
  const idxBase = header.indexOf("정산기준금액");

  const xlsxMap = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const poid = String(r[idxPoid] || "").trim();
    if (!poid) continue;
    xlsxMap.set(poid, {
      settled: String(r[idxSettled] || "").trim(),
      amount: Number(String(r[idxAmount] || "").replace(/,/g, "")) || 0,
      base: Number(String(r[idxBase] || "").replace(/,/g, "")) || 0,
      buyer: String(r[idxBuyer] || "").trim(),
    });
  }
  console.log(`xlsx 측 catch: ${xlsxMap.size}개 poid`);

  // DB 측 5월 완료 task_items (활성).
  const PAGE = 1000;
  const all = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await sb.from("task_items")
      .select(`id, task_id, qty, unit_price, subtotal, net_amount, naver_settled_at,
               customer_paid_amount, product_order_id, order_type, is_canceled,
               description,
               work_types(name),
               appliance_types(name),
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

  function svcLabel(it) {
    return it.appliance_types?.name || it.work_types?.name || it.description || it.order_type || "—";
  }

  // ─────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(110));
  console.log("(1) 수량 2배 차이 63건 — task_no / 서비스 / qty / net / subtotal / unit_price / xlsx 정산예정금액");
  console.log("=".repeat(110));

  const withNet = active.filter(it => it.net_amount != null);
  const mismatches = [];
  for (const it of withNet) {
    const n = Number(it.net_amount);
    const s = Number(it.subtotal) || 0;
    if (n !== s) mismatches.push({ it, n, s, diff: n - s });
  }
  console.log(`\n  net ≠ subtotal: ${mismatches.length}건`);

  // 패턴별 분류.
  const pattern2x = mismatches.filter(m => m.n === 2 * m.s);   // net = 2× sub
  const patternHalf = mismatches.filter(m => m.s === 2 * m.n); // sub = 2× net
  const patternOther = mismatches.filter(m => m.n !== 2 * m.s && m.s !== 2 * m.n);
  console.log(`    · net = 2× subtotal: ${pattern2x.length}건  (qty 측 net 측 측 측 측 X 측 spec)`);
  console.log(`    · subtotal = 2× net: ${patternHalf.length}건  (qty 측 subtotal 측 측 측 측 X 측 spec)`);
  console.log(`    · 기타            : ${patternOther.length}건`);

  // 패턴별 샘플 + xlsx 대조.
  function dump(label, list, max) {
    if (list.length === 0) return;
    console.log(`\n  ─── ${label} (샘플 ${Math.min(max, list.length)}건 / 전체 ${list.length}건) ───`);
    console.log(`  ${"task_no".padEnd(15)} ${"고객".padEnd(8)} ${"서비스".padEnd(20)} ${"qty".padStart(3)}  ${"unit_price".padStart(10)}  ${"net".padStart(10)}  ${"subtotal".padStart(10)}  ${"unit×qty".padStart(10)}  xlsx_정산예정`);
    for (const m of list.slice(0, max)) {
      const { it, n, s } = m;
      const x = xlsxMap.get(String(it.product_order_id || "").trim());
      const xlsxAmt = x ? x.amount : null;
      const xlsxStatus = x ? (x.settled ? "✓완료" : "예정") : "✗없음";
      const unitTimesQty = (Number(it.unit_price) || 0) * (it.qty || 1);
      const svc = svcLabel(it).slice(0, 20);
      console.log(`  ${(it.tasks?.task_no || "").padEnd(15)} ${(it.tasks?.customer_name || "").padEnd(8)} ${svc.padEnd(20)} ${String(it.qty || 1).padStart(3)}  ${String(it.unit_price || 0).padStart(10)}  ${String(n).padStart(10)}  ${String(s).padStart(10)}  ${String(unitTimesQty).padStart(10)}  ${xlsxAmt != null ? `₩${xlsxAmt.toLocaleString().padStart(8)} (${xlsxStatus})` : xlsxStatus}`);
    }
  }
  dump("net = 2× subtotal", pattern2x, 10);
  dump("subtotal = 2× net", patternHalf, 10);
  dump("기타 차이", patternOther, 10);

  // xlsx 매칭 통계.
  console.log("\n  ─── xlsx 측 측 측 측 catch (63건) ───");
  let nMatchNet = 0, nMatchSub = 0, nMatchOther = 0, nNoXlsx = 0;
  for (const m of mismatches) {
    const x = xlsxMap.get(String(m.it.product_order_id || "").trim());
    if (!x) { nNoXlsx++; continue; }
    if (x.amount === m.n) nMatchNet++;
    else if (x.amount === m.s) nMatchSub++;
    else nMatchOther++;
  }
  console.log(`    · xlsx 측 측 DB net 측 측  : ${nMatchNet}건  ← DB net 측 측`);
  console.log(`    · xlsx 측 측 DB subtotal 측: ${nMatchSub}건  ← DB subtotal 측 측 / net 측 측 측 X`);
  console.log(`    · xlsx 측 측 측 측 측 측 측: ${nMatchOther}건`);
  console.log(`    · xlsx 측 측 측             : ${nNoXlsx}건`);

  // ─────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(110));
  console.log("(2) net NULL 완료 40건 — task_no / 서비스 / subtotal / completed_at / poid / xlsx 측");
  console.log("=".repeat(110));

  const noNet = active.filter(it => it.net_amount == null);
  console.log(`\n  net NULL 완료 task_items: ${noNet.length}건`);

  // xlsx 매칭.
  const noNetMatched = [];
  const noNetNotInXlsx = [];
  const noNetNoPoid = [];
  for (const it of noNet) {
    const poid = String(it.product_order_id || "").trim();
    if (!poid) { noNetNoPoid.push(it); continue; }
    const x = xlsxMap.get(poid);
    if (x) noNetMatched.push({ it, xlsx: x });
    else noNetNotInXlsx.push(it);
  }
  console.log(`    · xlsx 측 측 (정산됐는데 net 입력 누락): ${noNetMatched.length}건`);
  console.log(`    · xlsx 측 측 (정산 전 / 신규)         : ${noNetNotInXlsx.length}건`);
  console.log(`    · poid NULL                          : ${noNetNoPoid.length}건  ← 별도 catch`);

  // (a) xlsx 측 측 = 정산 측 net 입력 누락 spec.
  if (noNetMatched.length > 0) {
    console.log(`\n  ─── (a) xlsx 측 측 — net 입력 누락 spec (${Math.min(15, noNetMatched.length)}건) ───`);
    console.log(`  ${"task_no".padEnd(15)} ${"고객".padEnd(8)} ${"서비스".padEnd(20)} ${"subtotal".padStart(10)}  completed_at  ${"poid".padEnd(16)}  xlsx 측 측 측`);
    for (const { it, xlsx } of noNetMatched.slice(0, 15)) {
      const svc = svcLabel(it).slice(0, 20);
      const cmpl = kstYmd(it.tasks?.completed_at);
      console.log(`  ${(it.tasks?.task_no || "").padEnd(15)} ${(it.tasks?.customer_name || "").padEnd(8)} ${svc.padEnd(20)} ${String(it.subtotal || 0).padStart(10)}  ${cmpl}    ${(it.product_order_id || "").padEnd(16)}  ₩${xlsx.amount.toLocaleString()} (${xlsx.settled ? "완료 " + xlsx.settled : "예정"})`);
    }
  }

  // (b) xlsx 측 측 = 정산 전 / 신규.
  if (noNetNotInXlsx.length > 0) {
    console.log(`\n  ─── (b) xlsx 측 측 — 정산 전 / 신규 spec (${Math.min(15, noNetNotInXlsx.length)}건) ───`);
    console.log(`  ${"task_no".padEnd(15)} ${"고객".padEnd(8)} ${"서비스".padEnd(20)} ${"subtotal".padStart(10)}  completed_at  poid`);
    for (const it of noNetNotInXlsx.slice(0, 15)) {
      const svc = svcLabel(it).slice(0, 20);
      const cmpl = kstYmd(it.tasks?.completed_at);
      console.log(`  ${(it.tasks?.task_no || "").padEnd(15)} ${(it.tasks?.customer_name || "").padEnd(8)} ${svc.padEnd(20)} ${String(it.subtotal || 0).padStart(10)}  ${cmpl}    ${it.product_order_id}`);
    }
  }

  // (c) poid NULL 측.
  if (noNetNoPoid.length > 0) {
    console.log(`\n  ─── (c) poid NULL spec (${noNetNoPoid.length}건) ───`);
    console.log(`  ${"task_no".padEnd(18)} ${"고객".padEnd(12)} ${"서비스".padEnd(20)} ${"subtotal".padStart(10)}  ${"order_type".padEnd(10)}  completed_at`);
    for (const it of noNetNoPoid) {
      const svc = svcLabel(it).slice(0, 20);
      const cmpl = kstYmd(it.tasks?.completed_at);
      console.log(`  ${(it.tasks?.task_no || "").padEnd(18)} ${(it.tasks?.customer_name || "").padEnd(12)} ${svc.padEnd(20)} ${String(it.subtotal || 0).padStart(10)}  ${(it.order_type || "—").padEnd(10)}  ${cmpl}`);
    }
  }

  console.log("\n" + "=".repeat(110));
  console.log("종합");
  console.log("=".repeat(110));
  console.log(`(1) 수량 2배 차이 63건 = net=2×sub ${pattern2x.length}건 + sub=2×net ${patternHalf.length}건 + 기타 ${patternOther.length}건`);
  console.log(`(2) net NULL 40건 = xlsx 측 (정산 측 net 누락) ${noNetMatched.length}건 + xlsx 측 측 (정산 전/신규) ${noNetNotInXlsx.length}건 + poid NULL ${noNetNoPoid.length}건`);
})();

// 2026-06-02 — 331건 (net NOT NULL + naver_settled NULL) xlsx 대조 진단 (읽기 only).
//
// 사장님 spec:
//   · 331건 product_order_id 측 네이버정산.xlsx (정산완료일 측 측 행) 측 대조.
//   · xlsx 측 측 → (a) 진짜 정산됨, 완료일 마킹만 누락 → 백필 후보
//   · xlsx 측 측 → (b) 아직 정산 전, net 측 예정금액 → naver_settled NULL 정상,
//                       헤더 라벨만 "정산예정금액" 측 spec
//
// ⚠️ 쓰기 절대 X. naver_settled_at 측 updated_at 추정값 측 백필 X — xlsx 측 진짜 정산완료일만 사용 spec.
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const XLSX = require("xlsx");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";

(async () => {
  console.log("=".repeat(100));
  console.log("331건 (net NOT NULL + naver_settled NULL) xlsx 정산완료일 대조 진단");
  console.log("=".repeat(100));

  // 1. xlsx 측 poid → 정산완료일 map.
  const wb = XLSX.readFile(path.join(__dirname, "..", "네이버정산.xlsx"));
  const ws = wb.Sheets["Sheet1"];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  const header = rows[0];
  const poidIdx = header.indexOf("상품주문번호");
  const settleIdx = header.indexOf("정산완료일");
  const planIdx = header.indexOf("정산예정일");
  const buyerIdx = header.indexOf("구매자명");
  const payDateIdx = header.indexOf("결제일");

  const xlsxMap = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const poid = String(r[poidIdx] || "").trim();
    if (!poid) continue;
    xlsxMap.set(poid, {
      settled: String(r[settleIdx] || "").trim(),
      plan:    String(r[planIdx] || "").trim(),
      buyer:   String(r[buyerIdx] || "").trim(),
      payDate: String(r[payDateIdx] || "").trim(),
    });
  }
  console.log(`\n  xlsx 측 catch: ${xlsxMap.size}개 poid (Sheet1, 정산완료일 포함)`);

  // 2. DB 측 331건 fetch (net NOT NULL + naver_settled NULL, cancel-strict).
  const PAGE = 1000;
  const all = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await sb.from("task_items")
      .select(`id, task_id, net_amount, naver_settled_at, product_order_id, is_canceled,
               tasks!inner(task_no, customer_name, status, principal_id, completed_at, scheduled_at)`)
      .eq("tasks.principal_id", PID)
      .not("net_amount", "is", null)
      .is("naver_settled_at", null)
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  const target = all.filter(it => it.is_canceled !== true && it.tasks?.status !== "취소");
  console.log(`  DB 측 331건 후보 (net NOT NULL + naver_settled NULL + cancel-strict): ${target.length}건`);

  // 3. 매칭 분류.
  const matchedSettled = [];   // (a) xlsx 측 + 정산완료일 측
  const noPoid = [];           // poid 측 측
  const noMatch = [];          // (b) xlsx 측 측 (= 정산 전, net 측 예정금액)

  for (const it of target) {
    const poid = String(it.product_order_id || "").trim();
    if (!poid) { noPoid.push(it); continue; }
    const x = xlsxMap.get(poid);
    if (!x) { noMatch.push(it); continue; }
    if (x.settled) matchedSettled.push({ it, xlsx: x });
    else noMatch.push(it);
  }

  console.log("\n  ─── 매칭 분류 ───");
  console.log(`    (a) xlsx 측 + 정산완료일 측  = ${matchedSettled.length}건  ← 백필 후보 (xlsx 측 진짜 정산완료일)`);
  console.log(`    (b) xlsx 측 측              = ${noMatch.length}건  ← 정산 전, "정산예정금액" 라벨 spec`);
  console.log(`    (c) product_order_id NULL  = ${noPoid.length}건  ← 별도 catch`);

  // 4. (a) 백필 후보 샘플 + 정산완료일 분포.
  if (matchedSettled.length > 0) {
    console.log("\n  ─── (a) 백필 후보 샘플 (10건) ───");
    for (const { it, xlsx } of matchedSettled.slice(0, 10)) {
      console.log(`    ${it.tasks?.task_no?.padEnd(15)} / ${it.tasks?.customer_name?.padEnd(8)} / poid=${it.product_order_id}`);
      console.log(`      net_amount=${it.net_amount?.toLocaleString()}  xlsx 구매자=${xlsx.buyer}  xlsx 정산완료일=${xlsx.settled}`);
    }
    // 정산완료일 월별 분포.
    const ymCounts = new Map();
    for (const { xlsx } of matchedSettled) {
      const ym = xlsx.settled.slice(0, 7); // "2026.05" 형식
      ymCounts.set(ym, (ymCounts.get(ym) || 0) + 1);
    }
    console.log("\n    xlsx 정산완료일 월별 분포:");
    for (const ym of [...ymCounts.keys()].sort()) {
      console.log(`      ${ym} → ${ymCounts.get(ym)}건`);
    }
  }

  // 5. (b) 정산 전 샘플.
  if (noMatch.length > 0) {
    console.log("\n  ─── (b) 정산 전 (xlsx 측 측) 샘플 (10건) ───");
    for (const it of noMatch.slice(0, 10)) {
      console.log(`    ${it.tasks?.task_no?.padEnd(15)} / ${it.tasks?.customer_name?.padEnd(8)} / poid=${it.product_order_id} / net=${it.net_amount?.toLocaleString()}`);
    }
  }

  // 6. (c) product_order_id NULL 측 spec 측.
  if (noPoid.length > 0) {
    console.log("\n  ─── (c) product_order_id NULL 측 spec (10건) ───");
    for (const it of noPoid.slice(0, 10)) {
      console.log(`    ${it.tasks?.task_no?.padEnd(15)} / ${it.tasks?.customer_name?.padEnd(8)} / net=${it.net_amount?.toLocaleString()}`);
    }
  }

  // 7. 송은정 (YS-260518-029) 측 spec 측 catch.
  const songPoids = ["2026051810422421", "2026051810422431"];
  console.log("\n  ─── 송은정 (YS-260518-029) 측 xlsx 측 catch ───");
  for (const poid of songPoids) {
    const x = xlsxMap.get(poid);
    if (x) {
      console.log(`    poid=${poid} → xlsx 측 ✓  / 구매자=${x.buyer} / 정산완료일=${x.settled}`);
    } else {
      console.log(`    poid=${poid} → xlsx 측 ✗  (정산 전)`);
    }
  }

  console.log("\n  결론:");
  console.log(`    · 백필 후보 (a) = ${matchedSettled.length}건 — xlsx 측 진짜 정산완료일 있음`);
  console.log(`    · 정산 전 (b)  = ${noMatch.length}건 — xlsx 측 측 = naver_settled NULL 정상, 라벨 "정산예정금액" spec`);
  console.log(`    · poid NULL (c) = ${noPoid.length}건 — 별도 spec`);
})();

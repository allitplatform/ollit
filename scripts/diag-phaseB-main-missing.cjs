// 파트 B (읽기 전용) — 본작업 누락 30건 진단
// 각 추가선택-only task에 대해:
//   · CSV에서 같은 주문번호의 본작업(서비스종류=가정집/사무실 에어컨청소) 행 있는지
//   · 있으면 그 본작업 작업코드가 DB에 있는지
//   분류 ① CSV 본작업 있음 + DB 있음 (연결 문제)
//   분류 ② CSV 본작업 있음 + DB 없음 (진짜 누락 — INSERT 필요)
//   분류 ③ CSV에도 본작업 없음 (정상 — 추가선택 단독 주문)
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
const Papa = require("papaparse");

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CSV_PATH = path.join(__dirname, "..", "data", "usol_ops_20260524.csv");
const PHASE_B_JSON = path.join(__dirname, "diag-phaseB-2026-05-24T20-42-53.json");

(async () => {
  console.log("=".repeat(110));
  console.log("파트 B — 본작업 누락 30건 진단 (읽기 전용)");
  console.log("=".repeat(110));

  // 1. 진단 JSON에서 30건 로드
  const phaseB = JSON.parse(fs.readFileSync(PHASE_B_JSON, "utf8"));
  const addonOnly = phaseB.addonOnly;
  console.log(`\n파트 B 대상: ${addonOnly.length}건 (모두 legacy=T, 추가선택만)`);

  // 2. CSV 로드 + 주문번호별 인덱스
  const csvRaw = fs.readFileSync(CSV_PATH, "utf8");
  const csvParsed = Papa.parse(csvRaw, { header: true, skipEmptyLines: true });
  const csvRows = csvParsed.data;
  const csvByOrderNo = new Map();
  for (const r of csvRows) {
    const orderNo = (r["주문번호"] || "").trim();
    if (!orderNo) continue;
    if (!csvByOrderNo.has(orderNo)) csvByOrderNo.set(orderNo, []);
    csvByOrderNo.get(orderNo).push(r);
  }
  console.log(`CSV: ${csvRows.length} rows / ${csvByOrderNo.size} 고유 주문번호`);

  // 3. DB의 모든 usol task 코드 (본작업 검색용)
  const { data: principals } = await sb.from("principals").select("id, code").in("code", ["usol_n", "usol_h"]);
  const pids = principals.map(p => p.id);
  let allTasks = [], from = 0;
  while (true) {
    const { data } = await sb.from("tasks").select("task_no, external_order_no, status")
      .in("principal_id", pids).range(from, from + 999);
    if (!data || data.length === 0) break;
    allTasks = allTasks.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const dbTaskByCode = new Map(allTasks.map(t => [t.task_no, t]));
  console.log(`DB usol task: ${allTasks.length}건`);

  // 4. 각 30건 분류
  const cat1 = [];  // CSV 본작업 있음 + DB 있음 (연결 문제)
  const cat2 = [];  // CSV 본작업 있음 + DB 없음 (진짜 누락)
  const cat3 = [];  // CSV에 본작업 없음 (정상)

  function isMainService(s) {
    return /가정집|사무실/.test(String(s || ""));
  }

  for (const a of addonOnly) {
    const ext = a.external_order_no;
    if (!ext) {
      cat3.push({ ...a, reason: "external_order_no 자체 없음" });
      continue;
    }
    const csvRowsForOrder = csvByOrderNo.get(String(ext)) || [];
    const mainRows = csvRowsForOrder.filter(r => isMainService(r["서비스종류"]));

    if (mainRows.length === 0) {
      cat3.push({ ...a, csvRowsForOrder: csvRowsForOrder.length, reason: "CSV에 본작업 행 없음" });
      continue;
    }

    const mainCodes = mainRows.map(r => (r["작업코드"] || "").trim()).filter(Boolean);
    const dbHas = mainCodes.filter(c => dbTaskByCode.has(c));
    const dbMiss = mainCodes.filter(c => !dbTaskByCode.has(c));

    if (dbMiss.length > 0 && dbHas.length === 0) {
      cat2.push({ ...a, mainCsvCodes: mainCodes, dbMissCodes: dbMiss });
    } else if (dbHas.length > 0 && dbMiss.length === 0) {
      const mainDbInfo = dbHas.map(c => {
        const t = dbTaskByCode.get(c);
        return { code: c, ext: t.external_order_no, status: t.status };
      });
      cat1.push({ ...a, mainCsvCodes: mainCodes, mainDbInfo });
    } else {
      // 일부는 DB 있고 일부는 없음 — cat1과 cat2 양쪽
      cat1.push({ ...a, mainCsvCodes: mainCodes, dbHasCodes: dbHas, dbMissCodes: dbMiss, mixed: true });
    }
  }

  console.log("\n[분류 결과]");
  console.log(`  ① CSV 본작업 있음 + DB 있음 (연결 문제):    ${cat1.length}건`);
  console.log(`  ② CSV 본작업 있음 + DB 없음 (진짜 누락):     ${cat2.length}건`);
  console.log(`  ③ CSV에도 본작업 없음 (정상/추가선택 단독): ${cat3.length}건`);

  if (cat1.length > 0) {
    console.log("\n[분류 ① — DB에 본작업 있지만 안 묶임 (external_order_no 차이 등)]");
    for (const x of cat1) {
      console.log(`  ${x.task_no} | ${x.customer_name} | ext=${x.external_order_no}`);
      console.log(`    CSV 본작업 코드: ${x.mainCsvCodes.join(", ")}`);
      const info = x.mainDbInfo || (x.dbHasCodes || []).map(c => {
        const t = dbTaskByCode.get(c);
        return { code: c, ext: t.external_order_no, status: t.status };
      });
      for (const i of info) {
        const same = i.ext === x.external_order_no;
        console.log(`      DB ${i.code} → ext=${i.ext || "NULL"} status=${i.status} ${same ? "ext 동일" : "⚠️ ext 불일치"}`);
      }
      if (x.mixed) console.log(`      (mixed) DB 없는 코드: ${x.dbMissCodes.join(", ")}`);
    }
  }

  if (cat2.length > 0) {
    console.log("\n[분류 ② — CSV에 본작업 있지만 DB 누락 (INSERT 필요)]");
    for (const x of cat2) {
      console.log(`  ${x.task_no} | ${x.customer_name} | ext=${x.external_order_no} → 누락 본작업 코드: ${x.dbMissCodes.join(", ")}`);
    }
  }

  if (cat3.length > 0) {
    console.log("\n[분류 ③ — CSV에도 본작업 없음 (정상 / 별도 처리)]");
    for (const x of cat3) {
      console.log(`  ${x.task_no} | ${x.customer_name} | ext=${x.external_order_no} | csvRows=${x.csvRowsForOrder ?? 0} | ${x.reason}`);
    }
  }

  // 5. 결과 JSON 저장
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outFile = path.join(__dirname, `diag-phaseB-main-missing-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    counts: { cat1: cat1.length, cat2: cat2.length, cat3: cat3.length },
    cat1, cat2, cat3,
  }, null, 2));
  console.log(`\n결과 저장: ${outFile}`);

  console.log("\n" + "=".repeat(110));
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

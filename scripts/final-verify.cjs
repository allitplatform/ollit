// 최종 측 — 회사배분 = engineer + owner 비교 + 강승희 appliance 매칭 측
const fs = require("fs"), path = require("path");
const Papa = require("papaparse");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function toInt(v) { const n = parseFloat(String(v || "").replace(/[,\s]/g, "")); return isNaN(n) ? 0 : Math.round(n); }
function cleanStr(v) { return v == null ? "" : String(v).trim(); }

(async () => {
  // CSV 측
  const csvRaw = fs.readFileSync(path.join(__dirname, "..", "신규_43주문_INSERT용.csv"), "utf8");
  const csvText = csvRaw.charCodeAt(0) === 0xFEFF ? csvRaw.slice(1) : csvRaw;
  const rows = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() }).data;
  const groups = new Map();
  for (const r of rows) {
    const o = cleanStr(r["주문번호"]); if (!o) continue;
    if (!groups.has(o)) groups.set(o, []); groups.get(o).push(r);
  }
  const sheetByTaskNo = new Map();
  for (const [, grp] of groups) sheetByTaskNo.set(cleanStr(grp[0]["작업코드"]), grp);

  const sampleNos = ["YS-260515-010", "YS-260515-070", "YS-260516-022", "YS-260516-116", "YS-260516-162"];
  // .in 측 측 X 측 측 — single 측 측 catch
  const tasks = [];
  for (const tn of sampleNos) {
    const { data: t } = await sb.from("tasks").select("id, task_no").eq("task_no", tn).maybeSingle();
    if (t) tasks.push(t);
  }
  console.log(`tasks catch: ${tasks.length}건\n`);

  const payByTask = new Map();
  for (const t of tasks) {
    const { data: pays, error } = await sb.from("payments").select("*").eq("task_id", t.id);
    console.log(`  ${t.task_no}: payments rows=${pays?.length || 0} ${error ? "err=" + error.message : ""}`);
    if (pays && pays.length > 0) payByTask.set(t.id, pays[0]);
  }
  console.log(`payByTask size: ${payByTask.size}\n`);

  console.log(`${"=".repeat(95)}\n[재비교] 시트 회사배분 vs (engineer + owner)\n${"=".repeat(95)}\n`);
  for (const t of tasks) {
    const pay = payByTask.get(t.id);
    const grp = sheetByTaskNo.get(t.task_no);
    const sP = grp.reduce((s, r) => s + toInt(r["도급사정산액"]), 0);
    const sE = grp.reduce((s, r) => s + toInt(r["회사배분액"]), 0);
    const sT = grp.reduce((s, r) => s + toInt(r["정산예정금액"]), 0);
    if (!pay) continue;
    const dbEngOwn = pay.engineer_amount + pay.owner_amount;
    console.log(`▣ ${t.task_no} | calc_method=${pay.calc_method} | balanced=${pay.is_balanced}`);
    console.log(`   도급사:        trigger=${pay.principal_amount}\t시트=${sP}\t측=${pay.principal_amount - sP}`);
    console.log(`   회사배분(시트): ${sE}`);
    console.log(`   engineer (기사): ${pay.engineer_amount}`);
    console.log(`   owner (회사):    ${pay.owner_amount}`);
    console.log(`   eng + own:       ${dbEngOwn}\t측 시트=${dbEngOwn - sE}`);
    console.log(`   pay columns:     ${Object.keys(pay).join(", ")}\n`);
  }

  // ============================================================================
  // 강승희 task_items 측 appliance 매칭 측
  // ============================================================================
  console.log(`${"=".repeat(95)}\n[강승희] task_items appliance 매칭 측\n${"=".repeat(95)}\n`);

  const kssGrp = groups.get("2026052271268341");
  console.log(`  시트 측 (3건):`);
  for (const r of kssGrp) {
    console.log(`    · 서비스구분=${cleanStr(r["서비스구분"])} | 정산예정금액=${r["정산예정금액"]}`);
  }

  const { data: kssTask } = await sb.from("tasks").select(`id, task_no, customer_name, task_items(unit_price, qty, order_type, product_order_id, work_types(name, code), appliance_types(name, code))`).eq("task_no", "YS-N-260523-005").maybeSingle();
  console.log(`\n  DB 측 (${kssTask?.task_no} | ${kssTask?.customer_name}):`);
  for (const it of (kssTask?.task_items || [])) {
    console.log(`    · unit_price=${it.unit_price} | order_type=${it.order_type} | work_type=${it.work_types?.name || "(X)"} (${it.work_types?.code}) | appliance=${it.appliance_types?.name || "(X)"} (${it.appliance_types?.code}) | product_order=${it.product_order_id}`);
  }

  // 매칭 검증 — 사장님 spec: 119,086=가정용 스탠드 / 69,412=벽걸이 / 9,445=냉매점검
  console.log(`\n  사장님 측 예상 매칭:`);
  console.log(`    · 119,086 → 가정용 스탠드 (서비스구분)`);
  console.log(`    · 69,412  → 벽걸이`);
  console.log(`    · 9,445   → 냉매점검`);
  console.log(`\n  실제 시트 측 측 측 매칭 (정산예정금액 기준):`);
  for (const r of kssGrp) {
    console.log(`    · 정산예정금액=${toInt(r["정산예정금액"])} → 서비스구분=${cleanStr(r["서비스구분"])} | 상품주문번호=${cleanStr(r["상품주문번호"])}`);
  }
})();

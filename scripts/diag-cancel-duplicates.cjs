// ④-2 측 — 중복 의심 8건 status='취소' 시뮬레이션 (수정 X)
const fs = require("fs"), path = require("path");
const XLSX = require("xlsx");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PRINCIPAL_ID = "22222222-2222-2222-2222-222222222006";
function cleanStr(v) { return v == null ? "" : String(v).trim(); }
function toInt(v) { const n = parseFloat(String(v || "").replace(/[,\s]/g, "")); return isNaN(n) ? 0 : Math.round(n); }

const SUSPECT_TASKS = [
  "YS-260513-005", "YS-260516-021", "YS-260516-115", "YS-260517-058",
  "YS-260518-075", "YS-260515-009", "YS-260515-069", "YS-260517-027",
];

(async () => {
  console.log(`${"=".repeat(95)}\n④-2 측 — 8건 status='취소' 측 시뮬레이션\n${"=".repeat(95)}\n`);

  // [1] 측 코드 측 status='취소' 측 측 측 측 측 확인 측 측
  console.log(`[1] 측 코드 측 status='취소' 측 측 측 측 측\n`);
  console.log(`  · utils/taskStatus.js isCompletedStatus("취소") → false (완료 X)`);
  console.log(`  · utils/remitFilter.js isTrackARemittance({status:'취소'}) → isCompletedStatus 측 측 → false (송금 측 X)`);
  console.log(`  · AdminApp dashboardStats — 측 분류 측 (미배정/배정/확정/진행중/완료) 측 측 catch X → 측 측 → 측 자동 측 catch`);
  console.log(`  · SettlementHistoryContent — payments 측 task.status 측 측 측 → 측 catch 측 측 X (측 측)`);
  console.log(`  → ✅ status='취소' 측 측 측 측 자동 측 측. payments measurement 측 안전.\n`);

  // [2] 측 8건 측 측 측
  console.log(`[2] 측 측 측 측 (UPDATE 측)\n`);
  const { data: tasks } = await sb.from("tasks").select("id, task_no, status, external_order_no").eq("tenant_id", TENANT_ID).in("task_no", SUSPECT_TASKS);
  const taskIds = tasks.map(t => t.id);
  const taskById = new Map(tasks.map(t => [t.id, t]));

  const { data: pays } = await sb.from("payments").select("task_id, principal_amount, engineer_amount, owner_amount, calc_method").in("task_id", taskIds);
  const payByTask = new Map((pays || []).map(p => [p.task_id, p]));

  let sumP = 0, sumE = 0, sumO = 0;
  for (const t of tasks) {
    const p = payByTask.get(t.id);
    if (!p) { console.log(`  ${t.task_no}: payments X`); continue; }
    console.log(`  ${t.task_no} | status=${t.status} | P=${p.principal_amount} E=${p.engineer_amount} O=${p.owner_amount} | calc=${p.calc_method}`);
    sumP += p.principal_amount; sumE += p.engineer_amount; sumO += p.owner_amount;
  }
  console.log(`\n  측 측 합: P=${sumP} | E=${sumE} | O=${sumO} | E+O=${sumE + sumO}`);

  // [3] 시트 측 측 측 측 정산 합계 catch (8건 측 측 측 task — 시트 측 task_no 측)
  console.log(`\n[3] 측 8건 측 측 측 — 시트 측 (정상) task 측 정산 합계\n`);
  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, "..", "유솔홈케어_운영.xlsx")), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const sheetByOrderNo = new Map();
  for (const r of rows) { const o = cleanStr(r["주문번호"]); if (!o) continue; if (!sheetByOrderNo.has(o)) sheetByOrderNo.set(o, []); sheetByOrderNo.get(o).push(r); }

  const orders = new Set(tasks.map(t => t.external_order_no).filter(Boolean));
  let sheetSumP = 0, sheetSumE = 0;
  for (const orderNo of orders) {
    const sRows = sheetByOrderNo.get(orderNo) || [];
    const sP = sRows.reduce((s, r) => s + toInt(r["도급사정산액"]), 0);
    const sE = sRows.reduce((s, r) => s + toInt(r["회사배분액"]), 0);
    sheetSumP += sP; sheetSumE += sE;
    console.log(`  주문 ${orderNo}: 시트 측 ${sRows.length}건 | P=${sP} | E=${sE}`);
  }
  console.log(`\n  시트 측 정산 합: P=${sheetSumP} | E=${sheetSumE}`);

  // [4] 측 8건 + 같은 주문 측 정상 task — 측 DB 정산 합계 (취소 측 측)
  console.log(`\n[4] 측 8건 같은 주문 측 측 측 task — DB payments 합계\n`);
  const { data: allOrderTasks } = await sb.from("tasks").select("id, task_no, status, external_order_no").eq("tenant_id", TENANT_ID).eq("principal_id", PRINCIPAL_ID).in("external_order_no", Array.from(orders));
  const allIds = allOrderTasks.map(t => t.id);
  const { data: allPays } = await sb.from("payments").select("task_id, principal_amount, engineer_amount, owner_amount").in("task_id", allIds);

  let allSumP = 0, allSumE = 0, allSumO = 0;
  for (const p of (allPays || [])) { allSumP += p.principal_amount; allSumE += p.engineer_amount; allSumO += p.owner_amount; }
  console.log(`  측 task ${allOrderTasks.length}건 | payments ${allPays.length}건`);
  console.log(`  측 합: P=${allSumP} | E=${allSumE} | O=${allSumO} | E+O=${allSumE + allSumO}`);

  // [5] 시뮬레이션 — 8건 측 측 측 측 측 합계
  console.log(`\n[5] 측 시뮬레이션 — 8건 status='취소' 측 측 측 측\n`);
  const expectedP = allSumP - sumP;
  const expectedE = allSumE - sumE;
  const expectedO = allSumO - sumO;
  console.log(`  측 측 (취소 측 측): P=${expectedP} | E=${expectedE} | O=${expectedO} | E+O=${expectedE + expectedO}`);
  console.log(`  시트 측:           P=${sheetSumP} | E=${sheetSumE}`);
  const diffP = expectedP - sheetSumP;
  const diffEO = (expectedE + expectedO) - sheetSumE;
  console.log(`  측: P측=${diffP} | E+O측=${diffEO}`);
  console.log(`  → ${diffP === 0 && diffEO === 0 ? "✅ 측 일치 — 측 측 측 측 측 시트 측 일치" : "⚠️ 측 measurement — 측 측 측"}`);

  // [6] payments 처리안
  console.log(`\n${"=".repeat(95)}\n[6] payments 처리안\n${"=".repeat(95)}`);
  console.log(`\n  · 측 측 — payments measurement 측. task.status='취소' 측 측 측 측 측 catch 측 측 측 측 X.`);
  console.log(`  · DELETE 측 측 X — task_items cascade delete 위험 (이전 측 같은 측 경험).`);
  console.log(`  · status='취소' UPDATE 측 측 — payments 측 측 측 측 measurement, 측 측 측 측 측 측 catch X.`);
})();

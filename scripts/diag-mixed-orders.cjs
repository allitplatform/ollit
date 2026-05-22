// ③ 추가 진단 — 혼합 주문 측 단위 합산 + YS-260517-054 측
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

(async () => {
  // 측 측 측
  const { data: usolTasks } = await sb.from("tasks").select("id, task_no, external_order_no, status").eq("tenant_id", TENANT_ID).eq("principal_id", PRINCIPAL_ID);
  const taskById = new Map(usolTasks.map(t => [t.id, t]));
  const tasksByOrderNo = new Map();
  for (const t of usolTasks) {
    if (!t.external_order_no) continue;
    if (!tasksByOrderNo.has(t.external_order_no)) tasksByOrderNo.set(t.external_order_no, []);
    tasksByOrderNo.get(t.external_order_no).push(t);
  }

  const taskIds = usolTasks.map(t => t.id);
  const chunkSize = 200;
  const allItems = [];
  for (let i = 0; i < taskIds.length; i += chunkSize) {
    const chunk = taskIds.slice(i, i + chunkSize);
    const { data } = await sb.from("task_items").select("id, task_id, order_type, work_type_id, appliance_type_id, unit_price, qty, product_order_id").in("task_id", chunk);
    if (data) allItems.push(...data);
  }
  const itemsByTaskId = new Map();
  for (const it of allItems) {
    if (!itemsByTaskId.has(it.task_id)) itemsByTaskId.set(it.task_id, []);
    itemsByTaskId.get(it.task_id).push(it);
  }

  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, "..", "유솔홈케어_운영.xlsx")), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const sheetByOrderNo = new Map();
  for (const r of rows) {
    const o = cleanStr(r["주문번호"]);
    if (!o) continue;
    if (!sheetByOrderNo.has(o)) sheetByOrderNo.set(o, []);
    sheetByOrderNo.get(o).push(r);
  }

  const { data: pays } = await sb.from("payments").select("task_id, principal_amount, engineer_amount, owner_amount, calc_method");
  const payByTaskId = new Map((pays || []).map(p => [p.task_id, p]));

  const wtRes = await sb.from("work_types").select("id, code, name, appliance_type_id");
  const atRes = await sb.from("appliance_types").select("id, code, name");
  const wtById = new Map(wtRes.data.map(w => [w.id, w]));
  const atById = new Map(atRes.data.map(a => [a.id, a]));

  // ============================================================================
  // [A] 혼합 주문 측 측 측 합산 검증
  // ============================================================================
  console.log(`${"=".repeat(140)}\n[A] 혼합 주문 — 주문번호 측 합산 (DB payments 합 vs 시트 측 측 task_no 행 합)\n${"=".repeat(140)}\n`);
  // 혼합 측 측 — 측 주문 측 측 측 task_items 측 order_type 측 measurement {본작업, 추가선택} measurement
  const mixedOrders = [];
  for (const [orderNo, tasks] of tasksByOrderNo) {
    const allOrderItems = tasks.flatMap(t => itemsByTaskId.get(t.id) || []);
    const ots = new Set(allOrderItems.map(it => it.order_type).filter(Boolean));
    if (ots.size >= 2) mixedOrders.push({ orderNo, tasks, items: allOrderItems });
  }
  console.log(`  혼합 주문 측 측: ${mixedOrders.length}건`);

  let matched = 0, mismatched = 0;
  const mismatches = [];
  for (const m of mixedOrders) {
    let dbP = 0, dbE = 0, dbO = 0;
    for (const t of m.tasks) {
      const pay = payByTaskId.get(t.id);
      if (pay) { dbP += pay.principal_amount || 0; dbE += pay.engineer_amount || 0; dbO += pay.owner_amount || 0; }
    }
    const sheetRows = sheetByOrderNo.get(m.orderNo) || [];
    const sP = sheetRows.reduce((s, r) => s + toInt(r["도급사정산액"]), 0);
    const sE = sheetRows.reduce((s, r) => s + toInt(r["회사배분액"]), 0);
    const diffP = dbP - sP;
    const diffEO = (dbE + dbO) - sE;
    const isMatch = Math.abs(diffP) <= 1 && Math.abs(diffEO) <= 1;
    if (isMatch) matched++;
    else mismatched++;
    if (!isMatch) mismatches.push({ orderNo: m.orderNo, taskCount: m.tasks.length, sheetRows: sheetRows.length, dbP, dbE, dbO, sP, sE, diffP, diffEO });
  }
  console.log(`  · 측 측: ${matched}건`);
  console.log(`  · 불일치: ${mismatched}건`);

  if (mismatches.length > 0) {
    console.log(`\n  불일치 측 (측 30건):`);
    console.log(`  order_no\t\tDB task\t시트 측\tDB P\tDB E+O\t시트 P\t시트 E\t측 P\t측 E+O`);
    for (const m of mismatches.slice(0, 30)) {
      console.log(`  ${m.orderNo}\t${m.taskCount}\t${m.sheetRows}\t${m.dbP}\t${m.dbE + m.dbO}\t${m.sP}\t${m.sE}\t${m.diffP}\t${m.diffEO}`);
    }
  }

  // ============================================================================
  // [B] YS-260517-054 측 측 — DB task_items vs 시트 측 측
  // ============================================================================
  console.log(`\n${"=".repeat(140)}\n[B] YS-260517-054 측 측 (DB +9,444 측)\n${"=".repeat(140)}\n`);
  const t054 = usolTasks.find(t => t.task_no === "YS-260517-054");
  if (!t054) { console.log(`  X — task 측 X`); return; }

  console.log(`  DB task:`);
  console.log(`    task_no: ${t054.task_no}`);
  console.log(`    external_order_no: ${t054.external_order_no}`);
  console.log(`    status: ${t054.status}`);

  const items054 = itemsByTaskId.get(t054.id) || [];
  console.log(`\n  DB task_items (${items054.length}건):`);
  for (const it of items054) {
    const wt = wtById.get(it.work_type_id);
    const at = it.appliance_type_id ? atById.get(it.appliance_type_id) : null;
    console.log(`    · order_type=${it.order_type} | unit_price=${it.unit_price} | qty=${it.qty} | work_type=${wt?.name} (${wt?.code}) | appliance=${at?.name || "(X)"} | product_order=${it.product_order_id}`);
  }

  const pay054 = payByTaskId.get(t054.id);
  console.log(`\n  DB payments:`);
  console.log(`    principal=${pay054?.principal_amount} | engineer=${pay054?.engineer_amount} | owner=${pay054?.owner_amount} | calc=${pay054?.calc_method}`);

  const sheetOrder054 = sheetByOrderNo.get(t054.external_order_no) || [];
  console.log(`\n  시트 측 측 측 (${sheetOrder054.length}건):`);
  for (const r of sheetOrder054) {
    console.log(`    · 작업코드=${cleanStr(r["작업코드"])} | 서비스종류=${cleanStr(r["서비스종류"])} | 서비스구분=${cleanStr(r["서비스구분"])} | 정산예정=${r["정산예정금액"]} | 도급사=${r["도급사정산액"]} | 회사배분=${r["회사배분액"]}`);
  }
})();

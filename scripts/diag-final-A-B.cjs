// ③ 최종 진단 — A: DB 측 task_items 측 측 / B: 3건 order_type 시뮬레이션
const fs = require("fs"), path = require("path");
const XLSX = require("xlsx");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PRINCIPAL_ID = "22222222-2222-2222-2222-222222222006";

const APPLIANCE_KEYWORD = { wall: "벽걸이", "1way": "1way", "2way": "2way", "4way": "4way", stand: "스탠드", round: "원형", "2in1": "투인원", multi: "시스템멀티" };
const ADDON_KEYWORD = { refri_no_appliance: "냉매점검", fan_disassembly: "송풍팬", outdoor_unit: "실외기", phytoncide: "피톤치드" };
function cleanStr(v) { return v == null ? "" : String(v).trim(); }
function toInt(v) { const n = parseFloat(String(v || "").replace(/[,\s]/g, "")); return isNaN(n) ? 0 : Math.round(n); }

(async () => {
  const { data: usolTasks } = await sb.from("tasks").select("id, task_no, external_order_no, customer_name, status").eq("tenant_id", TENANT_ID).eq("principal_id", PRINCIPAL_ID);
  const taskById = new Map(usolTasks.map(t => [t.id, t]));
  const tasksByOrderNo = new Map();
  for (const t of usolTasks) { if (!t.external_order_no) continue; if (!tasksByOrderNo.has(t.external_order_no)) tasksByOrderNo.set(t.external_order_no, []); tasksByOrderNo.get(t.external_order_no).push(t); }

  const taskIds = usolTasks.map(t => t.id);
  const allItems = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    const { data } = await sb.from("task_items").select("id, task_id, order_type, work_type_id, appliance_type_id, unit_price, product_order_id").in("task_id", taskIds.slice(i, i + 200));
    if (data) allItems.push(...data);
  }
  const itemsByTaskId = new Map();
  for (const it of allItems) { if (!itemsByTaskId.has(it.task_id)) itemsByTaskId.set(it.task_id, []); itemsByTaskId.get(it.task_id).push(it); }

  const wtRes = await sb.from("work_types").select("id, code, name, appliance_type_id");
  const atRes = await sb.from("appliance_types").select("id, code, name");
  const wtById = new Map(wtRes.data.map(w => [w.id, w]));
  const atById = new Map(atRes.data.map(a => [a.id, a]));

  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, "..", "유솔홈케어_운영.xlsx")), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const sheetByOrderNo = new Map();
  for (const r of rows) { const o = cleanStr(r["주문번호"]); if (!o) continue; if (!sheetByOrderNo.has(o)) sheetByOrderNo.set(o, []); sheetByOrderNo.get(o).push(r); }

  const { data: pays } = await sb.from("payments").select("task_id, principal_amount, engineer_amount, owner_amount, calc_method");
  const payByTaskId = new Map((pays || []).map(p => [p.task_id, p]));

  function getKeyword(item) {
    if (!item.work_type_id) return null;
    const wt = wtById.get(item.work_type_id);
    if (!wt) return null;
    if (wt.appliance_type_id) {
      const at = atById.get(wt.appliance_type_id);
      if (at && APPLIANCE_KEYWORD[at.code]) return APPLIANCE_KEYWORD[at.code];
    }
    if (ADDON_KEYWORD[wt.code]) return ADDON_KEYWORD[wt.code];
    return null;
  }

  // ============================================================================
  // [A] DB 측 task_items — 측 measurement 시트 측 측 측
  // ============================================================================
  console.log(`${"=".repeat(140)}\n[A] DB 측 task_items 측 (시트 측 측 측 task_item 측)\n${"=".repeat(140)}\n`);

  const dbOnlyItems = [];
  for (const [orderNo, tasks] of tasksByOrderNo) {
    const sheetRows = sheetByOrderNo.get(orderNo);
    if (!sheetRows) continue;
    const orderItems = tasks.flatMap(t => (itemsByTaskId.get(t.id) || []).map(it => ({ ...it, _task_no: t.task_no, _customer: t.customer_name })));
    if (orderItems.length <= sheetRows.length) continue;   // DB ≤ 시트 → 측 task_items 측 측 측 측 X

    const usedSheetIdx = new Set();
    for (const item of orderItems) {
      const keyword = getKeyword(item);
      if (!keyword) { dbOnlyItems.push({ order: orderNo, item, reason: "keyword 측 측 X" }); continue; }
      let foundIdx = -1;
      for (let i = 0; i < sheetRows.length; i++) {
        if (usedSheetIdx.has(i)) continue;
        if (String(sheetRows[i]["서비스구분"] || "").includes(keyword)) { foundIdx = i; break; }
      }
      if (foundIdx < 0) { dbOnlyItems.push({ order: orderNo, item, reason: "시트 측 측 측 task_items 측 측 측" }); }
      else usedSheetIdx.add(foundIdx);
    }
  }

  console.log(`  DB 측 task_items: ${dbOnlyItems.length}건\n`);
  console.log(`  task_no\t\t고객\t\torder_type\twork_type\t\tunit_price\tproduct_order_id`);
  console.log("-".repeat(140));
  for (const d of dbOnlyItems) {
    const wt = wtById.get(d.item.work_type_id);
    console.log(`  ${d.item._task_no}\t${d.item._customer}\t${d.item.order_type}\t${wt?.name || "(X)"}\t${d.item.unit_price}\t${d.item.product_order_id || "(X)"}`);
  }

  // 측 측 측 주문 측 시트 측 측 측 — 측 1건 측 측 측 시트 측 측 측
  if (dbOnlyItems.length > 0) {
    console.log(`\n  측 측 측 주문 측 시트 측 측 측 (측 5건):`);
    const seenOrders = new Set();
    for (const d of dbOnlyItems) {
      if (seenOrders.has(d.order)) continue;
      seenOrders.add(d.order);
      if (seenOrders.size > 5) break;
      const sheetRows = sheetByOrderNo.get(d.order) || [];
      console.log(`\n  ▣ 주문번호: ${d.order}`);
      console.log(`     시트 측 (${sheetRows.length}건):`);
      for (const r of sheetRows) {
        console.log(`       · 작업코드=${cleanStr(r["작업코드"])} | 서비스종류=${cleanStr(r["서비스종류"])} | 서비스구분=${cleanStr(r["서비스구분"])} | 정산예정=${r["정산예정금액"]}`);
      }
      const dbTasks = tasksByOrderNo.get(d.order) || [];
      const dbItems = dbTasks.flatMap(t => (itemsByTaskId.get(t.id) || []).map(it => ({ ...it, _task_no: t.task_no })));
      console.log(`     DB 측 (${dbItems.length}건):`);
      for (const it of dbItems) {
        const wt = wtById.get(it.work_type_id);
        console.log(`       · task_no=${it._task_no} | order_type=${it.order_type} | work_type=${wt?.name} | unit_price=${it.unit_price}`);
      }
    }
  }

  // ============================================================================
  // [B] 3건 order_type 시뮬레이션
  // ============================================================================
  console.log(`\n${"=".repeat(140)}\n[B] order_type 3건 시뮬레이션 — UPDATE → compute_payment → 측 → 원복\n${"=".repeat(140)}\n`);

  const cases = [
    { task_no: "YS-260522-016", item_keyword: "스탠드", from: "추가선택", to: "본작업" },
    { task_no: "YS-260424-080", item_keyword: "벽걸이", from: "본작업",   to: "추가선택" },
    { task_no: "YS-260516-036", item_keyword: "실외기", from: "추가선택", to: "본작업" },   // 대형실외기 (outdoor_unit work_type)
  ];

  for (const c of cases) {
    const task = usolTasks.find(t => t.task_no === c.task_no);
    if (!task) { console.log(`  ${c.task_no}: task X`); continue; }
    const items = itemsByTaskId.get(task.id) || [];
    const targetItem = items.find(it => {
      const kw = getKeyword(it);
      return kw === c.item_keyword;
    });
    if (!targetItem) { console.log(`  ${c.task_no}: item (${c.item_keyword}) 측 X`); continue; }

    // 측 시트 측 정산
    const sheetRows = sheetByOrderNo.get(task.external_order_no) || [];
    const sP = sheetRows.reduce((s, r) => s + toInt(r["도급사정산액"]), 0);
    const sE = sheetRows.reduce((s, r) => s + toInt(r["회사배분액"]), 0);

    // 측 DB 측 측
    const beforeAll = (tasksByOrderNo.get(task.external_order_no) || []).reduce((acc, t) => {
      const p = payByTaskId.get(t.id);
      return p ? { P: acc.P + (p.principal_amount||0), E: acc.E + (p.engineer_amount||0), O: acc.O + (p.owner_amount||0) } : acc;
    }, { P: 0, E: 0, O: 0 });

    console.log(`\n  ▣ ${c.task_no} (item ${c.item_keyword}) — ${c.from} → ${c.to}`);
    console.log(`     시트:  P=${sP} | E=${sE}`);
    console.log(`     측 DB: P=${beforeAll.P} | E+O=${beforeAll.E + beforeAll.O}`);

    // UPDATE
    const { error: u1 } = await sb.from("task_items").update({ order_type: c.to }).eq("id", targetItem.id);
    if (u1) { console.log(`     ❌ UPDATE: ${u1.message}`); continue; }

    // compute_payment 측 호출 (측 task 측)
    for (const t of (tasksByOrderNo.get(task.external_order_no) || [])) {
      await sb.rpc("compute_payment", { p_task_id: t.id });
    }

    // 측 측 measurement payments lookup
    const afterTaskIds = (tasksByOrderNo.get(task.external_order_no) || []).map(t => t.id);
    const afterPays = [];
    for (const tid of afterTaskIds) {
      const { data } = await sb.from("payments").select("principal_amount, engineer_amount, owner_amount, calc_method").eq("task_id", tid);
      if (data) afterPays.push(...data);
    }
    const afterAll = afterPays.reduce((acc, p) => ({ P: acc.P + (p.principal_amount||0), E: acc.E + (p.engineer_amount||0), O: acc.O + (p.owner_amount||0) }), { P: 0, E: 0, O: 0 });
    console.log(`     측 DB: P=${afterAll.P} | E+O=${afterAll.E + afterAll.O} | calc_methods=${[...new Set(afterPays.map(p => p.calc_method))].join("/")}`);
    const matchP = afterAll.P === sP;
    const matchE = (afterAll.E + afterAll.O) === sE;
    console.log(`     시트 측 측: P=${matchP ? "✅" : "❌"} (측=${afterAll.P - sP}) | E+O=${matchE ? "✅" : "❌"} (측=${(afterAll.E + afterAll.O) - sE})`);

    // 원복
    const { error: u2 } = await sb.from("task_items").update({ order_type: c.from }).eq("id", targetItem.id);
    if (u2) { console.log(`     ❌ 원복: ${u2.message}`); continue; }
    for (const t of (tasksByOrderNo.get(task.external_order_no) || [])) {
      await sb.rpc("compute_payment", { p_task_id: t.id });
    }
    console.log(`     ✅ 원복 측 (order_type=${c.from})`);
  }
})();

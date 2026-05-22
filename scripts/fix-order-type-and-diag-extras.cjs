// ③ 마무리 — order_type 3건 + NULL 1건 UPDATE + compute_payment + 결과 측
// ④ 진단 — DB measurement task / 중복 의심 / DB 측 task_item 측

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
  // ============================================================================
  // ③-A. order_type 3건 UPDATE
  // ============================================================================
  console.log(`${"=".repeat(85)}\n③-A. order_type 3건 UPDATE + compute_payment\n${"=".repeat(85)}\n`);

  const cases = [
    { task_no: "YS-260522-016", keyword: "스탠드", to: "본작업" },
    { task_no: "YS-260424-080", keyword: "벽걸이", to: "추가선택" },
    { task_no: "YS-260516-036", keyword: "실외기", to: "본작업" },
  ];

  // lookup helper
  const wtRes = await sb.from("work_types").select("id, code, name, appliance_type_id");
  const atRes = await sb.from("appliance_types").select("id, code, name");
  const wtById = new Map(wtRes.data.map(w => [w.id, w]));
  const atById = new Map(atRes.data.map(a => [a.id, a]));
  function getKw(item) {
    const wt = wtById.get(item.work_type_id);
    if (!wt) return null;
    if (wt.appliance_type_id) {
      const at = atById.get(wt.appliance_type_id);
      if (at && APPLIANCE_KEYWORD[at.code]) return APPLIANCE_KEYWORD[at.code];
    }
    if (ADDON_KEYWORD[wt.code]) return ADDON_KEYWORD[wt.code];
    return null;
  }

  for (const c of cases) {
    const { data: task } = await sb.from("tasks").select("id, external_order_no").eq("tenant_id", TENANT_ID).eq("task_no", c.task_no).maybeSingle();
    if (!task) { console.log(`  ${c.task_no}: task X`); continue; }
    const { data: items } = await sb.from("task_items").select("id, order_type, work_type_id").eq("task_id", task.id);
    const target = (items || []).find(it => getKw(it) === c.keyword);
    if (!target) { console.log(`  ${c.task_no}: item (${c.keyword}) X`); continue; }

    const { error: u } = await sb.from("task_items").update({ order_type: c.to }).eq("id", target.id);
    if (u) { console.log(`  ❌ ${c.task_no} UPDATE: ${u.message}`); continue; }

    // 같은 주문 측 측 task 측 compute_payment 측 호출
    const { data: orderTasks } = await sb.from("tasks").select("id").eq("tenant_id", TENANT_ID).eq("external_order_no", task.external_order_no);
    for (const t of (orderTasks || [])) {
      await sb.rpc("compute_payment", { p_task_id: t.id });
    }
    console.log(`  ✅ ${c.task_no} (${c.keyword}) → ${c.to} UPDATE + compute_payment 측`);
  }

  // ============================================================================
  // ③-B. NULL 1건 백필 — YS-N-260522-001 (refri_wall → 추가선택)
  // ============================================================================
  console.log(`\n${"=".repeat(85)}\n③-B. NULL 1건 백필 — YS-N-260522-001\n${"=".repeat(85)}\n`);
  const { data: nullTask } = await sb.from("tasks").select("id").eq("tenant_id", TENANT_ID).eq("task_no", "YS-N-260522-001").maybeSingle();
  if (nullTask) {
    const { data: nullItems } = await sb.from("task_items").select("id, order_type, work_type_id").eq("task_id", nullTask.id);
    const target = (nullItems || []).find(it => it.order_type == null);
    if (target) {
      const { error } = await sb.from("task_items").update({ order_type: "추가선택" }).eq("id", target.id);
      if (error) console.log(`  ❌ UPDATE: ${error.message}`);
      else       console.log(`  ✅ YS-N-260522-001 task_item order_type=추가선택 UPDATE 측 (status=취소, 정산 영향 X)`);
    } else {
      console.log(`  · 측 measurement NULL item X (이미 측 측?)`);
    }
  }

  // ============================================================================
  // ③ 측 결과 측 — 3건 정산 측 시트 측 측 측
  // ============================================================================
  console.log(`\n${"=".repeat(85)}\n③ UPDATE 측 정산 측\n${"=".repeat(85)}\n`);

  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, "..", "유솔홈케어_운영.xlsx")), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const sheetByOrderNo = new Map();
  for (const r of rows) { const o = cleanStr(r["주문번호"]); if (!o) continue; if (!sheetByOrderNo.has(o)) sheetByOrderNo.set(o, []); sheetByOrderNo.get(o).push(r); }

  for (const c of cases) {
    const { data: task } = await sb.from("tasks").select("id, external_order_no").eq("tenant_id", TENANT_ID).eq("task_no", c.task_no).maybeSingle();
    if (!task) continue;
    const { data: orderTasks } = await sb.from("tasks").select("id, task_no").eq("tenant_id", TENANT_ID).eq("external_order_no", task.external_order_no);
    const ids = (orderTasks || []).map(t => t.id);
    const allPays = [];
    for (const tid of ids) {
      const { data: pays } = await sb.from("payments").select("principal_amount, engineer_amount, owner_amount, calc_method").eq("task_id", tid);
      if (pays) allPays.push(...pays);
    }
    const dbP = allPays.reduce((s, p) => s + (p.principal_amount || 0), 0);
    const dbE = allPays.reduce((s, p) => s + (p.engineer_amount || 0), 0);
    const dbO = allPays.reduce((s, p) => s + (p.owner_amount || 0), 0);
    const sheetRows = sheetByOrderNo.get(task.external_order_no) || [];
    const sP = sheetRows.reduce((s, r) => s + toInt(r["도급사정산액"]), 0);
    const sE = sheetRows.reduce((s, r) => s + toInt(r["회사배분액"]), 0);
    console.log(`  ${c.task_no}: DB(P=${dbP} E+O=${dbE+dbO}) vs 시트(P=${sP} E=${sE}) → P측=${dbP-sP} | E+O측=${(dbE+dbO)-sE} | calc=${[...new Set(allPays.map(p => p.calc_method))].join("/")}`);
  }

  // ============================================================================
  // ④ 진단 — DB measurement task / 중복 의심 / 측 task_item
  // ============================================================================
  console.log(`\n${"=".repeat(85)}\n④ 진단 측 측 데이터\n${"=".repeat(85)}\n`);

  // 측 측 측
  const { data: usolTasks } = await sb.from("tasks").select("id, task_no, external_order_no, customer_name, status").eq("tenant_id", TENANT_ID).eq("principal_id", PRINCIPAL_ID);
  const taskById = new Map(usolTasks.map(t => [t.id, t]));
  const tasksByOrderNo = new Map();
  for (const t of usolTasks) { if (t.external_order_no) { if (!tasksByOrderNo.has(t.external_order_no)) tasksByOrderNo.set(t.external_order_no, []); tasksByOrderNo.get(t.external_order_no).push(t); } }
  const taskIds = usolTasks.map(t => t.id);
  const allItems = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    const { data } = await sb.from("task_items").select("id, task_id, order_type, work_type_id, appliance_type_id, unit_price, product_order_id").in("task_id", taskIds.slice(i, i + 200));
    if (data) allItems.push(...data);
  }
  const itemsByTaskId = new Map();
  for (const it of allItems) { if (!itemsByTaskId.has(it.task_id)) itemsByTaskId.set(it.task_id, []); itemsByTaskId.get(it.task_id).push(it); }

  const sheetTaskNos = new Set();
  const sheetOrderNos = new Set();
  for (const r of rows) {
    const tn = cleanStr(r["작업코드"]);
    const on = cleanStr(r["주문번호"]);
    if (tn) sheetTaskNos.add(tn);
    if (on) sheetOrderNos.add(on);
  }

  // ④-1. DB measurement task (시트 측 task_no + 주문번호 측 X)
  console.log(`\n[④-1] DB measurement task (시트 측 task_no + 주문번호 측 X)\n`);
  const dbOnlyTasks = usolTasks.filter(t => !sheetTaskNos.has(t.task_no) && (!t.external_order_no || !sheetOrderNos.has(t.external_order_no)));
  console.log(`  측 측: ${dbOnlyTasks.length}건\n`);
  for (const t of dbOnlyTasks) {
    const items = itemsByTaskId.get(t.id) || [];
    console.log(`  · ${t.task_no} | ${t.customer_name} | status=${t.status} | ext=${t.external_order_no || "(X)"} | items=${items.length}`);
  }

  // ④-2. 중복 의심 task (off-by-one)
  console.log(`\n[④-2] 중복 의심 task (off-by-one: 같은 주문번호 측 task_no 측 1~2 측 measurement DB task)\n`);
  const suspectTasks = [];
  for (const [orderNo, tasks] of tasksByOrderNo) {
    if (tasks.length < 2) continue;
    // 시트 측 측 task_no measurement 측
    const sheetRowsForOrder = rows.filter(r => cleanStr(r["주문번호"]) === orderNo);
    const sheetTnos = sheetRowsForOrder.map(r => cleanStr(r["작업코드"]));
    // DB task 측 측 시트 측 task_no measurement 측 — 측 의심 task
    for (const t of tasks) {
      if (!sheetTnos.includes(t.task_no)) suspectTasks.push({ task: t, sheetTnos });
    }
  }
  console.log(`  측 측: ${suspectTasks.length}건\n`);
  console.log(`  task_no\t\t고객\t\tstatus\t주문번호\t\titems\t같은 주문 시트 task_no`);
  console.log("-".repeat(140));
  for (const s of suspectTasks) {
    const items = itemsByTaskId.get(s.task.id) || [];
    console.log(`  ${s.task.task_no}\t${s.task.customer_name}\t${s.task.status}\t${s.task.external_order_no}\t${items.length}\t${s.sheetTnos.join(", ")}`);
  }

  // 측 5건 측 측
  console.log(`\n  측 측 측 5건:\n`);
  for (const s of suspectTasks.slice(0, 5)) {
    const items = itemsByTaskId.get(s.task.id) || [];
    console.log(`  ▣ DB ${s.task.task_no} (${s.task.customer_name})`);
    for (const it of items) {
      const wt = wtById.get(it.work_type_id);
      console.log(`    · order_type=${it.order_type} | work_type=${wt?.name} | unit_price=${it.unit_price} | product_order=${it.product_order_id}`);
    }
    const sheetRowsForOrder = rows.filter(r => cleanStr(r["주문번호"]) === s.task.external_order_no);
    console.log(`    [같은 주문 시트]`);
    for (const r of sheetRowsForOrder) {
      console.log(`      · 작업코드=${cleanStr(r["작업코드"])} | 서비스종류=${cleanStr(r["서비스종류"])} | 서비스구분=${cleanStr(r["서비스구분"])} | 정산예정=${r["정산예정금액"]}`);
    }
  }

  // ④-3. DB task_item 측 시트 측 측 catch (의심 task 측 X — 측 task)
  console.log(`\n[④-3] DB task_item 측 시트 측 측 catch (의심 task 측 X)\n`);
  const suspectIds = new Set(suspectTasks.map(s => s.task.id));
  const extraSamples = [];
  for (const [orderNo, tasks] of tasksByOrderNo) {
    const sheetRows = sheetByOrderNo.get(orderNo) || [];
    // 의심 task 측 측 측 측
    const normalTasks = tasks.filter(t => !suspectIds.has(t.id));
    const normalItems = normalTasks.flatMap(t => (itemsByTaskId.get(t.id) || []).map(it => ({ ...it, _task_no: t.task_no })));
    if (normalItems.length <= sheetRows.length) continue;
    // 매칭 측 — 측 측 측 task_item 측 측
    const used = new Set();
    for (const it of normalItems) {
      const kw = getKw(it);
      if (!kw) continue;
      let found = -1;
      for (let i = 0; i < sheetRows.length; i++) { if (used.has(i)) continue; if (String(sheetRows[i]["서비스구분"] || "").includes(kw)) { found = i; break; } }
      if (found < 0) {
        extraSamples.push({ task_no: it._task_no, item: it, orderNo });
      } else used.add(found);
    }
  }
  console.log(`  측 측: ${extraSamples.length}건\n`);
  console.log(`  task_no\t고객\torder_type\twork_type\tunit_price\tproduct_order_id`);
  console.log("-".repeat(120));
  for (const s of extraSamples) {
    const wt = wtById.get(s.item.work_type_id);
    const t = taskById.get(s.item.task_id);
    console.log(`  ${s.task_no}\t${t?.customer_name}\t${s.item.order_type}\t${wt?.name}\t${s.item.unit_price}\t${s.item.product_order_id}`);
  }
})();

// 긴급 측 — payments DELETE 측 cascade 측 measurement task_items 측 다시 INSERT
const fs = require("fs"), path = require("path");
const Papa = require("papaparse");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
function toInt(v) { const n = parseFloat(String(v || "").replace(/[,\s]/g, "")); return isNaN(n) ? 0 : Math.round(n); }
function cleanStr(v) { return v == null ? "" : String(v).trim(); }

const APPLIANCE_KR_TO_CODE = { "벽걸이": "wall", "1way": "1way", "2way": "2way", "스탠드": "stand", "4way": "4way", "원형": "round", "투인원": "2in1", "시스템멀티": "multi" };
const ADDON_KR_TO_WT_CODE = { "냉매": "refri_no_appliance", "송풍팬": "fan_disassembly", "층고": "fan_disassembly", "실외기": "outdoor_unit", "피톤치드": "phytoncide" };
function extractAppliance(text) {
  const t = String(text || "").toLowerCase();
  if (t.includes("1way")) return "1way";
  if (t.includes("2way")) return "2way";
  if (t.includes("4way")) return "4way";
  if (t.includes("스탠드")) return "스탠드";
  if (t.includes("벽걸이")) return "벽걸이";
  if (t.includes("투인원")) return "투인원";
  if (t.includes("원형")) return "원형";
  if (t.includes("천장형")) return "4way";
  return null;
}
function deriveOrderType(s) {
  const v = String(s || "").trim();
  if (v.includes("에어컨청소")) return "본작업";
  if (v.includes("벽걸이") || v.includes("스탠드") || v.includes("1way") || v.includes("2way") || v.includes("4way") || v.includes("투인원") || v.includes("원형") || v.includes("시스템멀티")) return "본작업";
  if (v.includes("추가선택") || v.includes("냉매점검")) return "추가선택";
  if (v.includes("송풍팬") || v.includes("층고") || v.includes("피톤치드") || v.includes("실외기")) return "추가선택";
  return null;
}

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

  // lookup
  const [wtRes, atRes, stRes] = await Promise.all([
    sb.from("work_types").select("id, code, service_type_id, appliance_type_id"),
    sb.from("appliance_types").select("id, code"),
    sb.from("service_types").select("id, code"),
  ]);
  const wts = wtRes.data; const aByCode = new Map(atRes.data.map(a => [a.code, a.id]));
  const cleaningId = stRes.data.find(s => s.code === "cleaning")?.id;

  // DB 측 task 측
  const allTaskNos = Array.from(sheetByTaskNo.keys());
  // 강승희 task_no 측 시트 측 X (시트 측 YS-260522-001 측 측 측, 측 — 측 — 측 task 측 INSERT measurement 측 측)
  const taskNosToCheck = allTaskNos.filter(t => t !== "YS-260522-001");

  const { data: dbTasks } = await sb.from("tasks").select("id, task_no, task_items(id)").in("task_no", taskNosToCheck);
  console.log(`측 측 task: ${dbTasks?.length || 0}건\n`);

  let reInserted = 0;
  for (const t of (dbTasks || [])) {
    if ((t.task_items || []).length > 0) continue;   // 이미 task_items measurement
    const grp = sheetByTaskNo.get(t.task_no);
    if (!grp) continue;

    const itemRows = [];
    for (const r of grp) {
      const sd = cleanStr(r["서비스구분"]);
      const orderType = deriveOrderType(cleanStr(r["서비스종류"])) || deriveOrderType(sd);
      if (!orderType) continue;
      let workTypeId = null, applianceTypeId = null;
      if (orderType === "본작업") {
        const appCode = APPLIANCE_KR_TO_CODE[extractAppliance(sd)] || null;
        if (!appCode) continue;
        applianceTypeId = aByCode.get(appCode);
        workTypeId = wts.find(w => w.service_type_id === cleaningId && w.appliance_type_id === applianceTypeId)?.id || null;
      } else {
        for (const [kr, code] of Object.entries(ADDON_KR_TO_WT_CODE)) {
          if (sd.includes(kr)) { workTypeId = wts.find(w => w.code === code)?.id || null; break; }
        }
      }
      if (!workTypeId) continue;
      itemRows.push({
        task_id: t.id, work_type_id: workTypeId, appliance_type_id: applianceTypeId,
        qty: toInt(r["수량"]) || 1,
        unit_price: toInt(r["정산예정금액"]),
        order_type: orderType,
        product_order_id: cleanStr(r["상품주문번호"]),
        metadata: { item_code: cleanStr(r["작업코드"]), external_item_no: cleanStr(r["상품주문번호"]) },
      });
    }
    if (itemRows.length === 0) continue;
    const { error: iErr } = await sb.from("task_items").insert(itemRows);
    if (iErr) { console.log(`  ❌ ${t.task_no}: ${iErr.message}`); continue; }
    console.log(`  ✅ ${t.task_no}: ${itemRows.length}건 INSERT`);
    reInserted += itemRows.length;
  }
  console.log(`\n✅ task_items 다시 INSERT: ${reInserted}건\n`);

  // 측 status='완료' task 측 compute_payment 측 호출 (DELETE 측 측 X — 이미 DELETE 측)
  const { data: completedTasks } = await sb.from("tasks").select("id, task_no, status").in("task_no", taskNosToCheck);
  const compTasks = (completedTasks || []).filter(t => t.status === "완료");
  console.log(`status='완료' task: ${compTasks.length}건`);

  for (const t of compTasks) {
    const { data: pid, error } = await sb.rpc("compute_payment", { p_task_id: t.id });
    if (error) console.log(`  ❌ ${t.task_no}: ${error.message}`);
    else       console.log(`  ✅ ${t.task_no}: payment_id=${pid}`);
  }

  // 측 5건 비교
  console.log(`\n${"=".repeat(85)}\n시트 vs trigger 측 비교 (측 5건)\n${"=".repeat(85)}\n`);
  const taskIds = compTasks.map(t => t.id);
  const { data: pays } = await sb.from("payments").select("task_id, principal_amount, engineer_amount, owner_amount, calc_method").in("task_id", taskIds);
  const payByTask = new Map((pays || []).map(p => [p.task_id, p]));

  for (const t of compTasks.slice(0, 5)) {
    const pay = payByTask.get(t.id);
    const grp = sheetByTaskNo.get(t.task_no);
    const sP = grp.reduce((s, r) => s + toInt(r["도급사정산액"]), 0);
    const sE = grp.reduce((s, r) => s + toInt(r["회사배분액"]), 0);
    const sT = grp.reduce((s, r) => s + toInt(r["정산예정금액"]), 0);
    if (!pay) { console.log(`  ${t.task_no}: payments X\n`); continue; }
    console.log(`▣ ${t.task_no} | calc_method=${pay.calc_method}`);
    console.log(`   도급사:   trigger=${pay.principal_amount}\t시트=${sP}\t측=${pay.principal_amount - sP}`);
    console.log(`   회사배분: trigger=${pay.engineer_amount}\t시트=${sE}\t측=${pay.engineer_amount - sE}`);
    console.log(`   owner:    ${pay.owner_amount}\t(시트 정산예정금액=${sT})\n`);
  }
})();

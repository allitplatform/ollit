// =============================================================================
// 측 measurement 정산 베이스 정정 + 강승희 INSERT — 2026-05-23
// =============================================================================
// 사장님 spec:
//   S2: 측 42건 task_items.unit_price + tasks.product_price SWAP 정정
//       · unit_price ← 정산예정금액 (Migration 045/046 spec)
//       · product_price ← 최종상품금액
//   S3: payments 8건 측 측 — task_items UPDATE 측 trigger 자동 측 측 측
//       · 측 측 X 측 payments DELETE → compute_payment 측 호출
//   강승희: 새 task_no 측 1 task + 3 task_items INSERT
//       · 주문번호 2026052271268341 / 김병철 / 5/31 / status=배정 / scheduled_at=NULL

const fs = require("fs"), path = require("path");
const Papa = require("papaparse");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
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

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const CATEGORY_ID = "33333333-3333-3333-3333-333333333001";
const PRINCIPAL_ID = "22222222-2222-2222-2222-222222222006";

function toInt(v) { if (v == null || v === "") return 0; const n = parseFloat(String(v).replace(/[,\s]/g, "")); return isNaN(n) ? 0 : Math.round(n); }
function cleanStr(v) { return v == null ? "" : String(v).trim(); }

// 강승희 측 매핑 helper (naverOrderParser 측 측)
const APPLIANCE_KR_TO_CODE = {
  "벽걸이": "wall", "1way": "1way", "2way": "2way", "스탠드": "stand",
  "4way": "4way", "원형": "round", "투인원": "2in1", "시스템멀티": "multi",
};
const ADDON_KR_TO_WT_CODE = {
  "냉매": "refri_no_appliance", "송풍팬": "fan_disassembly", "층고": "fan_disassembly",
  "실외기": "outdoor_unit", "피톤치드": "phytoncide",
};
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
  console.log(`${"=".repeat(85)}\n측 measurement 정산 정정 + 강승희 INSERT\n${"=".repeat(85)}\n`);

  // CSV 측
  const csvRaw = fs.readFileSync(path.join(__dirname, "..", "신규_43주문_INSERT용.csv"), "utf8");
  const csvText = csvRaw.charCodeAt(0) === 0xFEFF ? csvRaw.slice(1) : csvRaw;
  const rows = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() }).data;
  const groups = new Map();
  for (const r of rows) {
    const orderNo = cleanStr(r["주문번호"]);
    if (!orderNo) continue;
    if (!groups.has(orderNo)) groups.set(orderNo, []);
    groups.get(orderNo).push(r);
  }

  // 측 task_no 측 시트 row 측
  const sheetByTaskNo = new Map();   // task_no → grp (rows)
  for (const [, grp] of groups) {
    sheetByTaskNo.set(cleanStr(grp[0]["작업코드"]), grp);
  }
  const allTaskNos = Array.from(sheetByTaskNo.keys());

  // DB 측 측 task catch
  const { data: dbTasks } = await sb.from("tasks").select("id, task_no, customer_name, status, product_price, task_items(id, product_order_id, unit_price)").in("task_no", allTaskNos);
  console.log(`DB 측 측 task: ${dbTasks?.length || 0}건\n`);

  // ============================================================================
  // [S2] 42건 unit_price + product_price 정정
  // ============================================================================
  console.log(`${"=".repeat(85)}\n[S2] 측 42건 unit_price + product_price 정정\n${"=".repeat(85)}\n`);

  let updatedTaskCount = 0;
  let updatedItemCount = 0;
  const fixedTaskIds = [];   // S3 측

  for (const t of (dbTasks || [])) {
    const grp = sheetByTaskNo.get(t.task_no);
    if (!grp) continue;
    // 강승희 task_no 측 SKIP (DB 측 측 측 task 측 측 측 측 X)
    if (t.task_no === "YS-260522-001") continue;

    // tasks.product_price ← 최종상품금액 합계
    const newProductPrice = grp.reduce((s, r) => s + toInt(r["최종상품금액"]), 0);
    const { error: tErr } = await sb.from("tasks").update({ product_price: newProductPrice }).eq("id", t.id);
    if (tErr) { console.error(`❌ task ${t.task_no}: ${tErr.message}`); continue; }
    updatedTaskCount++;
    fixedTaskIds.push(t.id);

    // task_items.unit_price ← 정산예정금액 (product_order_id 매칭)
    for (const item of (t.task_items || [])) {
      const sheetRow = grp.find(r => cleanStr(r["상품주문번호"]) === item.product_order_id);
      if (!sheetRow) continue;
      const newUnitPrice = toInt(sheetRow["정산예정금액"]);
      const { error: iErr } = await sb.from("task_items").update({ unit_price: newUnitPrice }).eq("id", item.id);
      if (iErr) { console.error(`❌ item ${item.id}: ${iErr.message}`); continue; }
      updatedItemCount++;
    }
  }
  console.log(`  ✅ tasks UPDATE: ${updatedTaskCount}건`);
  console.log(`  ✅ task_items UPDATE: ${updatedItemCount}건\n`);

  // 측 5건 측 측 값 측
  const sampleNos = ["YS-260515-010", "YS-260515-070", "YS-260516-022", "YS-260516-116", "YS-260516-162"];
  const { data: sampleTasks } = await sb.from("tasks").select("task_no, customer_name, product_price, task_items(product_order_id, unit_price, order_type)").in("task_no", sampleNos);
  console.log(`  측 5건 정정 측 값:`);
  for (const t of (sampleTasks || [])) {
    console.log(`    ${t.task_no} | ${t.customer_name} | product_price=${t.product_price}`);
    for (const it of (t.task_items || [])) {
      console.log(`        - ${it.order_type} | unit_price=${it.unit_price} | product_order_id=${it.product_order_id}`);
    }
  }

  // ============================================================================
  // [S3] payments 8건 측 측 — task_items UPDATE 측 trigger 측 측 측 측 측
  // ============================================================================
  console.log(`\n${"=".repeat(85)}\n[S3] payments 8건 측 측\n${"=".repeat(85)}\n`);

  // task_items UPDATE 측 task_items_compute_trg (Migration 028) 측 측 자동 측 measurement
  // 측 — payment_id 측 측 측 → 측 측 측 측
  // 측 측 측 X 측 → DELETE 후 compute_payment 측 호출
  await new Promise(r => setTimeout(r, 1500));   // trigger 측 측 측 측 측 측

  const completedSamples = (sampleTasks || []).filter(t => true);   // 5건 측 측
  console.log(`  task_items UPDATE 측 측 측 payments 측 측:`);
  for (const t of (sampleTasks || [])) {
    const tFull = (dbTasks || []).find(x => x.task_no === t.task_no);
    if (!tFull) continue;
    const { data: pay } = await sb.from("payments").select("id, principal_amount, engineer_amount, owner_amount, calc_method").eq("task_id", tFull.id).maybeSingle();
    const grp = sheetByTaskNo.get(t.task_no);
    const sheetPrincipal = grp.reduce((s, r) => s + toInt(r["도급사정산액"]), 0);
    const sheetEngineer  = grp.reduce((s, r) => s + toInt(r["회사배분액"]), 0);
    if (!pay) { console.log(`    ${t.task_no}: payments X`); continue; }
    console.log(`    ${t.task_no}: principal=${pay.principal_amount} (시트 ${sheetPrincipal}, 측 ${pay.principal_amount - sheetPrincipal}) | engineer=${pay.engineer_amount} (시트 ${sheetEngineer}, 측 ${pay.engineer_amount - sheetEngineer})`);
  }

  // ============================================================================
  // [강승희] 새 task_no 측 1 task + 3 task_items INSERT
  // ============================================================================
  console.log(`\n${"=".repeat(85)}\n[강승희] 새 task_no 측 INSERT\n${"=".repeat(85)}\n`);

  // 강승희 시트 측 catch — 주문번호 2026052271268341
  const kssGrp = groups.get("2026052271268341");
  if (!kssGrp) { console.error(`❌ 강승희 시트 측 측 측`); process.exit(1); }
  console.log(`  강승희 시트 측: ${kssGrp.length}건`);

  // 새 task_no — generateTaskNosBulk 측 측 직접 계산
  const { data: prefData } = await sb.from("principals").select("prefix").eq("code", "usol_n").maybeSingle();
  const prefix = prefData?.prefix || "YS-N-";
  const now = new Date(); const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const yymmdd = `${String(kst.getUTCFullYear()).slice(2)}${String(kst.getUTCMonth() + 1).padStart(2, "0")}${String(kst.getUTCDate()).padStart(2, "0")}`;
  const { count: existCount } = await sb.from("tasks").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT_ID).like("task_no", `${prefix}${yymmdd}-%`);
  const newTaskNo = `${prefix}${yymmdd}-${String((existCount || 0) + 1).padStart(3, "0")}`;
  console.log(`  새 task_no: ${newTaskNo}`);

  // 김병철 user_id catch
  const { data: kbcUser } = await sb.from("users").select("id, name").eq("tenant_id", TENANT_ID).eq("name", "김병철").maybeSingle();
  console.log(`  김병철 user_id: ${kbcUser?.id}`);

  const first = kssGrp[0];
  // 강승희 task INSERT — Migration 045/046 spec
  const taskRow = {
    tenant_id: TENANT_ID, category_id: CATEGORY_ID, principal_id: PRINCIPAL_ID,
    task_no: newTaskNo,
    customer_name: cleanStr(first["수취인명"]) || cleanStr(first["구매자명"]) || "—",
    phone: cleanStr(first["수취인연락처1"]) || cleanStr(first["구매자연락처"]) || "",
    address: cleanStr(first["주소"]),
    district: cleanStr(first["지역키워드"]),
    channel: "네이버",
    request_note: cleanStr(first["배송메세지"]) || `네이버 주문 ${first["주문번호"]}`,
    status: "배정",            // X열 00:00
    assigned_engineer_id: kbcUser?.id || null,
    scheduled_at: null,         // X열 00:00 → NULL
    completed_at: null,
    product_price: kssGrp.reduce((s, r) => s + toInt(r["최종상품금액"]), 0),   // 최종상품금액 합
    extra_fee: 0, travel_fee: 0,
    external_order_no: cleanStr(first["주문번호"]),
    external_received_at: null,
    category_data: {},
  };
  const { data: tIns, error: tErr } = await sb.from("tasks").insert(taskRow).select("id, task_no").single();
  if (tErr || !tIns) { console.error(`❌ 강승희 task INSERT:`, tErr); process.exit(1); }
  console.log(`  ✅ task INSERT: ${tIns.task_no} (id=${tIns.id})`);

  // task_items 측 (3건)
  const [wtRes, atRes, stRes] = await Promise.all([
    sb.from("work_types").select("id, code, service_type_id, appliance_type_id"),
    sb.from("appliance_types").select("id, code"),
    sb.from("service_types").select("id, code"),
  ]);
  const wts = wtRes.data; const aByCode = new Map(atRes.data.map(a => [a.code, a.id]));
  const cleaningId = stRes.data.find(s => s.code === "cleaning")?.id;

  const itemRows = [];
  for (const r of kssGrp) {
    const sd = cleanStr(r["서비스구분"]);
    const orderType = deriveOrderType(cleanStr(r["서비스종류"])) || deriveOrderType(sd);
    let workTypeId = null, applianceTypeId = null;
    if (orderType === "본작업") {
      const appCode = APPLIANCE_KR_TO_CODE[extractAppliance(sd)] || null;
      if (!appCode) { console.warn(`  ⚠️ 본작업 매핑 실패: ${sd}`); continue; }
      applianceTypeId = aByCode.get(appCode);
      workTypeId = wts.find(w => w.service_type_id === cleaningId && w.appliance_type_id === applianceTypeId)?.id || null;
    } else if (orderType === "추가선택") {
      for (const [kr, code] of Object.entries(ADDON_KR_TO_WT_CODE)) {
        if (sd.includes(kr)) { workTypeId = wts.find(w => w.code === code)?.id || null; break; }
      }
    }
    if (!workTypeId) { console.warn(`  ⚠️ work_type 매핑 실패: ${sd}`); continue; }
    itemRows.push({
      task_id: tIns.id, work_type_id: workTypeId, appliance_type_id: applianceTypeId,
      qty: toInt(r["수량"]) || 1,
      unit_price: toInt(r["정산예정금액"]),   // ✅ Migration 045/046 spec
      order_type: orderType,
      product_order_id: cleanStr(r["상품주문번호"]),
      metadata: { item_code: cleanStr(r["작업코드"]), external_item_no: cleanStr(r["상품주문번호"]) },
    });
  }
  const { error: iErr } = await sb.from("task_items").insert(itemRows);
  if (iErr) { console.error(`❌ 강승희 task_items INSERT:`, iErr); process.exit(1); }
  console.log(`  ✅ task_items INSERT: ${itemRows.length}건`);
  for (let i = 0; i < itemRows.length; i++) {
    console.log(`      [${i}] order_type=${itemRows[i].order_type} | qty=${itemRows[i].qty} | unit_price=${itemRows[i].unit_price}`);
  }

  console.log(`\n${"=".repeat(85)}\n측 정정 측\n${"=".repeat(85)}\n`);
})();

// ③ 주문 단위 검증 — order_type 정확성 + 정산 정확성 + 혼합 주문
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
function sheetToOrderType(s) {
  const v = String(s || "").trim();
  if (v.includes("에어컨청소")) return "본작업";
  if (v.includes("추가선택"))   return "추가선택";
  return null;
}

(async () => {
  // ============================================================================
  // 측 측 측
  // ============================================================================
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
    const { data } = await sb.from("task_items").select("id, task_id, order_type, work_type_id, appliance_type_id, unit_price").in("task_id", chunk);
    if (data) allItems.push(...data);
  }
  const itemsByTaskId = new Map();
  for (const it of allItems) {
    if (!itemsByTaskId.has(it.task_id)) itemsByTaskId.set(it.task_id, []);
    itemsByTaskId.get(it.task_id).push(it);
  }

  const wtRes = await sb.from("work_types").select("id, code, name, appliance_type_id");
  const atRes = await sb.from("appliance_types").select("id, code, name");
  const wtById = new Map(wtRes.data.map(w => [w.id, w]));
  const atById = new Map(atRes.data.map(a => [a.id, a]));

  // 시트
  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, "..", "유솔홈케어_운영.xlsx")), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const sheetByOrderNo = new Map();
  for (const r of rows) {
    const o = cleanStr(r["주문번호"]);
    if (!o) continue;
    if (!sheetByOrderNo.has(o)) sheetByOrderNo.set(o, []);
    sheetByOrderNo.get(o).push(r);
  }

  // payments
  const { data: pays } = await sb.from("payments").select("task_id, principal_amount, engineer_amount, owner_amount, calc_method");
  const payByTaskId = new Map((pays || []).map(p => [p.task_id, p]));

  function getKeywordForItem(item) {
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
  // [검증 1] order_type 정확성 — 주문 단위 측 매칭
  // ============================================================================
  console.log(`${"=".repeat(120)}\n[검증 1] order_type 정확성 — 주문번호 측 측 매칭\n${"=".repeat(120)}\n`);
  let matched = 0, mismatched = 0;
  const mismatches = [];
  for (const [orderNo, tasks] of tasksByOrderNo) {
    const sheetRows = sheetByOrderNo.get(orderNo);
    if (!sheetRows) continue;
    // 측 주문 측 measurement task 측 task_items 측 측 측 측
    const orderItems = tasks.flatMap(t => (itemsByTaskId.get(t.id) || []).map(it => ({ ...it, _task_no: t.task_no })));
    // 측 측 측 측 시트 측 측 측 측 catch
    const usedSheetIdx = new Set();
    for (const item of orderItems) {
      if (item.order_type == null) continue;
      const keyword = getKeywordForItem(item);
      if (!keyword) continue;
      // 측 측 측 측 catch
      let sheetIdx = -1;
      for (let i = 0; i < sheetRows.length; i++) {
        if (usedSheetIdx.has(i)) continue;
        if (String(sheetRows[i]["서비스구분"] || "").includes(keyword)) { sheetIdx = i; break; }
      }
      if (sheetIdx < 0) continue;
      usedSheetIdx.add(sheetIdx);

      const sheetOT = sheetToOrderType(sheetRows[sheetIdx]["서비스종류"]);
      if (!sheetOT) continue;
      if (sheetOT === item.order_type) matched++;
      else {
        mismatched++;
        if (mismatches.length < 30) {
          mismatches.push({
            order: orderNo,
            db_task_no: item._task_no,
            서비스구분: sheetRows[sheetIdx]["서비스구분"],
            서비스종류: sheetRows[sheetIdx]["서비스종류"],
            DB: item.order_type,
            시트: sheetOT,
          });
        }
      }
    }
  }
  console.log(`  · 일치: ${matched}건`);
  console.log(`  · 불일치: ${mismatched}건`);
  if (mismatches.length > 0) {
    console.log(`\n  순수 불일치 측 (측 30건):`);
    for (const m of mismatches) {
      console.log(`    · order=${m.order} | task_no=${m.db_task_no} | 서비스구분=${m.서비스구분} | 서비스종류=${m.서비스종류} | DB=${m.DB} | 시트=${m.시트}`);
    }
  }

  // ============================================================================
  // [검증 2] 정산 정확성 — 주문 단위 합산 비교
  // ============================================================================
  console.log(`\n${"=".repeat(120)}\n[검증 2] 정산 정확성 — 주문 단위 합산\n${"=".repeat(120)}\n`);
  console.log(`order_no\t\tDB principal\tDB eng\tDB own\tDB 측\t시트 도급사\t시트 회사배분\t시트 측\t측 측`);
  console.log("-".repeat(150));

  // 23건 측 측 측 주문 — mismatches 측 측 측 measurement, 측 측 task 측 측 측 측
  // 측 측 — 측 measurement 측 측 → 측 측 측 측 측 측 측 측 catch
  // 측 — measurement 측 측 측 — 위 mismatches 측 측 주문번호 측 catch
  const allCheckOrders = new Set();
  // 23건 측 측 task_no 측 hardcoded (측 측 측)
  const TASK_NOS_FROM_MISMATCH = [
    "YS-260522-016","YS-260520-002","YS-260517-054","YS-260516-094","YS-260515-094",
    "YS-260515-089","YS-260514-029","YS-260425-010","YS-260518-135","YS-260516-121",
    "YS-260516-036","YS-260516-073","YS-260512-035","YS-260512-026","YS-260511-007",
    "YS-260510-018","YS-260509-002","YS-260502-008","YS-260429-016","YS-260424-080",
  ];
  for (const tn of TASK_NOS_FROM_MISMATCH) {
    const t = usolTasks.find(t => t.task_no === tn);
    if (t?.external_order_no) allCheckOrders.add(t.external_order_no);
  }

  let payMatched = 0, payMismatched = 0;
  const payMismatchList = [];
  for (const orderNo of allCheckOrders) {
    const tasks = tasksByOrderNo.get(orderNo) || [];
    let dbP = 0, dbE = 0, dbO = 0;
    let allComplete = true;
    for (const t of tasks) {
      const pay = payByTaskId.get(t.id);
      if (pay) {
        dbP += pay.principal_amount || 0;
        dbE += pay.engineer_amount || 0;
        dbO += pay.owner_amount || 0;
      }
      if (t.status !== "완료") allComplete = false;
    }
    const sheetRows = sheetByOrderNo.get(orderNo) || [];
    const sP = sheetRows.reduce((s, r) => s + toInt(r["도급사정산액"]), 0);
    const sE = sheetRows.reduce((s, r) => s + toInt(r["회사배분액"]), 0);
    const dbTotal = dbP + dbE + dbO;
    const sheetTotal = sP + sE;
    const isMatch = dbP === sP && (dbE + dbO) === sE;
    if (isMatch) payMatched++;
    else { payMismatched++; payMismatchList.push({ orderNo, dbP, dbE, dbO, sP, sE, dbTotal, sheetTotal, allComplete }); }
    console.log(`${orderNo}\t${dbP}\t\t${dbE}\t${dbO}\t${dbTotal}\t${sP}\t\t${sE}\t\t${sheetTotal}\t${isMatch ? "✅" : "❌"}`);
  }
  console.log(`\n  · 측 측: ${payMatched}건 / 불일치: ${payMismatched}건`);

  // ============================================================================
  // [검증 3] 혼합 주문 — 본작업+추가선택 같이 measurement task 측 calc_method
  // ============================================================================
  console.log(`\n${"=".repeat(120)}\n[검증 3] 혼합 주문 — 본작업+추가선택 혼합 task\n${"=".repeat(120)}\n`);
  let mixedCount = 0;
  let mixedMatchPay = 0, mixedMismatchPay = 0;
  const mixedSamples = [];
  for (const [taskId, items] of itemsByTaskId) {
    const orderTypes = new Set(items.map(it => it.order_type).filter(Boolean));
    if (orderTypes.size < 2) continue;   // 혼합 X
    mixedCount++;
    const task = taskById.get(taskId);
    if (!task?.external_order_no) continue;
    const pay = payByTaskId.get(taskId);
    if (!pay) continue;
    const sheetRows = sheetByOrderNo.get(task.external_order_no) || [];
    // 측 task 측 task_items 측 측 측 측 → 측 task 측 시트 측 측 catch X (주문번호 측 측 task 측 sheet 합)
    const tasks = tasksByOrderNo.get(task.external_order_no);
    if (tasks.length > 1) continue;   // 측 task 측 측 측 측 measurement — sheet 합 측 비교 X
    const sP = sheetRows.reduce((s, r) => s + toInt(r["도급사정산액"]), 0);
    const sE = sheetRows.reduce((s, r) => s + toInt(r["회사배분액"]), 0);
    const dbEngOwn = pay.engineer_amount + pay.owner_amount;
    const isMatch = pay.principal_amount === sP && dbEngOwn === sE;
    if (isMatch) mixedMatchPay++;
    else mixedMismatchPay++;
    if (mixedSamples.length < 10) {
      mixedSamples.push({
        task_no: task.task_no, calc_method: pay.calc_method,
        order_types: Array.from(orderTypes).join("+"),
        DB_P: pay.principal_amount, DB_E: pay.engineer_amount, DB_O: pay.owner_amount,
        시트_P: sP, 시트_E: sE,
        측: isMatch ? "✅" : "❌",
      });
    }
  }
  console.log(`  혼합 task 측 측: ${mixedCount}건`);
  console.log(`  측 측 task 측 (시트 측 비교 측 측):`);
  console.log(`    · 일치: ${mixedMatchPay}건 / 불일치: ${mixedMismatchPay}건`);
  if (mixedSamples.length > 0) {
    console.log(`\n  측 측 (측 10건):`);
    for (const m of mixedSamples) {
      console.log(`    · ${m.task_no} | calc=${m.calc_method} | 측=${m.order_types} | DB(P/E/O)=${m.DB_P}/${m.DB_E}/${m.DB_O} | 시트(P/E)=${m.시트_P}/${m.시트_E} | ${m.측}`);
    }
  }
})();

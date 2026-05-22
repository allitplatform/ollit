// ③ 재검증 — 주문번호 측 측 task_items 측 비교 + NULL 백필 드라이런
const fs = require("fs"), path = require("path");
const XLSX = require("xlsx");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PRINCIPAL_ID = "22222222-2222-2222-2222-222222222006";
const isCommit = process.argv.includes("--commit");

const APPLIANCE_KEYWORD = { wall: "벽걸이", "1way": "1way", "2way": "2way", "4way": "4way", stand: "스탠드", round: "원형", "2in1": "투인원", multi: "시스템멀티" };
const ADDON_KEYWORD = { refri_no_appliance: "냉매점검", fan_disassembly: "송풍팬", outdoor_unit: "실외기", phytoncide: "피톤치드" };

function sheetToOrderType(s) {
  const v = String(s || "").trim();
  if (v.includes("에어컨청소")) return "본작업";
  if (v.includes("추가선택"))   return "추가선택";
  return null;
}
function cleanStr(v) { return v == null ? "" : String(v).trim(); }

(async () => {
  // [1] 시트 측 — 주문번호+서비스구분 중복 측
  console.log(`${"=".repeat(85)}\n[1] 시트 — 주문번호+서비스구분 중복 측\n${"=".repeat(85)}\n`);
  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, "..", "유솔홈케어_운영.xlsx")), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });

  const sheetByOrderServiceDiv = new Map();   // key: orderNo|서비스구분 → [rows]
  for (const r of rows) {
    const o = cleanStr(r["주문번호"]);
    const sd = cleanStr(r["서비스구분"]);
    if (!o) continue;
    const key = `${o}|${sd}`;
    if (!sheetByOrderServiceDiv.has(key)) sheetByOrderServiceDiv.set(key, []);
    sheetByOrderServiceDiv.get(key).push(r);
  }
  const dups = Array.from(sheetByOrderServiceDiv.entries()).filter(([, v]) => v.length > 1);
  console.log(`  unique (주문번호+서비스구분): ${sheetByOrderServiceDiv.size}건`);
  console.log(`  중복 (한 주문 측 같은 서비스구분 측 measurement, 예: 벽걸이 2대): ${dups.length}건`);
  if (dups.length > 0) {
    console.log(`\n  중복 측 (측 10건):`);
    for (const [k, v] of dups.slice(0, 10)) {
      const [orderNo, sd] = k.split("|");
      const taskCodes = v.map(r => cleanStr(r["작업코드"])).join(", ");
      console.log(`    · 주문=${orderNo} | 서비스구분=${sd} | ${v.length}개 | 작업코드: ${taskCodes}`);
    }
  }

  // [2] DB lookup
  console.log(`\n${"=".repeat(85)}\n[2] DB task / task_items lookup\n${"=".repeat(85)}\n`);
  const { data: usolTasks } = await sb.from("tasks").select("id, task_no, customer_name, external_order_no").eq("tenant_id", TENANT_ID).eq("principal_id", PRINCIPAL_ID);
  const taskById = new Map(usolTasks.map(t => [t.id, t]));
  const tasksByOrderNo = new Map();
  for (const t of usolTasks) {
    if (!t.external_order_no) continue;
    if (!tasksByOrderNo.has(t.external_order_no)) tasksByOrderNo.set(t.external_order_no, []);
    tasksByOrderNo.get(t.external_order_no).push(t);
  }
  console.log(`  usol_n task: ${usolTasks.length}건`);
  console.log(`  external_order_no 측 측: ${usolTasks.filter(t => t.external_order_no).length}건`);
  console.log(`  external_order_no NULL: ${usolTasks.filter(t => !t.external_order_no).length}건`);

  // task_items chunk lookup
  const taskIds = usolTasks.map(t => t.id);
  const chunkSize = 200;
  const allItems = [];
  for (let i = 0; i < taskIds.length; i += chunkSize) {
    const chunk = taskIds.slice(i, i + chunkSize);
    const { data } = await sb.from("task_items")
      .select("id, task_id, order_type, work_type_id, appliance_type_id")
      .in("task_id", chunk);
    if (data) allItems.push(...data);
  }
  console.log(`  usol_n task_items: ${allItems.length}건`);

  const wtRes = await sb.from("work_types").select("id, code, name, appliance_type_id");
  const atRes = await sb.from("appliance_types").select("id, code, name");
  const wtById = new Map(wtRes.data.map(w => [w.id, w]));
  const atById = new Map(atRes.data.map(a => [a.id, a]));

  // [3] 주문번호 측 측 task_items 측 측 비교
  console.log(`\n${"=".repeat(85)}\n[3] order_type 정확성 — 주문번호+서비스구분 측 측 측 측 비교\n${"=".repeat(85)}\n`);
  let matched = 0, mismatched = 0, noSheet = 0, noKeyword = 0, noExtOrder = 0, nullOrderType = 0;
  const mismatches = [];

  for (const item of allItems) {
    if (item.order_type == null) { nullOrderType++; continue; }
    const task = taskById.get(item.task_id);
    if (!task?.external_order_no) { noExtOrder++; continue; }

    // DB item → keyword
    let keyword = null;
    if (item.work_type_id) {
      const wt = wtById.get(item.work_type_id);
      if (wt) {
        if (wt.appliance_type_id) {
          const at = atById.get(wt.appliance_type_id);
          if (at) keyword = APPLIANCE_KEYWORD[at.code] || null;
        }
        if (!keyword && ADDON_KEYWORD[wt.code]) keyword = ADDON_KEYWORD[wt.code];
      }
    }
    if (!keyword) { noKeyword++; continue; }

    // 주문번호+서비스구분 측 측
    const sheetOrders = sheetByOrderServiceDiv.entries();
    let sheetRow = null;
    for (const [k, v] of sheetOrders) {
      const [orderNo, sd] = k.split("|");
      if (orderNo === task.external_order_no && sd.includes(keyword)) { sheetRow = v[0]; break; }
    }
    if (!sheetRow) { noSheet++; continue; }

    const sheetOrderType = sheetToOrderType(sheetRow["서비스종류"]);
    if (!sheetOrderType) { noKeyword++; continue; }
    if (sheetOrderType === item.order_type) matched++;
    else {
      mismatched++;
      if (mismatches.length < 20) {
        mismatches.push({
          task_no: task.task_no, ext: task.external_order_no,
          서비스구분: sheetRow["서비스구분"], 서비스종류: sheetRow["서비스종류"],
          DB: item.order_type, 시트: sheetOrderType,
        });
      }
    }
  }
  console.log(`  · 일치:        ${matched}건`);
  console.log(`  · 불일치:      ${mismatched}건`);
  console.log(`  · 시트 측 매칭 측 X: ${noSheet}건`);
  console.log(`  · keyword 측 측 X:  ${noKeyword}건`);
  console.log(`  · external_order_no 측 X: ${noExtOrder}건`);
  console.log(`  · order_type NULL (측 [4]):    ${nullOrderType}건`);

  if (mismatches.length > 0) {
    console.log(`\n  불일치 측 (측 20건):`);
    for (const m of mismatches) {
      console.log(`    · ${m.task_no} | ext=${m.ext} | 서비스구분=${m.서비스구분} | 서비스종류=${m.서비스종류} | DB=${m.DB} | 시트=${m.시트}`);
    }
  }

  // [4] NULL 1건 측 백필 드라이런
  console.log(`\n${"=".repeat(85)}\n[4] NULL 1건 측 백필 드라이런\n${"=".repeat(85)}\n`);
  const nullItems = allItems.filter(it => it.order_type == null);
  for (const item of nullItems) {
    const task = taskById.get(item.task_id);
    const wt = wtById.get(item.work_type_id);
    // refri_* → 추가선택 / clean_* → 본작업 / fan/outdoor/phytoncide → 추가선택
    let proposedOrderType = null;
    if (wt) {
      if (wt.code?.startsWith("refri") || wt.code?.startsWith("fan") || wt.code?.startsWith("outdoor") || wt.code === "phytoncide") {
        proposedOrderType = "추가선택";
      } else if (wt.code?.startsWith("clean")) {
        proposedOrderType = "본작업";
      }
    }
    console.log(`  · task_no=${task?.task_no} | work_type=${wt?.name} (${wt?.code}) | 측 백필: ${proposedOrderType || "(측 측 X)"}`);

    if (isCommit && proposedOrderType) {
      const { error } = await sb.from("task_items").update({ order_type: proposedOrderType }).eq("id", item.id);
      if (error) console.log(`     ❌ ${error.message}`);
      else       console.log(`     ✅ UPDATE 측`);
    }
  }
  if (!isCommit) console.log(`\n  🔍 DRY-RUN — UPDATE 측 측 X.`);
})();

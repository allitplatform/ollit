// ③ 추가 진단 — order_type 값 정확성 + NULL 1건 측 측
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

function sheetToOrderType(serviceType) {
  const v = String(serviceType || "").trim();
  if (v.includes("에어컨청소")) return "본작업";
  if (v.includes("추가선택"))   return "추가선택";
  return null;
}

(async () => {
  // DB lookup
  const { data: usolTasks } = await sb.from("tasks").select("id, task_no, customer_name, status").eq("tenant_id", TENANT_ID).eq("principal_id", PRINCIPAL_ID);
  const taskById = new Map(usolTasks.map(t => [t.id, t]));
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

  // work_type / appliance_type lookup
  const wtRes = await sb.from("work_types").select("id, code, name, appliance_type_id");
  const atRes = await sb.from("appliance_types").select("id, code, name");
  const wtById = new Map(wtRes.data.map(w => [w.id, w]));
  const atById = new Map(atRes.data.map(a => [a.id, a]));

  // 시트 측 — task_no + 시트 측 측 측 (task_no 측 측 측 measurement)
  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, "..", "유솔홈케어_운영.xlsx")), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const sheetByTaskNo = new Map();
  for (const r of rows) {
    const tno = String(r["작업코드"] || "").trim();
    if (!tno) continue;
    if (!sheetByTaskNo.has(tno)) sheetByTaskNo.set(tno, []);
    sheetByTaskNo.get(tno).push(r);
  }

  // ============================================================================
  // [A] order_type 정확성 — DB vs 시트 1:1 비교
  // ============================================================================
  console.log(`${"=".repeat(85)}\n[A] order_type 정확성 측\n${"=".repeat(85)}\n`);
  let matched = 0, mismatched = 0, noSheet = 0, noKeyword = 0;
  const mismatches = [];

  for (const item of allItems) {
    if (item.order_type == null) continue;   // NULL 측 [B] 측
    const task = taskById.get(item.task_id);
    if (!task) continue;
    const sheetItems = sheetByTaskNo.get(task.task_no);
    if (!sheetItems) { noSheet++; continue; }

    // DB item → keyword (서비스구분 측 측)
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

    const sheetRow = sheetItems.find(r => String(r["서비스구분"] || "").includes(keyword));
    if (!sheetRow) { noSheet++; continue; }

    const sheetOrderType = sheetToOrderType(sheetRow["서비스종류"]);
    if (!sheetOrderType) {
      noKeyword++;
      continue;
    }
    if (sheetOrderType === item.order_type) {
      matched++;
    } else {
      mismatched++;
      if (mismatches.length < 20) {
        mismatches.push({
          task_no: task.task_no,
          서비스구분: sheetRow["서비스구분"],
          서비스종류: sheetRow["서비스종류"],
          DB_order_type: item.order_type,
          시트_매핑: sheetOrderType,
        });
      }
    }
  }
  console.log(`  · 일치: ${matched}건`);
  console.log(`  · 불일치: ${mismatched}건`);
  console.log(`  · 시트 측 매칭 측 X: ${noSheet}건`);
  console.log(`  · keyword 측 측 X: ${noKeyword}건`);

  if (mismatches.length > 0) {
    console.log(`\n  불일치 측 (측 20건):`);
    for (const m of mismatches) {
      console.log(`    · ${m.task_no} | 서비스구분=${m.서비스구분} | 서비스종류=${m.서비스종류} | DB=${m.DB_order_type} | 시트 매핑=${m.시트_매핑}`);
    }
  }

  // ============================================================================
  // [B] NULL 1건 측 측
  // ============================================================================
  console.log(`\n${"=".repeat(85)}\n[B] order_type NULL 1건 측 측\n${"=".repeat(85)}\n`);
  const nullItem = allItems.find(it => it.order_type == null);
  if (!nullItem) { console.log(`  NULL 측 X`); return; }

  const task = taskById.get(nullItem.task_id);
  let wtName = null, wtCode = null, atName = null, atCode = null;
  if (nullItem.work_type_id) {
    const wt = wtById.get(nullItem.work_type_id);
    if (wt) { wtName = wt.name; wtCode = wt.code; }
  }
  if (nullItem.appliance_type_id) {
    const at = atById.get(nullItem.appliance_type_id);
    if (at) { atName = at.name; atCode = at.code; }
  }

  console.log(`  task_no:        ${task?.task_no}`);
  console.log(`  customer_name:  ${task?.customer_name}`);
  console.log(`  status:         ${task?.status}`);
  console.log(`  work_type:      ${wtName} (${wtCode})`);
  console.log(`  appliance_type: ${atName} (${atCode})`);

  const sheetItems = sheetByTaskNo.get(task?.task_no);
  console.log(`\n  시트 측 task_no="${task?.task_no}" 측: ${sheetItems ? sheetItems.length + "건" : "X (시트 측 X)"}`);
  if (sheetItems) {
    for (const r of sheetItems) {
      console.log(`    · 서비스종류=${r["서비스종류"]} | 서비스구분=${r["서비스구분"]} | 상품주문번호=${r["상품주문번호"]}`);
    }
  }

  // task_items 측 측 측
  const { data: peers } = await sb.from("task_items").select("id, order_type, work_type_id").eq("task_id", task?.id);
  console.log(`\n  측 task 측 task_items: ${peers?.length || 0}건`);
  for (const p of (peers || [])) {
    const wt = wtById.get(p.work_type_id);
    console.log(`    · order_type=${p.order_type || "NULL"} | work_type=${wt?.name || "(X)"}`);
  }
})();

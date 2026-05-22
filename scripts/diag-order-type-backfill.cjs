// ③ 진단 — usol_n task_items.order_type 백필 측 측 (수정 X)
const fs = require("fs"), path = require("path");
const XLSX = require("xlsx");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PRINCIPAL_ID = "22222222-2222-2222-2222-222222222006";

(async () => {
  console.log(`${"=".repeat(85)}\n③ 진단 — task_items.order_type 백필 측 측\n${"=".repeat(85)}\n`);

  // ============================================================================
  // [1] usol_n task_items 측 — task_id 측 측 측 (.in 측 측 X 측 측 chunk)
  // ============================================================================
  console.log(`[1] usol_n task 측 lookup\n`);
  const { data: usolTasks } = await sb.from("tasks").select("id, task_no").eq("tenant_id", TENANT_ID).eq("principal_id", PRINCIPAL_ID);
  console.log(`  usol_n task: ${usolTasks?.length || 0}건`);
  const taskIds = usolTasks.map(t => t.id);
  const taskNoById = new Map(usolTasks.map(t => [t.id, t.task_no]));

  // task_items chunk lookup
  const chunkSize = 200;
  const allItems = [];
  for (let i = 0; i < taskIds.length; i += chunkSize) {
    const chunk = taskIds.slice(i, i + chunkSize);
    const { data, error } = await sb.from("task_items")
      .select("id, task_id, order_type, work_type_id, appliance_type_id, unit_price")
      .in("task_id", chunk);
    if (error) { console.error(`chunk ${i} err:`, error.message); continue; }
    if (data) allItems.push(...data);
  }
  console.log(`  usol_n task_items: ${allItems.length}건\n`);

  // ============================================================================
  // [2] order_type NULL vs 측 측 + 분포
  // ============================================================================
  console.log(`${"=".repeat(85)}\n[2] order_type 측 측\n${"=".repeat(85)}\n`);
  const nullItems = allItems.filter(it => it.order_type == null);
  const filledItems = allItems.filter(it => it.order_type != null);

  console.log(`  · NULL:  ${nullItems.length}건`);
  console.log(`  · 측 측: ${filledItems.length}건`);

  const distribution = {};
  for (const it of filledItems) {
    distribution[it.order_type] = (distribution[it.order_type] || 0) + 1;
  }
  console.log(`\n  측 측 분포:`);
  for (const [k, v] of Object.entries(distribution).sort((a, b) => b[1] - a[1])) {
    console.log(`    · ${k}: ${v}건`);
  }

  // ============================================================================
  // [3] 시트 측 + 매칭 키 측
  // ============================================================================
  console.log(`\n${"=".repeat(85)}\n[3] 시트 매칭 측 측\n${"=".repeat(85)}\n`);
  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, "..", "유솔홈케어_운영.xlsx")), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  console.log(`  시트 측 측: ${rows.length}건`);

  // 시트 — 작업코드 측 측 측 측 측 (한 작업코드 측 측 측 measurement)
  // 측 — 측 측 측 — task_no + 서비스구분
  const sheetByTaskNoServiceDiv = new Map();    // key: task_no|서비스구분 → [rows]
  for (const r of rows) {
    const tno = String(r["작업코드"] || "").trim();
    const sd = String(r["서비스구분"] || "").trim();
    if (!tno) continue;
    const key = `${tno}|${sd}`;
    if (!sheetByTaskNoServiceDiv.has(key)) sheetByTaskNoServiceDiv.set(key, []);
    sheetByTaskNoServiceDiv.get(key).push(r);
  }
  // 중복 측 (같은 task_no + 같은 서비스구분 측 measurement)
  const dupKeys = Array.from(sheetByTaskNoServiceDiv.entries()).filter(([, v]) => v.length > 1);
  console.log(`  unique (task_no + 서비스구분): ${sheetByTaskNoServiceDiv.size}건`);
  console.log(`  중복 (한 작업코드 측 같은 서비스구분 측 measurement): ${dupKeys.length}건`);
  if (dupKeys.length > 0) {
    console.log(`    측 5건:`);
    for (const [k, v] of dupKeys.slice(0, 5)) console.log(`      · ${k}: ${v.length}개`);
  }

  // ============================================================================
  // [4] 시트 "서비스종류" 분포
  // ============================================================================
  console.log(`\n${"=".repeat(85)}\n[4] 시트 "서비스종류" 측 측 분포\n${"=".repeat(85)}\n`);
  const serviceTypeDist = {};
  for (const r of rows) {
    const st = String(r["서비스종류"] || "").trim() || "(빈값)";
    serviceTypeDist[st] = (serviceTypeDist[st] || 0) + 1;
  }
  for (const [k, v] of Object.entries(serviceTypeDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  · "${k}": ${v}건`);
  }

  // ============================================================================
  // [5] 매칭 측 측 + 측 측
  // ============================================================================
  console.log(`\n${"=".repeat(85)}\n[5] DB task_items vs 시트 매칭 측 측\n${"=".repeat(85)}\n`);
  // DB task_item → task_no + work_type + appliance_type 측 catch
  const wtRes = await sb.from("work_types").select("id, code, name, appliance_type_id");
  const atRes = await sb.from("appliance_types").select("id, code, name");
  const wtById = new Map(wtRes.data.map(w => [w.id, w]));
  const atById = new Map(atRes.data.map(a => [a.id, a]));

  // DB task_item 측 — task_no + appliance_name 측 매핑
  // 시트 측 — task_no + 서비스구분 (예: "벽걸이", "가정용 스탠드 (...)") 매핑
  // 측 — DB appliance.name 측 시트 서비스구분 측 부분 일치 측 catch
  const APPLIANCE_KEYWORD = {
    wall: "벽걸이", "1way": "1way", "2way": "2way", "4way": "4way",
    stand: "스탠드", round: "원형", "2in1": "투인원", multi: "시스템멀티",
  };
  // 추가선택 측 work_type code → keyword
  const ADDON_KEYWORD = {
    refri_no_appliance: "냉매점검",
    fan_disassembly: "송풍팬",
    outdoor_unit: "실외기",
    phytoncide: "피톤치드",
  };

  // 시트 — task_no 측 측
  const sheetByTaskNo = new Map();
  for (const r of rows) {
    const tno = String(r["작업코드"] || "").trim();
    if (!tno) continue;
    if (!sheetByTaskNo.has(tno)) sheetByTaskNo.set(tno, []);
    sheetByTaskNo.get(tno).push(r);
  }

  let mappedOk = 0;
  let noTaskInSheet = 0;
  let noMatchingItem = 0;
  const noMatchingSamples = [];

  for (const item of nullItems) {
    const taskNo = taskNoById.get(item.task_id);
    const sheetItems = sheetByTaskNo.get(taskNo);
    if (!sheetItems) { noTaskInSheet++; continue; }

    // DB item 측 keyword 측 정의
    let keyword = null;
    if (item.work_type_id) {
      const wt = wtById.get(item.work_type_id);
      if (wt) {
        // 본작업 측 측 — appliance_type 측 catch
        if (wt.appliance_type_id) {
          const at = atById.get(wt.appliance_type_id);
          if (at) keyword = APPLIANCE_KEYWORD[at.code] || null;
        }
        // 추가선택 측 측 — work_type.code 측 catch
        if (!keyword && ADDON_KEYWORD[wt.code]) keyword = ADDON_KEYWORD[wt.code];
      }
    }
    if (!keyword) { noMatchingItem++; if (noMatchingSamples.length < 5) noMatchingSamples.push({ taskNo, item_id: item.id, wt_id: item.work_type_id }); continue; }

    // 시트 측 측 catch
    const match = sheetItems.find(r => String(r["서비스구분"] || "").includes(keyword));
    if (match) mappedOk++;
    else { noMatchingItem++; if (noMatchingSamples.length < 5) noMatchingSamples.push({ taskNo, keyword, sheet_items: sheetItems.map(r => r["서비스구분"]) }); }
  }

  console.log(`  NULL ${nullItems.length}건 측:`);
  console.log(`    · 시트 매칭 측: ${mappedOk}건`);
  console.log(`    · 시트 측 task_no 측 X: ${noTaskInSheet}건`);
  console.log(`    · 매칭 실패: ${noMatchingItem}건`);
  if (noMatchingSamples.length > 0) {
    console.log(`\n    매칭 실패 측 5건:`);
    for (const s of noMatchingSamples) console.log(`      · ${JSON.stringify(s).slice(0, 200)}`);
  }
})();

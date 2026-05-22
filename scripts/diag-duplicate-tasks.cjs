// ④-2 측 진단 — 중복 의심 task 8건 측 측 (DELETE X)
const fs = require("fs"), path = require("path");
const XLSX = require("xlsx");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
function cleanStr(v) { return v == null ? "" : String(v).trim(); }
function toInt(v) { const n = parseFloat(String(v || "").replace(/[,\s]/g, "")); return isNaN(n) ? 0 : Math.round(n); }

// off-by-one 8건 — { 측 의심(DB), 정상(시트 측) }
const DUPLICATES = [
  { suspect: "YS-260513-005", sheet: ["YS-260513-006"] },
  { suspect: "YS-260516-021", sheet: ["YS-260516-022", "YS-260516-023"] },
  { suspect: "YS-260516-115", sheet: ["YS-260516-116"] },
  { suspect: "YS-260517-058", sheet: ["YS-260517-059", "YS-260517-060"] },
  { suspect: "YS-260518-075", sheet: ["YS-260518-076"] },
  { suspect: "YS-260515-009", sheet: ["YS-260515-010"] },
  { suspect: "YS-260515-069", sheet: ["YS-260515-070", "YS-260515-071"] },
  { suspect: "YS-260517-027", sheet: ["YS-260517-028"] },
];

(async () => {
  console.log(`${"=".repeat(140)}\n④-2 측 진단 — 중복 의심 task 8건\n${"=".repeat(140)}\n`);

  // 시트 측
  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, "..", "유솔홈케어_운영.xlsx")), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });

  // work_types / appliance_types
  const wtRes = await sb.from("work_types").select("id, code, name");
  const atRes = await sb.from("appliance_types").select("id, code, name");
  const wtById = new Map(wtRes.data.map(w => [w.id, w]));
  const atById = new Map(atRes.data.map(a => [a.id, a]));

  for (const dup of DUPLICATES) {
    console.log(`\n${"=".repeat(140)}\n▣ 중복 의심: ${dup.suspect} (DB) | 정상 (시트 측 task_no): ${dup.sheet.join(", ")}\n${"=".repeat(140)}`);

    // suspect task
    const { data: suspectTask } = await sb.from("tasks").select("id, task_no, customer_name, status, scheduled_at, completed_at, external_order_no, created_at, channel").eq("tenant_id", TENANT_ID).eq("task_no", dup.suspect).maybeSingle();
    // sheet task — 시트 측 task_no measurement DB 측 measurement task (정상)
    const sheetTaskNos = dup.sheet;
    const { data: sheetTasks } = await sb.from("tasks").select("id, task_no, customer_name, status, scheduled_at, completed_at, external_order_no, created_at, channel").eq("tenant_id", TENANT_ID).in("task_no", sheetTaskNos);

    if (!suspectTask) { console.log(`  suspect task X`); continue; }

    // 측 task items
    const { data: suspectItems } = await sb.from("task_items").select("work_type_id, appliance_type_id, order_type, unit_price, qty, product_order_id").eq("task_id", suspectTask.id);

    console.log(`\n  [측 의심 task: ${suspectTask.task_no}]`);
    console.log(`    고객: ${suspectTask.customer_name} | status: ${suspectTask.status} | channel: ${suspectTask.channel || "(X)"}`);
    console.log(`    scheduled_at: ${suspectTask.scheduled_at} | completed_at: ${suspectTask.completed_at}`);
    console.log(`    external_order_no: ${suspectTask.external_order_no}`);
    console.log(`    created_at: ${suspectTask.created_at}`);
    console.log(`    task_items (${suspectItems?.length || 0}건):`);
    for (const it of (suspectItems || [])) {
      const wt = wtById.get(it.work_type_id); const at = it.appliance_type_id ? atById.get(it.appliance_type_id) : null;
      console.log(`      · ${it.order_type} | ${wt?.name} (${wt?.code}) | ${at?.name || "(X)"} | qty=${it.qty} | unit_price=${it.unit_price} | product_order=${it.product_order_id}`);
    }

    // payments
    const { data: suspectPays } = await sb.from("payments").select("principal_amount, engineer_amount, owner_amount, calc_method").eq("task_id", suspectTask.id);
    console.log(`    payments: ${suspectPays?.length ? JSON.stringify(suspectPays[0]) : "(X)"}`);

    // 시트 측 task (DB 측 측)
    for (const st of (sheetTasks || [])) {
      const { data: stItems } = await sb.from("task_items").select("work_type_id, appliance_type_id, order_type, unit_price, qty, product_order_id").eq("task_id", st.id);
      const { data: stPays } = await sb.from("payments").select("principal_amount, engineer_amount, owner_amount, calc_method").eq("task_id", st.id);
      console.log(`\n  [정상 task: ${st.task_no}]`);
      console.log(`    고객: ${st.customer_name} | status: ${st.status} | channel: ${st.channel || "(X)"}`);
      console.log(`    scheduled_at: ${st.scheduled_at} | completed_at: ${st.completed_at}`);
      console.log(`    created_at: ${st.created_at}`);
      console.log(`    task_items (${stItems?.length || 0}건):`);
      for (const it of (stItems || [])) {
        const wt = wtById.get(it.work_type_id); const at = it.appliance_type_id ? atById.get(it.appliance_type_id) : null;
        console.log(`      · ${it.order_type} | ${wt?.name} (${wt?.code}) | ${at?.name || "(X)"} | qty=${it.qty} | unit_price=${it.unit_price} | product_order=${it.product_order_id}`);
      }
      console.log(`    payments: ${stPays?.length ? JSON.stringify(stPays[0]) : "(X)"}`);
    }

    // 시트 측 측 측
    const sheetOrderRows = rows.filter(r => cleanStr(r["주문번호"]) === suspectTask.external_order_no);
    console.log(`\n  [시트 측 측 측 측 (주문번호=${suspectTask.external_order_no}, ${sheetOrderRows.length}건)]`);
    for (const r of sheetOrderRows) {
      console.log(`    · 작업코드=${cleanStr(r["작업코드"])} | 서비스종류=${cleanStr(r["서비스종류"])} | 서비스구분=${cleanStr(r["서비스구분"])} | 정산예정=${r["정산예정금액"]} | 도급사=${r["도급사정산액"]} | 회사배분=${r["회사배분액"]}`);
    }

    // 중복 측 판정 — 측 의심 task task_items 측 같은 주문 측 정상 task task_items 측 product_order_id 비교
    const allNormalItems = [];
    for (const st of (sheetTasks || [])) {
      const { data: stIt } = await sb.from("task_items").select("product_order_id, unit_price").eq("task_id", st.id);
      if (stIt) allNormalItems.push(...stIt);
    }
    const suspectPOIds = new Set((suspectItems || []).map(it => it.product_order_id).filter(Boolean));
    const normalPOIds = new Set(allNormalItems.map(it => it.product_order_id).filter(Boolean));
    const overlapping = [...suspectPOIds].filter(po => normalPOIds.has(po));
    const onlySuspect = [...suspectPOIds].filter(po => !normalPOIds.has(po));
    console.log(`\n  [중복 측 판정]`);
    console.log(`    측 측 의심 task product_order_id: ${suspectPOIds.size}건`);
    console.log(`    측 정상 task product_order_id: ${normalPOIds.size}건`);
    console.log(`    겹치는 product_order_id: ${overlapping.length}건 ${overlapping.length > 0 ? "(완전/부분 중복)" : ""}`);
    console.log(`    측 의심 task 측만 measurement: ${onlySuspect.length}건`);
    if (overlapping.length > 0 && onlySuspect.length === 0) console.log(`    → 측 측: 측 측 완전 중복 (모든 product_order_id 측 정상 task 측 측)`);
    else if (overlapping.length > 0) console.log(`    → 측 측: 부분 중복 (일부 product_order_id 측 측)`);
    else console.log(`    → 측 측: product_order_id 측 다름 (측 데이터)`);
  }
})();

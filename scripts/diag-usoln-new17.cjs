// 진단 — usol_n YS-N- 신규 형식 17건 목록
// 2026-05-24
const fs = require("fs"), path = require("path");
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
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

(async () => {
  const usolNId = "22222222-2222-2222-2222-222222222006";

  const { data: tasks } = await sb
    .from("tasks")
    .select("*")
    .eq("principal_id", usolNId)
    .like("task_no", "YS-N-%")
    .order("task_no", { ascending: true });

  console.log(`YS-N- 신규 형식 task: ${tasks?.length || 0}건\n`);

  // 모든 컬럼 확인용 (첫 행)
  if (tasks?.[0]) {
    console.log("[샘플 task 1건 — 값 있는 컬럼만]");
    for (const [k, v] of Object.entries(tasks[0])) {
      if (v == null || v === "" || (typeof v === "object" && !Array.isArray(v) && Object.keys(v || {}).length === 0)) continue;
      let disp = v;
      if (typeof v === "object") disp = JSON.stringify(v).slice(0, 80);
      else disp = String(v).slice(0, 80);
      console.log(`  · ${k.padEnd(28)} = ${disp}`);
    }
    console.log("");
  }

  const taskIds = (tasks || []).map(t => t.id);
  const { data: items } = await sb
    .from("task_items")
    .select("task_id, product_order_id, order_type, unit_price, net_amount, customer_paid_amount, description, work_type_id, appliance_type_id, metadata")
    .in("task_id", taskIds);

  // work_type / appliance_type 이름 조회
  const workTypeIds = [...new Set((items || []).map(i => i.work_type_id).filter(Boolean))];
  const applianceIds = [...new Set((items || []).map(i => i.appliance_type_id).filter(Boolean))];
  const { data: wt } = await sb.from("work_types").select("id, name, code").in("id", workTypeIds);
  const { data: at } = await sb.from("appliance_types").select("id, name, code").in("id", applianceIds);
  const wtMap = new Map((wt || []).map(r => [r.id, r]));
  const atMap = new Map((at || []).map(r => [r.id, r]));

  // 17건 표
  console.log("=".repeat(160));
  console.log("[17건 상세]");
  console.log("=".repeat(160));
  for (const t of (tasks || [])) {
    const its = (items || []).filter(i => i.task_id === t.id);
    console.log(`\n● ${t.task_no} | ${t.customer_name} | status=${t.status} | channel=${t.channel || "(NULL)"}`);
    console.log(`  scheduled_at : ${t.scheduled_at || "(NULL)"}`);
    console.log(`  created_at   : ${t.created_at}`);
    console.log(`  received_at  : ${t.received_at}`);
    console.log(`  ext_order_no : ${t.external_order_no || "(NULL)"}`);
    console.log(`  phone/addr   : ${t.phone} / ${(t.address || "").slice(0, 50)}`);
    console.log(`  request_note : ${t.request_note || "(NULL)"}`);
    console.log(`  work_memo    : ${t.work_memo || "(NULL)"}`);
    console.log(`  is_legacy    : ${t.is_legacy}`);
    console.log(`  assigned_eng : ${t.assigned_engineer_id || "(NULL)"}`);
    if (t.category_data && Object.keys(t.category_data).length) {
      console.log(`  category_data: ${JSON.stringify(t.category_data).slice(0, 120)}`);
    }
    console.log(`  task_items (${its.length}건):`);
    for (const i of its) {
      const wn = wtMap.get(i.work_type_id)?.name || "?";
      const an = atMap.get(i.appliance_type_id)?.name || "?";
      console.log(`    · poid=${i.product_order_id} | ${wn}/${an} | order_type=${i.order_type} | unit=${i.unit_price} net=${i.net_amount} cust=${i.customer_paid_amount}`);
      if (i.description) console.log(`      desc: ${i.description}`);
      if (i.metadata && Object.keys(i.metadata).length) {
        console.log(`      meta: ${JSON.stringify(i.metadata).slice(0, 120)}`);
      }
    }
  }

  // 한 줄 요약표
  console.log("\n" + "=".repeat(160));
  console.log("[한 줄 요약]");
  console.log("=".repeat(160));
  console.log("task_no".padEnd(20) + "| 고객".padEnd(12) + "| 서비스/order_type".padEnd(32) + "| status".padEnd(10) + "| scheduled_at".padEnd(28) + "| created_at".padEnd(28) + "| product_order_id".padEnd(20) + "| channel");
  for (const t of (tasks || [])) {
    const its = (items || []).filter(i => i.task_id === t.id);
    const svc = its.map(i => {
      const wn = wtMap.get(i.work_type_id)?.name || "?";
      return `${wn}/${i.order_type}`;
    }).join(",").slice(0, 30);
    const poids = its.map(i => i.product_order_id).join(",").slice(0, 18);
    const sch = (t.scheduled_at || "").slice(0, 19);
    const cre = (t.created_at || "").slice(0, 19);
    console.log(
      (t.task_no || "").padEnd(20) +
      "| " + (t.customer_name || "").padEnd(10) +
      "| " + svc.padEnd(30) +
      "| " + (t.status || "").padEnd(8) +
      "| " + sch.padEnd(26) +
      "| " + cre.padEnd(26) +
      "| " + poids.padEnd(18) +
      "| " + (t.channel || "")
    );
  }
})().catch(e => console.log("FATAL:", e.message, e.stack));

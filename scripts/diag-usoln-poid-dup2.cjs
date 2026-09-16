// 진단 — usol_n task_items.product_order_id 중복 11개 상세
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

  // tasks 수집
  const tasksById = new Map();
  {
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await sb
        .from("tasks")
        .select("id, task_no, status, customer_name, created_at, channel, scheduled_at, completed_at, assigned_engineer_id, external_order_no")
        .eq("principal_id", usolNId)
        .range(from, from + PAGE - 1);
      if (!data?.length) break;
      for (const t of data) tasksById.set(t.id, t);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  const usolNTaskIds = [...tasksById.keys()];

  // task_items 전체
  const items = [];
  for (let i = 0; i < usolNTaskIds.length; i += 200) {
    const ids = usolNTaskIds.slice(i, i + 200);
    const { data } = await sb
      .from("task_items")
      .select("id, task_id, product_order_id, order_type, unit_price, subtotal, net_amount, customer_paid_amount, naver_settled_at, company_received_at, engineer_settled_at, metadata")
      .in("task_id", ids);
    if (data) items.push(...data);
  }

  // 중복 poid 도출
  const counts = new Map();
  for (const it of items) {
    if (!it.product_order_id) continue;
    counts.set(it.product_order_id, (counts.get(it.product_order_id) || 0) + 1);
  }
  const dupPoids = [];
  for (const [k, v] of counts.entries()) if (v >= 2) dupPoids.push(k);
  console.log(`중복 product_order_id: ${dupPoids.length}개\n`);

  // 각 중복 poid의 두 행 상세
  console.log("=".repeat(120));
  for (const poid of dupPoids.sort()) {
    const rows = items.filter(it => it.product_order_id === poid);
    console.log(`\n● ${poid}  (${rows.length}건)`);
    for (const it of rows) {
      const t = tasksById.get(it.task_id);
      const kind = (t?.task_no || "").startsWith("YS-N-") ? "신규" : "legacy";
      console.log(`   [${kind}] task_no=${(t?.task_no || "?").padEnd(18)} | cust=${(t?.customer_name || "?").padEnd(10)} | status=${(t?.status || "?").padEnd(6)} | task.created_at=${(t?.created_at || "?").slice(0, 19)} | sched=${(t?.scheduled_at || "(N)").slice(0, 19)} | comp=${(t?.completed_at || "(N)").slice(0, 19)} | eng=${t?.assigned_engineer_id ? "Y" : "N"}`);
      console.log(`           item_id=${it.id.slice(0, 8)}.. | unit=${String(it.unit_price).padStart(8)} sub=${String(it.subtotal).padStart(8)} net=${String(it.net_amount ?? "NULL").padStart(6)} | order_type=${it.order_type} | naver_settled=${it.naver_settled_at ? it.naver_settled_at.slice(0,10) : "NULL"} | metadata=${JSON.stringify(it.metadata || {}).slice(0, 90)}`);
    }
  }

  // 요약 매트릭스 — legacy vs 신규 채워짐 차이
  console.log("\n" + "=".repeat(120));
  console.log("[요약] 11개 중복 쌍 — legacy/신규 비교");
  console.log("=".repeat(120));
  console.log(
    "poid".padEnd(18) +
    "| L task_no       L status L net    L sched      L comp       L set " +
    "| N task_no       N status N net    N sched      N comp       N set "
  );
  for (const poid of dupPoids.sort()) {
    const rows = items.filter(it => it.product_order_id === poid);
    const leg = rows.find(it => !(tasksById.get(it.task_id)?.task_no || "").startsWith("YS-N-"));
    const neu = rows.find(it => (tasksById.get(it.task_id)?.task_no || "").startsWith("YS-N-"));
    const cell = (it) => {
      if (!it) return "(없음)".padEnd(15) + " -      -      -            -            -";
      const t = tasksById.get(it.task_id);
      const tn = (t?.task_no || "?").padEnd(15);
      const st = (t?.status || "?").padEnd(7);
      const net = String(it.net_amount ?? "N").padStart(6);
      const sch = (t?.scheduled_at ? t.scheduled_at.slice(5, 10) : "N").padEnd(12);
      const comp = (t?.completed_at ? t.completed_at.slice(5, 10) : "N").padEnd(12);
      const set = (it.naver_settled_at ? "Y" : "N").padStart(3);
      return `${tn} ${st} ${net} ${sch} ${comp} ${set}`;
    };
    console.log(`${poid.padEnd(18)}| ${cell(leg)} | ${cell(neu)}`);
  }

  console.log(`\n${"=".repeat(120)}\n진단 완료.`);
})().catch(e => console.log("FATAL:", e.message, e.stack));

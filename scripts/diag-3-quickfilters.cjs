// 3측 quickFilter 측 measure task_items 측 shape 측 측 측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function kstTodayRangeUtc() {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit",
  }).format(now);
  const start = new Date(`${ymd}T00:00:00+09:00`);
  const end = new Date(start.getTime()); end.setDate(end.getDate()+1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

const SELECT = `id, task_no, customer_name, status,
  task_items ( id, qty, order_type,
    work_types ( id, name ),
    appliance_types ( id, name ) )`;

(async () => {
  const { data: pdata } = await sb.from("principals").select("id, code");
  const otherIds = pdata.filter(p => p.code !== "usol_n").map(p => p.id);
  const { startISO, endISO } = kstTodayRangeUtc();

  // todayCreated
  const { data: tc } = await sb.from("tasks").select(SELECT)
    .in("principal_id", otherIds)
    .gte("created_at", startISO).lt("created_at", endISO)
    .limit(5);
  console.log("\n=== todayCreated ===");
  for (const t of (tc||[])) {
    const items = t.task_items || [];
    const ap = items[0]?.appliance_types?.name || "?";
    console.log(`  ${t.customer_name} (${t.task_no}) ${t.status}: items=${items.length} appliance=${ap}`);
  }

  // todayCompleted
  const { data: td } = await sb.from("tasks").select(SELECT)
    .in("principal_id", otherIds)
    .eq("status", "완료")
    .gte("completed_at", startISO).lt("completed_at", endISO)
    .limit(5);
  console.log("\n=== todayCompleted ===");
  for (const t of (td||[])) {
    const items = t.task_items || [];
    const ap = items[0]?.appliance_types?.name || "?";
    console.log(`  ${t.customer_name} (${t.task_no}) ${t.status}: items=${items.length} appliance=${ap}`);
  }

  // confirmed
  const { data: cf } = await sb.from("tasks").select(SELECT)
    .in("principal_id", otherIds)
    .eq("status", "확정")
    .limit(5);
  console.log("\n=== confirmed ===");
  for (const t of (cf||[])) {
    const items = t.task_items || [];
    const ap = items[0]?.appliance_types?.name || "?";
    console.log(`  ${t.customer_name} (${t.task_no}) ${t.status}: items=${items.length} appliance=${ap}`);
  }

  // 비교: 전체 (필터 해제)
  const { data: all } = await sb.from("tasks").select(SELECT)
    .in("principal_id", otherIds)
    .limit(10);
  console.log("\n=== 전체 (필터 해제) — 측 측 측 측 측 측 측 ===");
  for (const t of (all||[])) {
    const items = t.task_items || [];
    const ap = items[0]?.appliance_types?.name || "?";
    console.log(`  ${t.customer_name} (${t.task_no}) ${t.status}: items=${items.length} appliance=${ap}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

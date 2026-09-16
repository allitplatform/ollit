// KA + crikrin 작업 전체 나열 (확인용 — 삭제 전).
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname,"..",".env"));
L(path.join(__dirname,"..",".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 1) KA/crikrin principal id 조회
  const { data: ps } = await sb.from("principals").select("id, code, name").in("code", ["KA", "crikrin"]);
  console.log("=== KA + crikrin principal ===");
  ps.forEach(p => console.log(`  ${p.code} / ${p.name} / id=${p.id}`));

  if (!ps || ps.length === 0) { console.log("principal 없음"); process.exit(0); }

  const principalIds = ps.map(p => p.id);

  // 2) tasks 조회
  const { data: tasks, error } = await sb.from("tasks")
    .select("id, task_no, customer_name, status, principal_id, created_at, scheduled_at")
    .in("principal_id", principalIds)
    .order("created_at", { ascending: false });
  if (error) { console.error("tasks 조회:", error); process.exit(1); }

  const pCodeById = Object.fromEntries(ps.map(p => [p.id, p.code]));

  console.log(`\n=== 작업 ${tasks.length}건 ===`);
  console.log("idx | task_no            | code    | 고객명          | status      | scheduled_at         | created_at");
  console.log("----|--------------------|---------|-----------------|-------------|----------------------|-------------------");
  tasks.forEach((t, i) => {
    const code = pCodeById[t.principal_id] || "?";
    console.log(`${String(i+1).padStart(3)} | ${(t.task_no||"").padEnd(18)} | ${code.padEnd(7)} | ${(t.customer_name||"").padEnd(15)} | ${(t.status||"").padEnd(11)} | ${(t.scheduled_at||"").toString().slice(0,19).padEnd(20)} | ${t.created_at}`);
  });

  // 3) 안현생(CK-260604-001) 따로 표시 — 남길 대상
  console.log("\n=== 남길 대상 (안현생, CK-260604-001) ===");
  const keep = tasks.filter(t => t.task_no === "CK-260604-001" || t.customer_name === "안현생");
  keep.forEach(t => console.log(`  KEEP: ${t.task_no} ${t.customer_name}`));

  console.log("\n=== 삭제 대상 ===");
  const del = tasks.filter(t => t.task_no !== "CK-260604-001" && t.customer_name !== "안현생");
  del.forEach(t => console.log(`  DEL : ${t.task_no} ${t.customer_name} (${pCodeById[t.principal_id]})`));
  console.log(`\n총 ${tasks.length}건 → 남김 ${keep.length} / 삭제 ${del.length}`);

  // 4) 의존 데이터 카운트 (CASCADE 확인용)
  if (del.length > 0) {
    const delIds = del.map(t => t.id);
    const [items, pays, photos] = await Promise.all([
      sb.from("task_items").select("id", { count: "exact", head: true }).in("task_id", delIds),
      sb.from("payments").select("id", { count: "exact", head: true }).in("task_id", delIds),
      sb.from("photos").select("id", { count: "exact", head: true }).in("task_id", delIds),
    ]);
    console.log("\n=== 의존 데이터 (CASCADE 삭제 예정) ===");
    console.log(`  task_items : ${items.count}건`);
    console.log(`  payments   : ${pays.count}건`);
    console.log(`  photos     : ${photos.count}건`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

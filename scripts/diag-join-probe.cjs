// 2026-06-02 — PAYMENT_SELECT 측 assigned_engineer:users + principal_rel:principals join 검증.
//   기사 이름 + 원청 코드가 실제로 오는지 확인 (rowToTask 패치 적용 전).
const fs = require("fs"), path = require("path");
function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
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

const SELECT = `
  id, task_no, customer_name, status, principal_id, assigned_engineer_id,
  assigned_engineer:users!assigned_engineer_id ( name, code ),
  principal_rel:principals!principal_id ( code, name )
`;

(async () => {
  // 1) 임의 assigned 작업 1건
  const { data: assigned, error: e1 } = await sb
    .from("tasks")
    .select(SELECT)
    .not("assigned_engineer_id", "is", null)
    .not("principal_id", "is", null)
    .limit(2);
  if (e1) { console.error("[assigned probe] ERROR:", e1); process.exit(1); }
  console.log("=== 배정 + 원청 있는 작업 (2건) ===");
  for (const r of assigned || []) {
    console.log({
      task_no: r.task_no,
      customer: r.customer_name,
      status: r.status,
      assigned_engineer_id: r.assigned_engineer_id,
      engineer_name: r.assigned_engineer?.name || null,
      engineer_code: r.assigned_engineer?.code || null,
      principal_id: r.principal_id,
      principal_code: r.principal_rel?.code || null,
      principal_name: r.principal_rel?.name || null,
    });
  }

  // 2) usol_n 작업 1건 (있다면)
  const { data: usolPrincipal, error: e2a } = await sb
    .from("principals").select("id, code").eq("code", "usol_n").maybeSingle();
  if (e2a) { console.error("[usol_n principal lookup] ERROR:", e2a); process.exit(1); }
  if (usolPrincipal?.id) {
    const { data: uTasks, error: e2 } = await sb
      .from("tasks")
      .select(SELECT)
      .eq("principal_id", usolPrincipal.id)
      .limit(2);
    if (e2) { console.error("[usol_n probe] ERROR:", e2); process.exit(1); }
    console.log("\n=== usol_n 작업 (2건) ===");
    for (const r of uTasks || []) {
      console.log({
        task_no: r.task_no,
        customer: r.customer_name,
        engineer_name: r.assigned_engineer?.name || null,
        principal_code: r.principal_rel?.code || null,
      });
    }
  } else {
    console.log("\n(usol_n principal row 없음 — skip)");
  }
  process.exit(0);
})();

// 2026-06-02 — 기사 PWA가 받는 task 측 principalCode / paymentMethod 측측.
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

(async () => {
  // usol_n 작업 측측 측측 + payment_method 측 측측측.
  const { data: usolP } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  const { data: usolTasks } = await sb
    .from("tasks")
    .select("id, task_no, customer_name, status, payment_method, principal_id")
    .eq("principal_id", usolP.id)
    .eq("status", "완료")
    .limit(5);
  console.log("=== usol_n 완료 작업 5건 (raw row) ===");
  for (const r of usolTasks || []) {
    console.log({
      task_no: r.task_no,
      customer: r.customer_name,
      payment_method: r.payment_method,
      principal_id: r.principal_id,
    });
  }

  // payment_method 분포 (usol_n 전체)
  const { data: dist } = await sb
    .from("tasks")
    .select("payment_method")
    .eq("principal_id", usolP.id);
  const counts = {};
  for (const r of (dist || [])) {
    const k = r.payment_method ?? "NULL";
    counts[k] = (counts[k] || 0) + 1;
  }
  console.log("");
  console.log("=== usol_n 전체 작업의 payment_method 분포 ===");
  console.log(counts);

  // 다른 원청 sample — 분기 검증용 (현금 등)
  const { data: nonUsol } = await sb
    .from("tasks")
    .select("task_no, customer_name, payment_method, principal_id")
    .neq("principal_id", usolP.id)
    .eq("status", "완료")
    .limit(5);
  console.log("");
  console.log("=== 비-usol_n 완료 작업 5건 ===");
  for (const r of nonUsol || []) {
    console.log({
      task_no: r.task_no,
      customer: r.customer_name,
      payment_method: r.payment_method,
    });
  }
  process.exit(0);
})();

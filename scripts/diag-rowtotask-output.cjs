// 2026-06-02 — 패치 후 rowToTask 출력 검증.
//   단건 + 목록 측 engineer / assignedEngineer / principalCode 가 실제 채워지는지.
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

const PAYMENT_SELECT = `
  *,
  assigned_engineer:users!assigned_engineer_id ( name, code ),
  principal_rel:principals!principal_id ( code, name ),
  payment:payments(
    calc_method, policy_key, engineer_amount, principal_amount, owner_amount,
    is_balanced, status, computed_at, track,
    engineer_remitted_at, engineer_remit_confirmed_at, engineer_remit_confirmed_by, usol_remitted_at
  ),
  task_items (
    id, qty, unit_price, subtotal, order_type, product_order_id,
    is_canceled, canceled_reason, canceled_at, received_amount,
    work_types ( id, name, service_types ( id, code ) ),
    appliance_types ( id, name )
  )
`;

(async () => {
  // 단건 — 배정 + 원청 있음
  const { data: oneRow } = await sb.from("tasks")
    .select(PAYMENT_SELECT)
    .not("assigned_engineer_id", "is", null)
    .not("principal_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (!oneRow) { console.log("(no row)"); process.exit(0); }

  console.log("=== row.assigned_engineer (raw) ===", oneRow.assigned_engineer);
  console.log("=== row.principal_rel (raw) ===", oneRow.principal_rel);

  // rowToTask 측 핵심 매핑만 시뮬레이트
  const mapped = {
    id: oneRow.id,
    taskCode: oneRow.task_no,
    customer: oneRow.customer_name,
    engineer: oneRow.assigned_engineer?.name || null,
    assignedEngineer: oneRow.assigned_engineer?.name || "",
    engineerCode: oneRow.assigned_engineer?.code || null,
    principalCode: oneRow.principal_rel?.code || "",
  };
  console.log("\n=== rowToTask 출력 (핵심 필드) ===");
  console.log(mapped);

  // 목록 측 동일 SELECT 측 5건
  const { data: list } = await sb.from("tasks")
    .select(PAYMENT_SELECT)
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("\n=== 목록 5건 ===");
  for (const r of list || []) {
    console.log({
      task_no: r.task_no,
      customer: r.customer_name,
      engineer_name: r.assigned_engineer?.name || null,
      principal_code: r.principal_rel?.code || null,
      principal_id_present: !!r.principal_id,
    });
  }
  process.exit(0);
})();

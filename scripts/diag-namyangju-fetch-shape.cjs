// loadTasksForRole 측 측측 측측측 측측측 — 측측 측측측 측측측 측측 측측 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// PAYMENT_SELECT (tasksDb.js:26-56 측 measurement)
const SELECT = `*,
  assigned_engineer:users!assigned_engineer_id ( name, code ),
  principal_rel:principals!principal_id ( code, name ),
  payment:payments(
    calc_method, policy_key, engineer_amount, principal_amount, owner_amount,
    is_balanced, status, computed_at, track,
    engineer_remitted_at, engineer_remit_confirmed_at, engineer_remit_confirmed_by,
    usol_remitted_at
  ),
  task_items (
    id, qty, unit_price, subtotal,
    order_type, product_order_id,
    is_canceled, canceled_reason, canceled_at,
    received_amount,
    work_types (
      id, name,
      service_types ( id, code )
    ),
    appliance_types ( id, name )
  )`;

(async () => {
  console.log("\n=== YS-260605-001 raw row + 측측 측측 (rowToTask 측 측측) ===");
  const { data: r } = await sb.from("tasks").select(SELECT).eq("task_no", "YS-260605-001").maybeSingle();
  const p = Array.isArray(r.payment) ? r.payment[0] : r.payment;
  console.log(`  task_id: ${r.id}`);
  console.log(`  task_no: ${r.task_no}  customer: ${r.customer_name}  status: ${r.status}`);
  console.log(`  principal_rel: code=${r.principal_rel?.code}  name=${r.principal_rel?.name}`);
  console.log(`  assigned_engineer: name=${r.assigned_engineer?.name}  code=${r.assigned_engineer?.code}`);
  console.log(`  assigned_engineer_id: ${r.assigned_engineer_id}`);
  console.log(`  product_price=${r.product_price} extra_fee=${r.extra_fee} total_amount=${r.total_amount}`);
  console.log(`  completed_at: ${r.completed_at}`);
  console.log(`  payment.track:           ${p?.track}`);
  console.log(`  payment.engineer_amount: ${p?.engineer_amount}`);
  console.log(`  payment.calc_method:     ${p?.calc_method}`);
  console.log(`  payment.is_balanced:     ${p?.is_balanced}`);

  // rowToTask 시뮬레이션 측 측측 필드 (assignedEngineer / track / etc)
  const normalized = {
    id: r.id,
    taskCode: r.task_no,
    customer: r.customer_name,
    status: r.status,
    assignedEngineer: r.assigned_engineer?.name || "",
    assignedEngineerId: r.assigned_engineer_id,
    principalCode: r.principal_rel?.code || "",
    completedAt: r.completed_at,
    totalAmount: r.total_amount,
    engineer_amount: p?.engineer_amount,
    track: p?.track || 'A',
    payment: p,
  };
  console.log("\n  --- 측측 측측 측측 (rowToTask 측측) ---");
  console.log("  measureAssignedEngineer:", normalized.assignedEngineer);
  console.log("  measureAssignedEngineerId:", normalized.assignedEngineerId);
  console.log("  measurePrincipalCode:", normalized.principalCode);
  console.log("  measureTrack:", normalized.track);
  console.log("  measureCompletedAt:", normalized.completedAt);
  console.log("  measureEngineerAmount:", normalized.engineer_amount);

  // 측측 측측 측측 측측 (EngineerApp 측측 측측 측측측)
  console.log("\n  --- 측측 측측 측측 ---");
  // [1] filterTasksForEngineerV14: assignedEngineer === "김현동" OR assignedEngineerId === "E011"
  const matchByName = normalized.assignedEngineer === "김현동";
  const matchById   = normalized.assignedEngineerId === "E011" || normalized.assignedEngineerId === "77777777-7777-7777-7777-7777777e0011";
  console.log(`  [1] filterTasksForEngineerV14 측측: name=${matchByName} id=${matchById} → ${matchByName||matchById ? "✓" : "❌"}`);

  // [2] isCompletedStatus
  const isCompleted = ["완료","visit_only"].includes(normalized.status);
  console.log(`  [2] isCompletedStatus(status='${normalized.status}'): ${isCompleted ? "✓" : "❌"}`);

  // [3] isTrackARemittance
  const trackA = normalized.track === "A";
  console.log(`  [3] isTrackARemittance(track='${normalized.track}'): ${trackA ? "✓" : "❌"}`);

  // [4] completedAt 측측 (KST 6/6 측측)
  const d = new Date(normalized.completedAt);
  const ymd = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
  console.log(`  [4] completedAt KST: ${ymd}`);

  // 4 측측 모두 통과 측 측측 측측 — 측측 측측측 측측
  console.log(`\n  → 측측 측측 측측 4 측측 모두 통과 측측. 측측 측측측 측측측 측측 측측측.`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });

// 진단 — 김웅 작업 (정훈 기사 완료 처리 누락)
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // [A] 김웅 task 전체
  const { data: tasks } = await sb.from("tasks").select("*, principals(code,name)").ilike("customer_name", "%김웅%").range(0, 19);
  console.log(`[A] 고객명 '김웅' tasks: ${(tasks || []).length}건\n`);

  // 기사 lookup
  const engIds = [...new Set((tasks || []).map(t => t.assigned_engineer_id).filter(Boolean))];
  const { data: users } = await sb.from("users").select("id, code, name").in("id", engIds);
  const userMap = new Map((users || []).map(u => [u.id, u]));

  for (const t of (tasks || [])) {
    const eng = userMap.get(t.assigned_engineer_id);
    const hl = (eng?.name === "정훈" || (t.customer_name || "").includes("김웅")) ? " ★" : "";
    console.log(`──────────────── ${t.task_no}${hl}`);
    console.log(`  고객명             : ${t.customer_name}`);
    console.log(`  원청               : ${t.principals?.name || t.principal_id}`);
    console.log(`  배정 기사          : ${eng?.name || "?"} (${eng?.code || "?"})`);
    console.log(`  status             : ${t.status}`);
    console.log(`  scheduled_at       : ${t.scheduled_at?.slice(0, 16) || "—"}`);
    console.log(`  started_at         : ${t.started_at?.slice(0, 16) || "NULL"}`);
    console.log(`  completed_at       : ${t.completed_at?.slice(0, 16) || "NULL"}`);
    console.log(`  created_at         : ${t.created_at?.slice(0, 19)}`);
    console.log(`  updated_at         : ${t.updated_at?.slice(0, 19)}`);
    console.log(`  product_price      : ₩${(t.product_price || 0).toLocaleString()}`);
    console.log(`  total_amount       : ₩${(t.total_amount || 0).toLocaleString()}`);
    console.log(`  external_order_no  : ${t.external_order_no}`);
    console.log(`  cancel_kind/amount : ${t.cancel_engineer_comp_kind || "NULL"} / ₩${(t.cancel_engineer_comp_amount || 0).toLocaleString()}`);
    console.log(`  partial_reason     : ${t.partial_reason || "NULL"}`);
    console.log(`  address            : ${t.address}`);
    console.log(`  phone              : ${t.phone}`);

    // [B] task_items
    const { data: items } = await sb.from("task_items").select("*, work_types(name,code), appliance_types(name,code)").eq("task_id", t.id);
    console.log(`\n  [B] task_items: ${(items || []).length}행`);
    for (const i of (items || [])) {
      console.log(`    ─ work_type=${i.work_types?.name || "?"} | appliance=${i.appliance_types?.name || "NULL"} | order_type=${i.order_type} | qty=${i.qty} | unit_price=₩${(i.unit_price || 0).toLocaleString()} | subtotal=₩${(i.subtotal || 0).toLocaleString()} | is_canceled=${i.is_canceled}`);
    }

    // [C] payments
    const { data: pays } = await sb.from("payments").select("*").eq("task_id", t.id);
    console.log(`\n  [C] payments: ${(pays || []).length}건`);
    for (const p of (pays || [])) {
      console.log(`    ─ engineer=₩${(p.engineer_amount || 0).toLocaleString()} | principal=₩${(p.principal_amount || 0).toLocaleString()} | owner=₩${(p.owner_amount || 0).toLocaleString()} | settled_at=${p.settled_at || "NULL"} | calc_method=${p.calc_method}`);
    }

    // status_history
    const { data: hist } = await sb.from("status_history").select("from_status, to_status, changed_at, changed_by").eq("task_id", t.id).order("changed_at");
    console.log(`\n  status_history: ${(hist || []).length}건`);
    for (const h of (hist || [])) {
      console.log(`    ${h.changed_at?.slice(0, 19)} | ${h.from_status || "NULL"} → ${h.to_status} | by=${h.changed_by?.slice(0, 8) || "NULL"}`);
    }

    // photos
    const { data: photos } = await sb.from("photos").select("id, step, created_at").eq("task_id", t.id);
    console.log(`  photos: ${(photos || []).length}장`);
    console.log("");
  }

  // [E] 5/22 일괄 8건에 김웅 있는지
  const bulkList = ["YS-260518-075","YS-260517-058","YS-260517-027","YS-260516-115","YS-260516-021","YS-260515-069","YS-260515-009","YS-260513-005"];
  const kimWoongTaskNos = (tasks || []).map(t => t.task_no);
  const overlap = kimWoongTaskNos.filter(tn => bulkList.includes(tn));
  console.log(`\n[E] 5/22 일괄 8건과 겹침: ${overlap.length}건${overlap.length > 0 ? ` (${overlap.join(",")})` : " — 별개 케이스"}`);
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });

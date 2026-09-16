// 진단 — 김윤섭 정산 보고 3건 (read-only)
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // A) 이름으로 찾기 — 이보배, 강인성, 김주연
  const names = ["이보배", "강인성", "김주연"];
  console.log("=".repeat(100));
  console.log("[A] 이름으로 task 조회");
  console.log("=".repeat(100));
  for (const nm of names) {
    const { data } = await sb.from("tasks").select("id, task_no, customer_name, status, scheduled_at, completed_at, principal_id, assigned_engineer_id, partial_reason, partial_memo, cancel_engineer_comp_kind, cancel_engineer_comp_amount, product_price")
      .ilike("customer_name", `%${nm}%`).range(0, 19);
    console.log(`\n  '${nm}': ${(data || []).length}건`);
    for (const t of (data || [])) {
      console.log(`    ${t.task_no} | ${t.customer_name} | status=${t.status} | sched=${t.scheduled_at?.slice(0,10) || "—"} | done=${t.completed_at?.slice(0,10) || "—"} | eng_id=${t.assigned_engineer_id?.slice(0,8) || "NULL"} | product_price=${t.product_price} | partial=${t.partial_reason || "—"} | cancel_eng_comp=${t.cancel_engineer_comp_kind}(${t.cancel_engineer_comp_amount || 0})`);
    }
  }

  // B) 김윤섭 engineer_id
  const { data: kim } = await sb.from("users").select("id, code, name").eq("name", "김윤섭").limit(1);
  const kimId = kim?.[0]?.id;
  console.log(`\n\n[김윤섭] user_id=${kimId} code=${kim?.[0]?.code}`);

  // C) ICEL — YS-260427-061
  console.log("\n" + "=".repeat(100));
  console.log("[C] YS-260427-061 (이경화 ICEL) — task + items");
  console.log("=".repeat(100));
  const { data: icel } = await sb.from("tasks").select("*").eq("task_no", "YS-260427-061").single();
  if (icel) {
    console.log(`  task_no=${icel.task_no} | ${icel.customer_name} | status=${icel.status}`);
    console.log(`  scheduled=${icel.scheduled_at} | completed=${icel.completed_at}`);
    console.log(`  external_order_no=${icel.external_order_no}`);
    console.log(`  request_note=${icel.request_note}`);
    console.log(`  product_price=${icel.product_price} | total_amount=${icel.total_amount}`);
    console.log(`  assigned_engineer_id=${icel.assigned_engineer_id}`);
    console.log(`  address=${icel.address}`);
    console.log(`  category_data.workItems=${JSON.stringify(icel.category_data?.workItems)}`);

    const { data: items } = await sb.from("task_items").select("*, work_types(code,name), appliance_types(code,name)").eq("task_id", icel.id);
    console.log(`\n  task_items: ${(items || []).length}행`);
    for (const i of (items || [])) {
      console.log(`    ─ work_type=${i.work_types?.name || "?"}(${i.work_types?.code || "?"}) | appliance=${i.appliance_types?.name || "NULL"}(${i.appliance_types?.code || "?"}) | order_type=${i.order_type} | qty=${i.qty} | unit_price=${i.unit_price} | subtotal=${i.subtotal} | poid=${i.product_order_id} | metadata=${JSON.stringify(i.metadata)}`);
    }

    // D) payments
    const { data: pays } = await sb.from("payments").select("*").eq("task_id", icel.id);
    console.log(`\n  [D] payments: ${(pays || []).length}건`);
    for (const p of (pays || [])) {
      console.log(`    ─ engineer=${p.engineer_amount} | principal=${p.principal_amount} | owner=${p.owner_amount} | settled_at=${p.settled_at} | calc_method=${p.calc_method} | created=${p.created_at} | updated=${p.updated_at}`);
    }
  } else {
    console.log("  NOT FOUND");
  }

  // E) 김윤섭이 본 정산 — usol_h/usol_n 작업 중 그가 배정된 5/15·5/21
  if (kimId) {
    console.log("\n\n[E] 김윤섭 배정 작업 (이보배·강인성·김주연 매칭 확인용)");
    const { data: kimTasks } = await sb.from("tasks").select("task_no, customer_name, status, scheduled_at, completed_at, principal_id, partial_reason, cancel_engineer_comp_kind, cancel_engineer_comp_amount").eq("assigned_engineer_id", kimId).gte("scheduled_at", "2026-05-14T00:00:00Z").lte("scheduled_at", "2026-05-22T23:59:59Z").order("scheduled_at");
    for (const t of (kimTasks || [])) {
      const matched = names.some(n => t.customer_name?.includes(n)) ? " ★" : "";
      console.log(`  ${(t.scheduled_at || "").slice(0, 10)} | ${t.task_no} | ${t.customer_name} | status=${t.status} | partial=${t.partial_reason || "—"} | cancel_eng_comp=${t.cancel_engineer_comp_kind}(${t.cancel_engineer_comp_amount || 0})${matched}`);
    }
  }
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });

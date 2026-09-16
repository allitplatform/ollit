// 냉매 60% 3건 — 심화 진단 (task_items 0건 root cause + payments 변동 이력)
//
// 추가 조회:
//   · task_items 전건 (is_canceled=true 포함)
//   · task_changes_audit_log (Migration 039) — 변경 이력
//   · users.refrigerant_rate 측 기록 시점
//   · task computed_at vs items 최신 시각
//
// 실행: node scripts/diag-refri-60-3tasks-deep.cjs

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

const TASKS = [
  { kw: "용산구4527", id: "a4dc2dca-d42a-41b7-b976-946b04e31511", task_no: "YS-260526-002" },
  { kw: "강북구9810", id: "7e03a275-f638-4199-9a40-7ef810e79b76", task_no: "A-260608-003" },
  { kw: "강남구6429", id: "be31c04b-9283-4ca2-ae3e-546db7010fc5", task_no: "CK-260608-001" },
];

(async () => {
  for (const T of TASKS) {
    console.log("\n" + "=".repeat(90));
    console.log(`▶ ${T.kw} — ${T.task_no} (id=${T.id})`);
    console.log("=".repeat(90));

    // 1) task_items 전건 (is_canceled 포함, 모든 컬럼)
    const { data: items } = await sb.from("task_items")
      .select("*")
      .eq("task_id", T.id)
      .order("created_at", { ascending: true });
    console.log(`\n[1] task_items 전건 (is_canceled 포함): ${items?.length || 0}건`);
    for (const it of (items || [])) {
      console.log(`  · id=${it.id}`);
      console.log(`    qty=${it.qty} unit_price=${it.unit_price} subtotal=${it.subtotal} received_amount=${it.received_amount}`);
      console.log(`    order_type=${it.order_type} is_canceled=${it.is_canceled} work_type_id=${it.work_type_id} appliance_type_id=${it.appliance_type_id}`);
      console.log(`    created_at=${it.created_at} updated_at=${it.updated_at}`);
      if (it.metadata) console.log(`    metadata=${JSON.stringify(it.metadata)}`);
    }

    // 2) task 전 컬럼 (cancel/extra 관련)
    const { data: task } = await sb.from("tasks").select("*").eq("id", T.id).single();
    console.log(`\n[2] tasks row 핵심 필드:`);
    console.log(`    product_price=${task.product_price} extra_fee=${task.extra_fee} travel_fee=${task.travel_fee}`);
    console.log(`    status=${task.status} completed_at=${task.completed_at} updated_at=${task.updated_at}`);
    console.log(`    cancel_engineer_comp_kind=${task.cancel_engineer_comp_kind} cancel_engineer_comp_amount=${task.cancel_engineer_comp_amount}`);
    console.log(`    assigned_engineer_id=${task.assigned_engineer_id}`);

    // 3) payments 전건 (히스토리)
    const { data: pays } = await sb.from("payments").select("*").eq("task_id", T.id).order("computed_at", { ascending: true });
    console.log(`\n[3] payments 전건: ${pays?.length || 0}건`);
    for (const p of (pays || [])) {
      console.log(`  · id=${p.id} eng=${p.engineer_amount} prin=${p.principal_amount} owner=${p.owner_amount}`);
      console.log(`    calc_method=${p.calc_method} policy_key=${p.policy_key} track=${p.track}`);
      console.log(`    product_price=${p.product_price} extra_fee=${p.extra_fee} travel_fee=${p.travel_fee}`);
      console.log(`    status=${p.status} computed_at=${p.computed_at}`);
    }

    // 4) task_changes_audit_log (Migration 039)
    const { data: audit } = await sb.from("task_changes")
      .select("*").eq("task_id", T.id).order("changed_at", { ascending: true }).limit(50);
    if (audit && audit.length) {
      console.log(`\n[4] task_changes 감사 로그: ${audit.length}건`);
      for (const a of audit) {
        console.log(`  · ${a.changed_at} field=${a.field_name} old=${JSON.stringify(a.old_value)} new=${JSON.stringify(a.new_value)} changed_by=${a.changed_by}`);
      }
    } else {
      console.log(`\n[4] task_changes 감사 로그: 0건 (또는 테이블 없음)`);
    }
  }

  // 5) 정책 매칭 확인 — yongin refrigerant
  console.log("\n" + "=".repeat(90));
  console.log("[정책 매칭] yongin refrigerant + crikrin refrigerant + usol_h refrigerant");
  console.log("=".repeat(90));
  const { data: policies } = await sb.from("commission_policies")
    .select("id, principal_code, service_code, appliance_code, calc_method, engineer_rate, principal_rate, engineer_fixed, principal_fixed, qty_condition, policy_key")
    .in("principal_code", ["yongin", "crikrin", "usol_h"]);
  // service_code='refrigerant' 만 필터
  for (const p of (policies || []).filter(p => p.service_code === "refrigerant")) {
    console.log(`  ${p.principal_code}/${p.service_code}/${p.appliance_code} → ${p.calc_method} (eng_rate=${p.engineer_rate}, prin_rate=${p.principal_rate}, eng_fix=${p.engineer_fixed}, prin_fix=${p.principal_fixed}, qty=${p.qty_condition}, key=${p.policy_key})`);
  }
})().catch(e => console.log("FATAL:", e.message, e.stack));

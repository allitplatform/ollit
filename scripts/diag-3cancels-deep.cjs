// 깊은 진단 — 3건 "네이버 완료 / 올잇 취소" 모순 (read-only)
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const PID = "22222222-2222-2222-2222-222222222006";

const TASK_NOS = ["YS-260518-076", "YS-260517-028", "YS-260507-023"];

(async () => {
  // A) tasks 전체 dump
  console.log("=".repeat(110));
  console.log("[A] tasks 전체 컬럼 dump");
  console.log("=".repeat(110));
  for (const tn of TASK_NOS) {
    const { data: t } = await sb.from("tasks").select("*").eq("task_no", tn).single();
    if (!t) { console.log(`\n  ${tn}: NOT FOUND`); continue; }
    console.log(`\n[${tn}] ${t.customer_name} (status=${t.status})`);
    console.log(`  scheduled_at         : ${t.scheduled_at}`);
    console.log(`  started_at           : ${t.started_at || "NULL"}`);
    console.log(`  completed_at         : ${t.completed_at || "NULL"}`);
    console.log(`  created_at           : ${t.created_at}`);
    console.log(`  updated_at           : ${t.updated_at}`);
    console.log(`  assigned_engineer_id : ${t.assigned_engineer_id?.slice(0,8)}...`);
    console.log(`  external_order_no    : ${t.external_order_no}`);
    console.log(`  product_price        : ${t.product_price}`);
    console.log(`  partial_reason       : ${t.partial_reason || "NULL"}`);
    console.log(`  partial_memo         : ${t.partial_memo || "NULL"}`);
    console.log(`  cancel_engineer_comp_kind   : ${t.cancel_engineer_comp_kind || "NULL"}`);
    console.log(`  cancel_engineer_comp_amount : ${t.cancel_engineer_comp_amount || 0}`);
    console.log(`  category_data        : ${JSON.stringify(t.category_data)}`);
  }

  // B/C) task_changes + status_history
  console.log("\n" + "=".repeat(110));
  console.log("[B/C] task_changes + status_history (status 변경 이력)");
  console.log("=".repeat(110));
  for (const tn of TASK_NOS) {
    const { data: t } = await sb.from("tasks").select("id, task_no, customer_name").eq("task_no", tn).single();
    if (!t) continue;
    console.log(`\n[${tn}] ${t.customer_name}`);

    // task_changes — 모든 변경
    const { data: changes, error: cErr } = await sb.from("task_changes").select("*").eq("task_id", t.id).order("created_at", { ascending: true });
    if (cErr) console.log(`  task_changes 조회 실패: ${cErr.message}`);
    else {
      console.log(`  task_changes: ${(changes || []).length}건`);
      for (const c of (changes || [])) {
        console.log(`    ${c.created_at?.slice(0,19)} | field=${c.field_name || c.field || "?"} | ${JSON.stringify(c.old_value)} → ${JSON.stringify(c.new_value)} | by=${c.changed_by?.slice(0,8) || "?"} | source=${c.source || "?"}`);
      }
    }

    // status_history
    const { data: hist, error: hErr } = await sb.from("status_history").select("*").eq("task_id", t.id).order("changed_at", { ascending: true });
    if (hErr) console.log(`  status_history 조회 실패: ${hErr.message}`);
    else {
      console.log(`  status_history: ${(hist || []).length}건`);
      for (const h of (hist || [])) {
        console.log(`    ${h.changed_at?.slice(0,19)} | ${h.from_status || "NULL"} → ${h.to_status} | by=${h.changed_by?.slice(0,8) || "?"}`);
      }
    }
  }

  // E) 같은 증상 — status='취소' but completed_at 또는 started_at 있는 usol_n
  console.log("\n" + "=".repeat(110));
  console.log("[E] 같은 증상 — status='취소' AND (completed_at IS NOT NULL OR started_at IS NOT NULL)");
  console.log("=".repeat(110));
  const { data: suspects } = await sb.from("tasks").select("task_no, customer_name, status, scheduled_at, started_at, completed_at, updated_at, assigned_engineer_id, product_price").eq("principal_id", PID).eq("status", "취소").or("completed_at.not.is.null,started_at.not.is.null").order("scheduled_at", { ascending: false }).range(0, 99);
  console.log(`  ${(suspects || []).length}건`);
  for (const s of (suspects || [])) {
    console.log(`    ${(s.scheduled_at || "").slice(0,10)} | ${s.task_no} | ${s.customer_name} | started=${s.started_at?.slice(0,10) || "—"} | done=${s.completed_at?.slice(0,10) || "—"} | updated=${s.updated_at?.slice(0,10)} | eng=${s.assigned_engineer_id?.slice(0,8)} | pp=${s.product_price}`);
  }
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });

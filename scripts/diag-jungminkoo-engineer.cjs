// 진단 — YS-N-260526-031 정민구 assigned_engineer_id + task_changes (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // A. 현재 tasks row
  const { data: t } = await sb.from("tasks")
    .select("id, task_no, customer_name, status, assigned_engineer_id, scheduled_at, category_data, updated_at")
    .eq("task_no", "YS-N-260526-031")
    .maybeSingle();
  if (!t) { console.log("[A] task 없음"); return; }

  console.log("[A. YS-N-260526-031 — 현재 tasks row]");
  console.log("  id                   :", t.id);
  console.log("  customer_name        :", t.customer_name);
  console.log("  status               :", t.status);
  console.log("  assigned_engineer_id :", t.assigned_engineer_id);
  console.log("  scheduled_at         :", t.scheduled_at);
  console.log("  updated_at           :", t.updated_at);

  // 기사 이름 조회
  if (t.assigned_engineer_id) {
    const { data: u } = await sb.from("users").select("id, code, name").eq("id", t.assigned_engineer_id).maybeSingle();
    console.log("  → 실제 기사            :", u ? `${u.code} ${u.name}` : "(users 매핑 X)");
  }

  // B. task_changes 이력 (engineer 변경)
  const { data: changes } = await sb.from("task_changes")
    .select("change_type, before_data, after_data, note, changed_by_name, changed_at")
    .eq("task_id", t.id)
    .order("changed_at", { ascending: false })
    .limit(20);

  console.log(`\n[B. task_changes 이력 (최신순 ${(changes || []).length}건)]`);
  for (const c of (changes || [])) {
    const before = c.before_data ? JSON.stringify(c.before_data) : "—";
    const after = c.after_data ? JSON.stringify(c.after_data) : "—";
    console.log(`  ${c.changed_at} | ${c.change_type} | by ${c.changed_by_name || "?"}`);
    console.log(`    before: ${before}`);
    console.log(`    after : ${after}`);
    if (c.note) console.log(`    note  : ${c.note}`);
  }

  // C. 김경호 / 이상준 users 조회
  const { data: targets } = await sb.from("users")
    .select("id, code, name, role")
    .in("name", ["김경호", "이상준"]);
  console.log("\n[C. 후보 기사]");
  for (const u of (targets || [])) {
    console.log(`  ${u.code} ${u.name} (role=${u.role}) → id=${u.id}`);
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

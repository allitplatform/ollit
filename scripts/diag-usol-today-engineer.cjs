// 진단 — KST 오늘 trackC 배정 기사 + payments 결과 정확 확인
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  for (const taskNo of ["YS-260521-008", "YS-260516-106", "YS-260512-087"]) {
    const { data } = await sb.from("tasks")
      .select(`id, task_no, customer_name, extra_fee, completed_at, assigned_engineer_id,
               assignee:users!tasks_assigned_engineer_id_fkey(id, code, name),
               payments(engineer_amount, principal_amount, usol_remitted_at, track)`)
      .eq("task_no", taskNo).maybeSingle();
    const p = Array.isArray(data?.payments) ? data.payments[0] : data?.payments;
    console.log(`${taskNo} | ${data?.customer_name} | extra=${data?.extra_fee}`);
    console.log(`  배정: ${data?.assignee?.code} ${data?.assignee?.name} (${data?.assigned_engineer_id})`);
    console.log(`  completed_at: ${data?.completed_at} (KST ${new Date(new Date(data?.completed_at).getTime() + 9*3600*1000).toISOString().slice(0,16)})`);
    console.log(`  payments: principal_amount=${p?.principal_amount} / track=${p?.track} / usol_remitted_at=${p?.usol_remitted_at ?? "(NULL)"}`);
    console.log("");
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

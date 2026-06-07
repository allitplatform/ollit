// 3 측 측측 측측 측 측 측측 (remit + track + 측측)
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  const TNs = ["YS-260605-001","A-260605-005","A-260606-006"];
  for (const tn of TNs) {
    const { data: t } = await sb.from("tasks")
      .select(`task_no, customer_name, status, total_amount,
               principals:principal_id(code),
               payments(engineer_amount, principal_amount, owner_amount, track, status, calc_method,
                        engineer_remitted_at, engineer_remit_confirmed_at, engineer_remit_confirmed_by,
                        paid_at, settled_at, principal_paid_at)`)
      .eq("task_no", tn).maybeSingle();
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    console.log(`\n─── ${tn} (${t.customer_name}) ───`);
    console.log(`  principal: ${t.principals?.code}  status: ${t.status}`);
    console.log(`  total=${fmt(t.total_amount)}  engineer=${fmt(p?.engineer_amount)}  owner=${fmt(p?.owner_amount)}  principal=${fmt(p?.principal_amount)}`);
    console.log(`  measureCompanyShare (total - engineer) = ${fmt(Number(t.total_amount||0) - Number(p?.engineer_amount||0))}`);
    console.log(`  payment.track:                 ${p?.track}`);
    console.log(`  payment.status:                ${p?.status}`);
    console.log(`  payment.calc_method:           ${p?.calc_method}`);
    console.log(`  engineer_remitted_at:          ${p?.engineer_remitted_at || "—"}`);
    console.log(`  engineer_remit_confirmed_at:   ${p?.engineer_remit_confirmed_at || "—"}`);
    console.log(`  engineer_remit_confirmed_by:   ${p?.engineer_remit_confirmed_by || "—"}`);
    console.log(`  paid_at:                       ${p?.paid_at || "—"}`);
    console.log(`  settled_at:                    ${p?.settled_at || "—"}`);
    console.log(`  principal_paid_at:             ${p?.principal_paid_at || "—"}`);
  }

  // 측측 측측: 측 측측 3측 측측 측측 측측 측측 (allRemitted = .every(engineerRemittedAt))
  console.log("\n\n=== 측측 측측 ===");
  console.log("  EngineerApp.jsx:4476 allRemitted = dateTasks.every(t => t.engineerRemittedAt)");
  console.log("  → 측 3건 측 1건 measure 측 측측 측측 측 'pending' 측측 (works 측측 측측측 3 측측 측측 측측)");
  console.log("\n  ✓ 측측 측측 'pending'/'overdue' → 측측측 측측측 (입금완료=초록 X)");
  console.log("  ⚠️ 측측 측측 측측 측 측 측 측측 측 'completed'/'confirmed' 측측 측측 측측 측측");
})().catch(e => { console.error("FATAL", e); process.exit(1); });

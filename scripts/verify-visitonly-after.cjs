// extra_fee=0 측측 측 측측 측측 (payments 측 측측 측측 측측 measure)
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  for (const tn of ["A-260603-005","A-260606-006"]) {
    const { data: t } = await sb.from("tasks").select(`task_no, total_amount, product_price, extra_fee, travel_fee,
             payments(engineer_amount, principal_amount, owner_amount, is_balanced, calc_method, engineer_remitted_at, engineer_remit_confirmed_at)`)
      .eq("task_no", tn).maybeSingle();
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    const distSum = (Number(p?.engineer_amount)||0) + (Number(p?.owner_amount)||0) + (Number(p?.principal_amount)||0);
    console.log(`\n=== ${t.task_no} ===`);
    console.log(`  tasks:    product=${fmt(t.product_price)} extra=${fmt(t.extra_fee)} travel=${fmt(t.travel_fee)} total=${fmt(t.total_amount)}`);
    console.log(`  payments: engineer=${fmt(p?.engineer_amount)} principal=${fmt(p?.principal_amount)} owner=${fmt(p?.owner_amount)} calc=${p?.calc_method}`);
    console.log(`  분배 합:  ${fmt(distSum)} (vs total ${fmt(t.total_amount)}) → ${distSum === Number(t.total_amount) ? "✓ 측측" : "⚠️ 측측측"}`);
    console.log(`  is_balanced: ${p?.is_balanced}`);
    console.log(`  remit: remitted_at=${p?.engineer_remitted_at || "NULL"}  confirmed_at=${p?.engineer_remit_confirmed_at || "NULL"}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

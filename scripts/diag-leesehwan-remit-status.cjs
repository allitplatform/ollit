// SELECT only — YS-N-260601-020-R 이세환 측 측측 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  const { data: t } = await sb.from("tasks").select(`
    id, task_no, customer_name, assigned_engineer_id, completed_at,
    payments(engineer_amount, principal_amount, owner_amount, calc_method, status,
             paid_at, confirmed_at, settled_at, actual_settlement_date,
             engineer_remitted_at, engineer_remit_confirmed_at, engineer_remit_confirmed_by,
             principal_paid_at)
  `).eq("task_no", "YS-N-260601-020-R").maybeSingle();

  const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
  console.log("\n=== YS-N-260601-020-R (이세환 / 하나영) 측측 측측 ===");
  console.log(`  task_id: ${t.id}`);
  console.log(`  완료:    ${t.completed_at}`);
  console.log(`\n  payment:`);
  console.log(`    engineer=${fmt(p?.engineer_amount)}  principal=${fmt(p?.principal_amount)}  owner=${fmt(p?.owner_amount)}`);
  console.log(`    calc=${p?.calc_method}  status=${p?.status}`);
  console.log(`\n  측측 측측:`);
  console.log(`    paid_at:                     ${p?.paid_at || "—"}`);
  console.log(`    confirmed_at:                ${p?.confirmed_at || "—"}`);
  console.log(`    settled_at:                  ${p?.settled_at || "—"}`);
  console.log(`    actual_settlement_date:      ${p?.actual_settlement_date || "—"}`);
  console.log(`    engineer_remitted_at:        ${p?.engineer_remitted_at || "—"}`);
  console.log(`    engineer_remit_confirmed_at: ${p?.engineer_remit_confirmed_at || "—"}`);
  console.log(`    engineer_remit_confirmed_by: ${p?.engineer_remit_confirmed_by || "—"}`);
  console.log(`    principal_paid_at:           ${p?.principal_paid_at || "—"}`);

  const alreadyRemitted = !!(p?.engineer_remitted_at || p?.engineer_remit_confirmed_at || p?.paid_at);
  console.log("");
  if (alreadyRemitted) {
    console.log(`  ⚠️ 측측 측측 — 측측 65,000 측측 측측 측측측 측측측 측 (현재 payment=${fmt(p?.engineer_amount)})`);
    console.log(`     → 이세환께 측측 측측 +13,000원 추가 측측 측측`);
  } else {
    console.log(`  ✓ 측측 측측 측 — 측측 측측 시 78,000 자동 측측 (추가 조치 X)`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

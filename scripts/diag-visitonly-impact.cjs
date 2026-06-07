// visit_only 측측 측측 + 측측 측측측 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  // [2] visit_only 측측 측측 + remit 측측
  console.log("\n=== [2] visit_only status 측측 ===");
  const { data: vTasks } = await sb.from("tasks")
    .select(`id, task_no, customer_name, completed_at, product_price, extra_fee, travel_fee, total_amount,
             principals:principal_id(code),
             assigned_engineer_id,
             payments(engineer_amount, principal_amount, owner_amount, track, calc_method, status,
                      engineer_remitted_at, engineer_remit_confirmed_at, principal_paid_at, paid_at)`)
    .eq("status","visit_only");

  console.log(`측측: ${(vTasks||[]).length}건`);

  let remittedCount = 0, remittedSum = 0;
  let ownerGt0Count = 0, ownerGt0Sum = 0;
  let companyShareCount = 0, companyShareSum = 0;
  const byPrincipal = {};
  console.log(`\n측측 측측:`);
  for (const t of (vTasks||[])) {
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    const total = Number(t.total_amount)||0;
    const eng = Number(p?.engineer_amount)||0;
    const owner = Number(p?.owner_amount)||0;
    const principal = Number(p?.principal_amount)||0;
    const companyShare = total - eng;  // 화면 측측 측 측측측
    const pcode = t.principals?.code || "?";
    if (!byPrincipal[pcode]) byPrincipal[pcode] = { n: 0, ownerSum: 0, compShareSum: 0, engRemittedN: 0 };
    byPrincipal[pcode].n++;
    byPrincipal[pcode].ownerSum += owner;
    byPrincipal[pcode].compShareSum += companyShare;

    if (p?.engineer_remitted_at) { remittedCount++; remittedSum += companyShare; byPrincipal[pcode].engRemittedN++; }
    if (owner > 0) { ownerGt0Count++; ownerGt0Sum += owner; }
    if (companyShare > 0) { companyShareCount++; companyShareSum += companyShare; }

    console.log(`  ${t.task_no} (${pcode}) ${t.customer_name?.slice(0,12)}: product=${fmt(t.product_price)} extra=${fmt(t.extra_fee)} travel=${fmt(t.travel_fee)} total=${fmt(total)} | eng=${fmt(eng)} owner=${fmt(owner)} principal=${fmt(principal)} | company측측(total-eng)=${fmt(companyShare)} | remit=${p?.engineer_remitted_at ? "✓" : "—"} confirmed=${p?.engineer_remit_confirmed_at ? "✓" : "—"} calc=${p?.calc_method}`);
  }

  console.log(`\n=== [2] 측측 ===`);
  console.log(`  전체 visit_only: ${(vTasks||[]).length}건`);
  console.log(`  engineer_remitted_at SET: ${remittedCount}건 (송금측 측측 = ${fmt(remittedSum)})`);

  console.log(`\n=== [3] 출장비 total 측측 ===`);
  console.log(`  total - engineer > 0 (회사몫 측측): ${companyShareCount}건 / 측측 ${fmt(companyShareSum)}`);

  console.log(`\n=== [4] owner_amount > 0 ===`);
  console.log(`  ${ownerGt0Count}건 (측측측 측측 측측 측측 측측)`);

  console.log(`\n=== 측측측 측측 ===`);
  for (const [p, v] of Object.entries(byPrincipal).sort((a,b)=>b[1].n-a[1].n)) {
    console.log(`  ${p}: ${v.n}건 / owner합 ${fmt(v.ownerSum)} / 회사몫(total-eng)합 ${fmt(v.compShareSum)} / remit측측 ${v.engRemittedN}건`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

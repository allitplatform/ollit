// 6/7 KST 매출 측측 측측 + "기타" 측측 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  // 6/7 KST = 2026-06-06T15:00:00Z ~ 2026-06-07T15:00:00Z
  const { data } = await sb.from("tasks")
    .select(`task_no, customer_name, status, completed_at, total_amount, product_price, extra_fee, travel_fee,
             principals:principal_id(code, name),
             assigned_engineer:users!assigned_engineer_id(name),
             task_items(qty, unit_price,
                        work_types(name, service_types(code)),
                        appliance_types(name)),
             payments(engineer_amount, principal_amount, owner_amount, calc_method, track)`)
    .gte("completed_at","2026-06-06T15:00:00Z")
    .lt("completed_at","2026-06-07T15:00:00Z");

  console.log(`\n=== 6/7 KST 완료 측측: ${(data||[]).length}건 (전체) ===`);

  // isTrackARemittance: 완료/visit_only + track A
  const COMPLETED = new Set(["완료","정산완료","visit_only"]);
  const revenueBase = (data||[]).filter(t => {
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    const track = p?.track || "A";
    return COMPLETED.has(t.status) && track === "A";
  });

  console.log(`\n=== isTrackARemittance 측측 (매출 dataset): ${revenueBase.length}건 ===\n`);

  let totalTotal = 0, totalEng = 0, totalPrincipal = 0, totalOwner = 0;
  // byService: cleaning/refrigerant/other
  const byService = { cleaning: 0, refrigerant: 0, other: 0 };

  for (const t of revenueBase) {
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    const items = t.task_items || [];
    const main = items[0] || null;
    const mainSvc = main?.work_types?.service_types?.code || "(측측)";

    console.log(`─── ${t.task_no} (${t.customer_name}) ───`);
    console.log(`  status=${t.status}  principal=${t.principals?.code} (${t.principals?.name})`);
    console.log(`  기사=${t.assigned_engineer?.name}  완료=${t.completed_at}`);
    console.log(`  total=${fmt(t.total_amount)}  product=${fmt(t.product_price)}  extra=${fmt(t.extra_fee)}  travel=${fmt(t.travel_fee)}`);
    console.log(`  ---- task_items ----`);
    for (const it of items) {
      const sc = it.work_types?.service_types?.code || "?";
      console.log(`    [${sc}] ${it.appliance_types?.name||"?"}×${it.qty} unit=${fmt(it.unit_price)}  (${it.work_types?.name})`);
    }
    console.log(`  payment: eng=${fmt(p?.engineer_amount)} principal=${fmt(p?.principal_amount)} owner=${fmt(p?.owner_amount)} calc=${p?.calc_method}`);
    console.log(`  → main service: ${mainSvc}\n`);

    // 매출 카운트 (revenueStats.js 측측 measure)
    const amt = Number(t.total_amount) || 0;
    totalTotal += amt;
    totalEng += Number(p?.engineer_amount) || 0;
    totalPrincipal += Number(p?.principal_amount) || 0;
    totalOwner += Number(p?.owner_amount) || 0;

    // byService: pickServiceCode = items[0]?.serviceCode (workItems[0])
    if (mainSvc === "cleaning") byService.cleaning += amt;
    else if (mainSvc === "refrigerant") byService.refrigerant += amt;
    else byService.other += amt;
  }

  console.log("\n=== 측측 ===");
  console.log(`  total:     ${fmt(totalTotal)}`);
  console.log(`  engineer:  ${fmt(totalEng)}  (= 프로 측측)`);
  console.log(`  principal: ${fmt(totalPrincipal)}  (= 측측 측측측)`);
  console.log(`  owner:     ${fmt(totalOwner)}  (= 회사 마진)`);
  console.log(`  측측측 (eng+principal+owner): ${fmt(totalEng + totalPrincipal + totalOwner)}`);
  console.log(`  측측 vs 측측측 측측: ${fmt(totalTotal - totalEng - totalPrincipal - totalOwner)}`);
  console.log(`\n  byService:`);
  console.log(`    cleaning:    ${fmt(byService.cleaning)}`);
  console.log(`    refrigerant: ${fmt(byService.refrigerant)}`);
  console.log(`    other (= "기타"): ${fmt(byService.other)}`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });

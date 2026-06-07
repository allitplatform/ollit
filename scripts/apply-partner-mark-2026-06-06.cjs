// KA 2026-06-06 측측 측측측 측측측 측측 (Mig 100 mark_principal_daily_remit)
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();

(async () => {
  // [1] 직측 측측 (이번달 KA/crikrin 측측 측측)
  const { data: pData } = await sb.from("principals").select("id, code").in("code", ["KA","crikrin"]);
  const KA_ID = pData.find(p => p.code === "KA")?.id;
  if (!KA_ID) { console.error("KA principal_id 측측 측측"); process.exit(1); }
  const pids = pData.map(p => p.id);

  console.log("=== 측 측측 — 이번달 principal_daily_remittances ===");
  const { data: beforeRemits } = await sb.from("principal_daily_remittances")
    .select("*")
    .in("principal_id", pids)
    .gte("settle_date", "2026-06-01");
  console.log(`  ${(beforeRemits||[]).length}건`);
  for (const r of (beforeRemits||[])) console.log(`    ${r.settle_date} principal_id=${r.principal_id} amount=${fmt(r.remitted_amount)}`);

  // 운영자 actor — A003 (이전 측측 측측측 측측, principal_daily_remit RPC 측 owner/admin/operator 측측)
  // 운영자 측 측측 (A003) UUID 측측
  const { data: opUser } = await sb.from("users").select("id, code, name").eq("code","A003").maybeSingle();
  if (!opUser) { console.error("A003 운영자 측측 측측"); process.exit(1); }
  const ACTOR = opUser.id;
  console.log(`\nactor: ${opUser.name} (${opUser.code}) id=${ACTOR}`);

  // [2] RPC 측측
  console.log("\n=== 측측 mark_principal_daily_remit ===");
  console.log(`  principalId: ${KA_ID} (KA)`);
  console.log(`  settleDate:  2026-06-06`);
  console.log(`  amount:      28000`);
  const { data: res, error } = await sb.rpc("mark_principal_daily_remit", {
    p_principal_id: KA_ID,
    p_settle_date:  "2026-06-06",
    p_amount:       28000,
    p_actor:        ACTOR,
  });
  if (error) { console.error("RPC 측측:", error); process.exit(1); }
  console.log(`  ✓ RPC 측측: ${JSON.stringify(res)}`);

  // [3] verify — 측측 측측
  console.log("\n=== 측측 측측 — 이번달 principal_daily_remittances ===");
  const { data: afterRemits } = await sb.from("principal_daily_remittances")
    .select("*")
    .in("principal_id", pids)
    .gte("settle_date", "2026-06-01");
  console.log(`  ${(afterRemits||[]).length}건`);
  for (const r of (afterRemits||[])) {
    console.log(`    ${r.settle_date} principal_id=${r.principal_id} amount=${fmt(r.remitted_amount)} at=${r.remitted_at} by=${r.remitted_by?.slice(0,8)}...`);
  }

  const diff = (afterRemits?.length || 0) - (beforeRemits?.length || 0);
  if (diff === 1) {
    console.log(`\n✓ 측측측 통과 — row 1측 INSERT 측측`);
  } else {
    console.log(`\n⚠️ 측측측 측측 — diff=${diff} (측측 +1)`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

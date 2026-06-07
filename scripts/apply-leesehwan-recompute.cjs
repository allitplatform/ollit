// YS-N-260601-020-R 이세환 측 측측측 (+13,000원)
//   백업 → before snap → compute_payment → after snap → 측측측 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

const TASK_NO = "YS-N-260601-020-R";

(async () => {
  // 1) task_id + 백업
  console.log(`\n=== ${TASK_NO} 측측측 ===`);
  const { data: t } = await sb.from("tasks").select("id, task_no, assigned_engineer_id").eq("task_no", TASK_NO).maybeSingle();
  if (!t) { console.error("측측 측측"); process.exit(1); }
  console.log(`측측: id=${t.id}`);
  const { data: u } = await sb.from("users").select("name, refrigerant_rate").eq("id", t.assigned_engineer_id).maybeSingle();
  console.log(`기사: ${u?.name} (rate=${u?.refrigerant_rate}%)`);

  // 백업
  const { data: before } = await sb.from("payments").select("*").eq("task_id", t.id).maybeSingle();
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = path.join(__dirname, "..", "data", `leesehwan-payment-backup-${ts}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(before, null, 2), "utf8");
  console.log(`✓ 백업: ${backupPath}`);

  // 2) before snap
  console.log("\n=== BEFORE ===");
  console.log(`  engineer=${fmt(before?.engineer_amount)}  principal=${fmt(before?.principal_amount)}  owner=${fmt(before?.owner_amount)}`);
  console.log(`  calc=${before?.calc_method}  status=${before?.status}  track=${before?.track}  is_balanced=${before?.is_balanced}`);
  console.log(`  paid_at:                     ${before?.paid_at || "—"}`);
  console.log(`  confirmed_at:                ${before?.confirmed_at || "—"}`);
  console.log(`  settled_at:                  ${before?.settled_at || "—"}`);
  console.log(`  engineer_remitted_at:        ${before?.engineer_remitted_at || "—"}`);
  console.log(`  engineer_remit_confirmed_at: ${before?.engineer_remit_confirmed_at || "—"}`);
  console.log(`  engineer_remit_confirmed_by: ${before?.engineer_remit_confirmed_by || "—"}`);
  console.log(`  principal_paid_at:           ${before?.principal_paid_at || "—"}`);

  // 3) compute_payment
  console.log("\n=== compute_payment 측측 ===");
  const { data: cpRes, error: cpErr } = await sb.rpc("compute_payment", { p_task_id: t.id });
  if (cpErr) { console.error("compute_payment 측측:", cpErr); process.exit(1); }
  console.log(`✓ compute_payment 측측: ${JSON.stringify(cpRes)?.slice(0, 100)}`);

  // 4) after snap
  const { data: after } = await sb.from("payments").select("*").eq("task_id", t.id).maybeSingle();
  console.log("\n=== AFTER ===");
  console.log(`  engineer=${fmt(after?.engineer_amount)}  principal=${fmt(after?.principal_amount)}  owner=${fmt(after?.owner_amount)}`);
  console.log(`  calc=${after?.calc_method}  status=${after?.status}  is_balanced=${after?.is_balanced}`);

  console.log("\n=== DIFF ===");
  console.log(`  engineer: ${fmt(before?.engineer_amount)} → ${fmt(after?.engineer_amount)}  (${after.engineer_amount - before.engineer_amount > 0 ? "+" : ""}${fmt(after.engineer_amount - before.engineer_amount)})`);
  console.log(`  principal: ${fmt(before?.principal_amount)} → ${fmt(after?.principal_amount)}  (${after.principal_amount - before.principal_amount > 0 ? "+" : ""}${fmt(after.principal_amount - before.principal_amount)})`);
  console.log(`  owner: ${fmt(before?.owner_amount)} → ${fmt(after?.owner_amount)}  (${after.owner_amount - before.owner_amount > 0 ? "+" : ""}${fmt(after.owner_amount - before.owner_amount)})`);

  const ok = after?.engineer_amount === 78000 && after?.is_balanced === true;
  console.log(ok ? "\n✓ 측측측 통과 — engineer=78,000 / is_balanced=true" : "\n⚠️ 측측측 측측");

  // 5) 측측 측측 측측
  console.log("\n=== 측측 측측 측측 ===");
  const alreadyPaid = !!(before?.paid_at || before?.engineer_remitted_at || before?.engineer_remit_confirmed_at);
  if (alreadyPaid) {
    console.log("  ⚠️ 측측 측측/측측 측측측 측측 — DB 측 +13,000 측측 측측 측측 측측 X");
    console.log("     → 이세환께 측측 측측 +13,000원 추가 측측 측측");
  } else {
    console.log("  ✓ 측측 측측 측 — 측측 측측 시 자동 측측");
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

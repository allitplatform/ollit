// A-260606-006 (강북구9129) 측측 송금 측측 측측
//   백업 → dry-run (측측측 측측) → APPLY 측측측 측측 측측 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

const APPLY = process.argv.includes("--apply");
const TASK_NO = "A-260606-006";

(async () => {
  // task + payment fetch
  const { data: t } = await sb.from("tasks").select(`*, payments(*)`)
    .eq("task_no", TASK_NO).maybeSingle();
  if (!t) { console.error("측측 측측"); process.exit(1); }
  const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;

  console.log(`\n=== ${TASK_NO} (강북구9129) 측 측측 ===`);
  console.log(`  task_id:                       ${t.id}`);
  console.log(`  status:                        ${t.status}`);
  console.log(`  customer:                      ${t.customer_name}`);
  console.log(`  product=${fmt(t.product_price)} extra=${fmt(t.extra_fee)} travel=${fmt(t.travel_fee)} total=${fmt(t.total_amount)}`);
  console.log(`  engineer=${fmt(p?.engineer_amount)} principal=${fmt(p?.principal_amount)} owner=${fmt(p?.owner_amount)}`);
  console.log(`  payment.status:                ${p?.status}`);
  console.log(`  engineer_remitted_at:          ${p?.engineer_remitted_at || "—"}`);
  console.log(`  engineer_remit_confirmed_at:   ${p?.engineer_remit_confirmed_at || "—"}`);
  console.log(`  engineer_remit_confirmed_by:   ${p?.engineer_remit_confirmed_by || "—"}`);
  console.log(`  paid_at:                       ${p?.paid_at || "—"}`);
  console.log(`  settled_at:                    ${p?.settled_at || "—"}`);
  console.log(`  principal_paid_at:             ${p?.principal_paid_at || "—"}`);

  // 측측 측측 측측 측측: tasks 측측 측측 측측측 측측측 (별도 측측 측측 X)
  console.log(`\n  → 송금 측측 측측 측측: payments 측측 측측측 측측 (별도 측측측측 측측).`);

  // 백업 — 측측 측측
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const backupPath = path.join(dataDir, `a260606-006-cleanup-backup-${ts}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ task: t, payment: p }, null, 2), "utf8");
  console.log(`\n  ✓ 백업: ${backupPath}`);

  if (!APPLY) {
    console.log(`\n=== DRY-RUN ===`);
    console.log(`  UPDATE payments SET engineer_remitted_at=NULL, engineer_remit_confirmed_at=NULL, engineer_remit_confirmed_by=NULL WHERE task_id='${t.id}';`);
    console.log(`\n  측측 (after):`);
    console.log(`    engineer_remitted_at:          NULL`);
    console.log(`    engineer_remit_confirmed_at:   NULL`);
    console.log(`    engineer_remit_confirmed_by:   NULL`);
    console.log(`    engineer_amount:               ${fmt(p?.engineer_amount)} (측측 측측)`);
    console.log(`    owner/principal:               측측 측측`);
    console.log(`\n  → 김현동 6/6 측측 송금합계 효과: 142K − 30K(이 측 측측 측측) = 112K`);
    console.log(`     (측측 SettlementHistoryContent 측측 측측측 측측 측측 측측 — 별도 측측측측 측측 X)`);
    console.log(`\n  측측 측측: --apply 측측`);
    return;
  }

  // APPLY
  console.log(`\n=== APPLY ===`);
  const { error: uErr } = await sb.from("payments").update({
    engineer_remitted_at: null,
    engineer_remit_confirmed_at: null,
    engineer_remit_confirmed_by: null,
  }).eq("task_id", t.id);
  if (uErr) { console.error("UPDATE 측측:", uErr); process.exit(1); }
  console.log(`  ✓ UPDATE 측측`);

  // verify
  const { data: p2 } = await sb.from("payments").select("engineer_remitted_at, engineer_remit_confirmed_at, engineer_remit_confirmed_by, engineer_amount, owner_amount, principal_amount").eq("task_id", t.id).maybeSingle();
  console.log(`\n=== AFTER ===`);
  console.log(`  engineer_remitted_at:          ${p2?.engineer_remitted_at || "NULL ✓"}`);
  console.log(`  engineer_remit_confirmed_at:   ${p2?.engineer_remit_confirmed_at || "NULL ✓"}`);
  console.log(`  engineer_remit_confirmed_by:   ${p2?.engineer_remit_confirmed_by || "NULL ✓"}`);
  console.log(`  engineer/owner/principal:      ${fmt(p2?.engineer_amount)} / ${fmt(p2?.owner_amount)} / ${fmt(p2?.principal_amount)} (측측 측측)`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });

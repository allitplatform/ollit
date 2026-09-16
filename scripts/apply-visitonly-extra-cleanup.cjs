// A-260603-005 + A-260606-006 출장비 측측 extra_fee=30K 측측
//   백업 → UPDATE extra_fee=0 → compute_payment 측측측 → verify
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

const TARGETS = ["A-260603-005","A-260606-006"];

(async () => {
  // [1] 백업
  console.log("=== [1] 백업 ===");
  const backupRows = [];
  for (const tn of TARGETS) {
    const { data: t } = await sb.from("tasks").select(`*, task_items(*), payments(*)`)
      .eq("task_no", tn).maybeSingle();
    if (!t) { console.error(`${tn} 측측 측측`); process.exit(1); }
    backupRows.push(t);
    console.log(`  ${tn}  task_id=${t.id}`);
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const backupPath = path.join(dataDir, `visitonly-extra-cleanup-backup-${ts}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backupRows, null, 2), "utf8");
  console.log(`  ✓ 백업: ${backupPath}`);

  // [2] UPDATE extra_fee=0
  console.log("\n=== [2] UPDATE tasks.extra_fee = 0 ===");
  for (const t of backupRows) {
    const { error } = await sb.from("tasks").update({ extra_fee: 0 }).eq("id", t.id);
    if (error) { console.error(`${t.task_no} UPDATE 측측:`, error); process.exit(1); }
    console.log(`  ✓ ${t.task_no}`);
  }

  // [3] compute_payment
  console.log("\n=== [3] compute_payment 측측측 ===");
  for (const t of backupRows) {
    const { data, error } = await sb.rpc("compute_payment", { p_task_id: t.id });
    if (error) { console.error(`${t.task_no} compute_payment 측측:`, error); process.exit(1); }
    console.log(`  ✓ ${t.task_no}  payment_id=${data || "?"}`);
  }

  // [4] verify
  console.log("\n=== [4] AFTER 측측측 ===");
  let allOk = true;
  for (const t of backupRows) {
    const { data: t2 } = await sb.from("tasks").select(`task_no, total_amount, extra_fee, product_price, travel_fee,
             payments(engineer_amount, principal_amount, owner_amount, is_balanced, calc_method, engineer_remitted_at)`)
      .eq("id", t.id).maybeSingle();
    const p = Array.isArray(t2.payments) ? t2.payments[0] : t2.payments;
    const ok = t2.extra_fee === 0
            && t2.total_amount === 30000
            && p?.engineer_amount === 30000
            && p?.owner_amount === 0
            && p?.principal_amount === 0
            && p?.is_balanced === true;
    if (!ok) allOk = false;
    console.log(`  ${t2.task_no}: total=${fmt(t2.total_amount)} extra=${fmt(t2.extra_fee)} | eng=${fmt(p?.engineer_amount)} principal=${fmt(p?.principal_amount)} owner=${fmt(p?.owner_amount)} | is_balanced=${p?.is_balanced} | remit=${p?.engineer_remitted_at || "NULL ✓ (측측 측측)"}  ${ok ? "✓" : "⚠️"}`);
  }

  console.log(allOk ? "\n✓ 측측측 통과 — 측측 ${TARGETS.length}건 정상 측측 (total=30K, eng=30K, owner/principal=0, is_balanced=true)" : "\n⚠️ 측측측 측측 측측");
})().catch(e => { console.error("FATAL", e); process.exit(1); });

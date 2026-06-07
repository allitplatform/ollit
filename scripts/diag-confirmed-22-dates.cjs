// 측측 confirmed 측측 22건 측측 측측측 측측측 측측측 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function toKstYmd(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date(d));
}

(async () => {
  // 백업 측측 측측 22건 id 측측
  const backupDir = path.join(__dirname, "..", "data");
  const files = require("fs").readdirSync(backupDir).filter(f => f.startsWith("engineer-confirm-all-past-backup-"));
  if (files.length === 0) { console.error("백업 측측 측측"); process.exit(1); }
  const latestBackup = JSON.parse(require("fs").readFileSync(path.join(backupDir, files[files.length-1]), "utf8"));
  const taskIds = latestBackup.items.map(i => i.task_id);

  const { data } = await sb.from("tasks")
    .select(`task_no, completed_at, payments(engineer_remitted_at, engineer_remit_confirmed_at)`)
    .in("id", taskIds);

  // 측측 측측 vs 측측 측측 측측 측측
  console.log(`\n=== 22건 측측 측측측 vs 측측측측 측측측 ===\n`);
  const byCompletedYmd = {};
  const byRemittedYmd = {};
  for (const t of (data||[])) {
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    const cYmd = toKstYmd(t.completed_at);
    const rYmd = toKstYmd(p?.engineer_remit_confirmed_at);
    byCompletedYmd[cYmd] = (byCompletedYmd[cYmd] || 0) + 1;
    byRemittedYmd[rYmd] = (byRemittedYmd[rYmd] || 0) + 1;
  }
  console.log("측측 측측측 (작업일자) 측측:");
  for (const [d, c] of Object.entries(byCompletedYmd).sort((a,b)=>a[0].localeCompare(b[0]))) {
    console.log(`  ${d}: ${c}건`);
  }
  console.log("\n측측 측측 측측 (confirmed_at) 측측:");
  for (const [d, c] of Object.entries(byRemittedYmd).sort((a,b)=>a[0].localeCompare(b[0]))) {
    console.log(`  ${d}: ${c}건`);
  }
  console.log(`\n측측 측측: completedAt 측측 측측 → 측측 ${Object.keys(byCompletedYmd).length}측 측측측 측측 측측.`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });

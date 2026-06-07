// 복구 스크립트 — 백업 JSON 측측 측측 측측 측측 복구
//   측측: node scripts/revert-engineer-confirm-all-past.cjs <backup-file.json> [--apply]
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const backupFile = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!backupFile) { console.error("측측: node scripts/revert-engineer-confirm-all-past.cjs <backup-file.json> [--apply]"); process.exit(1); }
if (!fs.existsSync(backupFile)) { console.error(`백업 측측 측측: ${backupFile}`); process.exit(1); }
const backup = JSON.parse(fs.readFileSync(backupFile, "utf8"));

(async () => {
  console.log(`\n=== 복구 ${APPLY ? "APPLY" : "DRY-RUN"} — 백업 ${backupFile} 측측 ===`);
  console.log(`측측 측측: ${backup.items.length}건`);

  if (!APPLY) {
    for (const item of backup.items) {
      console.log(`  ${item.task_no.padEnd(18)} ${item.classified_as.padEnd(8)} 복구→ remitted=${item.before.engineer_remitted_at?.slice(0,16) || "NULL"} confirmed=${item.before.engineer_remit_confirmed_at?.slice(0,16) || "NULL"} by=${item.before.engineer_remit_confirmed_by?.slice(0,8) || "NULL"}`);
    }
    console.log(`\n--apply 측측 측측 측측`);
    return;
  }

  // 측 측측 측측 복구 (측측측측측 측측측 측측, 측 row UPDATE)
  let ok = 0;
  for (const item of backup.items) {
    const { error } = await sb.from("payments").update({
      engineer_remitted_at:         item.before.engineer_remitted_at,
      engineer_remit_confirmed_at:  item.before.engineer_remit_confirmed_at,
      engineer_remit_confirmed_by:  item.before.engineer_remit_confirmed_by,
    }).eq("task_id", item.task_id);
    if (error) { console.error(`${item.task_no} 측측:`, error); continue; }
    ok++;
  }
  console.log(`✓ 복구 ${ok}/${backup.items.length}건 측측`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });

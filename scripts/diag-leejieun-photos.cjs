// 측측 task 측 photos 측측 + 측측측 측측 확인.
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TASK_ID = "3e5dc34d-02da-4456-9fbe-eb3fff3b7c7b"; // 이지은 / 중구 마장로13길 18

(async () => {
  // 사진 row 측측
  const { data: photos, error: pErr } = await sb
    .from("photos")
    .select("*")
    .eq("task_id", TASK_ID);

  if (pErr) {
    console.error("photos 측측 측측:", pErr);
    process.exit(1);
  }

  console.log(`\n=== task ${TASK_ID} 측 photos ===`);
  console.log(`측: ${(photos||[]).length}장`);
  for (const p of (photos||[])) {
    console.log(`  - id=${p.id} step=${p.step} storage_path=${p.storage_path} created=${p.created_at?.slice(0,16)}`);
  }

  // 측측 측측 측측 (task row 측측측 측측)
  const { data: t } = await sb.from("tasks").select("*").eq("id", TASK_ID).maybeSingle();
  const cat = t?.category_data || {};
  console.log("\n=== task row 측측 측측 측 ===");
  console.log("  status:           ", t?.status);
  console.log("  scheduled_at:     ", t?.scheduled_at);
  console.log("  completed_at:     ", t?.completed_at);
  console.log("  cancel_reason:    ", t?.cancel_reason);
  console.log("  cancelled_at:     ", t?.cancelled_at);
  console.log("  cancelled_by:     ", t?.cancelled_by);
  console.log("  category_data:    ", JSON.stringify(cat, null, 2));
})().catch(e => { console.error("FATAL", e); process.exit(1); });

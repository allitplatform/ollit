// 이지은 / 마장로13길 18 task 측측 (취소 → 확정, 사진 측측)
//   백업 → UPDATE → DELETE → verify (한 측측 측측).
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TASK_ID = "3e5dc34d-02da-4456-9fbe-eb3fff3b7c7b";

(async () => {
  console.log("\n=== 측측 1: 백업 ===");
  const { data: task, error: tErr } = await sb
    .from("tasks").select("*").eq("id", TASK_ID).maybeSingle();
  if (tErr || !task) {
    console.error("task 측측 측측:", tErr); process.exit(1);
  }
  const { data: photos, error: pErr } = await sb
    .from("photos").select("*").eq("task_id", TASK_ID);
  if (pErr) {
    console.error("photos 측측 측측:", pErr); process.exit(1);
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const backupPath = path.join(dataDir, `leejieun-task-backup-${ts}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ task, photos }, null, 2), "utf8");
  console.log(`✓ 백업: ${backupPath}`);
  console.log(`  task: id=${task.id} status=${task.status} scheduled_at=${task.scheduled_at}`);
  console.log(`  photos: ${(photos||[]).length}장`);

  console.log("\n=== 측측 2: tasks UPDATE 취소 → 확정 ===");
  const { data: updated, error: uErr } = await sb
    .from("tasks")
    .update({
      status: "확정",
      completed_at: null,
      // category_data 측 측 {} — 측측 측측 키 측 측측 측측측 측측 측측측 안전망 측측 측측.
    })
    .eq("id", TASK_ID)
    .select("id, status, scheduled_at, completed_at")
    .maybeSingle();
  if (uErr) {
    console.error("UPDATE 측측:", uErr); process.exit(1);
  }
  console.log("✓ UPDATE 측측");
  console.log(`  status=${updated.status} scheduled_at=${updated.scheduled_at} completed_at=${updated.completed_at}`);

  console.log("\n=== 측측 3: photos DELETE ===");
  const { error: dErr, count } = await sb
    .from("photos")
    .delete({ count: "exact" })
    .eq("task_id", TASK_ID);
  if (dErr) {
    console.error("DELETE 측측:", dErr); process.exit(1);
  }
  console.log(`✓ ${count}건 측측`);

  console.log("\n=== 측측 4: verify ===");
  const { data: verifyTask } = await sb
    .from("tasks").select("id, status, scheduled_at, completed_at").eq("id", TASK_ID).maybeSingle();
  const { count: photoCount } = await sb
    .from("photos").select("id", { count: "exact", head: true }).eq("task_id", TASK_ID);
  console.log(`  task: status=${verifyTask?.status} scheduled_at=${verifyTask?.scheduled_at} completed_at=${verifyTask?.completed_at}`);
  console.log(`  photos: ${photoCount}장`);

  // 측측 측측
  const ok =
    verifyTask?.status === "확정" &&
    verifyTask?.scheduled_at === "2026-06-09T00:00:00+00:00" &&
    !verifyTask?.completed_at &&
    photoCount === 0;
  if (ok) {
    console.log("\n✓ 측측측 통과 — status=확정 / scheduled_at=6/9 측측 / 사진 0장");
  } else {
    console.log("\n⚠️ 측측측 측측 — 측측 측측 측측");
    process.exit(2);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

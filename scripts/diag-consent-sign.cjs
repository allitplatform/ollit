// 4 작업 photos.step 매핑 진단 — consent_sign 판별.
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const taskNos = ["A-260622-005", "A-260620-003", "A-260621-008", "A-260619-028"];
  const { data: tasks } = await sb.from("tasks").select("id, task_no").in("task_no", taskNos);
  const ids = (tasks || []).map(t => t.id);
  const { data: photos } = await sb
    .from("photos")
    .select("task_id, step, storage_path, uploaded_at")
    .in("task_id", ids)
    .order("uploaded_at", { ascending: true });
  const tnMap = new Map((tasks || []).map(t => [t.id, t.task_no]));
  const groups = {};
  for (const p of photos || []) {
    const tn = tnMap.get(p.task_id) || p.task_id;
    groups[tn] ??= [];
    groups[tn].push(p);
  }
  for (const tn of taskNos) {
    console.log(`\n=== ${tn} ===`);
    for (const [i, p] of (groups[tn] || []).entries()) {
      const baseName = p.storage_path.split("/").pop();
      console.log(`  _${i + 1}: step='${p.step}' path=${baseName}`);
    }
  }
})();

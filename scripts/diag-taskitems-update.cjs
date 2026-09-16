const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb_service = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
  // 측 1건 측 catch — usol_n task_items 측 catch (cleanup 측 catch metadata 측 catch 측 측 측 측)
  const { data: items } = await sb_service.from("task_items").select("id, metadata").limit(1);
  if (!items?.length) { console.log("X"); return; }
  const id = items[0].id;
  const orig = items[0].metadata;
  // anon UPDATE 측 catch
  const probe = { ...(orig || {}), __probe: "x" };
  const { error } = await anonClient.from("task_items").update({ metadata: probe }).eq("id", id);
  if (error) {
    console.log("anon UPDATE 측 X:", error.code, "|", error.message);
  } else {
    console.log("anon UPDATE 측 — id:", id);
    // 측 catch
    await sb_service.from("task_items").update({ metadata: orig }).eq("id", id);
    console.log("  cleanup OK");
  }
})();

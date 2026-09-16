// 현재 usoln_settle_board_summary 반환 필드 확인
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const { data, error } = await sb.rpc("usoln_settle_board_summary", { p_actor: "77777777-7777-7777-7777-aaaaaaaa0004" });
  if (error) { console.log("error:", error.message); process.exit(1); }
  const may = (data?.months || []).find(m => m.wm === "2026-05");
  if (!may) { console.log("5월 없음"); process.exit(1); }
  console.log("5월 RPC 반환 필드:");
  Object.entries(may).sort().forEach(([k, v]) => {
    console.log(`  ${k.padEnd(35)} ${typeof v === 'number' ? v.toLocaleString('ko-KR') : v}`);
  });
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

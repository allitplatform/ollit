// 075 — partner_full_cancel / partner_partial_cancel_item 함수 정의 fetch 시도
// 2026-05-25
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 시도 1 — supabase.rpc('pg_get_functiondef', ...) — public schema 함수 아니라 안 됨
  console.log("[시도 1] supabase.rpc('pg_get_functiondef', ...)");
  try {
    const r = await sb.rpc("pg_get_functiondef", { funcoid: 0 });
    console.log("  →", r.error ? `ERR: ${r.error.message}` : `OK: ${String(r.data).slice(0, 100)}`);
  } catch (e) { console.log("  → THROW:", e.message); }

  // 시도 2 — schema('information_schema').from('routines')
  console.log("\n[시도 2] supabase.schema('information_schema').from('routines')");
  try {
    const r = await sb.schema("information_schema").from("routines")
      .select("routine_name, routine_definition")
      .in("routine_name", ["partner_full_cancel", "partner_partial_cancel_item"]);
    if (r.error) console.log("  → ERR:", r.error.message);
    else { console.log(`  → OK: ${(r.data || []).length}건`); (r.data || []).forEach(x => console.log(`    · ${x.routine_name}: def length=${(x.routine_definition || "").length}`)); }
  } catch (e) { console.log("  → THROW:", e.message); }

  // 시도 3 — schema('pg_catalog').from('pg_proc')
  console.log("\n[시도 3] supabase.schema('pg_catalog').from('pg_proc')");
  try {
    const r = await sb.schema("pg_catalog").from("pg_proc")
      .select("proname")
      .in("proname", ["partner_full_cancel"]).limit(1);
    if (r.error) console.log("  → ERR:", r.error.message);
    else console.log(`  → OK: ${(r.data || []).length}건`);
  } catch (e) { console.log("  → THROW:", e.message); }

  // 시도 4 — Supabase REST API 직접 fetch (없는 RPC URL)
  console.log("\n[시도 4] Direct fetch /rest/v1/rpc/pg_get_functiondef");
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const resp = await fetch(`${url}/rest/v1/rpc/pg_get_functiondef`, {
      method: "POST",
      headers: { "apikey": key, "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ funcoid: 0 }),
    });
    const text = await resp.text();
    console.log(`  → status=${resp.status} body=${text.slice(0, 200)}`);
  } catch (e) { console.log("  → THROW:", e.message); }

  // 시도 5 — Management API (PAT 필요 — .env에 없음)
  console.log("\n[시도 5] Supabase Management API — PAT 미확보, skip");
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

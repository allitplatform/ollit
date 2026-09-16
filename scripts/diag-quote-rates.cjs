// principals.quote_rates 전 원청 dump
const fs = require("fs"), path = require("path");
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  const { data } = await sb.from("principals").select("code, name, quote_rates").order("code");
  for (const p of (data || [])) {
    console.log(`\n[${p.code}] ${p.name}`);
    if (!p.quote_rates) {
      console.log("  quote_rates: NULL / 측 측 측");
    } else if (Object.keys(p.quote_rates).length === 0) {
      console.log("  quote_rates: {} (빈 객체)");
    } else {
      console.log("  quote_rates:");
      for (const [svc, rates] of Object.entries(p.quote_rates)) {
        console.log(`    ${svc}:`);
        if (typeof rates === "object" && rates) {
          for (const [app, price] of Object.entries(rates)) {
            console.log(`      ${app.padEnd(14)} ${price?.toLocaleString?.() ?? price}`);
          }
        } else {
          console.log(`      ${rates}`);
        }
      }
    }
  }
})().catch(e => console.log("FATAL:", e.message));

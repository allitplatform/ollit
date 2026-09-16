const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
// anon key 테스트
const anonClient = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
(async () => {
  // anon 측 catch tasks INSERT 측 catch
  const probeRow = {
    tenant_id: "11111111-1111-1111-1111-111111111111",
    category_id: "33333333-3333-3333-3333-333333333001",
    task_no: "PROBE-9999-99",
    customer_name: "(diag probe)",
    phone: "01000000000",
    status: "미배정",
  };
  const { data, error } = await anonClient.from("tasks").insert(probeRow).select("id").single();
  if (error) {
    console.log("anon INSERT 측 X:", error.code, "|", error.message);
  } else {
    console.log("anon INSERT 측 — id:", data.id);
    // 측 cleanup (service_role 필요 — 측 catch X 측 측 X)
    console.log("  ⚠️ probe row 측 catch DB 측 catch — 별도 측 catch 측 catch");
  }
})();

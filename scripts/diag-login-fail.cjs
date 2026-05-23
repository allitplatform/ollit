// 유솔 로그인 실패 진단 — 수정 X
const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const TENANT_ID = "11111111-1111-1111-1111-111111111111";

(async () => {
  // [2] P003 phone 측 측 측 + password_hash
  const { data: p003 } = await sb.from("users").select("id, name, code, phone, password_hash, is_active, must_change_password").eq("tenant_id", TENANT_ID).eq("code", "P003").maybeSingle();
  console.log(`[2] P003:`);
  console.log(`  · phone: "${p003?.phone}" (length=${p003?.phone?.length})`);
  console.log(`  · hex:   ${[...(p003?.phone || "")].map(c => c.charCodeAt(0).toString(16)).join(" ")}`);
  console.log(`  · password_hash: ${p003?.password_hash}`);
  console.log(`  · is_active: ${p003?.is_active}`);
  console.log(`  · must_change_password: ${p003?.must_change_password}`);

  // [3] 다른 측 측 (기사 E001 등) phone 측
  const { data: engs } = await sb.from("users").select("code, phone").eq("tenant_id", TENANT_ID).like("code", "E%").limit(3);
  console.log(`\n[3] 기사 phone 측:`);
  for (const e of (engs || [])) console.log(`  · ${e.code}: "${e.phone}" (length=${e.phone?.length})`);

  // [4] RPC 측 측 — 정규화 측 측
  console.log(`\n[4] RPC 측 측 (sign_in_with_phone)`);
  console.log(`  측 1: phone="01098921980" (정규화 측)`);
  const { data: r1 } = await sb.rpc("sign_in_with_phone", { p_phone: "01098921980", p_password: "1980" });
  console.log(`    → ${JSON.stringify(r1)?.slice(0, 200)}`);

  console.log(`  측 2: phone="010-9892-1980" (하이픈 측)`);
  const { data: r2 } = await sb.rpc("sign_in_with_phone", { p_phone: "010-9892-1980", p_password: "1980" });
  console.log(`    → ${JSON.stringify(r2)?.slice(0, 200)}`);

  // [5] bcrypt — '1980' vs P003 password_hash
  console.log(`\n[5] bcrypt 검증`);
  try {
    const bcrypt = require("bcryptjs");
    const ok = bcrypt.compareSync("1980", p003.password_hash);
    console.log(`  · "1980" vs P003 hash: ${ok ? "✅ 측" : "❌ 측 측"}`);
  } catch (e) {
    console.log(`  · bcryptjs 측 X — DB 측 측 측 (extensions.crypt) 측 검증`);
    // DB 측 측 측 catch — SECURITY DEFINER 측 catch X 측 측, raw SQL 측 측 측
    const { data: cryptResult, error } = await sb.rpc("sign_in_with_phone", { p_phone: p003.phone, p_password: "1980" });
    console.log(`  · RPC 측 (정확 phone): ${JSON.stringify(cryptResult)?.slice(0, 150)}`);
  }
})();

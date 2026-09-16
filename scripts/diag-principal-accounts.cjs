// 원청 계좌 데이터 진단 — principals 테이블 bank_name/account_number/account_holder 실제 채움 상태
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 전체 컬럼 select — 어떤 필드가 있는지 자동 노출
  const { data, error } = await sb.from("principals")
    .select("*")
    .order("code", { ascending: true });
  if (error) { console.error("FATAL", error); process.exit(1); }

  console.log(`\n=== principals 테이블 ${data.length}개 원청 ===\n`);
  // 첫 row 키 목록 (스키마 확인용)
  if (data[0]) {
    console.log("📋 컬럼 목록:");
    console.log("  " + Object.keys(data[0]).join(" / "));
    console.log("");
  }

  console.log("📋 원청별 계좌 채움 상태:\n");
  for (const p of data) {
    const bn = p.bank_name      || null;
    const an = p.account_number || null;
    const ah = p.account_holder || null;
    const filled = bn && an && ah;
    const partial = !filled && (bn || an || ah);
    const status = filled ? "✅ 완전" : partial ? "⚠️ 일부" : "❌ 비어있음";
    console.log(`  [${status}] ${p.code} (${p.name})`);
    console.log(`    bank_name      = ${bn || "—"}`);
    console.log(`    account_number = ${an || "—"}`);
    console.log(`    account_holder = ${ah || "—"}`);
    // email/phone 컬럼 있는지 검사
    const hasEmail = "email" in p;
    const hasPhone = "phone" in p || "contact" in p;
    if (hasEmail) console.log(`    email          = ${p.email || "—"}`);
    if (hasPhone) console.log(`    phone/contact  = ${p.phone || p.contact || "—"}`);
    console.log("");
  }

  // 요약
  const filled = data.filter(p => p.bank_name && p.account_number && p.account_holder).length;
  const partial = data.filter(p => !(p.bank_name && p.account_number && p.account_holder) && (p.bank_name || p.account_number || p.account_holder)).length;
  const empty = data.length - filled - partial;
  console.log(`📊 요약: 완전 ${filled} / 일부 ${partial} / 비어있음 ${empty} (총 ${data.length})`);
  console.log(`📊 email 컬럼 존재 여부: ${data[0] && "email" in data[0] ? "있음" : "없음"}`);
  console.log(`📊 phone 컬럼 존재 여부: ${data[0] && ("phone" in data[0] || "contact" in data[0]) ? "있음" : "없음"}`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });

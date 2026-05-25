// 진단 — 이세환 프로 추가 저장 시 users_tenant_id_phone_key 위반
// 2026-05-25
//
// 코드 흐름 (engineersDb.upsertEngineerToDb):
//   1) (tenant_id, code) 기준 select → 있으면 UPDATE, 없으면 INSERT
//   2) INSERT 시 (tenant_id, phone) UNIQUE 제약 위반 → 같은 phone 가진 다른 user 가 이미 있음
//
// 진단 항목:
//   1. name='이세환' 행 전수
//   2. 이세환의 phone과 같은 (tenant_id, phone) 가진 다른 행
//   3. 이세환 행 측 auto_init_user_auth_trg 흔적 (password_hash / email / must_change_password)
//   4. user_roles (engineer 역할 부여 여부)

const fs = require("fs"), path = require("path");
function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const NAME = "이세환";

function bar(c = "═", n = 100) { return c.repeat(n); }
function head(s) { console.log("\n" + bar()); console.log(s); console.log(bar()); }
function sub(s)  { console.log("\n" + bar("─")); console.log(s); console.log(bar("─")); }
function row(obj, keys) {
  for (const k of keys) {
    let v = obj[k];
    if (v && typeof v === "object") v = JSON.stringify(v);
    if (typeof v === "string" && v.length > 80) v = v.slice(0, 77) + "...";
    console.log(`    ${String(k).padEnd(24)} = ${v ?? "(NULL)"}`);
  }
}

(async () => {
  head(`진단 — 프로 추가 저장 오류 (users_tenant_id_phone_key 위반)`);

  // 1) name='이세환' 행
  sub("【1】 users 중 name='이세환'");
  const { data: hits, error: e1 } = await sb.from("users")
    .select("id, tenant_id, code, name, phone, email, is_active, region, refrigerant_rate, password_hash, must_change_password, created_at")
    .eq("tenant_id", TENANT_ID)
    .eq("name", NAME)
    .order("created_at", { ascending: true });
  if (e1) { console.log("조회 실패:", e1.message); return; }
  console.log(`  hits: ${(hits || []).length}건`);
  const cols = ["id","code","name","phone","email","is_active","region","refrigerant_rate","must_change_password","created_at"];
  const hasPasswordOf = id => (hits.find(u => u.id === id)?.password_hash) ? "YES (set)" : "(NULL)";
  (hits || []).forEach((u, i) => {
    console.log(`  ─ 행 ${i+1} ──`);
    row(u, cols);
    console.log(`    password_hash            = ${hasPasswordOf(u.id)}`);
  });

  const phones = [...new Set((hits || []).map(u => u.phone).filter(Boolean))];

  // 2) 이세환의 phone 가진 다른 행 (충돌 가능성)
  sub("【2】 (tenant_id, phone) 충돌 점검 — 이세환 phone과 같은 phone 가진 모든 user");
  if (phones.length === 0) {
    console.log("  · 이세환 행 phone 없음 — phone 충돌 점검 불가");
  } else {
    for (const ph of phones) {
      const { data: same } = await sb.from("users")
        .select("id, code, name, phone, is_active, created_at")
        .eq("tenant_id", TENANT_ID)
        .eq("phone", ph)
        .order("created_at", { ascending: true });
      console.log(`  phone="${ph}" → ${(same || []).length}건`);
      (same || []).forEach(u => {
        const isMe = (hits || []).some(h => h.id === u.id);
        console.log(`    · code=${u.code || "(NULL)"} | name=${u.name} | is_active=${u.is_active} | created=${u.created_at} ${isMe ? "← 이세환" : "← 다른 user"}`);
      });
    }
  }

  // 3) 이세환의 user_roles
  sub("【3】 user_roles — 이세환 행에 engineer 역할 부여됐는지");
  const ids = (hits || []).map(u => u.id);
  if (ids.length === 0) {
    console.log("  · 이세환 user 행이 없음 → user_roles 조회 skip");
  } else {
    const { data: roles } = await sb.from("user_roles").select("user_id, role, is_primary, principal_id").in("user_id", ids);
    console.log(`  user_roles: ${(roles || []).length}건`);
    (roles || []).forEach(r => console.log(`    · user_id=${r.user_id} | role=${r.role} | primary=${r.is_primary} | principal_id=${r.principal_id || "(NULL)"}`));
  }

  // 4) UNIQUE 제약 정보 — pg_constraint 직접 조회 시도 (PostgREST 노출 X 일 수 있음)
  sub("【4】 users_tenant_id_phone_key UNIQUE 제약 — 정적 정의 확인 (db/migrations/001_init.sql:54)");
  console.log("  UNIQUE (tenant_id, phone) — Migration 001 라인 54");
  console.log("  → 같은 tenant_id + 같은 phone 인 두 번째 INSERT 시 위반");

  // 5) localStorage 측 이세환이 어떤 code로 저장됐을 가능성 (생성 패턴 추정)
  sub("【5】 (참고) engineer code 패턴 — 다음 code 후보");
  const { data: codes } = await sb.from("users")
    .select("code")
    .eq("tenant_id", TENANT_ID)
    .like("code", "E%")
    .order("code", { ascending: false })
    .limit(5);
  console.log("  최근 E### 코드 5개:");
  (codes || []).forEach(c => console.log(`    · ${c.code}`));

  // 6) 저장 흐름 요약
  sub("【6】 저장 흐름 요약 + 추정 시나리오");
  console.log("  saveEngineerWithSync(eng):");
  console.log("    1) localStorage 저장 (즉시 OK)");
  console.log("    2) upsertEngineerToDb(payload):");
  console.log("       a) (tenant_id, code) 기준 select");
  console.log("       b) 없으면 INSERT users (auto_init_user_auth_trg 발화 — password_hash 자동 설정)");
  console.log("       c) INSERT user_roles {role:'engineer'}");
  console.log("");
  console.log("  ★ 충돌 가능 시나리오:");
  console.log("    A) 이세환을 한 번 추가했다가 code 가 부여됐는데 사장님이 다시 '추가'로 진입해 다른 code로 저장 시도");
  console.log("       → select(tenant_id, code) → 없음(새 code) → INSERT → (tenant_id, phone) 충돌");
  console.log("    B) 동명이인이 아니라 phone 자체가 다른 user에 들어가 있음 (오타로 다른 사람 phone 입력 등)");
  console.log("    C) 이세환 행이 이미 있는데 localStorage 측 code 가 다른 값 (시드/외부 import 차이) → INSERT 분기로 들어감");
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

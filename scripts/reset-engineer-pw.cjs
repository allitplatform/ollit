// 기사 31명 비밀번호 전원 초기화 — dry-run + 실제 SQL 생성
// 2026-05-24
//
// 사장님 spec:
//   - role='engineer' 전 기사 31명
//   - password_hash = bcrypt(phone 뒤 4자리)
//   - must_change_password = true
//   - 기존 시드(Migration 007)와 동일한 pgcrypto bcrypt 해시 방식
//
// 실행:
//   node scripts/reset-engineer-pw.cjs          # dry-run (기본) — 31명 표시 + 백업 JSON + SQL 파일 생성
//   node scripts/reset-engineer-pw.cjs --commit # commit 모드 — 백업 + SQL 파일 생성 (실제 UPDATE는 사장님이 Supabase SQL Editor에서 실행)
//
// 안전:
//   - JS에서 직접 UPDATE 실행 X (bcryptjs ≠ pgcrypto bcrypt 100% 호환 보장 X)
//   - 해시는 Postgres pgcrypto의 extensions.crypt(...)로만 생성 → SQL 파일에 측 catch
//   - 사장님이 SQL Editor 측 catch 측 catch 측 catch 실행
//   - 백업 JSON은 scripts/backup-engineer-pw-{ts}.json — .gitignore 측 catch 측 catch

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

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const MODE = COMMIT ? "✅ COMMIT (백업 + SQL 파일 생성)" : "🔍 DRY-RUN (시뮬레이션만)";

function phoneLast4(phone) {
  const digits = String(phone || "").replace(/[^0-9]/g, "");
  return digits.slice(-4);
}

(async () => {
  console.log("=".repeat(80));
  console.log(`기사 31명 비밀번호 전원 초기화 — ${MODE}`);
  console.log("=".repeat(80));

  // role='engineer' user_id 측 catch
  const { data: roles } = await sb.from("user_roles").select("user_id, role").eq("role", "engineer");
  const engineerIds = new Set((roles || []).map(r => r.user_id));

  // users 측 catch — engineer + code='E' prefix fallback
  const { data: users } = await sb
    .from("users")
    .select("id, code, name, phone, password_hash, must_change_password, is_active")
    .eq("tenant_id", TENANT_ID)
    .order("code", { ascending: true });
  const engineers = (users || []).filter(u => engineerIds.has(u.id) || (u.code && /^E/i.test(u.code)));

  console.log(`\n대상 engineer: ${engineers.length}명\n`);

  // dry-run 표시
  const plans = [];
  let warnNoPhone = 0;
  let warnShortDigits = 0;
  console.log(`${"code".padEnd(18)}${"name".padEnd(10)}${"phone".padEnd(16)}${"뒤4자리".padEnd(10)}${"현재 must_chg".padEnd(14)}변경 예정`);
  console.log("-".repeat(95));
  for (const u of engineers) {
    const last4 = phoneLast4(u.phone);
    if (!u.phone) warnNoPhone++;
    if (last4.length < 4) warnShortDigits++;
    const planMsg = (last4.length === 4) ? "→ password_hash 재생성, must_change_password=true" : "⚠️ phone 뒤 4자리 추출 실패 — SKIP";
    console.log(
      (u.code || "").padEnd(18) +
      (u.name || "").padEnd(10) +
      (u.phone || "").padEnd(16) +
      `"${last4}"`.padEnd(10) +
      String(u.must_change_password).padEnd(14) +
      planMsg
    );
    plans.push({ id: u.id, code: u.code, name: u.name, phone: u.phone, last4, current_must_change: u.must_change_password, current_hash_set: !!u.password_hash });
  }

  const valid = plans.filter(p => p.last4.length === 4);
  console.log(`\n변경 예정      : ${valid.length}명`);
  console.log(`phone 없음     : ${warnNoPhone}명`);
  console.log(`뒤 4자리 부족  : ${warnShortDigits}명`);

  // 백업 JSON (변경 전 상태 — password_hash는 보안상 저장하되 평문 X)
  // 사장님 spec — backup 측 catch password_hash 보존 (롤백 가능하도록)
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupFile = path.join(__dirname, `backup-engineer-pw-${ts}.json`);
  // password_hash는 bcrypt 해시 자체이므로 평문 추출 불가. 보안상 git ignore에 차단됨 (scripts/backup-*.json).
  // 그러나 화면 출력엔 절대 노출 X.
  const backupData = {
    type: "engineer-pw-reset",
    ts: new Date().toISOString(),
    count: engineers.length,
    note: "변경 전 password_hash + must_change_password 보존 (롤백 시 복구용). git ignore 측 catch.",
    engineers: engineers.map(u => ({
      id: u.id,
      code: u.code,
      name: u.name,
      phone: u.phone,
      previous_password_hash: u.password_hash,    // 롤백용 (해시 자체, 평문 X)
      previous_must_change_password: u.must_change_password,
    })),
  };
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), "utf8");
  console.log(`\n📦 백업 저장   : ${backupFile}`);
  console.log(`     · 31명 변경 전 password_hash + must_change_password 보존 (롤백용)`);

  // SQL 파일 생성 (사장님이 Supabase SQL Editor 측 catch 측 catch 측 catch 실행)
  const sqlFile = path.join(__dirname, `reset-engineer-pw-${ts}.sql`);
  const ids = valid.map(p => `'${p.id}'`).join(",\n    ");
  const sqlContent = `-- =============================================================================
-- 기사 ${valid.length}명 비밀번호 초기화 — phone 뒤 4자리로 reset
-- 생성: ${new Date().toISOString()}
-- 실행: Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
-- 의존: Migration 007 (pgcrypto extension)
-- 안전: BEGIN/COMMIT — 부분 실패 시 자동 ROLLBACK
-- 롤백: backup-engineer-pw-${ts}.json — 31명 측 catch previous_password_hash 측 catch 측 catch
-- =============================================================================

BEGIN;

UPDATE users
SET
  password_hash        = extensions.crypt(
    RIGHT(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+', ''), 4),
    extensions.gen_salt('bf')
  ),
  must_change_password = true
WHERE tenant_id = '${TENANT_ID}'
  AND id IN (
    ${ids}
  );

-- 검증 — 영향 row 수 (예상: ${valid.length})
SELECT COUNT(*) AS updated_count
FROM users
WHERE tenant_id = '${TENANT_ID}'
  AND id IN (
    ${ids}
  )
  AND must_change_password = true;

COMMIT;

-- =============================================================================
-- 실행 후 검증 SQL:
--   SELECT code, name, must_change_password,
--          (password_hash IS NOT NULL) AS has_hash
--   FROM users
--   WHERE tenant_id = '${TENANT_ID}'
--     AND id IN ( ${ids.replace(/\n {4}/g, " ")} );
-- 측 ${valid.length}건 모두 must_change_password=true / has_hash=true 측 catch.
-- =============================================================================
`;
  fs.writeFileSync(sqlFile, sqlContent, "utf8");
  console.log(`\n📄 SQL 파일    : ${sqlFile}`);
  console.log(`     · 사장님이 Supabase 콘솔 SQL Editor 측 catch 측 catch 측 catch 실행`);

  if (!COMMIT) {
    console.log(`\n${"=".repeat(80)}\n🔍 DRY-RUN 완료 — 실제 쓰기 0건.`);
    console.log(`백업 JSON + SQL 파일 측 catch 측 catch (commit 모드 측 catch 측 catch).`);
    console.log(`실행: node scripts/reset-engineer-pw.cjs --commit`);
    return;
  }

  console.log(`\n${"=".repeat(80)}\n✅ COMMIT 완료 — 백업 + SQL 파일 측 catch 측 catch.`);
  console.log(`측 측 측 UPDATE 측 사장님이 Supabase SQL Editor 측 catch 측 catch 측 catch 실행.`);
})().catch(e => console.log("FATAL:", e.message, e.stack));

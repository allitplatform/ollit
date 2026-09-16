// 기사 계정 전체 비밀번호 초기화 — 출시 준비
// 2026-05-25
//
// 사장님 spec:
//   - role='engineer' 사용자 전원
//   - password_hash = bcrypt(phone 뒤 4자리)   ← pgcrypto crypt() + bf salt
//   - must_change_password = true
//   - 백업: backups/engineer-pw-reset-before-{ts}.json (스냅샷)
//   - 적용: 사장님이 Supabase SQL Editor 측 직접 실행 (JS 측 UPDATE 호출 X)
//     · 이유: bcryptjs ≠ pgcrypto bcrypt 100% 호환 보장 X → 시드 흐름과 통일
//
// 모드:
//   node scripts/reset-engineer-pw-v2.cjs            # dry-run (기본, 인원/목록만 표시)
//   node scripts/reset-engineer-pw-v2.cjs --commit   # 백업 + 적용 SQL 파일 생성 (UPDATE는 사장님 SQL Editor)
//
// 안전:
//   - dry-run은 SELECT만. commit 모드도 JS에서는 UPDATE 호출 X (SQL 파일 생성만).
//   - backups/ 측 password_hash bcrypt 보존 (롤백용). .gitignore 측 적용 필수.

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

function phoneLast4(phone) {
  const digits = String(phone || "").replace(/[^0-9]/g, "");
  return digits.slice(-4);
}
function maskPhone(phone) {
  const d = String(phone || "").replace(/[^0-9]/g, "");
  if (d.length < 4) return phone || "";
  return `${d.slice(0, -4).replace(/./g, "*")}${d.slice(-4)}`;
}

(async () => {
  console.log("=".repeat(82));
  console.log(`기사 계정 비밀번호 초기화 — ${COMMIT ? "✅ COMMIT (백업 + SQL 파일 생성)" : "🔍 DRY-RUN"}`);
  console.log("=".repeat(82));

  // 1) role='engineer' user_id 집합 (user_roles)
  const { data: roles, error: rErr } = await sb
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["engineer", "기사"]);
  if (rErr) { console.error("user_roles 조회 실패:", rErr.message); process.exit(1); }
  const engineerIds = new Set((roles || []).map(r => r.user_id));

  // 2) users — engineer 매칭 (role 매핑 또는 code 'E' prefix 안전망)
  const { data: users, error: uErr } = await sb
    .from("users")
    .select("id, code, name, phone, password_hash, must_change_password, is_active")
    .eq("tenant_id", TENANT_ID)
    .order("code", { ascending: true });
  if (uErr) { console.error("users 조회 실패:", uErr.message); process.exit(1); }

  const engineers = (users || []).filter(u => engineerIds.has(u.id) || (u.code && /^E/i.test(u.code)));
  console.log(`\n대상 engineer: ${engineers.length}명 (role 매핑 ${engineerIds.size}명 + 'E' prefix 안전망 포함)\n`);

  // 3) 목록 출력 + 분류
  const plans = [];
  let warnNoPhone = 0, warnShortDigits = 0, warnInactive = 0;
  console.log(
    `${"code".padEnd(14)}${"name".padEnd(10)}${"phone".padEnd(17)}${"뒤4".padEnd(6)}${"active".padEnd(8)}${"must_chg".padEnd(10)}예정`
  );
  console.log("-".repeat(98));
  for (const u of engineers) {
    const last4 = phoneLast4(u.phone);
    if (!u.phone) warnNoPhone++;
    if (last4.length < 4) warnShortDigits++;
    if (u.is_active === false) warnInactive++;
    const willChange = (last4.length === 4);
    const planMsg = willChange
      ? "→ password_hash 재생성, must_change_password=true"
      : "⚠️ phone 뒤 4자리 추출 실패 — SKIP";
    console.log(
      (u.code || "").padEnd(14) +
      (u.name || "").padEnd(10) +
      maskPhone(u.phone).padEnd(17) +
      `"${last4}"`.padEnd(6) +
      String(u.is_active !== false).padEnd(8) +
      String(u.must_change_password).padEnd(10) +
      planMsg
    );
    plans.push({
      id: u.id, code: u.code, name: u.name,
      phone_last4: last4,
      is_active: u.is_active,
      current_must_change: u.must_change_password,
      current_hash_set: !!u.password_hash,
      will_change: willChange,
    });
  }

  const valid = plans.filter(p => p.will_change);
  console.log(`\n변경 예정      : ${valid.length}명`);
  console.log(`phone 없음     : ${warnNoPhone}명`);
  console.log(`뒤 4자리 부족  : ${warnShortDigits}명`);
  console.log(`비활성(is_active=false) 포함: ${warnInactive}명`);

  // ============ DRY-RUN — 여기서 종료 ============
  if (!COMMIT) {
    // 결과 JSON (전화번호 평문 X — phone_last4만 보존)
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const reportFile = path.join(__dirname, `reset-engineer-pw-v2-dryrun-${ts}.json`);
    fs.writeFileSync(reportFile, JSON.stringify({
      mode: "dry-run",
      generatedAt: new Date().toISOString(),
      readOnly: true,
      targetCount: engineers.length,
      willChangeCount: valid.length,
      warnings: { noPhone: warnNoPhone, shortDigits: warnShortDigits, inactive: warnInactive },
      plans,
    }, null, 2), "utf8");
    console.log(`\n📄 결과 JSON   : ${reportFile}`);
    console.log(`\n${"=".repeat(82)}`);
    console.log("🔍 DRY-RUN 완료 — DB 쓰기 0건.");
    console.log("적용 명령: node scripts/reset-engineer-pw-v2.cjs --commit");
    console.log("=".repeat(82));
    return;
  }

  // ============ COMMIT — 백업 + SQL 파일 생성 ============
  const backupsDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  // 백업 — 변경 전 password_hash + must_change_password 보존 (롤백용)
  const backupFile = path.join(backupsDir, `engineer-pw-reset-before-${ts}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({
    type: "engineer-pw-reset-before",
    ts: new Date().toISOString(),
    note: "변경 전 password_hash + must_change_password 보존 — 롤백 시 복구용. ★ git commit 금지 (backups/ .gitignore 처리 필요) ★",
    tenant_id: TENANT_ID,
    count: engineers.length,
    engineers: engineers.map(u => ({
      id: u.id,
      code: u.code,
      name: u.name,
      phone: u.phone,
      previous_password_hash: u.password_hash,
      previous_must_change_password: u.must_change_password,
      is_active: u.is_active,
    })),
  }, null, 2), "utf8");
  console.log(`\n📦 백업 저장   : ${backupFile}`);
  console.log(`     · ${engineers.length}명 변경 전 상태 보존 — ★ git commit 금지 ★`);

  // SQL 파일 (사장님이 Supabase SQL Editor 측 실행)
  const sqlFile = path.join(backupsDir, `engineer-pw-reset-apply-${ts}.sql`);
  const ids = valid.map(p => `'${p.id}'`).join(",\n    ");
  const sqlContent = `-- =============================================================================
-- 기사 ${valid.length}명 비밀번호 초기화 — phone 뒤 4자리로 reset
-- 생성: ${new Date().toISOString()}
-- 실행: Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
-- 의존: Migration 007 (pgcrypto extension — extensions.crypt / gen_salt)
-- 안전: BEGIN/COMMIT — 부분 실패 시 자동 ROLLBACK
-- 롤백: backups/engineer-pw-reset-before-${ts}.json — ${engineers.length}명 previous_password_hash 보존
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

-- 검증 — must_change_password=true + password_hash 존재 (예상: ${valid.length})
SELECT
  COUNT(*) FILTER (WHERE must_change_password = true)            AS must_change_count,
  COUNT(*) FILTER (WHERE password_hash IS NOT NULL)              AS has_hash_count
FROM users
WHERE tenant_id = '${TENANT_ID}'
  AND id IN (
    ${ids}
  );

COMMIT;

-- =============================================================================
-- 실행 후 상세 검증 (선택):
--   SELECT code, name, must_change_password,
--          (password_hash IS NOT NULL) AS has_hash
--   FROM users
--   WHERE tenant_id = '${TENANT_ID}'
--     AND id IN ( ${ids.replace(/\n {4}/g, " ")} )
--   ORDER BY code;
-- =============================================================================
`;
  fs.writeFileSync(sqlFile, sqlContent, "utf8");
  console.log(`📄 SQL 파일    : ${sqlFile}`);
  console.log(`     · 사장님이 Supabase 콘솔 SQL Editor 측 통째 붙여넣기 → Run`);
  console.log(`\n${"=".repeat(82)}`);
  console.log("✅ 산출물 생성 완료 — 실제 UPDATE는 사장님이 SQL Editor 측 실행.");
  console.log("=".repeat(82));
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

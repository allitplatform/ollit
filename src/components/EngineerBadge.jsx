// Step 8+9 V6 — 기사 표시 통일 컴포넌트 (CSS 변수 + role 자동 추출)
// 점(직급 색깔) + 이름 + 메인/서브 작은 회색 배지

const LEVEL_COLOR_VARS = {
  rookie: "var(--engineer-rookie)",
  career: "var(--engineer-career)",
  expert: "var(--engineer-expert)",
};

// 헬퍼: engineer 객체에서 role 자동 추출
// 우선순위: 명시 role > workType별 (cleaning/refrigerant) > workTypes.X.role > legacy cleaningRole/refrigerantRole > level
function inferRole(engineer, contextWorkType) {
  if (!engineer) return null;

  // 1. 명시 role 값 (eng._role / eng.role)
  if (engineer._role) return normalizeRole(engineer._role);
  if (engineer.role)  return normalizeRole(engineer.role);

  // 2. workType 컨텍스트 값
  if (contextWorkType === "cleaning") {
    const r = engineer.workTypes?.cleaning?.role || engineer.cleaningRole;
    if (r && r !== "none") return normalizeRole(r);
  }
  if (contextWorkType === "refrigerant") {
    const r = engineer.workTypes?.refrigerant?.role || engineer.refrigerantRole;
    if (r && r !== "none") return normalizeRole(r);
  }

  // 3. fallback — workTypes 값 우선순위 (cleaning > refrigerant)
  const cleaning = engineer.workTypes?.cleaning?.role || engineer.cleaningRole;
  const refrigerant = engineer.workTypes?.refrigerant?.role || engineer.refrigerantRole;
  if (cleaning && cleaning !== "none") return normalizeRole(cleaning);
  if (refrigerant && refrigerant !== "none") return normalizeRole(refrigerant);

  // 4. ENGINEERS_DATA legacy — eng.level 사용
  if (engineer.level === "main") return "main";
  if (engineer.level === "backup" || engineer.level === "sub") return "backup";

  return null;
}

function normalizeRole(role) {
  if (role === "main") return "main";
  if (role === "backup" || role === "sub") return "backup";
  return null;
}

export function EngineerBadge({
  engineer,
  role,                  // undefined = 자동 추출 / null = 강제 표시 X / "main"|"backup" = 명시
  workType,              // 'cleaning' | 'refrigerant' (자동 추출 시 컨텍스트)
  size = "md",
  showRoleBadge = true,
  showRookieLabel = false,
}) {
  if (!engineer) return null;
  const careerLevel = engineer.careerLevel || "career";
  const levelColor = LEVEL_COLOR_VARS[careerLevel] || "var(--engineer-rookie)";

  // role 결정: props 명시 > 자동 추출
  const finalRole = role !== undefined ? role : inferRole(engineer, workType);

  const dotSize  = size === "sm" ? 6  : size === "lg" ? 10 : 8;
  const fontSize = size === "sm" ? 11 : size === "lg" ? 14 : 13;
  const isMain   = finalRole === "main";
  const isBackup = finalRole === "backup";

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {/* AdminApp-fix1 — 이름 앞 점 제거 (사장님 catch 6 결정) */}
      <span style={{
        fontSize,
        color: "var(--text-primary)",
        fontWeight: isMain ? 600 : 500,
      }}>
        {engineer.name}
      </span>
      {showRoleBadge && isMain && (
        <span style={badgeStyle}>메인</span>
      )}
      {showRoleBadge && isBackup && (
        <span style={badgeStyle}>서브</span>
      )}
      {/* 신입 표시 — role 없을 때만 (role 박힌 카드는 신입 표시 X / 정보 중복) */}
      {showRookieLabel && !finalRole && careerLevel === "rookie" && (
        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>(신입)</span>
      )}
    </div>
  );
}

const badgeStyle = {
  background: "var(--bg-tertiary)",
  color: "var(--text-secondary)",
  fontSize: 9,
  padding: "1px 5px",
  borderRadius: 3,
  fontWeight: 500,
};

export default EngineerBadge;

// Step 8+9 V3 — 권한 / 데이터 격리
// 메뉴 권한은 users.js의 PERMISSIONS, 필드 권한은 여기서 정의
// V11-1 — 유솔 N 메뉴/필드 권한 추가

// 필드 단위 권한
export const FIELD_PERMISSIONS = {
  // 작업 정보
  "task.customer_phone_full": ["owner", "admin", "happycall", "engineer"],
  "task.customer_phone_mask": ["principal"],

  // 금액 정보
  "task.total_amount":        ["owner", "admin", "happycall", "engineer", "principal"],
  "task.engineer_rate":       ["owner", "admin", "engineer"],     // 자기 단가만 (engineer)
  "task.principal_fee":       ["owner", "admin", "principal"],    // 자기 원청만 (principal)
  "task.company_margin":      ["owner", "admin"],                 // 회사 내부만
  "task.fake_engineer_rate":  ["owner"],                          // 운영자만 (쿨가이 비밀)

  // 다른 사람 정보
  "task.other_engineers":     ["owner", "admin", "happycall"],
  "task.other_principals":    ["owner", "admin", "happycall"],

  // 액션
  "task.upload_naver":        ["owner", "admin"],

  // V11-1 — 유솔 N 정산 필드
  "task.netAmount":           ["owner", "admin", "happycall", "engineer"],
  "task.companyReceive":      ["owner", "admin"],            // 회사 받을 돈
  "task.companyMargin":       ["owner"],                     // 회사 마진 (운영자만)
  "task.naverSettledAt":      ["owner", "admin", "engineer"],
  "task.companyReceivedAt":   ["owner", "admin"],
  "task.engineerSettledAt":   ["owner", "admin", "engineer"],
};

// V11-1 — 메뉴 권한 (users.js PERMISSIONS와 별도 — 유솔 N 전용 키 namespace)
// 기존 PERMISSIONS (menu.dashboard 등)는 유지. 유솔 N 메뉴는 콜론 형태로 분리.
export const MENU_PERMISSIONS = {
  "menu:usol_n":                     ["owner", "admin"],
  "menu:usol_n_orders":              ["owner", "admin", "happycall"],
  "menu:usol_n_in_progress":         ["owner", "admin", "happycall"],
  "menu:usol_n_csv_match":           ["owner", "admin"],
  "menu:usol_n_tracking":            ["owner", "admin"],
  "menu:usol_n_engineer_settlement": ["owner", "admin"],
};

// 메뉴 권한 체크 (V11-1)
export function canAccessMenu(user, menuKey) {
  if (!user) return false;
  const allowed = MENU_PERMISSIONS[menuKey] || [];
  return allowed.includes(user.role);
}

// 작업 목록 필터링 (역할별)
export function filterTasksForUser(tasks, user) {
  if (!user) return [];
  if (["owner", "admin", "happycall"].includes(user.role)) {
    return tasks;
  }
  if (user.role === "engineer") {
    return tasks.filter(t =>
      t.engineerId === user.engineerId
      || t.engineer === user.name
    );
  }
  if (user.role === "principal") {
    // task.principal (이름) 또는 task.principalId 매칭
    return tasks.filter(t =>
      t.principalId === user.principalId
      || (user.principalId === "aircon_pro" && t.principal === "에어컨프로")
      || (user.principalId === "allday" && t.principal === "올데이케어")
      || (user.principalId === "yongin" && (t.principal === "용인" || t.principal === "용인컴퍼니"))
      || (user.principalId === "usol_h" && t.principal === "유솔홈케어 H")
      || (user.principalId === "usol_n" && t.principal === "유솔홈케어 N")
      || (user.principalId === "crikrin" && t.principal === "크리크린")
    );
  }
  return [];
}

// 필드 표시 여부
export function canSeeField(user, fieldKey) {
  if (!user) return false;
  const allowed = FIELD_PERMISSIONS[fieldKey] || [];
  return allowed.includes(user.role);
}

// 마스킹 헬퍼
export function maskPhone(phone) {
  if (!phone) return "";
  // 010-1234-5678 → 010-****-5678
  return String(phone).replace(/(\d{2,3})-?(\d{3,4})-?(\d{4})/, "$1-****-$3");
}

// Step 11 — 필드 단위 편집 권한
// 보기 권한과 별개 (FIELD_PERMISSIONS는 보기, 여기는 편집)
export const FIELD_EDIT_PERMISSIONS = {
  // 고객 정보
  "customerName":    ["owner", "admin", "happycall"],
  "customerPhone":   ["owner", "admin", "happycall"],
  "address":         ["owner", "admin", "happycall"],

  // 작업 내용
  "appliances":      ["owner", "admin", "happycall"],
  "workItems":       ["owner", "admin", "happycall"],
  "workType":        ["owner", "admin"],

  // 일정
  "scheduledAt":     ["owner", "admin", "happycall"],
  "schedule":        ["owner", "admin", "happycall"],
  "time":            ["owner", "admin", "happycall"],

  // 금액 — 권한 강함
  "totalAmount":     ["owner", "admin"],
  "estimateTotal":   ["owner", "admin"],
  "extraFee":        ["owner", "admin"],
  "addonFee":        ["owner", "admin"],
  "engineerEarning": ["owner"],
  "companyMargin":   ["owner"],
  "principalFee":    ["owner", "admin"],

  // 배정
  "engineerId":      ["owner", "admin"],
  "engineer":        ["owner", "admin"],
  "principalId":     ["owner"],
  "principal":       ["owner"],

  // 비고
  "note":            ["owner", "admin", "happycall"],
  "memo":            ["owner", "admin", "happycall", "engineer"],
};

export function canEditField(user, fieldKey) {
  if (!user) return false;
  const allowed = FIELD_EDIT_PERMISSIONS[fieldKey] || [];
  return allowed.includes(user.role);
}

// 역할별 연락처 표시
export function getDisplayPhone(phone, user) {
  if (!user) return "";
  if (user.role === "principal") return maskPhone(phone);
  return phone || "";
}

// 금액 표시 (역할별)
export function getDisplayAmount(task, user) {
  if (!user || !task) return {};
  const result = {};

  if (canSeeField(user, "task.total_amount")) {
    result.total = task.totalAmount || task.estimateTotal || 0;
  }

  // 기사 단가
  if (canSeeField(user, "task.engineer_rate")) {
    if (user.role === "engineer") {
      // 자기 단가만 노출
      if (task.engineerId === user.engineerId || task.engineer === user.name) {
        result.engineerRate = task.engineerEarning || 0;
      }
    } else if (["owner", "admin"].includes(user.role)) {
      result.engineerRate = task.engineerEarning || 0;
    }
  }

  // 원청 수수료
  if (canSeeField(user, "task.principal_fee")) {
    if (user.role === "principal") {
      // 쿨가이형 — 가짜 단가만 노출
      if (user.principalId === "aircon_pro") {
        result.engineerRateFake = task.fakeEngineerRate || 0;
        // 진짜 단가 X
      }
      result.principalFee = task.principalFee || 0;
    } else if (["owner", "admin"].includes(user.role)) {
      result.principalFee = task.principalFee || 0;
    }
  }

  // 회사 마진
  if (canSeeField(user, "task.company_margin")) {
    result.companyMargin = task.companyMargin || 0;
  }

  // 가짜 단가 (운영자만)
  if (canSeeField(user, "task.fake_engineer_rate")) {
    result.fakeEngineerRate = task.fakeEngineerRate || 0;
  }

  return result;
}

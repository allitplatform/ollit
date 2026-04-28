// 시뮬 계정 (5개)
// 4개 역할 + 1개 첫 로그인 (비밀번호 변경 시뮬)

export const REGISTERED_USERS = [
  {
    userId: "kim.donghyo",
    name: "김동효",
    role: "engineer",
    roleLabel: "기사님",
    roleIcon: "🔧",
    roleColor: "#10B981",
    phone: "010-1111-1111",
    password: "engineer1!",
    isFirstLogin: false,
  },
  {
    userId: "lee.jaehyun",
    name: "이재현",
    role: "engineer",
    roleLabel: "기사님",
    roleIcon: "🔧",
    roleColor: "#10B981",
    phone: "010-2222-2222",
    password: "temp1234",
    isFirstLogin: true,
  },
  {
    userId: "kim.jihye",
    name: "김지혜",
    role: "happycall",
    roleLabel: "해피콜 담당자",
    roleIcon: "📞",
    roleColor: "#7F77DD",
    phone: "010-3333-3333",
    password: "happycall1!",
    isFirstLogin: false,
  },
  {
    userId: "lee.ceo",
    name: "이대표",
    role: "admin",
    roleLabel: "대표님",
    roleIcon: "📊",
    roleColor: "#E91860",
    phone: "010-4444-4444",
    password: "admin1234!",
    isFirstLogin: false,
  },
  {
    userId: "kim.coolguy",
    name: "김쿨가이",
    role: "principal",
    roleLabel: "원청 대표님 (쿨가이)",
    roleIcon: "🏪",
    roleColor: "#FFB800",
    phone: "010-5555-5555",
    password: "cool1234!",
    isFirstLogin: false,
  },
];

// 역할별 기본 화면 정보
export const ROLE_INFO = {
  engineer: {
    label: "기사님",
    icon: "🔧",
    color: "#10B981",
    description: "현장 작업 수행",
  },
  happycall: {
    label: "해피콜 담당자",
    icon: "📞",
    color: "#7F77DD",
    description: "고객 응대 + 배정",
  },
  admin: {
    label: "대표님",
    icon: "📊",
    color: "#E91860",
    description: "운영 총괄",
  },
  principal: {
    label: "원청 대표님",
    icon: "🏪",
    color: "#FFB800",
    description: "원청 회사 대표",
  },
};

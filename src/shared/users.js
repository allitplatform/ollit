// 사용자 계정 — 시트 명단 36명 (Phase 2 / Supabase 시드 박은 영역)
// 한 사람 = 한 엔트리 (정규화). 조동욱 / 구현서 = admin + engineer 두 role 박혀있어 박힘.
// 로그인 = phone + password (Custom RPC `sign_in_with_phone` 박은 영역).
// 초기 비밀번호 = phone 끝 4자리 (`db/migrations/007_auth_setup.sql` 박은 영역 박은 영역 박은 영역).

export const REGISTERED_USERS = [
  // ===== admin 4명 =====
  {
    code: "A001", name: "조동욱", role: "admin", subRole: "engineer",
    engineerId: "E022", phone: "010-9447-1547",
    roleLabel: "사장님 / 기사님", roleIcon: "🔧", roleColor: "#E91860",
  },
  {
    code: "A002", name: "구현서", role: "admin", subRole: "engineer",
    engineerId: "E002", phone: "010-7372-3524",
    roleLabel: "사장님 / 기사님", roleIcon: "🔧", roleColor: "#E91860",
  },
  {
    code: "A003", name: "조동석", role: "admin",
    phone: "010-4785-6910",
    roleLabel: "사장님", roleIcon: "👔", roleColor: "#E91860",
  },
  {
    code: "A004", name: "최수연", role: "admin",
    phone: "010-4887-4002",
    roleLabel: "대표님", roleIcon: "👔", roleColor: "#E91860",
  },

  // ===== operator 2명 ("해피콜 담당자" / DB role='operator' / A 시리즈 동명이인 별도 인물) =====
  {
    code: "H001", name: "최수연", role: "operator",
    phone: "010-4937-2007",
    roleLabel: "해피콜 담당자", roleIcon: "📞", roleColor: "#7F77DD",
  },
  {
    code: "H002", name: "조동석", role: "operator",
    phone: "010-3626-4002",
    roleLabel: "해피콜 담당자", roleIcon: "📞", roleColor: "#7F77DD",
  },

  // ===== engineer 29명 =====
  { code: "E001", name: "강병익", role: "engineer", engineerId: "E001", phone: "010-9089-1726", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E002", name: "구현서", role: "engineer", engineerId: "E002", phone: "010-7372-3524", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E003", name: "권창용", role: "engineer", engineerId: "E003", phone: "010-7277-5157", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E004", name: "김경호", role: "engineer", engineerId: "E004", phone: "010-2414-5974", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E005", name: "김동효", role: "engineer", engineerId: "E005", phone: "010-9238-0412", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E006", name: "김병철", role: "engineer", engineerId: "E006", phone: "010-9836-9839", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E007", name: "김영수", role: "engineer", engineerId: "E007", phone: "010-2635-5772", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E008", name: "김윤섭", role: "engineer", engineerId: "E008", phone: "010-2063-4980", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E009", name: "김재현", role: "engineer", engineerId: "E009", phone: "010-2983-8814", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E010", name: "김태승", role: "engineer", engineerId: "E010", phone: "010-8683-9711", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E011", name: "김현동", role: "engineer", engineerId: "E011", phone: "010-5057-2312", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E012", name: "문성목", role: "engineer", engineerId: "E012", phone: "010-9397-8940", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E013", name: "손동식", role: "engineer", engineerId: "E013", phone: "010-9213-7040", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E014", name: "안승웅", role: "engineer", engineerId: "E014", phone: "010-5399-3651", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E015", name: "양승문", role: "engineer", engineerId: "E015", phone: "010-4686-0294", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E016", name: "류근학", role: "engineer", engineerId: "E016", phone: "010-4233-8586", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E017", name: "이상준", role: "engineer", engineerId: "E017", phone: "010-2909-5934", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E018", name: "임종일", role: "engineer", engineerId: "E018", phone: "010-3035-3766", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E019", name: "전현진", role: "engineer", engineerId: "E019", phone: "010-7764-4402", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E020", name: "정상현", role: "engineer", engineerId: "E020", phone: "010-2273-0976", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E021", name: "정훈",   role: "engineer", engineerId: "E021", phone: "010-2143-9620", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E022", name: "조동욱", role: "engineer", engineerId: "E022", phone: "010-9447-1547", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E023", name: "이세환", role: "engineer", engineerId: "E023", phone: "010-3077-2388", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E024", name: "신경일", role: "engineer", engineerId: "E024", phone: "010-7144-4291", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E025", name: "김만수", role: "engineer", engineerId: "E025", phone: "010-2194-7634", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E026", name: "김근욱", role: "engineer", engineerId: "E026", phone: "010-4212-6826", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E027", name: "안민철", role: "engineer", engineerId: "E027", phone: "010-3226-7704", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E028", name: "변기현", role: "engineer", engineerId: "E028", phone: "010-6351-8818", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },
  { code: "E029", name: "신은용", role: "engineer", engineerId: "E029", phone: "010-8879-8596", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981" },

  // ===== partner 3명 (원청 사장님) =====
  {
    code: "P001", name: "에어컨프로 사장님", role: "principal",
    clientName: "에어컨프로", phone: "010-2017-4415",
    roleLabel: "원청 사장님 (에어컨프로)", roleIcon: "🏪", roleColor: "#FFB800",
  },
  {
    code: "P002", name: "크리크린 사장님", role: "principal",
    clientName: "크리크린", phone: "010-8430-2620",
    roleLabel: "원청 사장님 (크리크린)", roleIcon: "🏪", roleColor: "#FFB800",
  },
  {
    code: "P003", name: "유솔홈케어 사장님", role: "principal",
    clientName: "유솔홈케어", phone: "010-9892-1980",
    roleLabel: "원청 사장님 (유솔홈케어)", roleIcon: "🏪", roleColor: "#FFB800",
  },
];

export const ROLE_INFO = {
  engineer:  { label: "기사님",         icon: "🔧", color: "#10B981", description: "현장 작업 수행" },
  operator:  { label: "해피콜 담당자",  icon: "📞", color: "#7F77DD", description: "고객 응대 + 배정" },
  admin:     { label: "사장님",         icon: "👔", color: "#E91860", description: "운영 총괄" },
  principal: { label: "원청 사장님",    icon: "🏪", color: "#FFB800", description: "원청 회사 대표" },
};

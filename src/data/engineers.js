// Step 6 — 기사 마스터 데이터 + localStorage
// Phase 1: localStorage / Phase 2: Supabase 자동 마이그레이션
// 사장님 catch: 화면에서 직접 추가/삭제 / 코드 수정 0번

const STORAGE_KEY = "ollit_engineers_v1";

const SEED_ENGINEERS = [
  // 세척 메인 10명
  {
    id: "yang_seungmoon", name: "양승문", phone: "010-3749-0294",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["고양시","은평구","서대문구"], appliances: [] },
      refrigerant: { role: "main", zones: ["은평구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "kim_yunseop", name: "김윤섭", phone: "010-2063-4980",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["마포구","용산구","중구"], appliances: [] },
      refrigerant: { role: "main", zones: ["용산구","중구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "jung_sanghyun", name: "정상현", phone: "010-2273-0976",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["종로구","성북구","동대문구"], appliances: [] },
      refrigerant: { role: "main", zones: ["강북구","도봉구","노원구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "an_seungwoong", name: "안승웅", phone: "010-5399-3651",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["성동구","광진구","중랑구"], appliances: [] },
      refrigerant: { role: "main", zones: ["성동구","광진구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "kim_youngsoo", name: "김영수", phone: "010-2635-5772",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["의정부","구리","남양주","양주"], appliances: [] },
      refrigerant: { role: "main", zones: ["동대문구","중랑구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "kim_hyundong", name: "김현동", phone: "",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["강북구","도봉구","노원구"], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "lim_jongil", name: "임종일", phone: "",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["동작구","관악구","시흥시"], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "ryu_geunhak", name: "류근학", phone: "",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["서초구","강남구","용인","하남"], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "jung_hoon", name: "정훈", phone: "010-2143-9620",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["송파구","강동구","용인","하남"], appliances: [] },
      refrigerant: { role: "main", zones: ["서초구","강남구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "jeon_hyunjin", name: "전현진", phone: "010-7764-4402",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["양천구","구로구","금천구","강서구"], appliances: [] },
      refrigerant: { role: "main", zones: ["강서구","양천구","구로구"], appliances: [] },
    },
    note: "",
  },

  // 벽걸이 전문가 2명
  {
    id: "kwon_changyong", name: "권창용", phone: "",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: [], appliances: ["벽걸이"] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "벽걸이 전문",
  },
  {
    id: "lee_sangjun", name: "이상준", phone: "010-4729-8079",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: [], appliances: ["벽걸이"] },
      refrigerant: { role: "main", zones: ["종로구","성북구"], appliances: [] },
    },
    note: "",
  },

  // 세척 백업 + 냉매 메인 6명
  {
    id: "kim_jaehyun", name: "김재현", phone: "",
    careerLevel: "rookie", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: [], appliances: ["벽걸이"] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "신입 / 벽걸이 가능",
  },
  {
    id: "kim_taeseung", name: "김태승", phone: "010-8185-9700",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: ["서대문구","중구"], appliances: [] },
      refrigerant: { role: "main", zones: ["마포구","서대문구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "moon_seongmok", name: "문성목", phone: "",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: ["성동구","광진구","중랑구"], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "son_dongsik", name: "손동식", phone: "",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: ["고양시","은평구"], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "kim_byeongchul", name: "김병철", phone: "",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: ["남양주","구리","의정부"], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "kim_donghyo", name: "김동효", phone: "010-9238-0412",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: ["관악구","동작구","시흥시","금천구","강서구"], appliances: [] },
      refrigerant: { role: "main", zones: ["송파구","강동구"], appliances: [] },
    },
    note: "",
  },

  // 냉매 전용 2명
  {
    id: "byun_kihyun", name: "변기현", phone: "010-6351-8818",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "main", zones: ["금천구","관악구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "kang_byeongik", name: "강병익", phone: "010-9089-1726",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "main", zones: ["동작구","영등포구"], appliances: [] },
    },
    note: "",
  },
];

export const CAREER_LEVELS = {
  rookie: { name: "신입",   color: "#888780" },
  career: { name: "경력",   color: "#00875A" },
  expert: { name: "전문가", color: "#D45A8C" },
};

export const STATUS_OPTIONS = {
  active: { name: "활동중", color: "#00875A" },
  off:    { name: "휴직",   color: "#888780" },
  quit:   { name: "퇴사",   color: "#555" },
};

export const ROLE_OPTIONS = {
  main:   "메인",
  backup: "백업",
  none:   "안 함",
};

export const APPLIANCE_OPTIONS = ["벽걸이", "스탠드", "천장형", "원웨이"];

export const SEOUL_DISTRICTS = [
  "강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구",
  "노원구","도봉구","동대문구","동작구","마포구","서대문구","서초구","성동구",
  "성북구","송파구","양천구","영등포구","용산구","은평구","종로구","중구","중랑구",
];

export const GG_INCHEON = [
  "고양시","구리","남양주","의정부","양주","용인","하남","시흥시",
];

export const ALL_REGIONS = [...SEOUL_DISTRICTS, ...GG_INCHEON];

export function loadEngineers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error(e); }
  // 첫 실행 — 시드 박기
  saveEngineers(SEED_ENGINEERS);
  return SEED_ENGINEERS;
}

export function saveEngineers(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) { console.error(e); return false; }
}

export function generateId(name) {
  const ts = Date.now().toString(36);
  const safe = (name || "engineer").replace(/\s+/g, "_").toLowerCase().slice(0, 12);
  return `${safe}_${ts}`;
}

// 신규 추가용 빈 객체
export function createEmptyEngineer() {
  return {
    id: "",
    name: "",
    phone: "",
    careerLevel: "rookie",
    status: "active",
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  };
}

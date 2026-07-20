// Step 6 — 기사 마스터 데이터 + localStorage
// Phase 1: localStorage / Phase 2: Supabase 자동 마이그레이션
// 사장님 catch: 화면에서 직접 추가/삭제 / 코드 수정 0번
// Step 5-2 — 시트 설정_기사 양방향 sync (saveEngineerWithSync / deleteEngineerWithSync)

// Phase 3-6 — 기사 마스터 시트 호출 폐기. DB 직접 사용 (src/lib/engineersDb.js).
// 함수명 / 시그니처 유지 — 10곳 호출처 동기 read 패턴 그대로.
// Phase 3-8 (2026-05-13) — 기사 단가 시트 호출 폐기. DB 직접 사용 (src/lib/engineerRatesDb.js).
// Phase 3-9 (2026-05-13) — 기사 역량 시트 호출 폐기.
//   epp (engineer_principal_permissions) + ez (engineer_zones) 직접 사용 (src/lib/engineerSkillsDb.js).
import {
  upsertEngineerToDb,
  deleteEngineerFromDb,
} from "../lib/engineersDb.js";
import {
  upsertEngineerRateToDb,
  deleteEngineerRateFromDb,
} from "../lib/engineerRatesDb.js";
import {
  upsertEngineerSkillToDb,
  deleteEngineerSkillFromDb,
} from "../lib/engineerSkillsDb.js";

const STORAGE_KEY = "ollit_engineers_v1";

// 2026-05-12 — 대표님 시트 측 실제 명단 29명(E001~E029) 반영.
// 옛 이름-매칭으로 workTypes/careerLevel 보존, 신규 8명(E002/E004/E022/E023/E024/E025/E026/E027/E029)은 기본값.
const SEED_ENGINEERS = [
  {
    id: "E001", name: "강병익", phone: "010-9089-1726",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "main", zones: ["동작구","영등포구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "E002", name: "구현서", phone: "010-7372-3524",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "E003", name: "권창용", phone: "010-7277-5157",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: [], appliances: ["벽걸이"] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "벽걸이 전문",
  },
  {
    id: "E004", name: "김경호", phone: "010-2414-5974",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "E005", name: "김동효", phone: "010-9238-0412",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: ["관악구","동작구","시흥시","금천구","강서구"], appliances: [] },
      refrigerant: { role: "main", zones: ["송파구","강동구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "E006", name: "김병철", phone: "010-9836-9839",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: ["남양주","구리","의정부"], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "E007", name: "김영수", phone: "010-2635-5772",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["의정부","구리","남양주","양주"], appliances: [] },
      refrigerant: { role: "main", zones: ["동대문구","중랑구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "E008", name: "김윤섭", phone: "010-2063-4980",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["마포구","용산구","중구"], appliances: [] },
      refrigerant: { role: "main", zones: ["용산구","중구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "E009", name: "김재현", phone: "010-2983-8814",
    careerLevel: "rookie", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: [], appliances: ["벽걸이"] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "신입 / 벽걸이 가능",
  },
  {
    id: "E010", name: "김태승", phone: "010-8683-9711",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: ["서대문구","중구"], appliances: [] },
      refrigerant: { role: "main", zones: ["마포구","서대문구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "E011", name: "김현동", phone: "010-5057-2312",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["강북구","도봉구","노원구"], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "E012", name: "문성목", phone: "010-9397-8940",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: ["성동구","광진구","중랑구"], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "E013", name: "손동식", phone: "010-9213-7040",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: ["고양시","은평구"], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "E014", name: "안승웅", phone: "010-5399-3651",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["성동구","광진구","중랑구"], appliances: [] },
      refrigerant: { role: "main", zones: ["성동구","광진구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "E015", name: "양승문", phone: "010-4686-0294",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["고양시","은평구","서대문구"], appliances: [] },
      refrigerant: { role: "main", zones: ["은평구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "E016", name: "류근학", phone: "010-4233-8586",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["서초구","강남구","용인","하남"], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "E017", name: "이상준", phone: "010-2909-5934",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "backup", zones: [], appliances: ["벽걸이"] },
      refrigerant: { role: "main", zones: ["종로구","성북구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "E018", name: "임종일", phone: "010-3035-3766",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["동작구","관악구","시흥시"], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "E019", name: "전현진", phone: "010-7764-4402",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["양천구","구로구","금천구","강서구"], appliances: [] },
      refrigerant: { role: "main", zones: ["강서구","양천구","구로구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "E020", name: "정상현", phone: "010-2273-0976",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["종로구","성북구","동대문구"], appliances: [] },
      refrigerant: { role: "main", zones: ["강북구","도봉구","노원구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "E021", name: "정훈", phone: "010-2143-9620",
    careerLevel: "expert", status: "active",
    workTypes: {
      cleaning:    { role: "main", zones: ["송파구","강동구","용인","하남"], appliances: [] },
      refrigerant: { role: "main", zones: ["서초구","강남구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "E022", name: "조동욱", phone: "010-9447-1547",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "E023", name: "이세환", phone: "010-3077-2388",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "E024", name: "신경일", phone: "010-7144-4291",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "E025", name: "김만수", phone: "010-2194-7634",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "E026", name: "김근욱", phone: "010-4212-6826",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "E027", name: "안민철", phone: "010-3226-7704",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
  },
  {
    id: "E028", name: "변기현", phone: "010-6351-8818",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "main", zones: ["금천구","관악구"], appliances: [] },
    },
    note: "",
  },
  {
    id: "E029", name: "신은용", phone: "010-8879-8596",
    careerLevel: "career", status: "active",
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
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

// 2026-07-14 — 사장님 spec: 경기 확장 + 인천 구 단위 (실제 tasks.district 상위 지역 기준).
//   칩 이름은 canonical(시 접미사) — "남양주시"/"남양주" 같은 표기 흔들림은
//   normalizeZoneName 매칭으로 흡수 (아래).
export const GYEONGGI = [
  "고양시","덕양구","일산동구","일산서구","파주시","김포시","부천시","시흥시",
  "광명시","안양시","군포시","의왕시","과천시","안산시","수원시","화성시",
  "성남시","분당구","수정구","중원구","용인시",
  "하남시","남양주시","구리시","의정부시","양주시","동두천시","이천시","평택시","천안시",
];
export const INCHEON = [
  "계양구","부평구","서구","남동구","연수구","미추홀구",
];
// 하위호환 — 옛 import 지점용 (경기+인천 합본)
export const GG_INCHEON = [...GYEONGGI, ...INCHEON];

export const ALL_REGIONS = [...SEOUL_DISTRICTS, ...GG_INCHEON];

// 2026-07-14 — 지역명 표기 흔들림 흡수: 끝의 "시" 제거 ("남양주시"→"남양주").
//   실제 데이터에 "남양주시" 15건 + "남양주" 13건처럼 두 표기가 섞여 있어
//   정확일치 매칭이 반쪽만 작동하던 문제. 구/군 이름은 그대로 둠.
export function normalizeZoneName(z) {
  const s = String(z || "").trim();
  if (s.length >= 3 && s.endsWith("시")) return s.slice(0, -1);
  return s;
}

// 2026-07-20 — 시 ↔ 소속 구 커버 매칭 (사장님 spec: 분당·과천 추가하면서).
//   "성남시"로 등록한 기사는 분당구/수정구/중원구 접수에 떠야 하고,
//   "덕양구" 기사는 구가 안 잡혀 "고양시"로 저장된 접수에도 떠야 함 (양방향).
//   ※ 서울 구는 시 소속 세분화 없음 — 여기엔 다구(多區) 경기 시만 등록.
const CITY_DISTRICTS = {
  "고양시": ["덕양구", "일산동구", "일산서구"],
  "성남시": ["분당구", "수정구", "중원구"],
};

// zone(기사 등록 지역)이 region(작업지)을 커버하는가 — 정확일치 + 시↔구.
export function zoneCoversRegion(zone, region) {
  const nz = normalizeZoneName(zone);
  const nr = normalizeZoneName(region);
  if (!nz || !nr) return false;
  if (nz === nr) return true;
  for (const [city, gus] of Object.entries(CITY_DISTRICTS)) {
    const nc = normalizeZoneName(city);
    if (nz === nc && gus.some(g => normalizeZoneName(g) === nr)) return true;  // 시 기사 → 구 작업
    if (nr === nc && gus.some(g => normalizeZoneName(g) === nz)) return true;  // 구 기사 → 시 작업
  }
  return false;
}

// Step 5-1 — 시트(설정_기사) 캐시 키 (feePolicy.js setEngineersCache와 동일)
const SHEET_CACHE_KEY = "ollit_engineers_cache_v1";

// 시트 fetch 결과 한 행을 옛 SEED 모델로 변환
// 시트 측 — engineerId / 기사ID / name / 이름 / phone / cm_refrigerant_rate 등
// SEED 측 — id / name / phone / careerLevel / status / workTypes / note
function adaptSheetEngineerToSeed(sheetEng) {
  if (!sheetEng) return null;
  const id    = sheetEng.engineerId || sheetEng.기사ID || sheetEng.id || "";
  const name  = sheetEng.name || sheetEng.이름 || "";
  const phone = sheetEng.phone || sheetEng.연락처 || sheetEng.전화 || "";
  if (!id && !name) return null;
  const rateRaw = sheetEng.cm_refrigerant_rate ?? sheetEng.cm_냉매비율 ?? sheetEng.refrigerant_rate;
  const rateNum = parseInt(rateRaw, 10);
  // Step 5-8 — 시트 H열 계좌번호 / I열 은행명 (다양한 키 호환)
  const accountNumber = String(sheetEng.accountNumber || sheetEng.계좌번호 || "").trim();
  const bankName      = String(sheetEng.bankName      || sheetEng.은행명   || "").trim();
  return {
    id: id || generateId(name),
    name,
    phone,
    careerLevel: "career",  // 사장님 결재 5 — 기본 career
    status:      "active",  // 사장님 결재 5 — 기본 active
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
    cm_refrigerant_rate: Number.isFinite(rateNum) && rateNum > 0 ? rateNum : 50,
    bankName,
    accountNumber,
    accountHolder: "",  // 시트 미보유 — 본인이 EngineerAccountEditScreen에서 박음 (옛 측 localStorage 보존)
    _fromSheet: true,
  };
}

function _loadSheetEngineersFromCache() {
  try {
    const raw = localStorage.getItem(SHEET_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { /* 캐시 read 실패 시 빈 배열 */ }
  return [];
}

// Step 5-1 — 옛 SEED + 시트 자동 병합 (E-3)
// 매칭: id 우선 / 이름 fallback (정확 매칭만)
// 옛 SEED 우선 (workTypes / careerLevel / status / note 보존)
// 시트 우선: cm_refrigerant_rate (Step 3 source of truth)
export function loadEngineers() {
  // 1) 옛 SEED localStorage (사장님이 화면에서 박은 + 옛 시드)
  let oldList = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) oldList = parsed;
    }
  } catch (e) { console.error(e); }
  if (oldList.length === 0) {
    saveEngineers(SEED_ENGINEERS);
    oldList = SEED_ENGINEERS;
  }

  // 2) 시트 캐시 (Step 3 setEngineersCache로 박힘)
  const sheetList = _loadSheetEngineersFromCache();
  if (sheetList.length === 0) {
    // 시트 데이터 없음 → 옛 측만 반환. Step 5-5-C Phase 1 — skills 빈 배열 첨부
    return oldList.map(o => ({ ...o, skills: getEngineerSkillsByEngineer(o.id) }));
  }

  // 3) 매칭 인덱스
  const oldById   = new Map();
  const oldByName = new Map();
  oldList.forEach(o => {
    if (o.id)   oldById.set(o.id, o);
    if (o.name) oldByName.set(o.name, o);
  });

  // 4) 시트 기반 병합 — 시트 29명을 기준으로 옛 SEED 정보 덮기
  const merged = [];
  const usedOldIds = new Set();
  for (const s of sheetList) {
    const adapted = adaptSheetEngineerToSeed(s);
    if (!adapted) continue;
    // 매칭: id 우선 / 이름 fallback (정확 매칭)
    const oldMatch = oldById.get(adapted.id) || oldByName.get(adapted.name);
    if (oldMatch) {
      // Step 5-2/5-4 hotfix — 시트 id 우선 (옛 SEED kang_byeongik → E001 등 통일)
      // task.assignedEngineerId는 이미 시트 id 형식 ("E001") 사용 중이라 호환성 영향 X.
      // 옛 SEED 정보 (workTypes / careerLevel / status / note / phone) 보존.
      merged.push({
        ...oldMatch,                  // 옛 SEED 정보 base (workTypes 등)
        ...adapted,                   // 시트 측 우선 (id / name / phone / 기본값)
        // 옛 SEED 풍부 정보 명시 보존 (어댑터 default를 옛 측이 덮음)
        careerLevel: oldMatch.careerLevel || adapted.careerLevel,
        status:      oldMatch.status      || adapted.status,
        workTypes:   oldMatch.workTypes   || adapted.workTypes,
        note:        oldMatch.note        || adapted.note,
        // 시트 측 우선 (저장 시 sync 일관성)
        id:          adapted.id,
        cm_refrigerant_rate: adapted.cm_refrigerant_rate,
        _oldId:      oldMatch.id,     // 디버깅용 (옛 측 id)
        _fromSheet:  false,
      });
      usedOldIds.add(oldMatch.id);
    } else {
      // 시트 신규 (옛 SEED에 없음) — 빈 workTypes
      merged.push(adapted);
    }
  }

  // 5) 옛 SEED에만 있는 항목 (시트에 없는 사람) — 보존
  for (const o of oldList) {
    if (!usedOldIds.has(o.id)) merged.push({ ...o, _onlyOld: true });
  }

  // 6) Step 5-5-C Phase 1 — engineer.skills 배열 첨부 (C-3 hybrid)
  // 시트 _기사역량 캐시 (Step 5-5-A setEngineerSkillsCache)에서 engineerId로 lookup.
  // 사용처 변경 X — 옛 workTypes/zones는 그대로 / skills는 별도 박음 (Phase 5에서 자동 배정에 사용 예정).
  return merged.map(eng => ({ ...eng, skills: getEngineerSkillsByEngineer(eng.id) }));
}

export function saveEngineers(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) { console.error(e); return false; }
}

// 2026-05-28 — 옛 시트 import 정규화 fallback 전용 (`${name}_${Date.now().toString(36)}`).
//   ⚠️ 신규 기사 등록 경로 사용 X — Supabase next_engineer_code() RPC 가 E0xx 자동 부여.
//   본 함수는 옛 시트 row 정규화 (data/engineers.js:342) 의 id 결손 케이스 호환만 유지.
//   호출 신규 추가 금지.
export function generateId(name) {
  const ts = Date.now().toString(36);
  const safe = (name || "engineer").replace(/\s+/g, "_").toLowerCase().slice(0, 12);
  return `${safe}_${ts}`;
}

// 신규 추가용 빈 객체
// Step 5-2 — email / cm_refrigerant_rate 신규 필드 (시트 설정_기사 sync)
export function createEmptyEngineer() {
  return {
    id: "",
    name: "",
    phone: "",
    email: "",
    careerLevel: "rookie",
    status: "active",
    cm_refrigerant_rate: 50,
    workTypes: {
      cleaning:    { role: "none", zones: [], appliances: [] },
      refrigerant: { role: "none", zones: [], appliances: [] },
    },
    note: "",
    // Step 5-8 — 계좌 필드 (시트 H/I 양방향 sync)
    bankName: "",
    accountNumber: "",
    accountHolder: "",
  };
}

// ============================================================
// Step 5-2 — 양방향 sync 헬퍼 (localStorage 즉시 + GAS 비동기)
// ============================================================
// 매핑: status="active" → 활성=true / status="off"|"quit" → 활성=false
// 시트 측 5칼럼 + cm_냉매비율만 sync. workTypes/careerLevel/note는 localStorage 전용 (Step 5-5에서)

// status → 시트 활성(boolean)
function statusToActive(status) {
  return status === "active";
}

// engineer 객체 → GAS 페이로드
// Step 5-8 — 계좌 필드 (bankName / accountNumber) 추가 sync
function _toSyncPayload(eng) {
  // 2026-05-31 — Bug 1 fix — cm_refrigerant_rate fallback 제거.
  //   옛: `|| 50` 측 falsy fallback → undefined/empty 측 50 강제 → engineersDb 측 도달해도 reset 위험.
  //   새: 값 그대로 pass-through → engineersDb 측 syncPayloadToRow 측 정확 validate + omit-on-undefined.
  return {
    engineerId: eng.id || "",
    name:       eng.name || "",
    phone:      eng.phone || "",
    email:      eng.email || "",
    active:     statusToActive(eng.status),
    cm_refrigerant_rate: eng.cm_refrigerant_rate,
    bankName:      eng.bankName      || "",
    accountNumber: eng.accountNumber || "",
    accountHolder: eng.accountHolder || "",
  };
}

// upsert: localStorage 즉시 + Supabase DB 비동기 sync
// Phase 3-6 — apiSaveEngineer (시트) → upsertEngineerToDb (DB). 시그니처 / 응답 형태 동일.
// 응답: { ok: true, action, engineerId } | { ok: false, error, localOk: true }
export async function saveEngineerWithSync(eng) {
  // 1) localStorage 즉시 (UI 응답성)
  const list = loadEngineers();
  const existing = list.find(e => e.id === eng.id);
  const next = existing
    ? list.map(e => e.id === eng.id ? eng : e)
    : [eng, ...list];
  saveEngineers(next);

  // 2) DB sync (비동기 / 실패 시 localStorage는 유지)
  try {
    const res = await upsertEngineerToDb(_toSyncPayload(eng));
    if (!res || res.ok === false) {
      throw new Error((res && res.error) || "DB sync 실패");
    }
    // DB가 새 engineerId 부여 시 (자동 생성) — localStorage 갱신
    if (res.engineerId && res.engineerId !== eng.id) {
      const updated = next.map(e => e.id === eng.id ? { ...e, id: res.engineerId } : e);
      saveEngineers(updated);
      return { ok: true, action: res.action, engineerId: res.engineerId };
    }
    return { ok: true, action: res.action || "update", engineerId: res.engineerId || eng.id };
  } catch (e) {
    return { ok: false, error: e.message || "네트워크 오류", localOk: true };
  }
}

// 삭제: localStorage 즉시 + DB sync
export async function deleteEngineerWithSync(engineerId) {
  if (!engineerId) return { ok: false, error: "engineerId 없음", localOk: false };
  const list = loadEngineers();
  saveEngineers(list.filter(e => e.id !== engineerId));
  try {
    const res = await deleteEngineerFromDb(engineerId);
    if (!res || res.ok === false) {
      throw new Error((res && res.error) || "DB sync 실패");
    }
    // 2026-07-20 — Mig 183: action 전달 ('deleted' | 'deactivated' 작업 이력 보존 비활성)
    return { ok: true, action: res.action || "deleted", reason: res.reason || "" };
  } catch (e) {
    return { ok: false, error: e.message || "네트워크 오류", localOk: true };
  }
}

// ============================================================
// Step 5-4 — 설정_기사단가 양방향 sync (P4 신규 모델)
// ============================================================
// 시트 5열: 기사ID / 작업유형 / 기종 / 단가 / 비고
// upsert 키 (3중): engineerId + workType + applianceType

const ENGINEER_RATES_CACHE_KEY = "ollit_engineer_rates_cache_v1";
const POLICIES_CACHE_KEY       = "ollit_policies_cache_v1"; // Step 5-3 fetchAllPolicies 결과

export function setEngineerRatesCache(list) {
  if (!Array.isArray(list)) return;
  try {
    localStorage.setItem(ENGINEER_RATES_CACHE_KEY, JSON.stringify(list));
  } catch (e) { /* */ }
}

export function getEngineerRatesCache() {
  try {
    const raw = localStorage.getItem(ENGINEER_RATES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { /* */ }
  return [];
}

// 시트 행 키 정규화 (다양한 키 호환)
function _matchEngineerRateRow(row, engineerId, workType, applianceType) {
  if (!row) return false;
  const rId  = String(row.engineerId    || row.기사ID || row.id    || "").trim();
  const rWT  = String(row.workType      || row.작업유형             || "").trim();
  const rApp = String(row.applianceType || row.appliance || row.기종 || "").trim();
  return rId === String(engineerId).trim()
      && rWT === String(workType).trim()
      && rApp === String(applianceType).trim();
}

function _extractRate(row) {
  const raw = row?.rate ?? row?.단가 ?? row?.unitPrice;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

// 시트 _수수료정책 캐시 (Step 5-3)에서 원청×기종 단가 lookup (2차 fallback)
function _findInPoliciesCache(principalId, principalName, workType, applianceType) {
  if (!workType || !applianceType) return null;
  try {
    const raw = localStorage.getItem(POLICIES_CACHE_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    const wt  = String(workType).trim();
    const app = String(applianceType).trim();
    const pid = principalId ? String(principalId).trim() : "";
    const pname = principalName ? String(principalName).trim() : "";
    const found = list.find(r => {
      const rPid   = String(r.principalId || r.원청ID || r.id || "").trim();
      const rPname = String(r.principal || r.원청 || r.원청명 || r.회사명 || "").trim();
      const rWT    = String(r.workType || r.작업유형 || "").trim();
      const rApp   = String(r.applianceType || r.appliance || r.기종 || "").trim();
      const principalMatch = (pid && rPid === pid) || (pname && rPname === pname);
      return principalMatch && rWT === wt && rApp === app;
    });
    if (!found) return null;
    const raw2 = found.rate ?? found.단가 ?? found.engineerRate ?? found.기사단가 ?? found.engineerUnitPrice;
    const n = parseInt(raw2, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  } catch (e) { return null; }
}

// 3-tier fallback 단가 lookup
// 1차: 시트 설정_기사단가 (engineerId + workType + applianceType 정확 매칭)
// 2차: 시트 _수수료정책 (principalId/Name + workType + applianceType)
// 3차: null 반환 — 호출처에서 standardRates fallback
export function getEngineerRateForTask({ engineerId, principalId, principalName, workType, applianceType } = {}) {
  if (!workType || !applianceType) return null;

  // 1차
  if (engineerId) {
    const cache = getEngineerRatesCache();
    const found = cache.find(r => _matchEngineerRateRow(r, engineerId, workType, applianceType));
    const rate = _extractRate(found);
    if (rate != null) return rate;
  }

  // 2차
  const fromPolicy = _findInPoliciesCache(principalId, principalName, workType, applianceType);
  if (fromPolicy != null) return fromPolicy;

  // 3차 — null (호출처에서 standardRates fallback)
  return null;
}

// ===== 단가 행 upsert / 삭제 (Step 5-2/5-3 패턴) =====

// 옛 측 localStorage (앞으로 사장님이 박은 데이터 보존용 / 시트 빈 상태 시작)
const ENGINEER_RATES_LOCAL_KEY = "ollit_engineer_rates_v1";

function _loadLocalEngineerRates() {
  try {
    const raw = localStorage.getItem(ENGINEER_RATES_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { /* */ }
  return [];
}

function _saveLocalEngineerRates(list) {
  try {
    localStorage.setItem(ENGINEER_RATES_LOCAL_KEY, JSON.stringify(list));
  } catch (e) { /* */ }
}

// upsert 키 비교 (옛 측 / 시트 측 동일 형식)
function _sameRateKey(a, b) {
  return String(a.engineerId).trim()    === String(b.engineerId).trim()
      && String(a.workType).trim()      === String(b.workType).trim()
      && String(a.applianceType).trim() === String(b.applianceType).trim();
}

export async function saveEngineerRateWithSync(payload) {
  if (!payload || !payload.engineerId || !payload.workType || !payload.applianceType) {
    return { ok: false, error: "필수 키 누락 (engineerId / workType / applianceType)", localOk: false };
  }
  // 1) 옛 측 localStorage 즉시
  const local = _loadLocalEngineerRates();
  const idx = local.findIndex(r => _sameRateKey(r, payload));
  if (idx >= 0) local[idx] = { ...local[idx], ...payload };
  else          local.push({ ...payload });
  _saveLocalEngineerRates(local);

  // 2) DB sync (Phase 3-8 — engineer_rates upsert)
  try {
    const res = await upsertEngineerRateToDb(payload);
    if (!res || res.ok === false) {
      throw new Error((res && res.error) || "DB sync 실패");
    }
    return { ok: true, action: res.action || "update" };
  } catch (e) {
    return { ok: false, error: e.message || "네트워크 오류", localOk: true };
  }
}

export async function deleteEngineerRateWithSync(payload) {
  if (!payload || !payload.engineerId || !payload.workType || !payload.applianceType) {
    return { ok: false, error: "필수 키 누락", localOk: false };
  }
  // 1) 옛 측
  const local = _loadLocalEngineerRates();
  const next = local.filter(r => !_sameRateKey(r, payload));
  _saveLocalEngineerRates(next);

  // 2) DB sync (Phase 3-8 — engineer_rates delete)
  try {
    const res = await deleteEngineerRateFromDb(payload);
    if (!res || res.ok === false) {
      throw new Error((res && res.error) || "DB sync 실패");
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || "네트워크 오류", localOk: true };
  }
}

// ============================================================
// Step 5-5 — 설정_기사역량 read 캐시 (5-5-A)
// ============================================================
// 시트 5열: A 기사ID / B 원청 / C 작업유형 / D 지역 (콤마/"전국") / E 등급
// 양방향 X — 시트 직접 편집 / 코드는 read만 (자동 배정/추천 lookup용)

const ENGINEER_SKILLS_CACHE_KEY = "ollit_engineer_skills_cache_v1";

export function setEngineerSkillsCache(list) {
  if (!Array.isArray(list)) return;
  try {
    localStorage.setItem(ENGINEER_SKILLS_CACHE_KEY, JSON.stringify(list));
  } catch (e) { /* */ }
}

export function getEngineerSkillsCache() {
  try {
    const raw = localStorage.getItem(ENGINEER_SKILLS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { /* */ }
  return [];
}

// 행 키 호환 추출
function _skillEngineerId(s) { return String(s.engineerId || s.기사ID || s.id || "").trim(); }
function _skillPrincipal(s)  { return String(s.principal  || s.원청 || s.원청명 || "").trim(); }
function _skillWorkType(s)   { return String(s.workType   || s.작업유형 || "").trim(); }
function _skillGrade(s)      { return String(s.grade      || s.등급 || "").trim(); }
function _skillZonesArray(s) {
  if (Array.isArray(s.zonesArray)) return s.zonesArray;
  if (Array.isArray(s.zones))      return s.zones;
  const raw = s.zones || s.지역 || "";
  if (typeof raw === "string") {
    return raw.split(",").map(z => z.trim()).filter(Boolean);
  }
  return [];
}

// 특정 기사의 모든 역량 행
export function getEngineerSkillsByEngineer(engineerId) {
  if (!engineerId) return [];
  const cache = getEngineerSkillsCache();
  const target = String(engineerId).trim();
  return cache
    .filter(s => _skillEngineerId(s) === target)
    .map(s => ({
      engineerId: _skillEngineerId(s),
      principal:  _skillPrincipal(s),
      workType:   _skillWorkType(s),
      grade:      _skillGrade(s),
      zones:      _skillZonesArray(s),
      raw:        s,
    }));
}

// ============================================================
// Step 5-5-C Phase 2 — 양방향 sync 헬퍼 (saveEngineerSkillWithSync 등)
// ============================================================
// 옛 측 localStorage (사장님이 화면에서 박은 / 시트 빈 상태 시작) — Step 5-4 단가 패턴
const ENGINEER_SKILLS_LOCAL_KEY = "ollit_engineer_skills_v1";

function _loadLocalEngineerSkills() {
  try {
    const raw = localStorage.getItem(ENGINEER_SKILLS_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { /* */ }
  return [];
}

function _saveLocalEngineerSkills(list) {
  try {
    localStorage.setItem(ENGINEER_SKILLS_LOCAL_KEY, JSON.stringify(list));
  } catch (e) { /* */ }
}

// upsert 키 (3중) 비교: engineerId + principal + workType
function _sameSkillKey(a, b) {
  return String(a.engineerId).trim() === String(b.engineerId).trim()
      && String(a.principal).trim()  === String(b.principal).trim()
      && String(a.workType).trim()   === String(b.workType).trim();
}

// payload 정규화 (zones / appliances 배열 → 콤마 string)
// Step 5-5-C Phase 4-C-2 — appliances 추가 (F열 / Phase 4-C-1 GAS 통과)
function _normalizeSkillPayload(p) {
  if (!p) return p;
  const toCommaString = v => {
    if (Array.isArray(v)) return v.map(z => String(z).trim()).filter(Boolean).join(", ");
    if (typeof v === "string") return v.trim();
    return "";
  };
  return {
    engineerId: String(p.engineerId || "").trim(),
    principal:  String(p.principal  || "").trim(),
    workType:   String(p.workType   || "").trim(),
    zones:      toCommaString(p.zones),
    grade:      String(p.grade      || "").trim(),
    appliances: toCommaString(p.appliances),
    note:       String(p.note       || "").trim(),
  };
}

// upsert: localStorage 즉시 + GAS 비동기 sync (Step 5-2/5-4 패턴)
// Phase 4-E — 시트 캐시 (ollit_engineer_skills_cache_v1)도 즉시 갱신 (옛 폼 재진입 시 stale 방지)
export async function saveEngineerSkillWithSync(payload) {
  const norm = _normalizeSkillPayload(payload);
  if (!norm.engineerId || !norm.principal || !norm.workType) {
    return { ok: false, error: "필수 키 누락 (engineerId / principal / workType)", localOk: false };
  }
  // 1) 옛 측 localStorage 즉시 upsert
  const local = _loadLocalEngineerSkills();
  const idx = local.findIndex(r => _sameSkillKey(r, norm));
  if (idx >= 0) local[idx] = { ...local[idx], ...norm };
  else          local.push({ ...norm });
  _saveLocalEngineerSkills(local);

  // 2) Phase 4-E — 시트 캐시도 즉시 갱신 (옛 폼 재진입 시 stale 방지)
  const splitCsv = s => (s ? String(s).split(",").map(z => z.trim()).filter(Boolean) : []);
  const cache = getEngineerSkillsCache();
  const cacheIdx = cache.findIndex(r =>
    String(r.engineerId || r.기사ID || r.id || "").trim() === norm.engineerId &&
    String(r.principal  || r.원청 || r.원청명 || "").trim() === norm.principal &&
    String(r.workType   || r.작업유형 || "").trim()         === norm.workType
  );
  const cacheRow = {
    engineerId:      norm.engineerId,
    principal:       norm.principal,
    workType:        norm.workType,
    zones:           norm.zones,
    zonesArray:      splitCsv(norm.zones),
    grade:           norm.grade,
    appliances:      norm.appliances,
    appliancesArray: splitCsv(norm.appliances),
    note:            norm.note,
  };
  if (cacheIdx >= 0) cache[cacheIdx] = cacheRow;
  else               cache.push(cacheRow);
  setEngineerSkillsCache(cache);

  // 3) DB sync (Phase 3-9 — epp upsert + ez 전체 교체)
  try {
    const res = await upsertEngineerSkillToDb(norm);
    if (!res || res.ok === false) {
      throw new Error((res && res.error) || "DB sync 실패");
    }
    return { ok: true, action: res.action || "update" };
  } catch (e) {
    return { ok: false, error: e.message || "네트워크 오류", localOk: true };
  }
}

export async function deleteEngineerSkillWithSync(payload) {
  const norm = _normalizeSkillPayload(payload);
  if (!norm.engineerId || !norm.principal || !norm.workType) {
    return { ok: false, error: "필수 키 누락", localOk: false };
  }
  // 1) 옛 측
  const local = _loadLocalEngineerSkills();
  const next = local.filter(r => !_sameSkillKey(r, norm));
  _saveLocalEngineerSkills(next);

  // 2) Phase 4-E — 시트 캐시도 즉시 갱신 (옛 폼 재진입 시 stale 방지)
  const cache = getEngineerSkillsCache();
  const newCache = cache.filter(r => !(
    String(r.engineerId || r.기사ID || r.id || "").trim() === norm.engineerId &&
    String(r.principal  || r.원청 || r.원청명 || "").trim() === norm.principal &&
    String(r.workType   || r.작업유형 || "").trim()         === norm.workType
  ));
  setEngineerSkillsCache(newCache);

  // 3) DB sync (Phase 3-9 — epp 행 hard DELETE / ez는 보존)
  try {
    const res = await deleteEngineerSkillFromDb({
      engineerId: norm.engineerId,
      principal:  norm.principal,
      workType:   norm.workType,
    });
    if (!res || res.ok === false) {
      throw new Error((res && res.error) || "DB sync 실패");
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || "네트워크 오류", localOk: true };
  }
}

// Step 5-5-C Phase 4-C-3 — 시트 skill 행 → 옛 workTypes 모델 (옛 폼 form 초기값용)
// 매핑: grade ↔ role / zones (배열 또는 콤마 string) / appliances (F열 / Phase 4-C-1)
// 입력: getEngineerSkillsByEngineer 결과 한 행 ({ principal, workType, grade, zones, raw })
// 반환: { role, zones (배열), appliances (배열) } — 옛 workTypes 형식
export function mapSheetSkillToWorkType(skill) {
  if (!skill) return null;
  // grade → role 매핑
  const grade = String(skill.grade || "").trim();
  const roleMap = { "메인": "main", "백업": "sub", "안 함": "none", "": "none" };
  const role = Object.prototype.hasOwnProperty.call(roleMap, grade) ? roleMap[grade] : "none";

  // zones (배열 또는 콤마 string)
  let zones = [];
  if (Array.isArray(skill.zones)) zones = skill.zones;
  else if (typeof skill.zones === "string") {
    zones = skill.zones.split(",").map(z => z.trim()).filter(Boolean);
  }

  // appliances (F열 / Phase 4-C-1에서 GAS 측 박을 예정)
  let appliances = [];
  const rawApps = skill.appliances ?? skill.기종 ?? skill.raw?.appliances ?? skill.raw?.기종;
  if (Array.isArray(rawApps)) appliances = rawApps;
  else if (typeof rawApps === "string") {
    appliances = rawApps.split(",").map(z => z.trim()).filter(Boolean);
  }

  return { role, zones, appliances };
}

// Step 5-5-C Phase 3 — 폼 초기값용: 시트 캐시 + 옛 측 localStorage 병합
// 시트 우선 (Step 5-5-A getEngineerSkillsByEngineer) + 옛 측 fallback (Phase 2)
// 반환 형식: [{ principal, workType, zones (콤마 string), grade, note }]
export function loadEngineerSkillsByEngineerWithLocal(engineerId) {
  if (!engineerId) return [];
  const fromSheet = getEngineerSkillsByEngineer(engineerId);  // Step 5-5-A
  const fromLocal = _loadLocalEngineerSkills().filter(s =>
    String(s.engineerId).trim() === String(engineerId).trim()
  );
  const seen = new Set();
  const merged = [];
  for (const s of fromSheet) {
    const key = `${s.principal}|${s.workType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      principal: s.principal || "",
      workType:  s.workType  || "",
      zones:     Array.isArray(s.zones) ? s.zones.join(", ") : (s.zones || ""),
      grade:     s.grade     || "메인",
      note:      (s.raw && (s.raw.note || s.raw.비고)) || "",
      _fromSheet: true,
    });
  }
  for (const s of fromLocal) {
    const key = `${s.principal}|${s.workType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      principal: s.principal || "",
      workType:  s.workType  || "",
      zones:     s.zones     || "",
      grade:     s.grade     || "메인",
      note:      s.note      || "",
    });
  }
  return merged;
}

// 자동 배정 / 추천 lookup 헬퍼 — 작업 1건이 기사 역량 매칭 여부
// 매칭: engineerId + workType (정확) + 원청 ("(전체)" 또는 매칭) + 지역 ("전국" 또는 포함)
// 반환: { matched: boolean, grade: string, skill: row | null }
export function getEngineerSkillsByTask({ engineerId, principalId, principalName, workType, region } = {}) {
  if (!engineerId || !workType) return { matched: false, grade: "", skill: null };
  const skills = getEngineerSkillsByEngineer(engineerId);
  const wt = String(workType).trim();
  const r  = region ? String(region).trim() : "";
  const pid   = principalId ? String(principalId).trim() : "";
  const pname = principalName ? String(principalName).trim() : "";

  for (const s of skills) {
    if (s.workType !== wt) continue;
    // 원청 매칭: "(전체)" 또는 정확 매칭 (id 또는 이름)
    const sp = s.principal;
    const principalMatch = !sp || sp === "(전체)" || sp === "전체"
      || sp === pid || sp === pname;
    if (!principalMatch) continue;
    // 지역 매칭: "전국" 또는 zones 포함
    const zones = s.zones || [];
    const isAllRegion = zones.length === 0
      || zones.includes("전국")
      || zones.includes("(전국)")
      || (zones.length === 1 && zones[0] === "");
    const regionMatch = !r || isAllRegion || zones.includes(r);
    if (!regionMatch) continue;
    return { matched: true, grade: s.grade, skill: s };
  }
  return { matched: false, grade: "", skill: null };
}

// 특정 기사의 단가 행 모두 catch (옛 측 + 시트 캐시 병합 — id/key 정확 매칭)
export function loadEngineerRatesByEngineer(engineerId) {
  if (!engineerId) return [];
  const local = _loadLocalEngineerRates();
  const sheet = getEngineerRatesCache();
  // 합치고 중복 제거 (시트 측 우선 — sync 일관성)
  const merged = [];
  const seen = new Set();
  const sameId = (rId) => String(rId || "").trim() === String(engineerId).trim();
  for (const r of sheet) {
    const rId = r.engineerId || r.기사ID || r.id;
    if (!sameId(rId)) continue;
    const key = `${r.workType || r.작업유형}|${r.applianceType || r.appliance || r.기종}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      engineerId: rId,
      workType: r.workType || r.작업유형 || "",
      applianceType: r.applianceType || r.appliance || r.기종 || "",
      rate: parseInt(r.rate ?? r.단가 ?? 0, 10) || 0,
      note: r.note || r.비고 || "",
      _fromSheet: true,
    });
  }
  for (const r of local) {
    if (!sameId(r.engineerId)) continue;
    const key = `${r.workType}|${r.applianceType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...r });
  }
  return merged;
}

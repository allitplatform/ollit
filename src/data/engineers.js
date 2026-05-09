// Step 6 — 기사 마스터 데이터 + localStorage
// Phase 1: localStorage / Phase 2: Supabase 자동 마이그레이션
// 사장님 catch: 화면에서 직접 추가/삭제 / 코드 수정 0번
// Step 5-2 — 시트 설정_기사 양방향 sync (saveEngineerWithSync / deleteEngineerWithSync)

import { saveEngineer as apiSaveEngineer, deleteEngineer as apiDeleteEngineer } from "../api.js";

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
  if (sheetList.length === 0) return oldList;  // 시트 데이터 없음 → 옛 동작 그대로

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
      // 옛 SEED 정보 우선 (사장님이 박은 workTypes 등 보존). 시트 측 cm_refrigerant_rate는 우선 적용.
      merged.push({
        ...adapted,
        ...oldMatch,
        cm_refrigerant_rate: adapted.cm_refrigerant_rate,
        _fromSheet: false,
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

  return merged;
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
function _toSyncPayload(eng) {
  return {
    engineerId: eng.id || "",
    name:       eng.name || "",
    phone:      eng.phone || "",
    email:      eng.email || "",
    active:     statusToActive(eng.status),
    cm_refrigerant_rate: eng.cm_refrigerant_rate || 50,
  };
}

// upsert: localStorage 즉시 박음 + GAS sync
// 응답: { ok: true } | { ok: false, error, localOk: true }
export async function saveEngineerWithSync(eng) {
  // 1) localStorage 즉시 (UI 응답성)
  const list = loadEngineers();
  const existing = list.find(e => e.id === eng.id);
  const next = existing
    ? list.map(e => e.id === eng.id ? eng : e)
    : [eng, ...list];
  saveEngineers(next);

  // 2) GAS sync (비동기 / 실패 시 localStorage는 유지)
  try {
    const res = await apiSaveEngineer(_toSyncPayload(eng));
    if (!res || res.ok === false) {
      throw new Error((res && res.error) || "시트 sync 실패");
    }
    // GAS가 새 engineerId 부여 시 (자동 E### 생성) — localStorage 갱신
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

// 삭제: localStorage 즉시 + GAS sync
export async function deleteEngineerWithSync(engineerId) {
  if (!engineerId) return { ok: false, error: "engineerId 없음", localOk: false };
  const list = loadEngineers();
  saveEngineers(list.filter(e => e.id !== engineerId));
  try {
    const res = await apiDeleteEngineer(engineerId);
    if (!res || res.ok === false) {
      throw new Error((res && res.error) || "시트 sync 실패");
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || "네트워크 오류", localOk: true };
  }
}

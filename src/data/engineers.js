// Step 6 — 기사 마스터 데이터 + localStorage
// Phase 1: localStorage / Phase 2: Supabase 자동 마이그레이션
// 사장님 catch: 화면에서 직접 추가/삭제 / 코드 수정 0번
// Step 5-2 — 시트 설정_기사 양방향 sync (saveEngineerWithSync / deleteEngineerWithSync)

import {
  saveEngineer as apiSaveEngineer,
  deleteEngineer as apiDeleteEngineer,
  saveEngineerRate as apiSaveEngineerRate,
  deleteEngineerRate as apiDeleteEngineerRate,
} from "../api.js";

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

  // 2) GAS sync
  try {
    const res = await apiSaveEngineerRate(payload);
    if (!res || res.ok === false) {
      throw new Error((res && res.error) || "시트 sync 실패");
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

  // 2) GAS sync
  try {
    const res = await apiDeleteEngineerRate(payload);
    if (!res || res.ok === false) {
      throw new Error((res && res.error) || "시트 sync 실패");
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

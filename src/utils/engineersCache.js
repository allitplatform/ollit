// engineersCache.js
// 2026-05-16 Phase 4 통합 2-E #1 — feePolicy.js 측 박힌 engineersCache 박은 spec 분리
// AdminApp 측 setEngineersCache 박음 (apiGetEngineers fetch 후 호출)
// Commit #3 측 feePolicy.js 박지 X 박을 spec — 박은 spec 측 분리 박음
//
// 박은 spec 함수 (feePolicy.js 측 박힌 spec 그대로):
//   - setEngineersCache(list)  — AdminApp fetch 후 호출 (메모리 + localStorage 박음)
//   - getEngineersCache()      — 박힌 cache 박음
//   - getEngineerRefrigerantRate(engineerIdOrName) — 기사별 냉매 비율 박음

const ENGINEERS_CACHE_KEY = "ollit_engineers_cache_v1";
const DEFAULT_REFRIGERANT_RATE = 50;

let _engineersCacheMem = null; // in-memory cache (lazy load)

function _loadEngineersFromStorage() {
  try {
    const raw = localStorage.getItem(ENGINEERS_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* localStorage 접근 실패 시 무시 */ }
  return [];
}

function _ensureCacheLoaded() {
  if (_engineersCacheMem == null) _engineersCacheMem = _loadEngineersFromStorage();
}

// AdminApp 등 fetch 후 호출 — 메모리 + localStorage 둘 다 박음
export function setEngineersCache(list) {
  if (!Array.isArray(list)) return;
  _engineersCacheMem = list;
  try {
    localStorage.setItem(ENGINEERS_CACHE_KEY, JSON.stringify(list));
  } catch (e) { /* 저장 실패 시 메모리만 사용 */ }
}

export function getEngineersCache() {
  _ensureCacheLoaded();
  return _engineersCacheMem || [];
}

// 기사 식별자(id 또는 이름)로 cm_refrigerant_rate 추출 — 빈 / 없음 시 기본 50
// 시트 칼럼: cm_refrigerant_rate (정수 50/60/100). 한글 키 cm_냉매비율도 fallback
export function getEngineerRefrigerantRate(engineerIdOrName) {
  if (engineerIdOrName == null || engineerIdOrName === "") return DEFAULT_REFRIGERANT_RATE;
  _ensureCacheLoaded();
  if (!_engineersCacheMem || _engineersCacheMem.length === 0) return DEFAULT_REFRIGERANT_RATE;
  const target = String(engineerIdOrName).trim();
  const eng = _engineersCacheMem.find(e =>
    e.engineerId === target || e.id === target ||
    e.기사ID    === target || e.name  === target ||
    e.이름     === target
  );
  if (!eng) return DEFAULT_REFRIGERANT_RATE;
  const raw = eng.cm_refrigerant_rate ?? eng.cm_냉매비율 ?? eng.refrigerant_rate;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_REFRIGERANT_RATE;
  return n;
}

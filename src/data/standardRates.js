// Step 7 V2 — 단가표 + Storage + 부가세 자동
// 사장님이 단가표 관리 화면에서 직접 편집 / localStorage 보관

const RATES_STORAGE_KEY = "ollit_standard_rates_v1";

const SEED_RATES = {
  cleaning: {
    "벽걸이":  40000,
    "스탠드":  60000,
    "투인원": 100000,
    "1way":   50000,
    "4way":   70000,
    "원형":   80000,
  },
  coolguyFake: {
    "벽걸이":  50000,
    "스탠드":  70000,
    "투인원": 110000,
    "1way":   60000,
    "4way":   80000,
    "원형":   90000,
  },
};

export const APPLIANCE_OPTIONS = ["벽걸이", "스탠드", "투인원", "1way", "4way", "원형"];

export function loadRates() {
  try {
    const raw = localStorage.getItem(RATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 시드 키 누락 시 기본값으로 머지 (마이그레이션)
      return {
        cleaning:    { ...SEED_RATES.cleaning,    ...(parsed.cleaning    || {}) },
        coolguyFake: { ...SEED_RATES.coolguyFake, ...(parsed.coolguyFake || {}) },
      };
    }
  } catch (e) { console.error(e); }
  saveRates(SEED_RATES);
  return SEED_RATES;
}

export function saveRates(rates) {
  try {
    localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(rates));
    return true;
  } catch (e) { console.error(e); return false; }
}

// 부가세 자동 적용
// vatPolicy: "included" → 그대로 / "excluded" → ×1.10
export function getEngineerRate(applianceType, vatPolicy = "included") {
  const rates = loadRates();
  const base = (rates.cleaning && rates.cleaning[applianceType]) || 0;
  return vatPolicy === "excluded" ? Math.round(base * 1.10) : base;
}

export function getCoolguyFakeRate(applianceType) {
  const rates = loadRates();
  return (rates.coolguyFake && rates.coolguyFake[applianceType]) || 0;
}

// 호환용 — 기존 호출처가 cleaning 단가만 받던 형태
export function getStandardRates() {
  return loadRates().cleaning;
}

// 호환용 alias (legacy)
export const ENGINEER_STANDARD_RATES = SEED_RATES.cleaning;
export const COOLGUY_FAKE_RATES = SEED_RATES.coolguyFake;

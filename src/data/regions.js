// Step 8 — 지역 마스터 + 그룹 + storage
// 그룹 (수도권 + 지방 5개) — 코드 정의 / 활성·비활성만 토글 가능
// 지역 — 사장님이 화면에서 추가/삭제/편집

const STORAGE_KEY = "ollit_regions_v1";
const GROUP_OVERRIDE_KEY = "ollit_region_groups_active_v1";

// 그룹 6개 (코드 정의 — 사장님 수정 X)
const REGION_GROUPS_BASE = [
  { id: "capital",     name: "수도권",  active: true,  order: 1 },
  { id: "chungcheong", name: "충청도",  active: false, order: 2 },
  { id: "honam",       name: "호남",    active: false, order: 3 },
  { id: "yeongnam",    name: "영남",    active: false, order: 4 },
  { id: "gangwon",     name: "강원도",  active: false, order: 5 },
  { id: "jeju",        name: "제주",    active: false, order: 6 },
];

// 서브그룹 (코드 정의)
export const REGION_SUBGROUPS = [
  { id: "seoul",    name: "서울",     groupId: "capital",     order: 1 },
  { id: "gyeonggi", name: "경기",     groupId: "capital",     order: 2 },
  { id: "incheon",  name: "인천",     groupId: "capital",     order: 3 },
  // Phase 2: 지방 추가 예정 (충남/충북/대전/세종 등)
];

const SEED_REGIONS = [
  // 서울 25구
  { id: "gangnam",       name: "강남구",   subgroupId: "seoul", active: true },
  { id: "gangdong",      name: "강동구",   subgroupId: "seoul", active: true },
  { id: "gangbuk",       name: "강북구",   subgroupId: "seoul", active: true },
  { id: "gangseo",       name: "강서구",   subgroupId: "seoul", active: true },
  { id: "gwanak",        name: "관악구",   subgroupId: "seoul", active: true },
  { id: "gwangjin",      name: "광진구",   subgroupId: "seoul", active: true },
  { id: "guro",          name: "구로구",   subgroupId: "seoul", active: true },
  { id: "geumcheon",     name: "금천구",   subgroupId: "seoul", active: true },
  { id: "nowon",         name: "노원구",   subgroupId: "seoul", active: true },
  { id: "dobong",        name: "도봉구",   subgroupId: "seoul", active: true },
  { id: "dongdaemun",    name: "동대문구", subgroupId: "seoul", active: true },
  { id: "dongjak",       name: "동작구",   subgroupId: "seoul", active: true },
  { id: "mapo",          name: "마포구",   subgroupId: "seoul", active: true },
  { id: "seodaemun",     name: "서대문구", subgroupId: "seoul", active: true },
  { id: "seocho",        name: "서초구",   subgroupId: "seoul", active: true },
  { id: "seongdong",     name: "성동구",   subgroupId: "seoul", active: true },
  { id: "seongbuk",      name: "성북구",   subgroupId: "seoul", active: true },
  { id: "songpa",        name: "송파구",   subgroupId: "seoul", active: true },
  { id: "yangcheon",     name: "양천구",   subgroupId: "seoul", active: true },
  { id: "yeongdeungpo",  name: "영등포구", subgroupId: "seoul", active: true },
  { id: "yongsan",       name: "용산구",   subgroupId: "seoul", active: true },
  { id: "eunpyeong",     name: "은평구",   subgroupId: "seoul", active: true },
  { id: "jongno",        name: "종로구",   subgroupId: "seoul", active: true },
  { id: "jung",          name: "중구",     subgroupId: "seoul", active: true },
  { id: "jungnang",      name: "중랑구",   subgroupId: "seoul", active: true },

  // 경기 7시군
  { id: "goyang",        name: "고양시",   subgroupId: "gyeonggi", active: true },
  { id: "seongnam",      name: "성남시",   subgroupId: "gyeonggi", active: true },
  { id: "suwon",         name: "수원시",   subgroupId: "gyeonggi", active: true },
  { id: "bucheon",       name: "부천시",   subgroupId: "gyeonggi", active: true },
  { id: "anyang",        name: "안양시",   subgroupId: "gyeonggi", active: true },
  { id: "namyangju",     name: "남양주시", subgroupId: "gyeonggi", active: true },
  { id: "hwaseong",      name: "화성시",   subgroupId: "gyeonggi", active: true },

  // 인천 1
  { id: "incheon_si",    name: "인천시",   subgroupId: "incheon",  active: true },
];

export function loadRegions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error(e); }
  saveRegions(SEED_REGIONS);
  return SEED_REGIONS;
}

export function saveRegions(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) { console.error(e); return false; }
}

// 그룹 활성/비활성 override (사장님이 화면에서 토글)
function loadGroupOverrides() {
  try {
    const raw = localStorage.getItem(GROUP_OVERRIDE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error(e); }
  return {};
}

function saveGroupOverrides(map) {
  try {
    localStorage.setItem(GROUP_OVERRIDE_KEY, JSON.stringify(map));
    return true;
  } catch (e) { console.error(e); return false; }
}

// 그룹 = base + override 머지
export function loadGroups() {
  const overrides = loadGroupOverrides();
  return REGION_GROUPS_BASE.map(g => ({
    ...g,
    active: overrides[g.id] !== undefined ? overrides[g.id] : g.active,
  }));
}

export function activateGroup(groupId) {
  const overrides = loadGroupOverrides();
  overrides[groupId] = true;
  saveGroupOverrides(overrides);
}

export function deactivateGroup(groupId) {
  const overrides = loadGroupOverrides();
  overrides[groupId] = false;
  saveGroupOverrides(overrides);
}

// 호환용 export (initial state로 사용)
export const REGION_GROUPS = REGION_GROUPS_BASE;

export function generateRegionId(name) {
  const ts = Date.now().toString(36);
  const safe = (name || "rgn").replace(/[\s가-힣]/g, "").toLowerCase().slice(0, 8) || "rgn";
  return `${safe}_${ts}`;
}

// 지역별 담당 기사 수
// engineer 객체 형식: { workTypes: { cleaning: { zones: [...] }, refrigerant: { zones: [...] } } }
// 또는 legacy: { cleaningRegions: [...], refrigerantRegions: [...] }
export function countEngineersByRegion(regionName, engineers) {
  return engineers.filter(e => {
    // 신규 형식 (Step 6)
    const cleaning = e.workTypes?.cleaning?.zones || [];
    const refrigerant = e.workTypes?.refrigerant?.zones || [];
    if (cleaning.includes(regionName) || refrigerant.includes(regionName)) return true;
    // legacy
    if (e.cleaningRegions?.includes(regionName) || e.refrigerantRegions?.includes(regionName)) return true;
    return false;
  }).length;
}

export function createEmptyRegion() {
  return {
    id: "",
    name: "",
    subgroupId: "seoul",
    active: true,
  };
}

// V11-5 — 서브그룹별 묶기 (서울/경기/인천 등)
// 입력: regions 배열 / 출력: [{ id, name, regions: [...] }]
// 활성 지역만 노출. 그룹 순서는 REGION_SUBGROUPS의 order 사용.
export function getRegionGroups(regions) {
  const list = (regions || []).filter(r => r.active !== false);

  const subgroupMap = {};
  REGION_SUBGROUPS.forEach(sg => {
    subgroupMap[sg.id] = { id: sg.id, name: sg.name, order: sg.order, regions: [] };
  });

  list.forEach(r => {
    const sgId = r.subgroupId || "etc";
    if (!subgroupMap[sgId]) {
      subgroupMap[sgId] = { id: sgId, name: "기타", order: 99, regions: [] };
    }
    subgroupMap[sgId].regions.push(r);
  });

  return Object.values(subgroupMap)
    .filter(g => g.regions.length > 0)
    .sort((a, b) => (a.order || 99) - (b.order || 99));
}

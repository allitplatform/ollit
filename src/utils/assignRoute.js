// ============================================================
// 2026-08-03 — 배정 추천 동선 계산 (사장님 확정 spec)
//
// 배경: 배차할 때 "이 기사 하루에 이 동네가 끼워질 자리가 있나"를
//   타임라인을 왔다갔다하며 머릿속으로 계산하던 것을 카드 안에서 답한다.
//
// 제공:
//   · loadGuCentroids()      — 시군구 GeoJSON(CDN, 모듈 캐시) → 구 중심좌표 Map
//   · buildDaySchedule()     — 기사 한 명의 특정 날짜 작업 블록 목록
//   · computeGaps()          — 하루(08~20시) 중 빈 구간
//   · routeVerdict()         — 동선 판정 (good/free/far/full/unknown + km)
//
// 좌표는 구(區) 중심 기반 추정 — 동 단위 정밀도 아님 (같은 구 = 0km).
// GeoJSON/센트로이드 방식은 MetroRouteMap.jsx 와 동일 (키 불필요/무료).
// ============================================================
import { normalizeDistrict } from "../components/admin/AssignRegionMap.jsx";
import { parseRegion } from "./regionParser.js";
import { toKstYmd } from "./dateLabel.js";

const GEO_URL = "https://cdn.jsdelivr.net/gh/southkorea/southkorea-maps@master/kostat/2013/json/skorea_municipalities_geo_simple.json";

// ── 구 중심좌표 (모듈 캐시) ──
let _centroidCache = null;
let _centroidPromise = null;

function _ringCentroid(ring) {
  let x = 0, y = 0;
  for (const p of ring) { x += p[0]; y += p[1]; }
  return [x / ring.length, y / ring.length];
}
function _featureCentroid(f) {
  const g = f?.geometry;
  if (!g) return null;
  if (g.type === "Polygon") return _ringCentroid(g.coordinates[0]);
  if (g.type === "MultiPolygon") {
    let best = null, bestLen = 0;
    for (const poly of g.coordinates) {
      if (poly[0].length > bestLen) { bestLen = poly[0].length; best = poly[0]; }
    }
    return best ? _ringCentroid(best) : null;
  }
  return null;
}

// Map<피처이름, [lon, lat]> — 전국 (필터 없음: 수도권 밖 원정도 거리 계산)
export function loadGuCentroids() {
  if (_centroidCache) return Promise.resolve(_centroidCache);
  if (_centroidPromise) return _centroidPromise;
  _centroidPromise = fetch(GEO_URL)
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      if (!j || !Array.isArray(j.features)) return null;
      const m = new Map();
      for (const f of j.features) {
        const name = f?.properties?.name || "";
        const c = _featureCentroid(f);
        if (name && c) m.set(name, c);
      }
      _centroidCache = m;
      return m;
    })
    .catch(() => null);
  return _centroidPromise;
}

// 구 이름 → 중심좌표 (MetroRouteMap.matchFeature 와 동일한 느슨 매칭)
export function guCentroid(gu, centroids) {
  if (!gu || !centroids) return null;
  if (centroids.has(gu)) return centroids.get(gu);
  for (const [name, c] of centroids) {
    if (name.endsWith(gu) || name.startsWith(gu)) return c;
  }
  return null;
}

// [lon,lat] 두 점 거리 (km, 하버사인)
export function distKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// task/주소 → 구 이름 (region 직접 + 주소 파서 승격)
export function taskGuOf(region, address) {
  const direct = normalizeDistrict(region || "");
  if (direct) return direct;
  const src = String(address || "").trim() || String(region || "").trim();
  if (src) {
    const p = parseRegion(src);
    if (p && p.sigungu) return normalizeDistrict(p.sigungu) || p.sigungu;
  }
  return "";
}

export const DAY_START_MIN = 8 * 60;    // 하루 띠 08:00
export const DAY_END_MIN   = 23 * 60;   // ~23:00 (2026-08-03 사장님: 야간 작업까지)
export const DEFAULT_JOB_MIN = 60;      // 작업 소요 가정 60분 (2026-08-03 사장님: 1시간 단위 배차)

// KST 분(minute of day) — scheduledAt ISO/"HH:MM" 모두 흡수
function _minOf(v) {
  if (!v) return null;
  const s = String(v);
  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    const parts = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).split(":");
    return Number(parts[0]) * 60 + Number(parts[1]);
  } catch { return null; }
}

const OPEN_STATUS = ["배정", "확정", "진행중", "이동중", "작업중"];

// 기사 한 명의 ymd 하루 작업 블록.
//   반환: { blocks: [{startMin,endMin,label,gu,region,status}], untimed: n(시간 미정 배정) }
export function buildDaySchedule(apiTasks, engineerName, ymd) {
  const blocks = [];
  let untimed = 0;
  for (const tk of apiTasks || []) {
    const eng = tk.assignedEngineer || tk.engineer || "";
    if (!eng || eng !== engineerName) continue;
    const st = String(tk.status || "");
    if (!OPEN_STATUS.includes(st)) continue;
    const sched = tk.scheduledDate || (tk.scheduledAt ? toKstYmd(tk.scheduledAt) : "");
    if (sched !== ymd) continue;
    const m = _minOf(tk.time) ?? _minOf(tk.scheduledAt);
    const gu = taskGuOf(tk.region, tk.fullAddress || tk.address);
    if (m == null) { untimed += 1; continue; }
    blocks.push({
      startMin: m,
      endMin: m + DEFAULT_JOB_MIN,
      label: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
      gu, region: tk.region || "", status: st,
    });
  }
  blocks.sort((a, b) => a.startMin - b.startMin);
  return { blocks, untimed };
}

// 빈 구간 (needMin 이상만). offRanges: [{startMin,endMin}] — 부분 휴무 제외.
// 2026-08-03 (2차) — nowMin: 오늘이면 현재시각 이전은 빈 시간으로 안 친다
//   (사장님 지적: 오후에 봐도 오전이 "여유"로 잡혀 판정이 왜곡됨).
export function computeGaps(blocks, offRanges = [], needMin = DEFAULT_JOB_MIN, nowMin = null) {
  const busy = [
    ...blocks.map(b => [Math.max(b.startMin, DAY_START_MIN), Math.min(b.endMin, DAY_END_MIN)]),
    ...offRanges.map(r => [Math.max(r.startMin, DAY_START_MIN), Math.min(r.endMin, DAY_END_MIN)]),
  ].filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let cur = nowMin != null ? Math.max(DAY_START_MIN, nowMin) : DAY_START_MIN;
  for (const [s, e] of busy) {
    if (s - cur >= needMin) gaps.push({ startMin: cur, endMin: s });
    cur = Math.max(cur, e);
  }
  if (DAY_END_MIN - cur >= needMin) gaps.push({ startMin: cur, endMin: DAY_END_MIN });
  return gaps;
}

// 동선 판정.
//   level: "off"(종일 휴무) | "full"(여유 없음) | "good"(≤5km) | "far" | "free"(일정 없음) | "unknown"
export function routeVerdict({ taskGu, blocks, gaps, centroids, fullOff }) {
  if (fullOff) return { level: "off", km: null, nearGu: "" };
  if (blocks.length === 0) return { level: "free", km: null, nearGu: "" };
  if (gaps.length === 0) return { level: "full", km: null, nearGu: "" };

  // 같은 구가 있으면 즉시 0km
  const sameGu = blocks.find(b => b.gu && taskGu && b.gu === taskGu);
  if (sameGu) return { level: "good", km: 0, nearGu: sameGu.gu };

  const tc = guCentroid(taskGu, centroids);
  if (!tc) return { level: "unknown", km: null, nearGu: "" };
  let best = null;
  for (const b of blocks) {
    const bc = guCentroid(b.gu, centroids);
    const d = distKm(tc, bc);
    if (d == null) continue;
    if (!best || d < best.km) best = { km: d, nearGu: b.gu };
  }
  if (!best) return { level: "unknown", km: null, nearGu: "" };
  return { level: best.km <= 5 ? "good" : "far", km: Math.round(best.km * 10) / 10, nearGu: best.nearGu };
}

// 정렬 우선순위 (그룹 안에서 동선 좋은 순)
export const VERDICT_RANK = { good: 0, free: 1, unknown: 2, far: 3, full: 4, off: 5 };

export function fmtMin(m) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// "HH:MM" → 분 (휴무 시간대 파싱용)
export function hmToMin(s) {
  const m = String(s || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

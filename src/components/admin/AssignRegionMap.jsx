// 2026-07-14 — 배정 추천 화면 지역 지도 (사장님 spec).
//   "접수 들어올 때마다 외부 지도 열어서 구 위치 확인하는 게 불편" → 앱 안에 서울 구 지도.
//   · 작업의 구 = 핑크 하이라이트
//   · 후보 프로들의 "오늘 동선" (오늘 일정·진행중·오늘 완료 작업의 구) = 색점으로 표시
//   · 지도 데이터: southkorea/seoul-maps 구 경계 GeoJSON (jsdelivr CDN, 런타임 1회 fetch 후 모듈 캐시)
//   · 외부 지도 API/키 불필요. fetch 실패 시 조용히 미표시 (배정 흐름 영향 0).
//   · 서울 외 지역(김포/구리/하남 등)은 지도 아래 텍스트 칩으로.
import { useEffect, useMemo, useState } from "react";

const GEO_URL = "https://cdn.jsdelivr.net/gh/southkorea/seoul-maps@master/juso/2015/json/seoul_municipalities_geo_simple.json";

// 모듈 캐시 — 화면 재진입 시 재다운로드 X
let _geoCache = null;
let _geoPromise = null;
function loadGeo() {
  if (_geoCache) return Promise.resolve(_geoCache);
  if (_geoPromise) return _geoPromise;
  _geoPromise = fetch(GEO_URL)
    .then(r => (r.ok ? r.json() : null))
    .then(j => { _geoCache = j; return j; })
    .catch(() => null);
  return _geoPromise;
}

// 프로별 마커 색 (순서 고정 팔레트)
const ENG_COLORS = ["#5B9BFF", "#22C55E", "#FFB800", "#A78BFA", "#F97316", "#2DD4BF", "#F472B6", "#94A3B8"];

// polygon ring 평균점 (라벨/점 위치용 — 구 단위엔 충분)
function ringCentroid(ring) {
  let x = 0, y = 0;
  for (const p of ring) { x += p[0]; y += p[1]; }
  return [x / ring.length, y / ring.length];
}

function featureCentroid(f) {
  const g = f.geometry;
  if (!g) return null;
  if (g.type === "Polygon") return ringCentroid(g.coordinates[0]);
  if (g.type === "MultiPolygon") {
    // 가장 큰 폴리곤 기준
    let best = null, bestLen = 0;
    for (const poly of g.coordinates) {
      if (poly[0].length > bestLen) { bestLen = poly[0].length; best = poly[0]; }
    }
    return best ? ringCentroid(best) : null;
  }
  return null;
}

// "서울 서초구 ..." / "서초구" / "김포시" → 구/시 이름 추출 (geojson name 과 매칭용)
export function normalizeDistrict(region) {
  const s = String(region || "").trim();
  if (!s) return "";
  const m = s.match(/([가-힣]+(?:구|시|군))/);
  return m ? m[1] : s.split(" ")[0];
}

export default function AssignRegionMap({ t, taskRegion, engineers = [] }) {
  const [geo, setGeo] = useState(_geoCache);

  useEffect(() => {
    if (geo) return;
    let alive = true;
    loadGeo().then(g => { if (alive) setGeo(g); });
    return () => { alive = false; };
  }, [geo]);

  const taskGu = normalizeDistrict(taskRegion);

  // 프로 → {구: 건수} 인덱스 + 색
  const marks = useMemo(() => {
    return (engineers || []).slice(0, 8).map((e, i) => ({
      name: e.name,
      color: ENG_COLORS[i % ENG_COLORS.length],
      districts: e.districts || {},     // { "강남구": 2, "김포시": 1 }
      total: Object.values(e.districts || {}).reduce((s, n) => s + n, 0),
    }));
  }, [engineers]);

  const { paths, dots, hasTaskGu, W, H } = useMemo(() => {
    if (!geo || !Array.isArray(geo.features)) return { paths: [], dots: [], hasTaskGu: false, W: 100, H: 80 };
    // bbox
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    const eachPoint = (f, cb) => {
      const g = f.geometry; if (!g) return;
      const polys = g.type === "Polygon" ? [g.coordinates] : (g.type === "MultiPolygon" ? g.coordinates : []);
      for (const poly of polys) for (const ring of poly) for (const p of ring) cb(p);
    };
    for (const f of geo.features) eachPoint(f, ([lon, lat]) => {
      if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
    });
    const latK = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const W0 = (maxLon - minLon) * latK, H0 = (maxLat - minLat);
    const W = 360, H = Math.round(360 * (H0 / W0));
    const px = (lon) => ((lon - minLon) * latK / W0) * W;
    const py = (lat) => ((maxLat - lat) / H0) * H;

    const paths = [];
    const dots = [];
    let hasTaskGu = false;

    for (const f of geo.features) {
      const name = f.properties?.name || f.properties?.SIG_KOR_NM || "";
      const g = f.geometry; if (!g) continue;
      const polys = g.type === "Polygon" ? [g.coordinates] : (g.type === "MultiPolygon" ? g.coordinates : []);
      let d = "";
      for (const poly of polys) {
        for (const ring of poly) {
          d += ring.map((p, i) => `${i === 0 ? "M" : "L"}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join("") + "Z";
        }
      }
      const isTask = name === taskGu;
      if (isTask) hasTaskGu = true;
      paths.push({ name, d, isTask });

      // 이 구에서 오늘 일하는 프로 점들
      const here = marks.filter(m => (m.districts[name] || 0) > 0);
      if (here.length > 0) {
        const c = featureCentroid(f);
        if (c) {
          const cx = px(c[0]), cy = py(c[1]);
          here.forEach((m, k) => {
            const off = (k - (here.length - 1) / 2) * 11;
            dots.push({ x: cx + off, y: cy, color: m.color, count: m.districts[name] });
          });
        }
      }
    }
    return { paths, dots, hasTaskGu, W, H };
  }, [geo, taskGu, marks]);

  // 서울 지도 밖 지역 (김포시/구리시 등) — 텍스트 칩
  const seoulNames = useMemo(() => new Set((geo?.features || []).map(f => f.properties?.name)), [geo]);
  const outside = useMemo(() => {
    const rows = [];
    for (const m of marks) {
      const outs = Object.entries(m.districts).filter(([gu]) => !seoulNames.has(gu));
      if (outs.length > 0) rows.push({ name: m.name, color: m.color, txt: outs.map(([gu, n]) => `${gu} ${n}건`).join(" · ") });
    }
    return rows;
  }, [marks, seoulNames]);

  const taskOutside = geo && taskGu && !seoulNames.has(taskGu);

  if (!geo) return null;   // 로딩/실패 — 조용히 미표시

  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 12, padding: "12px 12px 10px", marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: t.textSecondary }}>🗺️ 오늘 동선</span>
        <span style={{ fontSize: 10, color: t.textMuted }}>
          {taskGu ? (taskOutside ? `작업지 ${taskGu} (지도 밖)` : `작업지 ${taskGu}`) : ""}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {paths.map(p => (
          <path
            key={p.name}
            d={p.d}
            fill={p.isTask ? "rgba(255,27,141,0.55)" : "rgba(255,255,255,0.05)"}
            stroke={p.isTask ? "#FF1B8D" : "rgba(255,255,255,0.16)"}
            strokeWidth={p.isTask ? 1.6 : 0.7}
          />
        ))}
        {dots.map((d, i) => (
          <g key={i}>
            <circle cx={d.x} cy={d.y} r={5.5} fill={d.color} stroke="rgba(0,0,0,0.55)" strokeWidth={1.2}/>
            {d.count > 1 && (
              <text x={d.x} y={d.y + 3} textAnchor="middle" fontSize={7} fontWeight={800} fill="#0B0B0E">{d.count}</text>
            )}
          </g>
        ))}
      </svg>

      {/* 범례 — 프로별 색 + 오늘 건수 */}
      {marks.some(m => m.total > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 8 }}>
          {marks.filter(m => m.total > 0).map(m => (
            <span key={m.name} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: t.textSecondary }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: m.color, flexShrink: 0 }}/>
              {m.name} <span style={{ color: t.textMuted, fontWeight: 600 }}>오늘 {m.total}건</span>
            </span>
          ))}
        </div>
      )}
      {marks.length > 0 && marks.every(m => m.total === 0) && (
        <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 8 }}>
          후보 프로들 오늘 잡힌 일정 없음 — 어디서든 출발 가능
        </div>
      )}

      {/* 서울 밖 동선 */}
      {outside.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
          {outside.map(o => (
            <span key={o.name} style={{ fontSize: 10.5, color: t.textMuted }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: o.color, marginRight: 5 }}/>
              {o.name} — 지도 밖: {o.txt}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// 2026-07-14 — 배정 화면 지역 지도 (사장님 spec).
//   "접수 들어올 때마다 외부 지도 열어서 구 위치 확인하는 게 불편" → 앱 안에 서울 구 지도.
//   · 모든 구에 이름 라벨 (사장님 참고 이미지 스타일)
//   · 작업의 구 = 핑크 채움 / 후보 프로가 오늘 일하는 구 = 프로 색으로 채움 + 건수
//   · 라이트/다크 테마 모두 경계선 보이도록 t.isLight 분기 (v1: 흰 선이라 라이트에서 안 보였음)
//   · 지도 데이터: southkorea/seoul-maps 구 경계 GeoJSON (jsdelivr CDN, 런타임 1회 fetch 후 모듈 캐시)
//   · 외부 지도 API/키 불필요. fetch 실패 시 조용히 미표시 (배정 흐름 영향 0).
//   · 서울 외 지역(김포/고양 등)은 아래 한 줄로 압축 (v1 여러 줄 → 복잡하다는 피드백).
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

// 프로별 색 (순서 고정 팔레트)
const ENG_COLORS = ["#5B9BFF", "#22C55E", "#FFB800", "#A78BFA", "#F97316", "#2DD4BF", "#F472B6", "#94A3B8"];

// geojson feature 이름 — 이 데이터셋은 properties.name ("종로구" 형태).
//   v1 버그: 서울 소속 판정(seoulNames)에 name 만 봐서 SIG_KOR_NM 케이스에서 전부 "지도 밖" 처리.
function featName(f) {
  return f?.properties?.name || f?.properties?.SIG_KOR_NM || "";
}

// polygon ring 평균점 (라벨 위치용 — 구 단위엔 충분)
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
    let best = null, bestLen = 0;
    for (const poly of g.coordinates) {
      if (poly[0].length > bestLen) { bestLen = poly[0].length; best = poly[0]; }
    }
    return best ? ringCentroid(best) : null;
  }
  return null;
}

// "서울 서초구 ..." / "서울시성북구" / "김포시" → 구/시 이름 추출.
//   v2: 앞의 서울(특별시/시) 접두사 제거 + 무공백("서울시성북구")에서도 XX구 우선 매칭.
//   (v1 버그: "서울시성북구" → "서울시" 로 잘림)
export function normalizeDistrict(region) {
  let s = String(region || "").trim();
  if (!s) return "";
  s = s.replace(/^서울(특별시|시)?\s*/, "");
  const gu = s.match(/([가-힣]{1,6}구)(?![가-힣])/);
  if (gu) return gu[1];
  const si = s.match(/([가-힣]{1,6}[시군])(?![가-힣])/);
  if (si) return si[1];
  return s.split(" ")[0];
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
  const isLight = !!t.isLight;

  // 프로 → {구: 건수} + 색
  //   v3: 구/시/군으로 안 끝나는 값은 버림 — 주소 쪼가리("장안동373-1", "문정로",
  //   "마천동279-25")가 '서울 밖' 줄에 지역인 척 끼어들던 문제 (사장님 피드백).
  const marks = useMemo(() => {
    return (engineers || []).slice(0, 8).map((e, i) => {
      const districts = {};
      for (const [gu, n] of Object.entries(e.districts || {})) {
        if (/[구시군]$/.test(gu)) districts[gu] = n;
      }
      return {
        name: e.name,
        color: ENG_COLORS[i % ENG_COLORS.length],
        districts,                       // { "강남구": 2, "김포시": 1 }
        total: Object.values(districts).reduce((s, n) => s + n, 0),
      };
    });
  }, [engineers]);

  const { paths, labels, dots, W, H, seoulNames } = useMemo(() => {
    if (!geo || !Array.isArray(geo.features)) {
      return { paths: [], labels: [], dots: [], W: 100, H: 80, seoulNames: new Set() };
    }
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
    const labels = [];
    const dots = [];
    const seoulNames = new Set();

    for (const f of geo.features) {
      const name = featName(f);
      seoulNames.add(name);
      const g = f.geometry; if (!g) continue;
      const polys = g.type === "Polygon" ? [g.coordinates] : (g.type === "MultiPolygon" ? g.coordinates : []);
      let d = "";
      for (const poly of polys) {
        for (const ring of poly) {
          d += ring.map((p, i) => `${i === 0 ? "M" : "L"}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join("") + "Z";
        }
      }
      const isTask = name === taskGu;
      const here = marks.filter(m => (m.districts[name] || 0) > 0);

      // 채움색: 작업지 > 프로 1명 > 기본. 경계선은 테마 배경색 (타일 분리 효과).
      let fill;
      if (isTask) fill = "rgba(255,27,141,0.60)";
      else if (here.length === 1) fill = here[0].color + (isLight ? "66" : "59");   // 프로 색 40%/35%
      else fill = isLight ? "#ECECF1" : "rgba(255,255,255,0.07)";
      paths.push({
        name, d, fill,
        stroke: isTask ? "#FF1B8D" : (isLight ? "#FFFFFF" : "rgba(0,0,0,0.45)"),
        sw: isTask ? 1.6 : 1,
      });

      const c = featureCentroid(f);
      if (!c) continue;
      const cx = px(c[0]), cy = py(c[1]);

      // 구 이름 라벨 — 전부 표시 (작업지/프로 구는 강조)
      const hot = isTask || here.length > 0;
      labels.push({
        x: cx, y: here.length > 0 ? cy - 3 : cy + 2,
        text: name.replace(/구$/, ""),               // "강남구"→"강남" (좁은 구 대비)
        size: hot ? 8 : 6.5,
        weight: hot ? 800 : 600,
        color: isTask
          ? "#FFFFFF"
          : hot
            ? (isLight ? "#26262C" : "#FFFFFF")
            : (isLight ? "#8A8A94" : "rgba(255,255,255,0.45)"),
      });

      // 프로 점 (라벨 아래) — 같은 구에 여러 명이면 좌우 분산
      here.forEach((m, k) => {
        const off = (k - (here.length - 1) / 2) * 12;
        dots.push({ x: cx + off, y: cy + 8, color: m.color, count: m.districts[name] });
      });
    }
    return { paths, labels, dots, W, H, seoulNames };
  }, [geo, taskGu, marks, isLight]);

  // 서울 지도 밖 (김포·고양 등) — 한 줄 압축
  const outsideLine = useMemo(() => {
    if (!geo) return "";
    const parts = [];
    for (const m of marks) {
      const outs = Object.entries(m.districts).filter(([gu]) => !seoulNames.has(gu));
      if (outs.length > 0) parts.push(`${m.name} ${outs.map(([gu, n]) => (n > 1 ? `${gu} ${n}` : gu)).join("·")}`);
    }
    return parts.join("  |  ");
  }, [geo, marks, seoulNames]);

  const taskOutside = geo && taskGu && !seoulNames.has(taskGu);

  if (!geo) return null;   // 로딩/실패 — 조용히 미표시

  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 12, padding: "12px 12px 10px", marginBottom: 12,
    }}>
      {/* 범례 한 줄: 작업지 + 프로별 색/건수 */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 12px", marginBottom: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: t.text }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: "#FF1B8D", flexShrink: 0 }}/>
          작업지 {taskGu || "—"}{taskOutside ? " (서울 밖)" : ""}
        </span>
        {marks.map(m => (
          <span key={m.name} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: t.textSecondary }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: m.color, flexShrink: 0 }}/>
            {m.name}
            <span style={{ color: t.textMuted, fontWeight: 600 }}>{m.total > 0 ? `오늘 ${m.total}건` : "일정 없음"}</span>
          </span>
        ))}
      </div>

      {/* v3: PC 넓은 화면에서 지도가 통째로 커져 잘리던 문제 — 폭 제한 + 가운데 */}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 560, height: "auto", display: "block", margin: "0 auto" }}>
        {paths.map(p => (
          <path key={p.name} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw}/>
        ))}
        {labels.map((l, i) => (
          <text key={i} x={l.x} y={l.y} textAnchor="middle"
            fontSize={l.size} fontWeight={l.weight} fill={l.color}
            style={{ pointerEvents: "none" }}>{l.text}</text>
        ))}
        {dots.map((d, i) => (
          <g key={i}>
            <circle cx={d.x} cy={d.y} r={4.5} fill={d.color} stroke={isLight ? "#FFFFFF" : "rgba(0,0,0,0.55)"} strokeWidth={1.2}/>
            {d.count > 1 && (
              <text x={d.x} y={d.y + 2.5} textAnchor="middle" fontSize={6} fontWeight={800} fill="#0B0B0E">{d.count}</text>
            )}
          </g>
        ))}
      </svg>

      {/* 서울 밖 동선 — 줄바꿈 허용 (v2 ellipsis 는 끝이 잘려 보임) */}
      {outsideLine && (
        <div style={{ fontSize: 10, color: t.textMuted, marginTop: 6, lineHeight: 1.6 }}>
          서울 밖: {outsideLine}
        </div>
      )}
    </div>
  );
}

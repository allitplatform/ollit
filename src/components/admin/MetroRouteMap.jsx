// 2026-07-16 — 프로 오늘 동선 지도 (사장님 spec: "기사님 오늘 동선을 지도그림으로").
//   AssignRegionMap(서울 구 전용)과 달리 수도권(서울+인천+경기) 시군구 범위 —
//   사장님 질문 "서울이 아닐 때는?" → 텃밭(고양·파주·김포·부천)이 서울 밖이라 수도권 필수.
//   · 데이터: southkorea/southkorea-maps 전국 시군구 GeoJSON (jsdelivr, 368KB, 런타임 1회 + 모듈 캐시)
//     kostat code prefix: 11=서울, 23=인천, 31=경기 만 필터.
//   · 방문 구 = 핑크 채움 + 시간순 방문 순번(①②③) 표시. 나머지는 옅은 타일 (라벨 없음 — 251개 라벨은 노이즈).
//   · 이름 매칭: "일산동구" ↔ feature "고양시일산동구" (endsWith), "부천시" ↔ "부천시소사구" (startsWith).
//   · fetch 실패/수도권 밖 방문지는 아래 텍스트 줄 fallback — 화면 흐름 영향 0.
import { useEffect, useMemo, useState } from "react";
import { normalizeDistrict } from "./AssignRegionMap.jsx";

const GEO_URL = "https://cdn.jsdelivr.net/gh/southkorea/southkorea-maps@master/kostat/2013/json/skorea_municipalities_geo_simple.json";

let _cache = null;
let _promise = null;
function loadGeo() {
  if (_cache) return Promise.resolve(_cache);
  if (_promise) return _promise;
  _promise = fetch(GEO_URL)
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      if (!j || !Array.isArray(j.features)) return null;
      // 수도권만 (서울 11 / 인천 23 / 경기 31)
      const feats = j.features.filter(f => /^(11|23|31)/.test(String(f?.properties?.code || "")));
      _cache = { ...j, features: feats };
      return _cache;
    })
    .catch(() => null);
  return _promise;
}

function featName(f) {
  return f?.properties?.name || "";
}

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

// 구/시 이름 ↔ feature 이름 매칭 ("일산동구" ↔ "고양시일산동구" / "부천시" ↔ "부천시소사구")
function matchFeature(featureName, gu) {
  if (!featureName || !gu) return false;
  return featureName === gu || featureName.endsWith(gu) || featureName.startsWith(gu);
}

// slots: [{ time, region, address }] — 시간순 정렬된 오늘 작업.
export default function MetroRouteMap({ t, slots = [] }) {
  const [geo, setGeo] = useState(_cache);

  useEffect(() => {
    if (geo) return;
    let alive = true;
    loadGeo().then(g => { if (alive) setGeo(g); });
    return () => { alive = false; };
  }, [geo]);

  // 방문지: 시간순 → [{ gu, seq: [1,3], times: [...] }]
  const visits = useMemo(() => {
    const list = [];
    (slots || []).forEach((s, i) => {
      const gu = normalizeDistrict(s.region || s.address || "");
      if (!gu || !/[구시군]$/.test(gu)) return;
      const hit = list.find(v => v.gu === gu);
      if (hit) hit.seq.push(i + 1);
      else list.push({ gu, seq: [i + 1] });
    });
    return list;
  }, [slots]);

  const isLight = !!t.isLight;

  const view = useMemo(() => {
    if (!geo) return null;
    // 방문 feature 집합
    const hotFeats = new Set();
    const guToFeats = {};
    for (const f of geo.features) {
      const name = featName(f);
      for (const v of visits) {
        if (matchFeature(name, v.gu)) {
          hotFeats.add(name);
          (guToFeats[v.gu] = guToFeats[v.gu] || []).push(f);
        }
      }
    }
    // bbox: 방문지가 있으면 방문지 중심 + 서울 포함 / 없으면 서울+주변만
    //   전체 수도권(연천~안성)은 너무 넓어 라벨이 작아짐 → 방문 구 bbox에 패딩.
    const eachPoint = (f, cb) => {
      const g = f.geometry; if (!g) return;
      const polys = g.type === "Polygon" ? [g.coordinates] : (g.type === "MultiPolygon" ? g.coordinates : []);
      for (const poly of polys) for (const ring of poly) for (const p of ring) cb(p);
    };
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    const boundFeats = hotFeats.size > 0
      ? geo.features.filter(f => hotFeats.has(featName(f)) || /^11/.test(String(f.properties?.code || "")))
      : geo.features.filter(f => /^11/.test(String(f.properties?.code || "")));
    for (const f of boundFeats) eachPoint(f, ([lon, lat]) => {
      if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
    });
    // 패딩 8%
    const padLon = (maxLon - minLon) * 0.08, padLat = (maxLat - minLat) * 0.08;
    minLon -= padLon; maxLon += padLon; minLat -= padLat; maxLat += padLat;

    const latK = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const W0 = (maxLon - minLon) * latK, H0 = (maxLat - minLat);
    const W = 360, H = Math.max(200, Math.round(360 * (H0 / W0)));
    const px = (lon) => ((lon - minLon) * latK / W0) * W;
    const py = (lat) => ((maxLat - lat) / H0) * H;

    const paths = [];
    const marks = [];
    for (const f of geo.features) {
      const name = featName(f);
      const g = f.geometry; if (!g) continue;
      const polys = g.type === "Polygon" ? [g.coordinates] : (g.type === "MultiPolygon" ? g.coordinates : []);
      let d = "", anyIn = false;
      for (const poly of polys) {
        for (const ring of poly) {
          d += ring.map((p, i) => {
            const x = px(p[0]), y = py(p[1]);
            if (x > -30 && x < W + 30 && y > -30 && y < H + 30) anyIn = true;
            return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
          }).join("") + "Z";
        }
      }
      if (!anyIn) continue;   // viewBox 밖 시군구는 그리지 않음 (paths 수 절약)
      const hot = hotFeats.has(name);
      paths.push({
        name, d,
        fill: hot ? "rgba(255,27,141,0.55)" : (isLight ? "#ECECF1" : "rgba(255,255,255,0.07)"),
        stroke: hot ? "#FF1B8D" : (isLight ? "#FFFFFF" : "rgba(0,0,0,0.45)"),
        sw: hot ? 1.4 : 0.8,
      });
    }
    // 방문 순번 마크 — 구 단위 centroid (여러 feature 매칭이면 평균)
    for (const v of visits) {
      const feats = guToFeats[v.gu] || [];
      if (feats.length === 0) continue;
      let x = 0, y = 0, n = 0;
      for (const f of feats) {
        const c = featureCentroid(f);
        if (!c) continue;
        x += px(c[0]); y += py(c[1]); n++;
      }
      if (!n) continue;
      marks.push({ x: x / n, y: y / n, gu: v.gu, seqText: v.seq.join("·") });
    }
    return { paths, marks, W, H, matchedGus: new Set(Object.keys(guToFeats)) };
  }, [geo, visits, isLight]);

  if (!geo || !view) return null;
  if (visits.length === 0) return null;   // 오늘 일정 없으면 지도 생략

  // 지도에 못 올린 방문지 (수도권 밖 / 매칭 실패) — 텍스트 fallback
  const unmapped = visits.filter(v => !view.matchedGus.has(v.gu));

  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 12, padding: "10px 12px", marginBottom: 14,
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: t.textMuted, letterSpacing: 0.5, marginBottom: 6 }}>
        🗺 오늘 동선 <span style={{ fontWeight: 600 }}>· 숫자 = 방문 순서</span>
      </div>
      <svg viewBox={`0 0 ${view.W} ${view.H}`} style={{ width: "100%", maxWidth: 560, height: "auto", display: "block", margin: "0 auto" }}>
        {view.paths.map(p => (
          <path key={p.name} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw}/>
        ))}
        {view.marks.map((m, i) => (
          <g key={i}>
            <text x={m.x} y={m.y - 5} textAnchor="middle" fontSize={8.5} fontWeight={800}
              fill={isLight ? "#26262C" : "#FFFFFF"} style={{ pointerEvents: "none" }}>
              {m.gu.replace(/구$/, "").replace(/시$/, "")}
            </text>
            <circle cx={m.x} cy={m.y + 3} r={6.5} fill="#FF1B8D" stroke={isLight ? "#FFFFFF" : "rgba(0,0,0,0.5)"} strokeWidth={1.2}/>
            <text x={m.x} y={m.y + 5.5} textAnchor="middle" fontSize={6.5} fontWeight={800} fill="#FFFFFF">
              {m.seqText}
            </text>
          </g>
        ))}
      </svg>
      {unmapped.length > 0 && (
        <div style={{ fontSize: 10, color: t.textMuted, marginTop: 6, lineHeight: 1.6 }}>
          지도 밖: {unmapped.map(v => `${v.seq.join("·")} ${v.gu}`).join("  |  ")}
        </div>
      )}
    </div>
  );
}

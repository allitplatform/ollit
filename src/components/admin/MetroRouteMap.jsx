// 2026-07-16 — 프로 오늘 동선 지도 v2: 진짜 지도 (사장님 D안 확정).
//   v1(수도권 초로플레스)은 "빈 폴리곤 낭비 + 서울 밖 반쪽" 피드백으로 교체.
//   · 지도: OpenStreetMap 타일 + Leaflet — **API 키 불필요/무료**.
//     Leaflet 은 npm 의존 추가 없이 unpkg CDN 런타임 1회 로드 (AssignRegionMap 의
//     GeoJSON CDN 패턴과 동일 — 실패 시 조용히 미표시, 화면 흐름 영향 0).
//   · 핀 위치: 수도권 시군구 GeoJSON(모듈 캐시)의 구 중심 — 주소 좌표 변환(카카오 키) 불필요.
//     "일산동구"↔"고양시일산동구"(endsWith), "부천시"↔"부천시소사구"(startsWith) 매칭.
//   · 핀: 방문 순번(핑크) / 완료 ✓(회색) / 취소 ✕(흰+빨강 테두리 — 동선에 포함, 사장님 spec).
//   · 이동선: 시간순 연결 — 취소 구간은 빨강 점선, 나머지 핑크 실선 (F안 미니멀 요소 흡수).
//   · 지도 밖(수도권 외/매칭 실패) 방문지는 아래 텍스트 줄 fallback.
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeDistrict } from "./AssignRegionMap.jsx";
import { resolveAddressDistrict } from "../../lib/jusoApi.js";

const GEO_URL = "https://cdn.jsdelivr.net/gh/southkorea/southkorea-maps@master/kostat/2013/json/skorea_municipalities_geo_simple.json";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

// ── GeoJSON (수도권 시군구) — 모듈 캐시 ──
let _geoCache = null;
let _geoPromise = null;
function loadGeo() {
  if (_geoCache) return Promise.resolve(_geoCache);
  if (_geoPromise) return _geoPromise;
  _geoPromise = fetch(GEO_URL)
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      if (!j || !Array.isArray(j.features)) return null;
      const feats = j.features.filter(f => /^(11|23|31)/.test(String(f?.properties?.code || "")));
      _geoCache = feats;
      return feats;
    })
    .catch(() => null);
  return _geoPromise;
}

// ── Leaflet CDN 로더 — 모듈 캐시 ──
let _leafletPromise = null;
function loadLeaflet() {
  if (typeof window !== "undefined" && window.L) return Promise.resolve(window.L);
  if (_leafletPromise) return _leafletPromise;
  _leafletPromise = new Promise((resolve) => {
    try {
      if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = LEAFLET_CSS;
        document.head.appendChild(css);
      }
      const s = document.createElement("script");
      s.src = LEAFLET_JS;
      s.onload = () => resolve(window.L || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    } catch {
      resolve(null);
    }
  });
  return _leafletPromise;
}

function featName(f) { return f?.properties?.name || ""; }

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
function matchFeature(featureName, gu) {
  if (!featureName || !gu) return false;
  return featureName === gu || featureName.endsWith(gu) || featureName.startsWith(gu);
}

// 2026-07-16 — 동 단위 주소("면목동 33-10") → 구 해석: 주소 API 재활용 (사장님 "지도 밖" 피드백).
//   모듈 캐시로 같은 주소 재조회 방지. 실패 시 null (지도 밖 라인 fallback 유지).
const _guResolveCache = {};
async function resolveGuViaApi(raw) {
  const key = String(raw || "").trim();
  if (!key || key.length < 4) return null;
  if (key in _guResolveCache) return _guResolveCache[key];
  try {
    const res = await resolveAddressDistrict(key);
    const gu = res && res.ok && res.sgg ? res.sgg : null;
    _guResolveCache[key] = gu;
    return gu;
  } catch {
    _guResolveCache[key] = null;
    return null;
  }
}

// slots: [{ time, region, address, state, status }] — 시간순 정렬된 오늘 작업.
export default function MetroRouteMap({ t, slots = [] }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);   // geo + leaflet 로드 완료
  const [unmapped, setUnmapped] = useState([]);

  // 방문 스톱: 시간순 + 취소 표시 + 순번(취소 제외 카운트) — RouteTimeline 과 동일 규칙
  const stops = useMemo(() => {
    let seq = 0;
    return (slots || []).map(s => {
      const isCancel = s.state === "canceled" || s.status === "취소" || s.status === "취소요청";
      // 2026-07-16 — visit_only(출장비)도 완료 계열 (타임라인과 동일 규칙)
      const isDone = s.state === "done" || s.status === "visit_only" || s.state === "visit_only";
      if (!isCancel) seq += 1;
      const gu = normalizeDistrict(s.region || s.address || "");
      return {
        gu, isCancel, isDone, seq: isCancel ? null : seq, time: s.time || "",
        address: s.address || "", rawRegion: s.region || "",
      };
    });
  }, [slots]);

  useEffect(() => {
    let alive = true;
    if (stops.length === 0) return;
    Promise.all([loadGeo(), loadLeaflet()]).then(async ([feats, L]) => {
      if (!alive || !feats || !L || !boxRef.current) return;

      // 구 좌표 계산 헬퍼 (centroid 평균, [lat, lng])
      const coordOfGu = (gu) => {
        const matched = feats.filter(f => matchFeature(featName(f), gu));
        if (matched.length === 0) return null;
        let x = 0, y = 0, n = 0;
        for (const f of matched) {
          const c = featureCentroid(f);
          if (!c) continue;
          x += c[0]; y += c[1]; n++;
        }
        return n ? [y / n, x / n] : null;   // GeoJSON=[lon,lat] → Leaflet=[lat,lng]
      };

      // 1차: 지역명(구/시) 직접 매칭 / 2차: 동 단위·매칭 실패 → 주소 API로 구 해석 (사장님 "지도 밖" 피드백)
      const resolved = [];
      for (const st of stops) {
        let gu = st.gu;
        let coord = gu ? coordOfGu(gu) : null;
        if (!coord) {
          const apiGu = await resolveGuViaApi(st.address || st.rawRegion || st.gu);
          if (apiGu) {
            const c2 = coordOfGu(apiGu);
            if (c2) { gu = apiGu; coord = c2; }
          }
        }
        resolved.push({ ...st, gu: gu || st.gu, _coord: coord });
      }
      if (!alive || !boxRef.current) return;

      const placed = resolved.filter(s => s._coord);
      const missed = resolved.filter(s => !s._coord);
      setUnmapped(missed);
      if (placed.length === 0) return;

      // 지도 초기화 (재진입 시 기존 인스턴스 제거)
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      const map = L.map(boxRef.current, { zoomControl: false, attributionControl: false });
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // 같은 구 겹침 오프셋 (여러 방문이 같은 구면 핀이 포개짐 → 살짝 분산)
      const usedCount = {};
      const pts = placed.map(s => {
        const k = s.gu;
        const i = (usedCount[k] = (usedCount[k] || 0) + 1) - 1;
        const [lat, lng] = s._coord;
        return { ...s, lat: lat + i * 0.006, lng: lng + i * 0.006 };
      });

      // 이동선 (시간순 — 취소 구간 빨강 점선)
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const cancelSeg = a.isCancel || b.isCancel;
        L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
          color: cancelSeg ? "#E5484D" : "#FF1B8D",
          weight: cancelSeg ? 2.5 : 3.5,
          dashArray: cancelSeg ? "6 5" : null,
          opacity: 0.85,
        }).addTo(map);
      }

      // 핀
      for (const p of pts) {
        const style = p.isCancel
          ? "background:#fff;color:#E5484D;border:2px solid #E5484D;"
          : p.isDone
            ? "background:#9AA1AC;color:#fff;border:2px solid #fff;"
            : "background:#FF1B8D;color:#fff;border:2px solid #fff;";
        // 2026-07-16 — 사장님 spec "1번 체크는 없고": 완료도 회색 '번호' 유지
        const label = p.isCancel ? "✕" : String(p.seq);
        L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:800 12px -apple-system,sans-serif;box-shadow:0 2px 5px rgba(0,0,0,.3);${style}">${label}</div>`,
            iconSize: [26, 26], iconAnchor: [13, 13],
          }),
          title: `${p.time} ${p.gu}`,
        }).addTo(map);
      }

      map.fitBounds(pts.map(p => [p.lat, p.lng]), { padding: [36, 36], maxZoom: 13 });
      setReady(true);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(stops)]);

  // 언마운트 시 지도 정리
  useEffect(() => () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } }, []);

  if (!slots || slots.length === 0) return null;

  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 12, padding: "10px 12px", marginBottom: 14,
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: t.textMuted, letterSpacing: 0.5, marginBottom: 6 }}>
        🗺 오늘 동선 <span style={{ fontWeight: 600 }}>· 숫자 = 방문 순서 · ✕ = 취소</span>
      </div>
      <div ref={boxRef} style={{
        height: 260, borderRadius: 10, overflow: "hidden",
        background: t.bgInset,
        display: ready ? "block" : "flex", alignItems: "center", justifyContent: "center",
      }}>
        {!ready && <span style={{ fontSize: 11, color: t.textMuted }}>지도 불러오는 중…</span>}
      </div>
      {unmapped.length > 0 && (
        <div style={{ fontSize: 10, color: t.textMuted, marginTop: 6, lineHeight: 1.6 }}>
          지도 밖: {unmapped.map(v => `${v.isCancel ? "✕" : v.seq ?? ""} ${v.gu || "지역 미상"} ${v.time}`.trim()).join("  |  ")}
        </div>
      )}
    </div>
  );
}

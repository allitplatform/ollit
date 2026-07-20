// 2026-07-20 — 기사 지역 커버리지 지도 (사장님 spec).
//   "어느 지역이 설정 안 돼 있는지 모르겠고, 전지역 기사가 누군지 모르겠다"
//   · 서울: 구 경계 GeoJSON 지도 (AssignRegionMap 과 동일 데이터셋 — jsdelivr, 키 불필요)
//   · 경기/인천: 타일 그리드 (칩 목록과 동일 순서 — 지도보다 커버 수 읽기 쉬움)
//   · 색: 세척+냉매 다 있음(초록) / 한쪽만(노랑) / 아무도 없음(빨강)
//   · 구/시 클릭 → 담당 기사 명단 (세척 ❄ / 냉매·설치·누설 ⚡, 메인/백업)
//   · "전지역(전국·지역 미설정)" 기사는 별도 줄 — 모든 지역에서 배정 가능하므로 색엔 반영 X
//     (반영하면 전부 초록이 돼 빈 지역이 안 보임)
//   · 데이터: DB fresh (listEngineerSkillsFromDb + listEngineersFromDb) — localStorage 캐시 의존 X
import { useEffect, useMemo, useState } from "react";
import { listEngineerSkillsFromDb } from "../lib/engineerSkillsDb.js";
import { listEngineersFromDb } from "../lib/engineersDb.js";
import {
  SEOUL_DISTRICTS, GYEONGGI, INCHEON, zoneCoversRegion,
} from "../data/engineers.js";

const GEO_URL = "https://cdn.jsdelivr.net/gh/southkorea/seoul-maps@master/juso/2015/json/seoul_municipalities_geo_simple.json";

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

function featName(f) {
  return f?.properties?.name || f?.properties?.SIG_KOR_NM || "";
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

// 커버 상태 → 색 (라이트/다크 공용 — 반투명)
function coverFill(cov) {
  if (!cov || (cov.clean.length === 0 && cov.refri.length === 0)) return "rgba(239,68,68,0.30)";   // 빈 지역
  if (cov.clean.length > 0 && cov.refri.length > 0) return "rgba(34,197,94,0.30)";                  // 둘 다
  return "rgba(255,184,0,0.32)";                                                                     // 한쪽만
}

export default function EngineerCoverageMap() {
  const [geo, setGeo] = useState(_geoCache);
  const [skills, setSkills] = useState(null);   // null = 로딩
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [sel, setSel] = useState("");           // 선택된 구/시 이름
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    loadGeo().then(g => { if (alive) setGeo(g); });
    listEngineerSkillsFromDb().then(r => {
      if (!alive) return;
      if (!r.ok) { setError(r.error || "기사 지역 조회 실패"); setSkills([]); return; }
      setSkills(r.skills || []);
    });
    listEngineersFromDb().then(r => {
      if (!alive) return;
      setUsers(r.ok ? (r.engineers || []) : []);
    });
    return () => { alive = false; };
  }, []);

  // 기사별 요약: { id, name, active, zones[], clean: grade|null, refri: grade|null }
  const engineers = useMemo(() => {
    if (!skills || !users) return null;
    const nameById = new Map(users.map(u => [u.id, u]));
    const byId = new Map();
    for (const s of skills) {
      const id = String(s.engineerId || "").trim();
      if (!id) continue;
      const u = nameById.get(id);
      if (u && u.active === false) continue;      // 휴직/퇴사 제외
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          name: (u && u.name) || id,
          zones: Array.isArray(s.zonesArray) ? s.zonesArray.slice() : [],
          clean: null, refri: null,
        });
      }
      const e = byId.get(id);
      if (s.workType === "세척")     e.clean = s.grade || "메인";
      if (s.workType === "냉매충전") e.refri = s.grade || "메인";
      // zones 는 user 단위 단일 세트 (D7) — 첫 row 것으로 충분하지만 합집합으로 방어
      for (const z of (s.zonesArray || [])) {
        if (!e.zones.includes(z)) e.zones.push(z);
      }
    }
    return Array.from(byId.values());
  }, [skills, users]);

  // 전지역 기사 (전국 칩 또는 지역 미설정) — 색 계산에서 제외, 별도 표기
  const allZoneEngineers = useMemo(() => {
    if (!engineers) return [];
    return engineers.filter(e => e.zones.length === 0 || e.zones.includes("전국"));
  }, [engineers]);

  // 지역별 커버: { 지역명: { clean: [eng], refri: [eng] } } (전지역 기사 제외)
  const coverage = useMemo(() => {
    if (!engineers) return {};
    const zoneEngs = engineers.filter(e => !(e.zones.length === 0 || e.zones.includes("전국")));
    const map = {};
    for (const r of [...SEOUL_DISTRICTS, ...GYEONGGI, ...INCHEON]) {
      const covering = zoneEngs.filter(e =>
        e.zones.some(z => zoneCoversRegion(z, r))   // 시↔구 커버 포함 (성남시 기사 → 분당구 등)
      );
      map[r] = {
        clean: covering.filter(e => e.clean),
        refri: covering.filter(e => e.refri),
      };
    }
    return map;
  }, [engineers]);

  // 빈 지역 목록
  const emptyRegions = useMemo(() => {
    return Object.entries(coverage)
      .filter(([, c]) => c.clean.length === 0 && c.refri.length === 0)
      .map(([r]) => r);
  }, [coverage]);

  // 서울 SVG
  const svgData = useMemo(() => {
    if (!geo || !Array.isArray(geo.features)) return null;
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
    for (const f of geo.features) {
      const name = featName(f);
      const g = f.geometry; if (!g) continue;
      const polys = g.type === "Polygon" ? [g.coordinates] : (g.type === "MultiPolygon" ? g.coordinates : []);
      let d = "";
      for (const poly of polys) {
        for (const ring of poly) {
          d += ring.map((p, i) => `${i === 0 ? "M" : "L"}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join("") + "Z";
        }
      }
      const c = featureCentroid(f);
      paths.push({
        name, d,
        cx: c ? px(c[0]) : 0,
        cy: c ? py(c[1]) : 0,
      });
    }
    return { paths, W, H };
  }, [geo]);

  const loading = skills === null || users === null;

  return (
    <div style={{
      background: "var(--bg-elevated, var(--bg-secondary))",
      border: "1px solid var(--border)",
      borderRadius: 12, padding: "12px 14px", marginBottom: 14,
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>
          🗺️ 프로 지역 커버리지
          {!loading && emptyRegions.length > 0 && (
            <span style={{ color: "#FF3D5A", fontSize: 11.5, fontWeight: 800, marginLeft: 8 }}>
              빈 지역 {emptyRegions.length}곳
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{open ? "접기 ▴" : "펼치기 ▾"}</span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          {loading && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "14px 0" }}>불러오는 중…</div>
          )}
          {!loading && error && (
            <div style={{ fontSize: 12, color: "#FF3D5A", padding: "8px 0" }}>{error}</div>
          )}
          {!loading && !error && (
            <>
              {/* 범례 */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 10.5, color: "var(--text-secondary)", marginBottom: 8 }}>
                <span><span style={dotStyle("rgba(34,197,94,0.85)")}/> 세척+냉매 다 있음</span>
                <span><span style={dotStyle("rgba(255,184,0,0.9)")}/> 한쪽만</span>
                <span><span style={dotStyle("rgba(239,68,68,0.85)")}/> 아무도 없음</span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>
                ⚡ 냉매 지역 = 설치·누수·누설 배정에도 사용 · 전지역 기사는 색에 포함 안 함 (빈 지역 안 가려지게)
              </div>

              {/* 서울 지도 */}
              {svgData && (
                <svg viewBox={`0 0 ${svgData.W} ${svgData.H}`} style={{ width: "100%", maxWidth: 560, height: "auto", display: "block", margin: "0 auto" }}>
                  {svgData.paths.map(p => {
                    const cov = coverage[p.name];
                    const isSel = sel === p.name;
                    return (
                      <path
                        key={p.name} d={p.d}
                        fill={coverFill(cov)}
                        stroke={isSel ? "#FF1B8D" : "var(--border)"}
                        strokeWidth={isSel ? 1.8 : 1}
                        style={{ cursor: "pointer" }}
                        onClick={() => setSel(s => (s === p.name ? "" : p.name))}
                      />
                    );
                  })}
                  {svgData.paths.map(p => {
                    const cov = coverage[p.name];
                    const n = cov ? new Set([...cov.clean, ...cov.refri].map(e => e.id)).size : 0;
                    return (
                      <text key={`t-${p.name}`} x={p.cx} y={p.cy + 2} textAnchor="middle"
                        fontSize={6.5} fontWeight={700} fill="var(--text-primary)"
                        style={{ pointerEvents: "none" }}>
                        {p.name.replace(/구$/, "")}{n > 0 ? ` ${n}` : ""}
                      </text>
                    );
                  })}
                </svg>
              )}

              {/* 경기 / 인천 타일 */}
              {[["경기", GYEONGGI], ["인천", INCHEON]].map(([label, list]) => (
                <div key={label} style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 5 }}>{label}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {list.map(r => {
                      const cov = coverage[r];
                      const n = cov ? new Set([...cov.clean, ...cov.refri].map(e => e.id)).size : 0;
                      const isSel = sel === r;
                      return (
                        <button
                          key={r}
                          onClick={() => setSel(s => (s === r ? "" : r))}
                          style={{
                            background: coverFill(cov),
                            border: `1px solid ${isSel ? "#FF1B8D" : "var(--border)"}`,
                            borderRadius: 7,
                            padding: "4px 8px",
                            fontSize: 10.5, fontWeight: 700,
                            color: "var(--text-primary)",
                            cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          {r}{n > 0 ? ` ${n}` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* 선택 지역 명단 */}
              {sel && (
                <div style={{
                  marginTop: 12, padding: "10px 12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)", borderRadius: 10,
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>📍 {sel}</div>
                  {[["❄ 세척", coverage[sel]?.clean || [], "clean"],
                    ["⚡ 냉매 (설치·누수·누설 포함)", coverage[sel]?.refri || [], "refri"]].map(([lab, list, key]) => (
                    <div key={lab} style={{ fontSize: 11.5, marginBottom: 4, lineHeight: 1.6 }}>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>{lab}: </span>
                      {list.length === 0
                        ? <span style={{ color: "#FF3D5A", fontWeight: 700 }}>없음</span>
                        : list.map(e => `${e.name}(${e[key] || "메인"})`).join(", ")}
                    </div>
                  ))}
                  {allZoneEngineers.length > 0 && (
                    <div style={{ fontSize: 10.5, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
                      + 전지역 가능: {allZoneEngineers.map(e => e.name).join(", ")}
                    </div>
                  )}
                </div>
              )}

              {/* 빈 지역 요약 */}
              {emptyRegions.length > 0 && (
                <div style={{ fontSize: 11, color: "#FF3D5A", marginTop: 10, lineHeight: 1.6 }}>
                  ⚠️ 빈 지역 {emptyRegions.length}곳: {emptyRegions.join(", ")}
                </div>
              )}
              {/* 전지역 기사 */}
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.6 }}>
                🌏 전지역(전국·지역 미설정): {allZoneEngineers.length > 0 ? allZoneEngineers.map(e => e.name).join(", ") : "없음"}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function dotStyle(color) {
  return {
    display: "inline-block", width: 9, height: 9, borderRadius: 2,
    background: color, marginRight: 4, verticalAlign: "-1px",
  };
}

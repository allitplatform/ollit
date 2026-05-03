// V11-5 — 기사 편집 화면용 지역 에디터 (서브그룹 접기/펼치기)
// 시드 구조: engineer.workTypes.cleaning.zones[지역명] / role "main"|"sub"
// 작업 종류 (cleaning / refrigerant) 토글 + 메인/서브 토글
// 서브그룹별 (서울/경기/인천) 접기 — 처음엔 선택된 그룹만 자동으로 펼침
import { useState, useMemo } from "react";
import { loadRegions, getRegionGroups } from "../data/regions.js";

const ROLES = [
  { id: "main", label: "메인", color: "#FF1B8D" },
  { id: "sub",  label: "서브", color: "#00875A" },
];

const WORK_TYPES = [
  { id: "cleaning",    label: "세척" },
  { id: "refrigerant", label: "냉매" },
];

export function EngineerRegionEditor({ engineer, onChange }) {
  const [workType, setWorkType] = useState("cleaning");
  const allRegions = useMemo(() => {
    try { return loadRegions(); } catch { return []; }
  }, []);
  const groups = useMemo(() => getRegionGroups(allRegions), [allRegions]);

  const wt    = engineer.workTypes?.[workType] || { zones: [], role: "main", appliances: [] };
  const zones = wt.zones || [];
  const role  = wt.role  || "main";

  // 서브그룹 접힘 상태 — 선택된 지역이 있는 그룹은 자동 펼침
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const expanded = {};
    groups.forEach(group => {
      expanded[group.id] = group.regions.some(r => zones.includes(r.name));
    });
    return expanded;
  });

  function toggleGroup(groupId) {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  function toggleRegion(regionName) {
    const next = zones.includes(regionName)
      ? zones.filter(z => z !== regionName)
      : [...zones, regionName];
    emitChange({ zones: next });
  }

  function setRole(nextRole) {
    emitChange({ role: nextRole });
  }

  function emitChange(patch) {
    const newWt = { ...wt, ...patch };
    const newWorkTypes = {
      ...(engineer.workTypes || {}),
      [workType]: newWt,
    };
    onChange?.(newWorkTypes);
  }

  return (
    <div>
      {/* 작업 종류 + 역할 토글 */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 12,
        padding: 10, background: "var(--bg-secondary)",
        border: "1px solid var(--border)", borderRadius: 8,
      }}>
        <div style={{ display: "flex", gap: 4 }}>
          {WORK_TYPES.map(w => (
            <button
              key={w.id}
              onClick={() => setWorkType(w.id)}
              style={{
                padding: "5px 10px",
                background: workType === w.id ? "var(--accent, #FF1B8D)" : "transparent",
                border: workType === w.id ? "none" : "1px solid var(--border)",
                color: workType === w.id ? "#fff" : "var(--text-secondary)",
                fontSize: 11, fontWeight: 600, borderRadius: 4,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >{w.label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }}/>
        <div style={{ display: "flex", gap: 4 }}>
          {ROLES.map(r => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              style={{
                padding: "5px 10px",
                background: role === r.id ? r.color : "transparent",
                border: `1px solid ${role === r.id ? r.color : "var(--border)"}`,
                color: role === r.id ? "#fff" : "var(--text-secondary)",
                fontSize: 11, fontWeight: 700, borderRadius: 4,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >{r.label}</button>
          ))}
        </div>
      </div>

      {/* 우선순위 가이드 */}
      <div style={{
        display: "flex", gap: 10, marginBottom: 10,
        padding: 8, background: "var(--bg-secondary)",
        borderRadius: 6, fontSize: 10, color: "var(--text-secondary)",
      }}>
        <span>📍 메인 = 우선 배정 / 서브 = 보조</span>
        <span style={{ marginLeft: "auto" }}>선택: <b style={{ color: "var(--text-primary)" }}>{zones.length}</b>개 지역</span>
      </div>

      {/* 그룹별 접기 / 펼치기 */}
      {groups.map(group => {
        const isExpanded    = expandedGroups[group.id];
        const selectedCount = group.regions.filter(r => zones.includes(r.name)).length;

        return (
          <div key={group.id} style={{
            border: "1px solid var(--border)",
            borderRadius: 8, marginBottom: 6, overflow: "hidden",
          }}>
            <button
              onClick={() => toggleGroup(group.id)}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 12px",
                background: isExpanded ? "var(--bg-inset, var(--bg-secondary))" : "var(--bg-secondary)",
                border: "none", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {isExpanded ? "▼" : "▶"}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                {group.name}
              </span>
              {selectedCount > 0 && (
                <span style={{
                  fontSize: 9, color: "#00875A",
                  background: "rgba(0,135,90,0.15)",
                  padding: "1px 5px", borderRadius: 3, fontWeight: 700,
                }}>
                  {selectedCount}/{group.regions.length} 선택
                </span>
              )}
              <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))" }}>
                {group.regions.length}개
              </span>
            </button>

            {isExpanded && (
              <div style={{ padding: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {group.regions.map(region => {
                  const selected = zones.includes(region.name);
                  return (
                    <button
                      key={region.id}
                      onClick={() => toggleRegion(region.name)}
                      style={{
                        padding: "5px 10px",
                        background: selected ? (role === "main" ? "#FF1B8D" : "#00875A") : "var(--bg-secondary)",
                        border: `1px solid ${selected ? "transparent" : "var(--border)"}`,
                        color: selected ? "#fff" : "var(--text-secondary)",
                        fontSize: 11, fontWeight: selected ? 700 : 500,
                        borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {region.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {groups.length === 0 && (
        <div style={{
          padding: 20, textAlign: "center",
          color: "var(--text-secondary)", fontSize: 12,
          background: "var(--bg-secondary)",
          border: "1px dashed var(--border)",
          borderRadius: 8,
        }}>
          활성 지역이 없습니다 — 지역 관리에서 추가하세요
        </div>
      )}
    </div>
  );
}

export default EngineerRegionEditor;

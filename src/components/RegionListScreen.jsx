// Step 8 V2 — 지역 관리 (모든 그룹 기본 접힘 + 지역 인라인 펼침)
// 지역 클릭 → 담당 기사 명단 인라인 + [+ 기사 추가] 모달
import { useState, useMemo, useRef, useEffect } from "react";
import {
  loadRegions, loadGroups, activateGroup, deactivateGroup,
  REGION_SUBGROUPS, countEngineersByRegion,
} from "../data/regions.js";
import { loadEngineers, saveEngineers } from "../data/engineers.js";
import { EngineerBadge } from "./EngineerBadge.jsx";
// 2026-07-20 — 지역 커버리지 지도 (서울 GeoJSON + 경기/인천 타일, DB fresh)
import EngineerCoverageMap from "./EngineerCoverageMap.jsx";

export function RegionListScreen({ onBack, onAdd, onEdit }) {
  const [regions]   = useState(() => loadRegions());
  const [engineers, setEngineers] = useState(() => loadEngineers());
  const [groups, setGroups] = useState(() => loadGroups());
  const [search, setSearch] = useState("");
  // 모든 그룹 기본 접힘
  const [expandedGroups, setExpandedGroups] = useState({});
  // 지역별 펼침 상태 (인라인 — 담당 기사 명단)
  const [expandedRegions, setExpandedRegions] = useState({});
  // [+ 기사 추가] 모달
  const [addEngineerRegion, setAddEngineerRegion] = useState(null);

  function toggleGroup(groupId) {
    setExpandedGroups(e => ({ ...e, [groupId]: !e[groupId] }));
  }
  function toggleRegion(regionId) {
    setExpandedRegions(e => ({ ...e, [regionId]: !e[regionId] }));
  }

  // 지역의 담당 기사 + 작업 종류 + 역할 추출
  function getRegionEngineers(regionName) {
    return engineers.filter(e => {
      const cleaning = e.workTypes?.cleaning?.zones || [];
      const refrigerant = e.workTypes?.refrigerant?.zones || [];
      return cleaning.includes(regionName) || refrigerant.includes(regionName);
    }).map(e => {
      const isCleaning    = (e.workTypes?.cleaning?.zones    || []).includes(regionName);
      const isRefrigerant = (e.workTypes?.refrigerant?.zones || []).includes(regionName);
      let workType = "";
      if (isCleaning && isRefrigerant) workType = "세척 · 냉매";
      else if (isCleaning) workType = "세척";
      else if (isRefrigerant) workType = "냉매";

      // 역할 (메인/백업)
      let role = null;
      if (isCleaning) role = e.workTypes?.cleaning?.role || null;
      if (!role && isRefrigerant) role = e.workTypes?.refrigerant?.role || null;
      if (role === "sub") role = "backup";

      return { ...e, _workType: workType, _role: role };
    });
  }

  function removeEngineerFromRegion(engineerId, regionName) {
    if (!window.confirm(`${regionName}에서 이 프로를 제거할까요?`)) return;
    const updated = engineers.map(e => {
      if (e.id !== engineerId) return e;
      const next = { ...e, workTypes: { ...e.workTypes } };
      ["cleaning", "refrigerant"].forEach(wt => {
        if (next.workTypes[wt]?.zones) {
          next.workTypes[wt] = {
            ...next.workTypes[wt],
            zones: next.workTypes[wt].zones.filter(z => z !== regionName),
          };
        }
      });
      return next;
    });
    saveEngineers(updated);
    setEngineers(updated);
  }

  function handleAddEngineerComplete() {
    setEngineers(loadEngineers());
    setAddEngineerRegion(null);
  }

  function handleActivateGroup(groupId) {
    const ok = window.confirm("이 그룹을 활성화할까요?\n활성화 후 [+ 추가]로 지역을 등록할 수 있습니다.");
    if (!ok) return;
    activateGroup(groupId);
    setGroups(loadGroups());
    setExpandedGroups(e => ({ ...e, [groupId]: true }));
  }

  function handleDeactivateGroup(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const ok = window.confirm(
      `${group.name} 그룹을 비활성화할까요?\n\n` +
      `비활성 상태에서는 작업을 받을 수 없고,\n` +
      `다시 활성화하면 복원됩니다.`
    );
    if (!ok) return;
    deactivateGroup(groupId);
    setGroups(loadGroups());
  }

  // 통계
  const totalStats = useMemo(() => {
    const activeRegions = regions.filter(r => r.active);
    const allEngineers = new Set();
    activeRegions.forEach(r => {
      engineers.forEach(e => {
        const cleaning    = e.workTypes?.cleaning?.zones    || [];
        const refrigerant = e.workTypes?.refrigerant?.zones || [];
        if (cleaning.includes(r.name) || refrigerant.includes(r.name)) {
          allEngineers.add(e.id);
        }
      });
    });
    const unassigned = activeRegions.filter(r =>
      countEngineersByRegion(r.name, engineers) === 0
    ).length;
    return {
      active: activeRegions.length,
      engineers: allEngineers.size,
      unassigned,
    };
  }, [regions, engineers]);

  const groupStats = useMemo(() => {
    const stats = {};
    groups.forEach(g => {
      const subgroups = REGION_SUBGROUPS.filter(sg => sg.groupId === g.id);
      const groupRegions = regions.filter(r =>
        subgroups.some(sg => sg.id === r.subgroupId)
      );
      const totalEngineers = new Set();
      groupRegions.forEach(r => {
        engineers.forEach(e => {
          const cleaning    = e.workTypes?.cleaning?.zones    || [];
          const refrigerant = e.workTypes?.refrigerant?.zones || [];
          if (cleaning.includes(r.name) || refrigerant.includes(r.name)) {
            totalEngineers.add(e.id);
          }
        });
      });
      stats[g.id] = {
        regionCount: groupRegions.length,
        engineerCount: totalEngineers.size,
        unassignedCount: groupRegions.filter(r =>
          countEngineersByRegion(r.name, engineers) === 0
        ).length,
      };
    });
    return stats;
  }, [regions, engineers, groups]);

  const activeGroups   = groups.filter(g => g.active);
  const inactiveGroups = groups.filter(g => !g.active);

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif", paddingBottom: 80 }}>
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>지역 관리</div>
        <button onClick={onAdd} style={addBtnStyle}>+ 추가</button>
      </div>

      <div style={{ padding: 16 }}>
        <input
          type="text" placeholder="🔍 지역 검색"
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={searchStyle}
        />

        <div style={statsRowStyle}>
          <Stat label="활성 지역"   value={totalStats.active}    suffix="개" color="var(--text-primary)"/>
          <Stat label="배정 프로"   value={totalStats.engineers} suffix="명" color="#00875A"/>
          <Stat label="미배정"     value={totalStats.unassigned} suffix="개" color={totalStats.unassigned > 0 ? "#FF1B8D" : "var(--text-secondary)"}/>
        </div>

        {/* 2026-07-20 — 커버리지 지도 (사장님 spec: "지도로 나눠 있으면 보기 편할 것") */}
        <EngineerCoverageMap/>

        <SectionLabel>활성 지역</SectionLabel>
        {activeGroups.map(group => (
          <GroupCard
            key={group.id}
            group={group}
            stats={groupStats[group.id]}
            expanded={expandedGroups[group.id]}
            onToggle={() => toggleGroup(group.id)}
            regions={regions.filter(r => {
              const sg = REGION_SUBGROUPS.find(s => s.id === r.subgroupId);
              return sg?.groupId === group.id;
            })}
            engineers={engineers}
            search={search}
            expandedRegions={expandedRegions}
            onToggleRegion={toggleRegion}
            getRegionEngineers={getRegionEngineers}
            onEditRegion={onEdit}
            onRemoveEngineer={removeEngineerFromRegion}
            onAddEngineer={(region) => setAddEngineerRegion(region)}
            onDeactivate={handleDeactivateGroup}
          />
        ))}

        {inactiveGroups.length > 0 && (
          <>
            <SectionLabel>지방 (추가 예정)</SectionLabel>
            {inactiveGroups.map(group => (
              <InactiveGroupCard
                key={group.id} group={group}
                onActivate={() => handleActivateGroup(group.id)}
              />
            ))}
          </>
        )}

        <InfoBox>
          ℹ️ 미배정 = 작업이 들어왔을 때 안내됨 (담당 프로 없음)<br/>
          ℹ️ 지역을 펼치면 담당 프로 명단을 보고 추가/제거할 수 있어요
        </InfoBox>
      </div>

      {/* [+ 기사 추가] 모달 */}
      {addEngineerRegion && (
        <AddEngineerModal
          region={addEngineerRegion}
          allEngineers={engineers}
          onClose={() => setAddEngineerRegion(null)}
          onComplete={handleAddEngineerComplete}
        />
      )}
    </div>
  );
}

// ===== 그룹 카드 =====
function GroupCard({
  group, stats, expanded, onToggle,
  regions, engineers, search,
  expandedRegions, onToggleRegion, getRegionEngineers,
  onEditRegion, onRemoveEngineer, onAddEngineer,
  onDeactivate,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const subgroups = REGION_SUBGROUPS
    .filter(sg => sg.groupId === group.id)
    .sort((a, b) => a.order - b.order);
  const regionsCount = stats?.regionCount || 0;
  const canDeactivate = regionsCount === 0;

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!showMenu) return;
    function handleClickOutside(e) {
      if (menuRef.current?.contains(e.target)) return;
      if (buttonRef.current?.contains(e.target)) return;
      setShowMenu(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  function handleHeaderClick(e) {
    // [⋯] 버튼 영역이면 토글 X
    if (buttonRef.current?.contains(e.target)) return;
    if (menuRef.current?.contains(e.target)) return;
    onToggle();
  }

  function handleMenuButtonClick(e) {
    e.stopPropagation();
    e.preventDefault();
    setShowMenu(prev => !prev);
  }

  function handleDeactivateClick(e) {
    e.stopPropagation();
    e.preventDefault();
    setShowMenu(false);
    onDeactivate && onDeactivate(group.id);
  }

  return (
    <div style={{ ...cardStyle, overflow: "visible" }}>
      <div onClick={handleHeaderClick} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px", background: "var(--bg-tertiary)",
        borderRadius: expanded ? "10px 10px 0 0" : "10px",
        position: "relative", cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{expanded ? "▼" : "▶"}</span>
          <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{group.name}</span>
          <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>· {regionsCount}개</span>
          {stats?.unassignedCount > 0 && (
            <span style={{ fontSize: 10, color: "#FF1B8D" }}>· 미배정 {stats.unassignedCount}</span>
          )}
        </div>
        <span style={{ fontSize: 10, color: "#00875A", marginRight: 6 }}>프로 {stats?.engineerCount || 0}명</span>
        {/* [⋯] 메뉴 — useRef + 외부 클릭 감지 */}
        <div style={{ position: "relative" }}>
          <button
            ref={buttonRef}
            type="button"
            onClick={handleMenuButtonClick}
            style={{
              background: showMenu ? "var(--accent-soft)" : "transparent",
              border: "none", color: "var(--text-secondary)",
              fontSize: 18, cursor: "pointer",
              padding: "4px 10px", borderRadius: 4, lineHeight: 1,
              fontFamily: "inherit",
            }}
            aria-label="메뉴"
          >⋯</button>
          {showMenu && (
            <div
              ref={menuRef}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute", top: "100%", right: 0, marginTop: 4,
                background: "var(--bg-secondary)", border: "1px solid var(--border)",
                borderRadius: 10, padding: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                zIndex: 1000, minWidth: 200,
              }}
            >
              {canDeactivate ? (
                <button
                  type="button"
                  onClick={handleDeactivateClick}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 12px", background: "transparent", border: "none",
                    width: "100%", textAlign: "left",
                    color: "var(--text-primary)", fontSize: 12, cursor: "pointer",
                    borderRadius: 6, fontFamily: "inherit",
                  }}
                >💤 비활성화</button>
              ) : (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 12px",
                  color: "var(--text-tertiary)", fontSize: 12,
                  cursor: "not-allowed", opacity: 0.7,
                }}>🔒 비활성화 (지역 {regionsCount}개)</div>
              )}
            </div>
          )}
        </div>
      </div>

      {expanded && subgroups.map(sg => {
        const sgRegions = regions
          .filter(r => r.subgroupId === sg.id)
          .filter(r => !search || r.name.includes(search));
        if (sgRegions.length === 0 && search) return null;
        return (
          <div key={sg.id} style={{ padding: "10px 14px", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>
              {sg.name} ({sgRegions.length}{sg.id === "seoul" ? "구" : "시군"})
            </div>
            {sgRegions.length === 0 && (
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", padding: "4px 0" }}>등록된 지역 없음</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sgRegions.map(r => (
                <RegionItem
                  key={r.id} region={r}
                  expanded={expandedRegions[r.id]}
                  onToggle={() => onToggleRegion(r.id)}
                  regionEngineers={getRegionEngineers(r.name)}
                  onEditRegion={onEditRegion}
                  onRemoveEngineer={onRemoveEngineer}
                  onAddEngineer={onAddEngineer}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== 지역 한 줄 (인라인 펼침) =====
function RegionItem({ region, expanded, onToggle, regionEngineers, onEditRegion, onRemoveEngineer, onAddEngineer }) {
  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: `1px solid ${expanded ? "#FF1B8D" : "var(--bg-tertiary)"}`,
      borderRadius: 8, overflow: "hidden",
    }}>
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 12px", cursor: "pointer",
        background: "transparent",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: expanded ? "#FF1B8D" : "var(--text-secondary)", fontSize: 10 }}>
            {expanded ? "▼" : "▶"}
          </span>
          <span style={{
            fontSize: 12,
            color: region.active ? "var(--text-primary)" : "var(--text-tertiary)",
            fontWeight: expanded ? 600 : 400,
            textDecoration: region.active ? "none" : "line-through",
          }}>{region.name}</span>
          {!region.active && (
            <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>· 비활성</span>
          )}
        </div>
        {regionEngineers.length > 0 ? (
          <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>담당 {regionEngineers.length}명</span>
        ) : (
          <span style={{ fontSize: 10, color: "#FF1B8D" }}>미배정</span>
        )}
      </div>

      {expanded && (
        <div style={{
          padding: "10px 12px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-primary)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 500 }}>담당 프로</div>
            <button
              onClick={(e) => { e.stopPropagation(); onEditRegion(region); }}
              style={editRegionBtnStyle}
            >지역 편집</button>
          </div>

          {regionEngineers.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
              {regionEngineers.map(eng => (
                <div key={eng.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 8px",
                  background: "var(--bg-secondary)", borderRadius: 6,
                }}>
                  <EngineerBadge engineer={eng} role={eng._role} size="sm"/>
                  <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--text-tertiary)" }}>
                    {eng._workType}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveEngineer(eng.id, region.name); }}
                    style={removeBtnStyle}
                  >×</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 10, padding: "8px 0" }}>
              아직 담당 프로가 없어요
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); onAddEngineer(region); }}
            style={addEngBtnStyle}
          >+ 프로 추가</button>
        </div>
      )}
    </div>
  );
}

// ===== [+ 기사 추가] 모달 =====
function AddEngineerModal({ region, allEngineers, onClose, onComplete }) {
  const [workType, setWorkType] = useState("cleaning");
  const [role,     setRole]     = useState("backup");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // 이 지역을 담당하지 않는 기사 (검색 적용)
  const candidates = allEngineers.filter(e => {
    const zones = e.workTypes?.[workType]?.zones || [];
    if (zones.includes(region.name)) return false;
    if (e.status !== "active") return false;

    // 검색 필터 (이름 / 연락처 / 다른 지역명)
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const name  = (e.name || "").toLowerCase();
    const phone = (e.phone || "").toLowerCase();
    const zoneAll = [
      ...(e.workTypes?.cleaning?.zones    || []),
      ...(e.workTypes?.refrigerant?.zones || []),
    ].join(" ").toLowerCase();
    return name.includes(q) || phone.includes(q) || zoneAll.includes(q);
  });

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    if (selectedIds.size === 0) {
      alert("프로를 선택해주세요");
      return;
    }
    const updated = allEngineers.map(e => {
      if (!selectedIds.has(e.id)) return e;
      const cur = e.workTypes?.[workType] || { role: "none", zones: [], appliances: [] };
      const nextZones = [...(cur.zones || [])];
      if (!nextZones.includes(region.name)) nextZones.push(region.name);
      return {
        ...e,
        workTypes: {
          ...e.workTypes,
          [workType]: {
            ...cur,
            role: cur.role === "none" ? role : cur.role,
            zones: nextZones,
          },
        },
      };
    });
    saveEngineers(updated);
    onComplete();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)", zIndex: 100,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, maxHeight: "85vh",
          background: "var(--bg-primary)", borderRadius: "16px 16px 0 0",
          padding: "20px 16px", overflow: "auto",
          fontFamily: "-apple-system, 'Pretendard', sans-serif",
          color: "var(--text-primary)",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          {region.name}에 프로 추가
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 16 }}>
          이 지역을 담당하지 않는 프로 목록
        </div>

        {/* 작업 종류 */}
        <div style={{ marginBottom: 12 }}>
          <div style={subLabelStyle}>작업 종류</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { k: "cleaning",    label: "세척" },
              { k: "refrigerant", label: "냉매" },
            ].map(opt => (
              <div key={opt.k} onClick={() => setWorkType(opt.k)}
                style={{
                  flex: 1, padding: "8px 12px", textAlign: "center",
                  background: "var(--bg-secondary)",
                  border: workType === opt.k ? "2px solid #FF1B8D" : "1px solid var(--border)",
                  borderRadius: 7, fontSize: 12,
                  color: workType === opt.k ? "#FF1B8D" : "var(--text-secondary)",
                  cursor: "pointer", fontWeight: workType === opt.k ? 700 : 500,
                }}
              >{opt.label}</div>
            ))}
          </div>
        </div>

        {/* 역할 */}
        <div style={{ marginBottom: 12 }}>
          <div style={subLabelStyle}>역할 (해당 작업 종류 미설정 프로일 때 적용)</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { k: "main",   label: "메인" },
              { k: "backup", label: "서브" },
            ].map(opt => (
              <div key={opt.k} onClick={() => setRole(opt.k)}
                style={{
                  flex: 1, padding: "8px 12px", textAlign: "center",
                  background: role === opt.k ? "rgba(0,135,90,0.15)" : "var(--bg-secondary)",
                  border: `1px solid ${role === opt.k ? "#00875A" : "var(--bg-tertiary)"}`,
                  borderRadius: 7, fontSize: 12,
                  color: role === opt.k ? "#00875A" : "var(--text-secondary)",
                  cursor: "pointer", fontWeight: role === opt.k ? 600 : 400,
                }}
              >{opt.label}</div>
            ))}
          </div>
        </div>

        {/* 검색 input (V11-9) */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름 / 연락처 / 다른 지역 검색"
            style={{
              width: "100%",
              padding: "9px 32px 9px 12px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: 12, fontFamily: "inherit",
              outline: "none", boxSizing: "border-box",
            }}
          />
          <span style={{
            position: "absolute", right: 10, top: "50%",
            transform: "translateY(-50%)",
            fontSize: 13, color: "var(--text-tertiary, var(--text-secondary))",
            pointerEvents: "none",
          }}>🔍</span>
        </div>

        {/* 후보 목록 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={subLabelStyle}>
              후보 프로 ({candidates.length}명)
              {searchQuery && (
                <span style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))", marginLeft: 4 }}>
                  · "{searchQuery}" 검색
                </span>
              )}
            </div>
            <span style={{ fontSize: 10, color: "#FF1B8D" }}>선택 {selectedIds.size}</span>
          </div>
          {candidates.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
              {searchQuery
                ? "검색 결과가 없습니다"
                : "모든 프로가 이미 이 지역을 담당하고 있습니다"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflow: "auto" }}>
              {candidates.map(eng => {
                const selected = selectedIds.has(eng.id);
                return (
                  <div
                    key={eng.id}
                    onClick={() => toggleSelect(eng.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px",
                      background: "var(--bg-secondary)",
                      border: selected ? "2px solid #FF1B8D" : "1px solid var(--border)",
                      borderRadius: 6, cursor: "pointer",
                    }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: 4,
                      background: selected ? "#FF1B8D" : "transparent",
                      border: `1.5px solid ${selected ? "#FF1B8D" : "var(--text-tertiary)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {selected && <span style={{ color: "var(--text-primary)", fontSize: 10, fontWeight: 800 }}>✓</span>}
                    </span>
                    <EngineerBadge engineer={eng} size="sm"/>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={cancelBtnStyle}>닫기</button>
          <button onClick={handleSubmit} style={addBtnStyleLarge}>
            추가{selectedIds.size > 0 && ` (${selectedIds.size}명)`}
          </button>
        </div>
      </div>
    </div>
  );
}

function InactiveGroupCard({ group, onActivate }) {
  return (
    <div style={{
      background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10,
      padding: "12px 14px", marginBottom: 6,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.6 }}>
        <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>▶</span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>{group.name}</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onActivate(); }}
        style={{
          background: "#FF1B8D",
          border: "none",
          color: "#fff", fontSize: 11,
          padding: "5px 12px", borderRadius: 6, cursor: "pointer",
          fontWeight: 700, fontFamily: "inherit",
        }}
      >+ 활성화</button>
    </div>
  );
}

function Stat({ label, value, suffix, color }) {
  return (
    <div style={{
      flex: 1, padding: "10px 12px",
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      borderRadius: 8, textAlign: "center",
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "inherit" }}>
        {value}<span style={{ fontSize: 10, color: "var(--text-secondary)", marginLeft: 2 }}>{suffix}</span>
      </div>
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, color: "var(--text-secondary)", fontWeight: 600,
      marginTop: 18, marginBottom: 8, letterSpacing: 0.3,
    }}>{children}</div>
  );
}

function InfoBox({ children, color = "#FF1B8D" }) {
  return (
    <div style={{
      marginTop: 18,
      padding: "12px 14px",
      background: color + "12",
      border: `1px solid ${color}40`,
      borderRadius: 8,
      fontSize: 11, color: "var(--text-primary)", lineHeight: 1.6,
    }}>
      {children}
    </div>
  );
}

// 스타일
const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 16px", borderBottom: "1px solid var(--border)",
  position: "sticky", top: 0, background: "var(--bg-primary)", zIndex: 10,
};
const backBtnStyle = { background: "none", border: "none", color: "var(--text-primary)", fontSize: 18, cursor: "pointer", padding: 4 };
const titleStyle = { fontSize: 15, fontWeight: 500 };
const addBtnStyle = {
  background: "#FF1B8D", border: "none", color: "#fff",
  fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 6, cursor: "pointer",
  fontFamily: "inherit",
};
const searchStyle = {
  width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 10, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13,
  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  marginBottom: 12,
};
const statsRowStyle = { display: "flex", gap: 6, marginBottom: 12 };
const cardStyle = {
  background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 10, marginBottom: 8, overflow: "hidden",
};
const subLabelStyle = { fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 500 };
const removeBtnStyle = {
  background: "transparent", border: "none", color: "var(--text-secondary)",
  fontSize: 16, cursor: "pointer", padding: "0 4px",
  fontFamily: "inherit", lineHeight: 1,
};
const editRegionBtnStyle = {
  background: "transparent", border: "1px solid var(--border)",
  color: "var(--text-secondary)", fontSize: 10, fontWeight: 500,
  padding: "3px 10px", borderRadius: 5, cursor: "pointer",
  fontFamily: "inherit",
};
const addEngBtnStyle = {
  width: "100%", padding: "10px",
  background: "rgba(0,135,90,0.10)", border: "1px solid rgba(0,135,90,0.30)",
  color: "#00875A", fontSize: 12, fontWeight: 600,
  borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
};
const cancelBtnStyle = {
  flex: 1, background: "var(--bg-secondary)", border: "1px solid var(--border)",
  color: "var(--text-secondary)", fontSize: 14, fontWeight: 500,
  padding: 12, borderRadius: 10, cursor: "pointer",
  fontFamily: "inherit",
};
const addBtnStyleLarge = {
  flex: 2, background: "#FF1B8D", border: "none",
  color: "var(--text-primary)", fontSize: 14, fontWeight: 600,
  padding: 12, borderRadius: 10, cursor: "pointer",
  fontFamily: "inherit",
};

export default RegionListScreen;

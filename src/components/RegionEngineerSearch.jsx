// V11-5 — 지역관리: 후보 기사 검색 + 메인/서브 추가 모달
// 시드 구조: engineer.workTypes.cleaning.zones[] / refrigerant.zones[]
// 이 지역에 이미 등록된 기사는 후보에서 자동 제외.
// 검색: 이름 / 연락처 / 다른 지역명 / 작업 종류
import { useState, useMemo } from "react";
import { loadEngineers, saveEngineers } from "../data/engineers.js";
import { EngineerBadge } from "./EngineerBadge.jsx";

const ROLES = [
  { id: "main", label: "메인", color: "#FF1B8D" },
  { id: "sub",  label: "서브", color: "#00875A" },
];

const WORK_TYPES = [
  { id: "cleaning",    label: "세척" },
  { id: "refrigerant", label: "냉매" },
];

export function RegionEngineerSearch({ region, onClose, onAdded }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [workType, setWorkType]       = useState("cleaning");
  const [tick, setTick]               = useState(0);

  const allEngineers = useMemo(() => {
    try { return loadEngineers(); } catch { return []; }
  }, [tick]);

  // 이 지역에 (해당 작업종류로) 아직 등록되지 않은 기사만
  const availableEngineers = useMemo(
    () => allEngineers.filter(e => {
      const zones = e.workTypes?.[workType]?.zones || [];
      return !zones.includes(region.name);
    }),
    [allEngineers, region.name, workType]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availableEngineers;
    return availableEngineers.filter(e => {
      const name  = (e.name || "").toLowerCase();
      const phone = (e.phone || "").toLowerCase();
      const zonesC = (e.workTypes?.cleaning?.zones    || []).join(" ");
      const zonesR = (e.workTypes?.refrigerant?.zones || []).join(" ");
      return name.includes(q) || phone.includes(q) || zonesC.includes(q) || zonesR.includes(q);
    });
  }, [availableEngineers, searchQuery]);

  function handleAdd(engineerId, role) {
    const list = loadEngineers();
    const idx  = list.findIndex(e => e.id === engineerId);
    if (idx < 0) return;
    const eng = list[idx];

    const nextWt = {
      ...(eng.workTypes || {}),
      [workType]: {
        ...(eng.workTypes?.[workType] || { appliances: [] }),
        zones: [...new Set([...(eng.workTypes?.[workType]?.zones || []), region.name])],
        role:   eng.workTypes?.[workType]?.role || role,
      },
    };
    list[idx] = { ...eng, workTypes: nextWt };
    saveEngineers(list);
    setTick(v => v + 1);
    onAdded?.(eng, role);
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            📍 {region.name}에 프로 추가
          </div>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        <div style={{ padding: 16 }}>
          {/* 작업 종류 토글 */}
          <div style={{
            display: "flex", gap: 6, marginBottom: 12,
            padding: 8, background: "var(--bg-secondary)",
            border: "1px solid var(--border)", borderRadius: 8,
          }}>
            <span style={{ fontSize: 10, color: "var(--text-secondary)", alignSelf: "center" }}>
              작업 종류
            </span>
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

          {/* 검색란 */}
          <div style={{ position: "relative", marginBottom: 14 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름 / 연락처 / 다른 지역 검색"
              autoFocus
              style={{
                width: "100%",
                padding: "10px 32px 10px 12px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 12,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <span style={{
              position: "absolute", right: 10, top: "50%",
              transform: "translateY(-50%)",
              fontSize: 14, color: "var(--text-tertiary, var(--text-secondary))",
            }}>🔍</span>
          </div>

          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 8 }}>
            후보 프로 <b style={{ color: "var(--text-primary)" }}>{filtered.length}</b>명
            {" "}/ 전체 {availableEngineers.length}명
          </div>

          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{
                padding: 30, textAlign: "center",
                color: "var(--text-secondary)", fontSize: 12,
                background: "var(--bg-secondary)",
                border: "1px dashed var(--border)",
                borderRadius: 8,
              }}>
                {searchQuery ? "검색 결과가 없습니다" : "추가 가능한 프로가 없습니다"}
              </div>
            ) : (
              filtered.map(eng => (
                <EngineerSearchRow
                  key={eng.id}
                  engineer={eng}
                  workType={workType}
                  onAdd={(role) => handleAdd(eng.id, role)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EngineerSearchRow({ engineer, workType, onAdd }) {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const wt = engineer.workTypes?.[workType];
  const otherZones = (wt?.zones || []).slice(0, 4);

  return (
    <div style={{
      padding: 10,
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 8, marginBottom: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <EngineerBadge engineer={engineer} size="sm"/>

        {!showRoleMenu ? (
          <button
            onClick={() => setShowRoleMenu(true)}
            style={{
              padding: "5px 10px",
              background: "#FF1B8D", border: "none",
              borderRadius: 5, color: "#fff",
              fontSize: 10, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >추가</button>
        ) : (
          <div style={{ display: "flex", gap: 4 }}>
            {ROLES.map(r => (
              <button
                key={r.id}
                onClick={() => { onAdd(r.id); setShowRoleMenu(false); }}
                style={{
                  padding: "5px 8px",
                  background: r.color, border: "none",
                  borderRadius: 4, color: "#fff",
                  fontSize: 10, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >{r.label}</button>
            ))}
            <button
              onClick={() => setShowRoleMenu(false)}
              style={{
                padding: "5px 8px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "var(--text-secondary)",
                fontSize: 10, cursor: "pointer", fontFamily: "inherit",
              }}
            >취소</button>
          </div>
        )}
      </div>

      {/* 같은 작업종류의 기존 지역 (있는 경우) */}
      {otherZones.length > 0 && (
        <div style={{
          marginTop: 6, paddingTop: 6,
          borderTop: "1px dashed var(--border)",
          display: "flex", gap: 4, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))" }}>
            현재 {workType === "cleaning" ? "세척" : "냉매"} 담당:
          </span>
          {otherZones.map((z, idx) => (
            <span key={idx} style={{
              fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))",
              background: "var(--bg-inset, var(--bg-secondary))",
              padding: "1px 5px", borderRadius: 3,
            }}>
              {z}
            </span>
          ))}
          {(wt?.zones || []).length > 4 && (
            <span style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))" }}>
              +{(wt?.zones || []).length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.6)",
  zIndex: 1000,
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 16,
};

const modalStyle = {
  width: 480, maxWidth: "100%",
  maxHeight: "85vh",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  display: "flex", flexDirection: "column",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
  color: "var(--text-primary)",
  overflow: "hidden",
};

const modalHeaderStyle = {
  padding: "14px 16px",
  borderBottom: "1px solid var(--border)",
  display: "flex", alignItems: "center", justifyContent: "space-between",
};

const closeButtonStyle = {
  width: 28, height: 28, borderRadius: "50%",
  background: "var(--bg-secondary)", border: "none",
  color: "var(--text-secondary)",
  fontSize: 14, cursor: "pointer", fontFamily: "inherit",
};

export default RegionEngineerSearch;

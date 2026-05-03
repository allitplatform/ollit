// V11-10 — 전체 기사에서 선택 모달
// 모든 활성 기사 점수순 + 검색 (이름/연락처/지역)
// AutoAssignScreen 또는 RecommendScreen에서 "전체 기사에서 선택" 버튼 클릭 시 띄움
import { useState, useMemo } from "react";
import { recommendEngineers } from "../utils/engineerRecommendation.js";
import { loadEngineers } from "../data/engineers.js";

const TIER_COLOR = {
  best:     "#FF1B8D",
  good:     "#00875A",
  possible: "#FF1B8D",
  fallback: "#888780",
};

const TIER_LABEL = {
  best:     "최적",
  good:     "추천",
  possible: "가능",
  fallback: "어려움",
};

const REGION_LABEL = {
  main:     "메인",
  sub:      "서브",
  possible: "인접",
  none:     "지역 외",
};

export function AllEngineersModal({ task, engineers: enginerProp, onSelect, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");

  const engineers = useMemo(() => {
    if (Array.isArray(enginerProp)) return enginerProp;
    try { return loadEngineers(); } catch { return []; }
  }, [enginerProp]);

  const allScored = useMemo(
    () => recommendEngineers(task, { limit: 999, engineers }),
    [task, engineers]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allScored;
    return allScored.filter(rec => {
      const e = rec.engineer;
      const name  = (e.name || "").toLowerCase();
      const phone = (e.phone || "").toLowerCase();
      const zonesAll = [
        ...(e.workTypes?.cleaning?.zones    || []),
        ...(e.workTypes?.refrigerant?.zones || []),
      ].join(" ").toLowerCase();
      return name.includes(q) || phone.includes(q) || zonesAll.includes(q);
    });
  }, [allScored, searchQuery]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              👥 전체 기사 {engineers.length}명
            </div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
              점수 높은 순 · 검색 가능
            </div>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름 / 연락처 / 지역 검색"
              autoFocus
              style={inputStyle}
            />
            <span style={{
              position: "absolute", right: 10, top: "50%",
              transform: "translateY(-50%)",
              fontSize: 13, color: "var(--text-tertiary, var(--text-secondary))",
              pointerEvents: "none",
            }}>🔍</span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 6 }}>
            {filtered.length}명 검색됨
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
              {searchQuery ? "검색 결과가 없습니다" : "활성 기사가 없습니다"}
            </div>
          ) : (
            filtered.map(rec => (
              <AllEngineerRow
                key={rec.engineer.id}
                recommendation={rec}
                onSelect={() => onSelect(rec.engineer.id, rec.engineer)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AllEngineerRow({ recommendation, onSelect }) {
  const { engineer, score, regionMatch, tier } = recommendation;
  const tierColor = TIER_COLOR[tier];

  const careerLabel = engineer.careerLevel === "expert" ? "⭐ 베테랑"
    : engineer.careerLevel === "career" ? "경력"
    : engineer.careerLevel === "rookie" ? "신입" : "—";

  return (
    <button
      onClick={onSelect}
      style={{
        width: "100%", padding: 10, marginBottom: 4,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        cursor: "pointer", textAlign: "left",
        fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
            {engineer.name}
          </span>
          <span style={{
            fontSize: 9, color: tierColor,
            background: `${tierColor}26`,
            padding: "1px 5px", borderRadius: 3, fontWeight: 700,
          }}>
            {TIER_LABEL[tier]}
          </span>
        </div>
        <span style={{
          fontSize: 13, color: tierColor,
          fontWeight: 700, fontFamily: "monospace",
        }}>
          {score}
        </span>
      </div>

      <div style={{
        fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))",
        display: "flex", gap: 6, alignItems: "center",
      }}>
        <span>{careerLabel}</span>
        <span>·</span>
        <span>{REGION_LABEL[regionMatch]}</span>
      </div>
    </button>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1100,
  padding: 16,
};

const contentStyle = {
  width: 480, maxWidth: "100%", maxHeight: "85vh",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  display: "flex", flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  fontFamily: "-apple-system, 'Spoqa Han Sans Neo', sans-serif",
  color: "var(--text-primary)",
};

const headerStyle = {
  padding: "14px 16px",
  borderBottom: "1px solid var(--border)",
  display: "flex", alignItems: "flex-start", justifyContent: "space-between",
};

const closeButtonStyle = {
  width: 28, height: 28, borderRadius: "50%",
  background: "var(--bg-secondary)", border: "none",
  color: "var(--text-secondary)",
  fontSize: 14, cursor: "pointer", fontFamily: "inherit",
};

const inputStyle = {
  width: "100%",
  padding: "10px 32px 10px 12px",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 12, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};

export default AllEngineersModal;

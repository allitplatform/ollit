// Step 6 — 기사 관리 리스트 화면
// 사장님 catch: 코드 수정 0번 / 화면에서 직접 추가/삭제
import { useState, useMemo } from "react";
import {
  loadEngineers, CAREER_LEVELS, STATUS_OPTIONS,
} from "../data/engineers.js";
import { EngineerBadge } from "./EngineerBadge.jsx";

export function EngineerListScreen({ onEdit, onAdd, onBack, onClickRegions }) {
  // 매번 마운트 시 localStorage 다시 읽음 (편집 후 복귀 시 새 데이터 반영)
  const [engineers] = useState(() => loadEngineers());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    return engineers.filter(e => {
      // 검색 (이름 OR 지역)
      if (search) {
        const inName = e.name.includes(search);
        const inZones = Object.values(e.workTypes)
          .flatMap(w => w.zones || [])
          .some(z => z.includes(search));
        if (!inName && !inZones) return false;
      }
      // 필터
      if (filter === "cleaning"    && e.workTypes.cleaning.role === "none")    return false;
      if (filter === "refrigerant" && e.workTypes.refrigerant.role === "none") return false;
      if (filter === "rookie"      && e.careerLevel !== "rookie")              return false;
      return true;
    });
  }, [engineers, search, filter]);

  const counts = useMemo(() => ({
    active: engineers.filter(e => e.status === "active").length,
    off:    engineers.filter(e => e.status === "off").length,
    quit:   engineers.filter(e => e.status === "quit").length,
    rookie: engineers.filter(e => e.careerLevel === "rookie").length,
  }), [engineers]);

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif" }}>

      {/* 헤더 */}
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>기사 관리</div>
        <div style={{ display: "flex", gap: 6 }}>
          {onClickRegions && (
            <button onClick={onClickRegions} style={regionsBtnStyle}>📍 지역</button>
          )}
          <button onClick={onAdd} style={addBtnStyle}>+ 추가</button>
        </div>
      </div>

      {/* 카운터 */}
      <div style={countersStyle}>
        <span style={{ color: "var(--text-primary)" }}>활동 <strong style={{ color: "#00875A" }}>{counts.active}</strong></span>
        <span style={{ color: "var(--text-secondary)", marginLeft: 10 }}>· 휴직 {counts.off}</span>
        {counts.quit > 0 && <span style={{ color: "var(--text-secondary)", marginLeft: 10 }}>· 퇴사 {counts.quit}</span>}
        <span style={{ color: "var(--text-secondary)", marginLeft: 10 }}>· 신입 {counts.rookie}</span>
      </div>

      {/* 검색 */}
      <div style={{ padding: "0 16px 12px" }}>
        <input
          type="text" placeholder="🔍 이름 / 지역 검색"
          value={search} onChange={e => setSearch(e.target.value)}
          style={searchStyle}
        />
      </div>

      {/* 필터 */}
      <div style={filterRowStyle}>
        {[
          { key: "all",         label: "전체" },
          { key: "cleaning",    label: "🧽 세척" },
          { key: "refrigerant", label: "냉매" },
          { key: "rookie",      label: "신입" },
        ].map(f => (
          <div key={f.key} onClick={() => setFilter(f.key)}
               style={filterPillStyle(filter === f.key)}>
            {f.label}
          </div>
        ))}
      </div>

      {/* 리스트 */}
      <div style={{ padding: "0 16px 24px" }}>
        {filtered.map(e => (
          <EngineerRow key={e.id} engineer={e} onClick={() => onEdit(e)}/>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
            결과 없음
          </div>
        )}
      </div>
    </div>
  );
}

function EngineerRow({ engineer: e, onClick }) {
  const level = CAREER_LEVELS[e.careerLevel] || CAREER_LEVELS.career;
  const status = STATUS_OPTIONS[e.status] || STATUS_OPTIONS.active;

  // 작업별 요약: "세척 메인 3" / "냉매 백업 2" / 기종 전문 시 기종 기반
  const summarize = (workType, label) => {
    const w = e.workTypes[workType];
    if (!w || w.role === "none") return null;
    const roleText = w.role === "main" ? "메인" : "백업";
    if (w.zones.length > 0) return `${label} ${roleText} ${w.zones.length}`;
    if (w.appliances.length > 0) return `${label} ${roleText} (${w.appliances.join("·")})`;
    return `${label} ${roleText}`;
  };
  const parts = [
    summarize("cleaning",    "세척"),
    summarize("refrigerant", "냉매"),
  ].filter(Boolean);
  const summary = parts.join(" / ") || "작업 미설정";

  // EngineerBadge — main/backup 표시 (cleaning role 우선)
  const role = (e.workTypes?.cleaning?.role === "main" || e.workTypes?.refrigerant?.role === "main")
    ? "main"
    : (e.workTypes?.cleaning?.role === "backup" || e.workTypes?.refrigerant?.role === "backup")
    ? "backup" : null;

  return (
    <div onClick={onClick} style={rowStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <EngineerBadge engineer={e} role={role}/>
        <span style={{
          marginLeft: "auto", fontSize: 11,
          color: status.color, fontWeight: 500,
        }}>
          {status.name}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: e.phone ? 2 : 0 }}>
        · {summary}
      </div>
      {e.phone && (
        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>· {e.phone}</div>
      )}
      {e.note && (
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2, fontStyle: "italic" }}>
          {e.note}
        </div>
      )}
    </div>
  );
}

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
const regionsBtnStyle = {
  background: "var(--bg-secondary)", border: "1px solid var(--border)",
  color: "var(--text-secondary)", fontSize: 12, fontWeight: 500,
  padding: "6px 12px", borderRadius: 6, cursor: "pointer",
  fontFamily: "inherit",
};
const countersStyle = { padding: "14px 16px 8px", fontSize: 12 };
const searchStyle = {
  width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 10, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13,
  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const filterRowStyle = { display: "flex", gap: 6, padding: "0 16px 14px", overflowX: "auto" };
const filterPillStyle = (active) => ({
  padding: "6px 12px", background: "var(--bg-secondary)",
  border: active ? "2px solid #FF1B8D" : "1px solid var(--border)", borderRadius: 7,
  fontSize: 12, color: active ? "#FF1B8D" : "var(--text-secondary)",
  cursor: "pointer", whiteSpace: "nowrap", fontWeight: active ? 700 : 500,
});
const rowStyle = {
  background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10,
  padding: "12px 14px", marginBottom: 8, cursor: "pointer",
};

export default EngineerListScreen;

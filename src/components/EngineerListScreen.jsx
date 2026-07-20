// Step 6 — 기사 관리 리스트 화면
// 사장님 catch: 코드 수정 0번 / 화면에서 직접 추가/삭제
// 2026-06-08 — 기능 라벨 출처를 DB epp(engineer_principal_permissions)로 전환.
//   옛 출처 = SEED workTypes (하드코딩 12명) → 사이트 데이터 클리어 시 SEED 12명 노출 사고.
//   새 출처 = listEngineerSkillsFromDb (DB epp + zones JOIN).
//   캐시 비어도 SEED 폴백 안 함 — DB 응답 전엔 "—" 표시.
import { useState, useMemo, useEffect } from "react";
import {
  loadEngineers, CAREER_LEVELS, STATUS_OPTIONS,
} from "../data/engineers.js";
import { listEngineerSkillsFromDb } from "../lib/engineerSkillsDb.js";
import { EngineerBadge } from "./EngineerBadge.jsx";

export function EngineerListScreen({ onEdit, onAdd, onBack, onClickRegions }) {
  // 매번 마운트 시 localStorage 다시 읽음 (편집 후 복귀 시 새 데이터 반영)
  const [engineers] = useState(() => loadEngineers());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  // 2026-07-20 — 기본은 활동 기사만. 토글 켜면 휴직도 표시. 검색 있으면 자동 통과.
  const [includeOff, setIncludeOff] = useState(false);

  // 2026-06-08 — DB epp 직접 fetch (매 mount). engineerId(=users.code) → skills 배열.
  //   응답 전엔 null → summarize "—" 표시 (SEED 폴백 차단).
  const [skillsMap, setSkillsMap] = useState(null);
  useEffect(() => {
    let cancelled = false;
    listEngineerSkillsFromDb().then(res => {
      if (cancelled) return;
      const map = new Map();
      const list = (res && res.ok && Array.isArray(res.skills)) ? res.skills : [];
      for (const s of list) {
        const eid = String(s.engineerId || "").trim();
        if (!eid) continue;
        if (!map.has(eid)) map.set(eid, []);
        map.get(eid).push(s);
      }
      setSkillsMap(map);
    }).catch(() => { if (!cancelled) setSkillsMap(new Map()); });
    return () => { cancelled = true; };
  }, []);

  // 2026-06-08 — 필터/검색도 DB skills 기준.
  //   DB skill 의 workType 한국어 ("세척"/"냉매충전") 으로 매칭.
  function _hasSkillDb(e, workTypeKr) {
    if (!skillsMap) return false;
    const list = skillsMap.get(String(e.id || "").trim()) || [];
    return list.some(s => {
      const grade = String(s.grade || "").trim();
      const wt    = String(s.workType || "").trim();
      return wt === workTypeKr && (grade === "메인" || grade === "백업");
    });
  }
  const filtered = useMemo(() => {
    // 2026-07-20 — 정렬: 활동 그룹 → 휴직 그룹, 각 그룹 안에서 이름 가나다순.
    const sorted = engineers.slice().sort((a, b) => {
      const aOff = a.status !== "active";
      const bOff = b.status !== "active";
      if (aOff !== bOff) return aOff ? 1 : -1;
      return (a.name || "").localeCompare(b.name || "", "ko");
    });
    return sorted.filter(e => {
      // 검색 (이름 OR 지역) — 지역은 DB zones 우선, fallback SEED
      if (search) {
        const inName = e.name && e.name.includes(search);
        const dbList = skillsMap ? (skillsMap.get(String(e.id||"").trim()) || []) : [];
        const dbZones = dbList.flatMap(s => {
          const z = s.zones;
          if (Array.isArray(s.zonesArray)) return s.zonesArray;
          if (typeof z === "string") return z.split(",").map(x => x.trim()).filter(Boolean);
          return [];
        });
        const inZones = dbZones.some(z => z.includes(search));
        if (!inName && !inZones) return false;
      }
      // 2026-07-20 — 활동 기본 필터. 검색 있거나 토글 켜면 휴직/퇴사도 통과.
      if (!search && !includeOff && e.status !== "active") return false;
      // 기능 필터 — DB 기준. skillsMap 로딩 전엔 통과 (= 카운트 0 깜빡임 회피).
      if (filter === "cleaning"    && skillsMap && !_hasSkillDb(e, "세척"))    return false;
      if (filter === "refrigerant" && skillsMap && !_hasSkillDb(e, "냉매충전")) return false;
      if (filter === "rookie"      && e.careerLevel !== "rookie")              return false;
      return true;
    });
  }, [engineers, search, filter, skillsMap, includeOff]);

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
        <div style={titleStyle}>프로 관리</div>
        <div style={{ display: "flex", gap: 6 }}>
          {onClickRegions && (
            <button onClick={onClickRegions} style={regionsBtnStyle}>📍 지역</button>
          )}
          <button onClick={onAdd} style={addBtnStyle}>+ 추가</button>
        </div>
      </div>

      {/* 카운터 + 휴직 포함 토글 (2026-07-20) */}
      <div style={countersStyle}>
        <span style={{ color: "var(--text-primary)" }}>활동 <strong style={{ color: "#00875A" }}>{counts.active}</strong></span>
        <span style={{ color: "var(--text-secondary)", marginLeft: 10 }}>· 퇴사 {counts.off}</span>
        {counts.quit > 0 && <span style={{ color: "var(--text-secondary)", marginLeft: 10 }}>· 퇴사 {counts.quit}</span>}
        <span style={{ color: "var(--text-secondary)", marginLeft: 10 }}>· 신입 {counts.rookie}</span>
        {(counts.off > 0 || counts.quit > 0) && (
          <button
            onClick={() => setIncludeOff(v => !v)}
            style={includeToggleStyle(includeOff)}
            title={search ? "검색 중엔 자동으로 퇴사도 표시됩니다" : ""}
          >
            {includeOff ? "✓ 퇴사 포함" : `+ 퇴사 ${counts.off + counts.quit}명 포함`}
          </button>
        )}
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
          <EngineerRow
            key={e.id}
            engineer={e}
            skills={skillsMap ? (skillsMap.get(String(e.id||"").trim()) || []) : null}
            onClick={() => onEdit(e)}
          />
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

function EngineerRow({ engineer: e, skills, onClick }) {
  const level = CAREER_LEVELS[e.careerLevel] || CAREER_LEVELS.career;
  const status = STATUS_OPTIONS[e.status] || STATUS_OPTIONS.active;

  // 2026-06-08 — DB epp 기준 요약. skills=null (로딩 중) → "—" / [] (DB 없음) → "작업 미설정".
  function _summarizeDb(workTypeKr, label) {
    if (!skills) return null;
    const s = skills.find(x => String(x.workType||"").trim() === workTypeKr);
    if (!s) return null;
    const grade = String(s.grade || "").trim();
    if (grade !== "메인" && grade !== "백업") return null;
    const zonesArr = Array.isArray(s.zonesArray) ? s.zonesArray
      : (typeof s.zones === "string" ? s.zones.split(",").map(z=>z.trim()).filter(Boolean) : []);
    const n = zonesArr.length;
    return n > 0 ? `${label} ${grade} ${n}` : `${label} ${grade}`;
  }
  let summary;
  if (skills === null) {
    summary = "—";
  } else {
    const parts = [_summarizeDb("세척", "세척"), _summarizeDb("냉매충전", "냉매")].filter(Boolean);
    summary = parts.join(" / ") || "작업 미설정";
  }

  // EngineerBadge — main/backup 표시 (DB skills 기준, main 우선)
  let role = null;
  if (skills && skills.length > 0) {
    const hasMain   = skills.some(s => String(s.grade||"").trim() === "메인");
    const hasBackup = skills.some(s => String(s.grade||"").trim() === "백업");
    role = hasMain ? "main" : (hasBackup ? "backup" : null);
  }

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
const includeToggleStyle = (on) => ({
  marginLeft: 12,
  padding: "3px 10px",
  background: on ? "rgba(255, 27, 141, 0.12)" : "var(--bg-secondary)",
  border: `1px solid ${on ? "#FF1B8D" : "var(--border)"}`,
  borderRadius: 6,
  fontSize: 11,
  color: on ? "#FF1B8D" : "var(--text-secondary)",
  cursor: "pointer",
  fontWeight: on ? 700 : 500,
  fontFamily: "inherit",
});
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

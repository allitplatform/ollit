// 2026-06-12 — AdminApp PC 기사 목록 카드 그리드 (1024px+ 전용).
//   사장님 spec — 카드 그리드 3열(좁으면 2열), 아바타·상태·연락처·지역(외N)·스킬 칩.
//   ⚠️ 데이터/로직 0줄 변경 — loadEngineers + listEngineerSkillsFromDb (옛 EngineerListScreen 동일).
//   ⚠️ 카드 클릭 → onEdit (옛 편집 화면 = engineerEdit).
//   ⚠️ 모바일(<1024) 옛 EngineerListScreen 그대로 (이번 분기 X).

import { useState, useMemo, useEffect } from "react";
import { Search, Plus, Phone } from "lucide-react";
import { loadEngineers } from "../data/engineers.js";
import { listEngineerSkillsFromDb } from "../lib/engineerSkillsDb.js";

const COLOR_CLEANING    = "#0EA5E9";
const COLOR_REFRIGERANT = "#FFB800";

// 2026-07-20 — 상태 2단계 통합 (active / off). DB는 is_active boolean 뿐이라 off/quit
// 구분 안 됨. 옛 quit 항목 제거 + off 라벨 "퇴사" 로 통일.
const STATUS_META = {
  active: { label: "활동중", dotColor: "#10B981" },
  off:    { label: "퇴사",   dotColor: "#9CA3AF" },
};

function initials(name) {
  if (!name) return "?";
  const n = String(name).trim();
  if (!n) return "?";
  // 한국 이름 첫 글자 (성). 영문이면 첫 글자.
  return n.charAt(0);
}

function summarizeZones(zones, head = 3) {
  if (!Array.isArray(zones) || zones.length === 0) return "—";
  const arr = zones.filter(Boolean);
  if (arr.length === 0) return "—";
  if (arr.length <= head) return arr.join(" · ");
  return `${arr.slice(0, head).join(" · ")} 외 ${arr.length - head}`;
}

export function AdminPcEngineerGridScreen({ onEdit, onAdd, onCalendar }) {
  const [engineers] = useState(() => loadEngineers());
  const [search, setSearch] = useState("");
  const [skillsMap, setSkillsMap] = useState(null);

  // DB skills fetch (옛 EngineerListScreen line 23~ 동일 패턴).
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

  // 기사별 skills 추출 helper.
  function getEngSkills(engId) {
    if (!skillsMap) return [];
    return skillsMap.get(String(engId || "").trim()) || [];
  }
  function getEngZones(engId) {
    const skills = getEngSkills(engId);
    const zoneSet = new Set();
    for (const s of skills) {
      const arr = Array.isArray(s.zonesArray) ? s.zonesArray
        : typeof s.zones === "string" ? s.zones.split(",").map(x => x.trim()).filter(Boolean)
        : [];
      for (const z of arr) zoneSet.add(z);
    }
    return Array.from(zoneSet);
  }
  function hasSkill(engId, workTypeKr) {
    const skills = getEngSkills(engId);
    return skills.some(s => {
      const wt = String(s.workType || "").trim();
      const grade = String(s.grade || "").trim();
      return wt === workTypeKr && (grade === "메인" || grade === "백업");
    });
  }

  const filtered = useMemo(() => {
    if (!search) return engineers;
    const q = search.trim();
    if (!q) return engineers;
    // 2026-06-13 — 핸드폰 검색 추가 (하이픈 무관).
    //   숫자만 들어온 검색어는 phone 도 숫자만 추출 후 includes 비교.
    //   문자 섞이면 옛 방식 (이름/지역) 만.
    const qDigits = q.replace(/\D/g, "");
    return engineers.filter(e => {
      if (e.name && e.name.includes(q)) return true;
      const zones = getEngZones(e.id);
      if (zones.some(z => z.includes(q))) return true;
      // 핸드폰 — qDigits 있을 때만 시도
      if (qDigits) {
        const phone = String(e.phone || e.phoneNumber || "");
        const phoneDigits = phone.replace(/\D/g, "");
        if (phoneDigits && phoneDigits.includes(qDigits)) return true;
      }
      return false;
    });
    // skillsMap deps — search 변경 시만 trigger. zones 매핑이 skillsMap 의존 → 추가.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineers, search, skillsMap]);

  return (
    <div style={{
      padding: "20px 24px 32px",
      display: "flex", flexDirection: "column",
      gap: 16,
    }}>
      {/* 헤더 — 제목 + 검색 + 추가 버튼 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap",
      }}>
        <div style={{
          fontSize: 18, fontWeight: 800,
          color: "var(--text-primary)",
          letterSpacing: "-0.4px",
        }}>
          기사 목록
          <span style={{
            marginLeft: 10,
            fontSize: 12, color: "var(--text-secondary)", fontWeight: 600,
          }}>{filtered.length}명</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <SearchBar value={search} onChange={setSearch}/>
          {typeof onAdd === "function" && (
            <button onClick={onAdd}
              style={{
                padding: "10px 16px",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 13, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6,
                flexShrink: 0,
              }}>
              <Plus size={16} strokeWidth={2.8}/>
              <span>기사 추가</span>
            </button>
          )}
        </div>
      </div>

      {/* 카드 그리드 — 3열 (좁으면 2열 반응형, auto-fit). */}
      {filtered.length === 0 ? (
        <div style={{
          padding: "60px 20px",
          textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: 13, fontWeight: 600,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 14,
        }}>{search ? `"${search}" 검색 결과 없음` : "기사 없음"}</div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}>
          {filtered.map(eng => (
            <EngineerCard
              key={eng.id}
              engineer={eng}
              zones={getEngZones(eng.id)}
              hasCleaning={hasSkill(eng.id, "세척")}
              hasRefrigerant={hasSkill(eng.id, "냉매충전")}
              onClick={() => onEdit?.(eng)}
              onCalendar={onCalendar ? () => onCalendar(eng) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <div style={{ position: "relative", width: 280 }}>
      <Search size={14} style={{
        position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
        color: "var(--text-secondary)", pointerEvents: "none",
      }}/>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="이름 · 지역 · 핸드폰"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "9px 12px 9px 34px",
          background: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          color: "var(--text-primary)",
          fontSize: 13,
          fontFamily: "inherit",
          outline: "none",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }}
      />
    </div>
  );
}

function EngineerCard({ engineer, zones, hasCleaning, hasRefrigerant, onClick, onCalendar }) {
  const status = engineer.status || "active";
  const meta = STATUS_META[status] || STATUS_META.active;
  const isDimmed = status !== "active";
  // 2026-06-13 — 냉매 비율 필드명 정정.
  //   실제 저장 필드 = cm_refrigerant_rate (편집 화면 EngineerEditScreen.jsx:325, sync payload engineers.js:512).
  //   옛 코드는 refrigerantRate / refrigerant_rate 만 봐서 항상 null → % 표시 누락.
  const refriRate = engineer.cm_refrigerant_rate
                 ?? engineer.refrigerantRate
                 ?? engineer.refrigerant_rate
                 ?? null;
  // 이름 첫 글자 (아바타 이니셜).
  const init = initials(engineer.name);
  // 전화
  const phone = engineer.phone || engineer.phoneNumber || "";

  return (
    // 2026-06-12 — root <div role="button"> (button-in-button 회피 — 우상단 📅 sub-button 안전).
    <div role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); }
      }}
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 12px",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        opacity: isDimmed ? 0.55 : 1,
        transition: "border-color 0.1s",
        outline: "none",
        userSelect: "none",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      {/* 상단 — 좌(아바타+이름) / 우(상태) space-between */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 8,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          flex: 1, minWidth: 0,
        }}>
          <div style={{
            width: 30, height: 30,
            borderRadius: "50%",
            background: "var(--accent-bg)",
            color: "var(--accent)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800,
            flexShrink: 0,
          }}>{init}</div>
          <div style={{
            fontSize: 13, fontWeight: 800,
            color: "var(--text-primary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            flex: 1, minWidth: 0,
          }}>{engineer.name || "—"}</div>
        </div>
        {/* 우상단 — 📅 달력 진입 + 상태 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          flexShrink: 0,
        }}>
          {onCalendar && (
            <button onClick={(e) => { e.stopPropagation(); onCalendar(); }}
              title="달력 보기" aria-label="달력 보기"
              style={{
                width: 24, height: 24, padding: 0,
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-secondary)",
                cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontFamily: "inherit",
                fontSize: 12,
                lineHeight: 1,
              }}>📅</button>
          )}
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 700, color: "var(--text-secondary)",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: meta.dotColor,
            }}/>
            <span>{meta.label}</span>
          </div>
        </div>
      </div>

      {/* 연락처 */}
      <Row icon={<Phone size={12}/>}>
        {phone || <span style={{ color: "var(--text-tertiary, var(--text-secondary))" }}>—</span>}
      </Row>

      {/* 지역 — 한 줄 고정 (앞 3 · 외 N). 스킬 있고 zones 0개면 "전국" 표시. */}
      <Row icon="📍">
        <span style={{
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          display: "block", flex: 1, minWidth: 0,
        }}>{
          (!Array.isArray(zones) || zones.length === 0)
            ? ((hasCleaning || hasRefrigerant) ? "전국" : "—")
            : summarizeZones(zones, 3)
        }</span>
      </Row>

      {/* 스킬 칩 — 세척 / 냉매 */}
      <div style={{
        display: "flex", gap: 4, flexWrap: "wrap",
        marginTop: 1,
      }}>
        {hasCleaning && (
          <SkillChip color={COLOR_CLEANING}>❄ 세척</SkillChip>
        )}
        {hasRefrigerant && (
          <SkillChip color={COLOR_REFRIGERANT}>
            ⚡ 냉매{refriRate != null ? ` ${Math.round(Number(refriRate))}%` : ""}
          </SkillChip>
        )}
        {!hasCleaning && !hasRefrigerant && (
          <span style={{
            fontSize: 10, color: "var(--text-secondary)", fontWeight: 600,
          }}>스킬 정보 없음</span>
        )}
      </div>
    </div>
  );
}

function Row({ icon, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      fontSize: 11, color: "var(--text-secondary)",
      minWidth: 0,
    }}>
      <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center" }}>{icon}</span>
      <span style={{
        flex: 1, minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{children}</span>
    </div>
  );
}

function SkillChip({ color, children }) {
  return (
    <span style={{
      padding: "2px 7px",
      fontSize: 10, fontWeight: 800,
      color,
      background: `${color}22`,
      border: `1px solid ${color}55`,
      borderRadius: 999,
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

export default AdminPcEngineerGridScreen;

// V11-10 — 전체 기사에서 선택 모달
// 모든 활성 기사 + 검색 (이름/연락처/지역)
// AutoAssignScreen 또는 RecommendScreen에서 "전체 기사에서 선택" 버튼 클릭 시 띄움
// 2026-07-14 — B안 리디자인 (사장님 선택):
//   · 점수/"어려움" 딱지 제거 — 전원 동점이라 노이즈
//   · 한 줄 리스트 (한 화면 9~10명) — 이름 + 지역배지 + 30일 수익 + 지역 + [선택]
//   · 정렬: ① 작업지 매칭(메인/서브/인접) ② 최근 30일 회사 수익 순 (사장님 spec:
//     "회사 수익을 많이 주는 기사가 우선순위" — 단, 지역 밖 고수익이 위로 오면
//     배정 실수 유발이라 지역 매칭이 1순위)
//   · 지역 많으면 "강남·서초 외 8" 로 접기
import { useState, useMemo } from "react";
import { recommendEngineers } from "../utils/engineerRecommendation.js";
import { loadEngineers } from "../data/engineers.js";

const REGION_LABEL = {
  main:     "메인",
  sub:      "서브",
  possible: "인접",
  none:     "지역 외",
};

// "강남구"→"강남", "구리시"→"구리" (한 줄 밀도용 — 2글자 이하는 그대로)
function _shortZone(z) {
  const s = String(z || "").trim();
  return s.length >= 3 ? s.replace(/[구시군]$/, "") : s;
}

export function AllEngineersModal({ task, engineers: enginerProp, apiTasks = [], onSelect, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");

  const engineers = useMemo(() => {
    if (Array.isArray(enginerProp)) return enginerProp;
    try { return loadEngineers(); } catch { return []; }
  }, [enginerProp]);

  // 최근 30일 기사별 회사 수익 — {total, count, avg}.
  //   사장님 spec: "무조건 많은 기사 말고 작업수에 비례하게 수익을 주는 사람"
  //   → 정렬 기준은 총액이 아니라 건당 평균(avg = owner_amount 합 / 완료 건수).
  const profitByName = useMemo(() => {
    const map = {};
    if (!Array.isArray(apiTasks)) return map;
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const startYmd = start.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    for (const t of apiTasks) {
      const st = t.status || t.상태 || "";
      if (st !== "완료" && st !== "정산완료" && st !== "visit_only") continue;
      const done = t.completedAt || t.completed_at;
      if (!done) continue;
      let doneYmd = "";
      try { doneYmd = new Date(done).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); } catch { continue; }
      if (!doneYmd || doneYmd < startYmd) continue;
      const nm = String(t.assignedEngineer || t.engineer || "").trim();
      if (!nm) continue;
      if (!map[nm]) map[nm] = { total: 0, count: 0, avg: 0 };
      map[nm].total += Number(t.owner_amount || 0);
      map[nm].count += 1;
    }
    for (const nm of Object.keys(map)) {
      const m = map[nm];
      m.avg = m.count > 0 ? m.total / m.count : 0;
    }
    return map;
  }, [apiTasks]);

  const allScored = useMemo(() => {
    const scored = recommendEngineers(task, { limit: 999, engineers });
    // ① 지역 매칭 우선 ② 30일 건당 평균 회사 수익 ③ 기존 점수
    return [...scored].sort((a, b) => {
      const am = a.regionMatch !== "none" ? 1 : 0;
      const bm = b.regionMatch !== "none" ? 1 : 0;
      if (am !== bm) return bm - am;
      const ap = profitByName[a.engineer?.name]?.avg || 0;
      const bp = profitByName[b.engineer?.name]?.avg || 0;
      if (ap !== bp) return bp - ap;
      return (b.score || 0) - (a.score || 0);
    });
  }, [task, engineers, profitByName]);

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
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              👥 전체 프로 {engineers.length}명
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
              점수 높은 순 · 검색 가능
            </div>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          {/* 2026-07-14 — 검색란 정리 (사장님 spec): 아이콘 왼쪽 + 지우기 버튼 + 알약형 */}
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 13, top: "50%",
              transform: "translateY(-50%)",
              fontSize: 13, color: "var(--text-tertiary, var(--text-secondary))",
              pointerEvents: "none",
            }}>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름 · 연락처 · 지역"
              autoFocus
              style={inputStyle}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute", right: 8, top: "50%",
                  transform: "translateY(-50%)",
                  width: 22, height: 22, borderRadius: "50%",
                  background: "var(--bg-elevated, rgba(255,255,255,0.08))",
                  border: "none", cursor: "pointer",
                  color: "var(--text-secondary)", fontSize: 11,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "inherit", padding: 0,
                }}
                aria-label="검색어 지우기"
              >✕</button>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 7 }}>
            {searchQuery ? `"${searchQuery}" — ${filtered.length}명` : `전체 ${filtered.length}명`}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
              {searchQuery ? "검색 결과가 없습니다" : "활성 프로가 없습니다"}
            </div>
          ) : (
            filtered.map(rec => (
              <AllEngineerRow
                key={rec.engineer.id}
                recommendation={rec}
                profit={profitByName[rec.engineer?.name] || null}
                onSelect={() => onSelect(rec.engineer.id, rec.engineer)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// 2026-07-14 — B안 한 줄 리스트 (사장님 선택).
//   점수/"어려움" 딱지 제거. 이름 + 지역배지 + 건당수익(작게) | 지역(접기) | [선택].
//   지역 많으면 "강남·서초 외 8". 수익 = 최근 30일 건당 평균 회사 수익.
function AllEngineerRow({ recommendation, profit, onSelect }) {
  const { engineer, regionMatch } = recommendation;

  // 등록 지역 (세척+냉매 zone 합집합) — 앞 2개 + "외 N"
  const zones = [...new Set([
    ...(engineer.workTypes?.cleaning?.zones    || []),
    ...(engineer.workTypes?.refrigerant?.zones || []),
  ])].filter(Boolean);
  const zoneText = zones.length > 0
    ? zones.slice(0, 2).map(_shortZone).join("·") + (zones.length > 2 ? ` 외 ${zones.length - 2}` : "")
    : "지역 없음";

  const showMatchBadge = regionMatch === "main" || regionMatch === "sub" || regionMatch === "possible";

  // 건당 평균 회사 수익 — "4.5만/건 (12건)" 툴팁, 표시는 "4.5만/건"
  const avgMan = profit && profit.count > 0 ? profit.avg / 10000 : 0;
  const profitText = avgMan > 0
    ? `${avgMan >= 10 ? Math.round(avgMan) : avgMan.toFixed(1)}만/건`
    : "";

  return (
    <button
      onClick={onSelect}
      title={profit && profit.count > 0 ? `최근 30일 ${profit.count}건 · 건당 평균 ₩${Math.round(profit.avg).toLocaleString()}` : "최근 30일 완료 건 없음"}
      style={{
        width: "100%", padding: "11px 16px",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer", textAlign: "left",
        fontFamily: "inherit",
        display: "flex", alignItems: "center", gap: 8,
        color: "var(--text-primary)",
      }}
    >
      <span style={{ fontSize: 13.5, fontWeight: 700, flexShrink: 0 }}>
        {engineer.name}
      </span>
      {showMatchBadge && (
        <span style={{
          fontSize: 9.5, color: "#FF1B8D",
          background: "rgba(255,27,141,0.12)",
          padding: "1.5px 6px", borderRadius: 999, fontWeight: 800,
          flexShrink: 0,
        }}>
          {REGION_LABEL[regionMatch]}
        </span>
      )}
      {profitText && (
        <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 700, flexShrink: 0 }}>
          {profitText}
        </span>
      )}
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 11, color: "var(--text-tertiary, var(--text-secondary))",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        textAlign: "right",
      }}>
        {zoneText}
      </span>
      <span style={{
        padding: "6px 14px", borderRadius: 999,
        background: "#FF1B8D", color: "#fff",
        fontSize: 11, fontWeight: 800, flexShrink: 0,
      }}>
        선택
      </span>
    </button>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1100,
  padding: 16,
  // 2026-07-14 — body zoom(글자 크기 1.2/1.4배)이 fixed 팝업 좌표를 틀어뜨려
  //   PC에서 팝업이 한쪽에 붙고 잘리던 문제. 팝업 subtree 만 zoom 을 되돌려
  //   실제 화면 기준 정중앙 고정. (아래 폰트는 한 단계씩 키워 체감 크기 유지)
  zoom: "calc(1 / var(--font-scale, 1))",
};

const contentStyle = {
  width: 460, maxWidth: "100%", maxHeight: "82vh",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  display: "flex", flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
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
  padding: "11px 34px 11px 36px",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 999,
  color: "var(--text-primary)",
  fontSize: 13.5, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};

export default AllEngineersModal;

// Step 7 — 원청 관리 리스트 화면
import { useState, useMemo } from "react";
import { loadPrincipals, STATUS_OPTIONS } from "../data/principals.js";

export function PrincipalListScreen({ onEdit, onAdd, onBack, onClickRates }) {
  const [list] = useState(() => loadPrincipals());
  const [search, setSearch] = useState("");

  const filtered = useMemo(() =>
    list.filter(p =>
      !search
      || (p.name && p.name.includes(search))
      || (p.nickname && p.nickname.includes(search))
    )
  , [list, search]);

  const counts = useMemo(() => ({
    active: list.filter(p => p.status === "active").length,
    off:    list.filter(p => p.status !== "active").length,
  }), [list]);

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif" }}>

      {/* 헤더 */}
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>원청 관리</div>
        <div style={{ display: "flex", gap: 6 }}>
          {onClickRates && (
            <button onClick={onClickRates} style={ratesBtnStyle}>💰 단가표</button>
          )}
          <button onClick={onAdd} style={addBtnStyle}>+ 추가</button>
        </div>
      </div>

      {/* 카운터 */}
      <div style={{ padding: "14px 16px 8px", fontSize: 12 }}>
        <span style={{ color: "var(--text-primary)" }}>활동 <strong style={{ color: "#00875A" }}>{counts.active}</strong></span>
        <span style={{ color: "var(--text-secondary)", marginLeft: 10 }}>· 중단 {counts.off}</span>
      </div>

      {/* 검색 */}
      <div style={{ padding: "0 16px 12px" }}>
        <input
          type="text" placeholder="🔍 원청 / 별명 검색"
          value={search} onChange={e => setSearch(e.target.value)}
          style={searchStyle}
        />
      </div>

      {/* 리스트 */}
      <div style={{ padding: "0 16px 24px" }}>
        {filtered.map(p => (
          <PrincipalRow
            key={p.id}
            principal={p}
            onClick={() => onEdit(p)}
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

function PrincipalRow({ principal: p, onClick }) {
  const isUsolN = p.id === "usol_n";
  // 정책 요약
  const set = [];
  if (p.commissionPolicy?.cleaning)    set.push("세척");
  if (p.commissionPolicy?.refrigerant) set.push("냉매");

  // 냉매 정책 짧게 표시
  // Step 5-3 hotfix 2 — ref.principal null safe (시트 병합 시 principal 객체 누락 catch)
  const ref = p.commissionPolicy?.refrigerant;
  let refDesc = "";
  if (ref) {
    const refType  = ref.principal?.type;
    const refValue = ref.principal?.value;
    if (refType === "rate") {
      refDesc = `원청 ${refValue ?? 0}%`;
    } else if (refType === "fixed") {
      refDesc = `원청 ${(refValue ?? 0).toLocaleString()}원`;
    } else {
      refDesc = "원청 X";
    }
  }

  const status = STATUS_OPTIONS[p.status] || STATUS_OPTIONS.active;

  return (
    <div onClick={onClick} style={rowStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: p.color || "var(--text-secondary)",
          flexShrink: 0,
        }}/>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{p.name}</span>
        {p.nickname && (
          <span style={{
            background: "var(--bg-tertiary)", color: "var(--text-secondary)",
            fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 500,
          }}>{p.nickname}</span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, color: status.color, fontWeight: 500 }}>
          {status.name}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>
        · {set.length ? set.join(" / ") : "정책 미설정"}
        {refDesc && ` · ${refDesc}`}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "inherit" }}>
        prefix {p.prefix || "—"}
      </div>
      {p.note && (
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2, fontStyle: "italic" }}>
          {p.note}
        </div>
      )}
      {isUsolN && (
        <div style={{
          marginTop: 8,
          padding: "6px 10px",
          background: "rgba(3,199,90,0.08)",
          border: "1px solid rgba(3,199,90,0.3)",
          borderRadius: 6,
          fontSize: 10,
          color: "#03C75A",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <span>ℹ️</span>
          <span>주문/정산 CSV는 <strong>유솔 N</strong> 메뉴에서 별도 관리</span>
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
const ratesBtnStyle = {
  background: "var(--bg-secondary)", border: "1px solid var(--border)",
  color: "var(--text-secondary)", fontSize: 12, fontWeight: 500,
  padding: "6px 12px", borderRadius: 6, cursor: "pointer",
  fontFamily: "inherit",
};
const searchStyle = {
  width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 10, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13,
  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const rowStyle = {
  background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10,
  padding: "12px 14px", marginBottom: 8, cursor: "pointer",
};

export default PrincipalListScreen;

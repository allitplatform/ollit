// 운영자 유솔N · 업로드 토글 (접수 CSV / 정산 CSV)
// 2026-05-26 R2-2 — 유솔앱 UploadTab (PrincipalApp.jsx:507~) 패턴 측 catch.
//
// 사장님 spec:
//   · sub === "receive" → <UsolNOrders hideList/> — 접수 CSV 업로드
//   · sub === "settle"  → <UsolNCsvMatch/>        — 정산 CSV 매칭
//   · 토글 active 색 = var(--accent) 핑크 (헤더만 초록, 안쪽 핑크 — round 2 확정)
//   · ⚠️ 유솔앱 측 "+ 새 접수 등록" 버튼 (NewReceptionScreenLite, usol_h 전용) 측 X.
//
// UsolNOrders / UsolNCsvMatch 측 측 측 변경 X — 토글로 감싸기만.

import { useState } from "react";
import { UsolNOrders } from "./UsolNOrders.jsx";
import { UsolNCsvMatch } from "./UsolNCsvMatch.jsx";

export function UsolNUploadToggle({ onTaskClick }) {
  const [sub, setSub] = useState("receive");  // 'receive' | 'settle'

  return (
    <div>
      {/* 토글 — 접수 / 정산 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <ToggleBtn active={sub === "receive"} onClick={() => setSub("receive")}>
          접수 CSV
        </ToggleBtn>
        <ToggleBtn active={sub === "settle"} onClick={() => setSub("settle")}>
          정산 CSV
        </ToggleBtn>
      </div>

      {sub === "receive" && <UsolNOrders hideList onTaskClick={onTaskClick}/>}
      {sub === "settle"  && <UsolNCsvMatch/>}
    </div>
  );
}

function ToggleBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "10px 12px",
        background: active ? "var(--accent)" : "var(--bg-inset, var(--bg-secondary))",
        color: active ? "#fff" : "var(--text-primary)",
        border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
        borderRadius: 10,
        fontSize: 12, fontWeight: 700,
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default UsolNUploadToggle;

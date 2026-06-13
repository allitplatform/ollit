// 2026-06-12 — AdminApp PC 셸 (1024px+).
//   PrincipalApp PcShell 패턴 차용 — 좌 사이드바 + 메인 + 우 aside.
//   AdminApp.jsx 의 <Shell> 함수가 useIsPc() true 시 이 셸로 wrap.
//   Chunk 2 — 우 aside 활성화. 1280px+ 일 때 옆에, 미만은 overlay (본문 위 덮음).
//     · asideNode prop 받으면 표시 (Shell 함수가 PC + screen=taskDetail 일 때 children 을 asideNode 로 전달).
//     · 닫기 = pcCtx.onCloseTaskDetail.

import { useMinWidth } from "../utils/useIsPc.js";
import { AdminPcSidebar } from "./AdminPcSidebar.jsx";

export const PC_SIDEBAR_W = 240;   // 2026-06-13 사장님 spec — 260 → 240 축소 (우 콘텐츠 +20).
export const PC_DETAIL_W  = 420;   // PrincipalApp 동일

export function AdminPcShell({ t, pcCtx, asideNode, children }) {
  const isWide   = useMinWidth(1280);  // 좁은 PC (<1280) 면 aside 가 overlay (본문 위 덮음).
  const showAside = !!asideNode;
  const onClose   = pcCtx?.onCloseTaskDetail;

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', sans-serif",
    }}>
      <AdminPcSidebar t={t} pcCtx={pcCtx} width={PC_SIDEBAR_W}/>

      <main style={{
        flex: 1,
        minWidth: 0,
        overflow: "auto",
        background: "var(--bg-primary)",
        height: "100vh",
      }}>
        {children}
      </main>

      {/* 1280px+ 일 때 우 aside 옆에 (본문이 자동 좁아짐). */}
      {showAside && isWide && (
        <aside style={{
          width: PC_DETAIL_W,
          flexShrink: 0,
          borderLeft: "1px solid var(--border)",
          overflow: "auto",
          background: "var(--bg-primary)",
          position: "relative",
          height: "100vh",
        }}>
          <CloseButton onClose={onClose}/>
          {asideNode}
        </aside>
      )}

      {/* <1280px 일 때 overlay (본문 위 덮음). 반투명 배경 클릭 시 닫기. */}
      {showAside && !isWide && (
        <>
          <div onClick={onClose} style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0, 0, 0, 0.4)",
            zIndex: 99,
            cursor: "pointer",
          }}/>
          <aside style={{
            position: "fixed",
            top: 0, right: 0,
            width: "min(480px, 92vw)",
            height: "100vh",
            background: "var(--bg-primary)",
            borderLeft: "1px solid var(--border)",
            boxShadow: "-8px 0 24px rgba(0, 0, 0, 0.18)",
            overflow: "auto",
            zIndex: 100,
          }}>
            <CloseButton onClose={onClose}/>
            {asideNode}
          </aside>
        </>
      )}
    </div>
  );
}

function CloseButton({ onClose }) {
  if (typeof onClose !== "function") return null;
  return (
    <button onClick={onClose} aria-label="작업상세 닫기"
      style={{
        position: "absolute",
        top: 12, right: 14,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        color: "var(--text-secondary)",
        fontSize: 22, fontWeight: 700,
        cursor: "pointer",
        width: 32, height: 32,
        borderRadius: 8,
        padding: 0,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 5,
      }}>×</button>
  );
}

export default AdminPcShell;

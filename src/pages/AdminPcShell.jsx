// 2026-06-12 — AdminApp PC 셸 (1024px+).
//   PrincipalApp PcShell 패턴 차용 — 좌 사이드바 + 메인 + 우 aside 자리.
//   AdminApp.jsx 의 <Shell> 함수가 useIsPc() true 시 이 셸로 wrap.
//   1단계: 골격만 (사이드바 + 메인). 우 aside 는 자리만 정의, mount 다음 단계.

import { AdminPcSidebar } from "./AdminPcSidebar.jsx";

export const PC_SIDEBAR_W = 260;   // AdminApp 그룹 메뉴 (PrincipalApp 240 보다 약간 넓음)
export const PC_DETAIL_W  = 420;   // PrincipalApp 동일

export function AdminPcShell({ t, pcCtx, children }) {
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

      {/* 우 aside (작업상세) — 자리 정의만. 1단계는 mount X.
            다음 단계: pcCtx.selectedTaskDetail → AdminTaskDetailScreen 분리 + 여기 mount. */}
      {false && pcCtx?.selectedTaskDetail && (
        <aside style={{
          width: PC_DETAIL_W,
          flexShrink: 0,
          borderLeft: "1px solid var(--border)",
          overflow: "auto",
          background: "var(--bg-primary)",
          position: "relative",
          height: "100vh",
        }}>
          {/* AdminTaskDetailScreen mount → 다음 단계 */}
        </aside>
      )}
    </div>
  );
}

export default AdminPcShell;

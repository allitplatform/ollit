// 2026-06-06 — engineer + admin 둘 다 가진 사용자 측 헤더 토글.
//   노출: canSwitchEngineerAdmin(user) === true 측만 (조동욱 E022 / 구현서 E002).
//   동작: 측 [프로 | 운영자] 세그먼트. 현재 활성 측 핑크, 측 측 측 글자만.
//         탭 측 onSwitch(newDbRole) 호출 → App.jsx 측 currentUser.role swap → React 측 측 측 EngineerApp ↔ AdminApp 측 측.
//   위치: position:fixed, top-center. z-index 9999 측 측 측 측 측.
//   side-effect: 측 측 측 측 새 role 측 (다른 컴포넌트 unmount→mount 측 — 자연 측).

import { canSwitchEngineerAdmin } from "../lib/roles.js";

export function RoleSwitcher({ user, onSwitch }) {
  if (!canSwitchEngineerAdmin(user)) return null;
  const activeDbRole = user.dbRole || (user.role === "admin" ? "admin" : "engineer");

  return (
    <div style={{
      position: "fixed", top: 8, left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999,
      display: "flex",
      background: "rgba(20, 20, 20, 0.92)",
      border: "1px solid rgba(255, 255, 255, 0.12)",
      borderRadius: 999,
      padding: 3,
      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      fontFamily: "inherit",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    }}>
      <Segment label="프로"    active={activeDbRole === "engineer"} onClick={() => onSwitch("engineer")}/>
      <Segment label="운영자"  active={activeDbRole === "admin"}    onClick={() => onSwitch("admin")}/>
    </div>
  );
}

function Segment({ label, active, onClick }) {
  return (
    <button
      onClick={active ? undefined : onClick}
      style={{
        background: active ? "#FF1B8D" : "transparent",
        color:      active ? "#fff" : "rgba(255, 255, 255, 0.72)",
        border: "none",
        borderRadius: 999,
        padding: "5px 14px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
        cursor: active ? "default" : "pointer",
        fontFamily: "inherit",
        minWidth: 56,
        transition: "background 0.15s, color 0.15s",
      }}
    >{label}</button>
  );
}

export default RoleSwitcher;

// 2026-06-06 — engineer + admin 둘 다 가진 사용자 측측 토글.
//   노출: canSwitchEngineerAdmin(user) === true 측측 (조동욱 E022 / 구현서 E002).
//
// 측측 변형:
//   <RoleSwitcher user onSwitch />               → inline (헤더 flex row 측 일반 아이템)
//   <RoleSwitcher user onSwitch floating />      → fixed top-right (작은 pill, 헤더 측측 측측측 측측측 measure)
//
// 측 컴팩트: 측 28px / 폰트 12px / padding 4×10 / round pill. 측측 측측 측측.
// 측측: 측측 활성 측 핑크 #FF1B8D / 측측측 측측 글자만.

import { canSwitchEngineerAdmin } from "../lib/roles.js";

export function RoleSwitcher({ user, onSwitch, floating = false }) {
  if (!canSwitchEngineerAdmin(user)) return null;
  const activeDbRole = user.dbRole || (user.role === "admin" ? "admin" : "engineer");

  const inner = (
    <div style={{
      display: "inline-flex", alignItems: "center",
      background: "var(--bg-elevated, rgba(20,20,20,0.92))",
      border: "1px solid var(--border, rgba(255,255,255,0.12))",
      borderRadius: 999,
      padding: 2,
      fontFamily: "inherit",
      flexShrink: 0,
      ...(floating ? {
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      } : {}),
    }}>
      <Segment label="프로"   active={activeDbRole === "engineer"} onClick={() => onSwitch("engineer")}/>
      <Segment label="운영자" active={activeDbRole === "admin"}    onClick={() => onSwitch("admin")}/>
    </div>
  );

  if (!floating) return inner;

  return (
    <div style={{
      position: "fixed", top: "calc(env(safe-area-inset-top, 8px) + 4px)", right: 10,
      zIndex: 9999,
    }}>{inner}</div>
  );
}

function Segment({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={active ? undefined : onClick}
      style={{
        background: active ? "#FF1B8D" : "transparent",
        color:      active ? "#fff" : "var(--text-secondary, rgba(255,255,255,0.72))",
        border: "none",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.2,
        cursor: active ? "default" : "pointer",
        fontFamily: "inherit",
        minWidth: 46,
        height: 24,
        lineHeight: 1,
        transition: "background 0.15s, color 0.15s",
        whiteSpace: "nowrap",
      }}
    >{label}</button>
  );
}

export default RoleSwitcher;

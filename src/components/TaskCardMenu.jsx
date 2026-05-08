// Step 8+9 V7 — 작업 카드 [⋯] 메뉴 (공용 컴포넌트)
// 단계별 액션 + 외부 클릭 닫힘 + e.stopPropagation
import { useState, useRef, useEffect } from "react";
import { ACTIVE_STATUSES } from "../data/taskStatus.js";

// 작업 state → 통합 status 매핑
// "active"/"moving" → in_progress, "waiting" → received, "scheduled" → confirmed, "done" → completed
function deriveStatus(task) {
  if (task.status) return task.status;
  if (task.state === "active" || task.state === "moving") return "in_progress";
  if (task.state === "waiting")   return "received";
  if (task.state === "scheduled") return "confirmed";
  if (task.state === "done")      return "completed";
  // 새접수 (NEW_RECEPTIONS / extraReceptions)는 state X → received
  return "received";
}

export function TaskCardMenu({ task, onAction, align = "right" }) {
  const [showMenu, setShowMenu] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    function handleClickOutside(e) {
      if (menuRef.current?.contains(e.target)) return;
      if (buttonRef.current?.contains(e.target)) return;
      setShowMenu(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  function handleClick(action, e) {
    e?.stopPropagation();
    e?.preventDefault();
    setShowMenu(false);
    onAction?.(action, task);
  }

  function handleMenuButtonClick(e) {
    e.stopPropagation();
    e.preventDefault();
    setShowMenu(prev => !prev);
  }

  if (!task) return null;
  const status = deriveStatus(task);
  const canCancel = ACTIVE_STATUSES.includes(status);

  // 단계별 액션
  const actions = [];
  actions.push({ icon: "📋", label: "상세 보기", action: "detail" });
  actions.push({ icon: "📞", label: "통화하기",  action: "call" });
  actions.push({ icon: "📝", label: "메모 추가", action: "memo" });

  if (status === "received") {
    actions.push({ icon: "✏️", label: "수정",       action: "edit" });
  }
  if (status === "assigned" || status === "confirmed") {
    actions.push({ icon: "👷", label: "프로 변경",  action: "change_engineer" });
    actions.push({ icon: "📅", label: "일정 변경",  action: "change_schedule" });
  }
  if (status === "in_progress") {
    actions.push({ icon: "✓",  label: "완료 처리",  action: "complete" });
    actions.push({ icon: "🔶", label: "부분 완료",  action: "partial" });
    actions.push({ icon: "🚗", label: "출장비만",   action: "visit_only" });
  }

  return (
    <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleMenuButtonClick}
        aria-label="메뉴"
        style={{
          background: showMenu ? "var(--accent-soft)" : "transparent",
          border: "none",
          color: "var(--text-secondary)",
          fontSize: 18,
          cursor: "pointer",
          padding: "4px 10px",
          borderRadius: 4,
          lineHeight: 1,
          fontFamily: "inherit",
        }}
      >⋯</button>

      {showMenu && (
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "100%",
            [align]: 0,
            marginTop: 4,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            zIndex: 1000,
            minWidth: 180,
          }}
        >
          {actions.map(a => (
            <button
              key={a.action}
              type="button"
              onClick={(e) => handleClick(a.action, e)}
              style={menuItemStyle("var(--text-primary)")}
            >
              <span>{a.icon}</span>
              <span>{a.label}</span>
            </button>
          ))}

          {canCancel && actions.length > 0 && (
            <div style={{ height: 1, background: "var(--border)", margin: "4px 6px" }}/>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={(e) => handleClick("cancel", e)}
              style={menuItemStyle("#FF3D5A")}
            >
              <span>⚫</span>
              <span>작업 취소</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const menuItemStyle = (color) => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 12px",
  background: "transparent",
  border: "none",
  width: "100%",
  textAlign: "left",
  color,
  fontSize: 12,
  cursor: "pointer",
  borderRadius: 6,
  fontFamily: "inherit",
});

export default TaskCardMenu;

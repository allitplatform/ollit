// 2026-06-16 — 기사 앱 주소 표시 + 복사 공통 컴포넌트.
//   원본: EngineerTaskDetailScreen 내부 정의 (copyAddress / buildFullAddress / AddressLine)를 통합 export.
//   사용처: NextWorkCard / EngineerTaskDetailScreen / 신규 배정 3화면 / 일정 리스트.
//
// API:
//   <AddressLine task={task} baseStyle={...} variant="plain|bordered" lineClamp={1|2} iconColor={...}/>
//     - variant 기본 'bordered' (TaskDetailScreen 기존 모양 보존).
//     - 'plain' = 인라인 아이콘(테두리 X, 작게) — 카드 컨텍스트용.
//     - lineClamp 1 = 단일줄 ellipsis, 2 = 2줄 WebKit clamp.
//
// 동작: ti-copy 아이콘 탭 → navigator.clipboard.writeText(전체 주소) → "주소 복사됨" 토스트 + 햅틱.
// 기술: HTTPS PWA + 사용자 탭 제스처 기반 → clipboard API 정상.

import { useState } from "react";
import { Copy, Pencil } from "lucide-react";
// 2026-07-27 — 주소 수정 내장 (사장님 spec: 기사 앱 모든 화면에서 연필 아이콘).
//   Mig 194 engineer_update_address — 본인 배정 건만, 변경 이력 자동.
import { supabase } from "../../lib/supabase.js";
import { currentUserId } from "../../lib/cancelRpc.js";
import { parseRegion } from "../../utils/regionParser.js";

async function editTaskAddress(task, onToast) {
  const cur = task.fullAddress || task.address || "";
  const next = window.prompt("정확한 주소로 고쳐주세요", cur);
  if (next === null) return;
  const trimmed = String(next).trim();
  if (!trimmed || trimmed === cur) return;
  const actor = currentUserId();
  if (!actor) { if (onToast) onToast("로그인 정보 없음"); return; }
  const p = parseRegion(trimmed);
  const { data, error } = await supabase.rpc("engineer_update_address", {
    p_task_id:  task.id,
    p_address:  trimmed,
    p_district: (p && p.sigungu) || "",
    p_actor:    actor,
  });
  if (error || !data?.ok) {
    alert("주소 수정 실패: " + (data?.error || error?.message || ""));
    return;
  }
  task.address = trimmed;
  task.fullAddress = trimmed;
  if (onToast) onToast("주소 수정됨");
}

// 주소 합성 — DB tasks.address 가 풀 주소면 우선.
//   옛 시드(address="강남구" + fullAddress="청담로 200") 호환 fallback 유지.
export function buildFullAddress(task) {
  if (!task) return "";
  if (task.address && String(task.address).trim()) return String(task.address).trim();
  const region = task.region || "";
  const detail = task.fullAddress || "";
  if (!region && !detail) return "";
  if (!region) return detail;
  if (!detail) return region;
  const cityPrefix = region.includes("시") || region.includes("도") ? "" : "서울 ";
  return `${cityPrefix}${region} ${detail}`.trim();
}

// 클립보드 복사 + 햅틱 + onToast 콜백 호출.
export async function copyAddress(task, onToast) {
  const addr = buildFullAddress(task);
  if (!addr) {
    if (onToast) onToast("주소 없음");
    return;
  }
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(addr);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = addr;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    if (navigator?.vibrate) navigator.vibrate(30);
    if (onToast) onToast("주소 복사됨");
  } catch (err) {
    console.error("[copyAddress] 실패:", err);
    if (onToast) onToast("복사 실패");
  }
}

export function AddressLine({
  task,
  baseStyle,
  iconColor = "var(--label-main)",
  variant = "bordered",
  lineClamp = 1,
  editable = true,   // 2026-07-27 — 기본 ON (기사 앱 전 화면). 끄려면 false.
}) {
  const [toast, setToast] = useState(null);
  const addr = task?.fullAddress || task?.address || task?.region || "—";
  const hasAddr = addr && addr !== "—";

  function handleCopy(e) {
    e.stopPropagation();
    copyAddress(task, (msg) => {
      setToast(msg);
      setTimeout(() => setToast(null), 1500);
    });
  }

  // 2026-06-19 — lineClamp=0 / "none" → 무제한 줄바꿈(전체 주소 다 보이게).
  //   사장님 spec: 작업 상세 카드에서 "하남시 덕풍서로45 ..." 끝까지 보이게.
  const addrStyle = (lineClamp === 0 || lineClamp === "none") ? {
    flex: 1, minWidth: 0,
    whiteSpace: "normal",
    wordBreak: "keep-all",
    overflowWrap: "anywhere",
    lineHeight: 1.5,
  } : lineClamp >= 2 ? {
    flex: 1, minWidth: 0,
    display: "-webkit-box",
    WebkitLineClamp: lineClamp,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
    lineHeight: 1.4,
  } : {
    flex: 1, minWidth: 0,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  };

  const buttonStyle = variant === "plain" ? {
    flexShrink: 0,
    background: "transparent", border: "none",
    padding: 2, cursor: "pointer", lineHeight: 0,
    color: iconColor,
    display: "inline-flex", alignItems: "center",
  } : {
    flexShrink: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 26, height: 26, padding: 0,
    background: "transparent", border: "1px solid var(--border)",
    borderRadius: 6, color: iconColor,
    cursor: "pointer",
  };

  return (
    <div style={{
      position: "relative",
      ...baseStyle,
      display: "flex",
      alignItems: lineClamp >= 2 ? "flex-start" : "center",
      gap: 6,
    }}>
      <span style={addrStyle}>📍 {addr}</span>
      {hasAddr && (
        <button onClick={handleCopy} aria-label="주소 복사" style={buttonStyle}>
          <Copy size={14}/>
        </button>
      )}
      {editable && task?.id && (
        <button
          onClick={(e) => { e.stopPropagation(); editTaskAddress(task, (m) => { setToast(m); setTimeout(() => setToast(null), 1500); }); }}
          aria-label="주소 수정" title="주소 수정"
          style={{ ...buttonStyle, color: "#FF1B8D", borderColor: variant === "plain" ? undefined : "rgba(255,27,141,0.4)" }}
        >
          <Pencil size={variant === "plain" ? 13 : 14}/>
        </button>
      )}
      {toast && (
        <span style={{
          position: "absolute", right: 0, top: "100%", marginTop: 4,
          background: "rgba(0,0,0,0.85)", color: "#fff",
          fontSize: 11, fontWeight: 600,
          padding: "4px 10px", borderRadius: 6,
          whiteSpace: "nowrap", zIndex: 10,
        }}>
          {toast}
        </span>
      )}
    </div>
  );
}

export default AddressLine;

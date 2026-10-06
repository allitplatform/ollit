// 2026-10-06 — 취소된 작업 배너 (기사 앱 · 운영자 · 협력사 관리자 작업 상세 공용).
//   맨 위에 빨간 배너로 "취소된 작업 · 사유 · 취소자 · 시각" 을 보여 준다.
//   사유·취소자가 기록돼 있지 않은 옛 데이터는 있는 것만 보여 준다.
import { getCancelReasonLabel, getCancelActorLabel } from "../data/cancelReasons.js";

function fmtAt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

// 취소 요청 중(취소요청)도 같은 자리에서 알린다.
export function isCancelState(task) {
  const s = String(task?.status || "");
  return s === "취소" || s === "취소요청";
}

// force: 상태 글자는 취소가 아니지만 항목이 전부 취소된 작업(실질 취소)도 보여 줄 때 true.
export default function CancelBanner({ task, style, force = false }) {
  if (!task || !(isCancelState(task) || force)) return null;
  const cat = task.categoryData || task.category_data || {};
  const requested = task.status === "취소요청";
  const raw = task.cancelReason || cat.cancelReason || cat.cancelApproveReason || "";
  const reason = raw ? (getCancelReasonLabel(raw) || raw) : "";
  // 취소자: 구분값(partner / operator / engineer / customer) + 이름(Mig 236 이후 취소 건만 있음)
  //   이름이 있으면 "홍길동(운영자)", 없으면(옛 취소 건) 구분만.
  const actorCode = task.cancelActor || cat.cancelActor || "";
  const kind = actorCode
    ? getCancelActorLabel({ actor: actorCode, principalCode: task.cancelActorPrincipalCode || cat.cancelActorPrincipalCode })
    : "";
  const kindLabel = kind && kind !== "—" ? kind : "";
  const actorName = task.cancelActorName || cat.cancelActorName || "";
  const actor = actorName ? (kindLabel ? `${actorName}(${kindLabel})` : actorName) : kindLabel;
  // 취소 요청 중: 요청한 사람
  const requester = task.cancelRequestedByName || cat.cancelRequestedByName || "";
  const at = fmtAt(requested ? (cat.cancelRequestedAt || task.cancelAt || cat.cancelAt) : (task.cancelAt || cat.cancelAt || cat.cancelRequestedAt));
  const parts = [reason ? `사유 ${reason}` : "사유 기록 없음", requested ? (requester ? `요청자 ${requester}` : "") : (actor ? `취소자 ${actor}` : ""), at].filter(Boolean);
  return (
    <div role="status" style={{
      margin: "0 0 12px", padding: "12px 14px", borderRadius: 10,
      background: "rgba(255,59,92,0.10)", border: "1px solid rgba(255,59,92,0.45)",
      display: "flex", alignItems: "flex-start", gap: 10, ...style,
    }}>
      <span style={{ fontSize: 16, lineHeight: 1.2 }}>🚫</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#FF3B5C" }}>
          {requested ? "취소 요청 중인 작업" : "취소된 작업"}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-primary)", marginTop: 4, fontWeight: 600, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {parts.join(" · ")}
        </div>
      </div>
    </div>
  );
}

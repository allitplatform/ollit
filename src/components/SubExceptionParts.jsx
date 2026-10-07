// 2026-10-07 Mig 242 — 협력사 작업 예외 처리 부품 (작업 상세 화면에서 쓴다).
//   SubChangeRequestBand : 열려 있는 "올데이케어 변경 요청" 띠.
//                          운영자 화면 = "변경 요청 중" 표시만 / 협력사 관리자 화면 = 내용 + [처리 완료]
//   SubExceptionCard     : 운영자 전용, 상세 맨 아래. [관리자에게 변경 요청] · [올데이케어로 회수]
//   협력사 묶음은 운영자에게 보기 전용이다. 배정은 협력사 관리자가 한다 — 이 두 버튼은 급할 때만.
import { useState } from "react";
import BottomSheet, { SheetButtons } from "./BottomSheet.jsx";
import {
  adminRequestSubChange, adminRecallSubTask, subResolveChangeRequest, subcontractorName,
} from "../lib/subcontractorsDb.js";

const ORANGE = "#F97316";
const KINDS = [["engineer", "기사 변경"], ["schedule", "일정 변경"], ["etc", "기타"]];
const kindLabel = (k) => (KINDS.find(x => x[0] === k) || [null, "기타"])[1];

const label = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", margin: "10px 0 6px" };
const area = {
  display: "block", width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 10, minHeight: 96,
  border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)",
  fontSize: 16, fontFamily: "inherit", resize: "vertical",
};

function fmtWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 목록 카드용 작은 띠 (협력사 관리자 작업 목록)
export function SubChangeRequestChip({ request }) {
  if (!request) return null;
  return (
    <div style={{
      marginTop: 6, padding: "5px 8px", borderRadius: 7, fontSize: 11.5, fontWeight: 700, lineHeight: 1.4,
      background: "rgba(249,115,22,0.12)", border: `1px solid ${ORANGE}`, color: ORANGE,
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    }}>
      올데이케어 변경 요청 · {kindLabel(request.kind)} · {request.body}
    </div>
  );
}

export function SubChangeRequestBand({ task, subMode = false, onChanged, style = {} }) {
  const [busy, setBusy] = useState(false);
  const req = task && task.subChangeRequest;
  if (!req || !task.subcontractorId) return null;

  async function resolve() {
    if (busy) return;
    if (!window.confirm("이 변경 요청을 처리 완료로 표시합니다.\n올데이케어 운영자에게 알림이 갑니다.")) return;
    setBusy(true);
    const res = await subResolveChangeRequest(task.id);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "처리하지 못했습니다."); return; }
    if (typeof onChanged === "function") onChanged();
  }

  return (
    <div style={{
      padding: "11px 13px", borderRadius: 12, border: `1.5px solid ${ORANGE}`, background: "rgba(249,115,22,0.10)", ...style,
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: ORANGE }}>
        {subMode ? "올데이케어 변경 요청" : "변경 요청 중"} · {kindLabel(req.kind)}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginTop: 4, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {req.body}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
        {[req.by_name, fmtWhen(req.at)].filter(Boolean).join(" · ")}
        {!subMode && " · 협력사 관리자가 [처리 완료] 를 누르면 사라집니다"}
      </div>
      {subMode && (
        <button type="button" disabled={busy} onClick={resolve} style={{
          marginTop: 9, width: "100%", minHeight: 42, borderRadius: 10, border: "none", cursor: "pointer",
          background: ORANGE, color: "#fff", fontSize: 13.5, fontWeight: 800, fontFamily: "inherit", opacity: busy ? 0.6 : 1,
        }}>{busy ? "처리 중…" : "처리 완료"}</button>
      )}
    </div>
  );
}

// 회수할 수 없는 이유 (서버도 같은 조건으로 막는다). 회수할 수 있으면 "".
export function recallBlockReason(task) {
  const s = task && task.status;
  if (s === "진행중") return "작업을 시작한 뒤에는 회수할 수 없습니다.";
  if (s === "완료" || s === "정산완료" || s === "visit_only") return "완료된(정산에 올라간) 작업은 회수할 수 없습니다.";
  if (s === "취소" || s === "취소요청") return "취소된 작업은 회수할 수 없습니다.";
  return "";
}

export function SubExceptionCard({ task, onChanged, style = {} }) {
  const [sheet, setSheet] = useState(null);      // request / recall
  const [kind, setKind] = useState("engineer");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!task || !task.subcontractorId) return null;

  const subName = subcontractorName(task.subcontractorId);
  const closed = ["완료", "취소", "visit_only", "정산완료"].includes(task.status);
  const block = recallBlockReason(task);

  function open(which) { setText(""); setKind("engineer"); setSheet(which); }

  async function save() {
    if (busy) return;
    const body = text.trim();
    if (!body) { window.alert(sheet === "recall" ? "회수 사유를 입력해 주세요." : "요청 내용을 입력해 주세요."); return; }
    if (sheet === "recall" && !window.confirm(
      `이 작업을 ${subName}에서 올데이케어로 회수합니다.\n협력사 지정과 담당 기사가 해제되고 "미배정" 이 됩니다.\n${subName} 관리자와 담당 기사에게 알림이 갑니다.\n\n계속할까요?`)) return;
    setBusy(true);
    const res = sheet === "recall" ? await adminRecallSubTask(task.id, body) : await adminRequestSubChange(task.id, kind, body);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "처리하지 못했습니다."); return; }
    setSheet(null);
    if (typeof onChanged === "function") onChanged();
  }

  const btn = {
    flex: 1, minHeight: 44, borderRadius: 10, fontSize: 13, fontWeight: 800, fontFamily: "inherit", cursor: "pointer",
    background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)",
  };
  return (
    <div style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--bg-elevated)", ...style }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>
        🔒 {subName} 작업 — 배정은 {subName} 관리자가 합니다
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-secondary)", margin: "3px 0 10px", lineHeight: 1.5 }}>
        급할 때만 아래 버튼을 씁니다. 둘 다 {subName} 관리자에게 알림이 갑니다.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" disabled={closed} onClick={() => open("request")}
          style={{ ...btn, opacity: closed ? 0.45 : 1, cursor: closed ? "not-allowed" : "pointer" }}>
          관리자에게 변경 요청
        </button>
        <button type="button" disabled={!!block} onClick={() => open("recall")}
          style={{ ...btn, color: "var(--danger, #E5484D)", opacity: block ? 0.45 : 1, cursor: block ? "not-allowed" : "pointer" }}>
          올데이케어로 회수
        </button>
      </div>
      {(block || closed) && (
        <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 8 }}>
          {block || "끝난 작업에는 변경을 요청할 수 없습니다."}
        </div>
      )}

      {sheet && (
        <BottomSheet
          onClose={() => { if (!busy) setSheet(null); }}
          title={sheet === "recall" ? "올데이케어로 회수" : "관리자에게 변경 요청"}
          subtitle={sheet === "recall"
            ? `${subName} 지정과 담당 기사를 해제하고 미배정으로 돌립니다. 사유는 ${subName} 관리자와 기사에게 전달됩니다.`
            : `${subName} 관리자에게 알림이 가고, 작업에 "변경 요청 중" 이 표시됩니다.`}
          footer={<SheetButtons onCancel={() => setSheet(null)} onOk={save} busy={busy}
            okLabel={sheet === "recall" ? "회수" : "요청 보내기"} danger={sheet === "recall"}/>}
        >
          {sheet === "request" && (
            <>
              <label style={label}>요청 종류</label>
              <div style={{ display: "flex", gap: 6 }}>
                {KINDS.map(([k, t]) => (
                  <button key={k} type="button" onClick={() => setKind(k)} style={{
                    flex: 1, minHeight: 42, borderRadius: 10, fontSize: 13, fontWeight: 800, fontFamily: "inherit", cursor: "pointer",
                    border: kind === k ? "1.5px solid var(--accent, #FF1B8D)" : "1px solid var(--border)",
                    background: kind === k ? "var(--accent-bg, rgba(255,27,141,0.08))" : "var(--bg-elevated)",
                    color: "var(--text-primary)",
                  }}>{t}</button>
                ))}
              </div>
            </>
          )}
          <label style={label}>{sheet === "recall" ? "회수 사유 (필수)" : "내용 (필수)"}</label>
          <textarea value={text} onChange={e => setText(e.target.value)} maxLength={500} style={area}
            placeholder={sheet === "recall" ? "예: 고객 요청으로 직영 기사가 오늘 방문" : "예: 고객이 10/9 오전으로 옮겨 달라고 합니다"}/>
        </BottomSheet>
      )}
    </div>
  );
}

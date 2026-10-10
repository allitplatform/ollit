// 2026-10-10 (78) — 협력사 작업의 받은 금액 수정 창 (운영자).
//   협력사 작업은 항목 줄의 받은 돈 칸을 직접 고치지 않는다 — 수수료가 공급가 기준이라 "받은 금액 + 부가세 포함" 을 한 곳에서만 정한다.
//   저장은 협력사 기사 앱의 완료 단계와 같은 함수(sub_staff_set_received): 공급가 · 항목 줄 · 정산이 같이 다시 계산된다.
import { useState } from "react";
import { subStaffSetReceived } from "../../lib/subcontractorsDb.js";

const won = (n) => `₩${Math.round(Number(n) || 0).toLocaleString("ko-KR")}`;

export function SubReceivedEditModal({ task, onClose, onSaved }) {
  const [amount, setAmount] = useState(Number(task?.receivedTotal) > 0 ? String(Number(task.receivedTotal)) : "");
  const [vat, setVat] = useState(task?.vatIncluded === true);
  const [reason, setReason] = useState(task?.supplyShortfallReason || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const received = parseInt(amount || "0", 10) || 0;
  const supply = vat ? Math.round(received / 1.1) : received;
  const quote = Number(task?.productPrice ?? task?.estimateTotal ?? 0) || 0;
  const short = received > 0 && quote > 0 ? Math.max(0, quote - supply) : 0;

  async function save() {
    if (busy) return;
    if (!(received > 0)) { setError("받은 금액을 입력해 주세요."); return; }
    if (short > 0 && !reason.trim()) { setError("공급가가 견적(부가세 제외)보다 적습니다. 사유를 입력해 주세요."); return; }
    setBusy(true); setError("");
    let res = null;
    try { res = await subStaffSetReceived(task.id, received, vat, short > 0 ? reason.trim() : null); }
    catch (e) { res = { ok: false, error: e?.message || "저장 실패" }; }
    setBusy(false);
    if (!res || !res.ok) { setError((res && res.error) || "저장하지 못했습니다."); return; }
    if (onSaved) onSaved();
  }

  const field = {
    width: "100%", boxSizing: "border-box", padding: "13px 12px", borderRadius: 10, border: "1.5px solid var(--border)",
    background: "var(--card-bg, var(--bg-secondary))", color: "var(--text-primary)", fontSize: 18, fontWeight: 800,
    textAlign: "right", fontFamily: "inherit", outline: "none",
  };
  return (
    <div onClick={() => !busy && onClose && onClose()} style={{
      position: "fixed", inset: 0, zIndex: 1250, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 400, background: "var(--bg-primary)", color: "var(--text-primary)",
        border: "1px solid var(--border)", borderRadius: 16, padding: "18px 18px 16px",
      }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>받은 금액 수정</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
          협력사 작업은 수수료가 공급가 기준입니다. 받은 금액과 부가세 포함 여부를 여기서 정하면 공급가 · 항목 줄 · 정산이 같이 다시 계산됩니다.
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", margin: "14px 0 6px" }}>고객에게 받은 금액</div>
        <input type="text" inputMode="numeric" autoFocus
          value={amount ? Number(amount).toLocaleString("ko-KR") : ""}
          onChange={(e) => { setAmount(e.target.value.replace(/\D/g, "").slice(0, 9)); setError(""); }}
          placeholder="0" aria-label="받은 금액" style={field}/>

        <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>
          <input type="checkbox" checked={vat} onChange={(e) => { setVat(e.target.checked); setError(""); }} style={{ width: 20, height: 20 }}/>
          부가세 포함해서 받음
        </label>

        {received > 0 && (
          <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "var(--bg-secondary)", fontSize: 13, lineHeight: 1.6 }}>
            공급가 <b>{won(supply)}</b>{vat ? ` · 부가세 ${won(received - supply)}` : ""}
            {quote > 0 && <span style={{ color: "var(--text-secondary)" }}> · 견적 {won(quote)}</span>}
          </div>
        )}

        {short > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#E5484D", margin: "12px 0 6px" }}>
              공급가가 견적보다 {won(short)} 적습니다 — 사유 (필수)
            </div>
            <input type="text" value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }}
              placeholder="예: 현장 할인" aria-label="사유"
              style={{ ...field, fontSize: 14, fontWeight: 600, textAlign: "left", padding: "11px 12px" }}/>
          </>
        )}

        {error && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: "#E5484D", lineHeight: 1.5 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} disabled={busy} style={{
            flex: 1, padding: 13, borderRadius: 11, background: "transparent", border: "1px solid var(--border)",
            color: "var(--text-primary)", fontSize: 14, fontWeight: 800, fontFamily: "inherit", cursor: "pointer",
          }}>닫기</button>
          <button type="button" onClick={save} disabled={busy} style={{
            flex: 1.4, padding: 13, borderRadius: 11, border: "none", background: "#FF1B8D", color: "#fff",
            fontSize: 14, fontWeight: 800, fontFamily: "inherit", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
          }}>{busy ? "저장 중…" : "저장"}</button>
        </div>
      </div>
    </div>
  );
}

export default SubReceivedEditModal;

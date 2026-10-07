// 2026-10-07 Mig 244·245·247 — 협력사 작업의 원청 몫. 올데이케어(운영자) 화면 전용.
//   · 화이트코어가 올데이케어에 보내는 수수료(35%)는 그대로다. 그 안에서 원청 몫을 따로 보여 준다.
//     원청 몫 = LEAST(견적 공급가 × 35%, 수수료) · 올데이케어 실제 몫 = 수수료 − 원청 몫
//   · 협력사 관리자·기사 화면에는 쓰지 않는다 (원청 몫을 보여 주지 않는다).
//   · 사장님 지시(2026-10-07): 원청 이름은 화면에 쓰지 않는다. 문구는 "원청" 으로 고정하고,
//     어느 원청인지는 작업코드(K-…)로 구분한다.
//   SubPrincipalSplitCard : 작업 상세 — 견적(수정 가능) · 원청 몫 · 올데이케어 몫
//   PrincipalRemitBox     : 협력사 수수료 화면 — "원청에 보낼 돈" 날짜별 줄 + [원청 송금 완료]
//   useSubSplits          : 작업 id 목록 → Map(task_id → 분배) (정산 화면의 작업 줄 표시용)
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminGetSubSplits, adminSetSubQuote, adminListPrincipalRemits, adminMarkPrincipalRemitPaid,
} from "../lib/subcontractorsDb.js";
import { fmtWon, fmtWonSigned } from "../utils/money.js";

const VIOLET = "#8B5CF6";
const small = { fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 };
const linkBtn = {
  background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px",
  fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};
const tag = (bg, fg) => ({ display: "inline-block", fontSize: 10.5, fontWeight: 800, padding: "1px 6px", borderRadius: 5, background: bg, color: fg, marginLeft: 6, whiteSpace: "nowrap" });
// 화면에 쓰는 원청 문구 — 이름을 쓰지 않고 "원청" 으로 고정한다 (어느 원청인지는 작업코드로 구분)
export const shortPrincipal = () => "원청";

function dayLabel(ymd) {
  const [, m, d] = String(ymd || "").split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : String(ymd || "");
}

export function useSubSplits(taskIds) {
  const key = useMemo(() => [...new Set((taskIds || []).filter(Boolean))].sort().join(","), [taskIds]);
  const [map, setMap] = useState(() => new Map());
  useEffect(() => {
    let alive = true;
    if (!key) { setMap(new Map()); return undefined; }
    adminGetSubSplits(key.split(",")).then(res => {
      if (!alive) return;
      // 244 실행 전이면 조용히 빈 값 (화면은 전과 같다)
      setMap(new Map((res.ok && Array.isArray(res.rows) ? res.rows : []).map(r => [r.task_id, r])));
    });
    return () => { alive = false; };
  }, [key]);
  return map;
}

// 정산 화면 작업 줄 아래 한 줄 — "원청 35,000 / 올데이케어 17,500"
export function SplitNote({ split }) {
  if (!split || !split.has_rule || split.fee == null) return null;
  const share = Number(split.share) || 0;
  const fee = Number(split.fee) || 0;
  return (
    <div style={{ fontSize: 11.5, fontWeight: 700, color: VIOLET, marginTop: 2 }}>
      {shortPrincipal(split.principal_name)} {fmtWon(share)} / 올데이케어 {fmtWon(Math.max(0, fee - share))}
      {split.quote_edited_at && <span style={tag("rgba(249,115,22,0.16)", "#F97316")}>견적 수정</span>}
      {split.note === "no_quote" && <span style={tag("rgba(229,72,77,0.14)", "#E5484D")}>⚠ 견적 없음 — 수수료 전액</span>}
    </div>
  );
}

// ── 작업 상세: 원청 몫 카드 (운영자 전용) ──
export function SubPrincipalSplitCard({ task, style = {} }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const taskId = task && task.id;
  const load = useCallback(async () => {
    if (!taskId) return;
    const res = await adminGetSubSplits([taskId]);
    setData(res.ok && Array.isArray(res.rows) && res.rows[0] ? res.rows[0] : null);
  }, [taskId]);
  // 작업이 다시 읽힐 때(완료 · 금액 변경 등)도 같이 다시 읽는다
  useEffect(() => { load(); }, [load, task && task.status, task && task.supplyAmount, task && task.updatedAt]);

  if (!data || !data.has_rule) return null;        // 원청 몫 규칙이 없는 작업(올데이케어 원청 등)은 카드 없음
  const pname = shortPrincipal(data.principal_name);
  const quote = Number(data.quote) || 0;
  const fee = data.fee == null ? null : Number(data.fee) || 0;
  const share = Number(data.share) || 0;

  async function editQuote() {
    if (busy) return;
    const v = window.prompt(`${pname} 몫 계산에 쓰는 견적 공급가(부가세 제외)를 고칩니다.\n지금: ${fmtWon(quote)}\n\n새 금액을 숫자로 입력해 주세요.`, String(quote || ""));
    if (v == null) return;
    const n = Math.floor(Number(String(v).replace(/[^0-9]/g, "")));
    if (!Number.isFinite(n) || n < 0 || String(v).trim() === "") { window.alert("금액을 숫자로 입력해 주세요."); return; }
    const reason = window.prompt(`견적을 ${fmtWon(quote)} → ${fmtWon(n)} 로 고칩니다.\n고치는 사유를 입력해 주세요. (이력에 남습니다)`);
    if (reason == null) return;
    if (!String(reason).trim()) { window.alert("사유를 입력해 주세요."); return; }
    setBusy(true);
    const res = await adminSetSubQuote(taskId, n, String(reason).trim());
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "고치지 못했습니다."); return; }
    load();
  }

  const row = (label, value, strong = false, color = null) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "3px 0" }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: strong ? 15 : 13, fontWeight: strong ? 800 : 700, color: color || "var(--text-primary)" }}>{value}</span>
    </div>
  );
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 800, color: VIOLET }}>
          원청 몫
          {data.quote_edited_at && <span style={tag("rgba(249,115,22,0.16)", "#F97316")}>견적 수정</span>}
        </div>
        <button type="button" disabled={busy} onClick={editQuote} style={linkBtn}>{busy ? "…" : "견적 수정"}</button>
      </div>
      {row(`${pname} 몫 기준 견적 (부가세 제외)`, quote > 0 ? fmtWon(quote) : "없음")}
      {data.quote_edited_at && (
        <div style={{ ...small, fontSize: 11 }}>운영자가 고친 견적입니다{data.quote_edited_by ? ` · ${data.quote_edited_by}` : ""}</div>
      )}
      {quote <= 0 && (
        <div style={{ ...small, color: "#E5484D", fontWeight: 700 }}>
          ⚠ 견적이 없습니다. 이대로 완료되면 수수료 전액이 {pname} 몫으로 계산됩니다. [견적 수정] 으로 넣어 주세요.
        </div>
      )}
      <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }}/>
      {fee == null ? (
        <div style={small}>완료 후 계산됩니다. ({pname} 몫 = 견적의 35%, 수수료를 넘지 않음)</div>
      ) : (
        <>
          {/* 2026-10-07 Mig 256 — 직영 주방후드도 같은 카드: 수수료 = 받은 공급가의 35% */}
          {row(task && (task.subcontractorId || task.subcontractor_id) ? "화이트코어에게서 받는 수수료" : "수수료 (기사 몫을 뺀 금액)", fmtWon(fee))}
          {row(`${pname}에 줄 몫`, fmtWon(share), true, VIOLET)}
          {row("올데이케어 실제 몫", fmtWon(Math.max(0, fee - share)), true, "#FF1B8D")}
        </>
      )}
    </div>
  );
}

// ── 협력사 수수료 화면: 원청에 보낼 돈 (날짜별) ──
export function PrincipalRemitBox({ refreshKey = 0, style = {} }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const [showPaid, setShowPaid] = useState(false);

  const load = useCallback(async () => {
    const res = await adminListPrincipalRemits();
    setRows(res.ok && Array.isArray(res.rows) ? res.rows : null);     // 245 실행 전이면 상자 자체를 숨긴다
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (!rows || rows.length === 0) return null;
  const payable = rows.filter(r => !r.paid_at && !r.absorbed && Number(r.amount) > 0);
  const waiting = rows.filter(r => !r.paid_at && !r.absorbed && Number(r.amount) <= 0);     // 보낼 것 없음 — 다음 줄로 넘어감
  const paid = rows.filter(r => r.paid_at);
  const total = payable.reduce((a, r) => a + (Number(r.amount) || 0), 0);

  async function mark(r, paidFlag) {
    if (busy) return;
    const who = shortPrincipal(r.principal_name);
    const msg = paidFlag
      ? `${dayLabel(r.date)} 입금 확인분 · 원청 송금\n${fmtWon(r.amount)} 을 ${who}에 송금했습니까?\n\n가계부에 출금 ${fmtWon(r.amount)} 이 기록됩니다.`
      : `${dayLabel(r.date)} 입금 확인분 · 원청 송금 완료(${fmtWon(r.amount)})를 되돌릴까요?\n가계부의 출금 기록도 지워집니다.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    const res = await adminMarkPrincipalRemitPaid(r.id, paidFlag);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "처리하지 못했습니다."); return; }
    if (res.cashflow_error) window.alert("처리는 됐지만 가계부 기록에 실패했습니다. 가계부에 직접 입력해 주세요.");
    load();
  }

  const lineList = (r) => (
    <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--border)" }}>
      {Number(r.carried_in) !== 0 && (
        <div style={{ ...small, display: "flex", justifyContent: "space-between" }}><span>앞 날짜에서 넘어온 금액</span><b>{fmtWonSigned(r.carried_in)}</b></div>
      )}
      {(r.lines || []).map((l, i) => (
        <div key={i} style={{ ...small, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span className="mono">{l.task_no}</span> · {l.customer_name}
            {l.quote_edited && <span style={tag("rgba(249,115,22,0.16)", "#F97316")}>견적 수정</span>}
            {l.fee != null && <span> · 수수료 {fmtWon(l.fee)} 중 올데이케어 {fmtWon(Math.max(0, Number(l.fee) - Number(l.share_after)))}</span>}
          </span>
          <b style={{ flexShrink: 0 }}>{Number(l.delta) === Number(l.share_after) ? fmtWon(l.delta) : `${fmtWonSigned(l.delta)} (조정)`}</b>
        </div>
      ))}
    </div>
  );
  const card = (r, kind) => (
    <div key={r.id} style={{
      border: `1px solid ${kind === "todo" ? "var(--danger, #E5484D)" : "var(--border)"}`, borderRadius: 10, padding: "9px 11px", marginTop: 8,
      background: kind === "todo" ? "rgba(229,72,77,0.06)" : "transparent",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", color: "var(--text-primary)", fontSize: 13, fontWeight: 800, textAlign: "left", flex: 1, minWidth: 0 }}>
          {open === r.id ? "▼" : "▶"} {dayLabel(r.date)} 입금 확인분 · 원청 송금
          <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}> · {r.subcontractor_name} · {(r.lines || []).length}건</span>
        </button>
        <b style={{ fontSize: 14, color: kind === "todo" ? "var(--danger, #E5484D)" : "var(--text-primary)" }}>{fmtWon(r.amount)}</b>
        {kind === "todo" && (
          <button type="button" disabled={busy} onClick={() => mark(r, true)} style={{ ...linkBtn, background: VIOLET, borderColor: VIOLET, color: "#fff" }}>
            {shortPrincipal(r.principal_name)} 송금 완료
          </button>
        )}
        {kind === "paid" && (
          <>
            <span style={{ ...small, fontSize: 11 }}>원청 송금 완료{r.paid_by ? ` · ${r.paid_by}` : ""}</span>
            <button type="button" disabled={busy} onClick={() => mark(r, false)} style={{ ...linkBtn, color: "var(--text-secondary)" }}>되돌리기</button>
          </>
        )}
        {kind === "wait" && <span style={{ ...small, fontSize: 11 }}>보낼 금액 없음 — 다음 입금 확인분에 합쳐집니다</span>}
      </div>
      {open === r.id && lineList(r)}
    </div>
  );

  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px", ...style }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: VIOLET, flex: 1 }}>원청에 보낼 돈</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: total > 0 ? "var(--danger, #E5484D)" : "var(--text-secondary)" }}>
          {total > 0 ? `미송금 ${fmtWon(total)}` : "미송금 없음"}
        </div>
      </div>
      <div style={{ ...small, fontSize: 11.5, marginTop: 2 }}>
        화이트코어 입금을 [확인] 한 날짜의 작업분만 올라옵니다. 송금한 뒤 [송금 완료] 를 눌러 주세요.
      </div>
      {payable.map(r => card(r, "todo"))}
      {waiting.map(r => card(r, "wait"))}
      {paid.length > 0 && (
        <button type="button" onClick={() => setShowPaid(v => !v)} style={{ ...linkBtn, marginTop: 10 }}>
          {showPaid ? "▼" : "▶"} 원청 송금 완료 {paid.length}건
        </button>
      )}
      {showPaid && paid.map(r => card(r, "paid"))}
    </div>
  );
}

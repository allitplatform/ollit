// 2026-10-07 Mig 252 — 협력사 → 올데이케어 "추가분" (오늘 수수료를 이미 보고한 뒤에 더 생긴 금액).
//   오늘 날짜가 잠긴 뒤 끝난 작업·늘어난 금액은 내일 날짜 줄로만 잡혀서 오늘은 보이지도 보고하지도 못했다.
//   기사 → 협력사 추가분(Mig 250)과 같은 방식: 따로 보고 → 받음 확인.
//   SubFeeExtraDueCard  : 협력사 관리자 정산 화면 맨 위 — "추가로 보낼 수수료" + [추가분 송금 보고] / 보고 뒤 [추가분 취소]
//   AdminSubFeeExtraBox : 운영자 협력사 수수료 화면 — "추가분 확인 대기" + [받음 확인] / 보고 취소(사유 필수)
//   252 실행 전이면 두 부품 모두 아무것도 그리지 않는다 (기존 화면 그대로).
import { useCallback, useEffect, useState } from "react";
import {
  subListFeeExtras, subReportFeeExtra, subCancelFeeExtra,
  adminListSubFeeExtras, adminConfirmSubFeeExtra, adminCancelSubFeeExtra,
} from "../lib/subcontractorsDb.js";
import { fmtWon, fmtWonSigned } from "../utils/money.js";

const AMBER = "#F5A524";
const card = {
  background: "var(--bg-card)", border: `1px solid ${AMBER}`, borderRadius: 14, padding: 14, marginBottom: 12,
};
const small = { fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 };
const mainBtn = {
  background: "var(--accent, #3B82F6)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px",
  fontSize: 14, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};
const linkBtn = {
  background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px",
  fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};
const row = { display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderTop: "1px solid var(--border)", marginTop: 8 };

function dayLabel(ymd) {
  const [, m, d] = String(ymd || "").split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : String(ymd || "");
}

function Lines({ lines }) {
  if (!lines || lines.length === 0) return null;
  return (
    <div style={{ marginTop: 6 }}>
      {lines.map((l, i) => (
        <div key={i} style={{ ...small, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {l.task_no} · {l.customer_name || ""}{l.origin_date ? ` · ${dayLabel(l.origin_date)} 작업` : ""}
          </span>
          <b style={{ color: "var(--text-primary)" }}>{fmtWon(l.fee)}</b>
        </div>
      ))}
    </div>
  );
}

// ── 협력사 관리자 ──
export function SubFeeExtraDueCard({ refreshKey = 0, onChanged }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await subListFeeExtras();
    setData(res.ok ? res : null);
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (!data) return null;
  const due = data.due || {};
  const dueAmount = Number(due.amount) || 0;
  const waiting = (data.rows || []).filter(e => !e.received_at);
  if (dueAmount <= 0 && waiting.length === 0) return null;

  const done = () => { load(); if (onChanged) onChanged(); };

  async function report() {
    if (busy) return;
    if (!window.confirm(`추가분 ${fmtWon(dueAmount)} 을 올데이케어에 송금했습니까?\n[확인]을 누르면 송금 보고가 올라갑니다.`)) return;
    setBusy(true);
    const res = await subReportFeeExtra(dueAmount);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "보고하지 못했습니다."); return; }
    done();
  }
  async function cancel(e) {
    if (busy) return;
    if (!window.confirm(`추가분 송금 보고(${fmtWon(e.amount)})를 취소할까요?\n다시 "추가로 보낼 수수료" 로 돌아갑니다.`)) return;
    setBusy(true);
    const res = await subCancelFeeExtra(e.id);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "취소하지 못했습니다."); return; }
    done();
  }

  return (
    <div style={card}>
      {dueAmount > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 800, color: AMBER }}>⚠ 추가로 보낼 수수료 {fmtWon(dueAmount)}</div>
          <div style={{ ...small, marginTop: 2 }}>
            오늘 수수료를 이미 보고한 뒤에 더 생긴 금액입니다. 지금 따로 보내고 [추가분 송금 보고]를 눌러 주세요.
            보고하지 않으면 다음 날짜 정산에 자동으로 더해집니다.
          </div>
          <Lines lines={due.lines}/>
          <button type="button" disabled={busy} onClick={report} style={{ ...mainBtn, width: "100%", marginTop: 10 }}>
            추가분 송금 보고 · {fmtWon(dueAmount)}
          </button>
        </>
      )}
      {waiting.map(e => (
        <div key={e.id} style={dueAmount > 0 ? row : { ...row, borderTop: "none", marginTop: 0, paddingTop: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>추가분 {fmtWon(e.amount)} · 보냄</div>
            <div style={small}>{dayLabel(e.ref_date)} 보고 · 올데이케어 확인을 기다리는 중</div>
            <Lines lines={e.lines}/>
          </div>
          <button type="button" disabled={busy} onClick={() => cancel(e)} style={linkBtn}>추가분 취소</button>
        </div>
      ))}
    </div>
  );
}

// ── 운영자 ──
export function AdminSubFeeExtraBox({ refreshKey = 0, onChanged, style = {} }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    const res = await adminListSubFeeExtras();
    setRows(res.ok && Array.isArray(res.rows) ? res.rows : null);
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (!rows || rows.length === 0) return null;
  const waiting = rows.filter(e => !e.received_at);
  const received = rows.filter(e => e.received_at);
  const done = () => { load(); if (onChanged) onChanged(); };

  async function confirm(e, flag) {
    if (busy) return;
    const msg = flag
      ? `${e.sub_name} 추가분 ${fmtWon(e.amount)} 을 받았습니까?\n\n가계부에 입금이 기록되고, 이 작업들의 원청 몫이 "원청에 보낼 돈" 에 들어갑니다.`
      : `${e.sub_name} 추가분 받음 확인(${fmtWon(e.amount)})을 되돌릴까요?\n가계부 입금 기록과 원청 송금 줄도 함께 되돌립니다.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    const res = await adminConfirmSubFeeExtra(e.id, flag);
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "처리하지 못했습니다."); return; }
    if (res.warning) window.alert("받음 확인은 됐지만 일부 기록에 실패했습니다. 가계부와 원청 송금 줄을 확인해 주세요.\n" + res.warning);
    done();
  }
  async function cancel(e) {
    if (busy) return;
    const reason = window.prompt(`${e.sub_name} · 추가분 송금 보고(${fmtWon(e.amount)})를 취소합니다.\n금액은 다시 협력사의 "추가로 보낼 수수료" 로 돌아갑니다.\n\n취소 사유를 입력해 주세요.`);
    if (reason == null) return;
    if (!String(reason).trim()) { window.alert("취소 사유를 입력해 주세요."); return; }
    setBusy(true);
    const res = await adminCancelSubFeeExtra(e.id, String(reason).trim());
    setBusy(false);
    if (!res.ok) { window.alert(res.error || "취소하지 못했습니다."); return; }
    done();
  }

  const item = (e, isDone) => (
    <div key={e.id} style={row}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>
          {e.sub_name} · 추가분 {fmtWon(e.amount)}
          {Number(e.diff) !== 0 && <span style={{ ...small, marginLeft: 6, color: "var(--danger, #EF4444)" }}>계산 {fmtWon(e.calc_amount)} · 차액 {fmtWonSigned(e.diff)}</span>}
        </div>
        <div style={small}>{dayLabel(e.ref_date)} 보고{isDone ? " · 받음 확인" : ""}</div>
        <Lines lines={e.lines}/>
      </div>
      {isDone
        ? <button type="button" disabled={busy} onClick={() => confirm(e, false)} style={linkBtn}>확인 취소</button>
        : (
          <>
            <button type="button" disabled={busy} onClick={() => cancel(e)} style={{ ...linkBtn, color: "var(--danger, #EF4444)" }}>보고 취소</button>
            <button type="button" disabled={busy} onClick={() => confirm(e, true)} style={mainBtn}>받음 확인</button>
          </>
        )}
    </div>
  );

  if (waiting.length === 0 && received.length === 0) return null;
  return (
    <div style={{ ...card, borderColor: waiting.length > 0 ? AMBER : "var(--border)", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: waiting.length > 0 ? AMBER : "var(--text-primary)" }}>
          협력사 추가분 확인 대기 {waiting.length}건
        </div>
        {received.length > 0 && (
          <button type="button" onClick={() => setShowDone(v => !v)} style={linkBtn}>
            {showDone ? "받은 내역 접기" : `받은 내역 ${received.length}`}
          </button>
        )}
      </div>
      <div style={{ ...small, marginTop: 2 }}>
        협력사가 그날 수수료를 보고한 뒤에 더 생긴 금액을 따로 보낸 것입니다. 받았으면 [받음 확인]을 눌러 주세요.
      </div>
      {waiting.map(e => item(e, false))}
      {showDone && received.map(e => item(e, true))}
    </div>
  );
}

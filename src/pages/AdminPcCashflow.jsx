// 2026-06-13 — PC 운영자 "통장" 화면 (현금흐름 수동 기록 + 잔고).
//
// 사장님 spec:
//   · 월 단위 입출금 수동 기록 + 기준 잔고 1행.
//   · 3카드: 들어온 돈 / 나간 돈 / 현재 잔고.
//   · 들어온 / 나간 표 각각 — 날짜·내용·금액 + 편집/삭제.
//   · 추가·수정·삭제 모두 확인 다이얼로그.
//   · 음수 차단(거래 amount), 금액 comma, 날짜 default 오늘 KST.
//   · 기준 잔고 = baseline (음수 허용 — 대출). upsert.
//   · current_balance = baseline + Σ all in − Σ all out (시점 무관).
//
// 가계부와 별개. 좁은 PC 액션 잘림 정정 (가계부 교훈 동일 적용).

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, Wallet, Plus, Edit3, Trash2, X, Save, Calendar,
  ArrowDownCircle, ArrowUpCircle, BookOpen,
} from "lucide-react";
import {
  listCashflow, addCashflow, updateCashflow, deleteCashflow,
  getCashflowBaseline, setCashflowBaseline,
  getCashflowSummary,
  CASHFLOW_DIRECTIONS, CASHFLOW_DIRECTION_KO,
} from "../lib/bookkeepingCashflowDb.js";

// ──────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────
const KO_DOW = ["일","월","화","수","목","금","토"];
function kstYmd(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}
function nowKstYm() { return kstYmd().slice(0, 7); }
function shiftYm(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const total = (y * 12) + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
function ymdToDow(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m||1)-1, d||1);
  return isNaN(dt.getTime()) ? "" : KO_DOW[dt.getDay()];
}

const fmtKRW = (n) => `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
const fmtKRWSigned = (n) => {
  const x = Number(n) || 0;
  return x < 0 ? `−₩${Math.abs(x).toLocaleString("ko-KR")}` : `₩${x.toLocaleString("ko-KR")}`;
};
function fmtAmountInput(raw, allowNegative = false) {
  let s = String(raw || "");
  let sign = "";
  if (allowNegative && s.startsWith("-")) { sign = "-"; s = s.slice(1); }
  const digits = s.replace(/\D/g, "");
  if (!digits) return sign;
  return sign + Number(digits).toLocaleString("ko-KR");
}
function parseAmount(s, allowNegative = false) {
  const str = String(s || "");
  const sign = allowNegative && str.startsWith("-") ? -1 : 1;
  return sign * (Number(str.replace(/\D/g, "")) || 0);
}

// ──────────────────────────────────────────────
// 본체
// ──────────────────────────────────────────────
export default function AdminPcCashflow({ t, user }) {
  const todayYmd = kstYmd();
  const [selectedYm, setSelectedYm] = useState(nowKstYm());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);                  // 그 달 거래
  const [summary, setSummary] = useState(null);          // month_in/out/current_balance
  const [baseline, setBaseline] = useState(null);        // {baseline_date, baseline_amount, memo} | null
  const [reloadTick, setReloadTick] = useState(0);
  const [dialog, setDialog] = useState(null);            // { mode, row?, direction? }
  const [baselineDialog, setBaselineDialog] = useState(false);

  const actor = user?.user_id || user?.userId || user?.id;

  useEffect(() => {
    if (!actor) { setLoading(false); return; }
    let alive = true;
    setLoading(true); setErr("");
    (async () => {
      const [resL, resS, resB] = await Promise.all([
        listCashflow(selectedYm, actor),
        getCashflowSummary(selectedYm, actor),
        getCashflowBaseline(actor),
      ]);
      if (!alive) return;
      if (!resL?.ok) { setErr(resL?.error || "거래 조회 실패"); setLoading(false); return; }
      if (!resS?.ok) { setErr(resS?.error || "요약 조회 실패"); setLoading(false); return; }
      if (!resB?.ok) { setErr(resB?.error || "기준 잔고 조회 실패"); setLoading(false); return; }
      setRows(resL.rows || []);
      setSummary(resS);
      setBaseline(resB.row || null);
      setLoading(false);
    })().catch(e => { if (alive) { setErr(e?.message || "에러"); setLoading(false); } });
    return () => { alive = false; };
  }, [selectedYm, actor, reloadTick]);

  const inRows  = useMemo(() => (rows || []).filter(r => r.direction === "in"),  [rows]);
  const outRows = useMemo(() => (rows || []).filter(r => r.direction === "out"), [rows]);

  const isThisMonth = selectedYm === nowKstYm();

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1400, margin: "0 auto" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <BookOpen size={22} style={{ color: t.accent }}/>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>통장</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
            월별 입출금 수동 기록 · 기준 잔고 + 누적 = 현재 잔고
          </div>
        </div>
      </div>

      {/* 월 선택 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 14px", marginBottom: 14,
        background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10,
      }}>
        <button onClick={() => setSelectedYm(s => shiftYm(s, -1))} aria-label="이전 달" style={navBtnStyle(t)}>
          <ChevronLeft size={16}/>
        </button>
        <div style={{
          padding: "7px 14px",
          background: t.bgInset, border: `1.5px solid ${t.accent}`,
          borderRadius: 8,
          fontSize: 14, fontWeight: 800, color: t.text,
          minWidth: 140, textAlign: "center",
          fontVariantNumeric: "tabular-nums",
        }}>
          {selectedYm.slice(0, 4)}년 {Number(selectedYm.slice(5, 7))}월
        </div>
        <button onClick={() => setSelectedYm(s => shiftYm(s, +1))} aria-label="다음 달" style={navBtnStyle(t)}>
          <ChevronRight size={16}/>
        </button>
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "7px 12px",
          background: "transparent", border: `1px solid ${t.border}`,
          borderRadius: 8,
          fontSize: 12, fontWeight: 700, color: t.textMuted,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          <Calendar size={13}/>
          <span>월 선택</span>
          <input type="month" value={selectedYm}
            onChange={(e) => e.target.value && setSelectedYm(e.target.value)}
            style={{
              border: "none", background: "transparent",
              fontFamily: "inherit", fontSize: 12, color: t.text,
              padding: 0, width: 0, opacity: 0, position: "absolute",
            }}/>
        </label>
        <button onClick={() => setSelectedYm(nowKstYm())} disabled={isThisMonth}
          style={{
            padding: "7px 14px",
            background: isThisMonth ? "transparent" : t.accentBg,
            border: `1px solid ${isThisMonth ? t.border : t.accent}`,
            borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            color: isThisMonth ? t.textMuted : t.accent,
            cursor: isThisMonth ? "default" : "pointer",
            fontFamily: "inherit",
            opacity: isThisMonth ? 0.6 : 1,
          }}>
          → 이번달
        </button>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 12, color: t.textSecondary }}>
          이번달 거래 <span className="mono" style={{ fontWeight: 700, color: t.text }}>{rows.length}</span>건
        </div>
      </div>

      {/* 3 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
        <BigCard t={t} icon={<ArrowDownCircle size={18}/>}
          label="들어온 돈" amount={summary?.month_in || 0} color={t.success}/>
        <BigCard t={t} icon={<ArrowUpCircle size={18}/>}
          label="나간 돈" amount={summary?.month_out || 0} color={t.danger}/>
        <BigCard t={t} icon={<Wallet size={18}/>}
          label="현재 잔고 (전체 누적)" amount={summary?.current_balance || 0}
          color={t.accent} signed big/>
      </div>

      {/* 기준 잔고 영역 */}
      <BaselineCard t={t} baseline={baseline}
        onEdit={() => setBaselineDialog(true)}
      />

      {err && (
        <div style={{
          padding: "10px 14px", marginBottom: 12,
          background: t.dangerBg, border: `1px solid ${t.dangerBorder}`, borderRadius: 8,
          fontSize: 12, color: t.danger, fontWeight: 600,
        }}>⚠️ {err}</div>
      )}

      {/* 들어온 돈 표 */}
      <DirectionSection t={t}
        direction="in"
        title="들어온 돈"
        icon={<ArrowDownCircle size={14} style={{ color: t.success }}/>}
        rows={inRows}
        sum={summary?.month_in || 0}
        loading={loading}
        onAdd={() => setDialog({ mode: "add", direction: "in", row: null })}
        onEdit={(r) => setDialog({ mode: "edit", direction: r.direction, row: r })}
        onDelete={(r) => setDialog({ mode: "delete", row: r })}
      />

      {/* 나간 돈 표 */}
      <DirectionSection t={t}
        direction="out"
        title="나간 돈"
        icon={<ArrowUpCircle size={14} style={{ color: t.danger }}/>}
        rows={outRows}
        sum={summary?.month_out || 0}
        loading={loading}
        onAdd={() => setDialog({ mode: "add", direction: "out", row: null })}
        onEdit={(r) => setDialog({ mode: "edit", direction: r.direction, row: r })}
        onDelete={(r) => setDialog({ mode: "delete", row: r })}
      />

      {/* 다이얼로그 */}
      {dialog?.mode === "add" && (
        <EditDialog t={t} mode="add" actor={actor}
          direction={dialog.direction}
          defaultDate={todayYmd}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); setReloadTick(n => n + 1); }}
        />
      )}
      {dialog?.mode === "edit" && (
        <EditDialog t={t} mode="edit" actor={actor}
          row={dialog.row}
          direction={dialog.row.direction}
          defaultDate={dialog.row.flow_date}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); setReloadTick(n => n + 1); }}
        />
      )}
      {dialog?.mode === "delete" && (
        <DeleteDialog t={t} row={dialog.row} actor={actor}
          onClose={() => setDialog(null)}
          onDeleted={() => { setDialog(null); setReloadTick(n => n + 1); }}
        />
      )}

      {baselineDialog && (
        <BaselineDialog t={t}
          actor={actor}
          baseline={baseline}
          defaultDate={todayYmd}
          onClose={() => setBaselineDialog(false)}
          onSaved={() => { setBaselineDialog(false); setReloadTick(n => n + 1); }}
        />
      )}
    </div>
  );
}

function navBtnStyle(t) {
  return {
    background: "transparent", border: `1px solid ${t.border}`,
    borderRadius: 8, padding: "7px 10px",
    color: t.text, cursor: "pointer", display: "flex",
    fontFamily: "inherit",
  };
}

// ──────────────────────────────────────────────
// BigCard (3개)
// ──────────────────────────────────────────────
function BigCard({ t, icon, label, amount, color, signed, big }) {
  const display = signed ? fmtKRWSigned(amount) : fmtKRW(amount);
  return (
    <div style={{
      background: t.bgElevated,
      border: `${big ? 2 : 1}px solid ${big ? color : t.border}`,
      borderRadius: 12,
      padding: big ? "18px 22px" : "16px 20px",
      display: "flex", flexDirection: "column", gap: 6,
      boxShadow: big ? `0 0 0 1px ${color}22` : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{
          fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4,
        }}>{label}</span>
      </div>
      <div className="mono" style={{
        fontSize: big ? 22 : 18,
        fontWeight: 800, color,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.4px",
        wordBreak: "keep-all",
      }}>{display}</div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 기준 잔고 카드
// ──────────────────────────────────────────────
function BaselineCard({ t, baseline, onEdit }) {
  const hasBaseline = !!baseline;
  return (
    <div style={{
      background: t.bgInset,
      border: `1px dashed ${t.border}`,
      borderRadius: 10,
      padding: "12px 16px", marginBottom: 14,
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 16 }}>🏦</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4 }}>
          기준 잔고 {hasBaseline && (
            <span style={{ color: t.textDim, fontWeight: 500, marginLeft: 4 }}>
              · {baseline.baseline_date}
            </span>
          )}
        </div>
        <div className="mono" style={{
          fontSize: 16, fontWeight: 800,
          color: hasBaseline ? t.text : t.textMuted,
          fontVariantNumeric: "tabular-nums",
        }}>
          {hasBaseline ? fmtKRWSigned(baseline.baseline_amount) : "설정 안 됨"}
        </div>
        {hasBaseline && baseline.memo && (
          <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 2 }}>
            {baseline.memo}
          </div>
        )}
      </div>
      <button onClick={onEdit} style={{
        padding: "8px 14px",
        background: hasBaseline ? "transparent" : t.accent,
        color: hasBaseline ? t.textSecondary : "#fff",
        border: `1px solid ${hasBaseline ? t.border : t.accent}`,
        borderRadius: 8,
        fontSize: 12, fontWeight: 700, fontFamily: "inherit",
        cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 5,
      }}>
        <Edit3 size={12}/>
        {hasBaseline ? "기준 수정" : "기준 잔고 설정"}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────
// 들어온 / 나간 섹션
//   좁은 PC 액션 잘림 정정 — 95px / minmax(0,1fr) / 110px / 60px (가계부 패턴)
// ──────────────────────────────────────────────
function DirectionSection({ t, direction, title, icon, rows, sum, loading, onAdd, onEdit, onDelete }) {
  const isIn = direction === "in";
  const sumColor = isIn ? t.success : t.danger;
  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
      overflow: "hidden", marginBottom: 14,
    }}>
      {/* 섹션 헤더 + 추가 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 18px",
        borderBottom: `1px solid ${t.border}`,
      }}>
        {icon}
        <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{title}</div>
        <div style={{ fontSize: 12, color: t.textSecondary }}>
          <span className="mono" style={{ fontWeight: 700, color: t.text }}>{rows.length}</span>건
          <span style={{ color: t.textDim, margin: "0 6px" }}>·</span>
          <span className="mono" style={{ fontWeight: 800, color: sumColor }}>{fmtKRW(sum)}</span>
        </div>
        <div style={{ flex: 1 }}/>
        <button onClick={onAdd} style={{
          padding: "8px 14px",
          background: isIn ? t.success : t.danger,
          color: "#fff",
          border: "none", borderRadius: 8,
          fontSize: 12, fontWeight: 800,
          cursor: "pointer", fontFamily: "inherit",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          <Plus size={13} strokeWidth={2.8}/>
          {isIn ? "입금 추가" : "출금 추가"}
        </button>
      </div>

      {/* 표 */}
      {loading ? (
        <div style={{ padding: "30px 20px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
          불러오는 중...
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: "30px 20px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
          이번 달 {isIn ? "입금" : "출금"} 없음
        </div>
      ) : (
        <>
          {/* 표 헤더 (4컬럼 — 좁은 PC 안전) */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "95px minmax(0, 1fr) 110px 60px",
            gap: 8, alignItems: "center",
            padding: "10px 14px",
            fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4,
            borderBottom: `1px solid ${t.border}`,
          }}>
            <span>날짜</span>
            <span>내용</span>
            <span style={{ textAlign: "right" }}>금액</span>
            <span style={{ textAlign: "right" }}>액션</span>
          </div>
          {rows.map(r => (
            <CashflowRow key={r.id} t={t} row={r} amountColor={sumColor}
              onEdit={() => onEdit(r)} onDelete={() => onDelete(r)}/>
          ))}
        </>
      )}
    </div>
  );
}

function CashflowRow({ t, row, amountColor, onEdit, onDelete }) {
  const dow = ymdToDow(row.flow_date);
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "95px minmax(0, 1fr) 110px 60px",
      gap: 8, alignItems: "center",
      padding: "10px 14px",
      borderTop: `1px solid ${t.border}`,
    }}>
      <span className="mono" style={{
        fontSize: 12, color: t.text, fontVariantNumeric: "tabular-nums",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {row.flow_date}{dow ? ` (${dow})` : ""}
      </span>
      <span style={{
        fontSize: 12, color: row.memo ? t.text : t.textDim,
        minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{row.memo || "—"}</span>
      <span className="mono" style={{
        fontSize: 13, fontWeight: 800, color: amountColor,
        textAlign: "right", fontVariantNumeric: "tabular-nums",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{fmtKRW(row.amount)}</span>
      <div style={{ display: "flex", gap: 3, justifyContent: "flex-end" }}>
        <button onClick={onEdit} aria-label="편집" title="편집" style={iconBtnStyle(t)}>
          <Edit3 size={12}/>
        </button>
        <button onClick={onDelete} aria-label="삭제" title="삭제" style={{
          ...iconBtnStyle(t), color: t.danger,
        }}>
          <Trash2 size={12}/>
        </button>
      </div>
    </div>
  );
}

function iconBtnStyle(t) {
  return {
    padding: "5px 6px",
    background: "transparent", border: `1px solid ${t.border}`,
    color: t.textSecondary, borderRadius: 6,
    cursor: "pointer", display: "inline-flex",
    fontFamily: "inherit",
  };
}

// ──────────────────────────────────────────────
// 추가/편집 다이얼로그 + 확인 단계
// ──────────────────────────────────────────────
function EditDialog({ t, mode, actor, direction, row, defaultDate, onClose, onSaved }) {
  const [amountStr, setAmountStr] = useState(row?.amount != null ? Number(row.amount).toLocaleString("ko-KR") : "");
  const [date, setDate]           = useState(row?.flow_date || defaultDate);
  const [memo, setMemo]           = useState(row?.memo || "");
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const amount = parseAmount(amountStr);
  const hasAll = amount >= 0 && !!date;
  const dirLabel = CASHFLOW_DIRECTION_KO[direction] || direction;
  const isIn = direction === "in";

  function handleSubmit() {
    if (!hasAll) { setActionErr("금액·날짜 입력 필요"); return; }
    setActionErr("");
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!actor) { setActionErr("관리자 사용자 ID 없음"); setConfirmOpen(false); return; }
    setBusy(true);
    try {
      let res;
      if (mode === "add") {
        res = await addCashflow({ direction, amount, flowDate: date, memo, actor });
      } else {
        res = await updateCashflow({ id: row.id, direction, amount, flowDate: date, memo, actor });
      }
      if (!res?.ok) {
        setActionErr(res?.error || "저장 실패");
        setConfirmOpen(false);
      } else {
        onSaved?.();
      }
    } catch (e) {
      setActionErr(e?.message || "예외 발생");
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Backdrop onClick={onClose}/>
      <DialogCard t={t} width={460}>
        <DialogHeader t={t}
          title={`${dirLabel} ${mode === "add" ? "추가" : "편집"}`}
          subtitle={`${isIn ? "🟢 입금" : "🔴 출금"} 거래`}
          onClose={onClose}
        />
        <FieldText t={t} label="금액 (₩)" required value={amountStr}
          onChange={(v) => setAmountStr(fmtAmountInput(v))}
          placeholder="예: 1,000,000"
          monospace
          hint="음수 불가. 0 이상 정수."
        />
        <FieldDate t={t} label="날짜" required value={date} onChange={setDate}/>
        <FieldArea t={t} label="내용" value={memo} onChange={setMemo}
          placeholder={isIn ? "예: 6월 정산 입금" : "예: 사무실 임대료"}
          rows={2}
        />
        {actionErr && <ErrorBox t={t}>⚠️ {actionErr}</ErrorBox>}
        <DialogFooter>
          <BtnGhost t={t} onClick={onClose} disabled={busy}>취소</BtnGhost>
          <BtnPrimary t={t} onClick={handleSubmit} disabled={busy}>
            <Save size={13}/>
            저장
          </BtnPrimary>
        </DialogFooter>
      </DialogCard>

      {confirmOpen && (
        <ConfirmPanel t={t}
          title={mode === "add" ? `${dirLabel} 추가 확인` : "수정 확인"}
          body={
            <PreviewLines t={t} rows={[
              ["구분",  dirLabel],
              ["금액", fmtKRW(amount), "mono"],
              ["날짜", date, "mono"],
              ["내용", memo || "(없음)"],
            ]}/>
          }
          confirmLabel={busy ? "저장 중..." : "정말 저장"}
          busy={busy}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}

function DeleteDialog({ t, row, actor, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const dirLabel = CASHFLOW_DIRECTION_KO[row.direction] || row.direction;

  async function handleDelete() {
    if (!actor) { setActionErr("관리자 사용자 ID 없음"); return; }
    setBusy(true);
    try {
      const res = await deleteCashflow(row.id, actor);
      if (!res?.ok) setActionErr(res?.error || "삭제 실패");
      else onDeleted?.();
    } catch (e) {
      setActionErr(e?.message || "예외 발생");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Backdrop onClick={busy ? undefined : onClose}/>
      <DialogCard t={t} width={400} accent="danger">
        <div style={{ fontSize: 16, fontWeight: 800, color: t.danger, marginBottom: 12 }}>
          🗑 {dirLabel} 삭제
        </div>
        <div style={{ fontSize: 12, color: t.text, marginBottom: 14, lineHeight: 1.6 }}>
          이 거래를 정말 삭제하시겠습니까?
        </div>
        <div style={{
          padding: "12px 14px",
          background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 10,
          marginBottom: 14,
        }}>
          <PreviewLines t={t} rows={[
            ["구분",  dirLabel],
            ["금액", fmtKRW(row.amount), "mono"],
            ["날짜", row.flow_date, "mono"],
            ["내용", row.memo || "(없음)"],
          ]}/>
        </div>
        {actionErr && <ErrorBox t={t}>⚠️ {actionErr}</ErrorBox>}
        <DialogFooter>
          <BtnGhost t={t} onClick={onClose} disabled={busy}>되돌리기</BtnGhost>
          <button onClick={handleDelete} disabled={busy} style={{
            padding: "10px 18px",
            background: busy ? t.bgInset : t.danger,
            color: busy ? t.textMuted : "#fff",
            border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 800,
            cursor: busy ? "wait" : "pointer",
            fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", gap: 6,
            opacity: busy ? 0.6 : 1,
          }}>
            <Trash2 size={13}/>
            {busy ? "삭제 중..." : "정말 삭제"}
          </button>
        </DialogFooter>
      </DialogCard>
    </>
  );
}

// ──────────────────────────────────────────────
// 기준 잔고 설정/수정 다이얼로그 (음수 허용)
// ──────────────────────────────────────────────
function BaselineDialog({ t, actor, baseline, defaultDate, onClose, onSaved }) {
  const [amountStr, setAmountStr] = useState(
    baseline?.baseline_amount != null
      ? (baseline.baseline_amount < 0
          ? `-${Math.abs(baseline.baseline_amount).toLocaleString("ko-KR")}`
          : Number(baseline.baseline_amount).toLocaleString("ko-KR"))
      : ""
  );
  const [date, setDate] = useState(baseline?.baseline_date || defaultDate);
  const [memo, setMemo] = useState(baseline?.memo || "");
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const amount = parseAmount(amountStr, true);
  const hasAll = !!date && amountStr !== "";

  function handleSubmit() {
    if (!hasAll) { setActionErr("날짜·금액 입력 필요"); return; }
    setActionErr("");
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!actor) { setActionErr("관리자 사용자 ID 없음"); setConfirmOpen(false); return; }
    setBusy(true);
    try {
      const res = await setCashflowBaseline({
        baselineDate:   date,
        baselineAmount: amount,
        memo,
        actor,
      });
      if (!res?.ok) {
        setActionErr(res?.error || "저장 실패");
        setConfirmOpen(false);
      } else {
        onSaved?.();
      }
    } catch (e) {
      setActionErr(e?.message || "예외 발생");
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Backdrop onClick={onClose}/>
      <DialogCard t={t} width={480}>
        <DialogHeader t={t}
          title={baseline ? "기준 잔고 수정" : "기준 잔고 설정"}
          subtitle="음수 허용 (대출/마이너스 통장). 모든 입출금이 누적되는 base."
          onClose={onClose}
        />
        <FieldText t={t} label="기준 금액 (₩, 음수 가능)" required value={amountStr}
          onChange={(v) => setAmountStr(fmtAmountInput(v, true))}
          placeholder="예: 5,000,000 (또는 -300,000)"
          monospace
          hint="앞에 - 입력 시 음수. 통장 시작 시점의 실제 잔고."
        />
        <FieldDate t={t} label="기준일" required value={date} onChange={setDate}/>
        <FieldArea t={t} label="메모" value={memo} onChange={setMemo}
          placeholder="(선택) 예: 2026년 1월 1일 시작 잔고"
          rows={2}
        />
        {actionErr && <ErrorBox t={t}>⚠️ {actionErr}</ErrorBox>}
        <DialogFooter>
          <BtnGhost t={t} onClick={onClose} disabled={busy}>취소</BtnGhost>
          <BtnPrimary t={t} onClick={handleSubmit} disabled={busy}>
            <Save size={13}/>
            저장
          </BtnPrimary>
        </DialogFooter>
      </DialogCard>

      {confirmOpen && (
        <ConfirmPanel t={t}
          title="기준 잔고 저장 확인"
          body={
            <>
              <PreviewLines t={t} rows={[
                ["기준일", date, "mono"],
                ["금액",  fmtKRWSigned(amount), "mono"],
                ["메모",  memo || "(없음)"],
              ]}/>
              {baseline && (
                <div style={{ fontSize: 11, color: t.warning, marginTop: 10, fontWeight: 600 }}>
                  ⚠️ 기존 기준 잔고({fmtKRWSigned(baseline.baseline_amount)}) 가 덮어씌워집니다. 현재 잔고도 재계산됩니다.
                </div>
              )}
            </>
          }
          confirmLabel={busy ? "저장 중..." : "정말 저장"}
          busy={busy}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}

// ──────────────────────────────────────────────
// 다이얼로그 공용 헬퍼 (가계부 화면과 동일 패턴)
// ──────────────────────────────────────────────
function Backdrop({ onClick }) {
  return (
    <div onClick={onClick} style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)", zIndex: 200,
      cursor: onClick ? "pointer" : "default",
    }}/>
  );
}
function DialogCard({ t, width = 460, accent, children }) {
  return (
    <div style={{
      position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
      width: `min(${width}px, 92vw)`,
      background: t.bgElevated, borderRadius: 14,
      border: `${accent === "danger" ? 2 : 1}px solid ${accent === "danger" ? t.danger : t.border}`,
      boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
      zIndex: 201, padding: "22px 26px",
      display: "flex", flexDirection: "column", gap: 14,
      maxHeight: "90vh", overflow: "auto",
    }}>{children}</div>
  );
}
function DialogHeader({ t, title, subtitle, onClose }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <button onClick={onClose} aria-label="닫기" style={{
        background: "transparent", border: "none", padding: 4,
        color: t.textMuted, cursor: "pointer", display: "flex",
      }}>
        <X size={18}/>
      </button>
    </div>
  );
}
function DialogFooter({ children }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
      {children}
    </div>
  );
}
function BtnGhost({ t, onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "10px 18px",
      background: "transparent", border: `1px solid ${t.border}`,
      borderRadius: 8, fontSize: 13, fontWeight: 700,
      color: t.textSecondary, cursor: disabled ? "wait" : "pointer",
      fontFamily: "inherit",
    }}>{children}</button>
  );
}
function BtnPrimary({ t, onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "10px 20px",
      background: disabled ? t.bgInset : t.accent,
      border: "none", borderRadius: 8,
      fontSize: 13, fontWeight: 800, color: disabled ? t.textMuted : "#fff",
      cursor: disabled ? "wait" : "pointer",
      fontFamily: "inherit",
      display: "inline-flex", alignItems: "center", gap: 6,
      opacity: disabled ? 0.6 : 1,
    }}>{children}</button>
  );
}
function ErrorBox({ t, children }) {
  return (
    <div style={{
      padding: "8px 12px",
      background: t.dangerBg, border: `1px solid ${t.dangerBorder}`,
      borderRadius: 8, fontSize: 12, color: t.danger, fontWeight: 600,
    }}>{children}</div>
  );
}
function FieldText({ t, label, required, value, onChange, placeholder, monospace, hint }) {
  return (
    <Field t={t} label={label} required={required} hint={hint}>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={inputStyle(t, monospace)}/>
    </Field>
  );
}
function FieldDate({ t, label, required, value, onChange }) {
  return (
    <Field t={t} label={label} required={required}>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        style={inputStyle(t, true)}/>
    </Field>
  );
}
function FieldArea({ t, label, required, value, onChange, placeholder, rows = 2 }) {
  return (
    <Field t={t} label={label} required={required}>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={rows}
        style={{ ...inputStyle(t, false), resize: "vertical", minHeight: 60 }}/>
    </Field>
  );
}
function Field({ t, label, required, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{
        fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3,
      }}>{label}{required && <span style={{ color: t.accent }}> *</span>}</label>
      {children}
      {hint && <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>{hint}</div>}
    </div>
  );
}
function inputStyle(t, mono) {
  return {
    padding: "10px 12px",
    background: t.bgInset, border: `1px solid ${t.border}`,
    borderRadius: 8,
    fontSize: 13, color: t.text,
    fontFamily: mono ? "ui-monospace, monospace" : "inherit",
    outline: "none", boxSizing: "border-box",
    fontVariantNumeric: "tabular-nums",
    width: "100%",
  };
}
function ConfirmPanel({ t, title, body, confirmLabel, busy, onCancel, onConfirm }) {
  return (
    <>
      <div onClick={busy ? undefined : onCancel} style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.4)", zIndex: 210,
        cursor: busy ? "default" : "pointer",
      }}/>
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(420px, 92vw)",
        background: t.bgElevated, borderRadius: 14,
        border: `2px solid ${t.accent}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        zIndex: 211, padding: "22px 24px",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>{title}</div>
        <div style={{
          padding: "12px 14px",
          background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 10,
        }}>{body}</div>
        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.6 }}>
          돈 관련 작업입니다. 값 확인 후 진행해 주세요.
        </div>
        <DialogFooter>
          <BtnGhost t={t} onClick={onCancel} disabled={busy}>되돌리기</BtnGhost>
          <BtnPrimary t={t} onClick={onConfirm} disabled={busy}>{confirmLabel}</BtnPrimary>
        </DialogFooter>
      </div>
    </>
  );
}
function PreviewLines({ t, rows }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map(([label, value, mono], i) => (
        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, minWidth: 60 }}>{label}</span>
          <span className={mono ? "mono" : ""} style={{
            fontSize: 13, color: t.text, fontWeight: 700,
            fontFamily: mono ? "ui-monospace, monospace" : "inherit",
            fontVariantNumeric: mono ? "tabular-nums" : undefined,
            wordBreak: "break-all",
          }}>{value || "—"}</span>
        </div>
      ))}
    </div>
  );
}

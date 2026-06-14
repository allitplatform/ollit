// 2026-06-13 — PC 운영자 "가계부" 화면 (2-B 단계: 운영비 CRUD 만).
//
// 사장님 spec:
//   · 월 선택(이번달 default) + 운영비 표 + 추가/편집/삭제 (모두 확인 다이얼로그).
//   · 카테고리 한글 6개 (rent/ad/tax/meal/labor/etc — Mig 116).
//   · 음수 차단. 금액 comma 표시. 날짜 default 오늘 KST.
//   · 손익·이월·분배는 2-C 단계 (placeholder hint).
//
// 권한: RLS owner/admin/operator (A004 admin 통과). 직접 supabase.from CRUD.

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, Wallet, Plus, Edit3, Trash2, X, Save, Calendar,
} from "lucide-react";
import {
  listExpenses, addExpense, updateExpense, deleteExpense,
  listDistributions, setDistribution,
  getCarryover, setCarryover,
  getUsolNTrackBMargin,
  getCumulativeCarryover,
  EXPENSE_CATEGORIES, EXPENSE_CATEGORY_KO,
} from "../lib/bookkeepingDb.js";
import {
  listOtherIncome, addOtherIncome, updateOtherIncome, deleteOtherIncome,
  OTHER_INCOME_CATEGORIES, OTHER_INCOME_CATEGORY_KO,
} from "../lib/bookkeepingOtherIncomeDb.js";
// 2026-06-14 — 유솔N 수동 보정 (편집 UI 없이 표시·합산만).
//   보정 데이터는 스크립트로 직접 INSERT. 화면은 자동 + 보정 합쳐서 한 줄로만 표시.
//   ProfitCard 유솔N 줄 = bookkeeping_get_usoln_adjustment(workMonth).amount 합산.
//   incomeTotal · 순이익 도 동일하게 반영 → 손익 카드 = 누적 이월 일치.
import { getUsolnAdjustment } from "../lib/bookkeepingUsolnAdjustmentDb.js";
import {
  computeRevenueByYmRange,
  getMonthRange,
} from "../utils/revenueStats.js";

// 2026-06-13 — 대표 3명 (Phase 1 고정). user_id 는 Mig 114 진단 시 확정.
const REPRESENTATIVES = [
  { code: "E022", name: "조동욱", user_id: "77777777-7777-7777-7777-777777770022" },
  { code: "E002", name: "구현서", user_id: "77777777-7777-7777-7777-77777770002b" },
  { code: "A003", name: "조동석", user_id: "77777777-7777-7777-7777-aaaaaaaa0003" },
];

// KST YYYY-MM 헬퍼
const KO_DOW = ["일", "월", "화", "수", "목", "금", "토"];
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
function ymdToParts(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return { y, m, d, dow: isNaN(dt.getTime()) ? "" : KO_DOW[dt.getDay()] };
}

const fmtKRW = (n) => `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
function fmtAmountInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}
function parseAmount(s) {
  return Number(String(s || "").replace(/\D/g, "")) || 0;
}

// ──────────────────────────────────────────────
// 본체
// ──────────────────────────────────────────────
export default function AdminPcBookkeeping({ t, user, apiTasks = [] }) {
  const todayYmd = kstYmd();
  const [selectedYm, setSelectedYm] = useState(nowKstYm());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [dialog, setDialog] = useState(null);   // 운영비 다이얼로그 { mode, row? }
  const [oiDialog, setOiDialog] = useState(null); // 기타 수입 다이얼로그 { mode, row? }

  const actor = user?.user_id || user?.userId || user?.id;

  useEffect(() => {
    if (!actor) { setLoading(false); return; }
    let alive = true;
    setLoading(true); setErr("");
    (async () => {
      const res = await listExpenses(selectedYm, actor);
      if (!alive) return;
      if (!res?.ok) {
        setErr(res?.error || "조회 실패"); setLoading(false); return;
      }
      setRows(res.rows || []);
      setLoading(false);
    })().catch(e => { if (alive) { setErr(e?.message || "에러"); setLoading(false); } });
    return () => { alive = false; };
  }, [selectedYm, reloadTick, actor]);

  // 카테고리별 합 + 총합
  const totals = useMemo(() => {
    const byCat = {};
    let sum = 0;
    for (const r of rows) {
      const c = r.category;
      byCat[c] = (byCat[c] || 0) + (Number(r.amount) || 0);
      sum += Number(r.amount) || 0;
    }
    return { byCat, sum };
  }, [rows]);

  // 2026-06-13 — 수입(회사 마진) 분리:
  //   ① 일정산 (track A) = revenueStats month.owner (매출 리포트 동일)
  //   ② 유솔N 월정산 (track B) = bookkeeping_get_usoln_track_b_margin RPC (Mig 121 v5)
  //   ③ 수입 합계 = ① + ② (track A/B 배타라 중복 X)
  const monthRange = useMemo(() => {
    const [y, m] = selectedYm.split("-").map(Number);
    return getMonthRange(y, m);
  }, [selectedYm]);
  const revenueStat = useMemo(
    () => computeRevenueByYmRange(apiTasks, monthRange.start, monthRange.end, user),
    [apiTasks, monthRange.start, monthRange.end, user]
  );
  const incomeTrackA = Number(revenueStat?.owner) || 0;

  // 유솔N track B margin (자동, Mig 123 RPC)
  const [usolNB, setUsolNB] = useState(0);
  const [usolNBLoading, setUsolNBLoading] = useState(false);
  const [usolNBErr, setUsolNBErr] = useState("");
  useEffect(() => {
    if (!actor) { setUsolNB(0); return; }
    let alive = true;
    setUsolNBLoading(true); setUsolNBErr("");
    (async () => {
      const res = await getUsolNTrackBMargin(selectedYm, actor);
      if (!alive) return;
      if (!res?.ok) {
        setUsolNBErr(res?.error || "유솔N 월정산 조회 실패");
        setUsolNB(0);
      } else {
        setUsolNB(Number(res.amount) || 0);
      }
      setUsolNBLoading(false);
    })().catch(e => { if (alive) { setUsolNBErr(e?.message || "에러"); setUsolNBLoading(false); } });
    return () => { alive = false; };
  }, [selectedYm, actor]);

  // 유솔N 수동 보정 — 표시·합산용 fetch (편집 UI 는 없음, 데이터는 스크립트로 INSERT)
  const [usolNAdjustment, setUsolNAdjustment] = useState(0);
  useEffect(() => {
    if (!actor) { setUsolNAdjustment(0); return; }
    let alive = true;
    (async () => {
      const res = await getUsolnAdjustment(selectedYm, actor);
      if (!alive) return;
      if (res?.ok && res.row) {
        setUsolNAdjustment(Number(res.row.amount) || 0);
      } else {
        setUsolNAdjustment(0);
      }
    })().catch(() => { if (alive) setUsolNAdjustment(0); });
    return () => { alive = false; };
  }, [selectedYm, actor]);
  const usolNTotal = usolNB + usolNAdjustment;  // 자동 + 보정 (손익 카드 + 누적 이월 일치)

  // 기타 수입 (Mig 124/125) — 세스코·개인건 등 수동 입력 합계
  const [otherIncomeRows, setOtherIncomeRows] = useState([]);
  const [otherIncomeLoading, setOtherIncomeLoading] = useState(false);
  const [otherIncomeErr, setOtherIncomeErr] = useState("");
  const [oiReloadTick, setOiReloadTick] = useState(0);
  useEffect(() => {
    if (!actor) { setOtherIncomeRows([]); return; }
    let alive = true;
    setOtherIncomeLoading(true); setOtherIncomeErr("");
    (async () => {
      const res = await listOtherIncome(selectedYm, actor);
      if (!alive) return;
      if (!res?.ok) {
        setOtherIncomeErr(res?.error || "기타 수입 조회 실패");
        setOtherIncomeRows([]);
      } else {
        setOtherIncomeRows(res.rows || []);
      }
      setOtherIncomeLoading(false);
    })().catch(e => { if (alive) { setOtherIncomeErr(e?.message || "에러"); setOtherIncomeLoading(false); } });
    return () => { alive = false; };
  }, [selectedYm, actor, oiReloadTick]);
  const otherIncomeSum = useMemo(
    () => (otherIncomeRows || []).reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [otherIncomeRows]
  );

  const incomeTotal = incomeTrackA + usolNTotal + otherIncomeSum;
  const netProfit   = incomeTotal - (totals.sum || 0);

  const isThisMonth = selectedYm === nowKstYm();

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1400, margin: "0 auto" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Wallet size={22} style={{ color: t.accent }}/>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>가계부</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
            월별 운영비 입력 · 손익/이월/분배는 다음 단계
          </div>
        </div>
      </div>

      {/* 월 선택 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 14px", marginBottom: 14,
        background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10,
      }}>
        <button onClick={() => setSelectedYm(s => shiftYm(s, -1))}
          aria-label="이전 달"
          style={navBtnStyle(t)}>
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
        <button onClick={() => setSelectedYm(s => shiftYm(s, +1))}
          aria-label="다음 달"
          style={navBtnStyle(t)}>
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
        <button onClick={() => setSelectedYm(nowKstYm())}
          disabled={isThisMonth}
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
          지출 <span className="mono" style={{ fontWeight: 700, color: t.text }}>{rows.length}</span>건
          <span style={{ color: t.textDim, margin: "0 6px" }}>·</span>
          합계 <span className="mono" style={{ fontWeight: 800, color: t.danger }}>{fmtKRW(totals.sum)}</span>
        </div>
      </div>

      {/* 운영비 섹션 */}
      <div style={{
        background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
        overflow: "hidden", marginBottom: 14,
      }}>
        {/* 섹션 헤더 + + 지출 추가 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px",
          borderBottom: `1px solid ${t.border}`,
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>💸 운영비</div>
          <div style={{ flex: 1 }}/>
          <button onClick={() => setDialog({ mode: "add", row: null })} style={{
            padding: "8px 14px",
            background: t.accent, color: "#fff",
            border: "none", borderRadius: 8,
            fontSize: 12, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", gap: 5,
          }}>
            <Plus size={13} strokeWidth={2.8}/>
            지출 추가
          </button>
        </div>

        {/* 카테고리 요약 */}
        {rows.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 8,
            padding: "10px 18px",
            background: t.bgInset,
            borderBottom: `1px solid ${t.border}`,
          }}>
            {EXPENSE_CATEGORIES.map(c => (
              <div key={c} style={{
                padding: "8px 10px",
                background: t.bgElevated, border: `1px solid ${t.border}`,
                borderRadius: 7,
                display: "flex", flexDirection: "column", gap: 2,
              }}>
                <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3 }}>
                  {EXPENSE_CATEGORY_KO[c]}
                </span>
                <span className="mono" style={{
                  fontSize: 12, fontWeight: 800,
                  color: (totals.byCat[c] || 0) > 0 ? t.text : t.textDim,
                  fontVariantNumeric: "tabular-nums",
                }}>{fmtKRW(totals.byCat[c] || 0)}</span>
              </div>
            ))}
          </div>
        )}

        {/* 표 */}
        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
            불러오는 중...
          </div>
        ) : err ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: t.danger, fontSize: 13 }}>
            ⚠️ {err}
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <Wallet size={44} style={{ color: t.textMuted, opacity: 0.4, margin: "0 auto 14px" }}/>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 6 }}>
              이번 달 지출이 없습니다
            </div>
            <div style={{ fontSize: 11, color: t.textMuted }}>
              [+ 지출 추가] 로 시작
            </div>
          </div>
        ) : (
          <>
            {/* 2026-06-13 — 표 헤더. 좁은 PC(1024+)에서 액션 컬럼 잘림 정정.
                컬럼 합 = 95+90+110+0(1fr)+60 + gap(8*4=32) + padding(14*2=28) = 415px 최소. */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "95px 90px 110px minmax(0, 1fr) 60px",
              gap: 8, alignItems: "center",
              padding: "10px 14px",
              fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4,
              borderBottom: `1px solid ${t.border}`,
            }}>
              <span>날짜</span>
              <span>카테고리</span>
              <span style={{ textAlign: "right" }}>금액</span>
              <span>메모</span>
              <span style={{ textAlign: "right" }}>액션</span>
            </div>
            {rows.map(r => (
              <ExpenseRow key={r.id} t={t} row={r}
                onEdit={() => setDialog({ mode: "edit", row: r })}
                onDelete={() => setDialog({ mode: "delete", row: r })}
              />
            ))}
          </>
        )}
      </div>

      {/* 기타 수입 섹션 (Mig 124/125) — 세스코·개인건 등 수동 입력 */}
      <OtherIncomeSection t={t}
        rows={otherIncomeRows}
        sum={otherIncomeSum}
        loading={otherIncomeLoading}
        err={otherIncomeErr}
        onAdd={() => setOiDialog({ mode: "add", row: null })}
        onEdit={(r) => setOiDialog({ mode: "edit", row: r })}
        onDelete={(r) => setOiDialog({ mode: "delete", row: r })}
      />

      {/* 손익 카드 — 수입 (일정산 / 유솔N(자동+보정) / 기타 / 합계). 누적 이월과 일치. */}
      <ProfitCard t={t}
        incomeTrackA={incomeTrackA}
        usolNB={usolNTotal}
        usolNBAuto={usolNB}
        usolNAdjustment={usolNAdjustment}
        usolNBLoading={usolNBLoading}
        usolNBErr={usolNBErr}
        otherIncome={otherIncomeSum}
        otherIncomeLoading={otherIncomeLoading}
        otherIncomeErr={otherIncomeErr}
        incomeTotal={incomeTotal}
        expense={totals.sum}
        netProfit={netProfit}
      />

      {/* 나누기 — 분배 + 이월 (당월 + 누적) */}
      <DivisionCard t={t}
        workMonth={selectedYm}
        actor={actor}
        netProfit={netProfit}
        onSaved={() => setReloadTick(n => n + 1)}
        reloadKey={reloadTick + oiReloadTick}
      />

      {/* 다이얼로그 */}
      {dialog?.mode === "add" && (
        <EditDialog t={t} mode="add" actor={actor} workMonth={selectedYm}
          defaultDate={todayYmd}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); setReloadTick(n => n + 1); }}
        />
      )}
      {dialog?.mode === "edit" && (
        <EditDialog t={t} mode="edit" actor={actor} workMonth={selectedYm}
          row={dialog.row}
          defaultDate={dialog.row.expense_date}
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

      {/* 기타 수입 다이얼로그 */}
      {oiDialog?.mode === "add" && (
        <OtherIncomeEditDialog t={t} mode="add" actor={actor} workMonth={selectedYm}
          defaultDate={selectedYm === nowKstYm() ? todayYmd : `${selectedYm}-01`}
          onClose={() => setOiDialog(null)}
          onSaved={() => { setOiDialog(null); setOiReloadTick(n => n + 1); }}
        />
      )}
      {oiDialog?.mode === "edit" && (
        <OtherIncomeEditDialog t={t} mode="edit" actor={actor} workMonth={selectedYm}
          row={oiDialog.row}
          defaultDate={oiDialog.row.income_date}
          onClose={() => setOiDialog(null)}
          onSaved={() => { setOiDialog(null); setOiReloadTick(n => n + 1); }}
        />
      )}
      {oiDialog?.mode === "delete" && (
        <OtherIncomeDeleteDialog t={t} row={oiDialog.row} actor={actor}
          onClose={() => setOiDialog(null)}
          onDeleted={() => { setOiDialog(null); setOiReloadTick(n => n + 1); }}
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
// 행
// ──────────────────────────────────────────────
function ExpenseRow({ t, row, onEdit, onDelete }) {
  const dp = ymdToParts(row.expense_date);
  return (
    // 2026-06-13 — 그리드 컬럼 폭 헤더와 동일 (95+90+110+1fr+60). 좁은 PC 액션 잘림 정정.
    <div style={{
      display: "grid",
      gridTemplateColumns: "95px 90px 110px minmax(0, 1fr) 60px",
      gap: 8, alignItems: "center",
      padding: "10px 14px",
      borderTop: `1px solid ${t.border}`,
    }}>
      <span className="mono" style={{
        fontSize: 12, color: t.text, fontVariantNumeric: "tabular-nums",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {row.expense_date}{dp?.dow ? ` (${dp.dow})` : ""}
      </span>
      <span style={{
        fontSize: 12, fontWeight: 700, color: t.text,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {EXPENSE_CATEGORY_KO[row.category] || row.category}
      </span>
      <span className="mono" style={{
        fontSize: 13, fontWeight: 800, color: t.danger,
        textAlign: "right", fontVariantNumeric: "tabular-nums",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{fmtKRW(row.amount)}</span>
      <span style={{
        fontSize: 12, color: row.memo ? t.textSecondary : t.textDim,
        minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{row.memo || "—"}</span>
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
  // 2026-06-13 — 좁은 PC 액션 컬럼(60px)에 맞게 padding 축소. 아이콘 12px + padding = 약 26px width.
  return {
    padding: "5px 6px",
    background: "transparent", border: `1px solid ${t.border}`,
    color: t.textSecondary, borderRadius: 6,
    cursor: "pointer", display: "inline-flex",
    fontFamily: "inherit",
  };
}

// ──────────────────────────────────────────────
// 추가/편집 다이얼로그 — 확인 다이얼로그 단계 포함
// ──────────────────────────────────────────────
function EditDialog({ t, mode, actor, workMonth, row, defaultDate, onClose, onSaved }) {
  const [category, setCategory]   = useState(row?.category || "rent");
  const [amountStr, setAmountStr] = useState(row?.amount != null ? Number(row.amount).toLocaleString("ko-KR") : "");
  const [date, setDate]           = useState(row?.expense_date || defaultDate);
  const [memo, setMemo]           = useState(row?.memo || "");
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const amount = parseAmount(amountStr);
  const hasAll = category && amount >= 0 && !!date;

  function handleSubmit() {
    if (!hasAll) {
      setActionErr("카테고리·금액·날짜 모두 입력해주세요.");
      return;
    }
    setActionErr("");
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!actor) { setActionErr("관리자 사용자 ID 없음"); setConfirmOpen(false); return; }
    setBusy(true);
    try {
      let res;
      if (mode === "add") {
        res = await addExpense({
          workMonth, category, amount, expenseDate: date, memo, actor,
        });
      } else {
        res = await updateExpense({
          id: row.id, category, amount, expenseDate: date, memo, actor,
        });
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
          title={mode === "add" ? "지출 추가" : "지출 편집"}
          subtitle={`작업월 ${workMonth.slice(0,4)}년 ${Number(workMonth.slice(5,7))}월`}
          onClose={onClose}
        />

        <FieldSelect t={t} label="카테고리" required value={category} onChange={setCategory}
          options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: EXPENSE_CATEGORY_KO[c] }))}
        />
        <FieldText t={t} label="금액 (₩)" required value={amountStr}
          onChange={(v) => setAmountStr(fmtAmountInput(v))}
          placeholder="예: 500,000"
          monospace
          hint="음수 불가. 0 이상 정수."
        />
        <FieldDate t={t} label="날짜" required value={date} onChange={setDate}/>
        <FieldArea t={t} label="메모" value={memo} onChange={setMemo}
          placeholder="(선택) 예: 사무실 6월 임대료"
          rows={2}
        />

        {actionErr && (
          <ErrorBox t={t}>⚠️ {actionErr}</ErrorBox>
        )}

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
          title={mode === "add" ? "지출 추가 확인" : "수정 확인"}
          body={
            <PreviewLines t={t} rows={[
              ["카테고리", EXPENSE_CATEGORY_KO[category] || category],
              ["금액", fmtKRW(amount), "mono"],
              ["날짜", date, "mono"],
              ["메모", memo || "(없음)"],
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

// ──────────────────────────────────────────────
// 삭제 확인 다이얼로그
// ──────────────────────────────────────────────
function DeleteDialog({ t, row, actor, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");

  async function handleDelete() {
    if (!actor) { setActionErr("관리자 사용자 ID 없음"); return; }
    setBusy(true);
    try {
      const res = await deleteExpense(row.id, actor);
      if (!res?.ok) {
        setActionErr(res?.error || "삭제 실패");
      } else {
        onDeleted?.();
      }
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
          🗑 지출 삭제
        </div>
        <div style={{ fontSize: 12, color: t.text, marginBottom: 14, lineHeight: 1.6 }}>
          이 지출을 정말 삭제하시겠습니까?
        </div>
        <div style={{
          padding: "12px 14px",
          background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 10,
          marginBottom: 14,
        }}>
          <PreviewLines t={t} rows={[
            ["카테고리", EXPENSE_CATEGORY_KO[row.category] || row.category],
            ["금액", fmtKRW(row.amount), "mono"],
            ["날짜", row.expense_date, "mono"],
            ["메모", row.memo || "(없음)"],
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
// 다이얼로그 헬퍼 (공용)
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

// ──────────────────────────────────────────────
// 필드
// ──────────────────────────────────────────────
function FieldText({ t, label, required, value, onChange, placeholder, monospace, hint }) {
  return (
    <Field t={t} label={label} required={required} hint={hint}>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle(t, monospace)}
      />
    </Field>
  );
}
function FieldSelect({ t, label, required, value, onChange, options }) {
  return (
    <Field t={t} label={label} required={required}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle(t, false), appearance: "auto" }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}
function FieldDate({ t, label, required, value, onChange }) {
  return (
    <Field t={t} label={label} required={required}>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        style={inputStyle(t, true)}
      />
    </Field>
  );
}
function FieldArea({ t, label, required, value, onChange, placeholder, rows = 2 }) {
  return (
    <Field t={t} label={label} required={required}>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={rows}
        style={{ ...inputStyle(t, false), resize: "vertical", minHeight: 60 }}
      />
    </Field>
  );
}
function Field({ t, label, required, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{
        fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3,
      }}>
        {label}{required && <span style={{ color: t.accent }}> *</span>}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>{hint}</div>
      )}
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

// ──────────────────────────────────────────────
// 확인 패널 + 미리보기
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
// 손익 카드 — 수입 4줄 분리 (일정산 + 유솔N 월정산 + 기타 + 합계) − 운영비 = 순이익
//   · 일정산 (track A) — 매출 리포트 owner 와 동일 dataset.
//   · 유솔N 월정산 (track B) — Mig 123 RPC (전월 작업분, track A 와 배타).
//   · 기타 — Mig 124/125 (세스코 수수료·개인건 등 수동 입력).
//   · 수입 합계 = 세 항 합. 순이익 = 합계 − 운영비.
//   · 색: 일정산 파랑(#3B82F6) / 유솔N 보라(#8B5CF6) / 기타 청록(#14B8A6).
// ──────────────────────────────────────────────
function ProfitCard({ t, incomeTrackA, usolNB, usolNBAuto, usolNAdjustment,
                       usolNBLoading, usolNBErr,
                       otherIncome, otherIncomeLoading, otherIncomeErr,
                       incomeTotal, expense, netProfit }) {
  const fmt = n => fmtKRW(n).replace("₩", "₩");
  const hasAdj = (Number(usolNAdjustment) || 0) !== 0;
  const usolnHint = usolNBLoading
    ? "불러오는 중..."
    : usolNBErr
      ? `⚠️ ${usolNBErr}`
      : hasAdj
        ? `자동 ${fmt(usolNBAuto)} + 수동 보정 ${fmt(usolNAdjustment)} = ${fmt(usolNB)} (전월 작업분 + 보정).`
        : "유솔N 세척·추가선택 회사 마진 — 전월 작업분(작업 다음 달 정산 반영).";
  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
      padding: "18px 22px",
      marginTop: 14,
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 14 }}>
        📊 손익
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <ProfitRow t={t} label="수입 — 일정산 (track A)" value={incomeTrackA} color="#3B82F6"
          hint="매출 리포트 '이번달' 회사 마진과 동일 (revenueStats)."/>
        <ProfitRow t={t}
          label="수입 — 유솔N 월정산 (전월 작업분)"
          value={usolNB}
          color="#8B5CF6"
          hint={usolnHint}
        />
        <ProfitRow t={t}
          label="수입 — 기타 (세스코·개인건 등)"
          value={otherIncome}
          color="#14B8A6"
          hint={otherIncomeLoading
            ? "불러오는 중..."
            : otherIncomeErr
              ? `⚠️ ${otherIncomeErr}`
              : "세스코 수수료·개인건 등 수동 입력 (통장 cashflow 와 별개, 손익용)."}
        />
        <div style={{ height: 1, background: t.border, margin: "2px 0" }}/>
        <ProfitRow t={t} label="수입 합계" value={incomeTotal} color={t.text} mid/>
        <ProfitRow t={t} label="운영비" value={expense} color={t.danger} negative/>
        <div style={{ height: 1, background: t.border, margin: "4px 0" }}/>
        <ProfitRow t={t} label="순이익" value={netProfit} color={t.accent} big highlight/>
      </div>
    </div>
  );
}

function ProfitRow({ t, label, value, color, hint, negative, big, mid, highlight }) {
  const display = negative && value > 0
    ? `−${fmtKRW(value).replace("₩", "₩")}`
    : fmtKRW(value);
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 12,
      padding: highlight ? "8px 12px" : "4px 0",
      background: highlight ? color + "11" : undefined,
      borderRadius: highlight ? 8 : 0,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{
          fontSize: big ? 13 : mid ? 12.5 : 12,
          fontWeight: big ? 800 : mid ? 800 : 700,
          color: (big || mid) ? t.text : t.textSecondary,
        }}>{label}</span>
        {hint && (
          <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>{hint}</span>
        )}
      </div>
      <div style={{ flex: 1 }}/>
      <span className="mono" style={{
        fontSize: big ? 22 : mid ? 18 : 16,
        fontWeight: 800, color,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}>{display}</span>
    </div>
  );
}

// ──────────────────────────────────────────────
// 나누기 카드 — 분배 3명 입력 + 이월 자동 계산
//   · DB 저장값 있으면 prefill. setDistribution 3 + setCarryover 1 순차 호출.
//   · 자동 이월 = 순이익 − 분배 합. 음수면 저장 막음.
//   · DB carryover 값과 자동 계산값 불일치 시 ⚠️ 표시 (자동 덮어쓰기 X).
// ──────────────────────────────────────────────
function DivisionCard({ t, workMonth, actor, netProfit, onSaved, reloadKey }) {
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState("");

  // 분배 입력 state (대표별)
  const [amounts, setAmounts]   = useState(() => REPRESENTATIVES.map(() => ""));
  const [memos, setMemos]       = useState(() => REPRESENTATIVES.map(() => ""));

  // DB carryover (저장된 값) + memo
  const [savedCarry, setSavedCarry] = useState(null); // { amount, memo } | null
  const [carryMemo, setCarryMemo]   = useState("");

  // 누적 이월 (Mig 126)
  const [cumCarry, setCumCarry] = useState({ cumulative_carryover: 0, monthly: [], start_month: "2026-04" });
  const [cumLoading, setCumLoading] = useState(false);
  const [cumErr, setCumErr] = useState("");
  const [monthlyOpen, setMonthlyOpen] = useState(false);

  // 저장 진행 + 다이얼로그
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // fetch distributions + carryover + 누적
  useEffect(() => {
    if (!actor) { setLoading(false); return; }
    let alive = true;
    setLoading(true); setErr("");
    setCumLoading(true); setCumErr("");
    (async () => {
      const [resD, resC, resCum] = await Promise.all([
        listDistributions(workMonth, actor),
        getCarryover(workMonth, actor),
        getCumulativeCarryover(workMonth, actor),
      ]);
      if (!alive) return;
      if (!resD?.ok) { setErr(resD?.error || "분배 조회 실패"); setLoading(false); setCumLoading(false); return; }
      if (!resC?.ok) { setErr(resC?.error || "이월 조회 실패"); setLoading(false); setCumLoading(false); return; }
      if (!resCum?.ok) {
        setCumErr(resCum?.error || "누적 이월 조회 실패");
      } else {
        setCumCarry({
          cumulative_carryover: Number(resCum.cumulative_carryover) || 0,
          monthly:              Array.isArray(resCum.monthly) ? resCum.monthly : [],
          start_month:          resCum.start_month || "2026-04",
        });
      }
      setCumLoading(false);

      // prefill 분배: 대표별 user_id 매칭
      const newAmts = REPRESENTATIVES.map(rep => {
        const row = (resD.rows || []).find(d => d.representative_user_id === rep.user_id);
        return row ? String(Number(row.amount).toLocaleString("ko-KR")) : "";
      });
      const newMemos = REPRESENTATIVES.map(rep => {
        const row = (resD.rows || []).find(d => d.representative_user_id === rep.user_id);
        return row?.memo || "";
      });
      setAmounts(newAmts);
      setMemos(newMemos);

      // carryover
      const c = resC.row;
      if (c) {
        setSavedCarry({ amount: Number(c.amount) || 0, memo: c.memo || "" });
        setCarryMemo(c.memo || "");
      } else {
        setSavedCarry(null);
        setCarryMemo("");
      }

      setLoading(false);
    })().catch(e => { if (alive) { setErr(e?.message || "에러"); setLoading(false); } });
    return () => { alive = false; };
  }, [workMonth, actor, reloadKey]);

  // 계산
  const distAmts    = amounts.map(parseAmount);
  const distSum     = distAmts.reduce((s, n) => s + n, 0);
  const autoCarry   = netProfit - distSum;
  const overrun     = autoCarry < 0;            // 분배 합 > 순이익 → 음수 이월
  const sumMatch    = (distSum + Math.max(autoCarry, 0)) === netProfit && !overrun;
  // 2026-06-14 — 옛 bookkeeping_carryover 저장값과 자동 계산 불일치 경고 제거.
  //   누적 RPC(Mig 129)를 단일 진실로 사용. 옛 carryover 행은 저장은 유지하되 비교 안 함.

  function handleAmountChange(i, raw) {
    const next = [...amounts];
    next[i] = fmtAmountInput(raw);
    setAmounts(next);
  }
  function handleMemoChange(i, v) {
    const next = [...memos];
    next[i] = v;
    setMemos(next);
  }

  function handleSubmit() {
    if (!actor) { setActionErr("관리자 사용자 ID 없음"); return; }
    if (overrun) { setActionErr("분배 합이 순이익을 초과합니다. 마이너스 이월은 저장 불가."); return; }
    setActionErr("");
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    setBusy(true);
    try {
      // 1) 분배 3명 순차 저장
      for (let i = 0; i < REPRESENTATIVES.length; i++) {
        const rep = REPRESENTATIVES[i];
        const res = await setDistribution({
          workMonth,
          repUserId: rep.user_id,
          amount:    distAmts[i],
          memo:      memos[i],
          actor,
        });
        if (!res?.ok) {
          setActionErr(`${rep.name} 분배 저장 실패: ${res?.error || "—"}`);
          setConfirmOpen(false); setBusy(false); return;
        }
      }
      // 2) 이월 저장 (자동 계산값)
      const resC = await setCarryover({
        workMonth,
        amount: autoCarry,
        memo:   carryMemo,
        actor,
      });
      if (!resC?.ok) {
        setActionErr(`이월 저장 실패: ${resC?.error || "—"}`);
        setConfirmOpen(false); setBusy(false); return;
      }
      // 성공
      setConfirmOpen(false);
      onSaved?.();
    } catch (e) {
      setActionErr(e?.message || "예외 발생");
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
      padding: "18px 22px",
      marginTop: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>🔀 나누기 — 분배 + 이월</div>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 11, color: t.textMuted }}>
          순이익 <span className="mono" style={{ fontWeight: 800, color: t.accent }}>{fmtKRW(netProfit)}</span>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "30px 10px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
          불러오는 중...
        </div>
      ) : err ? (
        <div style={{ padding: "30px 10px", textAlign: "center", color: t.danger, fontSize: 12 }}>
          ⚠️ {err}
        </div>
      ) : (
        <>
          {/* 대표 3명 입력 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {REPRESENTATIVES.map((rep, i) => (
              <RepRow key={rep.code} t={t}
                rep={rep}
                amountStr={amounts[i]}
                memo={memos[i]}
                onAmount={(v) => handleAmountChange(i, v)}
                onMemo={(v) => handleMemoChange(i, v)}
              />
            ))}
          </div>

          {/* 분배 소계 */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10,
            padding: "10px 12px", marginTop: 10,
            background: t.bgInset, borderRadius: 8,
          }}>
            <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>분배 소계</span>
            <span className="mono" style={{
              fontSize: 15, fontWeight: 800, color: t.text,
              fontVariantNumeric: "tabular-nums",
            }}>{fmtKRW(distSum)}</span>
          </div>

          {/* 당월 차이 (= 자동 이월: 순이익 − 분배 소계) */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 14px", marginTop: 10,
            background: overrun ? t.dangerBg : t.bgInset,
            border: `1.5px solid ${overrun ? t.dangerBorder : t.border}`,
            borderRadius: 9,
          }}>
            <span style={{
              fontSize: 12, fontWeight: 800,
              color: overrun ? t.danger : t.text,
            }}>당월 차이</span>
            <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>
              = 순이익 − 분배 소계 (이번 달만)
            </span>
            <div style={{ flex: 1 }}/>
            <span className="mono" style={{
              fontSize: 17, fontWeight: 800,
              color: overrun ? t.danger : t.success,
              fontVariantNumeric: "tabular-nums",
            }}>{fmtKRW(autoCarry)}</span>
          </div>

          {/* 누적 이월 (Mig 126) — 시작월부터 그 달까지 누적 */}
          <CumulativeCarryoverBox t={t}
            workMonth={workMonth}
            cumCarry={cumCarry}
            loading={cumLoading}
            err={cumErr}
            monthlyOpen={monthlyOpen}
            onToggle={() => setMonthlyOpen(o => !o)}
          />

          {/* (옛 carryover 불일치 경고 제거 — 누적 RPC Mig 129 단일 진실 사용.) */}

          {/* 이월 메모 */}
          <div style={{ marginTop: 10 }}>
            <input type="text" value={carryMemo}
              onChange={(e) => setCarryMemo(e.target.value)}
              placeholder="이월 메모 (선택)"
              style={{
                ...inputStyle(t, false),
                fontSize: 12,
              }}
            />
          </div>

          {/* 합계 표시 */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 14px", marginTop: 12,
            background: sumMatch ? t.successBg : (overrun ? t.dangerBg : t.bgInset),
            border: `1px solid ${sumMatch ? t.successBorder : (overrun ? t.dangerBorder : t.border)}`,
            borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            color: sumMatch ? t.success : (overrun ? t.danger : t.textMuted),
          }}>
            {sumMatch ? "✓" : "⚠️"} 분배 + 이월 = 순이익
            <span className="mono" style={{
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}>
              {fmtKRW(distSum)} + {fmtKRW(Math.max(autoCarry, 0))} = {fmtKRW(distSum + Math.max(autoCarry, 0))}
              {!sumMatch && ` (순이익 ${fmtKRW(netProfit)})`}
            </span>
          </div>

          {/* 오류 */}
          {actionErr && (
            <div style={{
              padding: "8px 12px", marginTop: 10,
              background: t.dangerBg, border: `1px solid ${t.dangerBorder}`,
              borderRadius: 8, fontSize: 12, color: t.danger, fontWeight: 600,
            }}>⚠️ {actionErr}</div>
          )}

          {/* 저장 버튼 */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={handleSubmit}
              disabled={busy || overrun}
              style={{
                padding: "10px 22px",
                background: (busy || overrun) ? t.bgInset : t.accent,
                color: (busy || overrun) ? t.textMuted : "#fff",
                border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 800,
                cursor: (busy || overrun) ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", gap: 6,
                opacity: (busy || overrun) ? 0.6 : 1,
              }}>
              💾 분배 + 이월 저장
            </button>
          </div>
        </>
      )}

      {confirmOpen && (
        <ConfirmPanel t={t}
          title="분배 + 이월 저장 확인"
          body={
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {REPRESENTATIVES.map((rep, i) => (
                <div key={rep.code} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, minWidth: 76 }}>
                    {rep.name} ({rep.code})
                  </span>
                  <span className="mono" style={{
                    fontSize: 13, fontWeight: 800, color: t.text,
                    fontVariantNumeric: "tabular-nums",
                  }}>{fmtKRW(distAmts[i])}</span>
                </div>
              ))}
              <div style={{ height: 1, background: t.border, margin: "2px 0" }}/>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, minWidth: 76 }}>자동 이월</span>
                <span className="mono" style={{
                  fontSize: 14, fontWeight: 800, color: t.success,
                  fontVariantNumeric: "tabular-nums",
                }}>{fmtKRW(autoCarry)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, minWidth: 76 }}>합계</span>
                <span className="mono" style={{
                  fontSize: 14, fontWeight: 800, color: t.accent,
                  fontVariantNumeric: "tabular-nums",
                }}>{fmtKRW(distSum + autoCarry)} (순이익)</span>
              </div>
            </div>
          }
          confirmLabel={busy ? "저장 중..." : "정말 저장"}
          busy={busy}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 누적 이월 카드 (Mig 126)
//   · 큰 글자, 음수면 빨강 + 부드러운 안내.
//   · 월별 표 접기/펼치기 toggle.
// ──────────────────────────────────────────────
function CumulativeCarryoverBox({ t, workMonth, cumCarry, loading, err, monthlyOpen, onToggle }) {
  const cum = Number(cumCarry?.cumulative_carryover) || 0;
  const isNeg = cum < 0;
  const monthly = cumCarry?.monthly || [];
  const startMonth = cumCarry?.start_month || "2026-04";

  return (
    <div style={{
      marginTop: 10,
      background: isNeg ? t.dangerBg : t.successBg,
      border: `2px solid ${isNeg ? t.dangerBorder : t.successBorder}`,
      borderRadius: 10,
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 16px",
      }}>
        <span style={{
          fontSize: 13, fontWeight: 800,
          color: isNeg ? t.danger : t.success,
        }}>📦 누적 이월</span>
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>
          {startMonth} ~ {workMonth} 누적
        </span>
        <div style={{ flex: 1 }}/>
        {loading ? (
          <span style={{ fontSize: 12, color: t.textMuted }}>불러오는 중...</span>
        ) : err ? (
          <span style={{ fontSize: 12, color: t.danger }}>⚠️ {err}</span>
        ) : (
          <span className="mono" style={{
            fontSize: 22, fontWeight: 900,
            color: isNeg ? t.danger : t.success,
            fontVariantNumeric: "tabular-nums",
          }}>
            {isNeg ? "−" : ""}{fmtKRW(Math.abs(cum)).replace("₩", "₩")}
          </span>
        )}
      </div>

      {!loading && !err && isNeg && (
        <div style={{
          padding: "0 16px 12px",
          fontSize: 11, color: t.textSecondary, lineHeight: 1.5,
        }}>
          💡 아직 못 채운 금액입니다. 다음 달 수입이 쌓이면 점점 메워집니다.
        </div>
      )}

      {/* 월별 표 토글 */}
      {!loading && !err && monthly.length > 0 && (
        <>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 16px",
            background: t.bgInset,
            borderTop: `1px solid ${isNeg ? t.dangerBorder : t.successBorder}`,
            cursor: "pointer",
          }} onClick={onToggle}>
            <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>
              {monthlyOpen ? "▾ 월별 표 닫기" : "▸ 월별 표 펼치기"}
            </span>
            <span style={{ fontSize: 10, color: t.textDim }}>
              ({monthly.length}개월)
            </span>
          </div>

          {monthlyOpen && (
            <div style={{ padding: "0 16px 14px" }}>
              {/* 2026-06-14 — 4컬럼 축소: 월 / 분배 / 당월 차이 / 누적.
                  세부(일정산/유솔N/기타/운영비)는 손익 카드에서 확인. */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "80px repeat(3, minmax(0, 1fr))",
                gap: 8, alignItems: "center",
                padding: "8px 12px",
                background: t.bgElevated, border: `1px solid ${t.border}`,
                borderRadius: 8,
                fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3,
              }}>
                <span>월</span>
                <span style={{ textAlign: "right" }}>분배</span>
                <span style={{ textAlign: "right" }}>당월 차이</span>
                <span style={{ textAlign: "right" }}>누적</span>
              </div>
              {monthly.map(m => {
                const dist  = Number(m.distribution) || 0;
                const diff  = Number(m.monthly_diff) || 0;
                const cumRow = Number(m.cumulative) || 0;
                return (
                  <div key={m.wm} style={{
                    display: "grid",
                    gridTemplateColumns: "80px repeat(3, minmax(0, 1fr))",
                    gap: 8, alignItems: "center",
                    padding: "10px 12px",
                    borderTop: `1px solid ${t.border}`,
                    fontSize: 12,
                    fontFamily: "ui-monospace, monospace",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    <span style={{ color: t.text, fontWeight: 700, fontFamily: "inherit" }}>
                      {m.wm.slice(5)}월
                    </span>
                    <span style={{ textAlign: "right", color: dist > 0 ? t.warning : t.textDim }}>
                      {dist > 0 ? "−" : ""}{fmtKRW(dist)}
                    </span>
                    <span style={{
                      textAlign: "right", fontWeight: 800,
                      color: diff < 0 ? t.danger : (diff > 0 ? t.success : t.textDim),
                    }}>
                      {diff < 0 ? "−" : ""}{fmtKRW(Math.abs(diff))}
                    </span>
                    <span style={{
                      textAlign: "right", fontWeight: 800,
                      color: cumRow < 0 ? t.danger : (cumRow > 0 ? t.success : t.textDim),
                    }}>
                      {cumRow < 0 ? "−" : ""}{fmtKRW(Math.abs(cumRow))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RepRow({ t, rep, amountStr, memo, onAmount, onMemo }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "100px minmax(110px, 1fr) minmax(120px, 1.4fr)",
      gap: 8, alignItems: "center",
    }}>
      <span style={{
        fontSize: 12, fontWeight: 700, color: t.text,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {rep.name}
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginLeft: 4 }}>{rep.code}</span>
      </span>
      <input type="text" value={amountStr}
        onChange={e => onAmount(e.target.value)}
        placeholder="₩0"
        style={{
          ...inputStyle(t, true),
          fontSize: 13, textAlign: "right",
          padding: "8px 10px",
        }}
      />
      <input type="text" value={memo}
        onChange={e => onMemo(e.target.value)}
        placeholder="메모 (선택)"
        style={{
          ...inputStyle(t, false),
          fontSize: 12,
          padding: "8px 10px",
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// 기타 수입 섹션 — 운영비 섹션 패턴 동일 (수수료 / 개인건 / 기타)
//   · 카테고리 색: 청록 #14B8A6 (ProfitCard 와 일치)
//   · 행: 날짜 / 카테고리 / 금액 / 메모 / 액션
// ──────────────────────────────────────────────
function OtherIncomeSection({ t, rows, sum, loading, err, onAdd, onEdit, onDelete }) {
  // 카테고리별 합
  const byCat = {};
  for (const r of rows) {
    byCat[r.category] = (byCat[r.category] || 0) + (Number(r.amount) || 0);
  }
  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
      overflow: "hidden", marginBottom: 14,
    }}>
      {/* 2026-06-14 — 0건이면 헤더 한 줄만 (borderBottom 제거). 부제는 0건일 때 "비어있음" 으로 축약. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 18px",
        borderBottom: rows.length > 0 ? `1px solid ${t.border}` : "none",
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>💰 기타 수입</div>
        <div style={{ fontSize: 11, color: t.textMuted }}>
          {rows.length === 0 ? "이번 달 비어있음 (세스코·개인건 등)" : "세스코·개인건 등 수동 입력 (통장과 별개, 손익용)"}
        </div>
        <div style={{ flex: 1 }}/>
        {rows.length > 0 && (
          <div style={{ fontSize: 12, color: t.textSecondary, marginRight: 4 }}>
            {rows.length}건
            <span style={{ color: t.textDim, margin: "0 6px" }}>·</span>
            합계 <span className="mono" style={{ fontWeight: 800, color: "#14B8A6" }}>{fmtKRW(sum)}</span>
          </div>
        )}
        <button onClick={onAdd} style={{
          padding: "8px 14px",
          background: "#14B8A6", color: "#fff",
          border: "none", borderRadius: 8,
          fontSize: 12, fontWeight: 800,
          cursor: "pointer", fontFamily: "inherit",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          <Plus size={13} strokeWidth={2.8}/>
          수입 추가
        </button>
      </div>

      {rows.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          padding: "10px 18px",
          background: t.bgInset,
          borderBottom: `1px solid ${t.border}`,
        }}>
          {OTHER_INCOME_CATEGORIES.map(c => (
            <div key={c} style={{
              padding: "8px 10px",
              background: t.bgElevated, border: `1px solid ${t.border}`,
              borderRadius: 7,
              display: "flex", flexDirection: "column", gap: 2,
            }}>
              <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3 }}>
                {OTHER_INCOME_CATEGORY_KO[c]}
              </span>
              <span className="mono" style={{
                fontSize: 12, fontWeight: 800,
                color: (byCat[c] || 0) > 0 ? t.text : t.textDim,
                fontVariantNumeric: "tabular-nums",
              }}>{fmtKRW(byCat[c] || 0)}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "40px 20px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
          불러오는 중...
        </div>
      ) : err ? (
        <div style={{ padding: "40px 20px", textAlign: "center", color: t.danger, fontSize: 13 }}>
          ⚠️ {err}
        </div>
      ) : rows.length === 0 ? (
        // 0건 — 헤더 한 줄만 (별도 빈 상태 div 생략).
        null
      ) : (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "95px 90px 110px minmax(0, 1fr) 60px",
            gap: 8, alignItems: "center",
            padding: "10px 14px",
            fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4,
            borderBottom: `1px solid ${t.border}`,
          }}>
            <span>날짜</span>
            <span>카테고리</span>
            <span style={{ textAlign: "right" }}>금액</span>
            <span>메모</span>
            <span style={{ textAlign: "right" }}>액션</span>
          </div>
          {rows.map(r => (
            <OtherIncomeRow key={r.id} t={t} row={r}
              onEdit={() => onEdit(r)}
              onDelete={() => onDelete(r)}
            />
          ))}
        </>
      )}
    </div>
  );
}

function OtherIncomeRow({ t, row, onEdit, onDelete }) {
  const dp = ymdToParts(row.income_date);
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "95px 90px 110px minmax(0, 1fr) 60px",
      gap: 8, alignItems: "center",
      padding: "10px 14px",
      borderTop: `1px solid ${t.border}`,
    }}>
      <span className="mono" style={{
        fontSize: 12, color: t.text, fontVariantNumeric: "tabular-nums",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {row.income_date}{dp?.dow ? ` (${dp.dow})` : ""}
      </span>
      <span style={{
        fontSize: 12, fontWeight: 700, color: t.text,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {OTHER_INCOME_CATEGORY_KO[row.category] || row.category}
      </span>
      <span className="mono" style={{
        fontSize: 13, fontWeight: 800, color: "#14B8A6",
        textAlign: "right", fontVariantNumeric: "tabular-nums",
      }}>
        {fmtKRW(row.amount)}
      </span>
      <span style={{
        fontSize: 12, color: t.textSecondary,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {row.memo || "—"}
      </span>
      <span style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
        <button onClick={onEdit} title="편집" style={iconBtnStyle(t)}>
          <Edit3 size={13}/>
        </button>
        <button onClick={onDelete} title="삭제" style={{ ...iconBtnStyle(t), color: t.danger }}>
          <Trash2 size={13}/>
        </button>
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────
// 기타 수입 추가/편집 다이얼로그
// ──────────────────────────────────────────────
function OtherIncomeEditDialog({ t, mode, actor, workMonth, row, defaultDate, onClose, onSaved }) {
  const [category, setCategory]   = useState(row?.category || "commission");
  const [amountStr, setAmountStr] = useState(row?.amount != null ? Number(row.amount).toLocaleString("ko-KR") : "");
  const [date, setDate]           = useState(row?.income_date || defaultDate);
  const [memo, setMemo]           = useState(row?.memo || "");
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const amount = parseAmount(amountStr);
  const hasAll = category && amount >= 0 && !!date;
  const dateMonthOk = date && date.slice(0, 7) === workMonth;

  function handleSubmit() {
    if (!hasAll) { setActionErr("카테고리·금액·날짜 모두 입력해주세요."); return; }
    if (!dateMonthOk) { setActionErr(`날짜의 월이 작업월(${workMonth})과 일치해야 합니다.`); return; }
    setActionErr("");
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!actor) { setActionErr("관리자 사용자 ID 없음"); setConfirmOpen(false); return; }
    setBusy(true);
    try {
      let res;
      if (mode === "add") {
        res = await addOtherIncome({
          workMonth, category, amount, incomeDate: date, memo, actor,
        });
      } else {
        res = await updateOtherIncome({
          id: row.id, category, amount, incomeDate: date, memo, actor,
        });
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
          title={mode === "add" ? "기타 수입 추가" : "기타 수입 편집"}
          subtitle={`작업월 ${workMonth.slice(0,4)}년 ${Number(workMonth.slice(5,7))}월 · 날짜는 같은 달 안에서`}
          onClose={onClose}
        />

        <FieldSelect t={t} label="카테고리" required value={category} onChange={setCategory}
          options={OTHER_INCOME_CATEGORIES.map(c => ({ value: c, label: OTHER_INCOME_CATEGORY_KO[c] }))}
        />
        <FieldText t={t} label="금액 (₩)" required value={amountStr}
          onChange={(v) => setAmountStr(fmtAmountInput(v))}
          placeholder="예: 1,500,000"
          monospace
          hint="음수 불가. 0 이상 정수."
        />
        <FieldDate t={t} label="날짜" required value={date} onChange={setDate}/>
        {date && !dateMonthOk && (
          <div style={{ fontSize: 11, color: t.danger, marginTop: -4 }}>
            ⚠️ 날짜 월이 {workMonth} 와 다릅니다. 같은 달 안에서 선택해주세요.
          </div>
        )}
        <FieldArea t={t} label="메모" value={memo} onChange={setMemo}
          placeholder="(선택) 예: 세스코 5월 수수료"
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
          title={mode === "add" ? "기타 수입 추가 확인" : "수정 확인"}
          body={
            <PreviewLines t={t} rows={[
              ["카테고리", OTHER_INCOME_CATEGORY_KO[category] || category],
              ["금액", fmtKRW(amount), "mono"],
              ["날짜", date, "mono"],
              ["메모", memo || "(없음)"],
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

// ──────────────────────────────────────────────
// 기타 수입 삭제 확인
// ──────────────────────────────────────────────
function OtherIncomeDeleteDialog({ t, row, actor, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");

  async function handleDelete() {
    if (!actor) { setActionErr("관리자 사용자 ID 없음"); return; }
    setBusy(true);
    try {
      const res = await deleteOtherIncome(row.id, actor);
      if (!res?.ok) {
        setActionErr(res?.error || "삭제 실패");
      } else {
        onDeleted?.();
      }
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
          🗑 기타 수입 삭제
        </div>
        <div style={{ fontSize: 12, color: t.text, marginBottom: 14, lineHeight: 1.6 }}>
          이 수입 항목을 정말 삭제하시겠습니까?
        </div>
        <div style={{
          padding: "12px 14px",
          background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 10,
          marginBottom: 14,
        }}>
          <PreviewLines t={t} rows={[
            ["카테고리", OTHER_INCOME_CATEGORY_KO[row.category] || row.category],
            ["금액", fmtKRW(row.amount), "mono"],
            ["날짜", row.income_date, "mono"],
            ["메모", row.memo || "(없음)"],
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

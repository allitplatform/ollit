// 2026-06-13 — PC 운영자 "가계부" 화면 (2-B 단계: 운영비 CRUD 만).
//
// 사장님 spec:
//   · 월 선택(이번달 default) + 운영비 표 + 추가/편집/삭제 (모두 확인 다이얼로그).
//   · 카테고리 한글 6개 (rent/ad/tax/meal/program/etc).
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
  EXPENSE_CATEGORIES, EXPENSE_CATEGORY_KO,
} from "../lib/bookkeepingDb.js";

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
export default function AdminPcBookkeeping({ t, user }) {
  const todayYmd = kstYmd();
  const [selectedYm, setSelectedYm] = useState(nowKstYm());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [dialog, setDialog] = useState(null);   // { mode:'add'|'edit'|'delete', row? }

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
            {/* 표 헤더 */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "110px 120px minmax(120px, 1fr) minmax(180px, 2fr) 100px",
              gap: 10, alignItems: "center",
              padding: "10px 18px",
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

      {/* 2-C 예고 */}
      <div style={{
        padding: "12px 16px",
        background: t.bgInset, border: `1px dashed ${t.border}`, borderRadius: 10,
        fontSize: 11, color: t.textMuted,
      }}>
        🚧 손익(수입 − 운영비) · 이월 · 대표 분배는 2-C 단계.
      </div>

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
    <div style={{
      display: "grid",
      gridTemplateColumns: "110px 120px minmax(120px, 1fr) minmax(180px, 2fr) 100px",
      gap: 10, alignItems: "center",
      padding: "10px 18px",
      borderTop: `1px solid ${t.border}`,
    }}>
      <span className="mono" style={{
        fontSize: 12, color: t.text, fontVariantNumeric: "tabular-nums",
      }}>
        {row.expense_date}{dp?.dow ? ` (${dp.dow})` : ""}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
        {EXPENSE_CATEGORY_KO[row.category] || row.category}
      </span>
      <span className="mono" style={{
        fontSize: 13, fontWeight: 800, color: t.danger,
        textAlign: "right", fontVariantNumeric: "tabular-nums",
      }}>{fmtKRW(row.amount)}</span>
      <span style={{
        fontSize: 12, color: row.memo ? t.textSecondary : t.textDim,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{row.memo || "—"}</span>
      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
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
    padding: "6px 8px",
    background: "transparent", border: `1px solid ${t.border}`,
    color: t.textSecondary, borderRadius: 7,
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

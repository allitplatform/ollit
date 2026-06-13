// 2026-06-13 — PC 운영자 "원청 계좌" 화면.
//
// 사장님 spec:
//   · 원청 7개 표시 — 원청명 / 은행 / 계좌번호 / 예금주 / 연락처.
//   · 빈 계좌(crikrin/KB/yongin) 표시 + 채우기.
//   · 편집(4필드) → updatePrincipalAccount(+phone) RPC 호출, 다이얼로그 확인.
//   · 계좌번호 민감 — 표시 OK(운영자), 편집 시 다이얼로그/저장 확인.
//
// 데이터:
//   · listPrincipalsFromDb — 전체 7개 (rowToSheetShape 결과). dbId 필드로 RPC 호출.
//   · updatePrincipalAccount(Mig 113 v2) — 6 인자 (phone 추가, owner/admin/operator 통과).
//
// ⚠️ DB·계산·RPC 본문 변경 0줄. 호출만.

import { useEffect, useMemo, useState } from "react";
import {
  Building2, CheckCircle2, AlertTriangle, Edit3, X, Save, Phone, CreditCard,
} from "lucide-react";
import { listPrincipalsFromDb, updatePrincipalAccount } from "../lib/principalsDb.js";

export default function AdminPcPrincipalAccount({ t, user }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);              // [{ dbId, code, name, bankName, accountNumber, accountHolder, phone }]
  const [reloadTick, setReloadTick] = useState(0);
  const [editing, setEditing] = useState(null);      // 편집 중 row

  const actor = user?.user_id || user?.userId || user?.id;

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr("");
    (async () => {
      const res = await listPrincipalsFromDb();
      if (!alive) return;
      if (!res?.ok) {
        setErr(res?.error || "조회 실패"); setLoading(false); return;
      }
      // active true 만. code 정렬 유지.
      setRows((res.principals || []).filter(p => p?.dbId));
      setLoading(false);
    })().catch(e => { if (alive) { setErr(e?.message || "에러"); setLoading(false); } });
    return () => { alive = false; };
  }, [reloadTick]);

  // 채움 통계
  const stats = useMemo(() => {
    let filled = 0, partial = 0, empty = 0;
    for (const r of rows) {
      const has3 = r.bankName && r.accountNumber && r.accountHolder;
      const hasSome = r.bankName || r.accountNumber || r.accountHolder;
      if (has3) filled++;
      else if (hasSome) partial++;
      else empty++;
    }
    return { filled, partial, empty, total: rows.length };
  }, [rows]);

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1400, margin: "0 auto" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Building2 size={22} style={{ color: t.accent }}/>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>원청 계좌</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
            원청별 입금 계좌 (은행 · 계좌번호 · 예금주 · 연락처)
          </div>
        </div>
        <div style={{ flex: 1 }}/>
        <div style={{ display: "flex", gap: 8 }}>
          <Stat t={t} label="완전" value={stats.filled} color={t.success}/>
          <Stat t={t} label="일부" value={stats.partial} color={t.warning}/>
          <Stat t={t} label="빈 계좌" value={stats.empty} color={t.danger}/>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "80px 20px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
          불러오는 중...
        </div>
      ) : err ? (
        <div style={{ padding: "80px 20px", textAlign: "center", color: t.danger, fontSize: 13 }}>
          ⚠️ {err}
        </div>
      ) : (
        <div style={{
          background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
          overflow: "hidden",
        }}>
          {/* 표 헤더 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(140px, 1.1fr) minmax(110px, 0.9fr) minmax(170px, 1.4fr) minmax(120px, 1fr) minmax(140px, 1fr) 80px",
            gap: 10, alignItems: "center",
            padding: "12px 18px",
            background: t.bgInset,
            fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4,
            borderBottom: `1px solid ${t.border}`,
          }}>
            <span>원청</span>
            <span>은행</span>
            <span>계좌번호</span>
            <span>예금주</span>
            <span>연락처</span>
            <span style={{ textAlign: "right" }}>편집</span>
          </div>
          {rows.map(r => (
            <PrincipalRow key={r.dbId} t={t} row={r}
              onEdit={() => setEditing(r)}/>
          ))}
        </div>
      )}

      {editing && (
        <EditDialog
          t={t}
          row={editing}
          actor={actor}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReloadTick(n => n + 1);
          }}
        />
      )}
    </div>
  );
}

function Stat({ t, label, value, color }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 12px",
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 8,
    }}>
      <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
      <span className="mono" style={{
        fontSize: 14, fontWeight: 800, color, fontVariantNumeric: "tabular-nums",
      }}>{value}</span>
    </div>
  );
}

// ──────────────────────────────────────────────
// 원청 한 줄
// ──────────────────────────────────────────────
function PrincipalRow({ t, row, onEdit }) {
  const has3 = row.bankName && row.accountNumber && row.accountHolder;
  const hasSome = row.bankName || row.accountNumber || row.accountHolder;
  const status = has3 ? "filled" : hasSome ? "partial" : "empty";
  const dim = !has3;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(140px, 1.1fr) minmax(110px, 0.9fr) minmax(170px, 1.4fr) minmax(120px, 1fr) minmax(140px, 1fr) 80px",
      gap: 10, alignItems: "center",
      padding: "12px 18px",
      borderTop: `1px solid ${t.border}`,
      opacity: dim ? 0.85 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {status === "filled"  && <CheckCircle2 size={14} style={{ color: t.success, flexShrink: 0 }}/>}
        {status === "partial" && <AlertTriangle size={14} style={{ color: t.warning, flexShrink: 0 }}/>}
        {status === "empty"   && <AlertTriangle size={14} style={{ color: t.danger, flexShrink: 0 }}/>}
        <span style={{
          fontSize: 13, fontWeight: 700, color: t.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{row.name || row.code || "—"}</span>
      </div>
      <span style={{ fontSize: 13, color: row.bankName ? t.text : t.textMuted }}>
        {row.bankName || "—"}
      </span>
      <span className="mono" style={{
        fontSize: 12, color: row.accountNumber ? t.text : t.textMuted,
        fontVariantNumeric: "tabular-nums",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{row.accountNumber || "—"}</span>
      <span style={{ fontSize: 13, color: row.accountHolder ? t.text : t.textMuted }}>
        {row.accountHolder || "—"}
      </span>
      <span className="mono" style={{
        fontSize: 12, color: row.phone ? t.text : t.textMuted,
        fontVariantNumeric: "tabular-nums",
      }}>{row.phone || "—"}</span>
      <div style={{ textAlign: "right" }}>
        <button onClick={onEdit}
          style={{
            padding: "6px 12px",
            background: "transparent", border: `1px solid ${t.border}`,
            color: t.textSecondary, borderRadius: 7,
            fontSize: 11, fontWeight: 700, fontFamily: "inherit",
            cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
          <Edit3 size={11}/>
          편집
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 편집 다이얼로그 — 4필드 + 저장 확인
// ──────────────────────────────────────────────
function EditDialog({ t, row, actor, onClose, onSaved }) {
  const [bankName, setBankName]           = useState(row.bankName || "");
  const [accountNumber, setAccountNumber] = useState(row.accountNumber || "");
  const [accountHolder, setAccountHolder] = useState(row.accountHolder || "");
  const [phone, setPhone]                 = useState(row.phone || "");
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasAll =
    bankName.trim() !== "" &&
    accountNumber.trim() !== "" &&
    accountHolder.trim() !== "";

  function handleSave() {
    if (!hasAll) {
      setActionErr("은행 · 계좌번호 · 예금주는 필수입니다.");
      return;
    }
    setActionErr("");
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!actor) {
      setActionErr("관리자 사용자 ID를 찾을 수 없습니다.");
      setConfirmOpen(false);
      return;
    }
    setBusy(true);
    try {
      const res = await updatePrincipalAccount({
        principalId:   row.dbId,
        bankName:      bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        phone:         phone.trim(),
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
      <div onClick={onClose} style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)", zIndex: 200, cursor: "pointer",
      }}/>
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(520px, 92vw)",
        background: t.bgElevated, borderRadius: 14,
        border: `1px solid ${t.border}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        zIndex: 201, padding: "22px 26px",
        display: "flex", flexDirection: "column", gap: 16,
        maxHeight: "90vh", overflow: "auto",
      }}>
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Building2 size={20} style={{ color: t.accent }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
              {row.name || row.code} 계좌 편집
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
              원청 코드: <span className="mono">{row.code}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{
            background: "transparent", border: "none", padding: 4,
            color: t.textMuted, cursor: "pointer", display: "flex",
          }}>
            <X size={18}/>
          </button>
        </div>

        {/* 4 필드 */}
        <Field t={t} label="은행" required value={bankName} onChange={setBankName} placeholder="예: 우리은행"/>
        <Field t={t} label="계좌번호" required value={accountNumber} onChange={setAccountNumber}
          placeholder="예: 1005-104-865024"
          monospace
          hint={<><CreditCard size={11} style={{ verticalAlign: "-1px" }}/> 민감 정보 — 저장 전 확인 다이얼로그가 뜹니다.</>}
        />
        <Field t={t} label="예금주" required value={accountHolder} onChange={setAccountHolder} placeholder="예: 올데이케어"/>
        <Field t={t} label="연락처" value={phone} onChange={setPhone} placeholder="예: 010-1234-5678"
          monospace
          icon={<Phone size={11}/>}
        />

        {actionErr && (
          <div style={{
            padding: "8px 12px",
            background: t.dangerBg, border: `1px solid ${t.dangerBorder}`,
            borderRadius: 8, fontSize: 12, color: t.danger, fontWeight: 600,
          }}>⚠️ {actionErr}</div>
        )}

        {/* 액션 */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={busy} style={{
            padding: "10px 18px",
            background: "transparent", border: `1px solid ${t.border}`,
            borderRadius: 8, fontSize: 13, fontWeight: 700,
            color: t.textSecondary, cursor: busy ? "wait" : "pointer",
            fontFamily: "inherit",
          }}>취소</button>
          <button onClick={handleSave} disabled={busy} style={{
            padding: "10px 20px",
            background: busy ? t.bgInset : t.accent,
            border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 800, color: busy ? t.textMuted : "#fff",
            cursor: busy ? "wait" : "pointer",
            fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", gap: 6,
            opacity: busy ? 0.6 : 1,
          }}>
            <Save size={13}/>
            저장
          </button>
        </div>
      </div>

      {/* 확인 다이얼로그 — 저장 직전 */}
      {confirmOpen && (
        <ConfirmSavePanel t={t}
          row={row}
          bankName={bankName} accountNumber={accountNumber} accountHolder={accountHolder} phone={phone}
          busy={busy}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}

function Field({ t, label, required, value, onChange, placeholder, monospace, hint, icon }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{
        fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3,
        display: "inline-flex", alignItems: "center", gap: 5,
      }}>
        {icon}
        {label}{required && <span style={{ color: t.accent }}> *</span>}
      </label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: "10px 12px",
          background: t.bgInset, border: `1px solid ${t.border}`,
          borderRadius: 8,
          fontSize: 13, color: t.text,
          fontFamily: monospace ? "ui-monospace, monospace" : "inherit",
          outline: "none", boxSizing: "border-box",
          fontVariantNumeric: "tabular-nums",
        }}
      />
      {hint && (
        <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>{hint}</div>
      )}
    </div>
  );
}

function ConfirmSavePanel({ t, row, bankName, accountNumber, accountHolder, phone, busy, onCancel, onConfirm }) {
  return (
    <>
      <div onClick={onCancel} style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.4)", zIndex: 210, cursor: "pointer",
      }}/>
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(440px, 92vw)",
        background: t.bgElevated, borderRadius: 14,
        border: `2px solid ${t.accent}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        zIndex: 211, padding: "22px 24px",
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: t.text, marginBottom: 14 }}>
          저장 확인 — {row.name || row.code}
        </div>
        <div style={{
          padding: "12px 14px",
          background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 10,
          display: "flex", flexDirection: "column", gap: 6,
          fontSize: 12, color: t.text, marginBottom: 16,
        }}>
          <Line t={t} label="은행"     value={bankName}/>
          <Line t={t} label="계좌번호" value={accountNumber} mono/>
          <Line t={t} label="예금주"   value={accountHolder}/>
          <Line t={t} label="연락처"   value={phone || "(없음)"} mono/>
        </div>
        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.6, marginBottom: 14 }}>
          ⚠️ 계좌번호는 민감 정보입니다. 정확히 확인 후 저장해 주세요.<br/>
          저장 후 원청 PWA(본인 화면)와 운영자 화면에 즉시 반영됩니다.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={busy} style={{
            padding: "9px 16px",
            background: "transparent", border: `1px solid ${t.border}`,
            borderRadius: 8, fontSize: 12, fontWeight: 700,
            color: t.textSecondary, cursor: busy ? "wait" : "pointer",
            fontFamily: "inherit",
          }}>되돌리기</button>
          <button onClick={onConfirm} disabled={busy} style={{
            padding: "9px 20px",
            background: busy ? t.bgInset : t.accent,
            border: "none", borderRadius: 8,
            fontSize: 12, fontWeight: 800, color: busy ? t.textMuted : "#fff",
            cursor: busy ? "wait" : "pointer",
            fontFamily: "inherit",
            opacity: busy ? 0.6 : 1,
          }}>{busy ? "저장 중..." : "확인 — 저장"}</button>
        </div>
      </div>
    </>
  );
}

function Line({ t, label, value, mono }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, minWidth: 60 }}>{label}</span>
      <span className={mono ? "mono" : ""} style={{
        fontSize: 13, color: t.text, fontWeight: 700,
        fontFamily: mono ? "ui-monospace, monospace" : "inherit",
        fontVariantNumeric: mono ? "tabular-nums" : undefined,
      }}>{value || "—"}</span>
    </div>
  );
}

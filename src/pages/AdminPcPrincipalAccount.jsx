// 2026-06-13 — PC 운영자 "원청 계좌" 화면.
// 2026-07-21 — 시안 반영 재배치: 좌 원청 테이블 + 우 상세 패널 (사장님 승인 시안 레이아웃).
//   · 데이터·저장 무변경: listPrincipalsFromDb 조회 + updatePrincipalAccount(Mig 113 v2) RPC + 저장 확인 다이얼로그 그대로.
//   · 우 패널 정보(코드/유형/접두어/비고)는 DB에 실재하는 필드만 표시 — 없는 값 지어내지 않음.
//   · 새 원청 추가 버튼 없음 — 새 원청 = DB·정산 정책·화면 반영 한 세트 (계약 시 Claude 세션에서 일괄 세팅).
// ⚠️ DB·계산·RPC 본문 변경 0줄. 호출만.

import { useEffect, useMemo, useState } from "react";
import {
  Building2, CheckCircle2, AlertTriangle, X, Save, Phone, CreditCard,
} from "lucide-react";
import { listPrincipalsFromDb, updatePrincipalAccount } from "../lib/principalsDb.js";

export default function AdminPcPrincipalAccount({ t, user }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);              // [{ dbId, code, name, type, prefix, note, bankName, accountNumber, accountHolder, phone }]
  const [reloadTick, setReloadTick] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

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
      const list = (res.principals || []).filter(p => p?.dbId);
      setRows(list);
      // 선택 유지 (재조회 후) — 없으면 첫 행
      setSelectedId(prev => list.some(r => r.dbId === prev) ? prev : (list[0]?.dbId || null));
      setLoading(false);
    })().catch(e => { if (alive) { setErr(e?.message || "에러"); setLoading(false); } });
    return () => { alive = false; };
  }, [reloadTick]);

  const selected = rows.find(r => r.dbId === selectedId) || null;

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
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>원청</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
            {stats.total}곳 — 행을 클릭하면 오른쪽에서 정보 확인 · 계좌 관리
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
          display: "grid",
          gridTemplateColumns: "minmax(380px, 1.3fr) minmax(320px, 1fr)",
          gap: 18, alignItems: "start",
        }}>
          {/* ── 좌: 원청 테이블 ── */}
          <div style={{
            background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
            overflow: "hidden",
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(150px, 1.4fr) minmax(80px, 0.7fr) 90px",
              gap: 10, alignItems: "center",
              padding: "12px 18px",
              background: t.bgInset,
              fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4,
              borderBottom: `1px solid ${t.border}`,
            }}>
              <span>원청</span>
              <span>코드</span>
              <span style={{ textAlign: "center" }}>계좌</span>
            </div>
            {rows.map(r => {
              const has3 = r.bankName && r.accountNumber && r.accountHolder;
              const hasSome = r.bankName || r.accountNumber || r.accountHolder;
              const status = has3 ? "filled" : hasSome ? "partial" : "empty";
              const active = r.dbId === selectedId;
              return (
                <div key={r.dbId}
                  onClick={() => setSelectedId(r.dbId)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(150px, 1.4fr) minmax(80px, 0.7fr) 90px",
                    gap: 10, alignItems: "center",
                    padding: "12px 18px",
                    borderTop: `1px solid ${t.border}`,
                    cursor: "pointer",
                    background: active ? (t.accentBg || "rgba(255,27,141,0.10)") : "transparent",
                    borderLeft: `3px solid ${active ? t.accent : "transparent"}`,
                  }}>
                  <span style={{
                    fontSize: 13, fontWeight: active ? 800 : 700,
                    color: active ? t.accent : t.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{r.name || r.code || "—"}</span>
                  <span className="mono" style={{ fontSize: 11, color: t.textMuted }}>{r.code}</span>
                  <span style={{ textAlign: "center" }}>
                    {status === "filled" && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: t.success, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle2 size={12}/> 등록
                      </span>
                    )}
                    {status === "partial" && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: t.warning, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <AlertTriangle size={12}/> 일부
                      </span>
                    )}
                    {status === "empty" && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: t.danger, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <AlertTriangle size={12}/> 미등록
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            <div style={{
              margin: 12, padding: "10px 12px",
              border: `1px dashed ${t.border}`, borderRadius: 9,
              fontSize: 10.5, color: t.textMuted, lineHeight: 1.6,
            }}>
              ➕ 새 원청 추가는 화면에서 하지 않습니다 — 정산 규칙·DB 등록이 함께 필요해서, 계약 시 Claude 세션에서 한 번에 세팅합니다.
            </div>
          </div>

          {/* ── 우: 상세 패널 (정보 + 계좌 편집) ── */}
          {selected ? (
            <DetailPanel
              key={selected.dbId}
              t={t}
              row={selected}
              actor={actor}
              onSaved={() => setReloadTick(n => n + 1)}
            />
          ) : (
            <div style={{
              background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
              padding: 40, textAlign: "center", color: t.textMuted, fontSize: 12,
            }}>왼쪽에서 원청을 선택하세요</div>
          )}
        </div>
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
// 우측 상세 패널 — 정보(KV, DB 실재 필드만) + 계좌 4필드 인라인 편집
//   저장 흐름 = 옛 EditDialog 와 동일 (필수 3필드 검증 → 확인 다이얼로그 → updatePrincipalAccount RPC)
// ──────────────────────────────────────────────
function DetailPanel({ t, row, actor, onSaved }) {
  const [bankName, setBankName]           = useState(row.bankName || "");
  const [accountNumber, setAccountNumber] = useState(row.accountNumber || "");
  const [accountHolder, setAccountHolder] = useState(row.accountHolder || "");
  const [phone, setPhone]                 = useState(row.phone || "");
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const dirty =
    bankName !== (row.bankName || "") ||
    accountNumber !== (row.accountNumber || "") ||
    accountHolder !== (row.accountHolder || "") ||
    phone !== (row.phone || "");

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
        setConfirmOpen(false);
        setSavedMsg("✓ 저장됨");
        setTimeout(() => setSavedMsg(""), 2500);
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
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "13px 18px", borderBottom: `1px solid ${t.border}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <Building2 size={16} style={{ color: t.accent }}/>
        <span style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{row.name || row.code}</span>
        <span style={{ fontSize: 11, color: t.textMuted }}>정보 · 계좌</span>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* 정보 KV — DB 실재 필드만 */}
        <Kv t={t} label="코드" value={row.code} mono/>
        {row.type   ? <Kv t={t} label="유형"   value={row.type}/>   : null}
        {row.prefix ? <Kv t={t} label="접두어" value={row.prefix} mono/> : null}
        {row.note   ? <Kv t={t} label="비고"   value={row.note}/>   : null}

        <div style={{ borderTop: `1px solid ${t.border}`, margin: "2px 0" }}/>

        {/* 계좌 4필드 */}
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
        {savedMsg && (
          <div style={{ fontSize: 12, color: t.success, fontWeight: 700 }}>{savedMsg}</div>
        )}

        <button onClick={handleSave} disabled={busy || !dirty} style={{
          padding: "11px 20px",
          background: busy || !dirty ? t.bgInset : t.accent,
          border: "none", borderRadius: 9,
          fontSize: 13, fontWeight: 800, color: busy || !dirty ? t.textMuted : "#fff",
          cursor: busy || !dirty ? "default" : "pointer",
          fontFamily: "inherit",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <Save size={13}/>
          {busy ? "저장 중..." : "계좌 저장"}
        </button>
        <div style={{ fontSize: 10.5, color: t.textMuted, lineHeight: 1.6 }}>
          수수료·단가는 "단가 · 수수료" 메뉴에서. 여기는 정보 확인 + 계좌만.
        </div>
      </div>

      {/* 확인 다이얼로그 — 저장 직전 (기존 그대로) */}
      {confirmOpen && (
        <ConfirmSavePanel t={t}
          row={row}
          bankName={bankName} accountNumber={accountNumber} accountHolder={accountHolder} phone={phone}
          busy={busy}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

function Kv({ t, label, value, mono }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10,
      padding: "8px 11px",
      background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 8,
    }}>
      <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>{label}</span>
      <span className={mono ? "mono" : ""} style={{
        fontSize: 12.5, color: t.text, fontWeight: 700,
        fontFamily: mono ? "ui-monospace, monospace" : "inherit",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{value || "—"}</span>
    </div>
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

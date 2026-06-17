// 2026-06-17 — visit_only → 정상 작업 되돌리기 다이얼로그 (운영자 전용).
//
// 동작:
//   1. open 시 task_changes 의 visit_only mark 스냅샷 조회.
//   2. 스냅샷 있음 → 자동 모드 (미리보기 + "이대로 복원" 버튼).
//   3. 스냅샷 없음 또는 운영자가 "수동 입력" 선택 → 수동 폼 (작업유형 / 기종 / 견적금액 / 수량).
//   4. 제출 → unmark_visit_only RPC (자동/수동).
//   5. ok:true → onConfirmed() 부모 콜백 (작업 상세 새로고침 등).
//   6. ok:false → 에러별 안내 (appliance 누락 강조 등).
//
// ⚠️ 수동 모드 — 작업유형이 기종을 요구하면 (work_types.appliance_type_id NOT NULL)
//    기종 필수. Mig 138 의 'appliance_required' 가드와 동일.

import { useEffect, useMemo, useState } from "react";
import { X, AlertCircle, RotateCcw, ChevronRight } from "lucide-react";
import {
  fetchVisitOnlySnapshot,
  unmarkVisitOnlyAuto,
  unmarkVisitOnlyManual,
  fetchWorkTypesForUnmark,
} from "../../lib/visitOnlyDb.js";

function fmtKRW(n) {
  const v = Number(n) || 0;
  return `₩${v.toLocaleString("ko-KR")}`;
}

export function UnmarkVisitOnlyDialog({ t, task, actor, onClose, onConfirmed }) {
  const [phase, setPhase] = useState("loading"); // 'loading' | 'auto' | 'manual'
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState("");

  // 수동 폼 lookup 데이터.
  const [refs, setRefs] = useState({ work_types: [], service_types: [], appliance_types: [] });

  // 수동 폼 입력값.
  const [mWorkTypeId,      setMWorkTypeId]      = useState("");
  const [mApplianceTypeId, setMApplianceTypeId] = useState("");
  const [mQty,             setMQty]             = useState("1");
  const [mUnitPrice,       setMUnitPrice]       = useState("");
  const [mExtraFee,        setMExtraFee]        = useState("0");
  const [mTravelFee,       setMTravelFee]       = useState("0");
  const [mPaymentMethod,   setMPaymentMethod]   = useState("cash");

  // ── mount: 스냅샷 + lookup 동시 로드.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [snapRes, refsRes] = await Promise.all([
        fetchVisitOnlySnapshot(task?.id),
        fetchWorkTypesForUnmark(),
      ]);
      if (!alive) return;
      if (refsRes.ok) setRefs(refsRes);
      if (snapRes.ok && snapRes.snapshot) {
        setSnapshot(snapRes.snapshot);
        setPhase("auto");
      } else {
        setSnapshot(null);
        setPhase("manual");
      }
    })();
    return () => { alive = false; };
  }, [task?.id]);

  // 수동 폼 — 작업유형 변경 시 work_type 의 appliance_type_id 자동 매핑.
  //   work_types.appliance_type_id 가 NOT NULL 이면 기종 자동 set, NULL 이면 비움.
  const selectedWorkType = useMemo(
    () => refs.work_types.find(w => w.id === mWorkTypeId) || null,
    [refs.work_types, mWorkTypeId]
  );
  const requiresAppliance = !!(selectedWorkType && selectedWorkType.appliance_type_id);
  useEffect(() => {
    if (!selectedWorkType) return;
    // work_type 자체에 묶인 appliance 가 있으면 자동 set.
    if (selectedWorkType.appliance_type_id) {
      setMApplianceTypeId(selectedWorkType.appliance_type_id);
    } else {
      setMApplianceTypeId("");
    }
    if (selectedWorkType.default_unit_price && !mUnitPrice) {
      setMUnitPrice(String(selectedWorkType.default_unit_price));
    }
  }, [mWorkTypeId]);

  // ── 자동 모드 실행.
  async function handleAutoSubmit() {
    setSubmitting(true);
    setError("");
    const res = await unmarkVisitOnlyAuto(task.id, actor);
    setSubmitting(false);
    if (!res?.ok) {
      // no_snapshot → 수동 폼 전환.
      if (res?.error === "no_snapshot") {
        setSnapshot(null);
        setPhase("manual");
        setError("스냅샷이 없어 수동 입력으로 전환합니다.");
        return;
      }
      setError(formatRpcError(res));
      return;
    }
    setResultMsg(`✓ 정상 작업으로 복원됨 (${res.source}, ${res.item_count}개 항목)`);
    setTimeout(() => { onConfirmed && onConfirmed(res); }, 700);
  }

  // ── 수동 모드 검증 + 실행.
  async function handleManualSubmit() {
    setError("");
    const qty = parseInt(mQty || "0", 10);
    const unitPrice = parseInt(mUnitPrice || "0", 10);
    const extraFee  = parseInt(mExtraFee  || "0", 10);
    const travelFee = parseInt(mTravelFee || "0", 10);
    if (!mWorkTypeId) {
      setError("작업유형을 선택하세요.");
      return;
    }
    if (requiresAppliance && !mApplianceTypeId) {
      setError("선택한 작업유형은 기종(appliance)이 필요합니다.");
      return;
    }
    if (!unitPrice || unitPrice <= 0) {
      setError("견적금액(단가)을 입력하세요.");
      return;
    }
    if (!qty || qty <= 0) {
      setError("수량은 1 이상이어야 합니다.");
      return;
    }
    const productPrice = qty * unitPrice;
    const manual = {
      task: {
        status:         "완료",
        product_price:  productPrice,
        extra_fee:      extraFee,
        travel_fee:     travelFee,
        payment_method: mPaymentMethod || null,
      },
      task_items: [
        {
          work_type_id:      mWorkTypeId,
          appliance_type_id: mApplianceTypeId || null,
          qty,
          unit_price:        unitPrice,
          order_type:        "본작업",
        },
      ],
    };
    setSubmitting(true);
    const res = await unmarkVisitOnlyManual(task.id, actor, manual);
    setSubmitting(false);
    if (!res?.ok) {
      setError(formatRpcError(res));
      return;
    }
    setResultMsg(`✓ 정상 작업으로 복원됨 (수동, 견적 ${fmtKRW(productPrice)})`);
    setTimeout(() => { onConfirmed && onConfirmed(res); }, 700);
  }

  // 에러 메시지 사용자 친화 변환.
  function formatRpcError(res) {
    const e = res?.error || "";
    if (e === "permission denied") return "권한이 없습니다 (owner/admin/operator만).";
    if (e === "task is not visit_only") return `이 작업은 visit_only가 아닙니다 (현재: ${res.current_status || "—"}).`;
    if (e === "no_snapshot") return "스냅샷이 없습니다. 수동 입력으로 전환하세요.";
    if (e === "appliance_required") return `선택한 작업유형은 기종(appliance)이 필요합니다.`;
    return res?.hint ? `${e}: ${res.hint}` : e;
  }

  return (
    <>
      <div onClick={submitting ? undefined : onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200,
      }}/>
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(540px, 94vw)", maxHeight: "92vh", overflowY: "auto",
        background: t.bgElevated, borderRadius: 14,
        border: `2px solid ${t.accent}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        zIndex: 201, padding: 0,
        display: "flex", flexDirection: "column",
      }}>
        {/* 헤더 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 18px", borderBottom: `1px solid ${t.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RotateCcw size={18} style={{ color: t.accent }}/>
            <span style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
              정상 작업으로 되돌리기
            </span>
          </div>
          <button onClick={onClose} disabled={submitting} style={{
            background: "transparent", border: "none", padding: 4,
            cursor: "pointer", color: t.textMuted,
          }}><X size={18}/></button>
        </div>

        {/* 본문 */}
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          {phase === "loading" && (
            <div style={{ padding: "24px 0", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
              스냅샷 조회 중...
            </div>
          )}

          {phase === "auto" && snapshot && (
            <AutoPreview t={t} snapshot={snapshot} refs={refs}/>
          )}

          {phase === "manual" && (
            <ManualForm
              t={t}
              refs={refs}
              workTypeId={mWorkTypeId}      setWorkTypeId={setMWorkTypeId}
              applianceTypeId={mApplianceTypeId} setApplianceTypeId={setMApplianceTypeId}
              qty={mQty}                    setQty={setMQty}
              unitPrice={mUnitPrice}        setUnitPrice={setMUnitPrice}
              extraFee={mExtraFee}          setExtraFee={setMExtraFee}
              travelFee={mTravelFee}        setTravelFee={setMTravelFee}
              paymentMethod={mPaymentMethod} setPaymentMethod={setMPaymentMethod}
              requiresAppliance={requiresAppliance}
            />
          )}

          {/* 자동 ↔ 수동 토글 (스냅샷 있을 때만) */}
          {snapshot && phase === "auto" && (
            <button type="button" onClick={() => setPhase("manual")} style={ghostBtnStyle(t)}>
              수동 입력으로 전환 →
            </button>
          )}
          {snapshot && phase === "manual" && (
            <button type="button" onClick={() => setPhase("auto")} style={ghostBtnStyle(t)}>
              ← 스냅샷 자동 복원으로
            </button>
          )}

          {error && (
            <div style={{
              padding: "10px 12px",
              background: t.dangerBg || "rgba(255,59,92,0.08)",
              border: `1px solid ${t.danger || "#FF3D5A"}`,
              borderRadius: 8, fontSize: 12, color: t.danger || "#FF3D5A",
              display: "flex", alignItems: "flex-start", gap: 6,
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
              <span>{error}</span>
            </div>
          )}

          {resultMsg && (
            <div style={{
              padding: "10px 12px",
              background: t.successBg || "rgba(29,158,117,0.08)",
              border: `1px solid ${t.success || "#10B981"}`,
              borderRadius: 8, fontSize: 12, color: t.success || "#10B981",
              fontWeight: 700,
            }}>{resultMsg}</div>
          )}
        </div>

        {/* 액션 */}
        <div style={{
          display: "flex", gap: 8, justifyContent: "flex-end",
          padding: "12px 18px", borderTop: `1px solid ${t.border}`,
        }}>
          <button onClick={onClose} disabled={submitting} style={ghostBtnStyle(t)}>
            닫기
          </button>
          {phase === "auto" && (
            <button onClick={handleAutoSubmit} disabled={submitting || !snapshot}
              style={primaryBtnStyle(t)}>
              {submitting ? "복원 중..." : "이대로 복원"}
            </button>
          )}
          {phase === "manual" && (
            <button onClick={handleManualSubmit} disabled={submitting}
              style={primaryBtnStyle(t)}>
              {submitting ? "복원 중..." : "복원하기"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────
// 자동 미리보기 — 스냅샷 요약 (task / items / payments)
// ──────────────────────────────────────────────────
function AutoPreview({ t, snapshot, refs }) {
  const taskData = snapshot.task || {};
  const items    = Array.isArray(snapshot.task_items) ? snapshot.task_items : [];
  const payments = Array.isArray(snapshot.payments)   ? snapshot.payments   : [];

  // work_type / appliance 라벨 lookup.
  const wtById = useMemo(() => new Map(refs.work_types.map(w => [w.id, w])), [refs.work_types]);
  const atById = useMemo(() => new Map(refs.appliance_types.map(a => [a.id, a])), [refs.appliance_types]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        padding: "10px 12px",
        background: t.bgInset, border: `1px dashed ${t.border}`,
        borderRadius: 8, fontSize: 11, color: t.textSecondary, lineHeight: 1.6,
      }}>
        💡 visit_only 직전 스냅샷을 사용해 작업을 원래대로 복원합니다.
        분배(기사·원청·회사)는 compute_payment 가 정책에 따라 자동 재계산.
      </div>

      {/* tasks 요약 */}
      <SectionLabel t={t} text="작업 정보"/>
      <KV t={t} k="상태"      v={taskData.status || "—"}/>
      <KV t={t} k="견적금액"   v={fmtKRW(taskData.product_price)}/>
      <KV t={t} k="현장 추가금" v={fmtKRW(taskData.extra_fee)}/>
      <KV t={t} k="출장비"     v={fmtKRW(taskData.travel_fee)}/>
      {taskData.payment_method && (
        <KV t={t} k="결제 방법" v={taskData.payment_method}/>
      )}

      {/* task_items */}
      <SectionLabel t={t} text={`작업 항목 (${items.length}개)`}/>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: t.textMuted }}>(없음)</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((it, idx) => {
            const wt = wtById.get(it.work_type_id);
            const at = atById.get(it.appliance_type_id);
            return (
              <div key={idx} style={{
                padding: "8px 10px",
                background: t.bgInset, border: `1px solid ${t.border}`,
                borderRadius: 6,
                display: "grid", gridTemplateColumns: "1fr auto", gap: 6,
                fontSize: 12,
              }}>
                <div>
                  <div style={{ fontWeight: 800, color: t.text }}>
                    {wt?.name || it.work_type_id?.slice(0, 8) || "—"}
                    {at && <span style={{ color: t.textSecondary, fontWeight: 600 }}> · {at.name}</span>}
                    {it.is_canceled && <span style={{ color: t.danger || "#FF3D5A", marginLeft: 6 }}>(취소)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                    {it.order_type || "본작업"} · 수량 {it.qty}
                  </div>
                </div>
                <div className="mono" style={{
                  fontSize: 13, fontWeight: 700, color: t.text,
                  textAlign: "right", fontVariantNumeric: "tabular-nums",
                }}>{fmtKRW(it.unit_price)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* payments */}
      {payments.length > 0 && (
        <>
          <SectionLabel t={t} text={`옛 분배 (참조 — 새 분배는 자동 재계산)`}/>
          {payments.map((p, idx) => (
            <div key={idx} style={{
              display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr", gap: 8,
              padding: "6px 10px",
              background: t.bgInset, border: `1px solid ${t.border}`,
              borderRadius: 6, fontSize: 11, alignItems: "baseline",
            }}>
              <span style={{ color: t.textSecondary, fontWeight: 700 }}>{p.calc_method || "—"}</span>
              <span className="mono" style={{ textAlign: "right" }}>기사 {fmtKRW(p.engineer_amount)}</span>
              <span className="mono" style={{ textAlign: "right" }}>원청 {fmtKRW(p.principal_amount)}</span>
              <span className="mono" style={{ textAlign: "right", color: t.success }}>회사 {fmtKRW(p.owner_amount)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────
// 수동 폼 — 작업유형 / 기종 / 견적금액 / 수량
// ──────────────────────────────────────────────────
function ManualForm({
  t, refs,
  workTypeId, setWorkTypeId,
  applianceTypeId, setApplianceTypeId,
  qty, setQty,
  unitPrice, setUnitPrice,
  extraFee, setExtraFee,
  travelFee, setTravelFee,
  paymentMethod, setPaymentMethod,
  requiresAppliance,
}) {
  // 작업유형 선택지 — service_type 별로 그룹.
  const groups = useMemo(() => {
    const stById = new Map(refs.service_types.map(s => [s.id, s]));
    const map = new Map();
    for (const wt of refs.work_types) {
      const st = stById.get(wt.service_type_id);
      const key = st?.name || st?.code || "기타";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(wt);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [refs]);

  // 기종 선택지 — work_type 에 묶인 appliance 있으면 그 1개로 고정, 없으면 전체.
  const applianceOptions = useMemo(() => {
    return refs.appliance_types;
  }, [refs.appliance_types]);

  const productPrice = (parseInt(qty || "0", 10) || 0) * (parseInt(unitPrice || "0", 10) || 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        padding: "10px 12px",
        background: t.bgInset, border: `1px dashed ${t.border}`,
        borderRadius: 8, fontSize: 11, color: t.textSecondary, lineHeight: 1.6,
      }}>
        💡 스냅샷이 없는 옛 visit_only 작업입니다. 원래 정보를 입력해주세요.
        기종이 필요한 작업유형(세척/냉매 등)은 기종도 필수입니다.
      </div>

      {/* 작업유형 */}
      <Field t={t} label="작업유형 *">
        <select value={workTypeId} onChange={(e) => setWorkTypeId(e.target.value)} style={inputStyle(t)}>
          <option value="">— 선택 —</option>
          {groups.map(([groupName, wts]) => (
            <optgroup key={groupName} label={groupName}>
              {wts.map(wt => (
                <option key={wt.id} value={wt.id}>
                  {wt.name}{wt.code ? ` (${wt.code})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      {/* 기종 — requiresAppliance 일 때 강조 */}
      <Field t={t} label={`기종${requiresAppliance ? " *" : " (선택)"}`}>
        <select value={applianceTypeId} onChange={(e) => setApplianceTypeId(e.target.value)} style={{
          ...inputStyle(t),
          borderColor: requiresAppliance && !applianceTypeId ? (t.danger || "#FF3D5A") : t.border,
        }}>
          <option value="">— {requiresAppliance ? "필수 선택" : "없음"} —</option>
          {applianceOptions.map(at => (
            <option key={at.id} value={at.id}>
              {at.name}{at.code ? ` (${at.code})` : ""}
            </option>
          ))}
        </select>
      </Field>

      {/* 수량 + 단가 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <Field t={t} label="수량 *">
          <input type="number" value={qty} onChange={(e) => setQty(e.target.value)}
            min="1" style={inputStyle(t)} placeholder="1"/>
        </Field>
        <Field t={t} label="단가 (원) *">
          <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
            min="0" step="1000" style={inputStyle(t)} placeholder="80000"/>
        </Field>
      </div>

      {/* 견적금액 자동 계산 표시 */}
      <div style={{
        padding: "8px 12px",
        background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 6,
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontSize: 12,
      }}>
        <span style={{ color: t.textSecondary, fontWeight: 600 }}>견적금액 (수량 × 단가)</span>
        <span className="mono" style={{
          fontSize: 14, fontWeight: 800, color: t.text,
          fontVariantNumeric: "tabular-nums",
        }}>{fmtKRW(productPrice)}</span>
      </div>

      {/* 추가/출장/결제 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Field t={t} label="현장 추가금">
          <input type="number" value={extraFee} onChange={(e) => setExtraFee(e.target.value)}
            min="0" style={inputStyle(t)} placeholder="0"/>
        </Field>
        <Field t={t} label="출장비">
          <input type="number" value={travelFee} onChange={(e) => setTravelFee(e.target.value)}
            min="0" style={inputStyle(t)} placeholder="0"/>
        </Field>
      </div>

      <Field t={t} label="결제 방법">
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={inputStyle(t)}>
          <option value="cash">현금</option>
          <option value="card">카드</option>
          <option value="transfer">계좌이체</option>
          <option value="prepaid">선결제</option>
          <option value="naver_pay">네이버페이</option>
        </select>
      </Field>
    </div>
  );
}

function SectionLabel({ t, text }) {
  return (
    <div style={{
      fontSize: 11, color: t.textMuted, fontWeight: 800, letterSpacing: 0.3,
      marginTop: 4,
    }}>{text}</div>
  );
}

function KV({ t, k, v }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "4px 0", borderBottom: `1px dashed ${t.border}`,
      fontSize: 12,
    }}>
      <span style={{ color: t.textSecondary, fontWeight: 600 }}>{k}</span>
      <span style={{
        color: t.text, fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
      }}>{v}</span>
    </div>
  );
}

function Field({ t, label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
      {children}
    </div>
  );
}

function inputStyle(t) {
  return {
    padding: "8px 10px",
    background: t.bg,
    border: `1px solid ${t.border}`,
    borderRadius: 6,
    color: t.text, fontSize: 12, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box", width: "100%",
  };
}
function ghostBtnStyle(t) {
  return {
    padding: "9px 14px",
    background: "transparent", border: `1px solid ${t.border}`,
    color: t.text, borderRadius: 8,
    fontSize: 12, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  };
}
function primaryBtnStyle(t) {
  return {
    padding: "9px 18px",
    background: t.accent, color: "#fff",
    border: "none", borderRadius: 8,
    fontSize: 13, fontWeight: 800,
    cursor: "pointer", fontFamily: "inherit",
  };
}

export default UnmarkVisitOnlyDialog;

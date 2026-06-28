// 2026-06-28 — 작업 견적 수정 (qty/단가) + 추가 (정책 검증) 모달 2종.
//   Mig 153 RPC 연결.
//   가드: 미정산 + 트랙 B 차단 + 사유 5자+ + 정책 매칭 (추가) — 서버단 진실.
//   클라는 1차 검증 + confirm + 적용 후 reload 콜백.

import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import {
  adminUpdateTaskItem,
  adminInsertTaskItem,
  fetchPickerOptions,
} from "../../lib/taskItemsEditDb.js";

const ACCENT = "#FF1B8D";

const fmtKRW = (n) => `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;

// 공용 모달 스타일
const modalOverlay = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1100, padding: 20,
};
const modalCard = (t) => ({
  background: t?.bg || "var(--bg-primary)",
  color: t?.text || "var(--text-primary)",
  border: `1px solid ${t?.border || "var(--border)"}`,
  borderRadius: 14,
  width: "min(520px, 100%)",
  maxHeight: "min(85vh, 700px)",
  display: "flex", flexDirection: "column",
  fontFamily: "'Pretendard', sans-serif",
  boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
});
const labelStyle = (t) => ({
  display: "block",
  fontSize: 12, fontWeight: 700,
  color: t?.textSecondary || "var(--text-secondary)",
  marginBottom: 6,
});
const inputStyle = (t) => ({
  width: "100%",
  padding: "10px 12px",
  background: t?.bgElevated || "var(--bg-elevated)",
  border: `1px solid ${t?.border || "var(--border)"}`,
  borderRadius: 8,
  color: t?.text || "var(--text-primary)",
  fontSize: 13, fontWeight: 600,
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
});

// ============================================================================
// [A] 수정 모달 — qty / unit_price
// ============================================================================
export function EditTaskItemModal({ t, item, task, actorId, onClose, onApplied }) {
  const [qty, setQty]             = useState(String(item?.qty ?? 1));
  const [unitPrice, setUnitPrice] = useState(String(item?.unitPrice ?? item?.unit_price ?? 0));
  const [note, setNote]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    function handler(e) { if (e.key === "Escape" && !submitting) onClose?.(); }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, submitting]);

  const qtyN  = Number(qty)       || 0;
  const upN   = Number(unitPrice) || 0;
  const newSubtotal = qtyN * upN;
  const oldQty      = Number(item?.qty || 0);
  const oldUp       = Number(item?.unitPrice ?? item?.unit_price ?? 0);
  const oldSubtotal = oldQty * oldUp;
  const diff        = newSubtotal - oldSubtotal;
  const changed     = qtyN !== oldQty || upN !== oldUp;

  async function handleSubmit() {
    if (!changed)               { setError("변경 없음"); return; }
    if (qtyN <= 0)              { setError("qty > 0 필수"); return; }
    if (upN < 0)                { setError("단가 0 이상"); return; }
    if (note.trim().length < 5) { setError("변경 사유 5자 이상 필수"); return; }
    if (!actorId)               { setError("로그인 운영자 확인 실패"); return; }

    const msg = `이 항목 소계: ${fmtKRW(oldSubtotal)} → ${fmtKRW(newSubtotal)} (${diff >= 0 ? "+" : ""}${fmtKRW(diff)}).\n적용하시겠습니까?\n\n(정산 자동 재계산 — 적용 후 새 분배 확인)`;
    if (!window.confirm(msg)) return;

    setSubmitting(true); setError("");
    const res = await adminUpdateTaskItem({
      actorId, itemId: item.id,
      qty: qtyN !== oldQty ? qtyN : null,
      unitPrice: upN !== oldUp ? upN : null,
      note: note.trim(),
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error || "수정 실패"); return; }
    onApplied?.();
  }

  return (
    <div onClick={() => !submitting && onClose()} style={modalOverlay}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={modalCard(t)}>
        <ModalHeader t={t} title="✏️ 견적 수정" subtitle={`${task?.taskNo || task?.task_no || ""} · ${task?.customer || ""}`} onClose={() => !submitting && onClose()}/>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 현재 항목 */}
          <div style={{
            padding: "10px 12px",
            background: t?.bgInset || t?.bgSecondary || "rgba(255,255,255,0.03)",
            border: `1px solid ${t?.border || "var(--border)"}`,
            borderRadius: 8,
            fontSize: 12, color: t?.textSecondary || "var(--text-secondary)",
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {item?.workType || ""} · {item?.appliance || ""} (현재 {oldQty}개 × {fmtKRW(oldUp)})
            </div>
            <div>소계 {fmtKRW(oldSubtotal)}</div>
          </div>

          {/* qty + unit_price */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 10 }}>
            <div>
              <label style={labelStyle(t)}>수량</label>
              <input type="number" inputMode="numeric" min="1" step="1" value={qty}
                onChange={(e) => setQty(e.target.value)} style={inputStyle(t)}/>
            </div>
            <div>
              <label style={labelStyle(t)}>단가</label>
              <input type="number" inputMode="numeric" min="0" step="1000" value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)} style={inputStyle(t)}/>
            </div>
          </div>

          {/* 미리보기 — 항목 소계만 (정산 분배는 적용 후 reload) */}
          <div style={{
            padding: "10px 12px",
            background: changed ? "rgba(255,27,141,0.08)" : (t?.bgInset || "rgba(255,255,255,0.03)"),
            border: `1px solid ${changed ? ACCENT : (t?.border || "var(--border)")}`,
            borderRadius: 8,
            fontSize: 13, fontWeight: 700,
            color: changed ? ACCENT : (t?.textSecondary || "var(--text-secondary)"),
            textAlign: "right",
          }}>
            새 소계: {fmtKRW(newSubtotal)}
            {changed && (
              <span style={{ marginLeft: 8, fontSize: 11 }}>
                ({diff >= 0 ? "+" : ""}{fmtKRW(diff)})
              </span>
            )}
          </div>

          {/* 사유 */}
          <div>
            <label style={labelStyle(t)}>변경 사유 <span style={{ color: ACCENT }}>* (5자 이상)</span></label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500}
              placeholder="예: 고객 요청으로 수량 정정"
              style={{ ...inputStyle(t), resize: "vertical", minHeight: 70, lineHeight: 1.5 }}/>
            <div style={{ fontSize: 10, color: t?.textMuted || "var(--text-tertiary, var(--text-secondary))", textAlign: "right", marginTop: 4 }}>
              {note.length} / 500
            </div>
          </div>

          {error && <ErrorBox text={error}/>}
        </div>
        <ModalFooter t={t}
          submitting={submitting}
          submitLabel={submitting ? "적용 중..." : "수정 적용 (자동 재계산)"}
          disabled={!changed || submitting || note.trim().length < 5}
          onCancel={() => !submitting && onClose()}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}

// ============================================================================
// [B] 추가 모달 — work_type / appliance / qty / unit_price (정책 검증 서버단)
// ============================================================================
export function AddTaskItemModal({ t, task, actorId, onClose, onApplied }) {
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError,   setPickerError]   = useState("");
  const [pickerOpts,    setPickerOpts]    = useState(null); // {serviceTypes, workTypes, applianceTypes}

  const [serviceTypeId,   setServiceTypeId]   = useState("");
  const [workTypeId,      setWorkTypeId]      = useState("");
  const [applianceTypeId, setApplianceTypeId] = useState("");
  const [qty,             setQty]             = useState("1");
  const [unitPrice,       setUnitPrice]       = useState("");
  const [orderType,       setOrderType]       = useState("추가선택");
  const [note,            setNote]            = useState("");
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState("");

  useEffect(() => {
    function handler(e) { if (e.key === "Escape" && !submitting) onClose?.(); }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, submitting]);

  // 옵션 fetch (1회)
  useEffect(() => {
    let alive = true;
    setPickerLoading(true); setPickerError("");
    fetchPickerOptions().then(res => {
      if (!alive) return;
      if (!res.ok) { setPickerError(res.error || "옵션 불러오기 실패"); setPickerOpts(null); }
      else setPickerOpts(res);
    }).finally(() => { if (alive) setPickerLoading(false); });
    return () => { alive = false; };
  }, []);

  // 선택된 service 안에서 work_types 필터
  const filteredWorkTypes = useMemo(() => {
    if (!pickerOpts || !serviceTypeId) return [];
    return pickerOpts.workTypes.filter(w => w.service_type_id === serviceTypeId);
  }, [pickerOpts, serviceTypeId]);

  // work_type 변경 시 unit_price 자동 (default_unit_price)
  useEffect(() => {
    if (!workTypeId || !pickerOpts) return;
    const wt = pickerOpts.workTypes.find(w => w.id === workTypeId);
    if (wt && Number(wt.default_unit_price) > 0) {
      setUnitPrice(String(wt.default_unit_price));
    }
  }, [workTypeId, pickerOpts]);

  // service 변경 시 work_type 초기화
  useEffect(() => { setWorkTypeId(""); }, [serviceTypeId]);

  const qtyN = Number(qty)       || 0;
  const upN  = Number(unitPrice) || 0;
  const newSubtotal = qtyN * upN;

  async function handleSubmit() {
    if (!workTypeId)            { setError("작업 종류 선택"); return; }
    if (qtyN <= 0)              { setError("qty > 0 필수"); return; }
    if (upN < 0)                { setError("단가 0 이상"); return; }
    if (note.trim().length < 5) { setError("변경 사유 5자 이상 필수"); return; }
    if (!actorId)               { setError("로그인 운영자 확인 실패"); return; }

    const msg = `이 항목 추가: 소계 ${fmtKRW(newSubtotal)}.\n적용하시겠습니까?\n\n(정산 자동 재계산 — 적용 후 새 분배 확인. 정책 없는 조합은 거부됨)`;
    if (!window.confirm(msg)) return;

    setSubmitting(true); setError("");
    const res = await adminInsertTaskItem({
      actorId, taskId: task.id,
      workTypeId,
      applianceTypeId: applianceTypeId || null,
      qty: qtyN, unitPrice: upN,
      orderType: orderType || null,
      note: note.trim(),
    });
    setSubmitting(false);
    if (!res.ok) {
      // policy_not_found 시 detail 노출
      if (res.error === "policy_not_found") {
        setError(`정책 없음 — ${res.detail || "이 조합 (원청/서비스/기종) 의 정산 정책이 등록 안 됨"}. 관리자에게 정책 추가 요청 후 다시 시도.`);
      } else {
        setError(res.error || "추가 실패");
      }
      return;
    }
    onApplied?.();
  }

  const principalLabel = task?.principal || task?.principalCode || "?";

  return (
    <div onClick={() => !submitting && onClose()} style={modalOverlay}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={modalCard(t)}>
        <ModalHeader t={t} title="➕ 항목 추가" subtitle={`${task?.taskNo || task?.task_no || ""} · ${task?.customer || ""} · 원청: ${principalLabel}`} onClose={() => !submitting && onClose()}/>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {pickerLoading ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: t?.textSecondary || "var(--text-secondary)" }}>
              옵션 불러오는 중...
            </div>
          ) : pickerError ? (
            <ErrorBox text={pickerError}/>
          ) : (
            <>
              {/* 서비스 종류 (cleaning/refrigerant/repair/install …) */}
              <div>
                <label style={labelStyle(t)}>서비스 종류 <span style={{ color: ACCENT }}>*</span></label>
                <select value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} style={inputStyle(t)}>
                  <option value="">선택...</option>
                  {(pickerOpts?.serviceTypes || []).map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              {/* 작업 종류 — service 선택 후 노출 */}
              {serviceTypeId && (
                <div>
                  <label style={labelStyle(t)}>작업 종류 <span style={{ color: ACCENT }}>*</span></label>
                  <select value={workTypeId} onChange={(e) => setWorkTypeId(e.target.value)} style={inputStyle(t)}>
                    <option value="">선택...</option>
                    {filteredWorkTypes.map(w => (
                      <option key={w.id} value={w.id}>{w.name}{w.default_unit_price > 0 ? ` (기본 ${fmtKRW(w.default_unit_price)})` : ""}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 기종 (옵션) */}
              <div>
                <label style={labelStyle(t)}>기종 (옵션)</label>
                <select value={applianceTypeId} onChange={(e) => setApplianceTypeId(e.target.value)} style={inputStyle(t)}>
                  <option value="">(없음 — 정책이 NULL 기종이면)</option>
                  {(pickerOpts?.applianceTypes || []).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* qty + unit_price */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 10 }}>
                <div>
                  <label style={labelStyle(t)}>수량 <span style={{ color: ACCENT }}>*</span></label>
                  <input type="number" inputMode="numeric" min="1" step="1" value={qty}
                    onChange={(e) => setQty(e.target.value)} style={inputStyle(t)}/>
                </div>
                <div>
                  <label style={labelStyle(t)}>단가 <span style={{ color: ACCENT }}>*</span></label>
                  <input type="number" inputMode="numeric" min="0" step="1000" value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)} style={inputStyle(t)}/>
                </div>
              </div>

              {/* order_type */}
              <div>
                <label style={labelStyle(t)}>구분</label>
                <select value={orderType} onChange={(e) => setOrderType(e.target.value)} style={inputStyle(t)}>
                  <option value="추가선택">추가선택</option>
                  <option value="본작업">본작업</option>
                  <option value="첫대">첫대 (KA 1way)</option>
                  <option value="추가">추가 (KA 1way)</option>
                </select>
              </div>

              {/* 소계 미리보기 */}
              <div style={{
                padding: "10px 12px",
                background: qtyN > 0 && upN >= 0 ? "rgba(255,27,141,0.08)" : (t?.bgInset || "rgba(255,255,255,0.03)"),
                border: `1px solid ${qtyN > 0 && upN >= 0 ? ACCENT : (t?.border || "var(--border)")}`,
                borderRadius: 8,
                fontSize: 13, fontWeight: 700,
                color: qtyN > 0 && upN >= 0 ? ACCENT : (t?.textSecondary || "var(--text-secondary)"),
                textAlign: "right",
              }}>
                새 항목 소계: {fmtKRW(newSubtotal)}
              </div>

              {/* 사유 */}
              <div>
                <label style={labelStyle(t)}>변경 사유 <span style={{ color: ACCENT }}>* (5자 이상)</span></label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500}
                  placeholder="예: 고객 요청으로 추가선택 항목 추가"
                  style={{ ...inputStyle(t), resize: "vertical", minHeight: 70, lineHeight: 1.5 }}/>
                <div style={{ fontSize: 10, color: t?.textMuted || "var(--text-tertiary, var(--text-secondary))", textAlign: "right", marginTop: 4 }}>
                  {note.length} / 500
                </div>
              </div>

              {error && <ErrorBox text={error}/>}
            </>
          )}
        </div>
        <ModalFooter t={t}
          submitting={submitting}
          submitLabel={submitting ? "추가 중..." : "추가 적용 (정책 검증)"}
          disabled={!workTypeId || qtyN <= 0 || upN < 0 || note.trim().length < 5 || submitting || pickerLoading}
          onCancel={() => !submitting && onClose()}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 공용 보조 컴포넌트
// ============================================================================
function ModalHeader({ t, title, subtitle, onClose }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "16px 20px",
      borderBottom: `1px solid ${t?.border || "var(--border)"}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: t?.text || "var(--text-primary)" }}>{title}</div>
        {subtitle && (
          <div style={{
            fontSize: 11, color: t?.textSecondary || "var(--text-secondary)",
            fontWeight: 600, marginTop: 3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{subtitle}</div>
        )}
      </div>
      <button type="button" onClick={onClose} aria-label="닫기" style={{
        background: "transparent", border: "none", padding: 6,
        cursor: "pointer", color: t?.text || "var(--text-primary)",
        display: "flex", alignItems: "center", flexShrink: 0,
      }}><X size={20}/></button>
    </div>
  );
}

function ModalFooter({ t, submitting, submitLabel, disabled, onCancel, onSubmit }) {
  return (
    <div style={{
      display: "flex", gap: 8,
      padding: "12px 20px",
      borderTop: `1px solid ${t?.border || "var(--border)"}`,
    }}>
      <button type="button" onClick={onCancel} disabled={submitting} style={{
        flex: 1, padding: "12px 0",
        background: t?.bgSecondary || t?.bgElevated || "var(--bg-secondary)",
        border: `1px solid ${t?.border || "var(--border)"}`,
        borderRadius: 10,
        color: t?.textSecondary || "var(--text-secondary)",
        fontSize: 13, fontWeight: 700,
        cursor: submitting ? "default" : "pointer", fontFamily: "inherit",
      }}>취소</button>
      <button type="button" onClick={onSubmit} disabled={disabled} style={{
        flex: 2, padding: "12px 0",
        background: disabled ? (t?.border || "var(--border)") : ACCENT,
        border: "none", borderRadius: 10,
        color: "#fff",
        fontSize: 14, fontWeight: 800,
        cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
      }}>{submitLabel}</button>
    </div>
  );
}

function ErrorBox({ text }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: "rgba(255,27,141,0.1)",
      border: `1px solid ${ACCENT}`,
      borderRadius: 8,
      color: ACCENT,
      fontSize: 12, fontWeight: 700,
      whiteSpace: "pre-wrap",
    }}>⚠️ {text}</div>
  );
}

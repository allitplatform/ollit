// 2026-06-28 — 작업 견적 수정 (qty/단가) + 추가 (정책 검증) 모달 2종.
//   Mig 153 RPC 연결.
//   가드: 미정산 + 트랙 B 차단 + 사유 5자+ + 정책 매칭 (추가) — 서버단 진실.
//   클라는 1차 검증 + confirm + 적용 후 reload 콜백.

import { useState, useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";
import {
  adminUpdateTaskItem,
  adminInsertTaskItem,
  fetchPickerOptions,
  adminChangeTaskItemType,
  adminRemoveTaskItem,
  previewTaskItemTypeChange,
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

  // 2026-08-03 — window.confirm 제거 (사장님 실사용에서 확인창이 차단돼
  //   버튼이 조용히 죽는 사고: A-260802-082 종목 변경 무반응).
  //   브라우저 확인창 대신 2단계 버튼: 첫 클릭 = 경고 표시(armed), 둘째 클릭 = 실행.
  //   armed 값: "" | "apply" | "remove". 입력이 바뀌면 자동 해제.
  const [armed, setArmed] = useState("");

  // ──────────────────────────────────────────────────────────────
  // 2026-07-30 — Mig 201: 종목 변경 / 오입력 삭제.
  //   기본은 접혀 있다 (평소엔 수량·단가만 고치므로).
  //   ⚠️ 종목이 바뀌면 분배율이 통째로 바뀐다 → 저장 전에 기사 몫 미리보기.
  // ──────────────────────────────────────────────────────────────
  const [typeMode,        setTypeMode]        = useState(false);
  const [pickerLoading,   setPickerLoading]   = useState(false);
  const [pickerError,     setPickerError]     = useState("");
  const [pickerOpts,      setPickerOpts]      = useState(null);
  const [serviceTypeId,   setServiceTypeId]   = useState("");
  const [workTypeId,      setWorkTypeId]      = useState("");
  const [applianceTypeId, setApplianceTypeId] = useState("");
  const [preview,         setPreview]         = useState(null);
  const [previewLoading,  setPreviewLoading]  = useState(false);
  const [removing,        setRemoving]        = useState(false);

  // 완료·취소 건은 서버가 거부한다 (Mig 201 가드). 버튼을 미리 잠가 헛수고를 막는다.
  //   task.status 는 DB 원본값 ('진행중' / 'visit_only' 등).
  const EDITABLE_STATUSES = ["미배정", "약속대기", "배정", "취소요청", "확정", "진행중"];
  const statusOk = EDITABLE_STATUSES.includes(task?.status || "");

  useEffect(() => {
    function handler(e) { if (e.key === "Escape" && !submitting) onClose?.(); }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, submitting]);

  // 종목 변경 모드를 켤 때만 옵션 fetch (평소 수정에는 불필요한 네트워크 X)
  //   ⚠️ 2026-07-30 버그 수정 — pickerLoading 을 deps 에 넣었더니
  //      setPickerLoading(true) 가 effect 를 재실행시키고, 그 cleanup 이
  //      alive=false 로 만들어 fetch 결과를 통째로 버렸다
  //      → "옵션 불러오는 중..." 에서 영원히 멈춤.
  //      중복 요청 방지는 state 가 아니라 ref 로 해야 한다 (리렌더를 안 일으킴).
  const pickerReqRef = useRef(false);
  useEffect(() => {
    if (!typeMode || pickerOpts || pickerReqRef.current) return;
    pickerReqRef.current = true;
    setPickerLoading(true); setPickerError("");
    fetchPickerOptions().then(res => {
      if (!res.ok) {
        setPickerError(res.error || "옵션 불러오기 실패");
        setPickerOpts(null);
        pickerReqRef.current = false;   // 실패 시 재시도 가능하게
      } else {
        setPickerOpts(res);
      }
    }).catch(e => {
      setPickerError(e?.message || "옵션 불러오기 실패");
      pickerReqRef.current = false;
    }).finally(() => setPickerLoading(false));
  }, [typeMode, pickerOpts]);

  const filteredWorkTypes = useMemo(() => {
    if (!pickerOpts || !serviceTypeId) return [];
    return pickerOpts.workTypes.filter(w => w.service_type_id === serviceTypeId);
  }, [pickerOpts, serviceTypeId]);

  // 서비스 바꾸면 작업 종류 초기화
  useEffect(() => { setWorkTypeId(""); }, [serviceTypeId]);

  // 작업 종류 고르면 기본 단가 자동 채움 (기존 단가는 옛 종목 기준이라 의미 없음)
  useEffect(() => {
    if (!workTypeId || !pickerOpts) return;
    const wt = pickerOpts.workTypes.find(w => w.id === workTypeId);
    if (wt && Number(wt.default_unit_price) > 0) setUnitPrice(String(wt.default_unit_price));
  }, [workTypeId, pickerOpts]);

  const qtyN  = Number(qty)       || 0;
  const upN   = Number(unitPrice) || 0;
  const newSubtotal = qtyN * upN;
  const oldQty      = Number(item?.qty || 0);
  const oldUp       = Number(item?.unitPrice ?? item?.unit_price ?? 0);
  const oldSubtotal = oldQty * oldUp;
  const diff        = newSubtotal - oldSubtotal;
  const typeChanged = typeMode && !!workTypeId;
  const changed     = qtyN !== oldQty || upN !== oldUp || typeChanged;

  // 기종미정 접수 건은 workType/appliance 가 비어 있다 → "·" 만 덩그러니 보이지 않게.
  const curLabel = [item?.workType, item?.appliance].filter(Boolean).join(" · ")
                   || "(종목·기종 미지정)";

  // 기사 몫 미리보기 — 종목/수량/단가가 바뀔 때마다 서버에 물어본다 (읽기 전용).
  useEffect(() => {
    if (!typeChanged || !actorId || !item?.id) { setPreview(null); return; }
    let alive = true;
    setPreviewLoading(true);
    const timer = setTimeout(() => {
      previewTaskItemTypeChange({
        actorId, itemId: item.id,
        workTypeId, applianceTypeId: applianceTypeId || null,
        qty: qtyN > 0 ? qtyN : null,
        unitPrice: upN >= 0 ? upN : null,
      }).then(res => {
        if (!alive) return;
        setPreview(res.ok ? res : null);
      }).finally(() => { if (alive) setPreviewLoading(false); });
    }, 350);
    return () => { alive = false; clearTimeout(timer); };
  }, [typeChanged, actorId, item?.id, workTypeId, applianceTypeId, qtyN, upN]);

  const selectedWorkTypeName = useMemo(() => {
    if (!pickerOpts || !workTypeId) return "";
    return pickerOpts.workTypes.find(w => w.id === workTypeId)?.name || "";
  }, [pickerOpts, workTypeId]);

  // 입력이 바뀌면 "정말 적용" 대기 상태 해제 (다른 값으로 바뀐 걸 그대로 실행하면 안 됨)
  useEffect(() => { setArmed(""); }, [qty, unitPrice, note, workTypeId, applianceTypeId, typeMode]);

  async function handleSubmit() {
    if (!changed)               { setError("변경 없음"); return; }
    if (qtyN <= 0)              { setError("qty > 0 필수"); return; }
    if (upN < 0)                { setError("단가 0 이상"); return; }
    if (note.trim().length < 5) { setError("변경 사유 5자 이상 필수"); return; }
    if (!actorId)               { setError("로그인 운영자 확인 실패"); return; }

    // ── 종목 변경 경로 (Mig 201 RPC) ──
    if (typeChanged) {
      if (!statusOk) { setError(`완료·취소된 작업은 종목을 바꿀 수 없습니다 (현재: ${task?.status || "?"})`); return; }
      // 첫 클릭: 경고만 켜고 대기 (브라우저 확인창 안 씀 — 차단 환경에서 무반응 사고 방지)
      if (armed !== "apply") { setArmed("apply"); setError(""); return; }
      setArmed("");

      setSubmitting(true); setError("");
      const res = await adminChangeTaskItemType({
        actorId, itemId: item.id,
        workTypeId,
        applianceTypeId: applianceTypeId || null,
        qty: qtyN, unitPrice: upN,
        note: note.trim(),
      });
      setSubmitting(false);
      if (!res.ok) {
        if (res.error === "policy_not_found") {
          setError(`정책 없음 — ${res.detail || "이 조합 (원청/서비스/기종) 의 정산 정책이 등록 안 됨"}. 정책 추가 후 다시 시도.`);
        } else {
          setError(res.error || "종목 변경 실패");
        }
        return;
      }
      onApplied?.();
      return;
    }

    // ── 수량·단가만 (기존 경로 그대로) ──
    if (armed !== "apply") { setArmed("apply"); setError(""); return; }
    setArmed("");

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

  // 오입력 삭제 — ◐ 부분 취소와 다르다. 진짜 지운다.
  async function handleRemove() {
    if (note.trim().length < 5) { setError("삭제 사유 5자 이상 필수 (아래 사유 칸에 적어주세요)"); return; }
    if (!actorId)               { setError("로그인 운영자 확인 실패"); return; }
    if (!statusOk)              { setError(`완료·취소된 작업은 항목을 지울 수 없습니다 (현재: ${task?.status || "?"})`); return; }

    if (armed !== "remove") { setArmed("remove"); setError(""); return; }
    setArmed("");

    setRemoving(true); setError("");
    const res = await adminRemoveTaskItem({ actorId, itemId: item.id, note: note.trim() });
    setRemoving(false);
    if (!res.ok) { setError(res.error || "삭제 실패"); return; }
    onApplied?.();
  }

  const busy = submitting || removing;

  return (
    <div onClick={() => !busy && onClose()} style={modalOverlay}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={modalCard(t)}>
        <ModalHeader t={t} title="✏️ 견적 수정" subtitle={`${task?.taskNo || task?.task_no || ""} · ${task?.customer || ""}`} onClose={() => !busy && onClose()}/>
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
              {curLabel} (현재 {oldQty}개 × {fmtKRW(oldUp)})
            </div>
            <div>소계 {fmtKRW(oldSubtotal)}</div>
          </div>

          {/* ── 2026-07-30 종목 변경 (접힘 기본) ── */}
          {!typeMode ? (
            <button type="button"
              onClick={() => { if (statusOk) setTypeMode(true); }}
              disabled={!statusOk}
              title={statusOk ? "종목(작업 종류) 자체를 바꿉니다" : `완료·취소된 작업은 종목을 바꿀 수 없습니다 (현재: ${task?.status || "?"})`}
              style={{
                padding: "9px 12px",
                background: "transparent",
                border: `1px dashed ${statusOk ? (t?.border || "var(--border)") : "transparent"}`,
                borderRadius: 8,
                color: statusOk ? (t?.textSecondary || "var(--text-secondary)") : (t?.textMuted || "var(--text-tertiary, var(--text-secondary))"),
                fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                cursor: statusOk ? "pointer" : "not-allowed",
                opacity: statusOk ? 1 : 0.5,
                textAlign: "left",
              }}>
              🔧 종목이 잘못 들어갔나요? — 종목 바꾸기
              {!statusOk && <span style={{ fontWeight: 600 }}> (완료·취소 건은 불가)</span>}
            </button>
          ) : (
            <div style={{
              padding: "12px",
              background: "rgba(255,27,141,0.05)",
              border: `1px solid ${ACCENT}`,
              borderRadius: 10,
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 800, color: ACCENT }}>🔧 종목 변경</div>
                <button type="button" onClick={() => { setTypeMode(false); setServiceTypeId(""); setWorkTypeId(""); setApplianceTypeId(""); setPreview(null); }}
                  disabled={busy}
                  style={{
                    background: "transparent", border: "none", padding: 0,
                    color: t?.textSecondary || "var(--text-secondary)",
                    fontSize: 11, fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: "inherit",
                  }}>취소</button>
              </div>

              {pickerLoading ? (
                <div style={{ padding: 12, textAlign: "center", fontSize: 12, color: t?.textSecondary || "var(--text-secondary)" }}>
                  옵션 불러오는 중...
                </div>
              ) : pickerError ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <ErrorBox text={pickerError}/>
                  <button type="button"
                    onClick={() => { pickerReqRef.current = false; setPickerError(""); setPickerOpts(null); }}
                    style={{
                      padding: "8px 10px", background: "transparent",
                      border: `1px solid ${ACCENT}`, borderRadius: 8,
                      color: ACCENT, fontSize: 12, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>🔄 다시 시도</button>
                </div>
              ) : (
                <>
                  <div>
                    <label style={labelStyle(t)}>새 서비스 종류 <span style={{ color: ACCENT }}>*</span></label>
                    <select value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} style={inputStyle(t)}>
                      <option value="">선택...</option>
                      {(pickerOpts?.serviceTypes || []).map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>

                  {serviceTypeId && (
                    <div>
                      <label style={labelStyle(t)}>새 작업 종류 <span style={{ color: ACCENT }}>*</span></label>
                      <select value={workTypeId} onChange={(e) => setWorkTypeId(e.target.value)} style={inputStyle(t)}>
                        <option value="">선택...</option>
                        {filteredWorkTypes.map(w => (
                          <option key={w.id} value={w.id}>{w.name}{w.default_unit_price > 0 ? ` (기본 ${fmtKRW(w.default_unit_price)})` : ""}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={labelStyle(t)}>기종 (옵션)</label>
                    <select value={applianceTypeId} onChange={(e) => setApplianceTypeId(e.target.value)} style={inputStyle(t)}>
                      <option value="">(없음 — 정책이 NULL 기종이면)</option>
                      {(pickerOpts?.applianceTypes || []).map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 기사 몫 미리보기 — 조용히 분배가 바뀌는 걸 막는 핵심 장치 */}
                  {typeChanged && (
                    <div style={{
                      padding: "10px 12px",
                      background: t?.bgInset || "rgba(255,255,255,0.04)",
                      border: `1px solid ${t?.border || "var(--border)"}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}>
                      {previewLoading ? (
                        <span style={{ color: t?.textSecondary || "var(--text-secondary)" }}>기사 몫 계산 중...</span>
                      ) : !preview ? (
                        <span style={{ color: t?.textSecondary || "var(--text-secondary)" }}>미리보기를 불러오지 못했습니다 (저장은 가능 — 서버가 정책을 다시 검증합니다)</span>
                      ) : !preview.new?.ok ? (
                        <span style={{ color: ACCENT, fontWeight: 700 }}>
                          ⚠️ 이 조합은 정산 정책이 없습니다 — 저장하면 거부됩니다
                        </span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontWeight: 800, color: t?.text || "var(--text-primary)" }}>
                            기사 몫 {fmtKRW(preview.old?.engineer)} → <span style={{ color: ACCENT }}>{fmtKRW(preview.new?.engineer)}</span>
                          </div>
                          <div style={{ color: t?.textSecondary || "var(--text-secondary)" }}>
                            회사 몫 {fmtKRW(preview.old?.company)} → {fmtKRW(preview.new?.company)}
                          </div>
                          <div style={{ fontSize: 10, color: t?.textMuted || "var(--text-tertiary, var(--text-secondary))" }}>
                            {preview.old?.service || "?"} → {preview.new?.service || "?"} · 이 항목만 기준 (자재비·출장비 제외 개략치)
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

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
              placeholder="예: 고객 요청으로 수량 정정 / 접수 때 종목 잘못 넣음"
              style={{ ...inputStyle(t), resize: "vertical", minHeight: 70, lineHeight: 1.5 }}/>
            <div style={{ fontSize: 10, color: t?.textMuted || "var(--text-tertiary, var(--text-secondary))", textAlign: "right", marginTop: 4 }}>
              {note.length} / 500
            </div>
          </div>

          {error && <ErrorBox text={error}/>}

          {/* 2026-08-03 — 2단계 확인 (브라우저 확인창 대체) */}
          {armed === "apply" && (
            <div style={{
              padding: "12px 14px",
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.45)",
              borderRadius: 9,
              fontSize: 12, lineHeight: 1.7,
              color: t?.text || "var(--text-primary)",
            }}>
              <b style={{ color: "#B45309" }}>⚠️ 한 번 더 누르면 바로 적용됩니다.</b><br/>
              {typeChanged && <>종목: <b>{selectedWorkTypeName || "선택한 종목"}</b> 으로 변경<br/></>}
              소계 {fmtKRW(oldSubtotal)} → <b>{fmtKRW(newSubtotal)}</b>
              {typeChanged && preview?.old && preview?.new && (
                <> · 기사 몫 {fmtKRW(preview.old.engineer)} → <b>{fmtKRW(preview.new.engineer)}</b></>
              )}
              {typeChanged && <><br/>종목이 바뀌면 분배율이 통째로 바뀝니다.</>}
            </div>
          )}
          {armed === "remove" && (
            <div style={{
              padding: "12px 14px",
              background: "rgba(220,38,38,0.10)",
              border: "1px solid rgba(220,38,38,0.45)",
              borderRadius: 9,
              fontSize: 12, lineHeight: 1.7,
              color: t?.text || "var(--text-primary)",
            }}>
              <b style={{ color: "#DC2626" }}>⚠️ 한 번 더 누르면 완전히 지워집니다 — 되돌리기 없음.</b><br/>
              {item?.workType || ""} · {item?.appliance || ""} ({oldQty}개 × {fmtKRW(oldUp)}) = 소계 {fmtKRW(oldSubtotal)}<br/>
              고객이 이 작업만 안 하기로 한 거라면 삭제가 아니라 ◐ 부분 취소입니다.
            </div>
          )}

          {/* ── 2026-07-30 오입력 삭제 ── */}
          <div style={{ borderTop: `1px dashed ${t?.border || "var(--border)"}`, paddingTop: 10 }}>
            <button type="button"
              onClick={handleRemove}
              disabled={busy || !statusOk || note.trim().length < 5}
              title={!statusOk ? `완료·취소된 작업은 항목을 지울 수 없습니다 (현재: ${task?.status || "?"})` : "잘못 넣은 항목을 완전히 지웁니다"}
              style={{
                width: "100%", padding: "10px 12px",
                background: "transparent",
                border: `1px solid ${(busy || !statusOk || note.trim().length < 5) ? (t?.border || "var(--border)") : "rgba(220,38,38,0.55)"}`,
                borderRadius: 8,
                color: (busy || !statusOk || note.trim().length < 5) ? (t?.textMuted || "var(--text-tertiary, var(--text-secondary))") : "#DC2626",
                fontSize: 12, fontWeight: 800, fontFamily: "inherit",
                cursor: (busy || !statusOk || note.trim().length < 5) ? "not-allowed" : "pointer",
              }}>
              {removing ? "삭제 중..." : armed === "remove" ? "🗑 정말 삭제 — 한 번 더 누르세요" : "🗑 이 항목 삭제 (잘못 넣은 항목)"}
            </button>
            <div style={{ fontSize: 10, lineHeight: 1.6, marginTop: 6, color: t?.textMuted || "var(--text-tertiary, var(--text-secondary))" }}>
              고객이 이 작업만 안 하기로 한 경우는 삭제가 아니라 <b>◐ 부분 취소</b> 입니다.<br/>
              삭제는 <b>처음부터 잘못 넣은 줄</b> 을 정리할 때만 — 되돌릴 수 없고 변경 이력에만 남습니다.
              {note.trim().length < 5 && <><br/>위 사유를 5자 이상 적어야 삭제 버튼이 열립니다.</>}
            </div>
          </div>
        </div>
        <ModalFooter t={t}
          submitting={busy}
          submitLabel={
            submitting ? "적용 중..."
            : armed === "apply" ? "⚠️ 정말 적용 — 한 번 더 누르세요"
            : (typeChanged ? "종목 변경 적용 (자동 재계산)" : "수정 적용 (자동 재계산)")
          }
          disabled={!changed || busy || note.trim().length < 5 || (typeMode && !workTypeId)}
          onCancel={() => !busy && onClose()}
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
  // 2026-08-03 — 2단계 확인 (window.confirm 차단 환경 대응)
  const [armed,           setArmed]           = useState(false);

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

  // 입력 바뀌면 "정말 추가" 대기 해제
  useEffect(() => { setArmed(false); }, [qty, unitPrice, note, workTypeId, applianceTypeId, orderType]);

  async function handleSubmit() {
    if (!workTypeId)            { setError("작업 종류 선택"); return; }
    if (qtyN <= 0)              { setError("qty > 0 필수"); return; }
    if (upN < 0)                { setError("단가 0 이상"); return; }
    if (note.trim().length < 5) { setError("변경 사유 5자 이상 필수"); return; }
    if (!actorId)               { setError("로그인 운영자 확인 실패"); return; }

    // 2026-08-03 — window.confirm 대신 2단계 버튼 (확인창 차단 환경 무반응 사고 방지)
    if (!armed) { setArmed(true); setError(""); return; }
    setArmed(false);

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

              {/* 2026-08-03 — 2단계 확인 (브라우저 확인창 대체) */}
              {armed && (
                <div style={{
                  padding: "12px 14px",
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.45)",
                  borderRadius: 9,
                  fontSize: 12, lineHeight: 1.7,
                  color: t?.text || "var(--text-primary)",
                }}>
                  <b style={{ color: "#B45309" }}>⚠️ 한 번 더 누르면 추가됩니다.</b><br/>
                  새 항목 소계 <b>{fmtKRW(newSubtotal)}</b> · 정산 자동 재계산 (정책 없는 조합은 거부됨)
                </div>
              )}
            </>
          )}
        </div>
        <ModalFooter t={t}
          submitting={submitting}
          submitLabel={submitting ? "추가 중..." : armed ? "⚠️ 정말 추가 — 한 번 더 누르세요" : "추가 적용 (정책 검증)"}
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

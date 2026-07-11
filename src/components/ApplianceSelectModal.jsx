// 2026-07-11 — 홈페이지 접수 (기종·수량 미정) 나중 선택 팝업.
//   사장님 spec (확정):
//     · 종목은 이미 1차 해피콜에서 확정 → 팝업에서 종목 선택 없음.
//     · 그 작업 종목에 해당하는 기종 목록만 표시:
//        · 세척     → 벽걸이/1way/스탠드/4way/원형/투인원/시스템멀티
//        · 냉매충전 → 벽걸이/스탠드/4way/투인원/1way
//     · 수량 기본 1 (버튼으로 ±).
//     · 견적: lookupRate (기존 로직 재사용, 새 가격 로직 X).
//     · 저장: category_data.workItems 갱신 → Mig 017 트리거 → task_items 재생성 →
//              compute_payment 자동 재계산. 정상 경로만.
//
// Props:
//   task           — 대상 task (workType 판별용).
//   principalCode  — 원청 코드 ("allday" / "KA" ...). quote_rates lookup 용.
//   onClose        — 팝업 닫기.
//   onSaved()      — 저장 성공 후 부모 재로드 트리거 (선택).

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { updateTaskDb } from "../data/tasksDb.js";
import { lookupRate, WORK_TYPE_TO_SERVICE } from "./principal/NewReceptionScreenLite.jsx";

// 종목별 기종 목록 (사장님 spec).
const APPLIANCES_BY_WORKTYPE = {
  "세척":     ["벽걸이", "1way", "스탠드", "4way", "원형", "투인원", "시스템멀티"],
  "냉매충전": ["벽걸이", "스탠드", "4way", "투인원", "1way"],
};

function _pickWorkType(task) {
  if (!task) return "";
  const wi = Array.isArray(task.workItems) && task.workItems.length > 0 ? task.workItems[0] : null;
  const wt = (wi && wi.workType) || task.workType || "";
  return String(wt || "").trim();
}
function _pickPrincipalCode(task, override) {
  if (override) return override;
  return String(task?.principalCode || task?.principal_code || "").trim();
}
function _pickPrincipalId(task) {
  return task?.principalId || task?.principal_id || null;
}

// 견적 조회 — supabase principals.quote_rates.
//   principalId 우선. 없으면 principalCode 로 조회.
async function _fetchQuoteRates(principalId, principalCode) {
  if (!principalId && !principalCode) return null;
  let q = supabase.from("principals").select("quote_rates").limit(1);
  q = principalId ? q.eq("id", principalId) : q.eq("code", principalCode);
  const { data, error } = await q.maybeSingle();
  if (error) {
    console.warn("[ApplianceSelectModal] quote_rates fetch fail", error);
    return null;
  }
  return data?.quote_rates || null;
}

function _fmtKrw(n) {
  return `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
}

export function ApplianceSelectModal({ task, principalCode: pcOverride, onClose, onSaved }) {
  const workType = _pickWorkType(task);
  const principalCode = _pickPrincipalCode(task, pcOverride);
  const principalId   = _pickPrincipalId(task);
  const appliances = APPLIANCES_BY_WORKTYPE[workType] || null;

  const [appliance, setAppliance] = useState("");
  const [qty, setQty]             = useState(1);
  const [quoteRates, setQuoteRates] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setRatesLoading(true);
    _fetchQuoteRates(principalId, principalCode).then(qr => {
      if (!alive) return;
      setQuoteRates(qr);
      setRatesLoading(false);
    });
    return () => { alive = false; };
  }, [principalId, principalCode]);

  const rateResult = useMemo(() => {
    if (!appliance || !workType) return { unitPrice: 0, isKa1waySplit: false };
    return lookupRate({ principalCode, quoteRates, workType, appliance, qty });
  }, [principalCode, quoteRates, workType, appliance, qty]);

  const unitPrice = Number(rateResult.unitPrice) || 0;
  const totalPrice = useMemo(() => {
    if (!appliance) return 0;
    // KA 1way 첫대/추가 자동 분할 반영 (사장님 spec: 새 로직 X, lookupRate 그대로).
    if (rateResult.isKa1waySplit) {
      const first = Number(rateResult.firstPrice) || 0;
      const extra = Number(rateResult.extraPrice) || 0;
      const q = Math.max(1, Number(qty) || 1);
      return first + (q - 1) * extra;
    }
    return unitPrice * Math.max(1, Number(qty) || 1);
  }, [appliance, unitPrice, qty, rateResult]);

  const canSave = !!appliance && !ratesLoading && !saving && !!task?.id;
  const noSupport = !appliances; // 알려지지 않은 workType
  const noQuote = !ratesLoading && !quoteRates;
  const priceZero = !!appliance && unitPrice === 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setErr("");
    try {
      const finalQty = Math.max(1, Number(qty) || 1);
      // 새 workItem — 정상 스키마 유지.
      //   quote 필드에 unitPrice 저장 (fallback / 표시용). task_items 는 트리거가 재생성.
      const newWorkItem = {
        workType,
        appliance,
        qty: finalQty,
        quote: unitPrice,
        orderType: "본작업",
        serviceCode: WORK_TYPE_TO_SERVICE[workType] || null,
      };
      const prevCategory = task.categoryData || {};
      // 2026-07-11 — applianceUndecided 플래그 명시 해제 (사장님 spec: 기종 채워지면 해제).
      const nextCategory = { ...prevCategory, workItems: [newWorkItem], applianceUndecided: false };

      console.log("[ApplianceSelect] BEFORE update", {
        taskId: task.id,
        prevProductPrice: task.productPrice,
        prevWorkItems: prevCategory.workItems,
        newWorkItem,
        newProductPrice: totalPrice,
      });

      const res = await updateTaskDb(task.id, {
        categoryData: nextCategory,
        productPrice: totalPrice,
      });
      if (!res.ok) {
        setErr(res.error || "저장 실패");
        setSaving(false);
        return;
      }

      console.log("[ApplianceSelect] AFTER update — Mig 017 트리거가 task_items 재생성. compute_payment 자동 재계산.");
      if (onSaved) onSaved(res.data);
      onClose && onClose();
    } catch (e) {
      setErr(String(e?.message || e));
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16,
      }}>
      <div style={{
        background: "#fff", borderRadius: 14,
        width: "100%", maxWidth: 460,
        padding: "18px 20px 16px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#1C2B3A", letterSpacing: "-0.4px" }}>
            기종 선택 <span style={{ fontSize: 12, color: "#93A2B4", fontWeight: 700 }}>({workType || "종목 미정"})</span>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "#93A2B4", padding: 2, display: "inline-flex",
          }}>
            <X size={18}/>
          </button>
        </div>

        <div style={{ fontSize: 12, color: "#6A7D94", fontWeight: 700 }}>
          {task?.customer || task?.customerName || "고객 미상"}
          {task?.address ? <> · <span style={{ color: "#93A2B4" }}>{task.address}</span></> : null}
        </div>

        {noSupport ? (
          <div style={{
            padding: "12px 14px", borderRadius: 10,
            background: "#FEECEC", border: "1px solid #F5B5B5",
            color: "#C33", fontSize: 13, fontWeight: 700,
          }}>
            이 종목({workType || "미정"})은 팝업에서 기종 선택을 지원하지 않습니다.
            해피콜에서 종목을 확정한 후 다시 시도하세요.
          </div>
        ) : (
          <>
            {/* 기종 선택 */}
            <div>
              <div style={{
                fontSize: 11, color: "#93A2B4", fontWeight: 800,
                marginBottom: 6, letterSpacing: 0.3, textTransform: "uppercase",
              }}>기종</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {appliances.map(a => {
                  const on = appliance === a;
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAppliance(a)}
                      style={{
                        padding: "8px 14px",
                        background: on ? "#2563EB" : "#F4F6FA",
                        border: `1px solid ${on ? "#2563EB" : "#E5EAF1"}`,
                        borderRadius: 999,
                        color: on ? "#fff" : "#4A5A70",
                        fontSize: 13, fontWeight: 800,
                        cursor: "pointer", fontFamily: "inherit",
                      }}>{a}</button>
                  );
                })}
              </div>
            </div>

            {/* 수량 */}
            <div>
              <div style={{
                fontSize: 11, color: "#93A2B4", fontWeight: 800,
                marginBottom: 6, letterSpacing: 0.3, textTransform: "uppercase",
              }}>수량</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setQty(q => Math.max(1, (Number(q) || 1) - 1))}
                  disabled={qty <= 1}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "#F4F6FA", border: "1px solid #E5EAF1",
                    color: "#4A5A70", fontSize: 18, fontWeight: 800,
                    cursor: qty <= 1 ? "not-allowed" : "pointer",
                    opacity: qty <= 1 ? 0.5 : 1,
                    fontFamily: "inherit",
                  }}>−</button>
                <input
                  type="number"
                  min={1} max={99}
                  value={qty}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setQty(Number.isFinite(v) && v > 0 ? Math.min(99, v) : 1);
                  }}
                  style={{
                    width: 68, textAlign: "center",
                    padding: "6px 8px",
                    background: "#fff",
                    border: "1px solid #E5EAF1", borderRadius: 8,
                    fontSize: 15, fontWeight: 800, color: "#1C2B3A",
                    fontFamily: "inherit", outline: "none",
                    fontVariantNumeric: "tabular-nums",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setQty(q => Math.min(99, (Number(q) || 1) + 1))}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "#F4F6FA", border: "1px solid #E5EAF1",
                    color: "#4A5A70", fontSize: 18, fontWeight: 800,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>+</button>
                <span style={{ fontSize: 13, color: "#93A2B4", fontWeight: 700, marginLeft: 4 }}>대</span>
              </div>
            </div>

            {/* 견적 */}
            <div style={{
              padding: "12px 14px",
              background: "#F4F8FD", border: "1px solid #E5EAF1",
              borderRadius: 10,
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ fontSize: 11, color: "#6A7D94", fontWeight: 700 }}>
                견적 (자동 계산 · 원청 단가표)
              </div>
              {ratesLoading ? (
                <div style={{ fontSize: 13, color: "#93A2B4", fontWeight: 700 }}>단가 조회 중…</div>
              ) : noQuote ? (
                <div style={{ fontSize: 12, color: "#C33", fontWeight: 700 }}>
                  ⚠️ 이 원청은 단가표(quote_rates) 미설정 → 저장 불가.
                </div>
              ) : !appliance ? (
                <div style={{ fontSize: 13, color: "#93A2B4", fontWeight: 700 }}>기종을 먼저 선택하세요.</div>
              ) : priceZero ? (
                <div style={{ fontSize: 12, color: "#C33", fontWeight: 700 }}>
                  ⚠️ 이 기종({appliance})의 단가가 0 → 저장 불가. 원청 단가표 확인 필요.
                </div>
              ) : (
                <>
                  <div className="mono" style={{
                    fontSize: 22, fontWeight: 900, color: "#1C2B3A",
                    letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums",
                  }}>{_fmtKrw(totalPrice)}</div>
                  <div style={{ fontSize: 11, color: "#93A2B4", fontWeight: 700 }}>
                    {rateResult.isKa1waySplit
                      ? `KA 1way 첫대 ${_fmtKrw(rateResult.firstPrice)} + 추가 ${_fmtKrw(rateResult.extraPrice)} × ${qty - 1}`
                      : `단가 ${_fmtKrw(unitPrice)} × ${qty}`}
                  </div>
                </>
              )}
            </div>

            {err && (
              <div style={{
                padding: "9px 12px", borderRadius: 8,
                background: "#FEECEC", border: "1px solid #F5B5B5",
                color: "#C33", fontSize: 12, fontWeight: 700,
              }}>⚠️ {err}</div>
            )}
          </>
        )}

        {/* 액션 */}
        <div style={{
          display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4,
        }}>
          <button onClick={onClose} disabled={saving} style={{
            padding: "9px 16px",
            background: "#F4F6FA", border: "1px solid #E5EAF1",
            borderRadius: 8, color: "#4A5A70",
            fontSize: 13, fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
            opacity: saving ? 0.6 : 1,
          }}>취소</button>
          <button
            onClick={handleSave}
            disabled={!canSave || noSupport || noQuote || priceZero}
            style={{
              padding: "9px 18px",
              background: (!canSave || noSupport || noQuote || priceZero) ? "#B7C1CE" : "#2563EB",
              border: "none",
              borderRadius: 8, color: "#fff",
              fontSize: 13, fontWeight: 800,
              cursor: (!canSave || noSupport || noQuote || priceZero) ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              letterSpacing: "-0.2px",
            }}>{saving ? "저장 중…" : "저장 및 견적 반영"}</button>
        </div>
      </div>
    </div>
  );
}

// 헬퍼 — task 가 기종 선택 팝업 대상인지 판정.
//   우선순위:
//     1) task.applianceUndecided === true (플래그 명시)   ← 사장님 spec
//     2) workItems 안 첫 항목에 workType 있는데 appliance 비어있음
//     3) workItems 비어있는데 root 에 workType 있음 (홈페이지 접수 초기)
//     4) workItems 비어있고 memo 에 "[홈페이지 접수" 마커 (옛 저장 recover)
export function needsApplianceSelection(task) {
  if (!task) return false;
  if (task.applianceUndecided === true) return true;
  const wi = Array.isArray(task.workItems) ? task.workItems : [];
  if (wi.length === 0) {
    if (task.workType && String(task.workType).trim()) return true;
    // 홈페이지 접수 마커 검사 (memo/request/requestNote 어디에라도).
    const notes = [task.request, task.requestNote, task.memo, task.workMemo].filter(Boolean).join(" ");
    if (/\[홈페이지\s*접수/.test(notes)) return true;
    return false;
  }
  const first = wi[0] || {};
  return !!(first.workType && (!first.appliance || String(first.appliance).trim() === ""));
}

export default ApplianceSelectModal;

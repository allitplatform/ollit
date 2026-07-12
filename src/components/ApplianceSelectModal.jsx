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
// 2026-07-12 — 배지·배너 판정 통일 (사장님 spec).
//   detectServiceType.id === 'undecided' 이면 needsApplianceSelection 도 무조건 true.
import { detectServiceType } from "../data/serviceTypes.js";

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
  const initialWorkType = _pickWorkType(task);
  const principalCode = _pickPrincipalCode(task, pcOverride);
  const principalId   = _pickPrincipalId(task);

  // 2026-07-12 — 사장님 spec: 저장된 workType 이 placeholder('기타' 등) 이거나
  //   APPLIANCES_BY_WORKTYPE 미지원 종목이면 팝업 안에서 종목부터 재선택.
  //   '기타/기타' 로 잘못 저장된 옛 작업 recovery 경로.
  const initialWorkTypeUsable = !!APPLIANCES_BY_WORKTYPE[initialWorkType]
    && !_isPlaceholderAppliance(initialWorkType);
  const [workType, setWorkType] = useState(initialWorkTypeUsable ? initialWorkType : "");
  const appliances = APPLIANCES_BY_WORKTYPE[workType] || null;
  const needsWorkTypePick = !initialWorkTypeUsable;

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
  // 2026-07-11 — 사장님 spec: 단가 0/없음이면 '견적 미정' 흐름으로 저장 허용.
  //   올데이케어(직영) 등 현장 견적 방식 원청 지원. 기종은 저장 + 금액은 0.
  //   기존 관행: priceTBD 상태 = productPrice 0 저장 (별도 플래그 X, 현장에서 금액 입력).
  const isQuoteUndecided = noQuote || priceZero;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setErr("");
    try {
      const finalQty = Math.max(1, Number(qty) || 1);
      // 2026-07-11 — 견적 미정 흐름: 단가 0/없음이면 productPrice=0 저장 (기존 관행).
      //   기종은 저장 → 현장 견적. 정산은 나중에 기사가 금액 입력 시 자동 재계산.
      const finalUnit  = isQuoteUndecided ? 0 : unitPrice;
      const finalTotal = isQuoteUndecided ? 0 : totalPrice;
      const newWorkItem = {
        workType,
        appliance,
        qty: finalQty,
        quote: finalUnit,
        orderType: "본작업",
        serviceCode: WORK_TYPE_TO_SERVICE[workType] || null,
      };
      const prevCategory = task.categoryData || {};
      // 2026-07-11 — applianceUndecided 플래그 명시 해제 (기종 채워짐).
      //   quote 필드 (category_data.quote) 도 정합 갱신 (0 or unit).
      const nextCategory = {
        ...prevCategory,
        workItems: [newWorkItem],
        applianceUndecided: false,
        quote: finalUnit,
      };

      console.log("[ApplianceSelect] BEFORE update", {
        taskId: task.id,
        prevProductPrice: task.productPrice,
        prevWorkItems: prevCategory.workItems,
        newWorkItem,
        newProductPrice: finalTotal,
        isQuoteUndecided,
      });

      const res = await updateTaskDb(task.id, {
        categoryData: nextCategory,
        productPrice: finalTotal,
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
            {needsWorkTypePick ? "종목·기종 선택" : "기종 선택"} <span style={{ fontSize: 12, color: "#93A2B4", fontWeight: 700 }}>({workType || "종목 미정"})</span>
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

        {/* 2026-07-12 — 종목 재선택 UI (사장님 spec: '기타/기타' recovery + 홈페이지 접수 미정 대응). */}
        {needsWorkTypePick && (
          <div>
            <div style={{
              fontSize: 11, color: "#93A2B4", fontWeight: 800,
              marginBottom: 6, letterSpacing: 0.3, textTransform: "uppercase",
            }}>종목 <span style={{ color: "#DC2626" }}>*</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["냉매충전", "세척"].map(wt => {
                const on = workType === wt;
                return (
                  <button
                    key={wt}
                    type="button"
                    onClick={() => { setWorkType(wt); setAppliance(""); }}
                    style={{
                      padding: "8px 14px",
                      background: on ? "#2563EB" : "#F4F6FA",
                      border: `1px solid ${on ? "#2563EB" : "#E5EAF1"}`,
                      borderRadius: 999,
                      color: on ? "#fff" : "#4A5A70",
                      fontSize: 13, fontWeight: 800,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>{wt}</button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: "#93A2B4", fontWeight: 600, marginTop: 6 }}>
              수리/설치는 팝업 미지원 — 관리자 화면에서 작업항목 편집으로 처리하세요.
            </div>
          </div>
        )}

        {noSupport ? (
          !needsWorkTypePick && (
            <div style={{
              padding: "12px 14px", borderRadius: 10,
              background: "#FEECEC", border: "1px solid #F5B5B5",
              color: "#C33", fontSize: 13, fontWeight: 700,
            }}>
              이 종목({workType || "미정"})은 팝업에서 기종 선택을 지원하지 않습니다.
              관리자 화면에서 종목을 수정하세요.
            </div>
          )
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
              ) : !appliance ? (
                <div style={{ fontSize: 13, color: "#93A2B4", fontWeight: 700 }}>기종을 먼저 선택하세요.</div>
              ) : isQuoteUndecided ? (
                // 2026-07-11 — 사장님 spec: 단가 없음/0 → '견적 미정' 흐름 (올데이케어 등 현장 견적).
                //   "단가 0" 경고 문구 제거 (오해 소지). 담백하게 '견적 미정 · 현장 견적' 만.
                <>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#F59E0B" }}>
                    견적 미정
                  </div>
                  <div style={{ fontSize: 11, color: "#78350F", fontWeight: 700 }}>
                    현장 견적 — 완료 시 금액 입력 후 정산됩니다.
                  </div>
                </>
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
          {/* 2026-07-11 — 사장님 spec: 견적 미정도 저장 허용. noSupport (종목 미지원) 만 차단. */}
          <button
            onClick={handleSave}
            disabled={!canSave || noSupport}
            style={{
              padding: "9px 18px",
              background: (!canSave || noSupport) ? "#B7C1CE" : (isQuoteUndecided ? "#F59E0B" : "#2563EB"),
              border: "none",
              borderRadius: 8, color: "#fff",
              fontSize: 13, fontWeight: 800,
              cursor: (!canSave || noSupport) ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              letterSpacing: "-0.2px",
            }}>{saving ? "저장 중…" : (isQuoteUndecided ? "기종 저장 (견적 미정)" : "저장 및 견적 반영")}</button>
        </div>
      </div>
    </div>
  );
}

// placeholder 값 판정 (사장님 spec: "미정"/"기타"/"—"/"-" 등도 미정 취급).
//   저장 흐름 어딘가 appliance 를 빈값 대신 placeholder 로 채우는 케이스 방어.
const _APPLIANCE_PLACEHOLDER_RE = /^(미정|기타|미확정|—|-|_|\?|없음|선택|선택안함|선택안됨)$/i;
function _isPlaceholderAppliance(apl) {
  if (!apl) return true;
  const s = String(apl).trim();
  if (s === "") return true;
  return _APPLIANCE_PLACEHOLDER_RE.test(s);
}

// 헬퍼 — task 가 기종 선택 팝업 대상인지 판정.
//   우선순위:
//     1) task.applianceUndecided === true (플래그 명시)
//     2) workItems 첫 항목 workType 또는 appliance 이 placeholder ('기타' 등)
//        또는 빈값 (사고: work_types.name 매칭 실패 시 undefined).
//     3) workItems 비어있는데 root 에 workType 있음
//     4) workItems 비어있고 memo 에 "[홈페이지 접수" 마커 (옛 저장 recover)
//     5) root task.workType 이 placeholder ('기타' 등) — 최종 방어.
// 2026-07-12 — 사장님 spec: workType placeholder 도 미정 취급.
//   A-260712-029 (김은희) case — sync_task_items_trg 가 work_types.name='기타' 미매칭 →
//   task_items.work_type_id=NULL → rowToTask 에서 workItems[0].workType=undefined →
//   기존 판정 `first.workType && ...` 조건 fail → 배너 안 뜸.
export function needsApplianceSelection(task) {
  if (!task) return false;
  if (task.applianceUndecided === true) return true;
  // 2026-07-12 — 사장님 spec: 배지가 '미정' 이면 무조건 배너 표시 (판정 통일).
  //   detectServiceType 이 undecided 판정하는 모든 케이스를 needsApplianceSelection 도 커버.
  //   ('기타' workType 이 놓치는 경로 방어. placeholder 판정 로직 이중화.)
  try {
    const st = detectServiceType(task);
    if (st && st.id === "undecided") return true;
  } catch (_e) { /* ignore */ }
  const wi = Array.isArray(task.workItems) ? task.workItems : [];
  // 2026-07-12 — 사장님 spec: 항목 0 이면 root workType 유무 상관 없이 무조건 미정.
  //   A-260712-029 (workItems=[] + rootWorkType=null) — 완전 갇힘 방지.
  //   빈 task 는 정상 흐름 불가 → 배너로 종목·기종 선택 강제.
  if (wi.length === 0) return true;
  const first = wi[0] || {};
  const wtEmpty  = !first.workType || String(first.workType).trim() === "";
  const wtPlace  = _isPlaceholderAppliance(first.workType);
  const aplPlace = _isPlaceholderAppliance(first.appliance);
  if (wtEmpty || wtPlace || aplPlace) return true;
  // 최종 방어: root task.workType 이 placeholder ('기타' 등).
  if (task.workType && _isPlaceholderAppliance(task.workType)) return true;
  return false;
}

export default ApplianceSelectModal;

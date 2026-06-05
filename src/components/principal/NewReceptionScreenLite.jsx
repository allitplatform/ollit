// 유솔 / KA / 크리크린 원청 PWA — 새 접수 등록 (경량판, 일반화)
// 2026-05-24 최초 / 2026-06-03 일반화 (KA / crikrin 추가)
//
// 일반화 props:
//   principalCode    — 원청 code (필수). 예: "usol_h" / "KA" / "crikrin"
//   principalLabel   — 헤더 부제목. 예: "유솔홈케어 H · 직접 입력"
//   workTypes        — 작업 종류 목록. default ["세척","냉매충전","출장비"]
//   appliancePool    — 작업종류별 기종 목록. default 유솔H 값
//   quoteRates       — 원청별 기종 단가표 jsonb. 예: { refrigerant: { 벽걸이:70000, ... } }.
//                      넘기면: 기종 선택 시 단가 자동 채움 + 합계 자동 계산.
//                      안 넘기면(null): 기존 유솔H 동작 — 사용자가 견적 총액 직접 입력.
//   useRpc           — true면 향후 SECURITY DEFINER RPC 경유. 현재 PWA는 anon 직접 INSERT(false).
//   accentColor      — 강조 색. default "#FF4D9E" (유솔 마젠타)
//
// KA 1way 자동 분할:
//   principalCode='KA' + service_code='refrigerant' + appliance='1way' + qty≥2 일 때
//   저장 직전 workItems 분할:
//     첫대 1대 (단가=1way_첫대) + 추가 (qty-1)대 (단가=1way_추가)
//   crikrin 1way는 단일 단가, KA 외 원청은 분할 없음.
//
// 저장 spec:
//   createTaskAdapter({ principalCode, workItems, estimateTotal, status:'미배정', ... })
//   → tasks INSERT (category_data.workItems 포함)
//   → trigger sync_category_data_to_task_items (Mig 017)로 task_items 자동 생성
//   → 작업 상세 ItemProgress 진입 가능.
import { useState, useMemo, useEffect, useRef } from "react";
import { ArrowLeft, Send, Plus, X } from "lucide-react";
import { createTaskAdapter as createTask } from "../../data/tasksDb.js";
import { PAYMENT_METHOD_OPTIONS } from "../../data/paymentMethods.js";
// 2026-06-06 — KA/crikrin 붙여넣기 prefill (선택 기능). 유솔은 미사용.
import { APPLIANCE_CODE_TO_LABEL } from "../../utils/partnerPasteParser.js";

// 유솔H 기본 — 작업 종류 / 기종 풀
const DEFAULT_WORK_TYPES = ["세척", "냉매충전", "출장비"];
const DEFAULT_APPLIANCE_POOL = {
  "세척":     ["벽걸이", "1way", "스탠드", "4way", "원형", "투인원", "시스템멀티"],
  "냉매충전": ["벽걸이", "스탠드", "4way", "투인원", "1way"],
  "출장비":   ["(공통)"],
};

// 작업 종류 한글 → quote_rates jsonb의 service_code 키 매핑
const WORK_TYPE_TO_SERVICE = {
  "세척":     "cleaning",
  "냉매충전": "refrigerant",
  "출장비":   "visit_fee",
};

// 2026-05-26 — 고객 자동 생성. region("성북구") 그대로 + 전화 끝 4자리 → "성북구4696".
//   옛: /([가-힣]+?)(?:구|시|동|군)/ 게으른 매칭이 "서울특별시"에서 "서울특별"만 잡는 사고.
//   신: 호출처에서 '구' 우선 추출(아래 region 변수)하므로 정규식 불필요.
function autoGenerateCustomer(form, region) {
  if (form.customer && form.customer.trim()) return form.customer.trim();
  const digits = (form.phone || "").replace(/\D/g, "");
  const last4  = digits.length >= 4 ? digits.slice(-4) : "";
  const regionShort = region || (form.address || "").trim().split(/\s+/)[0] || "";
  if (regionShort && last4) return `${regionShort}${last4}`;
  if (regionShort)          return `${regionShort}고객`;
  if (last4)                return `고객${last4}`;
  return "고객 미정";
}

// 기종 + 작업종류 + 수량 → 단가 lookup (quoteRates 기반)
//   반환: { unitPrice, isKa1waySplit, firstPrice, extraPrice }
//   KA 1way + qty≥2 분할 정보 같이 반환 (저장 시 사용)
function lookupRate({ principalCode, quoteRates, workType, appliance, qty }) {
  if (!quoteRates) return { unitPrice: 0, isKa1waySplit: false };
  const serviceCode = WORK_TYPE_TO_SERVICE[workType];
  if (!serviceCode) return { unitPrice: 0, isKa1waySplit: false };
  const serviceMap = quoteRates[serviceCode];
  if (!serviceMap) return { unitPrice: 0, isKa1waySplit: false };

  // KA 1way 첫대/추가 자동 분할
  if (principalCode === "KA" && serviceCode === "refrigerant" && appliance === "1way") {
    const firstPrice = Number(serviceMap["1way_첫대"]) || 0;
    const extraPrice = Number(serviceMap["1way_추가"]) || 0;
    if (qty <= 1) {
      return { unitPrice: firstPrice, isKa1waySplit: false, firstPrice, extraPrice };
    }
    return { unitPrice: firstPrice, isKa1waySplit: true, firstPrice, extraPrice };
  }

  const price = Number(serviceMap[appliance]) || 0;
  return { unitPrice: price, isKa1waySplit: false };
}

export function NewReceptionScreenLite({
  t,
  onBack,
  onSubmit,
  // 일반화 props
  principalCode    = "usol_h",
  principalLabel   = "유솔홈케어 H · 직접 입력",
  workTypes        = DEFAULT_WORK_TYPES,
  appliancePool    = DEFAULT_APPLIANCE_POOL,
  quoteRates       = null,
  // useRpc 는 향후 확장 여지 — 현재는 미사용 (anon 직접 INSERT)
  // eslint-disable-next-line no-unused-vars
  useRpc           = false,
  accentColor      = "#FF4D9E",
  // 2026-06-06 — 붙여넣기 prefill (KA/crikrin 만 사용). 모두 optional.
  //   pasteText / onPasteTextChange : 텍스트에리어 controlled value (parent state).
  //   parsedRecords                  : parsePartnerPaste 결과 배열. 1건이면 자동 prefill.
  //   parseToken                     : 새 parse 호출 시마다 parent가 증가. useEffect 트리거.
  //   onParse(text)                  : '파싱' 버튼 클릭 → parent가 parsePartnerPaste 실행.
  //   onConsumeRecord(idx)           : 제출 성공 시 호출 → parent가 해당 record 제거.
  pasteText        = "",
  onPasteTextChange,
  parsedRecords,
  parseToken,
  onParse,
  onConsumeRecord,
}) {
  const [form, setForm] = useState({
    customer: "", phone: "", address: "",
    requestDate: "", requestTime: "", memo: "",
    estimateTotal: 0,
    paymentMethod: "",   // 2026-05-27 Migration 077 — 결제 방식 (선택 사항)
  });
  const [errors, setErrors] = useState({});
  // workItems 각 row: { workType, appliance, qty, unitPrice (자동/편집), userEditedPrice (boolean) }
  const [workItems, setWorkItems] = useState([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState({ workType: "", appliance: "", qty: 1, unitPrice: 0 });
  const [editPriceTouched, setEditPriceTouched] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(null);   // null | "tbd" | "input"
  const [priceTBD, setPriceTBD] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // 2026-06-06 — 붙여넣기 prefill 로컬 상태
  //   activeRecordIdx : 사용자가 [채우기] 클릭한(또는 자동 prefill 된) record idx — 제출 성공 시 consume 호출에 사용.
  //   lastAppliedTokenRef : 같은 parsedRecords 에 대해 useEffect 자동 prefill 중복 방지.
  const [activeRecordIdx, setActiveRecordIdx] = useState(null);
  const lastAppliedTokenRef = useRef(null);

  // quoteRates 모드: 가격표 사용 가능 여부
  const hasRates = !!quoteRates;
  // 붙여넣기 UI 노출 여부 — parser 지원 원청만 (KA / crikrin).
  const pasteSupported = principalCode === "KA" || principalCode === "crikrin";

  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  }

  // 2026-06-06 — 파싱된 record 1건을 폼에 채움 (사람 검토용. 절대 자동 제출 X).
  //   appliance=null (위니아 등 기종 불명) → "" 전달 → 폼 드롭다운 미선택 상태.
  //   desiredText/memo 는 합쳐서 메모란에. requestDate(YYYY-MM-DD) 자동 채움 X — 사람이 일정 잡기.
  //   견적가:
  //     · KA (parser 가 price 추출) → message 가격 그대로 unitPrice 사용.
  //     · crikrin (parser price=null) → quoteRates 에서 자동 lookup. appliance 미정이면 0.
  //     · KA 1way + qty≥2 분할 케이스는 폼 submit 측 isKa1waySplit 분기가 quote_rates 강제 사용
  //       (해당 시 unitPrice 는 표시용 — 분할 라벨로 덮어쓰여 안 보임).
  function applyRecord(record, idx) {
    if (!record) return;
    const memoParts = [];
    if (record.desiredText) memoParts.push(`희망: ${record.desiredText}`);
    if (record.memo)        memoParts.push(record.memo);
    setForm(prev => ({
      ...prev,
      customer: record.customerName || "",
      phone:    record.phone || "",
      address:  record.address || "",
      memo:     memoParts.join(" / "),
    }));
    const targetWorkType = record.workType || workTypes[0] || "냉매충전";
    const newItems = (record.items || []).map(it => {
      const applianceLabel = it.appliance ? (APPLIANCE_CODE_TO_LABEL[it.appliance] || "") : "";
      let unitPrice = it.price != null ? it.price : 0;
      // crikrin (메시지 가격 없음) → quote_rates 자동 채움. appliance 빈값(위니아 등) 이면 0 유지.
      if (it.price == null && quoteRates && applianceLabel) {
        const r = lookupRate({
          principalCode,
          quoteRates,
          workType:  targetWorkType,
          appliance: applianceLabel,
          qty:       it.qty || 1,
        });
        unitPrice = r.unitPrice || 0;
      }
      return {
        workType:  targetWorkType,
        appliance: applianceLabel,
        qty:       it.qty || 1,
        unitPrice,
      };
    });
    setWorkItems(newItems);
    setActiveRecordIdx(idx);
    setErrors({});
  }

  // 1건만 감지된 새 parsedRecords → 자동 prefill (parseToken 1회당 1회).
  useEffect(() => {
    if (parseToken == null) return;
    if (lastAppliedTokenRef.current === parseToken) return;
    if (Array.isArray(parsedRecords) && parsedRecords.length === 1) {
      applyRecord(parsedRecords[0], 0);
      lastAppliedTokenRef.current = parseToken;
    } else {
      // 다건 또는 빈 결과 — token 만 기록 (재시도 방지).
      lastAppliedTokenRef.current = parseToken;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parseToken]);

  // 2026-05-26 — 지역(region) 추출. 도로명 "서울특별시 성북구 ..." → "성북구".
  //   '구' 우선 → '시'/'군' (광역시·특별시·특별자치시·도 제외) → 첫 토큰 fallback.
  const region = (() => {
    const tokens = (form.address || "").trim().split(/\s+/);
    const gu = tokens.find(tok => /^[가-힣]+구$/.test(tok));
    if (gu) return gu;
    const siGun = tokens.find(tok =>
      /^[가-힣]+(시|군)$/.test(tok) &&
      !/(특별시|광역시|특별자치시|특별자치도)$/.test(tok)
    );
    if (siGun) return siGun;
    return tokens[0] || "";
  })();

  // editItem 변경 시 단가 자동 채움 (사용자가 가격 수정 안 한 경우만)
  function syncEditItemPrice(next) {
    if (!hasRates || editPriceTouched) return next;
    if (!next.workType || !next.appliance) return next;
    const r = lookupRate({
      principalCode,
      quoteRates,
      workType: next.workType,
      appliance: next.appliance,
      qty: next.qty || 1,
    });
    return { ...next, unitPrice: r.unitPrice };
  }

  function setEditField(patch) {
    setEditItem(prev => syncEditItemPrice({ ...prev, ...patch }));
  }

  function addWorkItem() {
    if (!editItem.workType || !editItem.appliance) return;
    const newItem = {
      workType:  editItem.workType,
      appliance: editItem.appliance,
      qty:       Number(editItem.qty) || 1,
      unitPrice: Number(editItem.unitPrice) || 0,
    };
    setWorkItems(prev => [...prev, newItem]);
    setEditItem({ workType: "", appliance: "", qty: 1, unitPrice: 0 });
    setEditPriceTouched(false);
    setShowAddItem(false);
    if (errors.workItems) setErrors(prev => ({ ...prev, workItems: null }));
  }
  function removeWorkItem(idx) {
    setWorkItems(prev => prev.filter((_, i) => i !== idx));
  }

  // 가격표 모드: workItems 합계 자동 계산 (KA 1way 분할 고려)
  const autoTotal = useMemo(() => {
    if (!hasRates) return 0;
    let sum = 0;
    for (const it of workItems) {
      const r = lookupRate({
        principalCode,
        quoteRates,
        workType:  it.workType,
        appliance: it.appliance,
        qty:       it.qty,
      });
      if (r.isKa1waySplit) {
        sum += r.firstPrice + r.extraPrice * Math.max(0, it.qty - 1);
      } else {
        const unit = Number(it.unitPrice) > 0 ? Number(it.unitPrice) : r.unitPrice;
        sum += unit * (it.qty || 1);
      }
    }
    return sum;
  }, [workItems, hasRates, principalCode, quoteRates]);

  // 가격표 모드면 estimateTotal = autoTotal (사용자가 별도 입력 안 함)
  const effectiveTotal = hasRates ? autoTotal : (form.estimateTotal || 0);

  async function handleSubmit() {
    const errs = {};
    if (!form.phone.trim()) errs.phone = "연락처 입력";
    if (!form.address.trim()) errs.address = "주소 입력";
    if (workItems.length === 0) errs.workItems = "작업 항목 1개 이상";
    if (!hasRates && !priceTBD && (!form.estimateTotal || form.estimateTotal <= 0)) {
      errs.estimateTotal = "견적 입력";
    }
    if (hasRates && !priceTBD && autoTotal <= 0) {
      errs.estimateTotal = "기종 단가 확인";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const finalCustomer = autoGenerateCustomer(form, region);
    const scheduleType  = scheduleMode === "input" ? "specific" : "tbd";

    // workItems 저장 형태 결정 — 두 경로
    //   (A) hasRates 모드: 각 row 별 quote 적용 + KA 1way 자동 분할
    //   (B) 유솔H 모드: head 1개 row에만 quote = unit_price = totalAmount/headQty (기존 동작)
    let workItemsToSave;
    let totalAmount;

    if (hasRates) {
      // 가격표 모드 — 자동 합계, 각 row 개별 단가
      totalAmount = priceTBD ? 0 : autoTotal;

      // KA 1way 분할 적용
      workItemsToSave = [];
      for (const it of workItems) {
        const r = lookupRate({
          principalCode,
          quoteRates,
          workType:  it.workType,
          appliance: it.appliance,
          qty:       it.qty,
        });
        if (r.isKa1waySplit) {
          // 첫대 1대 + 추가 (qty-1)대 — 두 row로 분리
          // orderType: '첫대' / '추가' — Mig 093 sync v4가 task_items.order_type에 옮김.
          //   Mig 094 compute_payment v18이 이 값을 calculate_commission p_qty_condition으로 전달.
          //   → KA refrigerant 1way 정책(qty_condition='첫대'/'추가' 시드) 정확 매칭.
          workItemsToSave.push({
            workType:  it.workType,
            appliance: it.appliance,
            qty:       1,
            quote:     r.firstPrice,
            orderType: '첫대',
          });
          workItemsToSave.push({
            workType:  it.workType,
            appliance: it.appliance,
            qty:       Math.max(1, it.qty - 1),
            quote:     r.extraPrice,
            orderType: '추가',
          });
        } else {
          const unit = Number(it.unitPrice) > 0 ? Number(it.unitPrice) : r.unitPrice;
          workItemsToSave.push({
            workType:  it.workType,
            appliance: it.appliance,
            qty:       it.qty,
            quote:     unit,
          });
        }
      }
    } else {
      // 유솔H 모드 — 기존 동작 그대로
      // 2026-05-26 fix — 금액 2배 버그(옵션 C, 프론트엔드만):
      //   estimateTotal 의도 = 첫 항목 기준 총액. unit_price=총액/headQty 로 분배.
      //   Migration 017 trigger가 workItem.quote → task_items.unit_price 로 사용.
      //   quote 미지정 시 NEW.product_price(총액) fallback → unit_price=총액 → subtotal=qty×총액 → 2배 발생.
      const head = workItems[0] || {};
      const headQty = head.qty || 1;
      totalAmount = priceTBD ? 0 : (form.estimateTotal || 0);
      const unitPrice = headQty > 0 ? Math.floor(totalAmount / headQty) : totalAmount;
      workItemsToSave = workItems.map((it, i) => ({
        workType:  it.workType,
        appliance: it.appliance,
        qty:       it.qty,
        quote:     i === 0 ? unitPrice : 0,
      }));
    }

    const head = workItemsToSave[0] || {};

    setSubmitting(true);
    setSubmitError("");
    try {
      const taskData = {
        principalCode,
        // 2026-06-05 — Mig 098 가드용. 원청앱 접수 식별자. 운영자/bulk와 분리.
        channel:       "원청앱",
        // 2026-05-27 Migration 077 — 결제 방식 (선택 안 함 → null)
        paymentMethod: form.paymentMethod || null,
        customer:      finalCustomer,
        phone:         form.phone,
        address:       form.address,
        region,
        workType:      head.workType,
        appliance:     head.appliance,
        qty:           head.qty || 1,
        workItems:     workItemsToSave,
        quote:         totalAmount,
        estimateTotal: totalAmount,
        scheduledDate: scheduleMode === "input" ? form.requestDate : null,
        scheduledTime: scheduleMode === "input" ? form.requestTime : null,
        memo:          form.memo,
        status:        "미배정",
        scheduleType,
      };
      const res = await createTask(taskData);
      if (!res.ok) {
        setSubmitError(res.error || "등록 실패");
        setSubmitting(false);
        return;
      }
      // 2026-06-06 — 붙여넣기 prefill 로 채워진 record 가 있었으면 parent 에 알려 리스트에서 제거.
      //   onSubmit 보다 먼저 호출 — onSubmit 이 폼 unmount 트리거 (showNewForm=false) 하므로.
      if (activeRecordIdx !== null && onConsumeRecord) {
        onConsumeRecord(activeRecordIdx);
      }
      onSubmit?.({
        id: res.taskId, taskNo: res.task_no,
        customer: finalCustomer, phone: form.phone, address: form.address,
        workItems: workItemsToSave, region,
      });
    } catch (e) {
      setSubmitError(e.message || "등록 실패");
      setSubmitting(false);
    }
  }

  const inputStyle = (hasError) => ({
    width: "100%", padding: "10px 12px",
    background: t.bgInset,
    border: `1px solid ${hasError ? t.danger : t.border}`,
    borderRadius: 8, fontSize: 13, color: t.text,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  });

  return (
    <div className="fade-in">
      {/* 헤더 */}
      <div style={{
        padding: "16px",
        borderBottom: `1px solid ${t.border}`,
        display: "flex", alignItems: "center", gap: 10,
        position: "sticky", top: 0, background: t.bg, zIndex: 100,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", color: t.text, display: "flex",
        }}><ArrowLeft size={18}/></button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>새 접수 등록</div>
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
            {principalLabel}
          </div>
        </div>
      </div>

      {/* 2026-06-06 — KA/crikrin 만 노출. 카톡/문자 통째 붙여넣기 → 파싱 → 폼 prefill.
          ⚠️ 자동 제출 없음 — 사람이 검토·수정 후 제출 버튼 직접 클릭. */}
      {pasteSupported && (
        <div style={{
          margin: "12px 16px 0",
          padding: 12,
          background: t.bgInset,
          border: `1px dashed ${t.border}`,
          borderRadius: 10,
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: t.text,
            marginBottom: 6,
          }}>
            📋 메시지 붙여넣기 (선택)
          </div>
          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
            {principalCode === "KA"
              ? "카톡/문자 통째 붙여넣기 — 빈 줄로 여러 건 자동 분리. 1건이면 자동 채움, 여러 건이면 [채우기] 클릭."
              : "메시지 1건 붙여넣기 → [파싱] → 자동으로 폼에 채움. 검토 후 제출."}
          </div>
          <textarea
            value={pasteText || ""}
            onChange={(e) => onPasteTextChange?.(e.target.value)}
            placeholder="여기에 붙여넣기"
            rows={6}
            style={{
              width: "100%",
              background: t.bg,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: "8px 10px",
              color: t.text,
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
            <button
              onClick={() => onParse?.(pasteText || "")}
              disabled={!pasteText || !pasteText.trim()}
              style={{
                padding: "7px 14px",
                background: accentColor,
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: pasteText && pasteText.trim() ? "pointer" : "not-allowed",
                opacity: pasteText && pasteText.trim() ? 1 : 0.5,
                fontFamily: "inherit",
              }}
            >파싱</button>
            {Array.isArray(parsedRecords) && parsedRecords.length > 0 && (
              <span style={{ fontSize: 10, color: t.textMuted }}>
                {parsedRecords.length}건 감지
              </span>
            )}
          </div>

          {/* 파싱 결과 — 다건이면 리스트, 1건이면 안내만 (자동 채움). */}
          {Array.isArray(parsedRecords) && parsedRecords.length === 1 && (
            <div style={{ marginTop: 10, fontSize: 10, color: t.textMuted }}>
              ✓ 폼에 자동 채워졌습니다. 검토·수정 후 제출 버튼 클릭하세요.
            </div>
          )}
          {Array.isArray(parsedRecords) && parsedRecords.length > 1 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 6 }}>
                건별로 [채우기] → 검토·제출 → 자동으로 다음 건 차례.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {parsedRecords.map((r, idx) => {
                  const itemsSummary = (r.items || []).map(it => {
                    const lab = it.appliance ? (APPLIANCE_CODE_TO_LABEL[it.appliance] || it.appliance) : "(기종?)";
                    return `${lab}×${it.qty}${it.price != null ? ` ₩${it.price.toLocaleString()}` : ""}`;
                  }).join(" / ");
                  const isActive = activeRecordIdx === idx;
                  return (
                    <div key={idx} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px",
                      background: isActive ? `${accentColor}22` : t.bg,
                      border: `1px solid ${isActive ? accentColor : t.border}`,
                      borderRadius: 8,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: t.text, fontWeight: 600 }}>
                          [{idx + 1}] {r.address || "(주소없음)"}
                        </div>
                        <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                          {r.phone || "폰없음"} · {itemsSummary || "(품목없음)"}
                        </div>
                      </div>
                      <button
                        onClick={() => applyRecord(r, idx)}
                        style={{
                          padding: "6px 10px",
                          background: isActive ? accentColor : "transparent",
                          border: `1px solid ${accentColor}`,
                          borderRadius: 6,
                          color: isActive ? "#fff" : accentColor,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          flexShrink: 0,
                          fontFamily: "inherit",
                        }}
                      >{isActive ? "채움" : "채우기"}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: "16px" }}>
        {/* 연락처 */}
        <FormSection t={t} accent={accentColor} icon="📞" label="연락처" required error={errors.phone}>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="010-0000-0000"
            style={inputStyle(!!errors.phone)}
          />
        </FormSection>

        {/* 주소 */}
        <FormSection t={t} accent={accentColor} icon="📍" label="주소" required error={errors.address}>
          <input
            type="text"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="강남구 역삼동 123-45"
            style={inputStyle(!!errors.address)}
          />
        </FormSection>

        {/* 고객명 (자동 생성, 직접 입력 가능) */}
        <FormSection t={t} accent={accentColor} icon="👤" label="고객명 (선택)">
          <input
            type="text"
            value={form.customer}
            onChange={(e) => update("customer", e.target.value)}
            placeholder={`자동: ${autoGenerateCustomer(form, region)}`}
            style={inputStyle(false)}
          />
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 6 }}>
            비워두면 지역 + 전화번호 끝 4자리로 자동 생성됩니다.
          </div>
        </FormSection>

        {/* 작업 항목 */}
        <FormSection t={t} accent={accentColor} icon="🔧" label="작업 항목" required error={errors.workItems}>
          {workItems.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {workItems.map((it, idx) => {
                // KA 1way 분할 정보 — UI 표시용
                const r = hasRates ? lookupRate({
                  principalCode, quoteRates,
                  workType: it.workType, appliance: it.appliance, qty: it.qty,
                }) : null;
                const lineTotal = r && r.isKa1waySplit
                  ? r.firstPrice + r.extraPrice * Math.max(0, it.qty - 1)
                  : (Number(it.unitPrice) || 0) * (it.qty || 1);
                return (
                  <div key={idx} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 10px",
                    background: t.bgInset, border: `1px solid ${t.border}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 12, color: t.text }}>
                        {it.workType} · {it.appliance} · {it.qty}대
                      </span>
                      {hasRates && (
                        <span style={{ fontSize: 10, color: t.textMuted }}>
                          {r && r.isKa1waySplit
                            ? `첫대 ${r.firstPrice.toLocaleString()} + 추가 ${(it.qty - 1)}대 × ${r.extraPrice.toLocaleString()} = ${lineTotal.toLocaleString()}원`
                            : `${(Number(it.unitPrice) || 0).toLocaleString()}원 × ${it.qty}대 = ${lineTotal.toLocaleString()}원`
                          }
                        </span>
                      )}
                    </div>
                    <button onClick={() => removeWorkItem(idx)} style={{
                      background: "transparent", border: "none", color: t.textMuted, cursor: "pointer",
                      padding: 0, display: "flex",
                    }}><X size={14}/></button>
                  </div>
                );
              })}
            </div>
          )}

          {!showAddItem ? (
            <button onClick={() => setShowAddItem(true)} style={{
              width: "100%", padding: "10px 12px",
              background: "transparent",
              border: `1px dashed ${t.border}`, borderRadius: 8,
              color: t.textSecondary, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}><Plus size={14}/> 작업 항목 추가</button>
          ) : (
            <div style={{
              padding: 10, background: t.bgInset, borderRadius: 8,
              border: `1px solid ${t.border}`,
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div>
                <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 6 }}>작업 종류</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {workTypes.map(wt => (
                    <FormChip key={wt} t={t} accent={accentColor} active={editItem.workType === wt}
                      onClick={() => { setEditField({ workType: wt, appliance: "", unitPrice: 0 }); setEditPriceTouched(false); }}
                    >{wt}</FormChip>
                  ))}
                </div>
              </div>
              {editItem.workType && (
                <div>
                  <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 6 }}>기종</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(appliancePool[editItem.workType] || []).map(ap => (
                      <FormChip key={ap} t={t} accent={accentColor} active={editItem.appliance === ap}
                        onClick={() => { setEditField({ appliance: ap }); setEditPriceTouched(false); }}
                      >{ap}</FormChip>
                    ))}
                  </div>
                </div>
              )}
              {editItem.appliance && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>수량</span>
                  <input
                    type="number" min="1" value={editItem.qty}
                    onChange={(e) => setEditField({ qty: parseInt(e.target.value) || 1 })}
                    style={{ ...inputStyle(false), width: 80 }}
                  />
                  <span style={{ fontSize: 11, color: t.textMuted }}>대</span>
                </div>
              )}
              {/* 가격표 모드: 단가 표시 + 편집 */}
              {hasRates && editItem.appliance && (
                <div>
                  <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 6 }}>
                    단가 (자동 — 편집 가능)
                    {principalCode === "KA" && editItem.workType === "냉매충전" && editItem.appliance === "1way" && (editItem.qty || 1) >= 2 && (
                      <span style={{ marginLeft: 8, color: accentColor, fontWeight: 800 }}>
                        ※ 첫대 + 추가 자동 분할
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number" min="0"
                      value={editItem.unitPrice || ""}
                      onChange={(e) => { setEditPriceTouched(true); setEditItem(prev => ({ ...prev, unitPrice: parseInt(e.target.value) || 0 })); }}
                      placeholder="0"
                      style={{ ...inputStyle(false), width: 140 }}
                    />
                    <span style={{ fontSize: 11, color: t.textMuted }}>원/대</span>
                  </div>
                  {principalCode === "KA" && editItem.workType === "냉매충전" && editItem.appliance === "1way" && (editItem.qty || 1) >= 2 && (() => {
                    const r = lookupRate({ principalCode, quoteRates, workType: "냉매충전", appliance: "1way", qty: editItem.qty });
                    const lineTotal = r.firstPrice + r.extraPrice * Math.max(0, (editItem.qty || 1) - 1);
                    return (
                      <div style={{ fontSize: 10, color: t.textSecondary, marginTop: 6 }}>
                        첫대 {r.firstPrice.toLocaleString()} + 추가 {(editItem.qty - 1)}대 × {r.extraPrice.toLocaleString()} = {lineTotal.toLocaleString()}원
                      </div>
                    );
                  })()}
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button
                  onClick={addWorkItem}
                  disabled={!editItem.workType || !editItem.appliance}
                  style={{
                    flex: 1, padding: "8px 12px",
                    background: (editItem.workType && editItem.appliance) ? accentColor : t.bgInset,
                    color: (editItem.workType && editItem.appliance) ? "#fff" : t.textMuted,
                    border: "none", borderRadius: 8,
                    fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                    cursor: (editItem.workType && editItem.appliance) ? "pointer" : "not-allowed",
                  }}
                >추가</button>
                <button onClick={() => { setShowAddItem(false); setEditItem({ workType: "", appliance: "", qty: 1, unitPrice: 0 }); setEditPriceTouched(false); }}
                  style={{
                    padding: "8px 12px",
                    background: "transparent", border: `1px solid ${t.border}`, borderRadius: 8,
                    color: t.textSecondary, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >취소</button>
              </div>
            </div>
          )}
        </FormSection>

        {/* 견적 — 가격표 모드 vs 직접 입력 모드 */}
        <FormSection t={t} accent={accentColor} icon="💰" label="견적 금액" required error={errors.estimateTotal}>
          {hasRates ? (
            // 가격표 모드: 자동 합계만 표시 (사용자 입력 X)
            <>
              <div style={{
                padding: "12px 14px",
                background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>자동 합계</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: accentColor }}>
                  {autoTotal.toLocaleString()}원
                </span>
              </div>
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 6 }}>
                기종 단가 × 수량 합계. 현장에서 추가금 발생 시 기사가 입력합니다.
              </div>
            </>
          ) : (
            // 직접 입력 모드 (유솔H 기존 동작)
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <FormChip t={t} accent={accentColor} active={!priceTBD} onClick={() => setPriceTBD(false)}>직접 입력</FormChip>
                <FormChip t={t} accent={accentColor} active={priceTBD} onClick={() => { setPriceTBD(true); update("estimateTotal", 0); }}>견적 미정</FormChip>
              </div>
              {!priceTBD && (
                <input
                  type="number" min="0"
                  value={form.estimateTotal || ""}
                  onChange={(e) => update("estimateTotal", parseInt(e.target.value) || 0)}
                  placeholder="200000"
                  style={inputStyle(!!errors.estimateTotal)}
                />
              )}
              {priceTBD && (
                <div style={{ fontSize: 11, color: t.warning, fontWeight: 600 }}>
                  ⚠️ 현장에서 금액 확정 — 작업 완료 후 추가금 입력
                </div>
              )}
            </>
          )}
        </FormSection>

        {/* 2026-05-29 위치 이동 — 결제 방식 (견적 결정 → 결제 흐름 자연 순서) */}
        <FormSection t={t} accent={accentColor} icon="💳" label="결제 방식">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PAYMENT_METHOD_OPTIONS.map(p => (
              <FormChip
                t={t}
                accent={accentColor}
                key={p.id}
                active={form.paymentMethod === p.id}
                onClick={() => update("paymentMethod", form.paymentMethod === p.id ? "" : p.id)}
              >{p.label}</FormChip>
            ))}
          </div>
        </FormSection>

        {/* 일정 */}
        <FormSection t={t} accent={accentColor} icon="📅" label="희망 일정">
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <FormChip t={t} accent={accentColor} active={scheduleMode === "input"} onClick={() => setScheduleMode("input")}>직접 입력</FormChip>
            <FormChip t={t} accent={accentColor} active={scheduleMode === "tbd"} onClick={() => setScheduleMode("tbd")}>일정 미정</FormChip>
          </div>
          {scheduleMode === "input" && (
            <div style={{ display: "flex", gap: 6 }}>
              <input type="date" value={form.requestDate}
                onChange={(e) => update("requestDate", e.target.value)}
                style={{ ...inputStyle(false), flex: 1 }}
              />
              <input type="time" value={form.requestTime}
                onChange={(e) => update("requestTime", e.target.value)}
                style={{ ...inputStyle(false), flex: 1 }}
              />
            </div>
          )}
        </FormSection>

        {/* 요청사항 */}
        <FormSection t={t} accent={accentColor} icon="📝" label="요청사항 (선택)">
          <textarea
            value={form.memo}
            onChange={(e) => update("memo", e.target.value)}
            placeholder="추가 요청사항"
            rows={3}
            style={{ ...inputStyle(false), resize: "vertical", lineHeight: 1.5 }}
          />
        </FormSection>

        {submitError && (
          <div style={{
            marginTop: 8, marginBottom: 12, padding: "10px 12px",
            background: `${t.danger}1A`, border: `1px solid ${t.danger}`,
            borderRadius: 8, fontSize: 11, color: t.danger, fontWeight: 600,
          }}>⚠️ {submitError}</div>
        )}

        <button onClick={handleSubmit} disabled={submitting} style={{
          width: "100%", padding: 14, marginTop: 8,
          background: submitting ? t.bgInset : accentColor,
          color: submitting ? t.textMuted : "#fff",
          border: "none", borderRadius: 10,
          fontSize: 14, fontWeight: 800,
          cursor: submitting ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <Send size={16}/>
          <span>
            {submitting ? "저장 중..." : (hasRates && effectiveTotal > 0
              ? `${effectiveTotal.toLocaleString()}원 — 접수 등록하기`
              : "접수 등록하기")}
          </span>
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Helpers — AdminApp NewReceptionFormScreen 패턴 그대로 (의존성 없이 같이 정의)
// ════════════════════════════════════════════════════════════
function FormSection({ t, accent = "#FF4D9E", icon, label, required, error, children }) {
  return (
    <div style={{
      marginBottom: 12,
      background: t.bgElevated,
      border: `1px solid ${error ? t.danger : t.border}`,
      borderRadius: 10, padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>{label}</span>
        {required && <span style={{ fontSize: 11, color: accent, fontWeight: 800 }}>*</span>}
        {error && <span style={{ marginLeft: "auto", fontSize: 10, color: t.danger, fontWeight: 700 }}>{error}</span>}
      </div>
      {children}
    </div>
  );
}

function FormChip({ t, accent = "#FF4D9E", active, onClick, children }) {
  return (
    <button onClick={onClick} type="button" style={{
      padding: "6px 12px",
      background: active ? accent : t.bgInset,
      border: active ? `1px solid ${accent}` : `1px solid ${t.border}`,
      borderRadius: 999, fontSize: 11, fontWeight: 700,
      color: active ? "white" : t.textSecondary,
      cursor: "pointer", fontFamily: "inherit",
      whiteSpace: "nowrap", flexShrink: 0,
    }}>{children}</button>
  );
}

export default NewReceptionScreenLite;

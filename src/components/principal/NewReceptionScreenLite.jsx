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
//   accentColor      — 강조 색. default "var(--accent)" (메인 핑크 토큰 — 2026-06-12 통일)
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
import { ArrowLeft, Send, Plus, X, ClipboardPaste } from "lucide-react";
import { createTaskAdapter as createTask } from "../../data/tasksDb.js";
import { PAYMENT_METHOD_OPTIONS } from "../../data/paymentMethods.js";
// 2026-06-06 — KA/crikrin 붙여넣기 prefill (선택 기능). 유솔은 미사용.
//   extractRegion — 주소에서 짧은 지역명 (구>시>군, 캡 6자) 추출. 고객 자동명 + task.region 둘 다 사용.
import { APPLIANCE_CODE_TO_LABEL, extractRegion } from "../../utils/partnerPasteParser.js";

// 유솔H 기본 — 작업 종류 / 기종 풀
const DEFAULT_WORK_TYPES = ["세척", "냉매충전", "출장비"];
const DEFAULT_APPLIANCE_POOL = {
  "세척":     ["벽걸이", "1way", "스탠드", "4way", "원형", "투인원", "시스템멀티"],
  "냉매충전": ["벽걸이", "스탠드", "4way", "투인원", "1way"],
  "출장비":   ["(공통)"],
};

// 작업 종류 한글 → quote_rates jsonb의 service_code 키 매핑
// 2026-06-08 — export 추가 (AdminApp 접수 폼 측 동일 매핑 재사용)
export const WORK_TYPE_TO_SERVICE = {
  "세척":     "cleaning",
  "냉매충전": "refrigerant",
  "출장비":   "visit_fee",
};

// 2026-05-26 → 2026-06-06 정정 — 고객 자동 생성. region(구>시>군) + 전화 끝 4자리.
//   결과 포맷: "{지역} {끝4}" 공백 구분. 예 "관악구 2283".
//   사고 이력:
//     · 옛: address.split(' ')[0] fallback → '부천시원미로17번지17' 같이 공백 없는 KA 주소가
//       전체 들어가 '부천시원미로17번지172283' 같은 긴 고객명 사고.
//   정정:
//     · region 못 찾으면 fallback 제거 — 끝4 만 사용 ('고객2283').
//     · 구분자 공백 — 가독성 (이전 '' 직결).
// 2026-06-17 — export 추가 (NewReceptionPcForm 측 동일 자동 생성 재사용).
//
// 2026-06-19 — 사장님 spec: 주소 키워드 짧게.
//   이전: region("은평구") 그대로 + 전화 뒷4 → "은평구 2770".
//     문제: region 이 시군구라 도로명주소 사례에서 너무 김. "은평구 갈현로47길 3 ..." 면
//           "은평구갈현로47길2770" 등 통째 누락 케이스도 있었음.
//   현재: 주소에서 동/도로명 한 토막만 추출 + 전화 뒷4.
//     1) 동/읍/면 토큰 ("상암동", "역삼동") 우선
//     2) 없으면 도로명 본체 ("갈현로47길" → "갈현로")
//     3) 그것도 없으면 첫 토큰
//   region 인자는 호환을 위해 그대로 받지만 사용 X (호출처 변경 0).
//   기존 생성된 이름은 그대로 (정산 이력 연결). 신규 접수부터 적용.
function _pickAddressKeyword(rawAddress) {
  const tokens = String(rawAddress || "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  // 1) 동/읍/면 토큰 우선
  for (const tok of tokens) {
    const m = tok.match(/^([가-힣]+[동읍면])$/);
    if (m) return m[1];
  }
  // 2) 도로명 본체 — 숫자 세부 떼기
  for (const tok of tokens) {
    const m1 = tok.match(/^([가-힣]+(?:대로|로))\d+(?:번)?길?$/);
    if (m1) return m1[1];
    const m2 = tok.match(/^([가-힣]+(?:대로|로|길))$/);
    if (m2) return m2[1];
  }
  // 3) 토큰 안에 동/읍/면 부분 매칭 (끝-숫자 케이스)
  for (const tok of tokens) {
    const m = tok.match(/^([가-힣]{2,}[동읍면])(?:\d|$)/);
    if (m) return m[1];
  }
  // 4) fallback — 첫 토큰
  return tokens[0] || "";
}

export function autoGenerateCustomer(form /*, region */) {
  if (form.customer && form.customer.trim()) return form.customer.trim();
  const digits = (form.phone || "").replace(/\D/g, "");
  const last4  = digits.length >= 4 ? digits.slice(-4) : "";
  const keyword = _pickAddressKeyword(form.address || "");
  if (keyword && last4) return `${keyword} ${last4}`;
  if (keyword)          return `${keyword} 고객`;
  if (last4)            return `고객 ${last4}`;
  return "고객 미정";
}

// 기종 + 작업종류 + 수량 → 단가 lookup (quoteRates 기반)
//   반환: { unitPrice, isKa1waySplit, firstPrice, extraPrice }
//   KA 1way + qty≥2 분할 정보 같이 반환 (저장 시 사용)
// 2026-06-08 — export 추가 (AdminApp 접수 폼 측 동일 lookup 재사용 — 1 source of truth)
export function lookupRate({ principalCode, quoteRates, workType, appliance, qty }) {
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
  user = null,        // 2026-06-09 — actor 추적 (audit log)
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
  accentColor      = "var(--accent)",
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

  // 2026-06-06 — partnerMode 새 UI 접이식 상태
  const [pasteOpen, setPasteOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  // 견적 수동 편집 플래그 — 사용자가 견적 input 한 번 건드리면 더 이상 autoTotal sync 안 함.
  //   paste prefill (applyRecord) 호출 시 false 로 리셋 → 새 record 의 autoTotal 로 갱신 가능.
  const [estimateTouched, setEstimateTouched] = useState(false);

  // quoteRates 모드: 가격표 사용 가능 여부
  const hasRates = !!quoteRates;
  // 붙여넣기 UI 노출 여부 — parser 지원 원청만 (KA / crikrin). = partnerMode.
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
      // 가격 미기재 시 분기:
      //   · crikrin — 메시지에 가격 없는 게 표준 → quote_rates 자동 lookup.
      //   · KA      — 가격 누락 = 메시지 오류/비정상 ('70.0000' / '안시원함' 등) → 0 유지.
      //               사장님이 폼에서 직접 단가 입력. (autoTotal 측 form fallback 은 그대로 동작.)
      if (it.price == null && principalCode === "crikrin" && quoteRates && applianceLabel) {
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
    // paste prefill → 견적 sync 재개 (이전 사용자 수동값 폐기, 새 record 의 autoTotal 적용).
    setEstimateTouched(false);
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

  // KST YYYY-MM-DD (오늘/내일 자동 채움용)
  function ymdKst(daysOffset = 0) {
    const now = new Date();
    now.setDate(now.getDate() + daysOffset);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
  }
  function setScheduleToday() {
    setScheduleMode("today");
    setForm(prev => ({ ...prev, requestDate: ymdKst(0), requestTime: "" }));
  }
  function setScheduleTomorrow() {
    setScheduleMode("tomorrow");
    setForm(prev => ({ ...prev, requestDate: ymdKst(1), requestTime: "" }));
  }
  function setScheduleTbd() {
    setScheduleMode("tbd");
    setForm(prev => ({ ...prev, requestDate: "", requestTime: "" }));
  }
  function setScheduleInput() {
    setScheduleMode("input");
  }

  // 2026-06-06 — 지역(region) 추출 — extractRegion 사용 (구 > 시 > 군, 캡 6자, 특별/광역시 제외).
  //   옛 token-기반 매칭은 공백 없는 KA 주소 ('부천시원미로...') 에서 fallback=전체주소 사고.
  //   새 헬퍼는 lazy regex `\S+?(구|시|군)` 로 토큰 안에서도 첫 prefix 만 추출.
  const region = extractRegion(form.address);

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

  // effectiveTotal — partnerMode 측 form.estimateTotal(편집 가능) 우선, fallback autoTotal.
  //   유솔H 측 옛 동작 그대로 (hasRates ? autoTotal : form.estimateTotal).
  const effectiveTotal = pasteSupported
    ? (form.estimateTotal > 0 ? form.estimateTotal : autoTotal)
    : (hasRates ? autoTotal : (form.estimateTotal || 0));

  // 2026-06-06 partnerMode 전용 — 견적금액 auto-sync (autoTotal → form.estimateTotal).
  //   workItems 변경 시 합계 갱신. 단 estimateTouched(사용자 수동 편집) 면 sync 중단 —
  //   덮어쓰기 사고 방지. paste 새 record 적용(applyRecord) 시 touched 리셋 → 자동 sync 재개.
  //   ⚠️ 본 useEffect 는 반드시 `const autoTotal = useMemo(...)` 선언 후에 위치해야 함.
  //   deps 배열 측 autoTotal 읽기는 render 단계 동기 평가 → 선언 전이면 TDZ 사고 (2026-06-06).
  useEffect(() => {
    if (!pasteSupported) return;
    if (estimateTouched) return;
    if (autoTotal <= 0) return;
    setForm(prev => prev.estimateTotal === autoTotal ? prev : { ...prev, estimateTotal: autoTotal });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTotal, pasteSupported, estimateTouched]);

  async function handleSubmit() {
    const errs = {};
    if (!form.phone.trim()) errs.phone = "연락처 입력";
    if (!form.address.trim()) errs.address = "주소 입력";
    if (workItems.length === 0) errs.workItems = "작업 항목 1개 이상";
    if (pasteSupported) {
      // partnerMode: 견적금액 input 직접 입력. autoTotal fallback.
      const total = form.estimateTotal > 0 ? form.estimateTotal : autoTotal;
      if (total <= 0) errs.estimateTotal = "견적 입력";
      // 희망 일정 필수 — 4개 chip 중 1개도 선택 안 하면 차단. tbd 도 valid.
      if (scheduleMode == null) errs.schedule = "희망 일정 선택";
    } else {
      if (!hasRates && !priceTBD && (!form.estimateTotal || form.estimateTotal <= 0)) {
        errs.estimateTotal = "견적 입력";
      }
      if (hasRates && !priceTBD && autoTotal <= 0) {
        errs.estimateTotal = "기종 단가 확인";
      }
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const finalCustomer = autoGenerateCustomer(form, region);
    // 2026-06-06 partnerMode 4-button schedule: today/tomorrow/tbd/input.
    //   특정 날짜 있는 모드(today/tomorrow/input) → "specific" + 날짜 전송.
    const hasSpecificDate = (scheduleMode === "input" || scheduleMode === "today" || scheduleMode === "tomorrow");
    const scheduleType = hasSpecificDate ? "specific" : "tbd";

    // workItems 저장 형태 결정 — 두 경로
    //   (A) hasRates 모드: 각 row 별 quote 적용 + KA 1way 자동 분할
    //   (B) 유솔H 모드: head 1개 row에만 quote = unit_price = totalAmount/headQty (기존 동작)
    let workItemsToSave;
    let totalAmount;

    if (hasRates) {
      // 가격표 모드 — 자동 합계, 각 row 개별 단가.
      //   partnerMode: 사장님이 견적금액 input 직접 수정한 경우 form.estimateTotal 우선.
      totalAmount = priceTBD
        ? 0
        : (pasteSupported && form.estimateTotal > 0 ? form.estimateTotal : autoTotal);

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
        scheduledDate: hasSpecificDate ? (form.requestDate || null) : null,
        scheduledTime: hasSpecificDate ? (form.requestTime || null) : null,
        memo:          form.memo,
        status:        "미배정",
        scheduleType,
      };
      const res = await createTask(taskData, {
        changedBy:     user?.id || user?.user_id || null,
        changedByName: user?.name || null,
        changedByRole: "원청",
      });
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

  // 2026-06-06 — 입력 박스 크기 통일 키움 (어르신 가독성).
  //   옛 padding 10/12 + fontSize 13 → padding 12/14 + fontSize 14.
  //   모든 input/textarea 가 inputStyle 스프레드로 받으므로 한 곳 수정으로 전체 통일.
  //   견적 박스도 같은 크기 (특별히 크게 X).
  const inputStyle = (hasError) => ({
    width: "100%", padding: "12px 14px",
    background: t.bgInset,
    border: `1px solid ${hasError ? t.danger : t.border}`,
    borderRadius: 8, fontSize: 14, color: t.text,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  });

  // 2026-06-06 — partnerMode (KA/crikrin) 새 레이아웃.
  //   유솔H 측 옛 return JSX 는 아래에 그대로 보존 (회귀 0).
  //   변경 spec: 색 통일(앱 핑크) / 붙여넣기 접이식 / 필수 글자배지 /
  //              순서 재배치 / 견적 input 작게 + 자동 sync / 일정 4버튼(오늘/내일/미정/직접) /
  //              요청사항 항상 보임 / 추가정보(고객명+결제방식) 접이식.
  if (pasteSupported) {
    const hasPasteResults = Array.isArray(parsedRecords) && parsedRecords.length > 0;
    const showPaste = pasteOpen || hasPasteResults;   // 결과 있으면 자동 열림 (사용자 검토)
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

        <div style={{ padding: "12px 14px" }}>
          {/* (1) 붙여넣기 — 옵션 C: 2px dashed 핑크 박스. 기본 닫힘. 결과 있으면 자동 펼침.
              접힘: 가운데 정렬 클립보드 + 안내. 클릭하면 그 자리에 textarea 펼침.
              펼침: 같은 점선 박스 안에 textarea (점선 핑크) + 파싱 + records.
          */}
          {!showPaste ? (
            // 접힘: 옅은 회색 1px 박스. 핑크 클립보드 아이콘 + 핑크 텍스트, 가운데 정렬.
            <div
              onClick={() => setPasteOpen(true)}
              style={{
                border: `1px solid ${t.border}`,
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 12,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                cursor: "pointer",
                userSelect: "none",
                background: "transparent",
                color: accentColor,
                fontSize: 13, fontWeight: 700,
              }}
            >
              <ClipboardPaste size={16} style={{ color: accentColor }}/>
              <span>카톡·문자 붙여넣기</span>
            </div>
          ) : (
            // 펼침: 같은 회색 1px 박스. 헤더 (아이콘 + 텍스트, 가운데, 클릭 시 접힘). textarea 회색.
            <div style={{
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
              background: "transparent",
            }}>
              <div
                onClick={() => setPasteOpen(false)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  marginBottom: 10,
                  cursor: "pointer",
                  userSelect: "none",
                  color: accentColor,
                  fontSize: 13, fontWeight: 700,
                }}
              >
                <ClipboardPaste size={14} style={{ color: accentColor }}/>
                <span>카톡·문자 붙여넣기</span>
              </div>
              <textarea
                value={pasteText || ""}
                onChange={(e) => onPasteTextChange?.(e.target.value)}
                placeholder={principalCode === "KA" ? "카톡/문자 통째 — 빈 줄로 여러 건 자동 분리" : "메시지 1건 붙여넣기"}
                rows={6}
                style={{
                  width: "100%",
                  background: t.bgInset,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: t.text,
                  fontSize: 17,
                  minHeight: 160,
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, alignItems: "stretch" }}>
                <button
                  onClick={() => onParse?.(pasteText || "")}
                  disabled={!pasteText || !pasteText.trim()}
                  style={{
                    width: "100%",
                    height: 52,
                    padding: "0 14px",
                    background: accentColor,
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 18,
                    fontWeight: 700,
                    cursor: pasteText && pasteText.trim() ? "pointer" : "not-allowed",
                    opacity: pasteText && pasteText.trim() ? 1 : 0.5,
                    fontFamily: "inherit",
                  }}
                >자동채우기</button>
                {hasPasteResults && (
                  <span style={{ fontSize: 10, color: t.textMuted }}>
                    {parsedRecords.length}건 감지
                  </span>
                )}
              </div>
              {parsedRecords && parsedRecords.length === 1 && (
                <div style={{ marginTop: 10, fontSize: 10, color: t.textMuted }}>
                  ✓ 폼에 자동 채워졌습니다. 검토·수정 후 제출 버튼 클릭하세요.
                </div>
              )}
              {parsedRecords && parsedRecords.length > 1 && (
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
                          background: isActive ? "var(--accent-bg-strong)" : t.bg,
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
                              fontSize: 11, fontWeight: 700,
                              cursor: "pointer", flexShrink: 0, fontFamily: "inherit",
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

          {/* (2) 연락처 */}
          <FormSection t={t} accent={accentColor} icon="📞" label="연락처" required error={errors.phone}>
            <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
              placeholder="010-0000-0000" style={inputStyle(!!errors.phone)}/>
          </FormSection>

          {/* (3) 주소 */}
          <FormSection t={t} accent={accentColor} icon="📍" label="주소" required error={errors.address}>
            <input type="text" value={form.address} onChange={(e) => update("address", e.target.value)}
              placeholder="강남구 역삼동 123-45" style={inputStyle(!!errors.address)}/>
          </FormSection>

          {/* (4) 작업 항목 */}
          <FormSection t={t} accent={accentColor} icon="🔧" label="작업 항목" required error={errors.workItems}>
            {workItems.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {workItems.map((it, idx) => {
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
                          {it.workType} · {it.appliance || "(기종?)"} · {it.qty}대
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
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>수량</span>
                    <QtyStepper value={editItem.qty || 1} onChange={(n) => setEditField({ qty: n })}/>
                    <span style={{ fontSize: 11, color: t.textMuted }}>대</span>
                  </div>
                )}
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
                      <input type="number" min="0" value={editItem.unitPrice || ""}
                        onChange={(e) => { setEditPriceTouched(true); setEditItem(prev => ({ ...prev, unitPrice: parseInt(e.target.value) || 0 })); }}
                        placeholder="0" style={{ ...inputStyle(false), width: 140 }}/>
                      <span style={{ fontSize: 11, color: t.textMuted }}>원/대</span>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button onClick={addWorkItem} disabled={!editItem.workType || !editItem.appliance}
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

          {/* (5) 견적 금액 — 같은 크기 input. 작업항목 합계 자동 sync, 직접 편집 가능.
              숫자색만 핑크(accentColor) 강조 — 박스 크기는 다른 입력과 동일. */}
          <FormSection t={t} accent={accentColor} icon="💰" label="견적 금액" required error={errors.estimateTotal}>
            <input type="number" min="0"
              value={form.estimateTotal || ""}
              onChange={(e) => {
                // 사용자가 한 번 건드리면 더 이상 autoTotal 가 덮어쓰지 못 하게 잠금.
                setEstimateTouched(true);
                update("estimateTotal", parseInt(e.target.value) || 0);
              }}
              placeholder="0"
              style={{ ...inputStyle(!!errors.estimateTotal), color: accentColor, fontWeight: 800 }}/>
            <div style={{ fontSize: 10, color: t.textMuted, marginTop: 6 }}>
              {estimateTouched
                ? "직접 입력값 유지 중 (작업 항목 변경 시 자동 갱신 안 됨)."
                : "작업 항목 합계로 자동 채움. 수정 가능."}
            </div>
          </FormSection>

          {/* (6) 희망 일정 — 4 chip.
              · 오늘/내일 → 날짜만 자동 (시간 안 물어봄). chip 활성 + 안내 텍스트만.
              · 일정 미정 → 빈값 (TBD). 안내 텍스트만 — 필수 충족으로 인정.
              · 직접 입력 → 이 모드만 date + time input 노출.
              ⚠️ 필수 — 4개 중 1개도 선택 안 하면 제출 차단 (handleSubmit 측 검증).
          */}
          <FormSection t={t} accent={accentColor} icon="📅" label="희망 일정 (필수)" required error={errors.schedule}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <FormChip t={t} accent={accentColor} active={scheduleMode === "today"}    onClick={setScheduleToday}>오늘</FormChip>
              <FormChip t={t} accent={accentColor} active={scheduleMode === "tomorrow"} onClick={setScheduleTomorrow}>내일</FormChip>
              <FormChip t={t} accent={accentColor} active={scheduleMode === "tbd"}      onClick={setScheduleTbd}>일정 미정</FormChip>
              <FormChip t={t} accent={accentColor} active={scheduleMode === "input"}    onClick={setScheduleInput}>직접 입력</FormChip>
            </div>
            {scheduleMode === "today" && (
              <div style={{ marginTop: 8, fontSize: 11, color: t.textMuted }}>
                오늘 ({form.requestDate}) — 시간 미지정
              </div>
            )}
            {scheduleMode === "tomorrow" && (
              <div style={{ marginTop: 8, fontSize: 11, color: t.textMuted }}>
                내일 ({form.requestDate}) — 시간 미지정
              </div>
            )}
            {scheduleMode === "tbd" && (
              <div style={{ marginTop: 8, fontSize: 11, color: t.textMuted }}>
                일정 미정 — 추후 협의
              </div>
            )}
            {scheduleMode === "input" && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input type="date" value={form.requestDate}
                  onChange={(e) => update("requestDate", e.target.value)}
                  style={{ ...inputStyle(false), flex: 1 }}/>
                <input type="time" value={form.requestTime}
                  onChange={(e) => update("requestTime", e.target.value)}
                  style={{ ...inputStyle(false), flex: 1 }}/>
              </div>
            )}
          </FormSection>

          {/* (7) 요청사항 — 항상 보임 */}
          <FormSection t={t} accent={accentColor} icon="📝" label="요청사항">
            <textarea value={form.memo} onChange={(e) => update("memo", e.target.value)}
              placeholder="추가 요청사항" rows={3}
              style={{ ...inputStyle(false), resize: "vertical", lineHeight: 1.5 }}/>
          </FormSection>

          {/* (8) 추가 정보 — 접이식 (기본 닫힘): 고객명, 결제방식 */}
          <CollapsibleHeader
            t={t}
            open={extraOpen}
            onToggle={() => setExtraOpen(o => !o)}
            icon="📌"
            title="추가 정보"
          />
          {extraOpen && (
            <>
              <FormSection t={t} accent={accentColor} icon="👤" label="고객명">
                <input type="text" value={form.customer}
                  onChange={(e) => update("customer", e.target.value)}
                  placeholder={`자동: ${autoGenerateCustomer(form, region)}`}
                  style={inputStyle(false)}/>
                <div style={{ fontSize: 10, color: t.textMuted, marginTop: 6 }}>
                  비워두면 지역 + 전화 끝 4자리로 자동 생성.
                </div>
              </FormSection>
              <FormSection t={t} accent={accentColor} icon="💳" label="결제 방식">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PAYMENT_METHOD_OPTIONS.map(p => (
                    <FormChip t={t} accent={accentColor} key={p.id}
                      active={form.paymentMethod === p.id}
                      onClick={() => update("paymentMethod", form.paymentMethod === p.id ? "" : p.id)}
                    >{p.label}</FormChip>
                  ))}
                </div>
              </FormSection>
            </>
          )}

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
              {submitting ? "저장 중..." : (effectiveTotal > 0
                ? `${effectiveTotal.toLocaleString()}원 — 접수 등록하기`
                : "접수 등록하기")}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // 유솔H — 옛 JSX (회귀 0 — 무수정).
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
              padding: "10px 12px",
              color: t.text,
              fontSize: 17,
              minHeight: 160,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, alignItems: "stretch" }}>
            <button
              onClick={() => onParse?.(pasteText || "")}
              disabled={!pasteText || !pasteText.trim()}
              style={{
                width: "100%",
                height: 52,
                padding: "0 14px",
                background: accentColor,
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 18,
                fontWeight: 700,
                cursor: pasteText && pasteText.trim() ? "pointer" : "not-allowed",
                opacity: pasteText && pasteText.trim() ? 1 : 0.5,
                fontFamily: "inherit",
              }}
            >자동채우기</button>
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
                      background: isActive ? "var(--accent-bg-strong)" : t.bg,
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
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>수량</span>
                  <QtyStepper value={editItem.qty || 1} onChange={(n) => setEditField({ qty: n })}/>
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
function FormSection({ t, accent = "var(--accent)", icon, label, required, error, children }) {
  // 2026-06-06 — 필수 표시: 텍스트 배지/별표 제거 → 박스 테두리 색으로 통일.
  //   error 우선 (빨강) > required (핑크) > 회색.
  //   필수/에러 시 테두리 두께 2px (선택 1px) — 사장님 spec "조금만" 두껍게.
  const borderColor = error ? t.danger : (required ? accent : t.border);
  const borderWidth = (error || required) ? 2 : 1;
  return (
    <div style={{
      marginBottom: 12,
      background: t.bgElevated,
      border: `${borderWidth}px solid ${borderColor}`,
      borderRadius: 10, padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>{label}</span>
        {error && <span style={{ marginLeft: "auto", fontSize: 10, color: t.danger, fontWeight: 700 }}>{error}</span>}
      </div>
      {children}
    </div>
  );
}

// 2026-06-06 — 접이식 섹션 헤더 (붙여넣기 / 추가정보 등).
function CollapsibleHeader({ t, open, onToggle, icon, title, hint }) {
  return (
    <div onClick={onToggle} style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 14px",
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      cursor: "pointer",
      marginBottom: open ? 8 : 12,
      userSelect: "none",
    }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: t.text }}>{title}</div>
        {hint && <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{hint}</div>}
      </div>
      <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>{open ? "▲" : "▼"}</span>
    </div>
  );
}

// 2026-06-06 — 모바일용 수량 스테퍼.
//   [−] N [+]  / − = #2C2C2E / + = var(--accent) / 숫자 흰색 / 40×40 라운드.
//   가운데 숫자 탭 → inline number input 측 측 (select-all, blur/Enter 측 측 측 복귀).
//   min=1 (− 1 측 비활성), max=99 (대량 현장 대응 — 99 측 + 비활성).
function QtyStepper({ value, onChange, min = 1, max = 99 }) {
  const safeValue = Math.max(min, Math.min(max, Number(value) || min));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(safeValue));
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = (raw) => {
    const n = parseInt(raw, 10);
    const clamped = Math.max(min, Math.min(max, isNaN(n) ? min : n));
    onChange(clamped);
    setDraft(String(clamped));
    setEditing(false);
  };

  const dec = () => { if (safeValue > min) onChange(safeValue - 1); };
  const inc = () => { if (safeValue < max) onChange(safeValue + 1); };

  const btnBase = {
    width: 40, height: 40, borderRadius: 999,
    border: "none", cursor: "pointer", fontFamily: "inherit",
    fontSize: 20, fontWeight: 700, color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button type="button" onClick={dec} disabled={safeValue <= min}
        style={{
          ...btnBase,
          background: "#2C2C2E",
          opacity: safeValue <= min ? 0.4 : 1,
          cursor: safeValue <= min ? "not-allowed" : "pointer",
        }}
        aria-label="감소"
      >−</button>
      {editing ? (
        <input
          ref={inputRef}
          type="number" inputMode="numeric" pattern="[0-9]*"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(draft); }
            if (e.key === "Escape") { setDraft(String(safeValue)); setEditing(false); }
          }}
          style={{
            width: 56, height: 40, minWidth: 56,
            textAlign: "center", fontSize: 18, fontWeight: 800,
            color: "#fff", background: "#1C1C1E",
            border: "1px solid var(--accent)", borderRadius: 8,
            outline: "none", fontFamily: "inherit",
            MozAppearance: "textfield",
          }}
        />
      ) : (
        <button type="button"
          onClick={() => { setDraft(String(safeValue)); setEditing(true); }}
          style={{
            minWidth: 40, height: 40, padding: "0 8px",
            background: "transparent", border: "none",
            fontSize: 18, fontWeight: 800, color: "#fff",
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          aria-label="수량 직접 입력"
        >{safeValue}</button>
      )}
      <button type="button" onClick={inc} disabled={safeValue >= max}
        style={{
          ...btnBase,
          background: "var(--accent)",
          opacity: safeValue >= max ? 0.4 : 1,
          cursor: safeValue >= max ? "not-allowed" : "pointer",
        }}
        aria-label="증가"
      >+</button>
    </div>
  );
}

function FormChip({ t, accent = "var(--accent)", active, onClick, children }) {
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

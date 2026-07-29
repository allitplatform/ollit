// 2026-06-17 — PC 새 접수 폼 (Stage 2).
//   모바일 NewReceptionFormScreen (AdminApp.jsx) 와 동일한 onSubmit 시그니처.
//   레이아웃: ≥1280px 2단(좌 기본정보+일정·결제 / 우 작업항목+견적+미리보기) / 1024~1280 단열.
//
// 공유 헬퍼: src/utils/receptionForm.js (Stage 1 추출).
// 공유 lookup: src/components/principal/NewReceptionScreenLite.jsx (lookupRate, WORK_TYPE_TO_SERVICE).
// 분배 미리보기: src/lib/commissionPoliciesDb.js (calculateCommissionMultiRpc).
//
// V1 미포함 (Phase 2 예정):
//   · 카톡 자동 파싱 (parseKakaoText) — 텍스트 영역만 두고 수동 입력
//   · 원청별 붙여넣기 파서 (parsePartnerPaste)
//   · KA 원본 자유 텍스트 파서 (parseKaText)
//
// 가드 (모바일과 동일 + Mig 138 appliance_required):
//   · 원청 미선택 / 연락처·주소 빈값 / 작업항목 0건
//   · 기종 필수 작업유형(세척/냉매/추가선택/냉매점검)에서 기종 누락
//   · 수량 ≤ 0 / TBD 아닌데 견적 0

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { useMinWidth } from "../../utils/useIsPc.js";
import { supabase } from "../../lib/supabase.js";
import {
  PRINCIPALS, PRINCIPAL_NAME_TO_CODE,
  WORK_TYPES, formatWorkTypeLabel,
  splitWorkItemsForKa1way,
  getAppliancePool,
  // 2026-06-17 Phase 2 — 카톡/KA 파서 (모바일 폼과 공유, Stage 1 확장).
  parseKakaoText, formatPhone,
} from "../../utils/receptionForm.js";
import { lookupRate, autoGenerateCustomer } from "../principal/NewReceptionScreenLite.jsx";
import { calculateCommissionMultiRpc } from "../../lib/commissionPoliciesDb.js";
// 2026-06-17 — 실제 DB INSERT (모바일 폼과 동일 어댑터). 이전엔 호출 누락 사고 (in-memory only).
import { createTaskAdapter as apiCreateTask } from "../../data/tasksDb.js";
// 2026-06-17 Phase 2 — 원청별 붙여넣기 파서 (KA/crikrin 주문 텍스트).
import { parsePartnerPaste, APPLIANCE_CODE_TO_LABEL, extractRegion } from "../../utils/partnerPasteParser.js";
// 2026-07-15 — 도로명·동 사전 fallback + 지역 수동 선택 목록
import { parseRegion } from "../../utils/regionParser.js";
// 2026-07-15 — 정부 주소 API fallback (사전으로 못 뽑는 도로명 → 시군구)
import { resolveAddressDistrict } from "../../lib/jusoApi.js";
import { ALL_REGIONS } from "../../data/engineers.js";

// formatPhone 은 receptionForm.js 에서 import (DRY).
function fmtKRW(n) { return `₩${(Number(n) || 0).toLocaleString("ko-KR")}`; }

// 2026-06-17 — local extractRegion(buggy regex) 제거 → partnerPasteParser.extractRegion 사용.
//   사고: "서초구신반포로45길71" → "초구" (앞 글자 잘림). 시/도 prefix 없는 모든 주소 영향.
//   원인: regex `[가-힣]+...([가-힣]+(?:구|시|군))` outer [가-힣]+ 이 첫 글자 강제 소비.
//   교체: 사전 기반 (서울 25구 + 전국 시/군/구 + stem + 동 시드, length desc) lookup +
//          stripProvincePrefix + lazy fallback. NewReceptionScreenLite 운영 검증된 구현.

const PAYMENT_METHODS = [
  { id: "naver_pay", label: "네이버페이" },
  { id: "cash",      label: "현금" },
  { id: "card",      label: "카드" },
  { id: "transfer",  label: "계좌이체" },
  { id: "prepaid",   label: "선결제" },
];

export function NewReceptionPcForm({ t, user, onBack, onSubmit, initial }) {
  const isWide = useMinWidth(1280);

  // 2026-06-24 — initial prop 으로 prefill 지원 (접수함 → 작업 전환 흐름).
  const init = initial || {};

  // ── 폼 상태 ──
  const [form, setForm] = useState({
    principal:     init.principal     || "",
    customer:      init.customer      || "",
    phone:         init.phone         || "",
    address:       init.address       || "",
    paymentMethod: init.paymentMethod || "",
    requestDate:   init.requestDate   || "",
    requestTime:   init.requestTime   || "",
    memo:          init.memo          || "",
    estimateTotal: init.estimateTotal || 0,
    // 2026-07-11 — 사장님 spec: 종목(workType) 보존. 홈페이지 전환 시 init.workType 넘어옴.
    //   workItems 비어있어도 root 에 남겨 taskData 저장 시 categoryData.workType 로 저장.
    workType:      init.workType      || "",
  });
  const [scheduleMode, setScheduleMode] = useState(null);    // null | 'tbd' | 'input'
  const [priceTBD, setPriceTBD] = useState(false);
  // 2026-07-11 — 사장님 spec: 기종 미정 체크 (홈페이지 전환 등 workItems 비어있는 상황).
  //   init.applianceUndecided true 로 넘어오면 기본 체크 (홈페이지 전환 흐름).
  const [applianceUndecided, setApplianceUndecided] = useState(init.applianceUndecided === true);
  const [estimateTouched, setEstimateTouched] = useState(false);
  const [workItems, setWorkItems] = useState(Array.isArray(init.workItems) ? init.workItems : []);
  const [editItem, setEditItem] = useState({ workType: "", appliance: "", qty: 1 });
  const [pasteText, setPasteText] = useState("");
  const [parseResult, setParseResult] = useState(null);  // { matched: [], unmatched: [] } | null

  const [quoteRates, setQuoteRates] = useState(null);
  const [autoEstimateValue, setAutoEstimateValue] = useState(null);

  const [feePreview, setFeePreview] = useState(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState("");

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // 2026-07-15 — 지역 추출 2단계 + 수동 보정 (사장님 spec).
  //   ① extractRegion (구/시/군 직접 매칭) ② 실패 시 parseRegion (도로명·동 사전)
  //   ③ 그래도 구/시가 아니면 운영자가 직접 선택 (regionOverride).
  const [regionOverride, setRegionOverride] = useState("");
  // ④ 정부 주소 API 결과 (사전 실패 시 비동기 fallback — jusoApi.js)
  const [regionApi, setRegionApi] = useState("");
  const regionAuto = useMemo(() => {
    const r1 = extractRegion(form.address);
    if (r1 && /[구시군]$/.test(r1)) return r1;
    try {
      const r2 = parseRegion(form.address);
      if (r2 && r2.sigungu) return r2.sigungu;
    } catch (_e) { /* 사전 파서 실패 무시 */ }
    return r1 || "";
  }, [form.address]);
  const dictBad = !regionAuto || !/[구시군]$/.test(regionAuto);
  // 사전 실패 + 주소 충분히 입력 → 0.6초 디바운스 후 주소 API 조회
  useEffect(() => {
    setRegionApi("");
    if (!dictBad) return;
    const addr = String(form.address || "").trim();
    if (addr.length < 6) return;
    let alive = true;
    const timer = setTimeout(async () => {
      const res = await resolveAddressDistrict(addr);
      if (alive && res.ok && res.sgg) setRegionApi(res.sgg);
    }, 600);
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.address, dictBad]);
  const regionBad = dictBad && !regionApi;
  const region = regionOverride || (dictBad ? (regionApi || regionAuto) : regionAuto);

  // ── 원청 변경 시 quote_rates fetch ──
  useEffect(() => {
    const code = PRINCIPAL_NAME_TO_CODE[form.principal];
    if (!code) { setQuoteRates(null); return; }
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("principals")
        .select("code, quote_rates")
        .eq("code", code)
        .maybeSingle();
      if (!alive) return;
      if (error) { setQuoteRates(null); return; }
      setQuoteRates(data?.quote_rates || null);
    })();
    return () => { alive = false; };
  }, [form.principal]);

  // ── 자동 견적 ──
  useEffect(() => {
    if (estimateTouched || priceTBD) return;
    const code = PRINCIPAL_NAME_TO_CODE[form.principal];
    if (!code || !quoteRates || workItems.length === 0) {
      setAutoEstimateValue(null);
      return;
    }
    let total = 0;
    let everyOk = true;
    for (const it of workItems) {
      const r = lookupRate({
        principalCode: code, quoteRates,
        workType: it.workType, appliance: it.appliance, qty: it.qty,
      });
      if (!r || r.unitPrice === 0) { everyOk = false; break; }
      if (r.isKa1waySplit) {
        total += r.firstPrice + Math.max(0, (it.qty || 1) - 1) * r.extraPrice;
      } else {
        total += r.unitPrice * (it.qty || 1);
      }
    }
    if (!everyOk || total <= 0) {
      setAutoEstimateValue(null);
      return;
    }
    setAutoEstimateValue(total);
    setForm(prev => prev.estimateTotal === total ? prev : { ...prev, estimateTotal: total });
  }, [form.principal, workItems, quoteRates, estimateTouched, priceTBD]);

  // ── 분배 미리보기 (유솔N 제외, debounce 500ms) ──
  useEffect(() => {
    if (!form.principal || workItems.length === 0 || !form.estimateTotal) {
      setFeePreview(null); setFeeError(""); return;
    }
    if (form.principal === "유솔홈케어 N") { setFeePreview(null); return; }
    if (!workItems.every(i => i.workType && i.appliance)) {
      setFeePreview(null); return;
    }
    setFeeLoading(true); setFeeError("");
    const timer = setTimeout(async () => {
      try {
        const result = await calculateCommissionMultiRpc({
          principalName: form.principal,
          workItems,
          totalEstimate: form.estimateTotal,
          totalExtra: 0, totalNaverFee: 0,
        });
        if (result.skip)        setFeePreview({ skip: true, message: result.message });
        else if (result.error)  { setFeeError(result.error); setFeePreview(null); }
        else setFeePreview({
          ok: true,
          engineer:  result.engineer_amount,
          principal: result.principal_amount,
          company:   result.company_margin,
          calcMethod: result.calc_method,
        });
      } catch (e) {
        setFeeError(e.message || "분배 계산 실패");
        setFeePreview(null);
      } finally {
        setFeeLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.principal, form.estimateTotal, workItems]);

  // 2026-06-17 — 자동 채우기: 원청별 파서 우선 + parseKakaoText fallback.
  //   1) form.principal 이 KA/crikrin 이면 parsePartnerPaste 시도
  //      · 1건 + 의미있는 데이터 (items≥1 또는 phone) 있으면 prefill 후 return
  //      · 빈약하면 (items=0 + phone=null) fallback 으로 계속 진행
  //   2) parseKakaoText (일반 카톡 — KA "가.충" 패턴 자동 위임 포함)
  //
  // ⚠️ 2026-06-17 정정: parsePartnerPaste 반환 필드명 정합 (1a7e10c 버그):
  //   · rec.customerName (rec.customer X)
  //   · rec.items[] {appliance, qty, price} → workItems[] {workType, appliance, qty} 변환
  //   · estimateTotal 은 items.price 합산 (parsePartnerPaste 가 따로 안 줌)
  //   · memo = desiredText + memo 합침
  function handleAutoFill() {
    if (!pasteText.trim()) return;

    // 1) 원청별 파서 (KA/crikrin 주문 텍스트)
    const principalCode = PRINCIPAL_NAME_TO_CODE[form.principal];
    if (principalCode === "KA" || principalCode === "crikrin") {
      try {
        const recs = parsePartnerPaste(pasteText, principalCode);
        if (Array.isArray(recs) && recs.length === 1) {
          const rec = recs[0];
          const hasMeaningfulData = (Array.isArray(rec.items) && rec.items.length > 0) || !!rec.phone;
          if (hasMeaningfulData) {
            const computedEstimate = Array.isArray(rec.items)
              ? rec.items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0)
              : 0;
            const memoCombined = [rec.desiredText, rec.memo].filter(Boolean).join(" ").trim();
            setForm(prev => ({
              ...prev,
              customer:      rec.customerName || prev.customer,
              phone:         rec.phone        || prev.phone,
              address:       rec.address      || prev.address,
              memo:          memoCombined     || prev.memo,
              estimateTotal: computedEstimate > 0 ? computedEstimate : prev.estimateTotal,
            }));
            // items → workItems (shape 변환). appliance null 인 건 (parser 안전망)은 제외.
            // appliance code (wall/stand/4way/...) → label (벽걸이/스탠드/4way/...) 변환.
            // 미매핑 코드는 원본 보존 (사용자가 드롭다운에서 수동 선택 가능).
            const wt = rec.workType || "냉매충전";
            const wis = (rec.items || [])
              .filter(it => it.appliance)
              .map(it => ({
                workType: wt,
                appliance: APPLIANCE_CODE_TO_LABEL[it.appliance] || it.appliance,
                qty: Math.max(1, Number(it.qty) || 1),
              }));
            if (wis.length > 0) setWorkItems(wis);
            if (computedEstimate > 0) setEstimateTouched(true);
            setParseResult({
              matched: [
                `원청별 (${principalCode})`,
                ...(wis.length > 0 ? [`기종 ${wis.length}건`] : []),
                ...(rec.phone ? ["연락처"] : []),
                ...(rec.address ? ["주소"] : []),
                ...(computedEstimate > 0 ? ["금액"] : []),
              ],
              unmatched: [],
            });
            return;
          }
          // hasMeaningfulData=false → fallback 카톡 파서로
        }
      } catch (_) { /* fallback 카톡 파서로 */ }
    }

    // 2) 일반 카톡 파서 (parseKakaoText — KA "가.충" 패턴 자동 위임 포함)
    const r = parseKakaoText(pasteText);
    setForm(prev => {
      const next = { ...prev };
      if (r.principal)   next.principal = r.principal;
      if (r.phone)       next.phone = r.phone;
      if (r.customer)    next.customer = r.customer;
      if (r.address)     next.address = r.address;
      if (r.requestDate) next.requestDate = r.requestDate;
      if (r.requestTime) next.requestTime = r.requestTime;
      if (r.memo)        next.memo = r.memo;
      if (r.estimatedPrice && !r.priceNeedsConfirm) {
        next.estimateTotal = r.estimatedPrice;
        setEstimateTouched(true);
      }
      return next;
    });
    if (Array.isArray(r.workItems) && r.workItems.length > 0) {
      setWorkItems(r.workItems);
    }
    if (r.requestDate || r.requestTime) {
      setScheduleMode("input");
    }

    // 미인식 계산
    const allKnown = ["원청", "이름", "연락처", "주소", "작업 종류", "기종", "일정", "금액"];
    const matchedSet = new Set((r.matched || []).map(m => m.split(" ")[0]));
    const unmatched = allKnown.filter(k => !matchedSet.has(k));
    setParseResult({ matched: r.matched || [], unmatched });
  }

  // ── 작업항목 조작 ──
  function addWorkItem() {
    if (!editItem.workType) { setErrors(p => ({ ...p, addItem: "작업유형을 선택하세요." })); return; }
    if (requiresApplianceFor(editItem.workType) && !editItem.appliance) {
      setErrors(p => ({ ...p, addItem: "기종을 선택하세요 (필수)." }));
      return;
    }
    if (!editItem.qty || editItem.qty < 1) {
      setErrors(p => ({ ...p, addItem: "수량은 1 이상이어야 합니다." }));
      return;
    }
    setWorkItems(prev => [...prev, { ...editItem }]);
    setEditItem({ workType: "", appliance: "", qty: 1 });
    setErrors(p => ({ ...p, addItem: null }));
    setEstimateTouched(false);  // 추가 시 자동 견적 재계산 허용
  }
  function removeWorkItem(idx) {
    setWorkItems(prev => prev.filter((_, i) => i !== idx));
    setEstimateTouched(false);
  }
  function updateWorkItem(idx, patch) {
    setWorkItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
    setEstimateTouched(false);
  }

  // ── 제출 ──
  async function handleSubmit() {
    setSubmitError(""); setErrors({});
    const errs = {};
    if (!form.principal) errs.principal = "원청을 선택하세요.";
    if (!form.phone || form.phone.replace(/\D/g, "").length < 9) errs.phone = "연락처를 입력하세요.";
    if (!form.address) errs.address = "주소를 입력하세요.";
    // 2026-07-11 — 사장님 spec: workItems 비어있으면 '기종 미정' 체크 필수.
    if (workItems.length === 0 && !applianceUndecided) {
      errs.workItems = "작업항목을 1개 이상 추가하거나 '기종 미정'을 체크하세요.";
    }
    // 2026-07-12 — 사장님 spec: 기종 미정 + workItems 비었으면 종목(workType) 은 필수.
    //   저장 후 기사앱 기종선택 배너가 종목 문자열로 기종 목록 결정 (냉매충전/세척 등).
    //   종목 없으면 '기타/기타' 사고 재발 → 명시적 차단.
    if (workItems.length === 0 && applianceUndecided && !form.workType) {
      errs.workType = "'기종 미정' 체크 시 종목(세척/냉매충전/설치/누설/누수)을 선택하세요.";
    }
    // 2026-07-10 — appliance="" 저장 사고 방지 (A-260710-003 등 policy_not_found 원인).
    //   냉매충전 대상 명시적 메시지 (카톡 파싱이 기종 미인식 시 "" 세팅).
    for (const it of workItems) {
      if (!requiresApplianceFor(it.workType)) continue;
      if (!it.appliance || String(it.appliance).trim() === "") {
        errs.workItems = it.workType === "냉매충전"
          ? "냉매충전 기종(벽걸이/스탠드/4way/투인원/1way)을 선택하세요."
          : `기종이 비어있는 작업 항목이 있습니다 (${it.workType}).`;
        break;
      }
    }
    if (!priceTBD && (!form.estimateTotal || form.estimateTotal <= 0)) {
      errs.estimateTotal = "견적금액을 입력하거나 '견적 미정'을 체크하세요.";
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const finalCustomer = autoGenerateCustomer(form, region);
      const splitItems = splitWorkItemsForKa1way(workItems, form.principal);
      const head = splitItems[0] || { workType: "", appliance: "", qty: 1 };
      const scheduleType = scheduleMode === "input" ? "input" : "tbd";

      // 2026-06-17 — 실제 DB INSERT (모바일 폼 패턴 그대로). 이전 코드는 onSubmit 만 호출 →
      //   AdminApp.addReception 이 sync in-memory state 갱신 + UI 알림만 발사 → DB row 0건.
      //   사고: PC 제출 시 화면엔 등록된 듯 보이나 새로고침 시 작업 소실, 운영자 인지 못함.
      const taskData = {
        principal:     form.principal,
        paymentMethod: form.paymentMethod || null,
        customer:      finalCustomer,
        phone:         form.phone,
        address:       form.address,
        region,
        // 2026-07-11 — 사장님 spec: workItems 비어있어도 종목(workType) 보존 (홈페이지 전환).
        workType:      head.workType || form.workType || "",
        appliance:     head.appliance,
        qty:           head.qty || 1,
        // 2026-07-27 — 설치/누설 + 기종미정: 빈 workItems 로 저장되면 task_items 가
        //   영원히 안 생겨 분배 0 (A-260726-027/035 사고). 설치·누설은 기종이 정산에
        //   불필요하므로 "종목 ×1 · 단가 0" 한 줄을 실어 보냄 → sync 트리거가 항목 생성.
        // 2026-07-29 — 사장님 지시: 종목 제한 해제. 세척/냉매도 같은 사고가 나므로
        //   "기종미정 + 항목 0" 이면 종목 무관하게 자리표시 한 줄을 항상 만든다.
        //   appliance "(미정)" 은 placeholder 로 인식돼 기사앱 [기종 선택] 배너가 계속 뜨고,
        //   ApplianceSelectModal.handleSave 가 workItems 배열을 통째로 교체하므로
        //   기사가 기종을 고르면 이 자리표시 줄은 깨끗이 덮인다.
        workItems:     (splitItems.length === 0 && applianceUndecided && !!form.workType)
          ? [{ workType: form.workType, appliance: "(미정)", qty: 1, quote: 0 }]
          : splitItems,
        // 2026-07-11 — 사장님 spec: 기종 미정 플래그 (category_data 저장).
        applianceUndecided: workItems.length === 0 && applianceUndecided,
        __log_note:    "see console [NewReceptionPc SAVE]",
        quote:         priceTBD ? 0 : (form.estimateTotal || 0),
        estimateTotal: priceTBD ? 0 : (form.estimateTotal || 0),
        workDate:      scheduleMode === "input" ? form.requestDate : "",
        scheduledDate: scheduleMode === "input" ? form.requestDate : "",
        scheduledTime: scheduleMode === "input" ? form.requestTime : "",
        memo:          form.memo,
        status:        "미배정",
      };
      // 2026-07-11 — 진단 로그 (사장님 실제 저장 값 검증).
      console.log("[NewReceptionPc SAVE]", {
        head_workType: head.workType, form_workType: form.workType,
        final_workType: taskData.workType,
        applianceUndecided: taskData.applianceUndecided,
        workItems_count: (taskData.workItems || []).length,
      });
      delete taskData.__log_note;
      const res = await apiCreateTask(taskData, {
        changedBy:     user?.user_id || user?.id || null,
        changedByName: user?.name || null,
        changedByRole: "운영자",
      });
      if (!res.ok) {
        setSubmitError(res.error || "등록 실패 — 다시 시도하세요.");
        setSubmitting(false);
        return;
      }
      onSubmit && onSubmit({
        ...form,
        customer:      finalCustomer,
        region,
        workItems:     splitItems,
        scheduleType,
        estimateTotal: priceTBD ? 0 : (form.estimateTotal || 0),
        quote:         priceTBD ? 0 : (form.estimateTotal || 0),
        workDate:      scheduleMode === "input" ? form.requestDate : "",
        scheduledDate: scheduleMode === "input" ? form.requestDate : "",
        scheduledTime: scheduleMode === "input" ? form.requestTime : "",
        status:        "미배정",
        taskId:        res.taskId,
        _v14ApiOk:     true,
      });
    } catch (e) {
      setSubmitError(e.message || "제출 중 오류");
      setSubmitting(false);
    }
  }

  // ──────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: t.bg, color: t.text,
      fontFamily: "'Pretendard', sans-serif",
      paddingBottom: 60,
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 24px", borderBottom: `1px solid ${t.border}`,
        background: t.bgElevated, position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={iconBtnStyle(t)} aria-label="뒤로">
          <ArrowLeft size={18}/>
        </button>
        <span style={{ fontSize: 17, fontWeight: 800, color: t.text }}>새 작업 만들기</span>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>PC 폼</span>
        <div style={{ flex: 1 }}/>
        <button onClick={handleSubmit} disabled={submitting} style={primaryBtnStyle(t)}>
          {submitting ? "저장 중..." : "✓ 작업 만들기"}
        </button>
      </div>

      {/* 상단 paste 영역 + 자동 채우기 + 결과 표시 */}
      <div style={{ padding: "16px 24px 8px", maxWidth: 1400, margin: "0 auto" }}>
        <PasteArea t={t}
          text={pasteText}
          onChange={setPasteText}
          onAutoFill={handleAutoFill}
          parseResult={parseResult}
          principalCode={PRINCIPAL_NAME_TO_CODE[form.principal] || null}
        />
      </div>

      {/* 좌/우 2단 (≥1280px) 또는 단열 (<1280) */}
      <div style={{
        padding: "8px 24px",
        maxWidth: 1400, margin: "0 auto",
        display: "grid",
        gridTemplateColumns: isWide ? "minmax(0, 1fr) minmax(0, 1.2fr)" : "minmax(0, 1fr)",
        gap: 20, alignItems: "start",
      }}>
        {/* ─── 좌측 ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 원청 */}
          <Card t={t} title="원청 *" error={errors.principal}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PRINCIPALS.map(p => {
                const active = form.principal === p.id;
                return (
                  <button key={p.id} type="button"
                    onClick={() => setForm(prev => ({ ...prev, principal: p.id }))}
                    style={{
                      padding: "8px 14px",
                      background: active ? p.color : "transparent",
                      border: `2px solid ${active ? p.color : t.border}`,
                      borderRadius: 999,
                      color: active ? "#fff" : t.text,
                      fontSize: 12, fontWeight: active ? 800 : 600,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>{p.label}</button>
                );
              })}
            </div>
          </Card>

          {/* 연락처 + 고객명 (2열) */}
          <Card t={t} title="고객 정보" error={errors.phone || errors.address}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <Field t={t} label="연락처 *">
                <input type="tel" value={form.phone}
                  onChange={(e) => setForm(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                  placeholder="010-0000-0000" style={inputStyle(t)}/>
              </Field>
              <Field t={t} label="고객명 (선택 — 비면 자동 생성)">
                <input type="text" value={form.customer}
                  onChange={(e) => setForm(p => ({ ...p, customer: e.target.value }))}
                  placeholder={region ? `${region} 고객` : ""} style={inputStyle(t)}/>
              </Field>
            </div>
            <Field t={t} label="주소 *">
              <input type="text" value={form.address}
                onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder="도로명 주소" style={inputStyle(t)}/>
            </Field>
            {region && !regionBad && !regionOverride && (
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                지역 자동{dictBad && regionApi ? " (주소 API)" : ""}: <span style={{ color: t.text, fontWeight: 700 }}>{region}</span>
              </div>
            )}
            {/* 2026-07-15 — 주소에서 구/시를 못 뽑으면 직접 선택 (사장님 spec: "삼양로" 저장 사고 방지) */}
            {form.address && (regionBad || regionOverride) && (
              <div style={{ marginTop: 6 }}>
                {regionBad && !regionOverride && (
                  <div style={{ fontSize: 11, color: "#FF3B5C", marginBottom: 4 }}>
                    ⚠️ 주소에서 지역(구·시)을 못 찾았어요{regionAuto ? ` — "${regionAuto}"로 저장되면 기사 매칭이 안 돼요` : ""}. 직접 선택:
                  </div>
                )}
                <select
                  value={regionOverride}
                  onChange={(e) => setRegionOverride(e.target.value)}
                  style={{ ...inputStyle(t), maxWidth: 220 }}
                >
                  <option value="">지역 선택…</option>
                  {ALL_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {regionOverride && (
                  <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 8 }}>
                    지역: <b style={{ color: t.text }}>{regionOverride}</b> 로 저장
                  </span>
                )}
              </div>
            )}
          </Card>

          {/* 일정 + 결제 */}
          <Card t={t} title="일정·결제">
            <div style={{ marginBottom: 10 }}>
              <SectionLabel t={t} text="결제 방법"/>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {PAYMENT_METHODS.map(pm => {
                  const active = form.paymentMethod === pm.id;
                  return (
                    <button key={pm.id} type="button"
                      onClick={() => setForm(p => ({ ...p, paymentMethod: active ? "" : pm.id }))}
                      style={chipStyle(t, active)}>
                      {pm.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <SectionLabel t={t} text="희망 일정"/>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button type="button" onClick={() => setScheduleMode("tbd")}
                  style={chipStyle(t, scheduleMode === "tbd")}>일정 미정</button>
                <button type="button" onClick={() => setScheduleMode("input")}
                  style={chipStyle(t, scheduleMode === "input")}>지정</button>
              </div>
              {scheduleMode === "input" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Field t={t} label="희망일">
                    <input type="date" value={form.requestDate}
                      onChange={(e) => setForm(p => ({ ...p, requestDate: e.target.value }))}
                      style={inputStyle(t)}/>
                  </Field>
                  <Field t={t} label="희망 시간 (예: 14:00 / 오전)">
                    <input type="text" value={form.requestTime}
                      onChange={(e) => setForm(p => ({ ...p, requestTime: e.target.value }))}
                      placeholder="14:00" style={inputStyle(t)}/>
                  </Field>
                </div>
              )}
            </div>
          </Card>

          {/* 요청사항 */}
          <Card t={t} title="요청사항 (선택)">
            <textarea value={form.memo}
              onChange={(e) => setForm(p => ({ ...p, memo: e.target.value.slice(0, 200) }))}
              rows={3}
              placeholder="특수 요청 사항 (200자 이내)"
              style={{ ...inputStyle(t), resize: "vertical", fontFamily: "inherit" }}/>
            <div style={{ fontSize: 10, color: t.textMuted, textAlign: "right", marginTop: 2 }}>
              {form.memo.length}/200
            </div>
          </Card>
        </div>

        {/* ─── 우측 ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 작업항목 표 */}
          <Card t={t} title={`작업항목 * (${workItems.length}건)`} error={errors.workItems}>
            <WorkItemsTable t={t}
              items={workItems}
              onRemove={removeWorkItem}
              onUpdate={updateWorkItem}
            />
            {/* 행 추가 */}
            <div style={{
              marginTop: 10, padding: "10px 12px",
              background: t.bgInset, border: `1px dashed ${t.border}`,
              borderRadius: 8,
            }}>
              <SectionLabel t={t} text="행 추가"/>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 6 }}>
                <select value={editItem.workType}
                  onChange={(e) => setEditItem({ workType: e.target.value, appliance: "", qty: editItem.qty })}
                  style={inputStyle(t)}>
                  <option value="">— 작업유형 —</option>
                  {WORK_TYPES.map(wt => <option key={wt} value={wt}>{formatWorkTypeLabel(wt)}</option>)}
                </select>
                <select value={editItem.appliance}
                  onChange={(e) => setEditItem(prev => ({ ...prev, appliance: e.target.value }))}
                  disabled={!editItem.workType}
                  style={{
                    ...inputStyle(t),
                    borderColor: requiresApplianceFor(editItem.workType) && !editItem.appliance
                      ? (t.danger || "#FF3D5A") : t.border,
                  }}>
                  <option value="">— {editItem.workType === "설치" ? "종류" : "기종"}{requiresApplianceFor(editItem.workType) ? " 필수" : ""} —</option>
                  {getAppliancePool(editItem.workType, form.principal).map(a =>
                    <option key={a} value={a}>{a}</option>
                  )}
                </select>
                <input type="number" min="1" value={editItem.qty}
                  onChange={(e) => setEditItem(p => ({ ...p, qty: Math.max(1, parseInt(e.target.value || "1", 10)) }))}
                  style={{ ...inputStyle(t), width: 70 }}/>
                <button type="button" onClick={addWorkItem} style={addBtnStyle(t)}>
                  <Plus size={14}/> 추가
                </button>
              </div>
              {errors.addItem && (
                <div style={{ fontSize: 11, color: t.danger || "#FF3D5A", marginTop: 6 }}>
                  ⚠️ {errors.addItem}
                </div>
              )}
            </div>
          </Card>

          {/* 견적 금액 */}
          <Card t={t} title="견적금액" error={errors.estimateTotal}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <input type="number" value={form.estimateTotal || ""}
                onChange={(e) => {
                  setForm(p => ({ ...p, estimateTotal: Number(e.target.value || 0) }));
                  setEstimateTouched(true);
                }}
                disabled={priceTBD}
                style={{ ...inputStyle(t), flex: 1, fontSize: 18, fontWeight: 800, opacity: priceTBD ? 0.5 : 1 }}/>
              <label style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, color: t.textSecondary, fontWeight: 600,
                cursor: "pointer",
              }}>
                <input type="checkbox" checked={priceTBD}
                  onChange={(e) => {
                    setPriceTBD(e.target.checked);
                    if (e.target.checked) setForm(p => ({ ...p, estimateTotal: 0 }));
                    setEstimateTouched(false);
                  }}/>
                견적 미정
              </label>
              {/* 2026-07-11 — 사장님 spec: '기종 미정' 체크박스. 견적 미정과 짝.
                    workItems 비어있을 때 이 체크 없으면 저장 차단. */}
              <label style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, color: t.textSecondary, fontWeight: 600,
                cursor: "pointer",
              }}>
                <input type="checkbox" checked={applianceUndecided}
                  onChange={(e) => {
                    setApplianceUndecided(e.target.checked);
                    // 체크 해제 시 workType 도 초기화 (revalidate 목적).
                    if (!e.target.checked) setForm(p => ({ ...p, workType: "" }));
                  }}/>
                기종 미정
              </label>
            </div>

            {/* 2026-07-12 — 사장님 spec: '기종 미정' 체크 시 종목(workType) 선택 필드 노출.
                  root workType 만 저장 → 기사앱 기종선택 팝업이 종목별 기종 목록 표시.
                  '기타/기타' 사고 재발 방지. 홈페이지 전환 흐름과 구조 동일. */}
            {workItems.length === 0 && applianceUndecided && (
              <div style={{
                marginTop: 8, padding: "10px 12px",
                background: t.bgInset, border: `1px solid ${t.border}`,
                borderRadius: 8,
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                <div style={{
                  fontSize: 11, color: t.textSecondary, fontWeight: 800, letterSpacing: 0.3,
                  textTransform: "uppercase",
                }}>종목 선택 <span style={{ color: "#DC2626" }}>*</span></div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {["세척", "냉매충전", "설치", "누설", "누수"].map(wt => {
                    const on = form.workType === wt;
                    return (
                      <button
                        key={wt}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, workType: wt }))}
                        style={{
                          padding: "7px 14px",
                          background: on ? "#2563EB" : "transparent",
                          border: `1px solid ${on ? "#2563EB" : t.border}`,
                          borderRadius: 999,
                          color: on ? "#fff" : t.textSecondary,
                          fontSize: 12, fontWeight: 700,
                          cursor: "pointer", fontFamily: "inherit",
                        }}>{wt}</button>
                    );
                  })}
                </div>
                {errors.workType && (
                  <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 700 }}>
                    ⚠ {errors.workType}
                  </div>
                )}
                <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>
                  기사앱에서 이 종목에 해당하는 기종 목록이 팝업으로 열립니다.
                </div>
              </div>
            )}
            {!priceTBD && autoEstimateValue != null && autoEstimateValue !== form.estimateTotal && (
              <div style={{
                padding: "6px 10px", background: t.bgInset, border: `1px solid ${t.border}`,
                borderRadius: 6, fontSize: 11, color: t.textSecondary,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span>자동 견적 (원청 단가표)</span>
                <button type="button"
                  onClick={() => { setForm(p => ({ ...p, estimateTotal: autoEstimateValue })); setEstimateTouched(false); }}
                  style={{
                    background: "transparent", border: "none", color: t.accent,
                    fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                  }}>
                  적용 ({fmtKRW(autoEstimateValue)})
                </button>
              </div>
            )}
          </Card>

          {/* 분배 미리보기 */}
          {form.principal === "유솔홈케어 N" ? (
            <Card t={t} title="분배 미리보기">
              <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>
                유솔N 은 네이버 정산 (별도 화면 — 미리보기 생략).
              </div>
            </Card>
          ) : feePreview?.ok ? (
            <Card t={t} title={`분배 미리보기 (${feePreview.calcMethod || "—"})`}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <SplitBox t={t} label="기사 정산"   amount={feePreview.engineer}  color="#378ADD"/>
                <SplitBox t={t} label="원청 수수료" amount={feePreview.principal} color="#FFB800"/>
                <SplitBox t={t} label="회사 마진"   amount={feePreview.company}   color="#1D9E75" accent/>
              </div>
            </Card>
          ) : feeLoading ? (
            <Card t={t} title="분배 미리보기">
              <div style={{ fontSize: 12, color: t.textMuted }}>계산 중...</div>
            </Card>
          ) : feeError ? (
            <Card t={t} title="분배 미리보기" error={feeError}/>
          ) : null}
        </div>
      </div>

      {/* 하단 에러 / 제출 */}
      {submitError && (
        <div style={{
          maxWidth: 1400, margin: "10px auto 0", padding: "0 24px",
        }}>
          <div style={{
            padding: "10px 12px",
            background: t.dangerBg || "rgba(255,59,92,0.08)",
            border: `1px solid ${t.danger || "#FF3D5A"}`,
            borderRadius: 8, fontSize: 12, color: t.danger || "#FF3D5A",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <AlertCircle size={14}/> {submitError}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 보조 컴포넌트
// ──────────────────────────────────────────────────────────

function requiresApplianceFor(workType) {
  if (!workType) return false;
  // 출장비 = "(공통)" 1개 → 사실상 선택 없음 (필수로 잡되 자동 채움)
  // 세척/냉매/추가선택/냉매점검 = 기종 필수
  return true;  // 모든 작업유형이 기종 필수 (출장비 포함, "(공통)" 자동)
}

function PasteArea({ t, text, onChange, onAutoFill, parseResult, principalCode }) {
  const hasPartnerParser = principalCode === "KA" || principalCode === "crikrin";
  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
      padding: "12px 14px",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>📋 카톡 / 붙여넣기</span>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
          {hasPartnerParser
            ? `(${principalCode} 주문 텍스트 자동 인식 — 원청별 파서 우선)`
            : "(고객 카톡 텍스트 → 자동 채우기 클릭 → 폼 자동 채움)"}
        </span>
        <div style={{ flex: 1 }}/>
        <button type="button" onClick={onAutoFill} disabled={!text.trim()}
          style={{
            padding: "6px 14px",
            background: text.trim() ? t.accent : t.bgInset,
            color: text.trim() ? "#fff" : t.textMuted,
            border: "none", borderRadius: 6,
            fontSize: 12, fontWeight: 800,
            cursor: text.trim() ? "pointer" : "not-allowed",
            fontFamily: "inherit", whiteSpace: "nowrap",
          }}>
          ✨ 자동 채우기
        </button>
        {text && (
          <button type="button" onClick={() => onChange("")}
            style={{
              padding: "6px 10px",
              background: "transparent", border: `1px solid ${t.border}`,
              color: t.textSecondary, borderRadius: 6,
              fontSize: 11, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>
            지우기
          </button>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="고객 카톡 텍스트 또는 원청 주문 텍스트를 여기에 붙여넣으세요. (자동 채우기 클릭)"
        style={{
          width: "100%", padding: "8px 10px",
          background: t.bg, border: `1px solid ${t.border}`, borderRadius: 6,
          color: t.text, fontSize: 12, fontFamily: "inherit",
          resize: "vertical", boxSizing: "border-box",
        }}
      />
      {/* parseResult 표시 — matched / unmatched */}
      {parseResult && (
        <div style={{
          marginTop: 8, padding: "8px 10px",
          background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 6,
          fontSize: 11, color: t.textSecondary, fontWeight: 600,
          display: "flex", flexWrap: "wrap", gap: 8,
        }}>
          <span style={{ color: t.success || "#10B981", fontWeight: 700 }}>
            ✓ 인식: {parseResult.matched.length > 0 ? parseResult.matched.join(", ") : "없음"}
          </span>
          {parseResult.unmatched.length > 0 && (
            <span style={{ color: t.textMuted, fontWeight: 700 }}>
              ⚠ 미인식: {parseResult.unmatched.join(", ")} <span style={{ fontWeight: 500 }}>(직접 입력)</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ t, title, error, children }) {
  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
      padding: "14px 16px",
    }}>
      <div style={{
        fontSize: 13, fontWeight: 800, color: t.text,
        marginBottom: 10,
      }}>{title}</div>
      {children}
      {error && (
        <div style={{
          marginTop: 8, padding: "6px 10px",
          background: t.dangerBg || "rgba(255,59,92,0.08)",
          border: `1px solid ${t.danger || "#FF3D5A"}`,
          borderRadius: 6, fontSize: 11, color: t.danger || "#FF3D5A",
        }}>⚠️ {error}</div>
      )}
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

function SectionLabel({ t, text }) {
  return (
    <div style={{
      fontSize: 11, color: t.textMuted, fontWeight: 800, letterSpacing: 0.3,
      marginBottom: 6,
    }}>{text}</div>
  );
}

function WorkItemsTable({ t, items, onRemove, onUpdate }) {
  if (items.length === 0) {
    return (
      <div style={{
        padding: "20px 12px", textAlign: "center",
        color: t.textMuted, fontSize: 12,
        background: t.bgInset, border: `1px dashed ${t.border}`, borderRadius: 8,
      }}>
        작업항목 없음 — 아래에서 추가하세요
      </div>
    );
  }
  return (
    <div style={{
      background: t.bg, border: `1px solid ${t.border}`,
      borderRadius: 8, overflow: "hidden",
    }}>
      <div style={{
        display: "grid", gridTemplateColumns: "1.2fr 1.2fr auto auto",
        gap: 8, padding: "8px 12px",
        background: t.bgInset, borderBottom: `1px solid ${t.border}`,
        fontSize: 10, color: t.textMuted, fontWeight: 800, letterSpacing: 0.3,
      }}>
        <span>작업유형</span><span>기종</span>
        <span style={{ minWidth: 50, textAlign: "right" }}>수량</span>
        <span style={{ width: 24 }}></span>
      </div>
      {items.map((it, idx) => (
        <div key={idx} style={{
          display: "grid", gridTemplateColumns: "1.2fr 1.2fr auto auto",
          gap: 8, padding: "8px 12px", alignItems: "center",
          borderTop: idx === 0 ? "none" : `1px solid ${t.border}`,
          fontSize: 12, color: t.text,
        }}>
          <span style={{ fontWeight: 700 }}>{it.workType}</span>
          <span>{it.appliance || <em style={{ color: t.danger || "#FF3D5A" }}>(기종 누락)</em>}</span>
          <input type="number" min="1" value={it.qty}
            onChange={(e) => onUpdate(idx, { qty: Math.max(1, parseInt(e.target.value || "1", 10)) })}
            style={{
              ...inputStyle(t), width: 60, padding: "4px 6px",
              fontSize: 12, textAlign: "right",
            }}/>
          <button type="button" onClick={() => onRemove(idx)}
            style={{
              background: "transparent", border: "none", padding: 4,
              cursor: "pointer", color: t.danger || "#FF3D5A",
              display: "flex", alignItems: "center",
            }}>
            <Trash2 size={14}/>
          </button>
        </div>
      ))}
    </div>
  );
}

function SplitBox({ t, label, amount, color, accent }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: accent ? `${color}11` : t.bgInset,
      border: `1px solid ${accent ? color : t.border}`,
      borderRadius: 8,
      display: "flex", flexDirection: "column", gap: 3,
    }}>
      <span style={{
        fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3,
      }}>{label}</span>
      <span className="mono" style={{
        fontSize: accent ? 17 : 14, fontWeight: 800,
        color: color,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.3px",
      }}>{fmtKRW(amount)}</span>
    </div>
  );
}

// ── 스타일 헬퍼 ──
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
function chipStyle(t, active) {
  return {
    padding: "6px 12px",
    background: active ? (t.bgInset || "rgba(255,255,255,0.06)") : "transparent",
    border: `1px solid ${active ? t.text : t.border}`,
    borderRadius: 999,
    color: active ? t.text : t.textSecondary,
    fontSize: 11, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  };
}
function iconBtnStyle(t) {
  return {
    background: "transparent", border: "none", padding: 4,
    cursor: "pointer", color: t.text,
    display: "flex", alignItems: "center",
  };
}
function addBtnStyle(t) {
  return {
    background: t.accent, color: "#fff",
    border: "none", borderRadius: 6,
    padding: "6px 12px", cursor: "pointer", fontFamily: "inherit",
    fontSize: 12, fontWeight: 800,
    display: "inline-flex", alignItems: "center", gap: 4,
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

export default NewReceptionPcForm;

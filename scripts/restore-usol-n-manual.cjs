// scripts/restore-usol-n-manual.cjs
// ============================================================================
// 일회성 — raw_orders 측 없는 usol_n 손실 task 2건 (이해수 YS-N-260526-027 /
//          김종민 YS-N-260528-008) 측 네이버 원본 정보 측 수동 inline 입력.
//
// 변환 로직: restore-usol-n-task-items.cjs 와 동일 (정확도) —
//   · APPLIANCE_KR_TO_CODE / ADDON_KR_TO_WT_CODE
//   · findCleaningWorkTypeId (service_type='cleaning' + appliance_type_id JOIN)
//   · findAddonWorkTypeId (키워드 부분 일치)
//   · unit_price 동적 판정 (qty>=2 + settlement > perUnitPaid * 1.1 → ÷qty)
//
// settlement 자동 계산: round(customerPaid × 0.94438) per line (관측된 네이버 수수료).
//
// ⚠️ 김종민 (YS-N-260528-008):
//   · 완료 작업 — 신중 처리. payments 측 before/after 비교 출력.
//   · category_data.refrigerant_addon (₩90,000 현장 냉매충전) 측 task 측 별도 보존됨.
//     → 본 스크립트는 task_items 측 INSERT 측만 함. refrigerant_addon 측 무관.
//
// 사용:
//   node scripts/restore-usol-n-manual.cjs              # dry-run
//   node scripts/restore-usol-n-manual.cjs --apply      # 실제 INSERT
// ============================================================================

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL          = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("ERROR: VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 환경변수 필요");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const APPLY = process.argv.includes("--apply");
const NAVER_FEE_RATIO = 0.94438;
const settle = (paid) => Math.round(paid * NAVER_FEE_RATIO);

// ──────────────────────────────────────────────
// 수동 입력 데이터 — 사장님 spec 그대로
// ──────────────────────────────────────────────
//
// 2026-06-05 — 신정원 / 이승희 (이전 이해수 + 김종민은 이미 --apply 완료, 가드 측 자동 skip).
//   네이버 주문 상세 측 customerPaid 정정 (옛 표 금액과 다름 — 주문 상세가 정확).
const MANUAL = [
  {
    task_no: "YS-N-260526-039",
    customer: "신정원",
    status_expected: "확정",
    product_price_expected: 308811,
    appliances: [
      // 본작업 1way ×3 (가정집 시스템 천장형)
      {
        orderType: "본작업",
        type: "1way",
        count: 3,
        customerPaid: 288000,
        settlement: settle(288000),
        serviceTypeRaw: "가정집 에어컨청소 / 구분: 1way(시스템 천장형)",
        productOrderId: null,
      },
      // 추가선택 냉매점검 ×1
      {
        orderType: "추가선택",
        type: null,
        count: 1,
        customerPaid: 10000,
        settlement: settle(10000),
        serviceTypeRaw: "추가선택: 냉매점검",
        productOrderId: null,
      },
      // 추가선택 실외기 ×1
      {
        orderType: "추가선택",
        type: null,
        count: 1,
        customerPaid: 29000,
        settlement: settle(29000),
        serviceTypeRaw: "추가선택: 실외기",
        productOrderId: null,
      },
    ],
  },
  {
    task_no: "YS-N-260529-024",
    customer: "이승희 (base)",
    status_expected: "완료",
    product_price_expected: 149685,
    note: "현장 냉매충전 ₩180,000 측 별도 -R 작업(YS-N-260529-024-R) 측 측정, base 측 추가 금지",
    appliances: [
      // 본작업 벽걸이 ×2 (가정집)
      {
        orderType: "본작업",
        type: "벽걸이",
        count: 2,
        customerPaid: 148500,
        settlement: settle(148500),
        serviceTypeRaw: "가정집 에어컨청소 / 구분: 벽걸이",
        productOrderId: null,
      },
      // 추가선택 냉매점검 ×1
      {
        orderType: "추가선택",
        type: null,
        count: 1,
        customerPaid: 10000,
        settlement: settle(10000),
        serviceTypeRaw: "추가선택: 냉매점검",
        productOrderId: null,
      },
    ],
  },
];

// ──────────────────────────────────────────────
// 변환 로직 — restore-usol-n-task-items.cjs 본문 동일 (정확도)
// ──────────────────────────────────────────────
const APPLIANCE_KR_TO_CODE = {
  "벽걸이": "wall", "1way": "1way", "2way": "2way", "스탠드": "stand",
  "4way": "4way", "원형": "round", "투인원": "2in1", "시스템멀티": "multi",
};
const ADDON_KR_TO_WT_CODE = {
  "냉매": "refri_no_appliance",
  "송풍팬": "fan_disassembly",
  "층고": "fan_disassembly",
  "실외기": "outdoor_unit",
  "피톤치드": "phytoncide",
};

function makeFindCleaningWorkTypeId(workTypes, applianceByCode, cleaningServiceId) {
  return function (applianceCode) {
    if (!cleaningServiceId || !applianceCode) return null;
    const applianceId = applianceByCode.get(applianceCode);
    if (!applianceId) return null;
    const wt = workTypes.find(w =>
      w.service_type_id === cleaningServiceId && w.appliance_type_id === applianceId
    );
    return wt?.id || null;
  };
}
function makeFindAddonWorkTypeId(workTypes) {
  return function (optionText) {
    if (!optionText) return null;
    const t = String(optionText);
    for (const [kr, code] of Object.entries(ADDON_KR_TO_WT_CODE)) {
      if (t.includes(kr)) {
        const wt = workTypes.find(w => w.code === code);
        return wt?.id || null;
      }
    }
    return null;
  };
}

// ──────────────────────────────────────────────
// 메인
// ──────────────────────────────────────────────
async function main() {
  console.log(`[manual-restore] mode = ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`[manual-restore] targets: ${MANUAL.map(m => m.task_no).join(", ")}`);
  console.log("");

  // 1) work_types + appliance_types + service_types
  const { data: workTypes } = await supabase.from("work_types").select("id, code, service_type_id, appliance_type_id");
  const { data: applianceTypes } = await supabase.from("appliance_types").select("id, code, name");
  const { data: serviceTypes } = await supabase.from("service_types").select("id, code");
  const cleaningServiceId = (serviceTypes || []).find(s => s.code === "cleaning")?.id;
  const apIdByCode = new Map((applianceTypes || []).map(a => [a.code, a.id]));
  const apByCode   = new Map((applianceTypes || []).map(a => [a.code, a]));

  const findCleaningWorkTypeId = makeFindCleaningWorkTypeId(workTypes, apIdByCode, cleaningServiceId);
  const findAddonWorkTypeId    = makeFindAddonWorkTypeId(workTypes);

  // 2) tasks 측 id 조회
  const tnos = MANUAL.map(m => m.task_no);
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, task_no, customer_name, status, product_price, category_data")
    .in("task_no", tnos);

  const summary = [];

  for (const spec of MANUAL) {
    const task = tasks.find(t => t.task_no === spec.task_no);
    if (!task) {
      console.warn(`[SKIP] ${spec.task_no} 측 tasks 측 없음`);
      summary.push({ task_no: spec.task_no, status: "skip_no_task" });
      continue;
    }

    console.log("==============================");
    console.log(`▶ ${spec.task_no} | ${task.customer_name} | status=${task.status} | product_price=${task.product_price}`);
    if (spec.note) console.log(`  ⓘ ${spec.note}`);

    // 2-a) 가드 — task_items 0건 확인
    const { count: itemCount } = await supabase
      .from("task_items").select("id", { count: "exact", head: true }).eq("task_id", task.id);
    if (itemCount > 0) {
      console.warn(`  [SKIP] task_items 측 이미 ${itemCount}건 존재 — 중복 INSERT 차단`);
      summary.push({ task_no: spec.task_no, status: "skip_existing_items", existing: itemCount });
      continue;
    }

    // 2-b) appliances 측 task_items 변환
    const itemRows = [];
    const warnings = [];
    let totalUnit = 0;  // unit_price × qty 합 — product_price cross-check
    for (let i = 0; i < spec.appliances.length; i++) {
      const app = spec.appliances[i];
      let workTypeId = null;
      let applianceTypeId = null;
      let appCode = null;

      if (app.orderType === "본작업") {
        appCode = APPLIANCE_KR_TO_CODE[app.type] || null;
        if (!appCode) { warnings.push(`[${i}] 본작업 기종 매핑 실패: type=${app.type}`); continue; }
        applianceTypeId = apIdByCode.get(appCode);
        workTypeId      = findCleaningWorkTypeId(appCode);
      } else if (app.orderType === "추가선택") {
        workTypeId = findAddonWorkTypeId(app.serviceTypeRaw) || findAddonWorkTypeId(app.type);
        if (!workTypeId) { warnings.push(`[${i}] 추가선택 키워드 매핑 실패: ${app.serviceTypeRaw}`); continue; }
      } else {
        warnings.push(`[${i}] orderType 측 ${app.orderType} (지원 X)`);
        continue;
      }

      const _qty         = app.count || 1;
      const _settlement  = app.settlement || 0;
      const _perUnitPaid = (app.customerPaid && _qty) ? app.customerPaid / _qty : null;
      let _unitPrice = _settlement;
      if (_qty >= 2 && _perUnitPaid && _settlement > _perUnitPaid * 1.1) {
        _unitPrice = Math.round(_settlement / _qty);
      }
      totalUnit += _unitPrice * _qty;

      const wtRow = workTypes.find(w => w.id === workTypeId);
      const apRow = appCode ? apByCode.get(appCode) : null;
      console.log(`  [${i}] ${app.orderType} | ${apRow?.name || "-"} | qty=${_qty} | settlement=${_settlement} | paid=${app.customerPaid} → unit_price=${_unitPrice} | work=${wtRow?.code}`);

      itemRows.push({
        task_id: task.id,
        work_type_id: workTypeId,
        appliance_type_id: applianceTypeId,
        qty: _qty,
        unit_price: _unitPrice,
        customer_paid_amount: app.customerPaid || null,
        order_type: app.orderType,
        product_order_id: app.productOrderId || null,
        metadata: app.productOrderId ? { external_item_no: String(app.productOrderId) } : {},
      });
    }

    // 2-c) cross-check
    console.log(`  → 변환 결과: ${itemRows.length} task_items / warnings ${warnings.length}건`);
    console.log(`  → 합계 (unit_price × qty): ₩${totalUnit.toLocaleString()} vs product_price: ₩${task.product_price.toLocaleString()} | 차이: ${totalUnit - task.product_price}`);
    if (warnings.length > 0) warnings.forEach(w => console.log(`    ⚠ ${w}`));

    if (itemRows.length === 0) {
      console.warn(`  [SKIP] 변환 결과 0건`);
      summary.push({ task_no: spec.task_no, status: "skip_zero_rows" });
      continue;
    }

    if (APPLY) {
      // payments before (김종민 비교용)
      const { data: paysBefore } = await supabase
        .from("payments").select("engineer_amount, principal_amount, owner_amount")
        .eq("task_id", task.id).maybeSingle();

      // INSERT
      const { error: insErr } = await supabase.from("task_items").insert(itemRows);
      if (insErr) {
        console.error(`  [ERROR] task_items INSERT 실패:`, insErr);
        summary.push({ task_no: spec.task_no, status: "error_insert", error: insErr.message });
        continue;
      }
      console.log(`  ✓ task_items ${itemRows.length}건 INSERT 완료`);

      // compute_payment
      const { error: payErr } = await supabase.rpc("compute_payment", { p_task_id: task.id });
      if (payErr) {
        console.warn(`  ⚠ compute_payment 호출 실패:`, payErr.message);
        summary.push({ task_no: spec.task_no, status: "applied_pay_failed", items: itemRows.length });
        continue;
      }
      const { data: paysAfter } = await supabase
        .from("payments").select("engineer_amount, principal_amount, owner_amount")
        .eq("task_id", task.id).maybeSingle();
      console.log(`  ✓ compute_payment OK`);
      console.log(`    BEFORE: engineer=${paysBefore?.engineer_amount} / principal=${paysBefore?.principal_amount} / owner=${paysBefore?.owner_amount}`);
      console.log(`    AFTER : engineer=${paysAfter?.engineer_amount} / principal=${paysAfter?.principal_amount} / owner=${paysAfter?.owner_amount}`);
      summary.push({
        task_no: spec.task_no, status: "applied", items: itemRows.length,
        eng_before: paysBefore?.engineer_amount, eng_after: paysAfter?.engineer_amount,
        prin_before: paysBefore?.principal_amount, prin_after: paysAfter?.principal_amount,
        own_before: paysBefore?.owner_amount, own_after: paysAfter?.owner_amount,
      });
    } else {
      summary.push({ task_no: spec.task_no, status: "dry_run", items: itemRows.length, total_unit: totalUnit, product_price: task.product_price, diff: totalUnit - task.product_price });
    }
    console.log("");
  }

  console.log("=== SUMMARY ===");
  console.table(summary);
  console.log(APPLY ? "[APPLIED]" : "[DRY-RUN — --apply 측 재실행]");
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });

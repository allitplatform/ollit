// scripts/restore-usol-n-task-items.cjs
// ============================================================================
// 일회성 — 2026-06-05 sync_category_data_to_task_items trigger 버그로
//          task_items 가 손실된 usol_n task 측 raw_orders.raw_payload 측 재구성.
//
// 변환 로직: src/lib/usolNTasksDb.js bulkInsertUsolNOrders 본문 그대로 복사
//   · APPLIANCE_KR_TO_CODE (라인 663-672)
//   · ADDON_KR_TO_WT_CODE (라인 706-712)
//   · findCleaningWorkTypeId / findAddonWorkTypeId (라인 818-833)
//   · appliances → task_items 변환 (라인 924-994)
//   · unit_price 동적 판정 (라인 968-980)
//
// 안전:
//   · task_items 직접 INSERT — sync trigger 미발화 (tasks UPDATE 안 함).
//   · 가드 — task_items 이미 있는 task 측 자동 skip (중복 INSERT 차단).
//   · raw_orders 측 가장 최근 uploaded_at row 1건만 사용.
//
// 사용:
//   1) 환경변수 설정 (.env 또는 셸):
//        VITE_SUPABASE_URL=https://<project>.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=<service_role 키>
//   2) TASK_NOS 환경변수 또는 본 스크립트 측 TASK_NOS 배열 직접 채움.
//   3) dry-run 먼저:
//        node scripts/restore-usol-n-task-items.cjs
//      sample row + warnings 검토.
//   4) 실제 INSERT:
//        node scripts/restore-usol-n-task-items.cjs --apply
//      task_items INSERT + compute_payment RPC 호출.
// ============================================================================

const { createClient } = require("@supabase/supabase-js");

// ──────────────────────────────────────────────
// 환경
// ──────────────────────────────────────────────
const SUPABASE_URL          = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("ERROR: VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 환경변수 필요");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ──────────────────────────────────────────────
// 대상 task_no — 사장님이 직접 채움 (환경변수 또는 아래 배열)
// 환경변수 예: TASK_NOS=YS-N-260605-001,YS-N-260605-002,...
// ──────────────────────────────────────────────
const TASK_NOS = process.env.TASK_NOS
  ? process.env.TASK_NOS.split(",").map(s => s.trim()).filter(Boolean)
  : [
      // 사장님이 손실 7건 task_no 정정 후 사용:
      // "YS-N-260605-001",
      // "YS-N-260605-002",
      // ...
    ];

const APPLY = process.argv.includes("--apply");

// ──────────────────────────────────────────────
// 변환 로직 — src/lib/usolNTasksDb.js 본문 그대로 복사 (정확도)
// ──────────────────────────────────────────────

// 라인 663-672
const APPLIANCE_KR_TO_CODE = {
  "벽걸이":     "wall",
  "1way":       "1way",
  "2way":       "2way",
  "스탠드":     "stand",
  "4way":       "4way",
  "원형":       "round",
  "투인원":     "2in1",
  "시스템멀티": "multi",
};

// 라인 706-712
const ADDON_KR_TO_WT_CODE = {
  "냉매":     "refri_no_appliance",
  "송풍팬":   "fan_disassembly",
  "층고":     "fan_disassembly",
  "실외기":   "outdoor_unit",
  "피톤치드": "phytoncide",
};

// findCleaningWorkTypeId — 원본 본문 (라인 818-826) 그대로:
//   service_type_id ('cleaning') + appliance_type_id 측 work_types 측 매칭.
//   ⚠ work_types.code 측 'clean_*' 명명 — 'cleaning_*' 가정 X.
function makeFindCleaningWorkTypeId(workTypes, applianceByCode, cleaningServiceId) {
  return function findCleaningWorkTypeId(applianceCode) {
    if (!cleaningServiceId || !applianceCode) return null;
    const applianceId = applianceByCode.get(applianceCode);
    if (!applianceId) return null;
    const wt = workTypes.find(w =>
      w.service_type_id === cleaningServiceId && w.appliance_type_id === applianceId
    );
    return wt?.id || null;
  };
}

// findAddonWorkTypeId — 원본 본문 (라인 828-838) 그대로:
//   옵션텍스트 측 키워드 부분 일치 → addon work_type code 매칭.
function makeFindAddonWorkTypeId(workTypes) {
  return function findAddonWorkTypeId(optionText) {
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
  if (TASK_NOS.length === 0) {
    console.error("ERROR: TASK_NOS 환경변수 또는 코드 측 직접 명시 필요");
    console.error("  예: TASK_NOS=YS-N-260605-001,YS-N-260605-002 node scripts/restore-usol-n-task-items.cjs");
    process.exit(1);
  }

  console.log(`[restore] mode = ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`[restore] target task_no count = ${TASK_NOS.length}`);
  console.log(`[restore] targets: ${TASK_NOS.join(", ")}`);
  console.log("");

  // 1) work_types + appliance_types + service_types 측 SELECT
  //    원본 bulkInsertUsolNOrders (라인 815) — service_types 측 'cleaning' id + work_types 측 service_type_id JOIN.
  const { data: workTypes, error: wtErr } = await supabase
    .from("work_types")
    .select("id, code, service_type_id, appliance_type_id");
  if (wtErr) { console.error("work_types SELECT 실패:", wtErr); process.exit(1); }
  console.log(`[restore] work_types loaded: ${workTypes.length}`);

  const { data: applianceTypes, error: atErr } = await supabase
    .from("appliance_types")
    .select("id, code");
  if (atErr) { console.error("appliance_types SELECT 실패:", atErr); process.exit(1); }
  const applianceTypeIdByCode = new Map((applianceTypes || []).map(a => [a.code, a.id]));
  console.log(`[restore] appliance_types loaded: ${applianceTypeIdByCode.size}`);

  const { data: serviceTypes, error: stErr } = await supabase
    .from("service_types")
    .select("id, code");
  if (stErr) { console.error("service_types SELECT 실패:", stErr); process.exit(1); }
  const cleaningServiceId = (serviceTypes || []).find(s => s.code === "cleaning")?.id || null;
  if (!cleaningServiceId) {
    console.error("service_types 측 'cleaning' code 없음 — 원본 spec 측 spec 정정 필요");
    process.exit(1);
  }
  console.log(`[restore] service_types loaded: ${serviceTypes.length}, cleaning id = ${cleaningServiceId}`);

  const findCleaningWorkTypeId = makeFindCleaningWorkTypeId(workTypes, applianceTypeIdByCode, cleaningServiceId);
  const findAddonWorkTypeId    = makeFindAddonWorkTypeId(workTypes);

  // 2) 손실 task 측 id 조회
  const { data: tasks, error: tErr } = await supabase
    .from("tasks")
    .select("id, task_no, principal_id, product_price, customer_name, status")
    .in("task_no", TASK_NOS);
  if (tErr) { console.error("tasks SELECT 실패:", tErr); process.exit(1); }

  if (!tasks || tasks.length === 0) {
    console.error("ERROR: 대상 task 없음 — TASK_NOS 정정 필요");
    process.exit(1);
  }
  console.log(`[restore] matched tasks: ${tasks.length} / ${TASK_NOS.length}`);

  // task_no 미매칭 경고
  const matchedNos = new Set(tasks.map(t => t.task_no));
  const missingNos = TASK_NOS.filter(no => !matchedNos.has(no));
  if (missingNos.length > 0) {
    console.warn(`[restore] WARNING — 미매칭 task_no: ${missingNos.join(", ")}`);
  }
  console.log("");

  // 3) 각 task 측 처리
  const summary = [];
  for (const task of tasks) {
    console.log(`▶ [${task.task_no}] ${task.customer_name || "?"} (status=${task.status})`);

    // 3-a) task_items 측 0건 확인 (중복 INSERT 차단)
    const { count: itemCount, error: cntErr } = await supabase
      .from("task_items")
      .select("id", { count: "exact", head: true })
      .eq("task_id", task.id);
    if (cntErr) {
      console.error(`  [ERROR] task_items count 측 측 실패:`, cntErr);
      summary.push({ task_no: task.task_no, status: "error_count" });
      continue;
    }
    if (itemCount > 0) {
      console.warn(`  [SKIP] 이미 task_items ${itemCount}건 존재 — 중복 INSERT 차단`);
      summary.push({ task_no: task.task_no, status: "skip_existing_items", existing: itemCount });
      continue;
    }

    // 3-b) raw_orders 측 raw_payload 조회 (가장 최근 uploaded_at)
    const { data: raws, error: roErr } = await supabase
      .from("raw_orders")
      .select("raw_payload, uploaded_at, source, external_order_no")
      .eq("task_id", task.id)
      .order("uploaded_at", { ascending: false })
      .limit(1);
    if (roErr) {
      console.error(`  [ERROR] raw_orders SELECT 실패:`, roErr);
      summary.push({ task_no: task.task_no, status: "error_raw_select" });
      continue;
    }
    if (!raws || raws.length === 0) {
      console.warn(`  [SKIP] raw_orders 없음 — 복구 소스 부재`);
      summary.push({ task_no: task.task_no, status: "skip_no_raw_payload" });
      continue;
    }

    const payload = raws[0].raw_payload;
    const appliances = payload?.appliances || [];
    if (appliances.length === 0) {
      console.warn(`  [SKIP] raw_payload.appliances 비어있음`);
      summary.push({ task_no: task.task_no, status: "skip_no_appliances" });
      continue;
    }
    console.log(`  raw_orders uploaded_at: ${raws[0].uploaded_at} (external_order_no: ${raws[0].external_order_no})`);
    console.log(`  raw_payload.appliances: ${appliances.length}건`);

    // 3-c) appliances → task_items 행 변환 (bulkInsertUsolNOrders 라인 924-994 그대로 복사)
    const itemRows = [];
    const warnings = [];
    for (const app of appliances) {
      if (!app.orderType) {
        warnings.push(`orderType 없음: ${JSON.stringify(app).slice(0, 120)}`);
        continue;
      }

      let workTypeId = null;
      let applianceTypeId = null;

      if (app.orderType === "본작업") {
        const applianceCode = APPLIANCE_KR_TO_CODE[app.type] || null;
        if (!applianceCode) {
          warnings.push(`본작업 기종 매핑 실패: type=${app.type}`);
          continue;
        }
        applianceTypeId = applianceTypeIdByCode.get(applianceCode);
        workTypeId      = findCleaningWorkTypeId(applianceCode);
      } else if (app.orderType === "추가선택") {
        workTypeId = findAddonWorkTypeId(app.serviceTypeRaw) || findAddonWorkTypeId(app.type);
        if (!workTypeId) {
          warnings.push(`추가선택 키워드 매핑 실패: serviceTypeRaw=${app.serviceTypeRaw}, type=${app.type}`);
          continue;
        }
      }

      if (!workTypeId) {
        warnings.push(`work_type 매핑 실패: orderType=${app.orderType}`);
        continue;
      }

      // unit_price 동적 판정 (라인 968-980 그대로)
      const _qty         = app.count || 1;
      const _settlement  = app.settlement || 0;
      const _perUnitPaid = (app.customerPaid && _qty) ? app.customerPaid / _qty : null;
      let _unitPrice = _settlement;
      if (_qty >= 2 && _perUnitPaid && _settlement > _perUnitPaid * 1.1) {
        _unitPrice = Math.round(_settlement / _qty);
      }

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

    console.log(`  → 변환 결과: ${itemRows.length} task_items / warnings ${warnings.length}건`);
    if (warnings.length > 0) {
      warnings.forEach(w => console.log(`    ⚠ ${w}`));
    }
    if (itemRows.length === 0) {
      console.warn(`  [SKIP] 변환 결과 0건`);
      summary.push({ task_no: task.task_no, status: "skip_zero_rows", warnings: warnings.length });
      continue;
    }

    // dry-run sample 출력
    console.log(`    sample row:`);
    console.log("    " + JSON.stringify(itemRows[0], null, 2).split("\n").join("\n    "));

    if (APPLY) {
      // 3-d) task_items INSERT
      const { error: insErr } = await supabase
        .from("task_items")
        .insert(itemRows);
      if (insErr) {
        console.error(`  [ERROR] task_items INSERT 실패:`, insErr);
        summary.push({ task_no: task.task_no, status: "error_insert", error: insErr.message });
        continue;
      }
      console.log(`  ✓ task_items ${itemRows.length}건 INSERT 완료`);

      // 3-e) compute_payment 호출
      const { data: payRes, error: payErr } = await supabase
        .rpc("compute_payment", { p_task_id: task.id });
      if (payErr) {
        console.warn(`  ⚠ compute_payment 호출 실패 (수동 재실행 필요):`, payErr.message);
        summary.push({ task_no: task.task_no, status: "applied_pay_failed", items: itemRows.length, warnings: warnings.length });
      } else {
        console.log(`  ✓ compute_payment OK — payment_id: ${payRes}`);
        summary.push({ task_no: task.task_no, status: "applied", items: itemRows.length, warnings: warnings.length });
      }
    } else {
      summary.push({ task_no: task.task_no, status: "dry_run", items: itemRows.length, warnings: warnings.length });
    }
    console.log("");
  }

  // ──────────────────────────────────────────────
  // 요약
  // ──────────────────────────────────────────────
  console.log("=== SUMMARY ===");
  console.table(summary);
  console.log(APPLY
    ? "[APPLIED] task_items INSERT + compute_payment 완료. 화면 측 검증 필요."
    : "[DRY-RUN] 실제 INSERT 없음. 검토 후 --apply 측 재실행."
  );
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});

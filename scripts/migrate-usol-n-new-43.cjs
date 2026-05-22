#!/usr/bin/env node
// =============================================================================
// 유솔(usol_n) 신규 43주문 (67항목) 일회성 마이그레이션 — 2026-05-23
// =============================================================================
//
// 입력: <repo-root>/신규_43주문_INSERT용.csv  (67 데이터 행 / 43 unique 주문번호)
//
// 사장님 spec:
//   1. 1 주문번호 = 1 task + N task_items (Migration 033 spec)
//   2. task.task_no = 그룹 첫 row 작업코드 / principal = usol_n
//   3. status: 작업완료→완료 / 일정확정→확정 / 기사배정완료→배정
//   4. scheduled_at = 고객컨택일자(Y) + 기사약속시간(X) → KST → UTC
//      · 기사약속시간 "00:00" → 시간 미확정 / status="배정" 고정
//   5. completed_at = 작업완료일 (값 있을 때만)
//   6. order_type — 서비스종류 측 측 (가정집/사무실 에어컨청소 / 추가선택)
//   7. work_type/appliance — 서비스구분 측 매핑 (naverOrderParser 측 측 측)
//   8. 배정기사 — users.name 측 매칭 / 매칭 실패 측 warnings + assigned=NULL 측 진행
//   9. payments — 옵션 A (status='완료' INSERT 측 trigger compute_payment 자동)
//      · post-commit 측 측 측 측 측 vs 시트 값 (도급사/회사배분) 측 측 측
//
// 측 측 측:
//   .env 측 SUPABASE_URL + SUPABASE_SERVICE_KEY 측 측
//   node scripts/migrate-usol-n-new-43.cjs --dry-run    # 측 측 측
//   node scripts/migrate-usol-n-new-43.cjs --commit     # 실제 INSERT
//
// 안전:
//   · task_no 중복 체크 — 이미 DB 측 측 측 측 측 SKIP
//   · 사장님 측 측 측 측 측 측 (Claude 측 측 X)

const fs   = require("fs");
const path = require("path");
const Papa = require("papaparse");

// .env 측 측 측 (측 측 측 측 측 정 측)
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const txt = fs.readFileSync(file, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.migrate"));
loadEnv(path.join(__dirname, "..", ".env.local"));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ .env 측 SUPABASE_URL + SUPABASE_SERVICE_KEY 측 측");
  console.error("   측 측: SUPABASE_URL=https://<project>.supabase.co");
  console.error("        SUPABASE_SERVICE_KEY=eyJ... (service_role key)");
  process.exit(1);
}

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// CLI 측 측
const args = process.argv.slice(2);
const isCommit  = args.includes("--commit");
const isDryRun  = !isCommit;
const csvFile   = path.join(__dirname, "..", "신규_43주문_INSERT용.csv");

console.log(`\n${"=".repeat(70)}`);
console.log(`유솔(usol_n) 신규 43주문 INSERT 마이그레이션`);
console.log(`측 측: ${isCommit ? "✅ COMMIT (실제 INSERT)" : "🔍 DRY-RUN (측 측 측)"}`);
console.log(`측 측: ${csvFile}`);
console.log(`${"=".repeat(70)}\n`);

// ============================================================================
// 측 측 측
// ============================================================================

const TENANT_ID     = "11111111-1111-1111-1111-111111111111";
const CATEGORY_ID   = "33333333-3333-3333-3333-333333333001";
const PRINCIPAL_ID  = "22222222-2222-2222-2222-222222222006";   // usol_n
const PRINCIPAL_CODE = "usol_n";

const STATUS_MAP = {
  "작업완료":     "완료",
  "일정확정":     "확정",
  "기사배정완료": "배정",
};

// naverOrderParser 측 측 매핑
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
const ADDON_KR_TO_WT_CODE = {
  "냉매":     "refri_no_appliance",
  "송풍팬":   "fan_disassembly",
  "층고":     "fan_disassembly",
  "실외기":   "outdoor_unit",
  "피톤치드": "phytoncide",
};

function extractAppliance(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  if (t.includes("1way")) return "1way";
  if (t.includes("2way")) return "2way";
  if (t.includes("4way")) return "4way";
  if (t.includes("스탠드")) return "스탠드";
  if (t.includes("벽걸이")) return "벽걸이";
  if (t.includes("투인원")) return "투인원";
  if (t.includes("원형"))   return "원형";
  if (t.includes("천장형")) return "4way";
  return null;
}

function deriveOrderType(serviceTypeValue) {
  if (!serviceTypeValue) return null;
  const v = String(serviceTypeValue).trim();
  if (v.includes("에어컨청소")) return "본작업";
  if (v.includes("벽걸이") || v.includes("스탠드") || v.includes("1way") || v.includes("2way") || v.includes("4way")
   || v.includes("투인원") || v.includes("원형") || v.includes("시스템멀티")) return "본작업";
  if (v.includes("추가선택")) return "추가선택";
  if (v.includes("냉매점검")) return "추가선택";
  if (v.includes("송풍팬") || v.includes("층고")) return "추가선택";
  if (v.includes("피톤치드")) return "추가선택";
  if (v.includes("실외기"))   return "추가선택";
  return null;
}

// KST 측 측 측 + 시간 → UTC ISO
function kstDateTimeToUTC(ymdDots, hmStr) {
  if (!ymdDots) return null;
  const ymd = String(ymdDots).trim().replace(/\./g, "-");   // "2026.05.23" → "2026-05-23"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const hm = (hmStr && hmStr !== "00:00") ? String(hmStr).trim() : "00:00";
  // KST = UTC+9
  const kstISO = `${ymd}T${hm}:00+09:00`;
  const d = new Date(kstISO);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// 측 측 측 측 측 측 측 → ISO
function dateOnlyToISO(s) {
  if (!s) return null;
  const trimmed = String(s).trim();
  if (!trimmed) return null;
  const ymd = trimmed.replace(/\./g, "-");
  // YYYY-MM-DD 또는 YYYY-MM-DD HH:MM:SS 측 측 catch
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  // KST 0시 측 측
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// 측 측 측 (단순 / 측 측)
function toInt(v) {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace(/[,\s]/g, ""));
  return isNaN(n) ? 0 : Math.round(n);
}

// 측 측 측 + 측 trim (사장님 측 시트 측 측 측 측 quotes 측 측 측 측)
function cleanStr(v) {
  if (v == null) return "";
  return String(v).trim().replace(/^["']|["']$/g, "");
}

// ============================================================================
// 측 측
// ============================================================================

async function main() {
  // 1) CSV 측
  const csvRaw = fs.readFileSync(csvFile, "utf8");
  const csvText = csvRaw.charCodeAt(0) === 0xFEFF ? csvRaw.slice(1) : csvRaw;   // BOM 측

  const parseRes = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,    // 사장님 spec — 측 측 측
    transformHeader: (h) => h.trim(),
  });
  if (parseRes.errors.length > 0) {
    console.warn("⚠️ CSV 측 측 측:", parseRes.errors.slice(0, 5));
  }
  const rows = parseRes.data;
  console.log(`📄 CSV 측 측: ${rows.length}행`);

  // 2) 주문번호 측 group
  const groups = new Map();
  for (const r of rows) {
    const orderNo = cleanStr(r["주문번호"]);
    if (!orderNo) continue;
    if (!groups.has(orderNo)) groups.set(orderNo, []);
    groups.get(orderNo).push(r);
  }
  console.log(`📦 unique 주문번호: ${groups.size}건`);
  console.log(`📋 측 항목 수: ${rows.length}건\n`);

  // 3) DB lookup
  console.log("🔍 DB lookup 측...");

  // 3-a) 측 task_no 측 → SKIP
  const taskNos = [];
  for (const [, grp] of groups) {
    taskNos.push(cleanStr(grp[0]["작업코드"]));
  }
  const { data: existing, error: exErr } = await supabase
    .from("tasks")
    .select("task_no")
    .eq("tenant_id", TENANT_ID)
    .in("task_no", taskNos);
  if (exErr) { console.error("❌ existing tasks lookup:", exErr); process.exit(1); }
  const existingSet = new Set((existing || []).map(r => r.task_no));
  console.log(`   · 이미 DB 측 측 task_no: ${existingSet.size}건`);

  // SKIP 측 task_no 측 측 측 catch (사장님 spec — 측 측 측 측 측)
  if (existingSet.size > 0) {
    const skippedNos = Array.from(existingSet);
    const { data: skippedDetails } = await supabase
      .from("tasks")
      .select("task_no, customer_name, status")
      .eq("tenant_id", TENANT_ID)
      .in("task_no", skippedNos);
    console.log(`   · SKIP 측 task 측 측:`);
    (skippedDetails || []).forEach(t => {
      console.log(`        - ${t.task_no} | 고객=${t.customer_name} | 상태=${t.status}`);
    });
  }

  // 3-b) work_types / appliance_types / service_types
  const [wtRes, atRes, stRes] = await Promise.all([
    supabase.from("work_types").select("id, code, service_type_id, appliance_type_id"),
    supabase.from("appliance_types").select("id, code, name"),
    supabase.from("service_types").select("id, code, name"),
  ]);
  if (wtRes.error || atRes.error || stRes.error) {
    console.error("❌ lookup:", wtRes.error || atRes.error || stRes.error);
    process.exit(1);
  }
  const workTypes = wtRes.data;
  const applianceByCode = new Map(atRes.data.map(a => [a.code, a.id]));
  const cleaningServiceId = stRes.data.find(s => s.code === "cleaning")?.id;

  function findCleaningWorkTypeId(applianceCode) {
    if (!cleaningServiceId || !applianceCode) return null;
    const aid = applianceByCode.get(applianceCode);
    if (!aid) return null;
    return workTypes.find(w => w.service_type_id === cleaningServiceId && w.appliance_type_id === aid)?.id || null;
  }
  function findAddonWorkTypeId(text) {
    if (!text) return null;
    for (const [kr, code] of Object.entries(ADDON_KR_TO_WT_CODE)) {
      if (String(text).includes(kr)) return workTypes.find(w => w.code === code)?.id || null;
    }
    return null;
  }

  // 3-c) users (기사) 매칭 — name 측
  const engineerNames = new Set();
  for (const [, grp] of groups) {
    const eng = cleanStr(grp[0]["배정기사"]);
    if (eng) engineerNames.add(eng);
  }
  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("id, name")
    .eq("tenant_id", TENANT_ID)
    .in("name", Array.from(engineerNames));
  if (uErr) { console.error("❌ users lookup:", uErr); process.exit(1); }
  const userByName = new Map((users || []).map(u => [u.name, u.id]));
  console.log(`   · users 매칭: ${userByName.size}/${engineerNames.size}명\n`);

  // 4) 측 group 측 측 (dry-run 측 commit 측 측)
  const stats = {
    inserted: 0,
    skipped: 0,
    engineerUnmatched: new Set(),
    statusUnknown: new Set(),
    serviceTypeWarn: [],
    applianceMappingFail: [],
    addonMappingFail: [],
    taskRows: [],
    itemCounts: 0,
  };

  for (const [orderNo, grp] of groups) {
    const first = grp[0];
    const taskNo = cleanStr(first["작업코드"]);
    if (existingSet.has(taskNo)) { stats.skipped++; continue; }

    // status 매핑 (그룹 측 측 측 + 사장님 spec)
    const statusRaw = cleanStr(first["상태"]);
    let status = STATUS_MAP[statusRaw];
    if (!status) {
      stats.statusUnknown.add(statusRaw || "(빈값)");
      status = "배정";    // fallback
    }

    // scheduled_at — X열 "00:00" 측 status="배정" + scheduled_at=NULL (사장님 최종 spec)
    //   → 캘린더 측 일정 측 측 X. 측 측 측 X.
    const customerContact = cleanStr(first["고객컨택일자"]);
    const scheduledTime   = cleanStr(first["기사약속시간"]);
    let scheduledAt = null;
    if (scheduledTime === "00:00" || !scheduledTime) {
      status = "배정";
      scheduledAt = null;    // 측 측 측 측 → 캘린더 측 측 측 X
    } else {
      scheduledAt = kstDateTimeToUTC(customerContact, scheduledTime);
    }

    // completed_at
    const completedRaw = cleanStr(first["작업완료일"]);
    const completedAt = completedRaw ? dateOnlyToISO(completedRaw) : null;

    // 배정기사
    const engName = cleanStr(first["배정기사"]);
    const assignedEngineerId = engName ? userByName.get(engName) : null;
    if (engName && !assignedEngineerId) stats.engineerUnmatched.add(engName);

    // product_price — Migration 033 측 task=주문 단위 measurement
    //   사장님 spec: 측 주문 항목들의 정산예정금액 합계
    const productPrice = grp.reduce((sum, r) => sum + toInt(r["정산예정금액"]), 0);

    // tasks INSERT row
    const taskRow = {
      tenant_id: TENANT_ID,
      category_id: CATEGORY_ID,
      principal_id: PRINCIPAL_ID,
      task_no: taskNo,
      customer_name: cleanStr(first["수취인명"]) || cleanStr(first["구매자명"]) || "—",
      phone:         cleanStr(first["수취인연락처1"]) || cleanStr(first["구매자연락처"]) || "",
      address:       cleanStr(first["주소"]),
      district:      cleanStr(first["지역키워드"]),
      channel:       "네이버",
      request_note:  cleanStr(first["배송메세지"]) || `네이버 주문 ${orderNo}`,
      status:        status,
      assigned_engineer_id: assignedEngineerId || null,
      scheduled_at:  scheduledAt,
      completed_at:  completedAt,
      product_price: productPrice,
      extra_fee:     0,
      travel_fee:    0,
      external_order_no:    orderNo,
      external_received_at: dateOnlyToISO(cleanStr(first["주문일시"])),
      category_data: {},
    };

    // task_items 측 (측 row → 측)
    const itemRows = [];
    for (const r of grp) {
      const serviceType = cleanStr(r["서비스종류"]);
      const serviceDiv  = cleanStr(r["서비스구분"]);
      const orderType = deriveOrderType(serviceType) || deriveOrderType(serviceDiv);

      if (!orderType) {
        stats.serviceTypeWarn.push({ task_no: taskNo, serviceType, serviceDiv });
        continue;
      }

      let workTypeId = null;
      let applianceTypeId = null;

      if (orderType === "본작업") {
        const appCode = APPLIANCE_KR_TO_CODE[extractAppliance(serviceDiv)] || null;
        if (!appCode) {
          stats.applianceMappingFail.push({ task_no: taskNo, serviceDiv });
          continue;
        }
        applianceTypeId = applianceByCode.get(appCode);
        workTypeId = findCleaningWorkTypeId(appCode);
      } else {
        // 추가선택
        workTypeId = findAddonWorkTypeId(serviceDiv);
        if (!workTypeId) {
          stats.addonMappingFail.push({ task_no: taskNo, serviceDiv });
          continue;
        }
      }
      if (!workTypeId) continue;

      itemRows.push({
        work_type_id: workTypeId,
        appliance_type_id: applianceTypeId,   // 추가선택 측 NULL
        qty: toInt(r["수량"]) || 1,
        unit_price: toInt(r["최종상품금액"]),
        order_type: orderType,
        product_order_id: cleanStr(r["상품주문번호"]) || null,
        metadata: {
          item_code: cleanStr(r["작업코드"]),
          external_item_no: cleanStr(r["상품주문번호"]),
        },
      });
    }

    stats.taskRows.push({ taskRow, itemRows, sheetValues: {
      principal_amount_sheet: grp.reduce((s, r) => s + toInt(r["도급사정산액"]), 0),
      engineer_amount_sheet:  grp.reduce((s, r) => s + toInt(r["회사배분액"]), 0),
      total_settlement_sheet: grp.reduce((s, r) => s + toInt(r["정산예정금액"]), 0),
    }});
    stats.itemCounts += itemRows.length;
  }

  // 5) 측 출력
  console.log(`${"=".repeat(70)}`);
  console.log(`📊 측 측`);
  console.log(`${"=".repeat(70)}`);
  console.log(`  · INSERT 측 task:     ${stats.taskRows.length}건`);
  console.log(`  · INSERT 측 task_items: ${stats.itemCounts}건`);
  console.log(`  · 측 중복 SKIP:        ${stats.skipped}건`);
  console.log(`  · 기사 매칭 실패:     ${stats.engineerUnmatched.size}명 → ${Array.from(stats.engineerUnmatched).join(", ") || "(측 측)"}`);
  console.log(`  · 상태값 미인식:      ${stats.statusUnknown.size}종 → ${Array.from(stats.statusUnknown).join(", ") || "(측 측)"}`);
  console.log(`  · 서비스종류 이상값:   ${stats.serviceTypeWarn.length}건`);
  console.log(`  · appliance 매핑 실패: ${stats.applianceMappingFail.length}건`);
  console.log(`  · addon 매핑 실패:     ${stats.addonMappingFail.length}건`);
  if (stats.serviceTypeWarn.length > 0) {
    console.log(`\n  ⚠️ 서비스종류 이상값 측 측 3건:`, stats.serviceTypeWarn.slice(0, 3));
  }
  if (stats.applianceMappingFail.length > 0) {
    console.log(`\n  ⚠️ appliance 매핑 실패 측 3건:`, stats.applianceMappingFail.slice(0, 3));
  }
  if (stats.addonMappingFail.length > 0) {
    console.log(`\n  ⚠️ addon 매핑 실패 측 3건:`, stats.addonMappingFail.slice(0, 3));
  }

  // 첫 5건 측 측
  console.log(`\n${"=".repeat(70)}`);
  console.log(`📋 첫 5건 INSERT 측 측 row`);
  console.log(`${"=".repeat(70)}`);
  for (let i = 0; i < Math.min(5, stats.taskRows.length); i++) {
    const { taskRow, itemRows } = stats.taskRows[i];
    console.log(`\n[${i + 1}] task_no=${taskRow.task_no} | 고객=${taskRow.customer_name} | 상태=${taskRow.status} | 측 ${itemRows.length}건`);
    console.log(`    scheduled_at: ${taskRow.scheduled_at}`);
    console.log(`    completed_at: ${taskRow.completed_at}`);
    console.log(`    product_price: ${taskRow.product_price}`);
    console.log(`    assigned_engineer_id: ${taskRow.assigned_engineer_id || "(매칭 X)"}`);
    for (let j = 0; j < itemRows.length; j++) {
      const it = itemRows[j];
      console.log(`      - item[${j}] order_type=${it.order_type} | qty=${it.qty} | unit_price=${it.unit_price} | work_type_id=${it.work_type_id?.slice(0, 8)}...`);
    }
  }

  if (isDryRun) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`🔍 DRY-RUN 측 — INSERT 측 측 측. --commit 측 측 측 실제 측 측 측.`);
    console.log(`${"=".repeat(70)}\n`);
    return;
  }

  // ============================================================================
  // COMMIT — 실제 INSERT
  // ============================================================================
  console.log(`\n${"=".repeat(70)}`);
  console.log(`✅ COMMIT — 실제 INSERT 측 측...`);
  console.log(`${"=".repeat(70)}\n`);

  const insertedTaskIds = [];
  const errors = [];
  for (let i = 0; i < stats.taskRows.length; i++) {
    const { taskRow, itemRows, sheetValues } = stats.taskRows[i];

    // task INSERT
    const { data: tIns, error: tErr } = await supabase
      .from("tasks")
      .insert(taskRow)
      .select("id, task_no, status")
      .single();
    if (tErr || !tIns) {
      console.error(`❌ [${taskRow.task_no}] task INSERT:`, tErr?.message);
      errors.push({ task_no: taskRow.task_no, error: tErr?.message });
      continue;
    }

    // task_items INSERT
    if (itemRows.length > 0) {
      const itemsWithTaskId = itemRows.map(r => ({ ...r, task_id: tIns.id }));
      const { error: iErr } = await supabase.from("task_items").insert(itemsWithTaskId);
      if (iErr) {
        console.error(`❌ [${taskRow.task_no}] task_items INSERT:`, iErr.message);
        errors.push({ task_no: taskRow.task_no, error: `items: ${iErr.message}` });
        continue;
      }
    }

    insertedTaskIds.push({ id: tIns.id, task_no: tIns.task_no, status: tIns.status, sheetValues });
    if ((i + 1) % 10 === 0) console.log(`  · ${i + 1}/${stats.taskRows.length}건 측...`);
  }

  console.log(`\n✅ ${insertedTaskIds.length}/${stats.taskRows.length}건 INSERT 측`);
  if (errors.length > 0) console.log(`❌ 실패 ${errors.length}건:`, errors.slice(0, 5));

  // ============================================================================
  // post-commit verification — 측 측 측 측 측 측 비교 (사장님 spec)
  // ============================================================================
  console.log(`\n${"=".repeat(70)}`);
  console.log(`🔬 post-commit — 측 측 측 (trigger) vs 시트 값 비교`);
  console.log(`${"=".repeat(70)}`);
  console.log(`  · status='완료' 측 측 task 측 측 trigger 측 측 자동 측 측 measurement`);
  console.log(`  · 측 5건 측 비교 측 측\n`);

  const completedSamples = insertedTaskIds.filter(t => t.status === "완료").slice(0, 5);
  for (const t of completedSamples) {
    const { data: pay } = await supabase
      .from("payments")
      .select("principal_amount, engineer_amount, total_amount, calc_method")
      .eq("task_id", t.id)
      .maybeSingle();
    if (!pay) {
      console.log(`  · ${t.task_no}: payments 측 측 측 측 X`);
      continue;
    }
    const sheet = t.sheetValues;
    const diffPrincipal = pay.principal_amount - sheet.principal_amount_sheet;
    const diffEngineer  = pay.engineer_amount  - sheet.engineer_amount_sheet;
    console.log(`  · ${t.task_no}`);
    console.log(`      도급사:   trigger=${pay.principal_amount}, 시트=${sheet.principal_amount_sheet}, 측=${diffPrincipal}`);
    console.log(`      회사배분: trigger=${pay.engineer_amount}, 시트=${sheet.engineer_amount_sheet}, 측=${diffEngineer}`);
    console.log(`      calc_method=${pay.calc_method}`);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`측 측 측`);
  console.log(`${"=".repeat(70)}\n`);
}

main().catch(e => {
  console.error("❌ 측 측 측 측:", e);
  process.exit(1);
});

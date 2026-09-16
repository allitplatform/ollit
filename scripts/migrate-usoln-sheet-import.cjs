// =============================================================================
// usol_n 운영 시트 이관 스크립트 (dry-run 우선)
// 2026-05-24
//
// 입력: scripts/유솔홈케어_운영.xlsx
// 매칭 키: 시트.상품주문번호 ↔ task_items.product_order_id
//
// 처리 규칙:
//   1) 매칭 1278건 → UPDATE (시트값 있을 때만, NULL 덮어쓰기 X)
//   2) 시트 신규 9건 → INSERT 후보 (시트 작업코드 그대로 사용)
//   3) 취소 6건 (사장님 확정 상품주문번호) → task_item 삭제 + task 활성 item 0이면 status='취소'
//   4) 이미 취소 25건 / YS-N 신규 7건 → 손대지 않음
//
// 실행:
//   node scripts/migrate-usoln-sheet-import.cjs           # dry-run (기본)
//   node scripts/migrate-usoln-sheet-import.cjs --commit  # 실제 실행 (사장님 OK 후)
//
// 안전:
//   · dry-run = 실제 쓰기 0
//   · commit 모드라도 INSERT/UPDATE 한 건씩 처리 (배치 실패 risk 격리)
//   · KST→UTC 변환 / 시트 NULL 보호
// =============================================================================

const fs = require("fs"), path = require("path");
const XLSX = require("xlsx");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ============================================================
// 상수
// ============================================================
const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const CATEGORY_ID = "33333333-3333-3333-3333-333333333001";
const USOL_N_PRINCIPAL_ID = "22222222-2222-2222-2222-222222222006";
const SHEET_PATH = path.join(__dirname, "유솔홈케어_운영.xlsx");

const args = process.argv.slice(2);
const STEP_ARG = args.find(a => a.startsWith("--step="));
const STEP = STEP_ARG ? STEP_ARG.split("=")[1] : null;     // "update" | "insert" | "cancel" | "delete"
const COMMIT = !!STEP;                                      // step 측 정해진 경우만 실제 쓰기
const VALID_STEPS = ["update", "update-dates", "insert", "cancel", "delete"];
if (STEP && !VALID_STEPS.includes(STEP)) {
  console.error(`❌ --step 값은 ${VALID_STEPS.join(" / ")} 중 하나여야 합니다 (받은 값: "${STEP}")`);
  process.exit(1);
}
const MODE = COMMIT ? `✅ COMMIT step=${STEP} (실제 쓰기)` : "🔍 DRY-RUN (시뮬레이션만)";

// 사장님 확정 — 취소 후보 6개
const CANCEL_POIDS = new Set([
  "2026051767451881", // 공형준
  "2026051660437861", // 장성숙
  "2026051648979211", // 한아영
  "2026051585005751", // 최도연 - 스탠드
  "2026051585005761", // 최도연 - 벽걸이
  "2026051246842031", // 박은주 - 송풍팬분해
]);

// 사장님 확정 — task 통째 삭제 (외부 완결, DB row 불필요)
const DELETE_TASK_NOS = new Set([
  "YS-260424-072", // 성남 단체 (단가확정 외부 완결)
]);

// 시트값으로 status·기사·일정을 덮어쓰지 않을 task (DB값 유지)
// 금액 백필(unit_price/net_amount/customer_paid_amount/naver_settled_at)은 적용
const SKIP_TASK_UPDATE_NOS = new Set([
  "YS-260504-011", // 양동주 — 시트가 옛 정보
  "YS-260504-001", // 김민정 — 5/9 정산 완료된 추가선택건
]);

// task_item 단건 INSERT — 시트 row가 활성 task에 새로 task_item으로 들어가야 하는 케이스
// (시트 매칭은 옛 취소 task의 item에 잡히지만 실제로는 새 활성 task에 item을 추가해야 함)
const STANDALONE_ITEM_INSERTS = [
  {
    poid: "2026051283417611",        // 차진영 추가선택
    target_task_no: "YS-260513-006", // 새 활성 task
    order_type: "추가선택",
    note: "차진영 추가선택 — 옛 취소 task(YS-260513-005)에만 존재, 새 활성 task에 INSERT 필요",
  },
];
const STANDALONE_POIDS = new Set(STANDALONE_ITEM_INSERTS.map(s => s.poid));

// 상태 매핑
const STATUS_MAP = {
  "작업완료": "완료",
  "일정확정": "확정",
  "기사배정완료": "배정",
  "접수": "미배정",
  "취소": "취소",
};

// ============================================================
// 헬퍼
// ============================================================
const norm = (v) => v == null ? "" : String(v).trim();
const toInt = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
};

// KST naive ISO("2026-05-23T09:00:00") → UTC ISO
function kstNaiveISOToUTC(s) {
  if (!s) return null;
  const ts = String(s).trim();
  if (!ts) return null;
  // 이미 timezone 측 들어있으면 그대로
  if (/[+-]\d{2}:?\d{2}$|Z$/.test(ts)) {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  // "YYYY-MM-DDTHH:MM:SS" → KST 가정
  const d = new Date(ts + "+09:00");
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// 날짜 토큰 추출 — 점·하이픈·슬래시 모두 허용
// 입력 예: "2026.05.18" / "2026-05-18" / "2026/05/18" / "2026-05-18T..." / "2026.05.18 09:00"
// 반환: { yyyy, mm, dd } 또는 null
function parseYmd(s) {
  if (!s) return null;
  const ts = String(s).trim();
  const m = ts.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (!m) return null;
  return { yyyy: m[1], mm: m[2].padStart(2, "0"), dd: m[3].padStart(2, "0") };
}

// 날짜만 (KST 자정) → UTC ISO
function kstDateOnlyToUTC(s) {
  const p = parseYmd(s);
  if (!p) return null;
  const d = new Date(`${p.yyyy}-${p.mm}-${p.dd}T00:00:00+09:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// 추가선택 keyword → work_types.code (src/lib/usolNTasksDb.js와 동일)
const ADDON_KR_TO_WT_CODE = {
  "냉매":     "refri_no_appliance",
  "송풍팬":   "fan_disassembly",
  "층고":     "fan_disassembly",
  "실외기":   "outdoor_unit",
  "피톤치드": "phytoncide",
};

// 시트 서비스구분 → appliance code
function mapApplianceCode(serviceDiv) {
  const d = String(serviceDiv || "");
  if (/벽걸이/.test(d)) return "wall";
  if (/스탠드/.test(d)) return "stand";
  if (/1way/i.test(d)) return "1way";
  if (/2way/i.test(d)) return "2way";
  if (/4way|천장형/i.test(d)) return "4way";
  return null;
}

// 시트 (서비스종류, 서비스구분) → { work_type_id, appliance_type_id, order_type } 또는 { error }
function mapServiceToWorkType(serviceType, serviceDiv, ctx) {
  const st = String(serviceType || "");
  const sd = String(serviceDiv || "");
  // 본작업 (cleaning)
  if (/에어컨청소/.test(st)) {
    const apCode = mapApplianceCode(sd);
    if (!apCode) return { error: `appliance 매핑 실패 — serviceDiv="${sd}"` };
    const apId = ctx.applianceByCode.get(apCode);
    if (!apId) return { error: `appliance_types.id 없음 — code=${apCode}` };
    const wt = ctx.workTypes.find(w => w.service_type_id === ctx.cleaningServiceId && w.appliance_type_id === apId);
    if (!wt) return { error: `work_type 없음 — cleaning + ${apCode}` };
    return { work_type_id: wt.id, appliance_type_id: apId, order_type: "본작업" };
  }
  // 추가선택
  if (/추가선택/.test(st)) {
    for (const [kr, code] of Object.entries(ADDON_KR_TO_WT_CODE)) {
      if (sd.includes(kr)) {
        const wt = ctx.workTypes.find(w => w.code === code);
        if (!wt) return { error: `addon work_type 없음 — ${code}` };
        return { work_type_id: wt.id, appliance_type_id: null, order_type: "추가선택" };
      }
    }
    return { error: `추가선택 매핑 실패 — serviceDiv="${sd}"` };
  }
  return { error: `서비스종류 unknown — "${st}"` };
}

// 고객컨택일자 + 기사약속시간 → KST → UTC
function combineSchedule(contactDate, schedTime) {
  const cd = norm(contactDate);
  const st = norm(schedTime);
  if (!cd) return null;
  const p = parseYmd(cd);
  if (!p) return null;
  const ymd = `${p.yyyy}-${p.mm}-${p.dd}`;
  // 시각 추출 — "00:00" 또는 빈값이면 scheduled_at NULL (사장님 spec)
  if (!st || st === "00:00") return null;
  // st 측 "HH:MM" / "HH:MM:SS" / ISO ("2026-05-23T09:00:00") catch
  let hm = null;
  const isoT = st.match(/T(\d{2}):(\d{2})/);
  const hhmm = st.match(/^(\d{1,2}):(\d{2})/);
  if (isoT) hm = `${isoT[1]}:${isoT[2]}`;
  else if (hhmm) hm = `${hhmm[1].padStart(2, "0")}:${hhmm[2]}`;
  if (!hm) return null;
  const d = new Date(`${ymd}T${hm}:00+09:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ============================================================
// 메인
// ============================================================
(async () => {
  console.log("=".repeat(80));
  console.log(`usol_n 운영 시트 이관 — ${MODE}`);
  console.log("=".repeat(80));

  // 1) 시트 로드
  const wb = XLSX.readFile(SHEET_PATH, { cellDates: false });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false });
  console.log(`[1] 시트 row: ${rows.length}`);

  // 2) DB tasks/task_items 로드
  const tasksById = new Map();
  {
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await sb
        .from("tasks")
        .select("id, task_no, status, customer_name, scheduled_at, completed_at, assigned_engineer_id, channel")
        .eq("principal_id", USOL_N_PRINCIPAL_ID)
        .range(from, from + PAGE - 1);
      if (!data?.length) break;
      for (const t of data) tasksById.set(t.id, t);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  const dbTaskIds = [...tasksById.keys()];

  const items = [];
  for (let i = 0; i < dbTaskIds.length; i += 200) {
    const ids = dbTaskIds.slice(i, i + 200);
    const { data } = await sb
      .from("task_items")
      .select("*")
      .in("task_id", ids);
    if (data) items.push(...data);
  }
  console.log(`[2] DB tasks ${tasksById.size}건 / task_items ${items.length}건`);

  // 3) users (배정기사 매핑)
  const { data: users } = await sb.from("users").select("id, name").eq("tenant_id", TENANT_ID);
  const userByName = new Map((users || []).map(u => [norm(u.name), u.id]));

  // 4) 시트 ↔ DB 매칭
  const sheetByOrd = new Map();
  for (const r of rows) {
    const ord = norm(r["상품주문번호"]);
    if (ord) sheetByOrd.set(ord, r);
  }
  // 매칭 — 활성 task 우선, 같은 poid의 취소 task item은 후보 제외
  // (중복 11쌍 — 옛 취소 행 + 새 활성 행 공존 → 새 행에만 적용)
  const dbItemByOrd = new Map();
  for (const it of items) {
    const ord = norm(it.product_order_id);
    if (!ord) continue;
    const taskOfItem = tasksById.get(it.task_id);
    if (!taskOfItem) continue;
    const isCancelled = taskOfItem.status === "취소";
    if (dbItemByOrd.has(ord)) {
      // 이미 들어가 있으면 — 기존 행이 취소이고 새 행이 활성이면 교체
      const prev = dbItemByOrd.get(ord);
      const prevTask = tasksById.get(prev.task_id);
      const prevCancelled = prevTask?.status === "취소";
      if (prevCancelled && !isCancelled) dbItemByOrd.set(ord, it);
      // 둘 다 활성이거나 둘 다 취소면 첫 번째 유지
    } else {
      dbItemByOrd.set(ord, it);
    }
  }

  // 5) UPDATE plan 생성
  const updateTaskPlans = new Map();  // task_id → updates
  const updateItemPlans = [];          // [{item, updates}]
  const taskWarnings = [];

  for (const [ord, sR] of sheetByOrd.entries()) {
    // standalone INSERT 대상 — 매칭 측 catch UPDATE 대상에서 제외 (별도 INSERT plan)
    if (STANDALONE_POIDS.has(ord)) continue;

    const it = dbItemByOrd.get(ord);
    if (!it) continue; // 시트만 — INSERT는 별도

    const task = tasksById.get(it.task_id);
    if (!task) continue;

    // ───── task 레벨 UPDATE ─────
    // 삭제 대상 task는 task/task_item 모두 skip
    if (DELETE_TASK_NOS.has(task.task_no)) continue;

    const skipTaskUpdate = SKIP_TASK_UPDATE_NOS.has(task.task_no);
    if (!updateTaskPlans.has(task.id) && !skipTaskUpdate) {
      const u = {};
      const statusKey = norm(sR["상태"]);
      const newStatus = STATUS_MAP[statusKey];
      if (newStatus && newStatus !== task.status) u.status = newStatus;

      const engName = norm(sR["배정기사"]);
      if (engName) {
        const uid = userByName.get(engName);
        if (uid && uid !== task.assigned_engineer_id) u.assigned_engineer_id = uid;
        else if (!uid) taskWarnings.push({ task_no: task.task_no, reason: `배정기사 매칭 실패: "${engName}"` });
      }

      const schedAt = combineSchedule(sR["고객컨택일자"], sR["기사약속시간"]);
      if (schedAt && schedAt !== task.scheduled_at) u.scheduled_at = schedAt;

      const compRaw = norm(sR["작업완료일"]);
      if (compRaw) {
        const compISO = compRaw.length <= 10 ? kstDateOnlyToUTC(compRaw) : kstNaiveISOToUTC(compRaw);
        if (compISO && compISO !== task.completed_at) u.completed_at = compISO;
      }
      // 시트값 NULL이면 task.completed_at 유지 (보호)

      if (Object.keys(u).length) updateTaskPlans.set(task.id, { task, updates: u });
    }

    // ───── task_item 레벨 UPDATE ─────
    const iu = {};
    const settle = toInt(sR["정산예정금액"]);
    if (settle != null && settle !== it.unit_price) iu.unit_price = settle;

    const netAmt = toInt(sR["네이버정산금액"]);
    if (netAmt != null && netAmt !== it.net_amount) iu.net_amount = netAmt;

    const custPaid = toInt(sR["최종상품금액"]);
    if (custPaid != null && custPaid !== it.customer_paid_amount) iu.customer_paid_amount = custPaid;

    const naverSettledRaw = norm(sR["네이버정산완료일"]);
    if (naverSettledRaw) {
      const naverSettledISO = naverSettledRaw.length <= 10 ? kstDateOnlyToUTC(naverSettledRaw) : kstNaiveISOToUTC(naverSettledRaw);
      if (naverSettledISO && naverSettledISO !== it.naver_settled_at) iu.naver_settled_at = naverSettledISO;
    }

    // metadata 측 도급사정산액 / 회사배분액 보관
    const dogup = toInt(sR["도급사정산액"]);
    const compShare = toInt(sR["회사배분액"]);
    if (dogup != null || compShare != null) {
      const md = { ...(it.metadata || {}) };
      let changed = false;
      if (dogup != null && md.dogup_settle !== dogup) { md.dogup_settle = dogup; changed = true; }
      if (compShare != null && md.company_share !== compShare) { md.company_share = compShare; changed = true; }
      if (changed) iu.metadata = md;
    }

    if (Object.keys(iu).length) updateItemPlans.push({ item: it, task, updates: iu });
  }

  // 6) INSERT plan — 시트만 9건 (work_type 매핑 + grouping)
  // work_type / appliance / service_type 캐시
  const [wtRes, atRes, stRes] = await Promise.all([
    sb.from("work_types").select("id, code, service_type_id, appliance_type_id"),
    sb.from("appliance_types").select("id, code, name"),
    sb.from("service_types").select("id, code, name"),
  ]);
  const ctx = {
    workTypes: wtRes.data || [],
    applianceByCode: new Map((atRes.data || []).map(a => [a.code, a.id])),
    cleaningServiceId: (stRes.data || []).find(s => s.code === "cleaning")?.id,
  };

  const sheetOnlyOrds = [...sheetByOrd.keys()].filter(k => !dbItemByOrd.has(k));

  // DB의 기존 task_no set (멱등성)
  const dbTaskNos = new Set([...tasksById.values()].map(t => t.task_no));
  const dbPoidSet = new Set([...dbItemByOrd.keys()]);

  // task_no 기준 grouping — 같은 task_no를 가진 신규 ord 묶기
  const sheetOnlyByTaskNo = new Map();
  for (const ord of sheetOnlyOrds) {
    const sR = sheetByOrd.get(ord);
    const tn = norm(sR["작업코드"]);
    if (!tn) continue;
    if (!sheetOnlyByTaskNo.has(tn)) sheetOnlyByTaskNo.set(tn, []);
    sheetOnlyByTaskNo.get(tn).push({ ord, sheet: sR });
  }

  // task 신규 INSERT vs 기존 task에 task_item 추가
  const insertNewTaskPlans = [];      // 신규 task + items
  const additionalItemPlans = [];     // 기존 task에 task_item만 추가
  const insertWarnings = [];

  for (const [taskNo, group] of sheetOnlyByTaskNo.entries()) {
    if (dbTaskNos.has(taskNo)) {
      // task 이미 존재 — task_items만 추가
      const existingTask = [...tasksById.values()].find(t => t.task_no === taskNo);
      for (const { ord, sheet } of group) {
        if (dbPoidSet.has(ord)) continue; // 멱등성 — 이미 같은 poid의 item 존재
        const mapping = mapServiceToWorkType(sheet["서비스종류"], sheet["서비스구분"], ctx);
        if (mapping.error) insertWarnings.push({ ord, taskNo, reason: mapping.error });
        additionalItemPlans.push({
          target_task: existingTask,
          ord,
          sheet,
          mapping,
        });
      }
    } else {
      // 신규 task + N items
      const firstSheet = group[0].sheet;
      const itemPlans = group.map(({ ord, sheet }) => {
        const mapping = mapServiceToWorkType(sheet["서비스종류"], sheet["서비스구분"], ctx);
        if (mapping.error) insertWarnings.push({ ord, taskNo, reason: mapping.error });
        return { ord, sheet, mapping };
      });
      insertNewTaskPlans.push({
        task_no: taskNo,
        first_sheet: firstSheet,
        group,
        item_plans: itemPlans,
      });
    }
  }

  // dry-run 보고용 평탄화
  const insertPlans = insertNewTaskPlans.map(p => {
    const sR = p.first_sheet;
    return {
      task_no: p.task_no,
      customer: norm(sR["수취인명"]) || norm(sR["구매자명"]),
      status: STATUS_MAP[norm(sR["상태"])] || "미배정",
      engineer: norm(sR["배정기사"]),
      service: norm(sR["서비스종류"]),
      appliance: norm(sR["서비스구분"]),
      item_count: p.item_plans.length,
      ords: p.item_plans.map(i => i.ord),
      total_cust: p.item_plans.reduce((s, i) => s + (toInt(i.sheet["최종상품금액"]) || 0), 0),
      mapping_errors: p.item_plans.filter(i => i.mapping.error).map(i => i.mapping.error),
    };
  });

  // 7) 취소 plan — 6개
  const cancelPlans = [];
  for (const ord of CANCEL_POIDS) {
    const it = dbItemByOrd.get(ord);
    if (!it) {
      cancelPlans.push({ ord, status: "DB 측 측 X", task_no: null });
      continue;
    }
    const task = tasksById.get(it.task_id);
    cancelPlans.push({ ord, item: it, task });
  }

  // 7-2) 취소 후 task status='취소' UPDATE 후보 — task_item 잔존 0
  const taskItemsByTask = new Map();
  for (const it of items) {
    if (!taskItemsByTask.has(it.task_id)) taskItemsByTask.set(it.task_id, []);
    taskItemsByTask.get(it.task_id).push(it);
  }
  const cancelItemsByTask = new Map();
  for (const cp of cancelPlans) {
    if (!cp.item || !cp.task) continue;
    if (!cancelItemsByTask.has(cp.task.id)) cancelItemsByTask.set(cp.task.id, []);
    cancelItemsByTask.get(cp.task.id).push(cp.item);
  }
  const taskCancelPlans = [];
  for (const [taskId, beingDeleted] of cancelItemsByTask.entries()) {
    const all = taskItemsByTask.get(taskId) || [];
    const remaining = all.filter(it => !beingDeleted.find(d => d.id === it.id));
    if (remaining.length === 0) {
      const t = tasksById.get(taskId);
      if (t && t.status !== "취소") {
        taskCancelPlans.push({ task: t, deleted_count: beingDeleted.length, total: all.length });
      }
    }
  }

  // 8) 삭제 plan — 사장님 확정 task 통째 삭제 (외부 완결)
  const deletePlans = [];
  for (const taskNo of DELETE_TASK_NOS) {
    const task = [...tasksById.values()].find(t => t.task_no === taskNo);
    if (!task) { deletePlans.push({ task_no: taskNo, status: "DB 없음" }); continue; }
    const taskItems = items.filter(it => it.task_id === task.id);
    deletePlans.push({ task, items: taskItems });
  }

  // 9-pre) update-dates 전용 plan — scheduled_at / completed_at 만 갱신
  // SKIP_TASK_UPDATE_NOS는 날짜도 보호 (DB값 유지)
  // 시트값 NULL이면 DB값 유지 (NULL 덮어쓰기 금지)
  const dateUpdatePlans = [];   // [{ task, updates: { scheduled_at?, completed_at? }, sheet_row, parsed }]
  const dateParseSamples = [];  // 시트 원본 → ISO 변환 샘플
  for (const [ord, sR] of sheetByOrd.entries()) {
    if (STANDALONE_POIDS.has(ord)) continue;
    const it = dbItemByOrd.get(ord);
    if (!it) continue;
    const task = tasksById.get(it.task_id);
    if (!task) continue;
    if (DELETE_TASK_NOS.has(task.task_no)) continue;
    if (SKIP_TASK_UPDATE_NOS.has(task.task_no)) continue; // 양동주·김민정 — 날짜도 보호

    const u = {};
    const parsed = {};

    const schedAt = combineSchedule(sR["고객컨택일자"], sR["기사약속시간"]);
    if (schedAt && schedAt !== task.scheduled_at) {
      u.scheduled_at = schedAt;
      parsed.scheduled = { raw_date: sR["고객컨택일자"], raw_time: sR["기사약속시간"], iso: schedAt };
    }

    const compRaw = norm(sR["작업완료일"]);
    if (compRaw) {
      const compISO = compRaw.length <= 10 ? kstDateOnlyToUTC(compRaw) : kstNaiveISOToUTC(compRaw);
      if (compISO && compISO !== task.completed_at) {
        u.completed_at = compISO;
        parsed.completed = { raw: compRaw, iso: compISO };
      }
    }

    if (Object.keys(u).length) {
      // 같은 task에 대해 여러 item이 같은 날짜 갱신 시도 — 첫 항목만 (중복 제거)
      if (!dateUpdatePlans.find(p => p.task.id === task.id)) {
        dateUpdatePlans.push({ task, updates: u, sheet_row: sR, parsed });
        if (dateParseSamples.length < 5 && (parsed.scheduled || parsed.completed)) {
          dateParseSamples.push({ task_no: task.task_no, parsed });
        }
      }
    }
  }

  // 9-pre2) update-dates 전용 task_items 갱신 — naver_settled_at 보충
  // (시트 '네이버정산완료일' 점 형식이라 1단계에서 0건 갱신됐던 누락)
  const dateItemPlans = [];           // [{ item, task, updates: { naver_settled_at } }]
  const naverSettledParseSamples = [];
  for (const [ord, sR] of sheetByOrd.entries()) {
    if (STANDALONE_POIDS.has(ord)) continue;
    const it = dbItemByOrd.get(ord);
    if (!it) continue;
    const task = tasksById.get(it.task_id);
    if (!task) continue;
    if (DELETE_TASK_NOS.has(task.task_no)) continue;
    if (SKIP_TASK_UPDATE_NOS.has(task.task_no)) continue; // 양동주·김민정 — naver_settled_at도 보호

    const nsRaw = norm(sR["네이버정산완료일"]);
    if (!nsRaw) continue;
    const nsISO = nsRaw.length <= 10 ? kstDateOnlyToUTC(nsRaw) : kstNaiveISOToUTC(nsRaw);
    if (!nsISO) continue;
    if (nsISO === it.naver_settled_at) continue;

    dateItemPlans.push({ item: it, task, updates: { naver_settled_at: nsISO }, raw: nsRaw });
    if (naverSettledParseSamples.length < 3) {
      naverSettledParseSamples.push({ task_no: task.task_no, poid: ord, raw: nsRaw, iso: nsISO });
    }
  }

  // 9) standalone task_item INSERT plan — 차진영 등
  const standalonePlans = [];
  for (const spec of STANDALONE_ITEM_INSERTS) {
    const sR = sheetByOrd.get(spec.poid);
    if (!sR) { standalonePlans.push({ ...spec, error: "시트 행 없음" }); continue; }
    const targetTask = [...tasksById.values()].find(t => t.task_no === spec.target_task_no);
    if (!targetTask) { standalonePlans.push({ ...spec, error: `대상 task ${spec.target_task_no} 없음` }); continue; }
    const mapping = mapServiceToWorkType(sR["서비스종류"], sR["서비스구분"], ctx);
    if (mapping.error) insertWarnings.push({ ord: spec.poid, taskNo: spec.target_task_no, reason: mapping.error });
    standalonePlans.push({
      ...spec,
      target_task: targetTask,
      sheet_row: sR,
      mapping,
      unit_price: toInt(sR["정산예정금액"]),
      net_amount: toInt(sR["네이버정산금액"]),
      customer_paid_amount: toInt(sR["최종상품금액"]),
    });
  }

  // ============================================================
  // dry-run 보고
  // ============================================================
  console.log("\n" + "=".repeat(80));
  console.log("[A] UPDATE 계획");
  console.log("=".repeat(80));
  console.log(`  · task UPDATE        : ${updateTaskPlans.size}건`);
  console.log(`  · task_items UPDATE  : ${updateItemPlans.length}건`);

  // task 변경 field 분포
  const taskFieldCnt = {};
  for (const { updates } of updateTaskPlans.values()) {
    for (const f of Object.keys(updates)) taskFieldCnt[f] = (taskFieldCnt[f] || 0) + 1;
  }
  console.log(`  · task field 분포:`);
  for (const [f, c] of Object.entries(taskFieldCnt).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${f.padEnd(22)} : ${c}건`);
  }
  // item 변경 field 분포
  const itemFieldCnt = {};
  for (const { updates } of updateItemPlans) {
    for (const f of Object.keys(updates)) itemFieldCnt[f] = (itemFieldCnt[f] || 0) + 1;
  }
  console.log(`  · task_item field 분포:`);
  for (const [f, c] of Object.entries(itemFieldCnt).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${f.padEnd(22)} : ${c}건`);
  }

  // status 변경 분포
  const statusChanges = {};
  for (const { task, updates } of updateTaskPlans.values()) {
    if (!updates.status) continue;
    const k = `${task.status} → ${updates.status}`;
    statusChanges[k] = (statusChanges[k] || 0) + 1;
  }
  if (Object.keys(statusChanges).length) {
    console.log(`  · status 변경 분포:`);
    for (const [k, c] of Object.entries(statusChanges).sort((a, b) => b[1] - a[1])) {
      console.log(`      ${k.padEnd(22)} : ${c}건`);
    }
  }

  // 날짜 갱신 plan dry-run 출력
  const dateSchedCnt = dateUpdatePlans.filter(p => p.updates.scheduled_at).length;
  const dateCompCnt = dateUpdatePlans.filter(p => p.updates.completed_at).length;
  const naverSettledCnt = dateItemPlans.length;
  console.log("\n[A-2] 날짜 갱신 계획 (--step=update-dates)");
  console.log("=".repeat(80));
  console.log(`  · scheduled_at      UPDATE 예정 : ${dateSchedCnt}건  (tasks)`);
  console.log(`  · completed_at      UPDATE 예정 : ${dateCompCnt}건  (tasks)`);
  console.log(`  · naver_settled_at  UPDATE 예정 : ${naverSettledCnt}건  (task_items)`);
  console.log(`  · 총 task UPDATE       (중복 제거): ${dateUpdatePlans.length}건`);
  console.log(`  · 총 task_item UPDATE  (단일 필드): ${dateItemPlans.length}건`);
  console.log(`  · 보호 대상 (SKIP)              : 양동주 YS-260504-011 / 김민정 YS-260504-001`);

  console.log(`  scheduled/completed 파싱 샘플 5건:`);
  for (const s of dateParseSamples) {
    if (s.parsed.scheduled) console.log(`    · ${s.task_no} | sched: "${s.parsed.scheduled.raw_date}" + "${s.parsed.scheduled.raw_time}" → ${s.parsed.scheduled.iso}`);
    if (s.parsed.completed) console.log(`    · ${s.task_no} | comp : "${s.parsed.completed.raw}" → ${s.parsed.completed.iso}`);
  }
  console.log(`  naver_settled_at 파싱 샘플 3건:`);
  for (const s of naverSettledParseSamples) {
    console.log(`    · ${s.task_no} | poid=${s.poid} | "${s.raw}" → ${s.iso}`);
  }

  console.log("\n[B] INSERT 계획 — 신규 task + task_items 통째");
  console.log("=".repeat(80));
  const totalNewItems = insertNewTaskPlans.reduce((s, p) => s + p.item_plans.length, 0);
  console.log(`  · 신규 task          : ${insertNewTaskPlans.length}`);
  console.log(`  · 신규 task_items 총: ${totalNewItems}`);
  for (const p of insertPlans) {
    console.log(`  · ${p.task_no} | ${p.customer} | ${p.status} | 기사='${p.engineer || "(없음)"}' | ${p.service}/${p.appliance} | items=${p.item_count} | cust 합=${p.total_cust}`);
    for (const o of p.ords) console.log(`      · ord=${o}`);
    if (p.mapping_errors.length) for (const e of p.mapping_errors) console.log(`      ⚠️ ${e}`);
  }

  if (additionalItemPlans.length) {
    console.log("\n[B-1] INSERT 계획 — 기존 task에 task_item 추가 (task_no 이미 DB 존재)");
    console.log("=".repeat(80));
    for (const a of additionalItemPlans) {
      console.log(`  · ${a.target_task.task_no} (${a.target_task.customer_name}) | ord=${a.ord} | service=${a.sheet["서비스종류"]}/${a.sheet["서비스구분"]} | order_type=${a.mapping.order_type || "(매핑실패)"} | unit=${toInt(a.sheet["정산예정금액"])} cust=${toInt(a.sheet["최종상품금액"])}`);
      if (a.mapping.error) console.log(`      ⚠️ ${a.mapping.error}`);
    }
  }

  console.log("\n[B-2] INSERT 계획 — task_item 단건 (사장님 확정 standalone)");
  console.log("=".repeat(80));
  for (const s of standalonePlans) {
    if (s.error) { console.log(`  · ord=${s.poid} | ❌ ${s.error}`); continue; }
    console.log(`  · ord=${s.poid} → ${s.target_task_no} (${s.target_task.customer_name}) | order_type=${s.order_type} | unit=${s.unit_price} net=${s.net_amount} cust=${s.customer_paid_amount}`);
    console.log(`      mapping: work_type_id=${s.mapping.work_type_id || "(NULL)"} appliance=${s.mapping.appliance_type_id || "(NULL)"}`);
    if (s.mapping.error) console.log(`      ⚠️ ${s.mapping.error}`);
    console.log(`      memo: ${s.note}`);
  }

  if (insertWarnings.length) {
    console.log("\n[B-경고] 매핑 실패");
    console.log("=".repeat(80));
    for (const w of insertWarnings) console.log(`  ⚠️ task_no=${w.taskNo} ord=${w.ord} — ${w.reason}`);
  }

  console.log("\n[C] 취소 계획 — 사장님 확정 6개");
  console.log("=".repeat(80));
  for (const p of cancelPlans) {
    if (!p.item) {
      console.log(`  · ord=${p.ord} | (DB 측 측 X)`);
      continue;
    }
    console.log(`  · ord=${p.ord} | ${p.task?.task_no} | ${p.task?.customer_name} | task.status=${p.task?.status} → task_item DELETE`);
  }

  // 박은주 task — 활성 item 검증
  const parkTaskId = cancelPlans.find(p => p.task?.customer_name === "박은주")?.task?.id;
  if (parkTaskId) {
    const parkItems = items.filter(it => it.task_id === parkTaskId);
    const parkCancelOrds = cancelPlans.filter(p => p.task?.id === parkTaskId).map(p => p.ord);
    const remaining = parkItems.filter(it => !parkCancelOrds.includes(it.product_order_id));
    console.log(`\n  [박은주 분석] task의 task_items ${parkItems.length}건 / 취소 후 잔존 ${remaining.length}건 → task 상태 ${remaining.length > 0 ? "유지(확정)" : "취소"}`);
  }

  // 다른 5건 — 각 task의 활성 item 검증
  for (const p of cancelPlans) {
    if (!p.task || p.task.customer_name === "박은주") continue;
    const taskItems = items.filter(it => it.task_id === p.task.id);
    const cancelInThisTask = cancelPlans.filter(x => x.task?.id === p.task.id).map(x => x.ord);
    const remaining = taskItems.filter(it => !cancelInThisTask.includes(it.product_order_id));
    console.log(`  [${p.task.customer_name}] ${p.task.task_no}: items ${taskItems.length} → 잔존 ${remaining.length} → task ${remaining.length > 0 ? "유지" : "취소"}`);
  }

  console.log("\n[C-3] task status='취소' UPDATE 예정 (task_item 잔존 0)");
  console.log("=".repeat(80));
  if (!taskCancelPlans.length) console.log(`  (없음)`);
  else {
    for (const tp of taskCancelPlans) {
      console.log(`  · ${tp.task.task_no} (${tp.task.customer_name}) | status=${tp.task.status} → 취소  | items ${tp.total} → 잔존 0 (삭제 ${tp.deleted_count})`);
    }
  }

  console.log("\n[C-2] 삭제 계획 — task 통째 삭제");
  console.log("=".repeat(80));
  for (const p of deletePlans) {
    if (!p.task) { console.log(`  · ${p.task_no} | (DB 없음)`); continue; }
    console.log(`  · [삭제] ${p.task.task_no} | ${p.task.customer_name} | task.status=${p.task.status} | task_items ${p.items.length}건 → task_items DELETE 후 task DELETE`);
    for (const it of p.items) {
      console.log(`      · item poid=${it.product_order_id} | order_type=${it.order_type} | unit=${it.unit_price} | net=${it.net_amount}`);
    }
  }

  console.log("\n[D] 경고 / 이상 케이스");
  console.log("=".repeat(80));
  if (taskWarnings.length) {
    for (const w of taskWarnings) console.log(`  · ${w.task_no}: ${w.reason}`);
  } else {
    console.log(`  (없음)`);
  }

  // 이상 전이 재검증 — 0건이어야 정상
  console.log("\n[D-2] status 이상 전이 재검증");
  console.log("=".repeat(80));
  const ABNORMAL = new Set(["취소→완료", "확정→미배정", "미배정→완료", "완료→배정", "배정→미배정"]);
  const abList = [];
  for (const { task, updates } of updateTaskPlans.values()) {
    if (!updates.status) continue;
    const tr = `${task.status}→${updates.status}`;
    if (ABNORMAL.has(tr)) abList.push({ task_no: task.task_no, customer: task.customer_name, trans: tr });
  }
  if (!abList.length) console.log(`  ✅ 이상 전이 0건 (예외 처리 + 매칭 버그 수정 효과 확인)`);
  else {
    console.log(`  ⚠️ 이상 전이 ${abList.length}건 남음:`);
    for (const a of abList) console.log(`    · ${a.task_no} | ${a.customer} | ${a.trans}`);
  }

  // 변경 안 됨 통계
  console.log("\n[E] 요약");
  console.log("=".repeat(80));
  console.log(`  · 시트 매칭 1278 중 task_item 실제 변경 : ${updateItemPlans.length}`);
  console.log(`  · task UPDATE                          : ${updateTaskPlans.size}`);
  console.log(`  · INSERT 후보 (task 신규)              : ${insertPlans.length}`);
  console.log(`  · INSERT 후보 (task_item 단건)         : ${standalonePlans.filter(s => !s.error).length}`);
  console.log(`  · 취소 후보 (task_item DELETE)         : ${cancelPlans.filter(p => p.item).length}`);
  const delTasks = deletePlans.filter(p => p.task).length;
  const delItems = deletePlans.reduce((a, p) => a + (p.items?.length || 0), 0);
  console.log(`  · 삭제 (task 통째)                     : ${delTasks} task + ${delItems} item`);
  console.log(`  · 시트값 무시 예외 (status·기사·일정만): ${SKIP_TASK_UPDATE_NOS.size} task`);
  console.log(`  · 손대지 않음 (이미 취소 + YS-N 미매칭) : 25 + 7 = 32`);

  // ============================================================
  // 실제 실행 (--step=... 전용)
  // ============================================================
  if (!COMMIT) {
    console.log(`\n${"=".repeat(80)}\n🔍 DRY-RUN 완료 — 실제 쓰기 0건.`);
    console.log(`실행: node scripts/migrate-usoln-sheet-import.cjs --step=update|insert|cancel|delete`);
    return;
  }

  // 백업 헬퍼
  function writeBackup(stepName, payload) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const file = path.join(__dirname, `backup-usoln-step-${stepName}-${ts}.json`);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
    return file;
  }

  console.log(`\n${"=".repeat(80)}\n✅ COMMIT step=${STEP} — 실제 실행 시작\n`);

  // ─────────────────────────────────────────────────────────────
  // 1단계 — UPDATE (tasks 55 + task_items 1276)
  // ─────────────────────────────────────────────────────────────
  if (STEP === "update") {
    const expectedTasks = updateTaskPlans.size;
    const expectedItems = updateItemPlans.length;

    // 백업 — 영향받는 task / task_item 전체 컬럼
    const taskIdSet = new Set([...updateTaskPlans.values()].map(p => p.task.id));
    const itemIdSet = new Set(updateItemPlans.map(p => p.item.id));

    const backupTasks = [];
    for (const id of taskIdSet) {
      const { data } = await sb.from("tasks").select("*").eq("id", id).single();
      if (data) backupTasks.push(data);
    }
    const backupItems = [];
    for (const id of itemIdSet) {
      const { data } = await sb.from("task_items").select("*").eq("id", id).single();
      if (data) backupItems.push(data);
    }
    const backupFile = writeBackup("update", {
      step: "update",
      ts: new Date().toISOString(),
      expected: { tasks: expectedTasks, task_items: expectedItems },
      tasks: backupTasks,
      task_items: backupItems,
    });
    console.log(`  📦 백업: ${backupFile}`);
    console.log(`     · tasks ${backupTasks.length} / task_items ${backupItems.length}\n`);

    // tasks UPDATE
    let ok_task = 0, fail_task = 0;
    for (const { task, updates } of updateTaskPlans.values()) {
      const { error } = await sb.from("tasks").update(updates).eq("id", task.id);
      if (error) { fail_task++; console.error(`  ❌ task ${task.task_no}: ${error.message}`); }
      else ok_task++;
    }
    console.log(`  · tasks UPDATE       : ${ok_task} ok / ${fail_task} fail  (예상: ${expectedTasks})`);

    // task_items UPDATE
    let ok_item = 0, fail_item = 0;
    for (const { item, updates } of updateItemPlans) {
      const { error } = await sb.from("task_items").update(updates).eq("id", item.id);
      if (error) { fail_item++; console.error(`  ❌ item ${item.id}: ${error.message}`); }
      else ok_item++;
    }
    console.log(`  · task_items UPDATE  : ${ok_item} ok / ${fail_item} fail  (예상: ${expectedItems})`);

    // 검증
    const matchTask = ok_task === expectedTasks && fail_task === 0;
    const matchItem = ok_item === expectedItems && fail_item === 0;
    console.log("");
    if (matchTask && matchItem) {
      console.log(`  ✅ 1단계 완료 — 실제 = 예상 일치, 실패 0`);
    } else {
      console.log(`  ⚠️ 1단계 불일치:`);
      if (!matchTask) console.log(`     tasks: ok ${ok_task} / fail ${fail_task} / 예상 ${expectedTasks}`);
      if (!matchItem) console.log(`     task_items: ok ${ok_item} / fail ${fail_item} / 예상 ${expectedItems}`);
      console.log(`     → 사장님 확인 후 다음 단계 진행. 백업: ${backupFile}`);
    }
  }
  // ─────────────────────────────────────────────────────────────
  // 1-B단계 — 날짜만 갱신 (scheduled_at / completed_at)
  // ─────────────────────────────────────────────────────────────
  else if (STEP === "update-dates") {
    const expected = dateUpdatePlans.length;
    const expectedItems = dateItemPlans.length;

    // 백업 — tasks (scheduled_at/completed_at 영향) + task_items (naver_settled_at 영향)
    const taskIdSet = new Set(dateUpdatePlans.map(p => p.task.id));
    const backupTasks = [];
    for (const id of taskIdSet) {
      const { data } = await sb.from("tasks").select("*").eq("id", id).single();
      if (data) backupTasks.push(data);
    }
    const itemIdSet = new Set(dateItemPlans.map(p => p.item.id));
    const backupItems = [];
    for (const id of itemIdSet) {
      const { data } = await sb.from("task_items").select("*").eq("id", id).single();
      if (data) backupItems.push(data);
    }
    const backupFile = writeBackup("update-dates", {
      step: "update-dates",
      ts: new Date().toISOString(),
      expected: {
        tasks: expected, scheduled_at: dateSchedCnt, completed_at: dateCompCnt,
        task_items: expectedItems, naver_settled_at: expectedItems,
      },
      tasks: backupTasks,
      task_items: backupItems,
    });
    console.log(`  📦 백업: ${backupFile}`);
    console.log(`     · tasks ${backupTasks.length} (sched+comp) / task_items ${backupItems.length} (naver_settled_at)\n`);

    // tasks UPDATE
    let ok = 0, fail = 0;
    let okSched = 0, okComp = 0;
    for (const { task, updates } of dateUpdatePlans) {
      const safeUpdates = {};
      if (updates.scheduled_at !== undefined) safeUpdates.scheduled_at = updates.scheduled_at;
      if (updates.completed_at !== undefined) safeUpdates.completed_at = updates.completed_at;
      if (!Object.keys(safeUpdates).length) continue;

      const { error } = await sb.from("tasks").update(safeUpdates).eq("id", task.id);
      if (error) { fail++; console.error(`  ❌ task ${task.task_no}: ${error.message}`); }
      else {
        ok++;
        if (safeUpdates.scheduled_at) okSched++;
        if (safeUpdates.completed_at) okComp++;
      }
    }
    console.log(`  · tasks UPDATE       : ${ok} ok / ${fail} fail  (예상 task: ${expected})`);
    console.log(`     · scheduled_at 갱신: ${okSched} (예상: ${dateSchedCnt})`);
    console.log(`     · completed_at 갱신: ${okComp} (예상: ${dateCompCnt})`);

    // task_items UPDATE — naver_settled_at 단일 필드만
    let okI = 0, failI = 0;
    for (const { item, updates } of dateItemPlans) {
      const safeUpdates = {};
      if (updates.naver_settled_at !== undefined) safeUpdates.naver_settled_at = updates.naver_settled_at;
      if (!Object.keys(safeUpdates).length) continue;
      const { error } = await sb.from("task_items").update(safeUpdates).eq("id", item.id);
      if (error) { failI++; console.error(`  ❌ item ${item.id}: ${error.message}`); }
      else okI++;
    }
    console.log(`  · task_items UPDATE  : ${okI} ok / ${failI} fail  (예상: ${expectedItems})`);
    console.log(`     · naver_settled_at 갱신: ${okI}`);

    const match = ok === expected && fail === 0 && okSched === dateSchedCnt && okComp === dateCompCnt
                && okI === expectedItems && failI === 0;
    console.log("");
    if (match) console.log(`  ✅ 1-B단계 완료 — 실제 = 예상 일치, 실패 0`);
    else {
      console.log(`  ⚠️ 1-B단계 불일치:`);
      console.log(`     tasks: ${ok}/${expected} | sched: ${okSched}/${dateSchedCnt} | comp: ${okComp}/${dateCompCnt}`);
      console.log(`     items: ${okI}/${expectedItems} (naver_settled_at)`);
      console.log(`     → 사장님 확인 후 다음 단계 진행. 백업: ${backupFile}`);
    }
  }
  // ─────────────────────────────────────────────────────────────
  // 2단계 — INSERT (tasks 9 + task_item 단건 1)
  // ─────────────────────────────────────────────────────────────
  else if (STEP === "insert") {
    // 멱등성 사전 점검 — task_no가 이미 DB에 있으면 skip (재실행 안전)
    // (이미 plan 단계에서 분기됐지만 commit 시점에 다시 한 번)
    const insertedTaskIds = [];
    const insertedItemIds = [];
    let okTask = 0, failTask = 0, okItem = 0, failItem = 0, skipItem = 0;

    const buildTaskRow = (taskNo, firstSheet, group) => {
      const sched = combineSchedule(firstSheet["고객컨택일자"], firstSheet["기사약속시간"]);
      const compRaw = norm(firstSheet["작업완료일"]);
      const compISO = compRaw ? (compRaw.length <= 10 ? kstDateOnlyToUTC(compRaw) : kstNaiveISOToUTC(compRaw)) : null;
      const engName = norm(firstSheet["배정기사"]);
      const assignedEng = engName ? userByName.get(engName) : null;
      const productPrice = group.reduce((s, g) => s + (toInt(g.sheet["최종상품금액"]) || 0), 0);
      return {
        tenant_id: TENANT_ID,
        category_id: CATEGORY_ID,
        principal_id: USOL_N_PRINCIPAL_ID,
        task_no: taskNo,
        customer_name: norm(firstSheet["수취인명"]) || norm(firstSheet["구매자명"]) || "—",
        phone: norm(firstSheet["수취인연락처1"]) || norm(firstSheet["구매자연락처"]) || "",
        address: norm(firstSheet["주소"]),
        district: norm(firstSheet["지역키워드"]),
        channel: norm(firstSheet["채널"]) || "네이버",
        request_note: norm(firstSheet["배송메세지"]) || `네이버 주문 ${norm(firstSheet["주문번호"])}`,
        status: STATUS_MAP[norm(firstSheet["상태"])] || "미배정",
        assigned_engineer_id: assignedEng || null,
        scheduled_at: sched,
        completed_at: compISO,
        product_price: productPrice,
        extra_fee: 0,
        travel_fee: 0,
        external_order_no: norm(firstSheet["주문번호"]) || null,
        category_data: {},
      };
    };

    const buildItemRow = (taskId, ord, sheet, mapping) => {
      const naverSettledRaw = norm(sheet["네이버정산완료일"]);
      const naverSettled = naverSettledRaw
        ? (naverSettledRaw.length <= 10 ? kstDateOnlyToUTC(naverSettledRaw) : kstNaiveISOToUTC(naverSettledRaw))
        : null;
      const metadata = {};
      const dogup = toInt(sheet["도급사정산액"]);
      const compShare = toInt(sheet["회사배분액"]);
      if (dogup != null) metadata.dogup_settle = dogup;
      if (compShare != null) metadata.company_share = compShare;
      return {
        task_id: taskId,
        work_type_id: mapping?.work_type_id || null,
        appliance_type_id: mapping?.appliance_type_id || null,
        qty: toInt(sheet["수량"]) || 1,
        unit_price: toInt(sheet["정산예정금액"]) || 0,
        description: norm(sheet["배송메세지"]) || null,
        naver_settled_at: naverSettled,
        net_amount: toInt(sheet["네이버정산금액"]),
        customer_paid_amount: toInt(sheet["최종상품금액"]),
        product_order_id: ord,
        order_type: mapping?.order_type || null,
        // Migration 033 — task_items.metadata NOT NULL DEFAULT '{}' — null 명시 INSERT 금지
        metadata: Object.keys(metadata).length ? metadata : {},
      };
    };

    // 멱등성 — 같은 product_order_id가 활성 task(취소 아님)에 이미 존재하는지
    // 옛 취소 task의 item만 있으면 false 반환 (= 신규 INSERT 진행 가능)
    async function poidExistsOnActive(poid) {
      const { data: its } = await sb.from("task_items").select("id, task_id").eq("product_order_id", poid);
      if (!its || !its.length) return false;
      const taskIds = [...new Set(its.map(i => i.task_id))];
      const { data: ts } = await sb.from("tasks").select("id, status").in("id", taskIds);
      return (ts || []).some(t => t.status !== "취소");
    }

    // 신규 task 9건
    for (const plan of insertNewTaskPlans) {
      // 멱등성 — 같은 task_no가 이미 있으면 skip
      const { data: existing } = await sb
        .from("tasks")
        .select("id")
        .eq("tenant_id", TENANT_ID)
        .eq("task_no", plan.task_no)
        .maybeSingle();
      if (existing) {
        console.log(`  ⏭️  ${plan.task_no} — task 이미 존재, skip`);
        continue;
      }

      const taskRow = buildTaskRow(plan.task_no, plan.first_sheet, plan.group);
      const { data: ins, error: tErr } = await sb.from("tasks").insert(taskRow).select("id, task_no").single();
      if (tErr || !ins) { failTask++; console.error(`  ❌ task ${plan.task_no}: ${tErr?.message}`); continue; }
      okTask++; insertedTaskIds.push({ task_no: ins.task_no, id: ins.id });

      for (const ip of plan.item_plans) {
        // poid 멱등성 — 활성 task에 이미 있으면 skip (옛 취소 task의 item은 무시)
        if (await poidExistsOnActive(ip.ord)) { skipItem++; console.log(`    ⏭️  item poid=${ip.ord} 활성 task에 이미 존재, skip`); continue; }

        const itemRow = buildItemRow(ins.id, ip.ord, ip.sheet, ip.mapping);
        const { data: iIns, error: iErr } = await sb.from("task_items").insert(itemRow).select("id").single();
        if (iErr || !iIns) { failItem++; console.error(`    ❌ item ${ip.ord}: ${iErr?.message}`); continue; }
        okItem++; insertedItemIds.push({ item_id: iIns.id, task_no: ins.task_no, ord: ip.ord });
      }
    }

    // additional items (task_no 이미 존재한 경우 — 현재 plan에선 0건 예상)
    for (const a of additionalItemPlans) {
      if (await poidExistsOnActive(a.ord)) { skipItem++; console.log(`  ⏭️  additional item poid=${a.ord} 활성 task에 이미 존재, skip`); continue; }
      const itemRow = buildItemRow(a.target_task.id, a.ord, a.sheet, a.mapping);
      const { data: iIns, error: iErr } = await sb.from("task_items").insert(itemRow).select("id").single();
      if (iErr || !iIns) { failItem++; console.error(`  ❌ additional item ${a.ord}: ${iErr?.message}`); continue; }
      okItem++; insertedItemIds.push({ item_id: iIns.id, task_no: a.target_task.task_no, ord: a.ord, kind: "additional" });
    }

    // 차진영 standalone item
    for (const s of standalonePlans) {
      if (s.error) { console.log(`  ⏭️  standalone ${s.poid} skip — ${s.error}`); continue; }
      if (await poidExistsOnActive(s.poid)) { skipItem++; console.log(`  ⏭️  standalone item poid=${s.poid} 활성 task에 이미 존재, skip`); continue; }
      const itemRow = buildItemRow(s.target_task.id, s.poid, s.sheet_row, s.mapping);
      const { data: iIns, error: iErr } = await sb.from("task_items").insert(itemRow).select("id").single();
      if (iErr || !iIns) { failItem++; console.error(`  ❌ standalone item ${s.poid}: ${iErr?.message}`); continue; }
      okItem++; insertedItemIds.push({ item_id: iIns.id, task_no: s.target_task.task_no, ord: s.poid, kind: "standalone" });
    }

    const totalNewItems = insertNewTaskPlans.reduce((s, p) => s + p.item_plans.length, 0);
    const expectedTask = insertNewTaskPlans.length;
    const expectedItem = totalNewItems + additionalItemPlans.length + standalonePlans.filter(s => !s.error).length;

    // 백업 — INSERT한 id 목록 (롤백 시 삭제용)
    const backupFile = writeBackup("insert", {
      step: "insert",
      ts: new Date().toISOString(),
      expected: { tasks: expectedTask, task_items: expectedItem },
      inserted_tasks: insertedTaskIds,
      inserted_items: insertedItemIds,
    });
    console.log(`\n  📦 백업(INSERT id list): ${backupFile}`);

    console.log(`\n  · tasks INSERT       : ${okTask} ok / ${failTask} fail  (예상: ${expectedTask})`);
    console.log(`  · task_items INSERT  : ${okItem} ok / ${failItem} fail / ${skipItem} skip  (예상: ${expectedItem})`);

    const match = okTask === expectedTask && failTask === 0 && okItem === expectedItem && failItem === 0;
    console.log("");
    if (match) console.log(`  ✅ 2단계(INSERT) 완료 — 실제 = 예상 일치, 실패 0`);
    else {
      console.log(`  ⚠️ 2단계 불일치:`);
      console.log(`     tasks: ${okTask}/${expectedTask} (fail ${failTask})`);
      console.log(`     items: ${okItem}/${expectedItem} (fail ${failItem}, skip ${skipItem})`);
      console.log(`     → 사장님 확인. 롤백 목록: ${backupFile}`);
    }
  }
  // ─────────────────────────────────────────────────────────────
  // 3단계 — 취소 (task_items DELETE 6 + task status='취소' UPDATE 2)
  // ─────────────────────────────────────────────────────────────
  else if (STEP === "cancel") {
    const itemsToDelete = cancelPlans.filter(p => p.item).map(p => p.item);
    const expectedDel = itemsToDelete.length;
    const expectedUp = taskCancelPlans.length;

    // 백업 — DELETE 대상 task_items 전체 + status UPDATE 대상 tasks 전체
    const backupItems = [];
    for (const it of itemsToDelete) {
      const { data } = await sb.from("task_items").select("*").eq("id", it.id).maybeSingle();
      if (data) backupItems.push(data);
    }
    const backupTasks = [];
    for (const tp of taskCancelPlans) {
      const { data } = await sb.from("tasks").select("*").eq("id", tp.task.id).maybeSingle();
      if (data) backupTasks.push(data);
    }
    const backupFile = writeBackup("cancel", {
      step: "cancel",
      ts: new Date().toISOString(),
      expected: { task_items_delete: expectedDel, task_status_update: expectedUp },
      deleted_task_items: backupItems,
      cancelled_tasks_before: backupTasks,
    });
    console.log(`  📦 백업: ${backupFile}`);
    console.log(`     · task_items ${backupItems.length} (DELETE 대상 전체 컬럼) / tasks ${backupTasks.length} (status 변경 전 전체 컬럼)\n`);

    // task_items DELETE — 멱등성: 이미 없으면 skip
    let okDel = 0, failDel = 0, skipDel = 0;
    for (const it of itemsToDelete) {
      const { data: ex } = await sb.from("task_items").select("id").eq("id", it.id).maybeSingle();
      if (!ex) { skipDel++; console.log(`  ⏭️  task_item ${it.id} 이미 없음, skip`); continue; }
      const { error } = await sb.from("task_items").delete().eq("id", it.id);
      if (error) { failDel++; console.error(`  ❌ task_item ${it.id}: ${error.message}`); }
      else okDel++;
    }
    console.log(`  · task_items DELETE  : ${okDel} ok / ${failDel} fail / ${skipDel} skip  (예상: ${expectedDel})`);

    // task status='취소' UPDATE (한아영·최도연 등)
    let okUp = 0, failUp = 0;
    for (const tp of taskCancelPlans) {
      const { error } = await sb.from("tasks").update({ status: "취소" }).eq("id", tp.task.id);
      if (error) { failUp++; console.error(`  ❌ task ${tp.task.task_no}: ${error.message}`); }
      else { okUp++; console.log(`  ✓ ${tp.task.task_no} (${tp.task.customer_name}) status → 취소`); }
    }
    console.log(`  · tasks status='취소': ${okUp} ok / ${failUp} fail  (예상: ${expectedUp})`);

    const match = okDel === expectedDel && failDel === 0
                && okUp === expectedUp && failUp === 0;
    console.log("");
    if (match) console.log(`  ✅ 3단계(CANCEL) 완료 — 실제 = 예상 일치, 실패 0`);
    else {
      console.log(`  ⚠️ 3단계 불일치:`);
      console.log(`     items DELETE: ${okDel}/${expectedDel} (fail ${failDel}, skip ${skipDel})`);
      console.log(`     tasks status: ${okUp}/${expectedUp} (fail ${failUp})`);
      console.log(`     → 사장님 확인. 백업: ${backupFile}`);
    }
  }
  // ─────────────────────────────────────────────────────────────
  // 4단계 — 삭제 (성남 task_items DELETE + task DELETE)
  // ─────────────────────────────────────────────────────────────
  else if (STEP === "delete") {
    const targets = deletePlans.filter(p => p.task);
    const expectedTasks = targets.length;
    const expectedItems = targets.reduce((s, p) => s + (p.items?.length || 0), 0);

    // 백업 — 영구 삭제 대비. task + task_items 전체 컬럼.
    const backup = { step: "delete", ts: new Date().toISOString(), expected: { tasks: expectedTasks, task_items: expectedItems }, deleted: [] };
    for (const p of targets) {
      const { data: t } = await sb.from("tasks").select("*").eq("id", p.task.id).maybeSingle();
      const { data: its } = await sb.from("task_items").select("*").eq("task_id", p.task.id);
      backup.deleted.push({ task: t, items: its || [] });
    }
    const backupFile = writeBackup("delete", backup);
    console.log(`  📦 백업: ${backupFile}`);
    console.log(`     · tasks ${backup.deleted.length} + task_items ${backup.deleted.reduce((s, d) => s + d.items.length, 0)}\n`);

    let okItem = 0, failItem = 0, skipItem = 0;
    let okTask = 0, failTask = 0, skipTask = 0;

    for (const p of targets) {
      // 멱등성 — task가 이미 없으면 skip
      const { data: tEx } = await sb.from("tasks").select("id").eq("id", p.task.id).maybeSingle();
      if (!tEx) { skipTask++; console.log(`  ⏭️  task ${p.task.task_no} 이미 없음, skip`); continue; }

      // task_items 먼저 DELETE (FK 순서)
      for (const it of p.items) {
        const { data: iEx } = await sb.from("task_items").select("id").eq("id", it.id).maybeSingle();
        if (!iEx) { skipItem++; console.log(`    ⏭️  item ${it.id} 이미 없음, skip`); continue; }
        const { error } = await sb.from("task_items").delete().eq("id", it.id);
        if (error) { failItem++; console.error(`    ❌ item ${it.id}: ${error.message}`); }
        else okItem++;
      }

      // task DELETE
      const { error } = await sb.from("tasks").delete().eq("id", p.task.id);
      if (error) { failTask++; console.error(`  ❌ task ${p.task.task_no}: ${error.message}`); }
      else { okTask++; console.log(`  ✓ task ${p.task.task_no} (${p.task.customer_name}) DELETE`); }
    }

    console.log(`\n  · task_items DELETE  : ${okItem} ok / ${failItem} fail / ${skipItem} skip  (예상: ${expectedItems})`);
    console.log(`  · tasks DELETE       : ${okTask} ok / ${failTask} fail / ${skipTask} skip  (예상: ${expectedTasks})`);

    const match = okItem === expectedItems && failItem === 0 && okTask === expectedTasks && failTask === 0;
    console.log("");
    if (match) console.log(`  ✅ 4단계(DELETE) 완료 — 실제 = 예상 일치, 실패 0`);
    else {
      console.log(`  ⚠️ 4단계 불일치:`);
      console.log(`     items: ${okItem}/${expectedItems} (fail ${failItem}, skip ${skipItem})`);
      console.log(`     tasks: ${okTask}/${expectedTasks} (fail ${failTask}, skip ${skipTask})`);
      console.log(`     → 사장님 확인. 백업: ${backupFile}`);
    }
  }

  console.log(`\n${"=".repeat(80)}\nCOMMIT step=${STEP} 종료.`);
})().catch(e => console.error("FATAL:", e.message, e.stack));

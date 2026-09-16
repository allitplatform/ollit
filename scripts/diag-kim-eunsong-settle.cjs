// 진단 — 김은송 YS-260518-120 (visit_only) 정산 단계 / 출장비 위치 / 현장 현금 시그널
// 2026-05-25
//
// 사장님 질문:
//   1) payment 레코드 전체 — track, method, settled/received 타임스탬프
//   2) ₩30,000 출장비 위치 — task.travel_fee? payment? task_items?
//   3) PrincipalApp 정산 단계 바 입력값 (task_items 의 naver_settled_at)
//   4) cash 관련 플래그/컬럼 (이미 있는지)
//   5) 네이버 취소된 visit_only 분류

const fs = require("fs"), path = require("path");
function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TASK_NO = "YS-260518-120";

function bar(c = "═", n = 100) { return c.repeat(n); }
function head(s) { console.log("\n" + bar()); console.log(s); console.log(bar()); }
function sub(s)  { console.log("\n" + bar("─")); console.log(s); console.log(bar("─")); }

(async () => {
  head(`진단 — ${TASK_NO} 김은송 출장비 / 정산 단계 / 현금정산`);

  // 1) task 전 컬럼
  const { data: task, error } = await sb.from("tasks").select("*").eq("task_no", TASK_NO).maybeSingle();
  if (error || !task) { console.log(`task 조회 실패: ${error?.message || "없음"}`); return; }

  sub("【1】 tasks 행 — 정산 관련 컬럼 전부");
  const taskKeys = [
    "id", "task_no", "customer_name", "phone",
    "status", "principal_id", "external_order_no",
    "product_price", "extra_fee", "travel_fee", "total_amount",
    "scheduled_at", "completed_at", "created_at", "updated_at",
    "assigned_engineer_id", "is_legacy", "channel", "district",
    "category_data",
  ];
  for (const k of taskKeys) {
    let v = task[k];
    if (v && typeof v === "object") v = JSON.stringify(v);
    if (typeof v === "string" && v.length > 100) v = v.slice(0, 97) + "...";
    console.log(`  ${k.padEnd(22)} = ${v ?? "(NULL)"}`);
  }

  // 2) task_items
  sub("【2】 task_items — 김은송 task 측 모든 행 (정산 단계 입력값)");
  const { data: items } = await sb.from("task_items")
    .select(`id, task_id, order_type, qty, unit_price, subtotal, description, product_order_id,
             net_amount, customer_paid_amount, naver_settled_at, naver_received_at, company_received_at,
             work_types(code, name, service_types(code)),
             appliance_types(name)`)
    .eq("task_id", task.id);
  console.log(`  task_items 개수: ${(items || []).length}건`);
  (items || []).forEach((it, idx) => {
    console.log(`  ─ 항목 ${idx + 1} ──`);
    console.log(`    id                 = ${it.id}`);
    console.log(`    order_type         = ${it.order_type ?? "(NULL)"}`);
    console.log(`    qty / unit / sub   = ${it.qty} / ${it.unit_price} / ${it.subtotal}`);
    console.log(`    work_type          = ${it.work_types?.code || "—"} / ${it.work_types?.name || "—"}  (service=${it.work_types?.service_types?.code || "—"})`);
    console.log(`    appliance_type     = ${it.appliance_types?.name || "(NULL)"}`);
    console.log(`    description        = ${it.description ?? "(NULL)"}`);
    console.log(`    product_order_id   = ${it.product_order_id ?? "(NULL)"}`);
    console.log(`    customer_paid_amt  = ${it.customer_paid_amount ?? "(NULL)"}`);
    console.log(`    net_amount         = ${it.net_amount ?? "(NULL)"}  ← PrincipalApp 정산 단계 wait 판정 시그널`);
    console.log(`    naver_settled_at   = ${it.naver_settled_at ?? "(NULL)"}  ← stage='naver' 판정 시그널`);
    console.log(`    naver_received_at  = ${it.naver_received_at ?? "(NULL)"}`);
    console.log(`    company_received_at= ${it.company_received_at ?? "(NULL)"}`);
  });

  // 3) payments 전 컬럼
  sub("【3】 payments — 김은송 task 측 행");
  const { data: pays } = await sb.from("payments").select("*").eq("task_id", task.id);
  console.log(`  payments 개수: ${(pays || []).length}건`);
  (pays || []).forEach((pm, idx) => {
    console.log(`  ─ payment ${idx + 1} ──`);
    Object.entries(pm).forEach(([k, v]) => {
      let val = v;
      if (val && typeof val === "object") val = JSON.stringify(val);
      console.log(`    ${k.padEnd(22)} = ${val ?? "(NULL)"}`);
    });
  });

  // 4) 출장비 ₩30,000 — DB 어디에 있는지 결산
  sub("【4】 ₩30,000 출장비 — DB 상 저장 위치 결산");
  const travelFee = Number(task.travel_fee || 0);
  const sumItemSub = (items || []).reduce((s, it) => s + Number(it.subtotal || 0), 0);
  const sumItemUnit = (items || []).reduce((s, it) => s + (Number(it.unit_price || 0) * Number(it.qty || 0)), 0);
  const payEng = (pays || []).reduce((s, p) => s + Number(p.engineer_amount || 0), 0);
  const payTravel = (pays || []).reduce((s, p) => s + Number(p.travel_fee || 0), 0);
  console.log(`  · tasks.travel_fee                 = ₩${travelFee.toLocaleString()}`);
  console.log(`  · tasks.product_price              = ₩${Number(task.product_price || 0).toLocaleString()}`);
  console.log(`  · tasks.extra_fee                  = ₩${Number(task.extra_fee || 0).toLocaleString()}`);
  console.log(`  · tasks.total_amount               = ₩${Number(task.total_amount || 0).toLocaleString()}  (GENERATED = pp+ef+tf)`);
  console.log(`  · SUM(task_items.subtotal)         = ₩${sumItemSub.toLocaleString()}`);
  console.log(`  · SUM(task_items.unit_price × qty) = ₩${sumItemUnit.toLocaleString()}`);
  console.log(`  · SUM(payments.engineer_amount)    = ₩${payEng.toLocaleString()}`);
  console.log(`  · SUM(payments.travel_fee)         = ₩${payTravel.toLocaleString()}`);

  // 5) PrincipalApp 정산 단계 시뮬레이션
  sub("【5】 PrincipalApp 정산 단계 바 — 시뮬레이션");
  if (!items || items.length === 0) {
    console.log("  · items.length === 0 → SettleDetailBox 측 return null (단계 바 안 보여야 함)");
    console.log("  ★ 사장님이 보고 계신 '정산대기' 단계 바 — 별도 화면 또는 회귀 가능성. 확인 필요.");
  } else {
    items.forEach((it, idx) => {
      const noNaver = !it.naver_settled_at;
      const stage = noNaver ? "wait (정산대기)" : "naver/company (naver_settled_at 있음)";
      console.log(`  · 항목 ${idx + 1}: naver_settled_at=${it.naver_settled_at ?? "NULL"} → stage = ${stage}`);
    });
  }

  // 6) cash / 현장 현금 / 네이버 취소 시그널 — 컬럼 존재 여부 (information_schema 직접 조회 X — 행 보면 됨)
  sub("【6】 cash / 현금정산 / 네이버 취소 시그널 — 현재 행에 어떤 키가 있나");
  const taskCols = Object.keys(task);
  const payCols  = (pays && pays[0]) ? Object.keys(pays[0]) : [];
  const itemCols = (items && items[0]) ? Object.keys(items[0]) : [];
  function findKeys(cols, kw) {
    return cols.filter(c => kw.some(k => c.toLowerCase().includes(k.toLowerCase())));
  }
  console.log(`  · tasks 측 cash/cancel/naver 키:`, findKeys(taskCols, ["cash", "cancel", "naver", "현금"]));
  console.log(`  · payments 측 cash/cancel/naver 키:`, findKeys(payCols, ["cash", "cancel", "naver", "현금"]));
  console.log(`  · task_items 측 cash/cancel/naver 키:`, findKeys(itemCols, ["cash", "cancel", "naver", "현금"]));
  // category_data 측 visitOnly hint
  if (task.category_data) {
    const cd = typeof task.category_data === "string" ? JSON.parse(task.category_data) : task.category_data;
    console.log(`  · tasks.category_data 키:`, Object.keys(cd || {}));
    if (cd?.visitOnly) {
      console.log(`    └ visitOnly:`);
      Object.entries(cd.visitOnly).forEach(([k, v]) => console.log(`        ${k} = ${v}`));
    }
    if (cd?.cancelReason || cd?.cancel) {
      console.log(`    └ cancel:`, cd.cancelReason || cd.cancel);
    }
  }

  // 7) 다른 visit_only 측 비교 — 본 케이스만 이상한지 / 정상 visit_only는 task_items 측 visit_fee row 있는지
  sub("【7】 다른 visit_only task 측 비교 — task_items 측 visit_fee row 패턴");
  const { data: otherVisits } = await sb.from("tasks")
    .select("id, task_no, customer_name, travel_fee, total_amount, product_price, completed_at")
    .eq("status", "visit_only")
    .neq("id", task.id)
    .order("completed_at", { ascending: false })
    .limit(5);
  console.log(`  다른 visit_only task ${(otherVisits || []).length}건 (최근 5건):`);
  for (const ot of (otherVisits || [])) {
    const { data: oit } = await sb.from("task_items")
      .select("qty, unit_price, work_types(code, name)")
      .eq("task_id", ot.id);
    const { data: opay } = await sb.from("payments")
      .select("engineer_amount, calc_method, track, status")
      .eq("task_id", ot.id).maybeSingle();
    console.log(`  · ${ot.task_no} ${ot.customer_name}`);
    console.log(`      travel_fee=${ot.travel_fee} total=${ot.total_amount} pp=${ot.product_price} comp=${ot.completed_at}`);
    console.log(`      task_items=${(oit || []).length}건 → ${(oit || []).map(it => `${it.work_types?.code}(${it.work_types?.name}) x${it.qty}@${it.unit_price}`).join(", ") || "(없음)"}`);
    console.log(`      payment: ${opay ? `eng=${opay.engineer_amount} method=${opay.calc_method} track=${opay.track} status=${opay.status}` : "(없음)"}`);
  }

  // 8) information_schema — payments / tasks 측 컬럼 목록 (cash 관련 후보 발견용)
  sub("【8】 (참고) payments 측 컬럼 전체 — cash 관련 후보 찾기");
  if (pays && pays[0]) {
    console.log(`  payments 컬럼 (${payCols.length}개):`);
    console.log("  " + payCols.join(", "));
  } else {
    console.log("  payments 행 없음 — 컬럼 목록 조회 불가");
  }
  console.log(`\n  tasks 컬럼 (${taskCols.length}개):`);
  console.log("  " + taskCols.join(", "));

  // 9) 네이버 취소 visit_only — Migration 053 status enum 측 'visit_only'만. 별도 cancel-related status 없음.
  //    네이버 취소 후 출장비 처리는 status='visit_only'로만 표기되고, 취소 정보는 category_data 측 별도 키 가능.
  sub("【9】 네이버 취소된 visit_only 분류 패턴");
  console.log("  · status='visit_only' enum만 존재 (Migration 053). '네이버취소+출장비' 별도 status 없음.");
  console.log("  · cancel 사유 저장 위치: category_data.cancelReason / cancel 또는 visitOnly.reason");
  console.log("  · 본 task 측 cancel 흔적 (위 6항 참조).");

  console.log("\n" + bar());
  console.log("진단 완료.");
  console.log(bar());
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

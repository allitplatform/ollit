// 진단 — 김은송 아이콘 오류 (⚡로 표시, 출장비만 건)
// 2026-05-25
//
// PrincipalListTab.jsx의 아이콘 로직:
//   getMainItem(task):
//     1) workItems 중 orderType === "본작업" → main
//     2) appliance가 ["벽걸이","스탠드","1way","2way","4way","투인원","원형","시스템멀티"] 키워드 포함 → main
//   getServiceKind: main → "main", 없으면 → "addon"
//   ServiceIcon: addon → ⚡ (REFRIGERANT_COLOR), main → ❄️ (CLEAN_COLOR)
//
// → 출장비만 있는 task는 본작업/세척어플라이언스 모두 X → "addon" → ⚡ 잘못 표시.
//
// 본 스크립트는 김은송 task의 실제 task_items 를 조회해 입력값을 보여줌.

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
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// PrincipalListTab.jsx와 동일한 키워드
const MAIN_APPLIANCE_KEYWORDS = ["벽걸이", "스탠드", "1way", "2way", "4way", "투인원", "원형", "시스템멀티"];

function judge(items) {
  // 1) 본작업
  const byOrderType = items.find(it => (it.order_type) === "본작업");
  if (byOrderType) return { kind: "main", reason: "orderType==='본작업'", hit: byOrderType };
  // 2) appliance 키워드
  const byKeyword = items.find(it => {
    const a = String(it.appliance || "").trim();
    return MAIN_APPLIANCE_KEYWORDS.some(kw => a.includes(kw));
  });
  if (byKeyword) return { kind: "main", reason: "appliance 키워드", hit: byKeyword };
  return { kind: "addon", reason: "본작업 X + appliance 키워드 X", hit: null };
}

(async () => {
  console.log("═".repeat(100));
  console.log("진단 — 김은송 아이콘 오류 (⚡ 잘못 표시)");
  console.log("═".repeat(100));

  // 1) 김은송 task 조회 (전 원청)
  const { data: tasks, error } = await sb.from("tasks")
    .select("id, task_no, customer_name, phone, principal_id, status, scheduled_at, product_price, total_amount, external_order_no, created_at, principals(code)")
    .eq("customer_name", "김은송")
    .order("created_at", { ascending: false });
  if (error) throw new Error("tasks: " + error.message);
  if (!tasks || tasks.length === 0) {
    console.log("김은송 task 없음. 종료.");
    return;
  }
  console.log(`김은송 task ${tasks.length}건 발견`);

  // 2) task_items 일괄 조회
  const ids = tasks.map(t => t.id);
  const { data: items } = await sb.from("task_items")
    .select("id, task_id, order_type, appliance, qty, unit_price, subtotal, customer_paid_amount, product_order_id, work_types(name), appliance_types(name)")
    .in("task_id", ids);

  // appliance 컬럼이 task_items에 직접 존재하는지 + appliance_types(name) 둘 다 확인.
  // PrincipalListTab은 정규화 단계(rowToTask/v14NormalizeTask)를 거쳐 workItems[].appliance에 어떤 값이 들어가는지가 핵심.

  const byTask = new Map();
  for (const it of items || []) {
    if (!byTask.has(it.task_id)) byTask.set(it.task_id, []);
    byTask.get(it.task_id).push(it);
  }

  // 3) 각 task별 출력 + 아이콘 판정
  for (const t of tasks) {
    console.log("\n" + "─".repeat(100));
    console.log(`task_no            : ${t.task_no}`);
    console.log(`id                 : ${t.id}`);
    console.log(`principal          : ${t.principals?.code || "?"}`);
    console.log(`status             : ${t.status}`);
    console.log(`product_price      : ${t.product_price}  /  total_amount: ${t.total_amount}`);
    console.log(`scheduled_at       : ${t.scheduled_at || "(NULL)"}`);
    console.log(`external_order_no  : ${t.external_order_no || "(NULL)"}`);
    console.log(`phone              : ${t.phone || "(NULL)"}`);

    const its = byTask.get(t.id) || [];
    console.log(`task_items: ${its.length}건`);
    its.forEach(it => {
      console.log(`  · order_type=${it.order_type || "(NULL)"} | wt=${it.work_types?.name || "—"} | appliance(col)=${it.appliance || "—"} | app_type(name)=${it.appliance_types?.name || "—"} | qty=${it.qty} unit=${it.unit_price} sub=${it.subtotal} | paid=${it.customer_paid_amount} | poid=${it.product_order_id || "—"}`);
    });

    // 4) PrincipalListTab 로직 시뮬레이션 (DB 컬럼명 그대로 입력)
    // 주의: PrincipalListTab은 정규화된 workItems를 받으므로 키 매핑이 다를 수 있음. 두 가지 변형 시뮬레이션:
    //   A) workItems = items 그대로 (appliance = appliance 컬럼)
    //   B) workItems = items 변형 (appliance = appliance_types.name)
    const variantA = its.map(it => ({ order_type: it.order_type, appliance: it.appliance || "" }));
    const variantB = its.map(it => ({ order_type: it.order_type, appliance: it.appliance_types?.name || "" }));
    const judgeA = judge(variantA);
    const judgeB = judge(variantB);
    console.log(`  [A] appliance=task_items.appliance(col) → ${judgeA.kind === "main" ? "❄️ main" : "⚡ addon"} (${judgeA.reason})`);
    console.log(`  [B] appliance=appliance_types.name         → ${judgeB.kind === "main" ? "❄️ main" : "⚡ addon"} (${judgeB.reason})`);
  }

  // 5) 출장비/visit_fee 케이스 일반 패턴 확인 — order_type / work_type 분포
  console.log("\n" + "═".repeat(100));
  console.log("【참고】 김은송 task의 task_items order_type / work_type 분포");
  console.log("═".repeat(100));
  const orderTypes = new Map();
  const workTypes  = new Map();
  for (const it of items || []) {
    const ot = it.order_type || "(NULL)";
    const wt = it.work_types?.name || "—";
    orderTypes.set(ot, (orderTypes.get(ot) || 0) + 1);
    workTypes.set(wt, (workTypes.get(wt) || 0) + 1);
  }
  console.log("order_type 분포 :", [...orderTypes.entries()].map(([k,v]) => `${k}=${v}`).join(", "));
  console.log("work_type  분포 :", [...workTypes.entries()].map(([k,v]) => `${k}=${v}`).join(", "));

  // 6) 출장비 식별 가능 시그널 확인
  // - work_types.name === "출장비" / "VISIT_FEE" 등 가능성
  // - order_type === "출장비" 가능성
  // - status === "visit_only" 가능성
  console.log("\n【참고】 출장비 식별 가능 시그널");
  const visitOnly = tasks.filter(t => t.status === "visit_only");
  console.log(`  · status === "visit_only" 인 task: ${visitOnly.length}건 → ${visitOnly.map(t=>t.task_no).join(", ") || "(없음)"}`);
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

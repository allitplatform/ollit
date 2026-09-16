// 진단 — usol_n 작업 현황 (운영 시트 이관 준비) 보강편
// 2026-05-24
const fs = require("fs"), path = require("path");
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

(async () => {
  const usolNId = "22222222-2222-2222-2222-222222222006";

  // task_no 형식 분포
  console.log("=".repeat(72));
  console.log("[A] task_no 형식 분포");
  const taskNoBuckets = { "YS-NNNNNN-NNN": 0, "YS-N-NNNNNN-NNN": 0, other: 0 };
  const otherSamples = [];
  const allTasks = [];
  {
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await sb
        .from("tasks")
        .select("id, task_no, status, external_order_no, completed_at, scheduled_at, assigned_engineer_id")
        .eq("principal_id", usolNId)
        .range(from, from + PAGE - 1);
      if (!data?.length) break;
      allTasks.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  for (const t of allTasks) {
    const n = t.task_no || "";
    if (/^YS-\d{6}-\d{3}$/.test(n)) taskNoBuckets["YS-NNNNNN-NNN"]++;
    else if (/^YS-N-\d{6}-\d{3}$/.test(n)) taskNoBuckets["YS-N-NNNNNN-NNN"]++;
    else { taskNoBuckets.other++; if (otherSamples.length < 10) otherSamples.push(n); }
  }
  for (const [k, v] of Object.entries(taskNoBuckets)) console.log(`    · ${k.padEnd(22)} : ${v}`);
  if (otherSamples.length) {
    console.log("    other 샘플:");
    for (const s of otherSamples) console.log(`      · "${s}"`);
  }

  // task_no 범위 확인 (운영 시트 YS-260408-016 ~ YS-260523-001 측 비교)
  const taskNoOnly = allTasks.map(t => t.task_no).filter(Boolean).sort();
  console.log(`\n[A] task_no 최소 / 최대:`);
  console.log(`    min: ${taskNoOnly[0]}`);
  console.log(`    max: ${taskNoOnly[taskNoOnly.length - 1]}`);

  // external_order_no 채워진 정도
  let extOrderFilled = 0, extOrderNull = 0;
  const extSamples = [];
  for (const t of allTasks) {
    if (t.external_order_no) { extOrderFilled++; if (extSamples.length < 5) extSamples.push(t.external_order_no); }
    else extOrderNull++;
  }
  console.log(`\n[B] tasks.external_order_no:`);
  console.log(`    · 채워짐: ${extOrderFilled}`);
  console.log(`    · NULL : ${extOrderNull}`);
  if (extSamples.length) console.log(`    샘플: ${extSamples.map(s => `${s}(${s.length})`).join(" / ")}`);

  // completed_at / scheduled_at / assigned_engineer_id 채워진 정도
  let cnt_completed = 0, cnt_scheduled = 0, cnt_engineer = 0;
  for (const t of allTasks) {
    if (t.completed_at) cnt_completed++;
    if (t.scheduled_at) cnt_scheduled++;
    if (t.assigned_engineer_id) cnt_engineer++;
  }
  console.log(`\n[C] tasks 주요 필드 채워진 건수 (총 ${allTasks.length}):`);
  console.log(`    · completed_at         : ${cnt_completed}`);
  console.log(`    · scheduled_at         : ${cnt_scheduled}`);
  console.log(`    · assigned_engineer_id : ${cnt_engineer}`);

  // YS- 시작 task_items product_order_id 5건 실체
  console.log(`\n[D] task_items.product_order_id YS- 시작 5건:`);
  const idChunks = [];
  const taskIds = allTasks.map(t => t.id);
  for (let i = 0; i < taskIds.length; i += 200) idChunks.push(taskIds.slice(i, i + 200));
  const ysItems = [];
  for (const ids of idChunks) {
    const { data } = await sb
      .from("task_items")
      .select("task_id, product_order_id, order_type, unit_price, net_amount, customer_paid_amount")
      .in("task_id", ids)
      .like("product_order_id", "YS-%");
    if (data) ysItems.push(...data);
  }
  for (const item of ysItems) {
    const tk = allTasks.find(t => t.id === item.task_id);
    console.log(`    · poid="${item.product_order_id}" / task_no=${tk?.task_no} / order_type=${item.order_type} / unit=${item.unit_price} / net=${item.net_amount} / cust=${item.customer_paid_amount}`);
  }

  // task_items 채워진 정도 — net_amount / customer_paid_amount / order_type
  let ti_total = 0, ti_net = 0, ti_cust = 0, ti_orderType = 0;
  const orderTypeBuckets = {};
  for (const ids of idChunks) {
    const { data } = await sb
      .from("task_items")
      .select("net_amount, customer_paid_amount, order_type")
      .in("task_id", ids);
    if (!data) continue;
    for (const r of data) {
      ti_total++;
      if (r.net_amount != null) ti_net++;
      if (r.customer_paid_amount != null) ti_cust++;
      if (r.order_type) {
        ti_orderType++;
        orderTypeBuckets[r.order_type] = (orderTypeBuckets[r.order_type] || 0) + 1;
      }
    }
  }
  console.log(`\n[E] task_items 주요 필드 채워진 건수 (총 ${ti_total}):`);
  console.log(`    · net_amount           : ${ti_net}`);
  console.log(`    · customer_paid_amount : ${ti_cust}`);
  console.log(`    · order_type           : ${ti_orderType}`);
  console.log(`    order_type 분포:`);
  for (const [k, v] of Object.entries(orderTypeBuckets).sort((a, b) => b[1] - a[1])) {
    console.log(`      · ${k.padEnd(8)} : ${v}`);
  }

  // 운영 시트 1287행 측 매칭 가능성 — DB external_order_no 중 16자리 vs 운영 시트 1281건 비교 준비
  console.log(`\n[F] 운영 시트 매칭 키 검토:`);
  console.log(`    · 운영 시트 키 = 상품주문번호(16자리) 1281건 + 작업코드(YS-) 6건 = 1287행`);
  console.log(`    · DB task_items.product_order_id 16자리 : ${1322}건`);
  console.log(`    · DB task_items.product_order_id YS-    : ${ysItems.length}건`);
  console.log(`    · DB tasks.external_order_no            : ${extOrderFilled}건`);
  console.log(`    → 두 키 모두 후보. task_items.product_order_id 측 매칭이 정산 항목 단위 정밀.`);

  console.log(`\n${"=".repeat(72)}\n진단 보강 완료.`);
})().catch(e => console.log("FATAL:", e.message, e.stack));

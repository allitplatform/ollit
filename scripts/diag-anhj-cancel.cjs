// 진단 — 안효정 task 부분취소 데이터 정합성
// 2026-05-25
//
// 사장님 보고: 4way 세척 현장 불가 → 4way item subtotal=0,
//   근데 고객결제 ₩199,600 / 네이버정산 ₩188,498 그대로. '반쪽 반영'.
//
// 조사 항목:
//   1. task 전수 (status, total_amount, product_price, partial_reason/memo, category_data)
//   2. task_items 각 (qty, unit_price, subtotal, customer_paid_amount, net_amount, naver_settled_at)
//   3. payment 전체

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

function bar(c = "═", n = 100) { return c.repeat(n); }
function head(s) { console.log("\n" + bar()); console.log(s); console.log(bar()); }
function sub(s)  { console.log("\n" + bar("─")); console.log(s); console.log(bar("─")); }

(async () => {
  head(`진단 — 안효정 task 부분취소 정합성`);

  const { data: tasks } = await sb.from("tasks")
    .select("*")
    .eq("customer_name", "안효정")
    .order("created_at", { ascending: false });
  if (!tasks || tasks.length === 0) { console.log("안효정 task 없음"); return; }
  console.log(`  ${tasks.length}건 발견`);

  for (const t of tasks) {
    head(`task ${t.task_no} — id=${t.id}`);

    sub("[1] task 필드 (정산/취소 관련)");
    const keys = ["task_no","status","principal_id","external_order_no","product_price","extra_fee","travel_fee","total_amount","scheduled_at","completed_at","partial_reason","partial_memo","is_legacy","channel","district","created_at","updated_at"];
    for (const k of keys) {
      let v = t[k]; if (typeof v === "string" && v.length > 80) v = v.slice(0, 77) + "...";
      console.log(`  ${k.padEnd(22)} = ${v ?? "(NULL)"}`);
    }
    if (t.category_data) {
      console.log(`  category_data keys = ${Object.keys(t.category_data).join(", ")}`);
      const cd = t.category_data;
      if (cd.cancelReason || cd.cancelApproveReason || cd.cancelRejectReason) {
        console.log(`    · cancelReason         = ${cd.cancelReason || "—"}`);
        console.log(`    · cancelApproveReason  = ${cd.cancelApproveReason || "—"}`);
        console.log(`    · cancelRejectReason   = ${cd.cancelRejectReason || "—"}`);
        console.log(`    · previousStatus       = ${cd.previousStatus || "—"}`);
      }
      if (cd.partial) {
        console.log(`    · partial              = ${JSON.stringify(cd.partial)}`);
      }
    }

    sub("[2] task_items 전수");
    const { data: items } = await sb.from("task_items")
      .select(`id, order_type, qty, unit_price, subtotal, description,
               net_amount, customer_paid_amount, product_order_id,
               naver_settled_at, naver_received_at, company_received_at,
               work_types(code, name, service_types(code)),
               appliance_types(name)`)
      .eq("task_id", t.id);
    console.log(`  ${(items || []).length}건`);
    let sumSub = 0, sumUnit = 0, sumCust = 0, sumNet = 0;
    (items || []).forEach((it, i) => {
      const sub_ = Number(it.subtotal || 0);
      const unit = Number(it.unit_price || 0) * Number(it.qty || 0);
      const cust = Number(it.customer_paid_amount || 0);
      const net  = Number(it.net_amount || 0);
      sumSub += sub_; sumUnit += unit; sumCust += cust; sumNet += net;
      console.log(`  ─ item ${i+1} ──`);
      console.log(`    id                  = ${it.id}`);
      console.log(`    order_type          = ${it.order_type ?? "(NULL)"}`);
      console.log(`    work_type           = ${it.work_types?.code || "—"} / ${it.work_types?.name || "—"}  (service=${it.work_types?.service_types?.code || "—"})`);
      console.log(`    appliance_type      = ${it.appliance_types?.name || "(NULL)"}`);
      console.log(`    qty / unit / sub    = ${it.qty} / ${it.unit_price} / ${it.subtotal}`);
      console.log(`    description         = ${it.description ?? "(NULL)"}`);
      console.log(`    product_order_id    = ${it.product_order_id ?? "(NULL)"}`);
      console.log(`    customer_paid_amount= ${it.customer_paid_amount ?? "(NULL)"}`);
      console.log(`    net_amount          = ${it.net_amount ?? "(NULL)"}`);
      console.log(`    naver_settled_at    = ${it.naver_settled_at ?? "(NULL)"}`);
      console.log(`    naver_received_at   = ${it.naver_received_at ?? "(NULL)"}`);
      console.log(`    company_received_at = ${it.company_received_at ?? "(NULL)"}`);
    });

    sub("[3] payments 전체");
    const { data: pays } = await sb.from("payments").select("*").eq("task_id", t.id);
    console.log(`  ${(pays || []).length}건`);
    (pays || []).forEach((pm, i) => {
      console.log(`  ─ payment ${i+1} ──`);
      Object.entries(pm).forEach(([k, v]) => {
        if (typeof v === "object" && v !== null) v = JSON.stringify(v);
        console.log(`    ${k.padEnd(28)} = ${v ?? "(NULL)"}`);
      });
    });

    sub("[4] 금액 결산 — '반쪽 반영' 여부");
    console.log(`  · tasks.product_price          = ₩${Number(t.product_price||0).toLocaleString()}`);
    console.log(`  · tasks.total_amount           = ₩${Number(t.total_amount||0).toLocaleString()}  (GENERATED)`);
    console.log(`  · SUM(task_items.subtotal)     = ₩${sumSub.toLocaleString()}  ← '정산예정금액' 합`);
    console.log(`  · SUM(unit_price × qty)        = ₩${sumUnit.toLocaleString()}`);
    console.log(`  · SUM(customer_paid_amount)    = ₩${sumCust.toLocaleString()}  ← '고객결제 합계'`);
    console.log(`  · SUM(net_amount)              = ₩${sumNet.toLocaleString()}  ← '네이버정산금액 합'`);

    const settleAmt = Number(pays?.[0]?.product_price || 0);
    console.log(`  · payments.product_price       = ₩${settleAmt.toLocaleString()}  ← compute_payment 기준`);
    console.log(`  · payments.engineer_amount     = ₩${Number(pays?.[0]?.engineer_amount || 0).toLocaleString()}`);
  }

  // 5) cancel/partial 관련 컬럼 존재 여부 — task_items에 cancel 플래그 있는지
  head("[5] task_items 측 cancel/status 컬럼 — item 단위 취소 메커니즘 존재 여부");
  if (tasks[0]) {
    const { data: oneItem } = await sb.from("task_items").select("*").eq("task_id", tasks[0].id).limit(1);
    if (oneItem && oneItem[0]) {
      const cols = Object.keys(oneItem[0]);
      const cancelKeys = cols.filter(c => /cancel|status|취소/i.test(c));
      console.log(`  task_items 컬럼 (${cols.length}개):`);
      console.log(`    ${cols.join(", ")}`);
      console.log(`  cancel/status 관련 컬럼: ${cancelKeys.length === 0 ? "(없음 — item 단위 취소 플래그 X)" : cancelKeys.join(", ")}`);
    }
  }
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

// 2026-06-02 — 5월 완료 작업 (completed_at KST 5월, status='완료', 활성, usol_n) 회사 받을 총액 진단.
//
// 분석:
//   1. net_amount NOT NULL 전체 sum(net) × 0.85 + 건수 (정산완료 + 정산예정 모두)
//   2. 분리:
//      · 이미 정산 (naver_settled_at NOT NULL) net 합 × 0.85
//      · 정산 전 (naver_settled_at NULL)     net 합 × 0.85
//   3. net NULL + 완료 작업 건수 (금액 미계산)
//   4. 참고: sum(subtotal) (net ≈ subtotal 검증)
//
// 단위: task_item (task.completed_at KST 5월 + task.status='완료' + 활성 + usol_n).
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";
const FACTOR = 0.85;

// KST 5월 범위
//   start KST 2026-05-01 00:00 = UTC 2026-04-30 15:00
//   end   KST 2026-06-01 00:00 = UTC 2026-05-31 15:00
const MAY_START_UTC = "2026-04-30T15:00:00Z";
const MAY_END_UTC   = "2026-05-31T15:00:00Z";

(async () => {
  console.log("=".repeat(100));
  console.log("5월 완료 작업 회사 받을 총액 진단 (usol_n)");
  console.log("  범위: completed_at KST 2026-05-01 ~ 2026-05-31");
  console.log("  필터: task.status='완료' + task_item.is_canceled !== true");
  console.log("=".repeat(100));

  // fetch — task.completed_at 5월 + status='완료' + usol_n.
  const PAGE = 1000;
  const all = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await sb.from("task_items")
      .select(`id, task_id, net_amount, subtotal, naver_settled_at, is_canceled, product_order_id,
               tasks!inner(task_no, customer_name, status, principal_id, completed_at)`)
      .eq("tasks.principal_id", PID)
      .eq("tasks.status", "완료")
      .gte("tasks.completed_at", MAY_START_UTC)
      .lt("tasks.completed_at", MAY_END_UTC)
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  console.log(`\n  fetch (cancel 무관): ${all.length}건`);

  // cancel-strict 필터 (task_item.is_canceled !== true; task.status 측 측 측 측 측 측).
  const active = all.filter(it => it.is_canceled !== true);
  console.log(`  active (is_canceled 제외): ${active.length}건`);
  console.log(`  → 제외된 cancel task_item: ${all.length - active.length}건`);

  // 1. net_amount NOT NULL 전체.
  const withNet = active.filter(it => it.net_amount != null);
  const noNet   = active.filter(it => it.net_amount == null);
  const sumNetAll = withNet.reduce((s, it) => s + Number(it.net_amount), 0);
  const companyAll = Math.round(sumNetAll * FACTOR);

  console.log("\n  ─── (1) net_amount NOT NULL 전체 ───");
  console.log(`    건수             = ${withNet.length}건`);
  console.log(`    sum(net)         = ₩${sumNetAll.toLocaleString()}`);
  console.log(`    × 0.85 (회사받음) = ₩${companyAll.toLocaleString()}  ★ 정산완료+정산예정 모두 포함`);

  // 2. 분리 — settled / unsettled.
  const settled   = withNet.filter(it => it.naver_settled_at);
  const unsettled = withNet.filter(it => !it.naver_settled_at);
  const sumNetSettled   = settled.reduce((s, it) => s + Number(it.net_amount), 0);
  const sumNetUnsettled = unsettled.reduce((s, it) => s + Number(it.net_amount), 0);
  const companySettled   = Math.round(sumNetSettled * FACTOR);
  const companyUnsettled = Math.round(sumNetUnsettled * FACTOR);

  console.log("\n  ─── (2) 분리 ───");
  console.log(`    · 이미 정산 (settled NOT NULL):`);
  console.log(`        건수             = ${settled.length}건`);
  console.log(`        sum(net)         = ₩${sumNetSettled.toLocaleString()}`);
  console.log(`        × 0.85 (회사받음) = ₩${companySettled.toLocaleString()}`);
  console.log(`    · 정산 전 (settled NULL):`);
  console.log(`        건수             = ${unsettled.length}건`);
  console.log(`        sum(net)         = ₩${sumNetUnsettled.toLocaleString()}`);
  console.log(`        × 0.85 (회사받음) = ₩${companyUnsettled.toLocaleString()}`);

  // 3. net NULL 완료 작업.
  console.log("\n  ─── (3) net NULL + 완료 작업 (금액 미계산) ───");
  console.log(`    건수 = ${noNet.length}건  ← 회사 받을 총액 측 빠짐`);
  if (noNet.length > 0) {
    console.log(`    샘플 (5건):`);
    for (const it of noNet.slice(0, 5)) {
      console.log(`      ${it.tasks?.task_no?.padEnd(15)} / ${it.tasks?.customer_name?.padEnd(8)} / subtotal=${it.subtotal?.toLocaleString() || "—"} / poid=${it.product_order_id || "(NULL)"}`);
    }
  }

  // 4. 참고: sum(subtotal) (net ≈ subtotal 검증).
  const sumSubtotalAll = active.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  const sumSubtotalWithNet = withNet.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  const diff = sumNetAll - sumSubtotalWithNet;

  console.log("\n  ─── (4) 참고 — sum(subtotal) ───");
  console.log(`    active 전체 sum(subtotal)               = ₩${sumSubtotalAll.toLocaleString()}`);
  console.log(`    withNet 측 sum(subtotal)                = ₩${sumSubtotalWithNet.toLocaleString()}`);
  console.log(`    sum(net) - sum(subtotal[withNet])      = ₩${diff.toLocaleString()}  (net ≈ subtotal 측 measure 측 측)`);
  // item별 net vs subtotal 차이 측 catch.
  let netGtSub = 0, subGtNet = 0, equalNet = 0, maxDiff = 0, sampleDiff = [];
  for (const it of withNet) {
    const n = Number(it.net_amount);
    const s = Number(it.subtotal) || 0;
    const d = n - s;
    if (d > 0) netGtSub++;
    else if (d < 0) subGtNet++;
    else equalNet++;
    if (Math.abs(d) > Math.abs(maxDiff)) maxDiff = d;
    if (Math.abs(d) > 100 && sampleDiff.length < 5) sampleDiff.push({ task_no: it.tasks?.task_no, net: n, subtotal: s, diff: d });
  }
  console.log(`    item 차이 분포: net=sub ${equalNet}건 / net>sub ${netGtSub}건 / sub>net ${subGtNet}건  / max|diff|=${maxDiff}`);
  if (sampleDiff.length > 0) {
    console.log("    |diff|>100 샘플 (5건):");
    for (const s of sampleDiff) console.log(`      ${s.task_no?.padEnd(15)}  net=${s.net.toLocaleString()}  sub=${s.subtotal.toLocaleString()}  diff=${s.diff}`);
  }

  // 종합.
  console.log("\n  ─── 종합 ───");
  console.log(`    5월 완료 task_items (활성): ${active.length}건`);
  console.log(`      · net NOT NULL : ${withNet.length}건  → 회사 받을 총액 ₩${companyAll.toLocaleString()}`);
  console.log(`        - 정산완료    : ${settled.length}건 / ₩${companySettled.toLocaleString()}`);
  console.log(`        - 정산예정    : ${unsettled.length}건 / ₩${companyUnsettled.toLocaleString()}`);
  console.log(`      · net NULL     : ${noNet.length}건  → 회사 받을 총액 측 빠짐`);
})();

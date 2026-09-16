// 진단 — usol_n 정산 금액 이중곱 (read-only, 전체 출력)
// 판정: unit_price > customer_paid_amount / qty → 1대 정산금이 1대 결제금보다 큰 비상식
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const PID = "22222222-2222-2222-2222-222222222006";

(async () => {
  const { data } = await sb.from("task_items").select(
    "id, task_id, qty, unit_price, subtotal, customer_paid_amount, tasks!inner(task_no, principal_id, customer_name, external_order_no, created_at, status, completed_at, assigned_engineer_id)"
  ).gte("qty", 2).eq("tasks.principal_id", PID);
  const items = data || [];

  const susp = items.filter(i => {
    if (!i.customer_paid_amount || !i.qty) return false;
    const perUnit = i.customer_paid_amount / i.qty;
    return i.unit_price > perUnit;
  });

  console.log("=".repeat(110));
  console.log("usol_n 정산 금액 이중곱 진단 — 전체 13행 dump");
  console.log("=".repeat(110));
  console.log(`전체 qty>=2 usol_n task_items: ${items.length}행`);
  console.log(`이중곱 의심 행 (unit_price > customer_paid/qty): ${susp.length}행`);
  console.log("");

  // 1) 행별 dump
  console.log("─".repeat(110));
  console.log("의심 행 전체 dump");
  console.log("─".repeat(110));
  susp.forEach((i, idx) => {
    const perUnit = Math.round(i.customer_paid_amount / i.qty);
    const diff    = i.unit_price - perUnit;
    const properSub = i.unit_price;  // unit_price가 합계라면 그것이 정확한 subtotal
    const bloat   = (i.subtotal || 0) - properSub;
    console.log(`\n[${idx + 1}/${susp.length}] ${i.tasks.task_no}  (${i.tasks.customer_name})`);
    console.log(`     task_id        : ${i.task_id}`);
    console.log(`     status         : ${i.tasks.status}` + (i.tasks.status === "완료" ? "  ★★★ 완료 — 정산 진행 가능성" : ""));
    console.log(`     completed_at   : ${i.tasks.completed_at || "(아님)"}`);
    console.log(`     created_at     : ${i.tasks.created_at}`);
    console.log(`     external_order : ${i.tasks.external_order_no || "(NULL)"}`);
    console.log(`     qty            : ${i.qty}`);
    console.log(`     unit_price     : ₩${(i.unit_price || 0).toLocaleString()}   ← 의심: 수량 합계 값`);
    console.log(`     subtotal (DB)  : ₩${(i.subtotal || 0).toLocaleString()}   ← 현재 (unit_price × qty 이중곱)`);
    console.log(`     customer_paid  : ₩${(i.customer_paid_amount || 0).toLocaleString()}   (수량 합계, 고객 결제액)`);
    console.log(`     customer_paid/qty(1대): ₩${perUnit.toLocaleString()}`);
    console.log(`     unit_price - cp/qty   : ₩${diff.toLocaleString()}   (양수 = 이중곱 신호)`);
    console.log(`     정정 추정 subtotal    : ₩${properSub.toLocaleString()}`);
    console.log(`     부풀어 오른 금액      : ₩${bloat.toLocaleString()}`);
  });

  // 2) 합계
  console.log("\n" + "─".repeat(110));
  console.log("합계");
  console.log("─".repeat(110));
  const subSum = susp.reduce((s, i) => s + (i.subtotal || 0), 0);
  const upSum  = susp.reduce((s, i) => s + (i.unit_price || 0), 0);
  const diffSum = subSum - upSum;
  console.log(`  현재 subtotal 합 (13행):        ₩${subSum.toLocaleString()}`);
  console.log(`  정정 추정 합 (= unit_price 합): ₩${upSum.toLocaleString()}`);
  console.log(`  부풀어 오른 금액 총차이:        ₩${diffSum.toLocaleString()}`);

  // 3) 작업 단위 집계 (같은 task에 의심 행 2개일 수 있음 — YS-N-260525-045는 2건)
  console.log("\n" + "─".repeat(110));
  console.log("작업(task) 단위 집계 + status");
  console.log("─".repeat(110));
  const byTask = new Map();
  for (const i of susp) {
    const tno = i.tasks.task_no;
    if (!byTask.has(tno)) byTask.set(tno, { task: i.tasks, items: [] });
    byTask.get(tno).items.push(i);
  }
  console.log(`  영향 받은 task 수: ${byTask.size}건`);
  console.log("");
  console.log(`  task_no            | 고객      | status   | 의심 행 | task 부풀림 합`);
  for (const [tno, info] of byTask) {
    const taskBloat = info.items.reduce((s, i) => s + ((i.subtotal || 0) - (i.unit_price || 0)), 0);
    const statusMark = info.task.status === "완료" ? " ★완료★" : "";
    console.log(`  ${tno.padEnd(18)} | ${(info.task.customer_name || "—").padEnd(8)} | ${(info.task.status || "—").padEnd(8)} | ${String(info.items.length).padStart(2)}행    | ₩${taskBloat.toLocaleString()}${statusMark}`);
  }

  // 4) status별 분포
  const byStatus = {};
  for (const [, info] of byTask) {
    const s = info.task.status || "(NULL)";
    if (!byStatus[s]) byStatus[s] = { count: 0, bloat: 0 };
    byStatus[s].count++;
    byStatus[s].bloat += info.items.reduce((sum, i) => sum + ((i.subtotal || 0) - (i.unit_price || 0)), 0);
  }
  console.log("\n  status별 task 수 + 부풀림 합:");
  for (const [s, v] of Object.entries(byStatus)) {
    const mark = s === "완료" ? "  ★★★ 정산 진행 가능성 — 보정 시 주의" : "";
    console.log(`    ${s.padEnd(8)}: ${v.count}건 / ₩${v.bloat.toLocaleString()}${mark}`);
  }

  // 5) payments 영향 — 완료 작업이 있으면 payments 조회
  const completedTaskIds = [];
  for (const [, info] of byTask) {
    if (info.task.status === "완료") completedTaskIds.push(info.items[0].task_id);
  }
  if (completedTaskIds.length > 0) {
    console.log("\n" + "─".repeat(110));
    console.log("★ 완료 작업 payments 조회 (정산 row 존재 여부)");
    console.log("─".repeat(110));
    const { data: pays } = await sb.from("payments").select("task_id, engineer_amount, principal_amount, owner_amount, settled_at, calc_method").in("task_id", completedTaskIds);
    for (const p of (pays || [])) {
      console.log(`  task_id=${p.task_id.slice(0, 8)}... | engineer=₩${(p.engineer_amount || 0).toLocaleString()} | principal=₩${(p.principal_amount || 0).toLocaleString()} | owner=₩${(p.owner_amount || 0).toLocaleString()} | settled_at=${p.settled_at || "(NULL)"} | calc=${p.calc_method}`);
    }
    if (!pays || pays.length === 0) console.log("  (payments row 없음 — 정산 미생성)");
  } else {
    console.log("\n  status='완료' task 없음 — payments 영향 0");
  }
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });

// 3단계 드라이런 — 13행 백필 시뮬레이션 (read-only / UPDATE 금지)
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const PID = "22222222-2222-2222-2222-222222222006";
const CUT = "2026-05-25T00:00:00Z";

(async () => {
  // 페이지네이션으로 전체 task_items
  const all = [];
  for (let off = 0; off < 5000; off += 1000) {
    const { data } = await sb.from("task_items")
      .select("id, task_id, qty, unit_price, subtotal, customer_paid_amount, product_order_id, work_types(name), appliance_types(name), tasks!inner(task_no, customer_name, principal_id, created_at, status, product_price)")
      .eq("tasks.principal_id", PID)
      .range(off, off + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
  }

  // 이중곱 13행 추출
  const susp = all.filter(i =>
    i.tasks.created_at >= CUT &&
    i.qty >= 2 &&
    i.customer_paid_amount &&
    i.unit_price > (i.customer_paid_amount / i.qty)
  );

  console.log("=".repeat(110));
  console.log("3단계 드라이런 — 백필 시뮬레이션 (UPDATE 미실행)");
  console.log("=".repeat(110));
  console.log(`대상 이중곱 행: ${susp.length}행\n`);

  // [A] 13행 — 정정 전후 표
  console.log("─".repeat(110));
  console.log("[A] 13행 정정 전후");
  console.log("─".repeat(110));
  console.log("");
  console.log("task_no            | 고객      | 품목                       | qty | up(현재)   | sub(현재)   | cp        | up(정정) | sub(정정)  | 차액");
  console.log("─".repeat(160));
  let totalCurSub = 0, totalNewSub = 0;
  const rows = [];
  for (const i of susp) {
    const newUp = Math.round(i.unit_price / i.qty);
    const newSub = i.qty * newUp;
    const diff = (i.subtotal || 0) - newSub;
    totalCurSub += (i.subtotal || 0);
    totalNewSub += newSub;
    const wt = i.work_types?.name || "?";
    const ap = i.appliance_types?.name || "?";
    const item = `${wt}/${ap}`.padEnd(26);
    rows.push({ i, newUp, newSub, diff });
    console.log(`${i.tasks.task_no.padEnd(18)} | ${(i.tasks.customer_name || "—").padEnd(8)} | ${item.slice(0, 26)} | ${String(i.qty).padStart(3)} | ${String(i.unit_price).padStart(9)} | ${String(i.subtotal).padStart(10)} | ${String(i.customer_paid_amount).padStart(9)} | ${String(newUp).padStart(8)} | ${String(newSub).padStart(10)} | ₩${diff.toLocaleString().padStart(10)}`);
  }

  // [B] task 12건 단위
  console.log("\n" + "─".repeat(110));
  console.log("[B] task 12건 product_price 정정 전후");
  console.log("─".repeat(110));
  // task_id별로 묶기
  const byTask = new Map();
  for (const r of rows) {
    const tid = r.i.task_id;
    if (!byTask.has(tid)) byTask.set(tid, { task: r.i.tasks, items: [] });
    byTask.get(tid).items.push(r);
  }
  // 각 task의 전체 items도 필요 (의심 행 외 다른 항목 subtotal 포함)
  const allItemsByTask = new Map();
  for (const i of all) {
    if (!allItemsByTask.has(i.task_id)) allItemsByTask.set(i.task_id, []);
    allItemsByTask.get(i.task_id).push(i);
  }

  console.log("");
  console.log("task_no            | 고객      | status   | product_price(현재) | product_price(정정) | 차액         ");
  console.log("─".repeat(110));
  let totalCurPP = 0, totalNewPP = 0;
  for (const [tid, info] of byTask) {
    const cur = info.task.product_price || 0;
    // 정정 후 = 의심 행은 newSub, 그 외는 기존 subtotal 그대로
    const susIds = new Set(info.items.map(r => r.i.id));
    const allItems = allItemsByTask.get(tid) || [];
    let newPP = 0;
    for (const i of allItems) {
      if (susIds.has(i.id)) {
        const r = info.items.find(x => x.i.id === i.id);
        newPP += r.newSub;
      } else {
        newPP += (i.subtotal || 0);
      }
    }
    const diff = cur - newPP;
    totalCurPP += cur;
    totalNewPP += newPP;
    console.log(`${info.task.task_no.padEnd(18)} | ${(info.task.customer_name || "—").padEnd(8)} | ${(info.task.status || "—").padEnd(8)} | ₩${cur.toLocaleString().padStart(15)} | ₩${newPP.toLocaleString().padStart(15)} | ₩${diff.toLocaleString().padStart(10)}`);
  }
  console.log("─".repeat(110));
  console.log(`합계               |          |          | ₩${totalCurPP.toLocaleString().padStart(15)} | ₩${totalNewPP.toLocaleString().padStart(15)} | ₩${(totalCurPP-totalNewPP).toLocaleString().padStart(10)}`);

  // [C] 합계
  console.log("\n" + "─".repeat(110));
  console.log("[C] 13행 subtotal 합계");
  console.log("─".repeat(110));
  console.log(`  현재 subtotal 합:    ₩${totalCurSub.toLocaleString()}`);
  console.log(`  정정 후 subtotal 합: ₩${totalNewSub.toLocaleString()}`);
  console.log(`  줄어드는 총액:       ₩${(totalCurSub - totalNewSub).toLocaleString()}`);

  // [D] 안전 재점검
  console.log("\n" + "─".repeat(110));
  console.log("[D] 안전 재점검");
  console.log("─".repeat(110));
  // (1) status 재확인
  const taskIds = [...byTask.keys()];
  const { data: tasksNow } = await sb.from("tasks").select("id, task_no, status, completed_at, product_price").in("id", taskIds);
  const byStatus = {};
  let completedCount = 0;
  for (const t of (tasksNow || [])) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    if (t.status === "완료") completedCount++;
  }
  console.log(`  (1) 12 task status 재확인: ${JSON.stringify(byStatus)}`);
  if (completedCount === 0) console.log(`      ✓ status='완료' 0건 — payments 영향 없음`);
  else console.log(`      ✗ status='완료' ${completedCount}건 — 별도 취급 필요!`);

  // (2) payments row 존재 여부
  const { data: pays } = await sb.from("payments").select("id, task_id, engineer_amount, principal_amount, owner_amount, settled_at, calc_method").in("task_id", taskIds);
  console.log(`  (2) payments row: ${(pays || []).length}건`);
  if ((pays || []).length === 0) console.log(`      ✓ 12 task 어느 것도 payments row 없음 — 정산 미생성 (compute_payment 미발동)`);
  else {
    console.log(`      ⚠ payments row 발견 — 백필 시 재계산 필요:`);
    for (const p of pays) console.log(`        task_id=${p.task_id.slice(0,8)}... eng=${p.engineer_amount} prin=${p.principal_amount} own=${p.owner_amount} settled=${p.settled_at} calc=${p.calc_method}`);
  }

  // (3) product_price resync 트리거 동작 — Mig 070 코드 확인
  console.log(`  (3) tasks.product_price resync 트리거 — Migration 070`);
  console.log(`      task_items_resync_task_total_trg: AFTER INSERT/UPDATE/DELETE ON task_items`);
  console.log(`      동작: SUM(미취소 subtotal) → tasks.product_price 자동 UPDATE`);
  console.log(`      가드: COALESCE(product_price, -1) <> v_sum 일 때만 UPDATE (체인 안전)`);
  console.log(`      ✓ task_items.unit_price UPDATE → GENERATED subtotal 자동 → 트리거 → product_price 자동 정정`);
  console.log(`      → 별도 tasks UPDATE 불필요`);

  // [E] SQL 초안
  console.log("\n" + "─".repeat(110));
  console.log("[E] 백필 SQL 초안 (실행 전 검토용, BEGIN/COMMIT 분리 실행 권장)");
  console.log("─".repeat(110));
  console.log("");
  console.log("-- ============================================");
  console.log("-- usol_n 정산 이중곱 백필 — 13행 unit_price 정정");
  console.log("-- 작성일 : 2026-05-27");
  console.log("-- 배경   : CSV \"정산예정금액\"이 수량 합계로 들어와 unit_price에 박힘 → GENERATED subtotal=qty×unit_price 이중곱.");
  console.log("--          파서는 f491158에서 동적 판정으로 정상화. 본 SQL은 이미 저장된 13행 정정.");
  console.log("-- 안전   :");
  console.log("--   · status='완료' 0건 → compute_payment 미발동 / payments row 0건");
  console.log("--   · subtotal은 GENERATED COLUMN(자동 재계산)");
  console.log("--   · tasks.product_price는 task_items_resync_task_total_trg(Mig 070)가 자동 정정");
  console.log("-- ============================================");
  console.log("");
  console.log("-- [0] 사전 검증 SELECT — 정정 대상 13행 현재값 확인");
  console.log("SELECT ti.id, t.task_no, ti.qty, ti.unit_price, ti.subtotal, ti.customer_paid_amount");
  console.log("FROM task_items ti");
  console.log("JOIN tasks t ON t.id = ti.task_id");
  console.log("WHERE ti.id IN (");
  console.log(susp.map(i => `  '${i.id}'`).join(",\n"));
  console.log(") ORDER BY t.task_no;");
  console.log("");
  console.log("-- [1] 백필 UPDATE — 13행 unit_price = ROUND(unit_price / qty)");
  console.log("BEGIN;");
  console.log("");
  for (const r of rows) {
    console.log(`UPDATE task_items SET unit_price = ${r.newUp} WHERE id = '${r.i.id}'; -- ${r.i.tasks.task_no} qty=${r.i.qty} (${r.i.unit_price} → ${r.newUp})`);
  }
  console.log("");
  console.log("COMMIT;");
  console.log("");
  console.log("-- [2] 사후 검증 — 13행 subtotal/product_price 정정 확인");
  console.log("SELECT ti.id, t.task_no, t.product_price AS task_pp, ti.qty, ti.unit_price, ti.subtotal");
  console.log("FROM task_items ti");
  console.log("JOIN tasks t ON t.id = ti.task_id");
  console.log("WHERE ti.id IN (");
  console.log(susp.map(i => `  '${i.id}'`).join(",\n"));
  console.log(") ORDER BY t.task_no;");
  console.log("");
  console.log("-- 기대:");
  for (const r of rows) {
    console.log(`--   ${r.i.tasks.task_no}: unit_price=${r.newUp} / subtotal=${r.newSub}`);
  }
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });

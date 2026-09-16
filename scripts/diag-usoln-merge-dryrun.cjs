// 드라이런 (읽기 전용) — usol_n 분리 주문 통합 계획 산출
// 2026-05-25
//
// ★ DB 쓰기 0건 ★ — SELECT만 사용.
//
// 룰:
//   1. keeper = order_type='본작업' item 가진 task. 없으면 created_at 가장 빠른 task.
//      본작업 task가 2개 이상이면 그중 created_at 가장 빠른 것 (그 외는 mergerTie 카운트).
//   2. 다른 task의 task_items는 keeper로 이동 (task_id 변경).
//   3. 중복 product_order_id 그룹 안에서 1개만 남김.
//      남길 우선순위: (unit_price>0 desc, subtotal>0 desc, task.created_at asc, task_items.id asc).
//      가격이 서로 다른 경우 (unit_price 또는 subtotal) → priceDivergent 별도 표기.
//   4. keeper 외 task는 (item 비워진 후) 삭제 대상. payments는 ON DELETE CASCADE → 자동 삭제.
//      삭제 대상 task에 payments가 있으면 paymentToDrop 카운트 (사장님 확인용).
//   5. keeper는 compute_payment 재계산 대상.
//
// 출력: scripts/diag-usoln-merge-dryrun-결과.json

const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PAGE = 1000;

async function fetchAllPaged(builder) {
  let all = [];
  for (let off = 0; ; off += PAGE) {
    const { data, error } = await builder().range(off, off + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
  }
  return all;
}

(async () => {
  const t0 = Date.now();
  const out = { generatedAt: new Date().toISOString(), readOnly: true };

  // 1) usol_n principal_id
  const { data: p } = await sb.from("principals").select("id, code").eq("code", "usol_n").maybeSingle();
  if (!p) { console.error("usol_n principal X"); process.exit(1); }
  const PID = p.id;

  // 2) usol_n 모든 task
  const allTasks = await fetchAllPaged(() => sb
    .from("tasks")
    .select("id, task_no, customer_name, external_order_no, status, received_at, created_at, assigned_engineer_id, completed_at")
    .eq("principal_id", PID)
    .order("created_at", { ascending: true })
  );
  out.totalTasks = allTasks.length;

  // 3) external_order_no 별 그룹 — 2+ task인 것만 골라냄
  const byOrderNo = new Map();
  for (const t of allTasks) {
    const k = t.external_order_no;
    if (!k) continue;
    if (!byOrderNo.has(k)) byOrderNo.set(k, []);
    byOrderNo.get(k).push(t);
  }
  const splitOrders = [];
  for (const [orderNo, tasks] of byOrderNo.entries()) {
    if (tasks.length >= 2) splitOrders.push({ orderNo, tasks });
  }
  out.splitOrderCount = splitOrders.length;

  // 4) 분리 주문 task_id 전체 → task_items + payments fetch
  const splitTaskIds = splitOrders.flatMap(s => s.tasks.map(t => t.id));

  // task_items
  let allItems = [];
  for (let i = 0; i < splitTaskIds.length; i += 200) {
    const chunk = splitTaskIds.slice(i, i + 200);
    const { data, error } = await sb
      .from("task_items")
      .select("id, task_id, order_type, product_order_id, qty, unit_price, subtotal, customer_paid_amount, work_types(name), appliance_types(name)")
      .in("task_id", chunk)
      .order("id", { ascending: true });
    if (error) { console.error(error); process.exit(1); }
    allItems = allItems.concat(data || []);
  }
  const itemsByTask = new Map();
  for (const it of allItems) {
    if (!itemsByTask.has(it.task_id)) itemsByTask.set(it.task_id, []);
    itemsByTask.get(it.task_id).push(it);
  }

  // payments
  let allPayments = [];
  for (let i = 0; i < splitTaskIds.length; i += 200) {
    const chunk = splitTaskIds.slice(i, i + 200);
    const { data, error } = await sb
      .from("payments")
      .select("id, task_id, status, engineer_amount, principal_amount, owner_amount, paid_at, confirmed_at, settled_at, track, engineer_remitted_at, engineer_remit_confirmed_at")
      .in("task_id", chunk);
    if (error) { console.error(error); process.exit(1); }
    allPayments = allPayments.concat(data || []);
  }
  const paymentByTask = new Map();
  for (const pm of allPayments) {
    if (!paymentByTask.has(pm.task_id)) paymentByTask.set(pm.task_id, []);
    paymentByTask.get(pm.task_id).push(pm);
  }

  // 5) 주문별 통합 계획 수립
  const plans = [];
  let totalTasksToDelete = 0;
  let totalDupItemsToRemove = 0;
  let totalItemsToMove = 0;
  let totalKeeperRecompute = 0;
  let paymentToDropCount = 0;
  let paymentToDropOnNonEmpty = 0;  // 삭제 대상 task에 payment + 정산 진행 (paid/confirmed/settled) 있으면 위험
  let mainMissingOrders = 0;
  let mergerTieOrders = 0;       // 본작업 task 2+ — keeper 후보 모호
  let priceDivergentGroups = 0;  // 같은 poid인데 가격 다른 케이스
  let priceDivergentOrders = 0;

  // 분류 — 분리 주문에 대해
  for (const s of splitOrders) {
    const orderTasks = s.tasks; // created_at asc 정렬됨
    // 본작업 item 있는 task
    const mainTasks = orderTasks.filter(t => (itemsByTask.get(t.id) || []).some(it => it.order_type === '본작업'));
    let keeper;
    let abnormal = { mainMissing: false, mergerTie: false };
    if (mainTasks.length === 0) {
      keeper = orderTasks[0]; // created_at 가장 빠른 task
      abnormal.mainMissing = true;
      mainMissingOrders++;
    } else if (mainTasks.length === 1) {
      keeper = mainTasks[0];
    } else {
      keeper = mainTasks[0]; // 그중 created_at 가장 빠른
      abnormal.mergerTie = true;
      mergerTieOrders++;
    }

    const absorbTasks = orderTasks.filter(t => t.id !== keeper.id);
    const keeperItems = (itemsByTask.get(keeper.id) || []).slice();
    const absorbItemsFlat = absorbTasks.flatMap(t => (itemsByTask.get(t.id) || []));
    const allItemsForMerge = keeperItems.concat(absorbItemsFlat);

    // 중복 product_order_id 그룹화
    const byPoid = new Map();
    const itemsWithoutPoid = [];
    for (const it of allItemsForMerge) {
      const poid = it.product_order_id || "";
      if (!poid) { itemsWithoutPoid.push(it); continue; }
      if (!byPoid.has(poid)) byPoid.set(poid, []);
      byPoid.get(poid).push(it);
    }

    const taskCreatedAt = new Map(orderTasks.map(t => [t.id, t.created_at]));
    function rankItem(it) {
      // 정렬 키: unit_price>0 asc(=0 last), subtotal>0 asc(=0 last), task.created_at asc, item.id asc
      const upMissing  = !(Number(it.unit_price) > 0);
      const sbtMissing = !(Number(it.subtotal)   > 0);
      const taskTs = taskCreatedAt.get(it.task_id) || '';
      return [upMissing ? 1 : 0, sbtMissing ? 1 : 0, taskTs, String(it.id)];
    }

    const dupItemsToRemove = [];
    const finalItemsForKeeper = [];
    let orderHadPriceDivergence = false;
    for (const it of itemsWithoutPoid) finalItemsForKeeper.push(it);
    for (const [poid, group] of byPoid.entries()) {
      // 가격 분기 체크
      const prices = new Set(group.map(g => `${Number(g.unit_price)||0}/${Number(g.subtotal)||0}`));
      if (prices.size > 1) { priceDivergentGroups++; orderHadPriceDivergence = true; }
      const sorted = group.slice().sort((a, b) => {
        const ra = rankItem(a), rb = rankItem(b);
        for (let i = 0; i < ra.length; i++) {
          if (ra[i] < rb[i]) return -1;
          if (ra[i] > rb[i]) return 1;
        }
        return 0;
      });
      const keep = sorted[0];
      const drop = sorted.slice(1);
      finalItemsForKeeper.push(keep);
      for (const d of drop) dupItemsToRemove.push(d);
    }
    if (orderHadPriceDivergence) priceDivergentOrders++;

    // task_items 이동/유지 분류
    const moveItems = [];   // task_id 변경 대상 (keeper 외 task에서 keeper로 이동, 중복 제거 후 남는 것만)
    const dropItems = [];   // 제거 대상 (중복)
    const dropIdSet = new Set(dupItemsToRemove.map(d => d.id));
    for (const it of allItemsForMerge) {
      if (dropIdSet.has(it.id)) { dropItems.push(it); continue; }
      if (it.task_id !== keeper.id) moveItems.push(it);
      // keeper.id 그대로면 손 안 댐
    }

    // payment 영향
    const paymentsOnAbsorbed = absorbTasks.flatMap(t => paymentByTask.get(t.id) || []);
    const dangerous = paymentsOnAbsorbed.filter(pm =>
      pm.paid_at || pm.confirmed_at || pm.settled_at ||
      pm.engineer_remitted_at || pm.engineer_remit_confirmed_at
    );
    paymentToDropCount       += paymentsOnAbsorbed.length;
    paymentToDropOnNonEmpty  += dangerous.length;

    // 합계
    totalTasksToDelete    += absorbTasks.length;
    totalDupItemsToRemove += dupItemsToRemove.length;
    totalItemsToMove      += moveItems.length;
    totalKeeperRecompute  += 1;

    plans.push({
      external_order_no: s.orderNo,
      taskCount: orderTasks.length,
      keeper: {
        task_no: keeper.task_no,
        id: keeper.id,
        created_at: keeper.created_at,
        status: keeper.status,
        customer: keeper.customer_name,
      },
      absorbTaskNos: absorbTasks.map(t => t.task_no),
      itemsTotal:      allItemsForMerge.length,
      itemsMoveCount:  moveItems.length,
      itemsKeeperBefore: keeperItems.length,
      itemsKeeperAfter:  finalItemsForKeeper.length,
      dupRemoveCount:  dupItemsToRemove.length,
      paymentsOnAbsorbed: paymentsOnAbsorbed.length,
      paymentsDangerous:  dangerous.length,
      abnormal,
      priceDivergent: orderHadPriceDivergence,
    });
  }

  // 6) 한유경 (2026051147012351) 상세 ─ 통합 후 예상 모습
  const HAN_ORDER = "2026051147012351";
  const hanPlan = plans.find(p => p.external_order_no === HAN_ORDER) || null;
  let hanDetail = null;
  if (hanPlan) {
    const han = splitOrders.find(s => s.orderNo === HAN_ORDER);
    const keeperId = hanPlan.keeper.id;
    const keeperTask = han.tasks.find(t => t.id === keeperId);
    const absorbed = han.tasks.filter(t => t.id !== keeperId);
    const allHanItems = han.tasks.flatMap(t => (itemsByTask.get(t.id) || []).map(it => ({ ...it, _from_task_no: t.task_no })));

    // 같은 dedup 룰 재실행해서 final items 산출
    const byPoid = new Map();
    const noPoid = [];
    for (const it of allHanItems) {
      const poid = it.product_order_id || "";
      if (!poid) { noPoid.push(it); continue; }
      if (!byPoid.has(poid)) byPoid.set(poid, []);
      byPoid.get(poid).push(it);
    }
    const taskCreatedAt = new Map(han.tasks.map(t => [t.id, t.created_at]));
    function rk(it) {
      const upMissing  = !(Number(it.unit_price) > 0);
      const sbtMissing = !(Number(it.subtotal)   > 0);
      const taskTs = taskCreatedAt.get(it.task_id) || '';
      return [upMissing ? 1 : 0, sbtMissing ? 1 : 0, taskTs, String(it.id)];
    }
    const finalItems = [];
    const removed = [];
    for (const it of noPoid) finalItems.push(it);
    for (const [poid, group] of byPoid.entries()) {
      const sorted = group.slice().sort((a, b) => {
        const ra = rk(a), rb = rk(b);
        for (let i = 0; i < ra.length; i++) {
          if (ra[i] < rb[i]) return -1;
          if (ra[i] > rb[i]) return 1;
        }
        return 0;
      });
      finalItems.push(sorted[0]);
      sorted.slice(1).forEach(d => removed.push(d));
    }

    hanDetail = {
      external_order_no: HAN_ORDER,
      keeper_task_no:    keeperTask.task_no,
      keeper_status:     keeperTask.status,
      taskCountBefore:   han.tasks.length,
      taskCountAfter:    1,
      tasksToDelete:     absorbed.map(t => t.task_no),
      itemsBefore:       allHanItems.length,
      itemsAfter:        finalItems.length,
      itemsRemoved:      removed.length,
      finalItems: finalItems.map(it => ({
        order_type: it.order_type,
        appliance:  it.appliance_types?.name || null,
        work_type:  it.work_types?.name || null,
        product_order_id: it.product_order_id,
        unit_price: it.unit_price,
        subtotal:   it.subtotal,
        from_task:  it._from_task_no,
      })),
      removedItems: removed.map(it => ({
        order_type: it.order_type,
        appliance:  it.appliance_types?.name || null,
        work_type:  it.work_types?.name || null,
        product_order_id: it.product_order_id,
        unit_price: it.unit_price,
        subtotal:   it.subtotal,
        from_task:  it._from_task_no,
        reason: "중복 product_order_id",
      })),
    };
  }

  // 7) 결과 종합
  out.summary = {
    splitOrders: splitOrders.length,
    splitTasksTotal: splitOrders.reduce((s, o) => s + o.tasks.length, 0),
    tasksToDelete: totalTasksToDelete,
    itemsToMove:   totalItemsToMove,
    dupItemsToRemove: totalDupItemsToRemove,
    keeperRecomputeCount: totalKeeperRecompute,
    payments: {
      onTasksToDelete: paymentToDropCount,
      withSettlementProgress: paymentToDropOnNonEmpty,
      note: "payments.task_id FK ON DELETE CASCADE — task 삭제 시 자동 사라짐. settlement 진행된 건은 별도 검토 필요 (지급/완료 후 사라지면 이력 손실).",
    },
    anomalies: {
      mainMissingOrders,   // 본작업 item 없는 주문 (전체가 추가선택-only)
      mergerTieOrders,     // 본작업 task 2+ — keeper 모호
      priceDivergentOrders,
      priceDivergentGroups,
    },
  };

  // 이상 케이스 샘플 추출
  const anomalySamples = {
    mainMissing:     plans.filter(p => p.abnormal.mainMissing).slice(0, 10),
    mergerTie:       plans.filter(p => p.abnormal.mergerTie).slice(0, 10),
    priceDivergent:  plans.filter(p => p.priceDivergent).slice(0, 10),
    paymentDanger:   plans.filter(p => p.paymentsDangerous > 0).slice(0, 10),
  };

  out.anomalySamples = anomalySamples;
  out.hanyukyung = hanDetail;
  out.plans = plans;  // 335 전수

  const file = path.join(__dirname, "diag-usoln-merge-dryrun-결과.json");
  fs.writeFileSync(file, JSON.stringify(out, null, 2));

  // 콘솔 요약
  console.log("=== usol_n 주문 통합 드라이런 (DB 쓰기 0건) ===");
  console.log("총 task:", out.totalTasks);
  console.log("분리 주문 수:", out.summary.splitOrders, "(영향 task:", out.summary.splitTasksTotal, ")");
  console.log("삭제 대상 task 총수:", out.summary.tasksToDelete);
  console.log("이동 대상 item:", out.summary.itemsToMove);
  console.log("제거될 중복 item:", out.summary.dupItemsToRemove);
  console.log("재계산 대상 (keeper):", out.summary.keeperRecomputeCount);
  console.log("");
  console.log("payment 영향:");
  console.log("  · 삭제 대상 task의 payments row 수:", out.summary.payments.onTasksToDelete);
  console.log("  · 그 중 정산 진행(paid/confirmed/settled/송금)된 건:", out.summary.payments.withSettlementProgress);
  console.log("  ※ payments.task_id ON DELETE CASCADE — 자동 사라짐. 진행분은 검토 필요.");
  console.log("");
  console.log("이상 케이스:");
  console.log("  · 본작업 없는 주문 (추가선택-only 주문):", mainMissingOrders);
  console.log("  · 본작업 task 2+ (keeper 모호):", mergerTieOrders);
  console.log("  · 같은 poid 가격 분기 — 주문수:", priceDivergentOrders, "/ 그룹수:", priceDivergentGroups);
  console.log("");
  if (hanDetail) {
    console.log("[한유경 2026051147012351]");
    console.log(`  keeper = ${hanDetail.keeper_task_no} (${hanDetail.keeper_status})`);
    console.log(`  taskCount: ${hanDetail.taskCountBefore} → ${hanDetail.taskCountAfter}`);
    console.log(`  삭제 대상: ${hanDetail.tasksToDelete.join(", ")}`);
    console.log(`  items: ${hanDetail.itemsBefore} → ${hanDetail.itemsAfter} (중복 제거 ${hanDetail.itemsRemoved})`);
    console.log("  통합 후 keeper items:");
    hanDetail.finalItems.forEach(it => {
      console.log(`    · ${it.order_type || '(X)'} | ${it.appliance || '—'} | ${it.work_type || '—'} | poid=${it.product_order_id || '—'} | unit=${it.unit_price} sub=${it.subtotal} (← ${it.from_task})`);
    });
    console.log("  제거될 중복 items:");
    hanDetail.removedItems.forEach(it => {
      console.log(`    × ${it.order_type || '(X)'} | ${it.work_type || it.appliance || '—'} | poid=${it.product_order_id} unit=${it.unit_price} sub=${it.subtotal} (← ${it.from_task})`);
    });
  }
  console.log("");
  console.log(`결과 파일: ${file}  (소요 ${((Date.now()-t0)/1000).toFixed(1)}s)`);
})().catch(e => { console.error(e); process.exit(1); });

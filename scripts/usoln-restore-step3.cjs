// usol_n task_items 복구 실행 스크립트 — 3단계 (작성, 실행 X)
// 2026-05-25
//
// 사전 조건 (사장님이 SQL Editor 측 직접 실행):
//   [SQL-A] Migration 069 적용 — sync_task_items_trg 함수 안전화 (UPDATE+빈cat → DELETE 차단)
//   [SQL-B] ALTER TABLE task_items DISABLE TRIGGER task_items_compute_trg;
//
// 사후 조건 (사장님이 SQL Editor 측 직접 실행):
//   [SQL-C] ALTER TABLE task_items ENABLE TRIGGER task_items_compute_trg;
//
// 본 스크립트:
//   1. 백업 — 현재 324 keeper의 task row + payments → backups/usoln-restore-before-{ts}.json
//   2. 백업(usoln-merge-before-2026-05-24T21-34-12.json) task_items 1,194건 읽기
//      → ext별 그룹 → 라이브 keeper.id 재매핑 → dedup 룰 (unit_price>0 우선)
//   3. 복원 INSERT — 324 keeper 측 총 747건 task_items
//   4. compute_payment RPC — 324 keeper 각 1회
//   5. 검증 (★라이브 재조회 — 옛 Map 재사용 금지★):
//      · keeper별 task_items 직접 .eq("task_id", keeper.id) 카운트 → 드라이런 예상치와 대조
//      · fresh SUM(subtotal) = task.product_price = payment.product_price 3자 일치
//      · payment.is_balanced = true 전수
//
// 모드:
//   node scripts/usoln-restore-step3.cjs           # dry-run (DB 쓰기 0, plan 출력만)
//   node scripts/usoln-restore-step3.cjs --commit  # 실제 실행 — 사전 조건 확인 후

const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const COMMIT = process.argv.includes("--commit");

async function withRetry(fn, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await fn(); }
    catch (e) {
      const msg = String(e?.message || e || "");
      const isTransient = /timeout|ECONN|fetch failed|network|503|504|gateway|upstream|transaction is aborted/i.test(msg);
      if (attempt >= 3 || !isTransient) throw e;
      const wait = 800 * attempt;
      console.warn(`  ⏳ ${label} transient (${attempt}/3) — ${msg} — ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

(async () => {
  console.log("=".repeat(82));
  console.log(`usol_n task_items 복구 — ${COMMIT ? "✅ COMMIT" : "🔍 DRY-RUN"}`);
  console.log("=".repeat(82));

  if (COMMIT) {
    console.log("\n⚠️  사전 조건 확인 (사장님 SQL Editor 측 실행 완료해야 함):");
    console.log("   [SQL-A] Migration 069 적용 (sync_task_items_trg 함수 안전화)");
    console.log("   [SQL-B] ALTER TABLE task_items DISABLE TRIGGER task_items_compute_trg;");
    console.log("   ※ 둘 다 미적용 시 사고 재발 또는 compute_payment 중복 호출.\n");
  }

  // ───── [1] 라이브 keeper 식별 + 백업 ─────
  const { data: p } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  const PID = p.id;
  const dry = JSON.parse(fs.readFileSync(path.join(__dirname, "diag-usoln-merge-dryrun-결과.json"), "utf8"));
  const allExts = dry.plans.map(p => p.external_order_no);

  let keepers = [];
  for (let i = 0; i < allExts.length; i += 100) {
    const chunk = allExts.slice(i, i + 100);
    const data = await withRetry(async () => {
      const { data, error } = await sb.from("tasks")
        .select("id, task_no, customer_name, external_order_no, status, product_price, total_amount, extra_fee, travel_fee, category_data, created_at, updated_at")
        .eq("principal_id", PID).in("external_order_no", chunk);
      if (error) throw new Error(error.message);
      return data;
    }, `keeper fetch ${i}`);
    keepers = keepers.concat(data || []);
  }
  const keeperByExt = new Map();
  for (const k of keepers) keeperByExt.set(k.external_order_no, k);
  const keeperIds = keepers.map(k => k.id);

  // 살아있는 task_items 보유 keeper 식별 (skip 대상)
  let liveItems = [];
  for (let i = 0; i < keeperIds.length; i += 200) {
    const chunk = keeperIds.slice(i, i + 200);
    const data = await withRetry(async () => {
      const { data, error } = await sb.from("task_items").select("task_id").in("task_id", chunk);
      if (error) throw new Error(error.message);
      return data;
    }, `live items ${i}`);
    liveItems = liveItems.concat(data || []);
  }
  const liveCountByTask = new Map();
  for (const it of liveItems) liveCountByTask.set(it.task_id, (liveCountByTask.get(it.task_id) || 0) + 1);

  // payments 현재값 — 백업용
  let livePayments = [];
  for (let i = 0; i < keeperIds.length; i += 200) {
    const chunk = keeperIds.slice(i, i + 200);
    const data = await withRetry(async () => {
      const { data, error } = await sb.from("payments").select("*").in("task_id", chunk);
      if (error) throw new Error(error.message);
      return data;
    }, `payments ${i}`);
    livePayments = livePayments.concat(data || []);
  }

  console.log(`라이브: keeper ${keepers.length} / 살아있는 items 있는 keeper ${[...liveCountByTask.entries()].filter(([,v]) => v > 0).length}`);

  // ───── [2] 복구 plan 산출 (백업 + dedup 룰) ─────
  const bak = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "backups", "usoln-merge-before-2026-05-24T21-34-12.json"), "utf8"));
  const bakTasks = bak.tasks || [];
  const bakItems = bak.task_items || [];
  const taskIdToExt = new Map();
  const taskIdToCreatedAt = new Map();
  const taskIdToTaskNo = new Map();
  for (const t of bakTasks) {
    taskIdToExt.set(t.id, t.external_order_no);
    taskIdToCreatedAt.set(t.id, t.created_at);
    taskIdToTaskNo.set(t.id, t.task_no);
  }
  const itemsByExt = new Map();
  for (const it of bakItems) {
    const ext = taskIdToExt.get(it.task_id);
    if (!ext) continue;
    if (!itemsByExt.has(ext)) itemsByExt.set(ext, []);
    itemsByExt.get(ext).push(it);
  }

  const restorePlans = []; // [{ ext, keeper, items_to_insert, expected_count }]
  let skipAlive = 0;
  for (const ext of allExts) {
    const keeper = keeperByExt.get(ext);
    if (!keeper) continue;
    if ((liveCountByTask.get(keeper.id) || 0) > 0) { skipAlive++; continue; }
    const bItems = itemsByExt.get(ext) || [];
    if (bItems.length === 0) continue;

    // dedup
    const byPoid = new Map();
    const noPoid = [];
    for (const it of bItems) {
      const k = it.product_order_id || "";
      if (!k) { noPoid.push(it); continue; }
      if (!byPoid.has(k)) byPoid.set(k, []);
      byPoid.get(k).push(it);
    }
    function rk(it) {
      return [
        Number(it.unit_price) > 0 ? 0 : 1,
        Number(it.subtotal)   > 0 ? 0 : 1,
        taskIdToCreatedAt.get(it.task_id) || '',
        String(it.id),
      ];
    }
    const keepItems = [];
    for (const it of noPoid) keepItems.push(it);
    for (const [, group] of byPoid.entries()) {
      const sorted = group.slice().sort((a, b) => {
        const ra = rk(a), rb = rk(b);
        for (let i = 0; i < ra.length; i++) { if (ra[i] < rb[i]) return -1; if (ra[i] > rb[i]) return 1; }
        return 0;
      });
      keepItems.push(sorted[0]);
    }

    // INSERT용 row 변환 — id 새로 생성(omit), task_id = keeper.id, 나머지 필드 그대로
    // 다만 GENERATED 컬럼 (subtotal 등) 제외, FK 컬럼 유지
    const insertRows = keepItems.map(it => ({
      task_id: keeper.id,
      work_type_id: it.work_type_id,
      appliance_type_id: it.appliance_type_id,
      qty: it.qty,
      unit_price: it.unit_price,
      // subtotal — GENERATED일 수 있음. backup에 값 있으면 그대로 — 단 GENERATED면 INSERT 시 무시됨.
      // 안전상 명시 INSERT 안 함 (Supabase가 default/generated 처리).
      customer_paid_amount: it.customer_paid_amount,
      order_type: it.order_type,
      product_order_id: it.product_order_id,
      description: it.description,
      metadata: it.metadata,
      // 정산 사이클 컬럼 — 옛 시각 그대로 복원 (Migration 045/041 컬럼)
      naver_settled_at: it.naver_settled_at,
      cash_settled_at: it.cash_settled_at,
      naver_received_at: it.naver_received_at,
      cash_received_at: it.cash_received_at,
      // company_received_at은 GENERATED (MAX(naver_received_at, cash_received_at)) — INSERT 시 무시됨
      engineer_settled_at: it.engineer_settled_at,
      net_amount: it.net_amount,
    }));
    restorePlans.push({ ext, keeper, items: insertRows, expected: insertRows.length });
  }
  const totalInsert = restorePlans.reduce((s, p) => s + p.items.length, 0);
  console.log(`복구 plan: ${restorePlans.length} keeper / 총 ${totalInsert} items / skip ${skipAlive}\n`);

  // ───── DRY-RUN 종료 ─────
  if (!COMMIT) {
    console.log("🔍 DRY-RUN 완료 — DB 쓰기 0건.");
    console.log("적용 명령:");
    console.log("  1) [사장님 SQL Editor] Migration 069 + DISABLE task_items_compute_trg");
    console.log("  2) node scripts/usoln-restore-step3.cjs --commit");
    console.log("  3) [사장님 SQL Editor] ENABLE task_items_compute_trg");
    return;
  }

  // ───── [3] 백업 — 현재 keeper task + payments 스냅샷 ─────
  const backupsDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const beforeFile = path.join(backupsDir, `usoln-restore-before-${ts}.json`);
  fs.writeFileSync(beforeFile, JSON.stringify({
    type: "usoln-restore-before",
    ts: new Date().toISOString(),
    note: "task_items 복구 직전 — 324 keeper의 task 행 + payments 전량 (롤백 용).",
    keepers,
    payments: livePayments,
    restorePlanSummary: { keepers: restorePlans.length, items: totalInsert, skipAlive },
  }, null, 2), "utf8");
  console.log(`📦 백업: ${beforeFile}`);

  // ───── [4] INSERT — keeper 단위 batch ─────
  const insertResults = []; // { ext, keeper_no, attempted, inserted_count, error }
  let totalInserted = 0;
  let insertErrors = [];
  const t0 = Date.now();
  for (let i = 0; i < restorePlans.length; i++) {
    const plan = restorePlans[i];
    try {
      await withRetry(async () => {
        const { error } = await sb.from("task_items").insert(plan.items);
        if (error) throw new Error(`INSERT ${plan.keeper.task_no} (${plan.items.length}건): ${error.message}`);
      }, `INSERT ${plan.keeper.task_no}`);
      totalInserted += plan.items.length;
      insertResults.push({ ext: plan.ext, keeper_no: plan.keeper.task_no, attempted: plan.items.length, ok: true });
      if ((i + 1) % 50 === 0) console.log(`  [INSERT ${i+1}/${restorePlans.length}] 누적 items ${totalInserted}`);
      await new Promise(r => setTimeout(r, 30));
    } catch (e) {
      insertErrors.push({ ext: plan.ext, keeper_no: plan.keeper.task_no, error: e.message });
      insertResults.push({ ext: plan.ext, keeper_no: plan.keeper.task_no, attempted: plan.items.length, ok: false, error: e.message });
      console.error(`  ❌ INSERT ${plan.keeper.task_no}: ${e.message}`);
    }
  }
  console.log(`\nINSERT 완료: ${totalInserted} items / ${restorePlans.length} keeper (${insertErrors.length} 오류, ${((Date.now()-t0)/1000).toFixed(1)}s)`);

  // ───── [5] compute_payment RPC — 324 keeper 각 1회 ─────
  console.log(`\ncompute_payment 재계산 시작...`);
  let rpcOk = 0, rpcErrors = [];
  const t1 = Date.now();
  for (let i = 0; i < restorePlans.length; i++) {
    const plan = restorePlans[i];
    try {
      await withRetry(async () => {
        const { error } = await sb.rpc('compute_payment', { p_task_id: plan.keeper.id });
        if (error) throw new Error(`compute_payment ${plan.keeper.task_no}: ${error.message}`);
      }, `compute_payment ${plan.keeper.task_no}`);
      rpcOk++;
      if ((i + 1) % 50 === 0) console.log(`  [RPC ${i+1}/${restorePlans.length}] 누적 OK ${rpcOk}`);
      await new Promise(r => setTimeout(r, 30));
    } catch (e) {
      rpcErrors.push({ ext: plan.ext, keeper_no: plan.keeper.task_no, error: e.message });
      console.error(`  ❌ RPC ${plan.keeper.task_no}: ${e.message}`);
    }
  }
  console.log(`compute_payment 완료: ${rpcOk}/${restorePlans.length} (${rpcErrors.length} 오류, ${((Date.now()-t1)/1000).toFixed(1)}s)`);

  // ───── [6] 검증 — ★라이브 재조회★ (옛 Map 금지) ─────
  console.log(`\n[검증 — 라이브 재조회, 옛 Map 재사용 금지]`);
  await new Promise(r => setTimeout(r, 1500)); // trigger 발화 안정 대기

  // 재조회: tasks
  let tasks2 = [];
  for (let i = 0; i < keeperIds.length; i += 200) {
    const chunk = keeperIds.slice(i, i + 200);
    const data = await withRetry(async () => {
      const { data, error } = await sb.from("tasks").select("id, task_no, product_price, total_amount, extra_fee, travel_fee").in("id", chunk);
      if (error) throw new Error(error.message);
      return data;
    }, `verify tasks ${i}`);
    tasks2 = tasks2.concat(data || []);
  }
  // 재조회: task_items 직접 .eq("task_id", keeper.id) 개수 + SUM(subtotal)
  let items2 = [];
  for (let i = 0; i < keeperIds.length; i += 200) {
    const chunk = keeperIds.slice(i, i + 200);
    const data = await withRetry(async () => {
      const { data, error } = await sb.from("task_items").select("task_id, subtotal").in("task_id", chunk);
      if (error) throw new Error(error.message);
      return data;
    }, `verify items ${i}`);
    items2 = items2.concat(data || []);
  }
  const freshItemCount = new Map();
  const freshSum = new Map();
  for (const it of items2) {
    freshItemCount.set(it.task_id, (freshItemCount.get(it.task_id) || 0) + 1);
    freshSum.set(it.task_id, (freshSum.get(it.task_id) || 0) + (Number(it.subtotal) || 0));
  }
  // 재조회: payments
  let payments2 = [];
  for (let i = 0; i < keeperIds.length; i += 200) {
    const chunk = keeperIds.slice(i, i + 200);
    const data = await withRetry(async () => {
      const { data, error } = await sb.from("payments").select("task_id, product_price, engineer_amount, principal_amount, owner_amount, is_balanced").in("task_id", chunk);
      if (error) throw new Error(error.message);
      return data;
    }, `verify payments ${i}`);
    payments2 = payments2.concat(data || []);
  }
  const pmByTask2 = new Map();
  for (const pm of payments2) pmByTask2.set(pm.task_id, pm);

  // 카운트 검증: keeper별 실제 task_items 개수 = 드라이런 예상치
  let countMatch = 0, countMismatch = 0;
  const countMismatchDetails = [];
  for (const plan of restorePlans) {
    const fresh = freshItemCount.get(plan.keeper.id) || 0;
    if (fresh === plan.expected) countMatch++;
    else {
      countMismatch++;
      if (countMismatchDetails.length < 10) countMismatchDetails.push({ task_no: plan.keeper.task_no, expected: plan.expected, actual: fresh });
    }
  }

  // 3자 일치
  let threeWayOK = 0, threeWayMismatch = 0, pmMissing = 0, pmUnbalanced = 0;
  const threeWayDetails = [];
  for (const plan of restorePlans) {
    const t = tasks2.find(x => x.id === plan.keeper.id);
    const sum = freshSum.get(plan.keeper.id) || 0;
    const pm = pmByTask2.get(plan.keeper.id);
    if (!pm) { pmMissing++; continue; }
    if (!pm.is_balanced) pmUnbalanced++;
    if (Number(t.product_price) === sum && Number(pm.product_price) === sum) threeWayOK++;
    else {
      threeWayMismatch++;
      if (threeWayDetails.length < 10) threeWayDetails.push({ task_no: plan.keeper.task_no, task_pp: t.product_price, sum, pm_pp: pm.product_price, balanced: pm.is_balanced });
    }
  }

  console.log(`\n  [keeper 측 items 개수 ↔ 드라이런 예상]`);
  console.log(`    일치   : ${countMatch} / ${restorePlans.length}`);
  console.log(`    불일치 : ${countMismatch}`);
  if (countMismatchDetails.length > 0) countMismatchDetails.forEach(d => console.log(`      · ${d.task_no} expected=${d.expected} actual=${d.actual}`));

  console.log(`\n  [3자 일치 (task.pp = SUM(subtotal) = payment.pp)]`);
  console.log(`    일치       : ${threeWayOK} / ${restorePlans.length}`);
  console.log(`    불일치     : ${threeWayMismatch}`);
  console.log(`    payment 없음: ${pmMissing}`);
  console.log(`    unbalanced : ${pmUnbalanced}`);
  if (threeWayDetails.length > 0) threeWayDetails.forEach(d => console.log(`      · ${d.task_no} task=${d.task_pp} sum=${d.sum} pm=${d.pm_pp} bal=${d.balanced}`));

  // 결과 저장
  const outFile = path.join(__dirname, `usoln-restore-step3-result-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    mode: "commit",
    generatedAt: new Date().toISOString(),
    elapsedSec: Math.round((Date.now() - t0) / 1000),
    summary: {
      keepers: restorePlans.length,
      itemsInserted: totalInserted,
      insertErrors: insertErrors.length,
      rpcOk,
      rpcErrors: rpcErrors.length,
      countMatch, countMismatch,
      threeWayOK, threeWayMismatch, pmMissing, pmUnbalanced,
    },
    countMismatchDetails,
    threeWayDetails,
    insertErrors,
    rpcErrors,
  }, null, 2), "utf8");
  console.log(`\n결과 파일: ${outFile}`);

  const allOK = (insertErrors.length === 0 && rpcErrors.length === 0 && countMismatch === 0 && threeWayMismatch === 0 && pmMissing === 0 && pmUnbalanced === 0);
  console.log(`\n${"=".repeat(82)}`);
  console.log(allOK ? "✅ 복구 완료 — 전수 정합성 OK." : "⚠️ 잔존 이슈 — 결과 JSON 확인.");
  console.log("=".repeat(82));
  console.log("\n📋 사후 SQL (사장님 SQL Editor):");
  console.log("   ALTER TABLE task_items ENABLE TRIGGER task_items_compute_trg;");
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

// usol_n 주문 통합 — 2단계: 나머지 334 주문 일괄 적용
// 2026-05-25
//
// 입력: scripts/diag-usoln-merge-dryrun-결과.json (ext 목록만 사용 — 룰은 라이브 재계산)
// 한유경(2026051147012351)은 이미 1단계에서 처리 → skip
//
// 룰 (1단계와 동일):
//   keeper = order_type='본작업' task. 여러 개면 created_at 가장 빠른 것.
//   본작업 0이면 created_at 가장 빠른 task (사장님 spec 폴백, 본 케이스 0건이지만 안전망).
//   중복 product_order_id: unit_price>0, subtotal>0, task.created_at asc, item.id asc 순.
//   absorb tasks DELETE → payments CASCADE → compute_payment(keeper).
//
// 모드:
//   node scripts/usoln-merge-step2-rest.cjs            # dry-run (DB 쓰기 0)
//   node scripts/usoln-merge-step2-rest.cjs --commit   # 실제 적용 (주문 단위 순차, 실패 시 중단)

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

const COMMIT = process.argv.includes("--commit");
const HAN_ORDER = "2026051147012351";  // 1단계에서 처리 완료 → skip

// 일시적(transient) 오류만 재시도. 데이터/룰 오류는 즉시 throw.
async function withRetry(fn, label) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e?.message || e || "");
      const isTransient = /timeout|ECONN|fetch failed|network|503|504|gateway|upstream|transaction is aborted/i.test(msg);
      if (attempt >= maxAttempts || !isTransient) throw e;
      const wait = 800 * attempt;
      console.warn(`  ⏳ ${label} transient (attempt ${attempt}/${maxAttempts}) — ${msg} — ${wait}ms 후 재시도`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

(async () => {
  console.log("=".repeat(82));
  console.log(`usol_n 통합 2단계 — ${COMMIT ? "✅ COMMIT (나머지 334 적용)" : "🔍 DRY-RUN"}`);
  console.log("=".repeat(82));

  // 1) usol_n principal_id
  const { data: p } = await sb.from("principals").select("id, code").eq("code", "usol_n").maybeSingle();
  if (!p) { console.error("usol_n principal X"); process.exit(1); }
  const PID = p.id;

  // 2) dryrun 결과 → ext 목록
  const dryFile = path.join(__dirname, "diag-usoln-merge-dryrun-결과.json");
  if (!fs.existsSync(dryFile)) { console.error(`dryrun 결과 없음: ${dryFile}`); process.exit(1); }
  const dry = JSON.parse(fs.readFileSync(dryFile, "utf8"));
  const allExts = dry.plans.map(p => p.external_order_no);
  const targetExts = allExts.filter(x => x !== HAN_ORDER);
  console.log(`dryrun plans: ${allExts.length} / 한유경 skip → 대상: ${targetExts.length}\n`);

  // 3) 주문 단위 처리 함수
  async function processOrder(ext, idx) {
    // 라이브 tasks
    const tasks = await withRetry(async () => {
      const { data, error } = await sb
        .from("tasks")
        .select("id, task_no, customer_name, external_order_no, status, created_at, completed_at")
        .eq("principal_id", PID)
        .eq("external_order_no", ext)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`tasks fetch ${ext}: ${error.message}`);
      return data;
    }, `tasks fetch ${ext}`);
    if (!tasks || tasks.length <= 1) {
      return { ext, skipped: true, reason: `라이브 task 수=${tasks?.length||0} (분리 X)` };
    }

    // 라이브 task_items
    const taskIds = tasks.map(t => t.id);
    const items = await withRetry(async () => {
      const { data, error } = await sb
        .from("task_items")
        .select("id, task_id, order_type, product_order_id, unit_price, subtotal")
        .in("task_id", taskIds);
      if (error) throw new Error(`items fetch ${ext}: ${error.message}`);
      return data;
    }, `items fetch ${ext}`);

    // keeper 결정
    const mainTasks = tasks.filter(t => items.some(it => it.task_id === t.id && it.order_type === '본작업'));
    let keeper;
    if (mainTasks.length === 0) {
      keeper = tasks[0]; // created_at 가장 빠른 task (폴백)
    } else {
      keeper = mainTasks[0]; // created_at asc 정렬돼있음
    }
    const absorbTasks = tasks.filter(t => t.id !== keeper.id);

    // dedup
    const byPoid = new Map();
    const noPoid = [];
    for (const it of items) {
      const k = it.product_order_id || "";
      if (!k) { noPoid.push(it); continue; }
      if (!byPoid.has(k)) byPoid.set(k, []);
      byPoid.get(k).push(it);
    }
    const tCreatedAt = new Map(tasks.map(t => [t.id, t.created_at]));
    function rk(it) {
      return [
        Number(it.unit_price) > 0 ? 0 : 1,
        Number(it.subtotal)   > 0 ? 0 : 1,
        tCreatedAt.get(it.task_id) || '',
        String(it.id),
      ];
    }
    const keepItems = [];
    const dropItems = [];
    for (const it of noPoid) keepItems.push(it);
    for (const [, group] of byPoid.entries()) {
      const sorted = group.slice().sort((a, b) => {
        const ra = rk(a), rb = rk(b);
        for (let i = 0; i < ra.length; i++) { if (ra[i] < rb[i]) return -1; if (ra[i] > rb[i]) return 1; }
        return 0;
      });
      keepItems.push(sorted[0]);
      sorted.slice(1).forEach(d => dropItems.push(d));
    }
    const moveItems = keepItems.filter(it => it.task_id !== keeper.id);

    if (!COMMIT) {
      return {
        ext, idx,
        skipped: false,
        taskCount: tasks.length,
        keeper: keeper.task_no,
        absorb: absorbTasks.map(t => t.task_no),
        moveCount: moveItems.length,
        dropCount: dropItems.length,
      };
    }

    // 적용 — 각 호출에 transient retry
    if (dropItems.length > 0) {
      const ids = dropItems.map(d => d.id);
      await withRetry(async () => {
        const { error } = await sb.from("task_items").delete().in("id", ids);
        if (error) throw new Error(`task_items DELETE ${ext}: ${error.message}`);
      }, `items DELETE ${ext}`);
    }
    if (moveItems.length > 0) {
      const ids = moveItems.map(m => m.id);
      await withRetry(async () => {
        const { error } = await sb.from("task_items").update({ task_id: keeper.id }).in("id", ids);
        if (error) throw new Error(`task_items UPDATE ${ext}: ${error.message}`);
      }, `items UPDATE ${ext}`);
    }
    const absorbIds = absorbTasks.map(t => t.id);
    if (absorbIds.length > 0) {
      await withRetry(async () => {
        const { error } = await sb.from("tasks").delete().in("id", absorbIds);
        if (error) throw new Error(`tasks DELETE ${ext}: ${error.message}`);
      }, `tasks DELETE ${ext}`);
    }
    await withRetry(async () => {
      const { error } = await sb.rpc('compute_payment', { p_task_id: keeper.id });
      if (error) throw new Error(`compute_payment ${ext}/${keeper.task_no}: ${error.message}`);
    }, `compute_payment ${keeper.task_no}`);

    // Supabase rate 측 sleep 50ms — 한 번에 처리 부담 완화
    await new Promise(r => setTimeout(r, 50));

    return {
      ext, idx,
      skipped: false,
      taskCount: tasks.length,
      keeper: keeper.task_no,
      absorb: absorbTasks.map(t => t.task_no),
      moveCount: moveItems.length,
      dropCount: dropItems.length,
      appliedAt: new Date().toISOString(),
    };
  }

  // 4) 주문 단위 순차 실행
  const results = [];
  let totalDeleted = 0, totalMoved = 0, totalDropped = 0, totalRecomputed = 0;
  let skippedCount = 0;
  let errorAt = null;

  const t0 = Date.now();
  for (let i = 0; i < targetExts.length; i++) {
    const ext = targetExts[i];
    try {
      const r = await processOrder(ext, i);
      results.push(r);
      if (r.skipped) { skippedCount++; continue; }
      totalDeleted    += r.absorb.length;
      totalMoved      += r.moveCount;
      totalDropped    += r.dropCount;
      totalRecomputed += 1;
      // 진행 로그 — 25건마다
      if (COMMIT && (i + 1) % 25 === 0) {
        console.log(`  [${i+1}/${targetExts.length}] 진행 — 누적 삭제 ${totalDeleted} / 제거 ${totalDropped} / 재계산 ${totalRecomputed}`);
      }
    } catch (e) {
      errorAt = { idx: i, ext, error: e.message };
      console.error(`  ❌ [${i+1}/${targetExts.length}] 실패 ext=${ext}: ${e.message}`);
      break; // 실패 시 즉시 중단
    }
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  // 5) 결과 저장
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outFile = path.join(__dirname, `usoln-merge-step2-result-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    mode: COMMIT ? "commit" : "dry-run",
    generatedAt: new Date().toISOString(),
    elapsedSec: Number(elapsed),
    targetCount: targetExts.length,
    processedCount: results.length,
    skippedCount,
    totals: { tasksDeleted: totalDeleted, itemsMoved: totalMoved, itemsDropped: totalDropped, keepersRecomputed: totalRecomputed },
    errorAt,
    results,
  }, null, 2), "utf8");

  // 6) 최종 보고
  console.log(`\n${"=".repeat(82)}`);
  console.log(`처리 결과 (${elapsed}s)`);
  console.log("=".repeat(82));
  console.log(`대상 주문         : ${targetExts.length}`);
  console.log(`처리 완료 주문    : ${results.filter(r => !r.skipped).length}`);
  console.log(`skip (분리 X)     : ${skippedCount}`);
  console.log(`삭제 task 총수    : ${totalDeleted}`);
  console.log(`이동 item 총수    : ${totalMoved}`);
  console.log(`제거 item 총수    : ${totalDropped}`);
  console.log(`재계산 keeper 수  : ${totalRecomputed}`);
  console.log(`에러              : ${errorAt ? "1 (중단)" : "0"}`);
  if (errorAt) {
    console.log(`  └─ idx=${errorAt.idx} ext=${errorAt.ext}: ${errorAt.error}`);
  }
  console.log(`\n결과 파일: ${outFile}`);

  // 7) 사후 검증 — 현재 usol_n 분리 주문 잔존
  if (COMMIT && !errorAt) {
    const PAGE = 1000;
    let all = [];
    for (let off = 0; ; off += PAGE) {
      const { data, error } = await sb
        .from("tasks")
        .select("external_order_no")
        .eq("principal_id", PID)
        .range(off, off + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
    }
    const byExt = new Map();
    for (const t of all) {
      if (!t.external_order_no) continue;
      byExt.set(t.external_order_no, (byExt.get(t.external_order_no) || 0) + 1);
    }
    const stillSplit = [];
    for (const [k, v] of byExt.entries()) if (v >= 2) stillSplit.push({ ext: k, count: v });
    console.log(`\n사후 검증 — 현재 usol_n 분리 주문(2+ task) 잔존: ${stillSplit.length}건`);
    if (stillSplit.length > 0) {
      console.log("  잔존 샘플(최대 5):", stillSplit.slice(0, 5));
    }
  }
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

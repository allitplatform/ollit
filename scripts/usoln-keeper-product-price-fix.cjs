// usol_n 통합 keeper 335건 — task.product_price 보정
// 2026-05-25
//
// 사장님 spec:
//   - 보정 범위 = task.product_price 만 (total_amount = GENERATED → 자동)
//   - payment(123/123 정상)는 손대지 않음
//   - UPDATE tasks SET product_price = SUM(subtotal) WHERE id = keeper
//   - 완료 task UPDATE 시 compute_payment trigger 발화해도 무방 (결과 동일)
//   - 검증: 335건 task.product_price = SUM(subtotal) = payment.product_price 3자 일치
//
// 모드:
//   node scripts/usoln-keeper-product-price-fix.cjs            # dry-run
//   node scripts/usoln-keeper-product-price-fix.cjs --commit   # 백업 + UPDATE 일괄

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
  console.log(`usol_n keeper product_price 보정 — ${COMMIT ? "✅ COMMIT" : "🔍 DRY-RUN"}`);
  console.log("=".repeat(82));

  // 1) usol_n principal_id
  const { data: p } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  const PID = p.id;

  // 2) 335 ext 목록 (dryrun JSON)
  const dry = JSON.parse(fs.readFileSync(path.join(__dirname, "diag-usoln-merge-dryrun-결과.json"), "utf8"));
  const allExts = dry.plans.map(p => p.external_order_no);
  console.log(`대상 ext: ${allExts.length}`);

  // 3) keeper tasks fetch (현재 분리 주문 잔존 0이므로 ext당 1 task)
  let keepers = [];
  for (let i = 0; i < allExts.length; i += 100) {
    const chunk = allExts.slice(i, i + 100);
    const data = await withRetry(async () => {
      const { data, error } = await sb
        .from("tasks")
        .select("id, task_no, customer_name, external_order_no, status, product_price, extra_fee, travel_fee, total_amount")
        .eq("principal_id", PID)
        .in("external_order_no", chunk);
      if (error) throw new Error(error.message);
      return data;
    }, `tasks fetch chunk ${i}`);
    keepers = keepers.concat(data || []);
  }
  console.log(`keeper tasks 라이브: ${keepers.length}`);

  // 정합성 — ext당 1 task인지
  const cntByExt = new Map();
  for (const t of keepers) cntByExt.set(t.external_order_no, (cntByExt.get(t.external_order_no) || 0) + 1);
  const dupExts = [...cntByExt.entries()].filter(([, v]) => v > 1);
  const missingExts = allExts.filter(e => !cntByExt.has(e));
  if (dupExts.length > 0) {
    console.error(`❌ ext당 2+ task 잔존: ${dupExts.length} — 통합 미완. ① 다시 돌리세요.`);
    console.error(dupExts.slice(0, 5));
    process.exit(1);
  }
  if (missingExts.length > 0) {
    console.warn(`⚠️ ext에 task 없음(아마 일찍 dryrun): ${missingExts.length}`);
  }

  // 4) SUM(subtotal) per keeper
  const ids = keepers.map(t => t.id);
  let items = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const data = await withRetry(async () => {
      const { data, error } = await sb
        .from("task_items")
        .select("task_id, subtotal")
        .in("task_id", chunk);
      if (error) throw new Error(error.message);
      return data;
    }, `items chunk ${i}`);
    items = items.concat(data || []);
  }
  const sumByTask = new Map();
  for (const it of items) sumByTask.set(it.task_id, (sumByTask.get(it.task_id) || 0) + (Number(it.subtotal) || 0));

  // 5) payments fetch (검증용)
  let payments = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const data = await withRetry(async () => {
      const { data, error } = await sb
        .from("payments")
        .select("task_id, product_price, is_balanced, engineer_amount, principal_amount, owner_amount")
        .in("task_id", chunk);
      if (error) throw new Error(error.message);
      return data;
    }, `payments chunk ${i}`);
    payments = payments.concat(data || []);
  }
  const pmByTask = new Map();
  for (const pm of payments) pmByTask.set(pm.task_id, pm);

  // 6) UPDATE 계획 — task.product_price ≠ SUM(subtotal)인 것만
  const plans = [];
  let alreadyMatch = 0, noItems = 0, noPayment = 0;
  for (const t of keepers) {
    const sum = sumByTask.get(t.id) || 0;
    const cur = Number(t.product_price || 0);
    const pm  = pmByTask.get(t.id);
    if (!pm) noPayment++;
    if (sum === 0) { noItems++; continue; }  // items 없는 keeper는 skip (이상)
    if (cur === sum) alreadyMatch++;
    plans.push({ id: t.id, task_no: t.task_no, customer: t.customer_name, ext: t.external_order_no, status: t.status,
                 cur, sum, diff: sum - cur, pm_price: pm?.product_price ?? null, pm_balanced: pm?.is_balanced ?? null });
  }
  const needUpdate = plans.filter(p => p.cur !== p.sum);
  console.log(`\n계획: 335 중 보정 필요 ${needUpdate.length} / 이미 일치 ${alreadyMatch} / items 없음 skip ${noItems} / payment 없음 ${noPayment}`);

  // 샘플 출력
  console.log(`샘플 (최대 5):`);
  needUpdate.slice(0, 5).forEach(p => {
    console.log(`  · ${p.task_no} (${p.customer}) cur=${p.cur} → sum=${p.sum} (diff=${p.diff>0?'+':''}${p.diff}) | pm.price=${p.pm_price} balanced=${p.pm_balanced}`);
  });

  // ───── DRY-RUN 종료 ─────
  if (!COMMIT) {
    console.log(`\n🔍 DRY-RUN 완료 — DB 쓰기 0건.`);
    console.log("적용: node scripts/usoln-keeper-product-price-fix.cjs --commit");
    return;
  }

  // ───── 백업 ─────
  const backupsDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupFile = path.join(backupsDir, `usoln-keeper-pp-before-${ts}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({
    type: "usoln-keeper-product-price-before",
    ts: new Date().toISOString(),
    note: "335 keeper의 보정 전 product_price/total_amount + payment snapshot — 롤백 시 복구용.",
    count: keepers.length,
    keepers: keepers.map(t => ({
      id: t.id, task_no: t.task_no, customer: t.customer_name, ext: t.external_order_no, status: t.status,
      previous_product_price: t.product_price,
      previous_total_amount:  t.total_amount,
      extra_fee: t.extra_fee, travel_fee: t.travel_fee,
      sum_subtotal: sumByTask.get(t.id) || 0,
      payment: pmByTask.get(t.id) || null,
    })),
  }, null, 2), "utf8");
  console.log(`📦 백업: ${backupFile}`);

  // ───── UPDATE 일괄 (task 단위 순차, transient retry) ─────
  let updated = 0, errors = [];
  const t0 = Date.now();
  for (let i = 0; i < needUpdate.length; i++) {
    const p = needUpdate[i];
    try {
      await withRetry(async () => {
        const { error } = await sb.from("tasks").update({ product_price: p.sum }).eq("id", p.id);
        if (error) throw new Error(`UPDATE ${p.task_no}: ${error.message}`);
      }, `UPDATE ${p.task_no}`);
      updated++;
      if ((i+1) % 50 === 0) console.log(`  [${i+1}/${needUpdate.length}] 누적 UPDATE ${updated}`);
      await new Promise(r => setTimeout(r, 30));
    } catch (e) {
      errors.push({ task_no: p.task_no, ext: p.ext, error: e.message });
      console.error(`  ❌ ${p.task_no}: ${e.message}`);
      // 단건 실패도 계속 (보정은 idempotent)
    }
  }
  console.log(`\nUPDATE 완료: ${updated}/${needUpdate.length} (오류 ${errors.length}, ${((Date.now()-t0)/1000).toFixed(1)}s)`);

  // ───── 검증 — 3자 일치 (잠시 대기 후 — trigger 발화 대기) ─────
  await new Promise(r => setTimeout(r, 1500));
  console.log(`\n${"─".repeat(82)}\n[검증 — 3자 일치 확인]`);

  // re-fetch tasks + payments (sum은 이미 보유)
  let tasks2 = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const data = await withRetry(async () => {
      const { data, error } = await sb.from("tasks").select("id, task_no, product_price, total_amount, extra_fee, travel_fee").in("id", chunk);
      if (error) throw new Error(error.message);
      return data;
    }, `verify tasks chunk ${i}`);
    tasks2 = tasks2.concat(data || []);
  }
  let payments2 = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const data = await withRetry(async () => {
      const { data, error } = await sb.from("payments").select("task_id, product_price, is_balanced, engineer_amount, principal_amount, owner_amount").in("task_id", chunk);
      if (error) throw new Error(error.message);
      return data;
    }, `verify payments chunk ${i}`);
    payments2 = payments2.concat(data || []);
  }
  const pmByTask2 = new Map();
  for (const pm of payments2) pmByTask2.set(pm.task_id, pm);

  let triThreeWayOK = 0, triMismatch = 0, pmMissing = 0, pmUnbalanced = 0;
  const mismatches = [];
  for (const t of tasks2) {
    const sum = sumByTask.get(t.id) || 0;
    const pm  = pmByTask2.get(t.id);
    if (!pm) { pmMissing++; mismatches.push({ task_no: t.task_no, reason: "payment 없음", task_pp: t.product_price, sum }); continue; }
    if (!pm.is_balanced) pmUnbalanced++;
    if (Number(t.product_price) === sum && Number(pm.product_price) === sum) {
      triThreeWayOK++;
    } else {
      triMismatch++;
      if (mismatches.length < 10) {
        mismatches.push({ task_no: t.task_no, task_pp: t.product_price, sum, pm_pp: pm.product_price, pm_balanced: pm.is_balanced });
      }
    }
  }
  console.log(`  3자 일치 (task.pp = SUM(subtotal) = payment.pp) : ${triThreeWayOK} / ${tasks2.length}`);
  console.log(`  불일치                                          : ${triMismatch}`);
  console.log(`  payment 없음                                    : ${pmMissing}`);
  console.log(`  payment.is_balanced=false                       : ${pmUnbalanced}`);
  if (mismatches.length > 0) {
    console.log(`\n  불일치 샘플:`);
    mismatches.slice(0, 10).forEach(m => console.log(`    · ${m.task_no} | task.pp=${m.task_pp} sum=${m.sum} pm.pp=${m.pm_pp ?? '—'} balanced=${m.pm_balanced ?? '—'} ${m.reason || ''}`));
  }

  // 결과 저장
  const resultFile = path.join(__dirname, `usoln-keeper-pp-fix-result-${ts}.json`);
  fs.writeFileSync(resultFile, JSON.stringify({
    mode: COMMIT ? "commit" : "dry-run",
    generatedAt: new Date().toISOString(),
    summary: { keepers: tasks2.length, updated, errors: errors.length, threeWayOK: triThreeWayOK, mismatch: triMismatch, pmMissing, pmUnbalanced },
    mismatches,
    updateErrors: errors,
  }, null, 2), "utf8");
  console.log(`\n결과 파일: ${resultFile}`);

  console.log(`\n${"=".repeat(82)}`);
  console.log(triMismatch === 0 && pmUnbalanced === 0 && pmMissing === 0
    ? "✅ 보정 완료 — 3자 일치 OK, 불일치 0."
    : `⚠️ 보정 후 잔존 이슈: 불일치 ${triMismatch} / pm 누락 ${pmMissing} / unbalanced ${pmUnbalanced}`);
  console.log("=".repeat(82));
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

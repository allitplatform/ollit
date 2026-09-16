// 진단 (읽기 전용) — usol_n task_items 삭제 사고 / 트리거 원인 + 324 keeper 상태
// 2026-05-25
//
// ★ DB 쓰기 0건 ★

const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 1) 라이브 trigger 전수 — information_schema.triggers
  console.log("════ [1] tasks/task_items 라이브 트리거 ════");
  // information_schema.triggers는 PostgREST로 직접 select 불가 — RPC로 우회. RPC 없으면 skip.
  // 대신 우리는 코드 측 정의를 가짐 → 코드 보고서로 갈음.
  console.log("  (information_schema는 PostgREST 직접 access X — Migration 코드 측 정의 + 사장님이 SQL Editor 측 검증)\n");

  // 2) 한유경 + 324 keeper 측 현재 상태 — task_items 0인지, payments 어떻게 됐는지
  console.log("════ [2] 통합 keeper 335 전수 라이브 상태 ════");
  const { data: p } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  const PID = p.id;
  const dry = JSON.parse(fs.readFileSync(path.join(__dirname, "diag-usoln-merge-dryrun-결과.json"), "utf8"));
  const allExts = dry.plans.map(p => p.external_order_no);

  // keeper tasks
  let keepers = [];
  for (let i = 0; i < allExts.length; i += 100) {
    const chunk = allExts.slice(i, i + 100);
    const { data } = await sb
      .from("tasks")
      .select("id, task_no, customer_name, external_order_no, status, product_price, total_amount, category_data, updated_at")
      .eq("principal_id", PID).in("external_order_no", chunk);
    keepers = keepers.concat(data || []);
  }
  const ids = keepers.map(t => t.id);

  // task_items 직접 query
  let items = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data } = await sb.from("task_items").select("task_id, subtotal, order_type").in("task_id", chunk);
    items = items.concat(data || []);
  }
  const itemsByTask = new Map();
  const sumByTask = new Map();
  for (const it of items) {
    if (!itemsByTask.has(it.task_id)) itemsByTask.set(it.task_id, []);
    itemsByTask.get(it.task_id).push(it);
    sumByTask.set(it.task_id, (sumByTask.get(it.task_id) || 0) + (Number(it.subtotal) || 0));
  }

  // payments
  let payments = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data } = await sb.from("payments").select("task_id, product_price, engineer_amount, principal_amount, owner_amount, is_balanced, status, computed_at").in("task_id", chunk);
    payments = payments.concat(data || []);
  }
  const pmByTask = new Map();
  for (const pm of payments) pmByTask.set(pm.task_id, pm);

  // 분류
  let itemsZero = 0, itemsAlive = 0;
  let pmAlive = 0, pmMissing = 0, pmUnbalanced = 0, pmEqualsItemsSum = 0;
  let catEmpty = 0, catHasWorkItems = 0;
  const samples = { itemsZero: [], itemsAlive: [], pmBalancedButItemsZero: [] };
  for (const t of keepers) {
    const ic = (itemsByTask.get(t.id) || []).length;
    const sum = sumByTask.get(t.id) || 0;
    const pm = pmByTask.get(t.id);
    const cat = t.category_data || {};
    const catKeys = Object.keys(cat);
    const hasCatWorkItems = Array.isArray(cat.workItems) && cat.workItems.length > 0;
    if (catKeys.length === 0) catEmpty++;
    if (hasCatWorkItems) catHasWorkItems++;
    if (ic === 0) {
      itemsZero++;
      if (samples.itemsZero.length < 3) samples.itemsZero.push({ task_no: t.task_no, customer: t.customer_name, status: t.status, task_pp: t.product_price, cat_keys: catKeys, pm: pm ? { pp: pm.product_price, eng: pm.engineer_amount, prin: pm.principal_amount, own: pm.owner_amount, bal: pm.is_balanced } : null });
    } else {
      itemsAlive++;
      if (samples.itemsAlive.length < 3) samples.itemsAlive.push({ task_no: t.task_no, customer: t.customer_name, status: t.status, items_count: ic, sum, task_pp: t.product_price, pm: pm ? { pp: pm.product_price, eng: pm.engineer_amount, prin: pm.principal_amount, own: pm.owner_amount, bal: pm.is_balanced } : null });
    }
    if (!pm) { pmMissing++; continue; }
    pmAlive++;
    if (!pm.is_balanced) pmUnbalanced++;
    if (ic === 0 && pm.is_balanced && samples.pmBalancedButItemsZero.length < 3) {
      samples.pmBalancedButItemsZero.push({ task_no: t.task_no, customer: t.customer_name, pm_pp: pm.product_price, pm_sum: pm.engineer_amount + pm.principal_amount + pm.owner_amount, computed_at: pm.computed_at });
    }
    if (Number(pm.product_price) === sum) pmEqualsItemsSum++;
  }

  console.log(`총 keeper: ${keepers.length}`);
  console.log(`  task_items 0건                              : ${itemsZero}`);
  console.log(`  task_items 살아있음                         : ${itemsAlive}`);
  console.log(`  payments 살아있음                           : ${pmAlive}`);
  console.log(`  payments 누락                               : ${pmMissing}`);
  console.log(`  payments is_balanced=false                  : ${pmUnbalanced}`);
  console.log(`  payment.product_price = 라이브 SUM(subtotal): ${pmEqualsItemsSum}  ← 0일 거임`);
  console.log(`  category_data 빈 객체                       : ${catEmpty}`);
  console.log(`  category_data.workItems 존재                : ${catHasWorkItems}`);

  console.log(`\n[items 0 + payment 살아있음 (옛값) 샘플]`);
  samples.pmBalancedButItemsZero.forEach(s => console.log(`  · ${s.task_no} (${s.customer}) pm.pp=${s.pm_pp} pm.sum=${s.pm_sum} computed_at=${s.computed_at}`));

  console.log(`\n[items 살아있는 11건 샘플 (UPDATE 안 한 keeper)]`);
  samples.itemsAlive.forEach(s => console.log(`  · ${s.task_no} (${s.customer}) items=${s.items_count} sum=${s.sum} task.pp=${s.task_pp} pm.pp=${s.pm?.pp} bal=${s.pm?.bal}`));

  // 3) ②번 백업으로 복구 가능성 — 백업에 task_items 보존?
  console.log(`\n════ [3] 복구 소스 백업 검증 ════`);
  const backupsDir = path.join(__dirname, "..", "backups");
  const candidateFiles = fs.readdirSync(backupsDir).filter(f => f.startsWith("usoln-merge-before-"));
  console.log(`  step1 백업 후보: ${candidateFiles.join(", ")}`);
  for (const f of candidateFiles) {
    const bak = JSON.parse(fs.readFileSync(path.join(backupsDir, f), "utf8"));
    console.log(`  · ${f}: tasks ${(bak.tasks || []).length} / task_items ${(bak.task_items || []).length} / payments ${(bak.payments || []).length}`);
  }

  // 결과 JSON
  fs.writeFileSync(path.join(__dirname, "diag-usoln-trigger-incident-결과.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    coverage: { keepers: keepers.length, itemsZero, itemsAlive, pmAlive, pmMissing, pmUnbalanced, pmEqualsItemsSum, catEmpty, catHasWorkItems },
    samples,
  }, null, 2), "utf8");
  console.log(`\n결과 파일: scripts/diag-usoln-trigger-incident-결과.json`);
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

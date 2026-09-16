// 진단 (읽기 전용) — 유솔N 통합 keeper 표시 버그
// 2026-05-25
//
// 가설: PrincipalListTab(ViewAll)이 사용하는 loadTasksForRole/PAYMENT_SELECT는
//   row.task_items inline JOIN + category_data 둘 다 받음. rowToTask는
//   sortedTaskItems.length>0이면 task_items 기반 workItems 생성, 0이면
//   cat.workItems fallback. 통합 keeper만 ⚡(—) → task_items JOIN이 0건 또는
//   category_data가 stale.
//
// 검증:
//   A) 통합 keeper 5건 (한유경 + step2 결과 4건) — PAYMENT_SELECT 그대로 fetch →
//      row.task_items 길이, category_data 내용, rowToTask 시뮬레이션 결과
//   B) native task (분리 X) 5건 — 같은 방식. native는 정상 표시이므로 비교 기준
//   C) 영향 범위 — 통합 keeper 335건 전수에 동일 패턴인지

const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// PrincipalListTab(loadTasksForRole)이 쓰는 SELECT — tasksDb.js PAYMENT_SELECT 동일
const PAYMENT_SELECT = `
  *,
  payment:payments(calc_method, policy_key, engineer_amount, principal_amount, owner_amount, is_balanced, status, computed_at, track),
  task_items (
    id, qty, unit_price, subtotal, order_type, product_order_id,
    work_types ( id, name, service_types ( id, code ) ),
    appliance_types ( id, name )
  )
`;

(async () => {
  const { data: p } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  const PID = p.id;

  // 통합 keeper 샘플 5 = 한유경(YS-260511-019) + 한유경 외 통합 keeper 4
  const step2 = JSON.parse(fs.readFileSync(path.join(__dirname, "usoln-merge-step2-result-2026-05-24T21-41-47.json"), "utf8"));
  const mergedKeeperNos = step2.results.filter(r => !r.skipped && r.keeper).slice(0, 4).map(r => r.keeper);
  mergedKeeperNos.unshift("YS-260511-019"); // 한유경

  // native task 샘플 5 — 분리 X였던 task (dryrun ext 목록에 없는 ext의 task)
  const dry = JSON.parse(fs.readFileSync(path.join(__dirname, "diag-usoln-merge-dryrun-결과.json"), "utf8"));
  const splitExts = new Set(dry.plans.map(p => p.external_order_no));
  const { data: allTasks } = await sb.from("tasks").select("task_no, external_order_no").eq("principal_id", PID).limit(200);
  const nativeCandidates = (allTasks || []).filter(t => t.external_order_no && !splitExts.has(t.external_order_no));
  const nativeNos = nativeCandidates.slice(0, 5).map(t => t.task_no);

  const targetNos = [...mergedKeeperNos, ...nativeNos];
  console.log(`샘플: 통합 keeper ${mergedKeeperNos.length} + native ${nativeNos.length}\n`);

  // 같은 PAYMENT_SELECT로 fetch
  const { data: rows, error } = await sb.from("tasks").select(PAYMENT_SELECT).eq("principal_id", PID).in("task_no", targetNos);
  if (error) { console.error(error); process.exit(1); }

  // 분석
  const result = [];
  for (const r of rows) {
    const cat = r.category_data || {};
    const tiCount = Array.isArray(r.task_items) ? r.task_items.length : 0;
    const tiSample = (r.task_items || []).slice(0, 2).map(it => ({
      order_type: it.order_type,
      appliance: it.appliance_types?.name || null,
      work_type: it.work_types?.name || null,
      qty: it.qty,
    }));
    const isMerged = mergedKeeperNos.includes(r.task_no);

    // rowToTask 시뮬레이션 (핵심 — sortedTaskItems 우선 → workItems)
    const sortedTi = (r.task_items || []).slice().sort((a, b) => (a.order_type === '본작업' ? 0 : 1) - (b.order_type === '본작업' ? 0 : 1));
    const simWorkItems = sortedTi.length > 0
      ? sortedTi.map(it => ({
          appliance: it.appliance_types?.name,
          workType:  it.work_types?.name,
          orderType: it.order_type,
          qty: it.qty,
        }))
      : (Array.isArray(cat.workItems) ? cat.workItems : []);
    const simAppliance = cat.appliance || sortedTi[0]?.appliance_types?.name || "";
    const simWorkType  = cat.workType  || sortedTi[0]?.work_types?.name || "";

    result.push({
      task_no: r.task_no,
      kind: isMerged ? "통합 keeper" : "native",
      customer: r.customer_name,
      ext: r.external_order_no,
      status: r.status,
      // 1. row.task_items (PAYMENT_SELECT inline join)
      task_items_count: tiCount,
      task_items_sample: tiSample,
      // 2. row.category_data
      category_data_keys: Object.keys(cat),
      cat_workItems_count: Array.isArray(cat.workItems) ? cat.workItems.length : 0,
      cat_appliance: cat.appliance || null,
      cat_workType: cat.workType || null,
      // 3. rowToTask 시뮬 — UI가 받을 값
      sim_workItems_count: simWorkItems.length,
      sim_appliance: simAppliance,
      sim_workType: simWorkType,
      sim_main_item_found: simWorkItems.some(w => w.orderType === '본작업'),
    });
  }

  console.log("════ 샘플 비교 ════\n");
  for (const r of result) {
    console.log(`[${r.kind}] ${r.task_no} (${r.customer}) ext=${r.ext} status=${r.status}`);
    console.log(`  row.task_items: ${r.task_items_count}건 → ${JSON.stringify(r.task_items_sample)}`);
    console.log(`  row.category_data keys: ${JSON.stringify(r.category_data_keys)}`);
    console.log(`  cat.workItems=${r.cat_workItems_count} cat.appliance="${r.cat_appliance}" cat.workType="${r.cat_workType}"`);
    console.log(`  → 시뮬 workItems=${r.sim_workItems_count} appliance="${r.sim_appliance}" workType="${r.sim_workType}" main_item=${r.sim_main_item_found}`);
    console.log("");
  }

  // 영향 범위 — 335 keeper 전수 task_items 카운트
  console.log("════ 영향 범위 — 335 keeper 전수 ════\n");
  const allExts = dry.plans.map(p => p.external_order_no);
  let keepers = [];
  for (let i = 0; i < allExts.length; i += 100) {
    const chunk = allExts.slice(i, i + 100);
    const { data } = await sb.from("tasks").select(PAYMENT_SELECT).eq("principal_id", PID).in("external_order_no", chunk);
    keepers = keepers.concat(data || []);
  }
  let tiZero = 0, catWorkItemsZero = 0, both = 0, mainItemMissingInUI = 0;
  for (const r of keepers) {
    const cat = r.category_data || {};
    const ti = Array.isArray(r.task_items) ? r.task_items.length : 0;
    const cwi = Array.isArray(cat.workItems) ? cat.workItems.length : 0;
    if (ti === 0) tiZero++;
    if (cwi === 0) catWorkItemsZero++;
    if (ti === 0 && cwi === 0) both++;
    // UI 본작업 잡힘 — 시뮬
    const sortedTi = (r.task_items || []).slice().sort((a, b) => (a.order_type === '본작업' ? 0 : 1) - (b.order_type === '본작업' ? 0 : 1));
    const simWorkItems = sortedTi.length > 0
      ? sortedTi.map(it => ({ orderType: it.order_type, appliance: it.appliance_types?.name }))
      : (Array.isArray(cat.workItems) ? cat.workItems : []);
    if (!simWorkItems.some(w => (w.orderType || w.order_type) === '본작업')) mainItemMissingInUI++;
  }
  console.log(`총 keeper: ${keepers.length}`);
  console.log(`  task_items 0건 (JOIN miss)              : ${tiZero}`);
  console.log(`  category_data.workItems 0건             : ${catWorkItemsZero}`);
  console.log(`  둘 다 0 (UI 측 workItems 빈 배열)        : ${both}`);
  console.log(`  시뮬 — 본작업 item UI에 안 잡힘 (⚡표시) : ${mainItemMissingInUI}`);

  // 저장
  fs.writeFileSync(path.join(__dirname, "diag-usoln-keeper-display-결과.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), samples: result,
      coverage: { total: keepers.length, tiZero, catWorkItemsZero, both, mainItemMissingInUI } }, null, 2), "utf8");
  console.log(`\n결과 파일: scripts/diag-usoln-keeper-display-결과.json`);
})().catch(e => { console.error(e); process.exit(1); });

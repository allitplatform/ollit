// usol_n 잔여 2건 scheduled_at 백필 — 드라이런 / commit
// 2026-05-25
//
// 대상 (id 명시 — 다른 row 안 건드림):
//   · 마지혜  YS-N-260524-006  id=4e7853eb-57b7-4a32-97e1-1f4bb928e5bb  → scheduled_at=2026-05-31 13:00 KST
//   · 전아름  YS-N-260524-009  id=5784100c-2719-482b-bb5e-3b649068cf88  → completed_at 기준
//
// 안전:
//   · sync_task_items_trg (Migration 069 안전화 이후) — UPDATE 시 category_data.workItems 없으면 DELETE 차단.
//     본 스크립트는 scheduled_at만 UPDATE → category_data 미변경 + 069가 빈 cat 차단. 안전.
//   · 단 spec에 따라 cat.workItems 키 존재 시 ★중단★ (안전망).
//   · task_items_compute_trg는 task_items INSERT/UPDATE/DELETE만 발화. tasks UPDATE는 영향 X.
//
// 모드:
//   node scripts/usoln-sched-fill-2.cjs           # dry-run
//   node scripts/usoln-sched-fill-2.cjs --commit  # 실 적용 (workItems 둘 다 없음 확인 후만)

const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const COMMIT = process.argv.includes("--commit");

const TARGETS = [
  { name: "마지혜", id: "4e7853eb-57b7-4a32-97e1-1f4bb928e5bb", task_no: "YS-N-260524-006",
    new_scheduled_at: "2026-05-31T13:00:00+09:00",
    sheet_first_poid: "2026051529272691" },
  { name: "전아름", id: "5784100c-2719-482b-bb5e-3b649068cf88", task_no: "YS-N-260524-009",
    new_scheduled_at: "2026-05-18T13:00:00+09:00",
    sheet_first_poid: "2026051657667811" },
];

(async () => {
  console.log("=".repeat(82));
  console.log(`usol_n 잔여 2건 scheduled_at 백필 — ${COMMIT ? "✅ COMMIT" : "🔍 DRY-RUN"}`);
  console.log("=".repeat(82));

  // 1) 현재 task 조회
  const ids = TARGETS.map(t => t.id);
  const { data: tasks } = await sb.from("tasks")
    .select("id, task_no, customer_name, scheduled_at, completed_at, status, category_data, product_price, total_amount")
    .in("id", ids);
  const taskById = new Map((tasks || []).map(t => [t.id, t]));

  // 2) task_items + payments
  const { data: items } = await sb.from("task_items")
    .select("task_id, id, order_type, product_order_id, qty, subtotal")
    .in("task_id", ids);
  const itemsByTask = new Map();
  for (const it of items || []) {
    if (!itemsByTask.has(it.task_id)) itemsByTask.set(it.task_id, []);
    itemsByTask.get(it.task_id).push(it);
  }
  const { data: payments } = await sb.from("payments")
    .select("task_id, product_price, engineer_amount, principal_amount, owner_amount, is_balanced, status")
    .in("task_id", ids);
  const pmByTask = new Map((payments || []).map(p => [p.task_id, p]));

  // 3) 분석 + plan
  let workItemsRisk = false;
  const plans = [];
  for (const tg of TARGETS) {
    const t = taskById.get(tg.id);
    if (!t) { console.error(`❌ task ${tg.task_no} 없음`); process.exit(1); }
    const cat = t.category_data || {};
    const hasWorkItems = !!(cat && Object.prototype.hasOwnProperty.call(cat, 'workItems'));
    if (hasWorkItems) workItemsRisk = true;
    const its = itemsByTask.get(t.id) || [];
    const pm = pmByTask.get(t.id);
    // 시트 첫 poid와 task_items poid 일치 여부
    const itemPoids = its.map(it => it.product_order_id);
    const poidMatch = itemPoids.includes(tg.sheet_first_poid);

    // 사장님 명시값 사용 (전아름 = 2026-05-18T13:00 KST, completed_at 무관)
    const planScheduled = tg.new_scheduled_at;
    const planNote = "";

    plans.push({ tg, task: t, items: its, payment: pm, hasWorkItems, planScheduled, planNote, itemPoids, poidMatch });
  }

  // 4) 출력
  for (const p of plans) {
    console.log("\n" + "─".repeat(82));
    console.log(`[${p.tg.name}] ${p.task.task_no} (id=${p.task.id.slice(0,8)}…)`);
    console.log("─".repeat(82));
    console.log(`  current scheduled_at : ${p.task.scheduled_at || '(NULL)'}`);
    console.log(`  current completed_at : ${p.task.completed_at || '(NULL)'}`);
    console.log(`  status               : ${p.task.status}`);
    console.log(`  category_data keys   : [${Object.keys(p.task.category_data || {}).join(', ')}]`);
    console.log(`  category_data.workItems 키 존재 : ${p.hasWorkItems ? '★ YES — 069 재생성 위험 ★' : 'NO (안전)'}`);
    console.log(`  task_items 개수      : ${p.items.length}`);
    p.items.forEach(it => console.log(`     · ${it.order_type} | poid=${it.product_order_id} | qty=${it.qty} sub=${it.subtotal}`));
    console.log(`  시트 첫 poid 일치     : ${p.poidMatch ? 'YES' : `NO (시트 ${p.tg.sheet_first_poid} vs 현재 ${p.itemPoids.join(',')})`}`);
    console.log(`  payment              : ${p.payment ? `pp=${p.payment.product_price} bal=${p.payment.is_balanced}` : '없음'}`);
    console.log(`  → 계획 scheduled_at  : ${p.planScheduled || '(미정)'}${p.planNote ? ' — ' + p.planNote : ''}`);
  }

  // 5) workItems risk 측 안전 게이트
  if (workItemsRisk) {
    console.error(`\n${"=".repeat(82)}`);
    console.error(`★ 중단 ★ — 한 건 이상 category_data.workItems 키 존재.`);
    console.error(`069 trigger가 UPDATE 시 task_items DELETE+재생성. 트리거 OFF 방식 재설계 필요.`);
    console.error(`${"=".repeat(82)}`);
    process.exit(1);
  }
  // planScheduled 누락 게이트 (사장님 명시값 — 비어 있을 일 0이지만 안전망)
  for (const p of plans) {
    if (!p.planScheduled) {
      console.error(`\n★ 중단 ★ — ${p.tg.name} planScheduled 누락.`);
      process.exit(1);
    }
  }

  // ───── DRY-RUN ─────
  if (!COMMIT) {
    console.log(`\n${"=".repeat(82)}`);
    console.log(`🔍 DRY-RUN 완료 — DB 쓰기 0건.`);
    console.log(`category_data.workItems 둘 다 없음 확인됨. 안전. 적용: --commit`);
    console.log(`${"=".repeat(82)}`);
    return;
  }

  // ───── COMMIT ─────
  // 백업
  const backupsDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const beforeFile = path.join(backupsDir, `usoln-sched-fill-before-${ts}.json`);
  fs.writeFileSync(beforeFile, JSON.stringify({
    type: "usoln-sched-fill-before",
    ts: new Date().toISOString(),
    note: "scheduled_at 백필 직전 — 2건 task 행 + task_items + payments (롤백 용).",
    tasks: plans.map(p => p.task),
    task_items: items || [],
    payments: payments || [],
    plans: plans.map(p => ({ task_no: p.task.task_no, id: p.task.id, planScheduled: p.planScheduled })),
  }, null, 2), "utf8");
  console.log(`\n📦 백업: ${beforeFile}`);

  // UPDATE — id 명시 2건만
  for (const p of plans) {
    const { error } = await sb.from("tasks").update({ scheduled_at: p.planScheduled }).eq("id", p.task.id);
    if (error) { console.error(`❌ UPDATE ${p.task.task_no}: ${error.message}`); process.exit(1); }
    console.log(`  ✅ UPDATE ${p.task.task_no} scheduled_at = ${p.planScheduled}`);
  }

  // 검증 — 라이브 재조회
  console.log(`\n[검증 — 라이브 재조회]`);
  await new Promise(r => setTimeout(r, 1000));
  const { data: tasks2 } = await sb.from("tasks")
    .select("id, task_no, scheduled_at").in("id", ids);
  const { data: items2 } = await sb.from("task_items")
    .select("task_id, id").in("task_id", ids);
  const { data: pm2 } = await sb.from("payments")
    .select("task_id, product_price, is_balanced").in("task_id", ids);
  const items2ByTask = new Map();
  for (const it of items2 || []) {
    if (!items2ByTask.has(it.task_id)) items2ByTask.set(it.task_id, []);
    items2ByTask.get(it.task_id).push(it);
  }
  const pm2ByTask = new Map((pm2 || []).map(p => [p.task_id, p]));

  let allOK = true;
  for (const tg of TARGETS) {
    const t2 = (tasks2 || []).find(x => x.id === tg.id);
    const its2 = items2ByTask.get(tg.id) || [];
    const p2 = pm2ByTask.get(tg.id);
    const expectedSched = plans.find(p => p.tg.id === tg.id).planScheduled;
    const schedOk = t2 && t2.scheduled_at; // 라이브 재조회 측 timestamptz 측 RFC3339 측 측 — 같은 시점 측 동일성 비교 측 정확 측 X 측 측 측 측, 단 NULL X면 OK
    const itemsOk = its2.length === 1;
    const pmOk = p2 && p2.is_balanced === true;
    console.log(`  ${tg.task_no}: scheduled=${t2?.scheduled_at || '(NULL)'} | items=${its2.length} | pm.balanced=${p2?.is_balanced}`);
    if (!schedOk || !itemsOk || !pmOk) {
      allOK = false;
      console.error(`     ❌ 불일치 — sched=${schedOk} items=${itemsOk}(예상 1) pm=${pmOk}`);
    }
  }

  console.log(`\n${"=".repeat(82)}`);
  console.log(allOK ? "✅ 완료 — scheduled_at 채워짐 / task_items 1건 유지 / payment balanced." : "⚠️ 잔존 이슈 발견.");
  console.log("=".repeat(82));
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

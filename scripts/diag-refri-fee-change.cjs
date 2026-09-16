// usol_n 냉매점검 수수료 35/15/50 변경 — dry-run 시뮬레이션 + 백업
// 2026-05-24
//
// Migration 066 (db/migrations/066_usol_n_addon_refri_35_15_50.sql) 적용 전 시뮬레이션:
//   현재 (usol_n_추가선택, 85/15/0) vs 신규 (usol_n_추가선택_냉매, 35/15/50)
//
// 영향: usol_n + order_type='추가선택' + service='refrigerant' task_items (~105건)
// 측 영향 task의 payments 변경 전 백업 → scripts/backup-refri-fee-{ts}.json
//
// 실행: node scripts/diag-refri-fee-change.cjs

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

const USOL_N = "22222222-2222-2222-2222-222222222006";

(async () => {
  console.log("=".repeat(80));
  console.log("usol_n 냉매점검 수수료 변경 — dry-run 시뮬레이션");
  console.log("=".repeat(80));

  // usol_n tasks 측 catch
  const { data: tasks } = await sb.from("tasks").select("id, task_no, customer_name, status").eq("principal_id", USOL_N);
  const taskIds = tasks.map(t => t.id);
  const tm = new Map(tasks.map(t => [t.id, t]));

  // 측 task_items + service_type 정보
  const items = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    const ids = taskIds.slice(i, i + 200);
    const { data } = await sb.from("task_items").select("id, task_id, order_type, qty, unit_price, subtotal, net_amount, work_types(code, service_types(code)), appliance_types(code)").in("task_id", ids);
    if (data) items.push(...data);
  }

  // 영향 task_items — 추가선택 + service='refrigerant'
  const targets = items.filter(it => {
    const svc = it.work_types?.service_types?.code;
    return it.order_type === "추가선택" && svc === "refrigerant";
  });

  console.log(`\n[1] 영향 task_items: ${targets.length}건 (= 측 catch 영향 task ${new Set(targets.map(t => t.task_id)).size}개)`);

  // 측 task 측 catch payments
  const affectedTaskIds = [...new Set(targets.map(t => t.task_id))];
  const payMap = new Map();
  for (let i = 0; i < affectedTaskIds.length; i += 200) {
    const ids = affectedTaskIds.slice(i, i + 200);
    const { data } = await sb.from("payments").select("*").in("task_id", ids).order("computed_at", { ascending: false });
    for (const p of (data || [])) {
      if (!payMap.has(p.task_id)) payMap.set(p.task_id, p);
    }
  }

  // 시뮬레이션 — task별 측 catch 측 catch:
  //   delta_engineer = SUM(refri item subtotal) × (0.35 - 0.85) = SUM × (-0.50)
  //   delta_principal = 0 (15% 변동 없음)
  //   delta_owner  = SUM(refri item subtotal) × (+0.50)
  // task 단위 합산.
  const taskDeltas = new Map();
  for (const it of targets) {
    const sub = Number(it.subtotal) || 0;
    if (!taskDeltas.has(it.task_id)) taskDeltas.set(it.task_id, { sumRefriSub: 0, items: [] });
    const d = taskDeltas.get(it.task_id);
    d.sumRefriSub += sub;
    d.items.push(it);
  }

  // 측 task별 측 catch / 합계
  let sumEngBefore = 0, sumPrinBefore = 0, sumOwnerBefore = 0;
  let sumEngAfter  = 0, sumPrinAfter  = 0, sumOwnerAfter  = 0;
  const sampleRows = [];
  for (const tid of affectedTaskIds) {
    const p = payMap.get(tid);
    if (!p) continue;
    const d = taskDeltas.get(tid);
    const sub = d?.sumRefriSub || 0;
    // 현재 refri item engineer = sub × 0.85, principal = sub × 0.15, owner += 0 (= refri 측 catch 0)
    // 측 catch refri item engineer = round(sub × 0.35), principal = round(sub × 0.15), owner += sub × 0.50
    const curEng = Math.floor(sub * 0.85);
    const curPrin = Math.floor(sub * 0.15);
    const newEng = Math.floor(sub * 0.35);
    const newPrin = Math.floor(sub * 0.15);
    const newOwnerPart = sub - newEng - newPrin;  // 50% + round 측 catch

    const taskEngAfter   = p.engineer_amount  - curEng  + newEng;
    const taskPrinAfter  = p.principal_amount - curPrin + newPrin;
    const taskOwnerAfter = p.owner_amount + newOwnerPart;  // 측 catch 측 catch X (owner 측 catch 추가)

    sumEngBefore   += p.engineer_amount;
    sumPrinBefore  += p.principal_amount;
    sumOwnerBefore += p.owner_amount;
    sumEngAfter   += taskEngAfter;
    sumPrinAfter  += taskPrinAfter;
    sumOwnerAfter += taskOwnerAfter;

    if (sampleRows.length < 10) {
      const t = tm.get(tid);
      sampleRows.push({
        task_no: t?.task_no,
        customer: t?.customer_name,
        refri_sub: sub,
        before: { e: p.engineer_amount, p: p.principal_amount, o: p.owner_amount },
        after:  { e: taskEngAfter, p: taskPrinAfter, o: taskOwnerAfter },
      });
    }
  }

  console.log(`\n[2] 샘플 10건 비교`);
  console.log(`${"task_no".padEnd(18)} ${"고객".padEnd(10)} ${"refri_sub".padStart(10)} | ${"eng 측".padStart(8)} ${"eng 측".padStart(8)} | ${"prin 측".padStart(7)} ${"prin 측".padStart(7)} | ${"own 측".padStart(8)} ${"own 측".padStart(8)}`);
  for (const s of sampleRows) {
    console.log(
      `${s.task_no.padEnd(18)} ${(s.customer||'').padEnd(10)} ${String(s.refri_sub).padStart(10)} | ` +
      `${String(s.before.e).padStart(8)} ${String(s.after.e).padStart(8)} | ` +
      `${String(s.before.p).padStart(7)} ${String(s.after.p).padStart(7)} | ` +
      `${String(s.before.o).padStart(8)} ${String(s.after.o).padStart(8)}`
    );
  }

  console.log(`\n[3] 105 task 합계 (현재 → 변경 후)`);
  console.log(`  engineer   : ₩${sumEngBefore.toLocaleString()} → ₩${sumEngAfter.toLocaleString()}  (${(sumEngAfter - sumEngBefore).toLocaleString()})`);
  console.log(`  principal  : ₩${sumPrinBefore.toLocaleString()} → ₩${sumPrinAfter.toLocaleString()}  (${(sumPrinAfter - sumPrinBefore).toLocaleString()})`);
  console.log(`  owner      : ₩${sumOwnerBefore.toLocaleString()} → ₩${sumOwnerAfter.toLocaleString()}  (+₩${(sumOwnerAfter - sumOwnerBefore).toLocaleString()})`);

  // 백업
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupFile = path.join(__dirname, `backup-refri-fee-${ts}.json`);
  const backup = {
    type: "usol_n_addon_refri_fee_change",
    ts: new Date().toISOString(),
    spec: "calc_method: usol_n_추가선택 (85/15/0) → usol_n_추가선택_냉매 (35/15/50)",
    affected_task_items: targets.length,
    affected_tasks: affectedTaskIds.length,
    payments_before: [...payMap.values()],
    refri_items_before: targets.map(it => ({
      id: it.id,
      task_id: it.task_id,
      task_no: tm.get(it.task_id)?.task_no,
      order_type: it.order_type,
      qty: it.qty,
      unit_price: it.unit_price,
      subtotal: it.subtotal,
      net_amount: it.net_amount,
    })),
  };
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), "utf8");
  console.log(`\n📦 백업: ${backupFile}`);
  console.log(`     · payments_before ${payMap.size}건`);
  console.log(`     · refri_items_before ${targets.length}건`);

  console.log(`\n${"=".repeat(80)}\n시뮬레이션 완료 (DB 측 catch 측 X).`);
})().catch(e => console.log("FATAL:", e.message, e.stack));

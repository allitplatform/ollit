// usol_n qty>1 task_items unit_price 정정 — dry-run + commit
// 2026-05-24
//
// 진단 [증상1]:
//   현재 DB의 unit_price = 시트 정산예정금액 (주문 1건 전체 금액)
//   subtotal = qty × unit_price = qty배 부풀림 (GENERATED 컬럼)
//   compute_payment v11 — SUM(subtotal) 측 catch owner_amount 측 catch 측 catch
//
// 수정:
//   unit_price = ROUND(시트 정산예정금액 / qty)
//   → subtotal = qty × 측 catch unit_price = 시트값 ± round 측 catch (1~3원)
//   → task_items_compute_trg 측 catch payments 자동 재계산 (Migration 028)
//
// 대상: usol_n principal + qty>1 + 시트 측 catch 측 catch + DB subtotal ≠ 시트 정산예정금액
//
// 실행:
//   node scripts/fix-usoln-unitprice-qty.cjs           # dry-run (기본)
//   node scripts/fix-usoln-unitprice-qty.cjs --commit  # 실제 UPDATE

const fs = require("fs"), path = require("path");
const XLSX = require("xlsx");

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
const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const MODE = COMMIT ? "✅ COMMIT (실제 쓰기)" : "🔍 DRY-RUN (시뮬레이션만)";

const norm = (v) => v == null ? "" : String(v).trim();
const toInt = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[,\s₩]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
};

(async () => {
  console.log("=".repeat(80));
  console.log(`usol_n qty>1 task_items unit_price 정정 — ${MODE}`);
  console.log("=".repeat(80));

  // [1] 시트 로드
  const wb = XLSX.readFile(path.join(__dirname, "유솔홈케어_운영.xlsx"), { cellDates: false });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false });
  const sheetByOrd = new Map();
  for (const r of rows) {
    const k = norm(r["상품주문번호"]);
    if (k) sheetByOrd.set(k, r);
  }

  // [2] usol_n tasks + task_items
  const tasksById = new Map();
  let from = 0;
  while (true) {
    const { data } = await sb.from("tasks").select("id, task_no, customer_name, status").eq("principal_id", USOL_N).range(from, from + 999);
    if (!data?.length) break;
    for (const t of data) tasksById.set(t.id, t);
    if (data.length < 1000) break;
    from += 1000;
  }
  const taskIds = [...tasksById.keys()];

  const items = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    const ids = taskIds.slice(i, i + 200);
    const { data } = await sb.from("task_items").select("id, task_id, product_order_id, order_type, qty, unit_price, subtotal, net_amount").in("task_id", ids);
    if (data) items.push(...data);
  }

  // [3] 대상 선별 — qty>1 + 시트 측 catch + DB subtotal ≠ 시트 정산예정금액
  const candidates = [];
  let skippedNoSheet = 0;
  let skippedAlreadyMatch = 0;
  for (const it of items) {
    if (Number(it.qty) <= 1) continue;
    const ord = norm(it.product_order_id);
    if (!ord) { skippedNoSheet++; continue; }
    const sR = sheetByOrd.get(ord);
    if (!sR) { skippedNoSheet++; continue; }
    const sheetSettle = toInt(sR["정산예정금액"]);
    if (sheetSettle == null) { skippedNoSheet++; continue; }
    const dbSub = Number(it.subtotal) || 0;
    if (dbSub === sheetSettle) { skippedAlreadyMatch++; continue; }
    const qty = Number(it.qty);
    const newUnit = Math.round(sheetSettle / qty);
    const newSubtotal = qty * newUnit;
    candidates.push({
      item: it,
      task: tasksById.get(it.task_id),
      ord,
      qty,
      old_unit: it.unit_price,
      old_subtotal: dbSub,
      sheet_settle: sheetSettle,
      new_unit: newUnit,
      new_subtotal: newSubtotal,
      round_diff: newSubtotal - sheetSettle,
    });
  }

  // 영향 task 측 catch
  const affectedTaskIds = [...new Set(candidates.map(c => c.task.id))];

  console.log(`\n[1] 대상 선별`);
  console.log(`  · 측 catch usol_n task_items   : ${items.length}`);
  console.log(`  · qty>1                   : ${items.filter(it => Number(it.qty) > 1).length}`);
  console.log(`  · 시트 측 catch X / skip        : ${skippedNoSheet}`);
  console.log(`  · 이미 일치 / skip         : ${skippedAlreadyMatch}`);
  console.log(`  · ✅ 정정 대상            : ${candidates.length} task_items / ${affectedTaskIds.length} task`);

  // [4] 영향 task 측 catch payments 현황
  const paymentsBefore = [];
  for (let i = 0; i < affectedTaskIds.length; i += 200) {
    const ids = affectedTaskIds.slice(i, i + 200);
    const { data } = await sb.from("payments").select("task_id, engineer_amount, principal_amount, owner_amount, product_price, calc_method, status").in("task_id", ids);
    if (data) paymentsBefore.push(...data);
  }
  // task 측 catch 측 catch 측 catch payment 측 catch (computed_at desc 측 catch)
  const latestPay = new Map();
  // 측 catch 측 catch 측 catch — query 측 catch order 측 catch 측 catch 측 catch
  for (let i = 0; i < affectedTaskIds.length; i += 100) {
    const ids = affectedTaskIds.slice(i, i + 100);
    const { data } = await sb.from("payments").select("task_id, engineer_amount, principal_amount, owner_amount, product_price, calc_method, status, computed_at").in("task_id", ids).order("computed_at", { ascending: false });
    for (const p of (data || [])) {
      if (!latestPay.has(p.task_id)) latestPay.set(p.task_id, p);
    }
  }

  let sumOwnerBefore = 0, sumEngBefore = 0, sumPrincBefore = 0;
  for (const tid of affectedTaskIds) {
    const p = latestPay.get(tid);
    if (!p) continue;
    sumOwnerBefore += p.owner_amount || 0;
    sumEngBefore   += p.engineer_amount || 0;
    sumPrincBefore += p.principal_amount || 0;
  }
  console.log(`\n[2] 영향 task payments 현재값 합계 (${affectedTaskIds.length} task):`);
  console.log(`  · engineer_amount 합  : ₩${sumEngBefore.toLocaleString()}`);
  console.log(`  · principal_amount 합 : ₩${sumPrincBefore.toLocaleString()}`);
  console.log(`  · owner_amount 합     : ₩${sumOwnerBefore.toLocaleString()}  ← 부풀림 측 catch`);

  // [5] 샘플 10건
  console.log(`\n[3] 샘플 10건`);
  console.log(`${"task_no".padEnd(18)} ${"고객".padEnd(10)} ${"qty".padStart(3)} ${"old_unit".padStart(10)} ${"old_sub".padStart(10)} ${"→new_unit".padStart(10)} ${"new_sub".padStart(10)} ${"시트".padStart(10)} ${"오차".padStart(5)}`);
  for (const c of candidates.slice(0, 10)) {
    console.log(
      `${c.task.task_no.padEnd(18)} ${c.task.customer_name.padEnd(10)} ${String(c.qty).padStart(3)} ` +
      `${String(c.old_unit).padStart(10)} ${String(c.old_subtotal).padStart(10)} ` +
      `${String(c.new_unit).padStart(10)} ${String(c.new_subtotal).padStart(10)} ` +
      `${String(c.sheet_settle).padStart(10)} ${String(c.round_diff).padStart(5)}`
    );
  }

  // [6] ÷qty 나눠떨어짐 측 catch
  const notDiv = candidates.filter(c => c.round_diff !== 0);
  console.log(`\n[4] ÷qty 나눠떨어짐 검사`);
  console.log(`  · 측 catch 일치 (오차 0)   : ${candidates.length - notDiv.length}`);
  console.log(`  · ±1~3원 round 오차     : ${notDiv.length}`);
  if (notDiv.length) {
    const min = Math.min(...notDiv.map(c => c.round_diff));
    const max = Math.max(...notDiv.map(c => c.round_diff));
    console.log(`  · 오차 범위             : ${min} ~ ${max} (원)`);
  }

  // [7] 황예원 측 catch 측 catch
  const hwang = candidates.filter(c => c.task.customer_name === "황예원");
  if (hwang.length) {
    console.log(`\n[5] 황예원 (YS-260504-037) 케이스`);
    for (const c of hwang) {
      console.log(`  · ord=${c.ord} qty=${c.qty} | unit ${c.old_unit} → ${c.new_unit} | subtotal ${c.old_subtotal} → ${c.new_subtotal} (시트 ${c.sheet_settle}, 오차 ${c.round_diff})`);
    }
  }

  // [8] payments 재계산 경로
  console.log(`\n[6] payments 재계산 경로`);
  console.log(`  · Migration 028 — task_items_compute_trg (AFTER UPDATE)`);
  console.log(`  · task_items.unit_price UPDATE 측 catch → trigger 측 catch compute_payment(task_id) 자동 호출`);
  console.log(`  · 별도 호출 측 X — UPDATE 측 catch payments 측 catch 측 catch 측 catch`);

  // [9] 백업 — commit 모드 측 catch 측 catch
  if (!COMMIT) {
    console.log(`\n${"=".repeat(80)}\n🔍 DRY-RUN 완료 — 실제 쓰기 0건.`);
    console.log(`실행: node scripts/fix-usoln-unitprice-qty.cjs --commit`);
    return;
  }

  // ============================================================
  // COMMIT — 실제 실행
  // ============================================================
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupFile = path.join(__dirname, `backup-usoln-unitprice-${ts}.json`);
  const backup = {
    type: "usol_n_unitprice_qty_fix",
    ts: new Date().toISOString(),
    expected: { task_items: candidates.length, tasks: affectedTaskIds.length },
    task_items_before: candidates.map(c => ({
      id: c.item.id,
      task_id: c.task.id,
      task_no: c.task.task_no,
      product_order_id: c.ord,
      qty: c.qty,
      old_unit_price: c.old_unit,
      old_subtotal: c.old_subtotal,
      sheet_settle: c.sheet_settle,
      planned_new_unit_price: c.new_unit,
      planned_new_subtotal: c.new_subtotal,
    })),
    payments_before: [...latestPay.values()],
  };
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), "utf8");
  console.log(`\n📦 백업: ${backupFile}`);
  console.log(`     · task_items ${candidates.length} (변경 전 unit_price/subtotal)`);
  console.log(`     · payments ${latestPay.size} (변경 전 engineer/principal/owner)\n`);

  let ok = 0, fail = 0;
  for (const c of candidates) {
    const { error } = await sb.from("task_items").update({ unit_price: c.new_unit }).eq("id", c.item.id);
    if (error) { fail++; console.error(`  ❌ ${c.task.task_no} item ${c.item.id}: ${error.message}`); }
    else ok++;
  }
  console.log(`  · task_items UPDATE: ${ok} ok / ${fail} fail  (예상: ${candidates.length})`);
  console.log(`  · trigger task_items_compute_trg 측 catch payments 자동 재계산 (각 row UPDATE 측 catch 측 catch)`);

  // payments 재계산 후 합계 측 catch
  const latestPayAfter = new Map();
  for (let i = 0; i < affectedTaskIds.length; i += 100) {
    const ids = affectedTaskIds.slice(i, i + 100);
    const { data } = await sb.from("payments").select("task_id, engineer_amount, principal_amount, owner_amount, computed_at").in("task_id", ids).order("computed_at", { ascending: false });
    for (const p of (data || [])) {
      if (!latestPayAfter.has(p.task_id)) latestPayAfter.set(p.task_id, p);
    }
  }
  let sumOwnerAfter = 0, sumEngAfter = 0, sumPrincAfter = 0;
  for (const tid of affectedTaskIds) {
    const p = latestPayAfter.get(tid);
    if (!p) continue;
    sumOwnerAfter += p.owner_amount || 0;
    sumEngAfter += p.engineer_amount || 0;
    sumPrincAfter += p.principal_amount || 0;
  }
  console.log(`\n  · payments 재계산 후:`);
  console.log(`     engineer_amount 합  : ₩${sumEngBefore.toLocaleString()} → ₩${sumEngAfter.toLocaleString()}`);
  console.log(`     principal_amount 합 : ₩${sumPrincBefore.toLocaleString()} → ₩${sumPrincAfter.toLocaleString()}`);
  console.log(`     owner_amount 합     : ₩${sumOwnerBefore.toLocaleString()} → ₩${sumOwnerAfter.toLocaleString()}`);

  console.log(`\n${"=".repeat(80)}\nCOMMIT 완료.`);
})().catch(e => console.log("FATAL:", e.message, e.stack));

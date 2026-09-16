// 2026-06-02 — task_no NULL 측 불완전 usol_n 완료 작업 진단 (읽기 only).
//
// 사장님 spec:
//   1. task_id=2a441725-cfe5-4bf9-8108-b0af1faaa0d6 (김혜영) 전체 측 catch
//      task_no / customer_name / phone / address / scheduled_at / completed_at / created_at
//      / principal_id / task_items / 생성 경로
//   2. 같은 류 탐색: usol_n 완료 + (task_no NULL OR phone NULL OR address NULL)
//   3. 5월 회사 수익 (80.3M) 모집단 측 포함 측 catch
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";
const TARGET = "2a441725-cfe5-4bf9-8108-b0af1faaa0d6";
const MAY_START_UTC = "2026-04-30T15:00:00Z";
const MAY_END_UTC   = "2026-05-31T15:00:00Z";

function kstYmd(utcIso) {
  if (!utcIso) return null;
  const d = new Date(utcIso);
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ");
}

(async () => {
  console.log("=".repeat(110));
  console.log("(1) 김혜영 task (id=2a441725-cfe5-4bf9-8108-b0af1faaa0d6) 전체 catch");
  console.log("=".repeat(110));

  // 컬럼 측 측 측 = '*' 측 catch.
  const { data: tRow, error: tErr } = await sb.from("tasks")
    .select("*")
    .eq("id", TARGET)
    .single();
  if (tErr || !tRow) {
    console.log("\n  ⚠️ task fetch 실패:", tErr);
  } else {
    console.log("\n  ─── task 측 컬럼 측 전체 ───");
    for (const [k, v] of Object.entries(tRow).sort()) {
      const display = v == null ? "(NULL)" : (typeof v === "object" ? JSON.stringify(v) : String(v));
      console.log(`    ${k.padEnd(30)} : ${display}`);
    }
  }

  // task_items.
  const { data: items, error: iErr } = await sb.from("task_items")
    .select(`id, task_id, qty, unit_price, subtotal, net_amount, customer_paid_amount,
             naver_settled_at, company_received_at, engineer_settled_at,
             product_order_id, order_type, is_canceled, canceled_reason, canceled_at,
             description,
             work_types(name, code, service_types(code)), appliance_types(name, code)`)
    .eq("task_id", TARGET)
    .order("id");
  if (iErr) console.log("  ⚠️ task_items fetch 실패:", iErr);
  else {
    console.log(`\n  ─── task_items (${items.length}건) ───`);
    for (const it of items) {
      console.log(`    [${it.id.slice(0, 8)}]`);
      console.log(`      서비스 : ${it.appliance_types?.name || it.work_types?.name || it.description || it.order_type || "(NULL)"}`);
      console.log(`      qty / unit_price / subtotal     : ${it.qty} / ${it.unit_price} / ${it.subtotal}`);
      console.log(`      net_amount / customer_paid       : ${it.net_amount} / ${it.customer_paid_amount}`);
      console.log(`      product_order_id                : ${it.product_order_id || "(NULL)"}`);
      console.log(`      order_type                      : ${it.order_type || "(NULL)"}`);
      console.log(`      naver_settled_at / company_recv : ${it.naver_settled_at || "(NULL)"} / ${it.company_received_at || "(NULL)"}`);
      console.log(`      is_canceled / canceled_reason   : ${it.is_canceled} / ${it.canceled_reason || "—"}`);
      console.log(`      created_at / updated_at         : ${it.created_at} / ${it.updated_at}`);
    }
  }

  // payments 측 catch.
  const { data: payments } = await sb.from("payments")
    .select("*")
    .eq("task_id", TARGET);
  console.log(`\n  ─── payments (${payments?.length || 0}건) ───`);
  if (payments && payments.length > 0) {
    for (const p of payments) {
      for (const [k, v] of Object.entries(p).sort()) {
        const display = v == null ? "(NULL)" : (typeof v === "object" ? JSON.stringify(v) : String(v));
        console.log(`    ${k.padEnd(25)} : ${display}`);
      }
    }
  }

  // ─────────────────────────────────────────────
  console.log("\n" + "=".repeat(110));
  console.log("(2) 같은 류 탐색 — usol_n 완료 + (task_no NULL OR phone NULL OR address NULL)");
  console.log("=".repeat(110));

  // 전체 usol_n 완료 task fetch (3개월 정도).
  const PAGE = 1000;
  const allTasks = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await sb.from("tasks")
      .select("id, task_no, customer_name, phone, address, scheduled_at, completed_at, created_at, status, principal_id, channel, external_order_no, payment_method")
      .eq("principal_id", PID)
      .eq("status", "완료")
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    allTasks.push(...data);
    if (data.length < PAGE) break;
  }
  console.log(`\n  전체 usol_n 완료 task: ${allTasks.length}건`);

  const taskNoNull = allTasks.filter(t => !t.task_no);
  const phoneNull = allTasks.filter(t => !t.phone);
  const addressNull = allTasks.filter(t => !t.address);
  const anyNull = allTasks.filter(t => !t.task_no || !t.phone || !t.address);

  console.log(`    · task_no NULL: ${taskNoNull.length}건`);
  console.log(`    · phone NULL  : ${phoneNull.length}건`);
  console.log(`    · address NULL: ${addressNull.length}건`);
  console.log(`    · 측 측 NULL  : ${anyNull.length}건`);

  // 측 task 측 task_items + payments 측 catch.
  if (anyNull.length > 0) {
    console.log(`\n  ─── 측 측 NULL task 목록 (${anyNull.length}건) ───`);
    // task_items 측 fetch.
    const taskIds = anyNull.map(t => t.id);
    const itemsMap = new Map();
    const CHUNK = 100;
    for (let i = 0; i < taskIds.length; i += CHUNK) {
      const chunk = taskIds.slice(i, i + CHUNK);
      const { data: chunkItems } = await sb.from("task_items")
        .select("task_id, subtotal, net_amount, is_canceled, product_order_id, qty")
        .in("task_id", chunk);
      for (const it of (chunkItems || [])) {
        if (!itemsMap.has(it.task_id)) itemsMap.set(it.task_id, []);
        itemsMap.get(it.task_id).push(it);
      }
    }
    // payments 측 fetch.
    const paymentsMap = new Map();
    for (let i = 0; i < taskIds.length; i += CHUNK) {
      const chunk = taskIds.slice(i, i + CHUNK);
      const { data: chunkPay } = await sb.from("payments")
        .select("task_id, engineer_amount, owner_amount, product_price")
        .in("task_id", chunk);
      for (const p of (chunkPay || [])) paymentsMap.set(p.task_id, p);
    }

    console.log(`  ${"customer_name".padEnd(12)} ${"task_no".padEnd(18)} ${"completed_at".padEnd(20)} ${"phone".padEnd(6)} ${"addr".padEnd(5)} ${"items".padStart(5)} ${"act".padStart(4)} ${"sub합".padStart(10)} ${"eng".padStart(8)} ${"channel".padEnd(10)} ${"poid".padEnd(18)}`);
    let m5_subPos = 0, m5_subPosWithPoid = 0;  // 5월 회사 수익 모집단 포함 측 catch
    for (const t of anyNull) {
      const its = itemsMap.get(t.id) || [];
      const active = its.filter(it => it.is_canceled !== true);
      const sumSub = active.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
      const hasPoid = active.some(it => it.product_order_id);
      const pay = paymentsMap.get(t.id);
      const cmpl = kstYmd(t.completed_at);
      const inMay = t.completed_at && t.completed_at >= MAY_START_UTC && t.completed_at < MAY_END_UTC;
      const phoneCh = t.phone ? "✓" : "✗";
      const addrCh = t.address ? "✓" : "✗";
      const firstPoid = active.find(it => it.product_order_id)?.product_order_id || "—";
      console.log(`  ${(t.customer_name || "—").padEnd(12)} ${(t.task_no || "(NULL)").padEnd(18)} ${(cmpl || "—").padEnd(20)} ${phoneCh.padEnd(6)} ${addrCh.padEnd(5)} ${String(its.length).padStart(5)} ${String(active.length).padStart(4)} ${String(sumSub).padStart(10)} ${String(pay?.engineer_amount || "—").padStart(8)} ${(t.channel || "—").padEnd(10)} ${String(firstPoid).padEnd(18)}`);
      if (inMay && active.length > 0 && sumSub > 0) {
        m5_subPos++;
        if (hasPoid) m5_subPosWithPoid++;
      }
    }
    console.log(`\n  (3) 5월 회사 수익 모집단 측 포함 측:`);
    console.log(`    (B) subtotal > 0 측 포함: ${m5_subPos}건`);
    console.log(`    (C) + poid NOT NULL  : ${m5_subPosWithPoid}건  ← 사장님 진단 (C) 측 포함`);
  }

  // 김혜영 task 측 5월 완료 모집단 측 포함 측 catch.
  console.log("\n" + "=".repeat(110));
  console.log("(3) 김혜영 task 측 5월 회사 수익 모집단 측 포함 측 catch");
  console.log("=".repeat(110));
  if (tRow) {
    const inMay = tRow.completed_at && tRow.completed_at >= MAY_START_UTC && tRow.completed_at < MAY_END_UTC;
    const active = (items || []).filter(it => it.is_canceled !== true);
    const sumSub = active.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
    const hasPoid = active.some(it => it.product_order_id);
    console.log(`\n  task.status        : ${tRow.status}`);
    console.log(`  task.principal_id   : ${tRow.principal_id} (= usol_n? ${tRow.principal_id === PID})`);
    console.log(`  completed_at        : ${tRow.completed_at} (KST ${kstYmd(tRow.completed_at)})`);
    console.log(`  5월 완료 측 catch     : ${inMay}`);
    console.log(`  활성 task_items     : ${active.length}건 / SUM(subtotal) = ${sumSub}`);
    console.log(`  poid 측 catch        : ${hasPoid ? "있음" : "없음"}`);
    console.log(`  ─── 모집단 측 포함 ───`);
    console.log(`  (A) active           : ${inMay && active.length > 0 ? "✓ 포함" : "✗ 미포함"}`);
    console.log(`  (B) + subtotal > 0   : ${inMay && active.length > 0 && sumSub > 0 ? "✓ 포함" : "✗ 미포함"}`);
    console.log(`  (C) + poid NOT NULL  : ${inMay && active.length > 0 && sumSub > 0 && hasPoid ? "✓ 포함" : "✗ 미포함"}`);
  }
})();

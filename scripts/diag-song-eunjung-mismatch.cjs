// 2026-06-02 — task 헤더 vs task_item 슬라이더 불일치 진단.
//
// 송은정 (일정 5/23): 헤더 net_amount sum 261,213 / 슬라이더 정산대기 / 행 정산 전.
// 진기선 (6/1):       헤더 0 / 슬라이더·행 정산 전 (일관).
//
// 코드 측 source (src/pages/PrincipalApp.jsx):
//   · 헤더 "네이버 정산금액" = SettleDetailBox.sumNaver = SUM(item.net_amount), NULL 제외 (line 1265)
//   · 슬라이더/행 단계      = getItemStageKey(item) 측 item.naver_settled_at NULL → "wait" (정산대기) (line 1134)
//
// → 동일 source(items[]) 측. 데이터 어긋남 (net_amount NOT NULL + naver_settled_at NULL) 측 spec.
//
// 검증:
//   1. 송은정 task 측 task_items 측 net_amount / naver_settled_at / product_order_id / canceled_reason 측
//   2. 진기선 task 측 동일 확인
//   3. 전체 usol_n 측 net_amount NOT NULL + naver_settled_at NULL 측 task_items 갯수
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";

function kstYmd(utcIso) {
  if (!utcIso) return null;
  const d = new Date(utcIso);
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function findTask(customerName, scheduledYmd) {
  // scheduled_at KST = scheduledYmd
  const { data, error } = await sb.from("tasks")
    .select("id, task_no, customer_name, scheduled_at, principal_id, status, completed_at, received_at")
    .eq("principal_id", PID)
    .like("customer_name", `%${customerName}%`)
    .order("scheduled_at", { ascending: false })
    .limit(20);
  if (error) { console.error(error); return null; }
  // filter by KST scheduledYmd
  const matches = (data || []).filter(t => kstYmd(t.scheduled_at) === scheduledYmd);
  return matches.length > 0 ? matches : (data || []).slice(0, 5);
}

async function dumpTaskItems(task) {
  const { data, error } = await sb.from("task_items")
    .select("id, task_id, qty, unit_price, subtotal, customer_paid_amount, net_amount, product_order_id, order_type, naver_settled_at, naver_received_at, company_received_at, engineer_settled_at, is_canceled, canceled_at, canceled_reason, description, work_types(name), appliance_types(name)")
    .eq("task_id", task.id)
    .order("id");
  if (error) { console.error(error); return; }
  console.log(`\n    task ${task.task_no} / ${task.customer_name}`);
  console.log(`    scheduled_at: ${task.scheduled_at} (KST ${kstYmd(task.scheduled_at)})`);
  console.log(`    status: ${task.status} / completed_at: ${kstYmd(task.completed_at) || "—"}`);
  console.log(`    task_items: ${data.length}건`);

  let sumNet = 0;
  let netNotNullCount = 0;
  let naverSettledCount = 0;
  let netNotNullNaverNullCount = 0;
  for (const it of data) {
    const label = it.appliance_types?.name || it.work_types?.name || it.description || it.order_type || "—";
    const naverKst = kstYmd(it.naver_settled_at);
    console.log(`      [${it.id.slice(0,8)}] ${label} ×${it.qty}`);
    console.log(`        net_amount=${it.net_amount}  (subtotal=${it.subtotal}, customer_paid=${it.customer_paid_amount})`);
    console.log(`        naver_settled_at: ${it.naver_settled_at || "(NULL ← 정산대기)"}${naverKst ? ` KST=${naverKst}` : ""}`);
    console.log(`        product_order_id: ${it.product_order_id || "(NULL)"}`);
    console.log(`        is_canceled=${it.is_canceled} canceled_reason=${it.canceled_reason || "—"}`);
    if (it.net_amount != null) {
      netNotNullCount++;
      sumNet += Number(it.net_amount);
      if (!it.naver_settled_at) netNotNullNaverNullCount++;
    }
    if (it.naver_settled_at) naverSettledCount++;
  }
  console.log(`    헤더 sumNet (net_amount NOT NULL 합) = ${sumNet.toLocaleString()}`);
  console.log(`    net_amount NOT NULL = ${netNotNullCount}건 / naver_settled_at NOT NULL = ${naverSettledCount}건`);
  console.log(`    ★ net_amount NOT NULL + naver_settled_at NULL = ${netNotNullNaverNullCount}건 ← 헤더-슬라이더 불일치 원인`);
}

(async () => {
  console.log("=".repeat(100));
  console.log("task 헤더 vs task_item 슬라이더 불일치 진단");
  console.log("=".repeat(100));

  // 1. 송은정 (일정 5/23)
  console.log("\n  ─── (A) 송은정 — 일정 2026-05-23 KST ───");
  const songTasks = await findTask("송은정", "2026-05-23");
  if (!songTasks || songTasks.length === 0) console.log("    측 측 측 측 (송은정 측 측 측 측)");
  else for (const t of songTasks) await dumpTaskItems(t);

  // 2. 진기선 (6/1)
  console.log("\n  ─── (B) 진기선 — 일정 2026-06-01 KST ───");
  const jinTasks = await findTask("진기선", "2026-06-01");
  if (!jinTasks || jinTasks.length === 0) console.log("    측 측 측 측 (진기선 측 측 측 측)");
  else for (const t of jinTasks) await dumpTaskItems(t);

  // 3. 전체 usol_n — net_amount NOT NULL + naver_settled_at NULL 측 task_items 갯수
  console.log("\n  ─── (C) 전체 usol_n 측 데이터 어긋남 갯수 ───");
  const PAGE = 1000;
  let total = 0;
  let mismatchCount = 0;
  let bothNullCount = 0;
  let bothSetCount = 0;
  const sampleMismatch = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await sb.from("task_items")
      .select("id, net_amount, naver_settled_at, is_canceled, tasks!inner(task_no, customer_name, status, principal_id)")
      .eq("tasks.principal_id", PID)
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    for (const it of data) {
      if (it.is_canceled || it.tasks?.status === "취소") continue;
      total++;
      const hasNet = it.net_amount != null;
      const hasSettled = !!it.naver_settled_at;
      if (hasNet && !hasSettled) {
        mismatchCount++;
        if (sampleMismatch.length < 10) sampleMismatch.push({ task_no: it.tasks?.task_no, customer: it.tasks?.customer_name, net: it.net_amount });
      } else if (!hasNet && !hasSettled) {
        bothNullCount++;
      } else if (hasNet && hasSettled) {
        bothSetCount++;
      }
    }
    if (data.length < PAGE) break;
  }
  console.log(`    전체 활성 task_items (cancel 제외): ${total}건`);
  console.log(`    · net_amount NOT NULL + naver_settled_at NOT NULL (정상 정산됨): ${bothSetCount}건`);
  console.log(`    · net_amount NULL     + naver_settled_at NULL     (정상 정산 전):  ${bothNullCount}건`);
  console.log(`    · net_amount NOT NULL + naver_settled_at NULL     (★불일치):       ${mismatchCount}건  ← CSV import 측 catch 누락 spec`);
  const onlySettledNoNet = total - bothNullCount - bothSetCount - mismatchCount;
  console.log(`    · net_amount NULL     + naver_settled_at NOT NULL                : ${onlySettledNoNet}건`);
  if (sampleMismatch.length > 0) {
    console.log(`\n    불일치 sample (10건):`);
    for (const s of sampleMismatch) console.log(`      ${s.task_no} / ${s.customer} / net=${s.net}`);
  }
})();

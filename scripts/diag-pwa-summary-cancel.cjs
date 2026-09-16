// 2026-06-02 — 유솔 PWA 전체 현황 summary 카운트 측 cancel 필터 진단 (읽기 only).
//
// 분석:
//   · summary 5개 카운트: received / beforeWork / doneWork / settled / pendingCount
//   · 단위: task_item (items 측 task_item 단위 fetched)
//   · 현재 cancel 필터: task.status !== "취소" 만 (task_item.is_canceled 무관)
//   · 주차별 정산 (118건 기준) cancel 필터: !is_canceled AND task.status !== "취소"
//   · 차이 = task_item.is_canceled=true 측 task_item (task.status != '취소')
//
// 검증:
//   1. fetchPrincipalSettleItems 측 시뮬레이션 (usol_h + usol_n, monthsBack=3)
//   2. summary 카운트 측 시뮬레이션 (현재 + cancel-strict 비교)
//   3. settled 907 측 정합 catch
//   4. 각 카운트 측 cancel 측 분포
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT = "11111111-1111-1111-1111-111111111111";

(async () => {
  console.log("=".repeat(100));
  console.log("유솔 PWA 전체 현황 summary 카운트 — cancel 필터 진단");
  console.log("=".repeat(100));

  // 1. principal_id 측 catch (usol_h + usol_n)
  const { data: principals } = await sb.from("principals").select("id, code").in("code", ["usol_h", "usol_n"]);
  const pids = principals.map(p => p.id);
  console.log("\n  principals:", principals.map(p => `${p.code}=${p.id}`).join(", "));

  // 2. cutoff = 3개월 전 (monthsBack: 3)
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  cutoff.setHours(0, 0, 0, 0);
  console.log("  cutoff (3 months back):", cutoff.toISOString());

  // 3. fetch (paged, 50 pages × 1000 = 50,000 cap)
  const PAGE_SIZE = 1000;
  const accumulated = [];
  for (let page = 0; page < 50; page++) {
    const offset = page * PAGE_SIZE;
    const { data, error } = await sb.from("task_items")
      .select(
        `id, task_id, naver_settled_at, net_amount, subtotal, is_canceled, canceled_at, canceled_reason,
         product_order_id,
         tasks!inner(id, task_no, customer_name, principal_id, status, received_at, completed_at)`
      )
      .eq("tasks.tenant_id", TENANT)
      .in("tasks.principal_id", pids)
      .gte("tasks.received_at", cutoff.toISOString())
      .order("naver_settled_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    accumulated.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  // 평탄화 — PWA principalSettleDb.js 와 동일 spec
  const items = accumulated.map(it => ({
    id: it.id,
    task_id: it.task_id,
    naver_settled_at: it.naver_settled_at,
    net_amount: it.net_amount,
    subtotal: it.subtotal,
    is_canceled: it.is_canceled,
    canceled_at: it.canceled_at,
    canceled_reason: it.canceled_reason,
    product_order_id: it.product_order_id,
    task_no: it.tasks?.task_no,
    customer_name: it.tasks?.customer_name,
    task_status: it.tasks?.status,
    principal_id: it.tasks?.principal_id,
    received_at: it.tasks?.received_at,
    completed_at: it.tasks?.completed_at,
  }));
  console.log(`  fetched: ${items.length} task_items`);

  // ─── 4. summary 시뮬레이션 (현재 PWA 코드 — task.status 만 cancel 필터) ────
  const live = items.filter(it => it.task_status !== "취소");
  const before = live.filter(it => ["배정", "확정"].includes(it.task_status));
  const done = live.filter(it => it.task_status === "완료");
  const settled = live.filter(it => it.naver_settled_at);
  const pendingSettle = done.filter(it => !it.naver_settled_at);

  console.log("\n  ─── (A) 현재 PWA summary (task.status !== '취소' 만 cancel 필터) ───");
  console.log(`    received    (live.length)        = ${live.length}`);
  console.log(`    beforeWork  (배정 + 확정)        = ${before.length}`);
  console.log(`    doneWork    (완료)               = ${done.length}`);
  console.log(`    settled     (naver_settled_at)   = ${settled.length}`);
  console.log(`    pendingCount(완료 - settled)     = ${pendingSettle.length}`);

  // ─── 5. cancel-strict (운영자 ① 와 같은 spec) ────
  const active = items.filter(it => !it.is_canceled && it.task_status !== "취소");
  const activeBefore = active.filter(it => ["배정", "확정"].includes(it.task_status));
  const activeDone = active.filter(it => it.task_status === "완료");
  const activeSettled = active.filter(it => it.naver_settled_at);
  const activePending = activeDone.filter(it => !it.naver_settled_at);

  console.log("\n  ─── (B) cancel-strict (is_canceled + status='취소' 둘 다 제외) ───");
  console.log(`    received    = ${active.length}`);
  console.log(`    beforeWork  = ${activeBefore.length}`);
  console.log(`    doneWork    = ${activeDone.length}`);
  console.log(`    settled     = ${activeSettled.length}`);
  console.log(`    pendingCount= ${activePending.length}`);

  // ─── 6. 차이 측 catch (A - B) ────
  console.log("\n  ─── (C) 차이 (A - B) = is_canceled=true (task.status != '취소') 측 task_item 측 ───");
  console.log(`    received   diff = ${live.length - active.length}`);
  console.log(`    beforeWork diff = ${before.length - activeBefore.length}`);
  console.log(`    doneWork   diff = ${done.length - activeDone.length}`);
  console.log(`    settled    diff = ${settled.length - activeSettled.length}`);
  console.log(`    pending    diff = ${pendingSettle.length - activePending.length}`);

  // ─── 7. cancel 측 분포 (task.status별 × task_item.is_canceled별) ────
  console.log("\n  ─── (D) task_item.is_canceled=true 측 task.status별 분포 ───");
  const canceledItems = items.filter(it => it.is_canceled === true);
  const dist = new Map();
  for (const it of canceledItems) {
    const key = it.task_status || "(null)";
    dist.set(key, (dist.get(key) || 0) + 1);
  }
  for (const [k, v] of [...dist.entries()].sort()) {
    console.log(`    task.status='${k}' & is_canceled=true → ${v}건`);
  }
  console.log(`    합계: ${canceledItems.length}건`);

  // ─── 8. settled 측 is_canceled=true 측 상세 ────
  const settledCanceled = settled.filter(it => it.is_canceled === true);
  console.log(`\n  ─── (E) settled 측 (naver_settled_at != null) 측 is_canceled=true 측 상세 (${settledCanceled.length}건) ───`);
  for (const it of settledCanceled.slice(0, 30)) {
    const ymd = it.naver_settled_at ? it.naver_settled_at.slice(0, 10) : "";
    console.log(`    ${it.task_no?.padEnd(15)} / ${it.customer_name?.padEnd(8)} / status='${it.task_status}' / settled=${ymd} / net=${it.net_amount} / canceled_at=${it.canceled_at?.slice(0,10) || "—"}`);
  }
  if (settledCanceled.length > 30) console.log(`    ... 외 ${settledCanceled.length - 30}건`);

  // ─── 9. principal별 분포 (usol_n vs usol_h) ────
  const byPrincipal = new Map();
  for (const it of items) {
    const code = principals.find(p => p.id === it.principal_id)?.code || "(unknown)";
    if (!byPrincipal.has(code)) byPrincipal.set(code, { all: 0, settled: 0, settledCancel: 0 });
    const s = byPrincipal.get(code);
    s.all++;
    if (it.task_status !== "취소" && it.naver_settled_at) {
      s.settled++;
      if (it.is_canceled === true) s.settledCancel++;
    }
  }
  console.log("\n  ─── (F) principal별 분포 ───");
  for (const [code, s] of byPrincipal) {
    console.log(`    ${code}: 전체=${s.all}건 / settled=${s.settled}건 / 그중 is_canceled=true=${s.settledCancel}건`);
  }

  // ─── 10. 주차별 정산 (운영자 ① 측 W23 = 118건) catch ────
  console.log("\n  ─── (G) 주차별 정산 (118건 기준) vs summary settled (현재값) ───");
  console.log("    주차별 정산 cancel 필터: is_canceled=false AND task.status != '취소' (둘 다)");
  console.log("    summary settled    필터: task.status != '취소' 만 (is_canceled 무관)");
  console.log("    단위: 양쪽 모두 task_item (동일)");
  console.log("");
  console.log("    → 차이 = is_canceled=true 인데 naver_settled_at != null + task.status != '취소' 측 task_item.");
  console.log(`    → 위 (E) ${settledCanceled.length}건 = settled 측 inflate 량.`);
})();

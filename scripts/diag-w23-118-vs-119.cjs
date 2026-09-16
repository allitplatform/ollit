// 2026-06-02 — 6/8 입금주 (naver_settled 6/1~6/7 KST) usol_n 집계 불일치 진단.
//
// 운영자 ① (UsolNToCompanySection.fetchJuneLiveWeeks) = 118건
// 유솔 원청 PWA (PrincipalSettleTab + principalSettleDb) = 119건
//
// 가설:
//   ① cancel 필터 차이 — 운영자 ①은 is_canceled=false AND tasks.status!='취소' 적용,
//      유솔 PWA는 cancel 필터 없음 → 취소된 1건이 PWA만 카운트됨.
//
// 출력: 6/1~6/7 KST 안에 naver_settled_at 잡힌 usol_n task_items 전체 + 각 필터별 카운트
//       + 차집합 (PWA 포함 / 운영자 제외) 후보 1건 상세
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";

// KST 6/1 00:00 = UTC 2026-05-31T15:00:00Z
// KST 6/8 00:00 = UTC 2026-06-07T15:00:00Z
const START_UTC = "2026-05-31T15:00:00Z";
const END_UTC   = "2026-06-07T15:00:00Z";

function kstYmd(utcIso) {
  if (!utcIso) return null;
  const d = new Date(utcIso);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
function kstHms(utcIso) {
  if (!utcIso) return null;
  const d = new Date(utcIso);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(11, 19);
}

(async () => {
  console.log("=".repeat(100));
  console.log("6/8 입금주 (naver_settled 6/1~6/7 KST) — usol_n task_items 진단");
  console.log("  start_utc =", START_UTC, "(KST 6/1 00:00)");
  console.log("  end_utc   =", END_UTC,   "(KST 6/8 00:00)");
  console.log("=".repeat(100));

  // 운영자 ① 와 동일한 fetch (principal_id eq, naver_settled_at NOT NULL, >= START_UTC)
  // 추가: <= END_UTC 도 적용해 6/1~6/7 KST 안만 추림.
  const PAGE = 1000;
  const MAX_PAGES = 10;
  const all = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const off = p * PAGE;
    const { data, error } = await sb.from("task_items")
      .select(`id, task_id, product_order_id, naver_settled_at, net_amount, subtotal, is_canceled, canceled_reason, canceled_at,
               tasks!inner(id, task_no, customer_name, principal_id, status, completed_at, received_at)`)
      .eq("tasks.principal_id", PID)
      .not("naver_settled_at", "is", null)
      .gte("naver_settled_at", START_UTC)
      .lt("naver_settled_at", END_UTC)
      .order("naver_settled_at", { ascending: true })
      .range(off, off + PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  console.log(`\n총 fetch: ${all.length}건 (6/1~6/7 KST 안 naver_settled_at)`);

  // 운영자 ① 필터: !is_canceled AND tasks.status != '취소'
  const adminActive = all.filter(it => !it.is_canceled && it.tasks?.status !== "취소");

  // 유솔 PWA 필터: cancel 필터 X (received_at 3개월 cutoff는 6/1 정산 건엔 영향 0)
  const pwaActive = all; // PWA는 status/is_canceled 무관하게 row.length

  console.log("\n─── 필터별 카운트 ───────────────────────────────────────────────");
  console.log(`  운영자 ① (!is_canceled AND tasks.status!='취소') = ${adminActive.length}건`);
  console.log(`  유솔 PWA (cancel 필터 X)                          = ${pwaActive.length}건`);
  console.log(`  차이                                              = ${pwaActive.length - adminActive.length}건`);

  // 차집합 = PWA O, 운영자 X
  const adminIds = new Set(adminActive.map(it => it.id));
  const diff = pwaActive.filter(it => !adminIds.has(it.id));

  console.log("\n─── PWA에만 포함되고 운영자 ①에서 제외된 항목 ─────────────────");
  for (const it of diff) {
    const t = it.tasks || {};
    console.log("  ─".repeat(40));
    console.log(`  task_item.id        : ${it.id}`);
    console.log(`  task_no             : ${t.task_no}`);
    console.log(`  customer_name       : ${t.customer_name}`);
    console.log(`  task.status         : ${t.status}`);
    console.log(`  task_item.is_canceled : ${it.is_canceled}`);
    console.log(`  canceled_reason     : ${it.canceled_reason || "(NULL)"}`);
    console.log(`  canceled_at         : ${it.canceled_at || "(NULL)"}`);
    console.log(`  net_amount          : ${it.net_amount}`);
    console.log(`  subtotal            : ${it.subtotal}`);
    console.log(`  product_order_id    : ${it.product_order_id || "(NULL)"}`);
    console.log(`  naver_settled_at UTC: ${it.naver_settled_at}`);
    console.log(`  naver_settled_at KST: ${kstYmd(it.naver_settled_at)} ${kstHms(it.naver_settled_at)}`);
    console.log(`  task.completed_at   : ${t.completed_at}`);
    console.log(`  task.received_at    : ${t.received_at}`);
  }

  // status별 분포 catch
  console.log("\n─── 전체 119건 status × is_canceled 분포 ──────────────────────");
  const dist = new Map();
  for (const it of all) {
    const key = `${it.tasks?.status || "(null)"} | is_canceled=${it.is_canceled}`;
    dist.set(key, (dist.get(key) || 0) + 1);
  }
  for (const [k, v] of [...dist.entries()].sort()) {
    console.log(`  ${k.padEnd(35)} → ${v}건`);
  }
})();

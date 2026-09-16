// 진단 — usol_n task_items.product_order_id 중복 확인
// 2026-05-24
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

const TARGET_POIDS = [
  "2026052294866531", "2026050557443361", "2026051133395611",
  "2026051254569031", "2026051311682451", "2026051529272691",
  "2026051526983461", "2026051639160931", "2026051657667811",
  "2026051781448021", "2026051818573561",
];

(async () => {
  const usolNId = "22222222-2222-2222-2222-222222222006";

  // 0. usol_n task ids 수집
  const tasksById = new Map();
  {
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await sb
        .from("tasks")
        .select("id, task_no, status, customer_name, created_at, channel")
        .eq("principal_id", usolNId)
        .range(from, from + PAGE - 1);
      if (!data?.length) break;
      for (const t of data) tasksById.set(t.id, t);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  const usolNTaskIds = [...tasksById.keys()];
  console.log(`usol_n tasks: ${usolNTaskIds.length}건 / 수집 완료`);

  // 1. 모든 task_items 수집 (poid 분포 + 풀 데이터)
  const items = [];
  for (let i = 0; i < usolNTaskIds.length; i += 200) {
    const ids = usolNTaskIds.slice(i, i + 200);
    const { data } = await sb
      .from("task_items")
      .select("id, task_id, product_order_id, order_type, unit_price, subtotal, net_amount, customer_paid_amount, naver_settled_at, company_received_at, engineer_settled_at, metadata")
      .in("task_id", ids);
    if (data) items.push(...data);
  }
  console.log(`task_items: ${items.length}건\n`);

  // 1-A. 대상 11개 각각 — 몇 번 나오는지
  console.log("=".repeat(110));
  console.log("[1] 대상 11개 product_order_id 빈도");
  console.log("=".repeat(110));
  const targetMap = new Map();
  for (const p of TARGET_POIDS) targetMap.set(p, []);
  for (const it of items) {
    if (targetMap.has(it.product_order_id)) {
      targetMap.get(it.product_order_id).push(it);
    }
  }
  for (const p of TARGET_POIDS) {
    const rows = targetMap.get(p);
    const tag = rows.length >= 2 ? "  ⚠️ 중복" : "";
    console.log(`  ${p} : ${rows.length}건${tag}`);
  }

  // 2. 중복 상세
  console.log("\n" + "=".repeat(110));
  console.log("[2] 중복 행 상세 — task_no(legacy/신규) / status / created_at");
  console.log("=".repeat(110));
  for (const p of TARGET_POIDS) {
    const rows = targetMap.get(p);
    if (rows.length < 2) continue;
    console.log(`\n● ${p}  (${rows.length}건)`);
    for (const it of rows) {
      const t = tasksById.get(it.task_id);
      const kind = (t?.task_no || "").startsWith("YS-N-") ? "신규" : "legacy";
      console.log(`   [${kind}] task_no=${t?.task_no || "?"} | cust=${t?.customer_name || "?"} | status=${t?.status || "?"} | task.created_at=${t?.created_at || "?"} | channel=${t?.channel || "?"}`);
      console.log(`           item_id=${it.id} | unit=${it.unit_price} | subtotal=${it.subtotal} | net_amount=${it.net_amount} | cust_paid=${it.customer_paid_amount} | naver_settled_at=${it.naver_settled_at || "(NULL)"}`);
      console.log(`           order_type=${it.order_type} | company_received_at=${it.company_received_at || "(NULL)"} | engineer_settled_at=${it.engineer_settled_at || "(NULL)"}`);
      if (it.metadata && Object.keys(it.metadata).length) console.log(`           metadata=${JSON.stringify(it.metadata).slice(0, 120)}`);
    }
  }

  // 3. 전체 중복 규모
  console.log("\n" + "=".repeat(110));
  console.log("[3] usol_n task_items 전체 product_order_id 중복 규모");
  console.log("=".repeat(110));
  const counts = new Map();
  for (const it of items) {
    if (!it.product_order_id) continue;
    counts.set(it.product_order_id, (counts.get(it.product_order_id) || 0) + 1);
  }
  let dupKeys = 0, totalDupRows = 0;
  const dupList = [];
  for (const [k, v] of counts.entries()) {
    if (v >= 2) {
      dupKeys++;
      totalDupRows += v;
      dupList.push({ poid: k, count: v });
    }
  }
  console.log(`  · 중복된 product_order_id: ${dupKeys}개`);
  console.log(`  · 중복 행 합계            : ${totalDupRows}건`);
  console.log(`  · 정리 시 제거 후보       : ${totalDupRows - dupKeys}건 (1개씩만 남기는 가정)`);

  // 중복 분포 (count별)
  const dist = {};
  for (const d of dupList) dist[d.count] = (dist[d.count] || 0) + 1;
  console.log(`  · 빈도 분포:`);
  for (const [c, n] of Object.entries(dist).sort((a, b) => +a[0] - +b[0])) {
    console.log(`      ${c}회 중복: ${n}개`);
  }

  // 중복 샘플 — 대상 11개 외 추가 발견 시 일부 표시
  const outsideTargets = dupList.filter(d => !TARGET_POIDS.includes(d.poid));
  if (outsideTargets.length) {
    console.log(`\n  · 대상 11개 외 중복 ${outsideTargets.length}개 (샘플 10건):`);
    for (const d of outsideTargets.slice(0, 10)) {
      console.log(`      · ${d.poid} (${d.count}회)`);
    }
  }

  // 4. 중복 쌍 — net_amount / subtotal / naver_settled_at 채워짐 비교 (대상 11개)
  console.log("\n" + "=".repeat(110));
  console.log("[4] 대상 11개 중복 쌍 — legacy vs 신규 필드 채워짐 요약");
  console.log("=".repeat(110));
  console.log(`${"poid".padEnd(18)} | ${"legacy task".padEnd(20)} ${"net".padStart(8)} ${"set.at".padStart(8)} | ${"신규 task".padEnd(20)} ${"net".padStart(8)} ${"set.at".padStart(8)}`);
  for (const p of TARGET_POIDS) {
    const rows = targetMap.get(p);
    if (rows.length < 2) continue;
    const leg = rows.find(it => !(tasksById.get(it.task_id)?.task_no || "").startsWith("YS-N-"));
    const neu = rows.find(it => (tasksById.get(it.task_id)?.task_no || "").startsWith("YS-N-"));
    const legT = leg ? tasksById.get(leg.task_id) : null;
    const neuT = neu ? tasksById.get(neu.task_id) : null;
    const fmt = (it, t) => {
      if (!it) return `${"(없음)".padEnd(20)} ${"-".padStart(8)} ${"-".padStart(8)}`;
      const tn = (t?.task_no || "?").padEnd(20);
      const net = String(it.net_amount ?? "NULL").padStart(8);
      const set = (it.naver_settled_at ? "YES" : "NULL").padStart(8);
      return `${tn} ${net} ${set}`;
    };
    console.log(`${p.padEnd(18)} | ${fmt(leg, legT)} | ${fmt(neu, neuT)}`);
  }

  // 4-B. 같은 11개 — 추가 컬럼 매트릭스 (unit / subtotal / cust_paid)
  console.log("\n" + "=".repeat(110));
  console.log("[4-B] 대상 11개 — 단가 일치 여부 (legacy vs 신규)");
  console.log("=".repeat(110));
  console.log(`${"poid".padEnd(18)} | ${"legacy unit".padStart(12)} ${"legacy sub".padStart(12)} | ${"신규 unit".padStart(12)} ${"신규 sub".padStart(12)} | 일치`);
  for (const p of TARGET_POIDS) {
    const rows = targetMap.get(p);
    if (rows.length < 2) continue;
    const leg = rows.find(it => !(tasksById.get(it.task_id)?.task_no || "").startsWith("YS-N-"));
    const neu = rows.find(it => (tasksById.get(it.task_id)?.task_no || "").startsWith("YS-N-"));
    const same = leg && neu && leg.unit_price === neu.unit_price ? "OK" : "DIFF";
    console.log(`${p.padEnd(18)} | ${String(leg?.unit_price ?? "-").padStart(12)} ${String(leg?.subtotal ?? "-").padStart(12)} | ${String(neu?.unit_price ?? "-").padStart(12)} ${String(neu?.subtotal ?? "-").padStart(12)} | ${same}`);
  }

  console.log(`\n${"=".repeat(110)}\n진단 완료.`);
})().catch(e => console.log("FATAL:", e.message, e.stack));

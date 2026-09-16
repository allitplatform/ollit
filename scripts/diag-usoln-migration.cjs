// 진단 — usol_n 작업 현황 (운영 시트 이관 준비)
// 2026-05-24
// 실행: node scripts/diag-usoln-migration.cjs

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

(async () => {
  // 0. usol_n principal id 확인
  const { data: principals } = await sb.from("principals").select("id, code, name").eq("code", "usol_n");
  const usolN = principals?.[0];
  if (!usolN) {
    console.log("usol_n principal 없음. 종료.");
    return;
  }
  console.log("=".repeat(72));
  console.log(`usol_n principal: id=${usolN.id} / name=${usolN.name}`);

  // 1-A. tasks 건수 (principal_id = usol_n)
  const { count: taskCount } = await sb
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("principal_id", usolN.id);
  console.log(`\n[1] usol_n tasks 총 건수: ${taskCount}`);

  // task ids 전체 수집
  const allTaskIds = [];
  {
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await sb
        .from("tasks")
        .select("id")
        .eq("principal_id", usolN.id)
        .range(from, from + PAGE - 1);
      if (error) { console.log("tasks ids 측 오류", error); break; }
      if (!data?.length) break;
      allTaskIds.push(...data.map(r => r.id));
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  console.log(`    → task id 수집: ${allTaskIds.length}건`);

  // 1-B. task_items 건수
  let itemCount = 0;
  let itemNullPoid = 0;
  let itemNonNullPoid = 0;
  const samplePoids = [];
  {
    const CHUNK = 200;
    for (let i = 0; i < allTaskIds.length; i += CHUNK) {
      const ids = allTaskIds.slice(i, i + CHUNK);
      const { data } = await sb
        .from("task_items")
        .select("id, product_order_id")
        .in("task_id", ids);
      if (!data) continue;
      itemCount += data.length;
      for (const r of data) {
        if (r.product_order_id == null || r.product_order_id === "") itemNullPoid++;
        else {
          itemNonNullPoid++;
          if (samplePoids.length < 10) samplePoids.push(r.product_order_id);
        }
      }
    }
  }
  console.log(`\n[1] usol_n task_items 총 건수: ${itemCount}`);
  console.log(`    · product_order_id NOT NULL: ${itemNonNullPoid}`);
  console.log(`    · product_order_id NULL    : ${itemNullPoid}`);

  // 2. product_order_id 샘플 10개 (앞 10개만)
  console.log(`\n[2] product_order_id 샘플 10개:`);
  for (const p of samplePoids) console.log(`    · ${p} (len=${String(p).length})`);

  // 2-B. 형식 분포 — 16자리 숫자 vs YS- 코드 vs 그 외
  let cnt16 = 0, cntYS = 0, cntEtc = 0;
  const etcSamples = [];
  {
    const CHUNK = 200;
    for (let i = 0; i < allTaskIds.length; i += CHUNK) {
      const ids = allTaskIds.slice(i, i + CHUNK);
      const { data } = await sb.from("task_items").select("product_order_id").in("task_id", ids);
      for (const r of (data || [])) {
        const p = r.product_order_id;
        if (!p) continue;
        if (/^\d{16}$/.test(p)) cnt16++;
        else if (/^YS-/.test(p)) cntYS++;
        else { cntEtc++; if (etcSamples.length < 10) etcSamples.push(p); }
      }
    }
  }
  console.log(`\n[2] product_order_id 형식 분포:`);
  console.log(`    · 16자리 숫자       : ${cnt16}`);
  console.log(`    · YS- 시작 작업코드 : ${cntYS}`);
  console.log(`    · 그 외             : ${cntEtc}`);
  if (etcSamples.length) {
    console.log(`    그 외 샘플 (${etcSamples.length}건):`);
    for (const e of etcSamples) console.log(`      · "${e}"`);
  }

  // 3. usol_n tasks status 분포
  const statusCounts = {};
  let taskNoSamples = [];
  {
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await sb
        .from("tasks")
        .select("id, task_no, status")
        .eq("principal_id", usolN.id)
        .range(from, from + PAGE - 1);
      if (!data?.length) break;
      for (const r of data) {
        statusCounts[r.status || "(NULL)"] = (statusCounts[r.status || "(NULL)"] || 0) + 1;
        if (taskNoSamples.length < 15) taskNoSamples.push(r.task_no);
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  console.log(`\n[3] usol_n tasks status 분포:`);
  for (const [s, c] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    · ${s.padEnd(8)} : ${c}`);
  }
  console.log(`\n[3] task_no 샘플 15개:`);
  for (const t of taskNoSamples) console.log(`    · ${t}`);

  // 4. 운영 시트 정산 칼럼 매핑 대상 컬럼 확인
  console.log(`\n[4] 운영 시트 → DB 대응 컬럼 (스키마 기준):`);
  console.log(`    [tasks]`);
  console.log(`      · 상태             → tasks.status`);
  console.log(`      · 배정기사         → tasks.assigned_engineer_id (users.id 참조)`);
  console.log(`      · 기사약속시간     → tasks.scheduled_at (timestamptz)`);
  console.log(`      · 작업완료일       → tasks.completed_at (timestamptz)`);
  console.log(`    [task_items]`);
  console.log(`      · 정산예정금액     → task_items.unit_price (qty 측 곱하면 subtotal — GENERATED)`);
  console.log(`      · 네이버정산금액   → task_items.net_amount (int, NULL 허용)`);
  console.log(`      · 고객실결제액(AG) → task_items.customer_paid_amount (int, NULL 허용 / 표시 전용 — Migration 064)`);
  console.log(`      · 상품주문번호     → task_items.product_order_id (varchar / 매칭 키)`);
  console.log(`      · 항목 종류        → task_items.order_type ('본작업' / '추가선택' / '방문비' / '현금수동')`);

  // 4-B. 샘플 한 건 — tasks + task_items 풀 컬럼
  console.log(`\n[4] 샘플 task 1건 (조인) 컬럼 점검:`);
  const sampleTaskId = allTaskIds[0];
  if (sampleTaskId) {
    const { data: tk } = await sb.from("tasks").select("*").eq("id", sampleTaskId).single();
    if (tk) {
      console.log(`    [tasks 컬럼 (값 있는 것만)]`);
      for (const [k, v] of Object.entries(tk)) {
        if (v == null || v === "" || (typeof v === "object" && Object.keys(v || {}).length === 0)) continue;
        let disp = v;
        if (typeof v === "object") disp = JSON.stringify(v).slice(0, 60);
        else disp = String(v).slice(0, 60);
        console.log(`      · ${k.padEnd(28)} = ${disp}`);
      }
      const { data: items } = await sb.from("task_items").select("*").eq("task_id", sampleTaskId);
      console.log(`    [task_items ${items?.length || 0}건 — 첫 행 값 있는 것만]`);
      if (items?.[0]) {
        for (const [k, v] of Object.entries(items[0])) {
          if (v == null || v === "") continue;
          console.log(`      · ${k.padEnd(28)} = ${String(v).slice(0, 60)}`);
        }
      }
    }
  }

  console.log(`\n${"=".repeat(72)}\n진단 완료.`);
})().catch(e => {
  console.log("FATAL:", e.message, e.stack);
});

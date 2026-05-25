// 진단 — 부분취소(qty=0 / partial_reason 보유) task 백필 대상 카운트
// 2026-05-25 (read-only)

const fs = require("fs"), path = require("path");
function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function bar(c = "═", n = 100) { return c.repeat(n); }
function sub(s) { console.log("\n" + bar("─")); console.log(s); console.log(bar("─")); }

(async () => {
  console.log(bar());
  console.log("진단 — 부분취소 백필 대상 카운트");
  console.log(bar());

  // A. tasks.partial_reason 가 NOT NULL 인 task
  sub("[A] tasks.partial_reason NOT NULL");
  const { count: partialCnt } = await sb.from("tasks")
    .select("id", { count: "exact", head: true })
    .not("partial_reason", "is", null);
  console.log(`  ${partialCnt ?? "?"}건`);

  // 목록 (10건 미리보기)
  const { data: partialList } = await sb.from("tasks")
    .select("task_no, customer_name, status, partial_reason, partial_memo, product_price, total_amount, principal_id")
    .not("partial_reason", "is", null)
    .order("updated_at", { ascending: false })
    .limit(15);
  (partialList || []).forEach(t => {
    console.log(`    · ${t.task_no} | ${t.customer_name} | status=${t.status} | reason=${t.partial_reason} | pp=${t.product_price}`);
  });

  // B. task_items.qty = 0 인 행을 가진 task 별도 카운트 (partial_reason 없어도)
  sub("[B] task_items.qty = 0 행 가진 task (distinct task 카운트)");
  const { data: zeroItems } = await sb.from("task_items")
    .select("task_id, qty")
    .eq("qty", 0);
  const zeroTaskIds = new Set((zeroItems || []).map(r => r.task_id));
  console.log(`  task_items.qty=0 행      : ${(zeroItems || []).length}건`);
  console.log(`  distinct task            : ${zeroTaskIds.size}건`);

  // C. tasks 행 + qty=0 항목 조회 (target list)
  if (zeroTaskIds.size > 0) {
    sub("[C] qty=0 항목 가진 task 상세 (백필 대상 미리보기, 최대 20건)");
    const ids = [...zeroTaskIds].slice(0, 50);
    const { data: ts } = await sb.from("tasks")
      .select("id, task_no, customer_name, status, partial_reason, product_price, total_amount, principal_id")
      .in("id", ids);
    const tMap = new Map((ts || []).map(t => [t.id, t]));
    const show = [...zeroTaskIds].slice(0, 20);
    show.forEach(id => {
      const t = tMap.get(id);
      if (!t) return;
      console.log(`    · ${t.task_no} | ${t.customer_name} | status=${t.status} | partial_reason=${t.partial_reason || "(NULL)"} | pp=${t.product_price} | total=${t.total_amount}`);
    });
    if (zeroTaskIds.size > 20) console.log(`    ... ${zeroTaskIds.size - 20}건 더`);
  }

  // D. 안효정처럼 customer_paid_amount / net_amount 가 그대로 남아있는지 — qty=0 행에서 두 컬럼 NOT NULL count
  sub("[D] qty=0 행 중 customer_paid_amount NOT NULL or net_amount NOT NULL (반쪽 반영 영향)");
  const { count: leftPaid } = await sb.from("task_items")
    .select("id", { count: "exact", head: true })
    .eq("qty", 0)
    .not("customer_paid_amount", "is", null);
  const { count: leftNet } = await sb.from("task_items")
    .select("id", { count: "exact", head: true })
    .eq("qty", 0)
    .not("net_amount", "is", null);
  console.log(`  qty=0 + customer_paid_amount NOT NULL : ${leftPaid ?? "?"}건  ← 백필 대상`);
  console.log(`  qty=0 + net_amount NOT NULL           : ${leftNet ?? "?"}건  ← 백필 대상`);

  // E. tasks.product_price 와 SUM(qty>0 subtotal) 불일치 카운트 추정 (samples)
  sub("[E] qty=0 항목 가진 task — product_price vs SUM(qty>0 subtotal) 불일치 (5건 샘플)");
  const sampleIds = [...zeroTaskIds].slice(0, 5);
  for (const id of sampleIds) {
    const { data: t } = await sb.from("tasks").select("task_no, product_price, total_amount").eq("id", id).maybeSingle();
    const { data: items } = await sb.from("task_items").select("qty, unit_price, subtotal").eq("task_id", id);
    const liveSum = (items || []).reduce((s, it) => s + Number(it.subtotal || 0), 0);
    const aliveSum = (items || []).filter(it => Number(it.qty) > 0).reduce((s, it) => s + Number(it.subtotal || 0), 0);
    console.log(`  · ${t?.task_no} | pp=${t?.product_price} total=${t?.total_amount} | SUM(all subtotal)=${liveSum} | SUM(qty>0 subtotal)=${aliveSum} | gap=${t?.product_price - aliveSum}`);
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

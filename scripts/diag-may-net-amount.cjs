// 2026-06-01 — 5월 작업 usol_n task_items net_amount 진단 (Q2 — 레거시 신뢰성 확인).
// 분류:
//   행 = task_no 형식 (신 YS-N-260xxx / 구 YS-260xxx / 기타)
//   열 = net_amount 상태 (NULL / 0 / 양수)
// 출력: 개수 + 합계 + 합계 × 0.85 (회사 실입금 환산).
//
// 실행: node scripts/diag-may-net-amount.cjs
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

const TENANT_ID    = "11111111-1111-1111-1111-111111111111";
const PRINCIPAL_ID = "22222222-2222-2222-2222-222222222006"; // usol_n

// KST 2026-05-01 00:00 = UTC 2026-04-30 15:00
// KST 2026-06-01 00:00 = UTC 2026-05-31 15:00
const MAY_START_UTC = "2026-04-30T15:00:00Z";
const MAY_END_UTC   = "2026-05-31T15:00:00Z";

function fmtTaskNo(taskNo) {
  const n = String(taskNo || "");
  if (n.startsWith("YS-N-260")) return "신 (YS-N-260xxx)";
  if (n.startsWith("YS-260"))   return "구 (YS-260xxx)";
  return `기타 (${n.slice(0, 12)}…)`;
}

function netStatusOf(v) {
  if (v == null) return "NULL";
  const n = Number(v);
  if (!isFinite(n)) return "NULL";
  if (n === 0) return "ZERO";
  return "POSITIVE";
}

function pad(s, n) { return String(s).padEnd(n); }
function rpad(s, n) { return String(s).padStart(n); }
function won(n) { return `₩${(Number(n) || 0).toLocaleString()}`; }

(async () => {
  // 1) 5월 KST 완료 usol_n tasks
  const { data: tasks, error: taskErr } = await sb
    .from("tasks")
    .select("id, task_no, completed_at, status")
    .eq("tenant_id", TENANT_ID)
    .eq("principal_id", PRINCIPAL_ID)
    .eq("status", "완료")
    .gte("completed_at", MAY_START_UTC)
    .lt("completed_at", MAY_END_UTC);
  if (taskErr) { console.error("tasks fetch error:", taskErr); process.exit(1); }
  console.log(`usol_n 5월 완료 tasks: ${tasks.length}건`);

  if (tasks.length === 0) { console.log("(데이터 없음)"); return; }

  const taskById = new Map(tasks.map(t => [t.id, t]));
  const taskIds  = tasks.map(t => t.id);

  // 2) task_items (200 chunk)
  const items = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    const { data, error } = await sb
      .from("task_items")
      .select("id, task_id, net_amount, is_canceled, order_type, subtotal, unit_price, qty")
      .in("task_id", taskIds.slice(i, i + 200));
    if (error) { console.error("items fetch error:", error); process.exit(1); }
    if (data) items.push(...data);
  }
  console.log(`task_items 총: ${items.length}건 (취소 item 포함)\n`);

  // 3) 매트릭스 (행 = task_no 형식, 열 = net 상태)
  const cells = {};   // `${fmt}|${ns}` → { count, sum }
  for (const it of items) {
    const t = taskById.get(it.task_id);
    if (!t) continue;
    const fmt = fmtTaskNo(t.task_no);
    const ns  = netStatusOf(it.net_amount);
    const key = `${fmt}|${ns}`;
    if (!cells[key]) cells[key] = { count: 0, sum: 0 };
    cells[key].count += 1;
    cells[key].sum   += Number(it.net_amount) || 0;
  }

  // 4) 출력 매트릭스
  const formats   = ["신 (YS-N-260xxx)", "구 (YS-260xxx)"];
  const allFmts   = [...new Set(items.map(it => fmtTaskNo(taskById.get(it.task_id)?.task_no || "")))];
  for (const f of allFmts) if (!formats.includes(f)) formats.push(f);
  const statuses  = ["NULL", "ZERO", "POSITIVE"];

  console.log("=".repeat(78));
  console.log("매트릭스 (개수 / 합계):");
  console.log("─".repeat(78));
  // header
  console.log(`  ${pad("형식", 22)} | ${pad("상태", 9)} | ${rpad("개수", 6)} | ${rpad("합계", 16)}`);
  console.log("─".repeat(78));
  for (const f of formats) {
    let fmtTotal = { count: 0, sum: 0 };
    for (const s of statuses) {
      const c = cells[`${f}|${s}`] || { count: 0, sum: 0 };
      console.log(`  ${pad(f, 22)} | ${pad(s, 9)} | ${rpad(c.count, 6)} | ${rpad(won(c.sum), 16)}`);
      fmtTotal.count += c.count;
      fmtTotal.sum   += c.sum;
    }
    console.log(`  ${pad(f, 22)} | ${pad("소계", 9)} | ${rpad(fmtTotal.count, 6)} | ${rpad(won(fmtTotal.sum), 16)}`);
    console.log("─".repeat(78));
  }

  // 5) 전체 합계 + 0.85 환산
  const totalCount = items.length;
  const totalSum   = items.reduce((s, it) => s + (Number(it.net_amount) || 0), 0);
  console.log(`전체 task_items 합계: ${totalCount}건 / ${won(totalSum)}`);
  console.log(`전체 × 0.85 (회사 실입금 환산): ${won(Math.round(totalSum * 0.85))}`);

  // 6) 보조 — 취소 item / 미취소 item 분리
  const canceledItems   = items.filter(it => it.is_canceled);
  const activeItems     = items.filter(it => !it.is_canceled);
  const canceledSum     = canceledItems.reduce((s, it) => s + (Number(it.net_amount) || 0), 0);
  const activeSum       = activeItems.reduce((s, it) => s + (Number(it.net_amount) || 0), 0);
  console.log(`\n참고 — task_item.is_canceled 분리:`);
  console.log(`  활성 (is_canceled=false): ${activeItems.length}건 / ${won(activeSum)}`);
  console.log(`  취소 (is_canceled=true):  ${canceledItems.length}건 / ${won(canceledSum)}`);
  console.log(`  활성 × 0.85: ${won(Math.round(activeSum * 0.85))}`);
})().catch(e => { console.error(e); process.exit(1); });

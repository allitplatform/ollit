// 주차별 메인카드(전체 fetch 분배) vs 세부합(주차 단일 fetch 분배) 차이 추적
// 2026-06-15. 옛 버그: subSumByTask 가 각 fetch 마다 다르게 계산됨.
// 신: full task active items subtotal 로 통일 → 모든 주차 차이 0 이어야.

const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const USOL_N_PID = "22222222-2222-2222-2222-222222222006";
const fmt = n => Number(n || 0).toLocaleString('ko-KR');

function distribute(items, principalExclByTask, subSumByTask) {
  let total = 0;
  for (const it of items) {
    const sub = Number(it.subtotal) || 0;
    const taskSub = subSumByTask.get(it.task_id) || 0;
    const taskPrinExcl = principalExclByTask.get(it.task_id) || 0;
    const distPrin = taskSub > 0 ? Math.round(taskPrinExcl * (sub / taskSub)) : 0;
    total += sub - distPrin;
  }
  return total;
}

async function fetchPayments(taskIds) {
  const principalExclByTask = new Map();
  const CHUNK = 300;
  for (let i = 0; i < taskIds.length; i += CHUNK) {
    const ids = taskIds.slice(i, i + CHUNK);
    const { data } = await sb.from("payments")
      .select("task_id, principal_amount, extra_fee")
      .eq("track", "B").in("task_id", ids);
    for (const p of (data || [])) {
      const prin = Number(p.principal_amount) || 0;
      const extra = Number(p.extra_fee) || 0;
      const usolExtra = Math.floor(extra * 0.15);
      principalExclByTask.set(p.task_id, prin - usolExtra);
    }
  }
  return principalExclByTask;
}

async function fetchFullTaskSubtotals(taskIds) {
  const subSumByTask = new Map();
  const CHUNK = 300;
  for (let i = 0; i < taskIds.length; i += CHUNK) {
    const ids = taskIds.slice(i, i + CHUNK);
    const { data } = await sb.from("task_items")
      .select("task_id, subtotal, is_canceled")
      .in("task_id", ids);
    for (const ti of (data || [])) {
      if (ti.is_canceled) continue;
      const v = Number(ti.subtotal) || 0;
      subSumByTask.set(ti.task_id, (subSumByTask.get(ti.task_id) || 0) + v);
    }
  }
  return subSumByTask;
}

function subSumFromWeekItemsOnly(items) {
  const m = new Map();
  for (const it of items) {
    if (!it.task_id) continue;
    const v = Number(it.subtotal) || 0;
    m.set(it.task_id, (m.get(it.task_id) || 0) + v);
  }
  return m;
}

(async () => {
  // 6/8 입금주 (W23) 이후 라이브 데이터 fetch
  const JUN_LIVE_START = "2026-05-31T15:00:00Z";
  let all = [], off = 0;
  while (true) {
    const { data } = await sb.from("task_items")
      .select("id, task_id, naver_settled_at, subtotal, is_canceled, tasks!inner(id, principal_id, status)")
      .eq("tasks.principal_id", USOL_N_PID)
      .not("naver_settled_at", "is", null)
      .gte("naver_settled_at", JUN_LIVE_START)
      .range(off, off + 999);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    off += 1000;
  }
  const active = all.filter(it => !it.is_canceled && it.tasks?.status !== "취소");
  console.log(`라이브 active items (naver_settled >= 6/1): ${active.length}건`);

  // 주차별 그룹 (KST monday)
  function kstYmd(utc) {
    if (!utc) return null;
    const d = new Date(utc);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getTime() + 9*3600*1000).toISOString().slice(0,10);
  }
  function mondayOf(ymd) {
    const [y,m,d] = ymd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m-1, d));
    const dow = dt.getUTCDay();
    const off = dow === 0 ? -6 : 1 - dow;
    dt.setUTCDate(dt.getUTCDate() + off);
    return dt.toISOString().slice(0,10);
  }
  const weekMap = new Map();
  for (const it of active) {
    const ymd = kstYmd(it.naver_settled_at);
    if (!ymd) continue;
    const monday = mondayOf(ymd);
    if (monday < "2026-06-01") continue;
    if (!weekMap.has(monday)) weekMap.set(monday, []);
    weekMap.get(monday).push(it);
  }

  // payments + full task subtotals (전체 task)
  const allTaskIds = [...new Set(active.map(it => it.task_id).filter(Boolean))];
  const principalExclByTask = await fetchPayments(allTaskIds);
  const subSumFull          = await fetchFullTaskSubtotals(allTaskIds);

  console.log('');
  console.log('주차          items   메인(옛 active-only)     세부(주차만)        신규 통일(full)     옛 차이      신 차이');
  console.log('─'.repeat(115));

  const sortedMondays = [...weekMap.keys()].sort();
  for (const monday of sortedMondays) {
    const items = weekMap.get(monday);

    // 옛 메인 카드 산식: subSum 은 active(전체 6월) 기준 = fetchJuneLiveWeeks 옛
    const subSumActiveAll = subSumFromWeekItemsOnly(active);
    const oldMain = distribute(items, principalExclByTask, subSumActiveAll);

    // 옛 세부 산식: subSum 은 그 주차 items 만 = fetchWeekItemsByMonday 옛
    const subSumWeekOnly = subSumFromWeekItemsOnly(items);
    const oldDetail = distribute(items, principalExclByTask, subSumWeekOnly);

    // 신 단일 산식: subSum 은 full task active items 전체 = 통일 후
    const newUnified = distribute(items, principalExclByTask, subSumFull);

    const oldDiff = oldMain - oldDetail;
    const newDiff = oldMain - newUnified;  // 신 vs 옛 메인 변화
    console.log(
      `${monday}    ${String(items.length).padStart(4)}    ` +
      `${fmt(oldMain).padStart(14)}      ${fmt(oldDetail).padStart(14)}    ` +
      `${fmt(newUnified).padStart(14)}    ` +
      `${(oldDiff >= 0 ? '+' : '') + fmt(oldDiff)}    ${(newDiff >= 0 ? '+' : '') + fmt(newDiff)}`
    );
  }

  // 6/8~6/14 specific check (사장님 사례)
  const w23 = weekMap.get("2026-06-08") || [];
  if (w23.length > 0) {
    console.log('');
    console.log('═'.repeat(80));
    console.log('6/8~6/14 주차 (사장님 사례 209건 가정) 세부 비교');
    console.log('═'.repeat(80));
    const subSumActive = subSumFromWeekItemsOnly(active);
    const subSumWeek   = subSumFromWeekItemsOnly(w23);
    const oldMain   = distribute(w23, principalExclByTask, subSumActive);
    const oldDetail = distribute(w23, principalExclByTask, subSumWeek);
    const newUnif   = distribute(w23, principalExclByTask, subSumFull);
    console.log(`  items 수            : ${w23.length}`);
    console.log(`  옛 메인 카드 (전체 active fetch) = ₩${fmt(oldMain)}`);
    console.log(`  옛 세부합 (주차만 fetch)         = ₩${fmt(oldDetail)}`);
    console.log(`  옛 차이                          = ₩${fmt(oldMain - oldDetail)}  (사장님 16,446 와 일치?)`);
    console.log(`  신 통일 (full task active items) = ₩${fmt(newUnif)}  ← 메인 = 세부 일치`);
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

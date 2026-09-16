// 미정산 (작업완료·naver_settled_at NULL) 회사 실수령(85%) 검증
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const USOL_N_PID = "22222222-2222-2222-2222-222222222006";
const fmt = n => Number(n || 0).toLocaleString('ko-KR');

(async () => {
  // usol_n 완료 task_items WHERE naver_settled_at NULL AND subtotal > 0 (PrincipalSettleTab summary 와 동일)
  let all = [], off = 0;
  while (true) {
    const { data } = await sb.from("task_items")
      .select("id, task_id, subtotal, naver_settled_at, is_canceled, tasks!inner(id, principal_id, status)")
      .eq("tasks.principal_id", USOL_N_PID)
      .eq("tasks.status", "완료")
      .is("naver_settled_at", null)
      .gt("subtotal", 0)
      .range(off, off + 999);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    off += 1000;
  }
  const active = all.filter(it => !it.is_canceled);
  console.log(`미정산 active items: ${active.length}`);

  // 옛 산식: Σ subtotal
  const oldSum = active.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  console.log(`\n옛 산식 Σ subtotal           = ₩${fmt(oldSum)}`);

  // 신 산식: task 단위 그룹 → task별 회사 실수령 합
  const taskSubByTask = new Map();
  for (const it of active) {
    if (!it.task_id) continue;
    const v = Number(it.subtotal) || 0;
    taskSubByTask.set(it.task_id, (taskSubByTask.get(it.task_id) || 0) + v);
  }
  let newSum = 0;
  for (const [, taskSub] of taskSubByTask) {
    newSum += taskSub - Math.floor(taskSub * 0.15);
  }
  console.log(`신 산식 회사받을(85%)         = ₩${fmt(newSum)}`);

  // 사장님 기대값
  console.log(`\n사장님 기대값:`);
  console.log(`  옛 정산금(100%)          = ₩26,147,185  → 실제 ₩${fmt(oldSum)}  ${oldSum === 26147185 ? '✓' : '⚠️'}`);
  console.log(`  신 회사받을(85%)         = ₩22,226,482  → 실제 ₩${fmt(newSum)}  ${newSum === 22226482 ? '✓' : '⚠️'}`);
  console.log(`  task 그룹 수             = ${taskSubByTask.size}건 (사장님 318)`);

  // 차이 분석
  const diff = oldSum - newSum;
  const expected15pct = Math.round(oldSum * 0.15);
  console.log(`\n  차이 (옛 − 신) = ₩${fmt(diff)} (≈ 15% of 옛)`);
  console.log(`  oldSum × 0.15  = ₩${fmt(expected15pct)}`);
  console.log(`  task-level FLOOR rounding loss ≈ ₩${fmt(expected15pct - diff)}`);

  // item 단위 분배 방식도 비교
  let itemDist = 0;
  for (const it of active) {
    const sub = Number(it.subtotal) || 0;
    const taskSub = taskSubByTask.get(it.task_id) || 0;
    const taskUsol = Math.floor(taskSub * 0.15);
    const distUsol = taskSub > 0 ? Math.round(taskUsol * (sub / taskSub)) : 0;
    itemDist += sub - distUsol;
  }
  console.log(`\n  item 분배 sum            = ₩${fmt(itemDist)}`);
  console.log(`  task 단위 sum            = ₩${fmt(newSum)}`);
  console.log(`  차이 (item vs task)       = ₩${fmt(itemDist - newSum)} (반올림 잔재)`);

  // payments.principal_excl_extra 직접 사용 (가장 정확)
  const taskIds = [...taskSubByTask.keys()];
  let principalSum = 0;
  for (let i = 0; i < taskIds.length; i += 300) {
    const ids = taskIds.slice(i, i + 300);
    const { data } = await sb.from("payments")
      .select("task_id, principal_amount, extra_fee")
      .eq("track", "B")
      .in("task_id", ids);
    for (const p of (data || [])) {
      const prin  = Number(p.principal_amount) || 0;
      const extra = Number(p.extra_fee)        || 0;
      const prinExcl = prin - Math.floor(extra * 0.15);
      principalSum += prinExcl;
    }
  }
  const realCompany = oldSum - principalSum;
  console.log(`\n  payments principal_excl 합 = ₩${fmt(principalSum)}`);
  console.log(`  oldSum − principal_excl    = ₩${fmt(realCompany)} ← 실제 회사받을`);
  console.log(`  사장님 기대 22,226,482 와 차이 = ₩${fmt(realCompany - 22226482)}`);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

// 5월 track B usol_n engineer 합 정밀 검증 — 사장님 확정값 vs 산식별 결과
// 2026-06-15 (read-only)
//
// 사장님 확정 (DB 기준):
//   · engineer_amount 합 = 63,113,513 (839 payments)
//   · _excl_extra 합     = 62,195,598
//   → 기사 extra 몫 합 (= eng - excl) = 917,915

const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT = '11111111-1111-1111-1111-111111111111';
const fmt = n => Number(n || 0).toLocaleString('ko-KR');
const sec = (s) => { console.log('\n' + '═'.repeat(80)); console.log(s); console.log('═'.repeat(80)); };

(async () => {
  const { data: pUn } = await sb.from('principals').select('id').eq('code', 'usol_n').maybeSingle();
  const usolnId = pUn.id;

  // payments 가져오기 — 한 번에 모두 (tenant 명시)
  let pays = [], off = 0;
  while (true) {
    const { data, error } = await sb.from('payments')
      .select('id, task_id, engineer_amount, extra_fee, tasks!inner(id, task_no, status, completed_at, principal_id, tenant_id)')
      .eq('track', 'B')
      .eq('tasks.principal_id', usolnId)
      .eq('tasks.status', '완료')
      .eq('tasks.tenant_id', TENANT)
      .gte('tasks.completed_at', '2026-05-01T00:00:00+09:00')
      .lt('tasks.completed_at',  '2026-06-01T00:00:00+09:00')
      .range(off, off + 999);
    if (error) { console.log('error:', error.message); break; }
    pays = pays.concat(data || []);
    if (!data || data.length < 1000) break;
    off += 1000;
  }

  // ────────────────────────────────────────
  // [1] payments row 카운트 + task 중복 확인
  // ────────────────────────────────────────
  sec('[1] payments row 카운트 + task 중복 검사');
  console.log(`  payments rows = ${pays.length}건`);
  const taskIds = pays.map(p => p.task_id);
  const uniqueTasks = new Set(taskIds);
  console.log(`  unique task_id = ${uniqueTasks.size}건`);
  console.log(`  중복 여부 = ${taskIds.length === uniqueTasks.size ? '없음 (1:1)' : `있음 (${taskIds.length - uniqueTasks.size} 중복 payment row)`}`);

  // task당 payment 수 분포
  const payByTask = new Map();
  for (const p of pays) {
    if (!payByTask.has(p.task_id)) payByTask.set(p.task_id, []);
    payByTask.get(p.task_id).push(p);
  }
  const multi = [...payByTask.entries()].filter(([, arr]) => arr.length > 1);
  if (multi.length > 0) {
    console.log(`  ⚠️ 중복 payment 있는 task: ${multi.length}건`);
    multi.slice(0, 5).forEach(([tid, arr]) => {
      console.log(`     task ${tid.slice(0,8)} → ${arr.length}건  payment ids: ${arr.map(p => p.id.slice(0,8)).join(' / ')}`);
    });
  }

  // ────────────────────────────────────────
  // [2] 산식별 합계 비교
  // ────────────────────────────────────────
  sec('[2] 산식별 engineer 합계 (5월 track B usol_n)');
  // 산식 A: 모든 payments row 합 (중복 포함)
  const sumA_allRows = pays.reduce((s, p) => s + Number(p.engineer_amount || 0), 0);
  // 산식 B: task 단위 (중복 task는 첫 payment 만)
  const sumB_uniqueTask = [...payByTask.entries()].reduce((s, [, arr]) => s + Number(arr[0].engineer_amount || 0), 0);
  // 산식 C: task 단위 (중복 task는 SUM(payments))
  const sumC_taskSum = [...payByTask.entries()].reduce((s, [, arr]) => s + arr.reduce((ss, p) => ss + Number(p.engineer_amount || 0), 0), 0);

  console.log(`  A. 모든 payments row 합          = ₩${fmt(sumA_allRows)}`);
  console.log(`  B. task 단위 (중복 task → 첫 row) = ₩${fmt(sumB_uniqueTask)}`);
  console.log(`  C. task 단위 (중복 task → SUM)    = ₩${fmt(sumC_taskSum)}`);
  console.log('');
  console.log(`  사장님 확정 engineer_amount      = ₩63,113,513`);
  console.log(`  차이 (A − 사장님)                 = ₩${fmt(sumA_allRows - 63113513)}`);
  console.log(`  차이 (B − 사장님)                 = ₩${fmt(sumB_uniqueTask - 63113513)}`);

  // ────────────────────────────────────────
  // [3] extra_fee 합 + 기사 extra 몫
  // ────────────────────────────────────────
  sec('[3] extra_fee 합 + 기사 extra 몫 (사장님 확정 917,915 검증)');
  // 산식 A 기준 (모든 row)
  const extraA = pays.reduce((s, p) => s + Number(p.extra_fee || 0), 0);
  const engExtraShareA = pays.reduce((s, p) => {
    const ex = Number(p.extra_fee || 0);
    return s + (ex - Math.floor(ex * 0.15));
  }, 0);
  // 산식 B 기준 (unique task, 첫 row)
  const extraB = [...payByTask.entries()].reduce((s, [, arr]) => s + Number(arr[0].extra_fee || 0), 0);
  const engExtraShareB = [...payByTask.entries()].reduce((s, [, arr]) => {
    const ex = Number(arr[0].extra_fee || 0);
    return s + (ex - Math.floor(ex * 0.15));
  }, 0);

  console.log(`  A. extra_fee 합 (all rows)          = ₩${fmt(extraA)}`);
  console.log(`     기사 extra 몫 (= ex − ⌊ex×0.15⌋) = ₩${fmt(engExtraShareA)}`);
  console.log(`  B. extra_fee 합 (unique task)        = ₩${fmt(extraB)}`);
  console.log(`     기사 extra 몫                     = ₩${fmt(engExtraShareB)}`);
  console.log('');
  console.log(`  사장님 확정 기사 extra 몫            = ₩917,915`);
  console.log(`  차이 (A − 사장님)                    = ₩${fmt(engExtraShareA - 917915)}`);
  console.log(`  차이 (B − 사장님)                    = ₩${fmt(engExtraShareB - 917915)}`);

  // ────────────────────────────────────────
  // [4] _excl_extra 합 비교
  // ────────────────────────────────────────
  sec('[4] engineer_excl_extra 합 (사장님 확정 62,195,598)');
  const exclA = sumA_allRows - engExtraShareA;
  const exclB = sumB_uniqueTask - engExtraShareB;
  console.log(`  A. all rows  : ${fmt(sumA_allRows)} − ${fmt(engExtraShareA)} = ₩${fmt(exclA)}`);
  console.log(`  B. unique task: ${fmt(sumB_uniqueTask)} − ${fmt(engExtraShareB)} = ₩${fmt(exclB)}`);
  console.log('');
  console.log(`  사장님 확정     = ₩62,195,598`);
  console.log(`  차이 (A)        = ₩${fmt(exclA - 62195598)}`);
  console.log(`  차이 (B)        = ₩${fmt(exclB - 62195598)}`);

  // ────────────────────────────────────────
  // [5] 옛 내 진단 63,157,513 차이 원인 추적
  // ────────────────────────────────────────
  sec('[5] 옛 내 진단 63,157,513 차이 추적');
  const diff = 63157513 - 63113513;  // 44,000
  console.log(`  옛 진단 (margin-decompose) = ₩63,157,513`);
  console.log(`  사장님 확정              = ₩63,113,513`);
  console.log(`  차이                      = ₩${fmt(diff)}`);
  console.log('');
  console.log('  옛 진단 코드 (diag-usoln-margin-decompose-260614.cjs):');
  console.log(`    pays.reduce((s,p) => s + Number(p.engineer_amount || 0), 0)`);
  console.log(`  → all rows 산식 (= 위 A) = ₩${fmt(sumA_allRows)}`);
  console.log(`  → 이번 ${sumA_allRows === 63113513 ? '일치 (옛 진단이 모순 — payment 1건 빠진 듯)' : '여전히 차이'}`);

  // engineer_amount = 44,000 인 단일 row 가 있나 (스탠드 1건 44K)
  const fortyfour = pays.filter(p => Number(p.engineer_amount) === 44000);
  console.log(`  engineer_amount = 44,000 인 payments: ${fortyfour.length}건`);

  // 6/14 이후 추가 INSERT/UPDATE 가능성
  // payments.computed_at 으로 추적
  const { data: recentComp } = await sb.from('payments')
    .select('id, computed_at, engineer_amount, task_id, tasks!inner(completed_at, principal_id, status)')
    .eq('track', 'B')
    .eq('tasks.principal_id', usolnId)
    .eq('tasks.status', '완료')
    .gte('tasks.completed_at', '2026-05-01T00:00:00+09:00')
    .lt('tasks.completed_at',  '2026-06-01T00:00:00+09:00')
    .gte('computed_at', '2026-06-14T00:00:00+09:00')
    .order('computed_at', { ascending: false })
    .limit(10);
  console.log(`\n  6/14 이후 재계산된 payments: ${(recentComp || []).length}건`);
  (recentComp || []).forEach(p => {
    console.log(`    computed=${p.computed_at?.slice(0,16)}  task=${p.task_id.slice(0,8)}  eng=${fmt(p.engineer_amount)}`);
  });
})().catch(e => { console.error('FATAL:', e.message); console.error(e.stack); process.exit(1); });

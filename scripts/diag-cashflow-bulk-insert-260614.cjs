// 통장 cashflow 일괄 입력 — baseline 4/1 0원 reset + 15 in + 19 out
// 2026-06-14. RPC 경유 (bookkeeping_cashflow_baseline_set + bookkeeping_cashflow_add).
// actor = A004 (77777777-7777-7777-7777-aaaaaaaa0004)

const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT = '11111111-1111-1111-1111-111111111111';
const ACTOR  = '77777777-7777-7777-7777-aaaaaaaa0004';
const fmt = n => Number(n || 0).toLocaleString('ko-KR');

const INFLOWS = [
  ['2026-04-06', 408000,   '유솔 입금'],
  ['2026-04-13', 283606,   '유솔 입금'],
  ['2026-04-20', 1136493,  '유솔 입금'],
  ['2026-04-27', 4879840,  '유솔 입금'],
  ['2026-04-15', 1500000,  '세스코 수수료'],
  ['2026-05-04', 6514822,  '유솔 입금'],
  ['2026-05-11', 19504515, '유솔 입금'],
  ['2026-05-18', 16958937, '유솔 입금'],
  ['2026-05-25', 18790320, '유솔 입금'],
  ['2026-05-15', 6400000,  '세스코 수수료'],
  ['2026-05-15', 970500,   '일정산 마진'],
  ['2026-06-01', 19267868, '유솔 입금'],
  ['2026-06-08', 17320560, '유솔 입금'],
  ['2026-06-15', 3681500,  '일정산 마진'],
  ['2026-05-15', 3050477,  '개인건 수익'],
];

const OUTFLOWS = [
  ['2026-05-15', 353000,   '앱결제'],
  ['2026-05-15', 200000,   '컴퓨터'],
  ['2026-05-15', 5000000,  '사무실계약금'],
  ['2026-05-15', 667700,   '흥일냉동'],
  ['2026-05-15', 2413750,  '유솔트래픽광고'],
  ['2026-05-15', 1683140,  '식대'],
  ['2026-05-15', 59930,    '통신비'],
  ['2026-05-15', 233820,   '관리비'],
  ['2026-05-15', 200000,   '축의금'],
  ['2026-05-15', 3000000,  '동욱 분배'],
  ['2026-05-15', 28375300, '유솔N 기사정산'],
  ['2026-05-30', 1449900,  '유솔N 기사정산'],
  ['2026-06-15', 387600,   '식대'],
  ['2026-06-15', 962500,   '유솔트래픽광고'],
  ['2026-06-15', 3336000,  '전현진 가불'],
  ['2026-06-15', 344798,   '앱결제'],
  ['2026-06-15', 2000000,  '인건비'],
  ['2026-06-15', 4000000,  '동석 분배'],
  ['2026-06-15', 4000000,  '현서 분배'],
];

(async () => {
  // 사전 안전 확인 — 기존 cashflow 행 수
  console.log('═'.repeat(80));
  console.log('[사전 점검] 기존 bookkeeping_cashflow 행 수');
  console.log('═'.repeat(80));
  const { count: existingCnt } = await sb.from('bookkeeping_cashflow')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', TENANT);
  console.log(`  기존 rows = ${existingCnt}`);
  if (existingCnt > 0) {
    console.log('  ⚠️ 기존 cashflow 행이 있음. 추가 입력 전 사장님 확인 필요 — 중단.');
    process.exit(1);
  }

  // 사전 sum 검산
  const inSum  = INFLOWS.reduce((s, [, a]) => s + a, 0);
  const outSum = OUTFLOWS.reduce((s, [, a]) => s + a, 0);
  console.log(`  inflow  ${INFLOWS.length}건 / sum  = ₩${fmt(inSum)}`);
  console.log(`  outflow ${OUTFLOWS.length}건 / sum = ₩${fmt(outSum)}`);
  console.log(`  예상 잔고 (baseline 0 + in - out) = ₩${fmt(inSum - outSum)}`);

  // 1) baseline reset
  console.log('\n' + '═'.repeat(80));
  console.log('[1] baseline reset → 2026-04-01, 0원');
  console.log('═'.repeat(80));
  const { data: bsRes, error: bsErr } = await sb.rpc('bookkeeping_cashflow_baseline_set', {
    p_baseline_date:   '2026-04-01',
    p_baseline_amount: 0,
    p_memo:            '4월 1일 0원 시작',
    p_actor:           ACTOR,
  });
  if (bsErr) { console.error('  ✗ baseline set error:', bsErr.message); process.exit(1); }
  console.log(`  ✓ baseline_set result: ${JSON.stringify(bsRes)}`);

  // 2) inflows
  console.log('\n' + '═'.repeat(80));
  console.log('[2] inflows 입력 (15건)');
  console.log('═'.repeat(80));
  let inOk = 0, inFail = 0;
  for (const [d, amt, memo] of INFLOWS) {
    const { data: r, error } = await sb.rpc('bookkeeping_cashflow_add', {
      p_direction: 'in',
      p_amount:    amt,
      p_flow_date: d,
      p_memo:      memo,
      p_actor:     ACTOR,
    });
    if (error || !r?.ok) {
      console.log(`  ✗ ${d} +${fmt(amt).padStart(12)} ${memo}  | ${error?.message || r?.error}`);
      inFail++;
    } else {
      console.log(`  ✓ ${d} +${fmt(amt).padStart(12)} ${memo}`);
      inOk++;
    }
  }
  console.log(`  → in 입력 결과: ok=${inOk} / fail=${inFail}`);

  // 3) outflows
  console.log('\n' + '═'.repeat(80));
  console.log('[3] outflows 입력 (19건)');
  console.log('═'.repeat(80));
  let outOk = 0, outFail = 0;
  for (const [d, amt, memo] of OUTFLOWS) {
    const { data: r, error } = await sb.rpc('bookkeeping_cashflow_add', {
      p_direction: 'out',
      p_amount:    amt,
      p_flow_date: d,
      p_memo:      memo,
      p_actor:     ACTOR,
    });
    if (error || !r?.ok) {
      console.log(`  ✗ ${d} −${fmt(amt).padStart(12)} ${memo}  | ${error?.message || r?.error}`);
      outFail++;
    } else {
      console.log(`  ✓ ${d} −${fmt(amt).padStart(12)} ${memo}`);
      outOk++;
    }
  }
  console.log(`  → out 입력 결과: ok=${outOk} / fail=${outFail}`);

  // 4) 검증 — summary
  console.log('\n' + '═'.repeat(80));
  console.log('[4] 검증 — bookkeeping_cashflow_summary(\'2026-06\', A004)');
  console.log('═'.repeat(80));
  const { data: sumRes, error: sumErr } = await sb.rpc('bookkeeping_cashflow_summary', {
    p_work_month: '2026-06',
    p_actor:      ACTOR,
  });
  if (sumErr) { console.error('  ✗ summary error:', sumErr.message); process.exit(1); }
  console.log(`  result: ${JSON.stringify(sumRes, null, 2)}`);
  const bal = sumRes?.current_balance;
  const diff = Number(bal) - 62000000;
  console.log(`\n  목표 ₩62,000,000  vs  실제 ₩${fmt(bal)}`);
  console.log(`  차이: ${diff >= 0 ? '+' : ''}₩${fmt(diff)}`);
  if (Math.abs(diff) === 0) console.log('  ✓ 정확히 일치.');
  else if (Math.abs(diff) < 100000) console.log('  ✓ 근사치 일치 (₩10만 미만).');
  else console.log('  ⚠️ 차이 큼 — 확인 필요.');
})().catch(e => { console.error('FATAL:', e.message); console.error(e.stack); process.exit(1); });

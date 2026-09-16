// 유솔N 보정 직접 입력 v2 — 스키마 캐시 리프레시 후 재시도
// 2026-06-14.
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT = '11111111-1111-1111-1111-111111111111';
const ACTOR  = '77777777-7777-7777-7777-aaaaaaaa0004';
const fmt = n => Number(n || 0).toLocaleString('ko-KR');

(async () => {
  // 1) set RPC 시도 (Mig 128 적용됐다면 가장 깔끔한 경로)
  console.log('═'.repeat(70));
  console.log('[A] bookkeeping_set_usoln_adjustment RPC 시도');
  console.log('═'.repeat(70));
  const { data: setRes, error: setErr } = await sb.rpc('bookkeeping_set_usoln_adjustment', {
    p_work_month: '2026-05',
    p_amount:     5223110,
    p_memo:       '4월 작업분 (앱 가동 전, 손계산)',
    p_actor:      ACTOR,
  });
  if (setErr) {
    console.log(`  ✗ RPC 에러: ${setErr.message}`);
    if (/Could not find the function/i.test(setErr.message)) {
      console.log('\n  ⚠️ Mig 128 미적용. 사장님이 Supabase SQL Editor 에서');
      console.log('     db/migrations/127_bookkeeping_usoln_adjustment.sql 실행 →');
      console.log('     db/migrations/128_bookkeeping_usoln_adjustment_rpcs.sql 실행 →');
      console.log('     db/migrations/129_bookkeeping_cumulative_carryover_v2.sql 실행 후');
      console.log('     이 스크립트 재실행. 종료.');
      process.exit(2);
    }
  } else if (setRes?.ok) {
    console.log(`  ✓ RPC upsert ok, id=${setRes.id}`);
  } else {
    console.log(`  ✗ ok=false: ${setRes?.error}`);
  }

  // 2) 행 재조회 (직접 select)
  console.log('\n' + '═'.repeat(70));
  console.log('[B] 행 재조회 (서비스 롤 직접 select)');
  console.log('═'.repeat(70));
  const { data: row, error: getErr } = await sb.from('bookkeeping_usoln_adjustment')
    .select('work_month, amount, memo, created_at, updated_at')
    .eq('tenant_id', TENANT).eq('work_month', '2026-05').maybeSingle();
  if (getErr) {
    console.log(`  ✗ select 에러: ${getErr.message}`);
    process.exit(1);
  }
  if (row) {
    console.log(`  ✓ work_month=${row.work_month}  amount=₩${fmt(row.amount)}  memo="${row.memo}"`);
  } else {
    console.log('  ✗ 행 없음 (RPC 가 안 만들었음)');
    process.exit(1);
  }

  // 3) 누적 RPC 검증
  console.log('\n' + '═'.repeat(70));
  console.log('[C] bookkeeping_cumulative_carryover(\'2026-06\') — usoln_auto/adj 분리 확인');
  console.log('═'.repeat(70));
  const { data: cumRes, error: cumErr } = await sb.rpc('bookkeeping_cumulative_carryover', {
    p_work_month: '2026-06',
    p_actor:      ACTOR,
  });
  if (cumErr) {
    console.log(`  ✗ RPC 에러: ${cumErr.message}`);
    process.exit(1);
  }
  if (!cumRes?.ok) {
    console.log(`  ✗ ok=false: ${cumRes?.error}`);
    process.exit(1);
  }
  const hasSplit = cumRes.monthly?.[0]?.usoln_auto !== undefined;
  console.log(`  Mig 129 v2 적용: ${hasSplit ? '✓ (usoln_auto/adjustment 분리 필드 있음)' : '✗ (v1 — 분리 필드 없음, 129 미적용)'}`);
  (cumRes.monthly || []).forEach(m => {
    const split = hasSplit ? ` (자동=₩${fmt(m.usoln_auto)} + 보정=₩${fmt(m.usoln_adjustment)})` : '';
    console.log(`    ${m.wm}: 유솔N=₩${fmt(m.usoln).padStart(10)}${split}  당월=${m.monthly_diff < 0 ? '−' : ''}₩${fmt(Math.abs(m.monthly_diff))}  누적=${m.cumulative < 0 ? '−' : ''}₩${fmt(Math.abs(m.cumulative))}`);
  });
  const cum = Number(cumRes.cumulative_carryover) || 0;
  console.log(`\n  📦 누적 이월 (6월 종료): ${cum < 0 ? '−' : '+'}₩${fmt(Math.abs(cum))}`);

  const expected = 3785235;
  const diff = cum - expected;
  if (Math.abs(diff) < 5000) {
    console.log(`  ✓ 기대값 +₩${fmt(expected)} 와 일치 (오차 ${diff >= 0 ? '+' : ''}₩${fmt(diff)})`);
  } else {
    console.log(`  ⚠️ 기대값 +₩${fmt(expected)} 와 차이 ${diff >= 0 ? '+' : ''}₩${fmt(diff)}`);
    if (!hasSplit) console.log('     → Mig 129 미적용. v1 RPC는 보정 합산 안 함.');
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

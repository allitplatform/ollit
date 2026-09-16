// 유솔N 보정 — Mig 127/128/129 적용 상태 확인 + 5월 ₩5,223,110 입력 + 검증
// 2026-06-14. RPC 또는 service role 직접 INSERT (fallback).
// actor = A004.

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
  // ───────────────────────────────────────────────
  // [1] Mig 127 — 테이블 존재 확인
  // ───────────────────────────────────────────────
  console.log('═'.repeat(70));
  console.log('[1] Mig 127 — bookkeeping_usoln_adjustment 테이블');
  console.log('═'.repeat(70));
  const { error: tblErr } = await sb.from('bookkeeping_usoln_adjustment')
    .select('id', { count: 'exact', head: true });
  if (tblErr) {
    console.log(`  ✗ 테이블 없음 (Mig 127 미적용): ${tblErr.message}`);
    console.log('  ⚠️ Supabase SQL Editor 에서 Mig 127 먼저 실행 필요. 중단.');
    process.exit(1);
  }
  console.log('  ✓ 테이블 존재');

  // ───────────────────────────────────────────────
  // [2] Mig 128 — RPC 등록 확인 (set RPC 호출)
  // ───────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('[2] Mig 128 — bookkeeping_set_usoln_adjustment RPC');
  console.log('═'.repeat(70));
  // 먼저 get 호출로 RPC 존재 확인 (실제 set 직전에 미리 확인)
  const { data: probeRes, error: probeErr } = await sb.rpc('bookkeeping_get_usoln_adjustment', {
    p_work_month: '2026-05',
    p_actor:      ACTOR,
  });
  let rpcAvailable = !probeErr && probeRes?.ok !== undefined;
  console.log(`  ${rpcAvailable ? '✓' : '✗'} RPC 호출 결과: ${probeErr ? probeErr.message : JSON.stringify(probeRes)}`);

  // ───────────────────────────────────────────────
  // [3] 입력 — RPC 우선, 안 되면 service role 직접 INSERT
  // ───────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('[3] 5월 보정 ₩5,223,110 입력');
  console.log('═'.repeat(70));
  const targetAmount = 5223110;
  const targetMemo   = '4월 작업분 (앱 가동 전, 손계산)';

  if (rpcAvailable) {
    const { data: setRes, error: setErr } = await sb.rpc('bookkeeping_set_usoln_adjustment', {
      p_work_month: '2026-05',
      p_amount:     targetAmount,
      p_memo:       targetMemo,
      p_actor:      ACTOR,
    });
    if (setErr || !setRes?.ok) {
      console.log(`  ✗ RPC 실패: ${setErr?.message || setRes?.error}`);
      console.log('  → service role 직접 INSERT 로 폴백');
      // 폴백: 기존 행 있으면 UPDATE, 없으면 INSERT
      const { data: ex } = await sb.from('bookkeeping_usoln_adjustment')
        .select('id').eq('tenant_id', TENANT).eq('work_month', '2026-05').maybeSingle();
      if (ex) {
        const { error } = await sb.from('bookkeeping_usoln_adjustment')
          .update({ amount: targetAmount, memo: targetMemo, updated_at: new Date().toISOString() })
          .eq('id', ex.id);
        if (error) { console.log(`  ✗ UPDATE 실패: ${error.message}`); process.exit(1); }
        console.log('  ✓ 기존 행 UPDATE 완료');
      } else {
        const { error } = await sb.from('bookkeeping_usoln_adjustment')
          .insert({ tenant_id: TENANT, work_month: '2026-05', amount: targetAmount, memo: targetMemo, created_by: ACTOR });
        if (error) { console.log(`  ✗ INSERT 실패: ${error.message}`); process.exit(1); }
        console.log('  ✓ INSERT 완료');
      }
    } else {
      console.log(`  ✓ RPC upsert ok, id=${setRes.id}`);
    }
  } else {
    console.log('  RPC 사용 불가 → service role 직접 INSERT');
    const { data: ex } = await sb.from('bookkeeping_usoln_adjustment')
      .select('id').eq('tenant_id', TENANT).eq('work_month', '2026-05').maybeSingle();
    if (ex) {
      const { error } = await sb.from('bookkeeping_usoln_adjustment')
        .update({ amount: targetAmount, memo: targetMemo, updated_at: new Date().toISOString() })
        .eq('id', ex.id);
      if (error) { console.log(`  ✗ UPDATE 실패: ${error.message}`); process.exit(1); }
      console.log('  ✓ 기존 행 UPDATE 완료');
    } else {
      const { error } = await sb.from('bookkeeping_usoln_adjustment')
        .insert({ tenant_id: TENANT, work_month: '2026-05', amount: targetAmount, memo: targetMemo, created_by: ACTOR });
      if (error) { console.log(`  ✗ INSERT 실패: ${error.message}`); process.exit(1); }
      console.log('  ✓ INSERT 완료');
    }
  }

  // ───────────────────────────────────────────────
  // [4] 행 재조회 (직접 select)
  // ───────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('[4] 행 재조회');
  console.log('═'.repeat(70));
  const { data: row } = await sb.from('bookkeeping_usoln_adjustment')
    .select('work_month, amount, memo, created_at, updated_at')
    .eq('tenant_id', TENANT).eq('work_month', '2026-05').maybeSingle();
  if (row) {
    console.log(`  ✓ work_month=${row.work_month}  amount=₩${fmt(row.amount)}  memo="${row.memo}"`);
  } else {
    console.log('  ✗ 행 없음');
  }

  // ───────────────────────────────────────────────
  // [5] Mig 129 — 누적 RPC 검증 (2026-06 호출)
  // ───────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('[5] Mig 129 — bookkeeping_cumulative_carryover(\'2026-06\') 검증');
  console.log('═'.repeat(70));
  const { data: cumRes, error: cumErr } = await sb.rpc('bookkeeping_cumulative_carryover', {
    p_work_month: '2026-06',
    p_actor:      ACTOR,
  });
  if (cumErr) {
    console.log(`  ✗ RPC 에러: ${cumErr.message}`);
    console.log('  ⚠️ Mig 129 미적용 가능성. SQL Editor에서 실행 필요.');
    process.exit(1);
  }
  if (!cumRes?.ok) {
    console.log(`  ✗ ok=false: ${cumRes?.error}`);
    process.exit(1);
  }
  console.log(`  ✓ start_month=${cumRes.start_month}  work_month=${cumRes.work_month}`);
  console.log(`  monthly[] ${cumRes.monthly.length}개월:`);
  (cumRes.monthly || []).forEach(m => {
    const hasSplit = m.usoln_auto !== undefined;
    const splitStr = hasSplit ? ` (자동 ₩${fmt(m.usoln_auto)} + 보정 ₩${fmt(m.usoln_adjustment)})` : '';
    console.log(`    ${m.wm}: 일정산=₩${fmt(m.track_a).padStart(10)}  유솔N=₩${fmt(m.usoln).padStart(12)}${splitStr}`);
    console.log(`           기타=₩${fmt(m.other).padStart(10)}  운영비=−₩${fmt(m.expense).padStart(9)}  분배=−₩${fmt(m.distribution).padStart(9)}`);
    console.log(`           당월 차이=${m.monthly_diff < 0 ? '−' : ''}₩${fmt(Math.abs(m.monthly_diff))}  누적=${m.cumulative < 0 ? '−' : ''}₩${fmt(Math.abs(m.cumulative))}`);
  });
  const cum = Number(cumRes.cumulative_carryover) || 0;
  console.log(`\n  📦 누적 이월 (6월 종료 시점): ${cum < 0 ? '−' : '+'}₩${fmt(Math.abs(cum))}`);

  // 기대값: 약 +3,785,235 (5월 −7,617,730 + 6월 +11,402,965)
  const expected = 3785235;
  const diff = cum - expected;
  if (Math.abs(diff) < 5000) {
    console.log(`  ✓ 기대값 ≈ +₩${fmt(expected)} 일치 (오차 ${diff >= 0 ? '+' : ''}₩${fmt(diff)})`);
  } else {
    console.log(`  ⚠️ 기대값 +₩${fmt(expected)} 와 차이 ${diff >= 0 ? '+' : ''}₩${fmt(diff)}`);
  }
})().catch(e => { console.error('FATAL:', e.message); console.error(e.stack); process.exit(1); });

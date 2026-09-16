// 6월 expense 4건 추가 입력 (직전 판단 정정) + placeholder 분배 행 조사
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT = '11111111-1111-1111-1111-111111111111';
const ACTOR  = '77777777-7777-7777-7777-aaaaaaaa0004';
const fmt = n => Number(n || 0).toLocaleString('ko-KR');

const EXP_2026_06 = [
  ['meal',  387600,  '2026-06-15', '식대'],
  ['ad',    962500,  '2026-06-15', '유솔트래픽'],
  ['etc',   344798,  '2026-06-15', '앱결제'],
  ['labor', 2000000, '2026-06-15', '인건비'],
];

(async () => {
  // 추가 입력 전 마지막 확인
  console.log('═'.repeat(60));
  console.log('[입력 직전 6월 expense 카운트]');
  console.log('═'.repeat(60));
  const { data: pre } = await sb.from('bookkeeping_expenses')
    .select('amount, category, memo').eq('tenant_id', TENANT).eq('work_month', '2026-06');
  console.log(`  현재 ${(pre || []).length}건`);
  (pre || []).forEach(r => console.log(`    ${r.category} ₩${fmt(r.amount)} | ${r.memo || ''}`));

  console.log('\n' + '═'.repeat(60));
  console.log('[입력] 6월 expense 4건');
  console.log('═'.repeat(60));
  let ok = 0, fail = 0;
  for (const [cat, amt, d, memo] of EXP_2026_06) {
    const { data: r, error } = await sb.rpc('bookkeeping_add_expense', {
      p_work_month:   '2026-06',
      p_category:     cat,
      p_amount:       amt,
      p_expense_date: d,
      p_memo:         memo,
      p_actor:        ACTOR,
    });
    if (error || !r?.ok) { console.log(`  ✗ ${cat.padEnd(6)} ₩${fmt(amt).padStart(10)} ${memo} | ${error?.message || r?.error}`); fail++; }
    else                  { console.log(`  ✓ ${cat.padEnd(6)} ₩${fmt(amt).padStart(10)} ${memo}`); ok++; }
  }
  console.log(`  → ok=${ok} / fail=${fail}`);

  // placeholder 분배 행 조사
  console.log('\n' + '═'.repeat(60));
  console.log('[조사] 6월 분배 ₩0 placeholder 행');
  console.log('═'.repeat(60));
  const { data: zeroRow } = await sb.from('bookkeeping_distributions')
    .select('id, representative_user_id, amount, memo, created_by, created_at, updated_at, users!representative_user_id(name)')
    .eq('tenant_id', TENANT).eq('work_month', '2026-06').eq('amount', 0);
  (zeroRow || []).forEach(r => {
    console.log(`  id=${r.id}`);
    console.log(`    rep=${r.representative_user_id} (${r.users?.name || '?'})`);
    console.log(`    amount=${r.amount}  memo=${r.memo || '(null)'}`);
    console.log(`    created_by=${r.created_by || '(null)'}`);
    console.log(`    created_at=${r.created_at}   updated_at=${r.updated_at}`);
  });

  // 최종 검증 — 5월 / 6월
  console.log('\n' + '═'.repeat(60));
  console.log('[최종 검증]');
  console.log('═'.repeat(60));
  for (const m of ['2026-05', '2026-06']) {
    const { data: e } = await sb.from('bookkeeping_expenses')
      .select('amount').eq('tenant_id', TENANT).eq('work_month', m);
    const { data: d } = await sb.from('bookkeeping_distributions')
      .select('amount').eq('tenant_id', TENANT).eq('work_month', m);
    const eSum = (e || []).reduce((s, r) => s + Number(r.amount), 0);
    const dSum = (d || []).reduce((s, r) => s + Number(r.amount), 0);
    console.log(`  [${m}] expense ${(e || []).length}건 ₩${fmt(eSum)}  /  distrib ${(d || []).length}건 ₩${fmt(dSum)}`);
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

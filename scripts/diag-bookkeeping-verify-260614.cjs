// 가계부 입력 후 단순 재집계 (join 없이)
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
  // RPC 기반 (RLS bypass + truth)
  for (const m of ['2026-05', '2026-06']) {
    console.log('═'.repeat(60));
    console.log(`[${m}] via RPC`);
    console.log('═'.repeat(60));
    const { data: exp } = await sb.rpc('bookkeeping_list_expenses',     { p_work_month: m, p_actor: ACTOR });
    const { data: dist } = await sb.rpc('bookkeeping_list_distributions', { p_work_month: m, p_actor: ACTOR });
    const eRows = exp?.rows || [];
    const dRows = dist?.rows || [];
    const eSum = eRows.reduce((s,r) => s + Number(r.amount), 0);
    const dSum = dRows.reduce((s,r) => s + Number(r.amount), 0);
    console.log(`  expenses     : ${eRows.length}건 / ₩${fmt(eSum)}`);
    eRows.forEach(r => console.log(`     ${r.expense_date} ${r.category.padEnd(7)} ₩${fmt(r.amount).padStart(12)} | ${r.memo || ''}`));
    console.log(`  distributions: ${dRows.length}건 / ₩${fmt(dSum)}`);
    dRows.forEach(r => console.log(`     rep=${r.representative_user_id?.slice(0,8)} ₩${fmt(r.amount).padStart(10)} | ${r.memo || ''}`));
  }

  // 전체 카운트
  console.log('\n' + '═'.repeat(60));
  console.log('[전체 카운트]');
  console.log('═'.repeat(60));
  const { count: eAll } = await sb.from('bookkeeping_expenses')
    .select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT);
  const { count: dAll } = await sb.from('bookkeeping_distributions')
    .select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT);
  console.log(`  bookkeeping_expenses      전체: ${eAll}건`);
  console.log(`  bookkeeping_distributions 전체: ${dAll}건`);

  // 6월만 직접 select (memo + work_month 정확히 확인)
  console.log('\n' + '═'.repeat(60));
  console.log('[6월 직접 select — work_month 컬럼값 확인]');
  console.log('═'.repeat(60));
  const { data: jun } = await sb.from('bookkeeping_expenses')
    .select('work_month, category, amount, expense_date, memo, created_at')
    .eq('tenant_id', TENANT)
    .gte('expense_date', '2026-06-01')
    .lt('expense_date', '2026-07-01')
    .order('expense_date');
  console.log(`  6월 expense_date 기준 ${(jun || []).length}건`);
  (jun || []).forEach(r => console.log(`    wm=${r.work_month} ${r.expense_date} ${r.category} ₩${fmt(r.amount)} | ${r.memo} (created ${r.created_at?.slice(0,10)})`));

  const { data: junD } = await sb.from('bookkeeping_distributions')
    .select('work_month, representative_user_id, amount, memo, created_at')
    .eq('tenant_id', TENANT);
  console.log(`\n  bookkeeping_distributions 전체 ${(junD || []).length}건`);
  (junD || []).forEach(r => console.log(`    wm=${r.work_month} rep=${r.representative_user_id?.slice(0,8)} ₩${fmt(r.amount)} | ${r.memo}`));
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

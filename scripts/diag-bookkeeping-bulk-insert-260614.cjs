// 가계부 일괄 입력 — bookkeeping_expenses (5월 9건) + bookkeeping_distributions (3건)
// 2026-06-14. RPC 경유. actor = A004.
// 사전 점검: 6월 기존 5건 (사장님 입력) 중복 확인 → 일치하는 4건 skip, 전현진 가불 1건은 보고.

const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT = '11111111-1111-1111-1111-111111111111';
const ACTOR  = '77777777-7777-7777-7777-aaaaaaaa0004';
const fmt = n => Number(n || 0).toLocaleString('ko-KR');

// [5월 운영비] — 전부 신규 입력 (현재 5월 0건)
const EXP_2026_05 = [
  ['etc',   353000,  '2026-05-15', '앱결제'],
  ['etc',   200000,  '2026-05-15', '컴퓨터'],
  ['rent',  5000000, '2026-05-15', '사무실계약금'],
  ['etc',   667700,  '2026-05-15', '흥일냉동'],
  ['ad',    2413750, '2026-05-15', '유솔트래픽'],
  ['meal',  1683140, '2026-05-15', '식대'],
  ['etc',   59930,   '2026-05-15', '통신비'],
  ['etc',   233820,  '2026-05-15', '관리비'],
  ['etc',   200000,  '2026-05-15', '축의금'],
];

// [6월 운영비] — 사장님이 직접 입력한 4건과 모두 일치 → 전부 SKIP. 신규 입력 없음.
// 기존 6월:
//   ad 962,500 / etc 344,798 / labor 2,000,000 / meal 387,600 → user 요청과 일치
//   etc 3,336,000 (전현진 가스값) → user 요청에선 가계부 제외 의도
const EXP_2026_06_DUPCHECK = [
  ['ad',    962500,  '식대 962,500'],
  ['meal',  387600,  '식대 387,600'],
  ['etc',   344798,  '앱결제 344,798'],
  ['labor', 2000000, '인건비 2,000,000'],
];

// [분배] — UNIQUE(tenant, work_month, rep) → set_distribution 가 upsert
const DISTRIBUTIONS = [
  ['2026-05', '77777777-7777-7777-7777-777777770022', 3000000, '조동욱'],
  ['2026-06', '77777777-7777-7777-7777-aaaaaaaa0003', 4000000, '조동석'],
  ['2026-06', '77777777-7777-7777-7777-77777770002b', 4000000, '구현서'],
];

(async () => {
  // ───────────────────────────────────────────────────
  // [사전 점검 A] 5월/6월 기존 expense 행 확인
  // ───────────────────────────────────────────────────
  console.log('═'.repeat(80));
  console.log('[사전 점검 A] 기존 bookkeeping_expenses — 5월 / 6월');
  console.log('═'.repeat(80));
  for (const m of ['2026-05', '2026-06']) {
    const { data: rows } = await sb.from('bookkeeping_expenses')
      .select('category, amount, expense_date, memo')
      .eq('tenant_id', TENANT).eq('work_month', m).order('expense_date');
    const sum = (rows || []).reduce((s, r) => s + Number(r.amount), 0);
    console.log(`  [${m}] ${(rows || []).length}건 / ₩${fmt(sum)}`);
    (rows || []).forEach(r => console.log(`     ${r.expense_date} ${r.category.padEnd(7)} ₩${fmt(r.amount).padStart(12)} | ${r.memo || ''}`));
  }

  // ───────────────────────────────────────────────────
  // [사전 점검 B] 사용자 정보 확인 (A003 / E002 / E022)
  // ───────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80));
  console.log('[사전 점검 B] 분배 대표자 user 존재 확인');
  console.log('═'.repeat(80));
  for (const [, uid, , label] of DISTRIBUTIONS) {
    const { data: u } = await sb.from('users').select('id, name').eq('id', uid).maybeSingle();
    if (u) console.log(`  ✓ ${uid}  → ${u.name} (요청 라벨: ${label})`);
    else   console.log(`  ✗ ${uid}  → NOT FOUND  (요청 라벨: ${label})`);
  }

  // ───────────────────────────────────────────────────
  // [사전 점검 C] 기존 분배 행
  // ───────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80));
  console.log('[사전 점검 C] 기존 bookkeeping_distributions — 5월 / 6월');
  console.log('═'.repeat(80));
  for (const m of ['2026-05', '2026-06']) {
    const { data: rows } = await sb.from('bookkeeping_distributions')
      .select('representative_user_id, amount, memo, users(name)')
      .eq('tenant_id', TENANT).eq('work_month', m);
    console.log(`  [${m}] ${(rows || []).length}건`);
    (rows || []).forEach(r => console.log(`     ${(r.users?.name || '?').padEnd(8)} ₩${fmt(r.amount).padStart(10)} | ${r.memo || ''}`));
  }

  // ───────────────────────────────────────────────────
  // [입력 1] 5월 expense 9건
  // ───────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80));
  console.log('[입력 1] 5월 bookkeeping_expenses — 9건');
  console.log('═'.repeat(80));
  let okE = 0, failE = 0;
  for (const [cat, amt, d, memo] of EXP_2026_05) {
    const { data: r, error } = await sb.rpc('bookkeeping_add_expense', {
      p_work_month:   '2026-05',
      p_category:     cat,
      p_amount:       amt,
      p_expense_date: d,
      p_memo:         memo,
      p_actor:        ACTOR,
    });
    if (error || !r?.ok) { console.log(`  ✗ ${d} ${cat.padEnd(6)} ₩${fmt(amt).padStart(10)} ${memo} | ${error?.message || r?.error}`); failE++; }
    else                  { console.log(`  ✓ ${d} ${cat.padEnd(6)} ₩${fmt(amt).padStart(10)} ${memo}`); okE++; }
  }
  console.log(`  → 결과: ok=${okE} / fail=${failE}`);

  // ───────────────────────────────────────────────────
  // [입력 2] 6월 expense — 사용자 요청 4건 모두 기존과 일치 → SKIP
  // ───────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80));
  console.log('[입력 2] 6월 bookkeeping_expenses — 신규 입력 없음 (기존 일치, SKIP)');
  console.log('═'.repeat(80));
  EXP_2026_06_DUPCHECK.forEach(([cat, amt, label]) => {
    console.log(`  ⊘ skip: ${cat.padEnd(6)} ₩${fmt(amt).padStart(10)} | ${label}`);
  });

  // ───────────────────────────────────────────────────
  // [입력 3] 분배 3건 (set_distribution: upsert)
  // ───────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80));
  console.log('[입력 3] bookkeeping_distributions — 3건 (upsert)');
  console.log('═'.repeat(80));
  let okD = 0, failD = 0;
  for (const [wm, uid, amt, label] of DISTRIBUTIONS) {
    const { data: r, error } = await sb.rpc('bookkeeping_set_distribution', {
      p_work_month:  wm,
      p_rep_user_id: uid,
      p_amount:      amt,
      p_memo:        label,
      p_actor:       ACTOR,
    });
    if (error || !r?.ok) { console.log(`  ✗ ${wm} ${label.padEnd(8)} ₩${fmt(amt).padStart(10)} | ${error?.message || r?.error}`); failD++; }
    else                  { console.log(`  ✓ ${wm} ${label.padEnd(8)} ₩${fmt(amt).padStart(10)}`); okD++; }
  }
  console.log(`  → 결과: ok=${okD} / fail=${failD}`);

  // ───────────────────────────────────────────────────
  // [검증] 입력 후 5월·6월 운영비 / 분배 재집계
  // ───────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80));
  console.log('[검증] 입력 후 재집계');
  console.log('═'.repeat(80));
  for (const m of ['2026-05', '2026-06']) {
    const { data: erows } = await sb.from('bookkeeping_expenses')
      .select('amount').eq('tenant_id', TENANT).eq('work_month', m);
    const { data: drows } = await sb.from('bookkeeping_distributions')
      .select('amount, users(name)').eq('tenant_id', TENANT).eq('work_month', m);
    const esum = (erows || []).reduce((s, r) => s + Number(r.amount), 0);
    const dsum = (drows || []).reduce((s, r) => s + Number(r.amount), 0);
    console.log(`  [${m}]`);
    console.log(`    expenses ${(erows || []).length}건 합계: ₩${fmt(esum)}`);
    console.log(`    distrib  ${(drows || []).length}건 합계: ₩${fmt(dsum)}`);
    (drows || []).forEach(r => console.log(`       ${(r.users?.name || '?').padEnd(8)} ₩${fmt(r.amount).padStart(10)}`));
  }
})().catch(e => { console.error('FATAL:', e.message); console.error(e.stack); process.exit(1); });

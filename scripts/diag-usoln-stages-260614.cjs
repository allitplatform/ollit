// task_items 정산 4단계 컬럼 — 실제 채움 상태 진단 (read-only)
// 2026-06-14.
//
// 컬럼:
//   · naver_settled_at    — 네이버 → 유솔 결제 완료
//   · naver_received_at   — (네이버) 유솔 → 회사 입금
//   · cash_received_at    — (현금) 유솔 → 회사 입금
//   · company_received_at — 회사 입금 완료 (= MAX(naver_received_at, cash_received_at) 자동?)
//   · engineer_settled_at — 회사 → 기사 지급 완료
//
// 4월/5월/6월 usol_n task_items 에서 각 timestamp 의 NOT NULL 비율 측정.

const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const fmt = n => Number(n || 0).toLocaleString('ko-KR');

(async () => {
  const { data: pUn } = await sb.from('principals').select('id').eq('code', 'usol_n').maybeSingle();
  const usolnId = pUn.id;

  const months = [
    { wm: '2026-04', start: '2026-04-01T00:00:00+09:00', end: '2026-05-01T00:00:00+09:00' },
    { wm: '2026-05', start: '2026-05-01T00:00:00+09:00', end: '2026-06-01T00:00:00+09:00' },
    { wm: '2026-06', start: '2026-06-01T00:00:00+09:00', end: '2026-07-01T00:00:00+09:00' },
  ];

  // 컬럼 1개 샘플 확인 (실제 컬럼 존재 여부)
  console.log('═'.repeat(80));
  console.log('[A] task_items 정산 컬럼 샘플 (1행)');
  console.log('═'.repeat(80));
  const { data: sample, error: sErr } = await sb.from('task_items')
    .select('id, subtotal, naver_settled_at, naver_received_at, cash_received_at, company_received_at, engineer_settled_at, net_amount, product_order_id, order_type, tasks!inner(task_no, completed_at, principal_id, status)')
    .eq('tasks.principal_id', usolnId)
    .eq('tasks.status', '완료')
    .gte('tasks.completed_at', '2026-05-01T00:00:00+09:00')
    .lt('tasks.completed_at',  '2026-06-01T00:00:00+09:00')
    .limit(1);
  if (sErr) console.log('  ✗', sErr.message);
  else if (sample && sample[0]) {
    const r = sample[0];
    console.log(`  task=${r.tasks.task_no}  item=${r.id.slice(0,8)}`);
    console.log(`    subtotal=${fmt(r.subtotal)}  order_type=${r.order_type}  product_order_id=${r.product_order_id || '(NULL)'}`);
    console.log(`    naver_settled_at    = ${r.naver_settled_at    || '(NULL)'}`);
    console.log(`    naver_received_at   = ${r.naver_received_at   || '(NULL)'}`);
    console.log(`    cash_received_at    = ${r.cash_received_at    || '(NULL)'}`);
    console.log(`    company_received_at = ${r.company_received_at || '(NULL)'}`);
    console.log(`    engineer_settled_at = ${r.engineer_settled_at || '(NULL)'}`);
    console.log(`    net_amount          = ${r.net_amount != null ? fmt(r.net_amount) : '(NULL)'}`);
  }

  // 월별 4단계 채움 카운트
  console.log('\n' + '═'.repeat(80));
  console.log('[B] 작업월별 (KST) task_items 4단계 채움 카운트 (usol_n track B)');
  console.log('═'.repeat(80));
  for (const m of months) {
    // 그 달 완료 task 의 task_items
    let all = [], off = 0;
    while (true) {
      const { data, error } = await sb.from('task_items')
        .select('subtotal, naver_settled_at, company_received_at, engineer_settled_at, tasks!inner(completed_at, status, principal_id)')
        .eq('tasks.principal_id', usolnId)
        .eq('tasks.status', '완료')
        .gte('tasks.completed_at', m.start)
        .lt('tasks.completed_at',  m.end)
        .range(off, off + 999);
      if (error) { console.log(`  ${m.wm} error:`, error.message); break; }
      all = all.concat(data || []);
      if (!data || data.length < 1000) break;
      off += 1000;
    }
    const n = all.length;
    const sub = all.reduce((s, r) => s + Number(r.subtotal || 0), 0);
    const wait     = all.filter(r => !r.naver_settled_at).length;
    const naver    = all.filter(r => r.naver_settled_at && !r.company_received_at).length;
    const company  = all.filter(r => r.company_received_at && !r.engineer_settled_at).length;
    const engineer = all.filter(r => r.engineer_settled_at).length;
    const naverDone   = all.filter(r => r.naver_settled_at).length;
    const companyDone = all.filter(r => r.company_received_at).length;
    const subWait     = all.filter(r => !r.naver_settled_at).reduce((s, r) => s + Number(r.subtotal || 0), 0);
    const subNaver    = all.filter(r => r.naver_settled_at && !r.company_received_at).reduce((s, r) => s + Number(r.subtotal || 0), 0);
    const subCompany  = all.filter(r => r.company_received_at && !r.engineer_settled_at).reduce((s, r) => s + Number(r.subtotal || 0), 0);
    const subEngineer = all.filter(r => r.engineer_settled_at).reduce((s, r) => s + Number(r.subtotal || 0), 0);
    console.log(`  [${m.wm}]  task_items = ${n}건  subtotal 합 = ₩${fmt(sub)}`);
    console.log(`     ⚪ 대기 (naver X)          : ${String(wait).padStart(4)}건  ₩${fmt(subWait).padStart(12)}`);
    console.log(`     🟡 네이버 결제완료         : ${String(naver).padStart(4)}건  ₩${fmt(subNaver).padStart(12)}  (naver 누적 ${naverDone})`);
    console.log(`     🟠 회사 입금완료 (미지급)  : ${String(company).padStart(4)}건  ₩${fmt(subCompany).padStart(12)}  (company 누적 ${companyDone})`);
    console.log(`     🟢 기사 정산완료           : ${String(engineer).padStart(4)}건  ₩${fmt(subEngineer).padStart(12)}`);
  }

  // 정합성 — 4단계 합 = 전체?
  console.log('\n' + '═'.repeat(80));
  console.log('[C] markTaskItemsField 사용 패턴 — 4단계 단조 증가 가정 확인');
  console.log('═'.repeat(80));
  // 5월 데이터로 검사: naver_settled X 인데 company_received O 인 행 있나? (단조성 위반)
  let bad1 = 0, bad2 = 0, total = 0, off = 0;
  while (true) {
    const { data, error } = await sb.from('task_items')
      .select('naver_settled_at, company_received_at, engineer_settled_at, tasks!inner(principal_id, status, completed_at)')
      .eq('tasks.principal_id', usolnId)
      .eq('tasks.status', '완료')
      .gte('tasks.completed_at', '2026-05-01T00:00:00+09:00')
      .lt('tasks.completed_at',  '2026-07-01T00:00:00+09:00')
      .range(off, off + 999);
    if (error || !data) break;
    data.forEach(r => {
      total++;
      if (!r.naver_settled_at && r.company_received_at) bad1++;
      if (!r.company_received_at && r.engineer_settled_at) bad2++;
    });
    if (data.length < 1000) break;
    off += 1000;
  }
  console.log(`  5+6월 task_items 총 ${total}건`);
  console.log(`  naver X 인데 company O  : ${bad1}건 ${bad1 === 0 ? '✓' : '⚠️'}`);
  console.log(`  company X 인데 engineer O: ${bad2}건 ${bad2 === 0 ? '✓' : '⚠️'}`);

  // 기존 reportEngineerRemit / confirmEngineerRemit (track A) 가 track B 도 쓰는지
  console.log('\n' + '═'.repeat(80));
  console.log('[D] track B payments 의 engineer_remitted_at 채움 여부 (Mig 025 컬럼, track A 용)');
  console.log('═'.repeat(80));
  const { count: trackBTotal } = await sb.from('payments')
    .select('id', { count: 'exact', head: true }).eq('track', 'B');
  const { count: trackBWithEngRemit } = await sb.from('payments')
    .select('id', { count: 'exact', head: true }).eq('track', 'B').not('engineer_remitted_at', 'is', null);
  console.log(`  track B 전체 payments: ${trackBTotal}건`);
  console.log(`  engineer_remitted_at NOT NULL: ${trackBWithEngRemit}건`);
  console.log(`  → ${trackBWithEngRemit === 0 ? '✗ track A 컬럼은 track B 에서 쓰지 않음' : '✓ track B 도 사용'}`);

  // principal_weekly_remittances 와 task_items.company_received_at 매핑
  console.log('\n' + '═'.repeat(80));
  console.log('[E] principal_weekly_remittances confirm → company_received_at 백필 추적');
  console.log('═'.repeat(80));
  const { data: pwr } = await sb.from('principal_weekly_remittances')
    .select('id, week_start, week_end, confirmed_at, remitted_amount')
    .eq('principal_id', usolnId).not('confirmed_at', 'is', null)
    .order('week_start');
  console.log(`  confirmed usol_n 행: ${(pwr || []).length}건`);
  for (const r of (pwr || [])) {
    // 그 주차에 해당하는 task_items 의 company_received_at 패턴 확인
    const ws = r.week_start + "T00:00:00+09:00";
    const we = new Date(new Date(r.week_end + "T00:00:00+09:00").getTime() + 24*3600*1000).toISOString().replace("Z","+00:00");
    const { count: weekItems } = await sb.from('task_items')
      .select('id', { count: 'exact', head: true })
      .gte('naver_settled_at', ws).lt('naver_settled_at', we);
    const { count: weekCompany } = await sb.from('task_items')
      .select('id', { count: 'exact', head: true })
      .gte('naver_settled_at', ws).lt('naver_settled_at', we)
      .not('company_received_at', 'is', null);
    console.log(`    ${r.week_start}~${r.week_end}  remit=${fmt(r.remitted_amount)}  conf=${r.confirmed_at?.slice(0,10)}  items in week=${weekItems}, with company_received_at=${weekCompany}`);
  }
})().catch(e => { console.error('FATAL:', e.message); console.error(e.stack); process.exit(1); });

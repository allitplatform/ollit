// 진단 — 통장 역산 (5/1 ~ 오늘) "모르는 수입" 찾기
// 2026-06-14 (read-only, no DB/code changes)
// 식: 0(시작) + 들어온 돈 − 나간 돈 = 62,000,000
// 차액 = 62,000,000 + 나간 돈 − 아는 들어온 돈

const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT = '11111111-1111-1111-1111-111111111111';
const PERIOD_START = '2026-05-01';
const PERIOD_END   = '2026-06-15';  // exclusive — covers up to 6/14
const TARGET_BAL   = 62_000_000;
const fmt = n => Number(n || 0).toLocaleString('ko-KR');
const line = c => console.log('─'.repeat(c || 80));
const hdr  = s => { console.log('\n' + '═'.repeat(80)); console.log(s); console.log('═'.repeat(80)); };

(async () => {
  console.log(`기간: ${PERIOD_START} ~ ${PERIOD_END} (exclusive) | 목표 통장: ₩${fmt(TARGET_BAL)}`);

  // ───────────────────────────────────────────────────
  // 0) bookkeeping_cashflow_baseline (시작 잔고)
  // ───────────────────────────────────────────────────
  hdr('[0] bookkeeping_cashflow_baseline (시작 잔고)');
  const { data: baseRow } = await sb.from('bookkeeping_cashflow_baseline')
    .select('baseline_date, baseline_amount, memo')
    .eq('tenant_id', TENANT)
    .maybeSingle();
  if (baseRow) {
    console.log(`  baseline_date  = ${baseRow.baseline_date}`);
    console.log(`  baseline_amount= ₩${fmt(baseRow.baseline_amount)}`);
    console.log(`  memo           = ${baseRow.memo || '(none)'}`);
  } else {
    console.log('  (baseline 미입력 — 0으로 가정)');
  }

  // ───────────────────────────────────────────────────
  // 1) bookkeeping_cashflow (수동 입력 in/out)
  // ───────────────────────────────────────────────────
  hdr('[1] bookkeeping_cashflow — 수동 입력 (5/1 ~ 6/14)');
  const { data: cfRows } = await sb.from('bookkeeping_cashflow')
    .select('direction, amount, flow_date, memo')
    .eq('tenant_id', TENANT)
    .gte('flow_date', PERIOD_START)
    .lt('flow_date', PERIOD_END)
    .order('flow_date');
  let cfIn = 0, cfOut = 0;
  console.log(`  rows: ${(cfRows || []).length}`);
  (cfRows || []).forEach(r => {
    const sign = r.direction === 'in' ? '+' : '−';
    console.log(`    ${r.flow_date} ${sign}${String(fmt(r.amount)).padStart(12)} | ${r.memo || ''}`);
    if (r.direction === 'in') cfIn += Number(r.amount); else cfOut += Number(r.amount);
  });
  console.log(`  SUM in : ₩${fmt(cfIn)}`);
  console.log(`  SUM out: ₩${fmt(cfOut)}`);

  // ───────────────────────────────────────────────────
  // 2) principal_weekly_remittances — confirmed_at in period
  //    (원청 → 회사 주간 입금, "입금 확인" 완료된 것만)
  // ───────────────────────────────────────────────────
  hdr('[2] principal_weekly_remittances — confirmed in 5/1~6/14');
  const { data: pwrRows } = await sb.from('principal_weekly_remittances')
    .select('principal_id, week_start, week_end, remitted_amount, remitted_at, confirmed_at, principals(code, name)')
    .gte('confirmed_at', PERIOD_START + 'T00:00:00+09:00')
    .lt('confirmed_at', PERIOD_END + 'T00:00:00+09:00')
    .not('confirmed_at', 'is', null)
    .order('confirmed_at');
  const pwrByPrin = {};
  let pwrTotal = 0;
  (pwrRows || []).forEach(r => {
    const code = r.principals?.code || '?';
    pwrByPrin[code] = (pwrByPrin[code] || 0) + Number(r.remitted_amount);
    pwrTotal += Number(r.remitted_amount);
  });
  console.log(`  confirmed rows: ${(pwrRows || []).length}`);
  Object.entries(pwrByPrin).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
    console.log(`    ${k.padEnd(10)} ₩${fmt(v).padStart(15)}`);
  });
  console.log(`  SUM confirmed : ₩${fmt(pwrTotal)}`);

  // 보고만 되고 확인 안 된 것 (참고)
  const { data: pwrPend } = await sb.from('principal_weekly_remittances')
    .select('remitted_amount, principals(code)')
    .gte('remitted_at', PERIOD_START + 'T00:00:00+09:00')
    .lt('remitted_at', PERIOD_END + 'T00:00:00+09:00')
    .is('confirmed_at', null);
  const pwrPendSum = (pwrPend || []).reduce((s, r) => s + Number(r.remitted_amount), 0);
  console.log(`  (참고) reported but unconfirmed: ${(pwrPend || []).length}건, ₩${fmt(pwrPendSum)}`);

  // ───────────────────────────────────────────────────
  // 3) payments — track A 기사→회사 일정산 (engineer_remit_confirmed in period)
  // ───────────────────────────────────────────────────
  hdr('[3] payments track A — engineer_remit_confirmed in 5/1~6/14 (기사→회사 일정산)');
  let paAll = [];
  let paOffset = 0;
  while (true) {
    const { data, error } = await sb.from('payments')
      .select('task_id, engineer_amount, principal_amount, owner_amount, engineer_remit_confirmed_at, tasks!inner(principal_id, principals(code))')
      .eq('track', 'A')
      .gte('engineer_remit_confirmed_at', PERIOD_START + 'T00:00:00+09:00')
      .lt('engineer_remit_confirmed_at', PERIOD_END + 'T00:00:00+09:00')
      .range(paOffset, paOffset + 999);
    if (error) { console.log('  error:', error.message); break; }
    paAll = paAll.concat(data || []);
    if (!data || data.length < 1000) break;
    paOffset += 1000;
  }
  const paByPrin = {};
  let paPrincipalSum = 0, paEngineerSum = 0, paOwnerSum = 0;
  paAll.forEach(p => {
    const code = p.tasks?.principals?.code || '?';
    if (!paByPrin[code]) paByPrin[code] = { cnt: 0, prin: 0, eng: 0, own: 0 };
    paByPrin[code].cnt++;
    paByPrin[code].prin += Number(p.principal_amount || 0);
    paByPrin[code].eng  += Number(p.engineer_amount || 0);
    paByPrin[code].own  += Number(p.owner_amount    || 0);
    paPrincipalSum += Number(p.principal_amount || 0);
    paEngineerSum  += Number(p.engineer_amount  || 0);
    paOwnerSum     += Number(p.owner_amount     || 0);
  });
  console.log(`  rows: ${paAll.length}`);
  console.log(`  ${'principal'.padEnd(10)} ${'cnt'.padStart(5)} ${'prin_sum'.padStart(15)} ${'eng_sum'.padStart(15)} ${'own_sum'.padStart(15)}`);
  Object.entries(paByPrin).sort((a,b) => b[1].prin - a[1].prin).forEach(([k,v]) => {
    console.log(`  ${k.padEnd(10)} ${String(v.cnt).padStart(5)} ${fmt(v.prin).padStart(15)} ${fmt(v.eng).padStart(15)} ${fmt(v.own).padStart(15)}`);
  });
  console.log(`  TOTAL      ${String(paAll.length).padStart(5)} ${fmt(paPrincipalSum).padStart(15)} ${fmt(paEngineerSum).padStart(15)} ${fmt(paOwnerSum).padStart(15)}`);
  console.log(`  ↑ 통장 inflow 기준 = principal_amount 또는 engineer_amount? (운영 방식 확인 필요)`);

  // ───────────────────────────────────────────────────
  // 4) usol_n track B — 월정산 inflow (4월 작업분 = 5/15 입금)
  // ───────────────────────────────────────────────────
  hdr('[4] usol_n track B — 4월 작업 완료분 (5/15 입금됨) + 5월 작업 (6/15 예정)');
  // 4월 작업 (KST 2026-04-01 ~ 2026-05-01)
  const aprStart = '2026-04-01T00:00:00+09:00';
  const mayStart = '2026-05-01T00:00:00+09:00';
  const junStart = '2026-06-01T00:00:00+09:00';

  async function sumUsolnB(fromISO, toISO) {
    const { data: pUn } = await sb.from('principals').select('id').eq('code', 'usol_n').maybeSingle();
    if (!pUn) return { rows: [], prin: 0, eng: 0, own: 0 };
    let all = [], off = 0;
    while (true) {
      const { data, error } = await sb.from('payments')
        .select('engineer_amount, principal_amount, owner_amount, tasks!inner(completed_at, status, principal_id)')
        .eq('track', 'B')
        .eq('tasks.principal_id', pUn.id)
        .eq('tasks.status', '완료')
        .gte('tasks.completed_at', fromISO)
        .lt('tasks.completed_at', toISO)
        .range(off, off + 999);
      if (error) { console.log('  error:', error.message); break; }
      all = all.concat(data || []);
      if (!data || data.length < 1000) break;
      off += 1000;
    }
    const prin = all.reduce((s,p) => s + Number(p.principal_amount || 0), 0);
    const eng  = all.reduce((s,p) => s + Number(p.engineer_amount  || 0), 0);
    const own  = all.reduce((s,p) => s + Number(p.owner_amount     || 0), 0);
    return { rows: all, prin, eng, own };
  }

  const apr = await sumUsolnB(aprStart, mayStart);
  console.log(`  4월 (5/15 입금 대상): ${apr.rows.length}건`);
  console.log(`    principal_amount  ₩${fmt(apr.prin)}  ← 회사 통장에 들어온 총액(usol→회사)`);
  console.log(`    engineer_amount   ₩${fmt(apr.eng)}   ← 회사가 기사에게 지급한 총액(나간 돈)`);
  console.log(`    owner_amount      ₩${fmt(apr.own)}   ← 회사 마진`);

  const may = await sumUsolnB(mayStart, junStart);
  console.log(`\n  5월 (6/15 입금 예정 — 제외): ${may.rows.length}건`);
  console.log(`    principal_amount  ₩${fmt(may.prin)}  (참고만, 입금 예정이라 계산 제외)`);
  console.log(`    engineer_amount   ₩${fmt(may.eng)}`);
  console.log(`    owner_amount      ₩${fmt(may.own)}`);

  // ───────────────────────────────────────────────────
  // 5) bookkeeping_expenses + distributions (운영비/분배)
  // ───────────────────────────────────────────────────
  hdr('[5] bookkeeping_expenses + distributions (5월 + 6월)');
  const months = ['2026-05', '2026-06'];
  let bkExpTotal = 0, bkDistTotal = 0;
  for (const m of months) {
    const { data: exps } = await sb.from('bookkeeping_expenses')
      .select('category, amount, expense_date, memo')
      .eq('tenant_id', TENANT)
      .eq('work_month', m);
    const { data: dists } = await sb.from('bookkeeping_distributions')
      .select('representative_user_id, amount, memo, users(name)')
      .eq('tenant_id', TENANT)
      .eq('work_month', m);
    const expSum  = (exps  || []).reduce((s,r) => s + Number(r.amount), 0);
    const distSum = (dists || []).reduce((s,r) => s + Number(r.amount), 0);
    bkExpTotal  += expSum;
    bkDistTotal += distSum;
    console.log(`  [${m}]`);
    console.log(`    expenses:      ${(exps  || []).length}건  ₩${fmt(expSum)}`);
    (exps  || []).forEach(r => console.log(`       ${r.expense_date} ${r.category.padEnd(8)} ₩${fmt(r.amount).padStart(12)} | ${r.memo || ''}`));
    console.log(`    distributions: ${(dists || []).length}건  ₩${fmt(distSum)}`);
    (dists || []).forEach(r => console.log(`       ${(r.users?.name || '?').padEnd(8)} ₩${fmt(r.amount).padStart(12)} | ${r.memo || ''}`));
  }
  console.log(`  SUM expenses (5월+6월):       ₩${fmt(bkExpTotal)}`);
  console.log(`  SUM distributions (5월+6월):  ₩${fmt(bkDistTotal)}`);

  // ───────────────────────────────────────────────────
  // 6) 종합 — 역산 표
  // ───────────────────────────────────────────────────
  hdr('[6] 종합 — 통장 역산표');
  console.log('');
  console.log('  ▶ 들어온 돈 (DB 기준)');
  console.log(`    a. bookkeeping_cashflow in   ₩${fmt(cfIn).padStart(15)}`);
  console.log(`    b. 원청 주간 송금(확인)       ₩${fmt(pwrTotal).padStart(15)}  [principal_weekly_remittances]`);
  console.log(`    c. 일정산 track A — prin     ₩${fmt(paPrincipalSum).padStart(15)}  [payments principal_amount 기준]`);
  console.log(`    c'. 일정산 track A — eng     ₩${fmt(paEngineerSum).padStart(15)}   [payments engineer_amount 기준]`);
  console.log(`    d. usol_n B 4월 (5/15 입금)  ₩${fmt(apr.prin).padStart(15)}  [usol → 회사 통장 총액]`);
  console.log(`    e. 세스코 수수료 (5/15)       ₩${fmt(5769000).padStart(15)}  [사장님 제공]`);
  console.log('');
  console.log('  ▶ 나간 돈');
  console.log(`    f. bookkeeping_cashflow out  ₩${fmt(cfOut).padStart(15)}`);
  console.log(`    g. usol_n B 4월 → 기사 지급  ₩${fmt(apr.eng).padStart(15)}  [4월 작업분 5/15·5/30 출금?]`);
  console.log(`    h. bookkeeping_expenses      ₩${fmt(bkExpTotal).padStart(15)}  [5+6월]`);
  console.log(`    i. bookkeeping_distributions ₩${fmt(bkDistTotal).padStart(15)}  [5+6월]`);
  console.log(`    j. 사장님 제공 운영비 합계    ₩${fmt(28842238).padStart(15)}  [중복 가능 — h/i와 비교]`);
  console.log(`    k. 사장님 제공 유솔N기사 합   ₩${fmt(29825200).padStart(15)}  [중복 가능 — g와 비교]`);

  // 시나리오 1: principal_amount 기준
  const inflowScenario1 = cfIn + pwrTotal + paPrincipalSum + apr.prin + 5769000;
  const outflowDB = cfOut + apr.eng + bkExpTotal + bkDistTotal;
  const outflowOwner = cfOut + 28842238 + 29825200;

  hdr('[7] 차액 계산');
  console.log(`  목표 통장: ₩${fmt(TARGET_BAL)}`);
  console.log('');
  console.log('  시나리오 A — 들어온 돈(track A principal 기준) + 나간 돈(DB 기준)');
  console.log(`    inflow  = a+b+c+d+e = ₩${fmt(inflowScenario1)}`);
  console.log(`    outflow = f+g+h+i   = ₩${fmt(outflowDB)}`);
  console.log(`    예상 잔고 = inflow − outflow = ₩${fmt(inflowScenario1 - outflowDB)}`);
  console.log(`    차액(모르는 수입) = ${TARGET_BAL} + outflow − inflow = ₩${fmt(TARGET_BAL + outflowDB - inflowScenario1)}`);
  console.log('');
  console.log('  시나리오 B — 들어온 돈(track A engineer 기준) + 나간 돈(DB)');
  const inflowScenario2 = cfIn + pwrTotal + paEngineerSum + apr.prin + 5769000;
  console.log(`    inflow  = a+b+c'+d+e = ₩${fmt(inflowScenario2)}`);
  console.log(`    outflow = f+g+h+i    = ₩${fmt(outflowDB)}`);
  console.log(`    예상 잔고 = ₩${fmt(inflowScenario2 - outflowDB)}`);
  console.log(`    차액 = ₩${fmt(TARGET_BAL + outflowDB - inflowScenario2)}`);
  console.log('');
  console.log('  시나리오 C — 들어온 돈(track A principal) + 나간 돈(사장님 제공)');
  console.log(`    inflow  = a+b+c+d+e   = ₩${fmt(inflowScenario1)}`);
  console.log(`    outflow = f+j+k       = ₩${fmt(outflowOwner)}`);
  console.log(`    예상 잔고 = ₩${fmt(inflowScenario1 - outflowOwner)}`);
  console.log(`    차액 = ₩${fmt(TARGET_BAL + outflowOwner - inflowScenario1)}`);
  console.log('');
  console.log('  ⚠️ 차액 ≈ 0이면 다 설명됨. 큰 양수면 빠진 inflow 또는 잘못 계산한 outflow.');
})().catch(e => { console.error("FATAL:", e.message); console.error(e.stack); process.exit(1); });

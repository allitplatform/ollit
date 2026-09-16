// 유솔N 정산 현황판 — 데이터 가용성 진단 (read-only, 변경 X)
// 2026-06-14.
//
// 목표 화면(설계 X) 위한 데이터 점검:
//   작업월(2026-04 / 2026-05 / 2026-06)별로
//     · 총 배분금액 (유솔→회사) — principal_amount 또는 다른 소스
//     · 받은 거 / 받을 거 (입금 완료 vs 예정)
//     · 기사 줄 총액 / 준 거 / 줄 거 (engineer_amount + 상태)
//     · 회사 마진 (owner_amount, track B)
//   가 DB에서 나오는지.

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
  // ───────────────────────────────────────────────
  // [1] payments 테이블 — track B usol_n 샘플 row (컬럼/스키마 파악)
  // ───────────────────────────────────────────────
  sec('[1] payments 컬럼 + track B usol_n 샘플 row (1건)');
  const { data: pUn } = await sb.from('principals').select('id').eq('code', 'usol_n').maybeSingle();
  if (!pUn) { console.log('  ✗ usol_n principal 없음. 중단.'); process.exit(1); }
  const usolnId = pUn.id;
  const { data: sample } = await sb.from('payments')
    .select('*, tasks!inner(id, task_no, status, completed_at, principal_id)')
    .eq('track', 'B')
    .eq('tasks.principal_id', usolnId)
    .eq('tasks.status', '완료')
    .order('id', { ascending: false })
    .limit(1);
  if (sample && sample[0]) {
    const r = sample[0];
    console.log('  payments 컬럼:');
    Object.entries(r).filter(([k]) => k !== 'tasks').forEach(([k, v]) => {
      console.log(`    ${k.padEnd(28)} ${v === null ? '(NULL)' : typeof v === 'object' ? JSON.stringify(v) : v}`);
    });
    console.log('  tasks (joined):');
    Object.entries(r.tasks).forEach(([k, v]) => {
      console.log(`    ${k.padEnd(28)} ${v === null ? '(NULL)' : v}`);
    });
  } else {
    console.log('  ✗ track B usol_n 완료 샘플 0건');
  }

  // ───────────────────────────────────────────────
  // [2] usol_n track B — 작업월별 (KST completed_at 기준) 합산
  // ───────────────────────────────────────────────
  sec('[2] usol_n track B — 작업월별 집계 (completed_at KST)');
  const months = [
    { wm: '2026-04', start: '2026-04-01T00:00:00+09:00', end: '2026-05-01T00:00:00+09:00' },
    { wm: '2026-05', start: '2026-05-01T00:00:00+09:00', end: '2026-06-01T00:00:00+09:00' },
    { wm: '2026-06', start: '2026-06-01T00:00:00+09:00', end: '2026-07-01T00:00:00+09:00' },
  ];
  const monthSummary = [];
  for (const m of months) {
    // 페이징으로 모두 가져옴
    let all = [], off = 0;
    while (true) {
      const { data, error } = await sb.from('payments')
        .select('engineer_amount, principal_amount, owner_amount, engineer_remitted_at, engineer_remit_confirmed_at, tasks!inner(completed_at, status, principal_id)')
        .eq('track', 'B')
        .eq('tasks.principal_id', usolnId)
        .eq('tasks.status', '완료')
        .gte('tasks.completed_at', m.start)
        .lt('tasks.completed_at', m.end)
        .range(off, off + 999);
      if (error) { console.log(`  ${m.wm} fetch error:`, error.message); break; }
      all = all.concat(data || []);
      if (!data || data.length < 1000) break;
      off += 1000;
    }
    const cnt = all.length;
    const prin = all.reduce((s, r) => s + Number(r.principal_amount || 0), 0);
    const eng  = all.reduce((s, r) => s + Number(r.engineer_amount  || 0), 0);
    const own  = all.reduce((s, r) => s + Number(r.owner_amount     || 0), 0);
    // engineer_remitted_at NOT NULL 비율 (track A 용 컬럼이 track B에서 쓰이는지 확인)
    const remitted    = all.filter(r => !!r.engineer_remitted_at).length;
    const confirmed   = all.filter(r => !!r.engineer_remit_confirmed_at).length;
    console.log(`  [${m.wm}] 완료 task = ${cnt}건`);
    console.log(`     principal_amount 합   = ₩${fmt(prin)}`);
    console.log(`     engineer_amount  합   = ₩${fmt(eng)}`);
    console.log(`     owner_amount     합   = ₩${fmt(own)}`);
    console.log(`     engineer_remitted_at NOT NULL: ${remitted}/${cnt}  (track A 컬럼, B 에 의미 있나?)`);
    console.log(`     engineer_remit_confirmed_at  : ${confirmed}/${cnt}`);
    monthSummary.push({ wm: m.wm, cnt, prin, eng, own });
  }

  // 상호 비교
  console.log('\n  ── 항등식 확인 (각 task: principal_amount =? engineer_amount + owner_amount?)');
  let off = 0; const eqOK = []; const eqNG = [];
  while (true) {
    const { data, error } = await sb.from('payments')
      .select('engineer_amount, principal_amount, owner_amount, tasks!inner(completed_at, status, principal_id)')
      .eq('track', 'B')
      .eq('tasks.principal_id', usolnId)
      .eq('tasks.status', '완료')
      .gte('tasks.completed_at', '2026-04-01T00:00:00+09:00')
      .lt('tasks.completed_at', '2026-07-01T00:00:00+09:00')
      .range(off, off + 999);
    if (error || !data) break;
    data.forEach(r => {
      const p = Number(r.principal_amount || 0);
      const e = Number(r.engineer_amount  || 0);
      const o = Number(r.owner_amount     || 0);
      if (Math.abs(p - (e + o)) < 1) eqOK.push({ p, e, o });
      else eqNG.push({ p, e, o, diff: p - e - o });
    });
    if (data.length < 1000) break;
    off += 1000;
  }
  console.log(`     p = e + o : ${eqOK.length} 일치 / ${eqNG.length} 불일치`);
  if (eqNG.length > 0) {
    console.log('     불일치 분포 (다른 항등식 가능):');
    const exNG = eqNG.slice(0, 3);
    exNG.forEach(r => console.log(`       p=${fmt(r.p)} e=${fmt(r.e)} o=${fmt(r.o)}  (diff=${fmt(r.diff)})`));
  }

  // ───────────────────────────────────────────────
  // [3] "받은 거 / 받을 거" — 유솔→회사 입금 추적
  // ───────────────────────────────────────────────
  sec('[3] 유솔→회사 입금 추적 (받은 거 vs 받을 거)');
  // 후보 1: principal_weekly_remittances (주간 정산 보고)
  console.log('  ▶ principal_weekly_remittances (usol_n)');
  const { data: pwr } = await sb.from('principal_weekly_remittances')
    .select('week_start, week_end, remitted_amount, remitted_at, confirmed_at, note')
    .eq('principal_id', usolnId)
    .order('week_start');
  if (!pwr || pwr.length === 0) {
    console.log('    ✗ usol_n 행 0건');
  } else {
    pwr.forEach(r => {
      const status = r.confirmed_at ? '✓확인' : (r.remitted_at ? '보고만' : '예정');
      console.log(`    ${r.week_start} ~ ${r.week_end}  ₩${fmt(r.remitted_amount).padStart(12)}  ${status}  | ${r.note || ''}`);
    });
  }
  console.log(`    ⚠️ 이 테이블은 주간 단위 → 유솔N "월정산" 과 매칭되는지 의문 (주차 합 = 월정산 ?)`);

  // 후보 2: bookkeeping_cashflow 의 "유솔 입금" 메모 합 (cashflow 직접)
  console.log('\n  ▶ bookkeeping_cashflow direction=in + memo LIKE "%유솔%"');
  const { data: cf } = await sb.from('bookkeeping_cashflow')
    .select('flow_date, amount, memo')
    .eq('tenant_id', TENANT).eq('direction', 'in')
    .like('memo', '%유솔%')
    .order('flow_date');
  if (!cf || cf.length === 0) console.log('    ✗ 행 0건');
  else cf.forEach(r => console.log(`    ${r.flow_date}  +₩${fmt(r.amount).padStart(12)}  ${r.memo}`));
  const cfSum = (cf || []).reduce((s, r) => s + Number(r.amount), 0);
  console.log(`    소계: ₩${fmt(cfSum)}`);

  // ───────────────────────────────────────────────
  // [4] "기사 줄/준/줄 거" — engineer outflow 추적
  // ───────────────────────────────────────────────
  sec('[4] 회사→기사 지급 추적 (줄 총액 / 준 거 / 줄 거)');
  // 후보 1: payments 에 settled_at / paid_at 같은 컬럼 있는지 — 위 [1] 컬럼 덤프에서 확인됨
  console.log('  ▶ payments 의 status 컬럼은 위 [1] 참고. track B 용 "지급 완료" 플래그 있나?');

  // 후보 2: bookkeeping_cashflow 의 "유솔N 기사정산" / "기사" memo
  console.log('\n  ▶ bookkeeping_cashflow direction=out + memo LIKE "%기사정산%"');
  const { data: cfOut } = await sb.from('bookkeeping_cashflow')
    .select('flow_date, amount, memo')
    .eq('tenant_id', TENANT).eq('direction', 'out')
    .like('memo', '%기사정산%')
    .order('flow_date');
  if (!cfOut || cfOut.length === 0) console.log('    ✗ 행 0건');
  else cfOut.forEach(r => console.log(`    ${r.flow_date}  −₩${fmt(r.amount).padStart(12)}  ${r.memo}`));
  const cfOutSum = (cfOut || []).reduce((s, r) => s + Number(r.amount), 0);
  console.log(`    소계: ₩${fmt(cfOutSum)}`);

  // ───────────────────────────────────────────────
  // [5] 회사 마진 — owner_amount (Mig 123 RPC 와 동일 로직, 작업월 그 달)
  // ───────────────────────────────────────────────
  sec('[5] 회사 마진 (owner_amount, track B)');
  monthSummary.forEach(m => {
    console.log(`  [${m.wm} 작업 완료분]  ${m.cnt}건  마진 = ₩${fmt(m.own)}`);
  });

  // ───────────────────────────────────────────────
  // [6] 4월 데이터 가용성 (앱 5월 말부터 가동) — 4월 = 0건 예상
  // ───────────────────────────────────────────────
  sec('[6] 4월 작업 데이터 가용성');
  const apr = monthSummary.find(m => m.wm === '2026-04');
  if (apr && apr.cnt === 0) {
    console.log('  ✗ 2026-04 작업 완료 0건 (앱 가동 전, DB 비어있음 — 손계산 보정 필요)');
  } else if (apr) {
    console.log(`  ✓ 2026-04 작업 ${apr.cnt}건 존재 — 자동 계산 가능`);
  }

  // ───────────────────────────────────────────────
  // [7] 정산 현황판에 필요한 4개 숫자 — 자동/수동 분류
  // ───────────────────────────────────────────────
  sec('[7] 정산 현황판 데이터 가용성 종합');
  const rows = [
    ['총 배분 (유솔→회사)',          '?',  'principal_amount 또는 사장님 손계산. 항등식(p=e+o) 검증 필요'],
    ['받은 거 (입금 완료)',          '✓',  'bookkeeping_cashflow direction=in memo~"유솔" 합'],
    ['받을 거 (예정)',               '?',  '총 배분 − 받은 거. "총 배분" 정의 명확화 필요'],
    ['기사 줄 총액',                  '✓',  'SUM(engineer_amount) track B usol_n by 작업월'],
    ['기사 준 거',                   '✓',  'bookkeeping_cashflow direction=out memo~"기사정산"'],
    ['기사 줄 거 (미지급)',          '?',  '총 줄 − 준 거 (cashflow 메모만으로 작업월 매핑 어려움)'],
    ['회사 마진',                     '✓',  'SUM(owner_amount) track B usol_n by 작업월'],
    ['통장 영향 (실제 잔고 증감)',     '✓',  'bookkeeping_cashflow_summary RPC + 거래 in/out 합'],
  ];
  rows.forEach(([k, ok, src]) => console.log(`  ${ok}  ${k.padEnd(22)} ← ${src}`));

  // ───────────────────────────────────────────────
  // [8] 결론 + 빠진 것
  // ───────────────────────────────────────────────
  sec('[8] 빠진 것 / 추가 필요');
  console.log('  · "받을 거 / 줄 거" 를 작업월별로 정확히 알려면 cashflow 거래에 work_month 태그가 필요.');
  console.log('    현재 cashflow.memo 는 자유 텍스트라 "5/15 유솔 입금 = 4월 작업분" 같은 매핑 자동 불가.');
  console.log('  · 4월 작업 데이터 DB 0건 — 사장님 손계산 보정(유솔N adjustment, Mig 127) 의존.');
  console.log('  · payments 의 engineer_remitted_at 은 track A 패턴 → track B 용 "지급 완료" 컬럼이 없음.');
  console.log('    → "기사 준 거" 는 cashflow out 합 (memo 기반) 만으로 추적 가능.');
  console.log('  · 정산 현황판 만들려면:');
  console.log('    (a) cashflow.work_month 컬럼 추가 (Mig 130 신규) — 거래 - 작업월 매핑');
  console.log('    (b) 또는 모달에서 사장님이 직접 입력 (수동 매핑)');
  console.log('    (c) 또는 작업월 입력 없이 "월별 cashflow 합" + "작업월 마진" 두 축 분리 표시');
})().catch(e => { console.error('FATAL:', e.message); console.error(e.stack); process.exit(1); });

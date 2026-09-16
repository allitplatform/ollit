// 유솔 → 회사 입금액의 성격 진단 — 기사 몫만? 마진 포함? (read-only)
// 2026-06-14.
//
// 사장님 가설: 유솔이 15% 떼고 입금 → 입금액 = subtotal × 85% = 기사 + 회사 마진
// 데이터 가설: 입금액 ≈ engineer_amount (= 기사 몫만, 회사 마진 별도)
//   증거: 사장님 받은 5월 입금 합 ≈ 63,184,836 ≈ engineer_amount 5월 ₩63,157,513
//
// 진단 목표: 유솔 입금이 (a) 기사몫만인지 (b) 기사+회사마진인지 (c) 다른 정의인지.

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

  // ────────────────────────────────────────
  // [1] cashflow "유솔 입금" 전체 (4/1 ~ 6/14)
  // ────────────────────────────────────────
  sec('[1] bookkeeping_cashflow direction=in & memo~"유솔 입금" 전체');
  const { data: cf } = await sb.from('bookkeeping_cashflow')
    .select('flow_date, amount, memo')
    .eq('tenant_id', TENANT).eq('direction', 'in')
    .ilike('memo', '%유솔 입금%')
    .gte('flow_date', '2026-04-01').lt('flow_date', '2026-07-01')
    .order('flow_date');
  let totApr = 0, totMay = 0, totJun = 0;
  (cf || []).forEach(r => {
    const m = r.flow_date.slice(5, 7);
    const a = Number(r.amount);
    console.log(`  ${r.flow_date}  +₩${fmt(a).padStart(12)}  ${r.memo}`);
    if (m === '04') totApr += a;
    if (m === '05') totMay += a;
    if (m === '06') totJun += a;
  });
  console.log(`\n  4월 입금 합: ₩${fmt(totApr)}`);
  console.log(`  5월 입금 합: ₩${fmt(totMay)}`);
  console.log(`  6월 입금 합: ₩${fmt(totJun)}`);
  console.log(`  전체 합   : ₩${fmt(totApr + totMay + totJun)}`);

  // ────────────────────────────────────────
  // [2] usol_n track B payments — 작업월별 핵심 합계 비교
  //   사장님 가설 vs 실제 어느 값과 매칭되는가
  // ────────────────────────────────────────
  sec('[2] 작업월별 (completed_at KST) — 입금 후보 컬럼 합 비교');
  const months = [
    { wm: '2026-04', start: '2026-04-01T00:00:00+09:00', end: '2026-05-01T00:00:00+09:00' },
    { wm: '2026-05', start: '2026-05-01T00:00:00+09:00', end: '2026-06-01T00:00:00+09:00' },
    { wm: '2026-06', start: '2026-06-01T00:00:00+09:00', end: '2026-07-01T00:00:00+09:00' },
  ];
  const monthlySums = {};
  for (const m of months) {
    let pays = [], po = 0;
    while (true) {
      const { data } = await sb.from('payments')
        .select('engineer_amount, principal_amount, owner_amount, product_price, extra_fee, tasks!inner(completed_at, status, principal_id)')
        .eq('track', 'B').eq('tasks.principal_id', usolnId).eq('tasks.status', '완료')
        .gte('tasks.completed_at', m.start).lt('tasks.completed_at', m.end)
        .range(po, po + 999);
      if (!data || data.length === 0) break;
      pays = pays.concat(data);
      if (data.length < 1000) break;
      po += 1000;
    }
    const eng  = pays.reduce((s, p) => s + Number(p.engineer_amount  || 0), 0);
    const prin = pays.reduce((s, p) => s + Number(p.principal_amount || 0), 0);
    const own  = pays.reduce((s, p) => s + Number(p.owner_amount     || 0), 0);
    const prod = pays.reduce((s, p) => s + Number(p.product_price    || 0), 0);
    const extra= pays.reduce((s, p) => s + Number(p.extra_fee        || 0), 0);
    monthlySums[m.wm] = { cnt: pays.length, eng, prin, own, prod, extra };
    console.log(`  [${m.wm}] payments ${pays.length}건`);
    console.log(`     engineer_amount      = ₩${fmt(eng).padStart(13)}  ← "기사 몫만"`);
    console.log(`     eng + owner          = ₩${fmt(eng + own).padStart(13)}  ← "기사+회사마진" (사장님 가설)`);
    console.log(`     subtotal × 85%       = ₩${fmt(Math.round(prod * 0.85)).padStart(13)}  ← "유솔 15% 뗀 금액"`);
    console.log(`     subtotal + extra     = ₩${fmt(prod + extra).padStart(13)}  ← "수수료 뺀 총수입"`);
    console.log(`     subtotal             = ₩${fmt(prod).padStart(13)}  ← "유솔 정산금"`);
    console.log(`     subtotal − principal = ₩${fmt(prod - prin).padStart(13)}  ← "유솔 몫 제외 정산금"`);
    console.log(`     principal_amount     = ₩${fmt(prin).padStart(13)}  ← "유솔 몫"`);
    console.log(`     owner_amount         = ₩${fmt(own).padStart(13)}  ← "회사 마진"`);
  }

  // ────────────────────────────────────────
  // [3] 입금일 ↔ 작업월 매핑 (시간 차이 흐름 확인)
  //   유솔N 월정산이면 4월 작업분 = 5/15 ± 입금일
  //   주간 정산이면 매주 월요일 = 전주 네이버 정산분
  // ────────────────────────────────────────
  sec('[3] 입금일 패턴 — 월정산 vs 주정산');
  console.log(`  cashflow 입금일 분포:`);
  console.log(`     4월 (4건? 5건?): ${(cf || []).filter(r => r.flow_date.startsWith('2026-04')).length}건`);
  console.log(`     5월: ${(cf || []).filter(r => r.flow_date.startsWith('2026-05')).length}건`);
  console.log(`     6월: ${(cf || []).filter(r => r.flow_date.startsWith('2026-06')).length}건`);
  console.log('');
  console.log(`  → 입금 패턴: ${(cf || []).length}건 — 매주 ${(cf || []).length >= 10 ? '주간' : '?'} 정산 또는 월정산.`);
  console.log(`     입금일 (월/요일):`);
  (cf || []).forEach(r => {
    const d = new Date(r.flow_date + 'T00:00:00');
    const dow = ['일','월','화','수','목','금','토'][d.getDay()];
    console.log(`        ${r.flow_date} (${dow})  +₩${fmt(r.amount)}`);
  });

  // ────────────────────────────────────────
  // [4] 가설별 입금 일치 검증 (4월 작업분 = 5월 입금분 가설 등)
  // ────────────────────────────────────────
  sec('[4] 가설별 매칭 검증');
  const may = monthlySums['2026-05'];
  console.log(`  사장님 5월 입금 합 (cashflow): ₩${fmt(totMay)}`);
  console.log('');
  console.log(`  ▶ 가설 X-1: 5월 입금 = 5월 작업의 어떤 항목인가?`);
  console.log(`     vs 5월 engineer_amount = ₩${fmt(may.eng)}  → 차이 ${fmt(totMay - may.eng)} (${((totMay - may.eng)/may.eng*100).toFixed(2)}%)`);
  console.log(`     vs 5월 eng+owner       = ₩${fmt(may.eng + may.own)}  → 차이 ${fmt(totMay - may.eng - may.own)}`);
  console.log(`     vs 5월 subtotal × 85%  = ₩${fmt(Math.round(may.prod * 0.85))}  → 차이 ${fmt(totMay - Math.round(may.prod * 0.85))}`);
  console.log('');
  console.log(`  ▶ 가설 X-2: 5월 입금 = 4월 작업분 (월정산 1달 지연)?`);
  const apr = monthlySums['2026-04'];
  console.log(`     vs 4월 engineer_amount = ₩${fmt(apr.eng)} (4월 = ${apr.cnt}건)`);
  console.log(`     → 4월 작업 0건이면 입금도 0이어야 — 가설 X`);
  console.log('');
  console.log(`  ▶ 가설 X-3: 5월 입금 = 5월 naver_settled 주차 합 (유솔이 그 주 받은 분 다음 주 입금)?`);

  // 5월 cashflow 입금일 직전 주의 task_items.naver_settled_at 주차별 engineer_amount 추정
  // task_items 5월~6월
  let allItems = [], io = 0;
  while (true) {
    const { data } = await sb.from('task_items')
      .select('subtotal, naver_settled_at, tasks!inner(completed_at, principal_id, status, payments(engineer_amount, principal_amount, owner_amount, product_price, track))')
      .eq('tasks.principal_id', usolnId)
      .eq('tasks.status', '완료')
      .gte('tasks.completed_at', '2026-04-01T00:00:00+09:00')
      .lt('tasks.completed_at',  '2026-07-01T00:00:00+09:00')
      .range(io, io + 999);
    if (!data || data.length === 0) break;
    allItems = allItems.concat(data);
    if (data.length < 1000) break;
    io += 1000;
  }
  console.log(`  task_items 4-6월 총 ${allItems.length}건`);
  // 주차 (naver_settled_at 기준 KST 월요일) → engineer 합 추정 (task 단위라 분배 필요)
  // 단순화: task_items 의 subtotal 합 by week (가장 직관)
  const wkMap = {};
  for (const it of allItems) {
    if (!it.naver_settled_at) continue;
    const d = new Date(it.naver_settled_at);
    const kstDay = new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const dt = new Date(kstDay + 'T00:00:00Z');
    const dow = dt.getUTCDay();
    const monOff = dow === 0 ? -6 : (1 - dow);
    dt.setUTCDate(dt.getUTCDate() + monOff);
    const wkStart = dt.toISOString().slice(0, 10);
    if (!wkMap[wkStart]) wkMap[wkStart] = { cnt: 0, sub: 0 };
    wkMap[wkStart].cnt++;
    wkMap[wkStart].sub += Number(it.subtotal || 0);
  }
  console.log(`\n  주차별 subtotal 합 (naver_settled_at 기준):`);
  Object.keys(wkMap).sort().forEach(wk => {
    console.log(`     주 시작 ${wk}: ${wkMap[wk].cnt}건 / subtotal ₩${fmt(wkMap[wk].sub)} / × 0.85 = ₩${fmt(Math.round(wkMap[wk].sub * 0.85))}`);
  });

  // ────────────────────────────────────────
  // [5] 결론
  // ────────────────────────────────────────
  sec('[5] 결론');
  console.log(`  cashflow 5월 유솔 입금 합 = ₩${fmt(totMay)}`);
  console.log(`  vs 5월 engineer_amount   = ₩${fmt(may.eng)}  → ${Math.abs(totMay - may.eng) / may.eng < 0.05 ? '✓ 거의 일치 (5% 이내)' : '⚠️ 차이 있음'}`);
  console.log(`  vs 5월 eng + owner       = ₩${fmt(may.eng + may.own)}  → ${Math.abs(totMay - may.eng - may.own) / (may.eng + may.own) < 0.05 ? '✓ 일치' : '⚠️ 큰 차이'}`);
  console.log('');
  console.log(`  ⚠️ 그러나: cashflow 입금일이 작업 → 정산 흐름과 일치하지 않을 수 있음`);
  console.log(`     · 5월 작업분 1244건 → 6/15 입금 예정 (아직 안 들어옴)`);
  console.log(`     · 5월 cashflow 입금 = 4월 작업분 정산? 4월 작업 DB 0건이라 불가능.`);
  console.log(`     · 가능성: 주간 정산 (매주 월요일 = 전주 네이버 정산분 일부)`);
})().catch(e => { console.error('FATAL:', e.message); console.error(e.stack); process.exit(1); });

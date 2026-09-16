// "net_amount × 0.85" 정합성 진단 — net 정의 + 0.85 의미 + 기사 몫 매칭 (read-only)
// 2026-06-14.
//
// 발견된 코드:
//   src/lib/usolNWeeklyData.js:20  NAVER_NET_TO_COMPANY_FACTOR = 0.85
//   fetchJuneLiveWeeks: weeklyTotal = SUM(net_amount) × 0.85
//   WEEKLY_DATA_FIXED: W14~W22 hardcoded (시트), W23+ live computed
//   UsolNTracking.calcItemReceive: net_amount NOT NULL 이면 그대로, NULL 이면 subtotal × 0.85
//
// 의문: net × 0.85 = 기사 몫(65%)과 같은지, 아니면 eng + own (85%)인지.

const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const fmt = n => Number(n || 0).toLocaleString('ko-KR');
const sec = (s) => { console.log('\n' + '═'.repeat(80)); console.log(s); console.log('═'.repeat(80)); };

(async () => {
  const { data: pUn } = await sb.from('principals').select('id').eq('code', 'usol_n').maybeSingle();
  const usolnId = pUn.id;

  // task_items + payments JOIN (4-6월 전체)
  let raw = [], off = 0;
  while (true) {
    const { data, error } = await sb.from('task_items')
      .select('id, task_id, subtotal, net_amount, naver_settled_at, is_canceled, order_type, tasks!inner(id, completed_at, status, principal_id)')
      .eq('tasks.principal_id', usolnId)
      .eq('tasks.status', '완료')
      .gte('tasks.completed_at', '2026-04-01T00:00:00+09:00')
      .lt('tasks.completed_at',  '2026-07-01T00:00:00+09:00')
      .range(off, off + 999);
    if (error) { console.log('  error:', error.message); break; }
    raw = raw.concat(data || []);
    if (!data || data.length < 1000) break;
    off += 1000;
  }
  const items = raw.filter(i => !i.is_canceled);
  console.log(`  task_items 4-6월 (active): ${items.length}건`);

  // payments map
  const taskIds = [...new Set(items.map(i => i.tasks?.id).filter(Boolean))];
  const payMap = new Map();
  for (let i = 0; i < taskIds.length; i += 300) {
    const chunk = taskIds.slice(i, i + 300);
    const { data } = await sb.from('payments')
      .select('task_id, engineer_amount, principal_amount, owner_amount, product_price, extra_fee')
      .eq('track', 'B')
      .in('task_id', chunk);
    (data || []).forEach(p => payMap.set(p.task_id, p));
  }

  // task 단위 task_items 의 net_amount 비율 분배 → item-level engineer/owner 추정
  // (task 의 모든 active items 합 = task_items.subtotal 의 비율로 engineer 분배)
  const itemsByTask = new Map();
  items.forEach(it => {
    const tid = it.tasks.id;
    if (!itemsByTask.has(tid)) itemsByTask.set(tid, []);
    itemsByTask.get(tid).push(it);
  });

  const itemEng = new Map(), itemOwn = new Map(), itemPrin = new Map();
  for (const [tid, its] of itemsByTask) {
    const p = payMap.get(tid);
    if (!p) continue;
    const subSum = its.reduce((s, x) => s + (Number(x.subtotal) || 0), 0);
    if (subSum === 0) continue;
    its.forEach(x => {
      const r = (Number(x.subtotal) || 0) / subSum;
      itemEng.set(x.id, Math.round((Number(p.engineer_amount) || 0) * r));
      itemOwn.set(x.id, Math.round((Number(p.owner_amount)    || 0) * r));
      itemPrin.set(x.id, Math.round((Number(p.principal_amount)|| 0) * r));
    });
  }

  // ────────────────────────────────────────
  // [1] item 단위 비교: net × 0.85 vs engineer / engineer+owner
  // ────────────────────────────────────────
  sec('[1] item 단위 (5월 작업 N=50 샘플) — net × 0.85 vs engineer / eng+own');
  const sample = items
    .filter(i => i.net_amount != null && i.subtotal != null)
    .slice(0, 12);
  console.log('  net      sub      net×0.85   engineer   eng+own    어느쪽?');
  sample.forEach(i => {
    const net = Number(i.net_amount);
    const sub = Number(i.subtotal);
    const eng = itemEng.get(i.id) || 0;
    const own = itemOwn.get(i.id) || 0;
    const target = Math.round(net * 0.85);
    const closerToEng = Math.abs(target - eng) < Math.abs(target - (eng + own));
    const flag = closerToEng ? '→eng' : '→eng+own';
    console.log(`  ${String(fmt(net)).padStart(8)}  ${String(fmt(sub)).padStart(8)}  ${String(fmt(target)).padStart(9)}  ${String(fmt(eng)).padStart(9)}  ${String(fmt(eng+own)).padStart(9)}  ${flag}`);
  });

  // 전체 5월 항목 비교
  const may = items.filter(i => {
    const d = new Date(i.tasks.completed_at);
    return d >= new Date('2026-05-01T00:00:00+09:00') && d < new Date('2026-06-01T00:00:00+09:00');
  });
  let sumNet = 0, sumSub = 0, sumEng = 0, sumOwn = 0, sumPrin = 0;
  may.forEach(i => {
    sumNet  += Number(i.net_amount || 0);
    sumSub  += Number(i.subtotal   || 0);
    sumEng  += itemEng.get(i.id)  || 0;
    sumOwn  += itemOwn.get(i.id)  || 0;
    sumPrin += itemPrin.get(i.id) || 0;
  });
  console.log(`\n  5월 작업 ${may.length}건 item-level 합:`);
  console.log(`     SUM(net_amount)        = ₩${fmt(sumNet)}`);
  console.log(`     SUM(subtotal)          = ₩${fmt(sumSub)}`);
  console.log(`     SUM(engineer 분배)     = ₩${fmt(sumEng)}`);
  console.log(`     SUM(eng + own 분배)    = ₩${fmt(sumEng + sumOwn)}`);
  console.log(`     SUM(principal 분배)    = ₩${fmt(sumPrin)}`);
  console.log('');
  console.log(`     net × 0.85             = ₩${fmt(Math.round(sumNet * 0.85))}`);
  console.log(`     subtotal × 0.85        = ₩${fmt(Math.round(sumSub * 0.85))}`);
  console.log(`     engineer 합            = ₩${fmt(sumEng)}`);
  console.log(`     engineer + owner 합    = ₩${fmt(sumEng + sumOwn)}`);
  console.log('');
  console.log(`  ▶ net × 0.85 ≈ engineer ?         → 차이 ${fmt(Math.round(sumNet * 0.85) - sumEng)}`);
  console.log(`  ▶ net × 0.85 ≈ engineer + owner ? → 차이 ${fmt(Math.round(sumNet * 0.85) - sumEng - sumOwn)}`);

  // ────────────────────────────────────────
  // [2] W23 (deposit 6/8) 라이브 계산 검증
  //   net_amount 합 (naver_settled_at 6/1~6/7 KST 주) × 0.85 vs cashflow 6/8 입금
  // ────────────────────────────────────────
  sec('[2] W23 (deposit 6/8) — net × 0.85 vs actual cashflow');
  const w23Start = new Date('2026-06-01T00:00:00+09:00').getTime();
  const w23End   = new Date('2026-06-08T00:00:00+09:00').getTime();
  const w23 = items.filter(i => {
    if (!i.naver_settled_at) return false;
    const t = new Date(i.naver_settled_at).getTime();
    return t >= w23Start && t < w23End;
  });
  const w23Net = w23.reduce((s, i) => s + (Number(i.net_amount) || 0), 0);
  const w23Sub = w23.reduce((s, i) => s + (Number(i.subtotal)   || 0), 0);
  const w23Eng = w23.reduce((s, i) => s + (itemEng.get(i.id)    || 0), 0);
  const w23Own = w23.reduce((s, i) => s + (itemOwn.get(i.id)    || 0), 0);
  console.log(`  W23 (naver_settled 6/1~6/7): ${w23.length}건`);
  console.log(`     SUM(net)            = ₩${fmt(w23Net)}`);
  console.log(`     × 0.85 (theory)     = ₩${fmt(Math.round(w23Net * 0.85))}`);
  console.log(`     engineer 분배 합    = ₩${fmt(w23Eng)}`);
  console.log(`     eng + own 분배 합   = ₩${fmt(w23Eng + w23Own)}`);
  console.log(`     실 cashflow 6/8     = ₩17,320,560`);

  // ────────────────────────────────────────
  // [3] W14-W22 hardcoded vs DB 실제 비교
  //   weeklyTotal 시트값과 net × 0.85 DB값이 매칭되는가
  // ────────────────────────────────────────
  sec('[3] W14-W22 hardcoded weeklyTotal vs DB 계산값');
  const fixedWeeks = [
    { wk: 'W14', monday: '2026-03-30', sunday: '2026-04-05', deposit: '2026-04-06', weeklyTotal:   408_000 },
    { wk: 'W15', monday: '2026-04-06', sunday: '2026-04-12', deposit: '2026-04-13', weeklyTotal:   283_606 },
    { wk: 'W16', monday: '2026-04-13', sunday: '2026-04-19', deposit: '2026-04-20', weeklyTotal: 1_136_493 },
    { wk: 'W17', monday: '2026-04-20', sunday: '2026-04-26', deposit: '2026-04-27', weeklyTotal: 4_879_840 },
    { wk: 'W18', monday: '2026-04-27', sunday: '2026-05-03', deposit: '2026-05-04', weeklyTotal: 6_514_822 },
    { wk: 'W19', monday: '2026-05-04', sunday: '2026-05-10', deposit: '2026-05-11', weeklyTotal: 19_504_515 },
    { wk: 'W20', monday: '2026-05-11', sunday: '2026-05-17', deposit: '2026-05-18', weeklyTotal: 16_958_937 },
    { wk: 'W21', monday: '2026-05-18', sunday: '2026-05-24', deposit: '2026-05-25', weeklyTotal: 18_790_320 },
    { wk: 'W22', monday: '2026-05-25', sunday: '2026-05-31', deposit: '2026-06-01', weeklyTotal: 19_267_868 },
  ];
  console.log('  wk    monday      sunday      hard시트      DB net합     × 0.85       DB eng분배');
  for (const w of fixedWeeks) {
    const start = new Date(w.monday + 'T00:00:00+09:00').getTime();
    const end   = new Date(w.sunday + 'T00:00:00+09:00').getTime() + 24 * 3600 * 1000;
    const wkItems = items.filter(i => {
      if (!i.naver_settled_at) return false;
      const t = new Date(i.naver_settled_at).getTime();
      return t >= start && t < end;
    });
    const wkNet = wkItems.reduce((s, i) => s + (Number(i.net_amount) || 0), 0);
    const wkEng = wkItems.reduce((s, i) => s + (itemEng.get(i.id)    || 0), 0);
    console.log(`  ${w.wk}  ${w.monday}  ${w.sunday}  ${String(fmt(w.weeklyTotal)).padStart(10)}  ${String(fmt(wkNet)).padStart(10)}  ${String(fmt(Math.round(wkNet * 0.85))).padStart(10)}  ${String(fmt(wkEng)).padStart(10)}`);
  }

  // ────────────────────────────────────────
  // [4] 결론
  // ────────────────────────────────────────
  sec('[4] 결론');
  console.log('  · 코드 출처: src/lib/usolNWeeklyData.js (NAVER_NET_TO_COMPANY_FACTOR = 0.85)');
  console.log('  · W14~W22: 시트에서 가져온 hardcoded weeklyTotal (실 cashflow와 일치)');
  console.log('  · W23+: SUM(task_items.net_amount) × 0.85 라이브 계산');
  console.log('');
  console.log('  net_amount 정의: CSV "정산예정금액" = 네이버 정산금 = POST-FEE (subtotal과 거의 동일)');
  console.log('');
  console.log('  ▶ net × 0.85 의 의미 (수학적):');
  console.log(`     net × 0.85 = subtotal × 0.85 = 회사가 받는 부분 (기사 + 회사 마진)`);
  console.log(`     subtotal × 0.85 = engineer + owner (≈ 85%, principal = 15% 차감 후)`);
  console.log('');
  console.log('  ▶ 그런데 실제 cashflow ≈ engineer 만 (회사 마진 부재)');
  console.log('     → 가능성 A: 시트 hardcoded 값이 실제로는 engineer 만 (회사 마진 미포함)');
  console.log('                  → 0.85 라는 식은 잘못 / 우연히 비슷한 수');
  console.log('     → 가능성 B: 사장님이 이번 보고 처음 알게 된 사실 = 유솔이 회사 마진 안 보냄');
  console.log('                  → 0.85 = sub × 0.85 는 "사실상 받아야 할 금액"인데 받지 않음');
  console.log('     → 가능성 C: 매주 ≠ 작업월 매핑이라 시간차로 인한 오차');
})().catch(e => { console.error('FATAL:', e.message); console.error(e.stack); process.exit(1); });

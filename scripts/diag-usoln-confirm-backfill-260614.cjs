// 유솔N 주간 confirm vs company_received_at 백필 진단 (read-only)
// 2026-06-14.
//
// 문제: 사장님이 "유솔 confirm 다 함(6/15 예정만 미)" 인데
//   company_received_at 백필이 5월 작업분 일부(167건)에만 찍힘.
// 가설:
//   1. principal_weekly_remittances 행이 실제로는 적음 (사장님 화면 ≠ DB 행)
//   2. confirm RPC 가 백필 안 함 (Mig 063 본문 확인: SET confirmed_at 만, task_items 미수정)
//   3. 백필이 다른 경로(트리거? 다른 RPC? 클라 후속 호출?)
//   4. 5월 작업분 (사용자 입금 6건 ≈ ₩63M) 의 주차 매핑 미스 (naver_settled_at 주차 ≠ confirm 주차)

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

  // ──────────────────────────────────────────
  // [1] principal_weekly_remittances usol_n 전체 (status 무관)
  // ──────────────────────────────────────────
  sec('[1] principal_weekly_remittances (usol_n) — ALL rows');
  const { data: pwr } = await sb.from('principal_weekly_remittances')
    .select('id, week_start, week_end, remitted_amount, remitted_at, confirmed_at, note')
    .eq('principal_id', usolnId)
    .order('week_start');
  console.log(`  총 ${(pwr || []).length}건`);
  let totReported = 0, totConfirmed = 0;
  (pwr || []).forEach(r => {
    const status = r.confirmed_at ? '✓확인' : (r.remitted_at ? '🟡보고만' : '⚪예정');
    console.log(`    ${r.week_start}~${r.week_end}  ₩${fmt(r.remitted_amount).padStart(12)}  ${status}`);
    if (r.remitted_at)  totReported++;
    if (r.confirmed_at) totConfirmed++;
  });
  console.log(`  보고됨: ${totReported}건 / 확인됨: ${totConfirmed}건`);

  // ──────────────────────────────────────────
  // [2] task_items company_received_at NOT NULL — 언제 채워졌나
  // ──────────────────────────────────────────
  sec('[2] task_items company_received_at NOT NULL (usol_n, 작업월 4/5/6월)');
  let all = [], off = 0;
  while (true) {
    const { data, error } = await sb.from('task_items')
      .select('id, subtotal, naver_settled_at, company_received_at, naver_received_at, cash_received_at, updated_at, tasks!inner(task_no, completed_at, principal_id, status)')
      .eq('tasks.principal_id', usolnId)
      .eq('tasks.status', '완료')
      .gte('tasks.completed_at', '2026-04-01T00:00:00+09:00')
      .lt('tasks.completed_at',  '2026-07-01T00:00:00+09:00')
      .not('company_received_at', 'is', null)
      .range(off, off + 999);
    if (error) { console.log('  error:', error.message); break; }
    all = all.concat(data || []);
    if (!data || data.length < 1000) break;
    off += 1000;
  }
  console.log(`  총 ${all.length}건`);
  // company_received_at 값 분포 (얼마나 다양한가)
  const distinctTimes = [...new Set(all.map(r => r.company_received_at?.slice(0, 10)))].sort();
  console.log(`  company_received_at 고유 날짜: ${distinctTimes.length}개`);
  distinctTimes.slice(0, 10).forEach(d => {
    const cnt = all.filter(r => r.company_received_at?.startsWith(d)).length;
    console.log(`    ${d}: ${cnt}건`);
  });
  // 어느 주차 (naver_settled_at 기준) 인가
  console.log('\n  ── 채워진 167건의 naver_settled_at 주차 분포');
  const weekMap = {};
  for (const r of all) {
    if (!r.naver_settled_at) continue;
    const d = new Date(r.naver_settled_at);
    const kstDay = new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const dt = new Date(kstDay + 'T00:00:00Z');
    const dow = dt.getUTCDay(); // 0=Sun
    const monOff = dow === 0 ? -6 : (1 - dow);
    dt.setUTCDate(dt.getUTCDate() + monOff);
    const monStr = dt.toISOString().slice(0, 10);
    weekMap[monStr] = (weekMap[monStr] || 0) + 1;
  }
  Object.entries(weekMap).sort().forEach(([wk, cnt]) => {
    console.log(`    주 시작 ${wk}: ${cnt}건`);
  });

  // ──────────────────────────────────────────
  // [3] 5월 작업분 task_items 전체 - naver_settled_at 주차별 분포
  // ──────────────────────────────────────────
  sec('[3] 5월 작업분 task_items — naver_settled_at 주차별 (받은 거 / 받을 거)');
  let may = [], offM = 0;
  while (true) {
    const { data, error } = await sb.from('task_items')
      .select('subtotal, naver_settled_at, company_received_at, tasks!inner(completed_at, principal_id, status)')
      .eq('tasks.principal_id', usolnId)
      .eq('tasks.status', '완료')
      .gte('tasks.completed_at', '2026-05-01T00:00:00+09:00')
      .lt('tasks.completed_at',  '2026-06-01T00:00:00+09:00')
      .range(offM, offM + 999);
    if (error) break;
    may = may.concat(data || []);
    if (!data || data.length < 1000) break;
    offM += 1000;
  }
  console.log(`  5월 작업 task_items 총: ${may.length}건`);
  // 주차별 (naver_settled_at) 분포
  const buckets = {};
  for (const r of may) {
    let key;
    if (!r.naver_settled_at) key = '(naver_settled NULL)';
    else {
      const d = new Date(r.naver_settled_at);
      const kstDay = new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      const dt = new Date(kstDay + 'T00:00:00Z');
      const dow = dt.getUTCDay();
      const monOff = dow === 0 ? -6 : (1 - dow);
      dt.setUTCDate(dt.getUTCDate() + monOff);
      key = dt.toISOString().slice(0, 10);
    }
    if (!buckets[key]) buckets[key] = { total: 0, sub: 0, cmpyRecv: 0, cmpyRecvSub: 0 };
    buckets[key].total++;
    buckets[key].sub += Number(r.subtotal || 0);
    if (r.company_received_at) {
      buckets[key].cmpyRecv++;
      buckets[key].cmpyRecvSub += Number(r.subtotal || 0);
    }
  }
  console.log('  주 시작        총건  총subtotal      company_received  received subtotal');
  Object.keys(buckets).sort().forEach(k => {
    const b = buckets[k];
    const pad = (s, n) => String(s).padStart(n);
    console.log(`  ${k}    ${pad(b.total, 5)}  ₩${pad(fmt(b.sub), 12)}  ${pad(b.cmpyRecv, 6)}건           ₩${pad(fmt(b.cmpyRecvSub), 12)}`);
  });

  // ──────────────────────────────────────────
  // [4] 트리거 / 함수 — DB 측 백필 mechanism 존재 확인
  //   service role 에서 pg_proc, pg_trigger 직접 조회 시도
  // ──────────────────────────────────────────
  sec('[4] DB 측 트리거 / 함수 (백필 mechanism)');
  // pg_trigger 직접 조회는 안전한 RPC 가 없으면 어려움.
  // 대신 정황 증거: 167건 모두 같은 timestamp 인가?
  console.log('  167건 company_received_at 고유값:');
  const distinctTs = [...new Set(all.map(r => r.company_received_at))].sort();
  console.log(`    고유 timestamp ${distinctTs.length}개`);
  if (distinctTs.length <= 10) {
    distinctTs.forEach(ts => {
      const cnt = all.filter(r => r.company_received_at === ts).length;
      console.log(`      ${ts}  ${cnt}건`);
    });
  } else {
    distinctTs.slice(0, 5).forEach(ts => console.log(`      ${ts}`));
    console.log(`      ... ${distinctTs.length - 5} 더`);
  }
  console.log('  → 동일 timestamp 가 ≥10 건 묶이면 일괄 SQL/마이그레이션 가능성.');
  console.log('  → 모두 제각각이면 클라 markTaskItemsField 호출 패턴 가능성.');

  // ──────────────────────────────────────────
  // [5] confirm_principal_remittance 의 직접 효과 추적
  //   가장 최근 confirmed_at 직후 company_received_at 가 같은 시각으로 찍힌 것이 있나?
  // ──────────────────────────────────────────
  sec('[5] confirmed_at vs company_received_at 시간 매핑');
  for (const r of (pwr || []).filter(r => r.confirmed_at)) {
    const confSec = new Date(r.confirmed_at).getTime();
    // ±5초 윈도우 안에 company_received_at 찍힌 task_items
    const near = all.filter(t => {
      const x = new Date(t.company_received_at).getTime();
      return Math.abs(x - confSec) < 5000;
    });
    console.log(`  주차 ${r.week_start}~${r.week_end}  confirmed=${r.confirmed_at?.slice(0,19)}  근접 company_received: ${near.length}건`);
  }

  // ──────────────────────────────────────────
  // [6] 결론 토대 — 무엇이 빠진 건지 추정
  // ──────────────────────────────────────────
  sec('[6] 결론');
  console.log(`  · principal_weekly_remittances usol_n 확인 행: ${totConfirmed}건`);
  console.log(`  · 5월 작업분 company_received_at 채움: ${all.filter(r => {
    const d = new Date(r.tasks.completed_at);
    return d >= new Date('2026-05-01T00:00:00+09:00') && d < new Date('2026-06-01T00:00:00+09:00');
  }).length}건`);
  console.log(`  · 5월 작업 task_items 총 ${may.length}건 중 company_received_at 채움 ${may.filter(r => r.company_received_at).length}건`);
  console.log('');
  console.log('  사장님이 화면에서 "confirm 다 했다" 가 의미하는 것:');
  console.log('  (a) UsolNToCompanySection (UsolNTracking 안) 주차 카드 — principal_weekly_remittances 만 갱신.');
  console.log('  (b) 다른 경로(예: 통장 cashflow "유솔 입금" 직접 입력) — task_items 미관여.');
  console.log('  → 사장님이 (b) 만 하셨다면 → 5월 작업분 company_received_at 미채움 자연스러움.');
  console.log('  → (a) 도 하셨는데 안 채워졌다면 → 백필 mechanism 부재 (Mig 063 RPC 본문 미백필 확인됨).');
})().catch(e => { console.error('FATAL:', e.message); console.error(e.stack); process.exit(1); });

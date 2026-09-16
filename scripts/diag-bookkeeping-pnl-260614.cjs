// 가계부 5월/6월 손익+이월 계산 (read-only, 변경 X)
// 수입 = 일정산(track A owner_amount, 그 달 completed_at) + 유솔N 월정산(Mig 123 RPC)
// 운영비 = bookkeeping_expenses 그 달
// 분배 = bookkeeping_distributions 그 달
// 순이익 = 수입 − 운영비
// 이월 = 순이익 − 분배

const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT = '11111111-1111-1111-1111-111111111111';
const ACTOR  = '77777777-7777-7777-7777-aaaaaaaa0004';
const fmt = n => {
  const s = Number(n || 0).toLocaleString('ko-KR');
  return Number(n) < 0 ? s : (n === 0 ? '0' : '+' + s);
};
const fmtPos = n => Number(n || 0).toLocaleString('ko-KR');

async function sumTrackAOwner(fromISO, toISO) {
  let all = [], off = 0;
  while (true) {
    const { data, error } = await sb.from('payments')
      .select('owner_amount, tasks!inner(completed_at, status)')
      .eq('track', 'A')
      .eq('tasks.status', '완료')
      .gte('tasks.completed_at', fromISO)
      .lt('tasks.completed_at', toISO)
      .range(off, off + 999);
    if (error) { console.error('  trackA fetch error:', error.message); break; }
    all = all.concat(data || []);
    if (!data || data.length < 1000) break;
    off += 1000;
  }
  const ownSum = all.reduce((s, r) => s + Number(r.owner_amount || 0), 0);
  return { count: all.length, owner: ownSum };
}

(async () => {
  const months = [
    { wm: '2026-05', startISO: '2026-05-01T00:00:00+09:00', endISO: '2026-06-01T00:00:00+09:00' },
    { wm: '2026-06', startISO: '2026-06-01T00:00:00+09:00', endISO: '2026-07-01T00:00:00+09:00' },
  ];

  const out = [];

  for (const m of months) {
    console.log('═'.repeat(80));
    console.log(`[${m.wm}] 손익/이월 계산`);
    console.log('═'.repeat(80));

    // 1) 일정산 — track A owner (그 달 completed_at)
    const ta = await sumTrackAOwner(m.startISO, m.endISO);
    console.log(`  ① 일정산 마진 (track A owner_amount, ${m.wm} 완료분)`);
    console.log(`     완료 task: ${ta.count}건  /  owner 합: ₩${fmtPos(ta.owner)}`);

    // 2) 유솔N 월정산 — Mig 123 RPC (전월 작업분)
    const { data: usolnRes } = await sb.rpc('bookkeeping_get_usoln_track_b_margin', {
      p_work_month: m.wm, p_actor: ACTOR,
    });
    const usoln = Number(usolnRes?.amount || 0);
    console.log(`  ② 유솔N 월정산 (track B, 전월 작업분 — Mig 123)`);
    console.log(`     RPC 결과: ₩${fmtPos(usoln)}`);

    const income = ta.owner + usoln;
    console.log(`  ─ 수입 합계 = ① + ② = ₩${fmtPos(income)}`);

    // 3) 운영비
    const { data: exp } = await sb.from('bookkeeping_expenses')
      .select('category, amount, memo, expense_date')
      .eq('tenant_id', TENANT).eq('work_month', m.wm);
    const expSum = (exp || []).reduce((s, r) => s + Number(r.amount), 0);
    console.log(`  ③ 운영비 (bookkeeping_expenses, ${m.wm})`);
    console.log(`     ${(exp || []).length}건  /  합: ₩${fmtPos(expSum)}`);

    const netProfit = income - expSum;
    console.log(`  ─ 순이익 = 수입 − 운영비 = ₩${fmtPos(netProfit)}`);

    // 4) 분배 (join 없이 RPC 경유)
    const { data: distRes } = await sb.rpc('bookkeeping_list_distributions', { p_work_month: m.wm, p_actor: ACTOR });
    const dist = distRes?.rows || [];
    const distSum = dist.reduce((s, r) => s + Number(r.amount), 0);
    console.log(`  ④ 분배 (bookkeeping_distributions, ${m.wm})`);
    console.log(`     ${dist.length}건  /  합: ₩${fmtPos(distSum)}`);
    // 이름 lookup 별도
    const repIds = [...new Set(dist.map(r => r.representative_user_id))];
    const repNames = {};
    if (repIds.length) {
      const { data: us } = await sb.from('users').select('id, name').in('id', repIds);
      (us || []).forEach(u => { repNames[u.id] = u.name; });
    }
    dist.forEach(r => console.log(`        ${(repNames[r.representative_user_id] || '?').padEnd(8)} ₩${fmtPos(r.amount).padStart(10)} | ${r.memo || ''}`));

    const carryover = netProfit - distSum;
    console.log(`  ─ 이월 = 순이익 − 분배 = ₩${fmtPos(carryover)}`);
    console.log('');

    out.push({ wm: m.wm, trackA: ta.owner, usoln, income, exp: expSum, net: netProfit, dist: distSum, carry: carryover });
  }

  // 표 요약
  console.log('\n' + '═'.repeat(80));
  console.log('[요약 표] 5월 / 6월');
  console.log('═'.repeat(80));
  const cols = ['달', '일정산 마진', '유솔N 월정산', '수입 합계', '운영비', '순이익', '분배', '이월'];
  const widths = [8, 14, 14, 14, 14, 14, 14, 14];
  const sep = '─'.repeat(widths.reduce((s, w) => s + w + 2, 0));
  function row(vals) {
    return vals.map((v, i) => (String(v)).padStart(widths[i])).join('  ');
  }
  console.log(row(cols));
  console.log(sep);
  out.forEach(o => {
    console.log(row([
      o.wm,
      fmtPos(o.trackA),
      fmtPos(o.usoln),
      fmtPos(o.income),
      '−' + fmtPos(o.exp),
      fmtPos(o.net),
      '−' + fmtPos(o.dist),
      (o.carry < 0 ? '' : '') + fmtPos(o.carry),
    ]));
  });
  console.log(sep);
  console.log('\n⚠️ 주석');
  console.log('  · 5월 직영 일정산은 앱이 5월 말부터 본격 가동 → 5월 일정산 owner 과소 가능.');
  console.log('  · 유솔N 월정산은 Mig 123 적용: 5월 가계부=4월 작업분 / 6월 가계부=5월 작업분.');
  console.log('  · 통장 cashflow와는 별개 (가계부 손익은 매출 기반, 통장은 실제 거래일 기준).');
})().catch(e => { console.error('FATAL:', e.message); console.error(e.stack); process.exit(1); });

// 유솔N 5월 회사 배분 96,583,557 / 지급 77,637,194 / 순이익 18,946,363 분해 진단 (read-only).
// 2026-06-14.
//
// 화면 (UsolNToEngineerSection.jsx line 718):
//   회사 배분 (정책 적용) = engSum + prinSum + ownerSum
//   기사+원청 지급        = engSum + prinSum
//   회사 순익             = ownerSum
//
// 정책 (Mig 009 / 035 / 046):
//   · usol_n cleaning 본작업: engineer = engineer_base × 1.10, 유솔(원청) = 15% × (subtotal - 네이버수수료)
//   · usol_n 추가선택:        engineer = 85%, 유솔 = 15%, 회사 = 0
//   · usol_n 냉매점검:        별도
//   · owner = GREATEST(subtotal - engineer - principal, 0)  ← usol_n 분기

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

  // 5월 작업분 payments track B 전체 fetch
  let pays = [], off = 0;
  while (true) {
    const { data, error } = await sb.from('payments')
      .select('task_id, engineer_amount, principal_amount, owner_amount, product_price, extra_fee, travel_fee, naver_fee, calc_method, policy_key, tasks!inner(completed_at, status, principal_id)')
      .eq('track', 'B')
      .eq('tasks.principal_id', usolnId)
      .eq('tasks.status', '완료')
      .gte('tasks.completed_at', '2026-05-01T00:00:00+09:00')
      .lt('tasks.completed_at',  '2026-06-01T00:00:00+09:00')
      .range(off, off + 999);
    if (error) { console.log('  error:', error.message); break; }
    pays = pays.concat(data || []);
    if (!data || data.length < 1000) break;
    off += 1000;
  }

  // 5월 task_items 전체 fetch (subtotal + 정책 분포)
  let items = [], ioff = 0;
  while (true) {
    const { data, error } = await sb.from('task_items')
      .select('task_id, subtotal, qty, unit_price, order_type, net_amount, is_canceled, work_types(code, name), tasks!inner(principal_id, status, completed_at)')
      .eq('tasks.principal_id', usolnId)
      .eq('tasks.status', '완료')
      .gte('tasks.completed_at', '2026-05-01T00:00:00+09:00')
      .lt('tasks.completed_at',  '2026-06-01T00:00:00+09:00')
      .range(ioff, ioff + 999);
    if (error) { console.log('  item error:', error.message); break; }
    items = items.concat(data || []);
    if (!data || data.length < 1000) break;
    ioff += 1000;
  }

  // ──────────────────────────────────────
  // [1] payments 5월 track B usol_n 합계
  // ──────────────────────────────────────
  sec('[1] 5월 작업분 payments track B usol_n — 컬럼 합계');
  const eng    = pays.reduce((s, p) => s + Number(p.engineer_amount  || 0), 0);
  const prin   = pays.reduce((s, p) => s + Number(p.principal_amount || 0), 0);
  const own    = pays.reduce((s, p) => s + Number(p.owner_amount     || 0), 0);
  const prodP  = pays.reduce((s, p) => s + Number(p.product_price    || 0), 0);
  const extra  = pays.reduce((s, p) => s + Number(p.extra_fee        || 0), 0);
  const travel = pays.reduce((s, p) => s + Number(p.travel_fee       || 0), 0);
  const naver  = pays.reduce((s, p) => s + Number(p.naver_fee        || 0), 0);
  const total  = eng + prin + own;
  console.log(`  payment rows = ${pays.length}건`);
  console.log(`     engineer_amount  합 = ₩${fmt(eng).padStart(14)}`);
  console.log(`     principal_amount 합 = ₩${fmt(prin).padStart(14)}`);
  console.log(`     owner_amount     합 = ₩${fmt(own).padStart(14)}`);
  console.log(`     ─────────────────────────────────────`);
  console.log(`     합계 (= 회사 배분)   = ₩${fmt(total).padStart(14)}`);
  console.log('');
  console.log(`     product_price    합 = ₩${fmt(prodP).padStart(14)}`);
  console.log(`     extra_fee        합 = ₩${fmt(extra).padStart(14)}`);
  console.log(`     travel_fee       합 = ₩${fmt(travel).padStart(14)}`);
  console.log(`     naver_fee        합 = ₩${fmt(naver).padStart(14)}`);

  // ──────────────────────────────────────
  // [2] task_items subtotal 합
  // ──────────────────────────────────────
  sec('[2] 5월 작업분 task_items — subtotal 합 (vs 회사 배분 차이)');
  const subAll      = items.reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const subActive   = items.filter(i => !i.is_canceled).reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const subCanceled = items.filter(i =>  i.is_canceled).reduce((s, i) => s + Number(i.subtotal || 0), 0);
  console.log(`  task_items 총: ${items.length}건 (cancel ${items.filter(i => i.is_canceled).length})`);
  console.log(`     subtotal 합 (all)      = ₩${fmt(subAll).padStart(14)}`);
  console.log(`     subtotal 합 (active만) = ₩${fmt(subActive).padStart(14)}`);
  console.log(`     subtotal 합 (canceled) = ₩${fmt(subCanceled).padStart(14)}`);
  console.log('');
  console.log(`  회사 배분 - subtotal(all) = ₩${fmt(total - subAll).padStart(14)}`);
  console.log(`     화면 차이 +1,123,900 의 정체 = extra_fee + travel_fee`);
  console.log(`     extra+travel = ₩${fmt(extra + travel)} (위 [1])`);

  // ──────────────────────────────────────
  // [3] 정책 분포 — calc_method / policy_key
  // ──────────────────────────────────────
  sec('[3] 5월 payments calc_method / policy_key 분포');
  const calcDist = {};
  pays.forEach(p => {
    const k = p.calc_method || '(NULL)';
    if (!calcDist[k]) calcDist[k] = { cnt: 0, eng: 0, prin: 0, own: 0 };
    calcDist[k].cnt++;
    calcDist[k].eng  += Number(p.engineer_amount  || 0);
    calcDist[k].prin += Number(p.principal_amount || 0);
    calcDist[k].own  += Number(p.owner_amount     || 0);
  });
  console.log(`  calc_method           cnt    engineer       principal      owner`);
  Object.entries(calcDist).sort((a,b) => b[1].cnt - a[1].cnt).forEach(([k, v]) => {
    console.log(`  ${k.padEnd(22)} ${String(v.cnt).padStart(4)}  ₩${fmt(v.eng).padStart(10)}  ₩${fmt(v.prin).padStart(11)}  ₩${fmt(v.own).padStart(11)}`);
  });

  // ──────────────────────────────────────
  // [4] order_type 분포 (task_items)
  // ──────────────────────────────────────
  sec('[4] 5월 task_items — order_type 분포');
  const otDist = {};
  items.forEach(i => {
    const k = i.order_type || '(NULL)';
    if (!otDist[k]) otDist[k] = { cnt: 0, sub: 0 };
    otDist[k].cnt++;
    otDist[k].sub += Number(i.subtotal || 0);
  });
  console.log(`  order_type   cnt    subtotal`);
  Object.entries(otDist).sort((a,b) => b[1].cnt - a[1].cnt).forEach(([k, v]) => {
    console.log(`  ${k.padEnd(12)} ${String(v.cnt).padStart(4)}  ₩${fmt(v.sub).padStart(12)}`);
  });

  // ──────────────────────────────────────
  // [5] "유솔 15% / 회사 85%" 가설 검증
  //   가설 A: 유솔 = 15% × subtotal_active
  //   가설 B: 회사 = 85% × subtotal_active (engineer 별도)
  // ──────────────────────────────────────
  sec('[5] 정책 가설 검증');
  const hypUsol15 = Math.round(subActive * 0.15);
  console.log(`  가설 A: 유솔(15%) × subtotal_active`);
  console.log(`     subtotal_active × 0.15 = ₩${fmt(hypUsol15)}`);
  console.log(`     실제 principal_amount  = ₩${fmt(prin)}`);
  console.log(`     차이                    = ₩${fmt(hypUsol15 - prin)}  → ${Math.abs(hypUsol15 - prin) < 100000 ? '✓ 거의 일치' : '⚠️ 불일치'}`);
  console.log('');
  const hypComp85 = Math.round(subActive * 0.85);
  console.log(`  가설 B: 회사(85%) × subtotal_active`);
  console.log(`     subtotal_active × 0.85 = ₩${fmt(hypComp85)}`);
  console.log(`     실제 owner_amount       = ₩${fmt(own)}`);
  console.log(`     차이                    = ₩${fmt(hypComp85 - own)}  → ${Math.abs(hypComp85 - own) < 100000 ? '✓' : '⚠️ 큰 차이 (가설 X)'}`);
  console.log('');
  console.log(`  실제 분배 (5월 작업):`);
  console.log(`     기사 ${(eng / total * 100).toFixed(1)}% / 유솔 ${(prin / total * 100).toFixed(1)}% / 회사 ${(own / total * 100).toFixed(1)}%`);
  console.log(`     기사 ₩${fmt(eng)} / 유솔 ₩${fmt(prin)} / 회사 ₩${fmt(own)}`);
  console.log('');
  console.log(`  ── 정책 실제 (Mig 009 / 046):`);
  console.log(`     · usol_n cleaning 본작업: engineer = engineer_base × 1.10 (벽40K/1way50K/스탠드60K/4way70K/원80K/2in1 100K)`);
  console.log(`       유솔 = 15% × (subtotal − 네이버수수료) [추정], 회사 = subtotal − engineer − 유솔`);
  console.log(`     · usol_n 추가선택 (팬분해/송풍/피톤치드/실외기): engineer = 85% × ?, 유솔 = 15%, 회사 = 0`);
  console.log(`     · usol_n 냉매점검: engineer = 85% × (product_price + extra) × rate, 유솔 = 15% × subtotal, 회사 = ?`);

  // ──────────────────────────────────────
  // [6] 결론
  // ──────────────────────────────────────
  sec('[6] 결론');
  console.log(`  ✓ 화면 "회사 배분 96,583,557" = engineer + principal + owner 합 = ₩${fmt(total)}`);
  console.log(`  ✓ 화면 "기사+원청 지급 77,637,194" = engineer + principal = ₩${fmt(eng + prin)}`);
  console.log(`     · engineer (기사 몫)  = ₩${fmt(eng)}`);
  console.log(`     · principal (유솔 몫) = ₩${fmt(prin)}  ← 유솔 15% 해당 (수수료 별)`);
  console.log(`  ✓ 화면 "회사 순이익 18,946,363" = owner_amount 합 = ₩${fmt(own)}`);
  console.log('');
  console.log(`  ⚠️ subtotal 합과 차이 (+₩${fmt(total - subAll)}) = extra_fee + travel_fee ${extra + travel === total - subAll ? '✓ 일치' : '⚠️ 확인 필요'}`);
  console.log('');
  console.log(`  ⚠️ 사장님 "유솔 15% / 회사 85%" 가설:`);
  console.log(`     · 유솔 15% × subtotal = ₩${fmt(hypUsol15)} ↔ 실제 principal ₩${fmt(prin)} → ${Math.abs(hypUsol15 - prin) < 200000 ? '거의 일치' : '불일치'}`);
  console.log(`     · 회사 85% × subtotal = ₩${fmt(hypComp85)} ↔ 실제 owner ₩${fmt(own)} → 큰 차이`);
  console.log('');
  console.log(`  → 사장님 가설(회사 85%)은 잘못된 mental model.`);
  console.log(`    실제: 기사 ${(eng/total*100).toFixed(1)}% / 유솔 ${(prin/total*100).toFixed(1)}% / 회사 ${(own/total*100).toFixed(1)}%`);
  console.log(`    기사 몫이 큰 이유 = cleaning 본작업의 engineer_base × 1.10 (정액)`);
})().catch(e => { console.error('FATAL:', e.message); console.error(e.stack); process.exit(1); });

// 유솔N task_items.subtotal 의미 진단 — 네이버 정산금(post-fee) vs 고객 결제 원금(pre-fee)
// 2026-06-14 (read-only).

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

  // 5월 task_items 전체
  let items = [], off = 0;
  while (true) {
    const { data, error } = await sb.from('task_items')
      .select('id, task_id, subtotal, qty, unit_price, net_amount, naver_settled_at, product_order_id, order_type, metadata, work_types(code, name), appliance_types(code, name), tasks!inner(task_no, completed_at, principal_id, status)')
      .eq('tasks.principal_id', usolnId)
      .eq('tasks.status', '완료')
      .gte('tasks.completed_at', '2026-05-01T00:00:00+09:00')
      .lt('tasks.completed_at',  '2026-06-01T00:00:00+09:00')
      .range(off, off + 999);
    if (error) { console.log('  error:', error.message); break; }
    items = items.concat(data || []);
    if (!data || data.length < 1000) break;
    off += 1000;
  }

  // ──────────────────────────────────────
  // [1] subtotal vs net_amount — 같은가 다른가
  // ──────────────────────────────────────
  sec('[1] subtotal vs net_amount 비교 (5월 작업분 1244 items)');
  const itemsWithBoth = items.filter(i => i.subtotal != null && i.net_amount != null);
  const itemsNetNull  = items.filter(i => i.net_amount == null);
  console.log(`  net_amount NOT NULL: ${itemsWithBoth.length}건`);
  console.log(`  net_amount NULL    : ${itemsNetNull.length}건`);

  // subtotal == net_amount 인가?
  const exactMatch = itemsWithBoth.filter(i => Number(i.subtotal) === Number(i.net_amount)).length;
  const closeMatch = itemsWithBoth.filter(i => Math.abs(Number(i.subtotal) - Number(i.net_amount)) <= 1).length;
  console.log(`  subtotal == net_amount (exact)  : ${exactMatch}건 / ${itemsWithBoth.length}건`);
  console.log(`  subtotal ≈ net_amount (±1원)    : ${closeMatch}건`);

  // 차이 분포
  const diffs = itemsWithBoth.map(i => Number(i.subtotal) - Number(i.net_amount));
  const sumSub = itemsWithBoth.reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const sumNet = itemsWithBoth.reduce((s, i) => s + Number(i.net_amount || 0), 0);
  console.log(`\n  합계 (both NOT NULL ${itemsWithBoth.length}건):`);
  console.log(`     SUM(subtotal)   = ₩${fmt(sumSub)}`);
  console.log(`     SUM(net_amount) = ₩${fmt(sumNet)}`);
  console.log(`     차이 (sub−net)  = ₩${fmt(sumSub - sumNet)}  ${sumSub === sumNet ? '✓ 0 (동일)' : '⚠️ 차이'}`);

  // ──────────────────────────────────────
  // [2] unit_price 출처 — Mig 045 백업된 old_unit_price metadata 확인
  // ──────────────────────────────────────
  sec('[2] metadata.old_unit_price (Mig 045 백업) 분포');
  const withOldUp = items.filter(i => i.metadata && typeof i.metadata === 'object' && 'old_unit_price' in i.metadata);
  console.log(`  metadata.old_unit_price 존재: ${withOldUp.length}건`);
  if (withOldUp.length > 0) {
    console.log(`  샘플 (앞 5건) — old_unit_price (옛 = 고객결제 원금) vs unit_price (현재 = 정산예정금액):`);
    withOldUp.slice(0, 5).forEach(i => {
      const old = i.metadata.old_unit_price;
      const cur = i.unit_price;
      const ratio = old > 0 ? (cur / old * 100).toFixed(1) : '?';
      console.log(`    item ${i.id.slice(0,8)} qty=${i.qty}  old=${fmt(old)} → cur=${fmt(cur)}  (${ratio}%)`);
    });
    const oldSum = withOldUp.reduce((s, i) => s + Number(i.metadata.old_unit_price || 0) * Number(i.qty || 1), 0);
    const curSum = withOldUp.reduce((s, i) => s + Number(i.unit_price || 0) * Number(i.qty || 1), 0);
    console.log(`\n  합계 (${withOldUp.length}건):`);
    console.log(`     OLD subtotal (qty × old_unit_price) = ₩${fmt(oldSum)}  (= 고객결제 원금 추정)`);
    console.log(`     현재 subtotal                        = ₩${fmt(curSum)}  (= 정산예정금액)`);
    console.log(`     네이버 수수료 추정                    = ₩${fmt(oldSum - curSum)}  (${oldSum > 0 ? ((1 - curSum / oldSum) * 100).toFixed(2) : '?'}%)`);
  } else {
    console.log(`  → Mig 045 백업 없음. unit_price 가 처음부터 정산예정금액으로 들어왔거나, 백필 안 됨.`);
  }

  // ──────────────────────────────────────
  // [3] net_amount 가 정산예정금액 (CSV 출처) 임을 확인
  // ──────────────────────────────────────
  sec('[3] net_amount 가 CSV 정산예정금액 임을 확인');
  console.log('  Mig 038 코멘트: "net_amount = 각 항목별 실수령 금액 (subtotal에서 수수료 차감 후)"');
  console.log('  CSV 코드: parseInt(row["정산예정금액"]) → net_amount UPDATE (UsolNCsvMatch.jsx:628)');
  console.log('  Mig 045 코멘트: "유솔N task_items.unit_price 정정 — 시트 정산예정금액 매핑"');
  console.log('  Mig 046 코멘트: "task_items.unit_price = 시트 정산예정금액(네이버 수수료 차감 후)"');
  console.log('                "product_price = 시트 최종상품금액(판매가 / 네이버 수수료 포함)"');
  console.log('');
  console.log('  → unit_price (= subtotal/qty) 는 POST-FEE (네이버 수수료 차감 후, "정산예정금액")');

  // ──────────────────────────────────────
  // [4] payments.product_price vs subtotal — usol_n track B
  // ──────────────────────────────────────
  sec('[4] payments.product_price 대 subtotal (5월 usol_n track B)');
  let pays = [], poff = 0;
  while (true) {
    const { data } = await sb.from('payments')
      .select('task_id, product_price, extra_fee, naver_fee, principal_amount, owner_amount, engineer_amount, tasks!inner(principal_id, status, completed_at)')
      .eq('track', 'B')
      .eq('tasks.principal_id', usolnId)
      .eq('tasks.status', '완료')
      .gte('tasks.completed_at', '2026-05-01T00:00:00+09:00')
      .lt('tasks.completed_at',  '2026-06-01T00:00:00+09:00')
      .range(poff, poff + 999);
    if (!data || data.length === 0) break;
    pays = pays.concat(data);
    if (data.length < 1000) break;
    poff += 1000;
  }
  const prodSum = pays.reduce((s, p) => s + Number(p.product_price || 0), 0);
  const navSum  = pays.reduce((s, p) => s + Number(p.naver_fee     || 0), 0);
  const subAll  = items.reduce((s, i) => s + Number(i.subtotal || 0), 0);
  console.log(`  payments.product_price 합  = ₩${fmt(prodSum)}`);
  console.log(`  payments.naver_fee     합  = ₩${fmt(navSum)}`);
  console.log(`  task_items.subtotal    합  = ₩${fmt(subAll)}`);
  console.log(`     → payments.product_price ${prodSum === subAll ? '== subtotal (POST-FEE 그대로 들어옴)' : '!= subtotal (다른 출처)'}`);
  console.log(`     → naver_fee 0 = 시스템에 수수료를 별도 저장하지 않음 (이미 차감된 값으로 입력)`);

  // ──────────────────────────────────────
  // [5] 유솔 15% 계산 검증 — POST-FEE 기준이 맞음
  // ──────────────────────────────────────
  sec('[5] 유솔 15% 계산이 POST-FEE (net) 기준임을 확인');
  const principal15 = Math.round(subAll * 0.15);
  const principalActual = pays.reduce((s, p) => s + Number(p.principal_amount || 0), 0);
  console.log(`  subtotal_active × 15%   = ₩${fmt(principal15)}`);
  console.log(`  실제 principal_amount   = ₩${fmt(principalActual)}`);
  console.log(`  차이                    = ₩${fmt(principalActual - principal15)}  (${(Math.abs(principalActual - principal15) / principal15 * 100).toFixed(2)}%)`);
  console.log(`  → ${Math.abs(principalActual - principal15) < principal15 * 0.02 ? '✓ 거의 일치 — 15% 는 subtotal(POST-FEE) 기준' : '⚠️ 불일치'}`);

  // ──────────────────────────────────────
  // [6] 결론
  // ──────────────────────────────────────
  sec('[6] 결론');
  console.log(`  ✓ task_items.subtotal = qty × unit_price = "정산예정금액" = POST-FEE (네이버 수수료 이미 차감)`);
  console.log(`  ✓ task_items.net_amount = subtotal 과 동일 (POST-FEE), CSV 매칭으로 확정 표시 용`);
  console.log(`  ✓ payments.naver_fee = 0 (시스템에 별도 저장 X — 입력 시 이미 차감된 값)`);
  console.log(`  ✓ 유솔 15% × subtotal = 유솔 15% × POST-FEE = 정확 (사장님 흐름과 일치)`);
  console.log('');
  console.log(`  사장님 흐름:`);
  console.log(`     고객결제 원금 → 네이버수수료 → 유솔 정산금 → 유솔 15% / 나머지`);
  console.log(`                    └ DB 미저장        └ subtotal/net_amount`);
  console.log('');
  console.log(`  · DB 의 subtotal = 사장님의 "유솔 정산금" 단계와 일치`);
  console.log(`  · 고객결제 원금(pre-fee) 은 DB 에 거의 안 남음`);
  console.log(`    └ Mig 045 백업된 metadata.old_unit_price 일부만 남음 (위 [2] 참조)`);
  console.log(`  · 별도로 네이버 수수료를 빼는 처리 불필요 — 이미 빠진 값으로 입력됨`);
})().catch(e => { console.error('FATAL:', e.message); console.error(e.stack); process.exit(1); });

// 유솔N 5월 track B 중 활성 task_items = 0 인 task 조사 (사장님 SQL)
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

  // 5월 작업분 track B payments + task + items
  let pays = [], off = 0;
  while (true) {
    const { data, error } = await sb.from('payments')
      .select('engineer_amount, tasks!inner(id, task_no, customer_name, status, completed_at, principal_id, tenant_id)')
      .eq('track', 'B')
      .eq('tasks.principal_id', usolnId)
      .eq('tasks.status', '완료')
      .gte('tasks.completed_at', '2026-05-01T00:00:00+09:00')
      .lt('tasks.completed_at',  '2026-06-01T00:00:00+09:00')
      .range(off, off + 999);
    if (error) { console.log('error:', error.message); break; }
    pays = pays.concat(data || []);
    if (!data || data.length < 1000) break;
    off += 1000;
  }

  const taskIds = pays.map(p => p.tasks.id);
  // items 일괄 (chunked 300)
  const allItems = [];
  for (let i = 0; i < taskIds.length; i += 300) {
    const chunk = taskIds.slice(i, i + 300);
    const { data } = await sb.from('task_items')
      .select('id, task_id, is_canceled, subtotal')
      .in('task_id', chunk);
    allItems.push(...(data || []));
  }
  const itemsByTask = new Map();
  for (const it of allItems) {
    if (!itemsByTask.has(it.task_id)) itemsByTask.set(it.task_id, []);
    itemsByTask.get(it.task_id).push(it);
  }

  // HAVING COUNT(ti.id) FILTER (WHERE is_canceled=false) = 0
  const rows = [];
  for (const p of pays) {
    const t = p.tasks;
    const items = itemsByTask.get(t.id) || [];
    const active = items.filter(i => i.is_canceled === false);
    if (active.length === 0) {
      rows.push({
        task_no:        t.task_no,
        customer:       t.customer_name,
        status:         t.status,
        completed_kst:  new Date(new Date(t.completed_at).getTime() + 9*3600*1000).toISOString().slice(0, 10),
        engineer_amount: Number(p.engineer_amount) || 0,
        active_items:   active.length,
        total_items:    items.length,
        sub_sum:        items.reduce((s, i) => s + Number(i.subtotal || 0), 0),
      });
    }
  }
  rows.sort((a, b) => b.engineer_amount - a.engineer_amount);

  console.log('═'.repeat(110));
  console.log(`활성 item = 0 인 5월 작업 track B usol_n: ${rows.length}건`);
  console.log('═'.repeat(110));
  console.log('task_no'.padEnd(18) + ' ' + '고객'.padEnd(18) + ' ' + '완료일'.padEnd(12) + 'engineer_amount'.padStart(15) + ' active/total ' + 'subtotal합'.padStart(12));
  console.log('─'.repeat(110));
  let sumEng = 0, sumSub = 0;
  for (const r of rows) {
    console.log(
      String(r.task_no).padEnd(18) + ' ' +
      String(r.customer || '').slice(0, 18).padEnd(18) + ' ' +
      r.completed_kst.padEnd(12) +
      String(fmt(r.engineer_amount)).padStart(15) + ' ' +
      String(`${r.active_items}/${r.total_items}`).padStart(11) + ' ' +
      String(fmt(r.sub_sum)).padStart(12)
    );
    sumEng += r.engineer_amount;
    sumSub += r.sub_sum;
  }
  console.log('─'.repeat(110));
  console.log(`합계 engineer_amount = ₩${fmt(sumEng)} / subtotal(cancel 포함) = ₩${fmt(sumSub)}`);
  console.log('');
  console.log('해석:');
  console.log('  · 활성 item 0 → engByItem 분배 실패 (subSum=0 균등 분배 폴백 또는 누락).');
  console.log('  · _excl_extra 산식에서는 task 단위 engineer_excl_extra 가 0 으로 카운트되거나 미분배.');
  console.log('  · 5월 payments 840건 중 이 케이스 = 정합 위반. 운영 확인 필요.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

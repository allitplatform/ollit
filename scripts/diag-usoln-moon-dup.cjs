// 진단 (읽기 전용) — usol_n 문연희 중복 의심
// 2026-05-25
const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const { data: p } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  const PID = p.id;

  // 1) 라이브 — 이름 + 전화 OR
  const { data: byName }  = await sb.from("tasks")
    .select("id, task_no, customer_name, phone, external_order_no, status, scheduled_at, completed_at, product_price, total_amount, created_at, assigned_engineer_id")
    .eq("principal_id", PID).eq("customer_name", "문연희");
  const { data: byPhone } = await sb.from("tasks")
    .select("id, task_no, customer_name, phone, external_order_no, status, scheduled_at, completed_at, product_price, total_amount, created_at, assigned_engineer_id")
    .eq("principal_id", PID).eq("phone", "010-9382-0980");

  const map = new Map();
  for (const r of [...(byName||[]), ...(byPhone||[])]) map.set(r.id, r);
  const rows = [...map.values()].sort((a,b) => String(a.created_at).localeCompare(String(b.created_at)));
  console.log(`════ 라이브 매칭 task: ${rows.length}건 ════`);

  // 2) task_items + payments
  const ids = rows.map(r => r.id);
  const { data: items } = ids.length ? await sb.from("task_items")
    .select("id, task_id, order_type, product_order_id, qty, unit_price, subtotal, customer_paid_amount, work_types(name), appliance_types(name)")
    .in("task_id", ids) : { data: [] };
  const { data: payments } = ids.length ? await sb.from("payments")
    .select("task_id, product_price, engineer_amount, principal_amount, owner_amount, is_balanced, status, calc_method, track")
    .in("task_id", ids) : { data: [] };
  const itemsByTask = new Map();
  for (const it of items || []) {
    if (!itemsByTask.has(it.task_id)) itemsByTask.set(it.task_id, []);
    itemsByTask.get(it.task_id).push(it);
  }
  const pmByTask = new Map((payments || []).map(p => [p.task_id, p]));

  // 3) 각 task 상세
  const TARGET_POIDS = new Set([
    "2026051573795450", "2026051573795440",  // A
    "2026051573795431", "2026051573795451", "2026051573795441",  // B (— 뒤 3개)
  ]);
  // 사장님 spec에 "...795450" 등 끝 6자리만 — full id 추정. 라이브 데이터의 actual poid와 매칭은 endsWith.
  function tagPoid(poid) {
    if (!poid) return "—";
    for (const t of TARGET_POIDS) if (poid === t) return `★ ${t}`;
    // endsWith 추론 (사장님 spec의 ...XXX 형태 매칭)
    for (const t of ["795450","795440","795431","795451","795441"]) {
      if (String(poid).endsWith(t)) return `★ ${poid} (시트 ...${t})`;
    }
    return String(poid);
  }

  for (const t of rows) {
    console.log(`\n──────────────────────────────────────────────────────`);
    console.log(`task_no            : ${t.task_no}`);
    console.log(`id                 : ${t.id}`);
    console.log(`customer / phone   : ${t.customer_name} / ${t.phone}`);
    console.log(`external_order_no  : ${t.external_order_no}`);
    console.log(`status             : ${t.status}`);
    console.log(`scheduled_at       : ${t.scheduled_at || '(NULL)'}`);
    console.log(`completed_at       : ${t.completed_at || '(NULL)'}`);
    console.log(`product_price      : ${t.product_price}`);
    console.log(`total_amount       : ${t.total_amount}`);
    console.log(`created_at         : ${t.created_at}`);
    console.log(`assigned_engineer  : ${t.assigned_engineer_id || '(X)'}`);
    const its = itemsByTask.get(t.id) || [];
    console.log(`task_items 개수    : ${its.length}`);
    its.forEach(it => {
      console.log(`  · ${it.order_type || '(X)'} | wt=${it.work_types?.name || '—'} | app=${it.appliance_types?.name || '—'} | qty=${it.qty} unit=${it.unit_price} sub=${it.subtotal} | poid=${tagPoid(it.product_order_id)}`);
    });
    const pm = pmByTask.get(t.id);
    console.log(`payment            : ${pm ? `pp=${pm.product_price} eng=${pm.engineer_amount} prin=${pm.principal_amount} own=${pm.owner_amount} bal=${pm.is_balanced} status=${pm.status} method=${pm.calc_method} track=${pm.track}` : '없음'}`);
  }

  // 4) A vs B 비교
  console.log(`\n════ A·B 비교 ════`);
  const aCands = rows.filter(t => t.status === "미배정" && Number(t.product_price) === 20000);
  const bCands = rows.filter(t => t.status === "확정"   && Number(t.product_price) === 137407);
  console.log(`A 후보 (미배정 + pp=20000) : ${aCands.length}건 — ${aCands.map(x=>x.task_no).join(', ')}`);
  console.log(`B 후보 (확정 + pp=137407) : ${bCands.length}건 — ${bCands.map(x=>x.task_no).join(', ')}`);
  if (aCands.length === 1 && bCands.length === 1) {
    const a = aCands[0], b = bCands[0];
    console.log(`A.ext = ${a.external_order_no}`);
    console.log(`B.ext = ${b.external_order_no}`);
    console.log(`A.ext === B.ext ? : ${a.external_order_no === b.external_order_no ? '★ 같음' : '다름'}`);
  }

  // 5) 백업에서 문연희 검색
  console.log(`\n════ 백업(usoln-merge-before-2026-05-24T21-34-12.json) 문연희 ════`);
  const bak = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "backups", "usoln-merge-before-2026-05-24T21-34-12.json"), "utf8"));
  const bakTasks = (bak.tasks || []).filter(t => t.customer_name === "문연희" || (t.phone && t.phone === "010-9382-0980"));
  console.log(`백업 매칭 task: ${bakTasks.length}건`);
  bakTasks.forEach(t => {
    console.log(`  · ${t.task_no} | id=${t.id.slice(0,8)} | ext=${t.external_order_no} | status=${t.status} | pp=${t.product_price} | created=${t.created_at}`);
  });
  // 백업 task_items 매칭
  const bakTaskIds = new Set(bakTasks.map(t => t.id));
  const bakItems = (bak.task_items || []).filter(it => bakTaskIds.has(it.task_id));
  console.log(`백업 task_items: ${bakItems.length}건`);
  bakItems.forEach(it => {
    const t = bakTasks.find(x => x.id === it.task_id);
    console.log(`  · ${t?.task_no} | ${it.order_type || '(X)'} | qty=${it.qty} unit=${it.unit_price} sub=${it.subtotal} | poid=${tagPoid(it.product_order_id)}`);
  });

  // 6) 5개 시트 poid → 라이브 위치
  console.log(`\n════ 시트 5개 poid → 라이브 매핑 ════`);
  const liveAllItems = (items || []);
  for (const tail of ["795450","795440","795431","795451","795441"]) {
    const hit = liveAllItems.filter(it => String(it.product_order_id || "").endsWith(tail));
    if (hit.length === 0) {
      console.log(`  · ...${tail}: 라이브에서 없음`);
    } else {
      hit.forEach(it => {
        const t = rows.find(x => x.id === it.task_id);
        console.log(`  · ...${tail}: ${t?.task_no} | ${it.order_type} | ${it.work_types?.name || it.appliance_types?.name} | sub=${it.subtotal}`);
      });
    }
  }
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

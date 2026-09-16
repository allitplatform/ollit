// 진단 (읽기 전용) — usol_n 잔여 2건 (마지혜 / 전아름)
const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TARGETS = [
  { name: "마지혜",  task_no: "YS-260516-019", exts: ["2026051529272691", "2026051588171411"], phone: "010-4641-8739" },
  { name: "전아름",  task_no: "YS-260517-023", exts: ["2026051657667811", "2026051618039281"], phone: "010-3869-3091" },
];

(async () => {
  const { data: p } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  const PID = p.id;

  for (const tg of TARGETS) {
    console.log("\n" + "═".repeat(82));
    console.log(`[${tg.name}] task_no=${tg.task_no} | ext=${tg.exts.join(", ")} | phone=${tg.phone}`);
    console.log("═".repeat(82));

    // task_no 또는 external_order_no 매칭
    const { data: byNo } = await sb.from("tasks")
      .select("id, task_no, customer_name, phone, external_order_no, status, scheduled_at, assigned_engineer_id, product_price, total_amount, created_at")
      .eq("principal_id", PID).eq("task_no", tg.task_no);
    const { data: byExt } = await sb.from("tasks")
      .select("id, task_no, customer_name, phone, external_order_no, status, scheduled_at, assigned_engineer_id, product_price, total_amount, created_at")
      .eq("principal_id", PID).in("external_order_no", tg.exts);
    // 전화로도 안전망
    const { data: byPhone } = await sb.from("tasks")
      .select("id, task_no, customer_name, phone, external_order_no, status, scheduled_at, assigned_engineer_id, product_price, total_amount, created_at")
      .eq("principal_id", PID).eq("phone", tg.phone);

    const map = new Map();
    for (const r of [...(byNo||[]), ...(byExt||[]), ...(byPhone||[])]) map.set(r.id, r);
    const rows = [...map.values()];

    if (rows.length === 0) {
      console.log("  결과: 없음 (task_no / external_order_no / phone 모두 매칭 X)");
      continue;
    }

    // 보조 정보 — items, payments, 기사
    const ids = rows.map(r => r.id);
    const { data: items } = await sb.from("task_items").select("task_id, order_type, qty, subtotal, work_types(name), appliance_types(name)").in("task_id", ids);
    const { data: payments } = await sb.from("payments").select("task_id, product_price, engineer_amount, principal_amount, owner_amount, is_balanced, status").in("task_id", ids);
    const engIds = [...new Set(rows.map(r => r.assigned_engineer_id).filter(Boolean))];
    const { data: engs } = engIds.length > 0 ? await sb.from("users").select("id, name, code").in("id", engIds) : { data: [] };
    const engById = new Map((engs || []).map(e => [e.id, e]));
    const itemsByTask = new Map();
    for (const it of items || []) {
      if (!itemsByTask.has(it.task_id)) itemsByTask.set(it.task_id, []);
      itemsByTask.get(it.task_id).push(it);
    }
    const pmByTask = new Map();
    for (const pm of payments || []) pmByTask.set(pm.task_id, pm);

    console.log(`  매칭 행 수: ${rows.length}`);
    for (const r of rows) {
      const its = itemsByTask.get(r.id) || [];
      const pm = pmByTask.get(r.id);
      const eng = r.assigned_engineer_id ? engById.get(r.assigned_engineer_id) : null;
      console.log(`\n  ───────────────────────────`);
      console.log(`  task_no             : ${r.task_no}`);
      console.log(`  id                  : ${r.id}`);
      console.log(`  customer / phone    : ${r.customer_name} / ${r.phone}`);
      console.log(`  external_order_no   : ${r.external_order_no}`);
      console.log(`  status              : ${r.status}`);
      console.log(`  scheduled_at        : ${r.scheduled_at || '(X)'}`);
      console.log(`  assigned_engineer   : ${eng ? `${eng.name} (${eng.code})` : '(X)'}`);
      console.log(`  product_price       : ${r.product_price}`);
      console.log(`  total_amount        : ${r.total_amount}`);
      console.log(`  task_items 개수     : ${its.length}`);
      if (its.length > 0) {
        its.forEach(it => console.log(`     · ${it.order_type || '(X)'} | ${it.appliance_types?.name || '—'} | ${it.work_types?.name || '—'} | qty=${it.qty} sub=${it.subtotal}`));
      }
      console.log(`  payment             : ${pm ? `있음 (status=${pm.status} pp=${pm.product_price} eng=${pm.engineer_amount} prin=${pm.principal_amount} own=${pm.owner_amount} bal=${pm.is_balanced})` : '없음'}`);
    }
  }
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

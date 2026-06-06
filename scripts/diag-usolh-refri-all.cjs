// usol_h 측측 측측 완료측 전체 — (NEW rate×received) vs (현재 engineer_amount) 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  const { data: ph } = await sb.from("principals").select("id").eq("code","usol_h").maybeSingle();
  const usolHId = ph.id;

  // usol_h 완료 task (status=완료) 측 task_items 측 refrigerant 측측
  const { data: tasks } = await sb.from("tasks")
    .select(`id, task_no, status, total_amount, extra_fee, product_price, assigned_engineer_id,
             task_items(id, qty, unit_price, subtotal, received_amount, order_type,
                        work_types(name, service_types(code)),
                        appliance_types(name)),
             payments(engineer_amount, principal_amount, owner_amount, calc_method, is_balanced)`)
    .eq("principal_id", usolHId).eq("status", "완료");

  console.log(`\n=== usol_h 완료 측측 (refri 포함): ${(tasks||[]).length}건 측측 ===\n`);

  const targets = [];
  for (const t of (tasks||[])) {
    const items = t.task_items || [];
    const refriItems = items.filter(it => it.work_types?.service_types?.code === "refrigerant");
    if (refriItems.length === 0) continue;

    // engineer rate
    let engRate = 50, engName = "?";
    if (t.assigned_engineer_id) {
      const { data: u } = await sb.from("users").select("name, refrigerant_rate").eq("id", t.assigned_engineer_id).maybeSingle();
      engRate = Number(u?.refrigerant_rate) || 50;
      engName = u?.name || "?";
    }

    // 측 측측 측 추측 측측 측 = received(또는 fallback subtotal) × engRate / 100
    let refriExpectedEng = 0;
    for (const it of refriItems) {
      const recv = Number(it.received_amount) || 0;
      const sub  = Number(it.subtotal) || (Number(it.qty)||1) * (Number(it.unit_price)||0);
      const base = recv > 0 ? recv : sub;
      refriExpectedEng += Math.floor(base * engRate / 100);
    }

    // 측측 측 측 측 측 측 (분측 측측 측측 측측 — payments 측 측측 측측 측 추측)
    const cleaningSeg = items.filter(it => it.work_types?.service_types?.code === "cleaning");
    const cleaningRecv = cleaningSeg.reduce((s, it) => s + (Number(it.received_amount) || 0), 0);

    const pmt = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    const curEng = Number(pmt?.engineer_amount) || 0;

    // 측 측 측 측 측 측 측 (cleaning 측 측측 측측 + refri 측 NEW): cleaning_eng_current = curEng - refri_eng_current
    // 측측 measure 측 refri 측 0 측측. → curEng 측 cleaning 측측 측측 측. NEW total = curEng + refriExpectedEng (refri 측 0 측측 측).
    const newTotalEng = curEng + refriExpectedEng;
    const diff = newTotalEng - curEng;

    targets.push({
      task_no: t.task_no, id: t.id, principal_id: t.principal_id,
      total: Number(t.total_amount)||0, product: Number(t.product_price)||0, extra: Number(t.extra_fee)||0,
      cleaningRecv,
      refriRecv: refriItems.reduce((s, it) => s + (Number(it.received_amount) || 0), 0),
      refriProduct: refriItems.reduce((s, it) => s + ((Number(it.qty)||1) * (Number(it.unit_price)||0)), 0),
      engName, engRate,
      curEng, refriExpectedEng, newTotalEng, diff,
      calc_method: pmt?.calc_method, is_balanced: pmt?.is_balanced,
    });
  }

  console.log("측측 측측 (diff > 0 측 측측, asc by task_no):\n");
  for (const r of targets.sort((a,b) => a.task_no.localeCompare(b.task_no))) {
    const flag = r.diff > 0 ? "⚠️" : (r.diff < 0 ? "🔻" : "✓");
    console.log(`  ${flag} ${r.task_no}  product=${fmt(r.product)} extra=${fmt(r.extra)} total=${fmt(r.total)}`);
    console.log(`     기사=${r.engName}(rate=${r.engRate}%)  refri_recv=${fmt(r.refriRecv)} refri_product=${fmt(r.refriProduct)}`);
    console.log(`     cur_eng=${fmt(r.curEng)}  →  new_eng=${fmt(r.newTotalEng)}  (diff=${r.diff > 0 ? "+" : ""}${fmt(r.diff)})  calc=${r.calc_method}`);
  }

  // 측측
  const withDiff = targets.filter(r => Math.abs(r.diff) > 0);
  const totalDiff = withDiff.reduce((s, r) => s + r.diff, 0);
  console.log(`\n--- 측측 ---`);
  console.log(`측측 task: ${targets.length}건 / 측측 측측 측측: ${withDiff.length}건`);
  console.log(`측측 측측 측측 합: ${fmt(totalDiff)}원`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });

// usol_h 측측 측측 완료측 — 측측측 측측 비교 (per_item RPC 호출 측 측측 추측)
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

  const { data: tasks } = await sb.from("tasks")
    .select(`id, task_no, status, total_amount, extra_fee, product_price, assigned_engineer_id,
             task_items(id, qty, unit_price, subtotal, received_amount, order_type,
                        work_types(name, service_types(code)),
                        appliance_types(name)),
             payments(engineer_amount, principal_amount, owner_amount, calc_method, is_balanced)`)
    .eq("principal_id", usolHId).eq("status", "완료");

  console.log(`\n=== usol_h 완료 측 refrigerant 측측 task: 측측 ${(tasks||[]).filter(t=>(t.task_items||[]).some(it=>it.work_types?.service_types?.code==="refrigerant")).length}건 ===\n`);

  // 측측측: cur_eng_per_refri = (per_item RPC dry-run 측측 측측 → 측측 측측 측측측 측 측측 측측).
  // 측측측: NEW = received(또는 product) × engRate / 100. 측측 task 측측 측측 비교.
  // 측측: per_item RPC 측측 측측 (측 task 측 측측 호출) — 측측 측측측.

  const targets = [];
  for (const t of (tasks||[])) {
    const items = t.task_items || [];
    const refriItems = items.filter(it => it.work_types?.service_types?.code === "refrigerant");
    if (refriItems.length === 0) continue;

    let engRate = 50, engName = "?";
    if (t.assigned_engineer_id) {
      const { data: u } = await sb.from("users").select("name, refrigerant_rate").eq("id", t.assigned_engineer_id).maybeSingle();
      engRate = Number(u?.refrigerant_rate) || 50;
      engName = u?.name || "?";
    }

    // 측측측 NEW (per_item RPC 측측 측측 → 측측 호출)
    let newPerItem = null;
    try {
      const { data: rpcRes } = await sb.rpc("compute_engineer_amount_per_item", {
        p_task_id: t.id,
      });
      newPerItem = rpcRes;
    } catch (e) {
      console.warn(`  RPC ${t.task_no} 측측:`, e.message);
    }

    // 측측 측측 측측 → 측측 사장님 정책 측측 측측 측측측 (received OR product × rate%)
    let expectedRefriEng = 0;
    for (const it of refriItems) {
      const recv = Number(it.received_amount) || 0;
      const sub  = Number(it.subtotal) || (Number(it.qty)||1) * (Number(it.unit_price)||0);
      const base = recv > 0 ? recv : sub;
      expectedRefriEng += Math.floor(base * engRate / 100);
    }

    // 측측 (per_item) — refri item 측측 sum
    let curRefriEng = 0;
    if (Array.isArray(newPerItem)) {
      for (const row of newPerItem) {
        // 측측 task_item 측측 service 측측
        const it = refriItems.find(x => x.id === row.task_item_id);
        if (it) curRefriEng += Number(row.engineer_amount) || 0;
      }
    }
    const diff = expectedRefriEng - curRefriEng;

    const pmt = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    targets.push({
      task_no: t.task_no, id: t.id,
      product: Number(t.product_price)||0, extra: Number(t.extra_fee)||0, total: Number(t.total_amount)||0,
      engName, engRate,
      curRefriEng, expectedRefriEng, diff,
      curEngTotal: Number(pmt?.engineer_amount)||0,
      calc: pmt?.calc_method,
    });
  }

  console.log("측측 측측 (per_item RPC 측측 cur vs 측측측):\n");
  for (const r of targets.sort((a,b) => a.task_no.localeCompare(b.task_no))) {
    const flag = r.diff > 0 ? "⚠️" : (r.diff < 0 ? "🔻" : "✓");
    console.log(`  ${flag} ${r.task_no}  product=${fmt(r.product)} extra=${fmt(r.extra)} total=${fmt(r.total)}  기사=${r.engName}(${r.engRate}%)`);
    console.log(`     RPC측 측측 refri_eng=${fmt(r.curRefriEng)}  측측측=${fmt(r.expectedRefriEng)}  diff=${r.diff > 0 ? "+" : ""}${fmt(r.diff)}  (payment.eng_total=${fmt(r.curEngTotal)} calc=${r.calc})`);
  }
  const changed = targets.filter(r => Math.abs(r.diff) > 0);
  const totalDiff = changed.reduce((s, r) => s + r.diff, 0);
  console.log(`\n--- 측측 ---`);
  console.log(`측측 task: ${targets.length}건  /  측측 측측 측측: ${changed.length}건  /  측측 측측 측측 합: ${fmt(totalDiff)}원`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });

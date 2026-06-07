// 측측 측측 사후 측측 — usol_h Track A 측측 + 측측 측측 측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  // ── 1) YS-260605-001 측측 측측: track + 측측 측측
  console.log("=== YS-260605-001 측측 측측 측 측측 ===");
  const { data: t1 } = await sb.from("tasks")
    .select(`id, task_no, status, principals:principal_id(code),
             payments(calc_method, track, engineer_amount, principal_amount, owner_amount, is_balanced, status, engineer_remitted_at, engineer_remit_confirmed_at)`)
    .eq("task_no", "YS-260605-001").maybeSingle();
  const p1 = Array.isArray(t1?.payments) ? t1.payments[0] : t1?.payments;
  console.log(`  principal: ${t1?.principals?.code}`);
  console.log(`  status:    ${t1?.status}`);
  console.log(`  payment:   calc=${p1?.calc_method}  track=${p1?.track}  pay_status=${p1?.status}`);
  console.log(`              engineer=${fmt(p1?.engineer_amount)} principal=${fmt(p1?.principal_amount)} owner=${fmt(p1?.owner_amount)} is_balanced=${p1?.is_balanced}`);
  console.log(`              eng_remitted_at=${p1?.engineer_remitted_at || "—"} eng_remit_confirmed_at=${p1?.engineer_remit_confirmed_at || "—"}`);

  // ── 2) usol_h 측 측측 완료 task 측 track 분포 (회귀 측측)
  console.log("\n=== usol_h 모든 완료 task 측 track 분포 ===");
  const { data: ph } = await sb.from("principals").select("id").eq("code","usol_h").maybeSingle();
  const { data: ts } = await sb.from("tasks")
    .select(`task_no, status, payments(track, calc_method)`)
    .eq("principal_id", ph.id).eq("status", "완료");
  const tracks = {};
  for (const t of (ts||[])) {
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    const k = p?.track || "(none)";
    if (!tracks[k]) tracks[k] = [];
    tracks[k].push({ no: t.task_no, calc: p?.calc_method });
  }
  for (const [k, arr] of Object.entries(tracks)) {
    console.log(`  Track ${k}: ${arr.length}건`);
    for (const x of arr) console.log(`    ${x.no}  calc=${x.calc}`);
  }

  // ── 3) 측측 측측 (allday 측 측측 calc_method 측측측) Track 분류 측측
  console.log("\n=== 회귀 — allday 완료 task track 분포 (변경 X 측측) ===");
  const { data: pa } = await sb.from("principals").select("id").eq("code","allday").maybeSingle();
  const { data: ta } = await sb.from("tasks")
    .select(`task_no, status, payments(track, calc_method)`)
    .eq("principal_id", pa.id).eq("status", "완료").limit(10);
  const tracksA = {};
  for (const t of (ta||[])) {
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    const k = p?.track || "(none)";
    tracksA[k] = (tracksA[k]||0) + 1;
  }
  for (const [k, v] of Object.entries(tracksA)) console.log(`  Track ${k}: ${v}건 (sample 10)`);

  // ── 4) ② 측측측 측측 측측측 — usol_h refri 완료 측측 RPC dry-run vs payments
  console.log("\n=== ② 측측측 측측 측측측 (per_item RPC vs payments) ===");
  const { data: usolhTasks } = await sb.from("tasks")
    .select(`id, task_no, total_amount, product_price, extra_fee,
             task_items(id, work_types(service_types(code))),
             payments(engineer_amount, principal_amount, owner_amount, calc_method)`)
    .eq("principal_id", ph.id).eq("status", "완료");

  const refriTasks = (usolhTasks||[]).filter(t => (t.task_items||[]).some(it => it.work_types?.service_types?.code === "refrigerant"));
  console.log(`측측 refri task: ${refriTasks.length}건`);
  let diffCount = 0, diffSum = 0;
  for (const t of refriTasks) {
    const { data: rpcRes } = await sb.rpc("compute_engineer_amount_per_item", { p_task_id: t.id });
    const rpcEng = Array.isArray(rpcRes) ? rpcRes.reduce((s, r) => s + (Number(r.engineer_amount)||0), 0) : 0;
    const pmt = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    const curEng = Number(pmt?.engineer_amount) || 0;
    const diff = rpcEng - curEng;
    const flag = Math.abs(diff) > 0 ? "⚠️" : "✓";
    console.log(`  ${flag} ${t.task_no} product=${fmt(t.product_price)} extra=${fmt(t.extra_fee)} | per_item_RPC eng=${fmt(rpcEng)} | payment eng=${fmt(curEng)} diff=${diff > 0 ? "+" : ""}${fmt(diff)}`);
    if (Math.abs(diff) > 0) { diffCount++; diffSum += diff; }
  }
  console.log(`\n측측측 측측 측측: ${diffCount}건 / 측측 합: ${fmt(diffSum)}`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });

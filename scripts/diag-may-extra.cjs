const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT="11111111-1111-1111-1111-111111111111", PID="22222222-2222-2222-2222-222222222006";
const S="2026-04-30T15:00:00Z", E="2026-05-31T15:00:00Z";
const won = n => `₩${(Number(n)||0).toLocaleString()}`;

(async () => {
  const { data: tasks } = await sb.from("tasks").select("id, task_no")
    .eq("tenant_id", TENANT).eq("principal_id", PID).eq("status", "완료")
    .gte("completed_at", S).lt("completed_at", E);
  const tById = new Map(tasks.map(t => [t.id, t]));
  const ids = tasks.map(t => t.id);
  const items = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from("task_items")
      .select("id, task_id, net_amount, is_canceled, order_type, product_order_id, subtotal, unit_price, qty")
      .in("task_id", ids.slice(i, i + 200));
    if (data) items.push(...data);
  }

  console.log("=== naver vs cash 트랙 (is_canceled=false 만) ===");
  const tracks = { naver: [], cash: [] };
  for (const it of items) {
    if (it.is_canceled) continue;
    (it.product_order_id ? tracks.naver : tracks.cash).push(it);
  }
  for (const [k, list] of Object.entries(tracks)) {
    const sum = list.reduce((s, it) => s + (Number(it.net_amount) || 0), 0);
    const pos = list.filter(it => Number(it.net_amount) > 0).length;
    const nul = list.filter(it => it.net_amount == null).length;
    const zer = list.filter(it => Number(it.net_amount) === 0).length;
    console.log(`  ${k.padEnd(6)} : ${String(list.length).padStart(5)}건 | net_sum ${won(sum)} | x0.85=${won(Math.round(sum*0.85))} | POS=${pos} NULL=${nul} ZERO=${zer}`);
  }

  console.log("\n=== order_type 분포 (활성) ===");
  const byType = {};
  for (const it of items) {
    if (it.is_canceled) continue;
    const k = String(it.order_type || "(null)");
    if (!byType[k]) byType[k] = { cnt: 0, sum: 0, naver: 0, cash: 0 };
    byType[k].cnt += 1;
    byType[k].sum += Number(it.net_amount) || 0;
    if (it.product_order_id) byType[k].naver += 1;
    else byType[k].cash += 1;
  }
  for (const [k, v] of Object.entries(byType).sort((a, b) => b[1].sum - a[1].sum)) {
    console.log(`  ${k.padEnd(14)} : ${String(v.cnt).padStart(5)}건 | net ${won(v.sum)} | naver=${v.naver} cash=${v.cash}`);
  }

  console.log("\n=== 구 (YS-260xxx) net 산정 출처 추정 (POSITIVE 활성) ===");
  const legacy = items.filter(it => {
    const t = tById.get(it.task_id);
    return t && t.task_no?.startsWith("YS-260") && !it.is_canceled && Number(it.net_amount) > 0;
  });
  const eqSub = legacy.filter(it => Math.abs(Number(it.net_amount) - Number(it.subtotal)) <= 1);
  const lessSub = legacy.filter(it => Number(it.net_amount) < Number(it.subtotal) * 0.95);
  const moreSub = legacy.filter(it => Number(it.net_amount) > Number(it.subtotal) * 1.05);
  const mid = legacy.length - eqSub.length - lessSub.length - moreSub.length;
  console.log(`  POSITIVE 활성 ${legacy.length}건:`);
  console.log(`  · net == subtotal (+-1)      : ${eqSub.length}건`);
  console.log(`  · net < subtotal x 0.95      : ${lessSub.length}건`);
  console.log(`  · net > subtotal x 1.05      : ${moreSub.length}건`);
  console.log(`  · 그 외 (0.95~1.05 사이)      : ${mid}건`);

  console.log("\n  샘플 5건 (legacy POSITIVE 활성):");
  legacy.slice(0, 5).forEach(it => {
    const t = tById.get(it.task_id);
    console.log(`    ${t.task_no} | net=${it.net_amount} | sub=${it.subtotal} | qty=${it.qty} | unit=${it.unit_price} | type=${it.order_type} | poid=${it.product_order_id || "(null)"}`);
  });
})();

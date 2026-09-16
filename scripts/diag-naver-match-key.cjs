// 네이버 정산 매칭 키 진단 — 수정 X
const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PRINCIPAL_ID = "22222222-2222-2222-2222-222222222006";

(async () => {
  // usol_n task → task_items 측 product_order_id 측 측
  const { data: tasks } = await sb.from("tasks").select("id").eq("tenant_id", TENANT_ID).eq("principal_id", PRINCIPAL_ID);
  const taskIds = tasks.map(t => t.id);
  const allItems = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    const { data } = await sb.from("task_items").select("id, product_order_id").in("task_id", taskIds.slice(i, i + 200));
    if (data) allItems.push(...data);
  }
  const filled = allItems.filter(it => it.product_order_id);
  const nullCnt = allItems.length - filled.length;
  console.log(`task_items 측: ${allItems.length}건`);
  console.log(`  · product_order_id 측 측: ${filled.length}건 (${(filled.length / allItems.length * 100).toFixed(1)}%)`);
  console.log(`  · NULL: ${nullCnt}건 (${(nullCnt / allItems.length * 100).toFixed(1)}%)`);

  // 측 측
  const poCount = new Map();
  for (const it of filled) {
    const po = it.product_order_id;
    poCount.set(po, (poCount.get(po) || 0) + 1);
  }
  const dups = Array.from(poCount.entries()).filter(([, v]) => v > 1);
  console.log(`\n  · unique product_order_id: ${poCount.size}건`);
  console.log(`  · 중복 product_order_id: ${dups.length}건`);
  if (dups.length > 0) {
    console.log(`    측 5건:`);
    for (const [po, n] of dups.slice(0, 5)) console.log(`      · ${po}: ${n}개`);
  }
})();

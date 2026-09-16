// 진단 — PostgREST inline embed vs 직접 query 비교 (한유경 019)
const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const HAN_NO = "YS-260511-019";
  const { data: t } = await sb.from("tasks").select("id, task_no").eq("task_no", HAN_NO).single();
  const taskId = t.id;
  console.log(`task ${HAN_NO} id=${taskId}\n`);

  // 1) 직접 task_items WHERE task_id = X
  const { data: direct } = await sb
    .from("task_items")
    .select("id, task_id, order_type, qty, work_types(name), appliance_types(name)")
    .eq("task_id", taskId);
  console.log(`[A] 직접 .eq("task_id"): ${direct.length}건`);
  direct.forEach(it => console.log(`    · ${it.order_type} | app=${it.appliance_types?.name} | wt=${it.work_types?.name}`));

  // 2) inline embed (PrincipalListTab가 쓰는 패턴)
  const { data: emb } = await sb
    .from("tasks")
    .select(`id, task_no, task_items(id, task_id, order_type, qty, work_types(name), appliance_types(name))`)
    .eq("id", taskId)
    .single();
  console.log(`\n[B] inline embed (tasks→task_items): ${emb.task_items.length}건`);
  emb.task_items.forEach(it => console.log(`    · ${it.order_type} | app=${it.appliance_types?.name} | wt=${it.work_types?.name}`));

  // 3) 좀 더 단순한 embed — work_types/appliance_types 빼고
  const { data: emb2 } = await sb
    .from("tasks")
    .select(`id, task_no, task_items(id, task_id, order_type, qty)`)
    .eq("id", taskId)
    .single();
  console.log(`\n[C] inline embed (단순, nested join 없음): ${emb2.task_items.length}건`);

  // 4) 명시적 FK 측 hint
  const { data: emb3 } = await sb
    .from("tasks")
    .select(`id, task_items!task_items_task_id_fkey(id, task_id, order_type)`)
    .eq("id", taskId)
    .single();
  console.log(`\n[D] inline embed with FK hint: ${(emb3.task_items || []).length}건`);

  // 5) tasks 측 어떤 task_id 가지고 있는지 (확인)
  const { data: all } = await sb.from("task_items").select("id, task_id").eq("task_id", taskId).limit(20);
  console.log(`\n[E] task_id 정확한 매칭: ${all.length}건 (id: ${all.map(x=>x.id.slice(0,8)).join(',')})`);
})().catch(e => { console.error(e); process.exit(1); });

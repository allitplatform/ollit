// 2026-06-03 — 테스트 데이터 삭제 측측 dry-run (사장님 측측 측측 측측).
//   기준: tasks.customer_name LIKE '%테스트%'
//   측측 측측: source ↔ -R 측측 (refrigerant_addon.processed_task_id) 측측 측측측 측측.
//   삭제 X — SELECT 측측.
const fs = require("fs"), path = require("path");
function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  // [1] direct match — 고객명 측측 측측 측측
  const { data: directs, error: e1 } = await sb
    .from("tasks")
    .select("id, task_no, customer_name, principal_id, status, created_at, category_data, principal_rel:principals!principal_id(code, name)")
    .like("customer_name", "%테스트%");
  if (e1) { console.error("direct query error:", e1); process.exit(1); }

  console.log(`[1] direct match (고객명 LIKE '%테스트%'): ${(directs || []).length}건`);

  // 측측측 측측 id 측측
  const directIds = new Set((directs || []).map(r => r.id));

  // [2] -R 측측 측측 (direct measure source → processed_task_id 측측 -R)
  const processedIds = [];
  for (const r of (directs || [])) {
    const pid = r.category_data?.refrigerant_addon?.processed_task_id;
    if (pid && pid !== "null") processedIds.push(pid);
  }
  let rChildren = [];
  if (processedIds.length > 0) {
    const { data: kids } = await sb
      .from("tasks")
      .select("id, task_no, customer_name, principal_id, status, created_at, category_data, principal_rel:principals!principal_id(code, name)")
      .in("id", processedIds);
    rChildren = kids || [];
  }
  console.log(`[2] -R 측측 (direct 측측 source 측측): ${rChildren.length}건`);

  // [3] source 측측 (direct measure -R → processed_task_id 측측 source)
  //   = direct.id 측 measure category_data.refrigerant_addon.processed_task_id = direct.id 측측 tasks 측측.
  //   Supabase 측측 jsonb 측측 측측 측측 측측 측측 측측 — 측측측 측측.
  let rSources = [];
  // direct 측 -R 측측 측측 측측 — task_no 측측 -R 측측 measure direct 측측. 측측 측측 모든 direct 측측 source 측측 측측.
  const candidates = (directs || []);
  for (const c of candidates) {
    const { data: srcs } = await sb
      .from("tasks")
      .select("id, task_no, customer_name, principal_id, status, created_at, category_data, principal_rel:principals!principal_id(code, name)")
      .eq("category_data->refrigerant_addon->>processed_task_id", c.id);
    if (srcs && srcs.length > 0) rSources.push(...srcs);
  }
  console.log(`[3] source 측측 (direct 측측 -R 측측): ${rSources.length}건`);

  // 측측측측 (직접 + -R 자식 + source)
  const all = new Map();
  for (const r of (directs || []))   all.set(r.id, { ...r, _kind: directIds.has(r.id) ? "direct" : null });
  for (const r of rChildren) {
    const existing = all.get(r.id);
    if (existing) existing._kind = "direct + -R 자식";
    else all.set(r.id, { ...r, _kind: "-R 자식" });
  }
  for (const r of rSources) {
    const existing = all.get(r.id);
    if (existing) existing._kind = (existing._kind ? existing._kind + " + source" : "source");
    else all.set(r.id, { ...r, _kind: "source(고객명 측측측 측측 X)" });
  }

  const list = [...all.values()].sort((a, b) => (a.task_no || "").localeCompare(b.task_no || ""));
  console.log("");
  console.log(`=== 측측측측 삭제 측측 측측: ${list.length}건 ===`);
  console.log("");
  for (const r of list) {
    const addon = r.category_data?.refrigerant_addon || null;
    console.log({
      task_no:       r.task_no,
      customer:      r.customer_name,
      principal:     `${r.principal_rel?.name || "—"} (${r.principal_rel?.code || "—"})`,
      status:        r.status,
      created_at:    r.created_at,
      kind:          r._kind,
      refri_addon:   addon ? {
        amount:             addon.amount,
        appliance:          addon.appliance,
        processed:          addon.processed,
        processed_task_id:  addon.processed_task_id,
      } : null,
      id:            r.id,
    });
  }

  console.log("");
  console.log("=== id 측측 (2단계 DELETE 측측) ===");
  console.log(list.map(r => `'${r.id}'`).join(",\n"));

  process.exit(0);
})();

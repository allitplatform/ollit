// 2026-06-06 — push_subscriptions 측 측 endpoint 측 정리 (Fix C-①)
//   측: (user_id, ua) 측 측 측 endpoint 측 측 측만 측, 측 측 측 모두 DELETE.
//   안전망:
//     · 측 측 측 JSON 측 측 (data/push_subscriptions_backup_<ts>.json)
//     · 측 측 측 측 측 측 측 (DELETE WHERE id IN (...))
//     · dry-run 측 측 — --apply 측 측 측 측 측 측
//
// 측:
//   node scripts/cleanup-push-stale-dupes.cjs           # dry-run (백업 측 측 X)
//   node scripts/cleanup-push-stale-dupes.cjs --apply   # 백업 + 측 측 측

const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const APPLY = process.argv.includes("--apply");

(async () => {
  console.log(`\n=== push_subscriptions 측 측 측 측 (${APPLY ? "APPLY" : "DRY-RUN"}) ===\n`);

  const { data: all, error } = await sb
    .from("push_subscriptions")
    .select("id, user_id, role, ua, endpoint, created_at, last_used_at")
    .order("user_id", { ascending: true });

  if (error) {
    console.error("FATAL fetch:", error);
    process.exit(1);
  }
  console.log(`전체 row: ${(all||[]).length}건`);

  // 1) 백업 — APPLY 측만
  if (APPLY) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dataDir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const backupPath = path.join(dataDir, `push_subscriptions_backup_${ts}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(all, null, 2), "utf8");
    console.log(`✓ 백업: ${backupPath}`);
  }

  // 2) (user_id, ua) 측 그룹 → 측 측 측만 측, 측 측 측 측 측
  const groupKey = (r) => `${r.user_id}::${r.ua || ""}`;
  const byKey = new Map();
  for (const r of (all||[])) {
    if (!byKey.has(groupKey(r))) byKey.set(groupKey(r), []);
    byKey.get(groupKey(r)).push(r);
  }

  const toDelete = [];
  for (const [, rs] of byKey) {
    if (rs.length <= 1) continue;
    // last_used_at desc, tie 측 created_at desc
    rs.sort((a, b) => {
      const la = new Date(a.last_used_at || a.created_at || 0).getTime();
      const lb = new Date(b.last_used_at || b.created_at || 0).getTime();
      return lb - la;
    });
    // 측 측 [0] 측 측, 측 측 측 측 측 측
    for (let i = 1; i < rs.length; i++) toDelete.push(rs[i]);
  }

  console.log(`\n--- 측 측 측 대상: ${toDelete.length}건 ---`);

  // user별 집계
  const byUser = new Map();
  for (const r of toDelete) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, 0);
    byUser.set(r.user_id, byUser.get(r.user_id) + 1);
  }
  for (const [uid, cnt] of [...byUser.entries()].sort((a,b) => b[1]-a[1])) {
    const { data: u } = await sb.from("users").select("code, name").eq("id", uid).maybeSingle();
    console.log(`  ${u?.name || "?"} (${u?.code || "?"}): ${cnt}건 측 측 측`);
  }

  if (toDelete.length === 0) {
    console.log("\n측 측 측 측. 종료.");
    return;
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] 측 측 측 측 측. --apply 측 측 측 측 측 측 측.`);
    return;
  }

  // 3) 측 측 — 측 측 측 측 측 측 측 in() 측 측 (Supabase 100측 단위 안전)
  const ids = toDelete.map(r => r.id);
  const CHUNK = 100;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { error: delErr, count } = await sb
      .from("push_subscriptions")
      .delete({ count: "exact" })
      .in("id", slice);
    if (delErr) {
      console.error(`FATAL DELETE chunk ${i}:`, delErr);
      process.exit(1);
    }
    deleted += count || 0;
  }
  console.log(`\n✓ ${deleted}건 측 측 측 측.`);

  // 4) 측 측 측 측
  const { count: remain } = await sb
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true });
  console.log(`측 push_subscriptions: ${remain}건`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });

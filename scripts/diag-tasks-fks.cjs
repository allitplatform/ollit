// 2026-06-03 — tasks 측측 측측 측측 모든 FK + CASCADE 측측 측측 (2단계 DELETE 측측 측측).
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

// 측측 SQL — pg_constraint + pg_class + pg_attribute 측측 tasks 측측 측측 측측 FK 측측.
//   confdeltype: 'a' = NO ACTION, 'r' = RESTRICT, 'c' = CASCADE, 'n' = SET NULL, 'd' = SET DEFAULT
const FK_SQL = `
SELECT
  conrelid::regclass::text AS child_table,
  conname                  AS constraint_name,
  pg_get_constraintdef(oid) AS def,
  confdeltype              AS on_delete
FROM pg_constraint
WHERE contype = 'f'
  AND confrelid = 'public.tasks'::regclass
ORDER BY conrelid::regclass::text;
`;

(async () => {
  const { data, error } = await sb.rpc("exec_sql_select", { p_query: FK_SQL });
  if (error) {
    // fallback — RPC 측측 측측. 측측측 측측측 SQL 측측 (서비스 측측 측측).
    console.log("RPC 측측 — 측측 측측 측측 측측. 측측 SQL 측측 사장님 측측 Supabase 측측측:");
    console.log("");
    console.log(FK_SQL);
    process.exit(0);
  }
  console.log("=== tasks 측측 측측 측측 측측 모든 FK ===");
  const cascadeMap = { a: "NO ACTION", r: "RESTRICT", c: "CASCADE", n: "SET NULL", d: "SET DEFAULT" };
  for (const row of (data || [])) {
    console.log(`${row.child_table.padEnd(30)} ${cascadeMap[row.on_delete] || row.on_delete} — ${row.constraint_name}`);
  }
  process.exit(0);
})();

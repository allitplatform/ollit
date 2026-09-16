// 수정 후 검증 — fetchPrincipalStatusCounts / loadTasksForRole / countTasksByStatusDb 시뮬
// (수정한 코드의 page loop 로직을 동일하게 실행해서 DB true count와 일치 확인)
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
const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const sbAnon = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const sbSvc = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function pageLoop(client, build) {
  let rows = [], from = 0;
  while (true) {
    const { data, error } = await build(client).range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

(async () => {
  console.log("=".repeat(100));
  console.log("수정 후 검증 — page loop 시뮬");
  console.log("=".repeat(100));

  // truth
  const { count: trueAll } = await sbSvc.from("tasks").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT_ID);
  console.log(`\nDB truth (tenant=allit) = ${trueAll}건`);

  // 1) fetchPrincipalStatusCounts (usol_n+usol_h)
  const { data: ps } = await sbAnon.from("principals").select("id, code").in("code", ["usol_n", "usol_h"]);
  const pids = ps.map(p => p.id);
  const stRows = await pageLoop(sbAnon, c => c.from("tasks").select("status").eq("tenant_id", TENANT_ID).in("principal_id", pids));
  const dist = {};
  for (const r of stRows) dist[r.status] = (dist[r.status] || 0) + 1;
  const total = stRows.filter(r => r.status !== "취소").length;
  const inProgress = (dist["미배정"]||0)+(dist["배정"]||0)+(dist["확정"]||0)+(dist["진행중"]||0);
  const completed = (dist["완료"]||0)+(dist["visit_only"]||0);
  console.log("\n[fetchPrincipalStatusCounts 수정 후 시뮬]");
  console.log(`  fetch rows: ${stRows.length}건`);
  console.log(`  raw dist:`, dist);
  console.log(`  전체(취소 제외) ${total} | 진행중 ${inProgress} | 완료 ${completed}`);
  console.log(`  → 이전 "976"이었으면 → 이제 ${total} 표시 예상`);

  // 2) loadTasksForRole (전체 tenant)
  const lrRows = await pageLoop(sbAnon, c => c.from("tasks").select("id").eq("tenant_id", TENANT_ID).order("received_at", { ascending: false }));
  console.log("\n[loadTasksForRole 수정 후 시뮬]");
  console.log(`  fetch rows: ${lrRows.length}건 (DB truth ${trueAll} → ${lrRows.length === trueAll ? "✅ 일치" : "⚠️ 불일치"})`);

  // 3) countTasksByStatusDb (전체 tenant)
  const cntRows = await pageLoop(sbAnon, c => c.from("tasks").select("status").eq("tenant_id", TENANT_ID));
  const cntDist = {};
  for (const r of cntRows) cntDist[r.status] = (cntDist[r.status] || 0) + 1;
  console.log("\n[countTasksByStatusDb 수정 후 시뮬]");
  console.log(`  fetch rows: ${cntRows.length}건 (DB truth ${trueAll} → ${cntRows.length === trueAll ? "✅" : "⚠️"})`);
  console.log(`  dist:`, cntDist);

  // 4) AdminApp 1,283 출처 추정
  console.log("\n[AdminApp 1,283 출처 추정]");
  console.log(`  loadTasksForRole 응답 ${lrRows.length} → apiTasks가 그만큼.`);
  console.log(`  1,283 = ?`);
  console.log(`    · 단일 .limit(5000) 응답 = 1,000건 (cap)`);
  console.log(`    · DB truth = ${trueAll}건`);
  console.log(`    · 1,283 ≠ 위 둘 중 어느 것과도 정확히 일치하지 않음`);
  console.log(`    · 가능성: 사장님 화면 캡처가 다른 카운터(예: 활성+완료 등)일 수 있음`);
  console.log(`    · 단일 .limit(5000) 1000 cap 후 _v14NormalizeTask가 일부 null로 → .filter(Boolean) 제거 → 더 작아짐. 1283은 그보다 큼.`);
  console.log(`    · 또는 baseSource가 별도 합산(예: apiTasks + 다른 source)일 수 있음 — 코드 더 추적 필요.`);

  console.log("\n" + "=".repeat(100));
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

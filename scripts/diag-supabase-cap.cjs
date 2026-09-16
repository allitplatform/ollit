// Supabase fetch cap 검증 — .limit(5000) 적용 시 실제 몇 건 응답하는지 확인
// + countTasksByStatusDb / loadTasksForRole 시뮬레이션
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

// 클라이언트 2개: anon (앱이 사용) + service_role (실제 카운트)
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

(async () => {
  console.log("=".repeat(100));
  console.log("Supabase fetch cap 검증");
  console.log("=".repeat(100));

  // 1. service_role — exact 카운트
  const { count: trueCount } = await sbSvc.from("tasks").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT_ID);
  console.log(`\n[service_role exact 카운트] ${trueCount}건`);

  // 2. anon — limit 옵션별로 실제 응답 개수
  const tests = [
    { label: "limit 없음 (PostgREST default)", fn: () => sbAnon.from("tasks").select("id").eq("tenant_id", TENANT_ID) },
    { label: ".limit(1000)",  fn: () => sbAnon.from("tasks").select("id").eq("tenant_id", TENANT_ID).limit(1000) },
    { label: ".limit(2000)",  fn: () => sbAnon.from("tasks").select("id").eq("tenant_id", TENANT_ID).limit(2000) },
    { label: ".limit(5000)",  fn: () => sbAnon.from("tasks").select("id").eq("tenant_id", TENANT_ID).limit(5000) },
    { label: ".limit(10000)", fn: () => sbAnon.from("tasks").select("id").eq("tenant_id", TENANT_ID).limit(10000) },
  ];
  console.log("\n[anon client — .limit 옵션별 응답 개수]");
  for (const t of tests) {
    const { data, error } = await t.fn();
    if (error) {
      console.log(`  ${t.label.padEnd(40)} ERROR: ${error.message}`);
    } else {
      console.log(`  ${t.label.padEnd(40)} ${data.length}건`);
    }
  }

  // 3. range 페이지 루프로 anon에서 전체 fetch 시도
  console.log("\n[anon client — .range page loop (1000씩)]");
  let allRows = [], offset = 0;
  while (true) {
    const { data, error } = await sbAnon.from("tasks").select("id").eq("tenant_id", TENANT_ID).range(offset, offset + 999);
    if (error) { console.log(`  ERROR @ offset=${offset}: ${error.message}`); break; }
    allRows = allRows.concat(data || []);
    if (!data || data.length < 1000) break;
    offset += 1000;
  }
  console.log(`  page loop 총 ${allRows.length}건 (DB true=${trueCount} → ${allRows.length === trueCount ? "✅ 일치" : "⚠️ 불일치"})`);

  // 4. service_role도 동일 테스트 (cap 차이 비교)
  console.log("\n[service_role — .limit 옵션별 응답 개수]");
  for (const t of tests) {
    const f = t.fn.toString();
    // sbAnon → sbSvc
    const { data, error } = await ({
      "limit 없음 (PostgREST default)": () => sbSvc.from("tasks").select("id").eq("tenant_id", TENANT_ID),
      ".limit(1000)":  () => sbSvc.from("tasks").select("id").eq("tenant_id", TENANT_ID).limit(1000),
      ".limit(2000)":  () => sbSvc.from("tasks").select("id").eq("tenant_id", TENANT_ID).limit(2000),
      ".limit(5000)":  () => sbSvc.from("tasks").select("id").eq("tenant_id", TENANT_ID).limit(5000),
      ".limit(10000)": () => sbSvc.from("tasks").select("id").eq("tenant_id", TENANT_ID).limit(10000),
    })[t.label]();
    if (error) console.log(`  ${t.label.padEnd(40)} ERROR: ${error.message}`);
    else console.log(`  ${t.label.padEnd(40)} ${data.length}건`);
  }

  // 5. fetchPrincipalStatusCounts 시뮬레이션 (usol_n + usol_h)
  console.log("\n[fetchPrincipalStatusCounts 시뮬 — usol_n+usol_h]");
  const { data: principals } = await sbAnon.from("principals").select("id, code").in("code", ["usol_n", "usol_h"]);
  const pids = principals.map(p => p.id);
  const { data: stRows } = await sbAnon.from("tasks").select("status").eq("tenant_id", TENANT_ID).in("principal_id", pids);
  const dist = {};
  for (const r of (stRows || [])) dist[r.status] = (dist[r.status] || 0) + 1;
  const total = (stRows || []).filter(r => r.status !== "취소").length;
  console.log(`  현재 spec → rows ${stRows?.length} 건 / 취소 제외 total = ${total}`);
  console.log(`  raw dist:`, dist);

  // 6. loadTasksForRole 시뮬레이션 (.limit(5000) — 전체 tenant)
  console.log("\n[loadTasksForRole 시뮬 — .limit(5000) 전체 tenant]");
  const { data: lrRows } = await sbAnon.from("tasks").select("id").eq("tenant_id", TENANT_ID).limit(5000);
  console.log(`  응답: ${lrRows?.length}건 (DB true=${trueCount} → ${lrRows?.length === trueCount ? "✅" : "⚠️ cap"})`);

  console.log("\n" + "=".repeat(100));
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

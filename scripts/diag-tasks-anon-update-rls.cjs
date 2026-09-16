// tasks 측 anon UPDATE RLS 진단.
//   1) service-role 측 pg_policies 조회 (실제 DB 측 모든 정책)
//   2) anon 키로 실제 UPDATE 시도 (안현생 phone 같은 값 그대로 — no-op) → 차단 여부
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname,"..",".env"));
L(path.join(__dirname,"..",".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const sbAnon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // (1) pg_policies for tasks
  console.log("=== [1] tasks 측 모든 RLS 정책 ===");
  const { data: pols, error: pErr } = await sb.rpc("exec_sql_simple", {
    sql: "SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename = 'tasks' ORDER BY cmd, policyname;"
  }).then(r => ({ data: r.data, error: r.error }))
    .catch(_ => ({ data: null, error: "exec_sql_simple RPC 없음" }));
  if (pErr || !pols) {
    // fallback — psql 같은 raw 쿼리 RPC 없으면 직접 information_schema 측 못 가져옴. 우회.
    console.log("  pg_policies 직접 조회 불가 (RPC 없음). DB 측 직접 \\d+ tasks 또는 SQL Editor 확인 필요.");
  } else {
    pols.forEach(p => {
      console.log(`  ${p.policyname} | cmd=${p.cmd} | roles=${JSON.stringify(p.roles)}`);
      if (p.qual)       console.log(`    USING: ${p.qual}`);
      if (p.with_check) console.log(`    WITH CHECK: ${p.with_check}`);
    });
  }

  // (2) anon UPDATE 실제 시도 — 안현생 phone 같은 값으로 (no-op)
  console.log("\n=== [2] anon 키로 tasks UPDATE 시도 (안현생, no-op) ===");
  const { data: anhyun } = await sb.from("tasks")
    .select("id, task_no, customer_name, phone")
    .eq("task_no", "CK-260604-001")
    .maybeSingle();
  if (!anhyun) { console.log("  안현생 task 없음"); return; }
  console.log(`  대상: ${anhyun.task_no} / ${anhyun.customer_name} / 현 phone=${anhyun.phone}`);

  const { data: upd, error: upErr, count } = await sbAnon
    .from("tasks")
    .update({ phone: anhyun.phone })   // 같은 값 — 실 변경 없음
    .eq("id", anhyun.id)
    .select("id");
  if (upErr) {
    console.log("  ❌ anon UPDATE 차단:", upErr.message, "code:", upErr.code);
  } else if (!upd || upd.length === 0) {
    console.log("  ⚠️ anon UPDATE 결과 빈 응답 — RLS 측 SELECT 거부 (UPDATE 자체는 통과? 또는 silent fail)");
  } else {
    console.log("  ✅ anon UPDATE 성공:", upd);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

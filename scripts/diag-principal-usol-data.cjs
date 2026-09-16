// 진단 — PrincipalApp(유솔앱) 측 ③ payments 쿼리 + ④ users JOIN 권한
// 2026-05-26 (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sbAnon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const sbSvc  = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // ④ users JOIN — anon vs service_role 비교
  console.log("═".repeat(80) + "\n[④ users JOIN 권한 — anon 키로 SELECT 가능한지]\n" + "═".repeat(80));
  const { data: uA, error: eA } = await sbAnon.from("users").select("id, code, name").limit(3);
  console.log(`  anon: ${eA ? `❌ ERR: ${eA.message}` : `✅ ${(uA || []).length}건`}`);
  (uA || []).forEach(u => console.log(`    · ${u.code} ${u.name}`));
  const { data: uS } = await sbSvc.from("users").select("id, code, name").limit(3);
  console.log(`  service_role: ${(uS || []).length}건 (참고)`);

  // anon → principals 측 검증
  console.log("\n" + "═".repeat(80) + "\n[② anon — principals (usol_n) SELECT 가능한지]\n" + "═".repeat(80));
  const { data: pA, error: pAE } = await sbAnon.from("principals").select("id, code, name, bank_name, account_number").eq("code", "usol_n");
  console.log(`  anon: ${pAE ? `❌ ERR: ${pAE.message}` : `✅ ${(pA || []).length}건`}`);
  (pA || []).forEach(p => console.log(`    · ${p.code} ${p.name} | ${p.bank_name} ${p.account_number}`));

  // anon → tasks 측 (usol_n)
  console.log("\n" + "═".repeat(80) + "\n[② anon — tasks WHERE principal_id=usol_n SELECT 가능한지]\n" + "═".repeat(80));
  const { data: pUn } = await sbSvc.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  const pid = pUn?.id;
  const { data: tA, error: tAE } = await sbAnon.from("tasks")
    .select("id, task_no, customer_name, principal_id").eq("principal_id", pid).limit(3);
  console.log(`  anon: ${tAE ? `❌ ERR: ${tAE.message}` : `✅ ${(tA || []).length}건`}`);
  (tA || []).forEach(t => console.log(`    · ${t.task_no} | ${t.customer_name}`));

  // ③ usol_n + 세척 + extra_fee>0 — payments + users JOIN 한 쿼리 시도
  console.log("\n" + "═".repeat(80) + "\n[③ 한 쿼리 — usol_n 세척+extra_fee>0 + payments + users JOIN (anon)]\n" + "═".repeat(80));
  const { data: rows, error: rE } = await sbAnon.from("tasks")
    .select(`
      id, task_no, customer_name, extra_fee, completed_at, assigned_engineer_id,
      payments(usol_remitted_at, principal_amount, track),
      task_items(work_types(service_types(code)))
    `)
    .eq("principal_id", pid)
    .gt("extra_fee", 0)
    .eq("status", "완료")
    .order("completed_at", { ascending: false })
    .limit(5);
  if (rE) {
    console.log(`  ❌ ERR: ${rE.message}`);
  } else {
    console.log(`  ✅ ${(rows || []).length}건`);
    (rows || []).slice(0, 5).forEach(t => {
      const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
      const items = Array.isArray(t.task_items) ? t.task_items : [];
      const hasClean = items.some(it => it?.work_types?.service_types?.code === "cleaning");
      console.log(`    · ${t.task_no} | ${t.customer_name} | extra=${t.extra_fee} | 15%=${Math.floor(t.extra_fee*0.15)} | usol_remitted_at=${p?.usol_remitted_at ?? "(NULL)"} | engineer_id=${(t.assigned_engineer_id || "").slice(0,8)} | cleaning=${hasClean}`);
    });
  }

  // ④ tasks + users 인-쿼리 nested embed (loadTasksForRole 패턴 측 in-memory join 측 측 X)
  console.log("\n" + "═".repeat(80) + "\n[④ nested embed — tasks!inner(...users) (anon)]\n" + "═".repeat(80));
  const { data: ne, error: neE } = await sbAnon.from("tasks")
    .select(`id, task_no, customer_name, assignee:users!tasks_assigned_engineer_id_fkey(id, name, code)`)
    .eq("principal_id", pid)
    .not("assigned_engineer_id", "is", null)
    .limit(3);
  if (neE) console.log(`  ❌ ERR: ${neE.message}`);
  else {
    console.log(`  ✅ ${(ne || []).length}건`);
    (ne || []).forEach(t => console.log(`    · ${t.task_no} | ${t.customer_name} | assignee=${t.assignee?.code} ${t.assignee?.name}`));
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

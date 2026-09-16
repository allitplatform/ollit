// 진단 — 유솔 입금 카드 빌드 전 사전 조사 (③ 계좌 + ④ 15% 분류)
// 2026-05-25 (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  console.log("═".repeat(80) + "\n[③ principals 측 계좌 컬럼 — usol_n / usol_h 측 등록 여부]\n" + "═".repeat(80));
  const { data: princs } = await sb.from("principals")
    .select("code, name, bank_name, account_number, account_holder")
    .in("code", ["usol_n", "usol_h", "allday"]).order("code");
  (princs || []).forEach(p => {
    console.log(`  · ${p.code.padEnd(8)} (${p.name})`);
    console.log(`    bank_name      = ${p.bank_name      || "(NULL)"}`);
    console.log(`    account_number = ${p.account_number || "(NULL)"}`);
    console.log(`    account_holder = ${p.account_holder || "(NULL)"}`);
  });

  console.log("\n" + "═".repeat(80) + "\n[④ usol_n 세척 + 현장추가금>0 task — principal_amount 분포 (트랙 B)]\n" + "═".repeat(80));
  const { data: pUn } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  if (!pUn) { console.log("usol_n 없음"); return; }

  const { data: tasks } = await sb.from("tasks")
    .select(`id, task_no, customer_name, status, extra_fee, completed_at,
             payments(engineer_amount, principal_amount, owner_amount, calc_method, track),
             task_items(work_types(service_types(code)))`)
    .eq("principal_id", pUn.id)
    .gt("extra_fee", 0)
    .eq("status", "완료")
    .order("completed_at", { ascending: false })
    .limit(10);

  console.log(`  최근 usol_n + 완료 + extra_fee>0 : ${(tasks || []).length}건`);
  let totalPrin = 0, totalExtra = 0, cleaningCnt = 0;
  (tasks || []).forEach(t => {
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    const items = Array.isArray(t.task_items) ? t.task_items : [];
    const services = items.map(it => it?.work_types?.service_types?.code).filter(Boolean);
    const hasClean = services.includes("cleaning");
    if (hasClean) cleaningCnt++;
    totalPrin += Number(p?.principal_amount || 0);
    totalExtra += Number(t.extra_fee || 0);
    console.log(`  · ${t.task_no} | ${t.customer_name} | extra=${t.extra_fee} | prin=${p?.principal_amount} (${hasClean ? "cleaning" : services.join(",")}) | track=${p?.track} | method=${p?.calc_method}`);
  });
  console.log(`\n  합계: SUM(extra_fee)=${totalExtra} / SUM(principal_amount)=${totalPrin} / cleaning task=${cleaningCnt}건`);
  console.log(`  예상 15%: ${Math.floor(totalExtra * 0.15)} vs 실제 principal_amount 합 ${totalPrin}`);

  console.log("\n" + "═".repeat(80) + "\n[④ 트랙 'B' 측 task — 유솔 송금 대상 식별 패턴]\n" + "═".repeat(80));
  const { count: trackBCnt } = await sb.from("payments")
    .select("task_id", { count: "exact", head: true })
    .eq("track", "B")
    .gt("principal_amount", 0);
  console.log(`  payments track='B' + principal_amount>0 : ${trackBCnt ?? "?"}건`);

  // 트랙 B + 미입금(engineer_remitted_at NULL) — 유솔 입금 대상 카운트
  const { count: pendingCnt } = await sb.from("payments")
    .select("task_id", { count: "exact", head: true })
    .eq("track", "B")
    .gt("principal_amount", 0)
    .is("engineer_remitted_at", null);
  console.log(`  ↑ + engineer_remitted_at NULL (미보고)     : ${pendingCnt ?? "?"}건`);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

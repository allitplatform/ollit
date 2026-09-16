// 정합성 점검 — DB 카운트 (읽기 전용)
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

async function fetchAll(query) {
  let out = [], from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + 999);
    if (error) throw error;
    out = out.concat(data || []);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return out;
}

(async () => {
  console.log("=".repeat(110));
  console.log("DB 카운트 — 정합성 점검 (읽기 전용)");
  console.log("=".repeat(110));

  // 1. principals
  const { data: principals } = await sb.from("principals").select("id, code, name").order("code");

  // 2. principal별 task 총수
  console.log("\n[1] principal별 task 총수");
  console.log("─".repeat(60));
  const pCounts = {};
  for (const p of principals) {
    const { count } = await sb.from("tasks").select("id", { count: "exact", head: true }).eq("principal_id", p.id);
    pCounts[p.code] = count;
    console.log(`  ${p.code.padEnd(10)} ${p.name?.padEnd(20) || ""} ${String(count).padStart(6)}건`);
  }
  const totalAll = Object.values(pCounts).reduce((a, b) => a + b, 0);
  console.log(`  ${"".padEnd(31)} ${"-".repeat(7)}`);
  console.log(`  ${"합계".padEnd(31)} ${String(totalAll).padStart(6)}건`);

  // 3. usol_n + usol_h: status별 카운트
  const usolN = principals.find(p => p.code === "usol_n");
  const usolH = principals.find(p => p.code === "usol_h");

  console.log("\n[2] usol_n status별 카운트");
  console.log("─".repeat(60));
  const usolNTasks = await fetchAll(sb.from("tasks").select("id, status, is_legacy").eq("principal_id", usolN.id));
  const nStatus = {}, nLegacyT = 0, nLegacyF = 0;
  let nLeg = { t: 0, f: 0 };
  for (const t of usolNTasks) {
    nStatus[t.status] = (nStatus[t.status] || 0) + 1;
    if (t.is_legacy === true) nLeg.t++; else nLeg.f++;
  }
  for (const [k, v] of Object.entries(nStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${String(v).padStart(6)}건`);
  }
  console.log(`  ${"-".repeat(6)}`);
  console.log(`  ${"총".padEnd(12)} ${String(usolNTasks.length).padStart(6)}건`);

  console.log("\n[3] usol_h status별 카운트");
  console.log("─".repeat(60));
  const usolHTasks = await fetchAll(sb.from("tasks").select("id, status, is_legacy").eq("principal_id", usolH.id));
  const hStatus = {};
  let hLeg = { t: 0, f: 0 };
  for (const t of usolHTasks) {
    hStatus[t.status] = (hStatus[t.status] || 0) + 1;
    if (t.is_legacy === true) hLeg.t++; else hLeg.f++;
  }
  for (const [k, v] of Object.entries(hStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${String(v).padStart(6)}건`);
  }
  console.log(`  ${"-".repeat(6)}`);
  console.log(`  ${"총".padEnd(12)} ${String(usolHTasks.length).padStart(6)}건`);

  // 4. usol 전체(N+H) payments 유무
  console.log("\n[4] usol 전체(N+H) payments 유무");
  console.log("─".repeat(60));
  const usolIds = [...usolNTasks, ...usolHTasks].map(t => t.id);
  let payTaskIds = new Set();
  for (let i = 0; i < usolIds.length; i += 500) {
    const slice = usolIds.slice(i, i + 500);
    const { data } = await sb.from("payments").select("task_id").in("task_id", slice);
    for (const p of (data || [])) payTaskIds.add(p.task_id);
  }
  const withPay = usolIds.filter(id => payTaskIds.has(id)).length;
  const withoutPay = usolIds.length - withPay;
  console.log(`  payments 있음  ${String(withPay).padStart(6)}건`);
  console.log(`  payments 없음  ${String(withoutPay).padStart(6)}건`);
  console.log(`  ${"-".repeat(6)}`);
  console.log(`  총           ${String(usolIds.length).padStart(6)}건`);

  // 5. is_legacy 분리
  console.log("\n[5] is_legacy 분리");
  console.log("─".repeat(60));
  console.log(`  usol_n  legacy=true  ${String(nLeg.t).padStart(6)} | legacy=false ${String(nLeg.f).padStart(6)}`);
  console.log(`  usol_h  legacy=true  ${String(hLeg.t).padStart(6)} | legacy=false ${String(hLeg.f).padStart(6)}`);

  // 6. usol 전체 status × legacy 교차
  console.log("\n[6] usol 전체(N+H) status × is_legacy 교차");
  console.log("─".repeat(60));
  const cross = {};
  for (const t of [...usolNTasks, ...usolHTasks]) {
    const k = t.status;
    if (!cross[k]) cross[k] = { t: 0, f: 0 };
    if (t.is_legacy === true) cross[k].t++; else cross[k].f++;
  }
  console.log(`  ${"status".padEnd(12)} ${"legacy=T".padStart(10)} ${"legacy=F".padStart(10)} ${"합".padStart(8)}`);
  let cT = 0, cF = 0;
  for (const [k, v] of Object.entries(cross).sort((a, b) => (b[1].t + b[1].f) - (a[1].t + a[1].f))) {
    console.log(`  ${k.padEnd(12)} ${String(v.t).padStart(10)} ${String(v.f).padStart(10)} ${String(v.t + v.f).padStart(8)}`);
    cT += v.t; cF += v.f;
  }
  console.log(`  ${"─".repeat(48)}`);
  console.log(`  ${"합".padEnd(12)} ${String(cT).padStart(10)} ${String(cF).padStart(10)} ${String(cT + cF).padStart(8)}`);

  // 7. payments 상태 분포 (status별 + paid_at 유무)
  console.log("\n[7] usol 전체 payments 상태 분포 (paid_at, status)");
  console.log("─".repeat(60));
  let payStatusCount = {};
  let payPaid = 0, payUnpaid = 0;
  let allPays = [];
  for (let i = 0; i < usolIds.length; i += 500) {
    const slice = usolIds.slice(i, i + 500);
    const { data } = await sb.from("payments").select("task_id, status, paid_at").in("task_id", slice);
    if (data) allPays = allPays.concat(data);
  }
  for (const p of allPays) {
    const st = p.status || "(null)";
    payStatusCount[st] = (payStatusCount[st] || 0) + 1;
    if (p.paid_at) payPaid++; else payUnpaid++;
  }
  console.log(`  payment status:`);
  for (const [k, v] of Object.entries(payStatusCount).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(12)} ${String(v).padStart(6)}`);
  }
  console.log(`  paid_at 있음 ${String(payPaid).padStart(6)} / 없음 ${String(payUnpaid).padStart(6)}`);

  console.log("\n" + "=".repeat(110));
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

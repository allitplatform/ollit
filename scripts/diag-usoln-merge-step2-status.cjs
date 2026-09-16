// usol_n 통합 2단계 — timeout 중단 후 현재 상태 진단 (읽기 전용)
const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const { data: p } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  const PID = p.id;
  // 전체 task 페이지
  let all = [];
  for (let off = 0; ; off += 1000) {
    const { data } = await sb.from("tasks").select("id, task_no, external_order_no").eq("principal_id", PID).range(off, off + 999);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
  }
  const byExt = new Map();
  for (const t of all) {
    if (!t.external_order_no) continue;
    if (!byExt.has(t.external_order_no)) byExt.set(t.external_order_no, []);
    byExt.get(t.external_order_no).push(t);
  }
  const splitNow = [...byExt.entries()].filter(([, v]) => v.length >= 2);
  console.log(`현재 usol_n total task: ${all.length}`);
  console.log(`현재 분리 주문 (2+ task) 잔존: ${splitNow.length}`);

  // timeout 발생 ext 상태
  const FAIL_EXT = "2026051324510331";
  const failTasks = byExt.get(FAIL_EXT) || [];
  console.log(`\n[timeout 발생 ext=${FAIL_EXT}] 현재 task ${failTasks.length}건:`);
  failTasks.forEach(t => console.log(`  · ${t.task_no} (id=${t.id.slice(0,8)})`));

  // failed 이후 잔여 (dryrun 입력 기준 212 + 1)
  const dry = JSON.parse(require("fs").readFileSync(path.join(__dirname, "diag-usoln-merge-dryrun-결과.json"), "utf8"));
  const allExts = dry.plans.map(p => p.external_order_no).filter(x => x !== "2026051147012351");
  const stillNeeds = allExts.filter(ext => (byExt.get(ext) || []).length >= 2);
  console.log(`\ndryrun 대상 334 중 아직 분리 상태인 주문: ${stillNeeds.length}`);
})().catch(e => { console.error(e); process.exit(1); });

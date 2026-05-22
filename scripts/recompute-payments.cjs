// payments 측 측 — task_items.unit_price 정정 측 측 compute_payment 측 호출
const fs = require("fs"), path = require("path");
const Papa = require("papaparse");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const TENANT_ID = "11111111-1111-1111-1111-111111111111";
function toInt(v) { const n = parseFloat(String(v || "").replace(/[,\s]/g, "")); return isNaN(n) ? 0 : Math.round(n); }
function cleanStr(v) { return v == null ? "" : String(v).trim(); }

(async () => {
  // CSV 측 task_no + 시트 측
  const csvRaw = fs.readFileSync(path.join(__dirname, "..", "신규_43주문_INSERT용.csv"), "utf8");
  const csvText = csvRaw.charCodeAt(0) === 0xFEFF ? csvRaw.slice(1) : csvRaw;
  const rows = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() }).data;
  const groups = new Map();
  for (const r of rows) {
    const o = cleanStr(r["주문번호"]); if (!o) continue;
    if (!groups.has(o)) groups.set(o, []); groups.get(o).push(r);
  }
  const sheetByTaskNo = new Map();
  for (const [, grp] of groups) sheetByTaskNo.set(cleanStr(grp[0]["작업코드"]), grp);

  const allTaskNos = Array.from(sheetByTaskNo.keys());
  const { data: tasks } = await sb.from("tasks").select("id, task_no, status").in("task_no", allTaskNos);
  const completedTasks = (tasks || []).filter(t => t.status === "완료");
  console.log(`완료 status task: ${completedTasks.length}건\n`);

  // 측 task 측 — payments DELETE + compute_payment 측 호출
  for (const t of completedTasks) {
    // payments DELETE (task_id 측 측 row 측)
    const { error: delErr } = await sb.from("payments").delete().eq("task_id", t.id);
    if (delErr) { console.log(`  ${t.task_no}: DELETE ${delErr.message}`); continue; }
    // compute_payment 측 측 호출
    const { data: pid, error: rpcErr } = await sb.rpc("compute_payment", { p_task_id: t.id });
    if (rpcErr) console.log(`  ${t.task_no}: ❌ ${rpcErr.message}`);
    else        console.log(`  ${t.task_no}: ✅ payment_id=${pid}`);
  }

  // 시트 vs trigger 측 비교 (측 5건)
  console.log(`\n${"=".repeat(85)}\n시트 vs trigger 측 비교\n${"=".repeat(85)}\n`);
  // payments lookup 측 .in("task_id") 측 한 번 측
  const taskIds = completedTasks.map(t => t.id);
  const { data: pays } = await sb.from("payments").select("task_id, principal_amount, engineer_amount, owner_amount, calc_method").in("task_id", taskIds);
  const payByTask = new Map((pays || []).map(p => [p.task_id, p]));

  for (const t of completedTasks.slice(0, 5)) {
    const pay = payByTask.get(t.id);
    const grp = sheetByTaskNo.get(t.task_no);
    const sheetPrincipal = grp.reduce((s, r) => s + toInt(r["도급사정산액"]), 0);
    const sheetEngineer  = grp.reduce((s, r) => s + toInt(r["회사배분액"]), 0);
    const sheetTotal     = grp.reduce((s, r) => s + toInt(r["정산예정금액"]), 0);
    if (!pay) { console.log(`  ${t.task_no}: payments X`); continue; }
    console.log(`▣ ${t.task_no} | calc_method=${pay.calc_method}`);
    console.log(`   도급사:   trigger=${pay.principal_amount}\t시트=${sheetPrincipal}\t측=${pay.principal_amount - sheetPrincipal}`);
    console.log(`   회사배분: trigger=${pay.engineer_amount}\t시트=${sheetEngineer}\t측=${pay.engineer_amount - sheetEngineer}`);
    console.log(`   owner:    ${pay.owner_amount}\t(시트 측 측 X)`);
    console.log(`   측:      시트 정산예정금액=${sheetTotal}\n`);
  }
})();

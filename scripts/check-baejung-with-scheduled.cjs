// status='배정' AND scheduled_at IS NOT NULL 측 측 + 시트 X열 측 측
const fs = require("fs"), path = require("path");
const XLSX = require("xlsx");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PRINCIPAL_ID = "22222222-2222-2222-2222-222222222006";
const isCommit = process.argv.includes("--commit");

(async () => {
  // [1] DB lookup
  const { data: tasks, error } = await sb.from("tasks")
    .select("id, task_no, customer_name, scheduled_at, status")
    .eq("tenant_id", TENANT_ID).eq("principal_id", PRINCIPAL_ID)
    .eq("status", "배정")
    .not("scheduled_at", "is", null);
  if (error) { console.error(error); process.exit(1); }

  console.log(`\n${"=".repeat(85)}\nstatus='배정' AND scheduled_at IS NOT NULL: ${tasks?.length || 0}건\n${"=".repeat(85)}\n`);

  if (!tasks || tasks.length === 0) {
    console.log(`✅ 0건 — ② 완벽 (사장님 spec 측)\n`);
    return;
  }

  // [2] 시트 측 측 측 X열 측 catch
  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, "..", "유솔홈케어_운영.xlsx")), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const sheetByTaskNo = new Map();
  for (const r of rows) {
    const tno = String(r["작업코드"] || "").trim();
    if (!tno) continue;
    if (!sheetByTaskNo.has(tno)) sheetByTaskNo.set(tno, r);
  }

  console.log(`측 task 목록:\n`);
  const toNullify = [];
  const others = [];
  for (const t of tasks) {
    const sr = sheetByTaskNo.get(t.task_no);
    const sheetTime = sr ? String(sr["기사약속시간"] || "").trim() : "(시트 측 측 X)";
    console.log(`  ${t.task_no} | ${t.customer_name} | scheduled_at=${t.scheduled_at} | 시트 X열="${sheetTime}"`);
    if (sheetTime === "00:00") toNullify.push(t);
    else others.push({ ...t, sheetTime });
  }

  console.log(`\n${"=".repeat(85)}\n측 측\n${"=".repeat(85)}`);
  console.log(`  · 시트 X열 = "00:00" → NULL 측 측: ${toNullify.length}건`);
  console.log(`  · 시트 X열 != "00:00" (보존): ${others.length}건`);

  if (others.length > 0) {
    console.log(`\n  ⚠️ NULL 측 측 X (시트 측 시간 측 measurement, 측 측 측 measurement):`);
    for (const t of others.slice(0, 10)) {
      console.log(`    · ${t.task_no} | 시트 X열="${t.sheetTime}"`);
    }
  }

  if (isCommit && toNullify.length > 0) {
    console.log(`\n${"=".repeat(85)}\n✅ COMMIT — NULL 측 측 측\n${"=".repeat(85)}\n`);
    const ids = toNullify.map(t => t.id);
    const { error: uErr } = await sb.from("tasks").update({ scheduled_at: null }).in("id", ids);
    if (uErr) console.error(`❌ UPDATE:`, uErr);
    else console.log(`  ✅ ${ids.length}건 scheduled_at = NULL UPDATE 측`);
  } else if (toNullify.length > 0) {
    console.log(`\n🔍 DRY-RUN — UPDATE 측 측 X. --commit 측 측 측 실행.\n`);
  }
})();

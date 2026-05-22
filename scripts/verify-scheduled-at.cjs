// X열 "00:00" 13건 + 새벽 측 측 scheduled_at 측 catch + KST 측 측 측
const fs = require("fs"), path = require("path");
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const Papa = require("papaparse");
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function toKstYmd(value) {
  if (!value) return "";
  const d = (value instanceof Date) ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  // KST 측 측 측 (UTC+9 측 측 측 catch — 측 측 브라우저 측 measurement 측 측 측)
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}
function toKstHm(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}`;
}

(async () => {
  // CSV 측 — X열 "00:00" + 새벽 측 측 추출
  const csvRaw = fs.readFileSync(path.join(__dirname, "..", "신규_43주문_INSERT용.csv"), "utf8");
  const csvText = csvRaw.charCodeAt(0) === 0xFEFF ? csvRaw.slice(1) : csvRaw;
  const rows = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() }).data;

  // 그룹핑 + 측 그룹 측 첫 row 측 측
  const groups = new Map();
  for (const r of rows) {
    const orderNo = String(r["주문번호"] || "").trim();
    if (!orderNo) continue;
    if (!groups.has(orderNo)) groups.set(orderNo, []);
    groups.get(orderNo).push(r);
  }

  const zeroTaskNos = [];
  const dawnTaskNos = [];
  for (const [, grp] of groups) {
    const first = grp[0];
    const taskNo = String(first["작업코드"] || "").trim();
    const time = String(first["기사약속시간"] || "").trim();
    if (time === "00:00") {
      zeroTaskNos.push({ task_no: taskNo, sheet_time: time, sheet_date: String(first["고객컨택일자"] || "").trim() });
    } else if (time && time < "10:00") {
      dawnTaskNos.push({ task_no: taskNo, sheet_time: time, sheet_date: String(first["고객컨택일자"] || "").trim() });
    }
  }
  console.log(`\nCSV 측 X열 "00:00" task: ${zeroTaskNos.length}건`);
  console.log(`CSV 측 새벽 (10:00 측) task: ${dawnTaskNos.length}건\n`);

  // DB 측 measurement scheduled_at catch
  const allNos = [...zeroTaskNos.map(t => t.task_no), ...dawnTaskNos.map(t => t.task_no)];
  const { data: tasks } = await sb
    .from("tasks")
    .select("task_no, customer_name, status, scheduled_at, assigned_engineer_id")
    .eq("tenant_id", "11111111-1111-1111-1111-111111111111")
    .in("task_no", allNos);
  const dbByNo = new Map((tasks || []).map(t => [t.task_no, t]));

  // user name lookup
  const userIds = (tasks || []).map(t => t.assigned_engineer_id).filter(Boolean);
  const { data: users } = await sb.from("users").select("id, name").in("id", userIds);
  const userMap = new Map((users || []).map(u => [u.id, u.name]));

  console.log(`${"=".repeat(95)}`);
  console.log(`X열 "00:00" 13건 — 측 측 측 측 + status='배정' + KST 날짜 catch`);
  console.log(`${"=".repeat(95)}\n`);
  for (const z of zeroTaskNos) {
    const t = dbByNo.get(z.task_no);
    if (!t) { console.log(`  ${z.task_no}: DB 측 X`); continue; }
    const kstYmd = toKstYmd(t.scheduled_at);
    const kstHm  = toKstHm(t.scheduled_at);
    const engineer = userMap.get(t.assigned_engineer_id) || "(X)";
    console.log(`  ${z.task_no} | 시트=${z.sheet_date} ${z.sheet_time} | 고객=${t.customer_name} | status=${t.status} | 측=${engineer}`);
    console.log(`     scheduled_at (UTC ISO): ${t.scheduled_at}`);
    console.log(`     캘린더 측 (KST YMD):    ${kstYmd} ${kstHm}`);
  }

  console.log(`\n${"=".repeat(95)}`);
  console.log(`새벽 작업 (08:30 / 07:30 / 08:00 측) — KST 날짜 측 측 catch`);
  console.log(`${"=".repeat(95)}\n`);
  for (const d of dawnTaskNos) {
    const t = dbByNo.get(d.task_no);
    if (!t) { console.log(`  ${d.task_no}: DB 측 X`); continue; }
    const kstYmd = toKstYmd(t.scheduled_at);
    const kstHm  = toKstHm(t.scheduled_at);
    const engineer = userMap.get(t.assigned_engineer_id) || "(X)";
    console.log(`  ${d.task_no} | 시트=${d.sheet_date} ${d.sheet_time} | 고객=${t.customer_name} | status=${t.status} | 측=${engineer}`);
    console.log(`     scheduled_at (UTC ISO): ${t.scheduled_at}`);
    console.log(`     캘린더 측 (KST YMD):    ${kstYmd} ${kstHm}`);
  }
})();

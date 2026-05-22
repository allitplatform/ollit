// ④-2 commit — 8건 status='취소' UPDATE + 측 정산 비교
const fs = require("fs"), path = require("path");
const XLSX = require("xlsx");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PRINCIPAL_ID = "22222222-2222-2222-2222-222222222006";
function cleanStr(v) { return v == null ? "" : String(v).trim(); }
function toInt(v) { const n = parseFloat(String(v || "").replace(/[,\s]/g, "")); return isNaN(n) ? 0 : Math.round(n); }

const SUSPECT = ["YS-260513-005","YS-260516-021","YS-260516-115","YS-260517-058","YS-260518-075","YS-260515-009","YS-260515-069","YS-260517-027"];

(async () => {
  // [1] UPDATE
  console.log(`${"=".repeat(85)}\n[1] 8건 status='취소' UPDATE\n${"=".repeat(85)}\n`);

  const { data: before } = await sb.from("tasks").select("id, task_no, status").eq("tenant_id", TENANT_ID).in("task_no", SUSPECT);
  console.log(`  측 측:`);
  for (const t of before) console.log(`    · ${t.task_no} | status=${t.status}`);

  const ids = before.map(t => t.id);
  const { error } = await sb.from("tasks").update({ status: "취소" }).eq("tenant_id", TENANT_ID).in("id", ids);
  if (error) { console.error(`  ❌ UPDATE: ${error.message}`); process.exit(1); }

  const { data: after } = await sb.from("tasks").select("task_no, status").eq("tenant_id", TENANT_ID).in("task_no", SUSPECT);
  console.log(`\n  측 측:`);
  for (const t of after) console.log(`    · ${t.task_no} | status=${t.status === "취소" ? "취소 ✅" : t.status + " ❌"}`);

  // [2] usol_n 측 정산 합계 vs 시트 측 비교
  console.log(`\n${"=".repeat(85)}\n[2] usol_n 측 정산 합계 — DB (취소 측 측) vs 시트\n${"=".repeat(85)}\n`);

  // DB: 모든 usol_n task 중 status='취소' 측 측
  const { data: dbTasks } = await sb.from("tasks").select("id, status").eq("tenant_id", TENANT_ID).eq("principal_id", PRINCIPAL_ID).neq("status", "취소");
  const ndTaskIds = dbTasks.map(t => t.id);
  console.log(`  DB usol_n task (취소 측): ${ndTaskIds.length}건`);

  // chunk lookup payments
  const allPays = [];
  for (let i = 0; i < ndTaskIds.length; i += 200) {
    const chunk = ndTaskIds.slice(i, i + 200);
    const { data } = await sb.from("payments").select("task_id, principal_amount, engineer_amount, owner_amount").in("task_id", chunk);
    if (data) allPays.push(...data);
  }
  const dbP = allPays.reduce((s, p) => s + (p.principal_amount || 0), 0);
  const dbE = allPays.reduce((s, p) => s + (p.engineer_amount || 0), 0);
  const dbO = allPays.reduce((s, p) => s + (p.owner_amount || 0), 0);
  console.log(`  DB 측 합 (취소 측): payments ${allPays.length}건 | P=${dbP} | E=${dbE} | O=${dbO} | E+O=${dbE + dbO}`);

  // 시트 측 측
  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, "..", "유솔홈케어_운영.xlsx")), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  // 시트 측 측 — status='작업완료' measurement 측 (DB 측 status='완료' 측)
  const sP = rows.reduce((s, r) => s + toInt(r["도급사정산액"]), 0);
  const sE = rows.reduce((s, r) => s + toInt(r["회사배분액"]), 0);
  console.log(`  시트 측 합: ${rows.length}행 | P=${sP} | E=${sE}`);

  console.log(`\n  측: P측=${dbP - sP} | E+O측=${(dbE + dbO) - sE}`);
})();

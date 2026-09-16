// 진단 — 안솔미 task 측 catch 측 catch 측 catch timestamptz 측 catch "" 측 catch (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TASK_ID = "e5bc62e0-32cf-4028-800f-55cd166488ef";

(async () => {
  const { data: task } = await sb.from("tasks").select("*").eq("id", TASK_ID).maybeSingle();
  if (!task) { console.log("X"); return; }

  console.log("[안솔미 task 현재 상태]");
  console.log("  task_no       :", task.task_no);
  console.log("  customer_name :", task.customer_name);
  console.log("  status        :", task.status);
  console.log("  assigned_engineer_id:", task.assigned_engineer_id);
  console.log("\n[timestamptz 컬럼]");
  const tsCols = ["scheduled_at", "started_at", "completed_at", "received_at", "created_at", "updated_at", "external_received_at"];
  for (const c of tsCols) {
    const v = task[c];
    console.log(`  ${c.padEnd(22)}: ${v === null ? "(NULL)" : v === "" ? '★EMPTY""' : v}`);
  }
  // assigned_at 컬럼 측 catch — schema 측 catch 측 catch 측 catch 측 catch 측 catch
  if ("assigned_at" in task) {
    console.log(`  assigned_at${" ".repeat(13)}: ${task.assigned_at === null ? "(NULL)" : task.assigned_at === "" ? '★EMPTY""' : task.assigned_at}`);
  }

  console.log("\n[date/time 컬럼]");
  const dtCols = ["requested_date", "requested_time"];
  for (const c of dtCols) {
    const v = task[c];
    console.log(`  ${c.padEnd(22)}: ${v === null ? "(NULL)" : v === "" ? '★EMPTY""' : v}`);
  }

  console.log("\n[category_data]");
  console.log(JSON.stringify(task.category_data, null, 2));

  console.log("\n[측 catch 컬럼 모두 (NULL/empty 측 catch)]");
  for (const [k, v] of Object.entries(task)) {
    if (v === "" || (typeof v === "string" && v.trim() === "")) {
      console.log(`  ★ "${k}" 측 EMPTY STRING (timestamptz 측 catch 측 catch invalid)`);
    }
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

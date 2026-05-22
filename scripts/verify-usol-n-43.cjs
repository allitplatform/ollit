#!/usr/bin/env node
// post-commit 검증 — 2026-05-23
//   1) SKIP 측 task_no 측 측 측 측 측
//   2) status='완료' INSERT 측 task 측 측 payments 측 측 측 측
//   3) trigger 측 측 측 vs 시트 측 비교

const fs   = require("fs");
const path = require("path");
const Papa = require("papaparse");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const txt = fs.readFileSync(file, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

async function main() {
  // CSV 측 측 시트 값 측
  const csvRaw = fs.readFileSync(path.join(__dirname, "..", "신규_43주문_INSERT용.csv"), "utf8");
  const csvText = csvRaw.charCodeAt(0) === 0xFEFF ? csvRaw.slice(1) : csvRaw;
  const rows = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() }).data;

  // 측 그룹 측 task_no + 측 시트 측
  const sheetByTaskNo = new Map();
  const groups = new Map();
  for (const r of rows) {
    const orderNo = String(r["주문번호"] || "").trim();
    if (!orderNo) continue;
    if (!groups.has(orderNo)) groups.set(orderNo, []);
    groups.get(orderNo).push(r);
  }
  for (const [, grp] of groups) {
    const taskNo = String(grp[0]["작업코드"] || "").trim();
    const toInt = (v) => { const n = parseFloat(String(v || "").replace(/[,\s]/g, "")); return isNaN(n) ? 0 : Math.round(n); };
    sheetByTaskNo.set(taskNo, {
      principal_sheet: grp.reduce((s, r) => s + toInt(r["도급사정산액"]), 0),
      engineer_sheet:  grp.reduce((s, r) => s + toInt(r["회사배분액"]), 0),
      total_sheet:     grp.reduce((s, r) => s + toInt(r["정산예정금액"]), 0),
      status_sheet:    String(grp[0]["상태"] || "").trim(),
    });
  }

  // status='완료' 측 task 측 측 — 측 시트 측 측 측
  const completedTaskNos = Array.from(sheetByTaskNo.entries())
    .filter(([, v]) => v.status_sheet === "작업완료")
    .map(([k]) => k);

  console.log(`\n측 시트 측 status='작업완료' 측 task: ${completedTaskNos.length}건\n`);

  // DB 측 측 task 측 measurement task_no 측 catch
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, task_no, customer_name, status, completed_at")
    .eq("tenant_id", TENANT_ID)
    .in("task_no", completedTaskNos);

  console.log(`DB 측 측 측 task: ${tasks?.length || 0}건\n`);
  console.log(`${"=".repeat(80)}`);
  console.log(`payments 측 측 측 + 시트 값 비교 (측 5건)`);
  console.log(`${"=".repeat(80)}\n`);

  // 측 task 측 payments 측
  const samples = (tasks || []).slice(0, 5);
  for (const t of samples) {
    const { data: pay } = await supabase
      .from("payments")
      .select("principal_amount, engineer_amount, total_amount, calc_method, owner_amount, is_balanced")
      .eq("task_id", t.id)
      .maybeSingle();

    const sheet = sheetByTaskNo.get(t.task_no);
    console.log(`▣ ${t.task_no} | 고객=${t.customer_name} | status=${t.status} | completed_at=${t.completed_at || "X"}`);
    if (!pay) {
      console.log(`  ⚠️ payments 측 측 측 측 X — trigger 측 X 측 측 측 측\n`);
    } else {
      console.log(`  · calc_method: ${pay.calc_method} | balanced: ${pay.is_balanced}`);
      console.log(`  · principal_amount: trigger=${pay.principal_amount}  | 시트=${sheet.principal_sheet}  | 측=${pay.principal_amount - sheet.principal_sheet}`);
      console.log(`  · engineer_amount:  trigger=${pay.engineer_amount}   | 시트=${sheet.engineer_sheet}   | 측=${pay.engineer_amount - sheet.engineer_sheet}`);
      console.log(`  · owner_amount:     ${pay.owner_amount}`);
      console.log(`  · total_amount:     trigger=${pay.total_amount}  | 시트=${sheet.total_sheet}  | 측=${pay.total_amount - sheet.total_sheet}\n`);
    }
  }

  // SKIP 측 task_no 측 측
  console.log(`${"=".repeat(80)}`);
  console.log(`SKIP 측 task (이미 DB 측 measurement)`);
  console.log(`${"=".repeat(80)}\n`);

  const allCsvTaskNos = Array.from(sheetByTaskNo.keys());
  const { data: allInDb } = await supabase
    .from("tasks")
    .select("task_no, customer_name, status, created_at")
    .eq("tenant_id", TENANT_ID)
    .in("task_no", allCsvTaskNos);

  // 이번 commit 측 측 측 task 측 created_at 측 측 measurement — 사장님 commit 측 측 5분 측 측 측 measurement
  // 측 measurement INSERT 측 측 측 측 측 → 측 측 measurement
  const dbTaskMap = new Map((allInDb || []).map(t => [t.task_no, t]));

  // CSV 측 measurement DB 측 measurement → 측 INSERT 측 measurement
  // 측 측 측 — created_at 측 측 시간 측 측 5분 측 측 measurement
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const oldTasks = (allInDb || []).filter(t => t.created_at < fiveMinAgo);
  console.log(`측 INSERT 측 (이미 measurement) task: ${oldTasks.length}건`);
  oldTasks.forEach(t => {
    console.log(`  · ${t.task_no} | 고객=${t.customer_name} | 상태=${t.status} | created=${t.created_at}`);
  });
}

main().catch(e => { console.error(e); process.exit(1); });

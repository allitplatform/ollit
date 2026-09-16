// 유솔 status + 부분취소 진단 — 수정 X
const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const USOL_H = "22222222-2222-2222-2222-222222222005";
const USOL_N = "22222222-2222-2222-2222-222222222006";

(async () => {
  // [1] tasks.status distinct (usol_h + usol_n)
  console.log(`${"=".repeat(85)}\n[1] tasks.status — 유솔 측 측 측\n${"=".repeat(85)}\n`);
  const { data: tasks } = await sb.from("tasks").select("id, status").eq("tenant_id", TENANT_ID).in("principal_id", [USOL_H, USOL_N]);
  const dist = {};
  for (const t of (tasks || [])) dist[t.status || "(NULL)"] = (dist[t.status || "(NULL)"] || 0) + 1;
  for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) console.log(`  · ${k}: ${v}건`);
  console.log(`  측 ${tasks?.length || 0}건`);

  // [3] task_items 측 columns 측 + status 측 측 측 측
  console.log(`\n${"=".repeat(85)}\n[3] task_items columns + status/cancel 측\n${"=".repeat(85)}\n`);
  const taskIds = (tasks || []).map(t => t.id);
  const sample = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    const { data } = await sb.from("task_items").select("*").in("task_id", taskIds.slice(i, i + 200)).limit(1);
    if (data && data[0]) { sample.push(data[0]); break; }
  }
  if (sample[0]) {
    const cols = Object.keys(sample[0]);
    console.log(`  task_items columns: ${cols.join(", ")}`);
    const statusish = cols.filter(c => /status|cancel|state|취소/i.test(c));
    console.log(`  측 측 catch 측 측 (status/cancel/state): ${statusish.length > 0 ? statusish.join(", ") : "(X)"}`);
  }

  // [4] task_items 측 측 측 측 측 측 측 = 측 task 측 task_items 측 측 측 측 측 측 측 X 측 측
  console.log(`\n${"=".repeat(85)}\n[4] 부분취소 패턴 측 — task.status=취소 측 task_items vs task.status=완료/확정 측 task_items\n${"=".repeat(85)}\n`);

  // 측 task 측 task_items 측 측 catch
  const allItems = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    const { data } = await sb.from("task_items").select("id, task_id, order_type, qty, unit_price, appliance_type_id, work_type_id").in("task_id", taskIds.slice(i, i + 200));
    if (data) allItems.push(...data);
  }
  const itemsByTask = new Map();
  for (const it of allItems) {
    if (!itemsByTask.has(it.task_id)) itemsByTask.set(it.task_id, []);
    itemsByTask.get(it.task_id).push(it);
  }

  // 같은 주문 측 task_no 측 측 catch — task 측 status='취소' 측 task 측 status='완료' 측 측 measurement 측 = 측 측 부분취소 측 측 측
  const { data: ext } = await sb.from("tasks").select("id, task_no, status, external_order_no, customer_name").in("id", taskIds);
  const taskById = new Map((ext || []).map(t => [t.id, t]));
  const tasksByOrder = new Map();
  for (const t of (ext || [])) {
    if (!t.external_order_no) continue;
    if (!tasksByOrder.has(t.external_order_no)) tasksByOrder.set(t.external_order_no, []);
    tasksByOrder.get(t.external_order_no).push(t);
  }
  // 측 주문 측 측 task measurement, 측 측 측 status 측 측 measurement → 부분취소
  let partialCancelOrders = 0;
  const partialSamples = [];
  for (const [ord, ts] of tasksByOrder) {
    if (ts.length < 2) continue;
    const statuses = new Set(ts.map(t => t.status));
    if (statuses.has("취소") && (statuses.has("완료") || statuses.has("확정") || statuses.has("배정"))) {
      partialCancelOrders++;
      if (partialSamples.length < 5) partialSamples.push({ ord, tasks: ts });
    }
  }
  console.log(`  주문번호 측 측 task measurement 측 — task 측 status 측 측 (취소 + 완료/확정/배정) measurement 측: ${partialCancelOrders}건`);
  for (const s of partialSamples) {
    console.log(`\n  ▣ 주문 ${s.ord}:`);
    for (const t of s.tasks) {
      const its = itemsByTask.get(t.id) || [];
      console.log(`    · ${t.task_no} | status=${t.status} | ${t.customer_name} | task_items=${its.length}`);
    }
  }

  // [4b] task_items 측 qty 측 — 2 측 측 측 측 측 측 측 (수량 측 측 측 measurement 측)
  console.log(`\n  task_items.qty 측 분포:`);
  const qtyDist = {};
  for (const it of allItems) qtyDist[it.qty || "(NULL)"] = (qtyDist[it.qty || "(NULL)"] || 0) + 1;
  for (const [k, v] of Object.entries(qtyDist).sort((a, b) => Number(a[0]) - Number(b[0]))) console.log(`    · qty=${k}: ${v}건`);

  // [5] tasks.status enum (Migration 측)
  console.log(`\n${"=".repeat(85)}\n[5] tasks.status CHECK constraint (Migration 측 측)\n${"=".repeat(85)}\n`);
  // information_schema 측 catch X → Migration 측 측 측 측 (사장님 측 직접 측 보고)
  console.log(`  · 측 measurement enum 측 측 measurement script 측 측 catch X — Migration 001/053 측 측 catch`);
  console.log(`  · '미배정' / '배정' / '확정' / '진행중' / '완료' / '취소' / 'visit_only' (이전 측)`);
  console.log(`  · '부분취소' 측 enum 측 measurement 측 (사장님 spec) — Migration 측 측 측 X`);
})();

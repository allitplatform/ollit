// 유솔 포털 정산 탭 Phase 1 진단 — 수정 X
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
  const { data: tasks } = await sb.from("tasks").select("id").eq("tenant_id", TENANT_ID).in("principal_id", [USOL_H, USOL_N]);
  const taskIds = (tasks || []).map(t => t.id);
  const allItems = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    const { data } = await sb.from("task_items").select("id, task_id, order_type, qty, unit_price, subtotal, net_amount, naver_settled_at, naver_received_at, company_received_at, cash_settled_at, cash_received_at, engineer_settled_at, product_order_id, work_type_id, appliance_type_id").in("task_id", taskIds.slice(i, i + 200));
    if (data) allItems.push(...data);
  }

  // [1] 정산 필드 채워진 건수
  console.log(`${"=".repeat(85)}\n[1] task_items 정산 필드 채움 분포 (usol_h + usol_n 측 ${allItems.length}건)\n${"=".repeat(85)}\n`);
  const fields = ["naver_settled_at", "naver_received_at", "company_received_at", "cash_settled_at", "cash_received_at", "engineer_settled_at"];
  for (const f of fields) {
    const cnt = allItems.filter(it => it[f] != null).length;
    console.log(`  · ${f.padEnd(22)}: ${String(cnt).padStart(5)}건`);
  }

  // [2] naver_settled_at 값 분포 (주차)
  console.log(`\n${"=".repeat(85)}\n[2] naver_settled_at 값 분포 (날짜·주차)\n${"=".repeat(85)}\n`);
  const naverSettled = allItems.filter(it => it.naver_settled_at).map(it => new Date(it.naver_settled_at));
  if (naverSettled.length === 0) {
    console.log(`  · 채움 0건 — naver_settled_at 측 비어있음`);
  } else {
    const sorted = [...naverSettled].sort((a, b) => a - b);
    console.log(`  · min: ${sorted[0].toISOString().slice(0, 10)}`);
    console.log(`  · max: ${sorted[sorted.length - 1].toISOString().slice(0, 10)}`);
    // 주차별 (ISO week)
    const weekDist = {};
    for (const d of naverSettled) {
      const y = d.getFullYear();
      const start = new Date(y, 0, 1);
      const diff = (d - start) / (1000 * 60 * 60 * 24);
      const wk = Math.ceil((diff + start.getDay() + 1) / 7);
      const key = `${y}-W${String(wk).padStart(2, "0")}`;
      weekDist[key] = (weekDist[key] || 0) + 1;
    }
    console.log(`  · 주차별:`);
    for (const [k, v] of Object.entries(weekDist).sort()) console.log(`    · ${k}: ${v}건`);
  }

  // [3] 정산 금액 후보 — net_amount vs subtotal
  console.log(`\n${"=".repeat(85)}\n[3] 정산 금액 후보 (net_amount / subtotal / unit_price)\n${"=".repeat(85)}\n`);
  let netCnt = 0, subCnt = 0, unitCnt = 0;
  let netSum = 0, subSum = 0;
  for (const it of allItems) {
    if (it.net_amount != null) { netCnt++; netSum += Number(it.net_amount) || 0; }
    if (it.subtotal != null) { subCnt++; subSum += Number(it.subtotal) || 0; }
    if (it.unit_price != null) unitCnt++;
  }
  console.log(`  · net_amount 채움: ${netCnt}건 / 측 ${netSum.toLocaleString()}`);
  console.log(`  · subtotal  채움: ${subCnt}건 / 측 ${subSum.toLocaleString()}`);
  console.log(`  · unit_price 채움: ${unitCnt}건`);

  // [4] 한 task 측 형제 task_items 측 측 naver_settled_at 측 측 측
  console.log(`\n${"=".repeat(85)}\n[4] 형제 task_items 측 다른 naver_settled_at — 한 주문 측 측 주차\n${"=".repeat(85)}\n`);
  const byTask = new Map();
  for (const it of allItems) {
    if (!byTask.has(it.task_id)) byTask.set(it.task_id, []);
    byTask.get(it.task_id).push(it);
  }
  let crossWeekTasks = 0;
  let crossDaySamples = [];
  for (const [tid, its] of byTask) {
    if (its.length < 2) continue;
    const dates = its.filter(x => x.naver_settled_at).map(x => x.naver_settled_at.slice(0, 10));
    if (dates.length < 2) continue;
    const uniq = new Set(dates);
    if (uniq.size > 1) {
      crossWeekTasks++;
      if (crossDaySamples.length < 5) crossDaySamples.push({ tid, dates: [...uniq] });
    }
  }
  console.log(`  · 측 task 측 task_items 측 측 다른 naver_settled_at 측 측 (날짜 기준): ${crossWeekTasks}건`);
  for (const s of crossDaySamples) console.log(`    · task ${s.tid.slice(0, 8)} → ${s.dates.join(" / ")}`);

  // [5] 본작업 vs 추가선택(냉매) 분류 — order_type 기준
  console.log(`\n${"=".repeat(85)}\n[5] order_type 분포 (세척/냉매 구분)\n${"=".repeat(85)}\n`);
  const otDist = {};
  for (const it of allItems) otDist[it.order_type || "(NULL)"] = (otDist[it.order_type || "(NULL)"] || 0) + 1;
  for (const [k, v] of Object.entries(otDist).sort((a, b) => b[1] - a[1])) console.log(`  · ${k}: ${v}건`);

  // [5b] work_types lookup 측 측 추가선택 측 측 측 측 측
  const { data: wts } = await sb.from("work_types").select("id, name");
  const wtMap = new Map((wts || []).map(w => [w.id, w.name]));
  console.log(`\n  · 추가선택 측 work_type name 분포 (refrigerant 측 측 측):`);
  const addonWt = {};
  for (const it of allItems) {
    if (it.order_type === "추가선택") {
      const name = wtMap.get(it.work_type_id) || "(name X)";
      addonWt[name] = (addonWt[name] || 0) + 1;
    }
  }
  for (const [k, v] of Object.entries(addonWt).sort((a, b) => b[1] - a[1])) console.log(`    · ${k}: ${v}건`);
})();

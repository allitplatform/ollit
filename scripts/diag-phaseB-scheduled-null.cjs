// Phase B 진단 — 확정/완료인데 scheduled_at NULL인 task + 시트/캘린더로 채울 수 있는지 + 메인 없는 추가선택
// 읽기 전용. 쓰기 금지.
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
const Papa = require("papaparse");

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CSV_PATH  = path.join(__dirname, "..", "data", "usol_ops_20260524.csv");
const GCAL_PATH = path.join(__dirname, "..", "data", "gcal-index.json");

async function fetchAll(builder) {
  let out = [], from = 0;
  while (true) {
    const { data, error } = await builder().range(from, from + 999);
    if (error) throw error;
    out = out.concat(data || []);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return out;
}

(async () => {
  console.log("=".repeat(110));
  console.log("Phase B 진단 — 확정/완료 scheduled_at NULL + 시트/gcal 대조 + 본작업 없는 추가선택");
  console.log("=".repeat(110));

  // 1. usol principals
  const { data: principals } = await sb.from("principals").select("id, code").in("code", ["usol_n", "usol_h"]);
  const pids = principals.map(p => p.id);
  console.log(`\nprincipals: ${principals.map(p => `${p.code}=${p.id.slice(0, 8)}`).join(" / ")}`);

  // 2. usol tasks 전체 fetch
  const tasks = await fetchAll(() => sb.from("tasks").select(
    "id, task_no, status, scheduled_at, completed_at, is_legacy, customer_name, assigned_engineer_id, external_order_no, principal_id"
  ).in("principal_id", pids));
  console.log(`usol task 총수: ${tasks.length}건`);

  // 3. 확정/완료 + scheduled_at NULL 분리
  const missingDone   = tasks.filter(t => t.status === "완료" && !t.scheduled_at);
  const missingFixed  = tasks.filter(t => t.status === "확정" && !t.scheduled_at);
  console.log("\n[A] status='완료' AND scheduled_at NULL");
  console.log(`  총: ${missingDone.length}건`);
  console.log(`  is_legacy=true:  ${missingDone.filter(t => t.is_legacy === true).length}건`);
  console.log(`  is_legacy=false: ${missingDone.filter(t => t.is_legacy === false).length}건`);

  console.log("\n[B] status='확정' AND scheduled_at NULL");
  console.log(`  총: ${missingFixed.length}건`);
  console.log(`  is_legacy=true:  ${missingFixed.filter(t => t.is_legacy === true).length}건`);
  console.log(`  is_legacy=false: ${missingFixed.filter(t => t.is_legacy === false).length}건`);

  // 4. CSV 로드 + 작업코드 인덱스
  const csvRaw = fs.readFileSync(CSV_PATH, "utf8");
  const csvParsed = Papa.parse(csvRaw, { header: true, skipEmptyLines: true });
  const csvByCode = new Map();
  for (const r of csvParsed.data) {
    const c = (r["작업코드"] || "").trim();
    if (c) csvByCode.set(c, r);
  }
  console.log(`\nCSV: ${csvParsed.data.length} rows, ${csvByCode.size} unique 작업코드`);

  // 5. gcal-index 로드
  const gcal = JSON.parse(fs.readFileSync(GCAL_PATH, "utf8"));
  console.log(`gcal-index: ${Object.keys(gcal).length} 작업코드`);

  // 6. CSV/gcal로 채울 수 있는지 판정
  function csvHasSchedule(row) {
    if (!row) return false;
    const contact = (row["고객컨택일자"] || "").trim();
    const completed = (row["작업완료일"] || "").trim();
    return !!(contact || completed);
  }
  function gcalHasSchedule(code) {
    const e = gcal[code];
    if (!e || !Array.isArray(e.occurrences) || e.occurrences.length === 0) return false;
    return !!e.occurrences[0].scheduled_at;
  }

  function analyze(label, arr) {
    let csvFillable = 0, gcalFillable = 0, eitherFillable = 0, neither = 0;
    const neitherList = [];
    for (const t of arr) {
      const csvRow = csvByCode.get(t.task_no);
      const csvOk = csvHasSchedule(csvRow);
      const gcOk = gcalHasSchedule(t.task_no);
      if (csvOk) csvFillable++;
      if (gcOk) gcalFillable++;
      if (csvOk || gcOk) eitherFillable++;
      else { neither++; neitherList.push(t); }
    }
    console.log(`\n[${label}] 채움 가능성 분석 (총 ${arr.length}건)`);
    console.log(`  CSV(고객컨택일자 또는 작업완료일 있음): ${csvFillable}건 (${arr.length > 0 ? Math.round(csvFillable*100/arr.length) : 0}%)`);
    console.log(`  gcal(scheduled_at 있음):                ${gcalFillable}건 (${arr.length > 0 ? Math.round(gcalFillable*100/arr.length) : 0}%)`);
    console.log(`  CSV 또는 gcal:                          ${eitherFillable}건 (${arr.length > 0 ? Math.round(eitherFillable*100/arr.length) : 0}%)`);
    console.log(`  둘 다 없음(수동 확인 필요):              ${neither}건`);
    return { neitherList };
  }
  const A = analyze("A 완료+NULL", missingDone);
  const B = analyze("B 확정+NULL", missingFixed);

  // 7. 작업코드 샘플 출력 (각 20건)
  function printSample(label, arr, n = 20) {
    console.log(`\n[${label}] 샘플 ${Math.min(n, arr.length)}건`);
    for (const t of arr.slice(0, n)) {
      const csvRow = csvByCode.get(t.task_no);
      const csvOk = csvHasSchedule(csvRow);
      const gcOk = gcalHasSchedule(t.task_no);
      const csvContact = csvRow ? (csvRow["고객컨택일자"] || "").trim() : "";
      const csvCompleted = csvRow ? (csvRow["작업완료일"] || "").trim() : "";
      const csvTime = csvRow ? (csvRow["기사약속시간"] || "").trim() : "";
      const gcalAt = gcalHasSchedule(t.task_no) ? gcal[t.task_no].occurrences[0].scheduled_at : "";
      console.log(`  ${t.task_no} | ${t.customer_name || "?"} | legacy=${t.is_legacy} | CSV=${csvOk ? "✓" : "✗"} gcal=${gcOk ? "✓" : "✗"} | contact=${csvContact} comp=${csvCompleted} time=${csvTime} | gcal=${gcalAt}`);
    }
  }
  printSample("A 완료+NULL 샘플", missingDone, 30);
  printSample("B 확정+NULL 샘플", missingFixed, 30);

  // 8. 신규 422건과 기존 862건 분리 (is_legacy 기반)
  console.log("\n[교차] status × is_legacy");
  function crossLegacy(arr, label) {
    const t = arr.filter(x => x.is_legacy === true).length;
    const f = arr.filter(x => x.is_legacy === false).length;
    console.log(`  ${label.padEnd(20)} legacy=T ${String(t).padStart(4)} | legacy=F ${String(f).padStart(4)} | 합 ${String(arr.length).padStart(4)}`);
  }
  crossLegacy(missingDone, "완료+NULL");
  crossLegacy(missingFixed, "확정+NULL");

  // 9. 본작업 없는 추가선택만 있는 task (메인 없는 추가선택)
  console.log("\n[C] 본작업(메인) 없이 추가선택 task_items만 있는 task");
  const taskIds = tasks.map(t => t.id);
  let items = [];
  for (let i = 0; i < taskIds.length; i += 500) {
    const slice = taskIds.slice(i, i + 500);
    const { data } = await sb.from("task_items").select("task_id, order_type").in("task_id", slice);
    if (data) items = items.concat(data);
  }
  const itemsByTask = new Map();
  for (const it of items) {
    if (!itemsByTask.has(it.task_id)) itemsByTask.set(it.task_id, []);
    itemsByTask.get(it.task_id).push(it);
  }
  const addonOnly = [];
  for (const t of tasks) {
    const its = itemsByTask.get(t.id) || [];
    if (its.length === 0) continue;
    const hasMain = its.some(i => i.order_type === "본작업");
    const hasAddon = its.some(i => i.order_type === "추가선택");
    if (!hasMain && hasAddon) addonOnly.push({ task: t, items: its });
  }
  console.log(`  본작업 없이 추가선택만 있는 task: ${addonOnly.length}건`);
  console.log(`  is_legacy=true:  ${addonOnly.filter(x => x.task.is_legacy === true).length}건`);
  console.log(`  is_legacy=false: ${addonOnly.filter(x => x.task.is_legacy === false).length}건`);

  if (addonOnly.length > 0) {
    console.log(`\n  본작업 없는 추가선택 task 목록 (전체):`);
    for (const x of addonOnly) {
      const orderTypes = [...new Set(x.items.map(i => i.order_type))].join("+");
      const ext = x.task.external_order_no || "(외부주문번호 없음)";
      console.log(`    ${x.task.task_no} | ${x.task.customer_name || "?"} | status=${x.task.status} | legacy=${x.task.is_legacy} | items=${x.items.length}(${orderTypes}) | ext=${ext}`);
    }
  }

  // 10. 같은 external_order_no를 공유하는 task 그룹 — 메인 task 누락 확인
  console.log("\n[D] 같은 external_order_no 그룹 (메인 task 누락 추정)");
  const byExtOrder = new Map();
  for (const t of tasks) {
    if (!t.external_order_no) continue;
    if (!byExtOrder.has(t.external_order_no)) byExtOrder.set(t.external_order_no, []);
    byExtOrder.get(t.external_order_no).push(t);
  }
  const groupCount = byExtOrder.size;
  const groupedMulti = [...byExtOrder.entries()].filter(([k, v]) => v.length > 1);
  console.log(`  external_order_no 고유 그룹: ${groupCount}건 / 2개 이상 task 공유: ${groupedMulti.length}건`);

  // 11. 결과 JSON 저장 (선택)
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outFile = path.join(__dirname, `diag-phaseB-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      usol_total: tasks.length,
      missingDone: missingDone.length,
      missingFixed: missingFixed.length,
      addonOnlyCount: addonOnly.length,
    },
    missingDone: missingDone.map(t => ({
      task_no: t.task_no, customer_name: t.customer_name, is_legacy: t.is_legacy,
      csvHas: csvHasSchedule(csvByCode.get(t.task_no)),
      gcalHas: gcalHasSchedule(t.task_no),
    })),
    missingFixed: missingFixed.map(t => ({
      task_no: t.task_no, customer_name: t.customer_name, is_legacy: t.is_legacy,
      csvHas: csvHasSchedule(csvByCode.get(t.task_no)),
      gcalHas: gcalHasSchedule(t.task_no),
    })),
    addonOnly: addonOnly.map(x => ({
      task_no: x.task.task_no, customer_name: x.task.customer_name,
      status: x.task.status, is_legacy: x.task.is_legacy,
      external_order_no: x.task.external_order_no,
      items: x.items.map(i => i.order_type),
    })),
  }, null, 2));
  console.log(`\n결과 저장: ${outFile}`);

  console.log("\n" + "=".repeat(110));
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

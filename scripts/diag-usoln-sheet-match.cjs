// 진단 — 운영 시트 ↔ DB 정밀 매칭 + 칼럼 매핑
// 2026-05-24
const fs = require("fs"), path = require("path");
const XLSX = require("xlsx");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SHEET_PATH = path.join(__dirname, "유솔홈케어_운영.xlsx");

(async () => {
  // ========== 시트 로드 ==========
  console.log("=".repeat(110));
  console.log("[0] 시트 로드");
  console.log("=".repeat(110));
  console.log(`파일: ${SHEET_PATH}`);

  const wb = XLSX.readFile(SHEET_PATH, { cellDates: true });
  const sheetNames = wb.SheetNames;
  console.log(`시트 목록: ${sheetNames.join(", ")}`);

  const sheet = wb.Sheets[sheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  console.log(`시트1 데이터 행: ${rows.length}`);

  if (rows.length > 0) {
    console.log(`시트1 칼럼 (${Object.keys(rows[0]).length}개):`);
    for (const [i, k] of Object.entries(Object.keys(rows[0]))) {
      console.log(`   ${String(+i + 1).padStart(2)}. ${k}`);
    }
  }

  // 매칭 키 컬럼 자동 추정 — '상품주문번호' or '작업코드'
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const colOrder = cols.find(c => /상품주문번호/.test(c));
  const colTaskNo = cols.find(c => /작업코드/.test(c));
  const colStatus = cols.find(c => /^상태$/.test(c)) || cols.find(c => /상태/.test(c));
  const colEng = cols.find(c => /배정기사/.test(c));
  const colSched = cols.find(c => /기사약속시간/.test(c)) || cols.find(c => /약속시간/.test(c));
  const colCompleted = cols.find(c => /작업완료일/.test(c));
  const colCustomer = cols.find(c => /수취인명/.test(c)) || cols.find(c => /고객명/.test(c)) || cols.find(c => /구매자명/.test(c));
  const colSettle = cols.find(c => /정산예정/.test(c));
  const colNetAmount = cols.find(c => /네이버정산/.test(c));
  const colCustPaid = cols.find(c => /최종상품금액/.test(c)) || cols.find(c => /총주문금액/.test(c));

  console.log("\n[추정 키 컬럼]");
  console.log(`  상품주문번호 → "${colOrder}"`);
  console.log(`  작업코드     → "${colTaskNo}"`);
  console.log(`  상태         → "${colStatus}"`);
  console.log(`  배정기사     → "${colEng}"`);
  console.log(`  기사약속시간 → "${colSched}"`);
  console.log(`  작업완료일   → "${colCompleted}"`);
  console.log(`  수취인명     → "${colCustomer}"`);
  console.log(`  정산예정금액 → "${colSettle}"`);
  console.log(`  네이버정산   → "${colNetAmount}"`);
  console.log(`  최종상품금액 → "${colCustPaid}"`);

  // ========== DB usol_n task_items 전체 수집 ==========
  console.log("\n" + "=".repeat(110));
  console.log("[1] DB usol_n task_items 수집");
  console.log("=".repeat(110));
  const usolNId = "22222222-2222-2222-2222-222222222006";

  const tasksById = new Map();
  {
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await sb
        .from("tasks")
        .select("id, task_no, status, customer_name, scheduled_at, completed_at, assigned_engineer_id, created_at, channel, external_order_no")
        .eq("principal_id", usolNId)
        .range(from, from + PAGE - 1);
      if (!data?.length) break;
      for (const t of data) tasksById.set(t.id, t);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  const dbTaskIds = [...tasksById.keys()];

  const dbItems = [];
  for (let i = 0; i < dbTaskIds.length; i += 200) {
    const ids = dbTaskIds.slice(i, i + 200);
    const { data } = await sb
      .from("task_items")
      .select("id, task_id, product_order_id, order_type, unit_price, subtotal, net_amount, customer_paid_amount, naver_settled_at, metadata")
      .in("task_id", ids);
    if (data) dbItems.push(...data);
  }
  console.log(`DB tasks: ${tasksById.size} / task_items: ${dbItems.length}`);

  // ========== [A] 매칭 ==========
  console.log("\n" + "=".repeat(110));
  console.log("[A] 정밀 매칭 — 상품주문번호 ↔ task_items.product_order_id");
  console.log("=".repeat(110));

  const normalize = (v) => v == null ? "" : String(v).trim();
  const sheetKeys = new Set();
  const sheetRowsByKey = new Map();
  const sheetCashKeys = new Set();   // YS- 시작 작업코드 (현금접수)

  for (const r of rows) {
    const ord = normalize(r[colOrder]);
    if (ord) {
      sheetKeys.add(ord);
      if (!sheetRowsByKey.has(ord)) sheetRowsByKey.set(ord, []);
      sheetRowsByKey.get(ord).push(r);
      if (/^YS-/.test(ord)) sheetCashKeys.add(ord);
    }
  }
  const dbKeys = new Set();
  const dbRowsByKey = new Map();
  for (const it of dbItems) {
    const k = normalize(it.product_order_id);
    if (k) {
      dbKeys.add(k);
      if (!dbRowsByKey.has(k)) dbRowsByKey.set(k, []);
      dbRowsByKey.get(k).push(it);
    }
  }

  // 양쪽
  const matched = [], sheetOnly = [], dbOnly = [];
  for (const k of sheetKeys) {
    if (dbKeys.has(k)) matched.push(k);
    else sheetOnly.push(k);
  }
  for (const k of dbKeys) if (!sheetKeys.has(k)) dbOnly.push(k);

  console.log(`\n[A-1] 매칭 요약:`);
  console.log(`  · 시트 row 총 수            : ${rows.length}`);
  console.log(`  · 시트 unique 상품주문번호  : ${sheetKeys.size}`);
  console.log(`  · DB unique product_order_id: ${dbKeys.size}`);
  console.log(`  · 매칭                      : ${matched.length}`);
  console.log(`  · 시트에만                  : ${sheetOnly.length}`);
  console.log(`  · DB에만                    : ${dbOnly.length}`);

  // ========== [A-2] DB에만 있음 — 분류 ==========
  console.log(`\n[A-2] DB에만 있음 분류 (${dbOnly.length}개):`);
  let already_cancelled = 0;
  let dup_old_cancel = 0;
  let ysn_unmatched = 0;
  let other = 0;
  const otherList = [];

  // 11쌍 중복의 옛 취소 행 식별 — 중복 poid + status='취소'
  const dupCounts = new Map();
  for (const it of dbItems) {
    const k = it.product_order_id;
    if (k) dupCounts.set(k, (dupCounts.get(k) || 0) + 1);
  }

  for (const k of dbOnly) {
    const items = dbRowsByKey.get(k) || [];
    for (const it of items) {
      const t = tasksById.get(it.task_id);
      const isYSN = (t?.task_no || "").startsWith("YS-N-");
      const isCanc = t?.status === "취소";
      const isDup = (dupCounts.get(k) || 0) >= 2;
      if (isYSN) ysn_unmatched++;
      else if (isDup && isCanc) dup_old_cancel++;
      else if (isCanc) already_cancelled++;
      else {
        other++;
        otherList.push({ poid: k, task_no: t?.task_no, status: t?.status, cust: t?.customer_name, scheduled_at: t?.scheduled_at, completed_at: t?.completed_at });
      }
    }
  }
  console.log(`  · 이미 status='취소'        : ${already_cancelled}`);
  console.log(`  · 중복 11쌍의 옛 취소 task  : ${dup_old_cancel}`);
  console.log(`  · YS-N- 미매칭              : ${ysn_unmatched}`);
  console.log(`  · 그 외 (진짜 취소 후보)    : ${other}`);

  if (otherList.length) {
    console.log(`\n  [그 외 — 진짜 취소 후보 ${otherList.length}건]`);
    for (const o of otherList) {
      console.log(`    · poid=${o.poid} | ${o.task_no} | ${o.status} | ${o.cust} | sched=${(o.scheduled_at || "").slice(0, 10)} | comp=${(o.completed_at || "").slice(0, 10)}`);
    }
  }

  // ========== [A-3] 시트에만 있음 ==========
  console.log(`\n[A-3] 시트에만 있음 (${sheetOnly.length}개):`);
  if (sheetOnly.length <= 30) {
    for (const k of sheetOnly) {
      const sRows = sheetRowsByKey.get(k) || [];
      const sFirst = sRows[0];
      console.log(`  · ${k} | ${sFirst?.[colCustomer] || "?"} | ${sFirst?.[colStatus] || "?"} | task_code=${sFirst?.[colTaskNo] || "?"}`);
    }
  } else {
    console.log(`  (30건 초과 — 샘플 30건만 출력)`);
    for (const k of sheetOnly.slice(0, 30)) {
      const sRows = sheetRowsByKey.get(k) || [];
      const sFirst = sRows[0];
      console.log(`  · ${k} | ${sFirst?.[colCustomer] || "?"} | ${sFirst?.[colStatus] || "?"} | task_code=${sFirst?.[colTaskNo] || "?"}`);
    }
  }

  // ========== [A-4] 현금접수 6건 ==========
  console.log(`\n[A-4] 시트 현금접수 (상품주문번호=YS- 작업코드) ${sheetCashKeys.size}건 매칭:`);
  for (const k of sheetCashKeys) {
    const matched_in_db = dbKeys.has(k);
    const dbItems2 = dbRowsByKey.get(k) || [];
    const status = dbItems2[0] ? tasksById.get(dbItems2[0].task_id)?.status : null;
    console.log(`  · ${k} | DB ${matched_in_db ? "있음" : "없음"} | status=${status || "?"}`);
  }

  // ========== [B] 칼럼 매핑 — 시트 컬럼 전체 dump ==========
  console.log("\n" + "=".repeat(110));
  console.log("[B] 칼럼 매핑 — 시트 59칼럼 dump + 샘플 값");
  console.log("=".repeat(110));
  const sampleRow = rows[0] || {};
  const allCols = Object.keys(sampleRow);
  for (const [i, c] of Object.entries(allCols)) {
    let v = sampleRow[c];
    if (v instanceof Date) v = v.toISOString().slice(0, 19);
    const s = String(v == null ? "" : v).slice(0, 50);
    console.log(`  ${String(+i + 1).padStart(2)}. "${c}" : "${s}"`);
  }

  // ========== [C] 기사명 매핑 ==========
  console.log("\n" + "=".repeat(110));
  console.log("[C] 기사명 → user_id 매핑");
  console.log("=".repeat(110));
  const engNames = new Set();
  for (const r of rows) {
    const n = normalize(r[colEng]);
    if (n) engNames.add(n);
  }
  console.log(`시트 고유 배정기사 ${engNames.size}명`);

  const { data: users } = await sb
    .from("users")
    .select("id, name, code, is_active")
    .eq("tenant_id", "11111111-1111-1111-1111-111111111111");
  const userByName = new Map();
  for (const u of (users || [])) userByName.set(normalize(u.name), u);

  const engMatch = [];
  const engMiss = [];
  for (const n of [...engNames].sort()) {
    const u = userByName.get(n);
    if (u) engMatch.push({ sheet: n, user_id: u.id, code: u.code, active: u.is_active });
    else engMiss.push(n);
  }
  console.log(`\n[C-1] 매칭된 기사 (${engMatch.length}):`);
  for (const e of engMatch) console.log(`  · ${e.sheet.padEnd(8)} → ${e.code || "(no code)"} | active=${e.active} | ${e.user_id}`);
  console.log(`\n[C-2] 매칭 실패 기사 (${engMiss.length}):`);
  for (const n of engMiss) console.log(`  · "${n}"`);

  // ========== [D] 상태값 매핑 ==========
  console.log("\n" + "=".repeat(110));
  console.log("[D] 상태값 매핑");
  console.log("=".repeat(110));
  const statusBuckets = {};
  for (const r of rows) {
    const s = normalize(r[colStatus]) || "(빈값)";
    statusBuckets[s] = (statusBuckets[s] || 0) + 1;
  }
  console.log(`시트 상태값 분포:`);
  for (const [s, c] of Object.entries(statusBuckets).sort((a, b) => b[1] - a[1])) {
    console.log(`  · ${s.padEnd(12)} : ${c}`);
  }

  console.log(`\n${"=".repeat(110)}\n진단 완료.`);
})().catch(e => console.log("FATAL:", e.message, e.stack));

// 진단 — status 이상 전이 케이스 상세 dump
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

const STATUS_MAP = {
  "작업완료": "완료",
  "일정확정": "확정",
  "기사배정완료": "배정",
  "접수": "미배정",
  "취소": "취소",
};

const TARGET_TRANSITIONS = new Set([
  "취소→완료",
  "확정→미배정",
  "미배정→완료",
  "완료→배정",
  "배정→미배정",
]);

const norm = (v) => v == null ? "" : String(v).trim();

(async () => {
  // 시트 로드
  const wb = XLSX.readFile(path.join(__dirname, "유솔홈케어_운영.xlsx"), { cellDates: false });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false });
  const sheetByOrd = new Map();
  for (const r of rows) {
    const k = norm(r["상품주문번호"]);
    if (k) sheetByOrd.set(k, r);
  }

  // DB 로드
  const usolNId = "22222222-2222-2222-2222-222222222006";
  const tasksById = new Map();
  {
    let from = 0;
    while (true) {
      const { data } = await sb
        .from("tasks")
        .select("id, task_no, status, customer_name, scheduled_at, completed_at, assigned_engineer_id, channel")
        .eq("principal_id", usolNId)
        .range(from, from + 999);
      if (!data?.length) break;
      for (const t of data) tasksById.set(t.id, t);
      if (data.length < 1000) break;
      from += 1000;
    }
  }
  const dbTaskIds = [...tasksById.keys()];

  const items = [];
  for (let i = 0; i < dbTaskIds.length; i += 200) {
    const ids = dbTaskIds.slice(i, i + 200);
    const { data } = await sb
      .from("task_items")
      .select("id, task_id, product_order_id, order_type, unit_price, net_amount, customer_paid_amount, naver_settled_at")
      .in("task_id", ids);
    if (data) items.push(...data);
  }
  const itemByOrd = new Map();
  for (const it of items) {
    const k = norm(it.product_order_id);
    if (k) itemByOrd.set(k, it);
  }

  // users
  const { data: users } = await sb.from("users").select("id, name").eq("tenant_id", "11111111-1111-1111-1111-111111111111");
  const userById = new Map((users || []).map(u => [u.id, u.name]));

  // 이상 전이 catch
  const buckets = new Map();   // 전이 key → [rowDetail]
  const seenTask = new Set();  // task 측 측 측 측 측 측 catch (한 task의 여러 item이 같은 전이 만들면 한 번만)

  for (const [ord, sR] of sheetByOrd.entries()) {
    const it = itemByOrd.get(ord);
    if (!it) continue;
    const task = tasksById.get(it.task_id);
    if (!task) continue;

    const sheetStatusKey = norm(sR["상태"]);
    const newStatus = STATUS_MAP[sheetStatusKey];
    if (!newStatus || newStatus === task.status) continue;

    const trans = `${task.status}→${newStatus}`;
    if (!TARGET_TRANSITIONS.has(trans)) continue;

    const key = `${task.id}|${trans}`;
    if (seenTask.has(key)) continue;
    seenTask.add(key);

    if (!buckets.has(trans)) buckets.set(trans, []);
    buckets.get(trans).push({ task, sheet: sR, item: it, ord });
  }

  // 출력
  const orderOut = ["취소→완료", "확정→미배정", "미배정→완료", "완료→배정", "배정→미배정"];
  for (const trans of orderOut) {
    const list = buckets.get(trans) || [];
    console.log("\n" + "=".repeat(120));
    console.log(`[전이] ${trans}  — ${list.length}건`);
    console.log("=".repeat(120));
    if (!list.length) { console.log("  (없음)"); continue; }

    for (const e of list) {
      const { task, sheet, item, ord } = e;
      const engName = userById.get(task.assigned_engineer_id) || "(미배정)";
      const sheetEng = norm(sheet["배정기사"]) || "(빈값)";

      console.log(`\n● ${task.task_no} | 고객=${task.customer_name}`);
      console.log(`  ─ status: DB '${task.status}'  →  시트 '${sheet["상태"]}'  (매핑: '${STATUS_MAP[norm(sheet["상태"])]}')`);
      console.log(`  ─ scheduled : DB ${task.scheduled_at || "(NULL)"}`);
      console.log(`                시트 ${sheet["고객컨택일자"] || "(빈값)"} + ${sheet["기사약속시간"] || "(빈값)"}`);
      console.log(`  ─ completed : DB ${task.completed_at || "(NULL)"}`);
      console.log(`                시트 ${sheet["작업완료일"] || "(빈값)"}`);
      console.log(`  ─ 기사       : DB '${engName}'  /  시트 '${sheetEng}'`);
      console.log(`  ─ ord(poid)  : ${ord}`);
      console.log(`  ─ DB item    : order_type=${item.order_type} | unit=${item.unit_price} | net=${item.net_amount ?? "NULL"} | cust_paid=${item.customer_paid_amount ?? "NULL"} | naver_settled=${item.naver_settled_at || "(NULL)"}`);
      console.log(`  ─ 시트 값    : 정산예정=${sheet["정산예정금액"] || "(빈)"} | 네이버정산=${sheet["네이버정산금액"] || "(빈)"} | 최종상품=${sheet["최종상품금액"] || "(빈)"} | 네이버정산완료일=${sheet["네이버정산완료일"] || "(빈)"}`);
      console.log(`  ─ 시트 비고  : ${sheet["비고"] || "(빈값)"}`);
    }
  }

  // 요약
  console.log("\n" + "=".repeat(120));
  console.log("[요약]");
  console.log("=".repeat(120));
  for (const trans of orderOut) {
    const cnt = (buckets.get(trans) || []).length;
    console.log(`  · ${trans.padEnd(14)} : ${cnt}건`);
  }
})().catch(e => console.error("FATAL:", e.message, e.stack));

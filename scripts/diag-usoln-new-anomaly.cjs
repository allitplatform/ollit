// 진단 — dry-run 재실행 측 catch "취소→확정 1건" + "미배정→완료(전아름)" 상세
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

const STATUS_MAP = { "작업완료": "완료", "일정확정": "확정", "기사배정완료": "배정", "접수": "미배정", "취소": "취소" };
const norm = (v) => v == null ? "" : String(v).trim();

(async () => {
  const wb = XLSX.readFile(path.join(__dirname, "유솔홈케어_운영.xlsx"), { cellDates: false });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false });
  const sheetByOrd = new Map();
  for (const r of rows) { const k = norm(r["상품주문번호"]); if (k) sheetByOrd.set(k, r); }

  const usolNId = "22222222-2222-2222-2222-222222222006";
  const tasksById = new Map();
  let from = 0;
  while (true) {
    const { data } = await sb.from("tasks").select("id, task_no, status, customer_name, scheduled_at, completed_at, assigned_engineer_id").eq("principal_id", usolNId).range(from, from + 999);
    if (!data?.length) break;
    for (const t of data) tasksById.set(t.id, t);
    if (data.length < 1000) break;
    from += 1000;
  }
  const dbTaskIds = [...tasksById.keys()];

  const items = [];
  for (let i = 0; i < dbTaskIds.length; i += 200) {
    const ids = dbTaskIds.slice(i, i + 200);
    const { data } = await sb.from("task_items").select("*").in("task_id", ids);
    if (data) items.push(...data);
  }

  // 활성 우선 매칭
  const itemByOrd = new Map();
  for (const it of items) {
    const ord = norm(it.product_order_id);
    if (!ord) continue;
    const t = tasksById.get(it.task_id);
    if (!t) continue;
    const canc = t.status === "취소";
    if (itemByOrd.has(ord)) {
      const prev = itemByOrd.get(ord);
      const pt = tasksById.get(prev.task_id);
      if (pt?.status === "취소" && !canc) itemByOrd.set(ord, it);
    } else itemByOrd.set(ord, it);
  }

  console.log("=".repeat(110));
  console.log("[취소→확정 / 미배정→완료 / 기타 잔여 이상] 측 측");
  console.log("=".repeat(110));

  for (const [ord, sR] of sheetByOrd.entries()) {
    const it = itemByOrd.get(ord);
    if (!it) continue;
    const t = tasksById.get(it.task_id);
    if (!t) continue;
    const newS = STATUS_MAP[norm(sR["상태"])];
    if (!newS || newS === t.status) continue;
    const trans = `${t.status}→${newS}`;
    if (!["취소→확정", "미배정→완료", "취소→완료", "확정→미배정", "완료→배정", "배정→미배정"].includes(trans)) continue;
    const sameOrdItems = items.filter(x => norm(x.product_order_id) === ord);

    console.log(`\n● ${trans}  |  task_no=${t.task_no}  |  고객=${t.customer_name}`);
    console.log(`  DB.status=${t.status}  sched=${t.scheduled_at}  comp=${t.completed_at || "(N)"}`);
    console.log(`  시트: 상태=${sR["상태"]} / 기사=${sR["배정기사"]} / 약속=${sR["고객컨택일자"]} ${sR["기사약속시간"]} / 완료=${sR["작업완료일"]}`);
    console.log(`  poid=${ord}  |  같은 poid의 task_items ${sameOrdItems.length}개:`);
    for (const x of sameOrdItems) {
      const xt = tasksById.get(x.task_id);
      console.log(`    · task_no=${xt?.task_no} | status=${xt?.status} | unit=${x.unit_price} | net=${x.net_amount} | order_type=${x.order_type}`);
    }
  }

  console.log("\n진단 완료.");
})().catch(e => console.log("FATAL:", e.message, e.stack));

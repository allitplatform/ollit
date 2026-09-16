// 진단 — 취소 후보 6건 상세 + 박은주 작업 전체 task_items
// 2026-05-24
const fs = require("fs"), path = require("path");
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

const TARGETS = [
  "2026051767451881", // 공형준
  "2026051660437861", // 장성숙
  "2026051648979211", // 한아영
  "2026051585005751", // 최도연
  "2026051585005761", // 최도연
  "2026051246842031", // 박은주
];

(async () => {
  // work_type / appliance_type 이름 lookup table
  const { data: wts } = await sb.from("work_types").select("id, name, code, service_type_id, appliance_type_id");
  const { data: ats } = await sb.from("appliance_types").select("id, name, code");
  const { data: sts } = await sb.from("service_types").select("id, name, code");
  const wtMap = new Map((wts || []).map(r => [r.id, r]));
  const atMap = new Map((ats || []).map(r => [r.id, r]));
  const stMap = new Map((sts || []).map(r => [r.id, r]));

  function fmtItem(it) {
    const wt = wtMap.get(it.work_type_id);
    const at = atMap.get(it.appliance_type_id);
    const st = wt ? stMap.get(wt.service_type_id) : null;
    const wtName = wt ? `${st?.name || "?"}/${wt.name || wt.code || "?"}` : "?";
    const atName = at?.name || at?.code || "?";
    return { wtName, atName };
  }

  // 6개 — 각 행의 item + task 풀 정보
  console.log("=".repeat(110));
  console.log("[1] 취소 후보 6개 — 각 행 상세");
  console.log("=".repeat(110));
  for (const poid of TARGETS) {
    const { data: items } = await sb
      .from("task_items")
      .select("*")
      .eq("product_order_id", poid);
    for (const it of (items || [])) {
      const { data: t } = await sb.from("tasks").select("id, task_no, customer_name, status, scheduled_at, completed_at, channel, request_note, external_order_no, assigned_engineer_id").eq("id", it.task_id).single();
      const { wtName, atName } = fmtItem(it);
      console.log(`\n● poid=${poid}`);
      console.log(`  task_no=${t?.task_no} | 고객=${t?.customer_name} | status=${t?.status} | channel=${t?.channel}`);
      console.log(`  scheduled_at=${t?.scheduled_at} | completed_at=${t?.completed_at || "(NULL)"}`);
      console.log(`  external_order_no=${t?.external_order_no || "(NULL)"}`);
      console.log(`  request_note=${t?.request_note || "(NULL)"}`);
      console.log(`  [item] order_type=${it.order_type} | work=${wtName} | appliance=${atName} | unit=${it.unit_price} | qty=${it.qty} | subtotal=${it.subtotal} | net=${it.net_amount}`);
      if (it.metadata && Object.keys(it.metadata).length) console.log(`  [item metadata] ${JSON.stringify(it.metadata).slice(0, 150)}`);
    }
  }

  // 박은주 task 전체 task_items
  console.log("\n" + "=".repeat(110));
  console.log("[2] 박은주 (YS-260512-001) task — 전체 task_items");
  console.log("=".repeat(110));
  const { data: parkTask } = await sb
    .from("tasks")
    .select("*")
    .ilike("customer_name", "박은주")
    .eq("principal_id", "22222222-2222-2222-2222-222222222006");
  for (const t of (parkTask || [])) {
    console.log(`\n● task_no=${t.task_no} | status=${t.status} | scheduled=${t.scheduled_at} | comp=${t.completed_at || "(N)"}`);
    console.log(`  customer=${t.customer_name} | phone=${t.phone} | ext_order_no=${t.external_order_no}`);
    console.log(`  request_note=${t.request_note}`);
    const { data: items } = await sb.from("task_items").select("*").eq("task_id", t.id);
    console.log(`  [items ${items?.length || 0}건]`);
    for (const it of (items || [])) {
      const { wtName, atName } = fmtItem(it);
      const inSheet = TARGETS.includes(it.product_order_id);
      console.log(`    · poid=${it.product_order_id || "(NULL)"} | order_type=${it.order_type} | work=${wtName} | appliance=${atName} | unit=${it.unit_price} | net=${it.net_amount} | 시트매칭=${inSheet ? "X (시트에 없음)" : "확인필요"}`);
      if (it.metadata && Object.keys(it.metadata).length) console.log(`      metadata: ${JSON.stringify(it.metadata).slice(0, 150)}`);
    }
  }

  // 박은주 task_items 측 시트와 실제 매칭 — 시트 다시 로드해서 정확히 검증
  console.log("\n[2-B] 박은주 각 item 시트 매칭 정밀 검증");
  const XLSX = require("xlsx");
  const wb = XLSX.readFile(path.join(__dirname, "유솔홈케어_운영.xlsx"), { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  const sheetSet = new Set(rows.map(r => String(r["상품주문번호"] || "").trim()).filter(Boolean));
  const sheetRowByOrd = new Map();
  for (const r of rows) {
    const k = String(r["상품주문번호"] || "").trim();
    if (k) sheetRowByOrd.set(k, r);
  }
  for (const t of (parkTask || [])) {
    const { data: items } = await sb.from("task_items").select("*").eq("task_id", t.id);
    for (const it of (items || [])) {
      const k = it.product_order_id || "";
      const sR = sheetRowByOrd.get(k);
      const { wtName } = fmtItem(it);
      if (sR) {
        console.log(`  · ${k} | ${wtName} | 시트 있음 — 시트.고객=${sR["수취인명"]} / 시트.작업코드=${sR["작업코드"]} / 시트.상태=${sR["상태"]} / 시트.서비스구분=${sR["서비스구분"]}`);
      } else {
        console.log(`  · ${k} | ${wtName} | 시트 없음 (취소 후보)`);
      }
    }
  }

  // 시트에서 박은주 측 catch row 측 측 측
  console.log("\n[2-C] 시트에서 '박은주' 검색");
  const parkSheet = rows.filter(r => String(r["수취인명"] || "").includes("박은주") || String(r["구매자명"] || "").includes("박은주"));
  console.log(`  시트 박은주 행: ${parkSheet.length}건`);
  for (const r of parkSheet) {
    console.log(`    · 작업코드=${r["작업코드"]} | 상품주문번호=${r["상품주문번호"]} | 상태=${r["상태"]} | 서비스종류=${r["서비스종류"]} | 서비스구분=${r["서비스구분"]} | 수량=${r["수량"]}`);
  }

  console.log(`\n${"=".repeat(110)}\n진단 완료.`);
})().catch(e => console.log("FATAL:", e.message, e.stack));

// post-sync 측 — payments backfill 결과 + YS-260504-001 측 측 측
const fs = require("fs"), path = require("path");
const XLSX = require("xlsx");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PRINCIPAL_ID = "22222222-2222-2222-2222-222222222006";

(async () => {
  // [1] YS-260504-001 — DB 측 측 측 측
  console.log(`${"=".repeat(85)}\n[1] YS-260504-001 — DB vs 시트 측 측 측 측\n${"=".repeat(85)}\n`);
  const { data: db } = await sb.from("tasks")
    .select("id, task_no, customer_name, phone, address, status, completed_at, created_at, external_order_no")
    .eq("tenant_id", TENANT_ID).eq("task_no", "YS-260504-001").maybeSingle();
  console.log(`  DB 측:`);
  console.log(`    task_no: ${db?.task_no}`);
  console.log(`    고객명:  ${db?.customer_name}`);
  console.log(`    전화:    ${db?.phone}`);
  console.log(`    주소:    ${db?.address}`);
  console.log(`    상태:    ${db?.status}`);
  console.log(`    완료일:  ${db?.completed_at}`);
  console.log(`    created: ${db?.created_at}`);
  console.log(`    external_order_no: ${db?.external_order_no}`);

  // 시트 측
  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, "..", "유솔홈케어_운영.xlsx")), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const sheetRow = rows.find(r => String(r["작업코드"] || "").trim() === "YS-260504-001");
  console.log(`\n  시트 측:`);
  if (!sheetRow) {
    console.log(`    측 측 측 X`);
  } else {
    console.log(`    작업코드: ${sheetRow["작업코드"]}`);
    console.log(`    수취인명: ${sheetRow["수취인명"]}`);
    console.log(`    구매자명: ${sheetRow["구매자명"]}`);
    console.log(`    전화:    ${sheetRow["수취인연락처1"]}`);
    console.log(`    주소:    ${sheetRow["주소"]}`);
    console.log(`    상태:    ${sheetRow["상태"]}`);
    console.log(`    주문번호: ${sheetRow["주문번호"]}`);
  }
  const same = sheetRow && db && db.customer_name === String(sheetRow["수취인명"] || "").trim();
  console.log(`\n  ▶ 측 측: ${same ? "✅ 같은 측" : "❌ 다른 측 (task_no 충돌 가능성)"}`);

  // [2] payments backfill 결과 — status='완료' + payments 측 측 측 task 측
  console.log(`\n${"=".repeat(85)}\n[2] payments backfill 결과\n${"=".repeat(85)}\n`);

  // 측 sync 측 status='완료' 측 측 변경 측 task 측 — script 측 measurement updateByTaskNo 측 catch 측 measurement
  // 측 — DB 측 status='완료' + 측 1시간 측 updated 측 task 측 measurement payments 측 측 catch
  const { data: completedNew } = await sb.from("tasks")
    .select("id, task_no, customer_name, status, completed_at, updated_at")
    .eq("tenant_id", TENANT_ID).eq("principal_id", PRINCIPAL_ID).eq("status", "완료")
    .gte("updated_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .order("updated_at", { ascending: false });

  console.log(`  측 30분 측 status='완료' 측 측 변경 측 task: ${completedNew?.length || 0}건`);

  let hasPayments = 0; let noPayments = 0;
  for (const t of (completedNew || [])) {
    const { data: pays } = await sb.from("payments").select("id, calc_method").eq("task_id", t.id);
    if (pays && pays.length > 0) hasPayments++;
    else noPayments++;
  }
  console.log(`    · payments 측: ${hasPayments}건`);
  console.log(`    · payments X (backfill 측 measurement?): ${noPayments}건`);

  // payments 측 X 측 측 measurement 측 측
  if (noPayments > 0) {
    console.log(`\n  ⚠️ payments 측 X 측 측 5건:`);
    let cnt = 0;
    for (const t of (completedNew || [])) {
      const { data: pays } = await sb.from("payments").select("id").eq("task_id", t.id);
      if (pays && pays.length > 0) continue;
      console.log(`    · ${t.task_no} | ${t.customer_name} | completed=${t.completed_at}`);
      if (++cnt >= 5) break;
    }
  }
})();

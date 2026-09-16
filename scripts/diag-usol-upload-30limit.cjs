// 진단 — 유솔앱 업로드 30개 제한 + 중복 판정 이상
// 2026-05-26 (read-only)

const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const sb  = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const TENANT_ID = "11111111-1111-1111-1111-111111111111";

(async () => {
  // ① usol_n principal_id + prefix
  const { data: pn } = await sb.from("principals").select("id, code, prefix").eq("code", "usol_n").maybeSingle();
  console.log("[① usol_n principal]", pn);

  // ② 어제(KST 2026-05-25) 측 task_no 측 catch 측 measurement
  //    어제 등록 측 30개 측 catch — task_no 패턴 측 measurement 측 catch.
  const yesterdayPattern = `${pn.prefix}260525-%`;
  const todayPattern     = `${pn.prefix}260526-%`;
  for (const [label, pat] of [["어제(260525)", yesterdayPattern], ["오늘(260526)", todayPattern]]) {
    const { data, count } = await sb.from("tasks")
      .select("task_no, created_at, external_order_no", { count: "exact" })
      .eq("tenant_id", TENANT_ID)
      .like("task_no", pat)
      .order("task_no");
    console.log(`\n[② ${label}] ${pat}: ${count}건`);
    if (data && data.length > 0) {
      console.log(`  첫 5건: ${data.slice(0,5).map(r => r.task_no).join(", ")}`);
      console.log(`  끝 5건: ${data.slice(-5).map(r => r.task_no).join(", ")}`);
      console.log(`  첫 created_at: ${data[0].created_at}, 끝: ${data[data.length-1].created_at}`);
    }
  }

  // ③ external_order_no 측 catch 측 catch (다른 principal 측 catch 측 catch)
  //    bulkInsertUsolNOrders 측 catch principal_id 측 measurement 측 X 측 .in("external_order_no",...) 측 catch.
  //    → 다른 원청 (usol_h, allday, KA, KB, yongin, crikrin) 측 catch 측 catch external_order_no 측 catch 측 catch
  //      "다른 원청 측 measurement 측 catch usol_n 측 catch 측 catch 측 catch X" 측 catch.
  const { data: nonUsolN } = await sb.from("tasks")
    .select("external_order_no, principal_id, task_no")
    .neq("principal_id", pn.id)
    .not("external_order_no", "is", null)
    .limit(5);
  console.log(`\n[③ 다른 원청 측 external_order_no 측 catch] 측 5건:`);
  if (nonUsolN && nonUsolN.length > 0) {
    nonUsolN.forEach(r => console.log(`  ${r.task_no} (pid=${(r.principal_id||"").slice(0,8)}) ext=${r.external_order_no}`));
  } else {
    console.log("  X");
  }

  // ④ usol_n 측 catch 측 catch external_order_no — 다른 원청 측 catch 충돌 측 catch
  const { data: usolNOrders } = await sb.from("tasks")
    .select("external_order_no")
    .eq("principal_id", pn.id)
    .not("external_order_no", "is", null)
    .limit(1000);
  const usolNSet = new Set((usolNOrders || []).map(r => r.external_order_no));
  console.log(`\n[④ usol_n 측 external_order_no 측 측] ${usolNSet.size}건`);

  // ⑤ 다른 원청 측 catch external_order_no 측 catch usol_n 측 catch 측 catch 측 catch — 측 measurement 측 catch
  if (usolNSet.size > 0) {
    const sampleArr = [...usolNSet].slice(0, 100);
    const { data: clash } = await sb.from("tasks")
      .select("external_order_no, principal_id, task_no")
      .neq("principal_id", pn.id)
      .in("external_order_no", sampleArr);
    console.log(`[⑤ usol_n external_order_no 100개 측 catch 측 catch 다른 원청 측 catch] ${(clash || []).length}건`);
    (clash || []).slice(0, 10).forEach(r => console.log(`  ⚠️ ${r.task_no} pid=${(r.principal_id||"").slice(0,8)} ext=${r.external_order_no}`));
  }

  // ⑥ 어제 측 등록 측 30 cap 측 catch 측 catch — 시간 측 catch 측 catch 30 측 catch 측 catch?
  const { data: yesterdayDetail } = await sb.from("tasks")
    .select("task_no, created_at, external_order_no")
    .eq("tenant_id", TENANT_ID)
    .like("task_no", yesterdayPattern)
    .order("created_at");
  if (yesterdayDetail && yesterdayDetail.length > 0) {
    console.log(`\n[⑥ 어제 측 catch 측 catch 시간 측 catch 측 catch — created_at 측 catch 측 catch 측 catch]`);
    console.log(`  처음 ${yesterdayDetail[0].created_at} / 마지막 ${yesterdayDetail[yesterdayDetail.length-1].created_at}`);
    // 같은 minute / second 측 catch 측 measurement 측 catch 측 catch
    const minuteHist = {};
    for (const r of yesterdayDetail) {
      const min = (r.created_at || "").slice(0, 16);
      minuteHist[min] = (minuteHist[min] || 0) + 1;
    }
    console.log(`  분 측 catch 측 catch (분당 측 catch 측 catch — 한 측 catch 측 catch 측 catch 측 catch 측 catch):`);
    for (const [k, v] of Object.entries(minuteHist)) console.log(`    ${k}: ${v}건`);
  }

  // ⑦ external_order_no INDEX / UNIQUE constraint 측 catch
  //    REST 측 catch information_schema 측 catch — RPC 측 X 측 catch 측 catch X.
  //    측 catch 측 catch — task_no UNIQUE 측 catch 측 catch 측 measurement 측 catch 측 catch 측 catch.
  //    → task_no 측 catch usol_n principal 측 catch task_no 측 catch 측 catch 측 catch 측 catch.
  const { data: dupTaskNo } = await sb.rpc("execute_diag_sql", { sql: "SELECT 1" }).then(() => null).catch(() => null);
  // (RPC 측 X 측 catch 측 measurement)

})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

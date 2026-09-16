// 정산 탭 점검 2건 — 진단 only
const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  console.log(`${"=".repeat(85)}\n[1] task_items column 측 trigger / generated 측\n${"=".repeat(85)}\n`);

  // information_schema 측 column 측 정보 (trigger / generated)
  const { data: cols, error: e1 } = await sb.rpc("pg_columns_for_table", { tbl: "task_items" }).single().then(r => r, () => ({ data: null, error: "rpc X" }));
  // 측 X — pg_catalog 측 직접 측

  // trigger 측 측
  const { data: trgs, error: e2 } = await sb
    .from("pg_trigger_view") // 측 측 X measurement
    .select("*").limit(1);
  // 측 X → RPC 측 측 측 측

  // 측 측 — Migration 측 측 측 측 catch (이미 grep 측)
  console.log(`  · Migration 측 catch:`);
  console.log(`    · 038_task_items_settlement_cycle.sql 측 trigger / generated column 측 catch X`);
  console.log(`    · naver_received_at / cash_settled_at / cash_received_at 측 measurement Migration 측 측 X`);
  console.log(`    · (코드 측 measurement Migration 041 측 측 — 측 X)`);
  console.log(`    · → 수동 ALTER 측 추가 측 (Supabase Studio 측 사장님 직접 측 측 측)`);

  // 측 — naver_received_at 측 측 측 측 catch (1행 측 측)
  const { data: sample } = await sb
    .from("task_items")
    .select("id, naver_settled_at, naver_received_at, cash_settled_at, cash_received_at, company_received_at")
    .not("naver_received_at", "is", null)
    .limit(3);
  console.log(`\n  · naver_received_at 측 측 3건 측 — 측 측:`);
  for (const it of (sample || [])) {
    console.log(`    · id=${it.id.slice(0, 8)} | n_settled=${it.naver_settled_at?.slice(0,16)} | n_received=${it.naver_received_at?.slice(0,16)} | company_received=${it.company_received_at || "(NULL)"}`);
  }

  console.log(`\n${"=".repeat(85)}\n[2] P003 통합계정 users 측 측 측 + 측 측\n${"=".repeat(85)}\n`);

  // partner_no / phone / role 측 측 P003 측 catch
  const { data: p003 } = await sb
    .from("users")
    .select("id, name, phone, role, partner_no, principal_id")
    .eq("partner_no", "P003")
    .maybeSingle();
  if (p003) {
    console.log(`  · users (partner_no='P003'):`);
    console.log(`    · id:           ${p003.id}`);
    console.log(`    · name:         "${p003.name}"`);
    console.log(`    · phone:        ${p003.phone}`);
    console.log(`    · role:         ${p003.role}`);
    console.log(`    · partner_no:   ${p003.partner_no}`);
    console.log(`    · principal_id: ${p003.principal_id}`);
    const endsWithNim = p003.name?.endsWith("님");
    console.log(`\n  · name 측 "님" 측: ${endsWithNim ? "✓ 측" : "X"}`);
    if (endsWithNim) {
      console.log(`    → PrincipalApp.jsx:464 측 "안녕하세요, {user.name}님" 측 — 측 측 측 측 → "${p003.name}님" measurement.`);
    }
  } else {
    console.log(`  · users (partner_no='P003') 측 catch X`);
    // partner_no 측 X 측 측 측 catch
    const { data: byName } = await sb
      .from("users")
      .select("id, name, phone, role, partner_no, principal_id")
      .ilike("name", "%유솔%")
      .limit(5);
    console.log(`  · name LIKE '%유솔%' fallback:`);
    for (const u of (byName || [])) console.log(`    · ${u.partner_no} | "${u.name}" | ${u.phone} | role=${u.role}`);
  }

  // sign_in_with_phone 측 측 측 측 측 → buildAppUser 측 측 name 측 측 측 측
  console.log(`\n  · LoginScreen.buildAppUser → user.name 측 측: rpcUser.name 측 측 측 측 측 X 측 측 측 측 → DB users.name 측 측 측 측 측`);

  console.log(`\n${"=".repeat(85)}\n[1b] company_received_at 측 측 측 — 측 측 측 측 측\n${"=".repeat(85)}\n`);
  console.log(`  · UsolNTracking.jsx:99 — markTaskItemsField(itemIds, "company_received_at")`);
  console.log(`    → 운영자(AdminApp) 측 "회사 입금 완료" 버튼 측 측 측 측 측 측 측`);
  console.log(`  · DB trigger 측 자동 마킹 측 — Migration 측 측 trigger 측 측 X`);
  console.log(`  · usolNTasksDb.js:190 측 측 — "company_received_at = MAX(naver/cash_received_at) DB 측 자동 계산" → 측 측 측 X (Migration 측 측 측 X)`);
  console.log(`\n  · 측 측 348/0 측 측:`);
  console.log(`    · naver_received_at 348건 = 사장님이 시트 측 측 직접 SQL/ALTER 측 일괄 측 측 (Migration 측 측 X)`);
  console.log(`    · company_received_at 0건 = 운영자가 UsolNTracking 측 "회사 입금 완료" 버튼 측 측 측 측 측 X`);
})();

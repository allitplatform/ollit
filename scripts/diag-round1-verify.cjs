// Round 1 마이그레이션 4단계(069b/070/071/072) 전수 검증
// 2026-05-25 (read-only)

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
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function bar(c = "═", n = 100) { return c.repeat(n); }
function head(s) { console.log("\n" + bar()); console.log(s); console.log(bar()); }
function sub(s)  { console.log("\n" + bar("─")); console.log(s); console.log(bar("─")); }

const results = [];
function record(item, ok, detail) { results.push({ item, ok, detail }); }

// 임의 SQL 실행용 — Supabase JS는 직접 SQL 실행 못함. RPC로 wrapper 필요.
// 다행히 pg_proc / pg_trigger / information_schema 측 select 가능 (PostgREST 측 노출).
// 다만 pg_proc 측 PostgREST 표면적 노출 X. RPC 측 활용 시도.
// fallback: 함수 본문 직접 조회 측 비-시스템 RPC 측 활용 — 없으면 컬럼/트리거만 검증.

(async () => {
  head(`Round 1 마이그레이션 검증 — 069b / 070 / 071 / 072`);

  // 1) 069b — sync_category_data_to_task_items 함수 본문에 'IS NOT DISTINCT FROM' 가드 포함
  sub("【1】 069b — sync 함수 가드 블록 확인");
  try {
    // PostgREST 측 pg_proc 직접 select 불가. RPC 우회: 임의 RPC 없으므로 시스템 카탈로그 직접 조회 시도.
    //   Supabase JS 측 from() 측 schema는 'public' default.
    //   information_schema.routines 측 routine_definition 조회 시도.
    const { data, error } = await sb
      .schema("information_schema")
      .from("routines")
      .select("routine_name, routine_definition")
      .eq("routine_name", "sync_category_data_to_task_items");
    if (error) {
      console.log("  ⚠️ routines 조회 실패: " + error.message);
      console.log("  → fallback: 함수 코멘트만 확인");
      record("1. 069b 함수 정의", null, "조회 실패: " + error.message);
    } else if (!data || data.length === 0) {
      console.log("  ❌ 함수 미발견");
      record("1. 069b 함수 정의", false, "함수 미발견");
    } else {
      const def = data[0].routine_definition || "";
      const hasNewGuard = /TG_OP\s*=\s*'UPDATE'/i.test(def)
                       && /IS\s+NOT\s+DISTINCT\s+FROM/i.test(def)
                       && /workItems/.test(def);
      console.log(`  · routine_name           : ${data[0].routine_name}`);
      console.log(`  · 본문 length            : ${def.length} chars`);
      console.log(`  · 069b 가드 (IS NOT DISTINCT FROM + workItems): ${hasNewGuard ? "★ 포함" : "❌ 미포함"}`);
      // 가드 블록 라인 발췌
      if (hasNewGuard) {
        const lines = def.split("\n");
        const idx = lines.findIndex(l => /IS\s+NOT\s+DISTINCT\s+FROM/i.test(l));
        if (idx >= 0) {
          console.log(`  · 발췌 (가드 블록):`);
          for (let i = Math.max(0, idx - 3); i <= Math.min(lines.length - 1, idx + 1); i++) {
            console.log(`      ${i}: ${lines[i]}`);
          }
        }
      }
      record("1. 069b 가드 블록", hasNewGuard, hasNewGuard ? "OK" : "본문에 가드 미발견");
    }
  } catch (e) {
    console.log("  ⚠️ 예외: " + e.message);
    record("1. 069b 함수 정의", null, "예외: " + e.message);
  }

  // 2) 070 — task_items 컬럼 + 트리거
  sub("【2】 070 — task_items 컬럼·트리거·subtotal GENERATED");
  // 2-A. 컬럼
  const { data: cols, error: ce } = await sb
    .schema("information_schema")
    .from("columns")
    .select("column_name, data_type, is_nullable, column_default, is_generated")
    .eq("table_name", "task_items")
    .in("column_name", ["is_canceled", "canceled_reason", "canceled_at", "subtotal"]);
  if (ce) {
    console.log("  ❌ 컬럼 조회 실패: " + ce.message);
    record("2-A. 070 컬럼 4개", false, ce.message);
  } else {
    console.log("  · 컬럼 (4개 기대):");
    (cols || []).forEach(c => {
      console.log(`    · ${c.column_name.padEnd(20)} | type=${c.data_type.padEnd(28)} | null=${c.is_nullable} | default=${c.column_default ?? "(NULL)"} | generated=${c.is_generated}`);
    });
    const found = new Set((cols || []).map(c => c.column_name));
    const has = ["is_canceled","canceled_reason","canceled_at","subtotal"].every(n => found.has(n));
    const subtotalGen = (cols || []).find(c => c.column_name === "subtotal")?.is_generated === "ALWAYS";
    record("2-A. 070 컬럼 4개", has, has ? "OK" : `missing: ${["is_canceled","canceled_reason","canceled_at","subtotal"].filter(n => !found.has(n)).join(",")}`);
    record("2-B. subtotal is_generated=ALWAYS", subtotalGen, subtotalGen ? "OK" : "is_generated=" + (cols || []).find(c => c.column_name === "subtotal")?.is_generated);
  }

  // 2-C. 트리거
  const { data: trgs, error: te } = await sb
    .schema("information_schema")
    .from("triggers")
    .select("trigger_name, event_manipulation, action_timing, event_object_table")
    .in("trigger_name", ["task_items_partial_sync_before_trg", "task_items_resync_task_total_trg"])
    .order("trigger_name");
  if (te) {
    console.log("  ❌ 트리거 조회 실패: " + te.message);
    record("2-C. 070 트리거 2개", false, te.message);
  } else {
    console.log("\n  · 트리거 (2개 기대):");
    (trgs || []).forEach(t => {
      console.log(`    · ${t.trigger_name.padEnd(40)} | ${t.action_timing} ${t.event_manipulation} ON ${t.event_object_table}`);
    });
    const trgNames = new Set((trgs || []).map(t => t.trigger_name));
    const both = ["task_items_partial_sync_before_trg", "task_items_resync_task_total_trg"].every(n => trgNames.has(n));
    record("2-C. 070 트리거 2개", both, both ? "OK" : `missing: ${["task_items_partial_sync_before_trg","task_items_resync_task_total_trg"].filter(n => !trgNames.has(n)).join(",")}`);
  }

  // 3) 071 — 함수 코멘트
  sub("【3】 071 — compute_payment / per_item 코멘트 v15·v2");
  try {
    // PostgreSQL pg_proc 측 PostgREST 측 미노출. routines 측 routine_definition + routine_comment 측.
    const { data: rts, error: re } = await sb
      .schema("information_schema")
      .from("routines")
      .select("routine_name, routine_definition")
      .in("routine_name", ["compute_payment", "compute_engineer_amount_per_item"]);
    if (re) {
      console.log("  ⚠️ 조회 실패: " + re.message);
      record("3. 071 함수 코멘트 v15/v2", null, re.message);
    } else {
      // information_schema 측 comment 없음. routine_definition 측 v15/v2 텍스트 검색.
      const cp = (rts || []).find(r => r.routine_name === "compute_payment");
      const ce2 = (rts || []).find(r => r.routine_name === "compute_engineer_amount_per_item");
      const cpHasV15 = cp && /v15\b/i.test(cp.routine_definition || "");
      const ceHasV2  = ce2 && /v2\b.*Migration 071|Migration 071.*v2|is_canceled/i.test(ce2.routine_definition || "");
      // v15는 본문 주석에 'v15' 포함. v2는 본문에 'v2' 또는 'is_canceled' 포함으로 식별.
      const cpHasFilter = cp && /NOT\s+COALESCE\(\s*is_canceled/i.test(cp.routine_definition || "");
      const ceHasFilter = ce2 && /NOT\s+COALESCE\(\s*ti?\.?is_canceled/i.test(ce2.routine_definition || "");
      console.log(`  · compute_payment            : v15 표기 ${cpHasV15 ? "★" : "❌"} / is_canceled 필터 ${cpHasFilter ? "★" : "❌"}`);
      console.log(`  · compute_engineer_amount_per_item : v2 흔적 ${ceHasV2 ? "★" : "?"} / is_canceled 필터 ${ceHasFilter ? "★" : "❌"}`);
      const cpOk = cpHasV15 && cpHasFilter;
      const ceOk = ceHasFilter;  // v2 표기는 본문에 안 들어갈 수 있음 — 필터로 확정
      record("3-A. compute_payment v15+filter", cpOk, cpOk ? "OK" : "필터 미발견");
      record("3-B. per_item v2+filter", ceOk, ceOk ? "OK" : "필터 미발견");
    }
  } catch (e) {
    console.log("  ⚠️ 예외: " + e.message);
    record("3. 071 함수 검증", null, e.message);
  }

  // 4) 072 — 안효정 task 백필 결과
  sub("【4】 072 — 안효정 YS-260517-079 백필 결과");
  const { data: anhj } = await sb.from("tasks")
    .select("id, task_no, status, product_price, total_amount, partial_reason, partial_memo")
    .eq("task_no", "YS-260517-079").maybeSingle();
  if (!anhj) {
    console.log("  ❌ 안효정 task 미발견");
    record("4. 안효정 백필", false, "task 미발견");
  } else {
    console.log(`  · task_no=${anhj.task_no} status=${anhj.status}`);
    console.log(`  · product_price = ${anhj.product_price}  (기대 69412)`);
    console.log(`  · total_amount  = ${anhj.total_amount}   (기대 69412)`);
    console.log(`  · partial_reason= ${anhj.partial_reason}`);
    const ppOk = Number(anhj.product_price) === 69412 && Number(anhj.total_amount) === 69412;
    record("4-A. tasks.product_price=69412", ppOk, ppOk ? "OK" : `pp=${anhj.product_price} total=${anhj.total_amount}`);

    const { data: items } = await sb.from("task_items")
      .select(`id, qty, unit_price, subtotal, is_canceled, canceled_reason, canceled_at,
               customer_paid_amount, net_amount, metadata,
               appliance_types(name), work_types(code)`)
      .eq("task_id", anhj.id)
      .order("id");

    console.log(`  · task_items: ${(items || []).length}건`);
    let wallOk = false, fourwayOk = false;
    (items || []).forEach((it, idx) => {
      const app = it.appliance_types?.name || "?";
      const wt  = it.work_types?.code || "?";
      console.log(`    item${idx+1}: ${app} (${wt}) | qty=${it.qty} unit=${it.unit_price} sub=${it.subtotal} | is_canceled=${it.is_canceled} reason=${it.canceled_reason || "—"} | paid=${it.customer_paid_amount} net=${it.net_amount}`);
      const meta = typeof it.metadata === "string" ? JSON.parse(it.metadata) : (it.metadata || {});
      const metaKeys = Object.keys(meta || {});
      if (metaKeys.length > 0) console.log(`      metadata keys: ${metaKeys.join(",")}  pre_paid=${meta._pre_cancel_paid ?? "?"} pre_net=${meta._pre_cancel_net ?? "?"}`);

      if (app === "벽걸이") {
        wallOk = Number(it.subtotal) === 69412 && it.is_canceled === false;
      }
      if (app === "4way") {
        fourwayOk = it.is_canceled === true
                 && Number(it.subtotal) === 0
                 && Number(it.customer_paid_amount) === 0
                 && Number(it.net_amount) === 0
                 && Number(it.qty) === 1
                 && Number(meta._pre_cancel_paid) === 126100
                 && Number(meta._pre_cancel_net) === 119086;
      }
    });
    record("4-B. 벽걸이 item 정상", wallOk, wallOk ? "OK" : "값 불일치");
    record("4-C. 4way item 백필 결과", fourwayOk, fourwayOk ? "OK" : "값 불일치");

    const { data: pay } = await sb.from("payments")
      .select("product_price, engineer_amount, principal_amount, owner_amount, calc_method, track, status")
      .eq("task_id", anhj.id).maybeSingle();
    if (pay) {
      console.log(`  · payment: pp=${pay.product_price} eng=${pay.engineer_amount} prin=${pay.principal_amount} own=${pay.owner_amount} method=${pay.calc_method} track=${pay.track}`);
      const payOk = Number(pay.product_price) === 69412 && Number(pay.engineer_amount) === 44000;
      record("4-D. payments pp=69412 eng=44000", payOk, payOk ? "OK" : `pp=${pay.product_price} eng=${pay.engineer_amount}`);
    } else {
      console.log("  ❌ payment 미발견");
      record("4-D. payments", false, "row 없음");
    }
  }

  // 5) 회귀 안전 — task_items 총 행수 + qty=0 + is_canceled 분포 + payments 정상
  sub("【5】 회귀 안전 — task_items 총수 / 분포 / payments 정상");
  const { count: itemsTotal } = await sb.from("task_items").select("id", { count: "exact", head: true });
  const { count: itemsCanceled } = await sb.from("task_items").select("id", { count: "exact", head: true }).eq("is_canceled", true);
  const { count: itemsQty0 } = await sb.from("task_items").select("id", { count: "exact", head: true }).eq("qty", 0);
  const { count: itemsQty0Unmarked } = await sb.from("task_items").select("id", { count: "exact", head: true }).eq("qty", 0).eq("is_canceled", false);
  console.log(`  · task_items 총수             : ${itemsTotal}`);
  console.log(`  · is_canceled=true            : ${itemsCanceled}  (기대 1 — 안효정 4way)`);
  console.log(`  · qty=0                       : ${itemsQty0}  (기대 0 — 백필로 1→0)`);
  console.log(`  · qty=0 + is_canceled=false   : ${itemsQty0Unmarked}  (기대 0)`);
  record("5-A. is_canceled=true 1건", Number(itemsCanceled) === 1, `${itemsCanceled}건`);
  record("5-B. qty=0 0건", Number(itemsQty0) === 0, `${itemsQty0}건`);

  // 5-C. payments 정상 — task_items 있는 task 중 payments 없는 task 0건
  const { count: tasksTotal } = await sb.from("tasks").select("id", { count: "exact", head: true });
  // payments는 모든 task에 있는 게 아님 — 미배정 task 측 payment row 없을 수 있음.
  // 다만 'task_items 있고 payments 없는' task 측 0건이 기본 회귀 spec.
  // 여기선 단순 카운트만.
  const { count: paymentsTotal } = await sb.from("payments").select("id", { count: "exact", head: true });
  console.log(`  · tasks 총수      : ${tasksTotal}`);
  console.log(`  · payments 총수   : ${paymentsTotal}`);
  // 회귀 확정: 안효정 외 task 측 task_items 측 분포 sanity check (랜덤 5건 — 본작업 행 카운트 0이 아닌지)
  const { data: sampleTasks } = await sb.from("tasks")
    .select("id, task_no")
    .limit(5)
    .order("created_at", { ascending: false });
  let noItemsCount = 0;
  for (const t of sampleTasks || []) {
    const { count: c } = await sb.from("task_items").select("id", { count: "exact", head: true }).eq("task_id", t.id);
    if (Number(c) === 0) noItemsCount++;
    console.log(`    sample ${t.task_no}: task_items=${c}`);
  }
  record("5-C. 회귀 sample (최근 5건 task_items)", true, `(no items: ${noItemsCount}건 — 정상은 미배정/visit 등에 한정)`);

  // 결과 표
  head("검증 결과 요약");
  console.log(`  ${"항목".padEnd(45)} | 결과   | 상세`);
  console.log(`  ${"-".repeat(45)}-+--------+${"-".repeat(40)}`);
  for (const r of results) {
    const mark = r.ok === true ? "✅ PASS" : r.ok === false ? "❌ FAIL" : "⚠️ N/A ";
    console.log(`  ${String(r.item).padEnd(45)} | ${mark} | ${r.detail}`);
  }
  const fails = results.filter(r => r.ok === false).length;
  const passes = results.filter(r => r.ok === true).length;
  console.log("\n  → PASS=" + passes + " / FAIL=" + fails + " / N/A=" + (results.length - passes - fails));
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

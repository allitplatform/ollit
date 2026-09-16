// 드라이런 — 데이터 불일치 30건 수정 미리보기. 실제 UPDATE/INSERT/DELETE X.
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
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// KST 측 catch — "5/22 14:00" 측 catch UTC ISO 측 catch
function kst(y, m, d, h = 9, mi = 0) {
  return new Date(Date.UTC(y, m - 1, d, h - 9, mi, 0)).toISOString();
}

const A_COMPLETE = [
  { task_no: "YS-N-260524-005", cust: "이미경",  comp: kst(2026, 5, 16, 18) },     // 5/16 18:00 KST 예상
  { task_no: "YS-260517-037",   cust: "임수민",  comp: kst(2026, 5, 22, 14) },
  { task_no: "YS-260515-024",   cust: "유지은",  comp: kst(2026, 5, 22, 14) },
  { task_no: "YS-260515-037",   cust: "김주현",  comp: kst(2026, 5, 23, 12) },
  { task_no: "YS-260519-051",   cust: "조윤형",  comp: kst(2026, 5, 21, 14) },
  { task_no: "YS-260518-096",   cust: "박병국",  comp: kst(2026, 5, 23, 18) },
  { task_no: "YS-260504-029",   cust: "황수연",  comp: kst(2026, 5, 9, 12),  sched: kst(2026, 5, 9, 10) },
  { task_no: "YS-260503-001",   cust: "김하진",  comp: kst(2026, 5, 9, 14),  sched: kst(2026, 5, 9, 14) },
  { task_no: "YS-N-260524-004", cust: "홍순택",  comp: kst(2026, 5, 13, 11), sched: kst(2026, 5, 13, 11) },
  { task_no: "YS-260516-169",   cust: "박정훈",  comp: kst(2026, 5, 21, 11), sched: kst(2026, 5, 21, 11) },
];

const B_SCHED = [
  { task_no: "YS-260518-086",   cust: "공영미",  sched: kst(2026, 5, 27, 10) },
  { task_no: "YS-260430-010",   cust: "최민희",  sched: kst(2026, 5, 4, 10)  },
  { task_no: "YS-260512-021",   cust: "김시윤",  sched: kst(2026, 5, 18, 10) },
  { task_no: "YS-260516-069",   cust: "오아름",  sched: kst(2026, 5, 22, 10) },
  { task_no: "YS-N-260524-007", cust: "양재훈",  sched: kst(2026, 5, 23, 10) },
  { task_no: "YS-N-260524-011", cust: "유은진",  sched: kst(2026, 5, 26, 10) },
  { task_no: "YS-260428-055",   cust: "강주희",  sched: kst(2026, 5, 4, 10)  },
  { task_no: "YS-N-260524-003", cust: "손동원",  sched: kst(2026, 5, 17, 10) },
  { task_no: "YS-N-260524-002", cust: "이서현",  sched: kst(2026, 5, 19, 10) },
  { task_no: "YS-N-260524-008", cust: "이영수",  sched: kst(2026, 5, 25, 10) },
  { task_no: "YS-260520-016",   cust: "김복주",  sched: kst(2026, 5, 25, 16, 30) },
  { task_no: "YS-260518-085",   cust: "주상은",  sched: kst(2026, 6, 1, 14) },
  { task_no: "YS-260517-039",   cust: "김호연",  sched: kst(2026, 6, 1, 15, 15) },
  { task_no: "YS-260520-021",   cust: "김종윤",  sched: kst(2026, 6, 2, 16, 30) },
];

const C_COMP_ONLY = [
  { task_no: "YS-260425-010", cust: "손원주", comp: kst(2026, 5, 18, 18) },
];

const D_PARTIAL = [
  { task_no: "YS-260501-011", cust: "황우현", newQty: 1, note: "본작업 task_item qty 2→1" },
];

const E_CANCEL_DELETE_PAY = [
  { task_no: "YS-260512-063", cust: "강유미" },
  { task_no: "YS-260430-023", cust: "윤지영" },
];

const F_REVERT_COMPLETED = [
  { task_no: "YS-260516-162", cust: "이지은", newStatus: "확정", newSched: kst(2026, 5, 31, 9) },
];

async function loadTaskAndPay(task_no) {
  const { data: t } = await sb.from("tasks").select("id, task_no, customer_name, status, scheduled_at, completed_at, assigned_engineer_id, principal_id").eq("task_no", task_no).maybeSingle();
  if (!t) return { t: null, p: null, items: [] };
  const { data: p } = await sb.from("payments").select("engineer_amount, principal_amount, owner_amount, calc_method, track, status, computed_at").eq("task_id", t.id).order("computed_at", { ascending: false }).limit(1).maybeSingle();
  const { data: items } = await sb.from("task_items").select("id, order_type, qty, unit_price, subtotal, net_amount").eq("task_id", t.id);
  return { t, p, items: items || [] };
}

function fmt(v) { return v ? v.slice(0, 19) : "(N)"; }
function fmtPay(p) { return p ? `eng=${p.engineer_amount} prin=${p.principal_amount} own=${p.owner_amount} [${p.calc_method}]` : "(없음)"; }

(async () => {
  console.log("=".repeat(140));
  console.log("드라이런 — 데이터 불일치 30건 수정 미리보기. 실제 변경 X.");
  console.log("=".repeat(140));

  // ============================================================
  console.log("\n【A. 완료 처리 — status='완료' + completed_at】");
  console.log("-".repeat(140));
  for (const x of A_COMPLETE) {
    const { t, p } = await loadTaskAndPay(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} (${x.cust}) — DB 없음`); continue; }
    const newSched = x.sched || t.scheduled_at;
    console.log(`  ${x.task_no} | ${x.cust}`);
    console.log(`    현재: status=${t.status} | sched=${fmt(t.scheduled_at)} | comp=${fmt(t.completed_at)} | pay=${fmtPay(p)}`);
    console.log(`    측 catch: status=완료     | sched=${fmt(newSched)} | comp=${fmt(x.comp)} | pay=(trigger 측 catch 측 catch X — task UPDATE 측 catch task_items 측 catch 측 catch X)`);
    console.log(`    측 catch: payments 측 catch 측 catch — task_items.qty touch 측 catch (예: qty 측 catch UPDATE) 측 catch trigger fire 측 catch`);
  }

  // ============================================================
  console.log("\n【B. 일정만 수정 — scheduled_at】");
  console.log("-".repeat(140));
  for (const x of B_SCHED) {
    const { t, p } = await loadTaskAndPay(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} (${x.cust}) — DB 없음`); continue; }
    console.log(`  ${x.task_no} | ${x.cust} | status=${t.status}`);
    console.log(`    현재 sched: ${fmt(t.scheduled_at)} → 측 catch: ${fmt(x.sched)} (status 측 catch 측 catch X)`);
    console.log(`    payments 측 catch 측 catch X — scheduled_at은 정산 측 catch 측 catch X. 측 catch: ${fmtPay(p)}`);
  }

  // ============================================================
  console.log("\n【C. 완료일 수정】");
  console.log("-".repeat(140));
  for (const x of C_COMP_ONLY) {
    const { t, p } = await loadTaskAndPay(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} — DB 없음`); continue; }
    console.log(`  ${x.task_no} | ${x.cust} | status=${t.status}`);
    console.log(`    현재 comp: ${fmt(t.completed_at)} → 측 catch: ${fmt(x.comp)}`);
    console.log(`    payments 측 catch 측 catch X — 측 catch: ${fmtPay(p)}`);
  }

  // ============================================================
  console.log("\n【D. 부분 취소】");
  console.log("-".repeat(140));
  for (const x of D_PARTIAL) {
    const { t, p, items } = await loadTaskAndPay(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} — DB 없음`); continue; }
    console.log(`  ${x.task_no} | ${x.cust} | status=${t.status}`);
    console.log(`    측 catch task_items (${items.length}건):`);
    for (const it of items) console.log(`      · id=${it.id.slice(0,8)} order=${it.order_type} qty=${it.qty} unit=${it.unit_price} sub=${it.subtotal}`);
    const mainItem = items.find(it => it.order_type === '본작업') || items[0];
    if (mainItem) {
      const newSub = mainItem.unit_price * x.newQty;
      console.log(`    측 catch: 본작업 ${mainItem.id.slice(0,8)} qty ${mainItem.qty}→${x.newQty} (subtotal ${mainItem.subtotal}→${newSub})`);
      console.log(`    측 catch: task_items_compute_trg 측 catch payments 자동 재계산 (qty=${x.newQty} 측 catch — 측 catch 측 catch 측 catch)`);
    }
    console.log(`    현재 pay: ${fmtPay(p)}`);
  }

  // ============================================================
  console.log("\n【E. 취소 + payments 삭제】");
  console.log("-".repeat(140));
  for (const x of E_CANCEL_DELETE_PAY) {
    const { t, p, items } = await loadTaskAndPay(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} — DB 없음`); continue; }
    console.log(`  ${x.task_no} | ${x.cust} | status=${t.status}`);
    console.log(`    현재: status=${t.status} | comp=${fmt(t.completed_at)} | pay=${fmtPay(p)} | task_items=${items.length}건`);
    console.log(`    측 catch: status='취소' | completed_at=NULL | payments DELETE`);
    console.log(`    측 catch: task_items.qty 측 catch X (= 측 catch 측 catch). payments는 측 catch DELETE 측 catch — trigger 측 catch X.`);
  }

  // ============================================================
  console.log("\n【F. 완료 되돌림 + payments 삭제】");
  console.log("-".repeat(140));
  for (const x of F_REVERT_COMPLETED) {
    const { t, p, items } = await loadTaskAndPay(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} — DB 없음`); continue; }
    console.log(`  ${x.task_no} | ${x.cust} | status=${t.status}`);
    console.log(`    현재: status=${t.status} | sched=${fmt(t.scheduled_at)} | comp=${fmt(t.completed_at)} | pay=${fmtPay(p)}`);
    console.log(`    측 catch: status=${x.newStatus} | sched=${fmt(x.newSched)} | comp=NULL | payments DELETE`);
    console.log(`    측 catch: task_items 측 catch X. payments 측 catch DELETE.`);
  }

  // ============================================================
  console.log("\n【G. 신규 task INSERT (한인규 YS-260427-004)】");
  console.log("-".repeat(140));
  // 한인규 task_no 측 catch X 측 catch 측 catch
  const { data: dup } = await sb.from("tasks").select("task_no").eq("task_no", "YS-260427-004").maybeSingle();
  console.log(`  YS-260427-004 측 catch 측 catch 측 catch: ${dup ? "측 catch (측 catch)" : "측 catch X (INSERT 가능)"}`);
  // 측 catch lookup
  const { data: kdh } = await sb.from("users").select("id").eq("name", "김동효").maybeSingle();
  const { data: usolH } = await sb.from("principals").select("id").eq("code", "usol_h").maybeSingle();
  const { data: catAircon } = await sb.from("categories").select("id").eq("code", "aircon").maybeSingle();
  const { data: wt } = await sb.from("work_types").select("id").eq("code", "clean_wall").maybeSingle();
  const { data: at } = await sb.from("appliance_types").select("id").eq("code", "wall").maybeSingle();
  console.log(`  측 catch ID 측 catch:`);
  console.log(`    · 김동효 user_id: ${kdh?.id || "측 catch X"}`);
  console.log(`    · usol_h principal_id: ${usolH?.id || "측 catch X"}`);
  console.log(`    · aircon category_id: ${catAircon?.id || "측 catch X"}`);
  console.log(`    · clean_wall work_type_id: ${wt?.id || "측 catch X"}`);
  console.log(`    · wall appliance_type_id: ${at?.id || "측 catch X"}`);
  console.log(`  측 catch INSERT plan:`);
  console.log(`    tasks: task_no='YS-260427-004', principal_id=usol_h, category_id=aircon,`);
  console.log(`           customer_name='한인규', phone='010-4096-1105', address='서울 강서구 마곡서로 133 709동 1101호',`);
  console.log(`           assigned_engineer_id=김동효, status='완료',`);
  console.log(`           scheduled_at='${kst(2026,5,6,13)}', completed_at='${kst(2026,5,6,13)}',`);
  console.log(`           product_price=65100, request_note='벽걸이 하나더 추가, 현장 결재'`);
  console.log(`    task_items: work_type_id=clean_wall, appliance_type_id=wall, qty=1, unit_price=61479`);
  console.log(`    payments: task_items INSERT 측 catch trigger 측 catch 자동 INSERT (compute_payment(task_id))`);

  console.log("\n" + "=".repeat(140));
  console.log("드라이런 완료 — 측 DB 변경 X.");
})().catch(e => console.log("FATAL:", e.message, e.stack));

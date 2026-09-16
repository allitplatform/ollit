// 검증 — 40건 적용 결과 vs 백업 JSON 대조. 조회만, 수정 X.
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

const BACKUP_FILE = path.join(__dirname, "..", "backups", "mismatch-fix-2026-05-24T17-16-50.json");
const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf8"));
const backupTaskById = new Map((backup.tasks || []).map(t => [t.id, t]));
const backupPayByTaskId = new Map((backup.payments || []).map(p => [p.task_id, p]));
const backupItemsByTaskId = new Map();
for (const it of (backup.task_items || [])) {
  if (!backupItemsByTaskId.has(it.task_id)) backupItemsByTaskId.set(it.task_id, []);
  backupItemsByTaskId.get(it.task_id).push(it);
}

function kst(y, m, d, h = 9, mi = 0) {
  return new Date(Date.UTC(y, m - 1, d, h - 9, mi, 0)).toISOString();
}

// 기대값 정의
const EXPECT_A = [
  { task_no: "YS-N-260524-005", cust: "이미경" },
  { task_no: "YS-260517-037",   cust: "임수민" },
  { task_no: "YS-260515-024",   cust: "유지은" },
  { task_no: "YS-260515-037",   cust: "김주현" },
  { task_no: "YS-260519-051",   cust: "조윤형" },
  { task_no: "YS-260518-096",   cust: "박병국" },
  { task_no: "YS-260504-029",   cust: "황수연",  expSched: kst(2026, 5, 9, 10) },
  { task_no: "YS-260503-001",   cust: "김하진",  expSched: kst(2026, 5, 9, 14) },
  { task_no: "YS-N-260524-004", cust: "홍순택",  expSched: kst(2026, 5, 13, 11) },
  { task_no: "YS-260516-169",   cust: "박정훈",  expSched: kst(2026, 5, 21, 11) },
];

const EXPECT_B = [
  { task_no: "YS-260518-086",   cust: "공영미",  expSched: kst(2026, 5, 27, 10) },
  { task_no: "YS-260430-010",   cust: "최민희",  expSched: kst(2026, 5, 4, 10)  },
  { task_no: "YS-260512-021",   cust: "김시윤",  expSched: kst(2026, 5, 18, 10) },
  { task_no: "YS-260516-069",   cust: "오아름",  expSched: kst(2026, 5, 22, 10) },
  { task_no: "YS-N-260524-007", cust: "양재훈",  expSched: kst(2026, 5, 23, 10) },
  { task_no: "YS-N-260524-011", cust: "유은진",  expSched: kst(2026, 5, 26, 10) },
  { task_no: "YS-260428-055",   cust: "강주희",  expSched: kst(2026, 5, 4, 10)  },
  { task_no: "YS-N-260524-003", cust: "손동원",  expSched: kst(2026, 5, 17, 10) },
  { task_no: "YS-N-260524-002", cust: "이서현",  expSched: kst(2026, 5, 19, 10) },
  { task_no: "YS-N-260524-008", cust: "이영수",  expSched: kst(2026, 5, 25, 10) },
  { task_no: "YS-260520-016",   cust: "김복주",  expSched: kst(2026, 5, 25, 16, 30) },
  { task_no: "YS-260518-085",   cust: "주상은",  expSched: kst(2026, 6, 1, 14) },
  { task_no: "YS-260517-039",   cust: "김호연",  expSched: kst(2026, 6, 1, 15, 15) },
  { task_no: "YS-260520-021",   cust: "김종윤",  expSched: kst(2026, 6, 2, 16, 30) },
];

const EXPECT_C = [
  { task_no: "YS-260425-010", cust: "손원주", expComp: kst(2026, 5, 18, 18) },
];

const EXPECT_D = [
  { task_no: "YS-260501-011", cust: "황우현", expQty: 1 },
];

const EXPECT_E = [
  { task_no: "YS-260512-063", cust: "강유미" },
  { task_no: "YS-260430-023", cust: "윤지영" },
];

const EXPECT_F = [
  { task_no: "YS-260516-162", cust: "이지은", expSched: kst(2026, 5, 31, 9) },
];

const EXPECT_G = { task_no: "YS-260427-004", cust: "한인규" };

const DAY24 = [
  "YS-260519-015", "YS-260518-098", "YS-260516-012", "YS-260521-013",
  "YS-260516-157", "YS-260516-158", "YS-260518-040", "YS-260515-061",
  "YS-260518-049", "YS-260517-033",
];

async function loadTaskFull(task_no) {
  const { data: t } = await sb.from("tasks").select("*").eq("task_no", task_no).maybeSingle();
  if (!t) return { t: null, p: null, items: [] };
  const { data: p } = await sb.from("payments").select("*").eq("task_id", t.id).maybeSingle();
  const { data: items } = await sb.from("task_items").select("*").eq("task_id", t.id);
  return { t, p, items: items || [] };
}

const issues = [];
function logIssue(label, detail) { issues.push(`${label}: ${detail}`); }

(async () => {
  console.log("=".repeat(120));
  console.log(`검증 — 백업 ${path.basename(BACKUP_FILE)} 측 catch 측 DB 측 catch`);
  console.log("=".repeat(120));

  // -----------------------------------------
  console.log("\n【A. 완료 처리 10건 — status='완료' / comp 존재 / payments 정상】");
  for (const x of EXPECT_A) {
    const { t, p } = await loadTaskFull(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} ${x.cust} — DB 없음`); logIssue("A", `${x.task_no} DB 없음`); continue; }
    const okStatus = t.status === "완료";
    const okComp = !!t.completed_at;
    const okSched = !x.expSched || t.scheduled_at === x.expSched;
    const okPay = p && p.engineer_amount != null && p.principal_amount != null && p.owner_amount != null;
    const mark = (okStatus && okComp && okSched && okPay) ? "✅" : "⚠️";
    console.log(`  ${mark} ${x.task_no} ${x.cust} | status=${t.status} | sched=${(t.scheduled_at||'').slice(0,16)} | comp=${(t.completed_at||'').slice(0,16)} | pay=${p ? `eng=${p.engineer_amount} prin=${p.principal_amount} own=${p.owner_amount}` : "(없음)"}`);
    if (!okStatus) logIssue("A", `${x.task_no} status=${t.status} (≠완료)`);
    if (!okComp) logIssue("A", `${x.task_no} completed_at 없음`);
    if (!okSched) logIssue("A", `${x.task_no} sched=${t.scheduled_at} (기대 ${x.expSched})`);
    if (!okPay) logIssue("A", `${x.task_no} payments 측 catch X 측 catch 측 catch X`);
  }

  // -----------------------------------------
  console.log("\n【B. 일정만 14건 — scheduled_at 일치】");
  for (const x of EXPECT_B) {
    const { t } = await loadTaskFull(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} ${x.cust} — DB 없음`); logIssue("B", `${x.task_no} DB 없음`); continue; }
    const ok = t.scheduled_at === x.expSched;
    console.log(`  ${ok ? "✅" : "⚠️"} ${x.task_no} ${x.cust} | sched=${(t.scheduled_at||'').slice(0,16)} ${ok ? "" : `(기대 ${x.expSched.slice(0,16)})`}`);
    if (!ok) logIssue("B", `${x.task_no} sched=${t.scheduled_at} (기대 ${x.expSched})`);
  }

  // -----------------------------------------
  console.log("\n【C. 손원주 — completed_at 5/18】");
  for (const x of EXPECT_C) {
    const { t } = await loadTaskFull(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} DB 없음`); logIssue("C", `${x.task_no} DB 없음`); continue; }
    const ok = t.completed_at === x.expComp;
    console.log(`  ${ok ? "✅" : "⚠️"} ${x.task_no} ${x.cust} | comp=${(t.completed_at||'').slice(0,16)} ${ok ? "" : `(기대 ${x.expComp.slice(0,16)})`}`);
    if (!ok) logIssue("C", `${x.task_no} comp=${t.completed_at} (기대 ${x.expComp})`);
  }

  // -----------------------------------------
  console.log("\n【D. 황우현 — task_items 본작업 qty=1 / payments 절반】");
  for (const x of EXPECT_D) {
    const { t, p, items } = await loadTaskFull(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} DB 없음`); logIssue("D", "DB 없음"); continue; }
    const mainItem = items.find(it => it.order_type === '본작업') || items[0];
    const okQty = mainItem && mainItem.qty === x.expQty;
    const okSub = mainItem && Number(mainItem.subtotal) === Number(mainItem.unit_price);

    // 백업 측 catch
    const beforePay = backupPayByTaskId.get(t.id);
    const expEng = beforePay ? Math.round(Number(beforePay.engineer_amount) / 2) : null;
    const expPrin = beforePay ? Math.round(Number(beforePay.principal_amount) / 2) : null;
    const expOwn = beforePay ? Math.round(Number(beforePay.owner_amount) / 2) : null;

    const halfTol = (act, exp) => exp == null ? true : Math.abs(Number(act) - exp) <= Math.max(2, exp * 0.05); // 5% tol
    const okHalfEng = halfTol(p && p.engineer_amount, expEng);
    const okHalfPrin = halfTol(p && p.principal_amount, expPrin);
    const okHalfOwn = halfTol(p && p.owner_amount, expOwn);

    const ok = okQty && okSub && p && okHalfEng && okHalfPrin && okHalfOwn;
    console.log(`  ${ok ? "✅" : "⚠️"} ${x.task_no} ${x.cust}`);
    console.log(`     본작업 item: qty=${mainItem ? mainItem.qty : "?"} (기대 ${x.expQty}) | unit=${mainItem ? mainItem.unit_price : "?"} sub=${mainItem ? mainItem.subtotal : "?"}`);
    console.log(`     payments 측: eng=${p ? p.engineer_amount : "(없음)"} prin=${p ? p.principal_amount : "(없음)"} own=${p ? p.owner_amount : "(없음)"}`);
    console.log(`     payments 백업: eng=${beforePay ? beforePay.engineer_amount : "(없음)"} prin=${beforePay ? beforePay.principal_amount : "(없음)"} own=${beforePay ? beforePay.owner_amount : "(없음)"}`);
    console.log(`     절반 측 catch (±5%): eng=${okHalfEng?"OK":"X"} prin=${okHalfPrin?"OK":"X"} own=${okHalfOwn?"OK":"X"}  (기대 ~${expEng}/${expPrin}/${expOwn})`);
    if (!okQty) logIssue("D", `qty=${mainItem?.qty} (기대 ${x.expQty})`);
    if (!p) logIssue("D", "payments 없음");
    if (p && (!okHalfEng || !okHalfPrin || !okHalfOwn)) logIssue("D", `payments 절반 측 catch X (eng=${p.engineer_amount} prin=${p.principal_amount} own=${p.owner_amount} / 기대 ~${expEng}/${expPrin}/${expOwn})`);
  }

  // -----------------------------------------
  console.log("\n【E. 강유미·윤지영 — status='취소' / payments row 없음】");
  for (const x of EXPECT_E) {
    const { t, p } = await loadTaskFull(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} DB 없음`); logIssue("E", `${x.task_no} DB 없음`); continue; }
    const okStatus = t.status === "취소";
    const okComp = t.completed_at == null;
    const okPay = !p;
    const mark = (okStatus && okComp && okPay) ? "✅" : "⚠️";
    console.log(`  ${mark} ${x.task_no} ${x.cust} | status=${t.status} | comp=${t.completed_at||'NULL'} | payments=${p ? "측 catch" : "없음"}`);
    if (!okStatus) logIssue("E", `${x.task_no} status=${t.status} (≠취소)`);
    if (!okComp) logIssue("E", `${x.task_no} completed_at=${t.completed_at} (≠NULL)`);
    if (!okPay) logIssue("E", `${x.task_no} payments 측 catch 측 catch (삭제 측 catch)`);
  }

  // -----------------------------------------
  console.log("\n【F. 이지은 — status='확정' / sched=5/31 09:00 / comp=NULL / payments 없음】");
  for (const x of EXPECT_F) {
    const { t, p } = await loadTaskFull(x.task_no);
    if (!t) { console.log(`  ❌ ${x.task_no} DB 없음`); logIssue("F", "DB 없음"); continue; }
    const okStatus = t.status === "확정";
    const okSched = t.scheduled_at === x.expSched;
    const okComp = t.completed_at == null;
    const okPay = !p;
    const mark = (okStatus && okSched && okComp && okPay) ? "✅" : "⚠️";
    console.log(`  ${mark} ${x.task_no} ${x.cust} | status=${t.status} | sched=${(t.scheduled_at||'').slice(0,16)} | comp=${t.completed_at||'NULL'} | payments=${p ? "측 catch" : "없음"}`);
    if (!okStatus) logIssue("F", `status=${t.status} (≠확정)`);
    if (!okSched) logIssue("F", `sched=${t.scheduled_at} (기대 ${x.expSched})`);
    if (!okComp) logIssue("F", `completed_at=${t.completed_at} (≠NULL)`);
    if (!okPay) logIssue("F", "payments row 측 catch (삭제 측 catch)");
  }

  // -----------------------------------------
  console.log("\n【G. 한인규 YS-260427-004 — task / task_items / payments 정상】");
  {
    const { t, p, items } = await loadTaskFull(EXPECT_G.task_no);
    if (!t) { console.log(`  ❌ DB 없음`); logIssue("G", "DB 없음"); }
    else {
      const okStatus = t.status === "완료";
      const okComp = !!t.completed_at;
      const okItems = items.length >= 1;
      const okPay = p && p.engineer_amount != null && p.principal_amount != null && p.owner_amount != null;
      const mark = (okStatus && okComp && okItems && okPay) ? "✅" : "⚠️";
      console.log(`  ${mark} ${t.task_no} ${t.customer_name} | status=${t.status} | sched=${(t.scheduled_at||'').slice(0,16)} | comp=${(t.completed_at||'').slice(0,16)}`);
      console.log(`     task_items=${items.length}건, 본작업 qty=${items[0]?.qty} unit=${items[0]?.unit_price} sub=${items[0]?.subtotal}`);
      console.log(`     payments: ${p ? `eng=${p.engineer_amount} prin=${p.principal_amount} own=${p.owner_amount} [${p.calc_method}]` : "(없음)"}`);
      if (!okStatus) logIssue("G", `status=${t.status}`);
      if (!okComp) logIssue("G", "completed_at 없음");
      if (!okItems) logIssue("G", "task_items 없음");
      if (!okPay) logIssue("G", "payments 측 catch X 측 catch 측 catch X");
    }
  }

  // -----------------------------------------
  console.log("\n【5/24분 10건 — status='완료' / comp 존재 / payments 정상】");
  for (const task_no of DAY24) {
    const { t, p } = await loadTaskFull(task_no);
    if (!t) { console.log(`  ❌ ${task_no} DB 없음`); logIssue("DAY24", `${task_no} DB 없음`); continue; }
    const okStatus = t.status === "완료";
    const okComp = !!t.completed_at;
    const okPay = p && p.engineer_amount != null && p.principal_amount != null && p.owner_amount != null;
    const mark = (okStatus && okComp && okPay) ? "✅" : "⚠️";
    console.log(`  ${mark} ${task_no} ${t.customer_name} | status=${t.status} | comp=${(t.completed_at||'').slice(0,16)} | pay=${p ? `eng=${p.engineer_amount} prin=${p.principal_amount} own=${p.owner_amount}` : "(없음)"}`);
    if (!okStatus) logIssue("DAY24", `${task_no} status=${t.status}`);
    if (!okComp) logIssue("DAY24", `${task_no} completed_at 없음`);
    if (!okPay) logIssue("DAY24", `${task_no} payments 측 catch X`);
  }

  // -----------------------------------------
  console.log("\n" + "=".repeat(120));
  if (issues.length === 0) {
    console.log("✅ 측 측 catch — 40건 측 측 catch 측 catch.");
  } else {
    console.log(`⚠️ 측 catch 측 catch — ${issues.length}건`);
    issues.forEach(i => console.log(`  · ${i}`));
  }
  console.log("=".repeat(120));
})().catch(e => console.log("FATAL:", e.message, e.stack));

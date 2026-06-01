// 2026-06-02 — 라이브 전환 측 검증.
// ① 정산월별 합 (우리 작업 = usol_n + naver_settled, sum net × 0.85)
// ② 5월 작업 순이익 라이브 (회사 실입금 라이브 − 1차 RPC)
//
// 실행: node scripts/diag-live-numbers.cjs

const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";

function kstYmd(utcIso) {
  if (!utcIso) return null;
  return new Date(new Date(utcIso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
function mondayOfYmd(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const off = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + off);
  return dt.toISOString().slice(0, 10);
}
function addDays(ymd, d) {
  const [y, m, dd] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd + d));
  return dt.toISOString().slice(0, 10);
}

(async () => {
  // ── 라이브 fetch — usol_n + naver_settled NOT NULL + 활성
  const PAGE = 1000;
  const all = [];
  for (let p = 0; p < 30; p++) {
    const { data, error } = await sb.from("task_items")
      .select("id, naver_settled_at, net_amount, is_canceled, engineer_settled_at, tasks!inner(principal_id, status, completed_at)")
      .eq("tasks.principal_id", PID)
      .not("naver_settled_at", "is", null)
      .order("id", { ascending: true })
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  const active = all.filter(it => !it.is_canceled && it.tasks?.status !== "취소");

  // ── ① 주차 그룹 → payYm 그룹
  const byWeek = new Map();
  for (const it of active) {
    const settledYmd = kstYmd(it.naver_settled_at);
    if (!settledYmd) continue;
    const monday = mondayOfYmd(settledYmd);
    if (!byWeek.has(monday)) {
      const sunday = addDays(monday, 6);
      const deposit = addDays(sunday, 1);
      byWeek.set(monday, { monday, sunday, deposit, payYm: deposit.slice(0, 7), count: 0, sumNet: 0 });
    }
    const wk = byWeek.get(monday);
    wk.count += 1;
    wk.sumNet += Number(it.net_amount) || 0;
  }
  const weeks = [...byWeek.values()].sort((a, b) => b.monday.localeCompare(a.monday));

  // 정산월(payYm) 그룹
  const byPayYm = new Map();
  for (const w of weeks) {
    if (!byPayYm.has(w.payYm)) byPayYm.set(w.payYm, []);
    byPayYm.get(w.payYm).push(w);
  }

  console.log("=".repeat(80));
  console.log("① 정산월별 합 (라이브 — usol_n + naver_settled 활성)");
  console.log("─".repeat(80));
  const payYms = [...byPayYm.keys()].sort().reverse();
  let grand = 0;
  for (const py of payYms) {
    const list = byPayYm.get(py).sort((a, b) => b.monday.localeCompare(a.monday));
    const total = list.reduce((s, w) => s + Math.round(w.sumNet * 0.85), 0);
    const cnt = list.reduce((s, w) => s + w.count, 0);
    grand += total;
    console.log(`\n  📅 ${py} — ${list.length}주 / ${cnt}건 / ₩${total.toLocaleString()}`);
    for (const w of list) {
      const wkX085 = Math.round(w.sumNet * 0.85);
      console.log(`     · ${w.monday}~${w.sunday} (입금 ${w.deposit}) : ${w.count}건 / ₩${wkX085.toLocaleString()}`);
    }
  }
  console.log("\n" + "─".repeat(80));
  console.log(`  grand total: ₩${grand.toLocaleString()}`);

  // ── ② 5월 작업 순이익 라이브
  console.log("\n" + "=".repeat(80));
  console.log("② 5월 작업 순이익 라이브 (회사 실입금 라이브 − 1차 RPC)");
  console.log("─".repeat(80));

  // 5월 KST = UTC [2026-04-30 15:00, 2026-05-31 15:00)
  const MAY_S = "2026-04-30T15:00:00Z";
  const MAY_E = "2026-05-31T15:00:00Z";

  // 5월 완료 task_items (live company net income 모집단 = 5월 + naver_settled)
  const { data: mayTasks } = await sb.from("tasks")
    .select("id, task_no")
    .eq("tenant_id", "11111111-1111-1111-1111-111111111111")
    .eq("principal_id", PID)
    .eq("status", "완료")
    .gte("completed_at", MAY_S).lt("completed_at", MAY_E);
  const mayTaskIds = (mayTasks || []).map(t => t.id);

  const mayItems = [];
  for (let i = 0; i < mayTaskIds.length; i += 200) {
    const chunk = mayTaskIds.slice(i, i + 200);
    const { data } = await sb.from("task_items")
      .select("id, task_id, naver_settled_at, engineer_settled_at, is_canceled, net_amount")
      .in("task_id", chunk);
    if (data) mayItems.push(...data);
  }
  const mayActive = mayItems.filter(it => !it.is_canceled);

  // 회사 실입금 라이브 = 5월 + naver_settled 의 sum(net) × 0.85
  let liveSumNet = 0, settledCnt = 0, unsettledCnt = 0;
  for (const it of mayActive) {
    if (!it.naver_settled_at) { unsettledCnt += 1; continue; }
    liveSumNet += Number(it.net_amount) || 0;
    settledCnt += 1;
  }
  const companyNetLive = Math.round(liveSumNet * 0.85);

  // RPC 측 1차 (naver_settled, 미지급) — naverConfirmed = first + done_1
  const engBy = new Map();
  for (let i = 0; i < mayTaskIds.length; i += 200) {
    const { data } = await sb.rpc("compute_engineer_amount_per_item_batch", { p_task_ids: mayTaskIds.slice(i, i + 200) });
    if (Array.isArray(data)) for (const r of data) engBy.set(r.task_item_id, Number(r.engineer_amount) || 0);
  }
  let first = 0, second = 0, done1 = 0, done2 = 0;
  let firstC = 0, secondC = 0, done1C = 0, done2C = 0;
  for (const it of mayActive) {
    const amt = engBy.get(it.id) || 0;
    if (it.engineer_settled_at) {
      if (it.naver_settled_at) { done1 += amt; done1C += 1; }
      else { done2 += amt; done2C += 1; }
    } else if (it.naver_settled_at) { first += amt; firstC += 1; }
    else { second += amt; secondC += 1; }
  }
  const naverConfirmed = first + done1;
  const profit = companyNetLive - naverConfirmed;

  console.log(`  5월 완료 활성 items: ${mayActive.length}건`);
  console.log(`  · 정산 확정 (naver_settled): ${settledCnt}건 / sum net ₩${liveSumNet.toLocaleString()}`);
  console.log(`  · 미정산: ${unsettledCnt}건`);
  console.log(`  · 회사 실입금 라이브 (sum net × 0.85): ₩${companyNetLive.toLocaleString()}`);
  console.log("");
  console.log(`  · 1차 (naver_settled 미지급): ${firstC}건 / ₩${first.toLocaleString()}`);
  console.log(`  · 2차 (미정산 미지급):       ${secondC}건 / ₩${second.toLocaleString()}`);
  console.log(`  · 받음 1차 (paid, settled):  ${done1C}건 / ₩${done1.toLocaleString()}`);
  console.log(`  · 받음 2차 (paid, unsettled): ${done2C}건 / ₩${done2.toLocaleString()}`);
  console.log(`  · naverConfirmed (1차 모집단 = first + done_1): ₩${naverConfirmed.toLocaleString()}`);
  console.log("");
  console.log(`  💰 순이익 라이브 = ${companyNetLive.toLocaleString()} − ${naverConfirmed.toLocaleString()} = ₩${profit.toLocaleString()}`);
  console.log(`     (이전 시트 기준 ₩4,819,950 대비 ${profit >= 4819950 ? "+" : ""}₩${(profit - 4819950).toLocaleString()})`);
})();

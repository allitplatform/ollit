// 2026-06-02 — W23 (deposit 6/8, naver_settled 6/1~6/7 KST) usol_n 활성 task_items 의
//   completed_at KST 월별 분포 진단 (DB 변경 X).
//
// 실행: node scripts/diag-w23-completed-split.cjs

const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";
// W23 KST: 6/1 00:00 ~ 6/8 00:00 → UTC: 5/31 15:00 ~ 6/7 15:00
const S_UTC = "2026-05-31T15:00:00Z";
const E_UTC = "2026-06-07T15:00:00Z";

function kstYmd(iso) {
  if (!iso) return null;
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
function kstYm(iso) {
  const ymd = kstYmd(iso);
  return ymd ? ymd.slice(0, 7) : null;
}

(async () => {
  const PAGE = 1000;
  const all = [];
  for (let p = 0; p < 10; p++) {
    const { data, error } = await sb.from("task_items")
      .select("id, naver_settled_at, net_amount, is_canceled, tasks!inner(principal_id, status, task_no, completed_at, status, customer_name)")
      .eq("tasks.principal_id", PID)
      .not("naver_settled_at", "is", null)
      .gte("naver_settled_at", S_UTC)
      .lt("naver_settled_at", E_UTC)
      .order("id", { ascending: true })
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  const active = all.filter(it => !it.is_canceled && it.tasks?.status !== "취소");
  console.log(`W23 (naver_settled 6/1~6/7 KST) 활성 usol_n task_items: ${active.length}건`);

  let sumNet = 0;
  for (const it of active) sumNet += Number(it.net_amount) || 0;
  const wkTotal = Math.round(sumNet * 0.85);
  console.log(`sum(net): ₩${sumNet.toLocaleString()} / × 0.85: ₩${wkTotal.toLocaleString()}\n`);

  console.log("=".repeat(78));
  console.log("completed_at KST 월별 분포");
  console.log("─".repeat(78));
  const byYm = {};
  let nullCnt = 0, nullSumNet = 0;
  for (const it of active) {
    const ym = kstYm(it.tasks?.completed_at);
    const net = Number(it.net_amount) || 0;
    if (!ym) { nullCnt += 1; nullSumNet += net; continue; }
    if (!byYm[ym]) byYm[ym] = { cnt: 0, sumNet: 0 };
    byYm[ym].cnt += 1;
    byYm[ym].sumNet += net;
  }
  const yms = Object.keys(byYm).sort();
  let runningTotal = 0;
  for (const ym of yms) {
    const v = byYm[ym];
    const x085 = Math.round(v.sumNet * 0.85);
    runningTotal += x085;
    console.log(`  ${ym}분 : ${String(v.cnt).padStart(4)}건 / sum(net)=₩${v.sumNet.toLocaleString().padStart(11)} / ×0.85=₩${x085.toLocaleString().padStart(11)}`);
  }
  const nullX085 = Math.round(nullSumNet * 0.85);
  console.log(`  null   : ${String(nullCnt).padStart(4)}건 / sum(net)=₩${nullSumNet.toLocaleString().padStart(11)} / ×0.85=₩${nullX085.toLocaleString().padStart(11)}`);
  runningTotal += nullX085;
  console.log("─".repeat(78));
  console.log(`  합계 (월별 ×0.85): ₩${runningTotal.toLocaleString()}`);
  console.log(`  weeklyTotal (sum(net)×0.85): ₩${wkTotal.toLocaleString()}`);
  console.log(`  차액: ₩${(wkTotal - runningTotal).toLocaleString()} (반올림 잔차)`);

  // null 측 측측 측측
  if (nullCnt > 0) {
    console.log("\n" + "=".repeat(78));
    console.log("completed_at NULL 항목 샘플 (앞 5)");
    console.log("─".repeat(78));
    const nulls = active.filter(it => !kstYm(it.tasks?.completed_at));
    for (const it of nulls.slice(0, 5)) {
      console.log(`  ${it.tasks?.task_no} | status=${it.tasks?.status} | customer=${it.tasks?.customer_name} | net=${Number(it.net_amount).toLocaleString()}`);
    }
  }

  // 측측 측측 측측 (kstYm 분포가 6월일 측 측측)
  if (byYm["2026-06"]) {
    console.log("\n" + "=".repeat(78));
    console.log("2026-06 (6월 작업) 샘플 (앞 5)");
    console.log("─".repeat(78));
    const jun = active.filter(it => kstYm(it.tasks?.completed_at) === "2026-06");
    for (const it of jun.slice(0, 5)) {
      console.log(`  ${it.tasks?.task_no} | completed=${it.tasks?.completed_at} (KST ${kstYmd(it.tasks?.completed_at)}) | net=${Number(it.net_amount).toLocaleString()}`);
    }
  }
})();

// 2026-06-01 — usol_n task_items naver_settled_at 분포 (KST 날짜별 카운트).
//   목적: 일괄 import 로 인해 naver_settled_at 이 몇몇 날짜에 뭉쳤는지,
//         아니면 실제 정산일별로 분산됐는지 확인 → 주차 분리 필터 신뢰성 판정.
//
// 실행: node scripts/diag-naver-settled-dist.cjs
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006"; // usol_n
const S = "2026-03-29T15:00:00Z";  // KST 2026-03-30 (W14)
const E = "2026-06-08T15:00:00Z";  // KST 2026-06-09

function kstYmd(utcIso) {
  const d = new Date(new Date(utcIso).getTime() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
function kstHM(utcIso) {
  const d = new Date(new Date(utcIso).getTime() + 9 * 3600 * 1000);
  return d.toISOString().slice(11, 16);
}
function mondayOfKst(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const off = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + off);
  return dt.toISOString().slice(0, 10);
}

(async () => {
  // 페이지네이션 fetch
  const PAGE = 1000, MAX = 10;
  const all = [];
  for (let p = 0; p < MAX; p++) {
    const off = p * PAGE;
    const { data, error } = await sb.from("task_items")
      .select("id, naver_settled_at, tasks!inner(principal_id)")
      .eq("tasks.principal_id", PID)
      .not("naver_settled_at", "is", null)
      .gte("naver_settled_at", S)
      .lt("naver_settled_at", E)
      .order("naver_settled_at", { ascending: true })
      .range(off, off + PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  console.log(`naver_settled task_items: ${all.length}건\n`);

  // 1) 날짜별 카운트
  const byDate = {};
  const byHour = {};  // KST 시각 분포 (일괄 import 검증)
  for (const it of all) {
    const ymd = kstYmd(it.naver_settled_at);
    const hm  = kstHM(it.naver_settled_at);
    byDate[ymd] = (byDate[ymd] || 0) + 1;
    const k = `${ymd} ${hm}`;
    byHour[k] = (byHour[k] || 0) + 1;
  }
  const dates = Object.keys(byDate).sort();
  console.log("=".repeat(78));
  console.log("1) 날짜별 naver_settled 카운트 (KST)");
  console.log("─".repeat(78));
  for (const d of dates) {
    const cnt = byDate[d];
    const bar = "█".repeat(Math.min(60, Math.round(cnt / 5)));
    console.log(`  ${d}  ${String(cnt).padStart(4)}건  ${bar}`);
  }

  // 2) 주차별 카운트 (KST monday 키)
  const byWeek = {};
  for (const ymd of dates) {
    const wk = mondayOfKst(ymd);
    byWeek[wk] = (byWeek[wk] || 0) + byDate[ymd];
  }
  const weeks = Object.keys(byWeek).sort();
  console.log("\n" + "=".repeat(78));
  console.log("2) 주차별 naver_settled 카운트 (KST 월요일 키)");
  console.log("─".repeat(78));
  for (const w of weeks) {
    console.log(`  ${w}  ${String(byWeek[w]).padStart(4)}건`);
  }

  // 3) 일괄 import 의심 — 같은 KST 시각 (분 단위) 에 N건 이상 = 일괄 stamp
  console.log("\n" + "=".repeat(78));
  console.log("3) 일괄 import 의심 — 같은 KST 시각 (분 단위) 측 10건 이상");
  console.log("─".repeat(78));
  const susp = Object.entries(byHour)
    .filter(([_, c]) => c >= 10)
    .sort((a, b) => b[1] - a[1]);
  if (susp.length === 0) {
    console.log("  · 의심 없음 (분 단위 뭉침 없음 — 실 정산일 분포로 추정)");
  } else {
    for (const [k, c] of susp.slice(0, 20)) {
      console.log(`  ${k} KST  ${String(c).padStart(4)}건  ${"█".repeat(Math.min(40, c))}`);
    }
    console.log(`  ... 총 의심 시각: ${susp.length}개`);
  }

  // 4) 분산도 — 고유 날짜 수 / 총 건수
  console.log("\n" + "=".repeat(78));
  console.log("4) 분산도 요약");
  console.log("─".repeat(78));
  console.log(`  고유 날짜 수: ${dates.length}일`);
  console.log(`  고유 주차 수: ${weeks.length}주`);
  console.log(`  평균 / 날짜:  ${(all.length / dates.length).toFixed(1)}건/일`);
  console.log(`  평균 / 주차:  ${(all.length / weeks.length).toFixed(1)}건/주`);
})();

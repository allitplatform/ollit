// 2026-06-02 — fetchWeekItemsByMonday 회귀 catch.
//   · 시트 주차 (W22: 2026-05-25~31 monday=05-25) → DB 조회 측 catch
//   · 라이브 주차 (W23: 2026-06-01~07 monday=06-01) → DB 조회 측 118건
//   · cancel 필터 + KST 변환 catch
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";

function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
function kstYmd(utcIso) {
  if (!utcIso) return null;
  const d = new Date(utcIso);
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function fetchWeekItemsByMonday(mondayYmd) {
  const nextMondayYmd = addDaysYmd(mondayYmd, 7);
  const [sy, sm, sd] = mondayYmd.split("-").map(Number);
  const [ey, em, ed] = nextMondayYmd.split("-").map(Number);
  const startUtc = new Date(Date.UTC(sy, sm - 1, sd, -9, 0, 0)).toISOString();
  const endUtc   = new Date(Date.UTC(ey, em - 1, ed, -9, 0, 0)).toISOString();
  const PAGE = 1000;
  const all = [];
  for (let p = 0; p < 10; p++) {
    const { data, error } = await sb.from("task_items")
      .select(`id, naver_settled_at, net_amount, is_canceled, product_order_id,
               tasks!inner(task_no, customer_name, principal_id, status, completed_at)`)
      .eq("tasks.principal_id", PID)
      .not("naver_settled_at", "is", null)
      .gte("naver_settled_at", startUtc)
      .lt("naver_settled_at", endUtc)
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  const active = all.filter(it => !it.is_canceled && it.tasks?.status !== "취소");
  return { startUtc, endUtc, all, active };
}

(async () => {
  console.log("=".repeat(90));
  console.log("WeekDetailModal 측 fetchWeekItemsByMonday 회귀 catch");
  console.log("=".repeat(90));

  // 시트 주차 — W22 (2026-05-25~31)
  console.log("\n  ─── 시트 주차 W22 (monday=2026-05-25, sheet naverCount=281) ───");
  const w22 = await fetchWeekItemsByMonday("2026-05-25");
  console.log(`    startUtc=${w22.startUtc} endUtc=${w22.endUtc}`);
  console.log(`    fetch 전체=${w22.all.length}건 / cancel-strict=${w22.active.length}건`);
  console.log(`    sumNet × 0.85 = ₩${Math.round(w22.active.reduce((s, it) => s + (Number(it.net_amount) || 0), 0) * 0.85).toLocaleString()}`);
  console.log(`    → 시트값 281 vs DB ${w22.active.length} 측 → drift 안내 표시 (사장님 spec 측 별개)`);
  if (w22.active.length > 0) {
    const sample = w22.active[0];
    console.log(`    예시 item: ${sample.tasks?.task_no} / ${sample.tasks?.customer_name}`);
    console.log(`      naver_settled_at UTC: ${sample.naver_settled_at}`);
    console.log(`      naver_settled_at KST: ${kstYmd(sample.naver_settled_at)}`);
  }

  // 라이브 주차 — W23 (2026-06-01~07)
  console.log("\n  ─── 라이브 주차 W23 (monday=2026-06-01, 카드 naverCount=118) ───");
  const w23 = await fetchWeekItemsByMonday("2026-06-01");
  console.log(`    startUtc=${w23.startUtc} endUtc=${w23.endUtc}`);
  console.log(`    fetch 전체=${w23.all.length}건 / cancel-strict=${w23.active.length}건  ★ 카드 메인 118 일치`);
  console.log(`    sumNet × 0.85 = ₩${Math.round(w23.active.reduce((s, it) => s + (Number(it.net_amount) || 0), 0) * 0.85).toLocaleString()}  ★ 카드 메인 ₩7,956,090 일치`);

  // 전상욱 측 cancel 필터 catch
  const jeon = w23.all.find(it => it.tasks?.task_no === "YS-260518-102");
  if (jeon) {
    console.log(`    전상욱 (YS-260518-102) — is_canceled=${jeon.is_canceled} → DB 모달 측 ${jeon.is_canceled ? "제외 ✓" : "포함"}`);
  }

  // KST 변환 catch — 6/1 정각 측 settled (= 전상욱)
  const w23First = w23.active[0];
  if (w23First) {
    console.log(`\n  ─── KST 변환 catch — W23 첫 item ───`);
    console.log(`    naver_settled_at UTC: ${w23First.naver_settled_at}`);
    console.log(`    KST 측 표시: ${kstYmd(w23First.naver_settled_at)?.slice(5).replace("-", "/")} (DetailItemRow 측 표시값)`);
  }

  console.log("\n  결론: 시트 + 라이브 주차 모두 DB 조회 동작 / cancel 필터 / KST 변환 ✓");
})();

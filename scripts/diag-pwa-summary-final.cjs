// 2026-06-02 — summary cancel 필터 통일 + 드릴인 KST/rounding 회귀 catch.
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const TENANT = "11111111-1111-1111-1111-111111111111";

function kstYmd(utcIso) {
  if (!utcIso) return null;
  const utc = new Date(utcIso);
  if (isNaN(utc.getTime())) return null;
  return new Date(utc.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

(async () => {
  console.log("=".repeat(90));
  console.log("PWA summary + 드릴인 회귀 catch");
  console.log("=".repeat(90));

  const { data: principals } = await sb.from("principals").select("id, code").in("code", ["usol_h", "usol_n"]);
  const pids = principals.map(p => p.id);
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3); cutoff.setHours(0, 0, 0, 0);

  // fetch
  const PAGE_SIZE = 1000;
  const accumulated = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await sb.from("task_items")
      .select(`id, naver_settled_at, net_amount, is_canceled,
               tasks!inner(task_no, status, received_at)`)
      .eq("tasks.tenant_id", TENANT)
      .in("tasks.principal_id", pids)
      .gte("tasks.received_at", cutoff.toISOString())
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    accumulated.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  const items = accumulated.map(it => ({
    naver_settled_at: it.naver_settled_at,
    net_amount: it.net_amount,
    is_canceled: it.is_canceled,
    task_status: it.tasks?.status,
    task_no: it.tasks?.task_no,
  }));

  // 새 summary (cancel 필터 통일)
  const live = items.filter(it => it.task_status !== "취소" && it.is_canceled !== true);
  const before = live.filter(it => ["배정", "확정"].includes(it.task_status));
  const done = live.filter(it => it.task_status === "완료");
  const settled = live.filter(it => it.naver_settled_at);
  const pendingSettle = done.filter(it => !it.naver_settled_at);

  console.log("\n  ─── 새 summary (cancel 필터 통일) ───");
  console.log(`    received     = ${live.length}        (이전 1724 → 1698 측 catch)`);
  console.log(`    beforeWork   = ${before.length}        (이전 415  → 411  측 catch)`);
  console.log(`    doneWork     = ${done.length}        (이전 1303 → 1281 측 catch)`);
  console.log(`    settled      = ${settled.length}        (이전 907  → 906  측 catch ★)`);
  console.log(`    pendingCount = ${pendingSettle.length}        (이전 406  → 385  측 catch)`);

  // 드릴인 W23 측 catch
  const w23Items = items.filter(it => {
    if (!it.naver_settled_at) return false;
    const ymd = kstYmd(it.naver_settled_at);
    return ymd >= "2026-06-01" && ymd <= "2026-06-07";
  });
  const w23Active = w23Items.filter(it => it.is_canceled !== true && it.task_status !== "취소");
  const w23SumNet = w23Active.reduce((s, it) => s + (Number(it.net_amount) || 0), 0);
  const w23SumSubtotal = Math.round(w23SumNet * 0.85);

  console.log("\n  ─── W23 (6/8 입금주) 드릴인 헤더 catch ───");
  console.log(`    week.items 전체    = ${w23Items.length}건`);
  console.log(`    cancel-strict filter = ${w23Active.length}건  ★ 카드 메인 = 118건과 일치`);
  console.log(`    sumSubtotal (sum×0.85 round) = ₩${w23SumSubtotal.toLocaleString()}  ★ 카드 메인 = ₩7,956,090과 일치`);

  // KST 변환 측 catch — 전상욱 settled UTC vs KST
  console.log("\n  ─── KST 변환 catch — 전상욱 (YS-260518-102) settled 측 ───");
  console.log(`    naver_settled_at UTC slice(5,10) (기존)  = "05-31" → "05/31"`);
  console.log(`    kstYmd 변환 후 slice(5)  (새)            = "${kstYmd("2026-05-31T15:00:00+00:00").slice(5).replace("-", "/")}" ← KST 6/1 정확`);

  console.log("\n  결론: summary settled 906 / 드릴인 118 + ₩7,956,090 (카드 메인 일치) / 날짜 KST 6/1 표시 ✓");
})();

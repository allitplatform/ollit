// 진단 — 김은송(YS-260518-120) 배정기사 '오늘 번 돈' 계산 점검
// 2026-05-25
//
// 검사:
//   · 김은송 task의 assigned_engineer_id 측 engineer 식별
//   · 그 engineer의 KST 오늘 (5/25) task 전수 + payment 합산
//   · 화면별 계산식 적용 시뮬레이션:
//     [A] EngineerApp.jsx:1010 — filter(status==='완료')  ← visit_only 누락 의심
//     [B] EngineerSettleTab.jsx:80 — filter(isCompletedStatus) ← visit_only 포함
//     [C] EngineerSettlementDetailScreen.jsx:32 — filter(status==='완료') ← visit_only 누락 의심

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

const KIM_TASK_NO = "YS-260518-120";
const KST_TODAY   = (() => {
  const d = new Date();
  // KST = UTC+9. Server 측 UTC. KST 'today' 계산용.
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear(), m = String(kst.getUTCMonth() + 1).padStart(2, "0"), dd = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
})();

function bar(c = "═", n = 100) { return c.repeat(n); }
function head(s) { console.log("\n" + bar()); console.log(s); console.log(bar()); }
function sub(s)  { console.log("\n" + bar("─")); console.log(s); console.log(bar("─")); }

// scheduled_at → KST YYYY-MM-DD (v14NormalizeTask 동일 규칙)
function toKstYmd(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, "0")}-${String(k.getUTCDate()).padStart(2, "0")}`;
}

(async () => {
  head(`진단 — 김은송 배정기사 '오늘 번 돈' 계산 점검 (KST 오늘 = ${KST_TODAY})`);

  // 1) 김은송 task → assigned_engineer_id
  const { data: kim } = await sb.from("tasks").select("id, task_no, customer_name, status, scheduled_at, completed_at, travel_fee, total_amount, assigned_engineer_id").eq("task_no", KIM_TASK_NO).maybeSingle();
  if (!kim) { console.log("김은송 task 없음"); return; }
  sub("【1】 김은송 task");
  console.log(`  task_no            : ${kim.task_no}`);
  console.log(`  customer / status  : ${kim.customer_name} / ${kim.status}`);
  console.log(`  scheduled_at       : ${kim.scheduled_at}  → KST ymd = ${toKstYmd(kim.scheduled_at)}`);
  console.log(`  completed_at       : ${kim.completed_at}  → KST ymd = ${toKstYmd(kim.completed_at)}`);
  console.log(`  travel_fee / total : ${kim.travel_fee} / ${kim.total_amount}`);
  console.log(`  assigned_engineer_id: ${kim.assigned_engineer_id}`);

  const engId = kim.assigned_engineer_id;
  if (!engId) { console.log("배정기사 없음"); return; }

  // 2) engineer 정보
  const { data: eng } = await sb.from("users").select("id, code, name, phone").eq("id", engId).maybeSingle();
  sub("【2】 배정기사");
  console.log(`  code=${eng?.code} name=${eng?.name} phone=${eng?.phone}`);

  // 3) 이 engineer의 KST 오늘 일정 task 전수
  // EngineerApp 필터: t.scheduledDate === todayYmd() (KST local).
  // → DB 측 scheduled_at 측 KST 환산 'YYYY-MM-DD' === KST_TODAY 인 task.
  const { data: allTasks } = await sb.from("tasks")
    .select(`id, task_no, customer_name, status, scheduled_at, completed_at, total_amount, travel_fee,
             payments(engineer_amount, principal_amount, owner_amount, calc_method, track, status)`)
    .eq("assigned_engineer_id", engId)
    .gte("scheduled_at", `${KST_TODAY}T00:00:00+09:00`)
    .lt ("scheduled_at", `${KST_TODAY}T23:59:59.999+09:00`)
    .order("scheduled_at", { ascending: true });

  sub(`【3】 KST 오늘(${KST_TODAY}) 배정기사 일정 task 전수`);
  console.log(`  총 ${(allTasks || []).length}건`);
  (allTasks || []).forEach(t => {
    const pay = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    const ea = pay?.engineer_amount ?? null;
    console.log(`    · ${t.task_no} | ${t.customer_name} | status=${t.status} | sched=${t.scheduled_at?.slice(11,16)} | total=${t.total_amount} | engineer_amount=${ea ?? "(NULL)"} | method=${pay?.calc_method ?? "—"} | track=${pay?.track ?? "—"}`);
  });

  // 4) 화면별 계산식 시뮬레이션
  sub("【4】 화면별 '오늘 번 돈' 시뮬레이션");
  const rows = (allTasks || []).map(t => {
    const pay = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    return { task_no: t.task_no, status: t.status, engineer_amount: Number(pay?.engineer_amount || 0) };
  });
  const sumIfCompleted     = rows.filter(t => t.status === "완료").reduce((s, t) => s + t.engineer_amount, 0);
  const sumIfCompletedSet  = rows.filter(t => t.status === "완료" || t.status === "visit_only").reduce((s, t) => s + t.engineer_amount, 0);
  console.log(`  [A] EngineerApp.jsx:1010    filter(status==='완료')     → ₩${sumIfCompleted.toLocaleString()}`);
  console.log(`  [B] EngineerSettleTab:80    filter(isCompletedStatus)  → ₩${sumIfCompletedSet.toLocaleString()}`);
  console.log(`  [C] EngineerSettlDetail:32  filter(status==='완료')     → ₩${sumIfCompleted.toLocaleString()}`);

  const diff = sumIfCompletedSet - sumIfCompleted;
  console.log(`\n  [A]/[C] vs [B] 차이 = ₩${diff.toLocaleString()}`);
  if (diff !== 0) {
    const missing = rows.filter(t => t.status === "visit_only");
    console.log(`  → visit_only 누락 ${missing.length}건:`);
    missing.forEach(t => console.log(`      · ${t.task_no} : ₩${t.engineer_amount.toLocaleString()}`));
  }

  // 5) KST 함정 점검 — scheduled_at, completed_at 의 KST 환산이 다른 날짜로 떨어지진 않는지
  sub("【5】 KST/UTC 함정 — scheduled_at·completed_at 측 KST 환산 비교");
  (allTasks || []).forEach(t => {
    const schKst = toKstYmd(t.scheduled_at);
    const cmpKst = toKstYmd(t.completed_at);
    const schUtc = (t.scheduled_at || "").slice(0, 10);
    const cmpUtc = (t.completed_at || "").slice(0, 10);
    const schMismatch = schKst !== schUtc ? " ★ UTC≠KST" : "";
    const cmpMismatch = (cmpKst && cmpUtc && cmpKst !== cmpUtc) ? " ★ UTC≠KST" : "";
    console.log(`    · ${t.task_no} : sched UTC=${schUtc} KST=${schKst}${schMismatch} | comp UTC=${cmpUtc || "—"} KST=${cmpKst || "—"}${cmpMismatch}`);
  });
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

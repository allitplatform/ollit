// 진단 — 유솔 입금 카드 표시 조건 (trackC 데이터 + 카드 로직 재검토)
// 2026-05-25 (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// KST 변환 (toKstYmd 패턴 — v14Task fallbackScheduledDate 동일)
function toKstYmd(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, "0")}-${String(k.getUTCDate()).padStart(2, "0")}`;
}
const KST_TODAY = (() => {
  const k = new Date(Date.now() + 9 * 3600 * 1000);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, "0")}-${String(k.getUTCDate()).padStart(2, "0")}`;
})();

(async () => {
  console.log("═".repeat(80));
  console.log(`진단 — trackC 데이터 (KST 오늘 = ${KST_TODAY})`);
  console.log("═".repeat(80));

  // 1) usol_n principal id 조회
  const { data: pUn } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  if (!pUn) { console.log("usol_n 없음"); return; }

  // 2) usol_n + 완료 + extra_fee>0 task 측 page loop (1000 cap 회피)
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb.from("tasks")
      .select(`id, task_no, customer_name, status, extra_fee, completed_at,
               assigned_engineer_id,
               payments(engineer_amount, principal_amount, usol_remitted_at, track),
               task_items(work_types(service_types(code)))`)
      .eq("principal_id", pUn.id)
      .eq("status", "완료")
      .gt("extra_fee", 0)
      .order("completed_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) { console.log("ERR:", error.message); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // service='cleaning' 필터 (task_items 측 work_types.service_types.code)
  const trackC = all.filter(t => {
    const items = Array.isArray(t.task_items) ? t.task_items : [];
    return items.some(it => it?.work_types?.service_types?.code === "cleaning");
  });

  console.log(`\n[1] 전체 모집단 (usol_n + 완료 + extra_fee>0): ${all.length}건`);
  console.log(`[2] 그 중 service='cleaning' 포함 (= trackC) : ${trackC.length}건`);

  // 3) 오늘 KST 완료 건
  const todayCompl = trackC.filter(t => toKstYmd(t.completed_at) === KST_TODAY);
  console.log(`[3] KST 오늘(${KST_TODAY}) 완료 trackC : ${todayCompl.length}건  ${todayCompl.length === 0 ? "★ 카드 미표시 원인" : "✓"}`);
  todayCompl.forEach(t => {
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    console.log(`  · ${t.task_no} | ${t.customer_name} | extra=${t.extra_fee} | 15%=${Math.floor(t.extra_fee * 0.15)} | usol_remitted_at=${p?.usol_remitted_at ?? "(NULL)"} | engineer=${t.assigned_engineer_id?.slice(0, 8)}`);
  });

  // 4) 최근 7일 (KST) 분포
  console.log(`\n[4] 최근 7일 KST 분포 — completed_at KST date별 카운트`);
  const map = new Map();
  trackC.forEach(t => {
    const ymd = toKstYmd(t.completed_at);
    if (!ymd) return;
    map.set(ymd, (map.get(ymd) || 0) + 1);
  });
  const sorted = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
  sorted.forEach(([ymd, cnt]) => console.log(`  · ${ymd} : ${cnt}건${ymd === KST_TODAY ? "  ← 오늘" : ""}`));

  // 5) 배정 기사별 건수
  console.log(`\n[5] trackC 배정 기사별 건수`);
  const engMap = new Map();
  for (const t of trackC) {
    const eid = t.assigned_engineer_id || "(NULL)";
    engMap.set(eid, (engMap.get(eid) || 0) + 1);
  }
  const engIds = [...engMap.keys()].filter(x => x !== "(NULL)");
  const { data: engs } = engIds.length ? await sb.from("users").select("id, code, name").in("id", engIds) : { data: [] };
  const engNameMap = new Map((engs || []).map(u => [u.id, `${u.code} ${u.name}`]));
  [...engMap.entries()].sort((a, b) => b[1] - a[1]).forEach(([eid, cnt]) => {
    console.log(`  · ${(engNameMap.get(eid) || eid.slice(0, 12)).padEnd(20)} : ${cnt}건`);
  });

  // 6) usol_remitted_at 상태 분포
  console.log(`\n[6] trackC payments.usol_remitted_at 상태`);
  let pNotNull = 0, pNull = 0, pMissing = 0;
  for (const t of trackC) {
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    if (!p) { pMissing++; continue; }
    if (p.usol_remitted_at) pNotNull++;
    else pNull++;
  }
  console.log(`  · usol_remitted_at NOT NULL (입금완료) : ${pNotNull}건`);
  console.log(`  · usol_remitted_at NULL    (미보고)    : ${pNull}건`);
  console.log(`  · payments row 없음                   : ${pMissing}건`);

  // 7) isTrackC + todayTrackCTasks 로직 — 코드 측 spec 재확인 안내
  console.log(`\n[7] 카드 표시 로직 (현 코드)`);
  console.log(`   src/utils/remitFilter.js  isTrackC(task):`);
  console.log(`     · isCompletedStatus(status) AND principalCode='usol_n' AND extraFee>0`);
  console.log(`   src/pages/EngineerApp.jsx:4259  todayTrackCTasks:`);
  console.log(`     · todayCompletedTasks.filter(isTrackC)  ← '오늘 완료' 한정`);
  console.log(`     · todayCompletedTasks = completedAt KST === todayYmd()`);
  if (todayCompl.length === 0) {
    console.log(`\n   ⚠️ KST 오늘 완료 trackC 0건 → usolRemit=null → 카드 미표시`);
    console.log(`   사장님 결정 — 테스트용 옵션:`);
    console.log(`     A) 과거 미보고 건도 카드에 표시 (todayCompletedTasks 가드 제거 + isTrackC + !usolRemittedAt)`);
    console.log(`     B) 테스트 task 한 건 completed_at 을 오늘로 임시 변경 (운영 데이터 변경, 비권장)`);
    console.log(`     C) 오늘 실제 trackC 완료될 때까지 대기`);
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

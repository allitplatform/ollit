// 3측 측측 측측 측측측 — PrincipalPaymentHistory / SettlementContent.group.total / PartnerDailySettleTab
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();

(async () => {
  // 이번달 KST 측측
  const ymKstNow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year:"numeric", month:"2-digit" }).format(new Date());
  const startKst = `${ymKstNow}-01`;
  const startUtc = new Date(`${startKst}T00:00:00+09:00`).toISOString();
  const [y, m] = ymKstNow.split("-").map(Number);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const endUtc = new Date(`${nextY}-${String(nextM).padStart(2,"0")}-01T00:00:00+09:00`).toISOString();

  console.log(`측측 측측: ${startKst} (KST) ~ 측측 측측 측측`);

  // principals
  const { data: pData } = await sb.from("principals").select("id, code").in("code", ["KA","crikrin"]);
  const pids = pData.map(p => p.id);
  const idToCode = Object.fromEntries(pData.map(p => [p.id, p.code]));
  console.log(`KA/crikrin pids: ${pids.length}건`);

  // 측측 task 측측 — status 측측 측측 (정산완료 측측 측측)
  const { data: allTasks } = await sb.from("tasks")
    .select(`task_no, status, completed_at, principal_id, payments(principal_amount, track)`)
    .in("principal_id", pids)
    .gte("completed_at", startUtc)
    .lt("completed_at", endUtc);

  console.log(`\n=== 측측 status 측측 (이번달 KA/crikrin 완료 측측) ===`);
  const statusCount = {};
  for (const t of (allTasks||[])) {
    statusCount[t.status] = (statusCount[t.status] || 0) + 1;
  }
  for (const [s, c] of Object.entries(statusCount)) console.log(`  ${s}: ${c}건`);

  // 측측 A — PrincipalPaymentHistory (신규):
  //   status ≠ '취소' AND status ≠ 'visit_only' AND track === 'A' → SUM(principal_amount)
  let sumA = 0, countA = 0;
  for (const t of (allTasks||[])) {
    if (t.status === "취소" || t.status === "visit_only") continue;
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    if ((p?.track || "A") !== "A") continue;
    sumA += Number(p?.principal_amount) || 0;
    countA++;
  }

  // 측측 B — SettlementContent.group.total (정산 탭 카드, 측측 측측측):
  //   isRemittanceTarget = isCompletedStatus(완료/정산완료/visit_only) + track === 'A' + status ≠ visit_only
  //   = 완료 OR 정산완료, track === 'A' → SUM(principal_amount)
  let sumB = 0, countB = 0;
  for (const t of (allTasks||[])) {
    if (!(t.status === "완료" || t.status === "정산완료")) continue;
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    if ((p?.track || "A") !== "A") continue;
    sumB += Number(p?.principal_amount) || 0;
    countB++;
  }

  // 측측 C — PartnerDailySettleTab (측측 측측):
  //   status IN ('완료', '취소', 'visit_only'). 완료만 amount 측측 (취소+visit_only측 0)
  //   = 완료 측 → SUM(principal_amount). 정산완료 측측 측측 (status IN 측측 측 측측).
  let sumC = 0, countC = 0;
  for (const t of (allTasks||[])) {
    if (!["완료","취소","visit_only"].includes(t.status)) continue;
    if (t.status === "취소" || t.status === "visit_only") continue;  // amount=0
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    sumC += Number(p?.principal_amount) || 0;
    countC++;
  }

  console.log(`\n=== 3측 측측 측측 ===`);
  console.log(`  A (PrincipalPaymentHistory 신규):  ${countA}건  ${fmt(sumA)}원`);
  console.log(`  B (SettlementContent.group.total): ${countB}건  ${fmt(sumB)}원`);
  console.log(`  C (PartnerDailySettleTab 측측):    ${countC}건  ${fmt(sumC)}원`);
  console.log(`\n  A vs C diff: ${fmt(sumA - sumC)} (${countA - countC}건)`);
  console.log(`  B vs C diff: ${fmt(sumB - sumC)} (${countB - countC}건)`);
  console.log(`  A vs B diff: ${fmt(sumA - sumB)} (${countA - countB}건)`);

  if (sumA === sumB && sumB === sumC) {
    console.log(`\n  ✓ 3측 측측 측 측측`);
  } else {
    console.log(`\n  ⚠️ 측측 측측 — PartnerDailySettleTab 측측측 측측`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

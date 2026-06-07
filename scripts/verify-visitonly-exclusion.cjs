// 측측 측측측: isRemittanceTarget vs isTrackARemittance 측측 측측측 측측측
//   1) 운영자 입금측측 6/6: 출장비 측측 X + 미입금 측 남양주 측측 측측
//   2) 기사(김현동) 입금측측 6/6: 출장비 측측 X
//   3) 매출 dataset: 출장비 측측 (측측 측측 측측)
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

// 측측 측측 (remitFilter.js 측측)
const COMPLETED_STATUSES = new Set(["완료", "정산완료", "visit_only"]);
function isCompletedStatus(s) { return COMPLETED_STATUSES.has(s); }
function isTrackARemittance(t) {
  if (!t) return false;
  if (!isCompletedStatus(t.status)) return false;
  const track = t.track || t.payment_track || "A";
  return track === "A";
}
function isRemittanceTarget(t) {
  if (!isTrackARemittance(t)) return false;
  return t.status !== "visit_only";
}

(async () => {
  // 6/6 KST 측측 측측 측측 (15:00 UTC 6/5 ~ 15:00 UTC 6/6)
  const { data: rows } = await sb.from("tasks")
    .select(`task_no, customer_name, status, total_amount, completed_at, assigned_engineer_id,
             payments(engineer_amount, track, engineer_remitted_at, engineer_remit_confirmed_at)`)
    .gte("completed_at","2026-06-05T15:00:00Z")
    .lt("completed_at","2026-06-06T15:00:00Z");

  const KIM_ID = "77777777-7777-7777-7777-7777777e0011";

  // normalize task 측측 (payments.track → task.track)
  const tasks = (rows||[]).map(r => {
    const p = Array.isArray(r.payments) ? r.payments[0] : r.payments;
    return {
      task_no: r.task_no, customer: r.customer_name, status: r.status,
      totalAmount: r.total_amount, completedAt: r.completed_at,
      assignedEngineerId: r.assigned_engineer_id,
      engineer_amount: p?.engineer_amount,
      track: p?.track || "A",
      engineerRemittedAt: p?.engineer_remitted_at,
      engineerRemitConfirmedAt: p?.engineer_remit_confirmed_at,
    };
  });

  console.log(`\n=== 6/6 KST 측측 측측 전체: ${tasks.length}건 ===`);

  // 1) 운영자 입금측측 base: isRemittanceTarget 통과 측
  const adminRemitBase = tasks.filter(isRemittanceTarget);
  console.log(`\n[1] 운영자 입금측측 base (isRemittanceTarget): ${adminRemitBase.length}건`);
  for (const t of adminRemitBase) {
    const remitState = t.engineerRemitConfirmedAt ? "confirmed" : (t.engineerRemittedAt ? "reported" : "측측측");
    console.log(`    ${t.task_no} (${t.customer}) status=${t.status}  → ${remitState}`);
  }
  const hasVisitOnly = adminRemitBase.some(t => t.status === "visit_only");
  const hasNamyangju = adminRemitBase.some(t => t.task_no === "YS-260605-001");
  console.log(`    ✓ 출장비 측측 X: ${!hasVisitOnly ? "PASS" : "FAIL"}`);
  console.log(`    ✓ 남양주 측측 (미정산): ${hasNamyangju ? "PASS" : "FAIL"}`);

  // 2) 김현동 6/6 측측
  const kimTasks = tasks.filter(t => t.assignedEngineerId === KIM_ID);
  const kimRemit = kimTasks.filter(isRemittanceTarget);
  console.log(`\n[2] 김현동 6/6 isRemittanceTarget: ${kimRemit.length}건`);
  for (const t of kimRemit) {
    console.log(`    ${t.task_no} (${t.customer}) status=${t.status} eng=${fmt(t.engineer_amount)} total=${fmt(t.totalAmount)}`);
  }
  const kimVisitOnly = kimRemit.filter(t => t.status === "visit_only");
  console.log(`    ✓ 출장비 측측 X: ${kimVisitOnly.length === 0 ? "PASS" : `FAIL (${kimVisitOnly.length}건)`}`);

  // 3) 매출 dataset: isTrackARemittance (출장비 측측 — 측측)
  const revenueBase = tasks.filter(isTrackARemittance);
  const revTotalAll = revenueBase.reduce((s, t) => s + Number(t.totalAmount||0), 0);
  const visitOnlyIn = revenueBase.filter(t => t.status === "visit_only");
  console.log(`\n[3] 매출 dataset (isTrackARemittance): ${revenueBase.length}건 / total=${fmt(revTotalAll)}`);
  console.log(`    측 출장비: ${visitOnlyIn.length}건 / total=${fmt(visitOnlyIn.reduce((s, t) => s + Number(t.totalAmount||0), 0))}`);
  console.log(`    ✓ 매출 측 출장비 측측: ${visitOnlyIn.length > 0 ? "PASS" : "FAIL"}`);

  // 김현동 6/6 송금합계 (운영자 측측, 출장비 측측, NULL 측측 — outstanding 측측측 측측)
  const kimRemitSum = kimRemit.reduce((s, t) => s + (Number(t.totalAmount||0) - Number(t.engineer_amount||0)), 0);
  console.log(`\n[측측] 김현동 6/6 운영자 측측 측측 송금합계(remit base, 출장비 측측): ${fmt(kimRemitSum)}원`);
  console.log(`       (강북구 30K 측측 측. 측측 시 142K, 측측 측 112K)`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });

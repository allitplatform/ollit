// 2026-06-02 — 회사 송금 카드 미입금 표시 버그 측측.
//   2026-06-02 KST 측측 측측 4건 (336,000) 측 engineer_remitted_at / confirmed_at 측측 측측.
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

// KST 2026-06-02 = UTC 2026-06-01 15:00 ~ 2026-06-02 15:00
const KST_START = "2026-06-01T15:00:00Z";
const KST_END   = "2026-06-02T15:00:00Z";

(async () => {
  // 2026-06-02 KST 완료 + 트랙 A (refrigerant 측측 6개 원청 측측)
  const { data: rows, error } = await sb
    .from("tasks")
    .select(`
      id, task_no, customer_name, completed_at, product_price, extra_fee, total_amount,
      assigned_engineer_id,
      payment:payments ( engineer_amount, owner_amount, principal_amount, track,
                          engineer_remitted_at, engineer_remit_confirmed_at, engineer_remit_confirmed_by, status ),
      task_items ( id, subtotal, work_types ( name, service_types ( code ) ) )
    `)
    .gte("completed_at", KST_START)
    .lt("completed_at", KST_END)
    .eq("status", "완료");

  if (error) { console.error(error); process.exit(1); }
  console.log(`KST 2026-06-02 완료 작업: ${(rows || []).length}건`);
  let trackASum = 0, remitted = 0, confirmed = 0;
  for (const r of (rows || [])) {
    const p = Array.isArray(r.payment) ? r.payment[0] : r.payment;
    if (!p) continue;
    const isRefri = (r.task_items || []).some(it => it.work_types?.service_types?.code === "refrigerant");
    const isTrackA = p.track === "A";
    if (!isTrackA) continue;
    const owner = Number(p.owner_amount) || 0;
    const principal = Number(p.principal_amount) || 0;
    const toCompany = owner + principal;
    trackASum += toCompany;
    if (p.engineer_remitted_at) remitted += 1;
    if (p.engineer_remit_confirmed_at) confirmed += 1;
    console.log({
      task_no: r.task_no,
      customer: r.customer_name,
      is_refrigerant: isRefri,
      completed_at: r.completed_at,
      track: p.track,
      engineer_amount: p.engineer_amount,
      owner_amount: p.owner_amount,
      principal_amount: p.principal_amount,
      to_company: toCompany,
      engineer_remitted_at: p.engineer_remitted_at,
      engineer_remit_confirmed_at: p.engineer_remit_confirmed_at,
      engineer_remit_confirmed_by: p.engineer_remit_confirmed_by,
    });
  }
  console.log("");
  console.log(`=== 합계 ===`);
  console.log(`트랙 A 회사 송금액 합: ₩${trackASum.toLocaleString()}`);
  console.log(`remitted (보고 측 측): ${remitted}건`);
  console.log(`confirmed (운영자 측측 측): ${confirmed}건`);
  process.exit(0);
})();

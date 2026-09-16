// 0원 미입금 건 진단 — 기사 송금 탭에서 미입금 ₩0 으로 잡히는 작업 찾기
// 조건 (SettlementHistoryContent / isRemittanceTarget 기준):
//   · payment.track = 'A'
//   · task.status IN ('완료', 'visit_only')  AND status != 'visit_only'  (isRemittanceTarget)
//   · payment.engineer_remitted_at IS NULL  AND payment.engineer_remit_confirmed_at IS NULL
//   · (total_amount - engineer_amount) = 0  → 회사 송금분 0
//
// 출력: 작업번호, 원청, 기사, 총액 / 기사몫 / owner / principal, calc_method, completedAt
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  // Track A + completed + not visit_only + not confirmed/reported
  const { data, error } = await sb.from("tasks")
    .select(`id, task_no, customer_name, status, total_amount, completed_at, assigned_engineer_id,
             principals:principal_id(code, name),
             payments(engineer_amount, principal_amount, owner_amount,
                      track, status, calc_method,
                      engineer_remitted_at, engineer_remit_confirmed_at)`)
    .eq("status", "완료")
    .order("completed_at", { ascending: false })
    .limit(2000);
  if (error) { console.error("FATAL", error); process.exit(1); }

  // 기사 이름 매핑
  const engIds = [...new Set(data.map(t => t.assigned_engineer_id).filter(Boolean))];
  const { data: users } = await sb.from("users").select("id, name").in("id", engIds);
  const uName = new Map((users || []).map(u => [u.id, u.name]));

  const hits = [];
  for (const t of data) {
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    if (!p) continue;
    if (p.track !== "A") continue;
    if (p.engineer_remitted_at) continue;
    if (p.engineer_remit_confirmed_at) continue;
    const total = Number(t.total_amount || 0);
    const eng = Number(p.engineer_amount || 0);
    const remit = Math.max(0, total - eng);
    if (remit !== 0) continue;
    hits.push({ t, p, total, eng, remit });
  }

  console.log(`\n=== 0원 미입금 후보 ${hits.length}건 (status='완료', track=A, 미정산, total-engineer=0) ===\n`);
  for (const h of hits) {
    const { t, p, total, eng } = h;
    console.log(`─── ${t.task_no} (${t.customer_name}) ───`);
    console.log(`  원청: ${t.principals?.code} (${t.principals?.name})  기사: ${uName.get(t.assigned_engineer_id) || "—"}`);
    console.log(`  completed_at: ${t.completed_at}`);
    console.log(`  total=${fmt(total)}  engineer=${fmt(eng)}  owner=${fmt(p.owner_amount)}  principal=${fmt(p.principal_amount)}`);
    console.log(`  payment.calc_method: ${p.calc_method}  payment.status: ${p.status}`);
    console.log(`  → 회사 송금분 = total - engineer = ${fmt(total - eng)}`);
    console.log("");
  }
  console.log(`총 ${hits.length}건`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });

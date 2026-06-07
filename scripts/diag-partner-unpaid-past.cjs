// KA/crikrin 이번달 미지급 (대기) — 오늘 측측
//   측측: 측측 측측 측 PrincipalPaymentHistory 동측 (Track A, visit_only 측측, 완료+정산완료)
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();

function toKstYmd(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date(d));
}

(async () => {
  const today = toKstYmd(new Date());
  const ym = today.slice(0, 7);
  const startKst = `${ym}-01`;
  const startUtc = new Date(`${startKst}T00:00:00+09:00`).toISOString();
  const [y, m] = ym.split("-").map(Number);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const endUtc = new Date(`${nextY}-${String(nextM).padStart(2,"0")}-01T00:00:00+09:00`).toISOString();

  console.log(`\n=== 측측: ${startKst} (KST) ~ ${today} (KST) 측측 [오늘 측측] ===\n`);

  // [1] principals
  const { data: pData } = await sb.from("principals").select("id, code, name").in("code", ["KA","crikrin"]);
  const pids = pData.map(p => p.id);
  const pByCode = Object.fromEntries(pData.map(p => [p.code, p]));

  // [2] tasks — 이번달 측측 + KA/crikrin
  const { data: tasks } = await sb.from("tasks")
    .select(`task_no, status, completed_at, principal_id, principals:principal_id(code, name),
             payments(principal_amount, track)`)
    .in("principal_id", pids)
    .gte("completed_at", startUtc).lt("completed_at", endUtc)
    .neq("status", "취소");

  // 측측 측측 (Track A, visit_only 측측, 완료+정산완료)
  const filtered = (tasks||[]).filter(t => {
    if (t.status === "visit_only") return false;
    if (!(t.status === "완료" || t.status === "정산완료")) return false;
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    return (p?.track || "A") === "A";
  });

  // (날짜 KST, principal_id) 측측 정산금 + 측측
  const dailyMap = new Map();  // key: ymd|pid → { total, count }
  for (const t of filtered) {
    const ymd = toKstYmd(t.completed_at);
    if (ymd >= today) continue;   // ★ 오늘 측측 (사장님 spec)
    const key = `${ymd}|${t.principal_id}`;
    if (!dailyMap.has(key)) dailyMap.set(key, { ymd, principal_id: t.principal_id, total: 0, count: 0 });
    const cell = dailyMap.get(key);
    const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    cell.total += Number(p?.principal_amount) || 0;
    cell.count += 1;
  }

  // [3] 측측 principal_daily_remittances — 이번달, 측측 측측
  const { data: remits } = await sb.from("principal_daily_remittances")
    .select("principal_id, settle_date, remitted_amount, remitted_at, remitted_by")
    .in("principal_id", pids)
    .gte("settle_date", startKst);
  const remitSet = new Set((remits||[]).map(r => `${r.principal_id}|${r.settle_date}`));

  // [4] 측측측 = dailyMap 측 (정산금 > 0) - remitSet 측 측측 측측
  const unpaid = [];
  for (const [k, cell] of dailyMap.entries()) {
    if (cell.total <= 0) continue;
    if (remitSet.has(`${cell.principal_id}|${cell.ymd}`)) continue;
    unpaid.push(cell);
  }
  unpaid.sort((a, b) => a.ymd.localeCompare(b.ymd) || (a.principal_id||"").localeCompare(b.principal_id||""));

  // [5] 출력
  const codeById = Object.fromEntries(pData.map(p => [p.id, p.code]));
  const nameById = Object.fromEntries(pData.map(p => [p.id, p.name]));
  console.log(`측측 측측: ${unpaid.length}건\n`);
  if (unpaid.length === 0) {
    console.log("측측 측측 측측 측측 측측 측측 (모두 지급 측측 측측 정산금 0).");
  } else {
    console.log("측측 측측표:");
    console.log("  날짜         | 원청      | 완료측수 | 정산금");
    console.log("  -------------|-----------|----------|------------");
    let sum = 0;
    for (const r of unpaid) {
      const code = codeById[r.principal_id] || "?";
      const name = nameById[r.principal_id] || code;
      console.log(`  ${r.ymd} | ${code.padEnd(9)} | ${String(r.count).padStart(7)}건 | ${fmt(r.total).padStart(9)}원   (${name})`);
      sum += r.total;
    }
    console.log("  -------------|-----------|----------|------------");
    console.log(`  측측 ${unpaid.length}건 / 합계 ${fmt(sum)}원`);

    // 측측측 측측
    const byPrincipal = {};
    for (const r of unpaid) {
      const code = codeById[r.principal_id] || "?";
      if (!byPrincipal[code]) byPrincipal[code] = { count: 0, total: 0 };
      byPrincipal[code].count++;
      byPrincipal[code].total += r.total;
    }
    console.log("\n측측측 측측:");
    for (const [code, v] of Object.entries(byPrincipal)) {
      console.log(`  ${code}: ${v.count}건 / ${fmt(v.total)}원`);
    }
  }

  // [6] 측측 측측 측측측 — 이번달 측측 측측 측측 측측 (백업측측)
  console.log(`\n=== 측측 principal_daily_remittances (백업측측, 이번달 측측) ===`);
  console.log(`측측: ${(remits||[]).length}건`);
  for (const r of (remits||[])) {
    console.log(`  ${r.settle_date} ${codeById[r.principal_id]||"?"} amount=${fmt(r.remitted_amount)} at=${r.remitted_at?.slice(0,16)}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

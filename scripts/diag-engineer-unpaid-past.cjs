// 측측→회사 측측 측측측 측측 측측 — 측측측 측측 (오늘 측측)
//   측측: isRemittanceTarget (Track A + 측측 + visit_only 측측)
//   pending: engineer_remitted_at 측측
//   reported: engineer_remitted_at 측측 + engineer_remit_confirmed_at 측측
//   confirmed: engineer_remit_confirmed_at 측측 → 측측측
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

  console.log(`\n=== 측측→회사 측측측 (측측 측측 측측측, 오늘 ${today} 측측) ===\n`);
  console.log(`측측: isRemittanceTarget(Track A + 완료/정산완료, visit_only 측측), engineer_remit_confirmed_at IS NULL`);

  // 측측 측측측 (페이지측측측측, 1000행 캡 측측)
  const PAGE = 1000;
  let rows = [];
  for (let page = 0; page < 20; page++) {
    const off = page * PAGE;
    const { data, error } = await sb.from("tasks")
      .select(`task_no, status, completed_at, assigned_engineer_id,
               assigned_engineer:users!assigned_engineer_id(name, code),
               payments(track, engineer_remitted_at, engineer_remit_confirmed_at, engineer_amount)`)
      .in("status", ["완료", "정산완료"])
      .order("completed_at", { ascending: false })
      .range(off, off + PAGE - 1);
    if (error) { console.error("측측 측측:", error); process.exit(1); }
    if (!data || data.length === 0) break;
    rows = rows.concat(data);
    if (data.length < PAGE) break;
  }

  // 측측: Track A, confirmed 측측, completed < today
  const eligible = rows.filter(r => {
    const p = Array.isArray(r.payments) ? r.payments[0] : r.payments;
    if ((p?.track || "A") !== "A") return false;
    if (p?.engineer_remit_confirmed_at) return false;  // confirmed 측측측
    if (!r.completed_at) return false;
    const kst = toKstYmd(r.completed_at);
    if (!kst || kst >= today) return false;  // 오늘 측측
    return true;
  });

  function classify(r) {
    const p = Array.isArray(r.payments) ? r.payments[0] : r.payments;
    return p?.engineer_remitted_at ? "reported" : "pending";
  }

  // 측측 분측: 측측 측 / 측측
  function aggregate(list) {
    const byStatus = { pending: 0, reported: 0 };
    const totalByStatus = { pending: 0, reported: 0 };
    const byEng = {}; // code → { name, pending: {n, sum}, reported: {n, sum} }
    for (const r of list) {
      const p = Array.isArray(r.payments) ? r.payments[0] : r.payments;
      const cls = classify(r);
      const eng = Number(p?.engineer_amount) || 0;
      byStatus[cls] += 1;
      totalByStatus[cls] += eng;
      const name = r.assigned_engineer?.name || "(미배정)";
      const code = r.assigned_engineer?.code || "?";
      if (!byEng[code]) byEng[code] = { name, code, pending: { n: 0, sum: 0 }, reported: { n: 0, sum: 0 } };
      byEng[code][cls].n += 1;
      byEng[code][cls].sum += eng;
    }
    return { byStatus, totalByStatus, byEng, count: list.length };
  }

  const thisMonth = eligible.filter(r => toKstYmd(r.completed_at).startsWith(ym));
  const all = eligible;

  function report(label, agg) {
    console.log(`\n${label}:`);
    console.log(`  pending  (측측 측측측): ${agg.byStatus.pending}건  /  측측 측 ${fmt(agg.totalByStatus.pending)}원`);
    console.log(`  reported (측측측 측측): ${agg.byStatus.reported}건  /  측측 측 ${fmt(agg.totalByStatus.reported)}원`);
    console.log(`  ──`);
    console.log(`  측측: ${agg.count}건  /  측측 합계 ${fmt(agg.totalByStatus.pending + agg.totalByStatus.reported)}원`);
    console.log(`\n  측측측 측측 (측측측 측측측 측측):`);
    const ranked = Object.values(agg.byEng).sort((a, b) => {
      return (b.pending.sum + b.reported.sum) - (a.pending.sum + a.reported.sum);
    });
    console.log(`     code   측측         pending      reported     측측합`);
    for (const e of ranked) {
      const totN = e.pending.n + e.reported.n;
      const totS = e.pending.sum + e.reported.sum;
      console.log(`     ${e.code.padEnd(5)}  ${(e.name||"?").padEnd(10)}  ${String(e.pending.n).padStart(2)}건/${fmt(e.pending.sum).padStart(9)}  ${String(e.reported.n).padStart(2)}건/${fmt(e.reported.sum).padStart(9)}  ${String(totN).padStart(2)}건/${fmt(totS).padStart(9)}`);
    }
  }

  report(`[① 이번달 (${ym})]`, aggregate(thisMonth));
  report(`[② 측측 (측측 측측)]`, aggregate(all));
})().catch(e => { console.error("FATAL", e); process.exit(1); });

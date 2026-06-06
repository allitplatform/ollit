// 김현동 기사 오늘(KST) 작업 기사수익/회사수익 검증 — 변경 X.
//   1) 김현동 user_id
//   2) 오늘 KST 배정 작업 측측 (완료/진행중/확정 측측)
//   3) actual vs expected 비교, 안 측측 건 ⚠️ 플래그
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function toKstYmd(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit" }).format(d);
}
function kstTodayUtc() {
  const ymd = toKstYmd(new Date());
  const start = new Date(`${ymd}T00:00:00+09:00`);
  const end = new Date(start.getTime()); end.setDate(end.getDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString(), ymd };
}

const fmt = (n) => n == null ? "—" : (Math.round(Number(n))).toLocaleString();

(async () => {
  // [1] 김현동 user
  const { data: users } = await sb.from("users").select("id, code, name, phone").ilike("name", "%김현동%");
  if (!users || users.length === 0) { console.log("김현동 측측"); return; }
  const kim = users[0];
  console.log(`\n=== 김현동 ===`);
  console.log(`  id=${kim.id} code=${kim.code} phone=${kim.phone}`);
  if (users.length > 1) console.log(`  ⚠️ ${users.length}명 측측 — 측측 ${kim.code} 측측`);

  // [2] 오늘 KST 배정/확정/측측측/완료 — scheduled_at OR completed_at OR (status='완료' AND completed_at)
  const { startISO, endISO, ymd } = kstTodayUtc();
  console.log(`\n=== 오늘 KST = ${ymd} (UTC range ${startISO} ~ ${endISO}) ===\n`);

  // scheduled_at 오늘 측측 OR completed_at 오늘 측측 (측측측 측측)
  const { data: schedToday, error: e1 } = await sb
    .from("tasks")
    .select(`id, task_no, status, scheduled_at, completed_at, total_amount, product_price, extra_fee, travel_fee, category_data,
             principal_id, principals:principal_id(code, name),
             task_items(id, qty, unit_price, subtotal, order_type, received_amount,
                        work_types(name, service_types(code)),
                        appliance_types(name)),
             payments(calc_method, policy_key, track, engineer_amount, principal_amount, owner_amount, computed_at, is_balanced, status)`)
    .eq("assigned_engineer_id", kim.id)
    .gte("scheduled_at", startISO).lt("scheduled_at", endISO);
  const { data: doneToday, error: e2 } = await sb
    .from("tasks")
    .select(`id, task_no, status, scheduled_at, completed_at, total_amount, product_price, extra_fee, travel_fee, category_data,
             principal_id, principals:principal_id(code, name),
             task_items(id, qty, unit_price, subtotal, order_type, received_amount,
                        work_types(name, service_types(code)),
                        appliance_types(name)),
             payments(calc_method, policy_key, track, engineer_amount, principal_amount, owner_amount, computed_at, is_balanced, status)`)
    .eq("assigned_engineer_id", kim.id)
    .gte("completed_at", startISO).lt("completed_at", endISO);

  if (e1) console.log("e1:", e1.message);
  if (e2) console.log("e2:", e2.message);
  console.log(`schedToday=${(schedToday||[]).length}  doneToday=${(doneToday||[]).length}`);

  // dedup
  const map = new Map();
  for (const t of (schedToday||[])) map.set(t.id, t);
  for (const t of (doneToday||[])) map.set(t.id, t);
  const tasks = [...map.values()].sort((a,b) => (b.completed_at||b.scheduled_at||"").localeCompare(a.completed_at||a.scheduled_at||""));

  console.log(`측측: ${tasks.length}건\n`);

  let sumPrincipal = 0, sumEngineer = 0, sumOwner = 0, sumTotal = 0, sumExtra = 0, sumReceived = 0;

  for (const t of tasks) {
    const items = t.task_items || [];
    const main = items.find(it => it.order_type === "본작업") || items[0] || null;
    const mainSvc = main?.work_types?.service_types?.code || "?";
    const addons = items.filter(it => it !== main);
    const addonSvcs = addons.map(it => it.work_types?.service_types?.code || "?").join(",");
    const pcode = t.principals?.code || "?";
    const pmt = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    // refrigerant_rate 측 payments 측측 측측 — category_data 측 측측측 측측 fallback.
    const refrigRate = t.category_data?.refrigerantRate ?? t.category_data?.refrigerant_rate ?? null;

    // received_amount sum (per_item) — 측측 측측측 측측 측 총측
    const receivedSum = items.reduce((s, it) => s + (Number(it.received_amount) || 0), 0);

    // 기대값 계산 (간략 — 측측 측측 측측)
    const expected = computeExpected(t, items, pcode, pmt);

    sumPrincipal += Number(pmt?.principal_amount) || 0;
    sumEngineer  += Number(pmt?.engineer_amount)  || 0;
    sumOwner     += Number(pmt?.owner_amount)     || 0;
    sumTotal     += Number(t.total_amount)        || 0;
    sumExtra     += Number(t.extra_fee)           || 0;
    sumReceived  += receivedSum;

    console.log(`─── ${t.task_no} (${t.status}) ───`);
    console.log(`  principal: ${pcode} / 측측: ${mainSvc}${addonSvcs ? ` + ${addonSvcs}` : ""}`);
    console.log(`  total=${fmt(t.total_amount)}  product=${fmt(t.product_price)}  extra(현장추가)=${fmt(t.extra_fee)}  travel=${fmt(t.travel_fee)}  received(items합)=${fmt(receivedSum)}`);
    console.log(`  payments: calc=${pmt?.calc_method || "—"} track=${pmt?.track || "—"} refrig_rate=${refrigRate ?? "—"} status=${pmt?.status || "—"} computed=${pmt?.computed_at?.slice(0,16) || "—"}`);
    console.log(`  ACTUAL    principal=${fmt(pmt?.principal_amount)}  engineer=${fmt(pmt?.engineer_amount)}  owner=${fmt(pmt?.owner_amount)}`);
    if (expected) {
      console.log(`  EXPECTED  principal=${fmt(expected.principal)}  engineer=${fmt(expected.engineer)}  owner=${fmt(expected.owner)}  (rule: ${expected.rule})`);
      const flags = [];
      if (Math.abs((pmt?.principal_amount||0) - expected.principal) > 1) flags.push(`principal diff=${(pmt?.principal_amount||0) - expected.principal}`);
      if (Math.abs((pmt?.engineer_amount||0)  - expected.engineer)  > 1) flags.push(`engineer diff=${(pmt?.engineer_amount||0) - expected.engineer}`);
      if (Math.abs((pmt?.owner_amount||0)     - expected.owner)     > 1) flags.push(`owner diff=${(pmt?.owner_amount||0) - expected.owner}`);
      // 합계 검증
      const sumActual = (pmt?.principal_amount||0) + (pmt?.engineer_amount||0) + (pmt?.owner_amount||0);
      const baseSum = expected.base;
      if (Math.abs(sumActual - baseSum) > 1) flags.push(`sum diff = ${sumActual} - ${baseSum} = ${sumActual - baseSum}`);
      if (flags.length > 0) console.log(`  ⚠️ ${flags.join(" / ")}`);
      else                  console.log(`  ✓ 매측`);
    } else {
      console.log(`  (측측측 측측 — 측측 측측)`);
    }
    console.log("");
  }

  console.log("=== 합계 ===");
  console.log(`  total=${fmt(sumTotal)}  extra=${fmt(sumExtra)}  received(items)=${fmt(sumReceived)}`);
  console.log(`  principal=${fmt(sumPrincipal)}  engineer=${fmt(sumEngineer)}  owner=${fmt(sumOwner)}`);
  console.log(`  합계 (principal+engineer+owner) = ${fmt(sumPrincipal + sumEngineer + sumOwner)}`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────
// 측측 측측 측측 (사장님 spec 측측)
// ─────────────────────────────────────────────────────────────────
function computeExpected(t, items, pcode, pmt) {
  const total    = Number(t.total_amount) || 0;
  const product  = Number(t.product_price) || 0;
  const extra    = Number(t.extra_fee) || 0;
  const received = items.reduce((s, it) => s + (Number(it.received_amount) || 0), 0);

  const main = items.find(it => it.order_type === "본작업") || items[0] || null;
  const mainSvc = main?.work_types?.service_types?.code || "";

  // base = 측측 측측 (received 측측 측측 → received, 측측 → total)
  const base = received > 0 ? received : total;

  // usol_n 측측 — 측측측: 기사85 / 원청15 / 회사0 (사장님 spec)
  if (pcode === "usol_n" && mainSvc === "cleaning") {
    // 측측 = product (측측측측 측측 측측측)
    // 측측측 = extra_fee
    const pPrincipal = Math.floor(product * 0.15) + Math.floor(extra * 0.15);
    const pEngineer  = (product - Math.floor(product * 0.15)) + (extra - Math.floor(extra * 0.15));
    const pOwner     = 0;
    return { base: pPrincipal + pEngineer + pOwner, principal: pPrincipal, engineer: pEngineer, owner: pOwner, rule: "usol_n 세척: 원청 FLOOR(.×0.15), 기사 나머지, 회사 0" };
  }
  // usol_n 측측 (본작업 측측측)
  if (pcode === "usol_n" && mainSvc === "refrigerant") {
    // 측측 직영 = 기사 100%
    return { base, principal: 0, engineer: base, owner: 0, rule: "usol_n 측측 본작업: 기사 100%" };
  }
  // KB 측측 (35/50/15)
  if (pcode === "KB" && mainSvc === "refrigerant") {
    return { base, principal: Math.floor(base*0.35), engineer: Math.floor(base*0.50), owner: base - Math.floor(base*0.35) - Math.floor(base*0.50), rule: "KB 측측: 35/50/15" };
  }
  // allday 측측 (50/50)
  if (pcode === "allday" && mainSvc === "refrigerant") {
    return { base, principal: 0, engineer: Math.floor(base*0.50), owner: base - Math.floor(base*0.50), rule: "allday 측측 직영: 50/50" };
  }
  return null;
}

// compute_payment v19 (refrigerant 단순화) 회귀 영향 조사
//
// 새 규칙:
//   refrigerant 분기 측 → engineer = (product_price + extra_fee) × refrigerant_rate / 100
//                          principal = 정책대로 (정액/비율/직영 모두)
//                          owner     = GREATEST(total − eng − prin, 0)
//
// 조사 항목:
//   [1] 6 원청 refrigerant 정책 전건 (calc_method / fee_rate / principal_fee)
//   [2] 현재 운영 중 refrigerant payments 분포
//       — task 별 (현재 eng, 새 eng) 차이
//       — 차이 0인 비율 (직영_50_50 + extra 적용된 케이스 = 0 기대)
//       — 차이 +/- 큰 케이스 식별
//   [3] owner 음수 가능 케이스 검출 (가드 적용 전 / 후 비교)
//   [4] usol_n addon 분기 (refrigerant 점검 → 'addon' 변환) 영향 확인
//   [5] KB / allday / KA / 등 refrigerant 정책 디테일 — 사장님 확인용
//
// 실행: node scripts/diag-v19-regression.cjs

const fs = require("fs"), path = require("path");
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
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

(async () => {
  // [1] 전 원청 refrigerant 정책
  console.log("=".repeat(95));
  console.log("[1] 전 원청 refrigerant 정책 (commission_policies)");
  console.log("=".repeat(95));
  const { data: pols } = await sb.from("commission_policies")
    .select("principal_code, appliance_code, qty_condition, calc_method, fee_rate, principal_fee, policy_key")
    .eq("service_code", "refrigerant")
    .order("principal_code")
    .order("appliance_code");

  const byPri = new Map();
  for (const p of (pols || [])) {
    if (!byPri.has(p.principal_code)) byPri.set(p.principal_code, []);
    byPri.get(p.principal_code).push(p);
  }
  for (const [pri, list] of byPri) {
    console.log(`\n  ${pri}:`);
    for (const p of list) {
      console.log(`    ${(p.appliance_code || "(null)").padEnd(8)} qty=${p.qty_condition || "-"} → ${p.calc_method.padEnd(14)} fee_rate=${p.fee_rate ?? "-"} principal_fee=${p.principal_fee ?? "-"} key=${p.policy_key}`);
    }
  }

  // [2] 현재 운영 중 refrigerant payments — 시뮬레이션
  console.log("\n" + "=".repeat(95));
  console.log("[2] 운영 refrigerant payments 시뮬레이션 (v18 현재 → v19 새 규칙)");
  console.log("=".repeat(95));

  // refrigerant service_type id
  const { data: refSvc } = await sb.from("service_types").select("id").eq("code", "refrigerant").single();
  // refrigerant work_type ids
  const { data: refWts } = await sb.from("work_types").select("id").eq("service_type_id", refSvc.id);
  const refWtIds = refWts.map(w => w.id);

  // refrigerant task_items 측 task ids 측 (단일 service-type task만 = pure refrigerant)
  const allTaskIds = new Set();
  for (let i = 0; i < refWtIds.length; i += 50) {
    const batch = refWtIds.slice(i, i + 50);
    const { data } = await sb.from("task_items").select("task_id").in("work_type_id", batch);
    for (const r of (data || [])) allTaskIds.add(r.task_id);
  }
  console.log(`  refrigerant 측 task_items 측 task: ${allTaskIds.size}건`);

  // 측 task 측 payments + tasks + items + engineer rate 측 일괄 fetch
  const taskIdsArr = [...allTaskIds];
  const taskMap = new Map();
  for (let i = 0; i < taskIdsArr.length; i += 200) {
    const batch = taskIdsArr.slice(i, i + 200);
    const { data } = await sb.from("tasks")
      .select("id, task_no, status, principal_id, product_price, extra_fee, travel_fee, assigned_engineer_id")
      .in("id", batch);
    for (const t of (data || [])) taskMap.set(t.id, t);
  }
  const payMap = new Map();
  for (let i = 0; i < taskIdsArr.length; i += 200) {
    const batch = taskIdsArr.slice(i, i + 200);
    const { data } = await sb.from("payments")
      .select("task_id, engineer_amount, principal_amount, owner_amount, calc_method, policy_key, product_price, extra_fee, travel_fee, status, track")
      .in("task_id", batch);
    for (const p of (data || [])) payMap.set(p.task_id, p);
  }
  // task_items 측 측 refrigerant + non-refrigerant 측 catch (pure refrigerant task 만)
  const itemsByTask = new Map();
  for (let i = 0; i < taskIdsArr.length; i += 200) {
    const batch = taskIdsArr.slice(i, i + 200);
    const { data } = await sb.from("task_items")
      .select("task_id, work_type_id, appliance_type_id, qty, unit_price, subtotal, is_canceled, order_type")
      .in("task_id", batch);
    for (const it of (data || [])) {
      if (!itemsByTask.has(it.task_id)) itemsByTask.set(it.task_id, []);
      itemsByTask.get(it.task_id).push(it);
    }
  }
  // principals
  const { data: prins } = await sb.from("principals").select("id, code");
  const prinMap = new Map(prins.map(p => [p.id, p.code]));

  // engineer refrigerant_rate
  const engRates = new Map();
  const engIds = [...new Set([...taskMap.values()].map(t => t.assigned_engineer_id).filter(Boolean))];
  for (let i = 0; i < engIds.length; i += 100) {
    const batch = engIds.slice(i, i + 100);
    const { data } = await sb.from("users").select("id, refrigerant_rate").in("id", batch);
    for (const u of (data || [])) engRates.set(u.id, u.refrigerant_rate ?? 50);
  }

  // policy lookup helper
  const polKey = (pri, app) => `${pri}::${app}`;
  const polByKey = new Map();
  for (const p of (pols || [])) polByKey.set(polKey(p.principal_code, p.appliance_code), p);

  // appliance_types
  const { data: appTypes } = await sb.from("appliance_types").select("id, code");
  const appCodeById = new Map(appTypes.map(a => [a.id, a.code]));

  // pure refrigerant task 분류 — 측 active(=NOT canceled) items 측 service_type 측 측 refrigerant인 task
  const pureRefriTaskIds = [];
  for (const tid of taskIdsArr) {
    const its = (itemsByTask.get(tid) || []).filter(it => !it.is_canceled);
    if (its.length === 0) continue;
    const allRefri = its.every(it => refWtIds.includes(it.work_type_id));
    if (allRefri) pureRefriTaskIds.push(tid);
  }
  console.log(`  pure refrigerant task (active items 측 전건 refrigerant): ${pureRefriTaskIds.length}건`);

  // 시뮬레이션
  const buckets = {
    diff_zero: 0,           // v18 == v19
    diff_pos: 0,            // v19 측 더 큼 (engineer 측 더 많음)
    diff_neg: 0,            // v19 측 더 적음
    owner_neg_v19: 0,       // v19 측 owner 음수 (가드 적용 전)
    owner_neg_clamped: [],  // 가드 적용 후 0 측 떨어진 케이스 (정보 dump)
    by_principal: new Map(),
    sample_pos: [],
    sample_neg: [],
  };

  for (const tid of pureRefriTaskIds) {
    const t = taskMap.get(tid);
    const p = payMap.get(tid);
    if (!t || !p) continue;

    const product = Number(t.product_price) || 0;
    const extra   = Number(t.extra_fee)     || 0;
    const travel  = Number(t.travel_fee)    || 0;
    const total   = product + extra;  // travel은 v18 측 engineer 측 100% 별도 합산. 새 규칙도 동일 (refrigerant 분기는 product+extra만 다룸).

    const rate = t.assigned_engineer_id ? (engRates.get(t.assigned_engineer_id) ?? 50) : 50;
    const newEng = Math.floor(total * rate / 100) + travel;  // travel_fee = 기사 100%

    // v19 측 principal 측 = 측 정책대로. 측 단일품목 측 측 측 측 우리 측 측 정책 측 측 측 측 측 측 정확 계산 측 측 측:
    //   - 정액 → principal = principal_fee
    //   - 비율_견적금액 → principal = total × fee_rate
    //   - 직영_50_50 → principal = 0 (principal_fee=0)
    // 측 단순 측 측 추정. 측 다중품목 task 측 부정확. 회귀 측 측 측 측 측 측 측 측.
    const items = (itemsByTask.get(tid) || []).filter(it => !it.is_canceled);
    let newPrin = 0;
    for (const it of items) {
      const appCode = appCodeById.get(it.appliance_type_id) || null;
      const pri = prinMap.get(t.principal_id);
      const pol = polByKey.get(polKey(pri, appCode));
      if (!pol) continue;
      const sub = Number(it.unit_price || 0) * Number(it.qty || 1);
      // 단일품목 가정 — extra 측 측 측 측 비율형 측 측 측 흡수, 정액 측 측 흡수 X
      if (pol.calc_method === "정액") {
        newPrin += Number(pol.principal_fee || 0);
      } else if (pol.calc_method === "비율_견적금액") {
        // 측 단일품목 측 측 unit + extra, multi 측 측 측 측 측 측 측 측
        const ratioBase = items.length === 1 ? (sub + extra) : sub;
        newPrin += Math.floor(ratioBase * Number(pol.fee_rate || 0));
      } else if (pol.calc_method === "직영_50_50") {
        newPrin += Number(pol.principal_fee || 0);  // 측 측 0
      } else {
        // 기타 calc_method — 측 측 측 측 측 측 측 측
        newPrin += p.principal_amount || 0;
      }
    }

    const newOwnerRaw = total + travel - newEng - newPrin;
    const newOwnerClamped = Math.max(0, newOwnerRaw);

    const oldEng = p.engineer_amount || 0;
    const oldPrin = p.principal_amount || 0;
    const oldOwner = p.owner_amount || 0;
    const diff = newEng - oldEng;

    if (diff === 0) buckets.diff_zero++;
    else if (diff > 0) {
      buckets.diff_pos++;
      if (buckets.sample_pos.length < 6) buckets.sample_pos.push({ task_no: t.task_no, pri: prinMap.get(t.principal_id), total, rate, oldEng, newEng, diff });
    } else {
      buckets.diff_neg++;
      if (buckets.sample_neg.length < 6) buckets.sample_neg.push({ task_no: t.task_no, pri: prinMap.get(t.principal_id), total, rate, oldEng, newEng, diff });
    }

    if (newOwnerRaw < 0) {
      buckets.owner_neg_v19++;
      if (buckets.owner_neg_clamped.length < 6) buckets.owner_neg_clamped.push({ task_no: t.task_no, pri: prinMap.get(t.principal_id), total, newEng, newPrin, newOwnerRaw, newOwnerClamped });
    }

    const pri = prinMap.get(t.principal_id);
    if (!buckets.by_principal.has(pri)) buckets.by_principal.set(pri, { count: 0, diff_zero: 0, diff_nonzero: 0, sum_diff: 0 });
    const b = buckets.by_principal.get(pri);
    b.count++;
    if (diff === 0) b.diff_zero++;
    else { b.diff_nonzero++; b.sum_diff += diff; }
  }

  console.log(`\n  시뮬레이션 결과 (pure refrigerant ${pureRefriTaskIds.length}건):`);
  console.log(`    diff_zero (v18 == v19): ${buckets.diff_zero}건`);
  console.log(`    diff_pos (v19 > v18, eng ↑): ${buckets.diff_pos}건`);
  console.log(`    diff_neg (v19 < v18, eng ↓): ${buckets.diff_neg}건`);

  console.log(`\n  by_principal:`);
  for (const [pri, b] of buckets.by_principal) {
    console.log(`    ${pri.padEnd(10)} 측 total=${b.count} unchanged=${b.diff_zero} changed=${b.diff_nonzero} sum_diff(eng)=${b.sum_diff.toLocaleString()}`);
  }

  console.log(`\n  v19 측 engineer 측 측 큰 케이스 sample:`);
  for (const s of buckets.sample_pos) {
    console.log(`    ${s.task_no} ${s.pri} total=${s.total.toLocaleString()} rate=${s.rate} oldEng=${s.oldEng.toLocaleString()} newEng=${s.newEng.toLocaleString()} diff=+${s.diff.toLocaleString()}`);
  }
  console.log(`\n  v19 측 engineer 측 측 적은 케이스 sample:`);
  for (const s of buckets.sample_neg) {
    console.log(`    ${s.task_no} ${s.pri} total=${s.total.toLocaleString()} rate=${s.rate} oldEng=${s.oldEng.toLocaleString()} newEng=${s.newEng.toLocaleString()} diff=${s.diff.toLocaleString()}`);
  }

  console.log(`\n  owner 음수 가능 (가드 전): ${buckets.owner_neg_v19}건`);
  for (const o of buckets.owner_neg_clamped) {
    console.log(`    ${o.task_no} ${o.pri} total=${o.total.toLocaleString()} newEng=${o.newEng.toLocaleString()} newPrin=${o.newPrin.toLocaleString()} ownerRaw=${o.newOwnerRaw.toLocaleString()} → clamped=${o.newOwnerClamped}`);
  }

  // [3] usol_n addon 변환 분기 — refrigerant 점검 측 'addon' 측 측 측 측 측. 측 측 측 측 측 측 측.
  console.log("\n" + "=".repeat(95));
  console.log("[3] usol_n 측 refrigerant '추가선택' (addon 변환) — v18 측 측 측 측 측. v19 측 측 측 측 측 측.");
  console.log("=".repeat(95));
  const usolNAddonItems = [];
  for (const tid of taskIdsArr) {
    const t = taskMap.get(tid);
    if (!t || prinMap.get(t.principal_id) !== "usol_n") continue;
    const its = (itemsByTask.get(tid) || []).filter(it => !it.is_canceled && it.order_type === "추가선택");
    if (its.length) usolNAddonItems.push({ task_no: t.task_no, items: its });
  }
  console.log(`  usol_n + refrigerant + 추가선택 task: ${usolNAddonItems.length}건 (v18 측 'usol_n_추가선택' calc_method 측 측 측 측 측 측)`);
  console.log(`  → 본 v19 측 측 측 분기는 그대로 (refrigerant_rate override 측 'usol_n_추가선택' != 측 측 측 측 측 측 측 측).`);
})().catch(e => console.log("FATAL:", e.message, e.stack));

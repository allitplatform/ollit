// 냉매 60% 기사 — 오늘(2026-06-08) 완료 3건 정산 어긋남 진단
// 용산구4527 (engineer=108,000 정상) / 강북구9810 (60,000 이상) / 강남구6429 (0)
//
// 출력:
//   각 task: id, task_no, principal_code, status, completed_at,
//            product_price + extra_fee + travel_fee = total,
//            assigned_engineer name + refrigerant_rate,
//            task_items (qty, unit_price, subtotal, received_amount, order_type, service_code, is_canceled),
//            payments (engineer/principal/owner, calc_method, computed_at, created_at, track)
//   가설 ① 총금액 변경 후 재계산 누락 (receipt vs subtotal diff)
//   가설 ② rate 0/옛값
//   가설 ③ principal_code 다름
//
// 실행: node scripts/diag-refri-60-3tasks.cjs

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

const KEYWORDS = ["용산구", "강북구", "강남구"];
const EXPECT = {
  "용산구": { engineer: 108000, note: "정상" },
  "강북구": { engineer: 60000,  note: "어긋남" },
  "강남구": { engineer: 0,      note: "어긋남(0원)" },
};

// 오늘 KST 범위 (UTC 기준 2026-06-07 15:00 ~ 2026-06-08 15:00)
const TODAY_KST_START = "2026-06-07T15:00:00.000Z";
const TODAY_KST_END   = "2026-06-08T15:00:00.000Z";

(async () => {
  console.log("=".repeat(90));
  console.log("냉매 60% 3건 정산 어긋남 진단 — " + new Date().toISOString());
  console.log("KST 오늘 범위: " + TODAY_KST_START + " ~ " + TODAY_KST_END);
  console.log("=".repeat(90));

  // 1) 오늘 완료 task 후보 — 주소 키워드 매칭
  // tasks 컬럼: id, task_no, status, principal_id, assigned_engineer_id, product_price, extra_fee, travel_fee
  //              customer_name, address (또는 customer_address), updated_at, completed_at
  const candidates = [];
  for (const kw of KEYWORDS) {
    // address 컬럼명 후보 시도
    const { data: byAddr } = await sb.from("tasks")
      .select("*")
      .ilike("address", `%${kw}%`)
      .gte("updated_at", TODAY_KST_START)
      .lte("updated_at", TODAY_KST_END);
    if (byAddr && byAddr.length) {
      for (const t of byAddr) candidates.push({ kw, t, src: "address" });
    }
  }

  // 키워드 + 4자리 숫자 매칭으로 재필터
  const SUFFIX = { "용산구": "4527", "강북구": "9810", "강남구": "6429" };
  const hits = [];
  for (const c of candidates) {
    const addr = (c.t.address || "") + " " + (c.t.customer_name || "");
    if (addr.includes(SUFFIX[c.kw])) {
      hits.push({ kw: c.kw, suffix: SUFFIX[c.kw], task: c.t });
    }
  }

  if (hits.length < 3) {
    console.log(`\n⚠️ address+4자리 매칭 ${hits.length}건 — 보조 검색 (status=완료 + 오늘 + 냉매)`);
    // 보조: status=완료 + 오늘 + service=refrigerant
    const { data: completedToday } = await sb.from("tasks")
      .select("*")
      .eq("status", "완료")
      .gte("updated_at", TODAY_KST_START)
      .lte("updated_at", TODAY_KST_END)
      .limit(100);
    for (const t of (completedToday || [])) {
      const addr = (t.address || "") + " " + (t.customer_name || "");
      for (const kw of KEYWORDS) {
        if (addr.includes(kw) && addr.includes(SUFFIX[kw])) {
          if (!hits.find(h => h.task.id === t.id)) hits.push({ kw, suffix: SUFFIX[kw], task: t });
        }
      }
    }
  }

  console.log(`\n[검출] ${hits.length}건`);
  for (const h of hits) {
    console.log(`  · ${h.kw}${h.suffix} → task_no=${h.task.task_no} id=${h.task.id} status=${h.task.status}`);
  }

  if (hits.length === 0) {
    console.log("\n0건 — address 컬럼 / 4자리 키워드 부재 가능. tasks 측 오늘 완료 전건 dump:");
    const { data: dump } = await sb.from("tasks")
      .select("id, task_no, status, address, customer_name, updated_at")
      .eq("status", "완료")
      .gte("updated_at", TODAY_KST_START)
      .lte("updated_at", TODAY_KST_END)
      .limit(50);
    for (const t of (dump || [])) {
      console.log(`  ${t.task_no} ${t.status} addr=${t.address} cust=${t.customer_name}`);
    }
    return;
  }

  // 2) 각 hit별 상세 dump
  for (const h of hits) {
    const t = h.task;
    console.log("\n" + "─".repeat(90));
    console.log(`▶ ${h.kw}${h.suffix} — task_no=${t.task_no}`);
    console.log("─".repeat(90));

    // principal
    const { data: prin } = await sb.from("principals").select("code, name").eq("id", t.principal_id).single();
    const product = Number(t.product_price) || 0;
    const extra   = Number(t.extra_fee)     || 0;
    const travel  = Number(t.travel_fee)    || 0;
    const total   = product + extra + travel;

    console.log(`  id              : ${t.id}`);
    console.log(`  principal       : ${prin?.code} (${prin?.name})`);
    console.log(`  status          : ${t.status}`);
    console.log(`  updated_at      : ${t.updated_at}`);
    console.log(`  completed_at    : ${t.completed_at || "(없음)"}`);
    console.log(`  address         : ${t.address}`);
    console.log(`  customer        : ${t.customer_name}`);
    console.log(`  product_price   : ${product.toLocaleString()}`);
    console.log(`  extra_fee       : ${extra.toLocaleString()}  (현장추가)`);
    console.log(`  travel_fee      : ${travel.toLocaleString()}`);
    console.log(`  → total         : ${total.toLocaleString()}`);

    // engineer
    if (t.assigned_engineer_id) {
      const { data: eng } = await sb.from("users")
        .select("id, name, refrigerant_rate")
        .eq("id", t.assigned_engineer_id).single();
      console.log(`  engineer        : ${eng?.name} (id=${eng?.id})`);
      console.log(`  refrigerant_rate: ${eng?.refrigerant_rate}  ← 60 기대`);
    } else {
      console.log(`  engineer        : (미배정!)`);
    }

    // task_items
    const { data: items } = await sb.from("task_items")
      .select("id, qty, unit_price, subtotal, received_amount, order_type, is_canceled, work_types(code, service_types(code)), appliance_types(code), updated_at")
      .eq("task_id", t.id)
      .order("id");

    console.log(`  task_items (${items?.length || 0}건):`);
    let sumSub = 0, sumReceived = 0;
    for (const it of (items || [])) {
      const svc = it.work_types?.service_types?.code;
      const app = it.appliance_types?.code;
      const cancel = it.is_canceled ? " [취소]" : "";
      const sub = Number(it.subtotal) || 0;
      const rec = it.received_amount == null ? "(null)" : Number(it.received_amount).toLocaleString();
      sumSub += it.is_canceled ? 0 : sub;
      if (!it.is_canceled && it.received_amount != null) sumReceived += Number(it.received_amount);
      console.log(`    - qty=${it.qty} unit=${(Number(it.unit_price)||0).toLocaleString()} subtotal=${sub.toLocaleString()} received=${rec} order_type=${it.order_type} svc=${svc} app=${app} updated=${it.updated_at}${cancel}`);
    }
    console.log(`  SUM(active subtotal) = ${sumSub.toLocaleString()}`);
    console.log(`  SUM(active received) = ${sumReceived.toLocaleString()}  (Phase C 측 사용 여부 판단)`);

    // payments
    const { data: pays } = await sb.from("payments")
      .select("*")
      .eq("task_id", t.id)
      .order("computed_at", { ascending: false });

    console.log(`  payments (${pays?.length || 0}건):`);
    for (const p of (pays || [])) {
      console.log(`    · id=${p.id}`);
      console.log(`      engineer_amount  : ${(p.engineer_amount  || 0).toLocaleString()}`);
      console.log(`      principal_amount : ${(p.principal_amount || 0).toLocaleString()}`);
      console.log(`      owner_amount     : ${(p.owner_amount     || 0).toLocaleString()}`);
      console.log(`      product_price    : ${(p.product_price    || 0).toLocaleString()}  (payments 측 저장값)`);
      console.log(`      extra_fee        : ${(p.extra_fee        || 0).toLocaleString()}`);
      console.log(`      travel_fee       : ${(p.travel_fee       || 0).toLocaleString()}`);
      console.log(`      calc_method      : ${p.calc_method}`);
      console.log(`      policy_key       : ${p.policy_key}`);
      console.log(`      track            : ${p.track}`);
      console.log(`      status           : ${p.status}`);
      console.log(`      computed_at      : ${p.computed_at}`);
      console.log(`      created_at       : ${p.created_at}`);
    }

    // 기대 vs 실제
    const exp = EXPECT[h.kw];
    const actEng = pays?.[0]?.engineer_amount || 0;
    console.log(`  기대 engineer ≈ ${exp.engineer.toLocaleString()} (${exp.note})`);
    console.log(`  실제 engineer = ${actEng.toLocaleString()}`);
    console.log(`  diff          = ${(actEng - exp.engineer).toLocaleString()}`);
  }

  // 3) 가설 평가
  console.log("\n" + "=".repeat(90));
  console.log("가설 평가");
  console.log("=".repeat(90));
  console.log("① 총금액 변경 후 재계산 누락:");
  console.log("   → 비교: tasks.product_price+extra+travel vs payments.product_price+extra+travel");
  console.log("           tasks.updated_at vs payments.computed_at (computed_at < items.updated_at 이면 stale)");
  console.log("② rate 0/옛값:");
  console.log("   → users.refrigerant_rate 출력 확인 (60 아니면 hit)");
  console.log("③ principal_code 다름:");
  console.log("   → 3건 principals.code 비교 (다르면 정책 분기)");
})().catch(e => console.log("FATAL:", e.message, e.stack));

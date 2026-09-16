// 2026-06-09 — Mig 099 STEP 1 진단.
//   visit_only task 의 extra_fee/travel_fee/total_amount 상태 분류 + 백필 안전성 검증.
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function classify(t) {
  const pp = Number(t.product_price) || 0;
  const ef = Number(t.extra_fee) || 0;
  const tf = Number(t.travel_fee) || 0;
  if (ef === 30000 && tf === 30000 && pp === 0) return "DUPLICATE_30K (백필 대상)";
  if (ef === 0     && tf === 30000 && pp === 0) return "CLEAN (Mig 054 정합)";
  if (ef > 30000) return "EXTRA_BEYOND_30K (수동 검토 — 진짜 추가금 섞임)";
  return "OTHER (수동 검토)";
}

(async () => {
  // STEP 1-A — 전체 visit_only task 분류
  const PAGE = 1000;
  const all = [];
  for (let p = 0; p < 10; p++) {
    const { data, error } = await sb.from("tasks")
      .select("id, task_no, customer_name, completed_at, product_price, extra_fee, travel_fee, total_amount")
      .eq("status", "visit_only")
      .eq("tenant_id", "11111111-1111-1111-1111-111111111111")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) { console.error("fetch err", error); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }

  console.log(`\n=== STEP 1-A — visit_only 전체 ${all.length}건 분류 ===\n`);

  const buckets = {};
  for (const t of all) {
    const c = classify(t);
    if (!buckets[c]) buckets[c] = [];
    buckets[c].push(t);
  }

  for (const [name, list] of Object.entries(buckets)) {
    console.log(`▶ ${name}: ${list.length}건`);
    // sample 5건
    list.slice(0, 5).forEach(t => {
      const kst = t.completed_at
        ? new Date(new Date(t.completed_at).getTime() + 9*3600*1000).toISOString().slice(0,16).replace("T"," ")
        : "—";
      console.log(
        `    ${kst} · ${t.task_no} · ${t.customer_name || "—"} ` +
        `· product=${t.product_price} extra=${t.extra_fee} travel=${t.travel_fee} total=${t.total_amount}`
      );
    });
    if (list.length > 5) console.log(`    ... 외 ${list.length - 5}건`);
    console.log("");
  }

  // STEP 1-B — DUPLICATE_30K 백필 안전성 검증
  const dup = buckets["DUPLICATE_30K (백필 대상)"] || [];
  console.log(`=== STEP 1-B — DUPLICATE_30K 백필 안전성 ===`);
  console.log(`  task_cnt:              ${dup.length}`);
  const sumBefore = dup.reduce((s, t) => s + (Number(t.total_amount) || 0), 0);
  const sumAfter  = dup.length * 30000;  // 백필 후 = product(0) + extra(0) + travel(30k) = 30k 각
  const delta = sumBefore - sumAfter;
  console.log(`  sum_total_before:      ${sumBefore.toLocaleString()}`);
  console.log(`  sum_total_after:       ${sumAfter.toLocaleString()}`);
  console.log(`  sum_delta:             ${delta.toLocaleString()} (= task_cnt × 30000 기대)`);
  console.log(`  task_cnt × 30000:      ${(dup.length * 30000).toLocaleString()}`);
  console.log(`  검증 정합:             ${delta === dup.length * 30000 ? "✅ OK" : "⚠️  mismatch"}`);

  // STEP 1-C — EXTRA_BEYOND_30K / OTHER 전체 행 (수동 검토용)
  const suspicious = [
    ...(buckets["EXTRA_BEYOND_30K (수동 검토 — 진짜 추가금 섞임)"] || []),
    ...(buckets["OTHER (수동 검토)"] || []),
  ];
  if (suspicious.length > 0) {
    console.log(`\n=== 수동 검토 필요 행 (${suspicious.length}건) ===`);
    suspicious.forEach(t => {
      const kst = t.completed_at
        ? new Date(new Date(t.completed_at).getTime() + 9*3600*1000).toISOString().slice(0,16).replace("T"," ")
        : "—";
      console.log(
        `  ${kst} · ${t.task_no} · ${t.customer_name || "—"} ` +
        `· product=${t.product_price} extra=${t.extra_fee} travel=${t.travel_fee} total=${t.total_amount}`
      );
    });
  } else {
    console.log("\n=== 수동 검토 필요 행: 0건 ===");
  }
})();

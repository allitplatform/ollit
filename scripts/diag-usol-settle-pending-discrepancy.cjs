// 진단 — 유솔앱 정산 화면 두 '정산 대기' 금액 차이 검증 (2회차 — is_canceled 반영)
// 2026-05-26 (read-only)
//
// 가설:
//   · 위쪽 '전체 현황' 정산 대기 ₩34,745,181 = Σ task_items.subtotal
//   · 아래쪽 '주차별 정산' pending ₩28,624,136 = Σ ROUND(net_amount * 0.85)
//   · 모집단 426건 = tasks.status='완료' AND task_items.naver_settled_at IS NULL
//                  AND (is_canceled FALSE 가능성)

const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const sb  = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

(async () => {
  const { data: pRows } = await sb.from("principals").select("id, code").in("code", ["usol_h", "usol_n"]);
  const pids = (pRows || []).map(p => p.id);

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  cutoff.setHours(0, 0, 0, 0);

  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from("task_items")
      .select(`id, subtotal, net_amount, naver_settled_at, is_canceled, qty, unit_price,
               tasks!inner ( id, principal_id, status, received_at )`)
      .eq("tasks.tenant_id", TENANT_ID)
      .in("tasks.principal_id", pids)
      .gte("tasks.received_at", cutoff.toISOString())
      .range(from, from + pageSize - 1);
    if (error) { console.error("ERR:", error.message); process.exit(1); }
    rows.push(...(data || []));
    if ((data || []).length < pageSize) break;
  }
  console.log(`[fetch] total task_items rows: ${rows.length}`);

  // pending (필터 1): tasks.status='완료' AND naver_settled_at NULL
  const pendingAll = rows.filter(r =>
    r.tasks?.status === "완료" && !r.naver_settled_at
  );
  // pending (필터 2): +is_canceled=false
  const pendingActive = pendingAll.filter(r => !r.is_canceled);

  function sumPair(arr) {
    let sub = 0, comp = 0, nullNet = 0;
    for (const it of arr) {
      sub += Number(it.subtotal) || 0;
      const n = it.net_amount;
      if (n == null) { nullNet++; continue; }
      comp += Math.round(Number(n) * 0.85);
    }
    return { sub, comp, nullNet };
  }

  const A = sumPair(pendingAll);
  const B = sumPair(pendingActive);

  console.log("\n━".repeat(40));
  console.log("[필터 1] tasks.status='완료' AND naver_settled_at NULL");
  console.log(`  건수      ${pendingAll.length}`);
  console.log(`  Σsubtotal ₩${A.sub.toLocaleString()}`);
  console.log(`  Σnet×0.85 ₩${A.comp.toLocaleString()}  (NULL net ${A.nullNet}건)`);

  console.log("\n[필터 2] 위 + is_canceled=false");
  console.log(`  건수      ${pendingActive.length}`);
  console.log(`  Σsubtotal ₩${B.sub.toLocaleString()}`);
  console.log(`  Σnet×0.85 ₩${B.comp.toLocaleString()}  (NULL net ${B.nullNet}건)`);

  console.log("\n━".repeat(40));
  console.log("[화면 표시값 비교]");
  console.log(`  위쪽 정산 대기      ₩34,745,181 (426건)`);
  console.log(`  아래쪽 pending      ₩28,624,136 (426건)`);

  // is_canceled 항목 — subtotal generated column 이 0 처리되는지 측정
  const canceledInPending = pendingAll.filter(r => r.is_canceled);
  if (canceledInPending.length > 0) {
    const cSub = canceledInPending.reduce((s, r) => s + (Number(r.subtotal) || 0), 0);
    const cQty = canceledInPending.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit_price) || 0), 0);
    console.log(`\n[is_canceled 항목 — pending 안]`);
    console.log(`  ${canceledInPending.length}건 · Σsubtotal = ₩${cSub.toLocaleString()}`);
    console.log(`  비교 qty×unit_price = ₩${cQty.toLocaleString()}  (subtotal generated CASE WHEN is_canceled 측정용)`);
  }

  // 차이 분해 (필터 2 기준)
  console.log("\n━".repeat(40));
  console.log("[차이 원인 분해 — 필터 2 기준]");
  console.log(`  Σsubtotal - Σnet×0.85 = ₩${(B.sub - B.comp).toLocaleString()}`);
  console.log(`  세부:`);
  let sum_eq_loss = 0;        // net==sub 일 때 sub*(1-0.85)=sub*0.15
  let sum_lt_loss = 0;        // net<sub 일 때 (sub-net) + net*0.15
  let sum_null_loss = 0;      // net NULL 일 때 sub 전체가 빠짐
  let sum_gt_gain = 0;        // net>sub 일 때 net*0.85가 sub보다 클 수도
  for (const it of pendingActive) {
    const s = Number(it.subtotal) || 0;
    if (it.net_amount == null) { sum_null_loss += s; continue; }
    const n = Number(it.net_amount);
    const c = Math.round(n * 0.85);
    const d = s - c;
    if (n === s) sum_eq_loss += d;
    else if (n < s) sum_lt_loss += d;
    else sum_gt_gain += (-d);
  }
  console.log(`    · net=subtotal × 15% 마진 (사장님 측 cut)  ₩${sum_eq_loss.toLocaleString()}`);
  console.log(`    · net<subtotal — 추가 차감 (수수료/할인)    ₩${sum_lt_loss.toLocaleString()}`);
  console.log(`    · net_amount NULL — 회사 입금 0원 처리       ₩${sum_null_loss.toLocaleString()}`);
  console.log(`    · net>subtotal — 추가금/조정 (음수 차이)     -₩${sum_gt_gain.toLocaleString()}`);

})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

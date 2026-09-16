// 2026-06-02 — 회사 순이익 카드 새 spec 검증 (작업월 2026-05).
//   배분액 = Σsubtotal × 0.85, 기사지급 = RPC engineer_amount 전체, profit = 차액.
//   UsolNToEngineerSection.jsx 의 splitByBucket + bucketItem + calcItemEngineerAmount 로직 재현.
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

const NAVER_NET_TO_COMPANY_FACTOR = 0.85;
const COMPANY_RATE_FALLBACK = 0.85;
const ENGINEER_RATIO_FALLBACK = 0.6;

// 작업월 KST 2026-05.
const GATE_YEAR = 2026;
const GATE_MONTH = 5;

function inKstMonth(completedAt, year, month) {
  if (!completedAt) return false;
  const t = new Date(completedAt).getTime();
  if (isNaN(t)) return false;
  const start = Date.UTC(year, month - 1, 1, -9, 0, 0, 0);
  const end   = Date.UTC(year, month,     1, -9, 0, 0, 0);
  return t >= start && t < end;
}

function bucketItem(item, gateYear, gateMonth) {
  if (item?.is_canceled) return null;
  if (!inKstMonth(item?.tasks?.completed_at, gateYear, gateMonth)) return null;
  if (item.engineer_settled_at) {
    return item.naver_settled_at ? "done_1" : "done_2";
  }
  if (item.naver_settled_at) return "first";
  return "second";
}

function calcItemEngineerAmount(item, engByItem) {
  if (item == null) return 0;
  if (engByItem && engByItem.has(item.id)) {
    return Number(engByItem.get(item.id)) || 0;
  }
  if (item.net_amount != null) return item.net_amount;
  const subtotal = item.subtotal || 0;
  return Math.floor(subtotal * COMPANY_RATE_FALLBACK * ENGINEER_RATIO_FALLBACK);
}

(async () => {
  // 1) usol_n principal id
  const { data: pidRow } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  if (!pidRow?.id) { console.error("usol_n principal X"); process.exit(1); }

  // 2) 완료 task_items fetch (monthsBack 6)
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);
  cutoff.setHours(0, 0, 0, 0);

  const PAGE = 1000;
  const all = [];
  for (let p = 0; p < 50; p++) {
    const { data, error } = await sb
      .from("task_items")
      .select(`id, task_id, subtotal, naver_settled_at,
               engineer_settled_at, net_amount, is_canceled,
               tasks!inner ( id, principal_id, status, completed_at )`)
      .eq("tasks.principal_id", pidRow.id)
      .eq("tasks.status", "완료")
      .gte("tasks.completed_at", cutoff.toISOString())
      .order("id", { ascending: true })
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  console.log(`총 task_items: ${all.length}건`);

  // 3) compute_engineer_amount_per_item_batch RPC — 작업월 measurement 측 task_ids만.
  const buckRows = all.filter(it => bucketItem(it, GATE_YEAR, GATE_MONTH));
  console.log(`작업월 ${GATE_YEAR}-${String(GATE_MONTH).padStart(2,"0")} 버킷: ${buckRows.length}건`);

  const taskIds = [...new Set(buckRows.map(it => it.task_id))];
  console.log(`unique task_ids: ${taskIds.length}건`);

  const engByItem = new Map();
  // RPC 호출 (배치).
  const { data: rpcRows, error: rpcErr } = await sb
    .rpc("compute_engineer_amount_per_item_batch", { p_task_ids: taskIds });
  if (rpcErr) { console.error("RPC error:", rpcErr); process.exit(1); }
  for (const r of (rpcRows || [])) {
    engByItem.set(r.task_item_id, Number(r.engineer_amount) || 0);
  }
  console.log(`RPC 측 engineer_amount: ${engByItem.size}건`);

  // 4) 버킷별 합산 — splitByBucket 시뮬.
  const split = {
    firstTotal: 0, secondTotal: 0, done1Total: 0, done2Total: 0,
    subtotalAll: 0,
  };
  for (const it of buckRows) {
    const k = bucketItem(it, GATE_YEAR, GATE_MONTH);
    const amt = calcItemEngineerAmount(it, engByItem);
    const sub = Number(it.subtotal) || 0;
    if (k === "first")  split.firstTotal  += amt;
    if (k === "second") split.secondTotal += amt;
    if (k === "done_1") split.done1Total  += amt;
    if (k === "done_2") split.done2Total  += amt;
    split.subtotalAll += sub;
  }
  split.doneTotal = split.done1Total + split.done2Total;
  split.engineerPayAll = split.firstTotal + split.secondTotal + split.doneTotal;
  split.naverConfirmed = split.firstTotal + split.done1Total;

  const companyShare = Math.round(split.subtotalAll * NAVER_NET_TO_COMPANY_FACTOR);
  const profit = companyShare - split.engineerPayAll;

  console.log("");
  console.log("=== 회사 순이익 · 작업월 2026-05 (새 spec) ===");
  console.log(`Σsubtotal (전체) : ₩${split.subtotalAll.toLocaleString()}`);
  console.log(`회사 배분액 ×0.85: ₩${companyShare.toLocaleString()}`);
  console.log(`기사지급 1차      : ₩${split.firstTotal.toLocaleString()}`);
  console.log(`기사지급 2차      : ₩${split.secondTotal.toLocaleString()}`);
  console.log(`기사지급 done     : ₩${split.doneTotal.toLocaleString()}`);
  console.log(`기사지급 전체     : ₩${split.engineerPayAll.toLocaleString()}`);
  console.log(`순이익            : ₩${profit.toLocaleString()}`);
  console.log("");
  console.log("=== 비교: 옛 spec ===");
  console.log(`구 회사 실입금(시트): ₩52,319,693`);
  console.log(`구 기사지급 1차만   : ₩${split.naverConfirmed.toLocaleString()}`);
  console.log(`구 순이익           : ₩${(52319693 - split.naverConfirmed).toLocaleString()}`);
  process.exit(0);
})();

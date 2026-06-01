// 2026-06-01 — 5월 완료 usol_n task_items 의 1차(naver_settled_at NOT NULL) /
//   2차(NULL) split. 기사 지급액 = compute_engineer_amount_per_item_batch RPC 합산.
//
// 출력:
//   1) 전체 1차/2차 split (건수 + 합계)
//   2) 기사별 1차/2차 split (정렬: 총액 내림차순)
//
// 실행: node scripts/diag-may-1cha-2cha.cjs
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT="11111111-1111-1111-1111-111111111111", PID="22222222-2222-2222-2222-222222222006";
const S="2026-04-30T15:00:00Z", E="2026-05-31T15:00:00Z";
const won = n => `₩${(Number(n)||0).toLocaleString()}`;

(async () => {
  // 1) 5월 KST 완료 usol_n tasks
  const { data: tasks, error: taskErr } = await sb.from("tasks")
    .select("id, task_no, assigned_engineer_id")
    .eq("tenant_id", TENANT).eq("principal_id", PID).eq("status", "완료")
    .gte("completed_at", S).lt("completed_at", E);
  if (taskErr) { console.error("tasks fetch error:", taskErr); process.exit(1); }
  const tById = new Map(tasks.map(t => [t.id, t]));
  const taskIds = tasks.map(t => t.id);
  console.log(`5월 완료 usol_n tasks: ${tasks.length}건`);

  // 2) 활성 task_items
  const items = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    const { data } = await sb.from("task_items")
      .select("id, task_id, naver_settled_at, engineer_settled_at, is_canceled")
      .in("task_id", taskIds.slice(i, i + 200));
    if (data) items.push(...data);
  }
  const active = items.filter(it => !it.is_canceled);
  console.log(`5월 활성 task_items: ${active.length}건 (취소 ${items.length - active.length} 제외)\n`);

  // 3) compute_engineer_amount_per_item_batch RPC
  const engById = new Map();
  for (let i = 0; i < taskIds.length; i += 200) {
    const chunk = taskIds.slice(i, i + 200);
    const { data } = await sb.rpc("compute_engineer_amount_per_item_batch", { p_task_ids: chunk });
    if (Array.isArray(data)) {
      for (const r of data) engById.set(r.task_item_id, Number(r.engineer_amount) || 0);
    }
  }
  console.log(`RPC engineer_amount: ${engById.size}건 매핑됨\n`);

  // 4) 1차 / 2차 split
  console.log("=".repeat(78));
  console.log("1) 전체 1차 (naver_settled_at NOT NULL) / 2차 (NULL) split");
  console.log("─".repeat(78));
  let firstCnt = 0, firstSum = 0, secondCnt = 0, secondSum = 0;
  let alreadyPaidCnt = 0, alreadyPaidSum = 0;
  for (const it of active) {
    const amt = engById.get(it.id) || 0;
    if (it.engineer_settled_at) {
      alreadyPaidCnt += 1;
      alreadyPaidSum += amt;
      continue;
    }
    if (it.naver_settled_at) {
      firstCnt += 1; firstSum += amt;
    } else {
      secondCnt += 1; secondSum += amt;
    }
  }
  const pendingTotal = firstSum + secondSum;
  console.log(`  1차 (정산 확정 · 미지급): ${String(firstCnt).padStart(5)}건 | ${won(firstSum).padStart(14)}`);
  console.log(`  2차 (미정산 예정 · 미지급): ${String(secondCnt).padStart(5)}건 | ${won(secondSum).padStart(14)}`);
  console.log(`  소계 (미지급 = 1차+2차):  ${String(firstCnt+secondCnt).padStart(5)}건 | ${won(pendingTotal).padStart(14)}`);
  console.log("─".repeat(78));
  console.log(`  이미 지급 (engineer_settled_at O): ${String(alreadyPaidCnt).padStart(5)}건 | ${won(alreadyPaidSum).padStart(14)}`);
  console.log(`  활성 합계:                  ${String(active.length).padStart(5)}건 | ${won(pendingTotal + alreadyPaidSum).padStart(14)}`);
  console.log("─".repeat(78));
  console.log(`  비율 — 1차 ${pendingTotal > 0 ? (firstSum/pendingTotal*100).toFixed(1) : "0.0"}% / 2차 ${pendingTotal > 0 ? (secondSum/pendingTotal*100).toFixed(1) : "0.0"}%`);

  // 5) 기사별 1차/2차 split (정렬: 총액 내림차순)
  console.log("\n" + "=".repeat(78));
  console.log("2) 기사별 1차/2차 split (미지급만)");
  console.log("─".repeat(78));
  const byEng = new Map();
  for (const it of active) {
    if (it.engineer_settled_at) continue;
    const t = tById.get(it.task_id);
    const eid = t?.assigned_engineer_id || "unassigned";
    if (!byEng.has(eid)) byEng.set(eid, { first: 0, second: 0, firstCnt: 0, secondCnt: 0 });
    const slot = byEng.get(eid);
    const amt = engById.get(it.id) || 0;
    if (it.naver_settled_at) { slot.first += amt; slot.firstCnt += 1; }
    else { slot.second += amt; slot.secondCnt += 1; }
  }

  // 기사 이름 조회
  const eids = [...byEng.keys()].filter(k => k !== "unassigned");
  const { data: users } = await sb.from("users").select("id, name").in("id", eids);
  const nameById = new Map((users || []).map(u => [u.id, u.name]));

  const rows = [...byEng.entries()]
    .map(([eid, v]) => ({
      name: eid === "unassigned" ? "(미배정)" : (nameById.get(eid) || eid.slice(0, 8)),
      ...v, total: v.first + v.second,
    }))
    .sort((a, b) => b.total - a.total);

  console.log(`  ${"기사".padEnd(12)} | ${"1차건".padStart(4)} | ${"1차".padStart(13)} | ${"2차건".padStart(4)} | ${"2차".padStart(13)} | ${"총액".padStart(13)}`);
  console.log("─".repeat(78));
  for (const r of rows) {
    console.log(`  ${r.name.padEnd(12)} | ${String(r.firstCnt).padStart(4)} | ${won(r.first).padStart(13)} | ${String(r.secondCnt).padStart(4)} | ${won(r.second).padStart(13)} | ${won(r.total).padStart(13)}`);
  }
})();

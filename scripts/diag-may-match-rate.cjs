// 2026-06-01 — 5월 작업 usol_n task_items 의 Naver 매칭 가능 범위 판단.
//   질문: 네이버 주문 엑셀 (정산예정금액 컬럼) 으로 백필 시 자동 매칭 가능한 비율?
//   기준: product_order_id 가 set 되어 있어야 Naver 엑셀의 "상품주문번호" 와 join 가능.
//
// 출력:
//   1) format × poid_set 매트릭스 (개수)
//   2) floor(/10) 키 중복 (collision) 카운트
//   3) 활성 / 취소 분리
//
// 실행: node scripts/diag-may-match-rate.cjs
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT="11111111-1111-1111-1111-111111111111", PID="22222222-2222-2222-2222-222222222006";
const S="2026-04-30T15:00:00Z", E="2026-05-31T15:00:00Z";

function fmtOf(taskNo) {
  const n = String(taskNo || "");
  if (n.startsWith("YS-N-260")) return "신 (YS-N-260xxx)";
  if (n.startsWith("YS-260"))   return "구 (YS-260xxx)";
  return "기타";
}
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

(async () => {
  const { data: tasks } = await sb.from("tasks").select("id, task_no")
    .eq("tenant_id", TENANT).eq("principal_id", PID).eq("status", "완료")
    .gte("completed_at", S).lt("completed_at", E);
  const tById = new Map(tasks.map(t => [t.id, t]));
  const ids = tasks.map(t => t.id);
  const items = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from("task_items")
      .select("id, task_id, product_order_id, is_canceled, net_amount")
      .in("task_id", ids.slice(i, i + 200));
    if (data) items.push(...data);
  }

  // === 1) 활성 매트릭스 (format × poid_set) ===
  console.log("=".repeat(78));
  console.log("1) 5월 활성 task_items — format × product_order_id 매칭 가능 여부");
  console.log("─".repeat(78));
  console.log(`  ${pad("형식", 22)} | ${pad("poid", 6)} | ${rpad("개수", 6)}`);
  console.log("─".repeat(78));
  const matrix = {};
  for (const it of items) {
    if (it.is_canceled) continue;
    const fmt = fmtOf(tById.get(it.task_id)?.task_no);
    const poidSet = it.product_order_id ? "SET" : "NULL";
    const k = `${fmt}|${poidSet}`;
    matrix[k] = (matrix[k] || 0) + 1;
  }
  const formats = ["신 (YS-N-260xxx)", "구 (YS-260xxx)", "기타"];
  for (const f of formats) {
    const set = matrix[`${f}|SET`] || 0;
    const nul = matrix[`${f}|NULL`] || 0;
    const total = set + nul;
    if (total === 0) continue;
    const setPct = total > 0 ? ((set / total) * 100).toFixed(1) : "0.0";
    console.log(`  ${pad(f, 22)} | ${pad("SET", 6)} | ${rpad(set, 6)} (${setPct}%)`);
    console.log(`  ${pad(f, 22)} | ${pad("NULL", 6)} | ${rpad(nul, 6)}`);
    console.log(`  ${pad(f, 22)} | ${pad("소계", 6)} | ${rpad(total, 6)}`);
    console.log("─".repeat(78));
  }

  // === 2) floor(/10) 충돌 확인 ===
  console.log("\n" + "=".repeat(78));
  console.log("2) floor(product_order_id / 10) 키 충돌 — 백필 시 매칭 안정성");
  console.log("─".repeat(78));
  const keyMap = new Map(); // floorKey → [{itemId, taskNo, fmt, poid}]
  for (const it of items) {
    if (it.is_canceled) continue;
    if (!it.product_order_id) continue;
    const n = Number(it.product_order_id);
    if (!isFinite(n)) continue;
    const k = Math.floor(n / 10);
    if (!keyMap.has(k)) keyMap.set(k, []);
    keyMap.get(k).push({
      itemId: it.id,
      taskNo: tById.get(it.task_id)?.task_no || "",
      fmt: fmtOf(tById.get(it.task_id)?.task_no),
      poid: it.product_order_id,
    });
  }
  const collisions = [...keyMap.entries()].filter(([k, list]) => list.length > 1);
  console.log(`  · 총 키: ${keyMap.size}개`);
  console.log(`  · 충돌 키 (2건+ 같은 floor): ${collisions.length}개`);
  if (collisions.length > 0) {
    console.log(`\n  충돌 샘플 5개:`);
    collisions.slice(0, 5).forEach(([k, list]) => {
      console.log(`    floor=${k}:`);
      list.forEach(x => console.log(`      ${x.taskNo} | ${x.fmt} | poid=${x.poid} | item=${x.itemId.slice(0, 8)}`));
    });
  }

  // === 3) 활성 / 취소 요약 ===
  console.log("\n" + "=".repeat(78));
  console.log("3) 활성 / 취소 요약");
  console.log("─".repeat(78));
  const active = items.filter(it => !it.is_canceled);
  const canceled = items.filter(it => it.is_canceled);
  console.log(`  활성 task_items: ${active.length}건`);
  console.log(`  취소 task_items: ${canceled.length}건`);
  console.log(`  활성 중 poid SET: ${active.filter(it => it.product_order_id).length}건`);
  console.log(`  활성 중 poid NULL: ${active.filter(it => !it.product_order_id).length}건`);
})();

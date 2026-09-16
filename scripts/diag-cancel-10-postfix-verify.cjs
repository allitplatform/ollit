// 5/22 일괄취소 10건 — 사후 검증 (SELECT만, 수정 금지)
// 사장님이 정정 완료했다는 상태가 의도대로 됐는지 확인
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TARGETS = [
  { tn: "YS-260518-075", cust: "김주연" },
  { tn: "YS-260517-058", cust: "한은혜" },
  { tn: "YS-260517-027", cust: "강인성" },
  { tn: "YS-260516-115", cust: "김진산" },
  { tn: "YS-260516-021", cust: "조용현" },
  { tn: "YS-260515-069", cust: "임유진" },
  { tn: "YS-260515-009", cust: "김난영" },
  { tn: "YS-260513-005", cust: "차진영" },
  { tn: "YS-260507-023", cust: "이보배" },
  { tn: "YS-260514-056", cust: "김민정" },
];

function pad(s, n) { s = String(s ?? ""); return s.length >= n ? s : s + " ".repeat(n - s.length); }
function padR(s, n) { s = String(s ?? ""); return s.length >= n ? s : " ".repeat(n - s.length) + s; }

(async () => {
  const taskNos = TARGETS.map(t => t.tn);
  const { data: tasks, error: e1 } = await sb.from("tasks")
    .select("id, task_no, customer_name, status, scheduled_at, completed_at, started_at, updated_at")
    .in("task_no", taskNos);
  if (e1) { console.error("tasks fetch error:", e1.message); process.exit(1); }

  const rows = [];
  for (const tgt of TARGETS) {
    const t = (tasks || []).find(x => x.task_no === tgt.tn);
    if (!t) { rows.push({ tn: tgt.tn, cust: tgt.cust, found: false }); continue; }

    const { data: pays } = await sb.from("payments")
      .select("engineer_amount, owner_amount, principal_amount, settled_at, calc_method, track")
      .eq("task_id", t.id);
    const { data: hist } = await sb.from("status_history")
      .select("from_status, to_status, changed_at, changed_by")
      .eq("task_id", t.id)
      .order("changed_at");

    const pay = (pays || [])[0];
    const last = (hist || [])[hist.length - 1];
    rows.push({
      tn: t.task_no, cust: t.customer_name || tgt.cust, found: true,
      status: t.status, completed_at: t.completed_at, scheduled_at: t.scheduled_at, started_at: t.started_at,
      pay_eng: pay?.engineer_amount ?? null, pay_own: pay?.owner_amount ?? null,
      pay_settled: pay?.settled_at ?? null, pay_method: pay?.calc_method ?? null, pay_track: pay?.track ?? null,
      pay_exists: !!pay,
      histN: (hist || []).length,
      lastFrom: last?.from_status, lastTo: last?.to_status, lastAt: last?.changed_at, lastBy: last?.changed_by,
    });
  }

  // ─── 본 표 ────────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(180));
  console.log("[표 1] 10건 사후 검증 — 상태/시각/payments/마지막 이력");
  console.log("=".repeat(180));
  console.log(
    pad("task_no", 18) + "| " +
    pad("고객", 10) + "| " +
    pad("status", 8) + "| " +
    pad("completed_at", 18) + "| " +
    pad("scheduled_at", 18) + "| " +
    pad("pay.engineer", 14) + "| " +
    pad("pay.owner", 12) + "| " +
    pad("pay.settled_at", 22) + "| " +
    pad("hist.last (from→to, at)", 50)
  );
  console.log("─".repeat(180));
  for (const r of rows) {
    if (!r.found) {
      console.log(pad(r.tn, 18) + "| " + pad(r.cust, 10) + "| " + pad("NOT FOUND", 8));
      continue;
    }
    const eng = r.pay_eng != null ? "₩" + Number(r.pay_eng).toLocaleString() : (r.pay_exists ? "₩0" : "(없음)");
    const own = r.pay_own != null ? "₩" + Number(r.pay_own).toLocaleString() : (r.pay_exists ? "₩0" : "(없음)");
    const settled = r.pay_settled || (r.pay_exists ? "NULL" : "—");
    const lastStr = r.lastTo ? `${r.lastFrom ?? "NULL"}→${r.lastTo} @ ${r.lastAt?.slice(0,16) ?? ""}` : "(이력 0건)";
    console.log(
      pad(r.tn, 18) + "| " +
      pad(r.cust, 10) + "| " +
      pad(r.status || "?", 8) + "| " +
      pad(r.completed_at?.slice(0,16) || "NULL", 18) + "| " +
      pad(r.scheduled_at?.slice(0,16) || "NULL", 18) + "| " +
      pad(eng, 14) + "| " +
      pad(own, 12) + "| " +
      pad(settled.slice(0,22), 22) + "| " +
      pad(lastStr.slice(0,50), 50)
    );
  }

  // ─── 이상 행 식별 ─────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(180));
  console.log("[표 2] 이상/주의 행 — 자동 표시");
  console.log("=".repeat(180));
  const anomalies = [];
  for (const r of rows) {
    if (!r.found) { anomalies.push({ tn: r.tn, cust: r.cust, reason: "DB에서 찾지 못함" }); continue; }
    const issues = [];
    // A. status 분류
    if (r.status === "완료") {
      // B. completed_at 채워졌나
      if (!r.completed_at) issues.push("status='완료'인데 completed_at NULL (화면 표시 누락 위험)");
      // C. payments engineer 값
      if (!r.pay_exists) issues.push("status='완료'인데 payments 행 없음 (재계산 안 됨)");
      else if (!r.pay_eng || r.pay_eng === 0) issues.push("status='완료'인데 payments.engineer_amount=0/NULL");
      // settled_at은 NULL이어야 정상
      if (r.pay_exists && r.pay_settled) issues.push(`⚠️ 이미 정산됨 (settled_at=${r.pay_settled})`);
      // D. 마지막 이력이 '취소→완료'인지
      if (r.lastTo !== "완료" || r.lastFrom !== "취소") {
        issues.push(`마지막 이력이 '취소→완료'가 아님 (last=${r.lastFrom ?? "NULL"}→${r.lastTo ?? "NULL"})`);
      }
    } else if (r.status === "취소") {
      issues.push("취소 유지 — 기사 더블체크 결과 '실제 안 한 작업'이면 정상 / 사장님 의도와 대조 필요");
    } else {
      issues.push(`예상 외 status='${r.status}'`);
    }
    if (issues.length) anomalies.push({ tn: r.tn, cust: r.cust, status: r.status, reason: issues.join(" / ") });
  }
  if (!anomalies.length) {
    console.log("(이상 없음 — 10건 모두 의도대로 보임)");
  } else {
    for (const a of anomalies) {
      console.log(`  • [${a.tn}] ${a.cust} (status=${a.status || "?"})`);
      console.log(`    └ ${a.reason}`);
    }
  }

  // ─── 그룹 카운트 ──────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(180));
  console.log("[요약] 상태별 카운트");
  console.log("=".repeat(180));
  const byStatus = {};
  for (const r of rows) {
    const k = r.found ? (r.status || "?") : "NOT_FOUND";
    byStatus[k] = (byStatus[k] || 0) + 1;
  }
  for (const [k, v] of Object.entries(byStatus)) console.log(`  ${k.padEnd(12)} : ${v}건`);
  console.log("");
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });

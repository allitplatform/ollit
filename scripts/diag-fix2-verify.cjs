// 검증 — 2차 수정 결과 + 전체 40건 정합성. 조회만, 수정 X.
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

const ALL_40 = [
  "YS-N-260524-005", "YS-260517-037", "YS-260515-024", "YS-260515-037", "YS-260519-051",
  "YS-260518-096", "YS-260504-029", "YS-260503-001", "YS-N-260524-004", "YS-260516-169",
  "YS-260518-086", "YS-260430-010", "YS-260512-021", "YS-260516-069", "YS-N-260524-007",
  "YS-N-260524-011", "YS-260428-055", "YS-N-260524-003", "YS-N-260524-002", "YS-N-260524-008",
  "YS-260520-016", "YS-260518-085", "YS-260517-039", "YS-260520-021",
  "YS-260425-010", "YS-260501-011",
  "YS-260512-063", "YS-260430-023",
  "YS-260516-162",
  "YS-260427-004",
  "YS-260519-015", "YS-260518-098", "YS-260516-012", "YS-260521-013", "YS-260516-157",
  "YS-260516-158", "YS-260518-040", "YS-260515-061", "YS-260518-049", "YS-260517-033",
];

const TO_COMPLETE = ["YS-260428-055","YS-N-260524-003","YS-N-260524-002","YS-260516-069","YS-N-260524-007"];
const TO_CONFIRM  = ["YS-260518-086","YS-N-260524-008"];

// KST 5/25 측 catch 측 catch = UTC 2026-05-24T15:00Z 측 catch
const KST_525_BOUNDARY = "2026-05-24T15:00:00.000Z";

const issues = [];
function logIssue(label, msg) { issues.push(`[${label}] ${msg}`); }

(async () => {
  console.log("=".repeat(120));
  console.log("측 catch — 2차 측 catch + 측 40건 측 catch");
  console.log("=".repeat(120));

  // -----------------------------------------------------------
  // 1. 한인규 8개 필드 + calc_method
  // -----------------------------------------------------------
  console.log("\n【1. 한인규 YS-260427-004 vs YS-260427-003 — 8개 필드】");
  const { data: pair } = await sb.from("tasks").select("*").in("task_no", ["YS-260427-004", "YS-260427-003"]);
  const t4 = pair.find(r => r.task_no === "YS-260427-004");
  const t3 = pair.find(r => r.task_no === "YS-260427-003");
  const COLS = ["principal_id", "channel", "district", "address", "external_order_no", "requested_date", "requested_time", "is_legacy"];
  for (const c of COLS) {
    const eq = JSON.stringify(t4[c]) === JSON.stringify(t3[c]);
    const mark = eq ? "✅" : "⚠️";
    console.log(`  ${mark} ${c.padEnd(22)} | 004=${String(t4[c]).slice(0,40).padEnd(40)} | 003=${String(t3[c]).slice(0,40)}`);
    if (!eq) logIssue("1", `한인규 ${c}: 004=${t4[c]} / 003=${t3[c]}`);
  }
  // payments calc_method
  const { data: hanPay } = await sb.from("payments").select("calc_method, engineer_amount, principal_amount, owner_amount").eq("task_id", t4.id).maybeSingle();
  const calcOk = hanPay && hanPay.calc_method === "usol_n_본작업";
  console.log(`  ${calcOk ? "✅" : "⚠️"} payments calc_method = ${hanPay?.calc_method} | eng=${hanPay?.engineer_amount} prin=${hanPay?.principal_amount} own=${hanPay?.owner_amount}`);
  if (!calcOk) logIssue("1", `한인규 calc_method=${hanPay?.calc_method} (기대 usol_n_본작업)`);

  // -----------------------------------------------------------
  // 2. B그룹 7건
  // -----------------------------------------------------------
  console.log("\n【2-A. 완료 5건 — status='완료' + completed_at】");
  for (const task_no of TO_COMPLETE) {
    const { data: t } = await sb.from("tasks").select("*").eq("task_no", task_no).maybeSingle();
    const okStatus = t.status === "완료";
    const okComp = !!t.completed_at;
    const mark = (okStatus && okComp) ? "✅" : "⚠️";
    console.log(`  ${mark} ${task_no} ${t.customer_name} | status=${t.status} | comp=${(t.completed_at||'NULL').slice(0,16)}`);
    if (!okStatus) logIssue("2-A", `${task_no} status=${t.status}`);
    if (!okComp) logIssue("2-A", `${task_no} completed_at NULL`);
  }
  console.log("\n【2-B. 확정 2건 — status='확정'】");
  for (const task_no of TO_CONFIRM) {
    const { data: t } = await sb.from("tasks").select("*").eq("task_no", task_no).maybeSingle();
    const okStatus = t.status === "확정";
    const okComp = t.completed_at == null;
    const mark = (okStatus && okComp) ? "✅" : "⚠️";
    console.log(`  ${mark} ${task_no} ${t.customer_name} | status=${t.status} | comp=${t.completed_at||'NULL'}`);
    if (!okStatus) logIssue("2-B", `${task_no} status=${t.status}`);
    if (!okComp) logIssue("2-B", `${task_no} completed_at=${t.completed_at}`);
  }

  // -----------------------------------------------------------
  // 3. 전체 40건 정합성
  // -----------------------------------------------------------
  console.log("\n【3. 전체 40건 정합성】");
  const { data: tasks40 } = await sb.from("tasks").select("task_no, customer_name, status, scheduled_at, completed_at").in("task_no", ALL_40);

  const inconsist = [];
  for (const t of (tasks40 || [])) {
    const s = t.status;
    const sched = t.scheduled_at;
    const comp = t.completed_at;

    // 측 catch '취소' 측 catch 측 catch
    if (s === "취소") continue;

    // 측 1: sched 측 catch 5/24 측 catch 측 catch status≠완료
    if (sched && sched < KST_525_BOUNDARY && s !== "완료") {
      inconsist.push({ task_no: t.task_no, cust: t.customer_name, why: `측 catch ${sched.slice(0,16)} (5/24 측 catch) 측 catch status=${s} (기대 완료)` });
    }
    // 측 2: sched가 5/25 이후 측 catch status=완료
    if (sched && sched >= KST_525_BOUNDARY && s === "완료") {
      inconsist.push({ task_no: t.task_no, cust: t.customer_name, why: `측 catch ${sched.slice(0,16)} (5/25 측 catch) 측 catch status=완료` });
    }
    // 측 3: comp 측 catch 측 catch status≠완료
    if (comp && s !== "완료") {
      inconsist.push({ task_no: t.task_no, cust: t.customer_name, why: `comp=${comp.slice(0,16)} 측 catch 측 catch status=${s}` });
    }
    // 측 4: status=완료 측 catch comp 측 catch X
    if (s === "완료" && !comp) {
      inconsist.push({ task_no: t.task_no, cust: t.customer_name, why: `status=완료 측 catch comp 측 catch X` });
    }
  }

  if (inconsist.length === 0) {
    console.log("  ✅ 측 catch 측 catch X");
  } else {
    console.log(`  ⚠️ 측 catch ${inconsist.length}건:`);
    for (const v of inconsist) {
      console.log(`    · ${v.task_no.padEnd(20)} ${(v.cust||'').padEnd(8)} — ${v.why}`);
      logIssue("3", `${v.task_no} ${v.cust}: ${v.why}`);
    }
  }

  // -----------------------------------------------------------
  // 측 catch
  // -----------------------------------------------------------
  console.log("\n" + "=".repeat(120));
  if (issues.length === 0) {
    console.log("✅ 측 catch 측 catch 없음.");
  } else {
    console.log(`⚠️ 측 catch ${issues.length}건:`);
    issues.forEach(i => console.log(`  · ${i}`));
  }
  console.log("=".repeat(120));
})().catch(e => console.log("FATAL:", e.message, e.stack));

// 진단 — 40건 status-일정 정합성 + 한인규 vs YS-260427-003 컬럼 비교. 수정 X.
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
  // A 10건
  "YS-N-260524-005", "YS-260517-037", "YS-260515-024", "YS-260515-037", "YS-260519-051",
  "YS-260518-096", "YS-260504-029", "YS-260503-001", "YS-N-260524-004", "YS-260516-169",
  // B 14건
  "YS-260518-086", "YS-260430-010", "YS-260512-021", "YS-260516-069", "YS-N-260524-007",
  "YS-N-260524-011", "YS-260428-055", "YS-N-260524-003", "YS-N-260524-002", "YS-N-260524-008",
  "YS-260520-016", "YS-260518-085", "YS-260517-039", "YS-260520-021",
  // C 1건
  "YS-260425-010",
  // D 1건
  "YS-260501-011",
  // E 2건
  "YS-260512-063", "YS-260430-023",
  // F 1건
  "YS-260516-162",
  // G 1건
  "YS-260427-004",
  // 5/24 10건
  "YS-260519-015", "YS-260518-098", "YS-260516-012", "YS-260521-013", "YS-260516-157",
  "YS-260516-158", "YS-260518-040", "YS-260515-061", "YS-260518-049", "YS-260517-033",
];

(async () => {
  // -----------------------------------------------------------
  // A. status-일정 정합성
  // -----------------------------------------------------------
  console.log("=".repeat(120));
  console.log("【A. 40건 status-일정 정합성】");
  console.log("=".repeat(120));

  const { data: tasks } = await sb.from("tasks").select("task_no, customer_name, status, scheduled_at, completed_at, assigned_engineer_id").in("task_no", ALL_40);

  const violations = [];
  for (const t of (tasks || [])) {
    const hasSched = !!t.scheduled_at;
    const hasComp = !!t.completed_at;
    const hasEng = !!t.assigned_engineer_id;
    const s = t.status;

    // 측 1: scheduled_at 측 catch 측 catch status='배정' — '확정' 측 catch 측 catch
    if (hasSched && s === "배정") {
      violations.push({ task_no: t.task_no, cust: t.customer_name, col: "status", cur: s, expect: "확정", note: "sched 측 catch 측 catch '확정' 측 catch" });
    }
    // 측 2: completed_at 측 catch 측 catch status≠'완료'
    if (hasComp && s !== "완료") {
      violations.push({ task_no: t.task_no, cust: t.customer_name, col: "status", cur: s, expect: "완료", note: "comp 측 catch 측 catch '완료' 측 catch" });
    }
    // 측 3: status='완료' 측 catch completed_at 측 catch X
    if (s === "완료" && !hasComp) {
      violations.push({ task_no: t.task_no, cust: t.customer_name, col: "completed_at", cur: "NULL", expect: "측 catch 측 catch", note: "완료인데 comp 측 catch X" });
    }
    // 측 4: status='확정' 측 catch scheduled_at 측 catch X
    if (s === "확정" && !hasSched) {
      violations.push({ task_no: t.task_no, cust: t.customer_name, col: "scheduled_at", cur: "NULL", expect: "측 catch 측 catch", note: "확정인데 sched 측 catch X" });
    }
    // 측 5: status='취소' 측 catch completed_at 측 catch
    if (s === "취소" && hasComp) {
      violations.push({ task_no: t.task_no, cust: t.customer_name, col: "completed_at", cur: t.completed_at, expect: "NULL", note: "취소인데 comp 측 catch 측 catch" });
    }
    // 측 6: 배정 측 catch assigned_engineer_id 측 catch X
    if ((s === "배정" || s === "확정") && !hasEng) {
      violations.push({ task_no: t.task_no, cust: t.customer_name, col: "assigned_engineer_id", cur: "NULL", expect: "측 catch 측 catch", note: `${s}측 catch 기사 측 catch X` });
    }
  }

  console.log(`\n측 ${(tasks || []).length}건 측 ${violations.length}건 측 catch 측 catch\n`);
  if (violations.length > 0) {
    console.log(`${"작업번호".padEnd(20)} | ${"고객".padEnd(8)} | ${"컬럼".padEnd(22)} | ${"현재값".padEnd(28)} | ${"있어야 할 값".padEnd(18)} | 비고`);
    console.log("-".repeat(140));
    for (const v of violations) {
      const cur = String(v.cur).slice(0, 28).padEnd(28);
      console.log(`${v.task_no.padEnd(20)} | ${(v.cust || "").padEnd(8)} | ${v.col.padEnd(22)} | ${cur} | ${v.expect.padEnd(18)} | ${v.note}`);
    }
  } else {
    console.log("측 catch 측 catch X.");
  }

  // -----------------------------------------------------------
  // B. 한인규 YS-260427-004 vs YS-260427-003 컬럼 비교
  // -----------------------------------------------------------
  console.log("\n" + "=".repeat(120));
  console.log("【B. 한인규 YS-260427-004 vs YS-260427-003 컬럼 비교】");
  console.log("=".repeat(120));

  const { data: rows } = await sb.from("tasks").select("*").in("task_no", ["YS-260427-004", "YS-260427-003"]);
  const t004 = (rows || []).find(r => r.task_no === "YS-260427-004");
  const t003 = (rows || []).find(r => r.task_no === "YS-260427-003");

  if (!t003) { console.log("YS-260427-003 측 catch X — 비교 불가"); }
  else if (!t004) { console.log("YS-260427-004 측 catch X"); }
  else {
    // 측 catch 측 catch 측 catch
    const allCols = new Set([...Object.keys(t003), ...Object.keys(t004)]);
    const diffs = [];
    for (const col of [...allCols].sort()) {
      // 다른 측 catch — id, task_no, created_at, updated_at 측 catch
      if (["id", "task_no", "created_at", "updated_at"].includes(col)) continue;
      const v3 = t003[col];
      const v4 = t004[col];
      const eq = JSON.stringify(v3) === JSON.stringify(v4);
      if (!eq) diffs.push({ col, v003: v3, v004: v4 });
    }

    console.log(`\n측 ${allCols.size}개 측 catch 측 ${diffs.length}개 측 catch:\n`);
    console.log(`${"컬럼".padEnd(28)} | ${"YS-260427-004 (한인규)".padEnd(40)} | YS-260427-003 (측 catch)`);
    console.log("-".repeat(140));
    for (const d of diffs) {
      const v4str = (d.v004 === null ? "NULL" : typeof d.v004 === "object" ? JSON.stringify(d.v004) : String(d.v004)).slice(0, 40).padEnd(40);
      const v3str = (d.v003 === null ? "NULL" : typeof d.v003 === "object" ? JSON.stringify(d.v003) : String(d.v003)).slice(0, 60);
      console.log(`${d.col.padEnd(28)} | ${v4str} | ${v3str}`);
    }

    // 측 catch 측 catch (특히 화면 측 catch — region, channel, n_mark 측 catch)
    console.log("\n[측 catch 측 catch 측 catch — 화면 측 catch]");
    const keyCols = ["region", "region_name", "channel", "channel_code", "sub_channel", "source", "platform", "principal_id", "category_id", "address", "address_detail", "address_dong", "address_ho", "naver_order_no", "naver_product_no", "product_order_id", "product_name", "memo", "request_note"];
    console.log(`${"컬럼".padEnd(28)} | ${"YS-260427-004".padEnd(40)} | YS-260427-003`);
    console.log("-".repeat(140));
    for (const col of keyCols) {
      if (!(col in t003) && !(col in t004)) continue;
      const v4 = t004[col];
      const v3 = t003[col];
      const v4str = (v4 === null || v4 === undefined ? "NULL" : typeof v4 === "object" ? JSON.stringify(v4) : String(v4)).slice(0, 40).padEnd(40);
      const v3str = (v3 === null || v3 === undefined ? "NULL" : typeof v3 === "object" ? JSON.stringify(v3) : String(v3)).slice(0, 60);
      const mark = JSON.stringify(v4) === JSON.stringify(v3) ? "  " : "⚠️";
      console.log(`${mark} ${col.padEnd(25)} | ${v4str} | ${v3str}`);
    }
  }

  console.log("\n" + "=".repeat(120));
  console.log("측 catch 측 catch.");
  console.log("=".repeat(120));
})().catch(e => console.log("FATAL:", e.message, e.stack));

// 진단 — isUsolNActionNeeded 측 catch 측 catch (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const USOL_N_PID = "22222222-2222-2222-2222-222222222006";

function isUsolNActionNeeded(task) {
  if (!task) return false;
  const status = task.status;
  if (status === "취소" || status === "완료" || status === "visit_only") return false;
  if (status === "미배정" || status === "약속대기" || status === "배정") return true;
  const cat = task.category_data || {};
  if (cat?.reassignRequest?.requestedAt) return true;
  return false;
}

(async () => {
  // usol_n 측 catch (statusIn:["미배정","약속대기","배정","확정","진행중"])
  const { data: page } = await sb.from("tasks")
    .select("id, task_no, customer_name, status, scheduled_at, category_data")
    .eq("principal_id", USOL_N_PID)
    .in("status", ["미배정", "약속대기", "배정", "확정", "진행중"])
    .range(0, 499);
  const tasks = page || [];

  const actionNeeded = tasks.filter(isUsolNActionNeeded);
  const byStatus = {};
  for (const t of actionNeeded) byStatus[t.status] = (byStatus[t.status] || 0) + 1;

  console.log(`[fetch — usol_n status IN ['미배정','약속대기','배정','확정','진행중']] ${tasks.length}건`);
  console.log(`\n[isUsolNActionNeeded 통과] ${actionNeeded.length}건`);
  console.log("  status 측 catch:", JSON.stringify(byStatus, null, 2));

  // reassignRequest 측 catch + status=확정/진행중 측 catch 측 catch 측 catch 측 catch
  const reassignInDoneStatus = tasks.filter(t => {
    const cat = t.category_data || {};
    return cat?.reassignRequest?.requestedAt && (t.status === "확정" || t.status === "진행중");
  });
  console.log(`\n[★ reassignRequest 측 catch + status=확정/진행중] ${reassignInDoneStatus.length}건`);
  for (const t of reassignInDoneStatus) {
    console.log(`  ${t.task_no} | ${t.customer_name} | status=${t.status} | reason=${t.category_data.reassignRequest.reason}`);
  }

  // 사장님 측 catch 측 catch 측 catch 측 catch 미처리 측 catch (영등포 / 조헌준)
  console.log(`\n[측 catch — 영등포 / 조헌준 (미처리 측 catch)]`);
  const { data: targets } = await sb.from("tasks")
    .select("id, task_no, customer_name, status, category_data")
    .in("task_no", ["YS-260424-114", "YS-260516-134"]);
  for (const t of (targets || [])) {
    const passes = isUsolNActionNeeded(t);
    const hasReassign = !!(t.category_data?.reassignRequest);
    console.log(`  ${t.task_no} | ${t.customer_name} | status=${t.status} | reassignRequest=${hasReassign} | isUsolNActionNeeded=${passes ? "✓ 측 catch" : "✗ 측 X"}`);
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

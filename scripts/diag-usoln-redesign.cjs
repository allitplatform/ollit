// 진단 — usol_n status distinct + reassignRequest 측 catch (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const USOL_N_PID = "22222222-2222-2222-2222-222222222006";

(async () => {
  // usol_n status distinct
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("tasks")
      .select("status, scheduled_at, category_data, requested_time")
      .eq("principal_id", USOL_N_PID)
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }

  const dist = {};
  for (const r of rows) dist[r.status] = (dist[r.status] || 0) + 1;
  console.log(`[usol_n tasks status distinct] 측 ${rows.length}건\n`);
  for (const [k, v] of Object.entries(dist).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${k.padEnd(15)}: ${v}`);
  }

  // reassignRequest 측 catch
  const withReassign = rows.filter(r => r.category_data && r.category_data.reassignRequest);
  console.log(`\n[usol_n + reassignRequest 측 catch] ${withReassign.length}건`);

  // 일정 협의 측 catch (scheduled_at NULL AND status IN ('배정','약속대기','확정'))
  const needSchedule = rows.filter(r =>
    !r.scheduled_at && ["배정","약속대기","확정"].includes(r.status)
  );
  console.log(`\n[usol_n + scheduled_at NULL + 측 catch 측 catch] ${needSchedule.length}건`);

  // 운영자 액션 필요 = 미배정 + 배정 + reassignRequest 측 catch (예시)
  const actionNeeded = rows.filter(r => {
    const hasReassign = !!(r.category_data && r.category_data.reassignRequest);
    return r.status === "미배정" || r.status === "배정" || r.status === "약속대기" || hasReassign;
  });
  console.log(`\n[운영자 액션 필요 측 catch (미배정+배정+약속대기+재배정요청)] ${actionNeeded.length}건`);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

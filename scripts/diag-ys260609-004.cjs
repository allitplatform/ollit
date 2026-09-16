// YS-260609-004 (김종민) 0원 송금 사유 분석
// 직영_50_50 calc_method 인데 engineer = total = 200,000 인 이유 추적
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  const { data: t } = await sb.from("tasks")
    .select(`*, principals:principal_id(code, name)`)
    .eq("task_no", "YS-260609-004").maybeSingle();
  console.log("─── TASK ───");
  console.log(JSON.stringify(t, null, 2).slice(0, 4000));

  const { data: p } = await sb.from("payments")
    .select("*").eq("task_id", t.id).maybeSingle();
  console.log("\n─── PAYMENT ───");
  console.log(JSON.stringify(p, null, 2));

  const { data: items } = await sb.from("task_work_items")
    .select("*").eq("task_id", t.id);
  console.log("\n─── WORK ITEMS ───");
  console.log(JSON.stringify(items, null, 2));
})().catch(e => { console.error("FATAL", e); process.exit(1); });

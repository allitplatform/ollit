// product_price = 0 측측 total_amount > 0 측 완료 측측 측측 (광측측 측측 측측)
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 전체 task 측 status 측 X — product=0 측측 total>0 측 모두 (측측측 측측)
  const { count: allCount } = await sb.from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("product_price", 0).gt("total_amount", 0);
  console.log(`product_price=0 + total>0  전체: ${allCount}건`);

  const { count: doneCount } = await sb.from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "완료")
    .eq("product_price", 0).gt("total_amount", 0);
  console.log(`product_price=0 + total>0  완료: ${doneCount}건`);

  // principal 분포 (완료만)
  const { data: rows } = await sb.from("tasks")
    .select("principal_id, principals:principal_id(code)")
    .eq("status", "완료")
    .eq("product_price", 0).gt("total_amount", 0);
  const byP = {};
  for (const r of (rows||[])) {
    const k = r.principals?.code || "?";
    byP[k] = (byP[k]||0) + 1;
  }
  console.log("\n분포 (완료):");
  for (const [k, v] of Object.entries(byP).sort((a,b)=>b[1]-a[1])) {
    console.log(`  ${k}: ${v}건`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

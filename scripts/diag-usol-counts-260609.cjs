// 2026-06-09 — usol_h vs usol_n 작업 총건수 + status 분포.
const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));
L(path.join(__dirname,"..",".env.local"));
const {createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});

(async()=>{
  for (const code of ["usol_h","usol_n"]) {
    const { data: pr } = await sb.from("principals").select("id,name").eq("code", code).maybeSingle();
    if (!pr) { console.log(`${code}: principal X`); continue; }
    const { count: total } = await sb.from("tasks").select("*",{count:"exact",head:true}).eq("principal_id", pr.id);
    // status 분포 (전체)
    const { data: rows } = await sb.from("tasks").select("status").eq("principal_id", pr.id).limit(10000);
    const dist = {};
    for (const r of (rows||[])) dist[r.status||"(null)"] = (dist[r.status||"(null)"]||0)+1;
    const active = (rows||[]).filter(r => !["완료","정산완료","취소","visit_only"].includes(r.status)).length;
    const done   = (rows||[]).filter(r => ["완료","정산완료","visit_only"].includes(r.status)).length;
    console.log(`\n=== ${code} (${pr.name}) ===`);
    console.log(`  총건수: ${total}`);
    console.log(`  활성 (미배정/배정/확정/진행중 등): ${active}`);
    console.log(`  완료/visit_only/정산완료: ${done}`);
    console.log(`  status 분포:`);
    for (const [s,c] of Object.entries(dist).sort((a,b)=>b[1]-a[1])) {
      console.log(`    ${s.padEnd(12)} ${c}`);
    }
  }

  // 30일 측 활성 + 최근 완료
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30);
  console.log(`\n=== 최근 30일 (${cutoff.toISOString().slice(0,10)} 이후) ===`);
  for (const code of ["usol_h","usol_n"]) {
    const { data: pr } = await sb.from("principals").select("id").eq("code", code).maybeSingle();
    if (!pr) continue;
    const { count: recent } = await sb.from("tasks")
      .select("*",{count:"exact",head:true})
      .eq("principal_id", pr.id)
      .gte("received_at", cutoff.toISOString());
    console.log(`  ${code}: 최근 30일 received_at ${recent}건`);
  }
})();

const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
(async()=>{
  // 1) trigger 존재 확인 (rpc 또는 직접 raw 쿼리 — supabase-js로는 information_schema 직접 select 가능)
  const{data:trgs,error:e1}=await sb.from("pg_trigger").select("tgname").eq("tgname","auto_init_user_auth_trg");
  if(e1) console.log("(pg_trigger 직접 SELECT 불가 — Supabase 권한)", e1.message);
  else console.log("[B-1] trigger 존재:", trgs?.length>0 ? "✓ auto_init_user_auth_trg":"✗ 없음");

  // 2) users 최근 row — password_hash 채워졌는지
  const{data:recent}=await sb.from("users").select("code,name,phone,email,role,must_change_password,created_at,password_hash").order("created_at",{ascending:false}).limit(15);
  console.log(`\n[C] 최근 users 15건:`);
  for(const u of (recent||[])){
    const hasPw = u.password_hash ? "✓" : "✗";
    console.log(`  ${(u.created_at||"").slice(0,16)} | code=${u.code} | ${u.name} | role=${u.role} | phone=${u.phone} | email=${u.email||"(NULL)"} | pw=${hasPw} | must_change=${u.must_change_password}`);
  }

  // 3) password_hash NULL인 row 있는지
  const{count:nullCnt}=await sb.from("users").select("id",{count:"exact",head:true}).is("password_hash",null);
  const{count:totalCnt}=await sb.from("users").select("id",{count:"exact",head:true});
  console.log(`\n[C-합계] password_hash NULL: ${nullCnt}건 / 전체: ${totalCnt}건`);

  // 4) role 분포
  const{data:roles}=await sb.from("users").select("role");
  const byRole={};
  for(const r of (roles||[])) byRole[r.role||"(NULL)"]=(byRole[r.role||"(NULL)"]||0)+1;
  console.log(`\n[D] role 분포:`, JSON.stringify(byRole));
})().catch(e=>{console.error("FATAL",e.message,e.stack);process.exit(1);});

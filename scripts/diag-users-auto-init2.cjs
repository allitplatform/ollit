const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
(async()=>{
  // 명시 range
  const{data:recent,error}=await sb.from("users").select("id,code,name,phone,email,role,must_change_password,created_at,password_hash").order("created_at",{ascending:false}).range(0,99);
  if(error){console.error("ERR",error);return;}
  console.log(`SELECT range(0,99) → ${recent?.length||0}건`);
  
  // role 분포
  const byRole={};
  let hashed=0, noHash=0, mustChange=0;
  for(const u of (recent||[])){
    byRole[u.role||"(NULL)"]=(byRole[u.role||"(NULL)"]||0)+1;
    if(u.password_hash) hashed++; else noHash++;
    if(u.must_change_password) mustChange++;
  }
  console.log(`role 분포:`, JSON.stringify(byRole));
  console.log(`password_hash 있음: ${hashed} / 없음: ${noHash}`);
  console.log(`must_change_password=true: ${mustChange}건`);
  
  console.log(`\n[최근 15건 dump]`);
  for(const u of (recent||[]).slice(0,15)){
    const hasPw = u.password_hash ? "✓" : "✗";
    console.log(`  ${(u.created_at||"").slice(0,16)} | code=${u.code||"?"} | ${u.name||"?"} | role=${u.role||"?"} | phone=${u.phone||"?"} | email=${u.email||"NULL"} | pw=${hasPw} | mc=${u.must_change_password}`);
  }

  // 최근 14일 신규
  const cutDate = new Date(Date.now() - 14*24*3600*1000).toISOString();
  const recent14 = (recent||[]).filter(u => u.created_at >= cutDate);
  console.log(`\n[최근 14일 신규 ${recent14.length}건] (auto trigger 동작 검증용)`);
  for(const u of recent14){
    const phoneClean = (u.phone||"").replace(/[-\s+]/g,"");
    const expectedEmail = phoneClean + "@allit.internal";
    const emailMatch = u.email === expectedEmail ? "✓" : `✗ (got: ${u.email})`;
    console.log(`  ${u.name} | phone=${u.phone} | email매칭=${emailMatch} | pw=${u.password_hash?"✓":"✗"} | must_change=${u.must_change_password}`);
  }
})().catch(e=>{console.error("FATAL",e.message,e.stack);process.exit(1);});

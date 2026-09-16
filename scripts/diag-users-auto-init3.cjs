const fs=require("fs"),path=require("path");
function L(f){if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;}}
L(path.join(__dirname,"..",".env"));L(path.join(__dirname,"..",".env.local"));
const{createClient}=require("@supabase/supabase-js");
const sb=createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
(async()=>{
  // users 컬럼만 (role 제외)
  const{data:recent,error}=await sb.from("users").select("id,code,name,phone,email,must_change_password,created_at,password_hash").order("created_at",{ascending:false}).range(0,49);
  if(error){console.error("ERR",error);return;}
  console.log(`전체 users: ${recent?.length||0}건\n`);
  let hashed=0, noHash=0, mustChange=0;
  for(const u of (recent||[])){
    if(u.password_hash) hashed++; else noHash++;
    if(u.must_change_password) mustChange++;
  }
  console.log(`password_hash 있음: ${hashed} / 없음: ${noHash}`);
  console.log(`must_change_password=true: ${mustChange}건\n`);

  console.log(`[전체 dump]`);
  for(const u of (recent||[])){
    const phoneClean = (u.phone||"").replace(/[-\s+]/g,"");
    const expectedEmail = phoneClean ? phoneClean + "@allit.internal" : "(phone없음)";
    const emailMatch = u.email === expectedEmail ? "✓" : (u.email ? "✗" : "NULL");
    console.log(`  ${(u.created_at||"").slice(0,10)} | code=${(u.code||"?").padEnd(6)} | ${(u.name||"?").padEnd(8)} | phone=${(u.phone||"?").padEnd(13)} | email=${(u.email||"NULL").padEnd(28)} | pw=${u.password_hash?"✓":"✗"} | mc=${u.must_change_password} | email매칭=${emailMatch}`);
  }

  // user_roles 테이블 — role 분기 확인
  const{data:roles,error:e2}=await sb.from("user_roles").select("user_id,role,principal_code").range(0,99);
  if(e2) console.log(`\nuser_roles 조회 실패: ${e2.message}`);
  else {
    console.log(`\n[D] user_roles ${roles?.length||0}건`);
    const byRole={};
    for(const r of (roles||[])) byRole[r.role]=(byRole[r.role]||0)+1;
    console.log(`  role 분포:`,JSON.stringify(byRole));
  }

  // RPC로 trigger 존재 확인 — execute_sql RPC가 없으면 우회
  console.log(`\n[B] trigger 존재 확인 — Mig 030 코드는 존재하나 실제 DB에 적용됐는지`);
  console.log(`  → 직접 검증 불가 (pg_trigger에 직접 SELECT 권한 없음)`);
  console.log(`  → 간접 신호: password_hash NULL=${noHash} 이므로`);
  if(noHash===0) console.log(`    ✓ 모든 users가 password_hash 있음 → 트리거 동작 강력 신호 (또는 백필 완료 + 신규 추가 없음)`);
})().catch(e=>{console.error("FATAL",e.message,e.stack);process.exit(1);});

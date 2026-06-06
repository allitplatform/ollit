// 측측측 측 측측 측측 측측 — 이지은 / 마장로13길 18
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  console.log("\n=== 측측: 이지은 / 마장로13길 18 ===");
  // 1) 측측측 측측 후보 측측
  const { data: tasks } = await sb
    .from("tasks")
    .select("id, task_no, customer_name, phone, address, district, status, scheduled_at, completed_at, updated_at, category_data, principal_id, principals:principal_id(code,name)")
    .or("customer_name.eq.이지은,address.ilike.%마장로13길 18%")
    .order("received_at", { ascending: false });

  console.log(`측측: ${(tasks||[]).length}건`);
  for (const t of (tasks||[])) {
    console.log("\n--- task ---");
    console.log("  id:           ", t.id);
    console.log("  task_no:      ", t.task_no);
    console.log("  customer:     ", t.customer_name);
    console.log("  phone:        ", t.phone);
    console.log("  address:      ", t.address);
    console.log("  district:     ", t.district);
    console.log("  status:       ", t.status);
    console.log("  scheduled_at: ", t.scheduled_at);
    console.log("  completed_at: ", t.completed_at);
    console.log("  updated_at:   ", t.updated_at);
    console.log("  principal:    ", t.principals?.code, "/", t.principals?.name);
    // 측측 측측 측측 (category_data 측 평탄화)
    const cat = t.category_data || {};
    const cancelKeys = ["cancelReason","cancelActor","cancelActorUserId","cancelActorPrincipalCode","cancelAt","previousStatus","wasCompleted"];
    const cancelDump = {};
    for (const k of cancelKeys) {
      if (cat[k] !== undefined) cancelDump[k] = cat[k];
    }
    if (Object.keys(cancelDump).length > 0) {
      console.log("  cancel(category_data):", JSON.stringify(cancelDump, null, 2));
    } else {
      console.log("  cancel(category_data): (없음)");
    }

    // 사진
    const { data: photos } = await sb
      .from("task_photos")
      .select("id, step, url, file_path, created_at")
      .eq("task_id", t.id)
      .order("created_at", { ascending: true });
    console.log(`  사진: ${(photos||[]).length}장`);
    for (const p of (photos||[])) {
      console.log(`    - id=${p.id} step=${p.step} created=${p.created_at?.slice(0,16)} url=${(p.url||p.file_path||"").slice(0,80)}`);
    }
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

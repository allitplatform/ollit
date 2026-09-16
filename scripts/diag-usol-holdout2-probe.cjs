// 유솔 보류 2건 INSERT 전 사전 조회 — work_types/appliance_types ID 확인 + 현재 task 수 확인
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

(async () => {
  console.log("=".repeat(100));
  console.log("유솔 보류 2건 — 사전 조회");
  console.log("=".repeat(100));

  // 1. work_types 전체 조회 (실외기 청소, 세척_벽걸이 찾기)
  const { data: workTypes } = await sb.from("work_types").select("id, code, name, appliance_type_id");
  const { data: applianceTypes } = await sb.from("appliance_types").select("id, code, name");
  const { data: principals } = await sb.from("principals").select("id, code");

  const usolN = principals.find(p => p.code === "usol_n");
  console.log(`\nusol_n principal_id: ${usolN.id}`);

  // 2. 실외기 청소 work_type 찾기
  console.log("\n--- '실외기 청소' / '실외기' 관련 work_types ---");
  const outdoor = workTypes.filter(w => /실외기/.test(w.name) || /outdoor|refri/i.test(w.code));
  for (const w of outdoor) {
    const ap = applianceTypes.find(a => a.id === w.appliance_type_id);
    console.log(`  id=${w.id} code=${w.code} name='${w.name}' appliance=${ap ? `${ap.code}/${ap.name}` : "NULL"}`);
  }

  // 3. 세척_벽걸이 + 벽걸이
  console.log("\n--- '세척_벽걸이' / '벽걸이' 관련 work_types ---");
  const wall = workTypes.filter(w => /벽걸이|wall/i.test(w.name + " " + w.code));
  for (const w of wall) {
    const ap = applianceTypes.find(a => a.id === w.appliance_type_id);
    console.log(`  id=${w.id} code=${w.code} name='${w.name}' appliance=${ap ? `${ap.code}/${ap.name}` : "NULL"}`);
  }

  // 4. 벽걸이 appliance_type
  console.log("\n--- '벽걸이' appliance_types ---");
  const wallAp = applianceTypes.filter(a => /벽걸이|wall/i.test(a.name + " " + a.code));
  for (const a of wallAp) {
    console.log(`  id=${a.id} code=${a.code} name='${a.name}'`);
  }

  // 5. 추가선택 실외기와 동일 work_type 검증 — 기존 task_items에서 order_type='추가선택'+name='실외기 청소' 샘플
  console.log("\n--- 기존 추가선택 실외기 task_items 샘플 (실제 사용 검증) ---");
  const outdoorIds = outdoor.map(w => w.id);
  if (outdoorIds.length > 0) {
    const { data: items } = await sb.from("task_items").select("task_id, work_type_id, appliance_type_id, order_type").in("work_type_id", outdoorIds).eq("order_type", "추가선택").limit(5);
    for (const it of (items || [])) {
      const w = workTypes.find(x => x.id === it.work_type_id);
      const a = applianceTypes.find(x => x.id === it.appliance_type_id);
      console.log(`  task_id=${it.task_id} work='${w?.name}' appliance='${a?.name || "NULL"}' order=${it.order_type}`);
    }
  }

  // 6. 현재 usol_n task 수
  const { count: usolNCount } = await sb.from("tasks").select("id", { count: "exact", head: true }).eq("principal_id", usolN.id);
  console.log(`\n현재 usol_n task 총수: ${usolNCount} (목표: 1325 → 1327)`);

  // 7. 보류 2건 코드가 이미 DB에 있는지 확인
  const codes = ["YS-260516-038", "YS-260424-081"];
  const { data: existing } = await sb.from("tasks").select("task_no").in("task_no", codes);
  console.log(`\n보류 2건 DB 존재 여부: ${existing?.length || 0}건`);
  for (const c of codes) {
    console.log(`  ${c}: ${existing?.find(e => e.task_no === c) ? "⚠️ 이미 존재" : "✅ 없음"}`);
  }

  console.log("\n" + "=".repeat(100));
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

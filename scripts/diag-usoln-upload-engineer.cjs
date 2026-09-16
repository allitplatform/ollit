// 진단 — usol_n 업로드 시 기사 배정 여부 + 윤다희 기사 배정 시점 추적 (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const USOL_N_PID = "22222222-2222-2222-2222-222222222006";

(async () => {
  // B-1. 윤다희 task 정보 + created_at
  const { data: yd } = await sb.from("tasks")
    .select("id, task_no, customer_name, status, assigned_engineer_id, recommended_engineer_id, scheduled_at, created_at, updated_at, received_at, external_received_at")
    .eq("task_no", "YS-N-260526-046")
    .maybeSingle();

  console.log("[B-1. 윤다희 (YS-N-260526-046) 현재 상태]");
  if (yd) {
    console.log("  id                       :", yd.id);
    console.log("  status                   :", yd.status);
    console.log("  assigned_engineer_id     :", yd.assigned_engineer_id);
    console.log("  recommended_engineer_id  :", yd.recommended_engineer_id);
    console.log("  created_at               :", yd.created_at);
    console.log("  updated_at               :", yd.updated_at);
    console.log("  received_at              :", yd.received_at);
    console.log("  external_received_at     :", yd.external_received_at);
    if (yd.assigned_engineer_id) {
      const { data: u } = await sb.from("users").select("code, name").eq("id", yd.assigned_engineer_id).maybeSingle();
      console.log("  → 현재 기사              :", u ? `${u.code} ${u.name}` : "(매핑 X)");
    }
  } else {
    console.log("  task 없음");
    return;
  }

  // B-2. 윤다희 task_changes 이력 전체 — 측 측 measurement
  const { data: changes } = await sb.from("task_changes")
    .select("change_type, before_data, after_data, note, changed_by_name, changed_at")
    .eq("task_id", yd.id)
    .order("changed_at", { ascending: true });

  console.log(`\n[B-2. 윤다희 task_changes 이력 (오래된 측 측, ${(changes || []).length}건)]`);
  for (const c of (changes || [])) {
    const before = c.before_data ? JSON.stringify(c.before_data) : "—";
    const after  = c.after_data  ? JSON.stringify(c.after_data)  : "—";
    console.log(`  ${c.changed_at} | ${c.change_type} | by ${c.changed_by_name || "?"}`);
    console.log(`    before: ${before}`);
    console.log(`    after : ${after}`);
    if (c.note) console.log(`    note  : ${c.note}`);
  }

  // B-3. created_at vs 측 catch 기사 배정 measurement 측 catch — 측 측 측 측 측 측 측 측
  const engineerChanges = (changes || []).filter(c => c.change_type === "engineer");
  if (engineerChanges.length > 0) {
    const firstAssign = engineerChanges[0]; // ascending sort 측 catch 측 catch 측 측 measurement
    const createdMs = new Date(yd.created_at).getTime();
    const firstAssignMs = new Date(firstAssign.changed_at).getTime();
    const diffSec = Math.round((firstAssignMs - createdMs) / 1000);
    console.log(`\n[B-3. 업로드 측 catch ↔ 측 measurement 기사 배정 측 measurement 측 catch]`);
    console.log(`  created_at        : ${yd.created_at}`);
    console.log(`  측 measurement 배정   : ${firstAssign.changed_at}`);
    console.log(`  측 measurement       : ${diffSec >= 0 ? "+" : ""}${diffSec}초 ${diffSec >= 60 ? `(${Math.floor(diffSec/60)}분)` : ""}`);
    console.log(`  → ${diffSec < 5 ? "업로드 측 catch 측 측 측" : "업로드 측 catch 측 catch 측 측 measurement 배정"}`);
  } else {
    console.log(`\n[B-3] task_changes 측 catch engineer change 측 X — 측 catch task_changes 측 catch 측 catch 측 measurement 측 catch 측 catch.`);
  }

  // C. usol_n 전체 분포 — assigned / recommended NULL 패턴
  let rows = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("tasks")
      .select("task_no, status, assigned_engineer_id, recommended_engineer_id, created_at")
      .eq("principal_id", USOL_N_PID)
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`\n[C. usol_n 전체 분포 — ${rows.length}건]`);

  const buckets = {
    assignedNotNull_byStatus:       {},
    recommendedOnly_byStatus:        {},
    bothNull_byStatus:               {},
  };
  for (const r of rows) {
    const hasAssigned    = !!r.assigned_engineer_id;
    const hasRecommended = !!r.recommended_engineer_id;
    if (hasAssigned) {
      buckets.assignedNotNull_byStatus[r.status] = (buckets.assignedNotNull_byStatus[r.status] || 0) + 1;
    } else if (hasRecommended) {
      buckets.recommendedOnly_byStatus[r.status] = (buckets.recommendedOnly_byStatus[r.status] || 0) + 1;
    } else {
      buckets.bothNull_byStatus[r.status] = (buckets.bothNull_byStatus[r.status] || 0) + 1;
    }
  }

  const sumBucket = b => Object.values(b).reduce((a, b) => a + b, 0);
  console.log(`\n  [a] assigned_engineer_id IS NOT NULL — ${sumBucket(buckets.assignedNotNull_byStatus)}건`);
  for (const [k, v] of Object.entries(buckets.assignedNotNull_byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`        ${k.padEnd(12)}: ${v}`);
  }
  console.log(`\n  [b] recommended만 있음, assigned NULL — ${sumBucket(buckets.recommendedOnly_byStatus)}건`);
  for (const [k, v] of Object.entries(buckets.recommendedOnly_byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`        ${k.padEnd(12)}: ${v}`);
  }
  console.log(`\n  [c] 둘 다 NULL — ${sumBucket(buckets.bothNull_byStatus)}건`);
  for (const [k, v] of Object.entries(buckets.bothNull_byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`        ${k.padEnd(12)}: ${v}`);
  }

  // C-2. 측 측 측 측 측 측 — assigned IS NOT NULL + status='배정' 측 측 측 측 측 측
  const assignedAndAssignStatus = rows.filter(r => r.assigned_engineer_id && r.status === "배정");
  console.log(`\n  ★ assigned NOT NULL + status='배정' (사장님이 측 측 측 측 측 측 측 측 측 catch): ${assignedAndAssignStatus.length}건`);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

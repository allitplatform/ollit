// 2차 수정 — 한인규 원청 정정 + B그룹 status 정리. 백업 후 적용.
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

function kst(y, m, d, h = 9, mi = 0) {
  return new Date(Date.UTC(y, m - 1, d, h - 9, mi, 0)).toISOString();
}
function plus2h(iso) {
  return new Date(new Date(iso).getTime() + 2 * 3600 * 1000).toISOString();
}

// ============================================================
// 대상
// ============================================================
const TARGET_HAN = "YS-260427-004";   // 한인규
const REF_TASK   = "YS-260427-003";   // 같은 주문 측 catch

const TO_COMPLETE = [
  "YS-260428-055",   // 강주희 5/4
  "YS-N-260524-003", // 손동원 5/17
  "YS-N-260524-002", // 이서현 5/19
  "YS-260516-069",   // 오아름 5/22
  "YS-N-260524-007", // 양재훈 5/23
];
const TO_CONFIRM = [
  "YS-260518-086",   // 공영미 5/27
  "YS-N-260524-008", // 이영수 5/25
];

// ============================================================
// 백업
// ============================================================
async function backupAll() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `fix2-${stamp}.json`);

  const taskNos = [TARGET_HAN, REF_TASK, ...TO_COMPLETE, ...TO_CONFIRM];
  const { data: tasks } = await sb.from("tasks").select("*").in("task_no", taskNos);
  const taskIds = (tasks || []).map(t => t.id);
  const safeIds = taskIds.length ? taskIds : ["00000000-0000-0000-0000-000000000000"];
  const { data: payments }   = await sb.from("payments").select("*").in("task_id", safeIds);
  const { data: task_items } = await sb.from("task_items").select("*").in("task_id", safeIds);

  fs.writeFileSync(file, JSON.stringify({
    timestamp: new Date().toISOString(),
    targets: { TARGET_HAN, REF_TASK, TO_COMPLETE, TO_CONFIRM },
    tasks: tasks || [], payments: payments || [], task_items: task_items || [],
  }, null, 2));
  console.log(`백업 저장: ${file}`);
  console.log(`  tasks=${(tasks||[]).length} payments=${(payments||[]).length} task_items=${(task_items||[]).length}`);
}

async function getTask(task_no) {
  const { data } = await sb.from("tasks").select("*").eq("task_no", task_no).maybeSingle();
  return data;
}
async function hasPayment(taskId) {
  const { data } = await sb.from("payments").select("id, calc_method, engineer_amount, principal_amount, owner_amount").eq("task_id", taskId).maybeSingle();
  return data;
}
async function touchTaskItem(taskId) {
  const { data: items } = await sb.from("task_items").select("id, qty").eq("task_id", taskId).limit(1);
  if (!items || items.length === 0) return false;
  const { error } = await sb.from("task_items").update({ qty: items[0].qty }).eq("id", items[0].id);
  return !error;
}

// ============================================================
// 1. 한인규 측 catch
// ============================================================
async function fixHaningyu() {
  console.log("\n【1. 한인규 YS-260427-004 — 원청 정정 + 필드 보정 + 정산 재계산】");

  // 측 catch '003' 측 catch (측 catch 측 catch 측 catch)
  const ref = await getTask(REF_TASK);
  if (!ref) { console.log(`  ❌ 측 catch ${REF_TASK} 측 catch X`); return; }

  const t = await getTask(TARGET_HAN);
  if (!t) { console.log(`  ❌ ${TARGET_HAN} 측 catch X`); return; }

  const beforePay = await hasPayment(t.id);
  console.log(`  현재 payments: ${beforePay ? `eng=${beforePay.engineer_amount} prin=${beforePay.principal_amount} own=${beforePay.owner_amount} [${beforePay.calc_method}]` : "(없음)"}`);

  // 측 catch 측 catch 측 catch:
  // - 원청/채널/지역/측 catch 측 catch — 측 측 catch ref 측 catch
  // - 요청 측 catch — '003'과 측 catch (측 catch 주문, 측 같은 측 catch 측 catch)
  // - 측 catch 측 catch (task_no/고객/측 catch/금액/측 catch/메모) — 측 catch
  const patch = {
    principal_id: ref.principal_id,                    // usol_n
    channel: ref.channel || "네이버",
    district: ref.district || "강서구",
    address: ref.address,                              // "서울특별시 강서구 마곡서로 133 709동 1101호"
    external_order_no: ref.external_order_no,          // 측 catch 측 catch 측 catch
    requested_date: ref.requested_date || "2026-05-06",
    requested_time: ref.requested_time || "오후",
    is_legacy: true,
  };

  const { error } = await sb.from("tasks").update(patch).eq("id", t.id);
  if (error) { console.log(`  ❌ tasks UPDATE — ${error.message}`); return; }

  console.log(`  ✅ tasks UPDATE 측 catch:`);
  for (const [k, v] of Object.entries(patch)) {
    console.log(`     · ${k.padEnd(20)} → ${v === null || v === undefined ? "NULL" : String(v).slice(0, 60)}`);
  }

  // 측 catch 측 catch — task_items touch → trigger 측 catch payments 측 catch
  const fired = await touchTaskItem(t.id);
  const afterPay = await hasPayment(t.id);
  console.log(`  task_items touch: ${fired ? "OK" : "FAIL"}`);
  console.log(`  측 catch payments: ${afterPay ? `eng=${afterPay.engineer_amount} prin=${afterPay.principal_amount} own=${afterPay.owner_amount} [${afterPay.calc_method}]` : "(없음)"}`);

  if (afterPay) {
    const isUsolN = afterPay.calc_method && afterPay.calc_method.includes("usol_n");
    console.log(`  calc_method check: ${isUsolN ? "✅ usol_n 측 catch" : "⚠️ usol_n 측 catch X — " + afterPay.calc_method}`);
  }
}

// ============================================================
// 2. B그룹 status 정리
// ============================================================
async function fixBStatus() {
  console.log("\n【2-A. 완료로 측 catch (5건) — status='완료' + completed_at】");
  let okC = 0, missC = 0;
  for (const task_no of TO_COMPLETE) {
    const t = await getTask(task_no);
    if (!t) { console.log(`  ❌ ${task_no} 측 catch X`); missC++; continue; }
    if (!t.scheduled_at) { console.log(`  ❌ ${task_no} sched 측 catch X`); missC++; continue; }
    const comp = plus2h(t.scheduled_at);
    const { error } = await sb.from("tasks").update({ status: "완료", completed_at: comp }).eq("id", t.id);
    if (error) { console.log(`  ❌ ${task_no} UPDATE — ${error.message}`); missC++; continue; }
    const pay = await hasPayment(t.id);
    if (!pay) {
      const fired = await touchTaskItem(t.id);
      const re = await hasPayment(t.id);
      console.log(`  ✅ ${task_no} ${t.customer_name} → status=완료 comp=${comp.slice(0,16)} | touch(${fired?"OK":"FAIL"}) pay=${re?"○":"×"}`);
    } else {
      console.log(`  ✅ ${task_no} ${t.customer_name} → status=완료 comp=${comp.slice(0,16)} (pay 측 catch)`);
    }
    okC++;
  }
  console.log(`  → 성공 ${okC}건 / 실패 ${missC}건`);

  console.log("\n【2-B. 확정으로 측 catch (2건) — status='확정'】");
  let okF = 0, missF = 0;
  for (const task_no of TO_CONFIRM) {
    const t = await getTask(task_no);
    if (!t) { console.log(`  ❌ ${task_no} 측 catch X`); missF++; continue; }
    const { error } = await sb.from("tasks").update({ status: "확정" }).eq("id", t.id);
    if (error) { console.log(`  ❌ ${task_no} UPDATE — ${error.message}`); missF++; continue; }
    console.log(`  ✅ ${task_no} ${t.customer_name} → status=확정 (sched=${(t.scheduled_at||'').slice(0,16)})`);
    okF++;
  }
  console.log(`  → 성공 ${okF}건 / 실패 ${missF}건`);
}

// ============================================================
// main
// ============================================================
(async () => {
  console.log("=".repeat(120));
  console.log("2차 수정 — 한인규 정정 + B그룹 status 정리");
  console.log("=".repeat(120));

  await backupAll();
  await fixHaningyu();
  await fixBStatus();

  console.log("\n" + "=".repeat(120));
  console.log("적용 완료.");
  console.log("=".repeat(120));
})().catch(e => console.log("FATAL:", e.message, e.stack));

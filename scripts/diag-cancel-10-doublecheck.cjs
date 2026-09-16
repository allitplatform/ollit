// 더블체크용 리스트 — 5/22 일괄 8건 + 이보배 + 김민정 = 10건 (read-only)
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// 10건 — 8건(5/22 일괄) + 이보배(특이) + 김민정(5/25 별도)
const TARGETS = [
  { tn: "YS-260518-075", group: "5/22 일괄" },
  { tn: "YS-260517-058", group: "5/22 일괄" },
  { tn: "YS-260517-027", group: "5/22 일괄" },
  { tn: "YS-260516-115", group: "5/22 일괄" },
  { tn: "YS-260516-021", group: "5/22 일괄" },
  { tn: "YS-260515-069", group: "5/22 일괄" },
  { tn: "YS-260515-009", group: "5/22 일괄" },
  { tn: "YS-260513-005", group: "5/22 일괄" },
  { tn: "YS-260507-023", group: "특이(이보배)" },
  { tn: "YS-260514-056", group: "5/25 별도(김민정)" },
];

(async () => {
  console.log("=".repeat(140));
  console.log("usol_n 취소 작업 더블체크 — 10건 (8건 일괄 + 이보배 + 김민정)");
  console.log("작성일: 2026-05-27 / 사장님이 내일 기사님들과 대조용");
  console.log("=".repeat(140));

  const taskNos = TARGETS.map(t => t.tn);
  const { data: tasks } = await sb.from("tasks").select("id, task_no, customer_name, status, scheduled_at, started_at, completed_at, external_order_no, product_price, assigned_engineer_id, cancel_engineer_comp_kind, cancel_engineer_comp_amount, updated_at").in("task_no", taskNos);

  // 기사 이름 lookup
  const engIds = [...new Set((tasks || []).map(t => t.assigned_engineer_id).filter(Boolean))];
  const { data: users } = await sb.from("users").select("id, code, name").in("id", engIds);
  const userMap = new Map((users || []).map(u => [u.id, u]));

  // 각 task 추가 데이터
  for (const target of TARGETS) {
    const t = (tasks || []).find(x => x.task_no === target.tn);
    if (!t) { console.log(`\n[${target.tn}] NOT FOUND (${target.group})`); continue; }

    const eng = userMap.get(t.assigned_engineer_id);
    const { data: hist } = await sb.from("status_history").select("from_status, to_status, changed_at, changed_by").eq("task_id", t.id).order("changed_at");
    const { data: pays } = await sb.from("payments").select("engineer_amount, principal_amount, owner_amount, settled_at, calc_method").eq("task_id", t.id);
    const { data: changes } = await sb.from("task_changes").select("change_type, note, changed_at").eq("task_id", t.id).order("changed_at");
    const { data: photos } = await sb.from("photos").select("id, step, created_at").eq("task_id", t.id);

    const pay = (pays || [])[0];
    const lastH = (hist || [])[hist.length - 1];
    const firstH = (hist || [])[0];
    const fromBeforeCancel = (hist || []).filter(h => h.to_status === "취소")[0]?.from_status;

    console.log(`\n${"─".repeat(140)}`);
    console.log(`[${target.tn}] ${t.customer_name}  (그룹: ${target.group})`);
    console.log(`${"─".repeat(140)}`);
    console.log(`  배정 기사       : ${eng?.name || "?"} (${eng?.code || "?"})`);
    console.log(`  scheduled_at    : ${t.scheduled_at?.slice(0, 16) || "—"}  (작업 예정일)`);
    console.log(`  started_at      : ${t.started_at?.slice(0, 16) || "NULL"}`);
    console.log(`  completed_at    : ${t.completed_at?.slice(0, 16) || "NULL"}`);
    console.log(`  현재 status     : ${t.status}`);
    console.log(`  변경 전 status  : ${fromBeforeCancel || "(이력 없음)"}`);
    console.log(`  product_price   : ₩${(t.product_price || 0).toLocaleString()}`);
    console.log(`  external_order  : ${t.external_order_no || "NULL"}`);
    console.log(`  cancel 보상     : kind=${t.cancel_engineer_comp_kind || "NULL"}  amount=₩${(t.cancel_engineer_comp_amount || 0).toLocaleString()}`);
    console.log(`  updated_at      : ${t.updated_at?.slice(0, 19) || "?"}`);
    if (pay) {
      console.log(`  payments        : engineer=₩${(pay.engineer_amount || 0).toLocaleString()}  principal=₩${(pay.principal_amount || 0).toLocaleString()}  owner=₩${(pay.owner_amount || 0).toLocaleString()}`);
      console.log(`  settled_at      : ${pay.settled_at || "NULL (송금 전)"}`);
      console.log(`  calc_method     : ${pay.calc_method}`);
    } else {
      console.log(`  payments        : 없음`);
    }

    // status_history 전체
    console.log(`  status_history  : ${(hist || []).length}건`);
    for (const h of (hist || [])) {
      console.log(`      ${h.changed_at?.slice(0, 19)} | ${h.from_status || "NULL"} → ${h.to_status} | by=${h.changed_by || "NULL"}`);
    }

    // task_changes 요약
    console.log(`  task_changes    : ${(changes || []).length}건`);
    for (const c of (changes || []).slice(0, 5)) {
      console.log(`      ${c.changed_at?.slice(0, 19)} | type=${c.change_type} | ${c.note ? c.note.slice(0, 60) : ""}`);
    }

    // photos — 작업 사진 (기사 작업 흔적)
    console.log(`  photos          : ${(photos || []).length}장${(photos || []).length > 0 ? " ★ 작업 사진 있음 (기사 작업했을 가능성)" : ""}`);
    for (const p of (photos || []).slice(0, 3)) {
      console.log(`      ${p.created_at?.slice(0, 19)} | step=${p.step}`);
    }

    // 비고 — 단서
    const notes = [];
    if (t.completed_at) notes.push("completed_at 채워짐 (작업 완료 흔적)");
    if (t.started_at) notes.push("started_at 채워짐 (작업 시작 흔적)");
    if ((photos || []).length > 0) notes.push(`사진 ${photos.length}장 존재`);
    if ((hist || []).length === 0) notes.push("status_history 0건 (변경 이력 없음)");
    if (pay?.settled_at) notes.push("⚠️ 이미 정산됨"); else if (pay) notes.push("정산 전(보정 가능)");
    if (t.cancel_engineer_comp_kind === "none") notes.push("운영자가 cancel 보상 'none' 명시 설정");
    console.log(`  비고            : ${notes.join(" / ") || "—"}`);
  }

  // 압축 표
  console.log(`\n\n${"=".repeat(140)}`);
  console.log("[압축 표] 한 눈에 보기");
  console.log("=".repeat(140));
  console.log("task_no            | 고객      | 기사    | 예정일      | started    | completed  | 변경전 → 현재 | engineer  | settled   | 비고");
  console.log("─".repeat(160));
  for (const target of TARGETS) {
    const t = (tasks || []).find(x => x.task_no === target.tn);
    if (!t) continue;
    const eng = userMap.get(t.assigned_engineer_id);
    const { data: hist } = await sb.from("status_history").select("from_status, to_status").eq("task_id", t.id).eq("to_status", "취소").limit(1);
    const { data: pays } = await sb.from("payments").select("engineer_amount, settled_at").eq("task_id", t.id).limit(1);
    const fromB = hist?.[0]?.from_status || "(이력없음)";
    const pay = pays?.[0];
    const flag = t.completed_at ? "★done" : (t.started_at ? "★start" : "—");
    console.log(`${t.task_no.padEnd(18)} | ${(t.customer_name || "?").padEnd(8)} | ${(eng?.name || "?").padEnd(6)} | ${t.scheduled_at?.slice(0,10) || "—"} | ${t.completed_at?.slice(0,10) || "—  ".padEnd(10)} | ${t.completed_at?.slice(0,10) || "—".padEnd(10)} | ${fromB.padEnd(6)} → 취소 | ₩${String(pay?.engineer_amount || 0).padStart(7)} | ${pay?.settled_at ? "★송금" : "NULL"} | ${flag}`);
  }
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });

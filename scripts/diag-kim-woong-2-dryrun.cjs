// 1단계 드라이런 — 김웅 2건 수동 완료 처리 시뮬레이션 (read-only)
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TASK_NOS = ["YS-260517-041", "YS-260517-040"];

(async () => {
  console.log("=".repeat(110));
  console.log("김웅 2건 수동 완료 처리 드라이런 — UPDATE 미실행 / 표 + SQL 초안만");
  console.log("=".repeat(110));

  const tasks = [];
  for (const tn of TASK_NOS) {
    const { data: t } = await sb.from("tasks").select("*").eq("task_no", tn).single();
    if (!t) { console.log(`\n[${tn}] NOT FOUND`); continue; }
    tasks.push(t);
  }

  // [A] tasks 현재 상태
  console.log("\n" + "─".repeat(110));
  console.log("[A] 2건 tasks 현재 상태");
  console.log("─".repeat(110));
  console.log("task_no            | 고객 | status | scheduled_at        | started | completed | product_price | 취소?");
  for (const t of tasks) {
    const cancelMark = t.status === "취소" ? "★ 취소!" : "—";
    console.log(`${t.task_no.padEnd(18)} | ${(t.customer_name || "?").padEnd(4)} | ${t.status.padEnd(6)} | ${(t.scheduled_at || "NULL").slice(0, 19).padEnd(19)} | ${(t.started_at || "NULL").slice(0, 10)} | ${(t.completed_at || "NULL").slice(0, 10)} | ₩${String(t.product_price || 0).padStart(7)} | ${cancelMark}`);
  }
  console.log("");
  console.log("→ 둘 다 status='배정' + 취소 아님 확인 필요");

  // [B] payments
  console.log("\n" + "─".repeat(110));
  console.log("[B] 2건 payments 현재값");
  console.log("─".repeat(110));
  console.log("task_no            | engineer  | principal | owner    | settled_at | calc_method");
  for (const t of tasks) {
    const { data: pays } = await sb.from("payments").select("*").eq("task_id", t.id);
    for (const p of (pays || [])) {
      const settledMark = p.settled_at ? `★ ${p.settled_at.slice(0, 10)}` : "NULL (안전)";
      console.log(`${t.task_no.padEnd(18)} | ₩${String(p.engineer_amount || 0).padStart(7)} | ₩${String(p.principal_amount || 0).padStart(7)} | ₩${String(p.owner_amount || 0).padStart(6)} | ${settledMark.padEnd(10)} | ${p.calc_method}`);
    }
    if ((pays || []).length === 0) console.log(`${t.task_no.padEnd(18)} | (payments 없음)`);
  }

  // [C] task_items + 예상 재계산
  console.log("\n" + "─".repeat(110));
  console.log("[C] 2건 task_items + status='완료' 변환 시 예상 결과");
  console.log("─".repeat(110));
  for (const t of tasks) {
    const { data: items } = await sb.from("task_items").select("*, work_types(name,code), appliance_types(name,code)").eq("task_id", t.id);
    console.log(`\n  ${t.task_no} (${t.customer_name}) task_items: ${(items || []).length}행`);
    for (const i of (items || [])) {
      console.log(`    work_type=${i.work_types?.name} | appliance=${i.appliance_types?.name || "NULL"} | order_type=${i.order_type} | qty=${i.qty} | unit_price=₩${(i.unit_price || 0).toLocaleString()} | subtotal=₩${(i.subtotal || 0).toLocaleString()}`);
    }
  }
  console.log("\n예상 compute_payment 동작 (Migration 071 v15):");
  console.log("  · status='배정'→'완료' UPDATE 시 compute_payment_trg (Mig 027) 발화");
  console.log("  · payments row 이미 존재 (배정 단계에서 자동 생성됨) → UPDATE");
  console.log("  · usol_n 본작업 산식 동일 적용 — engineer_amount 값 변동 거의 없음");
  console.log("  · settled_at NULL이라 송금 영향 없음");

  console.log("\ncompleted_at 자동 채움 트리거:");
  console.log("  · Migration 013 (assigned_at / scheduled_confirmed_at만 자동) — completed_at 트리거 없음");
  console.log("  · onStatusChange (AdminApp.jsx:2760)도 status만 보냄 — completed_at 누락");
  console.log("  · → SQL 직접 실행 시 completed_at 명시 입력 필요");

  // [D] SQL 초안
  console.log("\n" + "─".repeat(110));
  console.log("[D] 실행 SQL 초안 (Supabase SQL Editor용 / UPDATE 미실행)");
  console.log("─".repeat(110));
  console.log("");
  console.log("-- ============================================");
  console.log("-- 김웅 2건 수동 완료 처리");
  console.log("-- 작성일 : 2026-05-27");
  console.log("-- 배경   : 정훈 기사 현장 완료 / 시스템엔 status='배정' 남음");
  console.log("--          CSV상 5/22 작업 완료 (오후) — completed_at도 함께 채움");
  console.log("-- 안전   :");
  console.log("--   · status='배정'→'완료' 정상 방향 (역행 X)");
  console.log("--   · payments.settled_at = NULL (송금 전) → 재계산 안전");
  console.log("--   · compute_payment_trg가 status 변경 감지 → payments 자동 재계산");
  console.log("-- ============================================");
  console.log("");
  console.log("-- [0] 사전 검증 — 현재값 확인");
  console.log("SELECT t.task_no, t.customer_name, t.status, t.scheduled_at, t.started_at, t.completed_at, t.product_price,");
  console.log("       p.engineer_amount, p.principal_amount, p.owner_amount, p.settled_at, p.calc_method");
  console.log("FROM tasks t");
  console.log("LEFT JOIN payments p ON p.task_id = t.id");
  console.log("WHERE t.task_no IN ('YS-260517-041', 'YS-260517-040');");
  console.log("-- 기대: 둘 다 status='배정', settled_at=NULL");
  console.log("");
  console.log("-- [1] 수동 완료 UPDATE");
  console.log("BEGIN;");
  console.log("");
  console.log("UPDATE tasks SET");
  console.log("  status         = '완료',");
  console.log("  scheduled_at   = COALESCE(scheduled_at, '2026-05-22 14:30:00+09'::timestamptz),  -- NULL이면 5/22 14:30 KST 채움");
  console.log("  completed_at   = '2026-05-22 14:30:00+09'::timestamptz,  -- CSV상 5/22 작업 완료");
  console.log("  updated_at     = now()");
  console.log("WHERE task_no IN ('YS-260517-041', 'YS-260517-040')");
  console.log("  AND status = '배정';  -- 가드: 취소 등 다른 상태면 적용 X");
  console.log("");
  console.log("COMMIT;");
  console.log("");
  console.log("-- [2] 사후 검증 — status / completed_at / payments 재계산 확인");
  console.log("SELECT t.task_no, t.customer_name, t.status, t.scheduled_at, t.completed_at, t.product_price,");
  console.log("       p.engineer_amount, p.principal_amount, p.owner_amount, p.settled_at, p.calc_method,");
  console.log("       p.updated_at AS payment_updated");
  console.log("FROM tasks t");
  console.log("LEFT JOIN payments p ON p.task_id = t.id");
  console.log("WHERE t.task_no IN ('YS-260517-041', 'YS-260517-040');");
  console.log("-- 기대:");
  console.log("--   · status='완료' (둘 다)");
  console.log("--   · completed_at = 2026-05-22 14:30 KST");
  console.log("--   · scheduled_at = 2026-05-22 14:30 KST (NULL이었던 경우)");
  console.log("--   · settled_at = NULL (송금 전 그대로)");
  console.log("--   · payment_updated = UPDATE 직후 시각 (trigger 발화 증거)");
  console.log("--   · engineer_amount = 기존값 ± 미세 (calc_method 동일)");
  console.log("");
  console.log("-- [3] status_history 확인 — '배정→완료' 기록되는지");
  console.log("SELECT t.task_no, h.from_status, h.to_status, h.changed_at, h.changed_by");
  console.log("FROM status_history h");
  console.log("JOIN tasks t ON t.id = h.task_id");
  console.log("WHERE t.task_no IN ('YS-260517-041', 'YS-260517-040')");
  console.log("ORDER BY t.task_no, h.changed_at;");
  console.log("-- 기대: 각 task에 '배정→완료' 행 추가 (트리거 003 tasks_status_change 자동)");

  // 옵션 — 운영자 화면으로 처리할 경우
  console.log("\n" + "─".repeat(110));
  console.log("[대안] 운영자 작업 상세 화면으로 처리");
  console.log("─".repeat(110));
  console.log("  · 운영자 화면 → 작업 상세 진입 → 상태 알약 클릭 → '완료' 선택");
  console.log("  · 단점: onStatusChange가 completed_at을 채우지 X (status만 변경)");
  console.log("  · → 화면 처리 후 별도 SQL로 completed_at 보정 필요");
  console.log("  · SQL Editor 직접 실행이 더 깔끔");
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });

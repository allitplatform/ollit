// 5/22 일괄취소 10건 — '취소'→'완료' 정정 드라이런 (SELECT만, UPDATE 절대 금지)
// 예측: compute_payment 가 status='완료' 로 변경 시 자동 fire → engineer/owner 재계산
const fs = require("fs"), path = require("path");
function L(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TARGETS = [
  { tn: "YS-260518-075", cust: "김주연" },
  { tn: "YS-260517-058", cust: "한은혜" },
  { tn: "YS-260517-027", cust: "강인성" },
  { tn: "YS-260516-115", cust: "김진산" },
  { tn: "YS-260516-021", cust: "조용현" },
  { tn: "YS-260515-069", cust: "임유진" },
  { tn: "YS-260515-009", cust: "김난영" },
  { tn: "YS-260513-005", cust: "차진영" },
  { tn: "YS-260507-023", cust: "이보배" },
  { tn: "YS-260514-056", cust: "김민정" },
];

function pad(s, n) { s = String(s ?? ""); return s.length >= n ? s : s + " ".repeat(n - s.length); }

(async () => {
  const taskNos = TARGETS.map(t => t.tn);
  const { data: tasks } = await sb.from("tasks")
    .select("id, task_no, customer_name, status, scheduled_at, completed_at, started_at, product_price, extra_fee, travel_fee, principal_id, assigned_engineer_id, cancel_engineer_comp_kind, cancel_engineer_comp_amount, category_data")
    .in("task_no", taskNos);

  // principal lookup
  const pIds = [...new Set((tasks || []).map(t => t.principal_id).filter(Boolean))];
  const { data: principals } = await sb.from("principals").select("id, code").in("id", pIds);
  const pMap = new Map((principals || []).map(p => [p.id, p.code]));

  // engineer lookup (refrigerant_rate)
  const eIds = [...new Set((tasks || []).map(t => t.assigned_engineer_id).filter(Boolean))];
  const { data: users } = await sb.from("users").select("id, code, name, refrigerant_rate").in("id", eIds);
  const uMap = new Map((users || []).map(u => [u.id, u]));

  console.log("\n" + "=".repeat(180));
  console.log("[표 A] 10건 현재 상태 + 정정용 메타 데이터");
  console.log("=".repeat(180));
  console.log(
    pad("task_no", 18) + "| " + pad("고객", 8) + "| " + pad("원청", 8) + "| " +
    pad("기사", 12) + "| " + pad("status", 8) + "| " + pad("scheduled_at", 18) + "| " +
    pad("completed_at", 18) + "| " + pad("price", 10) + "| " + pad("extra", 8) + "| " +
    pad("travel", 8) + "| " + pad("cancel_kind", 12) + "| " + pad("cancel_amt", 10)
  );
  console.log("─".repeat(180));
  for (const tgt of TARGETS) {
    const t = (tasks || []).find(x => x.task_no === tgt.tn);
    if (!t) { console.log(pad(tgt.tn, 18) + "NOT FOUND"); continue; }
    const eng = uMap.get(t.assigned_engineer_id);
    console.log(
      pad(t.task_no, 18) + "| " + pad(t.customer_name || tgt.cust, 8) + "| " +
      pad(pMap.get(t.principal_id) || "?", 8) + "| " +
      pad((eng?.name || "?") + (eng?.refrigerant_rate ? `(${eng.refrigerant_rate}%)` : ""), 12) + "| " +
      pad(t.status || "?", 8) + "| " +
      pad(t.scheduled_at?.slice(0, 16) || "—", 18) + "| " +
      pad(t.completed_at?.slice(0, 16) || "NULL", 18) + "| " +
      pad("₩" + Number(t.product_price || 0).toLocaleString(), 10) + "| " +
      pad("₩" + Number(t.extra_fee || 0).toLocaleString(), 8) + "| " +
      pad("₩" + Number(t.travel_fee || 0).toLocaleString(), 8) + "| " +
      pad(t.cancel_engineer_comp_kind || "NULL", 12) + "| " +
      pad("₩" + Number(t.cancel_engineer_comp_amount || 0).toLocaleString(), 10)
    );
  }

  console.log("\n" + "=".repeat(180));
  console.log("[표 B] task_items.is_canceled — '완료' UPDATE 전 반드시 false 로 되돌려야 compute_payment 가 정상 동작");
  console.log("=".repeat(180));
  console.log(pad("task_no", 18) + "| " + pad("고객", 8) + "| " + pad("items", 6) + "| " + pad("is_canceled=true 개수", 22) + "| " + pad("item별 상태", 80));
  console.log("─".repeat(180));
  const itemFlagSummary = []; // 정산 SQL 결정용
  for (const tgt of TARGETS) {
    const t = (tasks || []).find(x => x.task_no === tgt.tn);
    if (!t) continue;
    const { data: items } = await sb.from("task_items")
      .select("id, qty, unit_price, subtotal, is_canceled, canceled_reason, order_type, work_type_id, appliance_type_id")
      .eq("task_id", t.id);
    const total = (items || []).length;
    const cancCount = (items || []).filter(i => i.is_canceled).length;
    const summary = (items || []).map(i => `${i.qty}× ₩${Number(i.unit_price||0).toLocaleString()}${i.is_canceled?"(취소)":""}`).join(", ");
    console.log(
      pad(t.task_no, 18) + "| " + pad(t.customer_name || tgt.cust, 8) + "| " +
      pad(String(total), 6) + "| " + pad(String(cancCount), 22) + "| " + pad(summary.slice(0, 78), 80)
    );
    itemFlagSummary.push({ task_no: t.task_no, task_id: t.id, total, cancCount, items });
  }

  console.log("\n" + "=".repeat(180));
  console.log("[표 C] 현재 payments + 정정 후 예측");
  console.log("=".repeat(180));
  console.log(
    pad("task_no", 18) + "| " + pad("고객", 8) + "| " +
    pad("현재 calc_method", 16) + "| " + pad("현재 engineer", 14) + "| " + pad("현재 owner", 14) + "| " + pad("settled_at", 12) + "| " +
    pad("예측 engineer (status=완료 후)", 36)
  );
  console.log("─".repeat(180));
  const predictions = [];
  for (const tgt of TARGETS) {
    const t = (tasks || []).find(x => x.task_no === tgt.tn);
    if (!t) continue;
    const { data: pays } = await sb.from("payments")
      .select("engineer_amount, owner_amount, calc_method, policy_key, settled_at, track")
      .eq("task_id", t.id);
    const pay = (pays || [])[0];
    const itemInfo = itemFlagSummary.find(x => x.task_no === t.task_no);

    // 예측: 만약 is_canceled=true 인 item이 있으면 우선 그것부터 false 로 돌려야 함.
    // 그 다음 status='완료' UPDATE → trigger 자동 compute_payment → 일반 calc_method 적용.
    // 현재 cancel_engineer_comp_kind 가 NULL 이면, 현 engineer_amount 는 OLD route(취소 직전 값 보존)
    //   → '완료' 재계산 결과는 OLD-route engineer_amount 와 비슷할 가능성 매우 큼
    // 현재 cancel_engineer_comp_kind = 'none' 이면, 현 engineer_amount=0 → '완료' 재계산은 정상 금액
    let predict = "—";
    if (itemInfo?.cancCount === itemInfo?.total && itemInfo?.total > 0) {
      // 전 품목 취소 상태 → 먼저 is_canceled=false 복원 필요
      if (t.cancel_engineer_comp_kind === "none") {
        predict = "정상 계산 (단, items.is_canceled 먼저 false 로 복원 필요)";
      } else {
        predict = "items 복원 + status='완료' → 정상 calc (현 값과 유사 예상)";
      }
    } else if (itemInfo?.cancCount > 0) {
      predict = `⚠️ 일부 item 취소 (${itemInfo.cancCount}/${itemInfo.total}) — 검토 필요`;
    } else {
      predict = "정상 계산 — 현 값과 동일 예상 (items 무손상)";
    }

    console.log(
      pad(t.task_no, 18) + "| " + pad(t.customer_name || tgt.cust, 8) + "| " +
      pad(pay?.calc_method || "—", 16) + "| " + pad("₩" + Number(pay?.engineer_amount || 0).toLocaleString(), 14) + "| " +
      pad("₩" + Number(pay?.owner_amount || 0).toLocaleString(), 14) + "| " +
      pad(pay?.settled_at ? "★송금완료" : "NULL", 12) + "| " + pad(predict.slice(0, 36), 36)
    );
    predictions.push({ task_no: t.task_no, pay, cancel_kind: t.cancel_engineer_comp_kind, itemInfo });
  }

  console.log("\n" + "=".repeat(180));
  console.log("[표 D] status_history — 정정 후 새로 찍힐 이력 예측");
  console.log("=".repeat(180));
  console.log(pad("task_no", 18) + "| " + pad("고객", 8) + "| " + pad("현재 마지막", 32) + "| " + pad("정정 후 새 row 예측", 40));
  console.log("─".repeat(180));
  for (const tgt of TARGETS) {
    const t = (tasks || []).find(x => x.task_no === tgt.tn);
    if (!t) continue;
    const { data: hist } = await sb.from("status_history")
      .select("from_status, to_status, changed_at").eq("task_id", t.id).order("changed_at");
    const last = (hist || [])[hist.length - 1];
    const cur = last ? `${last.from_status ?? "NULL"}→${last.to_status} @ ${last.changed_at?.slice(0,16)}` : "(이력 0건)";
    const expected = `${t.status}→완료 @ <UPDATE 시각>`;
    console.log(pad(t.task_no, 18) + "| " + pad(t.customer_name || tgt.cust, 8) + "| " + pad(cur, 32) + "| " + pad(expected, 40));
  }

  console.log("\n" + "=".repeat(180));
  console.log("[표 E] 정책 — completed_at 채우기 기준 (8건 NULL)");
  console.log("=".repeat(180));
  for (const tgt of TARGETS) {
    const t = (tasks || []).find(x => x.task_no === tgt.tn);
    if (!t) continue;
    const externalDoneFromCD = t.category_data?.usolN?.workCompletedAt
                            || t.category_data?.usolN?.completedAt
                            || t.category_data?.workCompletedAt
                            || t.category_data?.completedAt
                            || null;
    const note = t.completed_at
      ? `유지 (현재값=${t.completed_at?.slice(0,10)})`
      : `채워야 — scheduled_at=${t.scheduled_at?.slice(0,10)} / usol_n_csv_completedAt=${externalDoneFromCD ? externalDoneFromCD.slice(0,10) : "없음"}`;
    console.log(pad(t.task_no, 18) + "| " + pad(t.customer_name || tgt.cust, 8) + "| " + note);
  }
})().catch(e => { console.error("FATAL", e.message, e.stack); process.exit(1); });

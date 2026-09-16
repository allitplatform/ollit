// usol_n 주문 통합 — 1단계: 전량 백업 + 한유경 1건만 적용
// 2026-05-25
//
// 사장님 승인: payments CASCADE OK / keeper 룰 OK / 가격 unit_price>0 우선 OK.
//
// 흐름:
//   [백업] 335 분리 주문 → 772 task + 그 task_items + 그 payments 전량
//          backups/usoln-merge-before-{ts}.json
//   [한유경] ext=2026051147012351 — keeper YS-260511-019 통합
//          중복 items DELETE → 015 items task_id 019로 UPDATE → 015~018 tasks DELETE
//          → compute_payment RPC 재실행
//   [출력] keeper 019의 최종 items + payment + 정합성
//   [멈춤] 여기서 종료. 나머지 334 주문은 별도 라운드.
//
// 모드:
//   node scripts/usoln-merge-step1-han.cjs            # dry-run (DB 쓰기 0)
//   node scripts/usoln-merge-step1-han.cjs --commit   # 백업 + 한유경 실제 적용

const fs = require("fs"), path = require("path");
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
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

const COMMIT = process.argv.includes("--commit");
const HAN_ORDER = "2026051147012351";
const PAGE = 1000;

async function fetchAllPaged(builder) {
  let all = [];
  for (let off = 0; ; off += PAGE) {
    const { data, error } = await builder().range(off, off + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
  }
  return all;
}

(async () => {
  console.log("=".repeat(82));
  console.log(`usol_n 통합 1단계 — ${COMMIT ? "✅ COMMIT (백업 + 한유경 적용)" : "🔍 DRY-RUN"}`);
  console.log("=".repeat(82));

  // ───────── usol_n principal_id ─────────
  const { data: p } = await sb.from("principals").select("id, code").eq("code", "usol_n").maybeSingle();
  if (!p) { console.error("usol_n principal X"); process.exit(1); }
  const PID = p.id;

  // ───────── 분리 주문 식별 (전량 백업 대상) ─────────
  const allTasks = await fetchAllPaged(() => sb
    .from("tasks")
    .select("id, task_no, customer_name, external_order_no, status, received_at, created_at, completed_at, assigned_engineer_id, product_price, extra_fee, travel_fee, total_amount, category_data")
    .eq("principal_id", PID)
    .order("created_at", { ascending: true })
  );

  const byOrderNo = new Map();
  for (const t of allTasks) {
    if (!t.external_order_no) continue;
    if (!byOrderNo.has(t.external_order_no)) byOrderNo.set(t.external_order_no, []);
    byOrderNo.get(t.external_order_no).push(t);
  }
  const splitOrders = [];
  for (const [k, v] of byOrderNo.entries()) if (v.length >= 2) splitOrders.push({ orderNo: k, tasks: v });
  console.log(`\n분리 주문: ${splitOrders.length}개 / 영향 task: ${splitOrders.reduce((s,o)=>s+o.tasks.length,0)}건`);

  // ───────── 백업 대상 task_id 집합 ─────────
  const affectedIds = splitOrders.flatMap(s => s.tasks.map(t => t.id));
  console.log(`백업 대상 task: ${affectedIds.length}건`);

  // ───────── task_items + payments 전량 fetch ─────────
  let allItems = [];
  for (let i = 0; i < affectedIds.length; i += 200) {
    const chunk = affectedIds.slice(i, i + 200);
    const { data, error } = await sb
      .from("task_items")
      .select("*")
      .in("task_id", chunk);
    if (error) throw error;
    allItems = allItems.concat(data || []);
  }
  let allPayments = [];
  for (let i = 0; i < affectedIds.length; i += 200) {
    const chunk = affectedIds.slice(i, i + 200);
    const { data, error } = await sb
      .from("payments")
      .select("*")
      .in("task_id", chunk);
    if (error) throw error;
    allPayments = allPayments.concat(data || []);
  }
  console.log(`백업 대상 task_items: ${allItems.length} / payments: ${allPayments.length}`);

  // ───────── 백업 JSON (commit 모드만) ─────────
  if (COMMIT) {
    const backupsDir = path.join(__dirname, "..", "backups");
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const file = path.join(backupsDir, `usoln-merge-before-${ts}.json`);
    fs.writeFileSync(file, JSON.stringify({
      type: "usoln-merge-before",
      ts: new Date().toISOString(),
      note: "335 분리 주문 영향 데이터 전량 스냅샷. 한유경 1건 적용 직전. ★ git commit 금지 (backups/ .gitignore 처리 필요) ★",
      principal_id: PID,
      splitOrderCount: splitOrders.length,
      affectedTaskCount: affectedIds.length,
      tasks: allTasks.filter(t => affectedIds.includes(t.id)),
      task_items: allItems,
      payments: allPayments,
    }, null, 2), "utf8");
    console.log(`📦 백업 저장: ${file}`);
  } else {
    console.log(`📦 [dry-run] 백업 파일 생성 skip — commit 모드에서만 생성`);
  }

  // ───────── 한유경 통합 계획 ─────────
  console.log(`\n${"─".repeat(82)}\n[한유경 ext=${HAN_ORDER}] 통합 계획`);
  const han = splitOrders.find(s => s.orderNo === HAN_ORDER);
  if (!han) { console.error("한유경 분리 주문을 못 찾았습니다."); process.exit(1); }
  const hanItems = allItems.filter(it => han.tasks.some(t => t.id === it.task_id));
  // keeper 결정
  const hanMainTasks = han.tasks.filter(t => hanItems.some(it => it.task_id === t.id && it.order_type === '본작업'));
  if (hanMainTasks.length === 0) { console.error("한유경에 본작업 task가 없습니다."); process.exit(1); }
  const keeper = hanMainTasks.sort((a,b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
  const absorbTasks = han.tasks.filter(t => t.id !== keeper.id);
  console.log(`  keeper: ${keeper.task_no} (id=${keeper.id})`);
  console.log(`  absorb: ${absorbTasks.map(t => t.task_no).join(", ")}`);

  // dedup
  const byPoid = new Map();
  const noPoid = [];
  for (const it of hanItems) {
    const k = it.product_order_id || "";
    if (!k) { noPoid.push(it); continue; }
    if (!byPoid.has(k)) byPoid.set(k, []);
    byPoid.get(k).push(it);
  }
  const tCreatedAt = new Map(han.tasks.map(t => [t.id, t.created_at]));
  function rk(it) {
    return [
      Number(it.unit_price) > 0 ? 0 : 1,
      Number(it.subtotal)   > 0 ? 0 : 1,
      tCreatedAt.get(it.task_id) || '',
      String(it.id),
    ];
  }
  const keepItems = [];
  const dropItems = [];
  for (const it of noPoid) keepItems.push(it);
  for (const [k, group] of byPoid.entries()) {
    const sorted = group.slice().sort((a,b) => {
      const ra = rk(a), rb = rk(b);
      for (let i = 0; i < ra.length; i++) { if (ra[i] < rb[i]) return -1; if (ra[i] > rb[i]) return 1; }
      return 0;
    });
    keepItems.push(sorted[0]);
    sorted.slice(1).forEach(d => dropItems.push(d));
  }
  const moveItems = keepItems.filter(it => it.task_id !== keeper.id);
  const keepOnKeeperItems = keepItems.filter(it => it.task_id === keeper.id);
  console.log(`  items: ${hanItems.length} → keep ${keepItems.length} (이동 ${moveItems.length}, 그대로 ${keepOnKeeperItems.length}) / 삭제 ${dropItems.length}`);
  console.log(`  삭제 items: ${dropItems.map(d => `${d.id.slice(0,8)}(poid=${d.product_order_id})`).join(", ")}`);
  console.log(`  이동 items: ${moveItems.map(m => `${m.id.slice(0,8)}(poid=${m.product_order_id})`).join(", ")}`);

  // ───────── DRY-RUN 종료 ─────────
  if (!COMMIT) {
    console.log(`\n🔍 DRY-RUN 완료 — DB 쓰기 0건.`);
    console.log("적용 명령: node scripts/usoln-merge-step1-han.cjs --commit");
    return;
  }

  // ───────── 적용 ─────────
  console.log(`\n${"─".repeat(82)}\n[적용 시작]`);

  // 1) 중복 items DELETE
  if (dropItems.length > 0) {
    const ids = dropItems.map(d => d.id);
    const { error } = await sb.from("task_items").delete().in("id", ids);
    if (error) { console.error("중복 items DELETE 실패:", error.message); process.exit(1); }
    console.log(`  ✅ DELETE task_items ${ids.length}건 (중복)`);
  }

  // 2) 이동 items UPDATE — task_id를 keeper로
  if (moveItems.length > 0) {
    const ids = moveItems.map(m => m.id);
    const { error } = await sb.from("task_items").update({ task_id: keeper.id }).in("id", ids);
    if (error) { console.error("items 이동 UPDATE 실패:", error.message); process.exit(1); }
    console.log(`  ✅ UPDATE task_items.task_id → ${keeper.task_no} (${ids.length}건)`);
  }

  // 3) absorb tasks DELETE (payments CASCADE)
  const absorbIds = absorbTasks.map(t => t.id);
  if (absorbIds.length > 0) {
    const { error } = await sb.from("tasks").delete().in("id", absorbIds);
    if (error) { console.error("absorb tasks DELETE 실패:", error.message); process.exit(1); }
    console.log(`  ✅ DELETE tasks ${absorbIds.length}건 (${absorbTasks.map(t=>t.task_no).join(", ")}) + payments CASCADE`);
  }

  // 4) compute_payment RPC — keeper 재계산
  const { error: rpcErr } = await sb.rpc('compute_payment', { p_task_id: keeper.id });
  if (rpcErr) { console.error("compute_payment 실패:", rpcErr.message); process.exit(1); }
  console.log(`  ✅ RPC compute_payment(${keeper.task_no}) 재계산 완료`);

  // ───────── 검증 출력 ─────────
  console.log(`\n${"─".repeat(82)}\n[검증 — keeper 최종 상태]`);
  const { data: finalTask } = await sb
    .from("tasks")
    .select("id, task_no, customer_name, external_order_no, status, product_price, extra_fee, travel_fee, total_amount")
    .eq("id", keeper.id)
    .single();
  const { data: finalItems } = await sb
    .from("task_items")
    .select("id, order_type, product_order_id, qty, unit_price, subtotal, work_types(name), appliance_types(name)")
    .eq("task_id", keeper.id)
    .order("order_type", { ascending: true });
  const { data: finalPayment } = await sb
    .from("payments")
    .select("id, status, track, calc_method, product_price, extra_fee, travel_fee, naver_fee, engineer_amount, principal_amount, owner_amount, is_balanced, computed_at")
    .eq("task_id", keeper.id);

  console.log(`task   : ${finalTask.task_no} (${finalTask.status}) ext=${finalTask.external_order_no}`);
  console.log(`         product_price=${finalTask.product_price} extra=${finalTask.extra_fee} travel=${finalTask.travel_fee} total=${finalTask.total_amount}`);
  console.log(`items  : ${finalItems.length}건`);
  finalItems.forEach(it => {
    console.log(`  · ${it.order_type || '(X)'} | ${it.appliance_types?.name || '—'} | ${it.work_types?.name || '—'} | poid=${it.product_order_id || '—'} | qty=${it.qty} unit=${it.unit_price} sub=${it.subtotal}`);
  });
  console.log(`payment: ${(finalPayment || []).length}건`);
  (finalPayment || []).forEach(pm => {
    console.log(`  · track=${pm.track} status=${pm.status} method=${pm.calc_method}`);
    console.log(`    engineer=${pm.engineer_amount} principal=${pm.principal_amount} owner=${pm.owner_amount} | balanced=${pm.is_balanced} | computed=${pm.computed_at}`);
  });

  // 잔존 ext 확인 — 한유경 ext로 task가 keeper 1건만 남았는지
  const { data: leftover } = await sb
    .from("tasks")
    .select("id, task_no, status")
    .eq("external_order_no", HAN_ORDER)
    .eq("principal_id", PID);
  console.log(`\next=${HAN_ORDER} 남은 task: ${leftover.length}건 (예상 1) — ${leftover.map(t=>t.task_no).join(", ")}`);

  console.log(`\n${"=".repeat(82)}`);
  console.log("✅ 한유경 1건 통합 완료. 나머지 334 주문은 별도 라운드 (사장님 OK 후).");
  console.log("=".repeat(82));
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

// 진단 (읽기 전용) — 유솔N "주문별 그룹" 표시 안 되는 30건 원인 catch
// 2026-05-25
//
// 가설:
//   bulkInsertUsolNOrders 흐름 측 1 order (= 같은 orderId) = 1 task.
//   본작업 + 추가선택 task_items 측 같은 task_id 측 들어가야 정상.
//   30건 측 추가선택-only task가 따로 INSERT 됨 → 같은 external_order_no 측
//   본작업 task 측 별도로 존재. UI 측 "+N" 측 task.workItems.length 측 사용 →
//   별도 task 측 따로 표시.
//
// 검증:
//   1) 한유경 YS-260511-015~019 — task 단위 / external_order_no 비교
//   2) usol_n 전체 측 external_order_no 중복 task 측 — 총 몇 건이 분리됐는지
//   3) 분리된 task 측 task_items.order_type 분포 (본작업만 / 추가선택만 / 혼합)
//
// 출력: 콘솔 + scripts/diag-usoln-group-30-결과.json

const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  const out = { generatedAt: new Date().toISOString() };

  // 1) usol_n principal_id
  const { data: p } = await sb.from("principals").select("id, code").eq("code", "usol_n").maybeSingle();
  if (!p) { console.error("usol_n principal X"); process.exit(1); }
  const PID = p.id;
  out.principalId = PID;

  // 2) usol_n 측 모든 task (1000건 cap 우회 — range 페이지 루프)
  const PAGE = 1000;
  let all = [];
  for (let off = 0; ; off += PAGE) {
    const { data, error } = await sb
      .from("tasks")
      .select("id, task_no, customer_name, external_order_no, status, received_at, created_at")
      .eq("principal_id", PID)
      .order("created_at", { ascending: true })
      .range(off, off + PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
  }
  out.totalTasks = all.length;

  // 3) external_order_no 별 task 그룹
  const byOrderNo = new Map();
  for (const t of all) {
    const k = t.external_order_no || "(없음)";
    if (!byOrderNo.has(k)) byOrderNo.set(k, []);
    byOrderNo.get(k).push(t);
  }

  // 4) 중복 (= 같은 external_order_no가 2개 이상 task로 나뉜 경우)
  const splitOrders = [];
  for (const [orderNo, tasks] of byOrderNo.entries()) {
    if (orderNo === "(없음)") continue;
    if (tasks.length >= 2) splitOrders.push({ orderNo, count: tasks.length, tasks });
  }
  out.splitOrderCount = splitOrders.length;
  out.splitTaskCount  = splitOrders.reduce((s, o) => s + o.count, 0);

  // 5) 분리된 task 측 task_items 측 (order_type 분포 catch)
  const splitTaskIds = splitOrders.flatMap(s => s.tasks.map(t => t.id));
  let items = [];
  if (splitTaskIds.length > 0) {
    // chunk 200씩 IN 쿼리
    for (let i = 0; i < splitTaskIds.length; i += 200) {
      const chunk = splitTaskIds.slice(i, i + 200);
      const { data, error } = await sb
        .from("task_items")
        .select("task_id, order_type, product_order_id, work_types(name), appliance_types(name)")
        .in("task_id", chunk);
      if (error) { console.error(error); process.exit(1); }
      items = items.concat(data || []);
    }
  }
  const itemsByTask = new Map();
  for (const it of items) {
    if (!itemsByTask.has(it.task_id)) itemsByTask.set(it.task_id, []);
    itemsByTask.get(it.task_id).push(it);
  }

  // 6) order_type 분포 분류
  let mainOnlyTasks = 0;
  let addonOnlyTasks = 0;
  let mixedTasks = 0;
  let noItemTasks = 0;
  const samplePairs = [];
  for (const s of splitOrders) {
    let mainOnlyCount = 0, addonOnlyCount = 0, mixedCount = 0, noItemCount = 0;
    const taskDetails = [];
    for (const t of s.tasks) {
      const its = itemsByTask.get(t.id) || [];
      const hasMain  = its.some(x => x.order_type === '본작업');
      const hasAddon = its.some(x => x.order_type === '추가선택');
      let label = "";
      if (its.length === 0) { noItemTasks++; noItemCount++; label = "item-X"; }
      else if (hasMain && !hasAddon) { mainOnlyTasks++; mainOnlyCount++; label = "본작업-only"; }
      else if (!hasMain && hasAddon) { addonOnlyTasks++; addonOnlyCount++; label = "추가선택-only"; }
      else { mixedTasks++; mixedCount++; label = "혼합"; }
      taskDetails.push({
        task_no: t.task_no,
        customer: t.customer_name,
        status: t.status,
        label,
        items: its.map(x => ({
          order_type: x.order_type,
          work_type:  x.work_types?.name,
          appliance:  x.appliance_types?.name,
          product_order_id: x.product_order_id,
        })),
      });
    }
    if (samplePairs.length < 15) {
      samplePairs.push({
        external_order_no: s.orderNo,
        taskCount: s.count,
        mainOnly: mainOnlyCount, addonOnly: addonOnlyCount, mixed: mixedCount, noItem: noItemCount,
        tasks: taskDetails,
      });
    }
  }
  out.distribution = {
    splitOrders: splitOrders.length,
    affectedTasks: splitOrders.reduce((s, o) => s + o.count, 0),
    breakdown: {
      mainOnlyTasks, addonOnlyTasks, mixedTasks, noItemTasks,
    },
  };
  out.samplePairs = samplePairs;

  // 7) 한유경 YS-260511-015~019 catch
  const hanyk = all.filter(t =>
    (t.customer_name && t.customer_name.includes("한유경")) ||
    (t.task_no && /^YS-260511-01[5-9]$/.test(t.task_no))
  );
  out.hanyk = hanyk.map(t => ({
    task_no: t.task_no,
    customer: t.customer_name,
    external_order_no: t.external_order_no,
    status: t.status,
    created_at: t.created_at,
  }));
  // 한유경 task_items 측
  if (hanyk.length > 0) {
    const ids = hanyk.map(t => t.id);
    const { data: hits } = await sb
      .from("task_items")
      .select("task_id, order_type, product_order_id, work_types(name), appliance_types(name)")
      .in("task_id", ids);
    const map = new Map();
    for (const r of hits || []) {
      if (!map.has(r.task_id)) map.set(r.task_id, []);
      map.get(r.task_id).push(r);
    }
    out.hanyk.forEach(t => {
      const tid = hanyk.find(x => x.task_no === t.task_no)?.id;
      t.items = (map.get(tid) || []).map(x => ({
        order_type: x.order_type,
        work_type: x.work_types?.name,
        appliance: x.appliance_types?.name,
        product_order_id: x.product_order_id,
      }));
    });
  }

  // 출력
  const file = path.join(__dirname, "diag-usoln-group-30-결과.json");
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("=== usol_n 그룹 30건 진단 ===");
  console.log("총 task 수:", out.totalTasks);
  console.log("같은 external_order_no가 2+ task로 분리된 주문 수:", out.distribution.splitOrders);
  console.log("그에 영향받은 task 수:", out.distribution.affectedTasks);
  console.log("분포 — 본작업-only:", mainOnlyTasks, "/ 추가선택-only:", addonOnlyTasks, "/ 혼합:", mixedTasks, "/ item-X:", noItemTasks);
  console.log("한유경 task 수:", out.hanyk.length);
  if (out.hanyk.length > 0) {
    console.log("한유경 상세 — 결과 JSON 측");
    out.hanyk.forEach(t => {
      console.log(`  · ${t.task_no} (${t.status}) ext=${t.external_order_no} items=${(t.items||[]).length}`);
      (t.items || []).forEach(it => {
        console.log(`     - ${it.order_type || "(X)"} | ${it.appliance || "—"} | ${it.work_type || "—"} | poid=${it.product_order_id || "—"}`);
      });
    });
  }
  console.log("샘플 분리 주문 15건 — 결과 JSON 측");
  samplePairs.slice(0, 5).forEach(p => {
    console.log(`  · ext=${p.external_order_no} — ${p.taskCount}개 task (본:${p.mainOnly}/추:${p.addonOnly}/혼:${p.mixed}/X:${p.noItem})`);
    p.tasks.forEach(t => console.log(`     · ${t.task_no} [${t.label}] cust=${t.customer}`));
  });
  console.log("\n결과 파일:", file);
})();

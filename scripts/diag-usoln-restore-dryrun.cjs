// 드라이런 (DB 쓰기 0) — usol_n task_items 복구 plan
// 2026-05-25
//
// 입력:
//   backups/usoln-merge-before-2026-05-24T21-34-12.json (tasks 772 / task_items 1194 / payments 772)
//
// 룰 (사장님 승인 — 원래 통합과 동일):
//   keeper = 라이브에 ext당 살아있는 1 task (이미 통합돼있음)
//   복원: 백업의 같은 ext task들의 모든 task_items 모음 → 새 task_id = 라이브 keeper.id
//   dedup: (unit_price>0 desc, subtotal>0 desc, task.created_at asc, item.id asc) 우선순위 1개만
//   살아있는 task_items 가진 keeper (11건)은 SKIP (이미 정상)
//
// 산출:
//   keeper별 복원 item 수, 전체 합계, dedup으로 빠지는 중복 수, 이상 케이스, 샘플 상세

const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 백업 읽기
  const bak = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "backups", "usoln-merge-before-2026-05-24T21-34-12.json"), "utf8"));
  const bakTasks = bak.tasks || [];
  const bakItems = bak.task_items || [];
  console.log(`백업: tasks ${bakTasks.length} / items ${bakItems.length} / payments ${(bak.payments||[]).length}\n`);

  // 백업 task_id → ext 매핑
  const taskIdToExt = new Map();
  const taskIdToCreatedAt = new Map();
  const taskIdToTaskNo = new Map();
  for (const t of bakTasks) {
    taskIdToExt.set(t.id, t.external_order_no);
    taskIdToCreatedAt.set(t.id, t.created_at);
    taskIdToTaskNo.set(t.id, t.task_no);
  }
  // 백업 ext → items
  const itemsByExt = new Map();
  let itemsNoExt = 0;
  for (const it of bakItems) {
    const ext = taskIdToExt.get(it.task_id);
    if (!ext) { itemsNoExt++; continue; }
    if (!itemsByExt.has(ext)) itemsByExt.set(ext, []);
    itemsByExt.get(ext).push(it);
  }
  console.log(`백업 ext 그룹: ${itemsByExt.size} / 매핑 안 된 items: ${itemsNoExt}`);

  // 라이브 — usol_n keeper 335 (ext별 살아있는 task 1개)
  const { data: p } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  const PID = p.id;
  const dry = JSON.parse(fs.readFileSync(path.join(__dirname, "diag-usoln-merge-dryrun-결과.json"), "utf8"));
  const allExts = dry.plans.map(p => p.external_order_no);
  let keepers = [];
  for (let i = 0; i < allExts.length; i += 100) {
    const chunk = allExts.slice(i, i + 100);
    const { data } = await sb.from("tasks").select("id, task_no, customer_name, external_order_no, status").eq("principal_id", PID).in("external_order_no", chunk);
    keepers = keepers.concat(data || []);
  }
  const keeperByExt = new Map();
  for (const t of keepers) keeperByExt.set(t.external_order_no, t);

  // 라이브 — 살아있는 task_items 가진 keeper 식별 (skip 대상)
  const keeperIds = keepers.map(t => t.id);
  let liveItems = [];
  for (let i = 0; i < keeperIds.length; i += 200) {
    const chunk = keeperIds.slice(i, i + 200);
    const { data } = await sb.from("task_items").select("task_id").in("task_id", chunk);
    liveItems = liveItems.concat(data || []);
  }
  const itemsCountByTask = new Map();
  for (const it of liveItems) itemsCountByTask.set(it.task_id, (itemsCountByTask.get(it.task_id) || 0) + 1);

  // 복원 plan
  const plans = [];
  let skipAlive = 0;
  let extWithoutKeeper = 0;
  let extWithoutBackupItems = 0;
  let totalRestore = 0;
  let totalDup = 0;
  const sampleDetails = {};
  const SAMPLE_EXTS = new Set(["2026051147012351"]); // 한유경
  // 추가 샘플 — 백업 items 많은 ext 2~3개
  const itemsCountByExt = [...itemsByExt.entries()].map(([ext, items]) => ({ ext, count: items.length })).sort((a,b) => b.count - a.count);
  for (const e of itemsCountByExt.slice(0, 3)) SAMPLE_EXTS.add(e.ext);

  for (const ext of allExts) {
    const keeper = keeperByExt.get(ext);
    if (!keeper) {
      extWithoutKeeper++;
      plans.push({ ext, status: "no_keeper" });
      continue;
    }
    const liveItemCount = itemsCountByTask.get(keeper.id) || 0;
    if (liveItemCount > 0) {
      skipAlive++;
      plans.push({ ext, keeper_no: keeper.task_no, status: "skip_alive", live_items: liveItemCount });
      continue;
    }
    const bItems = itemsByExt.get(ext) || [];
    if (bItems.length === 0) {
      extWithoutBackupItems++;
      plans.push({ ext, keeper_no: keeper.task_no, status: "no_backup_items" });
      continue;
    }

    // dedup
    const byPoid = new Map();
    const noPoid = [];
    for (const it of bItems) {
      const k = it.product_order_id || "";
      if (!k) { noPoid.push(it); continue; }
      if (!byPoid.has(k)) byPoid.set(k, []);
      byPoid.get(k).push(it);
    }
    function rk(it) {
      return [
        Number(it.unit_price) > 0 ? 0 : 1,
        Number(it.subtotal)   > 0 ? 0 : 1,
        taskIdToCreatedAt.get(it.task_id) || '',
        String(it.id),
      ];
    }
    const keepItems = [];
    const dropItems = [];
    for (const it of noPoid) keepItems.push(it);
    for (const [, group] of byPoid.entries()) {
      const sorted = group.slice().sort((a,b) => {
        const ra = rk(a), rb = rk(b);
        for (let i = 0; i < ra.length; i++) { if (ra[i] < rb[i]) return -1; if (ra[i] > rb[i]) return 1; }
        return 0;
      });
      keepItems.push(sorted[0]);
      sorted.slice(1).forEach(d => dropItems.push(d));
    }
    totalRestore += keepItems.length;
    totalDup += dropItems.length;
    const planRow = {
      ext,
      keeper_no: keeper.task_no,
      keeper_id: keeper.id,
      customer: keeper.customer_name,
      backup_items: bItems.length,
      restore_count: keepItems.length,
      drop_count: dropItems.length,
      status: "restore",
    };
    plans.push(planRow);

    // 샘플 상세
    if (SAMPLE_EXTS.has(ext)) {
      sampleDetails[ext] = {
        keeper: keeper.task_no,
        customer: keeper.customer_name,
        items_to_restore: keepItems.map(it => ({
          backup_id: it.id,
          from_task_no: taskIdToTaskNo.get(it.task_id),
          order_type: it.order_type,
          product_order_id: it.product_order_id,
          qty: it.qty,
          unit_price: it.unit_price,
          subtotal: it.subtotal,
          customer_paid_amount: it.customer_paid_amount,
          work_type_id: it.work_type_id,
          appliance_type_id: it.appliance_type_id,
          description: it.description,
        })),
        items_dropped: dropItems.map(it => ({
          backup_id: it.id,
          from_task_no: taskIdToTaskNo.get(it.task_id),
          order_type: it.order_type,
          product_order_id: it.product_order_id,
          unit_price: it.unit_price,
          subtotal: it.subtotal,
          reason: "중복 product_order_id — unit_price>0 우선 룰로 다른 row가 keep됨",
        })),
      };
    }
  }

  // 요약
  console.log(`\n══════ 복원 plan 요약 ══════`);
  console.log(`총 335 keeper:`);
  console.log(`  · 복원 대상            : ${plans.filter(p => p.status === "restore").length}`);
  console.log(`  · skip (라이브 items 있음): ${skipAlive}`);
  console.log(`  · keeper 없음          : ${extWithoutKeeper}`);
  console.log(`  · 백업 items 없음      : ${extWithoutBackupItems}`);
  console.log(`복원 item 합계           : ${totalRestore}`);
  console.log(`dedup으로 빠지는 중복    : ${totalDup}`);
  console.log(`백업 items 총수          : ${bakItems.length}`);
  console.log(`(검증: 복원+dup+skip의 백업items = ${totalRestore + totalDup} + skip한 ext의 백업items)`);

  // 백업의 keeper-with-live-items 중복 제외 검증
  let bItemsInSkipExt = 0;
  for (const ext of allExts) {
    const keeper = keeperByExt.get(ext);
    if (!keeper) continue;
    if ((itemsCountByTask.get(keeper.id) || 0) === 0) continue;
    bItemsInSkipExt += (itemsByExt.get(ext) || []).length;
  }
  console.log(`  · skip ext의 백업 items : ${bItemsInSkipExt}`);
  console.log(`  → 총합 검증: ${totalRestore + totalDup + bItemsInSkipExt} (백업 1194와 비교)`);

  // 한유경 상세
  console.log(`\n══════ 샘플 상세 ══════`);
  for (const [ext, d] of Object.entries(sampleDetails)) {
    console.log(`\n[ext=${ext}] keeper ${d.keeper} (${d.customer}) — 복원 ${d.items_to_restore.length} / 중복 제거 ${d.items_dropped.length}`);
    d.items_to_restore.forEach(it => console.log(`  · 복원 ${it.order_type || '(X)'} | qty=${it.qty} unit=${it.unit_price} sub=${it.subtotal} poid=${it.product_order_id || '—'} (← 백업 ${it.from_task_no})`));
    d.items_dropped.forEach(it => console.log(`  × 제거 ${it.order_type || '(X)'} | unit=${it.unit_price} sub=${it.subtotal} poid=${it.product_order_id} (← 백업 ${it.from_task_no})`));
  }

  // 결과 저장
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outFile = path.join(__dirname, `diag-usoln-restore-dryrun-결과-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    generatedAt: new Date().toISOString(),
    backup: { tasks: bakTasks.length, items: bakItems.length },
    summary: {
      keepers: keepers.length,
      restoreCount: plans.filter(p => p.status === "restore").length,
      skipAlive,
      extWithoutKeeper,
      extWithoutBackupItems,
      totalRestore,
      totalDup,
      bItemsInSkipExt,
    },
    sampleDetails,
    plans,
  }, null, 2), "utf8");
  console.log(`\n결과 파일: ${outFile}`);
})().catch(e => { console.error("FATAL:", e.message, e.stack); process.exit(1); });

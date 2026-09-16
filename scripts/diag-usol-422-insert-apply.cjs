// 측 적용 — 유솔 측 catch 420건 INSERT. 백업 + 측 catch + 검증 측 catch 측 catch.
// 측 catch: 14건 (사무실/벽걸이 → 세척_벽걸이+벽걸이). 측 catch: 2건 (가정집/대형실외기, 추가선택/벽걸이).
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
const Papa = require("papaparse");

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CSV_PATH = path.join(__dirname, "..", "data", "usol_ops_20260524.csv");
const HOLDOUT_PATH = path.join(__dirname, "usol-422-holdout-2건.json");
const TENANT = "11111111-1111-1111-1111-111111111111";

function parseYmd(s) {
  if (!s) return null;
  s = String(s).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m) return { y: +m[1], mo: +m[2], d: +m[3], orig: s };
  m = s.match(/^(\d{1,2})\/(\d{1,2})/);
  if (m) return { y: 2026, mo: +m[1], d: +m[2], orig: s, corrected: true };
  return { parseError: true, orig: s };
}
function parseHm(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: +m[1], mi: +m[2] };
}
function toIso(y, mo, d, h = 9, mi = 0) {
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi, 0)).toISOString();
}

(async () => {
  const tStart = Date.now();
  console.log("=".repeat(120));
  console.log("측 적용 — 유솔 측 catch 420건 INSERT");
  console.log("=".repeat(120));

  // -----------------------------------------------------------
  // 1. CSV / DB 측 catch
  // -----------------------------------------------------------
  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  const csvByCode = new Map();
  for (const r of parsed.data) {
    const c = (r["작업코드"] || "").trim();
    if (c) csvByCode.set(c, r);
  }

  const { data: principals } = await sb.from("principals").select("id, code");
  const usolH = principals.find(p => p.code === "usol_h");
  const usolN = principals.find(p => p.code === "usol_n");
  const principalIds = [usolH.id, usolN.id];

  let allTasks = [];
  let offset = 0;
  while (true) {
    const { data } = await sb.from("tasks").select("id, task_no, principal_id, category_id").in("principal_id", principalIds).range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allTasks = allTasks.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  const dbByCode = new Map(allTasks.map(t => [t.task_no, t]));
  const sampleTask = allTasks.find(t => t.principal_id === usolN.id);

  const onlyCsv = [...csvByCode.keys()].filter(c => !dbByCode.has(c));
  const both = [...csvByCode.keys()].filter(c => dbByCode.has(c));
  console.log(`\nCSV ${csvByCode.size} / DB ${allTasks.length} / 매칭 ${both.length} / CSV측 catch ${onlyCsv.length}`);

  // -----------------------------------------------------------
  // 2. 측 catch 측 catch (매칭 862 측 catch)
  // -----------------------------------------------------------
  const matchedTaskIds = both.map(c => dbByCode.get(c).id);
  let matchedItems = [];
  for (let i = 0; i < matchedTaskIds.length; i += 500) {
    const slice = matchedTaskIds.slice(i, i + 500);
    const { data } = await sb.from("task_items").select("task_id, work_type_id, appliance_type_id, order_type").in("task_id", slice);
    if (data) matchedItems = matchedItems.concat(data);
  }
  const itemsByTaskId = new Map();
  for (const it of matchedItems) {
    if (!itemsByTaskId.has(it.task_id)) itemsByTaskId.set(it.task_id, []);
    itemsByTaskId.get(it.task_id).push(it);
  }
  const mapping = new Map();
  for (const code of both) {
    const csv = csvByCode.get(code);
    const dbTask = dbByCode.get(code);
    const items = itemsByTaskId.get(dbTask.id) || [];
    const svc = (csv["서비스종류"] || "").trim();
    const sk = (csv["서비스구분"] || "").trim();
    const expectedOrderType = svc === "추가선택" ? "추가선택" : "본작업";
    const matched = items.find(it => it.order_type === expectedOrderType) || items[0];
    if (!matched) continue;
    const key = `${svc}|${sk}`;
    const typeKey = `${matched.work_type_id || ""}|${matched.appliance_type_id || ""}`;
    if (!mapping.has(key)) mapping.set(key, { counts: new Map(), total: 0 });
    const e = mapping.get(key);
    e.counts.set(typeKey, (e.counts.get(typeKey) || 0) + 1);
    e.total++;
  }
  const resolveMap = new Map();
  for (const [key, entry] of mapping) {
    let best = null, bestCount = 0;
    for (const [tk, c] of entry.counts) {
      if (c > bestCount) { best = tk; bestCount = c; }
    }
    const [wt, at] = best.split("|");
    resolveMap.set(key, { workTypeId: wt || null, applianceTypeId: at || null });
  }
  // 측 catch — 사무실/벽걸이 → 가정집/벽걸이와 측 catch 측 catch
  const guestWallKey = "가정집 에어컨청소|벽걸이";
  const officeWallKey = "사무실 에어컨청소|벽걸이";
  if (resolveMap.has(guestWallKey)) {
    resolveMap.set(officeWallKey, { ...resolveMap.get(guestWallKey) });
    console.log(`측 catch 측 catch: ${officeWallKey} ← ${guestWallKey}`);
  } else {
    throw new Error("가정집/벽걸이 매핑이 없음 — 측 catch 측 catch 측 catch");
  }

  // -----------------------------------------------------------
  // 3. users 측 catch
  // -----------------------------------------------------------
  const { data: users } = await sb.from("users").select("id, name").eq("tenant_id", TENANT);
  const userIdByName = new Map((users || []).map(u => [u.name.trim(), u.id]));

  function deriveStatus(row, contactYmd, engId) {
    const csvStatus = (row["상태"] || "").trim();
    if (csvStatus === "취소") return "취소";
    if (contactYmd && !contactYmd.parseError) {
      const d = new Date(Date.UTC(contactYmd.y, contactYmd.mo - 1, contactYmd.d));
      const boundary = new Date(Date.UTC(2026, 4, 24));
      return d.getTime() <= boundary.getTime() ? "완료" : "확정";
    }
    if (engId) return "배정";
    return "미배정";
  }

  // -----------------------------------------------------------
  // 4. 측 catch / 측 catch 측 catch
  // -----------------------------------------------------------
  const plans = [];
  const holdouts = [];
  const holdoutKeys = new Set([
    "가정집 에어컨청소|대형실외기",
    "추가선택|벽걸이",
  ]);

  for (const code of onlyCsv) {
    const row = csvByCode.get(code);
    const svc = (row["서비스종류"] || "").trim();
    const sk = (row["서비스구분"] || "").trim();
    const key = `${svc}|${sk}`;

    if (holdoutKeys.has(key)) {
      holdouts.push({ code, svc, sk, row });
      continue;
    }

    const r = resolveMap.get(key);
    const needsAppliance = svc !== "추가선택";
    if (!r || !r.workTypeId || (needsAppliance && !r.applianceTypeId)) {
      console.log(`⚠️ 측 catch 측 catch 측 catch — ${code} (${key})`);
      continue;
    }

    const contactYmd = parseYmd(row["고객컨택일자"]);
    const completedYmd = parseYmd(row["작업완료일"]);
    const requestYmd = parseYmd(row["요청일자"]);
    const orderYmd = parseYmd(row["주문일시"]);
    const promiseHm = parseHm(row["기사약속시간"]);
    const assignedName = (row["배정기사"] || "").trim();
    const assignedId = assignedName ? (userIdByName.get(assignedName) || null) : null;
    const status = deriveStatus(row, contactYmd, assignedId);

    let scheduledAt = null;
    if (contactYmd && !contactYmd.parseError) {
      const promiseValid = promiseHm && (promiseHm.h !== 0 || promiseHm.mi !== 0);
      const h = promiseValid ? promiseHm.h : 9;
      const mi = promiseValid ? promiseHm.mi : 0;
      scheduledAt = toIso(contactYmd.y, contactYmd.mo, contactYmd.d, h, mi);
    }

    let completedAt = null;
    if (status === "완료" && completedYmd && !completedYmd.parseError) {
      const promiseValid = promiseHm && (promiseHm.h !== 0 || promiseHm.mi !== 0);
      const h = promiseValid ? promiseHm.h : 9;
      const mi = promiseValid ? promiseHm.mi : 0;
      let dt = new Date(Date.UTC(completedYmd.y, completedYmd.mo - 1, completedYmd.d, h - 9, mi, 0));
      if (!promiseValid) dt = new Date(dt.getTime() + 2 * 3600 * 1000);
      completedAt = dt.toISOString();
    } else if (status === "완료" && scheduledAt) {
      completedAt = new Date(new Date(scheduledAt).getTime() + 2 * 3600 * 1000).toISOString();
    }

    const receivedAt = orderYmd && !orderYmd.parseError ? toIso(orderYmd.y, orderYmd.mo, orderYmd.d, 0, 0) : null;
    const addrConfirm = (row["주소재확인"] || "").trim();
    const address = addrConfirm || (row["주소"] || "").trim();
    const qty = parseInt(row["수량"], 10) || 1;

    plans.push({
      code,
      task: {
        tenant_id: TENANT,
        task_no: code,
        principal_id: usolN.id,
        category_id: sampleTask.category_id,
        customer_name: (row["수취인명"] || "").trim(),
        phone: (row["수취인연락처1"] || "").trim(),
        address,
        district: (row["지역키워드"] || "").trim() || null,
        channel: (row["채널"] || "").trim() || null,
        external_order_no: (row["주문번호"] || "").trim() || null,
        received_at: receivedAt,
        requested_date: requestYmd && !requestYmd.parseError ? `${requestYmd.y}-${String(requestYmd.mo).padStart(2,"0")}-${String(requestYmd.d).padStart(2,"0")}` : null,
        requested_time: (row["시간구분"] || "").trim() || null,
        assigned_engineer_id: assignedId,
        request_note: ((row["배송메세지"] || "").trim() ? (row["배송메세지"] || "").trim() + (((row["추천기사"] || "").trim()) ? `\n[추천기사] ${(row["추천기사"]).trim()}` : "") : ((row["추천기사"] || "").trim() ? `[추천기사] ${(row["추천기사"]).trim()}` : null)) || null,
        happycall_status: (row["해피콜상태"] || "").trim() || null,
        happycall_memo: (row["해피콜메모"] || "").trim() || null,
        status,
        scheduled_at: scheduledAt,
        completed_at: completedAt,
        is_legacy: true,
      },
      item: {
        work_type_id: r.workTypeId,
        appliance_type_id: r.applianceTypeId,
        qty,
        order_type: svc === "추가선택" ? "추가선택" : "본작업",
        product_order_id: (row["상품주문번호"] || "").trim() || null,
      },
    });
  }

  console.log(`\n측 catch: ${plans.length}건 / 측 catch: ${holdouts.length}건`);

  // -----------------------------------------------------------
  // 5. 측 catch 2건 측 catch
  // -----------------------------------------------------------
  fs.writeFileSync(HOLDOUT_PATH, JSON.stringify({
    timestamp: new Date().toISOString(),
    reason: "매칭 선례 없음 — 수동 결정 필요",
    holdouts: holdouts.map(h => ({ code: h.code, svc: h.svc, sk: h.sk, row: h.row })),
  }, null, 2));
  console.log(`측 catch 측 catch: ${HOLDOUT_PATH}`);

  // -----------------------------------------------------------
  // 6. 백업
  // -----------------------------------------------------------
  // 사전 검증 — 측 420 측 catch DB 측 catch 측 catch 측 catch
  const planCodes = plans.map(p => p.code);
  const { data: dupCheck } = await sb.from("tasks").select("task_no").in("task_no", planCodes);
  if (dupCheck && dupCheck.length > 0) {
    console.log(`⛔ 측 catch — 측 ${dupCheck.length}개 task_no가 이미 DB 측 catch:`);
    dupCheck.slice(0, 10).forEach(d => console.log(`  · ${d.task_no}`));
    process.exit(1);
  }

  // 현재 usol_n 측 catch
  const { count: beforeTaskCount } = await sb.from("tasks").select("id", { count: "exact", head: true }).eq("principal_id", usolN.id);
  // 측 catch task_items 측 catch — task 측 catch
  const usolN_taskIds = allTasks.filter(t => t.principal_id === usolN.id).map(t => t.id);
  let beforeItemCount = 0;
  for (let i = 0; i < usolN_taskIds.length; i += 500) {
    const slice = usolN_taskIds.slice(i, i + 500);
    const { count } = await sb.from("task_items").select("id", { count: "exact", head: true }).in("task_id", slice);
    beforeItemCount += count || 0;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `usol-422-insert-before-${stamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    before: {
      usolN_taskCount: beforeTaskCount,
      usolN_itemCount: beforeItemCount,
    },
    planCodes,                                    // 측 catch (DELETE)에 측 catch
    holdoutCodes: holdouts.map(h => h.code),
    plans: plans,                                 // 측 plan 측 catch
  }, null, 2));
  console.log(`\n백업: ${backupFile}`);
  console.log(`  측 usol_n task 수: ${beforeTaskCount} / task_items: ${beforeItemCount}`);
  console.log(`  INSERT 측 catch task_no: ${planCodes.length}건`);

  // -----------------------------------------------------------
  // 7. INSERT (측 catch 50건씩, 실패 시 task_no 측 catch DELETE 측 catch)
  // -----------------------------------------------------------
  const insertedTaskNos = [];
  const BATCH = 50;
  console.log(`\nINSERT 측 catch 측 catch (측 catch ${BATCH}건씩)…`);

  try {
    for (let i = 0; i < plans.length; i += BATCH) {
      const slice = plans.slice(i, i + BATCH);

      // 7-1. tasks INSERT (측 catch)
      const taskRows = slice.map(p => p.task);
      const { data: insertedTasks, error: e1 } = await sb.from("tasks").insert(taskRows).select("id, task_no");
      if (e1) throw new Error(`tasks INSERT 실패 (측 catch ${i}-${i+slice.length-1}): ${e1.message}`);
      const idByCode = new Map((insertedTasks || []).map(t => [t.task_no, t.id]));
      insertedTaskNos.push(...(insertedTasks || []).map(t => t.task_no));

      // 7-2. task_items INSERT (측 catch)
      const itemRows = slice.map(p => ({
        task_id: idByCode.get(p.code),
        work_type_id: p.item.work_type_id,
        appliance_type_id: p.item.appliance_type_id,
        qty: p.item.qty,
        order_type: p.item.order_type,
        product_order_id: p.item.product_order_id,
        unit_price: 0,   // CSV에 금액 없음 — 추후 정산 라운드에서 채움
      }));
      const { error: e2 } = await sb.from("task_items").insert(itemRows);
      if (e2) throw new Error(`task_items INSERT 실패 (측 catch ${i}-${i+slice.length-1}): ${e2.message}`);

      process.stdout.write(`  · ${Math.min(i + BATCH, plans.length)}/${plans.length}\r`);
    }
    console.log(`\n✅ INSERT 측 catch — task ${insertedTaskNos.length}건, task_items ${insertedTaskNos.length}건`);
  } catch (err) {
    console.error(`\n⛔ ${err.message}`);
    console.error(`측 catch 측 catch — 측 ${insertedTaskNos.length}개 task DELETE 측 catch…`);
    // 측 catch — task_items는 task DELETE 측 catch cascade 측 catch X 측 catch 측 catch
    for (let i = 0; i < insertedTaskNos.length; i += 500) {
      const slice = insertedTaskNos.slice(i, i + 500);
      // 측 catch task_id 측 catch
      const { data: rb } = await sb.from("tasks").select("id").in("task_no", slice);
      const ids = (rb || []).map(t => t.id);
      if (ids.length > 0) {
        await sb.from("task_items").delete().in("task_id", ids);
        await sb.from("tasks").delete().in("id", ids);
      }
    }
    console.error(`측 catch 측 catch.`);
    process.exit(1);
  }

  // -----------------------------------------------------------
  // 8. 검증
  // -----------------------------------------------------------
  console.log("\n검증:");

  // 8-1. 420 측 catch INSERT 측 catch 측 catch
  const { data: insertedCheck } = await sb.from("tasks").select("task_no, status, principal_id").in("task_no", planCodes);
  const insertedSet = new Set((insertedCheck || []).map(t => t.task_no));
  const missing = planCodes.filter(c => !insertedSet.has(c));
  console.log(`  · INSERT 측 catch: ${insertedSet.size}/${planCodes.length} (missing=${missing.length})`);

  // 8-2. status 측 catch
  const statusDist = {};
  for (const t of (insertedCheck || [])) statusDist[t.status] = (statusDist[t.status] || 0) + 1;
  console.log(`  · status 측 catch:`);
  for (const [k, v] of Object.entries(statusDist).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${k.padEnd(8)} ${v}건`);
  }

  // 8-3. usol_n 측 catch task 측 catch
  const { count: afterTaskCount } = await sb.from("tasks").select("id", { count: "exact", head: true }).eq("principal_id", usolN.id);
  console.log(`  · usol_n task 수: ${beforeTaskCount} → ${afterTaskCount} (측 ${afterTaskCount - beforeTaskCount})`);
  console.log(`      측 catch ${beforeTaskCount + planCodes.length} : ${afterTaskCount === beforeTaskCount + planCodes.length ? "✅" : "⚠️"}`);

  // 8-4. task_items 측 catch
  const { data: insertedCheckIds } = await sb.from("tasks").select("id").in("task_no", planCodes);
  const insertedIds = (insertedCheckIds || []).map(t => t.id);
  let afterItemCountForInserted = 0;
  for (let i = 0; i < insertedIds.length; i += 500) {
    const slice = insertedIds.slice(i, i + 500);
    const { count } = await sb.from("task_items").select("id", { count: "exact", head: true }).in("task_id", slice);
    afterItemCountForInserted += count || 0;
  }
  console.log(`  · 측 INSERT task의 task_items: ${afterItemCountForInserted}건 (측 catch ${planCodes.length})`);

  // 8-5. 측 catch 2건 측 catch 측 catch (DB 측 catch 측 catch)
  const holdoutCodes = holdouts.map(h => h.code);
  if (holdoutCodes.length > 0) {
    const { data: hCheck } = await sb.from("tasks").select("task_no").in("task_no", holdoutCodes);
    console.log(`  · 측 catch 2건 DB 측 catch 측 catch: ${hCheck?.length ? "⚠️ " + hCheck.length + "건" : "✅ 0건"}`);
  }

  console.log(`\n측 catch 측 catch: ${Math.round((Date.now() - tStart) / 1000)}초`);
  console.log("=".repeat(120));
  console.log("측 catch 측 catch.");
  console.log("=".repeat(120));
})().catch(e => {
  console.error("FATAL:", e.message, e.stack);
  process.exit(1);
});

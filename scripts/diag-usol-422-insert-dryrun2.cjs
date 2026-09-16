// 진단 v2 — 유솔 422 INSERT 드라이런. 매칭 862에서 타입 매핑 복제. 쓰기 X.
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
  console.log("=".repeat(120));
  console.log("진단 v2 — 422 INSERT 드라이런 (타입 매핑 복제)");
  console.log("=".repeat(120));

  // -----------------------------------------------------------
  // CSV + DB 측 catch
  // -----------------------------------------------------------
  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  const csvRows = parsed.data;
  const csvByCode = new Map();
  for (const r of csvRows) {
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
    const { data } = await sb.from("tasks").select("*").in("principal_id", principalIds).range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allTasks = allTasks.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  const dbByCode = new Map(allTasks.map(t => [t.task_no, t]));

  const onlyCsv = [];
  const both = [];
  for (const c of csvByCode.keys()) {
    if (dbByCode.has(c)) both.push(c);
    else onlyCsv.push(c);
  }

  // -----------------------------------------------------------
  // 매칭 862 task_items 측 catch — 측 catch 측 catch 측 catch
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

  // (svc, sk) 측 catch → typeKey histogram
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

  // resolve 측 catch 측 catch — 측 catch typeKey 측 catch
  const resolveMap = new Map();
  for (const [key, entry] of mapping) {
    let best = null, bestCount = 0;
    for (const [tk, c] of entry.counts) {
      if (c > bestCount) { best = tk; bestCount = c; }
    }
    const [wt, at] = best.split("|");
    resolveMap.set(key, {
      workTypeId: wt || null,
      applianceTypeId: at || null,
      confidence: bestCount / entry.total,
      total: entry.total,
      uniques: entry.counts.size,
    });
  }

  // -----------------------------------------------------------
  // 매핑표 출력
  // -----------------------------------------------------------
  // work_types / appliance_types 측 catch 측 catch
  const { data: wtAll } = await sb.from("work_types").select("id, code, name");
  const { data: atAll } = await sb.from("appliance_types").select("id, code, name");
  const wtById = new Map((wtAll || []).map(w => [w.id, w]));
  const atById = new Map((atAll || []).map(a => [a.id, a]));

  console.log(`\n【매핑표 — (서비스종류, 서비스구분) → (work_type, appliance_type)】`);
  console.log(`${"서비스종류".padEnd(16)} | ${"서비스구분".padEnd(14)} | ${"work_type".padEnd(20)} | ${"appliance_type".padEnd(16)} | ${"신뢰도".padEnd(10)} | 표본수`);
  console.log("-".repeat(120));
  const mappingArr = [...resolveMap.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [key, r] of mappingArr) {
    const [svc, sk] = key.split("|");
    const wt = r.workTypeId ? wtById.get(r.workTypeId) : null;
    const at = r.applianceTypeId ? atById.get(r.applianceTypeId) : null;
    const conf = `${(r.confidence * 100).toFixed(0)}% (${r.uniques}측)`;
    console.log(`${svc.padEnd(16)} | ${(sk || "(빈칸)").padEnd(14)} | ${(wt?.name || wt?.code || "NULL").padEnd(20)} | ${(at?.name || at?.code || "NULL").padEnd(16)} | ${conf.padEnd(10)} | ${r.total}`);
  }

  // -----------------------------------------------------------
  // 422 INSERT plan 측 catch
  // -----------------------------------------------------------
  const { data: users } = await sb.from("users").select("id, name").eq("tenant_id", "11111111-1111-1111-1111-111111111111");
  const userIdByName = new Map((users || []).map(u => [u.name.trim(), u.id]));

  const sampleTask = allTasks.find(t => t.principal_id === usolN.id);

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

  const plans = [];        // 측 catch
  const blocked = [];      // 측 catch 측 catch 측 catch
  const unresolvedCombos = new Map(); // 측 catch 측 catch 측 catch (서비스종류, 서비스구분)

  for (const code of onlyCsv) {
    const row = csvByCode.get(code);
    const svc = (row["서비스종류"] || "").trim();
    const sk = (row["서비스구분"] || "").trim();
    const key = `${svc}|${sk}`;
    const r = resolveMap.get(key);

    // 측 catch 측 catch
    const contactYmd = parseYmd(row["고객컨택일자"]);
    const completedYmd = parseYmd(row["작업완료일"]);
    const requestYmd = parseYmd(row["요청일자"]);
    const orderYmd = parseYmd(row["주문일시"]);
    const promiseHm = parseHm(row["기사약속시간"]);
    const assignedName = (row["배정기사"] || "").trim();
    const assignedId = assignedName ? (userIdByName.get(assignedName) || null) : null;
    const status = deriveStatus(row, contactYmd, assignedId);

    // 측 catch 측 catch — 추가선택은 appliance_type NULL 측 catch (매칭 측 catch 측 catch 측 catch)
    const needsAppliance = svc !== "추가선택";
    if (!r || !r.workTypeId || (needsAppliance && !r.applianceTypeId)) {
      const combo = `${svc} / ${sk || "(빈칸)"}`;
      unresolvedCombos.set(combo, (unresolvedCombos.get(combo) || 0) + 1);
      blocked.push({ code, svc, sk, reason: !r ? "매칭 선례 측 catch X" : (!r.workTypeId ? "work_type 측 catch X" : "appliance_type 측 catch X") });
      continue;
    }

    // scheduled_at
    let scheduledAt = null;
    if (contactYmd && !contactYmd.parseError) {
      const h = promiseHm && (promiseHm.h !== 0 || promiseHm.mi !== 0) ? promiseHm.h : 9;
      const mi = promiseHm && (promiseHm.h !== 0 || promiseHm.mi !== 0) ? promiseHm.mi : 0;
      scheduledAt = toIso(contactYmd.y, contactYmd.mo, contactYmd.d, h, mi);
    }

    // completed_at
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
        tenant_id: "11111111-1111-1111-1111-111111111111",
        task_no: code,
        principal_id: usolN.id,
        category_id: sampleTask.category_id,
        customer_name: (row["수취인명"] || "").trim(),
        phone: (row["수취인연락처1"] || "").trim(),
        address,
        district: (row["지역키워드"] || "").trim() || null,
        channel: (row["채널"] || "").trim() || null,
        external_order_no: (row["주문번호"] || "").trim() || null,
        product_order_id: (row["상품주문번호"] || "").trim() || null,
        received_at: receivedAt,
        requested_date: requestYmd && !requestYmd.parseError ? `${requestYmd.y}-${String(requestYmd.mo).padStart(2,"0")}-${String(requestYmd.d).padStart(2,"0")}` : null,
        requested_time: (row["시간구분"] || "").trim() || null,
        assigned_engineer_id: assignedId,
        recommended_engineers: (row["추천기사"] || "").trim() || null,
        request_note: (row["배송메세지"] || "").trim() || null,
        happy_call_status: (row["해피콜상태"] || "").trim() || null,
        happy_call_memo: (row["해피콜메모"] || "").trim() || null,
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
      },
    });
  }

  // -----------------------------------------------------------
  // 측 catch
  // -----------------------------------------------------------
  console.log(`\n【422 INSERT 측 catch】`);
  console.log(`  ✅ INSERT 측 catch:        ${plans.length}건`);
  console.log(`  ⛔ 측 catch 측 catch:        ${blocked.length}건`);

  const statusDist = {};
  for (const p of plans) statusDist[p.task.status] = (statusDist[p.task.status] || 0) + 1;
  console.log(`\n  status 측 catch:`);
  for (const [k, v] of Object.entries(statusDist).sort((a, b) => b[1] - a[1])) {
    console.log(`    · ${k.padEnd(8)} ${v}건`);
  }

  if (unresolvedCombos.size > 0) {
    console.log(`\n  측 catch 측 catch — 매칭 선례 측 catch (서비스종류 / 서비스구분):`);
    for (const [combo, cnt] of [...unresolvedCombos.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    · ${combo} → ${cnt}건`);
    }
  }

  // 측 catch 5건
  console.log(`\n【측 catch 5건 측 catch 측 catch】`);
  for (const p of plans.slice(0, 5)) {
    console.log(`\n  ── ${p.code} ──`);
    for (const [k, v] of Object.entries(p.task)) {
      console.log(`    ${k.padEnd(22)} ${v === null ? "NULL" : String(v).slice(0, 60)}`);
    }
    const wt = wtById.get(p.item.work_type_id);
    const at = atById.get(p.item.appliance_type_id);
    console.log(`    [task_item] qty=${p.item.qty} order_type=${p.item.order_type}`);
    console.log(`                work_type=${wt?.name || wt?.code} (${p.item.work_type_id.slice(0, 8)})`);
    console.log(`                appliance_type=${at?.name || at?.code || "NULL"}${p.item.appliance_type_id ? ` (${p.item.appliance_type_id.slice(0,8)})` : ""}`);
  }

  // -----------------------------------------------------------
  // 결과 저장
  // -----------------------------------------------------------
  const outFile = path.join(__dirname, "diag-usol-422-insert-dryrun2-결과.json");
  fs.writeFileSync(outFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    mapping: mappingArr.map(([key, r]) => {
      const [svc, sk] = key.split("|");
      const wt = r.workTypeId ? wtById.get(r.workTypeId) : null;
      const at = r.applianceTypeId ? atById.get(r.applianceTypeId) : null;
      return { svc, sk, workType: wt ? { id: r.workTypeId, code: wt.code, name: wt.name } : null, applianceType: at ? { id: r.applianceTypeId, code: at.code, name: at.name } : null, confidence: r.confidence, total: r.total, uniques: r.uniques };
    }),
    summary: { canInsert: plans.length, blocked: blocked.length, statusDist },
    unresolvedCombos: [...unresolvedCombos.entries()].map(([combo, cnt]) => ({ combo, count: cnt })),
    blocked,
    plans,
  }, null, 2));
  console.log(`\n결과 저장: ${outFile}`);

  console.log("\n" + "=".repeat(120));
  console.log("드라이런 v2 측 catch — 측 catch 측 catch 측 catch.");
  console.log("=".repeat(120));
})().catch(e => console.log("FATAL:", e.message, e.stack));

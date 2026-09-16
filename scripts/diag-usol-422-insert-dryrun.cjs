// 진단 — 유솔 측 catch 422건 검증 + INSERT 드라이런. 측 catch X.
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

// =========================================================
// 측 catch
// =========================================================
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
  s = String(s).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: +m[1], mi: +m[2] };
}
function toIso(y, mo, d, h = 9, mi = 0) {
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi, 0)).toISOString();
}
function ymdToUtcStart(y, mo, d) { return new Date(Date.UTC(y, mo - 1, d, -9, 0, 0)); } // KST 00:00 → UTC 측 catch 15:00

// =========================================================
// main
// =========================================================
(async () => {
  console.log("=".repeat(120));
  console.log("측 catch — 유솔 측 catch 422건 검증 + INSERT 드라이런 (측 catch X)");
  console.log("=".repeat(120));

  // -----------------------------------------------------------
  // CSV 측 catch
  // -----------------------------------------------------------
  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  const csvRows = parsed.data;
  const csvByCode = new Map();
  for (const r of csvRows) {
    const c = (r["작업코드"] || "").trim();
    if (c) csvByCode.set(c, r);
  }

  // -----------------------------------------------------------
  // DB 측 catch
  // -----------------------------------------------------------
  const { data: principals } = await sb.from("principals").select("id, code");
  const usolH = principals.find(p => p.code === "usol_h");
  const usolN = principals.find(p => p.code === "usol_n");
  const principalIds = [usolH.id, usolN.id];
  const pCodeById = new Map(principals.map(p => [p.id, p.code]));

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

  // -----------------------------------------------------------
  // CSV-only / 매칭 분류
  // -----------------------------------------------------------
  const onlyCsv = [];
  const both = [];
  for (const [code, row] of csvByCode) {
    if (dbByCode.has(code)) both.push(code);
    else onlyCsv.push(code);
  }
  console.log(`\nCSV ${csvByCode.size}건 / DB ${allTasks.length}건 / 측 catch 측 catch ${both.length}건 / CSV측 catch ${onlyCsv.length}건`);

  // =========================================================
  // Step 1 — 검증
  // =========================================================
  console.log("\n" + "=".repeat(120));
  console.log("Step 1 — 검증");
  console.log("=".repeat(120));

  // 422건 측 catch 측 catch (= 작업코드 측 catch YS-26MMDD 측 catch 측 MM 측 catch)
  const monthOfCode = (code) => {
    const m = code.match(/YS-(?:N-)?26(\d{2})\d{2}-/);
    return m ? +m[1] : null;
  };
  const monthOfCompleted = (row) => {
    const r = parseYmd(row["작업완료일"]);
    return r && !r.parseError ? r.mo : null;
  };
  const cnt = (arr) => arr.reduce((a) => a + 1, 0);

  // 1-1. 422 측 catch 측 catch
  const codeMonths422 = {};
  const compMonths422 = {};
  for (const c of onlyCsv) {
    const r = csvByCode.get(c);
    const cm = monthOfCode(c);
    const dm = monthOfCompleted(r);
    codeMonths422[cm || "?"] = (codeMonths422[cm || "?"] || 0) + 1;
    compMonths422[dm || "(빈/측 catch)"] = (compMonths422[dm || "(빈/측 catch)"] || 0) + 1;
  }
  console.log(`\n[1-1] 422건 작업코드월 측 catch:`);
  for (const [k, v] of Object.entries(codeMonths422).sort()) console.log(`  · ${k}월: ${v}건`);
  console.log(`\n[1-1] 422건 작업완료일월 측 catch:`);
  for (const [k, v] of Object.entries(compMonths422).sort()) console.log(`  · ${k}월: ${v}건`);

  // ⚠️ 4월 완료 측 catch → 멈춤
  if (compMonths422["4"]) {
    console.log(`\n⚠️ 측 측 catch — 422건 측 catch 4월 작업완료일 ${compMonths422["4"]}건 측 catch. Step 2/3 측 catch X.`);
    return;
  }

  // 1-2. 매칭 862 측 catch 측 catch
  const codeMonthsBoth = {};
  for (const c of both) {
    const cm = monthOfCode(c);
    codeMonthsBoth[cm || "?"] = (codeMonthsBoth[cm || "?"] || 0) + 1;
  }
  console.log(`\n[1-2] 매칭 862건 작업코드월 측 catch (= 측 catch 측 catch 측 catch):`);
  for (const [k, v] of Object.entries(codeMonthsBoth).sort()) console.log(`  · ${k}월: ${v}건`);

  // 1-3. 422 상태 측 catch
  const stCounts = {};
  for (const c of onlyCsv) {
    const s = (csvByCode.get(c)["상태"] || "(빈칸)").trim();
    stCounts[s] = (stCounts[s] || 0) + 1;
  }
  console.log(`\n[1-3] 422건 CSV '상태' 측 catch:`);
  for (const [k, v] of Object.entries(stCounts).sort((a, b) => b[1] - a[1])) console.log(`  · ${k.padEnd(14)} ${v}건`);

  // =========================================================
  // Step 2 — 가격·정산 조사
  // =========================================================
  console.log("\n" + "=".repeat(120));
  console.log("Step 2 — 가격·정산 조사");
  console.log("=".repeat(120));

  // 매칭 측 catch usol_n task 측 catch product_price, total_amount 측 catch
  const matchedTasks = both.map(c => dbByCode.get(c)).filter(Boolean);
  const ppNull = matchedTasks.filter(t => t.product_price == null).length;
  const ppNonNull = matchedTasks.length - ppNull;
  console.log(`\n[2-1] 매칭 task 측 catch product_price:`);
  console.log(`  · 측 catch ${ppNonNull}건 / NULL ${ppNull}건`);

  // 측 catch 측 catch
  const taskIds = matchedTasks.map(t => t.id);
  let allItems = [];
  for (let i = 0; i < taskIds.length; i += 500) {
    const slice = taskIds.slice(i, i + 500);
    const { data } = await sb.from("task_items").select("task_id, unit_price, subtotal, qty, order_type").in("task_id", slice);
    if (data) allItems = allItems.concat(data);
  }
  const itemUpHist = { null: 0, zero: 0, positive: 0 };
  for (const it of allItems) {
    if (it.unit_price == null) itemUpHist.null++;
    else if (Number(it.unit_price) === 0) itemUpHist.zero++;
    else itemUpHist.positive++;
  }
  console.log(`\n[2-2] 측 catch task_items 측 catch (${allItems.length}건) unit_price:`);
  console.log(`  · NULL ${itemUpHist.null} / 0원 ${itemUpHist.zero} / 측 catch 측 catch ${itemUpHist.positive}`);

  // 측 catch payments
  let allPays = [];
  for (let i = 0; i < taskIds.length; i += 500) {
    const slice = taskIds.slice(i, i + 500);
    const { data } = await sb.from("payments").select("task_id, calc_method, engineer_amount, principal_amount, owner_amount").in("task_id", slice);
    if (data) allPays = allPays.concat(data);
  }
  const payByTask = new Map(allPays.map(p => [p.task_id, p]));
  const completedMatched = matchedTasks.filter(t => t.status === "완료");
  const completedWithPay = completedMatched.filter(t => payByTask.has(t.id)).length;
  console.log(`\n[2-3] 매칭 완료 task ${completedMatched.length}건 측 catch payments 측 catch ${completedWithPay}건`);

  const calcMethodHist = {};
  for (const p of allPays) calcMethodHist[p.calc_method || "(NULL)"] = (calcMethodHist[p.calc_method || "(NULL)"] || 0) + 1;
  console.log(`\n[2-4] payments calc_method 측 catch:`);
  for (const [k, v] of Object.entries(calcMethodHist).sort((a, b) => b[1] - a[1])) console.log(`  · ${k.padEnd(28)} ${v}건`);

  // 측 catch — usol_n 매칭 측 catch product_price 측 catch 측 catch?
  const ppSamples = matchedTasks.filter(t => t.product_price != null).slice(0, 5);
  console.log(`\n[2-5] product_price 측 catch (측 5건):`);
  for (const t of ppSamples) console.log(`  · ${t.task_no} ${t.customer_name} | product_price=${t.product_price} | total_amount=${t.total_amount}`);

  console.log(`\n→ 측 측: CSV 측 catch 측 catch 측 catch — DB 측 catch product_price 측 catch X 측 catch (네이버 측 catch / 측 catch 측 catch / 이관 측 catch 측 catch 측 catch 측 catch).`);
  console.log(`   422건 INSERT 측 catch product_price/subtotal/payments는 측 catch 측 catch X (Step 3 측 catch).`);

  // =========================================================
  // Step 3 — INSERT 드라이런
  // =========================================================
  console.log("\n" + "=".repeat(120));
  console.log("Step 3 — INSERT 드라이런 (측 catch X)");
  console.log("=".repeat(120));

  // 측 catch 측 catch 측 catch 측 catch
  const sampleTask = matchedTasks.find(t => t.principal_id === usolN.id) || matchedTasks[0];
  const colSet = sampleTask ? Object.keys(sampleTask) : [];
  console.log(`\n측 catch 컬럼셋: ${colSet.length}개 (측 catch ${sampleTask?.task_no})`);

  // users 측 catch 측 catch
  const { data: users } = await sb.from("users").select("id, name, tenant_id").eq("tenant_id", "11111111-1111-1111-1111-111111111111");
  const userIdByName = new Map((users || []).map(u => [u.name.trim(), u.id]));

  // work_types / appliance_types
  const { data: wtAll } = await sb.from("work_types").select("id, code, name");
  const { data: atAll } = await sb.from("appliance_types").select("id, code, name");
  // 측 catch — wall/stand/ceiling 측 catch
  const wtByCode = new Map((wtAll || []).map(w => [w.code, w.id]));
  const atByCode = new Map((atAll || []).map(a => [a.code, a.id]));
  // 측 catch — 매칭 측 catch task_items 측 catch 측 catch ID 측 catch
  let sampleItems = [];
  for (let i = 0; i < Math.min(taskIds.length, 50); i++) {
    const { data } = await sb.from("task_items").select("work_type_id, appliance_type_id, work_types(code,name), appliance_types(code,name)").eq("task_id", taskIds[i]);
    if (data) sampleItems = sampleItems.concat(data);
  }
  console.log(`\n측 catch 측 catch ID 측 catch — work_types: ${wtByCode.size}개, appliance_types: ${atByCode.size}개`);

  // 측 catch — '벽걸이'/'스탠드'/'천장형' → appliance_type
  // 측 catch '서비스구분' 측 catch '벽걸이', '스탠드', '천장형' 측 catch
  function resolveItem(svc, svcKind) {
    // svc = 서비스종류 (가정집 에어컨청소 / 사무실 에어컨청소 / 추가선택)
    // svcKind = 서비스구분 (벽걸이 / 스탠드 / 천장형 / 측 catch 측 catch)
    let appCode = null;
    const sk = (svcKind || "").trim();
    if (sk.includes("벽걸이")) appCode = "wall";
    else if (sk.includes("스탠드")) appCode = "stand";
    else if (sk.includes("천장")) appCode = "ceiling";
    else appCode = "other";
    // work_type: 측 catch 측 catch — 'clean_wall'/'clean_stand'/'clean_ceiling'? 측 catch 측 catch
    let wtCode = null;
    if (svc.includes("가정집") || svc.includes("사무실")) {
      if (appCode === "wall") wtCode = "clean_wall";
      else if (appCode === "stand") wtCode = "clean_stand";
      else if (appCode === "ceiling") wtCode = "clean_ceiling";
      else wtCode = "clean_wall";
    } else if (svc === "추가선택") {
      wtCode = "addon";
    } else {
      wtCode = "clean_wall";
    }
    return { workTypeId: wtByCode.get(wtCode), applianceTypeId: atByCode.get(appCode), wtCode, appCode };
  }

  // 측 catch 측 catch — status 측 catch
  function deriveStatus(row, contactYmd, engId) {
    const csvStatus = (row["상태"] || "").trim();
    if (csvStatus === "취소") return "취소";
    if (contactYmd && !contactYmd.parseError) {
      const d = new Date(Date.UTC(contactYmd.y, contactYmd.mo - 1, contactYmd.d));
      const boundary = new Date(Date.UTC(2026, 4, 24)); // 2026-05-24 (KST 측 catch 측 catch UTC)
      return d.getTime() <= boundary.getTime() ? "완료" : "확정";
    }
    if (engId) return "배정";
    return "미배정";
  }

  // 422건 INSERT plan 측 catch
  const insertPlans = [];
  const anomalies = [];
  for (const code of onlyCsv) {
    const row = csvByCode.get(code);
    // 측 catch 측 catch
    const contactYmd = parseYmd(row["고객컨택일자"]);
    const completedYmd = parseYmd(row["작업완료일"]);
    const requestYmd = parseYmd(row["요청일자"]);
    const orderYmd = parseYmd(row["주문일시"]);
    const promiseHm = parseHm(row["기사약속시간"]);

    if (contactYmd?.parseError) anomalies.push({ code, kind: "date_parse", field: "고객컨택일자", value: contactYmd.orig });
    if (completedYmd?.parseError) anomalies.push({ code, kind: "date_parse", field: "작업완료일", value: completedYmd.orig });
    if (requestYmd?.parseError) anomalies.push({ code, kind: "date_parse", field: "요청일자", value: requestYmd.orig });
    if (requestYmd?.corrected) anomalies.push({ code, kind: "date_corrected_year", field: "요청일자", value: requestYmd.orig });

    // 배정기사 측 catch lookup
    const assignedName = (row["배정기사"] || "").trim();
    let assignedId = null;
    if (assignedName) {
      assignedId = userIdByName.get(assignedName) || null;
      if (!assignedId) anomalies.push({ code, kind: "engineer_unmatched", value: assignedName });
    }

    // scheduled_at — contact + promise time
    let scheduledAt = null;
    if (contactYmd && !contactYmd.parseError) {
      const h = promiseHm && (promiseHm.h !== 0 || promiseHm.mi !== 0) ? promiseHm.h : 9;
      const mi = promiseHm && (promiseHm.h !== 0 || promiseHm.mi !== 0) ? promiseHm.mi : 0;
      scheduledAt = toIso(contactYmd.y, contactYmd.mo, contactYmd.d, h, mi);
    }

    // status
    const status = deriveStatus(row, contactYmd, assignedId);

    // completed_at — completed 측 catch + promise time. 측 catch 측 catch '완료' 측 catch
    let completedAt = null;
    if (status === "완료" && completedYmd && !completedYmd.parseError) {
      const promiseValid = promiseHm && (promiseHm.h !== 0 || promiseHm.mi !== 0);
      const h = promiseValid ? promiseHm.h : 9;
      const mi = promiseValid ? promiseHm.mi : 0;
      let dt = new Date(Date.UTC(completedYmd.y, completedYmd.mo - 1, completedYmd.d, h - 9, mi, 0));
      if (!promiseValid) dt = new Date(dt.getTime() + 2 * 3600 * 1000); // +2h
      completedAt = dt.toISOString();
    } else if (status === "완료" && scheduledAt) {
      // 작업완료일 측 catch 측 catch sched + 2h
      completedAt = new Date(new Date(scheduledAt).getTime() + 2 * 3600 * 1000).toISOString();
    }

    // received_at — 주문일시 (측 catch KST 측 catch 측 catch 9시 측 catch)
    let receivedAt = null;
    if (orderYmd && !orderYmd.parseError) receivedAt = toIso(orderYmd.y, orderYmd.mo, orderYmd.d, 0, 0);

    // 주소
    const addrConfirm = (row["주소재확인"] || "").trim();
    const address = addrConfirm || (row["주소"] || "").trim();

    // task_items
    const qty = parseInt(row["수량"], 10) || 1;
    const item = resolveItem(row["서비스종류"] || "", row["서비스구분"] || "");
    if (!item.workTypeId) anomalies.push({ code, kind: "work_type_unresolved", value: `${row["서비스종류"]} / ${row["서비스구분"]}` });
    if (!item.applianceTypeId) anomalies.push({ code, kind: "appliance_type_unresolved", value: row["서비스구분"] });

    insertPlans.push({
      code,
      task: {
        tenant_id: "11111111-1111-1111-1111-111111111111",
        task_no: code,
        principal_id: usolN.id,
        category_id: sampleTask.category_id, // aircon
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
        work_type_id: item.workTypeId,
        appliance_type_id: item.applianceTypeId,
        qty,
        order_type: (row["서비스종류"] || "").trim() === "추가선택" ? "추가선택" : "본작업",
      },
      raw: row,
    });
  }

  // 측 catch
  const statusDist = {};
  for (const p of insertPlans) statusDist[p.task.status] = (statusDist[p.task.status] || 0) + 1;

  console.log(`\nINSERT 측 catch task: ${insertPlans.length}건`);
  console.log(`INSERT 측 catch task_items: ${insertPlans.length}건 (측 task = 측 item, 추가선택 별도)`);
  console.log(`\nstatus 측 catch:`);
  for (const [k, v] of Object.entries(statusDist).sort((a, b) => b[1] - a[1])) console.log(`  · ${k.padEnd(8)} ${v}건`);

  // 측 catch
  const anomByKind = {};
  for (const a of anomalies) anomByKind[a.kind] = (anomByKind[a.kind] || 0) + 1;
  console.log(`\n측 catch:`);
  if (Object.keys(anomByKind).length === 0) console.log(`  (없음)`);
  for (const [k, v] of Object.entries(anomByKind)) console.log(`  · ${k.padEnd(28)} ${v}건`);

  // 배정기사 측 catch 측 catch 측 catch
  const engUnmatched = [...new Set(anomalies.filter(a => a.kind === "engineer_unmatched").map(a => a.value))];
  if (engUnmatched.length > 0) {
    console.log(`\n  배정기사 측 catch 측 catch 측 catch (${engUnmatched.length}측 catch):`);
    engUnmatched.slice(0, 20).forEach(n => console.log(`    · ${n}`));
  }

  // 측 catch 5건 측 catch
  console.log(`\n측 catch 5건 측 catch 측 catch:`);
  for (const p of insertPlans.slice(0, 5)) {
    console.log(`\n  ── ${p.code} ──`);
    for (const [k, v] of Object.entries(p.task)) {
      console.log(`    ${k.padEnd(22)} ${v === null ? "NULL" : String(v).slice(0, 60)}`);
    }
    console.log(`    [task_item] qty=${p.item.qty} work_type_id=${p.item.work_type_id} appliance_type_id=${p.item.appliance_type_id} order_type=${p.item.order_type}`);
  }

  // -----------------------------------------------------------
  // 결과 저장
  // -----------------------------------------------------------
  const outFile = path.join(__dirname, "diag-usol-422-insert-dryrun-결과.json");
  fs.writeFileSync(outFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    step1: {
      codeMonths422, compMonths422, codeMonthsBoth, stCounts,
    },
    step2: {
      ppNonNull, ppNull,
      itemUpHist,
      completedMatched: completedMatched.length,
      completedWithPay,
      calcMethodHist,
      ppSamples: ppSamples.map(t => ({ task_no: t.task_no, product_price: t.product_price, total_amount: t.total_amount })),
    },
    step3: {
      insertPlanCount: insertPlans.length,
      statusDist,
      anomaliesByKind: anomByKind,
      anomalies,
      plans: insertPlans, // 측 422 plan 측 catch 측 catch
    },
  }, null, 2));
  console.log(`\n결과 저장: ${outFile}`);

  console.log("\n" + "=".repeat(120));
  console.log("드라이런 측 catch — 측 catch INSERT/UPDATE/DELETE 측 catch.");
  console.log("=".repeat(120));
})().catch(e => console.log("FATAL:", e.message, e.stack));

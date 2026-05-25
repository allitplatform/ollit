// 유솔N 문연희 유령 중복 A 제거 — 드라이런 + --commit
// 2026-05-25
//
// 확정 근거: 운영시트 문연희 = ext 2026052285313711, 3품목
//   (poid ...795431 / ...795441 / ...795451) → 라이브 B(YS-260522-016)와 일치.
//   A(YS-N-260523-004 / ext 2026052285313710)는 시트에 없는 유령.
//
// 제거 대상:
//   · task        YS-N-260523-004 (id bedef53f...06cf4)
//   · task_items  2건 (poid ...795450 송풍팬분해 / ...795440 냉매점검)
//   · payment     A.task_id 행 (product_price=20,000)
//
// 사용법:
//   node scripts/diag-usoln-moondup-remove.cjs          # 드라이런 (삭제 X)
//   node scripts/diag-usoln-moondup-remove.cjs --commit # 백업 + 삭제 + 검증

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

const COMMIT = process.argv.includes("--commit");

// ============================================================
// 대상 식별자
// ============================================================
const A_TASK_NO   = "YS-N-260523-004";
const A_EXT       = "2026052285313710";
const A_ID_PREFIX = "bedef53f";
const A_PAYMENT_PP_EXPECT = 20000;  // 사장님 spec — payment 행의 product_price

const B_TASK_NO   = "YS-260522-016";
const B_EXT       = "2026052285313711";

const SHEET_POID_TAIL = ["795431", "795441", "795451"];     // B (시트 진본)
const GHOST_POID_TAIL = ["795450", "795440"];               // A (제거 대상 item poid 끝자리)

// ============================================================
// 유틸
// ============================================================
function bar(c = "═", n = 100) { return c.repeat(n); }
function head(title) { console.log("\n" + bar()); console.log(title); console.log(bar()); }
function sub(title)  { console.log("\n" + bar("─")); console.log(title); console.log(bar("─")); }

// information_schema → tasks.id 를 참조하는 모든 FK 조회
async function listFkToTasks() {
  // Postgres referential_constraints + key_column_usage 조회
  // Supabase JS는 information_schema 직접 select 가능
  const { data, error } = await sb
    .rpc("__noop_does_not_exist__");
  // RPC가 없으니 fallback — 직접 SQL은 service_role에서도 PostgREST 노출 X.
  // 대신 정적 점검 + 알려진 reference 테이블에 대해 행 존재만 검사.
  // (db/migrations 정적 조사 결과 — 아래 7개 테이블 + 향후 추가분은 commit 직전 한 번 더 점검 권장)
  return { ok: error?.code === "PGRST202" || !!error, fkTables: KNOWN_FK_TABLES };
}

// 정적 조사 결과 — 현재 스키마에서 tasks.id 를 FK로 참조하는 테이블
// (db/migrations 전체 grep: REFERENCES tasks(id))
const KNOWN_FK_TABLES = [
  { table: "task_items",         column: "task_id", onDelete: "CASCADE" },
  { table: "payments",           column: "task_id", onDelete: "CASCADE" },
  { table: "task_status_log",    column: "task_id", onDelete: "CASCADE" },
  { table: "task_disputes",      column: "task_id", onDelete: "CASCADE" },
  { table: "task_engineer_changes", column: "task_id", onDelete: "CASCADE" },
  { table: "task_attachments",   column: "task_id", onDelete: "CASCADE" },
  { table: "task_changes_audit_log", column: "task_id", onDelete: "CASCADE" },
];

// ============================================================
// 1) A 식별 + 출력
// ============================================================
async function fetchA() {
  const { data: a, error } = await sb.from("tasks")
    .select("*")
    .eq("task_no", A_TASK_NO)
    .maybeSingle();
  if (error) throw new Error("A fetch: " + error.message);
  if (!a) throw new Error(`A(${A_TASK_NO}) 없음 — 이미 삭제됐거나 식별자 오류`);

  // 식별 검증
  const checks = [];
  checks.push(["task_no", a.task_no === A_TASK_NO, `expect=${A_TASK_NO} got=${a.task_no}`]);
  checks.push(["ext", String(a.external_order_no) === A_EXT, `expect=${A_EXT} got=${a.external_order_no}`]);
  checks.push(["id prefix", String(a.id).startsWith(A_ID_PREFIX), `expect=${A_ID_PREFIX}* got=${a.id}`]);
  checks.push(["customer", a.customer_name === "문연희", `expect=문연희 got=${a.customer_name}`]);

  const allOk = checks.every(c => c[1]);
  sub("【1】 A 식별 검증");
  for (const [k, ok, msg] of checks) {
    console.log(`  ${ok ? "✅" : "❌"} ${k.padEnd(15)} ${msg}`);
  }
  if (!allOk) throw new Error("A 식별 실패 — 안전을 위해 중단");
  return a;
}

async function fetchAItems(aId) {
  const { data, error } = await sb.from("task_items")
    .select("id, task_id, order_type, product_order_id, qty, unit_price, subtotal, customer_paid_amount, work_types(name), appliance_types(name)")
    .eq("task_id", aId);
  if (error) throw new Error("A items fetch: " + error.message);
  return data || [];
}
async function fetchAPayment(aId) {
  const { data, error } = await sb.from("payments")
    .select("*")
    .eq("task_id", aId)
    .maybeSingle();
  if (error) throw new Error("A payment fetch: " + error.message);
  return data;
}

// ============================================================
// 2) FK 참조 점검 — A.id 를 가리키는 모든 행 카운트
// ============================================================
async function checkFkReferences(aId) {
  sub("【2】 FK 참조 점검 — A.id 를 가리키는 모든 행");
  const findings = [];
  for (const { table, column, onDelete } of KNOWN_FK_TABLES) {
    let count = null, error = null, missing = false;
    try {
      // 1차: count 헤더로 정확 카운트
      const r1 = await sb.from(table).select("*", { count: "exact", head: true }).eq(column, aId);
      count = r1.count;
      error = r1.error;
      // null 카운트면 2차: 실 select 로 재검증
      if (!error && count === null) {
        const r2 = await sb.from(table).select(`id, ${column}`).eq(column, aId).limit(50);
        if (r2.error) { error = r2.error; }
        else { count = (r2.data || []).length; }
      }
      // 테이블 자체가 없는 경우 detection
      if (error) {
        const msg = String(error.message || "");
        if (/relation .* does not exist|Could not find the table/i.test(msg)) {
          missing = true;
        }
      }
    } catch (e) {
      error = e;
    }
    let label;
    if (missing) label = `(테이블 없음)`;
    else if (error) label = `⚠️ 조회 실패: ${error.message || error}`;
    else if (count === null) label = `?건 (검증 실패)`;
    else label = `${String(count).padStart(3)}건`;
    const tag = (count != null && count > 0) ? "★" : "·";
    console.log(`  ${tag} ${table.padEnd(28)} ${column.padEnd(10)} ${label}  ON DELETE ${onDelete}`);
    findings.push({ table, column, onDelete, count, missing, error: error ? String(error.message || error) : null });
  }

  // CASCADE 미적용 + 행 존재 = 위험 → 중단 사유
  const danger = findings.filter(f => f.count > 0 && f.onDelete !== "CASCADE");
  // CASCADE인 테이블에 행이 있으면 = task DELETE 한 줄로 정리됨
  const cascadeRows = findings.filter(f => f.count > 0 && f.onDelete === "CASCADE");
  // 검증 실패 — 카운트도 못 받고 missing도 아님 (테이블 살아있는데 카운트 못 잡음)
  const unverified = findings.filter(f => f.count === null && !f.missing && !f.error);

  return { findings, danger, cascadeRows, unverified };
}

// ============================================================
// 3) 라이브 B 무변경 검증용 스냅샷
// ============================================================
async function snapshotB() {
  const { data: b } = await sb.from("tasks")
    .select("id, task_no, customer_name, external_order_no, status, product_price, total_amount, scheduled_at, completed_at, assigned_engineer_id")
    .eq("task_no", B_TASK_NO).maybeSingle();
  if (!b) return null;
  const { data: items } = await sb.from("task_items")
    .select("id, order_type, product_order_id, qty, unit_price, subtotal")
    .eq("task_id", b.id)
    .order("id");
  const { data: pay } = await sb.from("payments")
    .select("task_id, product_price, engineer_amount, principal_amount, owner_amount, is_balanced, status, calc_method, track")
    .eq("task_id", b.id).maybeSingle();
  return { task: b, items: items || [], payment: pay };
}
function shallowEq(a, b, keys) {
  for (const k of keys) {
    const av = a?.[k], bv = b?.[k];
    if (String(av) !== String(bv)) return { ok: false, key: k, av, bv };
  }
  return { ok: true };
}

// ============================================================
// 4) 상세 출력
// ============================================================
function printTask(label, t) {
  if (!t) { console.log(`  ${label}: (없음)`); return; }
  console.log(`  ${label}`);
  console.log(`    task_no            : ${t.task_no}`);
  console.log(`    id                 : ${t.id}`);
  console.log(`    customer / phone   : ${t.customer_name} / ${t.phone || "—"}`);
  console.log(`    external_order_no  : ${t.external_order_no}`);
  console.log(`    status             : ${t.status}`);
  console.log(`    scheduled_at       : ${t.scheduled_at || "(NULL)"}`);
  console.log(`    completed_at       : ${t.completed_at || "(NULL)"}`);
  console.log(`    product_price      : ${t.product_price}`);
  console.log(`    total_amount       : ${t.total_amount}`);
  console.log(`    assigned_engineer  : ${t.assigned_engineer_id || "(X)"}`);
  console.log(`    created_at         : ${t.created_at}`);
}
function printItems(items) {
  console.log(`  task_items: ${items.length}건`);
  items.forEach(it => {
    const tail = String(it.product_order_id || "").slice(-6);
    const ghostMark = GHOST_POID_TAIL.includes(tail) ? "★유령" : "";
    console.log(`    · id=${String(it.id).slice(0,8)} | ${it.order_type || "(X)"} | wt=${it.work_types?.name || "—"} | app=${it.appliance_types?.name || "—"} | qty=${it.qty} unit=${it.unit_price} sub=${it.subtotal} | poid=${it.product_order_id} ${ghostMark}`);
  });
}
function printPayment(pm) {
  if (!pm) { console.log(`  payment: (없음)`); return; }
  console.log(`  payment:`);
  console.log(`    task_id            : ${pm.task_id}`);
  console.log(`    product_price      : ${pm.product_price}`);
  console.log(`    engineer / principal / owner : ${pm.engineer_amount} / ${pm.principal_amount} / ${pm.owner_amount}`);
  console.log(`    is_balanced        : ${pm.is_balanced}`);
  console.log(`    status / method / track : ${pm.status} / ${pm.calc_method} / ${pm.track}`);
}

// ============================================================
// 5) 백업
// ============================================================
async function backup(a, items, pay) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `usoln-moondup-remove-before-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({
    timestamp: new Date().toISOString(),
    note: "유솔N 문연희 유령 중복 A 제거 직전 스냅샷",
    target: { task_no: A_TASK_NO, ext: A_EXT, id: a.id },
    task: a,
    task_items: items,
    payment: pay,
  }, null, 2));
  console.log(`  ✅ 백업 저장: ${file}`);
  return file;
}

// ============================================================
// 6) 삭제
// ============================================================
async function deleteA(aId, { useCascade }) {
  if (useCascade) {
    // CASCADE 신뢰 → task 한 줄 DELETE 로 자동 정리
    const { error } = await sb.from("tasks").delete().eq("id", aId);
    if (error) throw new Error("tasks DELETE: " + error.message);
    console.log(`  ✅ tasks DELETE (CASCADE 자동 정리)`);
  } else {
    // CASCADE 미신뢰 → 안전 순서로 수동 삭제
    const { error: e1 } = await sb.from("payments").delete().eq("task_id", aId);
    if (e1) throw new Error("payments DELETE: " + e1.message);
    console.log(`  ✅ payments DELETE`);
    const { error: e2 } = await sb.from("task_items").delete().eq("task_id", aId);
    if (e2) throw new Error("task_items DELETE: " + e2.message);
    console.log(`  ✅ task_items DELETE`);
    const { error: e3 } = await sb.from("tasks").delete().eq("id", aId);
    if (e3) throw new Error("tasks DELETE: " + e3.message);
    console.log(`  ✅ tasks DELETE`);
  }
}

// ============================================================
// 7) 검증
// ============================================================
async function verify(aId, bSnap) {
  sub("【검증】 A 0건 / 문연희 라이브 = B 1건 / B 무변경");

  // A 관련 — 0건 기대
  const { count: aCnt }    = await sb.from("tasks").select("*", { count: "exact", head: true }).eq("id", aId);
  const { count: aItemCnt } = await sb.from("task_items").select("*", { count: "exact", head: true }).eq("task_id", aId);
  const { count: aPayCnt }  = await sb.from("payments").select("*", { count: "exact", head: true }).eq("task_id", aId);
  console.log(`  · tasks(A.id)            : ${aCnt}건  ${aCnt === 0 ? "✅" : "❌"}`);
  console.log(`  · task_items(A.id)       : ${aItemCnt}건  ${aItemCnt === 0 ? "✅" : "❌"}`);
  console.log(`  · payments(A.id)         : ${aPayCnt}건  ${aPayCnt === 0 ? "✅" : "❌"}`);

  // usol_n principal_id
  const { data: p } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  const PID = p?.id;
  const { data: living } = await sb.from("tasks")
    .select("task_no, id, customer_name, external_order_no, status, product_price")
    .eq("principal_id", PID).eq("customer_name", "문연희");
  console.log(`  · 문연희 라이브 task     : ${(living||[]).length}건`);
  (living || []).forEach(t => console.log(`    · ${t.task_no} | ext=${t.external_order_no} | status=${t.status} | pp=${t.product_price}`));
  const onlyB = (living || []).length === 1 && living[0].task_no === B_TASK_NO;
  console.log(`    ${onlyB ? "✅" : "❌"} 라이브 = B(${B_TASK_NO}) 단독`);

  // B 무변경
  const bNow = await snapshotB();
  if (!bNow || !bSnap) {
    console.log(`  · B 스냅샷 비교: 불가 (before=${!!bSnap} after=${!!bNow})`);
    return;
  }
  const taskKeys = ["task_no","status","product_price","total_amount","scheduled_at","completed_at","assigned_engineer_id","external_order_no"];
  const taskCmp = shallowEq(bSnap.task, bNow.task, taskKeys);
  console.log(`  · B task 무변경          : ${taskCmp.ok ? "✅" : `❌ ${taskCmp.key}: ${taskCmp.av} → ${taskCmp.bv}`}`);

  // B items 무변경 (id 집합 + subtotal 합)
  const beforeIds = new Set(bSnap.items.map(x => x.id));
  const afterIds  = new Set(bNow.items.map(x => x.id));
  const sameIds   = beforeIds.size === afterIds.size && [...beforeIds].every(x => afterIds.has(x));
  const beforeSum = bSnap.items.reduce((s, x) => s + Number(x.subtotal || 0), 0);
  const afterSum  = bNow.items.reduce((s, x) => s + Number(x.subtotal || 0), 0);
  console.log(`  · B task_items 무변경    : id집합 ${sameIds ? "✅" : "❌"} / subtotal합 ${beforeSum}→${afterSum} ${beforeSum === afterSum ? "✅" : "❌"}`);

  // B payment 무변경
  if (bSnap.payment && bNow.payment) {
    const payKeys = ["product_price","engineer_amount","principal_amount","owner_amount","is_balanced","status","calc_method","track"];
    const payCmp = shallowEq(bSnap.payment, bNow.payment, payKeys);
    console.log(`  · B payment 무변경       : ${payCmp.ok ? "✅" : `❌ ${payCmp.key}: ${payCmp.av} → ${payCmp.bv}`}`);
  } else {
    console.log(`  · B payment              : before=${!!bSnap.payment} after=${!!bNow.payment}`);
  }
}

// ============================================================
// main
// ============================================================
(async () => {
  head(`유솔N 문연희 유령 중복 A 제거 ${COMMIT ? "[--commit 모드]" : "[드라이런]"}`);

  // 1) A 식별 + 상세
  const a = await fetchA();
  const aItems = await fetchAItems(a.id);
  const aPay   = await fetchAPayment(a.id);
  sub("【삭제 대상 상세】");
  printTask("A task", a);
  printItems(aItems);
  printPayment(aPay);

  // payment product_price 추가 식별 검증 (사장님 spec: 20,000)
  sub("【1-추가】 payment.product_price 식별 검증");
  if (!aPay) {
    console.log(`  ⚠️  payment 행 없음 — 사장님 spec(pp=20,000)과 불일치. 사장님 확인 필요. 중단.`);
    process.exit(1);
  }
  const ppOk = Number(aPay.product_price) === A_PAYMENT_PP_EXPECT;
  console.log(`  ${ppOk ? "✅" : "❌"} payment.product_price : expect=${A_PAYMENT_PP_EXPECT} got=${aPay.product_price}`);
  if (!ppOk) {
    console.log(`  중단 — payment 식별 불일치. 안전을 위해 진행하지 않음.`);
    process.exit(1);
  }
  // task_items 2건 + 끝자리 검증
  const tails = aItems.map(it => String(it.product_order_id || "").slice(-6));
  const expectGhostMatch = GHOST_POID_TAIL.every(t => tails.includes(t));
  console.log(`  ${aItems.length === 2 ? "✅" : "❌"} task_items 개수 : expect=2 got=${aItems.length}`);
  console.log(`  ${expectGhostMatch ? "✅" : "❌"} 유령 poid 끝자리 : expect=[${GHOST_POID_TAIL.join(",")}] got=[${tails.join(",")}]`);
  if (aItems.length !== 2 || !expectGhostMatch) {
    console.log(`  중단 — task_items 식별 불일치.`);
    process.exit(1);
  }

  // 2) FK 참조 점검
  const { findings, danger, cascadeRows, unverified } = await checkFkReferences(a.id);

  // CASCADE 정보 요약
  sub("【DELETE 영향 요약】");
  const taskItemsFk = findings.find(f => f.table === "task_items");
  const paymentsFk  = findings.find(f => f.table === "payments");
  console.log(`  · task_items FK : ON DELETE ${taskItemsFk?.onDelete || "?"}  (참조행 ${taskItemsFk?.count}건)`);
  console.log(`  · payments   FK : ON DELETE ${paymentsFk?.onDelete  || "?"}  (참조행 ${paymentsFk?.count}건)`);
  const allCascade = findings.every(f => f.onDelete === "CASCADE" || f.count === 0);
  console.log(`  → tasks DELETE 시 ${allCascade ? "✅ 모두 CASCADE 자동 정리 (task 한 줄 DELETE)" : "⚠️  일부 비-CASCADE 참조 — 수동 순서 필요"}`);

  // 위험 신호 — 비-CASCADE FK에 행 존재
  if (danger.length > 0) {
    sub("★ 보고 — 비-CASCADE FK에 참조 행 존재 (중단)");
    danger.forEach(d => console.log(`  · ${d.table}.${d.column} = ${d.count}건  ON DELETE ${d.onDelete}`));
    console.log("\n중단합니다. 위 테이블의 행을 먼저 처리하거나 사장님 OK 필요.");
    process.exit(1);
  }
  // 검증 실패 — 카운트도 못 받고 테이블도 살아있음
  if (unverified.length > 0) {
    sub("★ 보고 — 일부 FK 테이블 참조 행 검증 실패 (중단)");
    unverified.forEach(u => console.log(`  · ${u.table}.${u.column} — 카운트 ?건 (조회 무에러지만 결과 없음)`));
    console.log("\n중단합니다. 위 테이블을 사람이 직접 확인 필요.");
    process.exit(1);
  }
  // 기대 외 CASCADE 테이블에 행 존재 → 보고
  const unexpected = cascadeRows.filter(f => !["task_items", "payments"].includes(f.table));
  if (unexpected.length > 0) {
    sub("★ 보고 — 예상 외 테이블에 A.id 참조 행 존재 (중단)");
    unexpected.forEach(u => console.log(`  · ${u.table}.${u.column} = ${u.count}건  ON DELETE ${u.onDelete}`));
    console.log("\n중단합니다. CASCADE 자동 정리 대상이긴 하지만, spec에 없는 데이터입니다. 사장님 확인 필요.");
    process.exit(1);
  }

  // 3) 라이브 B 사전 스냅샷 (검증용)
  const bBefore = await snapshotB();
  sub("【참조 — B(라이브 정상) 사전 스냅샷】");
  printTask("B task", bBefore?.task);
  console.log(`  B task_items 개수 : ${bBefore?.items?.length ?? 0}`);
  console.log(`  B payment pp      : ${bBefore?.payment?.product_price ?? "(없음)"}`);

  if (!COMMIT) {
    sub("[드라이런 종료]");
    console.log("  · 위 내용 검토 후 --commit 으로 재실행");
    console.log("  · 백업 + DELETE + 검증 자동 수행됨");
    return;
  }

  // --commit 경로
  sub("【백업】");
  await backup(a, aItems, aPay);

  sub("【삭제 실행】");
  await deleteA(a.id, { useCascade: allCascade });

  // 4) 검증
  await verify(a.id, bBefore);

  head("완료.");
})().catch(e => {
  console.error("FATAL:", e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});

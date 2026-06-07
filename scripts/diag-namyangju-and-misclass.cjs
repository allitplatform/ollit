// [1] YS-260605-001 측측측 + 백업 + 측측 측측 + before/after dry-run
// [2] usol_h refrigerant 측 측측측 (principal_id 측측)
// [3] principal_id ↔ task_no prefix 측측측 측측 측측측
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  // ───────────────────────────────────────────────────
  // [1] YS-260605-001 측측측 + 백업
  // ───────────────────────────────────────────────────
  console.log("\n=== [1] YS-260605-001 — 측측 측측측 + 백업 ===");
  const { data: ph } = await sb.from("principals").select("id, code, name");
  const idByCode = new Map(ph.map(p => [p.code, p.id]));
  const codeById = new Map(ph.map(p => [p.id, p.code]));

  const { data: t } = await sb.from("tasks").select(`*, task_items(*), payments(*)`).eq("task_no","YS-260605-001").maybeSingle();
  console.log(`  task_id: ${t.id}`);
  console.log(`  현재 principal: ${codeById.get(t.principal_id)} (id=${t.principal_id})`);
  console.log(`  → 측측 principal: allday (id=${idByCode.get("allday")})`);
  console.log(`  product_price=${fmt(t.product_price)} extra_fee=${fmt(t.extra_fee)} total=${fmt(t.total_amount)}`);
  for (const it of (t.task_items||[])) {
    const code = it.work_type_id ? (await sb.from("work_types").select("name, service_types(code)").eq("id", it.work_type_id).maybeSingle()).data : null;
    console.log(`    item id=${it.id.slice(0,8)} svc=${code?.service_types?.code} unit=${fmt(it.unit_price)} qty=${it.qty} subtotal=${fmt(it.subtotal)} received=${fmt(it.received_amount)} order_type=${it.order_type}`);
  }
  const pmt = Array.isArray(t.payments) ? t.payments[0] : t.payments;
  console.log(`  payment: eng=${fmt(pmt?.engineer_amount)} principal=${fmt(pmt?.principal_amount)} owner=${fmt(pmt?.owner_amount)} calc=${pmt?.calc_method} track=${pmt?.track}`);

  // 백업
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = path.join(__dirname, "..", "data", `ys-260605-001-backup-${ts}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(t, null, 2), "utf8");
  console.log(`  ✓ 백업: ${backupPath}`);

  // ───────────────────────────────────────────────────
  // [2] 진짜 usol_h refri 측 — principal_id 기준
  // ───────────────────────────────────────────────────
  console.log("\n=== [2] principal_code='usol_h' (실측 principal_id) refrigerant 완료 task ===");
  const usolHId = idByCode.get("usol_h");
  const usolNId = idByCode.get("usol_n");

  const { data: usolHTasks } = await sb.from("tasks")
    .select(`task_no, principal_id, status,
             task_items(work_types(service_types(code))),
             payments(calc_method, engineer_amount, principal_amount, owner_amount)`)
    .eq("principal_id", usolHId).eq("status","완료");

  const refriCount = (usolHTasks||[]).filter(t => (t.task_items||[]).some(it => it.work_types?.service_types?.code === "refrigerant")).length;
  console.log(`  principal_id=usol_h 완료 측: ${(usolHTasks||[]).length}건`);
  console.log(`  측 측 refri 측측: ${refriCount}건`);
  for (const t of (usolHTasks||[])) {
    const hasRefri = (t.task_items||[]).some(it => it.work_types?.service_types?.code === "refrigerant");
    const pp = Array.isArray(t.payments) ? t.payments[0] : t.payments;
    if (hasRefri) {
      console.log(`    ${t.task_no}  calc=${pp?.calc_method} eng=${fmt(pp?.engineer_amount)}`);
    }
  }

  console.log("\n=== [2-b] 이전 측측 'usol_h refri' 측측측 6건 측측측 측측 ===");
  const prev6 = ["YS-260522-001","YS-260605-001","YS-N-260528-008-R","YS-N-260529-020","YS-N-260529-024-R","YS-N-260601-020-R"];
  for (const tno of prev6) {
    const { data: tk } = await sb.from("tasks").select("task_no, principal_id").eq("task_no", tno).maybeSingle();
    const pcode = codeById.get(tk?.principal_id) || "?";
    console.log(`    ${tno} → principal_id 측측 = ${pcode}`);
  }

  // ───────────────────────────────────────────────────
  // [3] 측측 (6월) 완료 측 principal_code ↔ task_no prefix 측측측
  // ───────────────────────────────────────────────────
  console.log("\n=== [3] 6월 완료 측 principal-prefix 측측측 측측 ===");
  const { data: junTasks } = await sb.from("tasks")
    .select("task_no, principal_id, status, completed_at")
    .eq("status","완료")
    .gte("completed_at","2026-05-31T15:00:00Z");  // KST 6/1 측측

  const PREFIX_MAP = { "A-": "KA 측측측 (allday/aircon_pro 등)", "YS-N-": "usol_n", "YS-": "usol_h/usol_n", "CK-": "crikrin", "KB-": "KB", "YO-": "yongin" };
  const flagged = [];
  for (const t of (junTasks||[])) {
    const pcode = codeById.get(t.principal_id);
    const tno = t.task_no || "";
    let suspect = false;
    let reason = "";
    if (tno.startsWith("A-") && pcode !== "KA" && pcode !== "allday") { suspect = true; reason = `A- 측측측 측측 ${pcode}`; }
    if (tno.startsWith("YS-N-") && pcode !== "usol_n") { suspect = true; reason = `YS-N- 측측측 측측 ${pcode}`; }
    if (tno.startsWith("YS-") && !tno.startsWith("YS-N-") && pcode !== "usol_h" && pcode !== "usol_n") { suspect = true; reason = `YS- 측측측 측측 ${pcode}`; }
    if (tno.startsWith("CK-") && pcode !== "crikrin") { suspect = true; reason = `CK- 측측측 측측 ${pcode}`; }
    if (suspect) flagged.push({ tno, pcode, reason });
  }
  console.log(`  측측 측측 완료: ${(junTasks||[]).length}건`);
  console.log(`  측측 측측측: ${flagged.length}건`);
  for (const f of flagged) {
    console.log(`    ⚠️ ${f.tno}  principal=${f.pcode}  (${f.reason})`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

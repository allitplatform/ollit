// ③ 추가 진단 — 불일치 23건 정산 영향 분석 + YS-260424-080 측
const fs = require("fs"), path = require("path");
const XLSX = require("xlsx");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PRINCIPAL_ID = "22222222-2222-2222-2222-222222222006";
function cleanStr(v) { return v == null ? "" : String(v).trim(); }
function toInt(v) { const n = parseFloat(String(v || "").replace(/[,\s]/g, "")); return isNaN(n) ? 0 : Math.round(n); }

// 불일치 23건 — 측 진단 결과 측 hardcoded
const MISMATCH_LIST = [
  { task_no: "YS-260424-080", db: "본작업", sheet: "추가선택", note: "측 측 — 시트 측 측" },
  { task_no: "YS-260522-016", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260520-002", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260517-054", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260516-094", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260515-094", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260515-089", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260514-029", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260425-010", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260518-135", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260516-121", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260516-036", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260516-073", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260512-035", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260512-026", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260511-007", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260510-018", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260509-002", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260502-008", db: "추가선택", sheet: "본작업" },
  { task_no: "YS-260429-016", db: "추가선택", sheet: "본작업" },
];

(async () => {
  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, "..", "유솔홈케어_운영.xlsx")), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });

  // 작업코드 측 측 + 주문번호 측 측
  const sheetByTaskNo = new Map();
  const sheetByOrderNo = new Map();
  for (const r of rows) {
    const tno = cleanStr(r["작업코드"]);
    const ono = cleanStr(r["주문번호"]);
    if (tno) { if (!sheetByTaskNo.has(tno)) sheetByTaskNo.set(tno, []); sheetByTaskNo.get(tno).push(r); }
    if (ono) { if (!sheetByOrderNo.has(ono)) sheetByOrderNo.set(ono, []); sheetByOrderNo.get(ono).push(r); }
  }

  // ============================================================================
  // [A] 22건 (가정용 스탠드 / 대형실외기) — task / payments / 시트 측 비교
  // ============================================================================
  console.log(`${"=".repeat(120)}\n[A] 불일치 측 — DB 정산 vs 시트 정산\n${"=".repeat(120)}\n`);
  console.log(`task_no\t\tDB_OT\t시트_OT\tDB_principal\tDB_eng\tDB_own\t시트_도급사\t시트_회사배분\t측 측\tnote`);
  console.log("-".repeat(140));

  const group22 = MISMATCH_LIST.filter(m => m.db === "추가선택");   // 가정용 스탠드/대형실외기
  for (const m of group22) {
    const { data: task } = await sb.from("tasks").select("id").eq("tenant_id", TENANT_ID).eq("task_no", m.task_no).maybeSingle();
    if (!task) continue;
    const { data: pays } = await sb.from("payments").select("principal_amount, engineer_amount, owner_amount, calc_method").eq("task_id", task.id);
    const pay = pays?.[0];
    const sheetRows = sheetByTaskNo.get(m.task_no) || [];
    const sheet = sheetRows[0];
    const sP = sheet ? toInt(sheet["도급사정산액"]) : 0;
    const sE = sheet ? toInt(sheet["회사배분액"]) : 0;
    const dbTotal = (pay?.engineer_amount || 0) + (pay?.owner_amount || 0);
    const match = dbTotal === sE && (pay?.principal_amount || 0) === sP ? "✅" : "❌";
    console.log(`${m.task_no}\t${m.db}\t${m.sheet}\t${pay?.principal_amount}\t\t${pay?.engineer_amount}\t${pay?.owner_amount}\t${sP}\t\t${sE}\t\t${match}\t${pay?.calc_method}`);
  }

  // ============================================================================
  // [B] 시뮬레이션 — order_type 측 측 측 정산 측 측 측?
  // ============================================================================
  console.log(`\n${"=".repeat(120)}\n[B] order_type 시뮬레이션 — compute_payment 측 측 측 측 측 측\n${"=".repeat(120)}\n`);

  // Migration 046 v11 측 측:
  //   line 163-167: IF principal='usol_n' AND order_type='추가선택' AND service='refrigerant' THEN service='addon'
  //   → service 측 'cleaning' (스탠드/4way 측 본작업) 측 측 측 측 order_type 측 측 측 X
  //   → calc_method 측 commission_policies 측 측 측 (service+appliance 측 측)
  console.log(`  Migration 046 v11 measurement order_type 측 측 측:`);
  console.log(`    · refrigerant + order_type='추가선택' → service='addon' (85/15)`);
  console.log(`    · 측 측 측 — order_type 측 측 측 X (calc_method 측 service+appliance 측 측)`);
  console.log(`\n  → 22건 측 측 (service='cleaning'):`);
  console.log(`    · 측 측 order_type='추가선택' measurement → cleaning + 스탠드/4way → calc_method='usol_n_본작업' 측 적용 측 measurement`);
  console.log(`    · 측 정산 정상 (시트 측 측)`);
  console.log(`    · order_type 측 '본작업' 측 측 측 측 → 측 측 측 측 측 → calc_method 측 측 → 정산 변동 X`);

  // 대형실외기 측 측 측 측 측 측
  console.log(`\n  ⚠️ 대형실외기 측 측 측:`);
  const { data: bigOutdoor } = await sb.from("tasks").select("id, task_no").eq("task_no", "YS-260516-036").maybeSingle();
  if (bigOutdoor) {
    const { data: items } = await sb.from("task_items").select("work_type_id, appliance_type_id, work_types(name, code), appliance_types(name, code)").eq("task_id", bigOutdoor.id);
    console.log(`    task_no=${bigOutdoor.task_no}`);
    for (const it of (items || [])) {
      console.log(`      · work_type=${it.work_types?.name} (${it.work_types?.code}) | appliance=${it.appliance_types?.name || "(X)"} (${it.appliance_types?.code})`);
    }
  }

  // commission_policies 측 — 대형실외기 측 정책 측?
  const { data: outdoorPolicies } = await sb.from("commission_policies").select("policy_key, calc_method, appliance_code, service_code, fixed_unit_price, fee_rate").eq("principal_code", "usol_n").or("appliance_code.eq.대형실외기,policy_key.like.%대형실외기%");
  console.log(`\n  commission_policies 측 대형실외기 측: ${outdoorPolicies?.length || 0}건`);
  for (const p of (outdoorPolicies || [])) {
    console.log(`    · ${p.policy_key} | service=${p.service_code} | appliance=${p.appliance_code} | calc=${p.calc_method} | 정액=${p.fixed_unit_price} | 비율=${p.fee_rate}`);
  }

  // ============================================================================
  // [C] YS-260424-080 — 측 측 측 측 측 + DB task_items 측 측
  // ============================================================================
  console.log(`\n${"=".repeat(120)}\n[C] YS-260424-080 측 측\n${"=".repeat(120)}\n`);
  const { data: task080 } = await sb.from("tasks").select("id, task_no, external_order_no, customer_name, status").eq("tenant_id", TENANT_ID).eq("task_no", "YS-260424-080").maybeSingle();
  console.log(`  DB task: ${JSON.stringify(task080)}`);

  if (task080?.external_order_no) {
    const sheetOrder = sheetByOrderNo.get(task080.external_order_no) || [];
    console.log(`\n  시트 측 측 측 (주문번호=${task080.external_order_no}): ${sheetOrder.length}건`);
    for (const r of sheetOrder) {
      console.log(`    · 작업코드=${cleanStr(r["작업코드"])} | 서비스종류=${cleanStr(r["서비스종류"])} | 서비스구분=${cleanStr(r["서비스구분"])} | 최종상품=${r["최종상품금액"]} | 정산예정=${r["정산예정금액"]}`);
    }
  }

  console.log(`\n  DB task_items:`);
  const { data: items080 } = await sb.from("task_items").select("id, order_type, unit_price, qty, product_order_id, work_types(name, code), appliance_types(name, code)").eq("task_id", task080?.id);
  for (const it of (items080 || [])) {
    console.log(`    · order_type=${it.order_type} | qty=${it.qty} | unit_price=${it.unit_price} | work_type=${it.work_types?.name} (${it.work_types?.code}) | appliance=${it.appliance_types?.name || "(X)"} | product_order=${it.product_order_id}`);
  }

  const { data: pay080 } = await sb.from("payments").select("principal_amount, engineer_amount, owner_amount, calc_method").eq("task_id", task080?.id);
  console.log(`\n  DB payments:`);
  for (const p of (pay080 || [])) console.log(`    · principal=${p.principal_amount} | engineer=${p.engineer_amount} | owner=${p.owner_amount} | calc=${p.calc_method}`);
})();

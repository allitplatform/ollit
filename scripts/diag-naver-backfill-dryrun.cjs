// 2026-06-01 — 네이버 정산 엑셀 → usol_n task_items 매칭 드라이런 (DB 변경 X).
//
// 입력: ./네이버정산.xlsx.xlsx (로컬, 3411건 추정).
// 컬럼:
//   상품주문번호, 정산완료일(YYYY.MM.DD), 정산예정금액(net), 정산기준금액(gross), 정산상태
// 처리:
//   1) '일반정산' 만 (' 정산후 취소' 제외)
//   2) DB usol_n task_items 매칭 — floor(poid / 10) 키
//   3) 보고: 매칭 / 미매칭 / 취소 카운트 + 미매칭 샘플
//   4) 백필 시뮬레이션: 정산완료일 KST 주차별 건수·sum net 합산 → 표 naverCount/weeklyTotal 비교
//
// 실행: node scripts/diag-naver-backfill-dryrun.cjs
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const XLSX = require("xlsx");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";

// XLSX 파일 — Windows Korean 경로 인코딩 회피 측측 readdir 측 측측.
const PROJ_ROOT = path.join(__dirname, "..");
function findNaverXlsx() {
  const files = fs.readdirSync(PROJ_ROOT);
  const hit = files.find(f => f.includes("네이버정산") && f.endsWith(".xlsx"));
  return hit ? path.join(PROJ_ROOT, hit) : null;
}
const XLSX_PATH = findNaverXlsx();

function poidKey(v) {
  if (v == null) return null;
  const n = Number(String(v).trim());
  if (!isFinite(n)) return null;
  return Math.floor(n / 10);
}

function parseKstDate(raw) {
  if (raw == null || raw === "") return null;
  // YYYY.MM.DD / YYYY-MM-DD / YYYY/MM/DD / Date 객체 / Excel serial
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const s = String(raw).trim().replace(/[./]/g, "-");
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${String(Number(mo)).padStart(2, "0")}-${String(Number(d)).padStart(2, "0")}`;
}

function toInt(v) {
  if (v == null || v === "") return 0;
  const s = String(v).replace(/[^\d.\-]/g, "");
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

function mondayOfKstYmd(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const off = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + off);
  return dt.toISOString().slice(0, 10);
}

// 표 값 (시트 기준)
const TABLE = {
  "2026-03-30": { week: "W14", naverCount:   0, weeklyTotal:    408_000 },
  "2026-04-06": { week: "W15", naverCount:   3, weeklyTotal:    283_606 },
  "2026-04-13": { week: "W16", naverCount:  18, weeklyTotal:  1_136_493 },
  "2026-04-20": { week: "W17", naverCount:  72, weeklyTotal:  4_879_840 },
  "2026-04-27": { week: "W18", naverCount: 100, weeklyTotal:  6_514_822 },
  "2026-05-04": { week: "W19", naverCount: 302, weeklyTotal: 19_504_515 },
  "2026-05-11": { week: "W20", naverCount: 259, weeklyTotal: 16_958_937 },
  "2026-05-18": { week: "W21", naverCount: 284, weeklyTotal: 18_790_320 },
  "2026-05-25": { week: "W22", naverCount: 281, weeklyTotal: 19_267_868 },
};

(async () => {
  // ── 1) xlsx 읽기
  if (!fs.existsSync(XLSX_PATH)) {
    console.error("XLSX 파일 없음:", XLSX_PATH);
    process.exit(1);
  }
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  console.log(`📄 XLSX 측 ${rows.length}측 측측 (sheet: ${wb.SheetNames[0]})`);

  // 컬럼 확인 (첫 행 키)
  const sampleKeys = rows[0] ? Object.keys(rows[0]) : [];
  console.log(`첫 행 컬럼: [${sampleKeys.join(", ")}]\n`);

  // ── 2) '일반정산' 필터링
  const COL_POID  = "상품주문번호";
  const COL_DATE  = "정산완료일";
  const COL_NET   = "정산예정금액";
  const COL_GROSS = "정산기준금액";
  const COL_STAT  = "정산상태";

  let totalRows = rows.length;
  let canceledCnt = 0, normalCnt = 0, missingPoidCnt = 0;
  const parsed = [];
  for (const r of rows) {
    const stat = String(r[COL_STAT] || "").trim();
    if (stat.includes("취소")) { canceledCnt += 1; continue; }
    normalCnt += 1;
    const poidRaw = r[COL_POID];
    if (!poidRaw) { missingPoidCnt += 1; continue; }
    const k = poidKey(poidRaw);
    if (k == null) { missingPoidCnt += 1; continue; }
    parsed.push({
      poidRaw: String(poidRaw),
      poidKey: k,
      settledYmd: parseKstDate(r[COL_DATE]),
      net: toInt(r[COL_NET]),
      gross: toInt(r[COL_GROSS]),
    });
  }
  console.log(`\n=== xlsx 측 측측 측측 ===`);
  console.log(`  측: ${totalRows}측`);
  console.log(`  일반정산: ${normalCnt}측`);
  console.log(`  취소 (제외): ${canceledCnt}측`);
  console.log(`  poid 측 측측 키 불가: ${missingPoidCnt}측`);
  console.log(`  → 매칭 후보: ${parsed.length}측`);

  // ── 3) DB usol_n task_items 측측 fetch (paged)
  console.log(`\n=== DB usol_n task_items 측측 fetch ===`);
  const PAGE = 1000;
  const all = [];
  for (let p = 0; p < 30; p++) {
    const { data, error } = await sb.from("task_items")
      .select("id, product_order_id, naver_settled_at, net_amount, is_canceled, tasks!inner(principal_id, completed_at, status, task_no, customer_name)")
      .eq("tasks.principal_id", PID)
      .not("product_order_id", "is", null)
      .order("id", { ascending: true })
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  console.log(`  DB usol_n task_items (poid O): ${all.length}측`);

  // 활성 (취소 제외) + key 측측
  const dbByKey = new Map();
  for (const it of all) {
    if (it.is_canceled) continue;
    if (it.tasks?.status === "취소") continue;
    const k = poidKey(it.product_order_id);
    if (k == null) continue;
    if (!dbByKey.has(k)) dbByKey.set(k, []);
    dbByKey.get(k).push(it);
  }
  console.log(`  DB 활성 (취소 제외): ${[...dbByKey.values()].reduce((s, l) => s + l.length, 0)}건 / ${dbByKey.size} 키`);

  // ── 4) 매칭
  let matchedCnt = 0, unmatchedCnt = 0;
  const matched = [];
  const unmatchedSamples = [];
  const dupKeyHits = [];  // 같은 키에 DB 2건+
  for (const x of parsed) {
    const dbHits = dbByKey.get(x.poidKey);
    if (!dbHits || dbHits.length === 0) {
      unmatchedCnt += 1;
      if (unmatchedSamples.length < 10) {
        unmatchedSamples.push({ poid: x.poidRaw, ymd: x.settledYmd, net: x.net });
      }
      continue;
    }
    matchedCnt += 1;
    matched.push({ ...x, dbHits });
    if (dbHits.length > 1) dupKeyHits.push({ key: x.poidKey, count: dbHits.length });
  }
  console.log(`\n=== 측측 결과 ===`);
  console.log(`  매칭: ${matchedCnt}측`);
  console.log(`  미매칭: ${unmatchedCnt}측`);
  console.log(`  같은 키에 DB 2건+ (poid 충돌): ${dupKeyHits.length}측`);
  if (unmatchedSamples.length > 0) {
    console.log(`\n  미매칭 샘플 (앞 10):`);
    for (const s of unmatchedSamples) {
      console.log(`    poid=${s.poid} | ymd=${s.ymd} | net=₩${(s.net||0).toLocaleString()}`);
    }
  }

  // ── 5) 백필 시뮬레이션 — 정산완료일 KST 주차 측측 측측
  console.log(`\n=== 백필 시뮬레이션 — 정산완료일 KST 주차 측측 ===`);
  console.log("─".repeat(98));
  console.log(`  ${"주차".padEnd(10)} | ${"표값(naver)".padStart(11)} | ${"backfill cnt".padStart(12)} | ${"표(weeklyTotal)".padStart(15)} | ${"backfill sum net".padStart(17)}`);
  console.log("─".repeat(98));
  const byWeek = {};
  for (const x of matched) {
    const wk = mondayOfKstYmd(x.settledYmd);
    if (!wk) continue;
    if (!byWeek[wk]) byWeek[wk] = { cnt: 0, sumNet: 0 };
    byWeek[wk].cnt += 1;
    byWeek[wk].sumNet += Number(x.net) || 0;
  }
  const allKeys = new Set([...Object.keys(TABLE), ...Object.keys(byWeek)]);
  for (const k of [...allKeys].sort()) {
    const t = TABLE[k];
    const b = byWeek[k] || { cnt: 0, sumNet: 0 };
    const wkLbl = (t && t.week) || "OUTSIDE";
    const naverCnt = t ? t.naverCount : "—";
    const wTotal   = t ? t.weeklyTotal : "—";
    const cntFlag = t && b.cnt === t.naverCount ? " ✓" : (t ? " ⚠️" : "");
    console.log(`  ${(k + " " + wkLbl).padEnd(10)} | ${String(naverCnt).padStart(11)} | ${String(b.cnt).padStart(12)} | ${(typeof wTotal === "number" ? "₩"+wTotal.toLocaleString() : wTotal).padStart(15)} | ₩${b.sumNet.toLocaleString().padStart(16)}${cntFlag}`);
  }

  // ── 6) 측측 (덮어쓰기) 측측 측측 측측
  console.log(`\n=== 측측 측측 (덮어쓰기 측측) ===`);
  let alreadyMarked = 0, alreadyEngSettled = 0, alreadyPaid = 0;
  let needMark = 0, needNetUpdate = 0;
  for (const m of matched) {
    for (const it of m.dbHits) {
      if (it.naver_settled_at) alreadyMarked += 1;
      else needMark += 1;
      // net_amount 측 != net (xlsx) 측측측 변경 측측
      if (Number(it.net_amount) !== m.net) needNetUpdate += 1;
    }
  }
  console.log(`  매칭 매칭 DB items: ${matched.reduce((s, m) => s + m.dbHits.length, 0)}측`);
  console.log(`  naver_settled_at 측측 마킹: ${alreadyMarked}측 (덮어쓰기 대상)`);
  console.log(`  naver_settled_at 측측: ${needMark}측 (신규 마킹)`);
  console.log(`  net_amount 다름 (덮어쓰기): ${needNetUpdate}측`);
})();

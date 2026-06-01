// 2026-06-01 — naver_settled_at + net_amount 백필.
//
// 입력: ./네이버정산.xlsx (3411측 측 일반정산 3380측, 매칭 904측).
// 처리:
//   1) xlsx 측측 + DB 측측 → floor(poid/10) 매칭 (드라이런 측 측측).
//   2) 백업: 측측 측 naver_settled_at / net_amount / engineer_settled_at →
//      backups/usoln-net-backfill-{YYYY-MM-DD}.json.
//   3) UPDATE:
//      · naver_settled_at = KST 정산완료일 자정 → UTC ISO.
//      · net_amount = 정산예정금액 (xlsx) — 측측, engineer_settled_at NOT NULL 측 보호 (보존).
//   4) 측측증 — 측측측 측측·net 측 + 5월 작업 1차 측측 (정확 측측 측 측측 측측).
//
// 측측: node scripts/backfill-naver-net.cjs

const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const XLSX = require("xlsx");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";
const PROJ_ROOT = path.join(__dirname, "..");

function findNaverXlsx() {
  const files = fs.readdirSync(PROJ_ROOT);
  const hit = files.find(f => f.includes("네이버정산") && f.endsWith(".xlsx"));
  return hit ? path.join(PROJ_ROOT, hit) : null;
}

function poidKey(v) {
  if (v == null) return null;
  const n = Number(String(v).trim());
  if (!isFinite(n)) return null;
  return Math.floor(n / 10);
}

function parseKstDate(raw) {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const s = String(raw).trim().replace(/[./]/g, "-");
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[3])).padStart(2, "0")}`;
}

function toInt(v) {
  if (v == null || v === "") return 0;
  const s = String(v).replace(/[^\d.\-]/g, "");
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

// KST date → UTC ISO at KST 00:00 (= UTC 전날 15:00).
function kstYmdToUtcIso(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, -9, 0, 0)).toISOString();
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

// 표 측측
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
  // ── 1) XLSX 측측 + 측측 ─────────────────────────────────
  const XLSX_PATH = findNaverXlsx();
  if (!XLSX_PATH) { console.error("XLSX 측 측측 X"); process.exit(1); }
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  console.log(`📄 xlsx: ${rows.length}측 측측`);

  const parsed = [];
  let canceledCnt = 0;
  for (const r of rows) {
    const stat = String(r["정산상태"] || "").trim();
    if (stat.includes("취소")) { canceledCnt += 1; continue; }
    const poid = r["상품주문번호"];
    const k = poidKey(poid);
    if (k == null) continue;
    parsed.push({
      poidRaw: String(poid),
      poidKey: k,
      settledYmd: parseKstDate(r["정산완료일"]),
      net: toInt(r["정산예정금액"]),
    });
  }
  console.log(`  일반정산 매칭 후보: ${parsed.length}측 (취소 측측: ${canceledCnt})`);

  // ── 2) DB fetch ───────────────────────────────────────
  const PAGE = 1000;
  const all = [];
  for (let p = 0; p < 30; p++) {
    const { data, error } = await sb.from("task_items")
      .select("id, product_order_id, naver_settled_at, net_amount, engineer_settled_at, is_canceled, tasks!inner(principal_id, status)")
      .eq("tasks.principal_id", PID)
      .not("product_order_id", "is", null)
      .order("id", { ascending: true })
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  const dbByKey = new Map();
  for (const it of all) {
    if (it.is_canceled) continue;
    if (it.tasks?.status === "측측") continue; // 한글 매치
    if (it.tasks?.status === "취소") continue;
    const k = poidKey(it.product_order_id);
    if (k == null) continue;
    if (!dbByKey.has(k)) dbByKey.set(k, []);
    dbByKey.get(k).push(it);
  }
  console.log(`  DB 활성 (취소 제외): ${[...dbByKey.values()].reduce((s, l) => s + l.length, 0)}측 / ${dbByKey.size} 키`);

  // ── 3) 매칭 + 측측 계획 ───────────────────────────────
  const updates = [];     // { id, newNaverSettled, newNetAmount, protected, oldRow }
  for (const x of parsed) {
    const dbHits = dbByKey.get(x.poidKey);
    if (!dbHits || dbHits.length === 0) continue;
    for (const it of dbHits) {
      const newNaver = x.settledYmd ? kstYmdToUtcIso(x.settledYmd) : null;
      const isProtected = !!it.engineer_settled_at;
      updates.push({
        id: it.id,
        newNaverSettled: newNaver,
        newNetAmount: x.net,
        isProtected,
        oldRow: {
          id: it.id,
          naver_settled_at: it.naver_settled_at,
          net_amount: it.net_amount,
          engineer_settled_at: it.engineer_settled_at,
        },
      });
    }
  }
  console.log(`\n=== 측측 계획 ===`);
  console.log(`  매칭 측 측측 측측: ${updates.length}측`);
  console.log(`  · 측측 (engineer_settled NOT NULL): ${updates.filter(u => u.isProtected).length}측 (net 측측 X, naver만)`);
  console.log(`  · 미보호: ${updates.filter(u => !u.isProtected).length}측 (naver + net 측측)`);

  if (updates.length === 0) {
    console.log("측측 측측 측측측. 측측측.");
    return;
  }

  // ── 4) 백업 ───────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const backupPath = path.join(PROJ_ROOT, "backups", `usoln-net-backfill-${today}.json`);
  const backupData = {
    createdAt: new Date().toISOString(),
    note: "naver_settled_at + net_amount 백필 측측 측측. 측측: backfill-naver-net.cjs.",
    matched: updates.length,
    rows: updates.map(u => u.oldRow),
  };
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf8");
  console.log(`\n📦 백업 측측: ${backupPath} (${updates.length}측)`);

  // ── 5) 측측 측측 ──────────────────────────────────────
  console.log(`\n=== 측측 측측 측측 (per-item) ===`);
  let okNaverCnt = 0, okNetCnt = 0, errCnt = 0;
  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    const patch = {};
    if (u.newNaverSettled) patch.naver_settled_at = u.newNaverSettled;
    if (!u.isProtected) patch.net_amount = u.newNetAmount;
    if (Object.keys(patch).length === 0) continue;

    const { error } = await sb.from("task_items").update(patch).eq("id", u.id);
    if (error) {
      errCnt += 1;
      console.error(`  ERR id=${u.id}:`, error.message);
      if (errCnt > 10) { console.error("측측 측측 10 측측 — 측측"); break; }
      continue;
    }
    if (patch.naver_settled_at) okNaverCnt += 1;
    if (patch.net_amount != null) okNetCnt += 1;
    if ((i + 1) % 100 === 0) {
      process.stdout.write(`  ... ${i + 1}/${updates.length}\r`);
    }
  }
  console.log(`\n  측측 결과: naver_settled_at = ${okNaverCnt}측, net_amount = ${okNetCnt}측, error = ${errCnt}측`);

  // ── 6) 측측증 — 측측측 측측·net 합 ─────────────────────
  console.log(`\n=== 측측증 ① 정산주별 측측·net 합 (KST 측측측 키) ===`);
  // 측측 fetch — naver_settled_at NOT NULL 측측 측측
  const verifyAll = [];
  for (let p = 0; p < 30; p++) {
    const { data, error } = await sb.from("task_items")
      .select("id, naver_settled_at, net_amount, is_canceled, tasks!inner(principal_id, status, completed_at)")
      .eq("tasks.principal_id", PID)
      .not("naver_settled_at", "is", null)
      .order("id", { ascending: true })
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    verifyAll.push(...data);
    if (data.length < PAGE) break;
  }
  const activeVerify = verifyAll.filter(it => !it.is_canceled && it.tasks?.status !== "취소");

  const byWeek = {};
  for (const it of activeVerify) {
    const ymd = new Date(new Date(it.naver_settled_at).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const wk = mondayOfKstYmd(ymd);
    if (!byWeek[wk]) byWeek[wk] = { cnt: 0, sumNet: 0 };
    byWeek[wk].cnt += 1;
    byWeek[wk].sumNet += Number(it.net_amount) || 0;
  }
  console.log("─".repeat(98));
  console.log(`  ${"주차 키".padEnd(15)} | ${"표(naver)".padStart(10)} | ${"DB cnt".padStart(7)} | ${"표(weeklyTotal)".padStart(15)} | ${"DB sum net×0.85".padStart(17)}`);
  console.log("─".repeat(98));
  const allKeys = new Set([...Object.keys(TABLE), ...Object.keys(byWeek)]);
  for (const k of [...allKeys].sort()) {
    const t = TABLE[k];
    const b = byWeek[k] || { cnt: 0, sumNet: 0 };
    const wkLbl = t ? t.week : "OUTSIDE";
    const naverCnt = t ? t.naverCount : "—";
    const wTotal   = t ? `₩${t.weeklyTotal.toLocaleString()}` : "—";
    const dbX085 = Math.round(b.sumNet * 0.85);
    const flag = t && b.cnt === t.naverCount ? " ✓" : (t ? " ⚠️" : "");
    console.log(`  ${(k + " " + wkLbl).padEnd(15)} | ${String(naverCnt).padStart(10)} | ${String(b.cnt).padStart(7)} | ${wTotal.padStart(15)} | ₩${dbX085.toLocaleString().padStart(16)}${flag}`);
  }

  // ── 7) 측측증 ② 5월 작업 1차 측측 (순이익 측측) ────────
  console.log(`\n=== 측측증 ② 5월 작업 1차 측측 (순이익 측측) ===`);
  // 5월 작업 = task.completed_at 5월 KST + status=완료.
  const MAY_S = new Date(Date.UTC(2026, 3, 30, 15, 0, 0)).toISOString();  // KST 5/1 00:00
  const MAY_E = new Date(Date.UTC(2026, 4, 31, 15, 0, 0)).toISOString();  // KST 6/1 00:00
  const { data: mayTasks } = await sb.from("tasks")
    .select("id, task_no")
    .eq("tenant_id", "11111111-1111-1111-1111-111111111111")
    .eq("principal_id", PID)
    .eq("status", "완료")
    .gte("completed_at", MAY_S).lt("completed_at", MAY_E);
  const mayTaskIds = (mayTasks || []).map(t => t.id);
  console.log(`  5월 완료 tasks: ${mayTaskIds.length}측`);

  // 측측 task_items
  const mayItems = [];
  for (let i = 0; i < mayTaskIds.length; i += 200) {
    const chunk = mayTaskIds.slice(i, i + 200);
    const { data } = await sb.from("task_items")
      .select("id, task_id, naver_settled_at, engineer_settled_at, is_canceled, net_amount")
      .in("task_id", chunk);
    if (data) mayItems.push(...data);
  }
  const mayActive = mayItems.filter(it => !it.is_canceled);

  // RPC compute_engineer_amount_per_item_batch
  const engBy = new Map();
  for (let i = 0; i < mayTaskIds.length; i += 200) {
    const { data } = await sb.rpc("compute_engineer_amount_per_item_batch", { p_task_ids: mayTaskIds.slice(i, i + 200) });
    if (Array.isArray(data)) for (const r of data) engBy.set(r.task_item_id, Number(r.engineer_amount) || 0);
  }

  let first = 0, second = 0, done1 = 0, done2 = 0;
  let firstCnt = 0, secondCnt = 0;
  for (const it of mayActive) {
    const amt = engBy.get(it.id) || 0;
    if (it.engineer_settled_at) {
      if (it.naver_settled_at) done1 += amt; else done2 += amt;
    } else if (it.naver_settled_at) { first += amt; firstCnt += 1; }
    else { second += amt; secondCnt += 1; }
  }
  const naverConfirmed = first + done1;  // 1차 모집단 (회사 실입금 측측 측측)
  const COMPANY_NET_MAY = 52_319_693;
  const profit = COMPANY_NET_MAY - naverConfirmed;

  console.log(`  활성 task_items: ${mayActive.length}측`);
  console.log(`  · 1차 (naver_settled, 미지급): ${firstCnt}측 / ₩${first.toLocaleString()}`);
  console.log(`  · 2차 (미정산, 미지급): ${secondCnt}측 / ₩${second.toLocaleString()}`);
  console.log(`  · 받음 (이미 지급): ₩${(done1 + done2).toLocaleString()}`);
  console.log(`  · naverConfirmed (1차 모집단): ₩${naverConfirmed.toLocaleString()}`);
  console.log(`  · 회사 실입금 (5월 시트 측측): ₩${COMPANY_NET_MAY.toLocaleString()}`);
  console.log(`  · 순이익 = ${COMPANY_NET_MAY.toLocaleString()} − ${naverConfirmed.toLocaleString()} = ₩${profit.toLocaleString()}`);
  console.log(`  · 측 측측 (₩5,125,916) 측측: ${profit > 5125916 ? "+" : ""}₩${(profit - 5125916).toLocaleString()}`);
})();

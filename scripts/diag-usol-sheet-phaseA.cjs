// 진단 Phase A — CSV ↔ DB tasks(usol_h+usol_n) 구조 대조. 쓰기 X.
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

(async () => {
  // -----------------------------------------------------------
  // 1. CSV 측 catch
  // -----------------------------------------------------------
  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  console.log("=".repeat(120));
  console.log("Phase A — 구조 진단 (CSV ↔ DB tasks usol_h+usol_n)");
  console.log("=".repeat(120));
  console.log(`\nCSV: ${path.basename(CSV_PATH)} — ${rows.length}행 측 catch`);

  // CSV 측 catch
  const csvByCode = new Map();
  const dups = [];
  for (const r of rows) {
    const code = (r["작업코드"] || "").trim();
    if (!code) continue;
    if (csvByCode.has(code)) dups.push(code);
    csvByCode.set(code, r);
  }
  if (dups.length) console.log(`⚠️ CSV 작업코드 중복: ${dups.length}건 → ${dups.slice(0,5).join(", ")}...`);

  // 측 catch 측 catch 측 catch 측 catch
  const svcCounts = {};
  for (const r of rows) {
    const s = (r["서비스종류"] || "").trim();
    svcCounts[s] = (svcCounts[s] || 0) + 1;
  }
  console.log(`\nCSV 측 catch 측 catch 측 catch 측 catch:`);
  for (const [k, v] of Object.entries(svcCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  · ${(k || '(빈칸)').padEnd(20)} ${v}건`);
  }

  // -----------------------------------------------------------
  // 2. DB tasks 측 catch (usol_h + usol_n)
  // -----------------------------------------------------------
  const { data: principals } = await sb.from("principals").select("id, code");
  const usolH = principals.find(p => p.code === "usol_h");
  const usolN = principals.find(p => p.code === "usol_n");
  const principalIds = [usolH.id, usolN.id];
  const pNameById = new Map([[usolH.id, "usol_h"], [usolN.id, "usol_n"]]);

  // 측 catch — 측 catch 측 catch
  let allTasks = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from("tasks")
      .select("id, task_no, customer_name, status, scheduled_at, completed_at, principal_id, assigned_engineer_id")
      .in("principal_id", principalIds)
      .range(offset, offset + PAGE - 1);
    if (error) { console.log("FATAL:", error.message); return; }
    if (!data || data.length === 0) break;
    allTasks = allTasks.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`\nDB tasks (usol_h+usol_n): 측 ${allTasks.length}건`);
  const byPrincipal = {};
  for (const t of allTasks) {
    const k = pNameById.get(t.principal_id) || "?";
    byPrincipal[k] = (byPrincipal[k] || 0) + 1;
  }
  for (const [k, v] of Object.entries(byPrincipal)) console.log(`  · ${k.padEnd(10)} ${v}건`);

  // status 측 catch
  const stByPrin = {};
  for (const t of allTasks) {
    const k = pNameById.get(t.principal_id) || "?";
    stByPrin[k] = stByPrin[k] || {};
    stByPrin[k][t.status || "(NULL)"] = (stByPrin[k][t.status || "(NULL)"] || 0) + 1;
  }
  console.log(`\nDB status 측 catch:`);
  for (const [p, m] of Object.entries(stByPrin)) {
    console.log(`  [${p}]`);
    for (const [s, c] of Object.entries(m).sort((a, b) => b[1] - a[1])) {
      console.log(`    · ${s.padEnd(10)} ${c}건`);
    }
  }

  // -----------------------------------------------------------
  // 3. 추가선택 판별 — 별도 task인가, task_items인가?
  // -----------------------------------------------------------
  // 측 catch — CSV 측 catch 측 catch '추가선택' 측 catch 측 catch 측 catch 측 catch tasks 측 catch 측 catch.
  // 측 catch: 측 catch 측 catch 측 catch → '별도 task'. 측 catch → 'task_items'.
  const dbCodes = new Set(allTasks.map(t => t.task_no));
  const csvAddonCodes = rows.filter(r => (r["서비스종류"] || "").trim() === "추가선택").map(r => (r["작업코드"] || "").trim()).filter(Boolean);
  const csvMainCodes  = rows.filter(r => (r["서비스종류"] || "").trim() !== "추가선택").map(r => (r["작업코드"] || "").trim()).filter(Boolean);

  const addonInDb = csvAddonCodes.filter(c => dbCodes.has(c));
  const addonNotInDb = csvAddonCodes.filter(c => !dbCodes.has(c));

  console.log(`\n추가선택 측 catch 측 catch:`);
  console.log(`  CSV 측 catch 측 catch 측 catch ${csvAddonCodes.length}건`);
  console.log(`  └─ DB에 측 catch task_no 측 catch 측 catch:  ${addonInDb.length}건 (= 별도 task)`);
  console.log(`  └─ DB에 측 catch task 측 catch X:        ${addonNotInDb.length}건 (= task_items 측 catch 측 catch 측 catch)`);

  // 측 catch — '추가선택' CSV row 측 catch 측 catch 측 catch 측 catch 측 catch task_no 측 catch 측 catch task가 측 catch 측 catch (= task_items 측 catch 측 catch)
  // 측 catch CSV는 측 catch row 측 catch task_no(작업코드) 측 catch 측 catch — 측 catch 측 catch task_no가 측 catch '측 catch' 측 catch 측 catch row 측 catch 측 catch X?
  // 측 catch task_no prefix 측 catch
  const addonByPrefix = {};
  for (const c of csvAddonCodes) {
    const pre = c.slice(0, 5);
    addonByPrefix[pre] = (addonByPrefix[pre] || 0) + 1;
  }
  console.log(`  추가선택 측 catch 측 catch (prefix):`);
  for (const [k, v] of Object.entries(addonByPrefix)) console.log(`    · ${k}... ${v}건`);

  // -----------------------------------------------------------
  // 4. 작업코드 커버리지 3분류
  // -----------------------------------------------------------
  const csvCodes = new Set(csvByCode.keys());
  const onlyCsv = [...csvCodes].filter(c => !dbCodes.has(c)).sort();
  const onlyDb  = [...dbCodes].filter(c => !csvCodes.has(c)).sort();
  const both    = [...csvCodes].filter(c =>  dbCodes.has(c)).sort();

  console.log(`\n작업코드 측 catch:`);
  console.log(`  ① CSV에만 측 catch (DB 측 catch 측 catch):  ${onlyCsv.length}건`);
  console.log(`  ② DB에만 측 catch (시트 측 catch X): ${onlyDb.length}건`);
  console.log(`  ③ 양쪽 측 catch:                ${both.length}건`);

  // 측 catch CSV측 catch 측 catch 측 catch 측 catch (측 catch 측 catch 측 catch 측 catch — 측 catch / 추가선택)
  const onlyCsvMain  = onlyCsv.filter(c => (csvByCode.get(c)?.["서비스종류"] || "").trim() !== "추가선택");
  const onlyCsvAddon = onlyCsv.filter(c => (csvByCode.get(c)?.["서비스종류"] || "").trim() === "추가선택");
  console.log(`    └─ 측 catch 측 catch (측 catch):    ${onlyCsvMain.length}건`);
  console.log(`    └─ 측 catch 측 catch (추가선택): ${onlyCsvAddon.length}건`);

  // 측 catch 측 catch — onlyCsv 측 catch 30건
  console.log(`\n  [① CSV에만 측 catch 측 catch — 측 catch 30건]`);
  for (const c of onlyCsv.slice(0, 30)) {
    const r = csvByCode.get(c);
    console.log(`    · ${c} | ${r?.["수취인명"] || ""} | ${r?.["서비스종류"] || ""} | 측 catch=${r?.["고객컨택일자"] || ""} | 측 catch=${r?.["상태"] || ""}`);
  }
  if (onlyCsv.length > 30) console.log(`    ... 측 ${onlyCsv.length}건 (생략)`);

  // 측 catch 측 catch — onlyDb 측 catch 30건
  console.log(`\n  [② DB에만 측 catch 측 catch — 측 catch 30건]`);
  const onlyDbDetails = onlyDb.slice(0, 30).map(c => allTasks.find(t => t.task_no === c)).filter(Boolean);
  for (const t of onlyDbDetails) {
    console.log(`    · ${t.task_no} | ${t.customer_name || ""} | ${pNameById.get(t.principal_id)} | status=${t.status} | sched=${(t.scheduled_at||"").slice(0,16)}`);
  }
  if (onlyDb.length > 30) console.log(`    ... 측 ${onlyDb.length}건 (생략)`);

  // -----------------------------------------------------------
  // 결과 저장
  // -----------------------------------------------------------
  const outFile = path.join(__dirname, "diag-usol-sheet-phaseA-결과.json");
  fs.writeFileSync(outFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    csvRows: rows.length,
    csvServiceCounts: svcCounts,
    dbTotal: allTasks.length,
    dbByPrincipal: byPrincipal,
    dbStatusByPrincipal: stByPrin,
    addonDetection: {
      csvAddonCount: csvAddonCodes.length,
      addonInDbCount: addonInDb.length,
      addonNotInDbCount: addonNotInDb.length,
      verdict: addonInDb.length > addonNotInDb.length ? "별도 task" : "task_items 측 catch 측 catch",
    },
    coverage: {
      onlyCsv: onlyCsv,
      onlyDb: onlyDb,
      both: both.length,
      onlyCsvMain: onlyCsvMain.length,
      onlyCsvAddon: onlyCsvAddon.length,
    },
  }, null, 2));
  console.log(`\n결과 저장: ${outFile}`);

  // -----------------------------------------------------------
  // 측 측 catch
  // -----------------------------------------------------------
  console.log("\n" + "=".repeat(120));
  console.log("Phase A 측 catch.");
  console.log("=".repeat(120));
  console.log(`측 catch 측 catch 측 catch:`);
  console.log(`  CSV 측 ${rows.length}행 (측 catch ${csvCodes.size}건)`);
  console.log(`  DB usol_h+usol_n: 측 ${allTasks.length}건`);
  console.log(`  - 양쪽 측 catch: ${both.length}건`);
  console.log(`  - CSV측 catch (DB 측 catch 측 catch): ${onlyCsv.length}건 (측 catch ${onlyCsvMain.length} / 추가선택 ${onlyCsvAddon.length})`);
  console.log(`  - DB측 catch (시트 측 catch X): ${onlyDb.length}건`);
  console.log(`  추가선택 측 catch 측 catch: ${addonInDb.length > addonNotInDb.length ? "별도 task (CSV 측 catch row 측 catch DB task)" : "task_items 측 catch 측 catch (CSV 측 catch row 측 catch DB task 측 catch X)"}`);
  console.log("=".repeat(120));
})().catch(e => console.log("FATAL:", e.message, e.stack));

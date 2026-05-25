// 진단 — category_data.workItems 키 보유 task 카운트 + 안효정 task 확인
// 2026-05-25 (read-only)

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
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function bar(c = "═", n = 100) { return c.repeat(n); }
function sub(s) { console.log("\n" + bar("─")); console.log(s); console.log(bar("─")); }

(async () => {
  console.log(bar());
  console.log("진단 — category_data.workItems 키 보유 task 카운트");
  console.log(bar());

  // 1) 전체 tasks 카운트
  const { count: total } = await sb.from("tasks").select("id", { count: "exact", head: true });
  console.log(`\n총 tasks: ${total ?? "?"}건`);

  // 2) category_data.workItems 키 보유 — PostgREST 측 jsonb '?' 연산자 호출 불가.
  //    대신 cd 행 측 페치 후 client 측 키 존재 검사. 데이터 양 크니 페이지 루프.
  sub("[1] 페이지 루프 — category_data 페치 후 workItems 키 보유 카운트");
  const PAGE = 1000;
  let offset = 0;
  let scanned = 0, hasKey = 0, anhjFound = null;
  const samples = [];

  while (true) {
    const { data, error } = await sb.from("tasks")
      .select("id, task_no, customer_name, status, category_data")
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) { console.log("페치 오류:", error.message); break; }
    if (!data || data.length === 0) break;
    for (const t of data) {
      scanned++;
      const cd = t.category_data;
      const has = cd && typeof cd === "object" && Object.prototype.hasOwnProperty.call(cd, "workItems");
      if (has) {
        hasKey++;
        if (samples.length < 10) {
          const wi = cd.workItems;
          samples.push({
            task_no: t.task_no,
            customer: t.customer_name,
            status: t.status,
            workItems_type: Array.isArray(wi) ? `array(${wi.length})` : typeof wi,
            keys: Object.keys(cd).join(","),
          });
        }
      }
      if (t.task_no === "YS-260517-079") {
        anhjFound = {
          task_no: t.task_no,
          customer_name: t.customer_name,
          category_data_keys: cd ? Object.keys(cd) : [],
          has_workItems_key: has,
          category_data_full: cd,
        };
      }
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  console.log(`  스캔 ${scanned}건 / workItems 키 보유 ${hasKey}건`);
  if (samples.length > 0) {
    console.log(`\n  샘플 (최대 10건):`);
    samples.forEach(s => {
      console.log(`    · ${s.task_no} | ${s.customer} | ${s.status} | workItems=${s.workItems_type} | cd keys=${s.keys}`);
    });
  }

  // 3) 안효정 명시
  sub("[2] 안효정 YS-260517-079 — workItems 키 존재 여부");
  if (!anhjFound) {
    console.log("  안효정 task 미발견");
  } else {
    console.log(`  task_no: ${anhjFound.task_no} / customer: ${anhjFound.customer_name}`);
    console.log(`  category_data keys: ${JSON.stringify(anhjFound.category_data_keys)}`);
    console.log(`  has workItems key : ${anhjFound.has_workItems_key ? "★ 예 (sync 발화 위험)" : "아니오 (sync RETURN — 안전)"}`);
    console.log(`  category_data full: ${JSON.stringify(anhjFound.category_data_full)}`);
  }

  // 4) workItems 키 보유 task — 원청별 카운트 (위험 분포)
  sub("[3] workItems 키 보유 task — 원청별 카운트 (위험 분포)");
  if (hasKey === 0) {
    console.log("  키 보유 0건 — 시나리오 B 발생 불가. 070 현 설계 안전.");
  } else {
    // 위 페이지 루프에서 principal_id 누락 — 별도 조회는 부담. 위 samples 만 보고.
    console.log(`  키 보유 ${hasKey}건. 위 샘플 참조 — 운영 위험도 평가용.`);
  }

  // 5) workItems 키 보유 + qty=0 행 보유 task (직접 위험 — 백필 시 즉시 영향)
  sub("[4] workItems 키 보유 + qty=0 task_items 행 보유 task (직접 영향)");
  const { data: zeroItems } = await sb.from("task_items").select("task_id, qty").eq("qty", 0);
  const zeroIds = new Set((zeroItems || []).map(r => r.task_id));
  let directRisk = 0;
  // 위 페이지 루프 결과를 재활용하기엔 메모리 — 별도 조회.
  if (zeroIds.size > 0) {
    const { data: tcheck } = await sb.from("tasks")
      .select("id, task_no, customer_name, category_data")
      .in("id", [...zeroIds]);
    (tcheck || []).forEach(t => {
      const cd = t.category_data;
      const has = cd && typeof cd === "object" && Object.prototype.hasOwnProperty.call(cd, "workItems");
      console.log(`  · ${t.task_no} | ${t.customer_name} | workItems 키 ${has ? "★있음" : "없음"}`);
      if (has) directRisk++;
    });
  }
  console.log(`  → 직접 위험 ${directRisk}건 (백필 시 sync 발화 → is_canceled 소실 위험).`);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });

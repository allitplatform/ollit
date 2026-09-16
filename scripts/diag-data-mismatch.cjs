// 진단 — 운영 실제 vs DB 측 catch 측 catch
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

// 대상 list — { 기사, 고객, 사장님 확인값 }
const TARGETS = [
  { eng: "김경호", cust: "이미경",   note: "5/16 — 앱 없음" },
  { eng: "김경호", cust: "임수민",   note: "5/22 — 실 완료 / 앱 확정" },
  { eng: "김경호", cust: "공영미",   note: "실 5/27 / 앱 5/31" },
  { eng: "권창용", cust: "유지은",   note: "5/22 — 실 완료 / 앱 확정" },
  { eng: "김동효", cust: "손원주",   note: "실 5/18 완료 / 앱 5/4" },
  { eng: "김동효", cust: "한인규",   note: "5/6 — 앱 없음" },
  { eng: "김병철", cust: "최민희",   note: "실 5/4 / 앱 5/3" },
  { eng: "김영수", cust: "오아름",   note: "5/22 — 앱 없음" },
  { eng: "김영수", cust: "김주현",   note: "5/23 — 실 완료 / 앱 확정" },
  { eng: "김영수", cust: "김시윤",   note: "실 5/18 완료 / 앱 5/29" },
  { eng: "김윤섭", cust: "강유미",   note: "취소" },
  { eng: "김윤섭", cust: "박정훈",   note: "5/21 — 벽걸이 추가" },
  { eng: "김윤섭", cust: "양재훈",   note: "5/23 — 앱 없음" },
  { eng: "양승문", cust: "유은진",   note: "5/26 — 앱 없음" },
  { eng: "양승문", cust: "윤지영",   note: "5/27 — 취소" },
  { eng: "이상준", cust: "조윤형",   note: "5/21 — 확정→완료" },
  { eng: "이상준", cust: "황수연",   note: "5/31 / 실 5/9 완료" },
  { eng: "이상준", cust: "김하진",   note: "5/31 / 실 5/9 완료" },
  { eng: "임종일", cust: "강주희",   note: "5/4 — 앱 없음" },
  { eng: "임종일", cust: "손동원",   note: "5/17 — 앱 없음" },
  { eng: "임종일", cust: "이서현",   note: "5/19 — 앱 없음" },
  { eng: "임종일", cust: "이영수",   note: "5/25 — 앱 없음" },
  { eng: "임종일", cust: "박병국",   note: "5/23 — 완료로 측 catch" },
  { eng: null,     cust: "이지은",   note: "5/13 → 5/31 09:00" },
  { eng: "정훈",   cust: "홍순택",   note: "5/13 11:00 — 완료 추가" },
  { eng: "정훈",   cust: "김복주",   note: "5/25 16:30 — 확정 추가" },
  { eng: "정훈",   cust: "주상은",   note: "5/31 → 6/1" },
  { eng: "정훈",   cust: "김호연",   note: "5/31 → 6/1" },
  { eng: "정훈",   cust: "김종윤",   note: "5/31 → 6/2" },
  { eng: null,     cust: "황우현",   note: "5/9 — 2대 중 1대 취소" },
];

const norm = (v) => v == null ? "" : String(v).trim();

(async () => {
  // 기사 lookup — name → id
  const { data: users } = await sb.from("users").select("id, name").eq("tenant_id", "11111111-1111-1111-1111-111111111111");
  const userIdByName = new Map((users || []).map(u => [norm(u.name), u.id]));
  const userNameById = new Map((users || []).map(u => [u.id, u.name]));

  // 측 target에 대해 tasks 측 catch
  const rows = [];
  for (const t of TARGETS) {
    let q = sb.from("tasks").select("task_no, customer_name, status, scheduled_at, completed_at, assigned_engineer_id, principal_id");
    q = q.eq("tenant_id", "11111111-1111-1111-1111-111111111111");
    q = q.ilike("customer_name", `%${t.cust}%`);
    if (t.eng) {
      const uid = userIdByName.get(t.eng);
      if (uid) q = q.eq("assigned_engineer_id", uid);
    }
    const { data } = await q;
    rows.push({ target: t, matches: data || [] });
  }

  // 출력
  console.log("=".repeat(140));
  console.log(`${"기사".padEnd(8)} ${"고객".padEnd(10)} ${"사장님 확인".padEnd(28)} | ${"task_no".padEnd(20)} ${"DB 측 catch".padEnd(8)} ${"DB scheduled".padEnd(28)} ${"DB completed".padEnd(28)} | 매칭`);
  console.log("=".repeat(140));
  for (const r of rows) {
    const { target, matches } = r;
    const engLabel = (target.eng || "—").padEnd(8);
    const custLabel = target.cust.padEnd(10);
    const noteLabel = target.note.padEnd(28);
    if (matches.length === 0) {
      console.log(`${engLabel} ${custLabel} ${noteLabel} | ${"(DB 없음)".padEnd(20)} ${"".padEnd(8)} ${"".padEnd(28)} ${"".padEnd(28)} | ❌`);
    } else if (matches.length === 1) {
      const m = matches[0];
      const eName = m.assigned_engineer_id ? (userNameById.get(m.assigned_engineer_id) || "") : "—";
      const engCheck = target.eng && eName !== target.eng ? `⚠️기사=${eName}` : "";
      console.log(`${engLabel} ${custLabel} ${noteLabel} | ${(m.task_no || "").padEnd(20)} ${(m.status || "").padEnd(8)} ${(m.scheduled_at || "(N)").slice(0, 19).padEnd(28)} ${(m.completed_at || "(N)").slice(0, 19).padEnd(28)} | ✅ ${engCheck}`);
    } else {
      console.log(`${engLabel} ${custLabel} ${noteLabel} | (다중 매칭 ${matches.length}건):`);
      for (const m of matches) {
        const eName = m.assigned_engineer_id ? (userNameById.get(m.assigned_engineer_id) || "") : "—";
        console.log(`${"".padEnd(8)} ${"".padEnd(10)} ${"".padEnd(28)} |   · ${(m.task_no || "").padEnd(18)} ${(m.status || "").padEnd(8)} sched=${(m.scheduled_at || "(N)").slice(0, 19)} comp=${(m.completed_at || "(N)").slice(0, 19)} | 기사=${eName}`);
      }
    }
  }

  console.log("\n진단 완료.");
})().catch(e => console.log("FATAL:", e.message, e.stack));

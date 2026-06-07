// 측측→회사 측측 측측측 측측 입금완료 (오늘 측측)
//   백업 → 드라이런 → APPLY (--apply)
//   복구: scripts/revert-engineer-confirm-all-past.cjs (백업 JSON 측측 측측 복구)
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();
const APPLY = process.argv.includes("--apply");
function toKstYmd(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date(d));
}

(async () => {
  const today = toKstYmd(new Date());
  console.log(`\n=== 측측→회사 측측 측측 측측 (${APPLY ? "APPLY" : "DRY-RUN"}) — 오늘 ${today} 측측 ===\n`);

  // 측측 측측측 (페이지측측측측)
  const PAGE = 1000;
  let rows = [];
  for (let page = 0; page < 20; page++) {
    const off = page * PAGE;
    const { data, error } = await sb.from("tasks")
      .select(`id, task_no, status, completed_at, assigned_engineer_id,
               assigned_engineer:users!assigned_engineer_id(name, code),
               payments(task_id, track, engineer_remitted_at, engineer_remit_confirmed_at, engineer_remit_confirmed_by, engineer_amount)`)
      .in("status", ["완료", "정산완료"])
      .order("completed_at", { ascending: false })
      .range(off, off + PAGE - 1);
    if (error) { console.error("측측 측측:", error); process.exit(1); }
    if (!data || data.length === 0) break;
    rows = rows.concat(data);
    if (data.length < PAGE) break;
  }

  // 측측: Track A, confirmed 측측, completed < today, visit_only 측측 (이미 status 측측 측측)
  const eligible = rows.filter(r => {
    const p = Array.isArray(r.payments) ? r.payments[0] : r.payments;
    if ((p?.track || "A") !== "A") return false;
    if (p?.engineer_remit_confirmed_at) return false;
    if (!r.completed_at) return false;
    const kst = toKstYmd(r.completed_at);
    if (!kst || kst >= today) return false;
    return true;
  });

  const pendingList = eligible.filter(r => {
    const p = Array.isArray(r.payments) ? r.payments[0] : r.payments;
    return !p?.engineer_remitted_at;
  });
  const reportedList = eligible.filter(r => {
    const p = Array.isArray(r.payments) ? r.payments[0] : r.payments;
    return !!p?.engineer_remitted_at;
  });

  console.log(`측측: 측측 ${eligible.length}건 (pending ${pendingList.length} + reported ${reportedList.length})`);

  // actor — A003 운영자
  const { data: opUser } = await sb.from("users").select("id, code, name").eq("code","A003").maybeSingle();
  if (!opUser) { console.error("A003 운영자 측측 측측"); process.exit(1); }
  const ACTOR = opUser.id;
  console.log(`actor: ${opUser.name} (${opUser.code}) id=${ACTOR}`);

  // 백업 (BEFORE 측측)
  const backup = eligible.map(r => {
    const p = Array.isArray(r.payments) ? r.payments[0] : r.payments;
    return {
      task_id: r.id,
      task_no: r.task_no,
      engineer_name: r.assigned_engineer?.name,
      engineer_code: r.assigned_engineer?.code,
      engineer_amount: Number(p?.engineer_amount) || 0,
      before: {
        engineer_remitted_at:         p?.engineer_remitted_at || null,
        engineer_remit_confirmed_at:  p?.engineer_remit_confirmed_at || null,
        engineer_remit_confirmed_by:  p?.engineer_remit_confirmed_by || null,
      },
      classified_as: p?.engineer_remitted_at ? "reported" : "pending",
    };
  });

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const backupPath = path.join(dataDir, `engineer-confirm-all-past-backup-${ts}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({
    backup_at: new Date().toISOString(),
    today_kst: today,
    actor_id: ACTOR,
    actor_name: opUser.name,
    eligible_count: eligible.length,
    items: backup,
  }, null, 2), "utf8");
  console.log(`✓ 백업: ${backupPath}`);

  // 드라이런 측측 (측측 측측)
  console.log("\n=== 측측 측측 (BEFORE) ===");
  for (const b of backup) {
    console.log(`  ${b.task_no.padEnd(18)} ${b.classified_as.padEnd(8)} ${b.engineer_code.padEnd(5)} ${(b.engineer_name||"?").padEnd(10)} eng=${fmt(b.engineer_amount).padStart(9)}원  remitted=${b.before.engineer_remitted_at?.slice(0,16) || "—"}  confirmed=${b.before.engineer_remit_confirmed_at?.slice(0,16) || "—"}`);
  }

  if (!APPLY) {
    console.log("\n=== 측측 측측 측측 (DRY-RUN) ===");
    console.log(`  pending 21건 → engineer_remitted_at + confirmed_at + confirmed_by 측 측 측측`);
    console.log(`  reported 1건 → confirmed_at + confirmed_by 측측 측측`);
    console.log(`  분배 측측 (engineer/owner/principal) 측측 측측 X`);
    console.log("\n--apply 측측 측측 측측");
    return;
  }

  // ===== APPLY =====
  console.log("\n=== APPLY ===");
  const nowIso = new Date().toISOString();

  // 1) pending 측측측 측 측측 UPDATE — engineer_remitted_at + confirmed_at + confirmed_by
  if (pendingList.length > 0) {
    const pendingIds = pendingList.map(r => r.id);
    const { error } = await sb.from("payments")
      .update({
        engineer_remitted_at:        nowIso,
        engineer_remit_confirmed_at: nowIso,
        engineer_remit_confirmed_by: ACTOR,
      })
      .in("task_id", pendingIds);
    if (error) { console.error("pending UPDATE 측측:", error); process.exit(1); }
    console.log(`  ✓ pending ${pendingList.length}건 — remitted_at + confirmed_at + by 측 측측`);
  }

  // 2) reported 측측 — confirmed_at + by 측 측측 (remitted_at 측측 측측)
  if (reportedList.length > 0) {
    const reportedIds = reportedList.map(r => r.id);
    const { error } = await sb.from("payments")
      .update({
        engineer_remit_confirmed_at: nowIso,
        engineer_remit_confirmed_by: ACTOR,
      })
      .in("task_id", reportedIds);
    if (error) { console.error("reported UPDATE 측측:", error); process.exit(1); }
    console.log(`  ✓ reported ${reportedList.length}건 — confirmed_at + by 측측`);
  }

  // ===== VERIFY =====
  console.log("\n=== VERIFY ===");
  const allIds = eligible.map(r => r.id);
  const { data: afterPayments } = await sb.from("payments")
    .select("task_id, engineer_remitted_at, engineer_remit_confirmed_at, engineer_remit_confirmed_by")
    .in("task_id", allIds);
  let confirmedCount = 0, problemCount = 0;
  for (const p of (afterPayments||[])) {
    if (p.engineer_remit_confirmed_at && p.engineer_remit_confirmed_by) confirmedCount++;
    else problemCount++;
  }
  console.log(`  측측 confirmed: ${confirmedCount}/${eligible.length}`);
  if (problemCount > 0) {
    console.log(`  ⚠️ 측측 측측 ${problemCount}건`);
  } else {
    console.log(`  ✓ 측측측 통과 — 측측 ${eligible.length}건 모두 confirmed 측측`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });

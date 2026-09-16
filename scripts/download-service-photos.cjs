// 홈페이지용 냉매충전 / 수리 작업 사진 다운로드.
// 2026-06-22.
//   · 대상: status='완료' + service_types.code IN ('refrigerant', 'repair').
//   · photos step 짝 안 따짐 — 작업의 모든 사진 받음.
//   · 각 service 별 최근순 30건. 파일명: {task_no}_1.{ext}, _2.{ext} ...
//   · 출력: ./hero_photos_refrig/ (냉매), ./hero_photos_repair/ (수리).

const fs   = require("fs");
const path = require("path");

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
const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "task-photos";
const CHUNK = 200;
const MAX_TASKS = 30;

const PLAN = [
  { code: "refrigerant", out: path.join(__dirname, "..", "hero_photos_refrig") },
  { code: "repair",      out: path.join(__dirname, "..", "hero_photos_repair") },
];

if (!SB_URL || !SB_KEY) {
  console.error("env 미설정 (SUPABASE_URL / SERVICE_ROLE_KEY)");
  process.exit(1);
}

const sb = createClient(SB_URL, SB_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function safeFilename(s) {
  return String(s || "").replace(/[^a-zA-Z0-9가-힣_-]/g, "_");
}

async function processService(code, outDir) {
  console.log(`\n===== service_type code='${code}' =====`);
  fs.mkdirSync(outDir, { recursive: true });

  // 1) task_items 측 code 매칭 task_id 추출
  const { data: items, error: e1 } = await sb
    .from("task_items")
    .select("task_id, work_types!inner(service_types!inner(code))")
    .eq("work_types.service_types.code", code)
    .limit(5000);
  if (e1) { console.error(`ERR(items ${code}):`, e1.message); return; }
  const ids = [...new Set((items || []).map(r => r.task_id).filter(Boolean))];
  console.log(`  [1] ${code} task ${ids.length}건`);
  if (ids.length === 0) return;

  // 2) 완료 + 최근순
  const tasks = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("tasks")
      .select("id, task_no, completed_at")
      .in("id", part)
      .eq("status", "완료")
      .order("completed_at", { ascending: false });
    if (error) { console.error(`ERR(tasks ${code}):`, error.message); return; }
    tasks.push(...(data || []));
  }
  tasks.sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)));
  const top = tasks.slice(0, 100); // photos 검사 전 후보 100건
  console.log(`  [2] 완료 ${tasks.length}건 (후보 ${top.length}건)`);

  // 3) photos 조회 — 1장 이상 있는 task만
  const topIds = top.map(t => t.id);
  const photos = [];
  for (let i = 0; i < topIds.length; i += CHUNK) {
    const part = topIds.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("photos")
      .select("task_id, step, storage_path, uploaded_at")
      .in("task_id", part)
      .order("uploaded_at", { ascending: true });
    if (error) { console.error(`ERR(photos ${code}):`, error.message); return; }
    photos.push(...(data || []));
  }

  const byTask = new Map();
  for (const p of photos) {
    if (!byTask.has(p.task_id)) byTask.set(p.task_id, []);
    byTask.get(p.task_id).push(p);
  }

  const eligible = [];
  for (const t of top) {
    const list = byTask.get(t.id);
    if (list && list.length > 0) {
      eligible.push({ task: t, photos: list });
    }
    if (eligible.length >= MAX_TASKS) break;
  }
  console.log(`  [3] 사진 보유 ${eligible.length}건 (목표 ${MAX_TASKS})`);

  // 4) 다운로드 — 각 task 별 _1, _2, ...
  console.log(`  [4] 다운로드 → ${outDir}`);
  let taskOk = 0, fileOk = 0, fileFail = 0;
  for (const { task, photos: list } of eligible) {
    const taskNo = safeFilename(task.task_no || task.id);
    let anyOk = false;
    for (let i = 0; i < list.length; i++) {
      const ph = list[i];
      const ext = (ph.storage_path.match(/\.([a-zA-Z0-9]+)$/) || [, "jpg"])[1].toLowerCase();
      const dest = path.join(outDir, `${taskNo}_${i + 1}.${ext}`);
      try {
        const { data: blob, error } = await sb.storage.from(BUCKET).download(ph.storage_path);
        if (error || !blob) {
          console.error(`    ✗ ${taskNo}_${i + 1}: ${error?.message || "blob null"}`);
          fileFail++;
          continue;
        }
        const arr = await blob.arrayBuffer();
        fs.writeFileSync(dest, Buffer.from(arr));
        fileOk++;
        anyOk = true;
      } catch (e) {
        console.error(`    ✗ ${taskNo}_${i + 1}: ${e.message}`);
        fileFail++;
      }
    }
    if (anyOk) taskOk++;
  }

  console.log(`  [완료 ${code}] task ${taskOk} / file ${fileOk} ok, ${fileFail} fail`);
}

(async () => {
  for (const { code, out } of PLAN) {
    await processService(code, out);
  }
  console.log("\n[모든 service 완료]");
})().catch(e => {
  console.error("UNHANDLED:", e?.message || e);
  process.exit(1);
});

// 홈페이지용 에어컨 세척 전/후 사진 다운로드.
// 2026-06-22.
//   · 대상: status='완료' + service_types.code='cleaning' (분해세척).
//   · photos 측 step='시작' (before) + step='완료' (after) 둘 다 있는 작업만.
//   · 최근순 최대 50건. 각 작업당 전/후 1장씩 짝지어 저장.
//   · 출력: ./hero_photos/{task_no}_before.{ext} / {task_no}_after.{ext}

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
const OUT_DIR = path.join(__dirname, "..", "hero_photos");
const MAX_TASKS = 50;

if (!SB_URL || !SB_KEY) {
  console.error("env 미설정 (SUPABASE_URL / SERVICE_ROLE_KEY)");
  process.exit(1);
}

const sb = createClient(SB_URL, SB_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function safeFilename(s) {
  return String(s || "").replace(/[^a-zA-Z0-9가-힣_-]/g, "_");
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1) 분해세척 task_id 추출 — service_types.code='cleaning'
  console.log("[1] task_items 측 cleaning task_id 추출");
  const { data: items, error: e1 } = await sb
    .from("task_items")
    .select("task_id, work_types!inner(service_types!inner(code))")
    .eq("work_types.service_types.code", "cleaning")
    .limit(5000);
  if (e1) { console.error("ERR(items):", e1.message); process.exit(1); }
  const cleaningIds = [...new Set((items || []).map(r => r.task_id).filter(Boolean))];
  console.log(`  → cleaning task ${cleaningIds.length}건`);

  if (cleaningIds.length === 0) {
    console.log("cleaning task 없음 — 종료"); return;
  }

  // 2) 완료 상태 + 최근순 — IN 한계 1000건 대응 (chunk)
  console.log("[2] 완료 상태 + 최근순 fetch");
  const CHUNK = 200;
  const tasks = [];
  for (let i = 0; i < cleaningIds.length; i += CHUNK) {
    const part = cleaningIds.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("tasks")
      .select("id, task_no, completed_at, customer_name")
      .in("id", part)
      .eq("status", "완료")
      .order("completed_at", { ascending: false });
    if (error) { console.error("ERR(tasks):", error.message); process.exit(1); }
    tasks.push(...(data || []));
  }
  tasks.sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)));
  const top = tasks.slice(0, 200); // photos 검사 전 후보 200건
  console.log(`  → 완료 task ${tasks.length}건 (후보 상위 ${top.length}건)`);

  // 3) photos 조회 — 시작+완료 둘 다 있는 task 만 통과
  console.log("[3] photos 조회 + 짝 검사");
  const topIds = top.map(t => t.id);
  const photos = [];
  for (let i = 0; i < topIds.length; i += CHUNK) {
    const part = topIds.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("photos")
      .select("task_id, step, storage_path, uploaded_at")
      .in("task_id", part)
      .order("uploaded_at", { ascending: true });
    if (error) { console.error("ERR(photos):", error.message); process.exit(1); }
    photos.push(...(data || []));
  }

  const byTask = new Map();
  for (const p of photos) {
    if (!byTask.has(p.task_id)) byTask.set(p.task_id, { before: [], after: [] });
    const m = byTask.get(p.task_id);
    if (p.step === "시작") m.before.push(p);
    else if (p.step === "완료") m.after.push(p);
  }

  const eligible = [];
  for (const t of top) {
    const m = byTask.get(t.id);
    if (m && m.before.length > 0 && m.after.length > 0) {
      eligible.push({ task: t, before: m.before[0], after: m.after[0] });
    }
    if (eligible.length >= MAX_TASKS) break;
  }
  console.log(`  → 전/후 둘 다 보유 ${eligible.length}건 (목표 ${MAX_TASKS})`);

  if (eligible.length === 0) {
    console.log("대상 작업 없음 — 종료"); return;
  }

  // 4) 다운로드 (Storage .download — service_role)
  console.log(`[4] 다운로드 시작 → ${OUT_DIR}`);
  let pairOk = 0, perFileOk = 0, perFileFail = 0;
  for (const { task, before, after } of eligible) {
    const taskNo = safeFilename(task.task_no || task.id);
    let beforeOk = false, afterOk = false;
    for (const { ph, suffix } of [{ ph: before, suffix: "before" }, { ph: after, suffix: "after" }]) {
      const ext = (ph.storage_path.match(/\.([a-zA-Z0-9]+)$/) || [, "jpg"])[1].toLowerCase();
      const dest = path.join(OUT_DIR, `${taskNo}_${suffix}.${ext}`);
      try {
        const { data: blob, error } = await sb.storage.from(BUCKET).download(ph.storage_path);
        if (error || !blob) {
          console.error(`  ✗ ${taskNo}_${suffix}: ${error?.message || "blob null"}`);
          perFileFail++;
          continue;
        }
        const arr = await blob.arrayBuffer();
        fs.writeFileSync(dest, Buffer.from(arr));
        perFileOk++;
        if (suffix === "before") beforeOk = true; else afterOk = true;
      } catch (e) {
        console.error(`  ✗ ${taskNo}_${suffix}: ${e.message}`);
        perFileFail++;
      }
    }
    if (beforeOk && afterOk) pairOk++;
  }

  console.log(`\n[완료]`);
  console.log(`  · 짝 다운로드 성공: ${pairOk}건 / 후보 ${eligible.length}건`);
  console.log(`  · 파일 단위 성공/실패: ${perFileOk} / ${perFileFail}`);
  console.log(`  · 폴더: ${OUT_DIR}`);
})().catch(e => {
  console.error("UNHANDLED:", e?.message || e);
  process.exit(1);
});

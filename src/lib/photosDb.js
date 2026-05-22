// Phase 4-5 — 사진 업로드 DB 모듈
// Supabase Storage (버킷: task-photos) + photos 테이블 활용.
//
// 매핑:
//   · File → Storage 측 업로드 → public URL + storage_path
//   · photos 테이블 row 박음 (task_id / step / storage_path / uploaded_by)
//
// 경로 패턴: {task_id}/{step}_{timestamp}.{ext}
//   예: "abc-123/완료_20260514T103045.jpg"
//
// 시그니처 호환: 옛 api.js completeTask(taskId, photoBase64Array) 대체.
//   호출처는 base64 변환 박지 X / File 직접 업로드 박음.
//
// RLS: storage.objects + photos 측 anon SELECT/INSERT/DELETE 정책 박혀있어야
//      (대표님 SQL 사전 실행 완료).

import { supabase } from "./supabase.js";

const BUCKET = "task-photos";

// Supabase Storage key 측 — 한글 박지 X 박힘 (Invalid key error)
// 박은 spec 측 — storage_path 측만 영어 박음. DB photos.step 컬럼 측 — 한글 박힘 (UI 호환).
const STEP_TO_EN = {
  "시작":  "before",
  "완료":  "after",
  before:  "before",
  after:   "after",
};

// 파일 확장자 추출 (대소문자 정규화 + fallback)
function _extOf(file) {
  const name = String(file?.name || "").toLowerCase();
  const m = name.match(/\.([a-z0-9]+)$/);
  if (m) return m[1];
  const type = String(file?.type || "").toLowerCase();
  if (type.includes("png"))  return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("heic")) return "heic";
  return "jpg";
}

// 시각 박힌 영역 (파일명 충돌 회피)
function _timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}_${Math.random().toString(36).slice(2, 6)}`;
}

// ============================================================
// uploadPhoto — File 측 Storage 업로드 + photos row 박음
// ============================================================
// 입력: taskId (uuid), file (File 객체), step (string / 예: '완료')
// 선택: uploadedBy (uuid / null 박을 차례)
// 응답: { ok: true, photoId, storage_path, url } | { ok: false, error }
export async function uploadPhoto(taskId, file, step = "완료", uploadedBy = null) {
  if (!taskId) return { ok: false, error: "taskId 없음" };
  if (!file)   return { ok: false, error: "file 없음" };

  try {
    const ext = _extOf(file);
    const stepEn = STEP_TO_EN[step] || "other";
    const path = `${taskId}/${stepEn}_${_timestamp()}.${ext}`;

    // [1] Storage 업로드
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || `image/${ext}`,
      });
    if (upErr) {
      console.error("[photosDb.upload:storage]", upErr);
      return { ok: false, error: `Storage 업로드 실패: ${upErr.message}` };
    }

    // [2] public URL 박을 차례
    const { data: pubData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const url = pubData?.publicUrl || "";

    // [3] photos 테이블 row 박음
    const { data: row, error: insErr } = await supabase
      .from("photos")
      .insert({
        task_id:      taskId,
        step:         step,
        storage_path: path,
        uploaded_by:  uploadedBy || null,
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("[photosDb.upload:row]", insErr);
      // Storage 측은 박힌 영역이라 cleanup 시도 (best-effort)
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      return { ok: false, error: `photos row 실패: ${insErr.message}` };
    }

    return { ok: true, photoId: row.id, storage_path: path, url };
  } catch (e) {
    console.error("[photosDb.uploadPhoto]", e);
    return { ok: false, error: e.message || "사진 업로드 실패" };
  }
}

// ============================================================
// listPhotosByTask — 특정 task 측 사진 목록 + public URL
// ============================================================
// 응답: { ok: true, photos: [...] } | { ok: false, error, photos: [] }
//   photos[i] = { id, step, storage_path, url, uploadedBy, uploadedAt }
export async function listPhotosByTask(taskId) {
  if (!taskId) return { ok: false, error: "taskId 없음", photos: [] };

  try {
    const { data, error } = await supabase
      .from("photos")
      .select("id, task_id, step, storage_path, uploaded_by, uploaded_at")
      .eq("task_id", taskId)
      .order("uploaded_at", { ascending: true });
    if (error) {
      console.error("[photosDb.list]", error);
      return { ok: false, error: error.message, photos: [] };
    }

    const photos = (data || []).map(row => {
      const { data: pubData } = supabase.storage.from(BUCKET).getPublicUrl(row.storage_path);
      return {
        id:           row.id,
        taskId:       row.task_id,
        step:         row.step,
        storage_path: row.storage_path,
        url:          pubData?.publicUrl || "",
        uploadedBy:   row.uploaded_by,
        uploadedAt:   row.uploaded_at,
      };
    });

    return { ok: true, photos };
  } catch (e) {
    console.error("[photosDb.listPhotosByTask]", e);
    return { ok: false, error: e.message || "사진 조회 실패", photos: [] };
  }
}

// ============================================================
// deletePhoto — Storage + photos row 둘 다 삭제
// ============================================================
// 입력: photoId (uuid)
// 응답: { ok: true } | { ok: false, error }
export async function deletePhoto(photoId) {
  if (!photoId) return { ok: false, error: "photoId 없음" };

  try {
    // [1] storage_path 박힌 영역 조회
    const { data: row, error: selErr } = await supabase
      .from("photos")
      .select("id, storage_path")
      .eq("id", photoId)
      .maybeSingle();
    if (selErr) {
      console.error("[photosDb.delete:select]", selErr);
      return { ok: false, error: selErr.message };
    }
    if (!row) return { ok: false, error: "사진 없음" };

    // [2] Storage 측 삭제
    const { error: rmErr } = await supabase.storage
      .from(BUCKET)
      .remove([row.storage_path]);
    if (rmErr) {
      console.error("[photosDb.delete:storage]", rmErr);
      // Storage 측 실패해도 row 삭제 시도 (best-effort)
    }

    // [3] photos row 삭제
    const { error: delErr } = await supabase
      .from("photos")
      .delete()
      .eq("id", photoId);
    if (delErr) {
      console.error("[photosDb.delete:row]", delErr);
      return { ok: false, error: delErr.message };
    }

    return { ok: true };
  } catch (e) {
    console.error("[photosDb.deletePhoto]", e);
    return { ok: false, error: e.message || "사진 삭제 실패" };
  }
}

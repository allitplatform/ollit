// 2026-10-06 Mig 211a — 앱 버전 기록.
//   운영자가 "기사 전원이 새 버전인가"를 확인할 수 있게, 앱이 열릴 때 서버에 버전을 남긴다.
//   (조회: db/ops/check_engineer_app_versions.sql — 211b 실행 조건)
//   값은 배포 묶음이 바뀔 때만 올린다. 형식 YYYYMMDD-이름, 문자열 비교로 최신 여부 판단.
import { supabase } from "./supabase.js";
import { getSessionAuth } from "./auth.js";

export const APP_VERSION = "20261006-guard";

let _reportedFor = null;

// 로그인된 사용자 기준 1회 보고 (같은 사용자로는 다시 보내지 않음). 실패해도 앱 동작에는 영향 없음.
export async function reportAppVersion() {
  try {
    const { actor, token } = getSessionAuth();
    if (!actor || _reportedFor === actor) return;
    _reportedFor = actor;
    const { error } = await supabase.rpc("report_app_version", {
      p_actor:   actor,
      p_version: APP_VERSION,
      p_token:   token,
    });
    if (error) _reportedFor = null;
  } catch (_e) {
    _reportedFor = null;
  }
}

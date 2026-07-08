// Phase 3-5 — 휴무 DB 접근 모듈
// Supabase `user_off_days` 테이블 직접 사용 (시트 호출 폐기).
// 함수 시그니처는 옛 api.js 측과 동일 — EngineerApp 호출 코드 변경 X.
//
// 매핑 핵심:
//   · engineerName (한글 이름) ↔ user_id (UUID) — 모듈 내 Map 캐시
//     · engineer 역할 한정 매칭 (동명이인 위험 회피 / role='engineer' inner join)
//   · "종일" ↔ NULL (DB time 컬럼)
//   · off_date (date) ↔ "YYYY-MM-DD"
//   · start_time / end_time (time) ↔ "HH:MM"
//   · 결과 row 측 id + offId 둘 다 채움 (EngineerApp 양쪽 사용)
//
// RLS: user_off_days SELECT / INSERT / UPDATE / DELETE 모두 anon 허용
//      (대표님 사전 적용 완료 — Phase 3-4 마지막)

import { supabase } from "./supabase.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// ============================================================
// 내부 헬퍼
// ============================================================

// engineerName → user_id 매핑 캐시 (휴무 화면 진입 시 1회 fetch 후 재사용)
const _userIdByName = new Map();

async function _getUserIdByName(name) {
  if (!name) return null;
  if (_userIdByName.has(name)) return _userIdByName.get(name);

  // engineer 역할 한정 매칭 (admin/operator 등 다른 역할 동명이인 회피)
  const { data, error } = await supabase
    .from("users")
    .select("id, name, user_roles!inner(role)")
    .eq("tenant_id", TENANT_ID)
    .eq("name", name)
    .eq("user_roles.role", "engineer")
    .maybeSingle();

  if (error) {
    console.error("[offDaysDb._getUserIdByName]", error);
    return null;
  }
  const userId = data?.id || null;
  if (userId) _userIdByName.set(name, userId);
  return userId;
}

// DB time → 시트 측 문자열
function timeFromDb(t) {
  if (t === null || t === undefined || t === "") return "종일";
  // PostgreSQL time: "HH:MM:SS" → "HH:MM"
  const m = String(t).match(/^(\d{2}:\d{2})/);
  return m ? m[1] : String(t);
}

// 시트 측 문자열 → DB time
function timeToDb(s) {
  if (!s) return null;
  if (s === "종일") return null;
  return String(s);
}

// DB date → "YYYY-MM-DD"
function dateFromDb(d) {
  if (!d) return "";
  const m = String(d).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : String(d);
}

// ============================================================
// 시트 호환 API — 함수명 / 시그니처 / 응답 형태 동일
// ============================================================

// 한 기사의 모든 휴무 조회
// 응답: { ok: true, offDays: [...] } | { ok: false, error, offDays: [] }
export async function getOffDays(engineer) {
  if (!engineer) return { ok: false, error: "engineer 없음", offDays: [] };

  const userId = await _getUserIdByName(engineer);
  if (!userId) {
    return { ok: false, error: `사용자 찾을 수 없음: ${engineer}`, offDays: [] };
  }

  const { data, error } = await supabase
    .from("user_off_days")
    .select("id, user_id, off_date, type, start_time, end_time, memo")
    .eq("user_id", userId)
    .order("off_date", { ascending: false });

  if (error) {
    console.error("[offDaysDb.getOffDays]", error);
    return { ok: false, error: error.message, offDays: [] };
  }

  // 호출 시 engineerName 이미 알고 있음 → row 매핑마다 name lookup 불필요
  // 2026-07-08 — reason 별칭 (EngineerCalendarTab 화면이 off.reason 참조 → 호환)
  const offDays = (data || []).map(row => ({
    id:        row.id,
    offId:     row.id,        // EngineerApp 호환 (off.offId 사용처 여러 곳)
    engineer,                  // 입력 그대로
    type:      row.type || "",
    date:      dateFromDb(row.off_date),
    startTime: timeFromDb(row.start_time),
    endTime:   timeFromDb(row.end_time),
    memo:      row.memo || "",
    reason:    row.memo || "",  // 옛 표시 컴포넌트 호환
  }));

  return { ok: true, offDays };
}

// 휴무 추가
// 입력: { engineer, type, date, startTime, endTime, memo }
// 응답: { ok: true, id } | { ok: false, error }
export async function addOffDay({ engineer, type, date, startTime, endTime, memo }) {
  if (!engineer) return { ok: false, error: "engineer 없음" };
  if (!date)     return { ok: false, error: "date 없음" };
  if (!type)     return { ok: false, error: "type 없음" };

  const userId = await _getUserIdByName(engineer);
  if (!userId) {
    return { ok: false, error: `사용자 찾을 수 없음: ${engineer}` };
  }

  const row = {
    user_id:    userId,
    off_date:   date,
    type,
    start_time: timeToDb(startTime),
    end_time:   timeToDb(endTime),
    memo:       memo || null,
  };

  const { data, error } = await supabase
    .from("user_off_days")
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error("[offDaysDb.addOffDay]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data?.id };
}

// 휴무 삭제
// 응답: { ok: true } | { ok: false, error }
export async function deleteOffDay(offId) {
  if (!offId) return { ok: false, error: "offId 없음" };

  const { error } = await supabase
    .from("user_off_days")
    .delete()
    .eq("id", offId);

  if (error) {
    console.error("[offDaysDb.deleteOffDay]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ============================================================
// 2026-07-08 — 운영자 화면 조회 (전 기사 range fetch)
// ============================================================

// 기간 내 전체 기사 휴무 조회 (운영자 타임라인/주간/월간/프로상세용).
//   users JOIN 으로 engineerName / engineerCode 동봉 → 프론트 매핑 없이 즉시 사용.
//   응답: { ok: true, offDays: [...] } | { ok: false, error, offDays: [] }
export async function getAllOffDaysInRange(startYmd, endYmd) {
  if (!startYmd || !endYmd) {
    return { ok: false, error: "range 없음", offDays: [] };
  }

  const { data, error } = await supabase
    .from("user_off_days")
    .select("id, user_id, off_date, type, start_time, end_time, memo, users:user_id(id, name, code)")
    .gte("off_date", startYmd)
    .lte("off_date", endYmd)
    .order("off_date", { ascending: true });

  if (error) {
    console.error("[offDaysDb.getAllOffDaysInRange]", error);
    return { ok: false, error: error.message, offDays: [] };
  }

  const offDays = (data || []).map(row => ({
    id:           row.id,
    userId:       row.user_id,
    engineerName: row.users?.name || "",
    engineerCode: row.users?.code || "",
    type:         row.type || "",
    date:         dateFromDb(row.off_date),
    startTime:    timeFromDb(row.start_time),
    endTime:      timeFromDb(row.end_time),
    memo:         row.memo || "",
  }));

  return { ok: true, offDays };
}

// 타입 영문키 → 한글 라벨 (화면 표시용 매핑).
//   저장은 영문 키 (single/range/repeat/hourly). 옛 데이터 호환 항목 포함.
export const OFF_DAY_TYPE_LABEL = {
  single:   "하루 휴무",
  range:    "기간 휴무",
  repeat:   "반복 휴무",
  hourly:   "시간 휴무",
  // 옛 데이터 (구 AddOffDayModal 로 저장된 것) — 화면 표시 호환
  "휴무종일": "하루 휴무",
  "휴무부분": "시간 휴무",
};

export function formatOffDayType(type) {
  return OFF_DAY_TYPE_LABEL[type] || type || "";
}

// 기사명 → engineerId 변환 헬퍼
// 2026-05-28 — UsolNInProgress 서버 검색 (페이징) — 기사명 검색은 서버 측 column 없으니
//   클라가 REGISTERED_USERS 에서 name → engineerId 변환 후 assigned_engineer_id IN (...) 로 조회.
//
// 동작:
//   findEngineerCodesByName("김")      → ["E004","E005","E006","E007","E008","E009","E010","E011"]
//   findEngineerCodesByName("김윤섭")  → ["E008"]
//   findEngineerCodesByName("조동욱")  → ["E022"]   (A001+E022 같은 인물, engineerId 동일 → 중복 제거)
//   findEngineerCodesByName("")        → []
//
// 매칭 규칙:
//   - 공백 trim 후 소문자 includes (대소문자 무시 — 영문 코드 포함 안전망)
//   - engineerId 있는 entry 만 (admin-only 행은 제외 — 작업 배정 대상이 아님)
//   - 같은 engineerId 가 여러 entry (admin+engineer 겸직) 에 등장해도 Set 으로 dedup

import { REGISTERED_USERS } from "../shared/users.js";

export function findEngineerCodesByName(query) {
  if (query == null) return [];
  const q = String(query).trim().toLowerCase();
  if (!q) return [];
  const codes = new Set();
  for (const u of REGISTERED_USERS) {
    if (!u || !u.engineerId) continue;
    const name = u.name ? String(u.name).toLowerCase() : "";
    if (name && name.includes(q)) {
      codes.add(u.engineerId);
    }
  }
  return Array.from(codes);
}

// 지역 (구/군/시) 키워드 추출 — 작업 카드 한 줄 표시용 공용 유틸.
// 2026-06-09 작성.
//
// 동기:
//   옛 인라인 폴백 (`String(address).split(/\s+/)[0]`) 은 주소에 공백 없으면 전체 반환 →
//   카드 한 줄 넘쳐 잘림 사고 (예: "중구장충단로7길24-14" 전체 표시).
//   본 유틸 측 한글 N자 + (구|군|시) 패턴 우선 매치 → 매치 실패 시 6자 cap.
//
// 적용:
//   PrincipalListTab.TaskRow / UsolNAssignList.TaskRowOperator / AdminApp.TaskCard.

// 주소·지역 문자열에서 첫 "구/군/시" 키워드 추출.
//   "서울특별시 중구 장충단로 ..."          → "중구"
//   "강남구 역삼동 ..."                     → "강남구"
//   "중구장충단로7길24-14"                 → "중구"   (붙어있어도 매치)
//   "전주시 완산구 ..."                    → "전주시" (먼저 매치된 것)
//   "(빈 값) / null / undefined"           → ""
//   "매치 없음 + 한 어절 < 6자"             → 그 어절
//   "매치 없음 + 첫 어절 6자 초과"          → 첫 6자
export function extractDistrictKeyword(value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";
  // 1) 한글 1~5자 + (구|군|시) 매치 (붙어있어도 OK)
  const m = s.match(/[가-힣]{1,5}(구|군|시)/);
  if (m) return m[0];
  // 2) fallback — 첫 어절 (한 줄 유지 위해 6자 cap)
  const firstWord = s.split(/\s+/)[0] || "";
  return firstWord.length > 6 ? firstWord.slice(0, 6) : firstWord;
}

// 지역 우선 — task.region (이미 짧음 가정) → 빈 값이면 address 에서 추출.
//   호출처: TaskRow 등 카드 행 인라인.
export function regionOrDistrictFromAddress(region, address) {
  const r = String(region || "").trim();
  if (r) {
    // region 이 이미 너무 길면 (옛 데이터 / 잘못 들어간 풀주소) → 추출 시도
    if (r.length > 8) return extractDistrictKeyword(r);
    return r;
  }
  return extractDistrictKeyword(address);
}

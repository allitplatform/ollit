// 2026-06-11 — PC 폰트 크기 표준 (원청 PWA "내 작업" ViewPcTable 기준).
//
// 사장님 spec:
//   · 본문 / 헤더 = 동일 17 (색·weight·letterSpacing 측 위계 유지).
//   · 메타 / 보조 = 13.
//   · 작은 라벨 = 11.
//   · 메트릭 큰 숫자 = 28 (별도 강조, 통일 대상 X).
//
// 사용처:
//   · src/components/principal/PrincipalListTab.jsx (내 작업 — 기준 화면)
//   · src/components/principal/PrincipalSettleTab.jsx (정산)
//   · 후속: 일정 / 알림 / 내정보 (사장님 OK 후 적용).
//
// 폰트 토큰 한 곳에서 관리 — 다음에 다시 어긋나지 않게.
export const TEXT = {
  // 표 셀 / 리스트 항목 본문 (가장 일반).
  BODY:   17,
  // 섹션 헤더 / 컬럼 헤더 (BODY 와 같은 크기 — 색·weight 측 위계).
  HEADER: 17,
  // 메타 / 보조 / 부가 (날짜, 작은 라벨, 보조 텍스트).
  META:   13,
  // 작은 라벨 (사이드바 옛 라벨, 더 작은 보조).
  LABEL:  11,
  // 작업종류 칩 / 작은 배지 (ServiceTag 등).
  CHIP:   13,
  // 상태 칩 (status badge — 메타와 본문 사이, 시각 무게 살짝).
  STATUS: 14,
  // 메트릭 큰 숫자 (사이드바 요약 / 메트릭 카드 value 등 강조).
  METRIC: 28,
  // 검색바 (PC 헤더 풀폭 검색 입력).
  SEARCH: 15,
};

export default TEXT;

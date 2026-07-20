// 2026-07-20 — 기사 목록 공용 필터·정렬 헬퍼.
//   두 화면 공유:
//     · src/components/EngineerListScreen.jsx (모바일)
//     · src/pages/AdminPcEngineerGridScreen.jsx (PC)
//   양쪽이 같은 규칙을 쓰도록 로직 단일화 (다음에 한쪽만 수정해서 어긋나는 사고 방지).
//
// 규칙:
//   · 정렬: 활동(status === "active") 그룹 → 퇴사(그 외) 그룹.
//           각 그룹 안 이름 가나다순 (localeCompare 'ko').
//   · 상태 필터:
//       - 검색어(search) 있음 → 퇴사도 자동 포함 (사장님 spec — 이름 검색으로 퇴사자 찾기 대응).
//       - includeOff 켜짐 → 퇴사도 표시.
//       - 그 외 → 활동만.
//
// 검색·기능·지역 등 화면별 자체 필터는 각 화면에서 별도 적용 후 이 헬퍼로 최종 통과.

export function filterAndSortEngineers(engineers, { search = "", includeOff = false } = {}) {
  if (!Array.isArray(engineers)) return [];
  const sorted = engineers.slice().sort((a, b) => {
    const aOff = a.status !== "active";
    const bOff = b.status !== "active";
    if (aOff !== bOff) return aOff ? 1 : -1;
    return (a.name || "").localeCompare(b.name || "", "ko");
  });
  const hasSearch = !!(search && String(search).trim().length > 0);
  return sorted.filter(e => {
    if (!hasSearch && !includeOff && e.status !== "active") return false;
    return true;
  });
}

// 2026-07-08 — 운영자 화면에서 기간 범위 안 전 기사 휴무 조회 hook.
//   AdminPcTimelineScreen / AdminPcEngineerCalendarScreen /
//   AdminPcEngineerMonthlyCalendarScreen / EngineerEditScreen 4곳 공통 사용.
//
//   반환:
//     · offDays        — 전체 목록 (raw, DB 순서)
//     · byNameDate     — Map<engineerName, Map<"YYYY-MM-DD", off[]>>
//                        (row 매칭 키가 name → 화면 grouping 즉시 사용)
//     · byUserIdDate   — Map<userId, Map<"YYYY-MM-DD", off[]>>
//                        (row 매칭 키가 uuid → 화면 grouping)
//     · loading / error
//     · reload         — 명시 재로드
//
//   내부: getAllOffDaysInRange 한 번 fetch → 두 형태로 grouping.

import { useState, useEffect, useMemo, useCallback } from "react";
import { getAllOffDaysInRange } from "../lib/offDaysDb.js";

export function useOffDaysInRange(startYmd, endYmd) {
  const [offDays, setOffDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const reload = useCallback(async () => {
    if (!startYmd || !endYmd) {
      setOffDays([]);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await getAllOffDaysInRange(startYmd, endYmd);
    setLoading(false);
    if (res.ok) {
      setOffDays(res.offDays || []);
    } else {
      setError(res.error || "load failed");
      setOffDays([]);
    }
  }, [startYmd, endYmd]);

  useEffect(() => { reload(); }, [reload]);

  // name × date 이중 Map
  const byNameDate = useMemo(() => {
    const m = new Map();
    for (const o of offDays) {
      const name = o.engineerName || "";
      if (!name) continue;
      if (!m.has(name)) m.set(name, new Map());
      const inner = m.get(name);
      const d = o.date || "";
      if (!inner.has(d)) inner.set(d, []);
      inner.get(d).push(o);
    }
    return m;
  }, [offDays]);

  // userId × date 이중 Map
  const byUserIdDate = useMemo(() => {
    const m = new Map();
    for (const o of offDays) {
      const uid = o.userId || "";
      if (!uid) continue;
      if (!m.has(uid)) m.set(uid, new Map());
      const inner = m.get(uid);
      const d = o.date || "";
      if (!inner.has(d)) inner.set(d, []);
      inner.get(d).push(o);
    }
    return m;
  }, [offDays]);

  return { offDays, byNameDate, byUserIdDate, loading, error, reload };
}

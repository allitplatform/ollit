// 유솔 포털 정산 탭 — 네이버 주차 정산 + 입금 워크플로 (Phase 1+2)
// 2026-05-23
//
// 사장님 spec:
//   · 단위: 항목(task_item), naver_settled_at 기준 ISO 주(월~일) 묶음
//   · 금액: subtotal
//   · 주차 카드 상태 3단계:
//       입금 예정     (row 없음)                       — 파랑
//       입금 확인 중  (remitted_at NOT NULL, !confirm) — 앰버
//       입금완료     (confirmed_at NOT NULL)           — 초록
//   · 드릴인에 "입금했습니다" / "보고 취소" 버튼
//   · 이번 주(오늘 포함) 카드 테두리 — 핑크 #FF4D9E
//   · 전체 현황 — 배경·테두리 제거 (단계 시각만 표시)
import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, ChevronLeft, Check } from "lucide-react";
import {
  fetchPrincipalSettleItems,
  getSettleStageKey,
  getNaverSettleWeek,
  getItemLabel,
  SETTLE_STAGES,
} from "../../lib/principalSettleDb.js";
import {
  fetchPrincipalWeeklyRemittances,
  markPrincipalRemitted,
  undoPrincipalRemit,
} from "../../lib/principalRemitDb.js";
import { supabase } from "../../lib/supabase.js";
// 2026-06-02 — 주차 카드 spec 통일 (운영자 ① 와 동일).
//   usol_n 측 주차 (시트값 W14~W22 + 라이브 W23+, cancel 필터)
//   + 월별(payYm) 아코디언 + deposit 기준 입금 완료/예정 시각 + 동적 월 분류.
import {
  USOL_N_PID,
  NAVER_NET_TO_COMPANY_FACTOR,
  WEEKLY_DATA_FIXED,
  fetchJuneLiveWeeks,
  getMonthlyEntriesOf,
  aggregateMonthlyAmounts,
  ymLabel,
  getKstToday,
  isDepositDone,
  isLiveRemitWeek,
  depositStatusLabel,
  mdLabel,
  dowKor,
  kstYmd,
  addDaysYmd,
  C_PINK_DEPOSIT,
  C_GREEN_DONE,
  C_GRAY_BAR,
} from "../../lib/usolNWeeklyData.js";
// 2026-05-26 — 기사 입금 내역 화면 (usol_n 측 cleaning + extra_fee 15%)
import { UsolRemitHistoryScreen } from "./UsolRemitHistoryScreen.jsx";
// 2026-06-02 — 공유 드릴인 컴포넌트 (운영자 ① / PWA 공유).
import { WeekSettleDetail, getWeekRemitStatus } from "./WeekSettleDetail.jsx";
// 2026-06-11 — PC 반응형 (1024px 이상) 분기.
import { useIsPc } from "../../utils/useIsPc.js";
// 2026-06-11 — 추이 차트 다크/라이트 분기.
import { useIsDark } from "../../hooks/useIsDark.js";
// 2026-06-11 — PC 폰트 크기 표준 토큰 (내 작업 ViewPcTable 기준).
import { TEXT } from "../../styles/textTokens.js";

// 색 토큰 — 시안 확정
const C_MAGENTA = "#FF4D9E";
const C_GREEN   = "#5DCAA5";
const C_BLUE    = "#6AAAEC";
const C_AMBER   = "#E6A33A";
const C_GRAY    = "#9CA3AF";
const C_DOT     = "#4A4A4A";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 회사 입금액 = ROUND(net_amount × 0.85). net_amount NULL → 0.
//   (사장님 정의 — 네이버 정산금액 × 0.85)
function companyAmountOf(item) {
  const n = item?.net_amount;
  if (n == null) return 0;
  return Math.round(Number(n) * 0.85);
}

// "M월 N주차" — 그 달의 첫 주(1일 포함 주)부터 카운트, sunday의 달 기준
function getKoreanWeekLabel(monday, sunday) {
  const year  = sunday.getFullYear();
  const month = sunday.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstDayDow = firstDay.getDay() || 7;
  const firstMonday = new Date(firstDay);
  firstMonday.setDate(firstDay.getDate() - (firstDayDow - 1));
  const diff = Math.round((monday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${month + 1}월 ${diff + 1}주차`;
}

function getThisWeekMondayKey() {
  const now = new Date();
  const dow = now.getDay() || 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow - 1));
  mon.setHours(0, 0, 0, 0);
  return toIsoDate(mon);
}

function getNextMonday(sunday) {
  const d = new Date(sunday);
  d.setDate(sunday.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIsoDate(d) {
  // 로컬 KST 기준 YYYY-MM-DD (UTC slice 측 측 catch)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatMD(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatMDWithDow(d) {
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

// 2026-06-02 — getWeekRemitStatus 측 ./WeekSettleDetail.jsx 측 import (공유).
export function PrincipalSettleTab({ principalCodes, onSelect }) {
  // 2026-06-11 — PC 반응형 (1024px+) 분기 (유솔N 전용 시안 확정안).
  //   레이아웃: 좌(메트릭 4 가로 + 정산대기 배너 + 주차 표) + 우(기사 입금내역 인라인).
  //   모바일은 무손상 — 데이터 fetch / state 전부 공유.
  const isPc = useIsPc();
  const [items, setItems] = useState([]);
  const [remits, setRemits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  // 뷰 전환
  const [selectedWeekKey, setSelectedWeekKey] = useState(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  // 2026-05-26 — 기사 입금 내역 화면 진입 state (usol_n principal 만 노출)
  const [showUsolHistory, setShowUsolHistory] = useState(false);

  // 2026-06-02 — usol_n 주차 카드 source 통일.
  //   usol_n 포함 시 fetchJuneLiveWeeks (W23+) 라이브 결과 사용.
  const isUsolNIncluded = Array.isArray(principalCodes) && principalCodes.includes("usol_n");
  const [liveWeeks, setLiveWeeks] = useState([]);

  const refresh = useCallback(() => setReloadTick(v => v + 1), []);

  useEffect(() => {
    if (!Array.isArray(principalCodes) || principalCodes.length === 0) return;
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      fetchPrincipalSettleItems({ principalCodes, monthsBack: 3 }),
      fetchPrincipalWeeklyRemittances({ principalCodes, monthsBack: 3 }),
    ]).then(([itemsRes, remitRes]) => {
      if (!alive) return;
      if (!itemsRes.ok) setError(itemsRes.error || "정산 항목 조회 실패");
      setItems(itemsRes.items || []);
      setRemits(remitRes.remits || []);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [principalCodes, reloadTick]);

  // usol_n 라이브 fetch (W23+ — 6/8 입금주 이후)
  useEffect(() => {
    if (!isUsolNIncluded) { setLiveWeeks([]); return; }
    let alive = true;
    fetchJuneLiveWeeks()
      .then(ws => { if (alive) setLiveWeeks(ws); })
      .catch(err => { console.error("[PrincipalSettleTab.junLive]", err); });
    return () => { alive = false; };
  }, [isUsolNIncluded, reloadTick]);

  // 전체 현황 수치
  // 2026-06-02 — cancel 필터 통일 (운영자 ① / 주차별 정산 측과 동일).
  //   기존: task.status='취소' 만 제외 → 정산완료 907 측 inflate 1건 (전상욱 task_item.is_canceled=true).
  //   통일: is_canceled !== true AND task.status !== '취소' 둘 다 제외 → 정합값.
  //   영향 (1,861 fetched 기준): received 1724→1698, beforeWork 415→411, doneWork 1303→1281, settled 907→906, pending 406→385.
  // 2026-06-02 — pendingAmount 측 task_item 측 subtotal 합 (사장님 spec).
  //   기존: Σ(net × 0.85) → net NULL 측 0 measure (진기선 등 0 표시).
  //   새:   Σ subtotal     → net NULL 측 측 측 subtotal 측 measure (TaskDetail 정산금액 측 동일 source).
  // 2026-06-02 — pending 측 추가 필터: subtotal > 0 (부분취소 0원 제외).
  //   신동욱 벽걸이×2 부분취소 (subtotal=0) 측 측 정산 대기 측 측 측 측 X.
  // 2026-06-09 — pending 모집단 usol_n 전용 스코프 (사장님 spec).
  //   근거: usol_h 는 네이버 정산 개념 자체가 없음 (naver_settled 0건).
  //   → usol_h 완료 task_items 가 naver_settled_at NULL 로 영원히 pending 에 끼어 카운트 오류.
  //   처방: principal_id === USOL_N_PID 필터. usol_h-only 로그인 시 정산 대기 = 0건 (정합).
  //   영향: 통합계정 (usol_h + usol_n) 정산 대기 카운트 운영자 (UsolNSettleScreen) 와 일치.
  //   다른 합계 (received / beforeWork / doneWork / settled) 는 전 principal 합산 유지 — 옛 동작.
  const summary = useMemo(() => {
    const live = items.filter(it => it.task_status !== "취소" && it.is_canceled !== true);
    const before = live.filter(it => ["배정", "확정"].includes(it.task_status));
    const done = live.filter(it => it.task_status === "완료");
    const settled = live.filter(it => it.naver_settled_at);
    const pendingSettle = done.filter(
      it => it.principal_id === USOL_N_PID
         && !it.naver_settled_at
         && Number(it.subtotal) > 0
    );
    const pendingAmount = pendingSettle.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
    return {
      received: live.length, beforeWork: before.length, doneWork: done.length,
      settled: settled.length, pendingCount: pendingSettle.length, pendingAmount,
    };
  }, [items]);

  // 2026-06-02 — 주차 묶음. 사장님 spec (운영자 ① 와 통일):
  //   · cancel 필터: task_item.is_canceled=true / task.status='취소' 둘 다 제외.
  //   · usol_n 주차 카드 메인 표시값 (naverCount / weeklyTotal):
  //       - W14~W22 (~6/1 입금): WEEKLY_DATA_FIXED 시트값
  //       - W23+ (6/8 입금~):    fetchJuneLiveWeeks 라이브 (sum(net) × 0.85)
  //   · usol_h 등 다른 원청: DB items 측 ISO 주 그룹 (기존 로직).
  //   · 드릴인 items = DB items (cancel 필터 적용된 것 — 표시 구조 유지).
  //   · pending 묶음 = task.status='완료' AND naver_settled_at NULL.
  const weeks = useMemo(() => {
    // 1. DB items → cancel 필터 + ISO 주 그룹 (드릴인 측 items 출처)
    const itemsByKey = new Map();
    const pending = [];
    for (const it of items) {
      // 운영자 ① 와 일치 — task_item 취소 / task 취소 둘 다 제외.
      if (it.is_canceled === true) continue;
      if (it.task_status === "취소") continue;
      const wk = getNaverSettleWeek(it);
      if (!wk) {
        // 2026-06-02 — pending bucket 측 subtotal > 0 (부분취소 0원 제외).
        // 2026-06-09 — usol_n 전용 스코프 (summary.pendingSettle 와 동일 근거).
        //   usol_h 는 네이버 정산 X — pending 모집단에서 제외.
        if (it.principal_id === USOL_N_PID
            && it.task_status === "완료"
            && Number(it.subtotal) > 0) {
          pending.push(it);
        }
        continue;
      }
      if (!itemsByKey.has(wk.key)) itemsByKey.set(wk.key, { wk, items: [] });
      itemsByKey.get(wk.key).items.push(it);
    }

    // 2. usol_n 측 source map (시트 + 라이브) — isoKey 기준
    const usolNSourceByKey = new Map();
    if (isUsolNIncluded) {
      for (const src of WEEKLY_DATA_FIXED) usolNSourceByKey.set(src.weekKey, src);
      for (const src of liveWeeks)         usolNSourceByKey.set(src.weekKey, src);
    }

    // 3. 합집합 ISO key 순회 — 카드 메인 = (usol_n source 측 + usol_h DB) 합산
    const allKeys = new Set([
      ...itemsByKey.keys(),
      ...usolNSourceByKey.keys(),
    ]);
    const list = [];
    for (const key of allKeys) {
      const dbEntry = itemsByKey.get(key);
      const src     = usolNSourceByKey.get(key);

      // monday/sunday Date — DB 측 우선 (기존 ISO week 계산), 없으면 source string → Date.
      //   depositStr (YMD) = 시각 spec 측 사용 (deposit 기준 입금 완료/예정 판단).
      let monday, sunday, year, week, monthDay, depositStr, mondayStr, sundayStr;
      if (src) {
        mondayStr  = src.monday;
        sundayStr  = src.sunday;
        depositStr = src.deposit;
        const [my, mm, md] = src.monday.split("-").map(Number);
        const [sy, sm, sd] = src.sunday.split("-").map(Number);
        monday = new Date(my, mm - 1, md);
        sunday = new Date(sy, sm - 1, sd);
        const [yy, ww] = key.split("-W");
        year = Number(yy);
        week = Number(ww);
        monthDay = `${monday.getMonth() + 1}/${monday.getDate()}~${sunday.getMonth() + 1}/${sunday.getDate()}`;
      } else if (dbEntry) {
        ({ monday, sunday, year, week, monthDay } = dbEntry.wk);
        mondayStr  = toIsoDate(monday);
        sundayStr  = toIsoDate(sunday);
        depositStr = addDaysYmd(sundayStr, 1);
      }

      const dbItems   = dbEntry ? dbEntry.items : [];
      // usol_n / 비-usol_n 분리.
      const usolNDb   = dbItems.filter(it => it.principal_id === USOL_N_PID);
      const otherDb   = dbItems.filter(it => it.principal_id !== USOL_N_PID);

      // 카드 메인 — usol_n 측 source 우선, 없으면 DB items / 비-usol_n 측 DB items 합산.
      let displayNaverCount  = 0;
      let displayWeeklyTotal = 0;
      if (src) {
        displayNaverCount  += src.naverCount;
        displayWeeklyTotal += src.weeklyTotal;
      } else {
        displayNaverCount  += usolNDb.length;
        displayWeeklyTotal += usolNDb.reduce((s, it) => s + companyAmountOf(it), 0);
      }
      displayNaverCount  += otherDb.length;
      displayWeeklyTotal += otherDb.reduce((s, it) => s + companyAmountOf(it), 0);

      // 동적 월 분류 — usol_n source (시트/라이브) 측 monthlyAmounts + 비-usol_n items 측 aggregate.
      //   usol_n src 측 measurement 측 (src.monthlyAmounts) → usol_n 부분.
      //   src 측 measurement 측 = usolNDb 측 aggregate (fallback).
      //   otherDb 측 = aggregateMonthlyAmounts (completed_at KST 우선, NULL → task_no fallback).
      const monthlyAmounts = new Map();
      if (src && src.monthlyAmounts instanceof Map) {
        for (const [ym, amt] of src.monthlyAmounts) {
          if (amt > 0) monthlyAmounts.set(ym, (monthlyAmounts.get(ym) || 0) + amt);
        }
      } else if (!src) {
        const usolNMap = aggregateMonthlyAmounts(usolNDb);
        for (const [ym, amt] of usolNMap) {
          if (amt > 0) monthlyAmounts.set(ym, (monthlyAmounts.get(ym) || 0) + amt);
        }
      }
      const otherMap = aggregateMonthlyAmounts(otherDb);
      for (const [ym, amt] of otherMap) {
        if (amt > 0) monthlyAmounts.set(ym, (monthlyAmounts.get(ym) || 0) + amt);
      }

      list.push({
        key, year, week, monday, sunday, monthDay,
        mondayStr, sundayStr, depositStr,
        displayNaverCount,
        displayWeeklyTotal,
        monthlyAmounts,
        items: dbItems,  // 드릴인 측 (cancel 필터 적용된 DB items)
      });
    }
    list.sort((a, b) => b.key.localeCompare(a.key));
    if (pending.length > 0) {
      list.push({ key: "pending", year: null, week: null, monday: null, sunday: null, items: pending });
    }
    return list;
  }, [items, liveWeeks, isUsolNIncluded]);

  // 2026-06-02 — payYm 그룹 아코디언 (운영자 ① 와 통일).
  //   · pending bucket 측 별도 (기존 SummarySection 측 클릭 spec 유지).
  //   · 그룹 헤더 = 전부 입금 완료 → 초록 / 예정·미확인·보고대기 섞이면 핑크.
  //   · 입금 미완료(예정·미확인·보고대기) 있는 payYm 만 기본 펼침.
  // 2026-06-09 — isDepositDone(deposit, today, remitStatus) 로 전환.
  //   < 6/8 주차: 옛 isDepositPast (4월·5월 완료 라벨 유지).
  //   ≥ 6/8 주차: remitStatus.kind === 'done' 만 완료.
  const today = getKstToday();
  const groups = useMemo(() => {
    const nonPending = weeks.filter(w => w.key !== "pending");
    const pendingBucket = weeks.find(w => w.key === "pending");

    // 컷오프 이상 주차의 remitStatus 사전 계산 (remits 배열 활용).
    function remitStatusOf(w) {
      if (!isLiveRemitWeek(w.depositStr)) return null;
      const sub = new Map();
      for (const r of remits) {
        if (r?.week_start === w.mondayStr) sub.set(r.principal_id, r);
      }
      if (w.items && w.items.length > 0 && sub.size > 0) {
        return getWeekRemitStatus(w.items, sub);
      }
      const remit = sub.get(USOL_N_PID);
      if (!remit) return { kind: "expected", remits: [] };
      if (remit.confirmed_at) return { kind: "done", remits: [remit] };
      if (remit.remitted_at)  return { kind: "reported", remits: [remit] };
      return { kind: "expected", remits: [remit] };
    }

    const map = new Map();
    for (const w of nonPending) {
      if (!w.depositStr) continue;
      const payYm = w.depositStr.slice(0, 7);
      if (!map.has(payYm)) map.set(payYm, []);
      map.get(payYm).push({ ...w, remitStatus: remitStatusOf(w) });
    }
    const list = [...map.entries()].map(([payYm, ws]) => ({
      payYm,
      weeks: ws.sort((a, b) => b.depositStr.localeCompare(a.depositStr)),
      total: ws.reduce((s, w) => s + (w.displayWeeklyTotal || 0), 0),
      count: ws.length,
      allDone: ws.every(w => isDepositDone(w.depositStr, today, w.remitStatus)),
      hasExpected: ws.some(w => !isDepositDone(w.depositStr, today, w.remitStatus)),
    }));
    list.sort((a, b) => b.payYm.localeCompare(a.payYm));
    return { groups: list, pendingBucket };
  }, [weeks, today, remits]);

  const [openGroups, setOpenGroups] = useState({});
  useEffect(() => {
    setOpenGroups(prev => {
      const next = { ...prev };
      for (const g of groups.groups) {
        if (!(g.payYm in next)) next[g.payYm] = g.hasExpected;
      }
      return next;
    });
  }, [groups.groups]);

  // 입금 보고 lookup — (principal_id, week_start) → remit row
  const remitMap = useMemo(() => {
    const m = new Map(); // key = `${principal_id}|${week_start}`
    for (const r of remits) {
      m.set(`${r.principal_id}|${r.week_start}`, r);
    }
    return m;
  }, [remits]);

  function getRemitMapForWeek(weekMondayIso) {
    const sub = new Map();
    for (const r of remits) {
      if (r.week_start === weekMondayIso) sub.set(r.principal_id, r);
    }
    return sub;
  }

  // 보고 액션
  async function handleReport(week) {
    const weekStart = toIsoDate(week.monday);
    const weekEnd   = toIsoDate(week.sunday);
    // principal_id 측 그룹 — 측 principal 측 measurement 측 RPC 호출 (Promise.all)
    const byPrincipal = new Map();
    for (const it of week.items) {
      const pid = it.principal_id;
      if (!pid) continue;
      if (!byPrincipal.has(pid)) byPrincipal.set(pid, { sum: 0, code: null });
      const slot = byPrincipal.get(pid);
      // 회사 입금액 = ROUND(net_amount × 0.85). net_amount NULL → 0.
      slot.sum += companyAmountOf(it);
    }
    // principal_id → code 매핑 (principalCodes 측 catch 측 측 X → tasks JOIN 측 측 X)
    // 측 측 — items 측 측 principal_id 그대로 RPC 측 측 (markPrincipalRemitted 측 code 측 받음 → 측 측 측 측)
    // 측 측 measurement code 측 측 — fetchPrincipalSettleItems 측 측 principal_id 측 측. code 측 측 X.
    // → markPrincipalRemitted 측 principalId 측 측 측 측 X → principalRemitDb 측 principalCode 측 → principal_id 매핑
    // 측 — items 측 principal_id 측 catch 측 measurement, principalCodes prop 측 측 catch
    // 측 measurement (principal_id → code): principalCodes 측 측 1:1 측 X → fetch 측 측 catch
    const reverseMap = await resolvePidToCodeMap(principalCodes);

    const tasks = [];
    for (const [pid, slot] of byPrincipal) {
      const code = reverseMap.get(pid);
      if (!code) continue;
      tasks.push(markPrincipalRemitted({
        principalCode: code,
        weekStart, weekEnd,
        amount: slot.sum,
      }));
    }
    const results = await Promise.all(tasks);
    const failed = results.find(r => !r.ok);
    if (failed) {
      alert("보고 실패: " + (failed.error || "알 수 없는 오류"));
      return;
    }
    refresh();
  }

  async function handleUndo(remitIds) {
    const results = await Promise.all(remitIds.map(id => undoPrincipalRemit({ remitId: id })));
    const failed = results.find(r => !r.ok);
    if (failed) {
      alert("보고 취소 실패: " + (failed.error || "알 수 없는 오류"));
      return;
    }
    refresh();
  }

  const thisWeekMondayKey = getThisWeekMondayKey();

  if (loading) return <div style={{ padding: "40px 20px", textAlign: "center", color: C_GRAY, fontSize: 12 }}>불러오는 중...</div>;
  if (error)   return <div style={{ padding: "40px 20px", textAlign: "center", color: "#EF4444", fontSize: 12 }}>⚠️ {error}</div>;

  // 드릴인 뷰 — 2026-06-02 공유 컴포넌트 WeekSettleDetail (principal mode).
  if (selectedWeekKey) {
    const wk = weeks.find(w => w.key === selectedWeekKey);
    if (!wk) { setSelectedWeekKey(null); return null; }
    const weekRemits = wk.monday ? getRemitMapForWeek(toIsoDate(wk.monday)) : new Map();
    const isPending = wk.key === "pending";
    const remitStatus = isPending ? null : getWeekRemitStatus(wk.items, weekRemits);
    return (
      <WeekSettleDetail
        week={wk}
        actionMode="principal"
        remitStatus={remitStatus}
        onReport={() => handleReport(wk)}
        onUndo={() => {
          const ids = (remitStatus?.remits || []).map(r => r.id).filter(Boolean);
          if (ids.length > 0) return handleUndo(ids);
        }}
        onBack={() => { setSelectedWeekKey(null); setSearch(""); setStageFilter("all"); setDateFilter(""); }}
        // 2026-06-02 — payload 측 정보 전달 (사장님 spec — 김혜영 측 측 측 빈칸 측 catch).
        //   AdminTaskDetailScreen 측 full re-fetch 측 X → payload 측 측 정보 측 measure.
        //   id 측 partial 측 측 measure 측 X — task_no/phone/address/scheduled_at 등 측 측 전달 spec.
        onItemClick={onSelect ? (it) => onSelect({
          id:            it.task_id,
          task_no:       it.task_no,
          customer_name: it.customer_name,
          phone:         it.phone,
          address:       it.address,
          district:      it.district,
          scheduled_at:  it.scheduled_at,
          completed_at:  it.completed_at,
          received_at:   it.received_at,
          status:        it.task_status,
          principal_id:  it.principal_id,
        }) : null}
        search={search} setSearch={setSearch}
        stageFilter={stageFilter} setStageFilter={setStageFilter}
        dateFilter={dateFilter} setDateFilter={setDateFilter}
      />
    );
  }

  // 2026-05-26 — 기사 입금 내역 화면 (usol_n 측만 노출). 사장님 spec: settle 탭 측 카드 클릭 진입.
  if (showUsolHistory) {
    return <UsolRemitHistoryScreen onBack={() => setShowUsolHistory(false)}/>;
  }

  // usol_n principal 측 노출 — principalCodes 측 usol_n 포함 시만 진입 카드 표시
  const hasUsolN = Array.isArray(principalCodes) && principalCodes.includes("usol_n");

  // pending 묶음 존재 시 SummarySection 의 정산 대기 줄을 클릭 가능하게.
  //   클릭 → setSelectedWeekKey('pending') → WeekDetailView 측 catch 측 catch 426건 상세 진입.
  const hasPendingBucket = weeks.some(w => w.key === "pending");

  // 2026-06-11 — PC 분기 (1024px+, 유솔N 전용 시안). selectedWeekKey/showUsolHistory 분기 후라
  //   주차 드릴인 / 기사 입금 화면은 기존 모바일 분기로 그대로 진입 (회귀 0).
  if (isPc) {
    return (
      <ViewPcSettle
        summary={summary}
        groups={groups.groups}
        today={today}
        openGroups={openGroups}
        setOpenGroups={setOpenGroups}
        onWeekClick={(wk) => setSelectedWeekKey(wk.key)}
        onPendingClick={hasPendingBucket ? () => setSelectedWeekKey("pending") : null}
        hasUsolN={hasUsolN}
      />
    );
  }

  // 리스트 뷰
  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      <SummarySection
        summary={summary}
        onPendingClick={hasPendingBucket ? () => setSelectedWeekKey("pending") : null}
      />

      {/* 2026-05-26 — 기사 입금 내역 진입 카드 (usol_n 측만) */}
      {hasUsolN && (
        <div
          onClick={() => setShowUsolHistory(true)}
          className="clickable"
          style={{
            marginTop: 14,
            background: "var(--bg-elevated, #1F1F1F)",
            border: "1px solid var(--border, #2A2A2A)",
            borderRadius: 12,
            padding: "14px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer", gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 800,
              color: "var(--text-primary, #FAF8F5)",
              marginBottom: 3,
            }}>
              📥 기사 입금 내역
            </div>
            <div style={{ fontSize: 11, color: C_GRAY, fontWeight: 600 }}>
              세척 현장추가금 15% · 이번 달 기사별 보고 현황
            </div>
          </div>
          <span style={{ color: C_GRAY, fontSize: 18, fontWeight: 700 }}>›</span>
        </div>
      )}

      <div style={{ fontSize: 11, color: C_GRAY, margin: "18px 0 10px", fontWeight: 600 }}>
        주차별 정산
      </div>

      {/* 2026-06-02 — 월별(payYm) 아코디언 (운영자 ① 통일).
            pending 묶음 = SummarySection 측 클릭 spec (드릴인 진입). */}
      {groups.groups.length === 0 ? (
        <EmptyBox>정산 항목이 없습니다</EmptyBox>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {groups.groups.map(g => (
            <PrincipalGroupAccordion
              key={g.payYm}
              group={g}
              today={today}
              isOpen={!!openGroups[g.payYm]}
              onToggle={() => setOpenGroups(o => ({ ...o, [g.payYm]: !o[g.payYm] }))}
              onWeekClick={(wk) => setSelectedWeekKey(wk.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// principal_id → code 매핑 (1:1)
async function resolvePidToCodeMap(codes) {
  const { data } = await supabase.from("principals").select("id, code").in("code", codes);
  const m = new Map();
  for (const p of (data || [])) m.set(p.id, p.code);
  return m;
}

// 전체 현황 섹션 — 배경·테두리 없음 (시안 확정)
function SummarySection({ summary, onPendingClick }) {
  const steps = [
    { key: "received",   label: "접수",            value: summary.received },
    { key: "beforeWork", label: "일정 확정·작업 전", value: summary.beforeWork },
    { key: "doneWork",   label: "작업완료",         value: summary.doneWork },
  ];
  const clickable = typeof onPendingClick === "function" && summary.pendingCount > 0;
  return (
    <div style={{ padding: "4px 4px 0" }}>
      <div style={{ fontSize: 14, color: "var(--text-primary, #FAF8F5)", fontWeight: 800, marginBottom: 14 }}>
        전체 현황
      </div>

      {steps.map(s => <StepRow key={s.key} {...s} green={false} hasLineBelow={true}/>)}

      <div style={{ position: "relative", marginLeft: 4 }}>
        <div style={{ position: "absolute", left: 5, top: -8, width: 2, height: 18, background: C_DOT }}/>
        <div
          onClick={clickable ? onPendingClick : undefined}
          className={clickable ? "clickable" : ""}
          style={{
            marginLeft: 16, marginBottom: 6, marginTop: 10,
            background: "rgba(230,163,58,0.08)",
            borderLeft: `3px solid ${C_AMBER}`,
            borderRadius: 8, padding: "12px 14px",
            cursor: clickable ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C_AMBER, marginBottom: 4 }}>
              정산 대기 {summary.pendingCount}건
            </div>
            <div style={{ fontSize: 12, color: C_GRAY }}>
              작업 끝났는데 네이버 정산 전 · <span style={{ color: C_MAGENTA, fontWeight: 800, fontSize: 13 }}>
                ₩{summary.pendingAmount.toLocaleString()}
              </span>
            </div>
          </div>
          {clickable && (
            <span style={{ color: C_GRAY, fontSize: 18, fontWeight: 700, flexShrink: 0 }}>›</span>
          )}
        </div>
        <div style={{ position: "absolute", left: 5, bottom: -8, width: 2, height: 18, background: C_DOT }}/>
      </div>

      <StepRow label="정산완료" value={summary.settled} green={true} hasLineBelow={false}/>
    </div>
  );
}

function StepRow({ label, value, green, hasLineBelow }) {
  return (
    <div style={{ position: "relative", marginLeft: 4, paddingLeft: 18, paddingBottom: hasLineBelow ? 18 : 0, minHeight: 26 }}>
      <div style={{
        position: "absolute", left: 0, top: 8,
        width: 12, height: 12, borderRadius: "50%",
        background: green ? C_GREEN : C_DOT,
        border: green ? `2px solid ${C_GREEN}` : `2px solid ${C_DOT}`,
        boxShadow: green ? `0 0 0 3px rgba(93,202,165,0.18)` : "none",
      }}/>
      {hasLineBelow && (
        <div style={{
          position: "absolute", left: 5, top: 20, width: 2, height: "calc(100% - 20px)",
          background: C_DOT,
        }}/>
      )}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, color: "var(--text-primary, #FAF8F5)", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary, #FAF8F5)", fontFamily: "inherit", lineHeight: 1 }}>
          {value.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// 2026-06-02 — 월별(payYm) 아코디언 + 주차 카드 (deposit 기준 시각 + 동적 월 칸).
//   운영자 ① (UsolNToCompanySection) 와 동일 spec (공유 모듈 헬퍼).
function PrincipalGroupAccordion({ group, today, isOpen, onToggle, onWeekClick }) {
  const [y, m] = group.payYm.split("-").map(Number);
  const monthLabel = `${y}년 ${m}월`;
  const headerColor = group.allDone ? C_GREEN_DONE : C_PINK_DEPOSIT;

  return (
    <div style={{
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", padding: "12px 14px",
          background: "transparent", border: "none",
          color: "var(--text-primary, #FAF8F5)",
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 11, color: C_GRAY, fontWeight: 700, width: 12, display: "inline-block",
            transition: "transform 0.15s",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
          }}>▶</span>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{monthLabel}</span>
          <span style={{ fontSize: 11, color: C_GRAY }}>{group.count}주</span>
          {group.allDone && <Check size={13} strokeWidth={3} style={{ color: C_GREEN_DONE }}/>}
        </div>
        <span style={{
          fontSize: 16, fontFamily: "inherit", fontWeight: 800,
          color: headerColor, lineHeight: 1,
        }}>
          ₩{group.total.toLocaleString()}
        </span>
      </button>
      {isOpen && (
        <div style={{
          padding: "0 10px 10px",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {group.weeks.map(wk => (
            <PrincipalWeekCard
              key={wk.key}
              week={wk}
              today={today}
              onClick={() => onWeekClick(wk)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 2026-06-09 — week.remitStatus 는 groups useMemo 에서 사전 계산되어 전달.
//   isDepositDone / depositStatusLabel 에 그대로 위임 (컷오프 분기 내장).
function PrincipalWeekCard({ week, today, onClick }) {
  const remitStatus = week.remitStatus || null;
  const isDone = isDepositDone(week.depositStr, today, remitStatus);
  const total = week.displayWeeklyTotal || 0;
  const count = week.displayNaverCount || 0;
  const weekLabel = getKoreanWeekLabel(week.monday, week.sunday);
  // 2026-06-02 — string-based 측 (KST 측 timezone-safe). week.mondayStr / sundayStr 측 fallback Date.
  const dateRange = week.mondayStr && week.sundayStr
    ? `${mdLabel(week.mondayStr)} ~ ${mdLabel(week.sundayStr)}`
    : `${formatMD(week.monday)} ~ ${formatMD(week.sunday)}`;
  const statusText = depositStatusLabel(week.depositStr, today, remitStatus);
  const monthlyEntries = getMonthlyEntriesOf(week);
  const amountColor = isDone ? C_GREEN_DONE : C_PINK_DEPOSIT;

  return (
    <div onClick={onClick} style={{
      background: "var(--bg-secondary, #1A1A1A)",
      border: isDone ? "1px solid var(--border, #2A2A2A)" : `2px solid ${C_PINK_DEPOSIT}`,
      borderRadius: 10,
      padding: "12px 14px",
      cursor: "pointer",
    }}>
      {/* 헤더 — 주 라벨 + 정산 건수 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary, #FAF8F5)" }}>{weekLabel}</span>
          <span style={{ fontSize: 11, color: C_GRAY }}>{dateRange}</span>
        </div>
        <span style={{ fontSize: 11, color: C_GRAY, whiteSpace: "nowrap" }}>네이버 정산 {count}건</span>
      </div>
      {/* 메인 — 시각 + 금액 */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: amountColor,
          display: "inline-flex", alignItems: "center", gap: 4,
          whiteSpace: "nowrap",
        }}>
          {isDone && <Check size={12} strokeWidth={3}/>}
          {statusText}
        </span>
        <span style={{
          fontSize: 17, fontWeight: 800, color: amountColor,
          fontFamily: "inherit", lineHeight: 1,
        }}>
          ₩{total.toLocaleString()}
        </span>
      </div>
      {/* 동적 월 칸 (양수만, 최신=핑크/이전=회색) */}
      {monthlyEntries.length > 0 && (
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: "1px dashed var(--border)",
          display: "grid",
          gridTemplateColumns: `repeat(${monthlyEntries.length}, 1fr)`,
          gap: 8, fontSize: 11,
        }}>
          {monthlyEntries.map(({ ym, amount }, idx) => {
            const isLatest = idx === monthlyEntries.length - 1;
            return (
              <MonthSplitItem
                key={ym}
                dotColor={isLatest ? C_PINK_DEPOSIT : C_GRAY_BAR}
                label={ymLabel(ym)}
                amount={amount}
                highlight={isLatest}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function MonthSplitItem({ dotColor, label, amount, highlight }) {
  return (
    <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
      <span style={{
        width: 6, height: 6, borderRadius: 1,
        background: dotColor, display: "inline-block", flexShrink: 0,
      }}/>
      <span style={{ color: C_GRAY, fontSize: 10 }}>{label}</span>
      <span style={{
        fontFamily: "inherit", fontWeight: 700,
        color: highlight ? C_PINK_DEPOSIT : C_GRAY,
        fontSize: 11,
      }}>
        ₩{(amount || 0).toLocaleString()}
      </span>
    </span>
  );
}


function EmptyBox({ children }) {
  return (
    <div style={{
      padding: "40px 20px", textAlign: "center",
      color: C_GRAY, fontSize: 12,
      background: "var(--bg-secondary, #1A1A1A)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 8,
    }}>{children}</div>
  );
}

// ============================================================
// 2026-06-11 — PC 정산 화면 (유솔N 전용 시안 확정안 — 2차 재구성)
//   ViewPcTable 톤 그대로 (다크 + 핑크).
//   상단 2열: 좌 = 월별 정산 추이 막대 / 우 = 메트릭 카드 2x2 + 정산대기 배너.
//   하단 2열: 좌 = 주차별 정산 표 / 우 = 기사 입금내역.
//   상시 우측 aside 폐기 — selectedTask 상세 패널 자리 확보.
//   1024px 좁을 때 grid auto-fit 으로 세로 1열 wrap (반응형 자연 전환).
// ============================================================
function ViewPcSettle({
  summary, groups, today, openGroups, setOpenGroups,
  onWeekClick, onPendingClick, hasUsolN,
}) {
  // 라벨 축약 (옛 "일정 확정·작업 전" 줄바꿈 catch).
  const metrics = [
    { key: "received",   label: "접수",       value: summary.received },
    { key: "beforeWork", label: "확정·작업전", value: summary.beforeWork },
    { key: "doneWork",   label: "작업완료",   value: summary.doneWork },
    { key: "settled",    label: "정산완료",   value: summary.settled, green: true },
  ];

  // 월별 추이 — groups.payYm 그대로 사용 (신규 fetch 0건. 모바일과 동일 source).
  //   현재 KST 기준 최근 3개월 (이전 2개월 + 이번 달).
  //   groups 의 .total = 해당 입금월 합계. 모바일 월별 아코디언 헤더 금액과 정합.
  const trendBars = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ ym, label: `${d.getMonth() + 1}월` });
    }
    const byYm = new Map(groups.map(g => [g.payYm, g]));
    return months.map(m => ({
      ym: m.ym,
      label: m.label,
      amount: byYm.get(m.ym)?.total || 0,
    }));
  }, [groups]);
  const trendMax = Math.max(1, ...trendBars.map(b => b.amount));

  return (
    <div style={{
      width: "100%",
      padding: "20px 24px 24px",
      minHeight: "100vh",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: 24,
    }}>
      {/* 상단 row — 추이 차트 + 메트릭/배너. auto-fit minmax(400, 1fr) → 좁으면 세로. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
        gap: 24,
        alignItems: "stretch",
      }}>
        {/* 좌 — 월별 정산 추이 (가로 막대, 최근 3개월).
            2026-06-11 — alignSelf: "start" 박스 높이를 콘텐츠만큼만 차지 (옆 칸 stretch 무시). */}
        <div style={{
          background: "var(--bg-elevated, #1F1F1F)",
          border: "1px solid var(--border, #2A2A2A)",
          borderRadius: 12,
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minWidth: 0,
          alignSelf: "start",
        }}>
          <div style={{ fontSize: 14, color: C_GRAY, fontWeight: 700 }}>
            월별 정산 추이
          </div>
          <MonthlyTrendChart bars={trendBars} max={trendMax}/>
        </div>

        {/* 우 — 메트릭 2x2 + 정산대기 배너 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
          }}>
            {metrics.map(m => <MetricCard key={m.key} {...m}/>)}
          </div>
          {summary.pendingCount > 0 && (
            <PendingBanner summary={summary} onClick={onPendingClick}/>
          )}
        </div>
      </div>

      {/* 하단 row — 주차별 표 + 기사 입금내역. auto-fit minmax(420, 1fr) → 좁으면 세로. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
        gap: 24,
        alignItems: "flex-start",
      }}>
        {/* 좌 — 주차별 정산 표 */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            color: C_GRAY,
            fontWeight: 700,
            margin: "0 0 10px 4px",
          }}>
            주차별 정산
          </div>
          {groups.length === 0 ? (
            <EmptyBox>정산 항목이 없습니다</EmptyBox>
          ) : (
            <div style={{
              background: "var(--bg-elevated, #1F1F1F)",
              border: "1px solid var(--border, #2A2A2A)",
              borderRadius: 12,
              overflow: "hidden",
            }}>
              {/* 헤더 — TEXT.HEADER 토큰 적용 (내 작업 컬럼 헤더와 통일). */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 1fr",
                padding: "14px 18px",
                borderBottom: `1px solid var(--border, #2A2A2A)`,
                background: "var(--bg-secondary, #1A1A1A)",
                fontSize: TEXT.HEADER,
                fontWeight: 800,
                color: C_GRAY,
                textAlign: "center",
              }}>
                <div style={{ textAlign: "left" }}>월·주차</div>
                <div>상태</div>
                <div style={{ textAlign: "right" }}>금액</div>
              </div>
              {/* 월별 그룹 */}
              {groups.map(g => (
                <PcMonthGroup
                  key={g.payYm}
                  group={g}
                  today={today}
                  isOpen={!!openGroups[g.payYm]}
                  onToggle={() => setOpenGroups(o => ({ ...o, [g.payYm]: !o[g.payYm] }))}
                  onWeekClick={onWeekClick}
                />
              ))}
            </div>
          )}
        </div>

        {/* 우 — 기사 입금내역 (usol_n 포함 시만). 헤더 뒤로가기 X (embedded). */}
        {hasUsolN && (
          <div style={{
            background: "var(--bg-elevated, #1F1F1F)",
            border: "1px solid var(--border, #2A2A2A)",
            borderRadius: 12,
            padding: "4px 0",
            minWidth: 0,
            maxHeight: 720,
            overflowY: "auto",
            boxSizing: "border-box",
          }}>
            <UsolRemitHistoryScreen />
          </div>
        )}
      </div>
    </div>
  );
}

// 메트릭 카드 (2x2 grid 측 사용)
function MetricCard({ label, value, green }) {
  return (
    <div style={{
      background: "var(--bg-secondary, #1A1A1A)",
      border: `1px solid ${green ? C_GREEN : "var(--border, #2A2A2A)"}`,
      borderRadius: 12,
      padding: "16px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      minWidth: 0,
    }}>
      <div style={{
        fontSize: TEXT.META,
        color: C_GRAY,
        fontWeight: 700,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>{label}</div>
      <div style={{
        fontSize: TEXT.METRIC,
        fontWeight: 800,
        color: green ? C_GREEN : "var(--text-primary, #FAF8F5)",
        fontFamily: "inherit",
        lineHeight: 1.1,
      }}>{value.toLocaleString()}</div>
    </div>
  );
}

// 정산 대기 배너 (메트릭 카드 아래)
function PendingBanner({ summary, onClick }) {
  return (
    <div
      onClick={onClick || undefined}
      className={onClick ? "clickable" : ""}
      style={{
        background: "rgba(230,163,58,0.08)",
        borderLeft: `4px solid ${C_AMBER}`,
        border: `1px solid rgba(230,163,58,0.25)`,
        borderRadius: 10,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div>
        <div style={{ fontSize: TEXT.BODY, fontWeight: 800, color: C_AMBER, marginBottom: 4 }}>
          정산 대기 {summary.pendingCount}건
        </div>
        <div style={{ fontSize: TEXT.META, color: C_GRAY }}>
          작업 끝났는데 네이버 정산 전 · <span style={{ color: C_MAGENTA, fontWeight: 800, fontSize: TEXT.STATUS }}>
            ₩{summary.pendingAmount.toLocaleString()}
          </span>
        </div>
      </div>
      {onClick && (
        <span style={{ color: C_GRAY, fontSize: 18, fontWeight: 700 }}>›</span>
      )}
    </div>
  );
}

// 월별 정산 추이 — 가로 막대 (다크/라이트 양쪽 대응).
//   각 행 = [월 라벨 30px] [트랙 바 flex:1] [금액 우측정렬].
//   당월 (KST 현재 월) 만 포인트 핑크 + 월·금액 라벨 핑크.
//   지난 달 = 무채색 회색. 트랙은 더 연한 회색.
//   다크 핑크 #D4537E / 라이트 핑크 #993556.
//   다크 회색 #3A3A42 / 라이트 회색 #D8D6CC.
//   bars[].amount → max 대비 % 길이. min 2% 가시성.
function MonthlyTrendChart({ bars, max }) {
  const isDark = useIsDark();

  // KST 현재 월 (YYYY-MM) — 하드코딩 없이 동적 판정.
  const nowKstYm = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric", month: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find(p => p.type === "year")?.value;
    const m = parts.find(p => p.type === "month")?.value;
    return `${y}-${m}`;
  }, []);

  const colorPink    = isDark ? "#D4537E" : "#993556";
  const colorGray    = isDark ? "#3A3A42" : "#D8D6CC";
  const colorTrack   = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const colorTextSec = isDark ? "#9CA3AF" : "#6F6A60";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {bars.map(b => {
        const isCurrent = b.ym === nowKstYm;
        const pct = max > 0 && b.amount > 0
          ? Math.max(2, (b.amount / max) * 100)
          : 0;
        const accent = isCurrent ? colorPink : colorGray;
        const labelColor = isCurrent ? colorPink : colorTextSec;
        return (
          <div key={b.ym} style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}>
            {/* 월 라벨 */}
            <div style={{
              width: 30,
              fontSize: 13,
              fontWeight: 800,
              color: labelColor,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}>
              {b.label}
            </div>
            {/* 트랙 + 채움 */}
            <div style={{
              flex: 1,
              height: 12,
              background: colorTrack,
              borderRadius: 6,
              overflow: "hidden",
              minWidth: 0,
            }}>
              <div style={{
                width: `${pct}%`,
                height: "100%",
                background: accent,
                borderRadius: 6,
                transition: "width 0.3s ease",
              }}/>
            </div>
            {/* 금액 */}
            <div className="mono" style={{
              fontSize: 12,
              fontWeight: 700,
              color: labelColor,
              fontFamily: "inherit",
              textAlign: "right",
              minWidth: 86,
              whiteSpace: "nowrap",
              flexShrink: 0,
              letterSpacing: "-0.2px",
            }}>
              {b.amount > 0 ? `₩${b.amount.toLocaleString()}` : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// PC 표용 월별 그룹 row (ViewPcTable 톤 — 행 호버, 가운데 정렬)
function PcMonthGroup({ group, today, isOpen, onToggle, onWeekClick }) {
  const [y, m] = group.payYm.split("-").map(Number);
  const monthLabel = `${y}년 ${m}월`;
  const headerColor = group.allDone ? C_GREEN_DONE : C_PINK_DEPOSIT;

  return (
    <div style={{ borderBottom: "1px solid var(--border, #2A2A2A)" }}>
      {/* 월 헤더 */}
      <div
        onClick={onToggle}
        className="clickable"
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr",
          padding: "14px 18px",
          alignItems: "center",
          cursor: "pointer",
          background: isOpen ? "rgba(255,77,158,0.04)" : "transparent",
          textAlign: "center",
        }}
      >
        <div style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: C_GRAY, fontSize: TEXT.STATUS, fontWeight: 700 }}>
            {isOpen ? "▼" : "▶"}
          </span>
          <span style={{ fontSize: TEXT.BODY, fontWeight: 800, color: headerColor }}>
            {monthLabel}
          </span>
          <span style={{ fontSize: TEXT.STATUS, color: C_GRAY, fontWeight: 600 }}>
            ({group.count}주차)
          </span>
        </div>
        <div>
          <span style={{
            fontSize: TEXT.STATUS, fontWeight: 700,
            color: group.allDone ? C_GREEN_DONE : C_AMBER,
          }}>
            {group.allDone ? "전부 입금완료" : "대기 포함"}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{
            fontSize: TEXT.BODY, fontWeight: 800,
            color: C_MAGENTA,
            fontFamily: "inherit",
          }}>
            ₩{group.total.toLocaleString()}
          </span>
        </div>
      </div>
      {/* 주차 row 펼침 */}
      {isOpen && group.weeks.map(w => {
        const status = w.remitStatus;
        const done = isDepositDone(w.depositStr, today, status);
        const statusLabel = depositStatusLabel(w.depositStr, today, status);
        const statusColor = done ? C_GREEN : C_AMBER;
        return (
          <div
            key={w.key}
            onClick={() => onWeekClick(w)}
            className="clickable"
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr",
              padding: "13px 18px 13px 36px",
              alignItems: "center",
              cursor: "pointer",
              borderTop: "1px solid var(--border, #2A2A2A)",
              fontSize: TEXT.BODY,
              textAlign: "center",
            }}
          >
            <div style={{ textAlign: "left", color: "var(--text-primary, #FAF8F5)", fontWeight: 700 }}>
              {`${w.monday?.getMonth() + 1}월 ${w.week ?? "-"}주차`}
              <span style={{ marginLeft: 8, fontSize: TEXT.STATUS, color: C_GRAY, fontWeight: 600 }}>
                {w.monthDay}
              </span>
            </div>
            <div>
              <span style={{
                fontSize: TEXT.STATUS,
                fontWeight: 800,
                color: statusColor,
                background: done ? "rgba(93,202,165,0.12)" : "rgba(230,163,58,0.14)",
                padding: "5px 11px",
                borderRadius: 999,
              }}>
                {statusLabel}
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{
                fontSize: TEXT.BODY, fontWeight: 700,
                color: "var(--text-primary, #FAF8F5)",
                fontFamily: "inherit",
              }}>
                ₩{(w.displayWeeklyTotal || 0).toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default PrincipalSettleTab;

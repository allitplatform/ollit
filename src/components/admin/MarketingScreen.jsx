// 2026-07-24 — 마케팅 조감 화면 (운영자 PC).
//   1단계: DB 기반 3블록.
//     ① 홈페이지 접수 퍼널  — 총 접수(스팸 포함) / 유효(converted) / 완료 + 스팸률·취소율.
//     ② 완료 매출·회사이익  — 홈페이지 유입 완료 작업만 필터. 기간: completed_at.
//     ③ 지역 top5           — 홈페이지 유입 task 주소 집계 (미상 제외). 기간: created_at.
//   2단계 (2026-07-25): 네이버 검색광고 API 연동 → 블록④ 활성화.
//     GET /api/ad-report?since&until&actor. salesAmt VAT 별도 → 클라에서 ×1.1 로 실청구액 CPA.
//     CPA vs 완료 1건당 회사이익 비교 (초록=남는 장사, 빨강=적자).
//   ⚠️ 2026-07-25 정정 — 블록④ CPA 분모 교체.
//     기존: 홈페이지 폼(inquiries) 완료건. 이건 자체 유입의 일부일 뿐이다.
//     전화·당근·네이버쇼핑 유입이 전부 "올데이케어" 원청으로 들어오므로 폼 기준 분모는
//     실제의 약 1/3 이었고, 그 결과 흑자인 광고가 적자로 표시됐다 (7월: 92건 vs 실제 319건).
//     → 광고 CPA 분모 = principalCode === "allday" 완료건 (자체 유입 전체).
//     블록①②③ 은 "홈페이지 폼" 분석이므로 그대로 둔다 (성격이 다름).
//   3단계 (2026-07-25): 블록⑤ 일별 광고비 vs 자체유입 대조.
//     유입경로(tasks.channel) 미기록 상태에서 광고 기여분을 역산하기 위한 화면.
//     광고비 하위 1/3 일자의 평균 접수 = "자연유입 기준선", 그 위 초과분 = 광고 기여 추정.

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { todayYmd, toKstYmd } from "../../utils/dateLabel.js";
import { listInquiries } from "../../lib/inquiriesDb.js";
import { parseRegion } from "../../utils/regionParser.js";
import { computeRevenueByYmRange } from "../../utils/revenueStats.js";
import { canSeeField } from "../../data/permissions.js";

// 자체 유입(직영) 원청 코드. 홈페이지·전화·당근·네이버쇼핑 등 우리가 직접 딴 건이 전부 여기로 들어온다.
const SELF_PRINCIPAL_CODE = "allday";

const PERIOD_OPTS = [
  { id: "today", label: "오늘" },
  { id: "week",  label: "이번주" },
  { id: "month", label: "이번달" },
];

function _startOfWeekMonYmd() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function _startOfMonthYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function _rangeForPeriod(period) {
  const today = todayYmd();
  if (period === "today") return { start: today,                end: today };
  if (period === "week")  return { start: _startOfWeekMonYmd(), end: today };
  if (period === "month") return { start: _startOfMonthYmd(),   end: today };
  return { start: today, end: today };
}

// 네이버 키워드도구는 '같이 검색되는 단어' 를 준다. 그래서 삼성서비스센터·붙박이장 같은
// 우리 장사와 무관한 단어가 검색량 상위를 다 차지한다. 여기서 걸러낸다.
const _KW_BUY  = /(추천|구입|구매|렌탈|렌털|중고|판매|매장|가격비교|신제품|얼마|스탠드형|리모컨|사용법|전기세|평수|자동차|차량|버스|트럭|화물|캠핑|셀프|커버|받침|거치대|보관|이사)/;
const _KW_ASC  = /(서비스센터|as센터|무상|보증|as$|as[^a-z]|삼성전자|엘지전자)/i;
const _KW_WORK = /(충전|냉매|가스|청소|세척|수리|고장|안시원|시원하지|안나와|안나옴|안됨|물떨어|누수|냄새|곰팡이|점검|실외기|필터|얼음|결빙|에러|안돌아|약해|냉방|배수|드레인|살균|분해)/;

// work = 우리 일 · as = 제조사 AS 찾는 사람(애매) · etc = 무관
function _kwClass(word) {
  const w = String(word || "");
  if (_KW_BUY.test(w))  return "etc";
  if (_KW_ASC.test(w))  return "as";
  if (_KW_WORK.test(w)) return "work";
  return "etc";
}

function _fmtKRW(n) {
  return Number(n || 0).toLocaleString("ko-KR");
}
function _pctText(num, den) {
  if (!den) return "0.0%";
  return ((num / den) * 100).toFixed(1) + "%";
}

export function MarketingScreen({ t, apiTasks = [], user, onBack }) {
  // 2026-07-25 — 기본 "이번달". "오늘"이면 오늘 접수→오늘 완료가 사실상 없어 항상 N/0/0 표기됨.
  const [period, setPeriod] = useState("month");
  const [showDailyTable, setShowDailyTable] = useState(false);
  const [kwShowAll, setKwShowAll] = useState(false);
  const [showKwTable, setShowKwTable] = useState(false);

  // ⑦ 검색량 조회 — 씨앗 단어를 네이버에 던져 연관 키워드를 검색량과 함께 받는다.
  const [seeds, setSeeds] = useState("에어컨청소,에어컨세척,에어컨가스충전,벽걸이에어컨청소,시스템에어컨청소");
  const [tool, setTool] = useState(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [toolError, setToolError] = useState("");
  const [toolOnlyMissing, setToolOnlyMissing] = useState(true);
  const [toolWorkOnly, setToolWorkOnly] = useState(true);
  const [toolShowAll, setToolShowAll] = useState(false);
  // 2026-07-25 — 스팸 포함 모든 status (null = 전체) 를 1회 호출로. 클라에서 status 별 분류.
  const [allInquiries, setAllInquiries] = useState([]);
  // converted inquiries 의 task_id Set — 홈페이지 유입 task 판별 진실 소스 (v3).
  const [homepageTaskIds, setHomepageTaskIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const actorId = user?.user_id || user?.id;
    if (!actorId) {
      setAllInquiries([]);
      setHomepageTaskIds(new Set());
      setLoading(false);
      return () => { alive = false; };
    }
    listInquiries(actorId, null).then(rows => {
      if (!alive) return;
      const list = rows || [];
      setAllInquiries(list);
      const ids = new Set();
      for (const r of list) {
        if (r.status === "converted" && r.task_id) ids.add(String(r.task_id));
      }
      setHomepageTaskIds(ids);
      setLoading(false);
    }).catch(e => {
      if (!alive) return;
      setError(String(e?.message || e));
      setAllInquiries([]);
      setHomepageTaskIds(new Set());
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user?.user_id, user?.id]);

  const { start, end } = useMemo(() => _rangeForPeriod(period), [period]);

  // ── 블록 ① — 접수 퍼널 (기간: inquiries.created_at 기준) ─────────────────────
  //   총 접수(스팸 포함) → 유효(converted) → 완료. 스팸률 별도 표기.
  //   new/contacted 는 구조적으로 0(운영 흐름상 즉시 converted/spam) — "전환율" 지표 폐기.
  const funnel = useMemo(() => {
    const inRange = (allInquiries || []).filter(x => {
      const c = x.created_at || x.createdAt;
      if (!c) return false;
      const k = toKstYmd(c);
      return k && k >= start && k <= end;
    });
    const total     = inRange.length;
    const spam      = inRange.filter(x => x.status === "spam").length;
    const converted = inRange.filter(x => x.status === "converted" && x.task_id);
    // converted → 실제 task 조회. status 로 완료/취소 판정.
    const taskById = new Map();
    for (const t2 of (apiTasks || [])) {
      if (t2 && t2.id) taskById.set(String(t2.id), t2);
    }
    let completed = 0;
    let canceled  = 0;
    for (const cv of converted) {
      const tk = taskById.get(String(cv.task_id));
      if (!tk) continue;
      const st = tk.status || "";
      // 2026-07-25 — 취소를 먼저 배제. DB에 status='취소'인데 completed_at 이 남은 task 18건 실재 →
      //   기존 (st === "완료" || tk.completedAt || tk.completed_at) 이 취소를 완료로 이중 계상.
      if (st === "취소") { canceled += 1; continue; }
      if (st === "완료" || tk.completedAt || tk.completed_at) completed += 1;
    }
    return {
      total,
      spam,
      valid: converted.length,
      completed,
      canceled,
    };
  }, [allInquiries, apiTasks, start, end]);

  // ── 블록 ② — 완료 매출·회사이익 (기간: completed_at 기준) ────────────────────
  //   apiTasks 를 homepageTaskIds 로 미리 필터 → computeRevenueByYmRange 통과.
  const revenue = useMemo(() => {
    if (!canSeeField(user, "task.total_amount")) return null;
    const filtered = (apiTasks || []).filter(t2 => t2 && t2.id && homepageTaskIds.has(String(t2.id)));
    return computeRevenueByYmRange(filtered, start, end, user);
  }, [apiTasks, homepageTaskIds, start, end, user]);

  // ── 자체 유입(올데이케어 원청) 완료 실적 — 블록④ CPA 의 분모 ────────────────
  //   2026-07-25 정정. 광고는 폼 접수만 만드는 게 아니라 전화·당근·네이버쇼핑 유입도 만든다.
  //   그 전부가 올데이케어 원청으로 들어오므로 광고 성과의 분모는 이쪽이 맞다.
  //   ⚠️ 한계: 유입경로(tasks.channel) 가 기록되지 않아, 이 중 몇 건이 광고에서 왔는지는
  //   아직 알 수 없다. 따라서 아래 CPA 는 "가장 유리하게 본 값"(하한 CPA)이다.
  const selfTasks = useMemo(() => (apiTasks || []).filter(t2 => {
    if (!t2) return false;
    const code = t2.principalCode || t2.principal_code || "";
    return code === SELF_PRINCIPAL_CODE;
  }), [apiTasks]);

  const selfRevenue = useMemo(() => {
    if (!canSeeField(user, "task.total_amount")) return null;
    return computeRevenueByYmRange(selfTasks, start, end, user);
  }, [selfTasks, start, end, user]);

  // ── 블록 ③ — 지역 top5 (기간: task.created_at 기준, 홈페이지 유입만) ────────
  //   2026-07-25 — "미상"(주소 파싱 실패) 은 순위에서 제외하고 하단에 별도 표기.
  const regionTop5 = useMemo(() => {
    const tasksInRange = (apiTasks || []).filter(x => {
      if (!x || x.status === "취소") return false;
      if (!homepageTaskIds.has(String(x.id))) return false;
      const c = x.createdAt || x.created_at || x.receivedAt || x.received_at;
      if (!c) return false;
      const k = toKstYmd(c);
      return k && k >= start && k <= end;
    });
    const map = new Map();
    let unknown = 0;
    for (const tk of tasksInRange) {
      const addr = tk.address || tk.fullAddress || tk.주소 || "";
      const { key, label } = parseRegion(addr);
      if (key === "미상") { unknown += 1; continue; }
      if (!map.has(key)) map.set(key, { key, label, count: 0 });
      map.get(key).count += 1;
    }
    const sorted = [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    const rankedTotal = tasksInRange.length - unknown;
    return { rows: sorted.slice(0, 5), total: rankedTotal, unknown, grandTotal: tasksInRange.length };
  }, [apiTasks, homepageTaskIds, start, end]);

  const cancelRate = funnel.valid > 0
    ? _pctText(funnel.canceled, funnel.valid)
    : "-";
  const spamRate = funnel.total > 0
    ? _pctText(funnel.spam, funnel.total)
    : "-";

  // ── 블록 ④ — 네이버 검색광고 (기간: since~until, KST) ───────────────────────
  //   salesAmt 는 VAT 별도 → ×1.1 로 실청구액 산출. CPA 는 실청구액 기준.
  const [ad, setAd] = useState(null);          // { ok, cost, clicks, impressions, cpc, ctr, ... } | null
  const [adLoading, setAdLoading] = useState(false);
  const [adError, setAdError]     = useState("");

  useEffect(() => {
    let alive = true;
    const actorId = user?.user_id || user?.id;
    if (!actorId) { setAd(null); return () => { alive = false; }; }
    setAdLoading(true);
    setAdError("");
    fetch(`/api/ad-report?since=${encodeURIComponent(start)}&until=${encodeURIComponent(end)}&actor=${encodeURIComponent(actorId)}&daily=1&keywords=1`)
      .then(r => r.json())
      .then(j => {
        if (!alive) return;
        setAd(j || null);
        setAdLoading(false);
      })
      .catch(e => {
        if (!alive) return;
        setAdError(String(e?.message || e));
        setAd(null);
        setAdLoading(false);
      });
    return () => { alive = false; };
  }, [user?.user_id, user?.id, start, end]);

  // ── 블록 ⓪ — 지금 실시간 (오늘 광고비 + 실접수 + 자동입찰 생존) ──────────────
  //   기간 필터와 무관하게 항상 '오늘'. 5분마다 자동 갱신.
  const [liveAd, setLiveAd] = useState(null);
  useEffect(() => {
    let alive = true;
    const actorId = user?.user_id || user?.id;
    if (!actorId) return () => { alive = false; };
    const load = () => {
      const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      fetch(`/api/ad-report?since=${today}&until=${today}&actor=${encodeURIComponent(actorId)}&live=1`)
        .then(r => r.json())
        .then(j => { if (alive) setLiveAd(j && j.ok ? j : null); })
        .catch(() => { if (alive) setLiveAd(null); });
    };
    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(iv); };
  }, [user?.user_id, user?.id]);

  const runKeywordTool = () => {
    const actorId = user?.user_id || user?.id;
    if (!actorId) { setToolError("로그인 정보 없음"); return; }
    const list = seeds.split(",").map(x => x.trim()).filter(Boolean);
    if (list.length === 0) { setToolError("씨앗 단어를 하나 이상 넣으세요"); return; }
    setToolLoading(true); setToolError(""); setToolShowAll(false);
    fetch(`/api/ad-report?since=${encodeURIComponent(start)}&until=${encodeURIComponent(end)}`
        + `&actor=${encodeURIComponent(actorId)}&tool=1&seeds=${encodeURIComponent(list.join(","))}`)
      .then(r => r.json())
      .then(j => {
        if (j && j.ok && j.tool) { setTool(j.tool); }
        else { setTool(null); setToolError(String(j?.error || "조회 실패")); }
        setToolLoading(false);
      })
      .catch(e => { setTool(null); setToolError(String(e?.message || e)); setToolLoading(false); });
  };

  // 표에 실제로 그릴 줄. '없는 것만' 필터 + 기본 40줄.
  const toolRows = useMemo(() => {
    const all = (tool?.rows || []).map(r => ({ ...r, cls: _kwClass(r.keyword) }));
    const work = all.filter(r => r.cls === "work");
    // 헤드라인 숫자는 '우리 일 관련' 만으로 센다. 안 그러면 삼성서비스센터 70만이 다 먹는다.
    const workMissing = work.filter(r => !r.registered);
    const head = {
      count: workMissing.length,
      vol:   workMissing.reduce((a, b) => a + Number(b.total || 0), 0),
      noise: all.length - work.length,
    };
    let f = toolWorkOnly ? work : all;
    if (toolOnlyMissing) f = f.filter(r => !r.registered);
    return { all, filtered: f, view: toolShowAll ? f : f.slice(0, 40), head };
  }, [tool, toolOnlyMissing, toolWorkOnly, toolShowAll]);

  const adCostVat        = ad?.ok ? Math.round(Number(ad.cost || 0) * 1.1) : 0;
  // 2026-07-25 정정 — 분모: 홈페이지 폼 완료건(funnel.completed) → 자체유입 완료건(selfRevenue.count)
  const selfCount        = selfRevenue?.count || 0;
  const cpaVat           = ad?.ok && selfCount > 0
    ? Math.round(adCostVat / selfCount)
    : null;
  const profitPerJob     = selfRevenue && selfCount > 0
    ? Math.round(Number(selfRevenue.owner || 0) / selfCount)
    : null;
  const cpaVerdictColor  = (cpaVat != null && profitPerJob != null)
    ? (cpaVat < profitPerJob ? "#16A34A" : "#DC2626")
    : null;

  // ⓪ 지금 실시간 — 화면에 그릴 값 (profitPerJob 계산 이후에 있어야 함)
  const liveView = useMemo(() => {
    if (!liveAd) return null;
    // 비즈머니 실시간(0시 잔액−지금 잔액)이 있으면 그걸 우선 — 보고서 API는 1~2시간 지연됨
    const rawCost = liveAd.live?.spendRealtime != null
      ? Math.max(Number(liveAd.live.spendRealtime), Number(liveAd.cost || 0))
      : Number(liveAd.cost || 0);
    const costVat = Math.round(rawCost * 1.1);
    const jobs = liveAd.live?.jobsToday ?? null;
    const per = jobs > 0 ? Math.round(costVat / jobs) : null;
    const goal = profitPerJob != null ? profitPerJob : 65000;
    // 페이스: 광고 시간 08~20시 기준, 지금까지 속도로 마감 예상
    const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
    const kstH = kstNow.getUTCHours() + kstNow.getUTCMinutes() / 60;
    const ran = Math.min(Math.max(kstH - 8, 0.25), 12);
    const proj = kstH < 20 ? Math.round(costVat * 12 / ran) : costVat;
    let verdict;
    if (per != null && per <= goal * 0.6)      verdict = { label: "더 써도 됨",    color: "#16A34A" };
    else if (per != null && per <= goal)       verdict = { label: "적정",          color: "#D97706" };
    else if (per != null)                      verdict = { label: "밑지는 중",     color: "#DC2626" };
    else if (costVat >= goal)                  verdict = { label: "접수 0 — 확인", color: "#DC2626" };
    else                                       verdict = { label: "아직 이름",     color: "#94A3B8" };
    const lr = liveAd.live?.lastRun;
    const lrMin = lr ? Math.round((Date.now() - new Date(lr.at).getTime()) / 60000) : null;
    return { costVat, jobs, per, goal, proj, verdict, lrMin, lrWatched: lr?.watched };
  }, [liveAd, profitPerJob]);
  // 손익분기 건수 — 광고비를 회수하는 데 필요한 최소 완료건 수.
  //   자체유입 중 이 수만큼만 광고에서 왔으면 본전. 유입경로 미기록이라 실제 기여분은 미상.
  const breakEvenJobs    = (profitPerJob != null && profitPerJob > 0 && adCostVat > 0)
    ? Math.ceil(adCostVat / profitPerJob)
    : null;

  // ── 블록 ⑤ — 일별 광고비 vs 자체유입 ───────────────────────────────────────
  //   왜 접수(completed 아님)와 짝짓나: 접수→완료까지 며칠 걸린다. 같은 날 완료매출은
  //   며칠 전 광고의 결과라 당일 광고비와 나란히 놓으면 인과가 어긋난다.
  //   자연유입 기준선: 광고비가 가장 적었던 날들의 평균 접수. 광고 없이도 들어오는 양.
  //   광고 기여 추정 = Σ max(0, 그날 접수 − 기준선) → 완료율 곱해 완료건으로 환산.
  const daily = useMemo(() => {
    const adDays = new Map();
    for (const d of (ad?.days || [])) {
      if (d && d.ymd) adDays.set(String(d.ymd), d);
    }
    const canMoney = canSeeField(user, "task.total_amount");
    const rows = [];
    const cur  = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    while (cur <= last && rows.length < 200) {
      const ymd = cur.toISOString().slice(0, 10);
      const a   = adDays.get(ymd);
      let received = 0;
      for (const x of selfTasks) {
        const c = x.createdAt || x.created_at || x.receivedAt || x.received_at;
        if (c && toKstYmd(c) === ymd) received += 1;
      }
      const rv = canMoney ? computeRevenueByYmRange(selfTasks, ymd, ymd, user) : null;
      rows.push({
        ymd,
        cost:        a ? Math.round(Number(a.cost || 0) * 1.1) : 0,
        clicks:      a ? Number(a.clicks || 0) : 0,
        impressions: a ? Number(a.impressions || 0) : 0,
        received,
        done:  rv?.count || 0,
        owner: Number(rv?.owner || 0),
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    const totalCost = rows.reduce((sum, r) => sum + r.cost, 0);
    // 5일 미만이거나 광고비 자체가 0 이면 기준선 비교가 성립하지 않는다.
    if (rows.length < 5 || totalCost <= 0) return { rows, baseline: null };

    const sorted   = [...rows].sort((a, b) => a.cost - b.cost);
    const k        = Math.max(3, Math.floor(rows.length / 3));
    const lowDays  = sorted.slice(0, k);
    const baseline = lowDays.reduce((sum, r) => sum + r.received, 0) / k;

    const totalReceived = rows.reduce((sum, r) => sum + r.received, 0);
    const adDrivenRecv  = rows.reduce((sum, r) => sum + Math.max(0, r.received - baseline), 0);
    const convRate      = totalReceived > 0 ? (selfCount / totalReceived) : 0;
    const adDrivenDone  = Math.round(adDrivenRecv * convRate);

    return {
      rows,
      baseline,
      lowDayCount:   k,
      lowDayAvgCost: Math.round(lowDays.reduce((sum, r) => sum + r.cost, 0) / k),
      totalReceived,
      adDrivenRecv:  Math.round(adDrivenRecv),
      convRate,
      adDrivenDone,
    };
  }, [ad, selfTasks, start, end, user, selfCount]);

  const maxDayCost = Math.max(1, ...daily.rows.map(r => r.cost));
  const maxRecv    = Math.max(1, ...daily.rows.map(r => r.received));
  // 광고가 만든 이익 − 광고비 = 실제로 남은 돈. 블록⑤ 한 줄 결론.
  const adProfit = (profitPerJob != null && daily.adDrivenDone != null)
    ? daily.adDrivenDone * profitPerJob
    : null;
  const adNet    = adProfit != null ? adProfit - adCostVat : null;

  // ── 블록 ⑥ — 키워드별 성과 ───────────────────────
  //   "예산을 다 못 쓴다" 의 원인 판별. 지표 2개.
  //     avgRnk(평균노출순위) — 낮을수록(1위에 가까울수록) 위에 뜬다.
  //     노출 0 키워드 수      — 등록만 돼 있고 실제로는 안 뜨는 것들. 많으면 입찰가 문제다.
  const kw = useMemo(() => {
    const meta = ad?.keywordMeta || null;
    const rows = (ad?.keywords || []).map(k => ({
      ...k,
      costVat: Math.round(Number(k.cost || 0) * 1.1),
      ctr:     k.impressions > 0 ? (k.clicks / k.impressions) : 0,
      cpc:     k.clicks > 0 ? Math.round(Number(k.cost || 0) * 1.1 / k.clicks) : 0,
    }));
    if (rows.length === 0) return { rows: [], avgRank: null, meta };
    let impSum = 0, rankSum = 0;
    for (const r of rows) {
      if (r.impressions > 0 && r.avgRnk > 0) { impSum += r.impressions; rankSum += r.avgRnk * r.impressions; }
    }
    const avgRank = impSum > 0 ? (rankSum / impSum) : null;
    return { rows, avgRank, meta };
  }, [ad]);

  // 등록 키워드 중 실제로 노출된 비율. 이게 낮으면 "키워드가 많아도 소용없다" 는 뜻.
  const kwLiveRate = (kw.meta && kw.meta.total > 0) ? (kw.meta.live / kw.meta.total) : null;

  // 네이버 전환은 '웹에서 폼을 넣은 사람' 만 센다. 전화로 온 손님이 통째로 빠진다.
  //   블록⑤의 '광고로 따온 일' 추정치로 배율을 구해 건당비용을 보정한다.
  //   블록⑤ 추정은 보수적인(적게 잡는) 방식이라, 보정 후에도 실제보단 비싸게 나온다.
  const convFactor = useMemo(() => {
    const naverConv = (ad?.adGroups || []).reduce((sum, g) => sum + Number(g.conv || 0), 0);
    if (naverConv <= 0) return null;
    if (daily.adDrivenDone == null || daily.adDrivenDone <= 0) return null;
    const f = daily.adDrivenDone / naverConv;
    return f > 1.05 ? { f, naverConv, real: daily.adDrivenDone } : null;
  }, [ad, daily]);

  // 실제로 노출되고 있는 광고의 평균 순위 — 노출수로 가중.
  //   '입찰가를 제대로 세팅했나' 의 답이 곧 이 숫자다.
  const liveRank = useMemo(() => {
    let impSum = 0, rankSum = 0, n = 0;
    for (const g of (ad?.adGroups || [])) {
      const imp = Number(g.impressions || 0), rk = Number(g.avgRnk || 0);
      if (imp > 0 && rk > 0) { impSum += imp; rankSum += rk * imp; n += 1; }
    }
    return impSum > 0 ? { rank: rankSum / impSum, groups: n } : null;
  }, [ad]);

  // 실제 관리 단위는 키워드가 아니라 광고그룹이다. 700개는 못 봐도 19줄은 본다.
  //   status 로 한 줄 진단까지 붙여서, 사장님이 표를 해석할 필요가 없게 만든다.
  const groups = useMemo(() => {
    // 전환 1건에 평균 몇 클릭이 드는지. 그 2배를 못 채운 그룹은 판정을 보류한다.
    let tClk = 0, tConv = 0;
    for (const g of (ad?.adGroups || [])) { tClk += Number(g.clicks || 0); tConv += Number(g.conv || 0); }
    const needClicks = tConv > 0 ? Math.max(20, Math.ceil((tClk / tConv) * 2)) : 20;
    const rows = (ad?.adGroups || []).map(g => {
      const costVat = Math.round(Number(g.cost || 0) * 1.1);
      const conv    = Number(g.conv || 0);
      const convAdj = convFactor ? conv * convFactor.f : conv;
      const cpaRaw  = conv > 0 ? Math.round(costVat / conv) : null;
      const cpa     = convAdj > 0 ? Math.round(costVat / convAdj) : null;
      let status;
      if (costVat < 10000 && g.impressions < 100) {
        status = { key: "dead",  label: "안 돌아감", color: "#94A3B8" };
      } else if (cpa == null) {
        // 클릭 수가 너무 적으면 '전환 없음' 은 통계적으로 의미가 없다. 아직 모르는 것뿐이다.
        status = Number(g.clicks || 0) < needClicks
          ? { key: "few",    label: "아직 모름", color: "#94A3B8" }
          : { key: "noconv", label: "전환 없음", color: "#DC2626" };
      } else if (profitPerJob != null && cpa > profitPerJob) {
        status = { key: "over",  label: "비쌈",     color: "#DC2626" };
      } else if (profitPerJob != null && cpa < profitPerJob * 0.5) {
        status = { key: "cheap", label: "더 써도 됨", color: "#16A34A" };
      } else {
        status = { key: "ok",    label: "적정",     color: "#D97706" };
      }
      return { ...g, costVat, conv, cpa, cpaRaw, status };
    });
    const totalCost = rows.reduce((a, b) => a + b.costVat, 0);
    return { rows, totalCost, needClicks };
  }, [ad, profitPerJob, convFactor]);

  // 한 줄 요약 — 몇 개 그룹이 돈의 대부분을 쓰는가.
  const groupConcentration = useMemo(() => {
    const rows = groups.rows;
    if (rows.length === 0 || groups.totalCost <= 0) return null;
    let acc = 0, n = 0;
    for (const r of rows) { acc += r.costVat; n += 1; if (acc >= groups.totalCost * 0.9) break; }
    return { n, total: rows.length, pct: Math.round((acc / groups.totalCost) * 100) };
  }, [groups]);

  // 진단 문구 — 사장님이 바로 행동으로 옮길 수 있게.
  //   판정 순서가 중요하다. '지금 뜨는 광고가 몇 위인가' 를 제일 먼저 본다.
  //   최저입찰가로도 1~2위를 먹고 있으면 경쟁자가 없다는 뜻이고,
  //   그건 곧 그 단어를 검색하는 사람이 없다는 뜻이다. 입찰가를 올려도 소용없다.
  const kwVerdict = (() => {
    const r = (liveRank && liveRank.rank) != null ? liveRank.rank : kw.avgRank;
    const deadN = (kw.meta && kw.meta.dead > 0) ? kw.meta.dead : 0;

    // 순위 자료가 아예 없을 때만, 예전처럼 노출 실패율로 판단한다.
    if (r == null) {
      if (kwLiveRate != null && kwLiveRate < 0.5 && deadN > 0) {
        return {
          color: "#DC2626",
          head: `조사한 키워드 ${_fmtKRW(kw.meta.total)}개 중 ${_fmtKRW(deadN)}개가 한 번도 안 떴습니다`,
          body: "노출이 아예 없어 원인을 가릴 수 없습니다. 광고그룹이 켜져 있는지, 예산이 걸려 있는지부터 확인하세요.",
        };
      }
      return null;
    }

    if (r <= 2.5) {
      const minBidMost = kw.meta && kw.meta.deadMinBidPct > 0.6;
      return {
        color: "#2563EB",
        head: `입찰가는 잘 맞춰져 있습니다 (뜨는 광고 평균 ${r.toFixed(1)}위)`,
        body: "지금 나가고 있는 광고는 전부 검색 결과 맨 위 1~2번째 자리에 붙어 있습니다. "
            + "입찰가를 더 올려도 올라갈 자리가 없습니다."
            + (deadN > 0
                ? ` 안 뜨는 키워드 ${_fmtKRW(deadN)}개는 입찰가 문제가 아닙니다`
                  + (minBidMost ? " — 최저가로도 1~2위가 나오는 걸 보면 경쟁자 자체가 없습니다" : "")
                  + ". 그 단어를 검색하는 사람이 없어서입니다."
                : "")
            + " 예산이 남는 이유가 이것입니다. 돈을 더 쓰려면 검색량이 있는 새 키워드를 찾거나 다른 채널로 넓혀야 합니다.",
      };
    }

    if (r <= 3.5) {
      return {
        color: "#D97706",
        head: `조금 밀려 있습니다 (뜨는 광고 평균 ${r.toFixed(1)}위)`,
        body: "돈 되는 그룹의 입찰가를 올리면 노출이 늘고 예산도 더 쓸 수 있습니다. 아래 표에서 광고비 큰 것부터 손보세요.",
      };
    }

    return {
      color: "#DC2626",
      head: `많이 밀려 있습니다 (뜨는 광고 평균 ${r.toFixed(1)}위)`,
      body: "순위가 낮아 노출 기회를 놓치고 있습니다. 입찰가 올리는 것이 가장 먼저 할 일입니다."
          + (deadN > 0 ? ` 안 뜨는 키워드 ${_fmtKRW(deadN)}개도 같은 원인일 가능성이 큽니다.` : ""),
    };
  })();

  return (
    <div style={{
      minHeight: "100vh",
      background: t.bg,
      color: t.text,
      paddingBottom: "calc(40px + env(safe-area-inset-bottom))",
      fontFamily: "'Pretendard', sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgElevated,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", color: t.text,
          display: "flex", alignItems: "center",
        }} aria-label="뒤로">
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>
          📈 마케팅 조감
        </div>
      </div>

      {/* 기간 필터 */}
      <div style={{ padding: "12px 16px 4px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PERIOD_OPTS.map(opt => {
            const on = period === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                style={{
                  padding: "6px 14px",
                  background: on ? t.accent : "transparent",
                  border: `1px solid ${on ? t.accent : t.border}`,
                  borderRadius: 999,
                  color: on ? "#fff" : t.textSecondary,
                  fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{opt.label}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginTop: 8 }}>
          {start === end ? `${start} (하루)` : `${start} ~ ${end}`} · KST
        </div>
        {/* v3 안내 문구 (원청 기준 금지 + 2026-06-28 이후만 정확) */}
        <div style={{
          fontSize: 10, color: t.textMuted, fontWeight: 600, marginTop: 6,
          padding: "6px 10px",
          background: t.bgInset || "rgba(148, 163, 184, 0.08)",
          borderRadius: 6,
          lineHeight: 1.5,
        }}>
          ⓘ 홈페이지 유입 판별: 접수함 <b>converted 상태 inquiries.task_id</b> 기반 (v3).
          원청 코드 기준(v2) 은 폐기. <b>2026-06-28 (Mig 152) 이전 전환분은 소급 불가</b> — 그 이전 데이터는 홈페이지 유입 여부 판정 불가.
        </div>
      </div>

      {/* ⓪ 지금 실시간 — 기간 필터와 무관하게 항상 오늘 */}
      {liveView && (
        <div style={{ padding: "8px 16px 0" }}>
          <div style={{
            background: t.bgElevated, border: `1px solid ${liveView.verdict.color}44`,
            borderLeft: `4px solid ${liveView.verdict.color}`,
            borderRadius: 12, padding: "13px 14px 11px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>🔴 지금 실시간 <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>오늘 0시~방금 · 5분마다 갱신</span></span>
              <span style={{
                marginLeft: "auto", fontSize: 11, fontWeight: 800, color: liveView.verdict.color,
                border: `1px solid ${liveView.verdict.color}55`, borderRadius: 999, padding: "3px 10px",
              }}>{liveView.verdict.label}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.55, marginBottom: 10 }}>
              오늘 <b className="mono">{_fmtKRW(liveView.costVat)}원</b> 써서 접수 <b className="mono">{liveView.jobs ?? "?"}건</b>
              {liveView.per != null && (<> — 1건에 <b className="mono" style={{ color: liveView.verdict.color }}>{_fmtKRW(liveView.per)}원</b> <span style={{ color: t.textMuted, fontWeight: 600 }}>(기준 {_fmtKRW(liveView.goal)}원)</span></>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
              <Metric t={t} label="오늘 광고비 (VAT포함)" value={_fmtKRW(liveView.costVat)} suffix="원" />
              <Metric t={t} label="오늘 실접수" value={liveView.jobs ?? "-"} suffix="건" />
              <Metric t={t} label="이 속도면 마감쯤" value={_fmtKRW(liveView.proj)} suffix="원" />
            </div>
            <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600, marginTop: 8 }}>
              {liveView.lrMin != null
                ? <>🟢 1위 자동맞춤 {liveView.lrMin < 1 ? "방금" : `${liveView.lrMin}분 전`} 실행 · 키워드 {_fmtKRW(liveView.lrWatched || 0)}개 감시 중</>
                : <>⚪ 자동입찰 기록 없음</>}
              {liveView.lrMin != null && liveView.lrMin > 75 && <b style={{ color: "#DC2626" }}> — 75분 넘게 조용함, 확인 필요</b>}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: t.textMuted, fontSize: 12 }}>
          불러오는 중…
        </div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: "center", color: "#DC2626", fontSize: 12 }}>
          조회 실패: {error}
        </div>
      ) : (
        <div style={{
          padding: "12px 16px 20px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 12,
        }}>
          {/* ① 홈페이지 접수 퍼널 */}
          <Panel t={t} title="① 홈페이지 접수 퍼널" subtitle="기간: 접수(inquiry.created_at) 기준">
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
            }}>
              <FunnelStep t={t} label="총 접수 (스팸 포함)" value={funnel.total} accent/>
              <FunnelStep t={t} label="유효 (converted)"    value={funnel.valid}/>
              <FunnelStep t={t}
                label="완료"
                value={funnel.completed}
                sub={funnel.valid > 0 ? _pctText(funnel.completed, funnel.valid) + " 완료율" : null}
              />
            </div>
            <div style={{
              marginTop: 12,
              padding: "8px 12px",
              background: t.bgInset || "rgba(148, 163, 184, 0.06)",
              borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>스팸률 (총 접수 대비)</span>
              <span className="mono" style={{
                fontSize: 15, fontWeight: 800,
                color: funnel.spam > 0 ? "#6B7280" : t.text,
                fontVariantNumeric: "tabular-nums",
              }}>
                {spamRate} <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 4 }}>
                  ({funnel.spam}건)
                </span>
              </span>
            </div>
            <div style={{
              marginTop: 6,
              padding: "8px 12px",
              background: t.bgInset || "rgba(148, 163, 184, 0.06)",
              borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>취소율 (유효 대비)</span>
              <span className="mono" style={{
                fontSize: 15, fontWeight: 800,
                color: funnel.canceled > 0 ? "#DC2626" : t.text,
                fontVariantNumeric: "tabular-nums",
              }}>
                {cancelRate} <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 4 }}>
                  ({funnel.canceled}건)
                </span>
              </span>
            </div>
          </Panel>

          {/* ② 완료 매출·회사이익 */}
          <Panel t={t} title="② 완료 매출 · 회사이익" subtitle="기간: 완료(task.completed_at) 기준 · 홈페이지 유입만 · ①의 완료와 집계 기준이 다름(완료 시각 기준)">
            {revenue == null ? (
              <div style={{ padding: 16, textAlign: "center", color: t.textMuted, fontSize: 12 }}>
                매출 조회 권한 없음
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 10,
              }}>
                <Metric t={t} label="완료 건수"  value={revenue.count}/>
                <Metric t={t} label="완료 매출"  value={_fmtKRW(revenue.total)} suffix="원" accent/>
                <Metric t={t} label="회사 이익"  value={_fmtKRW(revenue.owner)} suffix="원"
                        highlight={revenue.owner > 0 ? "#16A34A" : (revenue.owner < 0 ? "#DC2626" : null)}/>
              </div>
            )}
          </Panel>

          {/* ③ 지역 top5 */}
          <Panel t={t} title="③ 지역 top5" subtitle="기간: 접수(task.created_at) 기준 · 홈페이지 유입만 · 주소 파싱 실패(미상)는 순위 제외">
            {regionTop5.grandTotal === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: t.textMuted, fontSize: 12 }}>
                이 기간 홈페이지 유입 없음
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {regionTop5.rows.map((r, idx) => {
                  const pct = regionTop5.total > 0 ? (r.count / regionTop5.total) * 100 : 0;
                  return (
                    <div key={r.key} style={{
                      display: "grid",
                      gridTemplateColumns: "28px minmax(0, 1fr) 60px",
                      gap: 10, alignItems: "center",
                      padding: "8px 4px",
                    }}>
                      <span className="mono" style={{
                        fontSize: 13, fontWeight: 800,
                        color: idx === 0 ? t.accent : t.textMuted,
                        textAlign: "center",
                      }}>{idx + 1}</span>
                      <div style={{
                        display: "flex", flexDirection: "column", gap: 3,
                        minWidth: 0,
                      }}>
                        <span style={{
                          fontSize: 13, fontWeight: 700, color: t.text,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{r.label}</span>
                        <div style={{
                          height: 4, background: t.bgInset || "rgba(148, 163, 184, 0.15)",
                          borderRadius: 2, overflow: "hidden",
                        }}>
                          <div style={{
                            width: `${pct.toFixed(1)}%`, height: "100%",
                            background: t.accent, borderRadius: 2,
                          }}/>
                        </div>
                      </div>
                      <span className="mono" style={{
                        fontSize: 13, fontWeight: 800, color: t.text,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}>{r.count} <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>건</span></span>
                    </div>
                  );
                })}
                {regionTop5.rows.length === 0 && (
                  <div style={{ padding: "12px 4px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
                    이 기간 순위 대상 없음 (전부 주소 미상)
                  </div>
                )}
                {regionTop5.unknown > 0 && (
                  <div style={{
                    marginTop: 4,
                    padding: "6px 4px",
                    borderTop: `1px dashed ${t.border}`,
                    display: "flex", justifyContent: "space-between",
                    fontSize: 11, color: t.textMuted, fontWeight: 700,
                  }}>
                    <span>주소 미상 (순위 제외)</span>
                    <span className="mono" style={{ color: t.text }}>{regionTop5.unknown}건</span>
                  </div>
                )}
                <div style={{
                  marginTop: 4,
                  padding: "6px 4px",
                  borderTop: `1px solid ${t.border}`,
                  display: "flex", justifyContent: "space-between",
                  fontSize: 11, color: t.textMuted, fontWeight: 700,
                }}>
                  <span>홈페이지 유입 합계</span>
                  <span className="mono" style={{ color: t.text }}>{regionTop5.grandTotal}건</span>
                </div>
              </div>
            )}
          </Panel>

          {/* ④ 광고 지출·CPA (네이버 검색광고) */}
          <Panel t={t} title="④ 광고 지출 · CPA" subtitle="네이버 검색광고 · 분모는 자체유입(올데이케어) 완료건 · 광고비/CPA 는 VAT 포함(실청구)">
            {adLoading ? (
              <div style={{ padding: 20, textAlign: "center", color: t.textMuted, fontSize: 12 }}>
                광고 지표 조회 중…
              </div>
            ) : (adError || !ad || ad.ok === false) ? (
              <div style={{ padding: 16, textAlign: "center", color: t.textMuted, fontSize: 12, lineHeight: 1.5 }}>
                광고 API 조회 실패
                {(adError || ad?.error) && (
                  <div style={{ marginTop: 4, fontSize: 10, color: t.textSecondary }}>
                    {adError || ad?.error}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 8,
                }}>
                  <Metric t={t} label="광고비 (VAT 포함)" value={_fmtKRW(adCostVat)}     suffix="원" accent/>
                  <Metric t={t} label="클릭"               value={_fmtKRW(ad.clicks)}    suffix="회"/>
                  <Metric t={t} label="CPC"                value={_fmtKRW(ad.cpc)}       suffix="원"/>
                  <Metric t={t} label="CTR"                value={(Number(ad.ctr || 0) * 100).toFixed(2)} suffix="%"/>
                </div>
                <div style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  background: t.bgInset || "rgba(148, 163, 184, 0.06)",
                  borderRadius: 8,
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>
                      CPA (VAT 포함) — 광고비 ÷ 자체유입 완료({selfCount}건)
                    </span>
                    <span className="mono" style={{
                      fontSize: 16, fontWeight: 800,
                      color: cpaVerdictColor || t.text,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {cpaVat != null ? _fmtKRW(cpaVat) + "원" : "-"}
                    </span>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>
                      완료 1건당 회사이익 — 이익 ÷ 자체유입 완료({selfCount}건)
                    </span>
                    <span className="mono" style={{
                      fontSize: 13, fontWeight: 700, color: t.text,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {profitPerJob != null ? _fmtKRW(profitPerJob) + "원" : "-"}
                    </span>
                  </div>
                  {(cpaVat != null && profitPerJob != null) && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 11, fontWeight: 700,
                      color: cpaVerdictColor,
                      textAlign: "right",
                    }}>
                      {cpaVat < profitPerJob
                        ? `✓ 남는 장사 (건당 +${_fmtKRW(profitPerJob - cpaVat)}원)`
                        : `✗ 적자 (건당 −${_fmtKRW(cpaVat - profitPerJob)}원)`}
                    </div>
                  )}
                </div>
                {breakEvenJobs != null && (
                  <div style={{
                    marginTop: 8,
                    padding: "8px 10px",
                    background: t.bgInset || "rgba(148, 163, 184, 0.06)",
                    borderRadius: 8,
                    fontSize: 11, fontWeight: 700, color: t.textMuted, lineHeight: 1.5,
                  }}>
                    손익분기 <span className="mono" style={{ color: t.text, fontWeight: 800 }}>{_fmtKRW(breakEvenJobs)}건</span>
                    {selfCount > 0 && (
                      <> — 자체유입 {_fmtKRW(selfCount)}건 중 {(breakEvenJobs / selfCount * 100).toFixed(0)}% 이상이 광고 유입이면 본전</>
                    )}
                  </div>
                )}
                <div style={{
                  marginTop: 8, fontSize: 10, color: t.textMuted, fontWeight: 600, lineHeight: 1.5,
                }}>
                  ⓘ 네이버 salesAmt 는 VAT 별도 (원본 {_fmtKRW(Math.round(Number(ad.cost || 0)))}원).
                  카드 실청구는 VAT 포함 (×1.1). CPA·손익 판단은 실청구액 기준.
                  <br/>
                  ⚠️ 분모는 자체유입(전화·홈페이지·당근·네이버쇼핑) 완료 전체다. 유입경로가 기록되지
                  않아 이 중 광고 기여분을 아직 가려낼 수 없으므로, 위 CPA 는 가장 유리하게 본 값이다.
                </div>
              </>
            )}
          </Panel>

          {/* ⑤ 광고가 만든 일감 (일별 역산) */}
          {ad?.ok && !adLoading && daily.rows.length >= 5 && (
            <Panel t={t} title="⑤ 광고가 만든 일감"
                   subtitle="광고 거의 안 쓴 날에도 들어온 접수 = 광고 없어도 왔을 건수다. 그 위로 넘은 만큼이 광고 성과다">
              {daily.baseline == null || adNet == null ? (
                <div style={{ padding: 16, textAlign: "center", color: t.textMuted, fontSize: 12, lineHeight: 1.6 }}>
                  이 기간은 비교할 수 없습니다. (최소 5일 이상 + 광고비 지출 필요)
                </div>
              ) : (
                <>
                  <div style={{
                    padding: "14px 14px",
                    borderRadius: 10,
                    background: adNet >= 0 ? "rgba(22, 163, 74, 0.10)" : "rgba(220, 38, 38, 0.10)",
                    border: `1px solid ${adNet >= 0 ? "#16A34A" : "#DC2626"}`,
                    marginBottom: 14,
                  }}>
                    <div style={{
                      fontSize: 15, fontWeight: 900, lineHeight: 1.4,
                      color: adNet >= 0 ? "#16A34A" : "#DC2626",
                    }}>
                      {adNet >= 0
                        ? `✓ 광고비보다 ${_fmtKRW(adNet)}원 더 벌었습니다`
                        : `✗ 광고비보다 ${_fmtKRW(Math.abs(adNet))}원 모자랍니다`}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: t.text, lineHeight: 1.9 }}>
                      광고로 따온 일 <span className="mono" style={{ fontWeight: 900 }}>약 {_fmtKRW(daily.adDrivenDone)}건</span>
                      {" × "}건당 남는 돈 <span className="mono" style={{ fontWeight: 900 }}>{_fmtKRW(profitPerJob)}원</span>
                      {" = "}<span className="mono" style={{ fontWeight: 900 }}>{_fmtKRW(adProfit)}원</span>
                      <br/>
                      쓴 광고비 <span className="mono" style={{ fontWeight: 900 }}>{_fmtKRW(adCostVat)}원</span>
                      {" → "}남은 돈{" "}
                      <span className="mono" style={{ fontWeight: 900, color: adNet >= 0 ? "#16A34A" : "#DC2626" }}>
                        {adNet >= 0 ? "+" : "−"}{_fmtKRW(Math.abs(adNet))}원
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginBottom: 6 }}>
                    이 기간 자체 접수 {_fmtKRW(daily.totalReceived)}건을 둘로 나누면
                  </div>
                  <div style={{ display: "flex", height: 26, borderRadius: 6, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{
                      flex: Math.max(1, daily.totalReceived - daily.adDrivenRecv),
                      background: "rgba(148, 163, 184, 0.35)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 800, color: t.text, minWidth: 0,
                    }}>
                      {_fmtKRW(daily.totalReceived - daily.adDrivenRecv)}
                    </div>
                    <div style={{
                      flex: Math.max(1, daily.adDrivenRecv),
                      background: "#16A34A",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 800, color: "#fff", minWidth: 0,
                    }}>
                      {_fmtKRW(daily.adDrivenRecv)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 14 }}>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "rgba(148, 163, 184, 0.55)", marginRight: 4 }}/>광고 없어도 왔을 건</span>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#16A34A", marginRight: 4 }}/>광고가 더 데려온 건</span>
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginBottom: 8 }}>
                    날짜별 접수 — 점선(하루 {daily.baseline.toFixed(1)}건)이 광고 없어도 들어오는 수준
                  </div>
                  <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 2, height: 84, marginBottom: 4 }}>
                    <div style={{
                      position: "absolute", left: 0, right: 0,
                      bottom: `${(daily.baseline / maxRecv) * 100}%`,
                      borderTop: `1px dashed ${t.textMuted}`, opacity: 0.8,
                    }}/>
                    {daily.rows.map(r => {
                      const over = r.received > daily.baseline;
                      return (
                        <div key={r.ymd}
                             title={`${r.ymd} · 접수 ${r.received}건 · 광고비 ${_fmtKRW(r.cost)}원`}
                             style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                          <div style={{
                            height: `${(r.received / maxRecv) * 100}%`,
                            background: over ? "#16A34A" : "rgba(148, 163, 184, 0.45)",
                            borderRadius: "3px 3px 0 0",
                          }}/>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontWeight: 700, color: t.textMuted, marginBottom: 12 }}>
                    <span>{daily.rows[0].ymd.slice(5)}</span>
                    <span>{daily.rows[daily.rows.length - 1].ymd.slice(5)}</span>
                  </div>

                  <button
                    onClick={() => setShowDailyTable(v => !v)}
                    style={{
                      width: "100%", padding: "8px 10px",
                      background: t.bgInset || "rgba(148, 163, 184, 0.06)",
                      border: `1px solid ${t.border}`, borderRadius: 8,
                      color: t.textMuted, fontSize: 11, fontWeight: 800, cursor: "pointer",
                      fontFamily: "inherit",
                    }}>
                    {showDailyTable ? "날짜별 숫자 접기 ▲" : "날짜별 숫자 보기 ▼"}
                  </button>

                  {showDailyTable && (
                    <div style={{ overflowX: "auto", marginTop: 8 }}>
                      <table className="mono" style={{
                        width: "100%", borderCollapse: "collapse",
                        fontSize: 11, fontVariantNumeric: "tabular-nums",
                      }}>
                        <thead>
                          <tr style={{ color: t.textMuted, fontWeight: 800 }}>
                            <th style={{ textAlign: "left",  padding: "4px 6px" }}>날짜</th>
                            <th style={{ textAlign: "right", padding: "4px 6px" }}>광고비</th>
                            <th style={{ textAlign: "right", padding: "4px 6px" }}>클릭</th>
                            <th style={{ textAlign: "right", padding: "4px 6px" }}>접수</th>
                            <th style={{ textAlign: "right", padding: "4px 6px" }}>완료</th>
                            <th style={{ textAlign: "right", padding: "4px 6px" }}>회사이익</th>
                          </tr>
                        </thead>
                        <tbody>
                          {daily.rows.map(r => {
                            const over = r.received > daily.baseline;
                            return (
                              <tr key={r.ymd} style={{ borderTop: `1px solid ${t.border}` }}>
                                <td style={{ padding: "4px 6px", color: t.textMuted, fontWeight: 700 }}>{r.ymd.slice(5)}</td>
                                <td style={{ padding: "4px 6px", textAlign: "right", color: t.text }}>
                                  <span style={{
                                    display: "inline-block", padding: "1px 4px", borderRadius: 4,
                                    background: `rgba(255, 27, 141, ${(r.cost / maxDayCost * 0.22).toFixed(3)})`,
                                  }}>{_fmtKRW(r.cost)}</span>
                                </td>
                                <td style={{ padding: "4px 6px", textAlign: "right", color: t.textMuted }}>{_fmtKRW(r.clicks)}</td>
                                <td style={{
                                  padding: "4px 6px", textAlign: "right",
                                  color: over ? "#16A34A" : t.text, fontWeight: over ? 800 : 700,
                                }}>{_fmtKRW(r.received)}</td>
                                <td style={{ padding: "4px 6px", textAlign: "right", color: t.textMuted }}>{_fmtKRW(r.done)}</td>
                                <td style={{ padding: "4px 6px", textAlign: "right", color: t.text }}>{_fmtKRW(r.owner)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ marginTop: 10, fontSize: 10, color: t.textMuted, fontWeight: 600, lineHeight: 1.6 }}>
                    ⓘ 접수하고 며칠 뒤에 완료되므로, 같은 날짜의 접수와 완료는 같은 고객이 아니다.
                    그래서 광고비와 같이 볼 것은 <b>접수</b> 숫자다.
                    <br/>
                    ⚠️ 주말은 광고비도 접수도 같이 줄어든다. 이 요일 효과를 보정하지 않았으므로 위 숫자는 추정치다.
                    접수받을 때 "어떻게 알고 연락하셨어요?" 한 칸만 기록하면 이 추정 자체가 필요 없어진다.
                  </div>
                </>
              )}
            </Panel>
          )}

          {/* ⑥ 광고그룹 — 실제 관리 단위. 키워드는 접어서 아래로. */}
          {ad?.ok && !adLoading && (groups.rows.length > 0 || kw.rows.length > 0) && (
            <Panel t={t} title="⑥ 광고그룹별 성과"
                   subtitle="키워드 말고 여기만 보면 된다. 매일 볼 건 이 표 하나">
              {kwVerdict && (
                <div style={{
                  padding: "12px 14px", borderRadius: 10, marginBottom: 12,
                  background: `${kwVerdict.color}1A`,
                  border: `1px solid ${kwVerdict.color}`,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: kwVerdict.color, lineHeight: 1.4 }}>
                    {kwVerdict.head}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 700, color: t.text, lineHeight: 1.7 }}>
                    {kwVerdict.body}
                  </div>
                </div>
              )}

              {groupConcentration && groupConcentration.n < groupConcentration.total && (
                <div style={{
                  padding: "10px 12px", borderRadius: 9, marginBottom: 10,
                  background: t.bg, border: `1px solid ${t.border}`,
                  fontSize: 12, fontWeight: 800, color: t.text, lineHeight: 1.6,
                }}>
                  그룹 {_fmtKRW(groupConcentration.total)}개 중 {_fmtKRW(groupConcentration.n)}개가 광고비의 {groupConcentration.pct}%를 씁니다.
                  <span style={{ color: t.textMuted, fontWeight: 700 }}> 나머지는 사실상 볼 필요가 없습니다.</span>
                </div>
              )}

              {groups.rows.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table className="mono" style={{
                    width: "100%", borderCollapse: "collapse",
                    fontSize: 11, fontVariantNumeric: "tabular-nums",
                  }}>
                    <thead>
                      <tr style={{ color: t.textMuted, fontWeight: 800 }}>
                        <th style={{ textAlign: "left",  padding: "5px 6px" }}>그룹</th>
                        <th style={{ textAlign: "right", padding: "5px 6px" }}>광고비</th>
                        <th style={{ textAlign: "right", padding: "5px 6px" }}>전환</th>
                        <th style={{ textAlign: "right", padding: "5px 6px" }}>건당비용</th>
                        <th style={{ textAlign: "right", padding: "5px 6px" }}>키워드</th>
                        <th style={{ textAlign: "right", padding: "5px 6px" }}>순위</th>
                        <th style={{ textAlign: "left",  padding: "5px 6px" }}>판정</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.rows.map(g => (
                        <tr key={g.id} style={{
                          borderTop: `1px solid ${t.border}`,
                          opacity: g.status.key === "dead" ? 0.5 : 1,
                        }}>
                          <td style={{
                            padding: "6px", color: t.text, fontWeight: 800,
                            maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }} title={g.name}>{g.name}</td>
                          <td style={{ padding: "6px", textAlign: "right", color: t.text, fontWeight: 800 }}>
                            {_fmtKRW(g.costVat)}
                          </td>
                          <td style={{ padding: "6px", textAlign: "right", color: t.textMuted }}>
                            {g.conv > 0 ? _fmtKRW(g.conv) : "-"}
                          </td>
                          <td style={{
                            padding: "6px", textAlign: "right", fontWeight: 900,
                            color: g.cpa == null ? t.textMuted : g.status.color,
                          }}>
                            {g.cpa != null ? _fmtKRW(g.cpa) : "-"}
                            {convFactor && g.cpaRaw != null && g.cpaRaw !== g.cpa && (
                              <div style={{ fontSize: 9, fontWeight: 600, color: t.textMuted, opacity: 0.75 }}>
                                네이버 {_fmtKRW(g.cpaRaw)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "6px", textAlign: "right", color: t.textMuted }}>
                            {g.kwTotal == null
                              ? <span style={{ opacity: 0.5 }}>미조회</span>
                              : g.kwTotal > 0
                                ? <>{_fmtKRW(g.kwLive)}<span style={{ opacity: 0.6 }}>/{_fmtKRW(g.kwTotal)}</span></>
                                : "-"}
                          </td>
                          <td style={{
                            padding: "6px", textAlign: "right",
                            color: g.avgRnk > 0 && g.avgRnk <= 2 ? "#16A34A" : t.textMuted, fontWeight: 700,
                          }}>
                            {g.avgRnk > 0 ? g.avgRnk.toFixed(1) : "-"}
                          </td>
                          <td style={{ padding: "6px" }}>
                            <span style={{
                              display: "inline-block", padding: "2px 7px", borderRadius: 999,
                              background: `${g.status.color}22`, color: g.status.color,
                              fontSize: 10, fontWeight: 900, whiteSpace: "nowrap",
                            }}>{g.status.label}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginTop: 10, fontSize: 10.5, color: t.textMuted, fontWeight: 600, lineHeight: 1.75 }}>
                ⓘ <b style={{ color: t.text }}>건당비용</b>이 회사 이익{profitPerJob != null ? ` ${_fmtKRW(profitPerJob)}원` : ""}보다
                크면 그 그룹은 밑지는 중입니다.
                <br/>
                ⓘ <b style={{ color: "#16A34A" }}>더 써도 됨</b> = 싸게 일감을 따고 있는데 광고비를 적게 쓰는 그룹.
                여기 입찰가를 올리는 게 제일 안전합니다.
                <br/>
                ⓘ <b>키워드</b> 칸의 "3/812" 는 812개 등록했는데 3개만 실제로 떴다는 뜻입니다.
                <b>미조회</b>는 광고비가 적어 키워드까지 열어보지 않은 그룹입니다(광고비·순위 숫자는 정확합니다).
                <br/>
                ⓘ <b>순위</b>가 1~2위면 이미 맨 위입니다. 입찰가를 올려도 더 올라갈 자리가 없습니다.
                <br/>
                ⓘ <b style={{ color: "#94A3B8" }}>아직 모름</b> = 클릭이 {groups.needClicks}번도 안 쌓인 그룹.
                우리 평균은 클릭 {groups.needClicks ? Math.round(groups.needClicks / 2) : "-"}번에 1건이 들어오니,
                클릭 몇 번으로 "전환 없음" 이라고 단정할 수 없습니다. 판단하려면 광고비를 더 태워봐야 합니다.
                {convFactor ? (
                  <>
                    <br/>
                    ⓘ 네이버 전환은 <b>웹으로 접수한 사람만</b> 셉니다. 전화 손님이 빠져 있어 그대로 쓰면 건당비용이 부풀려집니다.
                    그래서 블록⑤ 추정({_fmtKRW(convFactor.real)}건)과 네이버 집계({_fmtKRW(convFactor.naverConv)}건)의
                    차이 <b>{convFactor.f.toFixed(1)}배</b>로 보정한 값을 크게 적었습니다. 작은 회색 숫자가 네이버 원본입니다.
                  </>
                ) : (
                  <>
                    <br/>
                    ⚠️ 전환은 네이버가 웹에서 잡은 것만 셉니다. <b>전화로 온 손님은 빠져 있어</b> 건당비용이 실제보다 비싸 보입니다.
                  </>
                )}
              </div>

              {kw.rows.length > 0 && (
                <>
                  <button
                    onClick={() => setShowKwTable(v => !v)}
                    style={{
                      marginTop: 12, padding: "8px 12px", borderRadius: 8,
                      border: `1px solid ${t.border}`, background: "transparent",
                      color: t.textMuted, fontSize: 11, fontWeight: 800, cursor: "pointer",
                    }}>
                    {showKwTable ? "키워드 목록 닫기" : "키워드 하나씩 보기 (필요할 때만)"}
                  </button>

                  {showKwTable && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 6, lineHeight: 1.6 }}>
                        {kw.meta
                          ? <>광고비 상위 {_fmtKRW(kw.meta.detailGroups || 0)}개 그룹의 키워드 {_fmtKRW(kw.meta.total)}개를 조사했고,
                              그 중 실제로 뜬 것은 {_fmtKRW(kw.meta.live)}개입니다.
                              {kw.meta.live > kw.rows.length && <> 아래는 광고비 큰 순 {_fmtKRW(kw.rows.length)}개.</>}
                              {kw.meta.partial && <><br/><span style={{ color: "#D97706" }}>⚠️ 전체 등록 키워드 수는 이보다 훨씬 많습니다. 광고비가 붙지 않는 그룹은 조사하지 않았습니다.</span></>}
                              {kw.meta.truncated && <><br/><span style={{ color: "#D97706" }}>⚠️ 광고그룹이 너무 많아 일부만 불러왔습니다.</span></>}
                            </>
                          : <>돌아가는 키워드 {_fmtKRW(kw.rows.length)}개 · 광고비 큰 순</>}
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table className="mono" style={{
                          width: "100%", borderCollapse: "collapse",
                          fontSize: 11, fontVariantNumeric: "tabular-nums",
                        }}>
                          <thead>
                            <tr style={{ color: t.textMuted, fontWeight: 800 }}>
                              <th style={{ textAlign: "left",  padding: "5px 6px" }}>키워드</th>
                              <th style={{ textAlign: "right", padding: "5px 6px" }}>순위</th>
                              <th style={{ textAlign: "right", padding: "5px 6px" }}>노출</th>
                              <th style={{ textAlign: "right", padding: "5px 6px" }}>클릭</th>
                              <th style={{ textAlign: "right", padding: "5px 6px" }}>클릭당</th>
                              <th style={{ textAlign: "right", padding: "5px 6px" }}>광고비</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(kwShowAll ? kw.rows : kw.rows.slice(0, 40)).map(r => {
                              const pricey = r.cpc > 0 && profitPerJob != null && r.cpc * 20 > profitPerJob;
                              return (
                                <tr key={r.id} style={{ borderTop: `1px solid ${t.border}` }}>
                                  <td style={{
                                    padding: "5px 6px", color: t.text, fontWeight: 700,
                                    maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  }} title={`${r.text} · ${r.group}`}>{r.text}</td>
                                  <td style={{
                                    padding: "5px 6px", textAlign: "right", fontWeight: 800,
                                    color: r.avgRnk > 0 && r.avgRnk <= 2 ? "#16A34A" : t.textMuted,
                                  }}>{r.avgRnk > 0 ? r.avgRnk.toFixed(1) : "-"}</td>
                                  <td style={{ padding: "5px 6px", textAlign: "right", color: t.textMuted }}>{_fmtKRW(r.impressions)}</td>
                                  <td style={{ padding: "5px 6px", textAlign: "right", color: t.textMuted }}>{_fmtKRW(r.clicks)}</td>
                                  <td style={{
                                    padding: "5px 6px", textAlign: "right",
                                    color: pricey ? "#DC2626" : t.textMuted, fontWeight: pricey ? 800 : 700,
                                  }}>{_fmtKRW(r.cpc)}</td>
                                  <td style={{ padding: "5px 6px", textAlign: "right", color: t.text, fontWeight: 800 }}>{_fmtKRW(r.costVat)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {kw.rows.length > 40 && (
                        <button
                          onClick={() => setKwShowAll(v => !v)}
                          style={{
                            marginTop: 8, padding: "7px 12px", borderRadius: 8,
                            border: `1px solid ${t.border}`, background: "transparent",
                            color: t.textMuted, fontSize: 11, fontWeight: 800, cursor: "pointer",
                          }}>
                          {kwShowAll ? "접기" : `나머지 ${_fmtKRW(kw.rows.length - 40)}개 더 보기`}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </Panel>
          )}

          {/* ⑦ 검색량 조회 — 손님이 찾는데 우리 광고엔 없는 단어 */}
          <Panel t={t} title="⑦ 검색량 순위 — 우리한테 없는 단어 찾기"
                 subtitle="네이버가 알려주는 '사람들이 실제로 검색한 단어' 를 검색량 큰 순으로">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <input
                value={seeds}
                onChange={e => setSeeds(e.target.value)}
                placeholder="씨앗 단어를 쉼표로 (예: 에어컨청소,에어컨세척)"
                style={{
                  flex: "1 1 320px", minWidth: 200, padding: "9px 11px", borderRadius: 8,
                  border: `1px solid ${t.border}`, background: t.bg, color: t.text,
                  fontSize: 12, fontWeight: 700, outline: "none",
                }} />
              <button
                onClick={runKeywordTool}
                disabled={toolLoading}
                style={{
                  padding: "9px 16px", borderRadius: 8, border: "none",
                  background: toolLoading ? t.border : "#2563EB", color: "#fff",
                  fontSize: 12, fontWeight: 900, cursor: toolLoading ? "default" : "pointer",
                  whiteSpace: "nowrap",
                }}>
                {toolLoading ? "찾는 중…" : "검색량 조회"}
              </button>
            </div>

            <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600, lineHeight: 1.7, marginBottom: 10 }}>
              씨앗 단어 하나를 넣으면 네이버가 <b style={{ color: t.text }}>비슷한 단어를 검색량과 함께</b> 돌려줍니다.
              그걸 우리 광고에 등록된 단어와 맞춰봐서, <b style={{ color: "#DC2626" }}>손님은 찾는데 우리한테 없는 단어</b>를 빨갛게 표시합니다.
            </div>

            {toolError && (
              <div style={{
                padding: "10px 12px", borderRadius: 8, marginBottom: 10,
                background: "#DC262614", border: "1px solid #DC2626",
                fontSize: 11.5, fontWeight: 800, color: "#DC2626",
              }}>{toolError}</div>
            )}

            {tool && (
              <>
                <div style={{
                  padding: "12px 14px", borderRadius: 10, marginBottom: 10,
                  background: toolRows.head.count > 0 ? "#DC26261A" : "#16A34A1A",
                  border: `1px solid ${toolRows.head.count > 0 ? "#DC2626" : "#16A34A"}`,
                }}>
                  <div style={{
                    fontSize: 14, fontWeight: 900, lineHeight: 1.4,
                    color: toolRows.head.count > 0 ? "#DC2626" : "#16A34A",
                  }}>
                    {toolRows.head.count > 0
                      ? `우리 일 관련인데 광고에 없는 단어 ${_fmtKRW(toolRows.head.count)}개 — 합쳐서 월 ${_fmtKRW(toolRows.head.vol)}번 검색됩니다`
                      : "우리 일 관련 단어는 전부 이미 등록돼 있습니다"}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 700, color: t.text, lineHeight: 1.7 }}>
                    네이버가 알려준 단어 {_fmtKRW(tool.found)}개 중 {_fmtKRW(toolRows.head.noise)}개는
                    <b> 에어컨 사려는 사람 · 제조사 무상AS 찾는 사람</b>이라 빼고 셌습니다.
                    우리가 등록해 둔 단어는 {_fmtKRW(tool.registered)}개(광고그룹 {_fmtKRW(tool.adgroups)}개).
                    {toolRows.head.count > 0 && " 아래 빨간 줄을 위에서부터 광고그룹에 넣으면 됩니다."}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => { setToolOnlyMissing(v => !v); setToolShowAll(false); }}
                    style={{
                      padding: "7px 12px", borderRadius: 999,
                      border: `1px solid ${toolOnlyMissing ? "#DC2626" : t.border}`,
                      background: toolOnlyMissing ? "#DC262618" : "transparent",
                      color: toolOnlyMissing ? "#DC2626" : t.textMuted,
                      fontSize: 11, fontWeight: 900, cursor: "pointer",
                    }}>
                    {toolOnlyMissing ? "없는 것만 보는 중" : "등록된 것도 보는 중"}
                  </button>
                  <button
                    onClick={() => { setToolWorkOnly(v => !v); setToolShowAll(false); }}
                    style={{
                      padding: "7px 12px", borderRadius: 999,
                      border: `1px solid ${toolWorkOnly ? "#2563EB" : t.border}`,
                      background: toolWorkOnly ? "#2563EB18" : "transparent",
                      color: toolWorkOnly ? "#2563EB" : t.textMuted,
                      fontSize: 11, fontWeight: 900, cursor: "pointer",
                    }}>
                    {toolWorkOnly ? "우리 일 관련만" : "무관한 단어까지 전부"}
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, alignSelf: "center" }}>
                    {_fmtKRW(toolRows.filtered.length)}개
                  </span>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table className="mono" style={{
                    width: "100%", borderCollapse: "collapse",
                    fontSize: 11, fontVariantNumeric: "tabular-nums",
                  }}>
                    <thead>
                      <tr style={{ color: t.textMuted, fontWeight: 800 }}>
                        <th style={{ textAlign: "left",  padding: "5px 6px" }}>단어</th>
                        <th style={{ textAlign: "right", padding: "5px 6px" }}>월 검색량</th>
                        <th style={{ textAlign: "right", padding: "5px 6px" }}>모바일</th>
                        <th style={{ textAlign: "left",  padding: "5px 6px" }}>우리 광고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {toolRows.view.map(r => {
                        const st = !r.registered
                          ? { label: "없음 — 추가", color: "#DC2626" }
                          : r.on === false
                            ? { label: "꺼둠", color: "#D97706" }
                            : { label: "있음", color: "#94A3B8" };
                        return (
                          <tr key={r.keyword} style={{ borderTop: `1px solid ${t.border}` }}>
                            <td style={{
                              padding: "6px", color: t.text,
                              fontWeight: r.registered ? 700 : 900,
                              maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }} title={r.group ? `${r.keyword} · ${r.group}` : r.keyword}>{r.keyword}</td>
                            <td style={{
                              padding: "6px", textAlign: "right", fontWeight: 900,
                              color: r.registered ? t.textMuted : "#DC2626",
                            }}>
                              {r.low ? "10 미만" : _fmtKRW(r.total)}
                            </td>
                            <td style={{ padding: "6px", textAlign: "right", color: t.textMuted }}>
                              {r.low ? "-" : _fmtKRW(r.mobile)}
                            </td>
                            <td style={{ padding: "6px" }}>
                              <span style={{
                                display: "inline-block", padding: "2px 7px", borderRadius: 999,
                                background: `${st.color}22`, color: st.color,
                                fontSize: 10, fontWeight: 900, whiteSpace: "nowrap",
                              }}>{st.label}</span>
                              {r.group && (
                                <span style={{ marginLeft: 6, fontSize: 10, color: t.textMuted, fontWeight: 700 }}>
                                  {r.group}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {toolRows.filtered.length > 40 && (
                  <button
                    onClick={() => setToolShowAll(v => !v)}
                    style={{
                      marginTop: 8, padding: "7px 12px", borderRadius: 8,
                      border: `1px solid ${t.border}`, background: "transparent",
                      color: t.textMuted, fontSize: 11, fontWeight: 800, cursor: "pointer",
                    }}>
                    {toolShowAll ? "접기" : `나머지 ${_fmtKRW(toolRows.filtered.length - 40)}개 더 보기`}
                  </button>
                )}

                <div style={{ marginTop: 10, fontSize: 10.5, color: t.textMuted, fontWeight: 600, lineHeight: 1.75 }}>
                  ⓘ 검색량은 <b style={{ color: t.text }}>PC + 모바일 한 달 기준</b>입니다. 우리 손님은 대부분 모바일입니다.
                  <br/>
                  ⓘ <b>"10 미만"</b>은 네이버가 정확한 숫자를 안 주는 구간입니다. 사실상 검색이 없다는 뜻이라 넣어도 소용없습니다.
                  <br/>
                  ⓘ 씨앗 단어를 바꾸면 다른 목록이 나옵니다. 한 번에 5개씩 조회되니 여러 번 나눠 돌려보세요.
                </div>
              </>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

function Panel({ t, title, subtitle, children }) {
  return (
    <div style={{
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
      padding: "14px 14px 12px",
    }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.text, letterSpacing: "-0.2px" }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

function Metric({ t, label, value, suffix, accent, highlight }) {
  const color = highlight || (accent ? t.accent : t.text);
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 4,
      padding: "10px 12px",
      background: t.bgInset || "rgba(148, 163, 184, 0.05)",
      borderRadius: 8,
      minWidth: 0,
    }}>
      <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
      <span className="mono" style={{
        fontSize: 16, fontWeight: 800, color,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.3px",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {value}
        {suffix && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginLeft: 2 }}>{suffix}</span>}
      </span>
    </div>
  );
}

function FunnelStep({ t, label, value, sub, accent }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 4,
      padding: "12px 12px",
      background: accent ? (t.accentBg || "rgba(255, 27, 141, 0.08)") : (t.bgInset || "rgba(148, 163, 184, 0.05)"),
      border: `1px solid ${accent ? t.accent : "transparent"}`,
      borderRadius: 10,
      textAlign: "center",
    }}>
      <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
      <span className="mono" style={{
        fontSize: 22, fontWeight: 800,
        color: accent ? t.accent : t.text,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.5px",
      }}>{Number(value || 0).toLocaleString("ko-KR")}</span>
      {sub && (
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>{sub}</span>
      )}
    </div>
  );
}

export default MarketingScreen;

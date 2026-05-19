// V14 Task Utils — 시트 작업DB row → 내부 task object 변환
// AdminApp + EngineerApp + HappycallApp 공유 (재사용 module)

import { formatTimeKST } from "./dateLabel.js";

// V14 — 주소 첫 단어 = 지역 (예: "강남구 도곡동 ..." → "강남구")
export function v14ExtractRegion(address) {
  if (!address) return "";
  const first = String(address).trim().split(/\s+/)[0];
  return first || "";
}

// V14 — summary 텍스트 → workItems 배열 파싱
// "세척 · 벽걸이 ×1"                              → 1건
// "세척 · 벽걸이 ×1 + 냉매충전 · 4way ×1"          → 2건 (multi-item)
// "냉매충전 · (공통) ×1"                          → 1건
export function v14ParseSummary(summary) {
  if (!summary) return [];
  return String(summary).split(' + ').map(part => {
    const dotParts = part.split(/\s*·\s*/);
    const workType = (dotParts[0] || '').trim();
    let appliance = '', qty = 1;
    if (dotParts[1]) {
      const m = dotParts[1].match(/^(.+?)\s*[×x]\s*(\d+)/i);
      if (m) { appliance = m[1].trim(); qty = Number(m[2]) || 1; }
      else   { appliance = dotParts[1].trim(); }
    }
    return { workType, appliance, qty };
  }).filter(it => it.workType);
}

// V14 — 한국어 status → 영어 state 매핑
const V14_STATUS_TO_STATE = {
  "미배정": "waiting", "대기": "waiting",
  "확정": "scheduled", "배정": "scheduled", "예정": "scheduled",
  "이동중": "moving",
  "진행중": "active", "작업중": "active", "active": "active",
  "완료": "done", "정산완료": "done", "done": "done",
  "취소": "canceled", "canceled": "canceled",
};

export function v14StatusToState(status) {
  if (!status) return "waiting";
  const s = String(status).trim();
  return V14_STATUS_TO_STATE[s] || s;
}

// V14 — 시트 작업DB row → 내부 task 객체로 정규화
export function v14NormalizeTask(t) {
  if (!t) return null;
  const id        = t.id || t.taskId || t.task_id || t.작업번호 || "";
  const customer  = t.customer || t.고객명 || "";
  const phone     = t.phone || t.연락처 || t.전화 || "";
  const address   = t.address || t.주소 || "";
  const region    = t.region || t.지역 || v14ExtractRegion(address);
  const principal = t.principal || t.client || t.원청 || "";
  const channel   = t.channel || t.채널 || "";
  const summary   = t.summary || t.작업요약 || t.요약 || "";
  const status    = t.status || t.상태 || "";
  const reqDate   = t.requestedDate || t.scheduledDate || t.희망일자 || t.예약일 || "";
  const reqTime   = t.requestedTime || t.scheduledTime || t.희망시간 || t.예약시간 || "";
  const memo      = t.memo || t.note || t.작업메모 || t.비고 || "";
  const estimate  = Number(t.estimateTotal || t.quote || t.totalAmount || t.견적합계 || t.견적금액 || 0);
  const settlement = t.settlementStatus || t.정산상태 || "";

  // 2026-05-10 — 정산 필드 (Hybrid 구조)
  // GAS 응답에 engineerEarning 있으면 그거 사용 (비밀 영역 KA/KB 세척)
  // 아니면 calcCommission lookup 후 계산 (일반 영역)
  const addonFee = Number(t.addonFee || t.현장추가금 || 0);
  const extraFee = Number(t.extraFee || t.추가금 || t.addAmount || 0);
  const schedule  = t.schedule || [reqDate, reqTime].filter(Boolean).join(" ") || "협의";
  const scheduledAt = t.scheduledAt || t.확정일시 || t.confirmedAt || "";
  const summaryItems = v14ParseSummary(summary);
  const workType  = t.workType  || t.work_type || t.작업유형 || (summaryItems[0]?.workType)  || "";
  const appliance = t.appliance || t.기종      || (summaryItems[0]?.appliance) || "";
  const qty       = Number(t.qty || t.totalQty || t.수량 || (summaryItems[0]?.qty) || 1);
  const assignedEngineerName = t.assignedEngineer || t.engineer || t.배정기사 || "";
  // 2026-05-11 — P열 (추천기사) 매핑 추가 / 7단계 pendingAcceptances 측 catch
  const recommendedEngineer = t.recommendedEngineer || t.추천기사 || t.P || "";
  const startedAt   = t.startedAt   || t.시작시간 || "";
  const completedAt = t.completedAt || t.완료시간 || "";
  let workItems = Array.isArray(t.workItems) && t.workItems.length > 0 ? t.workItems : null;
  if (!workItems && summaryItems.length > 0) workItems = summaryItems;
  else if (!workItems && workType) workItems = [{ workType, appliance, qty }];

  // 2026-05-10 fix — scheduledDate fallback 추가 (N열 비어도 화면에 표시되도록)
  // 1순위 scheduledAt (N열) > 2순위 reqDate (희망일자) > 3순위 ID 내부 YYMMDD > 4순위 빈 값
  // AdminApp의 dateOf 패턴과 일관성 (workTypeCounts L3226 / NewReceptionScreen L4028)
  const fallbackScheduledDate = (() => {
    // 1순위: scheduledAt (N열)
    if (scheduledAt) {
      const s = String(scheduledAt);
      // 2026-05-16 fix — date-only(YYYY-MM-DD)만 slice, datetime은 KST 환산
      // 직전 버그 — /^\d{4}-\d{2}-\d{2}/는 datetime도 매칭해서 UTC 날짜 그대로 사용
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;  // date-only만
      const d = new Date(scheduledAt);
      if (!isNaN(d.getTime())) {
        // KST 로컬 변환 (브라우저 timezone 의존, 한국 사용자 기준)
        const yy = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, "0");
        const da = String(d.getDate()).padStart(2, "0");
        return `${yy}-${mo}-${da}`;
      }
    }
    // 2순위: reqDate (희망일자)
    if (reqDate) {
      const s = String(reqDate);
      if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0, 10);
    }
    // 3순위: ID 내부 YYMMDD 추출 (예: O260510-001 → 2026-05-10)
    const idStr = String(id || t.taskId || t.작업번호 || "");
    const m = idStr.match(/(\d{6})-/);
    if (m) {
      const yymmdd = m[1];
      return `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
    }
    // 4순위: 빈 값
    return "";
  })();

  // 2026-05-16 Phase 4 통합 2-E #2 — commission 별도 계산 안 함 (DB payments 결과 직접 사용)
  // GAS 의존 제거 후 호환 코드도 제거. compute_payment v7 trigger spec — 작업 완료 시 자동 계산

  // 2026-05-11 진단 — window.__DEBUG_NORMALIZE 켜면 status 매핑 추적
  if (typeof window !== "undefined" && window.__DEBUG_NORMALIZE) {
    console.log("[normalize-status]", {
      id,
      status_normalized: status,
      assignedEngineer: assignedEngineerName,
      raw_상태: t["상태"],
      raw_R: t.R,
      raw_status: t.status,
      raw_배정기사: t["배정기사"],
      raw_Q: t.Q,
      row_keys: Object.keys(t).slice(0, 35),
    });
  }

  return {
    id,
    // Phase 4-2 fix — taskCode 측 작업번호 우선 (UUID는 fallback)
    taskCode: t.taskCode || t.taskNo || t.task_no || t.작업번호 || id,
    taskNo:   t.taskNo   || t.task_no || t.작업번호 || "",
    customer, phone, address, region,
    principal, channel, workType, appliance, qty,
    summary, status,
    state: v14StatusToState(status),
    schedule, memo,
    estimateTotal: estimate,
    addonFee,
    extraFee,
    // 2026-05-19 Phase 5 Step 0.C-13 — is_legacy (Migration 042) 매핑
    isLegacy: !!(t.isLegacy ?? t.is_legacy),
    requestedDate: reqDate,
    requestedTime: reqTime,
    scheduledAt,
    scheduledDate: fallbackScheduledDate,
    // 2026-05-15 fix — KST 변환 (이전 string slice는 UTC raw 노출돼 기사 메인 카드에 07:00 표시)
    scheduledTime: formatTimeKST(scheduledAt),
    settlementStatus: settlement,
    workItems: workItems || [],
    time: reqTime || formatTimeKST(scheduledAt) || reqDate || "협의",
    type: "work",
    assignedEngineer: assignedEngineerName,
    engineer: assignedEngineerName || null,
    recommendedEngineer,
    startedAt, completedAt,
    // Phase 4-2 fix — DB 전환 측 누락 필드 (dashboardStats 카운트 catch)
    createdAt:  t.createdAt  || t.created_at  || t.receivedAt || t.received_at || "",
    receivedAt: t.receivedAt || t.received_at || "",

    // Phase 4 후속 — 자동 배정 푸시 후보 (Realtime 측 catch)
    pushCandidates: Array.isArray(t.pushCandidates) ? t.pushCandidates
                  : Array.isArray(t.push_candidates) ? t.push_candidates
                  : [],
    // 2026-05-16 Phase 4 통합 2-D — DB payments 적용 spec (compute_payment v7)
    payment:          t.payment || null,
    engineer_amount:  t.engineer_amount  ?? 0,
    principal_amount: t.principal_amount ?? 0,
    owner_amount:     t.owner_amount     ?? 0,
    calc_method:      t.calc_method      ?? null,
    payment_status:   t.payment_status   ?? null,
    is_balanced:      t.is_balanced      ?? null,
    // 2026-05-18 Fix #29 — 자금 흐름 트랙 (Migration 031/032, compute_payment v10 자동 결정).
    // 'A'=일일정산(기사→회사), 'B'=월정산(회사→기사). isTrackARemittance가 task.track 판별.
    // tasksDb.rowToTask가 이미 매핑한 top-level track 우선, 누락 시 payment 객체에서 재추출.
    track: t.track || t.payment_track || t.paymentTrack || t.payment?.track || 'A',
    // 2026-05-17 Migration 025 — 기사 → 회사 송금 흐름
    engineerRemittedAt:       t.engineerRemittedAt       || null,
    engineerRemitConfirmedAt: t.engineerRemitConfirmedAt || null,
    engineerRemitConfirmedBy: t.engineerRemitConfirmedBy || null,

    _api: true,
  };
}

// V14 — getTasks API 응답에서 task 배열 catch (다양한 shape catch)
export function v14FindTaskList(res) {
  if (!res) return { list: null, key: null };
  if (Array.isArray(res)) return { list: res, key: '(root array)' };
  const candidates = ['tasks', 'data', 'list', 'items', 'rows', 'result', 'records'];
  for (const key of candidates) {
    if (Array.isArray(res[key])) return { list: res[key], key };
  }
  // 1단계 nested catch
  for (const key of Object.keys(res)) {
    const v = res[key];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const k2 of candidates) {
        if (Array.isArray(v[k2])) return { list: v[k2], key: `${key}.${k2}` };
      }
    }
  }
  return { list: null, key: null };
}

// V14 — 본인 작업만 필터 (이름 매칭 / engineerId 매칭 양쪽 catch)
// 시트 Q 배정기사 = 이름 (예: "류근학")
// user 객체 = name (예: "류근학") + engineerId (예: "E016")
export function filterTasksForEngineerV14(tasks, engineerName, engineerId) {
  if (!engineerName && !engineerId) return [];
  return (tasks || []).filter(t => {
    if (engineerName && (t.assignedEngineer === engineerName || t.engineer === engineerName)) return true;
    if (engineerId && (t.assignedEngineerId === engineerId || t.engineerId === engineerId)) return true;
    return false;
  });
}

// ============================================
// AdminApp — 시안 4-V4 (메인 대시보드) + 4 시안 흐름
// 작성: 2026-05-01 EOD (Step 1: 메인 + placeholder)
// 다음 단계: 4 placeholder 화면 → 실제 시안 1 / C / 5-V3 / 3-V5 코드
// ============================================

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Phone, MessageCircle, Snowflake, Wrench, Settings, Zap, ChevronRight, ChevronDown, ChevronUp,
  Sun, Moon, Plus, ArrowLeft, ArrowRight, User, MapPin, Calendar,
  Clock, FileText, RotateCcw, CheckCircle2, AlertCircle, Star, Search,
  Users, BarChart3, TrendingUp, Activity, Wallet, Bell, Camera,
  Briefcase, Hash, AlertTriangle, MoreVertical, Award, XCircle, Edit3, ClipboardList,
} from "lucide-react";
import { OllitMark } from "../components/OllitMark.jsx";
import { EngineerBadge } from "../components/EngineerBadge.jsx";
import { AdminTaskDetailScreen } from "../components/AdminTaskDetailScreen.jsx";
// 2026-05-19 Phase 5 Step 0.C-4 — 변경 이력 audit log (Migration 039)
import { insertTaskChange } from "../lib/taskChangesDb.js";
// 2026-05-20 Phase 5 Step 0.F-1 — 작업유형 색 사이드바 (V14 spec)
import { getWorkTypeColors } from "../utils/workTypeColors.js";
import { ServiceTypeIcon } from "../components/ServiceTypeIcon.jsx";
import { NotiScreen } from "../components/notifications/NotiScreen.jsx";
import { applyTheme as applyThemeVars, loadTheme as loadThemeSaved } from "../styles/themes.js";
import { VisitOnlyDialog } from "../components/VisitOnlyDialog.jsx";
import { VISIT_FEE, getVisitReasonLabel } from "../data/visitFee.js";
import { setEngineersCache } from "../utils/engineersCache.js";
import { ENABLE_MOCK } from "../config/env.js";
import { setPrincipalsCache } from "../data/principals.js";
import { setEngineerRatesCache, setEngineerSkillsCache } from "../data/engineers.js";
import { setUsersCache } from "../data/users.js";
import { TaskCardMenu } from "../components/TaskCardMenu.jsx";
import { MemoAddScreen } from "../components/MemoAddScreen.jsx";
import { loadMemos, getMemoTypeLabel } from "../data/memos.js";
import { TaskEditScreen as TaskFullEditScreen } from "../components/TaskEditScreen.jsx";
import { TaskHistoryScreen } from "../components/TaskHistoryScreen.jsx";
import { getHistoryCount } from "../data/taskHistory.js";
import { UsolNScreen } from "../components/UsolNScreen.jsx";
import { AllEngineersModal } from "../components/AllEngineersModal.jsx";
import { SettlementScreen as SettlementDailyClose } from "../components/SettlementScreen.jsx";
import { PrincipalSettlementScreen } from "../components/PrincipalSettlementScreen.jsx";
import { startDailyAlertScheduler, stopDailyAlertScheduler } from "../utils/dailyAlertScheduler.js";
import { computeDashboardStats, TASK_FILTERS, _getEffectiveStatus } from "../utils/dashboardStats.js";
import { getCurrentUser as getCurrentUserPerm } from "../data/users.js";
import { EngineerListScreen } from "../components/EngineerListScreen.jsx";
import { EngineerEditScreen } from "../components/EngineerEditScreen.jsx";
import { createEmptyEngineer } from "../data/engineers.js";
import { RegionListScreen } from "../components/RegionListScreen.jsx";
import { RegionEditScreen } from "../components/RegionEditScreen.jsx";
import { createEmptyRegion } from "../data/regions.js";
import { SettingsScreen } from "../components/SettingsScreen.jsx";
import { CompanyAccountScreen } from "../components/CompanyAccountScreen.jsx";
import { UserListScreen } from "../components/UserListScreen.jsx";
import { UserEditScreen } from "../components/UserEditScreen.jsx";
import { NotificationsScreen as NotiSettingsScreen } from "../components/NotificationsScreen.jsx";
import { createEmptyUser } from "../data/users.js";
import { PrincipalListScreen } from "../components/PrincipalListScreen.jsx";
import { PrincipalEditScreen } from "../components/PrincipalEditScreen.jsx";
import { NaverUploadScreen } from "../components/NaverUploadScreen.jsx";
import { bulkInsertUsolNOrders } from "../lib/usolNTasksDb.js";
import { RatesManagementScreen } from "../components/RatesManagementScreen.jsx";
import { CommissionPolicyManagement } from "../components/admin/CommissionPolicyManagement.jsx";
import { createEmptyPrincipal } from "../data/principals.js";
// V14 Week 1 1F + 2A + 2B-3 — 진짜 API (시뮬 createTask + 시뮬 22건 + RecommendScreen 폐기)
// Phase 3-1 — 정책 호출은 DB (commissionPoliciesDb.js) 측 어댑터 사용. 시트 calculateFee / getAllPolicies 폐기.
// Phase 3-3 — 원청 마스터도 DB (principalsDb.js) 측 어댑터 사용. 시트 getPrincipals 폐기.
import {
  invalidateRecommendCache,
} from "../api.js";
import {
  loadTasksForRole as apiGetTasks,
  createTaskAdapter as apiCreateTask,
  updateTaskAdapter as apiUpdateTask,
  approveCancelAdapter as apiApproveCancel,
  rejectCancelAdapter as apiRejectCancel,
  assignEngineerAdapter as apiAssignEngineer,
} from "../data/tasksDb.js";
// Round 2 — 취소 RPC (옛 어댑터와 분리)
import {
  adminFullCancel,
  adminPartialCancelItem,
  adminSetCancelCompensation,
} from "../lib/cancelRpc.js";
import { PartialCancelDialog } from "../components/CancelDialogs.jsx";
import { listEngineerRatesFromDb } from "../lib/engineerRatesDb.js";
import { listEngineerSkillsFromDb } from "../lib/engineerSkillsDb.js";
import { recommendEngineersGroupedAdapter } from "../utils/engineerRecommendation.js";
import {
  calculateFeeCompat,
  calculateCommissionMultiRpc,
  CALC_METHOD_LABEL,
  listPoliciesSheetShape,
} from "../lib/commissionPoliciesDb.js";
import { listPrincipalsFromDb } from "../lib/principalsDb.js";
import { listUsersFromDb } from "../lib/usersDb.js";
import { listEngineersFromDb } from "../lib/engineersDb.js";

// 🚀 Phase 1-B 2-E ─ 실시간 새로고침 hook
import { useRealtime } from "../hooks/useRealtime.js";
// Phase 4 후속 — Supabase Realtime 구독 (폴링 폐기)
import { useRealtimeTasks } from "../hooks/useRealtimeSubscription.js";
// Phase 4 후속 — push_candidates 박음 (AutoAssignScreen 측)
import { supabase } from "../lib/supabase.js";

// 2026-05-14 — 모듈 레벨 Set 박지 X
// StrictMode 측 cleanup → 2차 mount 측 early return 박은 영역 catch 박힘
// → setCandidates 박지 X / 화면 "후보 없음" 박힘
// 대안: DB 사전 조회 측만 박음 (UI 측 setCandidates 박힘 / DB 측 1회만 박힘)
import { formatTimeOnly, formatDateOnly, formatScheduleShort, todayYmd, toKstYmd } from "../utils/dateLabel.js";
import { isTrackARemittance, isPendingRemit } from "../utils/remitFilter.js";
import { confirmEngineerRemit, cancelConfirmRemit } from "../lib/paymentsDb.js";
import SettlementHistoryContent from "../components/admin/SettlementHistoryContent.jsx";
import {
  listNotifications as listStoredNotifications,
  markAsRead as markStoredAsRead,
  markAllAsRead as markAllStoredAsRead,
} from "../utils/notificationStore.js";

// IndexedDB 측 알림 → AdminApp NotiScreen 형식 어댑트
function adaptStoredAdminNoti(stored) {
  const title = stored.title || "";
  // 2026-05-15 fix — NOTI_CATEGORIES 측 박은 키 박힌 거 박기 (NotiCard 측 return null 박지 X)
  let category = "team_message";
  if (/배정|새 작업|새 접수|재배정/.test(title)) category = "new_assignment";
  // 2026-05-16 — 시작/완료/일정 분리 (옛 spec은 모두 schedule_changed로 박힘). 순서 중요 — 시작/완료가 일정 매칭보다 먼저
  else if (/시작|진행/.test(title)) category = "work_started";
  else if (/완료/.test(title)) category = "work_completed";
  else if (/일정/.test(title)) category = "schedule_changed";
  else if (/취소/.test(title)) category = "work_canceled";
  else if (/정산|입금/.test(title)) category = "payment_confirmed";
  return {
    id: stored.id,
    category,
    title,
    subtitle: stored.body || "",
    createdAt: new Date(stored.timestamp || Date.now()),
    read: !!stored.read,
    relatedId: stored.taskId || null,
    targetScreen: stored.url || null,
    _stored: true,
  };
}

// V14 Step 3 Fix 3 — 동적 날짜 (페이지 진입 시점 기준 / IIFE 박기)
const NOW = (() => {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
})();
const TODAY = (() => {
  const d = new Date();
  const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const date = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return `${day} · ${date} ${month}`;
})();
const TODAY_DATE = "2026-04-27";  // 비교용 (assignedDate / completedDate / workDate)
const ADMIN_USER = "이대표";

// ============================================
// Mock 데이터 (시안 4-V4 / 1 / 5-V3 / 3-V5 검증용)
// ============================================

// Step 5-7-C — TODAY_STATS 운영/시뮬 분기
const _TODAY_STATS_MOCK = {
  newReceived: 5, assigned: 2, confirmed: 4, inProgress: 3, completed: 8,
  revenue: 2850000, myMargin: 1140000, engineerNet: 1710000, principalFee: 480000,
};
const _TODAY_STATS_EMPTY = {
  newReceived: 0, assigned: 0, confirmed: 0, inProgress: 0, completed: 0,
  revenue: 0, myMargin: 0, engineerNet: 0, principalFee: 0,
};
const TODAY_STATS = ENABLE_MOCK ? _TODAY_STATS_MOCK : _TODAY_STATS_EMPTY;

// V14 헌법 v6 — 운영 7개 원청 (api-backend.gs V14_PRINCIPAL_CODES와 동기화 / KA·KB 분리)
const PRINCIPALS = [
  { id: "올데이케어",      label: "올데이케어",       color: "#FF1B8D", code: "O"    },
  { id: "에어컨프로 (KA)", label: "에어컨프로 (KA)",  color: "#06B6D4", code: "A"    },
  { id: "쿨가이 (KB)",     label: "쿨가이 (KB)",      color: "#0891B2", code: "K"    },
  { id: "용인컴퍼니",      label: "용인",              color: "#888780", code: "Y"    },
  { id: "유솔홈케어 H",    label: "유솔홈케어 H",      color: "#10B981", code: "YS"   },
  { id: "유솔홈케어 N",    label: "유솔홈케어 N",      color: "#03C75A", code: "YS-N" },
  { id: "크리크린",        label: "크리크린",          color: "#7F77DD", code: "CK"   },
];

// 원청 라벨 색 — V14 헌법 + 옛 호환 (시뮬 22건 점진 폐기)
const PRINCIPAL_COLORS = {
  ...Object.fromEntries(PRINCIPALS.map(p => [p.id, p.color])),
  // 옛 시뮬 호환 (점진 폐기)
  "에어컨프로": "#06B6D4",
  "쿨가이":    "#0891B2",
};

// V14 — 회사 수익 계산 (commissionCalc.js로 폐기 통합 / principals.js 정책 그대로)
// task.principal(원청 이름) → calcTaskEarning → { total, engineer, principal, company }
// 기존 호출자 호환: { total, rate, amount, isConfirmed } 모양 유지
// amount = 회사가 가져가는 돈 (= principal + company = total - engineer)
function calculateCommission(task) {
  // 2026-05-16 Phase 4 통합 2-D — DB payments 박은 spec (compute_payment v7)
  const total = Number(task.estimateTotal) || 0;
  const engineer = Number(task.engineer_amount) || 0;
  const amount = Math.max(0, total - engineer);
  const rate = total > 0 ? Math.round((amount / total) * 100) : 0;
  const isConfirmed = task.state === "done" || !!task.engineer_amount;
  return { total, rate, amount, isConfirmed };
}

// Step 5-3 — 작업 종류 단일 진실 소스 (편집 친화)
// enabled: Phase 1 박힌 작업 (세척/냉매충전) / 나머지는 disabled (Phase 2 시안 미정)
// workflow: manual_with_recommendation = 수동 추천 / auto_first_accept = 자동 첫 응답
// priority: 메인 = 가장 복잡한 작업 (1=세척 ... 99=냉매충전)
const WORK_TYPES_CONFIG = {
  "세척":     { enabled: true,  workflow: "manual_with_recommendation", needsAppliance: true,  priority: 1  },
  "냉매충전": { enabled: true,  workflow: "auto_first_accept",          needsAppliance: false, priority: 99 },
  "설치":     { enabled: false, workflow: "manual_with_recommendation", needsAppliance: true,  priority: 2  },
  "누설":     { enabled: false, workflow: "manual_with_recommendation", needsAppliance: true,  priority: 3  },
  "수리":     { enabled: false, workflow: "manual_with_recommendation", needsAppliance: true,  priority: 4  },
  "점검":     { enabled: false, workflow: "manual_with_recommendation", needsAppliance: true,  priority: 5  },
};

// V14 Step 2-B-2 — KA 1way 차등 단가 (동일 집 추가)
// UI: 사용자가 "1way" + qty 입력 → 견적 자동 계산
// 저장: workItems가 "1way 첫 대" / "1way 추가" 두 행으로 분리 (시트 매칭)
// 표시: 카드/리스트는 두 행을 다시 합쳐 "1way × N"으로 노출
const KA_PRINCIPAL_NAME       = "에어컨프로 (KA)";
const KA_1WAY_FIRST_PRICE     = 90000;
const KA_1WAY_ADDITIONAL_PRICE = 70000;

// KA + 냉매충전 + 1way qty 합계 → 자동 견적
// 첫 대 90,000 + 추가 (qty-1) × 70,000
function calcKaOnewayEstimate(workItems) {
  if (!Array.isArray(workItems)) return null;
  const onewayQtySum = workItems.reduce((sum, w) => {
    if (w.workType === "냉매충전" && w.appliance === "1way") return sum + (w.qty || 1);
    return sum;
  }, 0);
  if (onewayQtySum <= 0) return null;
  return KA_1WAY_FIRST_PRICE + Math.max(0, onewayQtySum - 1) * KA_1WAY_ADDITIONAL_PRICE;
}

// KA 작업 저장 직전 — "1way" + qty=N 항목을 "1way 첫 대" 1 + "1way 추가" (N-1)로 분리
// KA 외 원청 / 다른 기종 / 1way가 아닌 항목은 그대로
function splitWorkItemsForKa1way(items, principalName) {
  if (principalName !== KA_PRINCIPAL_NAME || !Array.isArray(items)) return items;
  const out = [];
  for (const item of items) {
    if (item.workType === "냉매충전" && item.appliance === "1way") {
      const qty = item.qty || 1;
      out.push({ ...item, appliance: "1way 첫 대", qty: 1 });
      if (qty > 1) {
        out.push({ ...item, appliance: "1way 추가", qty: qty - 1 });
      }
    } else {
      out.push(item);
    }
  }
  return out;
}

// 카드/리스트 표시용 — 분리 저장된 KA 1way 행을 단일 "1way × N"으로 합쳐 보여줌
// "1way 첫 대" + "1way 추가" 행이 둘 다 있을 때만 합침. 다른 항목은 그대로
function mergeKaOneway(items) {
  if (!Array.isArray(items)) return items;
  const hasFirst = items.some(w => w.workType === "냉매충전" && w.appliance === "1way 첫 대");
  if (!hasFirst) return items;
  const merged = [];
  let mergedQty = 0;
  let mergedTemplate = null;
  for (const item of items) {
    if (item.workType === "냉매충전" &&
        (item.appliance === "1way 첫 대" || item.appliance === "1way 추가")) {
      mergedQty += (item.qty || 1);
      if (!mergedTemplate) mergedTemplate = item;
    } else {
      merged.push(item);
    }
  }
  if (mergedTemplate) {
    merged.push({ ...mergedTemplate, appliance: "1way", qty: mergedQty });
  }
  return merged;
}

function sortWorkItemsByPriority(workItems) {
  if (!Array.isArray(workItems)) return [];
  return [...workItems].sort((a, b) =>
    (WORK_TYPES_CONFIG[a.workType]?.priority || 100) - (WORK_TYPES_CONFIG[b.workType]?.priority || 100)
  );
}

function determineMainWorkType(workItems) {
  const sorted = sortWorkItemsByPriority(workItems);
  return sorted[0]?.workType || null;
}

function determineWorkflow(workItems) {
  const main = determineMainWorkType(workItems);
  return WORK_TYPES_CONFIG[main]?.workflow || "manual_with_recommendation";
}

function hasRefrigerantItem(workItems) {
  return Array.isArray(workItems) && workItems.some(it => it.workType === "냉매충전");
}

// Step 5-1e — 단일 작업 항목 포맷 (냉매충전은 기종 X / 가격 동일)
function formatWorkItem(item) {
  if (!item) return "";
  if (item.workType === "냉매충전") {
    return `냉매충전 ×${item.qty || 1}`;
  }
  return `${item.workType} · ${item.appliance || "기종 미정"} ×${item.qty || 1}`;
}

// V14 2B-1 fix — 작업 항목 = 기종만 (작업유형은 별도 칩/알약 표시)
// 단일: "벽걸이 ×1" / multi: "벽걸이 ×1, 4way ×1" / 냉매충전: "냉매충전 ×1" (기종 없을 때 fallback)
// Step 2-B-2 — KA "1way 첫 대" + "1way 추가" 분리 저장 → 표시는 "1way × N" 합쳐서
function formatWorkItemsAppliance(workItems) {
  const items = mergeKaOneway(workItems);
  if (!items || items.length === 0) return "";
  return items.map(item => {
    const qty = item.qty || 1;
    const appliance = item.appliance && String(item.appliance).trim();
    if (appliance) return `${appliance} ×${qty}`;
    // 기종이 비어있으면 → workType fallback (예: 옛 냉매충전 단일)
    return `${item.workType || "—"} ×${qty}`;
  }).join(", ");
}

// Step 5-1d — workItems 카드/알림 표시 (작업 종류별 그룹화)
// 규칙:
// - 1건            → "세척 · 벽걸이 ×2" / "냉매충전 ×1"
// - 같은 종류 복수 → "세척 · 벽걸이 ×2 외 1건"
// - 다른 종류 추가 → "세척 · 벽걸이 ×2 (+ 냉매충전 ×1)"
// - 혼합           → "세척 · 벽걸이 ×2 (+ 냉매충전 ×1, 점검 ×1)"
function formatWorkItems(workItems) {
  // Step 2-B-2 — KA 1way 분리 저장된 항목은 합쳐서 표시
  const items = mergeKaOneway(workItems);
  if (!items || items.length === 0) return "";
  if (items.length === 1) return formatWorkItem(items[0]);
  // Step 5-1e (통합) — 우선순위 정렬 후 메인 선택
  const sorted = sortWorkItemsByPriority(items);
  const main = sorted[0];
  const mainText = formatWorkItem(main);

  const others = sorted.slice(1);
  const grouped = {};
  let sameTypeCount = 0;
  for (const item of others) {
    if (item.workType === main.workType) {
      sameTypeCount += 1;
    } else {
      grouped[item.workType] = (grouped[item.workType] || 0) + (item.qty || 1);
    }
  }
  const extraTypes = Object.entries(grouped).map(([wt, qty]) => `${wt} ×${qty}`).join(", ");
  if (extraTypes && sameTypeCount > 0) return `${mainText} 외 ${sameTypeCount}건 (+ ${extraTypes})`;
  if (extraTypes)                     return `${mainText} (+ ${extraTypes})`;
  return `${mainText} 외 ${sameTypeCount}건`;
}

// ============================================
// Step 5-1a — 카톡 텍스트 자동 파싱
// ============================================
// 운영 원칙: "두 번 일 안 하기" — 고객 카톡 텍스트 그대로 붙여넣기 → 폼 자동 채움
//
// 자동 하이픈 (공용)
function formatPhone(raw) {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
//
// 테스트 케이스:
// 케이스 1:
//   "서울 중구 마장로18길 16, 306호
//    5월 2일 13:30 입니다!
//    16만원
//    토요일 3-4
//    010-9289-2116"
//   기대:
//     phone: "010-9289-2116"
//     address: "서울 중구 마장로18길 16, 306호"
//     requestDate: "2026-05-02"
//     requestTime: "13:30"
//     estimatedPrice: 160000
//
// 케이스 2:
//   "외도민: 논현동 97-2 103호
//    현관 비번 860903
//    아니 스탠드1 벽걸이1
//    +82 10-9053-9590
//    가격은 17"
//   기대:
//     customer: "외도민"
//     phone: "010-9053-9590"
//     address: "논현동 97-2 103호"
//     applianceItems: [{스탠드 1}, {벽걸이 1}]
//     workItems: [] (작업 종류 미인식 → 사장님 직접 선택)
//     estimatedPrice: 170000 (확인 필요)
//
// 케이스 3 (Step 5-1e — 세척+가스, 냉매충전은 기종 X):
//   "세척이랑 가스충전 같이 부탁드려요
//    벽걸이 2대
//    010-1234-5678"
//   기대:
//     workItems: [
//       { workType: "냉매충전", appliance: "", qty: 1 },   ← 기종 X
//       { workType: "세척", appliance: "벽걸이", qty: 2 },
//     ]
//     phone: "010-1234-5678"
// 2026-05-21 — KA 자유 텍스트 파서 (라벨 X / 전화 앵커 + "가.충" 패턴)
//   입력 예: "공릉동공릉아파트 603동1505호\n벽걸이 .가.충. 70.000\n01039291303"
//   출력: 기존 parseKakaoText 측 동일 형식 (handleAutoFill 측 매핑 그대로)
function parseKaText(text, phoneMatch) {
  const result = { matched: [], unmatched: [] };

  // 전화번호 표준화 (formatPhone 사용)
  let pDigits = phoneMatch[0].replace(/^\+?82\s?-?\s?/, "").replace(/\D/g, "");
  if (pDigits.startsWith("10") || pDigits.startsWith("11") || pDigits.startsWith("16") || pDigits.startsWith("17") || pDigits.startsWith("18") || pDigits.startsWith("19")) {
    pDigits = "0" + pDigits;
  }
  result.phone = formatPhone(pDigits);
  result.matched.push("연락처");

  // 전화번호 측 측 측측 / 측측 분리
  const phoneIdx = text.indexOf(phoneMatch[0]);
  const before = text.slice(0, phoneIdx).replace(/\s+$/, "");
  const after  = text.slice(phoneIdx + phoneMatch[0].length).trim();

  // 측측 측 측 단위 split (빈 측측 제거)
  const lines = before.split(/\n+/).map(s => s.trim()).filter(Boolean);

  // "가.충" / "가 . 충" / "가충" 측 측측 (= 종류측)
  const gachungRegex = /가\s*\.?\s*충/;
  const itemLineIdx = lines.findIndex(l => gachungRegex.test(l));

  if (itemLineIdx >= 0) {
    const itemLine = lines[itemLineIdx];
    const addressLines = lines.slice(0, itemLineIdx);

    // 주소 = 종류측 측측측측 합침 (1~3측측 가변)
    if (addressLines.length > 0) {
      result.address = addressLines.join(" ").replace(/\s+/g, " ").trim();
      result.matched.push("주소");
    }

    // 기종 측 측 (한국어 측 측 / 폼 매칭) — 측 측 측 X / 측 측 측 측
    //   사장님 spec: KA 1way 측 = 자동 측 (splitWorkItemsForKa1way 측 측)
    const APPLIANCE_KR = ["벽걸이", "1way", "스탠드", "4way", "원형", "투인원"];
    let appliance = null;
    for (const kr of APPLIANCE_KR) {
      if (itemLine.includes(kr)) { appliance = kr; break; }
    }

    // 금액 측 — "가.충" 측측 측측측 측측 측 측 (전화 측측 측 측 X)
    //   "70.000" / "100.000" → 70000 / 100000 (점 천단위 패턴 우선)
    //   "70000" 측 측 = 측 숫자 측 측 측
    const priceLine = itemLine.replace(gachungRegex, " ");
    const dotPriceMatch = priceLine.match(/(\d{1,3}(?:\.\d{3})+)/);
    const plainPriceMatch = priceLine.match(/(\d{4,})/);
    if (dotPriceMatch) {
      result.estimatedPrice = parseInt(dotPriceMatch[1].replace(/\./g, ""), 10);
      result.matched.push("금액");
    } else if (plainPriceMatch) {
      result.estimatedPrice = parseInt(plainPriceMatch[1], 10);
      result.matched.push("금액");
    }

    // workItems 측 (= 냉매충전 + 기종 / qty=1 default)
    if (appliance) {
      result.workItems = [{ workType: "냉매충전", appliance, qty: 1 }];
      result.applianceItems = [{ appliance, qty: 1 }];
      result.detectedWorkTypes = ["냉매충전"];
      result.matched.push("기종");
      result.matched.push("작업 종류 1건");
    }
  }

  // 원청 = KA 측 (= 패턴 측 측 측 측 = 측 측)
  result.principal = "에어컨프로 (KA)";
  result.matched.push("원청(KA)");

  // 메모 = 전화 측측측측 측 (= 측 측 측 측만)
  if (after) {
    result.memo = after;
    result.matched.push("메모");
  }

  return result;
}

function parseKakaoText(text) {
  const result = { matched: [], unmatched: [] };
  if (!text || !text.trim()) return result;

  // 1. 연락처 (다양한 형식: +82 / 국가코드 / 공백 / 점 / 하이픈)
  const phoneRegex = /(?:\+?82[\s-]?)?0?1[0-9][\s.-]?\d{3,4}[\s.-]?\d{4}/;
  const phoneMatch = text.match(phoneRegex);

  // 2026-05-21 — KA 패턴 측 측 "가.충" / "가 . 충" / "가충" 측 + 전화 측 측 → KA 측 측 측
  //   KA 측 = 라벨 X / 자유 텍스트 / 측 측 측 측 측 측 측 (= 측 측 측 측 측 측 측 측 측)
  if (phoneMatch && /가\s*\.?\s*충/.test(text)) {
    return parseKaText(text, phoneMatch);
  }
  if (phoneMatch) {
    let p = phoneMatch[0].replace(/^\+?82\s?-?\s?/, "").replace(/\D/g, "");
    if (p.startsWith("10") || p.startsWith("11") || p.startsWith("16") || p.startsWith("17") || p.startsWith("18") || p.startsWith("19")) {
      p = "0" + p;
    }
    result.phone = formatPhone(p);
    result.matched.push("연락처");
  }

  // 2. 금액 (만원 단위 + 원 단위 + 콤마 형식 처리)
  const priceRegex1 = /(\d+)\s*만\s*원?/;          // "16만원" / "17만"
  const priceRegex2 = /가격은?\s*(\d{1,3})\b/;     // "가격은 17"
  // V14 — 콤마 + 원 형식 처리 (예: "100,000원" / "견적: 100,000원" / "1,000,000")
  const priceRegex3 = /(?:견적|금액|가격)\s*[:：]?\s*(\d{1,3}(?:,\d{3})+|\d{4,})\s*원?/;
  const priceRegex4 = /(\d{1,3}(?:,\d{3})+)\s*원/;
  let priceMatch = text.match(priceRegex1);
  if (priceMatch) {
    result.estimatedPrice = parseInt(priceMatch[1]) * 10000;
    result.matched.push("금액");
  } else if ((priceMatch = text.match(priceRegex3))) {
    result.estimatedPrice = parseInt(priceMatch[1].replace(/,/g, ""), 10);
    result.matched.push("금액");
  } else if ((priceMatch = text.match(priceRegex4))) {
    result.estimatedPrice = parseInt(priceMatch[1].replace(/,/g, ""), 10);
    result.matched.push("금액");
  } else {
    priceMatch = text.match(priceRegex2);
    if (priceMatch) {
      const n = parseInt(priceMatch[1]);
      result.estimatedPrice = n * 10000;
      result.priceNeedsConfirm = true;
      result.priceRawValue = n;
      result.matched.push("금액 (확인 필요)");
    }
  }

  // 3. 주소
  // V14 — 0순위: "주소:" 박은 catch (콜론 박은 후 줄 끝까지)
  const addrColonRegex = /주소\s*[:：]\s*([^\n]+)/;
  const addrColonMatch = text.match(addrColonRegex);
  if (addrColonMatch) {
    result.address = addrColonMatch[1].replace(/[\s,!.?]+$/, "").trim();
    result.matched.push("주소");
  } else {
    // 1순위: 시 키워드 + 그 줄 끝까지 (greedy, 줄바꿈 전까지)
    const cityRegex = /(서울|경기|인천|부산|대구|광주|대전|울산|세종|제주)[^\n]+/;
    const cityMatch = text.match(cityRegex);
    if (cityMatch) {
      result.address = cityMatch[0].replace(/[\s,!.?]+$/, "").trim();
      result.matched.push("주소");
    } else {
      // 2순위: 동/구/로/길 키워드 (이름 콜론 이후 / 공백 뒤 / 줄 시작)
      const kwRegex = /(?:^|[\s:：])([가-힣]{2,}(?:동|구|로|길)[\s\d\-,]*\d+(?:\s*[가-힣]+\d*호?)?)/m;
      const kwMatch = text.match(kwRegex);
      if (kwMatch) {
        result.address = kwMatch[1].replace(/[\s,!.?]+$/, "").trim();
        result.matched.push("주소");
      } else {
        // V14 3순위: 짧은 구/시 박은 catch (예: "강남구" / "송파구")
        const shortRegex = /(?:^|[\s:：])([가-힣]{2,4}(?:구|시))(?:\s|$|[,.!?])/m;
        const shortMatch = text.match(shortRegex);
        if (shortMatch) {
          result.address = shortMatch[1].trim();
          result.matched.push("주소");
        }
      }
    }
  }

  // 4. 이름 (콜론 패턴)
  // V14 Phase 2.5 — nameRegex2 blacklist 박기 (라벨 단어 박지 X)
  // 옛 동작 주의: '원청:', '주소:', '기종:' 라벨이 들어가면 이름으로 인식됨 ⚠️
  const NAME_LABEL_BLACKLIST = new Set([
    "원청", "주소", "연락처", "전화", "핸드폰", "휴대폰",
    "기종", "견적", "금액", "가격", "수량",
    "작업", "유형", "작업유형",
    "일정", "시간", "날짜", "희망",
    "메모", "비고", "요청", "사유",
    "고객", "성함", "성명", "이름",
    "확정", "예약", "구분", "채널",
  ]);
  const nameRegex1 = /(?:이름|고객|성함|성명)\s*[:：]\s*([가-힣]{2,5})/;
  const nameRegex2 = /^([가-힣]{2,5})\s*[:：]/m;
  let nameMatch = text.match(nameRegex1);
  if (!nameMatch) {
    const m2 = text.match(nameRegex2);
    if (m2 && !NAME_LABEL_BLACKLIST.has(m2[1])) {
      nameMatch = m2;
    }
  }
  if (nameMatch) {
    result.customer = nameMatch[1];
    result.matched.push("이름");
  }

  // V14 Phase 2 — 원청 매핑 = form dropdown value (Korean / KA/KB suffix 박힘)
  // PRINCIPALS dropdown id 매칭 catch (form 자동 선택 박힘)
  // 사장님 spec [4]: "쿨가이" → "쿨가이 (KB)" 자동 선택
  const principalMap = {
    "올데이케어": "올데이케어",
    "올데이":     "올데이케어",
    "에어컨프로": "에어컨프로 (KA)",
    "에어컨 프로": "에어컨프로 (KA)",
    "KA":         "에어컨프로 (KA)",
    "쿨가이":     "쿨가이 (KB)",
    "KB":         "쿨가이 (KB)",
    "용인컴퍼니": "용인컴퍼니",
    "용인":       "용인컴퍼니",
    "유솔홈케어 H": "유솔홈케어 H",
    "유솔홈케어H":  "유솔홈케어 H",
    "유솔 H":     "유솔홈케어 H",
    "유솔홈케어 N": "유솔홈케어 N",
    "유솔홈케어N":  "유솔홈케어 N",
    "유솔 N":     "유솔홈케어 N",
    "유솔":       "유솔홈케어 H",
    "크리크린":   "크리크린",
  };
  const principalColonRegex = /원청\s*[:：\-]\s*([가-힣A-Za-z\s]+?)(?:\n|$|,|\/)/;
  const principalColonMatch = text.match(principalColonRegex);
  let principalDetected = null;
  if (principalColonMatch) {
    const raw = principalColonMatch[1].trim();
    for (const [keyword, id] of Object.entries(principalMap).sort((a, b) => b[0].length - a[0].length)) {
      if (raw.indexOf(keyword) !== -1) {
        principalDetected = id;
        break;
      }
    }
    if (principalDetected) {
      result.principal = principalDetected;
      result.matched.push("원청");
    }
  } else {
    for (const [keyword, id] of Object.entries(principalMap).sort((a, b) => b[0].length - a[0].length)) {
      if (text.indexOf(keyword) !== -1) {
        result.principal = id;
        result.matched.push("원청");
        break;
      }
    }
  }

  // 5. 기종 + 수량 (V14 헌법 7 기종 + 옛 호환)
  // V14 Phase 2.5 Step 2.1 — modelLabelRegex 블록 박지 X (non-greedy = '벽' 박힘 / 중복 catch)
  // → itemRegex 단독 = '기종: 벽걸이 ×2' 형식 처리 ✓
  const applianceItems = [];
  // V14 7 기종 + 옛 호환: '벽걸이 ×2' / '4way 1대' / '스탠드 3' / '기종: 벽걸이 ×2' 모두 catch
  const itemRegex = /(벽걸이|1way|스탠드|4way|원형|투인원|시스템멀티|시스템\s?멀티|시스템|천장형|이동식)\s*(?:[×x]\s*)?(\d+)?\s*대?/gi;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(text)) !== null) {
    const appliance = itemMatch[1].replace(/\s+/g, "");
    // 중복 추가 X (이미 modelLabel에서 처리한 것)
    if (!applianceItems.some(x => x.appliance === appliance)) {
      applianceItems.push({ appliance, qty: parseInt(itemMatch[2]) || 1 });
    }
  }
  if (applianceItems.length > 0) {
    result.applianceItems = applianceItems;
    result.matched.push(`기종 ${applianceItems.length}건`);
  }

  // 작업 종류 (키워드 매핑 — 복수 인식, 자동 추정 X)
  // Step 5-1c: 사장님 catch — 세척+가스 같이 있으면 둘 다 표시
  const workTypeMap = {
    "세척": "세척",
    "청소": "세척",
    "냉매": "냉매충전",
    "가스": "냉매충전",
    "충전": "냉매충전",
    "설치": "설치",
    "누설": "누설",
    "점검": "점검",
    "수리": "수리",
  };
  const detectedWorkTypes = [];
  const seenWT = new Set();
  for (const [keyword, workType] of Object.entries(workTypeMap)) {
    if (text.includes(keyword) && !seenWT.has(workType)) {
      detectedWorkTypes.push(workType);
      seenWT.add(workType);
    }
  }
  if (detectedWorkTypes.length > 0) {
    result.detectedWorkTypes = detectedWorkTypes;
    result.matched.push(`작업 종류 ${detectedWorkTypes.length}건`);
  }

  // Step 5-1e — workItems 매트릭스 (냉매충전은 기종 X로 별도 분기)
  result.workItems = [];
  const aps = applianceItems;
  // 냉매충전 / 나머지 작업 분리
  const hasRefrigerant = detectedWorkTypes.includes("냉매충전");
  const otherWTs = detectedWorkTypes.filter(w => w !== "냉매충전");

  // 1) 냉매충전 — V14 헌법: 기종 박힌 catch (옛 V13 = 기종 X)
  if (hasRefrigerant) {
    if (aps.length > 0) {
      // V14 — 기종이 있으면 각 기종별 workItem 생성
      for (const a of aps) {
        result.workItems.push({ workType: "냉매충전", appliance: a.appliance, qty: a.qty });
      }
    } else {
      // 기종 박지 X = 옛 흐름 (수량만 추출 / 사장님 검증 catch)
      const refrigerantQtyRegex = /(?:냉매(?:충전|가스)?|가스(?:충전)?|충전)\s*(\d+)\s*대?/;
      const qtyMatch = text.match(refrigerantQtyRegex);
      const refrigerantQty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
      result.workItems.push({ workType: "냉매충전", appliance: "", qty: refrigerantQty });
    }
  }

  // 2) 나머지 작업 종류 (세척 등) — 기종과 매칭
  if (otherWTs.length === 1 && aps.length > 0) {
    if (!hasRefrigerant) {
      for (const a of aps) result.workItems.push({ workType: otherWTs[0], appliance: a.appliance, qty: a.qty });
    } else {
      for (const a of aps) result.workItems.push({ workType: otherWTs[0], appliance: a.appliance, qty: a.qty });
    }
  } else if (otherWTs.length > 1 && aps.length === 1) {
    for (const wt of otherWTs) result.workItems.push({ workType: wt, appliance: aps[0].appliance, qty: aps[0].qty });
  } else if (otherWTs.length > 1 && aps.length > 1) {
    for (const a of aps) result.workItems.push({ workType: otherWTs[0], appliance: a.appliance, qty: a.qty });
    result.workItemsNeedReview = true;
  } else if (otherWTs.length > 0 && aps.length === 0) {
    result.matched.push(`${otherWTs.join(", ")} 인식 (기종 직접 선택)`);
  } else if (otherWTs.length === 0 && aps.length > 0 && !hasRefrigerant) {
    result.matched.push("기종 인식 (작업 직접 선택)");
  }

  // 6. 일정 (M월 D일 + H:MM / H시 MM분)
  const dateTimeRegex = /(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(?:[^\d]{0,8})?(\d{1,2})\s*[:시]\s*(\d{0,2})/;
  const dateRegex2 = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
  const timeRegex = /(\d{1,2})\s*시\s*(\d{0,2})\s*분?/;

  const dateTimeMatch = text.match(dateTimeRegex);
  const today = new Date();
  const yyyy = today.getFullYear();
  if (dateTimeMatch) {
    const mm = String(dateTimeMatch[1]).padStart(2, "0");
    const dd = String(dateTimeMatch[2]).padStart(2, "0");
    const h  = String(dateTimeMatch[3]).padStart(2, "0");
    const min = (dateTimeMatch[4] || "00").padStart(2, "0");
    result.requestDate = `${yyyy}-${mm}-${dd}`;
    result.requestTime = `${h}:${min}`;
    result.matched.push("일정");
  } else {
    const altDate = text.match(dateRegex2);
    if (altDate) {
      const mm = String(altDate[1]).padStart(2, "0");
      const dd = String(altDate[2]).padStart(2, "0");
      result.requestDate = `${yyyy}-${mm}-${dd}`;
      result.matched.push("일정 (날짜만)");
    }
    const timeMatch = text.match(timeRegex);
    if (timeMatch) {
      const h = String(timeMatch[1]).padStart(2, "0");
      const min = (timeMatch[2] || "00").padStart(2, "0");
      result.requestTime = `${h}:${min}`;
      if (!result.matched.includes("일정 (날짜만)")) result.matched.push("시간");
    }
  }

  return result;
}

// Step 5-3 fix — 직급 단순화: 신입 / 경력 / 전문가 (3단계)
// Step 5-3-4 — expert 핑크 톤다운 (#FF1B8D → #FF1B8D)
// 핑크 #FF1B8D는 진짜 액션 (저장/배정/카운트)에만 박기
const CAREER_LEVELS = {
  rookie: { id: "rookie", name: "신입",   color: "#888780" },  // 회색
  career: { id: "career", name: "경력",   color: "#00875A" },  // 청록
  expert: { id: "expert", name: "전문가", color: "#FF1B8D" },  // 옅은 핑크
};

// 메인 / 백업 (서브 → 백업 정정)
const LEVEL_LABELS = {
  main:   { name: "메인", isMain: true  },
  backup: { name: "백업", isMain: false },
  sub:    { name: "백업", isMain: false },  // legacy alias
};

// 기존 rank → careerLevel 자동 매핑 (legacy 데이터 호환)
function rankToLevel(rank) {
  switch (rank) {
    case "intern":   return "rookie";
    case "junior":   return "career";
    case "senior":   return "career";
    case "manager":  return "expert";
    case "director": return "expert";
    default:         return "career";
  }
}

// 기사 객체 → careerLevel 추출 (명시 careerLevel > level 기반 > rank fallback)
// 사장님 권장 단순화: 메인 = 전문가 / 백업 = 경력 / 신규/미정 = 신입
function getCareerLevel(eng) {
  if (!eng) return "career";
  if (eng.careerLevel) return eng.careerLevel;
  if (eng.level === "main")   return "expert";
  if (eng.level === "backup" || eng.level === "sub") return "career";
  return rankToLevel(eng.rank);
}

// 직급 색 (legacy — 호환용으로만 유지, 새 코드는 CareerLabel 사용)
const RANK_COLORS = {
  intern:   { id: "intern",   name: "수습", color: "#888780" },
  junior:   { id: "junior",   name: "주임", color: "#378ADD" },
  senior:   { id: "senior",   name: "대리", color: "#00875A" },
  manager:  { id: "manager",  name: "과장", color: "#E91860" },
  director: { id: "director", name: "부장", color: "#BA7517" },
};

// 긴급 알림 mock
const URGENT_TASK = {
  id: "A260427-007",
  customer: "이지은",
  workType: "설치",
  appliance: "벽걸이",
  qty: 2,
  region: "서초 반포",
  schedule: "오늘 18:00 이후",
  principal: "에어컨프로",
  reason: "당일 작업 요청",
};

// 새 접수 종류별 mock
// 작업 종류 → 아이콘 컴포넌트 매핑 (확장: 새 작업 추가 시 행 1줄)
const WORK_TYPE_ICONS = {
  세척:     Snowflake,     // ❄️ 차가움/에어컨
  냉매충전: Zap,            // ⚡ 가스/에너지
  설치:     Wrench,         // 🔧 공구
  누설:     AlertTriangle,  // ⚠️ 경고
  점검:     Search,          // 🔍 확인
  수리:     Settings,        // ⚙️ 손보기
};

// ─────────────────────────────────────────────
// Phase 2 — 실제 알림 시스템 (구현 예정)
// ─────────────────────────────────────────────
// 1. Web Push Notification (PWA 표준)
//    - Service Worker 등록 (sw.js)
//    - Push Subscription (사용자 권한)
//    - 앱 닫혀 있어도 OS 레벨 푸시
// 2. Supabase Realtime
//    - notifications 테이블 subscribe
//    - 새 row INSERT 시 자동 푸시 트리거
//    - 사용자별 권한 (운영자/기사/해피콜)
// 3. 외부 의존 0 (텔레그램 X — 사장님 운영 원칙)
// ─────────────────────────────────────────────
// Step 5-7-B — 알림 mock 0건 (운영 시작 = 깨끗한 상태)
// 시트 양방향 sync 또는 푸시 알림 박힐 때까지 빈 배열 / unreadCount=0 / Bell 배지 X
const NOTIFICATIONS_MOCK = [];

// 알림 타입 → 아이콘/색깔 매핑
// 2026-05-15 사장님 spec — 8개 시나리오 이모지 통일
const NOTI_TYPE_META = {
  new_reception:      { icon: "📥", colorKey: "accent"  },  // 1 새 접수
  assignment:         { icon: "🎯", colorKey: "purple"  },  // 2 배정 (수동)
  schedule_confirmed: { icon: "📅", colorKey: "warning" },  // 3 일정 확정
  started:            { icon: "▶️", colorKey: "warning" },  // 4 작업 시작 (NEW)
  completed:          { icon: "✅", colorKey: "success" },  // 5 작업 완료
  schedule_changed:   { icon: "🔄", colorKey: "warning" },  // 6 일정 변경 (NEW — 토스트 아이콘 박힘)
  cancelled:          { icon: "❌", colorKey: "danger"  },  // 7 작업 취소 (NEW)
  reassignment:       { icon: "🔄", colorKey: "purple"  },  // 8 재배정 (NEW)
  urgent:             { icon: "⚠️", colorKey: "danger"  },
};

// V14 Week 2 2A — NEW_RECEPTIONS 시뮬 폐기 / 진짜 시트 catch (apiTasks)
// 옛 호환을 위해 빈 배열로 박힘 — 데이터는 AdminApp의 apiTasks state에서 catch
const NEW_RECEPTIONS = {
  세척:    [],
  냉매충전: [],
};

// V14 — 주소 첫 단어 = 지역 (예: "강남구 도곡동 ..." → "강남구")
function _v14ExtractRegion(address) {
  if (!address) return "";
  const first = String(address).trim().split(/\s+/)[0];
  return first || "";
}

// V14 2A fix — summary 텍스트 → workItems 배열 파싱
// "세척 · 벽걸이 ×1"                              → 1건
// "세척 · 벽걸이 ×1 + 냉매충전 · 4way ×1"          → 2건 (multi-item)
// "냉매충전 · (공통) ×1"                          → 1건
function _v14ParseSummary(summary) {
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

// V14 2B-1 — 한국어 status → 영어 state 매핑 (AdminTaskDetailScreen STATE_MAP catch)
const _V14_STATUS_TO_STATE = {
  "미배정":   "waiting",
  "대기":     "waiting",
  "확정":     "scheduled",
  "배정":     "scheduled",
  "예정":     "scheduled",
  "이동중":   "moving",
  "진행중":   "active",
  "active":   "active",
  "완료":     "done",
  "done":     "done",
  "취소":     "canceled",
  "canceled": "canceled",
};

function _v14StatusToState(status) {
  if (!status) return "waiting";
  const s = String(status).trim();
  return _V14_STATUS_TO_STATE[s] || s; // 매칭 X면 그대로 박힘
}

// V14 — 시트 작업DB row → AdminApp 내부 task 객체로 정규화
// API가 어떤 키로 반환하든 (taskId / id, principal / client 등) 양쪽 catch
// V14 2A fix — workType/appliance/qty 컬럼 X / summary 텍스트만 있을 때 → 파싱 처리
// V14 2B-1 — state 필드 박힘 (한국어 status → 영어 state) + time 정확
function _v14NormalizeTask(t) {
  if (!t) return null;
  const id        = t.id || t.taskId || t.task_id || t.작업번호 || "";
  const customer  = t.customer || t.고객명 || "";
  const phone     = t.phone || t.연락처 || t.전화 || "";
  const address   = t.address || t.주소 || "";
  const region    = t.region || t.지역 || _v14ExtractRegion(address);
  const principal = t.principal || t.client || t.원청 || "";
  const channel   = t.channel || t.채널 || "";
  const summary   = t.summary || t.작업요약 || t.요약 || "";
  const status    = t.status || t.상태 || "";
  const reqDate   = t.requestedDate || t.scheduledDate || t.예약일 || "";
  const reqTime   = t.requestedTime || t.scheduledTime || t.예약시간 || "";
  const memo      = t.memo || t.note || t.비고 || "";
  // V14 Step 3.1 Fix A — estimate 키 광범위 catch (backend 박힌 키 정확 박지 X)
  // 옛 Step 3에서 박은 키 (productPrice/상품금액) catch X → 더 많은 키 박기 + console catch
  const estimate  = Number(
    t.estimateTotal || t.quote || t.totalAmount || t.견적금액 || t.견적합계 ||
    t.productPrice || t.상품금액 || t.estimateAmount || t.amount ||
    t.totalPrice || t.salePrice || t.판매가 || t.견적 ||
    t.AC || t['AC'] || t.ac || 0
  );
  const settlement = t.settlementStatus || t.정산상태 || "";
  const schedule  = t.schedule || [reqDate, reqTime].filter(Boolean).join(" ") || "협의";

  // V14 2A fix — summary 파싱 (작업DB에 workType/appliance 컬럼 X / 작업내역DB 별도)
  const summaryItems = _v14ParseSummary(summary);

  const workType  = t.workType  || t.work_type || t.작업유형 || (summaryItems[0]?.workType)  || "";
  const appliance = t.appliance || t.기종      || (summaryItems[0]?.appliance) || "";
  const qty       = Number(t.qty || t.totalQty || t.수량 || (summaryItems[0]?.qty) || 1);

  // V14 2B-3 — 배정 기사 매핑 (시트 Q 배정기사 컬럼)
  const assignedEngineerName = t.assignedEngineer || t.engineer || t.배정기사 || "";
  // V14 Step 3 Fix 1 — 배정 기사 연락처 (apiEngineers에서 lookup 박을 catch / normalize 박지 X / EngineerCard에서 박힘)
  const assignedEngineerPhone = t.engineerPhone || t.assignedEngineerPhone || "";

  // workItems 배열 — API 직접 들어있으면 OK / summary 파싱 / 단일 wrap 순으로 처리
  let workItems = Array.isArray(t.workItems) && t.workItems.length > 0 ? t.workItems : null;
  if (!workItems && summaryItems.length > 0) {
    workItems = summaryItems;
  } else if (!workItems && workType) {
    workItems = [{ workType, appliance, qty }];
  }

  // 2026-05-21 Phase 5 Step 0.G-5-A — serviceCode / orderType 보존 ("3곳 매핑 트랩")
  //   카운트 통일 spec — "유솔N 본작업 + 냉매" 판정 측 두 필드 필요
  //   공유 v14Task.js + tasksDb.rowToTask 측 동일 매핑 적용
  if (Array.isArray(workItems) && workItems.length > 0) {
    workItems = workItems.map(it => ({
      ...it,
      serviceCode: it.serviceCode || it.service_code || null,
      orderType:   it.orderType   || it.order_type   || null,
      // 2026-05-25 Round 1 마이그 070 — 부분취소 플래그 (3곳 매핑 트랩)
      isCanceled:     it.isCanceled     ?? !!it.is_canceled,
      canceledReason: it.canceledReason || it.canceled_reason || null,
      canceledAt:     it.canceledAt     || it.canceled_at     || null,
    }));
  }

  return {
    id,
    // Phase 4-2 fix — taskCode 측 작업번호 우선 (UUID는 fallback)
    taskCode: t.taskCode || t.taskNo || t.task_no || t.작업번호 || id,
    taskNo:   t.taskNo   || t.task_no || t.작업번호 || "",
    customer, phone, address, region,
    // 2026-05-21 Phase 5 Step 0.G-6-A — principalCode 매핑 복구 ("3곳 매핑 트랩")
    //   카운트 통일 spec — _isUsolNMainRefrigerant 측 t.principalCode 측 필요
    //   공유 v14Task.js + tasksDb.rowToTask 측 동일 매핑 적용
    principal, principalCode: t.principalCode || t.principal_code || "",
    // 2026-05-21 Phase 5 Step 0.G-6-C — task 레벨 boolean (유솔N 본작업 + 냉매)
    hasUsolNMainRefrigerant: !!t.hasUsolNMainRefrigerant,
    channel, workType, appliance, qty,
    summary, status,
    // 2026-05-21 Phase 5 Step 0.H-5 — effectiveStatus 기반 state (예정 시간 측 측 → 진행중 자동)
    state: _v14StatusToState(_getEffectiveStatus(t)),
    schedule, memo,
    // 2026-05-24 fix — work_memo 매핑 추가 (3곳 매핑 트랩 / v14Task.js·rowToTask·로컬본 통일)
    workMemo: t.workMemo ?? t.work_memo ?? "",
    estimateTotal: estimate,
    requestedDate: reqDate,
    requestedTime: reqTime,
    settlementStatus: settlement,
    workItems: workItems || [],
    // V14 2B-1 — time = 약속 시간 (옛 시뮬은 "방금"이었지만 실데이터는 실제 시간 사용)
    // 2026-05-17 Round 2 Fix #23 — scheduledAt (timestamptz)에서 시간 추출 추가.
    // 옛엔 requestedTime / requestedDate만 봐서 N열(scheduledAt)에만 시간 있는 작업이
    // "협의"로 떨어졌음. 공유 v14NormalizeTask(v14Task.js:160)는 이미 처리하지만
    // AdminApp 로컬 _v14NormalizeTask는 누락된 트랩 변형.
    time: reqTime || formatTimeOnly(t.scheduledAt || t.scheduled_at) || reqDate || "협의",
    type: "work",                 // V14 — AdminTaskDetailScreen이 type === 'external'일 때 분기
    // V14 2B-3 — 배정 기사 (시트 Q 컬럼) / engineer = 옛 컴포넌트 호환 (string 또는 object)
    assignedEngineer: assignedEngineerName,
    engineer:         assignedEngineerName || null,
    engineerPhone:    assignedEngineerPhone,  // V14 Step 3 Fix 1 — apiEngineers에서 박힘 (있으면)
    // Phase 4-2 fix — DB 전환 측 누락 필드 (dashboardStats 카운트 catch)
    createdAt:   t.createdAt   || t.created_at   || t.receivedAt || t.received_at || t.접수일시 || t.B || "",
    receivedAt:  t.receivedAt  || t.received_at  || "",
    scheduledAt: t.scheduledAt || t.scheduled_at || t.확정일시 || "",
    // 2026-05-15 — Migration 013 status 변경 시점 (이력 화면 TimestampHistory catch)
    assignedAt:            t.assignedAt           || t.assigned_at            || "",
    scheduledConfirmedAt:  t.scheduledConfirmedAt || t.scheduled_confirmed_at || "",
    completedAt: t.completedAt || t.completed_at || t.완료시간 || "",
    startedAt:   t.startedAt   || t.started_at   || t.시작시간 || "",
    // 2026-05-25 — 부분완료 (Migration 068)
    partialReason: t.partialReason ?? t.partial_reason ?? null,
    partialMemo:   t.partialMemo   ?? t.partial_memo   ?? null,
    // 2026-05-25 Round 2 — 취소 건 기사 수고비 (Migration 073) — 3곳 매핑 트랩
    cancelEngineerCompKind:   t.cancelEngineerCompKind   ?? t.cancel_engineer_comp_kind   ?? null,
    cancelEngineerCompAmount: t.cancelEngineerCompAmount ?? t.cancel_engineer_comp_amount ?? null,
    pushCandidates: Array.isArray(t.pushCandidates) ? t.pushCandidates : Array.isArray(t.push_candidates) ? t.push_candidates : [],
    // 2026-05-17 Round 1 Fix #1 — payments JOIN 패스스루 (dashboardStats 매출 카드용).
    // 공유 v14NormalizeTask(src/utils/v14Task.js)에는 이미 매핑돼 있으나
    // AdminApp은 별개 로컬 _v14NormalizeTask를 사용 → 여기서도 동일 6필드 매핑 필요 ("두 곳 모두 매핑" 트랩).
    payment:          t.payment || null,
    engineer_amount:  t.engineer_amount  ?? 0,
    principal_amount: t.principal_amount ?? 0,
    owner_amount:     t.owner_amount     ?? 0,
    payment_status:   t.payment_status   ?? null,
    is_balanced:      t.is_balanced      ?? null,
    // 2026-05-17 Round 1 Fix #5 — total_amount 패스스루 (오늘 매출 카드에 extra_fee 포함되도록).
    // tasksDb.rowToTask는 row.total_amount(GENERATED, product+extra+travel)를 totalAmount로 박는데
    // 로컬 _v14NormalizeTask가 이 필드를 떨어뜨려 dashboardStats가 estimateTotal(productPrice)로 fallback.
    totalAmount: Number(t.totalAmount || t.total_amount || 0) || estimate,
    // 2026-05-19 Phase 5 Step 0.C-3-a — extraFee / extraReason 매핑 ("두 곳 모두 매핑" 트랩)
    // 공유 v14Task.js 측 매핑 있음 / 로컬 _v14NormalizeTask 측 누락 — AdminTaskDetailScreen 측 현장 추가금 표시용
    extraFee:    Number(t.extraFee    || t.extra_fee    || t.추가금 || t.addAmount || 0),
    extraReason: t.extraReason  || t.extra_reason  || "",
    extraFeeAt:  t.extraFeeAt   || t.extra_fee_at   || null,
    // 2026-05-19 Phase 5 Step 0.C-13 — is_legacy (Migration 042) 매핑 ("두 곳 모두 매핑" 트랩)
    isLegacy:    !!(t.isLegacy ?? t.is_legacy),
    // 2026-05-17 Round 1 Fix #7 — calc_method 패스스루 (정산 정책 표시용).
    // 2026-05-18 Fix #29 — 트랙 판별은 payments.track으로 일원화. calc_method는 트랙 판별과 무관.
    calc_method: t.calc_method ?? null,
    // 2026-05-18 Fix #29 — 자금 흐름 트랙 (Migration 031/032, compute_payment v10 자동 결정).
    // 'A'=일일정산(기사→회사), 'B'=월정산(회사→기사). 공유 v14Task.js와 동일 매핑 ("두 곳 모두 매핑" 트랩).
    track: t.track || t.payment_track || t.paymentTrack || t.payment?.track || 'A',
    engineerRemittedAt:       t.engineerRemittedAt       || t.engineer_remitted_at        || null,
    engineerRemitConfirmedAt: t.engineerRemitConfirmedAt || t.engineer_remit_confirmed_at || null,
    // 2026-05-25 Migration 077 — 유솔 입금 흐름 (3곳 매핑 트랩)
    usolRemittedAt:           t.usolRemittedAt           ?? t.usol_remitted_at            ?? null,
    // 2026-05-22 — 냉매 동의서 (3곳 매핑 트랩)
    consent: t.consent || t.categoryData?.consent || null,
    // 2026-05-22 — 재배정 요청 (3곳 매핑 트랩)
    reassignRequest: t.reassignRequest || t.categoryData?.reassignRequest || null,
    _api: true,                   // 진짜 API 출처 마킹
  };
}

// LIVE_TASKS 는 Step 3-4 에서 제거됨 — TASKS_TODAY (ENGINEERS_DATA 평탄화) 가 단일 진실 소스
// (정의는 ENGINEERS_DATA 아래)

// 추천 기사 mock (시안 5-V3) — Step 5-3 정정: ENGINEERS_MASTER + ZONE_MAPPINGS 사용 (RECOMMENDED_ENGINEERS 더 이상 사용 X)
const RECOMMENDED_ENGINEERS = [
  { id: "E001", name: "김동효", level: "main", nightOk: true,  region: "강남, 서초", todayCount: 3, newCount: 1, rank: "manager" },
  { id: "E005", name: "정훈",   level: "main", nightOk: false, region: "서초, 강남", todayCount: 2, newCount: 0, rank: "senior" },
  { id: "E008", name: "김윤섭", level: "sub",  nightOk: true,  region: "용산, 중구", todayCount: 1, newCount: 1, rank: "junior" },
];

// ============================================
// Step 5-3 — 기사 마스터 데이터 (사장님 박힌 진짜 운영 데이터)
// 사장님이 한 곳에서 직접 수정/추가 가능 (편집 친화 구조)
// ============================================
const ENGINEERS_MASTER = [
  { id: "M01", name: "김태승", careerLevel: "expert", level: "main",   phone: "010-8185-9700", regionLabel: "서대문" },
  { id: "M02", name: "양승문", careerLevel: "expert", level: "main",   phone: "010-3749-0294", regionLabel: "은평" },
  { id: "M03", name: "김윤섭", careerLevel: "expert", level: "main",   phone: "010-2063-4980", regionLabel: "용산" },
  { id: "M04", name: "이상준", careerLevel: "expert", level: "main",   phone: "010-4729-8079", regionLabel: "전문 프로" },
  { id: "M05", name: "정상현", careerLevel: "expert", level: "main",   phone: "010-2273-0976", regionLabel: "강북" },
  { id: "M06", name: "김영수", careerLevel: "expert", level: "main",   phone: "010-2635-5772", regionLabel: "동대문" },
  { id: "M07", name: "안승웅", careerLevel: "expert", level: "main",   phone: "010-5399-3651", regionLabel: "성동" },
  { id: "M08", name: "변기현", careerLevel: "expert", level: "main",   phone: "010-6351-8818", regionLabel: "금천" },
  { id: "M09", name: "정훈",   careerLevel: "expert", level: "main",   phone: "010-2143-9620", regionLabel: "서초" },
  { id: "M10", name: "강병익", careerLevel: "expert", level: "main",   phone: "010-9089-1726", regionLabel: "동작" },
  { id: "M11", name: "김동효", careerLevel: "expert", level: "main",   phone: "010-9238-0412", regionLabel: "송파" },
  { id: "M12", name: "전현진", careerLevel: "expert", level: "main",   phone: "010-7764-4402", regionLabel: "강서" },
  { id: "M13", name: "김현동", careerLevel: "expert", level: "main",   phone: "010-9999-0001", regionLabel: "강북" },
  { id: "M14", name: "임종일", careerLevel: "expert", level: "main",   phone: "010-9999-0002", regionLabel: "관악" },
  { id: "M15", name: "류근학", careerLevel: "expert", level: "main",   phone: "010-9999-0003", regionLabel: "강남" },
  { id: "M16", name: "권창용", careerLevel: "expert", level: "main",   phone: "010-9999-0004", regionLabel: "전문 프로" },
  { id: "M17", name: "김재현", careerLevel: "career", level: "backup", phone: "010-9999-0005", regionLabel: "전문 프로" },
  { id: "M18", name: "문성목", careerLevel: "career", level: "backup", phone: "010-9999-0006", regionLabel: "성동" },
  { id: "M19", name: "손동식", careerLevel: "career", level: "backup", phone: "010-9999-0007", regionLabel: "은평" },
  { id: "M20", name: "김병철", careerLevel: "career", level: "backup", phone: "010-9999-0008", regionLabel: "남양주" },
];

// ============================================
// Step 5-3 — 지역 매핑 (사장님이 한 곳에서 관리)
// 작업 종류별 zones / applianceCapable / sub
// Phase 2: 설정 화면에서 직접 편집 가능
// Step 5-3-3 — applianceSpecialist → applianceCapable (전문 X / 가능 O — 신입도 포함)
// ============================================
const ZONE_MAPPINGS = {
  "세척": {
    main: [
      { engineer: "양승문", zones: ["고양시", "은평구", "서대문구"] },
      { engineer: "김윤섭", zones: ["마포구", "용산구", "중구"] },
      { engineer: "정상현", zones: ["종로구", "성북구", "동대문구"] },
      { engineer: "안승웅", zones: ["성동구", "광진구", "중랑구"] },
      { engineer: "김영수", zones: ["의정부", "구리", "남양주", "양주"] },
      { engineer: "김현동", zones: ["강북구", "도봉구", "노원구"] },
      { engineer: "임종일", zones: ["동작구", "관악구", "시흥시"] },
      { engineer: "류근학", zones: ["서초구", "강남구", "용인", "하남"] },
      { engineer: "정훈",   zones: ["송파구", "강동구", "용인", "하남"] },
      { engineer: "전현진", zones: ["양천구", "구로구", "금천구", "강서구"] },
    ],
    applianceCapable: [
      { engineer: "권창용", appliances: ["벽걸이"] },
      { engineer: "이상준", appliances: ["벽걸이"] },
      { engineer: "김재현", appliances: ["벽걸이"] },  // sub에서 이동 / 원웨이 제거
    ],
    sub: [
      // 김재현 제거 → applianceCapable로 이동
      { engineer: "김태승", zones: ["서대문구", "중구"] },
      { engineer: "문성목", zones: ["성동구", "광진구", "중랑구"] },
      { engineer: "손동식", zones: ["고양시", "은평구"] },
      { engineer: "김병철", zones: ["남양주", "구리", "의정부"] },
      { engineer: "김동효", zones: ["관악구", "동작구", "시흥시", "금천구", "강서구"] },
    ],
  },
  "냉매충전": {
    main: [
      { engineer: "김태승", zones: ["마포구", "서대문구"] },
      { engineer: "양승문", zones: ["은평구"] },
      { engineer: "김윤섭", zones: ["용산구", "중구"] },
      { engineer: "이상준", zones: ["종로구", "성북구"] },
      { engineer: "정상현", zones: ["강북구", "도봉구", "노원구"] },
      { engineer: "김영수", zones: ["동대문구", "중랑구"] },
      { engineer: "안승웅", zones: ["성동구", "광진구"] },
      { engineer: "변기현", zones: ["금천구", "관악구"] },
      { engineer: "정훈",   zones: ["서초구", "강남구"] },
      { engineer: "강병익", zones: ["동작구", "영등포구"] },
      { engineer: "김동효", zones: ["송파구", "강동구"] },
      { engineer: "전현진", zones: ["강서구", "양천구", "구로구"] },
    ],
    applianceCapable: [],
    sub: [],
  },
};

// 주소/지역 텍스트에서 행정구역 키워드 추출
// "강남 도곡" → "강남구" / "서초 잠원" → "서초구" / "송파 잠실" → "송파구" 자동 매핑
const SEOUL_GU_NAMES = [
  "강남", "강동", "강북", "강서", "관악", "광진", "구로", "금천", "노원",
  "도봉", "동대문", "동작", "마포", "서대문", "서초", "성동", "성북",
  "송파", "양천", "영등포", "용산", "은평", "종로", "중랑",
];
function extractZone(address) {
  if (!address) return null;
  const text = String(address).trim();
  // 1. "OO구" 명시
  const guMatch = text.match(/([가-힣]+구)/);
  if (guMatch) return guMatch[1];
  // 2. "OO시" 명시
  const siMatch = text.match(/([가-힣]+시)/);
  if (siMatch) return siMatch[1];
  // 3. 서울 외 시/지역 키워드
  const keywords = ["의정부", "구리", "남양주", "양주", "용인", "하남", "성남", "수원", "광명", "안양", "시흥"];
  for (const kw of keywords) {
    if (text.includes(kw)) return kw;
  }
  // 4. 서울 25개 구 이름 (bare → 구 suffix 자동 추가)
  for (const gu of SEOUL_GU_NAMES) {
    if (text.includes(gu)) return gu + "구";
  }
  // 5. 중구 (특수 — 단어 길이 1자라 마지막에)
  if (text.includes("중구") || /\s중\s/.test(" " + text + " ")) return "중구";
  // 6. fallback
  return text.split(/\s+/)[0] || null;
}

// 기사 이름 → ZONE_MAPPINGS에서 해당 작업 타입의 zones 추출 (UI 표시용)
function getEngineerZoneList(name, workType) {
  const config = ZONE_MAPPINGS[workType];
  if (!config) return [];
  const inMain = config.main?.find(m => m.engineer === name);
  if (inMain && inMain.zones?.length > 0) return inMain.zones;
  const inSub = config.sub?.find(s => s.engineer === name);
  if (inSub && inSub.zones?.length > 0) return inSub.zones;
  // applianceCapable 기사는 지역 무관
  return [];
}

// Step 5-3-4 — 작업 지역 매칭 1개만 추출 (추천기사 카드용)
// 매칭 없으면 zones[0] fallback
function getMatchedZone(name, workType, taskZone) {
  const zones = getEngineerZoneList(name, workType);
  if (zones.length === 0) return null;
  if (!taskZone) return zones[0];
  const matched = zones.find(z => z === taskZone || z.includes(taskZone) || taskZone.includes(z));
  return matched || zones[0];
}

// Step 5-3-3 — 기사 이름 → 가능 기종 리스트 (capable 그룹 카드 표시용)
function getEngineerApplianceList(name, workType) {
  const config = ZONE_MAPPINGS[workType];
  if (!config) return [];
  const inCap = config.applianceCapable?.find(s => s.engineer === name);
  if (inCap && inCap.appliances?.length > 0) return inCap.appliances;
  // 만약 sub에 appliances가 있으면 그것도 fallback
  const inSub = config.sub?.find(s => s.engineer === name);
  if (inSub && inSub.appliances?.length > 0) return inSub.appliances;
  return [];
}

// 추천 후보 기사 추출 — main / sub / capable 그룹화
function getCandidateEngineers(workType, region, appliance) {
  const config = ZONE_MAPPINGS[workType];
  if (!config) return { main: [], sub: [], capable: [] };

  const targetZone = extractZone(region);
  const findEng = (name) => ENGINEERS_MASTER.find((e) => e.name === name);

  const main = (config.main || [])
    .filter((m) => targetZone && m.zones.includes(targetZone))
    .map((m) => findEng(m.engineer))
    .filter(Boolean);

  const sub = (config.sub || [])
    .filter((s) => Array.isArray(s.zones) && s.zones.length > 0 && targetZone && s.zones.includes(targetZone))
    .map((s) => findEng(s.engineer))
    .filter(Boolean);

  // 기종 가능 기사 (지역 무관 / appliance 매칭 시)
  const capable = (config.applianceCapable || [])
    .filter((s) => !appliance || (s.appliances && s.appliances.includes(appliance)))
    .map((s) => findEng(s.engineer))
    .filter(Boolean);

  return {
    main,
    sub,
    capable,
  };
}

// Step 5-3 v3 — 자동 배정 broadcast 후보 (zone 매칭 우선 + 모자라면 다른 main으로 확장)
// Phase 1 mock: 첫 응답자 = candidates[0] (zone 매칭 기사가 우선 선택됨)
function getAutoBroadcastCandidates(workType, region, appliance, maxCount = 4) {
  const config = ZONE_MAPPINGS[workType];
  if (!config) return [];
  const findEng = (name) => ENGINEERS_MASTER.find((e) => e.name === name);
  const matched = new Set();
  const result = [];

  // 1. Zone 매칭 (메인 + 서브 + 가능)
  const zoneMatched = getCandidateEngineers(workType, region, appliance);
  for (const eng of zoneMatched.main) {
    if (!matched.has(eng.name)) { matched.add(eng.name); result.push(eng); }
    if (result.length >= maxCount) return result;
  }
  for (const eng of zoneMatched.sub) {
    if (!matched.has(eng.name)) { matched.add(eng.name); result.push(eng); }
    if (result.length >= maxCount) return result;
  }
  for (const eng of zoneMatched.capable) {
    if (!matched.has(eng.name)) { matched.add(eng.name); result.push(eng); }
    if (result.length >= maxCount) return result;
  }
  // 2. 추가 broadcast — 같은 workType 다른 메인 기사
  for (const m of config.main || []) {
    if (matched.has(m.engineer)) continue;
    const eng = findEng(m.engineer);
    if (eng) {
      matched.add(eng.name);
      result.push(eng);
      if (result.length >= maxCount) return result;
    }
  }
  return result;
}

// 기사 탭 — Step 3-2: 시스템 디자이너 시각, 스케쥴이 답
// type:  "work" | "off_full" | "off_partial" | "external"
// state (work/external만): "done" | "active" | "moving" | "waiting" | "scheduled"
// Step 4: work 항목에 상세 필드 추가 (taskCode/phone/address/qty/estimateTotal/addonFee/principal/memo/startedAt/completedAt)
// Step 5-7-C — ENGINEERS_DATA 운영/시뮬 분기 (raw seed → ENABLE_MOCK 토글)
const _ENGINEERS_DATA_MOCK = [
  // 활동중 (5명)
  { id: "E001", name: "김동효", rank: "manager", level: "main", region: "강남", phone: "010-9999-0001",
    todaySchedule: [
      { type: "work", time: "09:00", taskCode: "A260427-001",
        customer: "정수아", phone: "010-2345-6789",
        address: "송파 잠실 한솔아파트 501동 802호",
        workType: "세척", appliance: "벽걸이", qty: 2,
        region: "송파 잠실",
        estimateTotal: 320000, addonFee: 0, principal: "올데이케어",
        memo: "벽걸이 2대 청소 요청",
        startedAt: "09:05", completedAt: "10:45",
        photos: { before: 3, after: 4, driveUrl: "https://drive.google.com/drive/folders/abc123" },
        state: "done" },
      { type: "work", time: "11:30", taskCode: "A260427-002",
        customer: "이상훈", phone: "010-3456-7890",
        address: "서초 반포 래미안퍼스티지 102동 1203호",
        workType: "세척", appliance: "스탠드", qty: 2,
        region: "서초 반포",
        estimateTotal: 280000, addonFee: 50000, principal: "에어컨프로",
        memo: "스탠드 2대, 곰팡이 심함",
        startedAt: "11:35", completedAt: null,
        state: "active" },
      { type: "work", time: "14:00", taskCode: "A260427-005",
        customer: "박은서", phone: "010-1234-5678",
        address: "강남 도곡 도곡렉슬 101동 1505호",
        workType: "세척", appliance: "벽걸이", qty: 1,
        region: "강남 도곡",
        estimateTotal: 170000, addonFee: 0, principal: "올데이케어",
        memo: "에어컨 뒤편 청소 부탁드려요",
        startedAt: null, completedAt: null,
        state: "waiting" },
    ] },
  { id: "E021", name: "정훈", rank: "senior", level: "main", region: "서초", phone: "010-9999-0002",
    todaySchedule: [
      { type: "work", time: "10:00", taskCode: "YS-260427-021",
        customer: "박서연", phone: "010-7891-2345",
        address: "강남 청담 청담아이파크 103동 805호",
        workType: "세척", appliance: "스탠드", qty: 1,
        region: "강남 청담",
        estimateTotal: 200000, addonFee: 0, principal: "유솔홈케어 H",
        memo: "네이버 결제 완료",
        startedAt: "10:10", completedAt: "11:50",
        photos: { before: 0, after: 0, driveUrl: "" },
        state: "done" },
      { type: "work", time: "13:00", taskCode: "MG-260427-008",
        customer: "이재훈", phone: "010-4567-8901",
        address: "서초 반포 반포자이 305동 1404호",
        workType: "냉매충전", appliance: "벽걸이", qty: 2,
        region: "서초 반포",
        estimateTotal: 240000, addonFee: 0, principal: "에어컨프로",
        memo: "가스 부족 — 누설 점검 같이 요청",
        startedAt: null, completedAt: null,
        state: "moving" },
    ] },
  { id: "E007", name: "김도현", rank: "junior", level: "main", region: "송파", phone: "010-9999-0003",
    todaySchedule: [
      { type: "work", time: "10:00", taskCode: "A260427-011",
        customer: "최서연", phone: "010-5678-9012",
        address: "송파 가락 헬리오시티 405동 1502호",
        workType: "세척", appliance: "스탠드", qty: 1,
        region: "송파 가락",
        estimateTotal: 180000, addonFee: 0, principal: "올데이케어",
        memo: "거실 스탠드 1대",
        startedAt: "10:08", completedAt: null,
        state: "active" },
      { type: "work", time: "14:30", taskCode: "A260427-012",
        customer: "한지수", phone: "010-6789-0123",
        address: "송파 잠실 잠실엘스 207동 803호",
        workType: "점검", appliance: "벽걸이", qty: 2,
        region: "송파 잠실",
        estimateTotal: 80000, addonFee: 0, principal: "올데이케어",
        memo: "냉방 약함 호소 — 진단 우선",
        startedAt: null, completedAt: null,
        state: "waiting" },
    ] },
  { id: "E004", name: "최민수", rank: "junior", level: "main", region: "강남", phone: "010-9999-0004",
    todaySchedule: [
      { type: "work", time: "09:30", taskCode: "MG-260427-014",
        customer: "이지수", phone: "010-7890-1234",
        address: "강남 청담 청담린든그로브 102동 901호",
        workType: "냉매충전", appliance: "벽걸이", qty: 1,
        region: "강남 청담",
        estimateTotal: 130000, addonFee: 30000, principal: "에어컨프로",
        memo: "현장 추가 — 누설 부위 보수",
        startedAt: "09:35", completedAt: null,
        state: "active" },
      { type: "work", time: "13:00", taskCode: "A260427-015",
        customer: "박민호", phone: "010-8901-2345",
        address: "강남 역삼 강남파이낸스센터 오피스 28층",
        workType: "수리", appliance: "벽걸이", qty: 1,
        region: "강남 역삼",
        estimateTotal: 110000, addonFee: 0, principal: "에어컨프로",
        memo: "리모컨 인식 안됨",
        startedAt: null, completedAt: null,
        state: "waiting" },
    ] },
  { id: "E010G", name: "김태승", rank: "senior", level: "main", region: "마포", phone: "010-9999-0005",
    todaySchedule: [
      { type: "work", time: "11:15", taskCode: "MG-260427-018",
        customer: "정수민", phone: "010-9012-3456",
        address: "마포 공덕 공덕래미안5차 502동 1105호",
        workType: "냉매충전", appliance: "벽걸이", qty: 2,
        region: "마포 → 서대문",
        estimateTotal: 240000, addonFee: 0, principal: "에어컨프로",
        memo: "이동 (마포 → 서대문)",
        startedAt: null, completedAt: null,
        state: "moving" },
      { type: "work", time: "15:00", taskCode: "A260427-019",
        customer: "김민호", phone: "010-2345-6789",
        address: "송파 잠실 잠실리센츠 206동 1804호",
        workType: "스탠드 세척", appliance: "스탠드", qty: 1,
        region: "송파 잠실",
        estimateTotal: 130000, addonFee: 0, principal: "에어컨프로",
        memo: "",
        startedAt: null, completedAt: null,
        state: "waiting" },
    ] },
  // 시간 휴무 — 1명
  { id: "E024", name: "박재현", rank: "junior", level: "backup", region: "강북", phone: "010-9999-0006",
    todaySchedule: [
      { type: "off_partial", time: "~14:00", note: "오전 휴무" },
      { type: "work", time: "14:30", taskCode: "MG-260427-024",
        customer: "김지혜", phone: "010-3456-7890",
        address: "마포 합정 합정메세나폴리스 1905호",
        workType: "냉매충전", appliance: "벽걸이", qty: 1,
        region: "마포",
        estimateTotal: 130000, addonFee: 0, principal: "에어컨프로",
        memo: "오후 일정 — 14:30 도착 예정",
        startedAt: null, completedAt: null,
        state: "scheduled" },
      { type: "work", time: "16:00", taskCode: "A260427-025",
        customer: "이서연", phone: "010-4567-8901",
        address: "마포 망원 망원한강해모로 802호",
        workType: "점검", appliance: "벽걸이", qty: 1,
        region: "마포",
        estimateTotal: 60000, addonFee: 0, principal: "올데이케어",
        memo: "에어컨 소음 점검",
        startedAt: null, completedAt: null,
        state: "scheduled" },
    ] },
  // 외근 — 1명
  { id: "E002", name: "이재현", rank: "manager", level: "main", region: "관악", phone: "010-9999-0007",
    todaySchedule: [
      { type: "external", time: "09:00~16:00", note: "서울대병원 정기 점검 (외근)", state: "active" },
      { type: "work", time: "17:00", taskCode: "A260427-027",
        customer: "최영수", phone: "010-5678-9012",
        address: "동작 사당 사당롯데캐슬 105동 503호",
        workType: "수리", appliance: "스탠드", qty: 1,
        region: "동작",
        estimateTotal: 150000, addonFee: 0, principal: "에어컨프로",
        memo: "외근 후 마지막 일정",
        startedAt: null, completedAt: null,
        state: "waiting" },
    ] },
  // 종일 휴무 — 1명
  { id: "E003", name: "박상민", rank: "senior", level: "main", region: "강서", phone: "010-9999-0008",
    todaySchedule: [
      { type: "off_full", note: "종일 휴무" },
    ] },
  // ─────────────────────────────────────────────
  // Step 5-3 — ENGINEERS_MASTER 신규 17명 (overlap 3명 제외)
  // ─────────────────────────────────────────────
  // 활동 추가 — 진행중 1명 (M15 류근학 / M03 김윤섭)
  { id: "M15", name: "류근학", rank: "manager", level: "main", region: "강남", phone: "010-9999-0003",
    todaySchedule: [
      { type: "work", time: "10:00", taskCode: "A260427-031",
        customer: "이혜진", phone: "010-1212-3434",
        address: "강남 역삼 강남센트럴아이파크 102동 1801호",
        workType: "세척", appliance: "벽걸이", qty: 2,
        region: "강남구",
        estimateTotal: 320000, addonFee: 0, principal: "올데이케어",
        memo: "벽걸이 2대 청소",
        startedAt: "10:05", completedAt: null,
        state: "active" },
    ] },
  { id: "M03", name: "김윤섭", rank: "manager", level: "main", region: "용산", phone: "010-2063-4980",
    todaySchedule: [
      { type: "work", time: "11:00", taskCode: "A260427-032",
        customer: "박지은", phone: "010-2323-4545",
        address: "용산구 한강로 래미안용산 305동 1502호",
        workType: "세척", appliance: "벽걸이", qty: 1,
        region: "용산구",
        estimateTotal: 170000, addonFee: 0, principal: "올데이케어",
        memo: "",
        startedAt: "11:08", completedAt: null,
        state: "active" },
    ] },
  // 대기 — 2명 (M16 권창용 / M06 김영수)
  { id: "M16", name: "권창용", rank: "senior", level: "main", careerLevel: "expert", region: "전문 프로", phone: "010-9999-0004",
    todaySchedule: [
      { type: "work", time: "13:00", taskCode: "A260427-033",
        customer: "최세영", phone: "010-3434-5656",
        address: "강남 도곡 도곡렉슬 105동 802호",
        workType: "세척", appliance: "벽걸이", qty: 3,
        region: "강남구",
        estimateTotal: 480000, addonFee: 0, principal: "올데이케어",
        memo: "벽걸이 3대",
        startedAt: null, completedAt: null,
        state: "waiting" },
    ] },
  { id: "M06", name: "김영수", rank: "manager", level: "main", region: "동대문", phone: "010-2635-5772",
    todaySchedule: [
      { type: "work", time: "14:00", taskCode: "A260427-034",
        customer: "송민지", phone: "010-4545-6767",
        address: "의정부 신곡동 의정부롯데캐슬 902동 1503호",
        workType: "세척", appliance: "스탠드", qty: 1,
        region: "의정부",
        estimateTotal: 200000, addonFee: 0, principal: "유솔홈케어 H",
        memo: "",
        startedAt: null, completedAt: null,
        state: "waiting" },
    ] },
  // 종일 휴무 추가 — 1명 (M20 김병철)
  { id: "M20", name: "김병철", rank: "junior", level: "backup", careerLevel: "career", region: "남양주", phone: "010-9999-0008",
    todaySchedule: [
      { type: "off_full", note: "종일 휴무" },
    ] },
  // 0건 / 미정 — 12명
  { id: "M02", name: "양승문", rank: "junior",  level: "main",   careerLevel: "expert", region: "은평",       phone: "010-3749-0294", todaySchedule: [] },
  { id: "M04", name: "이상준", rank: "senior",  level: "main",   careerLevel: "expert", region: "전문 프로",  phone: "010-4729-8079", todaySchedule: [] },
  { id: "M05", name: "정상현", rank: "junior",  level: "main",   careerLevel: "expert", region: "강북",       phone: "010-2273-0976", todaySchedule: [] },
  { id: "M07", name: "안승웅", rank: "senior",  level: "main",   careerLevel: "expert", region: "성동",       phone: "010-5399-3651", todaySchedule: [] },
  { id: "M08", name: "변기현", rank: "junior",  level: "main",   careerLevel: "expert", region: "금천",       phone: "010-6351-8818", todaySchedule: [] },
  { id: "M10", name: "강병익", rank: "junior",  level: "main",   careerLevel: "expert", region: "동작",       phone: "010-9089-1726", todaySchedule: [] },
  { id: "M12", name: "전현진", rank: "junior",  level: "main",   careerLevel: "expert", region: "강서",       phone: "010-7764-4402", todaySchedule: [] },
  { id: "M13", name: "김현동", rank: "junior",  level: "main",   careerLevel: "expert", region: "강북",       phone: "010-9999-0001", todaySchedule: [] },
  { id: "M14", name: "임종일", rank: "junior",  level: "main",   careerLevel: "expert", region: "관악",       phone: "010-9999-0002", todaySchedule: [] },
  { id: "M17", name: "김재현", rank: "junior",  level: "backup", careerLevel: "career", region: "전문 프로",  phone: "010-9999-0005", todaySchedule: [] },
  { id: "M18", name: "문성목", rank: "junior",  level: "backup", careerLevel: "career", region: "성동",       phone: "010-9999-0006", todaySchedule: [] },
  { id: "M19", name: "손동식", rank: "junior",  level: "backup", careerLevel: "career", region: "은평",       phone: "010-9999-0007", todaySchedule: [] },
];
const ENGINEERS_DATA = ENABLE_MOCK ? _ENGINEERS_DATA_MOCK : [];

// 작업 탭 — 단일 진실 소스 평탄화 ("두 번 일 안 하기")
// 사장님 시각: 기사 탭 = Who / 작업 탭 = What
// state: "active"(진행중) | "moving"(이동중) | "waiting"(대기) | "scheduled"(예정) | "done"(완료)
// type === "external" 은 외근중 그룹으로 분리
const TASKS_TODAY = ENGINEERS_DATA.flatMap((eng) =>
  eng.todaySchedule
    .filter((s) => s.type === "work" || s.type === "external")
    .map((s, idx) => ({
      ...s,
      taskId: `${eng.id}-${idx}`,
      engineerId: eng.id,
      engineer: eng.name,
      engineerRank: eng.rank,
      engineerLevel: eng.level,
      engineerRegion: eng.region,
    }))
);

// 기사별 배정 전체 (오늘/내일/다음주 다 — 사장님 시각: 활동 시각 / 공평성 지표용)
// state: waiting(신규배정) | scheduled/moving/active(일정확정) | done(완료)
// 날짜 필드: workDate / assignedDate / completedDate (TODAY_DATE = "2026-04-27")
const ENGINEER_ASSIGNMENTS = {
  // 김동효 — newAssigned 2 / confirmed 5 / todayDone 1 / todayAssigned 3
  "E001": [
    { taskCode: "A260427-001", customer: "정수아", phone: "010-2345-6789", address: "송파 잠실 한솔아파트 501동 802호", workType: "세척", appliance: "벽걸이", qty: 2, region: "송파 잠실", time: "09:00", estimateTotal: 320000, addonFee: 0, principal: "올데이케어", memo: "벽걸이 2대", workDate: "2026-04-27", assignedDate: "2026-04-26", state: "done", startedAt: "09:05", completedAt: "10:45", completedDate: "2026-04-27", photos: { before: 3, after: 4, driveUrl: "https://drive.google.com/drive/folders/abc123" } },
    { taskCode: "A260427-002", customer: "이상훈", phone: "010-3456-7890", address: "서초 반포 래미안퍼스티지 102동 1203호", workType: "세척", appliance: "스탠드", qty: 2, region: "서초 반포", time: "11:30", estimateTotal: 280000, addonFee: 50000, principal: "에어컨프로", memo: "스탠드 2대, 곰팡이 심함", workDate: "2026-04-27", assignedDate: "2026-04-27", state: "active", startedAt: "11:35" },
    { taskCode: "A260427-005", customer: "박은서", phone: "010-1234-5678", address: "강남 도곡 도곡렉슬 101동 1505호", workType: "세척", appliance: "벽걸이", qty: 1, region: "강남 도곡", time: "14:00", estimateTotal: 170000, addonFee: 0, principal: "올데이케어", memo: "에어컨 뒤편 청소 부탁드려요", workDate: "2026-04-27", assignedDate: "2026-04-27", state: "waiting" },
    { taskCode: "A260428-001", customer: "김민수", phone: "010-3322-1100", address: "강남 청담 청담아이파크 501동 902호", workType: "세척", appliance: "벽걸이", qty: 1, region: "강남 청담", time: "10:00", estimateTotal: 160000, addonFee: 0, principal: "올데이케어", memo: "오늘 들어온 — 일정 미정", workDate: "2026-04-28", assignedDate: "2026-04-27", state: "waiting" },
    { taskCode: "A260428-002", customer: "정수환", phone: "010-1111-2222", address: "강남 역삼 강남파이낸스센터 503동", workType: "세척", appliance: "스탠드", qty: 1, region: "강남 역삼", time: "13:00", estimateTotal: 200000, addonFee: 0, principal: "에어컨프로", workDate: "2026-04-28", assignedDate: "2026-04-26", state: "scheduled" },
    { taskCode: "A260429-001", customer: "박지영", phone: "010-5555-1212", address: "송파 잠실 잠실엘스 207동 1503호", workType: "세척", appliance: "벽걸이", qty: 2, region: "송파 잠실", time: "11:00", estimateTotal: 320000, addonFee: 0, principal: "올데이케어", workDate: "2026-04-29", assignedDate: "2026-04-26", state: "scheduled" },
    { taskCode: "A260503-001", customer: "김상훈", phone: "010-7777-8888", address: "강남 압구정 현대아파트 702동", workType: "냉매충전", appliance: "벽걸이", qty: 1, region: "강남 압구정", time: "10:00", estimateTotal: 130000, addonFee: 0, principal: "유솔홈케어 N", workDate: "2026-05-03", assignedDate: "2026-04-25", state: "scheduled" },
    { taskCode: "A260504-001", customer: "이수영", phone: "010-9090-1234", address: "서초 반포 반포자이 305동 904호", workType: "세척", appliance: "벽걸이", qty: 2, region: "서초 반포", time: "14:00", estimateTotal: 320000, addonFee: 0, principal: "올데이케어", workDate: "2026-05-04", assignedDate: "2026-04-25", state: "scheduled" },
  ],
  // 정훈 — newAssigned 1 / confirmed 3 / todayDone 1 / todayAssigned 2
  "E021": [
    { taskCode: "YS-260427-021", customer: "박서연", phone: "010-7891-2345", address: "강남 청담 청담아이파크 103동 805호", workType: "세척", appliance: "스탠드", qty: 1, region: "강남 청담", time: "10:00", estimateTotal: 200000, addonFee: 0, principal: "유솔홈케어 H", memo: "네이버 결제 완료", workDate: "2026-04-27", assignedDate: "2026-04-26", state: "done", startedAt: "10:10", completedAt: "11:50", completedDate: "2026-04-27", photos: { before: 0, after: 0, driveUrl: "" } },
    { taskCode: "MG-260427-008", customer: "이재훈", phone: "010-4567-8901", address: "서초 반포 반포자이 305동 1404호", workType: "냉매충전", appliance: "벽걸이", qty: 2, region: "서초 반포", time: "13:00", estimateTotal: 240000, addonFee: 0, principal: "에어컨프로", memo: "가스 부족", workDate: "2026-04-27", assignedDate: "2026-04-27", state: "moving" },
    { taskCode: "A260428-021", customer: "김도훈", phone: "010-3344-5566", address: "서초 양재 양재대우디오빌 705호", workType: "점검", appliance: "벽걸이", qty: 1, region: "서초 양재", time: "10:00", estimateTotal: 60000, addonFee: 0, principal: "올데이케어", workDate: "2026-04-28", assignedDate: "2026-04-27", state: "scheduled" },
    { taskCode: "A260429-021", customer: "송민지", phone: "010-2233-4455", address: "강남 청담 청담린든그로브 503호", workType: "세척", appliance: "벽걸이", qty: 1, region: "강남 청담", time: "11:00", estimateTotal: 170000, addonFee: 0, principal: "올데이케어", workDate: "2026-04-29", assignedDate: "2026-04-25", state: "scheduled" },
    { taskCode: "A260430-021", customer: "장혜진", phone: "010-9988-7766", address: "서초 반포 반포센트레빌 901호", workType: "수리", appliance: "스탠드", qty: 1, region: "서초 반포", time: "14:00", estimateTotal: 150000, addonFee: 0, principal: "에어컨프로", workDate: "2026-04-30", assignedDate: "2026-04-26", state: "waiting" },
  ],
  // 김도현 — newAssigned 0 / confirmed 4 / todayDone 0 / todayAssigned 1
  "E007": [
    { taskCode: "A260427-011", customer: "최서연", phone: "010-5678-9012", address: "송파 가락 헬리오시티 405동 1502호", workType: "세척", appliance: "스탠드", qty: 1, region: "송파 가락", time: "10:00", estimateTotal: 180000, addonFee: 0, principal: "올데이케어", memo: "거실 스탠드 1대", workDate: "2026-04-27", assignedDate: "2026-04-26", state: "active", startedAt: "10:08" },
    { taskCode: "A260427-012", customer: "한지수", phone: "010-6789-0123", address: "송파 잠실 잠실엘스 207동 803호", workType: "점검", appliance: "벽걸이", qty: 2, region: "송파 잠실", time: "14:30", estimateTotal: 80000, addonFee: 0, principal: "올데이케어", memo: "냉방 약함", workDate: "2026-04-27", assignedDate: "2026-04-25", state: "scheduled" },
    { taskCode: "A260428-007", customer: "박지훈", phone: "010-1212-3434", address: "송파 가락 헬리오시티 502동 1801호", workType: "세척", appliance: "스탠드", qty: 1, region: "송파 가락", time: "11:00", estimateTotal: 180000, addonFee: 0, principal: "올데이케어", workDate: "2026-04-28", assignedDate: "2026-04-27", state: "scheduled" },
    { taskCode: "A260429-007", customer: "이은혜", phone: "010-5656-7878", address: "송파 신천 잠실파크리오 1102동", workType: "세척", appliance: "벽걸이", qty: 2, region: "송파 신천", time: "13:00", estimateTotal: 320000, addonFee: 0, principal: "에어컨프로", workDate: "2026-04-29", assignedDate: "2026-04-26", state: "scheduled" },
  ],
  // 최민수 — newAssigned 1 / confirmed 2 / todayDone 0 / todayAssigned 1
  "E004": [
    { taskCode: "MG-260427-014", customer: "이지수", phone: "010-7890-1234", address: "강남 청담 청담린든그로브 102동 901호", workType: "냉매충전", appliance: "벽걸이", qty: 1, region: "강남 청담", time: "09:30", estimateTotal: 130000, addonFee: 30000, principal: "에어컨프로", memo: "현장 추가 — 누설 보수", workDate: "2026-04-27", assignedDate: "2026-04-26", state: "active", startedAt: "09:35" },
    { taskCode: "A260427-015", customer: "박민호", phone: "010-8901-2345", address: "강남 역삼 강남파이낸스센터 28층", workType: "수리", appliance: "벽걸이", qty: 1, region: "강남 역삼", time: "13:00", estimateTotal: 110000, addonFee: 0, principal: "에어컨프로", memo: "리모컨 인식 안됨", workDate: "2026-04-27", assignedDate: "2026-04-27", state: "scheduled" },
    { taskCode: "A260428-004", customer: "김유나", phone: "010-3232-4545", address: "강남 도곡 타워팰리스 G동 1503호", workType: "냉매충전", appliance: "벽걸이", qty: 1, region: "강남 도곡", time: "11:00", estimateTotal: 130000, addonFee: 0, principal: "에어컨프로", workDate: "2026-04-28", assignedDate: "2026-04-25", state: "waiting" },
  ],
  // 김태승 — newAssigned 0 / confirmed 3 / todayDone 0 / todayAssigned 0
  "E010G": [
    { taskCode: "MG-260427-018", customer: "정수민", phone: "010-9012-3456", address: "마포 공덕 공덕래미안5차 502동 1105호", workType: "냉매충전", appliance: "벽걸이", qty: 2, region: "마포 → 서대문", time: "11:15", estimateTotal: 240000, addonFee: 0, principal: "에어컨프로", workDate: "2026-04-27", assignedDate: "2026-04-25", state: "moving" },
    { taskCode: "A260427-019", customer: "김민호", phone: "010-2345-6789", address: "송파 잠실 잠실리센츠 206동 1804호", workType: "스탠드 세척", appliance: "스탠드", qty: 1, region: "송파 잠실", time: "15:00", estimateTotal: 130000, addonFee: 0, principal: "에어컨프로", workDate: "2026-04-27", assignedDate: "2026-04-25", state: "scheduled" },
    { taskCode: "A260428-010", customer: "박세훈", phone: "010-3434-5656", address: "마포 합정 메세나폴리스 901호", workType: "냉매충전", appliance: "벽걸이", qty: 1, region: "마포 합정", time: "13:00", estimateTotal: 130000, addonFee: 0, principal: "에어컨프로", workDate: "2026-04-28", assignedDate: "2026-04-25", state: "scheduled" },
  ],
  // 박재현 — newAssigned 1 / confirmed 1 / todayDone 0 / todayAssigned 1
  "E024": [
    { taskCode: "MG-260427-024", customer: "김지혜", phone: "010-3456-7890", address: "마포 합정 합정메세나폴리스 1905호", workType: "냉매충전", appliance: "벽걸이", qty: 1, region: "마포", time: "14:30", estimateTotal: 130000, addonFee: 0, principal: "에어컨프로", workDate: "2026-04-27", assignedDate: "2026-04-26", state: "scheduled" },
    { taskCode: "A260427-025", customer: "이서연", phone: "010-4567-8901", address: "마포 망원 망원한강해모로 802호", workType: "점검", appliance: "벽걸이", qty: 1, region: "마포", time: "16:00", estimateTotal: 60000, addonFee: 0, principal: "올데이케어", workDate: "2026-04-27", assignedDate: "2026-04-27", state: "waiting" },
  ],
  // 이재현 — newAssigned 1 / confirmed 2 / todayDone 0 / todayAssigned 5 (배정 많이 받은 케이스)
  "E002": [
    { taskCode: "A260427-027", customer: "최영수", phone: "010-5678-9012", address: "동작 사당 사당롯데캐슬 105동 503호", workType: "수리", appliance: "스탠드", qty: 1, region: "동작", time: "17:00", estimateTotal: 150000, addonFee: 0, principal: "에어컨프로", memo: "외근 후 마지막 일정", workDate: "2026-04-27", assignedDate: "2026-04-27", state: "waiting" },
    { taskCode: "A260428-027", customer: "이정훈", phone: "010-7373-8484", address: "관악 봉천 관악푸르지오 502동", workType: "세척", appliance: "벽걸이", qty: 2, region: "관악 봉천", time: "11:00", estimateTotal: 320000, addonFee: 0, principal: "올데이케어", workDate: "2026-04-28", assignedDate: "2026-04-27", state: "scheduled" },
    { taskCode: "A260429-027", customer: "정혜원", phone: "010-9292-1818", address: "관악 신림 신림푸른마을 1004호", workType: "냉매충전", appliance: "벽걸이", qty: 1, region: "관악 신림", time: "10:00", estimateTotal: 130000, addonFee: 0, principal: "에어컨프로", workDate: "2026-04-29", assignedDate: "2026-04-27", state: "scheduled" },
    { taskCode: "A260430-027", customer: "박철수", phone: "010-2929-3838", address: "동작 상도 상도더샵 305동", workType: "세척", appliance: "스탠드", qty: 1, region: "동작 상도", time: "14:00", estimateTotal: 200000, addonFee: 0, principal: "유솔홈케어 H", workDate: "2026-04-30", assignedDate: "2026-04-27", state: "scheduled" },
    { taskCode: "A260501-027", customer: "최진영", phone: "010-1717-2828", address: "관악 서원 우림아파트 502동", workType: "점검", appliance: "벽걸이", qty: 1, region: "관악 서원", time: "13:00", estimateTotal: 60000, addonFee: 0, principal: "올데이케어", workDate: "2026-05-01", assignedDate: "2026-04-27", state: "scheduled" },
  ],
  // 박상민 — 종일 휴무 (배정 0)
  "E003": [],
};

// 기사 활동 통계 — 사장님 catch (Step 4-2)
// newAssigned = waiting / confirmed = scheduled+moving+active / todayDone = done&오늘 / todayAssigned = 오늘 배정
function getEngineerStats(engId, today) {
  const all = ENGINEER_ASSIGNMENTS[engId] || [];
  return {
    newAssigned:   all.filter(a => a.state === "waiting").length,
    confirmed:     all.filter(a => a.state === "scheduled" || a.state === "moving" || a.state === "active").length,
    todayDone:     all.filter(a => a.state === "done" && a.completedDate === today).length,
    todayAssigned: all.filter(a => a.assignedDate === today).length,
    items: all,
  };
}

// 배정 완료 / 일정 확정 화면용 — assigned 2 / confirmed 4 (TODAY_STATS와 일치)
// Step 5-7-C — ASSIGNED_TASKS 운영/시뮬 분기
const _ASSIGNED_TASKS_MOCK = [
  // assigned (일정 확정 대기) — 2건
  { id: "A260427-005", customer: "박은서", phone: "010-1234-5678",
    appliance: "벽걸이", qty: 1, region: "강남 도곡", schedule: "오늘 14:00", estimateTotal: 170000,
    principal: "올데이케어", memo: "",
    assignedEngineer: "김동효", engineerPhone: "010-9999-0001",
    assignmentStatus: "assigned" },
  { id: "MG-260427-008", customer: "김지수", phone: "010-9012-3456",
    appliance: "벽걸이", qty: 2, region: "서초 잠원", schedule: "내일 낮", estimateTotal: 240000,
    principal: "에어컨프로", memo: "",
    assignedEngineer: "김민준", engineerPhone: "010-9999-0002",
    assignmentStatus: "assigned" },
  // confirmed (일정 확정) — 4건
  { id: "YS-260427-021", customer: "박서연", phone: "010-7891-2345",
    appliance: "스탠드", qty: 1, region: "강남 청담", schedule: "오늘 13:00", estimateTotal: 200000,
    principal: "유솔홈케어 H", memo: "네이버 결제 완료",
    assignedEngineer: "정훈", engineerPhone: "010-9999-0003",
    assignmentStatus: "confirmed" },
  { id: "CC-260427-014", customer: "정수아", phone: "010-4567-1234",
    appliance: "벽걸이", qty: 2, region: "송파 잠실", schedule: "오늘 09:00", estimateTotal: 320000,
    principal: "올데이케어", memo: "",
    assignedEngineer: "김동효", engineerPhone: "010-9999-0001",
    assignmentStatus: "confirmed" },
  { id: "A260427-006", customer: "김민호", phone: "010-2345-6789",
    appliance: "스탠드", qty: 1, region: "송파 잠실", schedule: "오늘 15:00", estimateTotal: 130000,
    principal: "에어컨프로", memo: "",
    assignedEngineer: "김태승", engineerPhone: "010-9999-0004",
    assignmentStatus: "confirmed" },
  { id: "A260427-002", customer: "이상훈", phone: "010-3456-7890",
    appliance: "스탠드", qty: 2, region: "서초 반포", schedule: "오늘 11:30", estimateTotal: 280000,
    principal: "에어컨프로", memo: "",
    assignedEngineer: "김동효", engineerPhone: "010-9999-0001",
    assignmentStatus: "confirmed" },
];
const ASSIGNED_TASKS = ENABLE_MOCK ? _ASSIGNED_TASKS_MOCK : [];

// 기사 오늘 일정 mock (C 화면)
const ENGINEER_DAY = {
  engineer: "김동효",
  rank: "manager",
  status: "진행중",
  region: "강남 전담",
  date: "2026-05-01 (목)",
  total: 3,
  done: 1,
  remain: 2,
  slots: [
    { time: "09:00~10:30", customer: "정수민", workType: "점검",      region: "강남 역삼", appliance: "벽걸이",       state: "done" },
    { time: "11:30~13:30", customer: "이상훈", workType: "세척+점검", region: "서초 반포", appliance: "스탠드 ×2",   state: "active" },
    { time: "14:00~16:30", customer: "김미경", workType: "냉매충전",  region: "송파 잠실", appliance: "시스템 멀티",  state: "scheduled" },
  ],
};

// ============================================
// THEMES
// ============================================

const THEMES = {
  dark: {
    name: "🌑 다크", icon: Moon,
    bg: "#1A1512", bgElevated: "#221C18", bgInset: "#13100E",
    border: "rgba(255, 220, 200, 0.06)", borderStrong: "rgba(255, 220, 200, 0.10)",
    text: "#FAF8F5", textSecondary: "#C4B5A6", textMuted: "#8A7B6F", textDim: "#5C5048",
    accent: "#FF1B8D", accentBg: "rgba(255, 27, 141, 0.10)", accentBorder: "rgba(255, 27, 141, 0.3)",
    warning: "#FF1B8D", warningBg: "rgba(251, 191, 36, 0.10)", warningBorder: "rgba(251, 191, 36, 0.3)",
    success: "#34D399", successBg: "rgba(52, 211, 153, 0.10)", successBorder: "rgba(52, 211, 153, 0.3)",
    danger:  "#F87171", dangerBg:  "rgba(248, 113, 113, 0.10)", dangerBorder: "rgba(248, 113, 113, 0.3)",
    info:    "#60A5FA", infoBg:    "rgba(96, 165, 250, 0.10)",
    purple:  "#A78BFA", purpleBg:  "rgba(167, 139, 250, 0.10)",
    isLight: false,
  },
  light: {
    name: "☀️ 라이트", icon: Sun,
    bg: "#FAFAFA", bgElevated: "#FFFFFF", bgInset: "#F4F4F5",
    border: "rgba(0,0,0,0.05)", borderStrong: "rgba(0,0,0,0.09)",
    text: "#0A0A0A", textSecondary: "#404040", textMuted: "#737373", textDim: "#A3A3A3",
    accent: "#E91860", accentBg: "rgba(233, 24, 96, 0.06)", accentBorder: "rgba(233, 24, 96, 0.25)",
    warning: "#FF1B8D", warningBg: "rgba(217, 119, 6, 0.06)", warningBorder: "rgba(217, 119, 6, 0.22)",
    success: "#16A34A", successBg: "rgba(22, 163, 74, 0.06)", successBorder: "rgba(22, 163, 74, 0.22)",
    danger:  "#FF3D5A", dangerBg:  "rgba(220, 38, 38, 0.06)", dangerBorder: "rgba(220, 38, 38, 0.22)",
    info:    "#2563EB", infoBg:    "rgba(37, 99, 235, 0.06)",
    purple:  "#7C3AED", purpleBg:  "rgba(124, 58, 237, 0.08)",
    isLight: true,
  },
};

// ============================================
// 2026-05-22 — Shell + FontStyle 모듈 레벨 컴포넌트 (옛 AdminApp 안 정의 → 매 렌더 재정의 → 자식 unmount)
//
// 원인: AdminApp 함수 본체 안에서 const Shell = ... 정의 시 매 렌더마다 새 함수 identity →
// React reconciliation 측 다른 컴포넌트로 인식 → 자식 트리(NewReceptionFormScreen 등) unmount/remount →
// 폼 입력 state 소실 (특히 minute tick setInterval 측 매 분 발화).
//
// 정정: 모듈 레벨 함수로 추출 + t/toasts props 전달. 호출처 측 props 명시.
// 부가 효과: 모든 화면(작업 상세 / 정산 / 설정 등) 측 우발 unmount 함정 동시 해소.
// ============================================
const FontStyle = (
  <style>{`

    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes flash { 0%, 100% { background-color: transparent; } 30% { background-color: rgba(251, 191, 36, 0.25); } }
    .fade-in { animation: slideUp 0.4s ease-out; }
    .flash-highlight { animation: flash 1.5s ease-out; }
    .mono { font-family: inherit; }
    .clickable { cursor: pointer; transition: all 0.15s; }
    .clickable:active { opacity: 0.7; transform: scale(0.98); }
  `}</style>
);

function Shell({ t, toasts, children }) {
  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text }}>
      {FontStyle}
      <div style={{
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        background: t.bg,
        minHeight: "100vh",
        color: t.text,
        fontFamily: "'Pretendard', sans-serif",
        paddingBottom: "calc(80px + env(safe-area-inset-bottom))",
        paddingTop: "env(safe-area-inset-top)",
        position: "relative",
        boxSizing: "border-box",
      }}>
        {children}
        <ToastContainer t={t} toasts={toasts}/>
      </div>
    </div>
  );
}

// ============================================
// 메인 export — 화면 분기 (모달 state)
// ============================================

export default function AdminApp({ user, onLogout }) {
  const [mode, setMode] = useState(() => loadThemeSaved());
  // 테마 변경 시 CSS 변수 + body 배경 + localStorage 저장
  useEffect(() => {
    applyThemeVars(mode);
  }, [mode]);
  const t = THEMES[mode];

  // V14 Step 4.3 — AdminApp 글자 크기 적용 (EngineerApp 옛 박은 0.9/1.0/1.15 박지 X / 새 1.00/1.20/1.40 박힘)
  // 새 키 'ollit_admin_font_size' + 새 attribute 'data-admin-font-size' (src/index.css scope)
  // 옛 EngineerApp attribute 박지 X (충돌 catch / unmount 시 cleanup 박힘)
  useEffect(() => {
    let saved = "medium";
    try {
      const v = localStorage.getItem("ollit_admin_font_size");
      if (v === "small" || v === "medium" || v === "large") saved = v;
    } catch (e) {}
    document.documentElement.removeAttribute("data-font-size");
    document.documentElement.setAttribute("data-admin-font-size", saved);
    return () => {
      // AdminApp unmount 시 (예: 로그아웃 → EngineerApp 빠른 로그인) 옛 EngineerApp 비율 박힘
      document.documentElement.removeAttribute("data-admin-font-size");
    };
  }, []);

  // V11-4 — 운영자/관리자 로그인 시 22시 자동 알림 스케줄러 시작
  useEffect(() => {
    const role = user?.role === "admin" && user?.userId === "lee.ceo" ? "owner" : user?.role;
    if (role !== "owner" && role !== "admin") return;

    startDailyAlertScheduler();

    // 알림 권한 요청 (한 번만)
    if (typeof window !== "undefined" && window.Notification && window.Notification.permission === "default") {
      try { window.Notification.requestPermission(); } catch (e) { /* 무시 */ }
    }

    return () => stopDailyAlertScheduler();
  }, [user?.role, user?.userId]);

  // Step 8+9 V2 — Navigation Stack (history-aware goBack)
  const [screenStack, setScreenStack] = useState([]);
  const screen = screenStack.length > 0 ? screenStack[screenStack.length - 1] : null;
  // 호환용 setScreen — push (중복 방지) / null = stack 클리어 (메인)
  const setScreen = (name) => {
    if (name === null) {
      setScreenStack([]);
    } else {
      setScreenStack(prev => {
        if (prev[prev.length - 1] === name) return prev;
        return [...prev, name];
      });
    }
  };
  // 명시적 뒤로가기 — stack에서 pop
  const goBack = () => {
    setScreenStack(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
  };
  // V14 Phase 2.5 — top 교체 (action 완료 시 사용 / stack 중복 박지 X)
  // 예: newReceptionForm submit → replaceScreen('newReception')
  //   → stack [newReception, newReceptionForm] → [newReception]
  //   → 뒤로 = main ✓ (옛 setScreen은 [..., newReception] push → 뒤로 newReceptionForm 박힘 ⚠️)
  // 추가 catch: 새 top과 그 아래가 같은 화면이면 중복 제거
  //   예: [main, newReception, recommend] + replace('newReception') → [main, newReception, newReception]
  //       → 중복 제거 → [main, newReception] → 뒤로 = main ✓
  const replaceScreen = (name) => {
    setScreenStack(prev => {
      if (prev.length === 0) return name == null ? [] : [name];
      if (name == null) return prev.slice(0, -1);
      const newTop = [...prev.slice(0, -1), name];
      if (newTop.length >= 2 && newTop[newTop.length - 2] === name) {
        return newTop.slice(0, -1);
      }
      return newTop;
    });
  };
  // V14 Phase 2.5 — stack 박지 X / 메인으로 직접 (강제 reset)
  const resetTo = (name) => {
    if (name == null || name === "main") {
      setScreenStack([]);
    } else {
      setScreenStack([name]);
    }
  };
  const [editingEngineer, setEditingEngineer] = useState(null);  // 편집/추가 대상 (Step 6)
  const [editingIsNew, setEditingIsNew] = useState(false);
  // Step 7 — 원청 편집/추가 대상
  const [editingPrincipal, setEditingPrincipal] = useState(null);
  const [editingPrincipalIsNew, setEditingPrincipalIsNew] = useState(false);
  // Step 8 — 지역 편집/추가 대상
  const [editingRegion, setEditingRegion] = useState(null);
  const [editingRegionIsNew, setEditingRegionIsNew] = useState(false);
  // Step 9 — 사용자 편집/추가 대상
  const [editingUser, setEditingUser] = useState(null);
  const [editingUserIsNew, setEditingUserIsNew] = useState(false);
  const [prevScreen, setPrevScreen] = useState(null);  // taskDetail / engineerDay back 추적
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedEngineer, setSelectedEngineer] = useState(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);
  const [newReceptionFilter, setNewReceptionFilter] = useState(null);  // null | '세척' | '냉매충전'
  const [assignedFilter, setAssignedFilter] = useState(null);  // 'assigned' | 'confirmed'
  // 2026-05-17 Round 1 Fix #2 — 메인 "완료" 카드 클릭 시 작업 탭으로 이동 + 필터 (오늘+완료)
  const [liveWorkFilter, setLiveWorkFilter] = useState(null);  // null | 'completed-today'
  const [dashboardActiveTab, setDashboardActiveTab] = useState("overview");  // 외부에서 탭 변경 가능

  // V14 Week 2 2A — 진짜 시트 작업DB catch (apiTasks)
  const [apiTasks, setApiTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState("");

  // V14 Step 3 Fix 1 — 시트 설정_기사 catch (apiEngineers / 연락처 lookup 박기)
  const [apiEngineers, setApiEngineers] = useState([]);
  // Phase 3-6 — DB 측 기사 fetch + localStorage 캐시 (loadEngineers 병합 호환)
  async function fetchEngineers() {
    try {
      const res = await listEngineersFromDb();
      if (!res || res.ok === false) return;
      const list = res.engineers || [];
      if (!Array.isArray(list)) return;
      setApiEngineers(list);
      // feePolicy 캐시에도 저장 (앱 간 sync — 기사별 냉매 비율 lookup)
      setEngineersCache(list);
      console.log('[Phase 3-6] engineers(DB):', list.length, '명');
    } catch (e) {
      console.error('[Phase 3-6] fetchEngineers 에러:', e);
    }
  }
  useEffect(() => { fetchEngineers(); }, []);

  // Phase 3-3 — DB 측 원청 fetch + localStorage 캐시 (loadPrincipals 병합 호환)
  async function fetchPrincipals() {
    try {
      const res = await listPrincipalsFromDb();
      if (!res || res.ok === false) return;
      const list = res.principals || [];
      if (!Array.isArray(list) || list.length === 0) return;
      setPrincipalsCache(list);
      console.log('[Phase 3-3] principals(DB):', list.length, '곳');
    } catch (e) {
      console.error('[Phase 3-3] fetchPrincipals 에러:', e);
    }
  }
  useEffect(() => { fetchPrincipals(); }, []);

  // Phase 3-4 — DB 측 사용자 fetch + localStorage 캐시 (loadUsers 병합 호환)
  async function fetchUsers() {
    try {
      const res = await listUsersFromDb();
      if (!res || res.ok === false) return;
      const list = res.users || [];
      if (!Array.isArray(list)) return;
      setUsersCache(list);
      console.log('[Phase 3-4] users(DB):', list.length, '명');
    } catch (e) {
      console.error('[Phase 3-4] fetchUsers 에러:', e);
    }
  }
  useEffect(() => { fetchUsers(); }, []);

  // Phase 3-9 — engineer_principal_permissions + engineer_zones DB fetch + 캐시
  async function fetchEngineerSkills() {
    try {
      const res = await listEngineerSkillsFromDb();
      if (!res || res.ok === false) return;
      const list = res.skills || [];
      if (!Array.isArray(list)) return;
      setEngineerSkillsCache(list);
      console.log('[Phase 3-9] engineer skills:', list.length, '행');
    } catch (e) {
      console.error('[Phase 3-9] fetchEngineerSkills 에러:', e);
    }
  }
  useEffect(() => { fetchEngineerSkills(); }, []);

  // Phase 3-8 — engineer_rates DB fetch + 캐시 (시트 호출 폐기)
  async function fetchEngineerRates() {
    try {
      const res = await listEngineerRatesFromDb();
      if (!res || res.ok === false) return;
      const list = res.rates || [];
      if (!Array.isArray(list)) return;
      setEngineerRatesCache(list);
      console.log('[Phase 3-8] engineer rates:', list.length, '행');
    } catch (e) {
      console.error('[Phase 3-8] fetchEngineerRates 에러:', e);
    }
  }
  useEffect(() => { fetchEngineerRates(); }, []);

  // Phase 3-1 — 정책 캐시 (시트 → DB 전환).
  // listPoliciesSheetShape 측 옛 sheet 형태로 변환된 row 반환 → engineers.js._findInPoliciesCache 호환 유지.
  const POLICIES_CACHE_KEY = "ollit_policies_cache_v1";
  async function fetchAllPolicies() {
    try {
      const res = await listPoliciesSheetShape();
      if (!res || res.ok === false) return;
      const list = res.policies || [];
      if (!Array.isArray(list) || list.length === 0) return;
      try {
        localStorage.setItem(POLICIES_CACHE_KEY, JSON.stringify(list));
      } catch (e) { /* 저장 실패 시 무시 */ }
      console.log('[Phase 3-1] policies(DB):', list.length, '행');
    } catch (e) {
      console.error('[Phase 3-1] fetchAllPolicies 에러:', e);
    }
  }
  useEffect(() => { fetchAllPolicies(); }, []);

  // V14 Step 3 Fix 1 — 기사 이름 → 연락처 lookup helper
  const getEngineerPhone = (name) => {
    if (!name || apiEngineers.length === 0) return "";
    const eng = apiEngineers.find(e =>
      e.name === name || e.이름 === name || e.engineerId === name || e.기사ID === name
    );
    return (eng && (eng.phone || eng.연락처 || eng.전화)) || "";
  };
  // V14 2B-3 — 배정 진행/에러 (RecommendScreen 박힘)
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  // V14 큰 흐름 — 취소 요청 처리 모달 state
  const [cancelHandleTask, setCancelHandleTask] = useState(null);
  const [cancelRejectReason, setCancelRejectReason] = useState("");

  // V14 — 취소 확인 (기사 취소요청 → 운영자 승인)
  // 2026-05-25 Round 2 — 옛 approveCancelAdapter 폐기, admin_full_cancel RPC 로 통일.
  //   부수처리 (Optimistic / 토스트 / 모달 close / fetchTasks) 는 그대로 유지.
  //   거절(handleRejectCancel) / 기사 측 취소요청(requestCancelAdapter) 경로는 무수정.
  async function handleApproveCancel() {
    if (!cancelHandleTask?.id) return;
    try {
      const res = await adminFullCancel(cancelHandleTask.id, '운영자 확인');
      if (!res || res.ok === false) {
        addToast({ type: "completed", title: "취소 실패", message: (res && res.error) || "알 수 없는 오류" });
        return;
      }
      // Optimistic
      setApiTasks(prev => prev.map(t =>
        t.id === cancelHandleTask.id ? { ...t, status: '취소', state: 'canceled' } : t
      ));
      addToast({ type: "assignment", title: "✓ 취소 완료", message: `${cancelHandleTask.customer || ""} / 취소DB 이동` });
      setCancelHandleTask(null);
      setCancelRejectReason("");
      fetchTasks();
    } catch (e) {
      addToast({ type: "completed", title: "취소 에러", message: e.message });
    }
  }

  // V14 — 취소 거절
  async function handleRejectCancel() {
    if (!cancelHandleTask?.id || !cancelRejectReason.trim()) return;
    try {
      const res = await apiRejectCancel(cancelHandleTask.id, cancelRejectReason);
      if (!res || res.ok === false) {
        addToast({ type: "completed", title: "거절 실패", message: (res && res.error) || "시트 박지 X" });
        return;
      }
      // Optimistic — 옛 상태 복구 (backend 응답에서 oldStatus 박힘)
      const oldStatus = (res && res.oldStatus) || '미배정';
      setApiTasks(prev => prev.map(t =>
        t.id === cancelHandleTask.id ? { ...t, status: oldStatus } : t
      ));
      addToast({ type: "assignment", title: "취소 거절", message: `${cancelHandleTask.customer || ""} / 프로에게 알림 전송됨` });
      setCancelHandleTask(null);
      setCancelRejectReason("");
      fetchTasks();
    } catch (e) {
      addToast({ type: "completed", title: "거절 에러", message: e.message });
    }
  }
  // V14 디버그 — 0건 catch 시 raw 응답 박힘 (사장님 catch 용)
  const [tasksDebug, setTasksDebug] = useState(null);

  // 깊이 있는 배열 키 catch (시트/서버 응답 shape 다양성 catch)
  function _v14FindTaskList(res) {
    if (!res) return { list: null, key: 'null response' };
    if (Array.isArray(res)) return { list: res, key: '(root array)' };
    const candidates = ['tasks', 'data', 'rows', 'list', 'items', 'result', 'records'];
    for (const k of candidates) {
      if (Array.isArray(res[k])) return { list: res[k], key: k };
    }
    // 1단계 nested catch
    for (const k of Object.keys(res)) {
      const v = res[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const k2 of candidates) {
          if (Array.isArray(v[k2])) return { list: v[k2], key: `${k}.${k2}` };
        }
      }
    }
    return { list: null, key: 'no array key found' };
  }

  async function fetchTasks(options = {}) {
    // 2026-05-14 fix — 60초 폴링 시 로딩 인디케이터 박지 X (깜박임 catch)
    // 초기 mount / 수동 새로고침: 로딩 박음 / 폴링: 백그라운드
    const isBackground = options.background === true;
    if (!isBackground) {
      setTasksLoading(true);
    }
    setTasksError("");
    setTasksDebug(null);
    try {
      console.log('[V14 2A] fetchTasks 시작 — role=admin / userId=', user?.id || user?.userId || 'admin');
      const res = await apiGetTasks('admin', user?.id || user?.userId || 'admin', null);
      console.log('[V14 2A] raw 응답:', res);
      console.log('[V14 2A] 응답 키:', res ? Object.keys(res) : 'null');

      if (!res || res.ok === false) {
        setTasksError((res && res.error) || '불러오기 실패');
        setTasksDebug({ phase: 'error', res });
        return;
      }

      const { list, key } = _v14FindTaskList(res);
      console.log(`[V14 2A] 배열 key="${key}" / length=${list ? list.length : 'null'}`);
      if (list && list[0]) {
        console.log('[V14 2A] 첫 row sample:', list[0]);
        console.log('[V14 2A] 첫 row 키:', Object.keys(list[0]));
      }

      if (!Array.isArray(list)) {
        // 0건 또는 catch X — UI에 디버그 박기
        setApiTasks([]);
        setTasksDebug({
          phase: 'no-array',
          arrayKey: key,
          responseKeys: res ? Object.keys(res) : [],
          response: res,
        });
        return;
      }

      const normalized = list.map(_v14NormalizeTask).filter(Boolean);
      console.log('[V14 2A] normalized:', normalized.length, '건');
      if (normalized[0]) console.log('[V14 2A] 첫 normalized:', normalized[0]);

      // 2026-05-10 hotfix — Optimistic 마킹된 task는 polling 결과 덮어씀 방지 (60초간)
      // 2026-05-14 fix — DB 측 status가 finalized (취소/완료/정산완료/취소요청) 박혔으면
      //                  Optimistic 무시 + DB 측 status 우선 (다른 사용자 변경 즉시 catch)
      setApiTasks(prev => {
        const optimisticMap = new Map();
        const now = Date.now();
        const dbMap = new Map(normalized.map(n => [n.id, n]));
        const FINALIZED = new Set(['취소', '완료', '정산완료', '취소요청']);
        for (const t of prev) {
          if (t._optimisticUntil && t._optimisticUntil > now) {
            // DB 측 동일 task의 status가 finalized 박혔으면 Optimistic 무시
            const dbVersion = dbMap.get(t.id);
            if (dbVersion && FINALIZED.has(dbVersion.status)) {
              continue;
            }
            optimisticMap.set(t.id, t);
          }
        }
        if (optimisticMap.size === 0) return normalized;
        return normalized.map(t => optimisticMap.has(t.id) ? optimisticMap.get(t.id) : t);
      });
      // 0건이면 디버그 표시 (사장님 catch 위해)
      if (normalized.length === 0) {
        setTasksDebug({
          phase: 'zero-after-normalize',
          arrayKey: key,
          responseKeys: res ? Object.keys(res) : [],
          rawListLength: list.length,
          firstRowSample: list[0] || null,
          firstRowKeys: list[0] ? Object.keys(list[0]) : [],
          response: res,
        });
      }
    } catch (e) {
      console.error('[V14 2A] fetchTasks 에러:', e);
      setTasksError(e.message || '불러오기 실패');
      setTasksDebug({ phase: 'exception', error: e.message, stack: e.stack });
    } finally {
      if (!isBackground) {
        setTasksLoading(false);
      }
    }
  }
  // 2026-05-14 — Supabase Realtime 구독 (옛 60초 폴링 폐기)
  // 신규접수 폼 진입 시 fetch 끊기 (입력 초기화 방지)
  // payload 분기 박지 X / 단순 refetch 패턴 (background:true 측 깜박임 X)
  useRealtimeTasks(() => {
    if (screen === "newReceptionForm") return;
    fetchTasks({ background: true });
  });

  // V14 — mount 시 한 번 + user 변경 시 재호출
  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.userId]);

  // 2026-05-22 — Service Worker push 메시지 도착 시 자동 refetch (이중 안전망)
  // realtime 측 실패해도 push 도착할 때마다 화면 갱신. 신규접수 폼 진입 시는 끊기.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const handler = (event) => {
      if (event.data?.type !== "PUSH_RECEIVED") return;
      if (screen === "newReceptionForm") return;
      fetchTasks({ background: true });
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // Step 5 — 새 접수 등록 + 알림 (Phase 1 mock)
  // 새 접수 추가분 (NEW_RECEPTIONS const + 폼에서 등록한 항목)
  const [extraReceptions, setExtraReceptions] = useState([]);
  // Step 5-3 v3 — 새 접수 카드 상태 변경 (자동 배정 완료 등) AdminApp 레벨 overlay
  const [receptionUpdates, setReceptionUpdates] = useState({});  // { [id]: { autoAssignStatus, acceptedEngineer } }
  function updateReception(id, partial) {
    if (!id) return;
    setReceptionUpdates(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...partial } }));
  }
  // In-App 알림 (Phase 2: Web Push + Supabase Realtime)
  // 2026-05-10 — IndexedDB 측 push 알림 통합 (notification:added 이벤트로 자동 갱신)
  const [notifications, setNotifications] = useState(NOTIFICATIONS_MOCK);

  useEffect(() => {
    let cancelled = false;
    async function reload() {
      const stored = await listStoredNotifications();
      if (cancelled) return;
      const adapted = stored.map(adaptStoredAdminNoti);
      // mock + IndexedDB 합쳐서 (옛 mock 호환 / push 받은 거 추가)
      setNotifications([...adapted, ...NOTIFICATIONS_MOCK]);
    }
    reload();
    const handler = () => reload();
    window.addEventListener("notification:added", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("notification:added", handler);
    };
  }, []);
  // 화면 상단 toast (3초 자동 사라짐)
  const [toasts, setToasts] = useState([]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Step 10 — 진짜 카운팅 (기존 mock TODAY_STATS 대체)
  // 2026-05-19 Phase 5 Step 0.C-10 — mock data source 측 모두 제거
  //   옛: tasksToday=TASKS_TODAY, newReceptions=NEW_RECEPTIONS, assignedTasks=ASSIGNED_TASKS
  //   새: apiTasks 측 only + extraReceptions (옵티미스틱 측만 / 등록 직후 lag 동안)
  //   사장님 catch: 메인 카운트 측 mock 잔존 측 detail 측 mismatch 발생.
  // 2026-05-21 Phase 5 Step 0.H-5 — effectiveStatus 측 1분 자동 갱신
  //   예정 시간 측 측 작업 측 자동 진행중 측 측 → 매 분 마다 dynamicStats 재계산
  const [minuteTick, setMinuteTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMinuteTick(v => v + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const dynamicStats = useMemo(() => computeDashboardStats({
    extraReceptions,
    apiTasks,
    user: getCurrentUserPerm(user),
  }), [extraReceptions, receptionUpdates, user, apiTasks, minuteTick]);

  function addToast(toast) {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id));
    }, toast.duration || 3000);
  }

  function addNotification(noti) {
    const id = "n" + Date.now();
    // 옛 필드 (type/message/subInfo) → 새 필드 (category/title/subtitle) 자동 변환
    const ADMIN_TYPE_TO_CATEGORY = {
      new_reception:      { category: "new_assign",       label: "새 접수"   },
      assignment:         { category: "new_assign",       label: "프로 배정" },
      // 2026-05-16 — schedule_confirm alias 박은 거 박지 X (WORK_STARTED 박힘), 정식 키 사용
      schedule_confirmed: { category: "schedule_changed", label: "일정 확정" },
      // 2026-05-16 — 시작/완료 정식 카테고리 분리 (schedule_confirm/complete alias 박지 X)
      started:            { category: "work_started",     label: "작업 시작" },
      schedule_changed:   { category: "schedule_changed", label: "일정 변경" },
      completed:          { category: "work_completed",   label: "작업 완료" },
      // 2026-05-16 — complete alias 박은 거 박지 X (WORK_COMPLETED 박힘), 정식 키 사용
      cancelled:          { category: "work_canceled",    label: "작업 취소" },
      reassignment:       { category: "new_assign",       label: "프로 재배정" },  // NEW
      urgent:             { category: "urgent",           label: "긴급"     },
    };
    const isOldStyle = noti.message !== undefined;
    const map = ADMIN_TYPE_TO_CATEGORY[noti.type];
    const normalized = {
      ...noti,
      id, read: false,
      category:      noti.category      ?? (map ? map.category : "ops_memo"),
      categoryLabel: noti.categoryLabel ?? (isOldStyle ? noti.title : (map ? map.label : "알림")),
      title:         isOldStyle ? noti.message : (noti.title ?? ""),
      subtitle:      noti.subtitle      ?? noti.subInfo ?? "",
      timeAgo:       noti.timeAgo       ?? "방금",
      createdAt:     noti.createdAt     ?? new Date(),
    };
    setNotifications(prev => [normalized, ...prev]);
  }

  function markNotiRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  // 새 접수 등록 — workItems[0] 우선, mock id 생성
  function addReception(form) {
    const today = new Date();
    const yy = String(today.getFullYear()).slice(2);
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const seq = String(extraReceptions.length + 9).padStart(3, "0");
    // Step 5-1e (통합) — 우선순위 정렬 (메인 = 가장 복잡한 작업)
    const rawItems = Array.isArray(form.workItems) ? form.workItems : [];
    const items = sortWorkItemsByPriority(rawItems);
    const head = items[0] || { workType: "세척", appliance: "벽걸이", qty: 1 };
    const extraCount = items.length > 1 ? items.length - 1 : 0;
    const scheduleText = form.scheduleType === "tbd"
      ? "프로님 컨택"
      : ([form.requestDate, form.requestTime].filter(Boolean).join(" ") || "협의");
    const workflow = WORK_TYPES_CONFIG[head.workType]?.workflow || "manual_with_recommendation";
    // Step 5-3 v3 — 자동 배정 작업이면 등록 시점에 push 시작 (carded 상태 표시용)
    const isAuto = workflow === "auto_first_accept";
    let pushCount = 0;
    if (isAuto) {
      const broadcast = getAutoBroadcastCandidates(head.workType, form.region, head.appliance, 4);
      pushCount = broadcast.length;
    }
    // V14 1F — form.taskId 가 있으면 진짜 API 결과 / 없으면 임시 시뮬 ID (점진 폐기)
    const newTask = {
      id: form.taskId || `A${yy}${mm}${dd}-${seq}`,
      customer: form.customer,
      phone: form.phone,
      appliance: head.appliance,
      qty: head.qty || 1,
      region: form.region || "—",
      time: "방금",
      principal: form.principal,
      channel: form.channel || "",
      schedule: scheduleText,
      estimateTotal: form.estimateTotal || 0,
      memo: form.memo || "",
      workType: head.workType,
      workItems: items,                                 // 정렬 후 저장
      extraCount,
      scheduleType: form.scheduleType || "tbd",
      workflow,
      hasRefrigerant: hasRefrigerantItem(items),        // ⚡ 표시용
      // Step 5-3 v3 — 자동 배정 초기 상태
      autoAssignStatus: isAuto ? "pushing" : null,
      acceptedEngineer: null,
      pushCount: isAuto ? pushCount : 0,
    };
    setExtraReceptions(prev => [newTask, ...prev]);
    // Step 5-1d — 작업 종류별 그룹화 표시
    const itemSummary = formatWorkItems(items) || `${head.workType} ×${head.qty || 1}`;
    addNotification({
      type: "new_reception",
      title: isAuto ? "신규 접수 (자동 배정 시작)" : "신규 접수",
      message: `${form.customer} (${itemSummary})`,
      subInfo: form.region || form.address,
      taskId: newTask.id,
    });
    addToast({
      type: "new_reception",
      title: isAuto ? "신규 접수 — 자동 배정 시작" : "신규 접수 등록",
      message: `${form.customer} (${itemSummary})`,
    });
    return newTask;
  }

  // 화면 진입 헬퍼 — 두 시각 분리 (작업 상세 / 기사 오늘)
  const goTaskDetail   = (task, from) => { setSelectedTaskDetail(task); setPrevScreen(from); setScreen("taskDetail"); };
  const goEngineerDay  = (eng,  from) => { setSelectedEngineer(eng);    setPrevScreen(from); setScreen("engineerDay"); };
  const goBackFromStack = () => { setPrevScreen(null); goBack(); };

  // 2026-05-22 — Shell + FontStyle 측 모듈 레벨 함수로 추출 (위 정의 참조).
  // 옛 const 정의 측 매 렌더마다 새 함수 identity → 자식 unmount → 폼 state 소실.

  // 화면 분기
  if (screen === "newReception") {
    return <Shell t={t} toasts={toasts}>
      <NewReceptionScreen
        t={t}
        filter={newReceptionFilter}
        extraReceptions={extraReceptions}
        apiTasks={apiTasks}
        tasksLoading={tasksLoading}
        tasksError={tasksError}
        tasksDebug={tasksDebug}
        onRefresh={fetchTasks}
        receptionUpdates={receptionUpdates}
        onBack={() => { goBack(); setNewReceptionFilter(null); }}
        onAssign={(task) => {
          // Step 5-3 — 세척 카드 [기사 배정 →] → 추천 화면 (manual_with_recommendation)
          // 냉매 카드는 onAssign 호출 X (RefrigerantCard에 button 없음)
          const flow = determineWorkflow(task.workItems) || WORK_TYPES_CONFIG[task.workType]?.workflow || "manual_with_recommendation";
          setSelectedTask(task);
          setScreen(flow === "auto_first_accept" ? "autoAssign" : "recommend");
        }}
        onClickAdd={() => setScreen("newReceptionForm")}
        onClickPushing={(task) => { setSelectedTask(task); setScreen("autoAssign"); }}
        onClickAccepted={(task) => goTaskDetail(task, "newReception")}
        onCardMenuAction={(action, task) => {
          // Step 8+9 V8 — 카드 [⋯] 메뉴 액션 분기
          // call → tel: 링크 / memo → MemoAddScreen
          // detail/cancel/visit_only/partial → 작업 상세 화면 (거기서 다이얼로그)
          // edit → 수정 화면
          if (action === "call") {
            const phone = task.phone || task.engineerPhone;
            if (phone) {
              window.location.href = `tel:${phone}`;
            } else {
              addToast({ type: "assignment", title: "통화", message: "전화번호가 등록되지 않았습니다" });
            }
          } else if (action === "memo") {
            setSelectedTask(task);
            setScreen("memoAdd");
          } else if (action === "edit") {
            setSelectedTask(task);
            setScreen("taskEdit");
          } else if (action === "change_engineer") {
            // 작업 상세 → [수정]에서 담당 기사 필드를 변경
            setSelectedTask(task);
            setScreen("taskEdit");
          } else if (action === "change_schedule") {
            // 작업 상세 → [수정]에서 일정 필드를 변경
            setSelectedTask(task);
            setScreen("taskEdit");
          } else {
            // detail / cancel / visit_only / partial / complete → 작업 상세 화면
            goTaskDetail(task, "newReception");
          }
        }}
      />
    </Shell>;
  }
  if (screen === "newReceptionForm") {
    return <Shell t={t} toasts={toasts}>
      <NewReceptionFormScreen
        t={t}
        onBack={goBack}
        onSubmit={(form) => {
          addReception(form);

          // 2026-05-14 진단용 — 자동 AutoAssignScreen 진입 임시 다시 켜기 (디버그 로그 catch 박을 차례)
          // 무한 루프 catch 박힐 영역 catch 박은 후 다시 결정 박을 차례
          const head = (form.workItems && form.workItems[0]) || {};
          const workflow = WORK_TYPES_CONFIG[head.workType]?.workflow;
          const isAuto = workflow === "auto_first_accept";
          if (form._v14ApiOk && isAuto && form.taskId) {
            setSelectedTask({
              id:         form.taskId,
              taskId:     form.taskId,
              taskCode:   form.taskId,
              workType:   head.workType,
              appliance:  head.appliance,
              qty:        head.qty || 1,
              workItems:  form.workItems,
              region:     form.region,
              principal:  form.principal,
              customer:   form.customer,
              phone:      form.phone,
              address:    form.address,
              estimateTotal: form.estimateTotal || 0,
              // 2026-05-22 — 사장님 spec: 푸시 후보 10명 (옛 4명 → 10명)
              pushCount:  10,
            });
            replaceScreen("autoAssign");
            return;
          }

          // V14 Phase 2.5 — replaceScreen 박기 (옛 setScreen = stack 중복 / 뒤로 newReceptionForm 박힘 catch)
          replaceScreen("newReception");
          // V14 2A — 진짜 API 등록 후 Realtime 측 자동 박힘 (옛 fetchTasks 호출 박지 X)
        }}
      />
    </Shell>;
  }
  if (screen === "memoAdd" && selectedTask) {
    return <Shell t={t} toasts={toasts}>
      <MemoAddScreen
        task={selectedTask}
        user={user}
        onBack={goBack}
        onSaved={(memo) => {
          addToast({ type: "assignment", title: "메모 저장", message: memo?.content?.slice(0, 24) || "—" });
        }}
      />
    </Shell>;
  }
  if (screen === "taskEdit" && selectedTask) {
    return <Shell t={t} toasts={toasts}>
      <TaskFullEditScreen
        task={selectedTask}
        user={user}
        onBack={goBack}
        onSave={(updated, changes) => {
          addToast({
            type: "assignment",
            title: "수정 완료",
            message: `${updated.customer || "—"} · ${changes.length}건 변경`,
          });
        }}
      />
    </Shell>;
  }
  if (screen === "taskHistory" && selectedTask) {
    return <Shell t={t} toasts={toasts}>
      <TaskHistoryScreen
        task={selectedTask}
        onBack={goBack}
      />
    </Shell>;
  }
  if (screen === "notifications") {
    return <Shell t={t} toasts={toasts}>
      <NotificationScreen
        t={t}
        notifications={notifications}
        onBack={goBack}
        onMarkRead={markNotiRead}
        onMarkAllRead={markAllRead}
        onClickItem={(noti) => {
          markNotiRead(noti.id);
          // 알림에 박힌 taskId로 시드 검색 후 작업 상세 진입
          const findTask = (id) => {
            if (!id) return null;
            return TASKS_TODAY.find(t => t.id === id || t.taskCode === id)
              || ASSIGNED_TASKS.find(t => t.id === id || t.taskCode === id)
              || null;
          };
          const task = findTask(noti.taskId);
          if (task) {
            goTaskDetail(task, "notifications");
          } else {
            addToast({ type: "assignment", title: "작업 정보 없음", message: "원본 작업을 찾을 수 없습니다" });
          }
        }}
      />
    </Shell>;
  }
  if (screen === "liveWork") {
    return <Shell t={t} toasts={toasts}>
      <LiveWorkScreen
        t={t}
        onBack={() => { goBack(); setLiveWorkFilter(null); }}
        onTaskClick={(task) => goTaskDetail(task, "liveWork")}
        initialFilter={liveWorkFilter}
        apiTasks={apiTasks}
      />
    </Shell>;
  }
  if (screen === "engineerDay" && selectedEngineer) {
    return <Shell t={t} toasts={toasts}>
      <EngineerDayScreen
        t={t}
        engineer={selectedEngineer}
        onBack={goBackFromStack}
        onTaskClick={(task) => goTaskDetail(task, "engineerDay")}
      />
    </Shell>;
  }
  if (screen === "taskDetail" && selectedTaskDetail) {
    return <Shell t={t} toasts={toasts}>
      <AdminTaskDetailScreen
        t={t}
        task={selectedTaskDetail ? {
          ...selectedTaskDetail,
          // V14 Step 3 Fix 1 — apiEngineers에서 연락처 lookup 박기 (normalize에 박지 X면 박힘)
          engineerPhone: selectedTaskDetail.engineerPhone || getEngineerPhone(selectedTaskDetail.assignedEngineer || selectedTaskDetail.engineer),
        } : null}
        onBack={goBackFromStack}
        onCancelTask={async (reasonId, memo) => {
          // 2026-05-25 Round 2 — 옛 approveCancelAdapter 경로 폐기, 신규 admin_full_cancel RPC 호출.
          //   RPC 가 status='취소' + task_items 전부 is_canceled=true 자동 + 070 트리거 연쇄.
          //   기본 수고비 kind='none'. 운영자가 작업상세 컨트롤에서 visit_fee 토글 가능.
          const tk = selectedTaskDetail;
          if (!tk?.id) {
            addToast({ type: "completed", title: "취소 실패", message: "작업 정보 없음" });
            return;
          }
          const reason = `${reasonId}${memo ? " · " + memo : ""}`;
          try {
            const res = await adminFullCancel(tk.id, reason);
            if (!res || res.ok === false) {
              addToast({ type: "completed", title: "취소 실패", message: (res && res.error) || "알 수 없는 오류" });
              return;
            }
            // Optimistic Update — 화면 측 즉시 반영
            setApiTasks(prev => prev.map(t =>
              t.id === tk.id ? { ...t, status: "취소", state: "canceled" } : t
            ));
            addNotification({
              type: "cancelled",
              title: "작업 취소",
              message: `${tk.customer || "—"}`,
              subInfo: `사유: ${reasonId} ${memo ? "· " + memo.slice(0, 20) : ""}`,
              taskId: tk.id || tk.taskCode,
            });
            addToast({ type: "cancelled", title: "작업 취소", message: tk.customer || "—" });
            // 2026-05-19 Phase 5 Step 0.C-4 — 변경 이력 audit log
            insertTaskChange({
              taskId:        tk.id,
              changeType:    "cancel",
              before:        { status: tk.status || null },
              after:         { status: "취소" },
              note:          reason,
              changedBy:     user?.user_id || user?.id || null,
              changedByName: user?.name || null,
            });
            goBackFromStack();
          } catch (e) {
            console.error("[onCancelTask] 에러:", e);
            addToast({ type: "completed", title: "취소 에러", message: e.message || "취소 처리 중 오류" });
          }
        }}
        onPartialCancel={async (itemIds, reason) => {
          // 2026-05-25 Round 2 — 운영자 부분취소 (item별 admin_partial_cancel_item RPC 순차 호출).
          const tk = selectedTaskDetail;
          if (!tk?.id || !Array.isArray(itemIds) || itemIds.length === 0) return;
          let ok = 0, fail = 0;
          for (const itemId of itemIds) {
            const res = await adminPartialCancelItem(itemId, reason);
            if (res && res.ok) ok += 1; else fail += 1;
          }
          if (fail === 0) {
            addToast({ type: "completed", title: "부분 취소 완료", message: `${ok}건 처리됨` });
          } else {
            addToast({ type: "completed", title: "부분 취소 일부 실패", message: `성공 ${ok} / 실패 ${fail}` });
          }
          // refetch trigger — realtime / 다음 polling 시 동기. Optimistic 갱신 X (item 단위).
        }}
        onSetCompensation={async (kind) => {
          // 2026-05-25 Round 2 — 취소 건 기사 수고비 토글 (admin_set_cancel_compensation RPC).
          const tk = selectedTaskDetail;
          if (!tk?.id || !kind) return;
          const res = await adminSetCancelCompensation(tk.id, kind);
          if (!res || res.ok === false) {
            addToast({ type: "completed", title: "수고비 변경 실패", message: (res && res.error) || "오류" });
            return;
          }
          const amount = res.data?.engineer_amount ?? 0;
          // Optimistic — 화면 즉시 반영
          setApiTasks(prev => prev.map(t =>
            t.id === tk.id
              ? { ...t, cancelEngineerCompKind: kind, cancelEngineerCompAmount: amount }
              : t
          ));
          addToast({ type: "completed", title: "수고비 변경", message: `${kind === "visit_fee" ? "출장비만" : "없음"} · ₩${amount.toLocaleString("ko-KR")}` });
        }}
        onVisitOnly={(payload) => {
          addNotification({
            type: "completed",
            title: "🚗 출장비만 정산",
            message: `${selectedTaskDetail.customer || "—"} · 출장비 ${VISIT_FEE.amount.toLocaleString()}원`,
            subInfo: `사유: ${payload.reasonLabel || "—"} · 프로 100%`,
            taskId: selectedTaskDetail.id || selectedTaskDetail.taskCode,
          });
          addToast({
            type: "completed",
            title: "출장비만 확정",
            message: `${selectedTaskDetail.customer || "—"} · ₩${VISIT_FEE.amount.toLocaleString()}`,
          });
          // 2026-05-19 Phase 5 Step 0.C-4 — 변경 이력 audit log
          insertTaskChange({
            taskId:        selectedTaskDetail.id,
            changeType:    "visit_only",
            before:        { status: selectedTaskDetail.status || null },
            after:         { status: "완료", visit_fee: VISIT_FEE.amount, type: "visit_only" },
            note:          payload?.reasonLabel || null,
            changedBy:     user?.user_id || user?.id || null,
            changedByName: user?.name || null,
          });
          goBackFromStack();
        }}
        onMemoAdd={() => {
          setSelectedTask(selectedTaskDetail);
          setScreen("memoAdd");
        }}
        onEdit={() => {
          setSelectedTask(selectedTaskDetail);
          setScreen("taskEdit");
        }}
        onHistory={() => {
          setSelectedTask(selectedTaskDetail);
          setScreen("taskHistory");
        }}
        onAssign={() => {
          // V14 2B-1 fix — 기사 배정/변경 = RecommendScreen 진입
          // (자동 배정 작업은 autoAssign / 그 외는 recommend / 옛 시뮬 mock OK)
          const tk = selectedTaskDetail;
          if (!tk) return;
          const flow = WORK_TYPES_CONFIG[tk.workType]?.workflow || "manual_with_recommendation";
          setSelectedTask(tk);
          setScreen(flow === "auto_first_accept" ? "autoAssign" : "recommend");
        }}
        // V14 2B-2 — 일정 변경 (prompt 박은 임시 모달 / 진짜 picker = Phase 2)
        onScheduleChange={async () => {
          const tk = selectedTaskDetail;
          if (!tk?.id) return;
          const today = todayYmd();
          const dateStr = window.prompt("일정 날짜 박기 (YYYY-MM-DD):", tk.requestedDate || tk.confirmedDate || today);
          if (!dateStr) return;
          const timeStr = window.prompt("일정 시간 박기 (HH:MM):", tk.requestedTime || "10:00");
          if (!timeStr) return;
          const confirmedAt = `${dateStr} ${timeStr}`;
          // V14 헌법 — '확정' = 배정 + 일정 박힌 catch
          // 일정만 박은 경우 = 약속대기 그대로 / 배정 박힌 경우만 → 확정
          // (사장님 catch: 기사가 일정 확정 박는 진짜 흐름 / 운영자는 예외 catch)
          const hasEngineer = !!(tk.assignedEngineer || tk.engineer);
          const newStatus = hasEngineer ? '확정' : (tk.status || '미배정');
          try {
            console.log('[V14 2B-2] updateTask 일정', { taskId: tk.id, scheduledAt: confirmedAt, hasEngineer, newStatus });
            const res = await apiUpdateTask(tk.id, {
              // V14 — backend 박은 키: scheduledAt (N 확정일시 catch)
              scheduledAt: confirmedAt,
              // 옛 호환 (frontend Optimistic 적용 케이스)
              confirmedAt,
              confirmedDate: dateStr,
              confirmedTime: timeStr,
              // V14 헌법 — 배정 박힌 경우만 확정 / 박지 X = 약속대기 그대로
              status: newStatus,
            });
            if (!res || res.ok === false) {
              alert(`일정 변경 실패: ${(res && res.error) || '실패'}`);
              return;
            }
            setApiTasks(prev => prev.map(t =>
              t.id === tk.id
                ? {
                    ...t,
                    scheduledAt: confirmedAt,  // V14 backend 박은 키 (일정 확정 카운트 catch)
                    confirmedAt, confirmedDate: dateStr, confirmedTime: timeStr,
                    status: newStatus,
                    state: newStatus === '확정' ? 'scheduled' : 'waiting',
                    schedule: confirmedAt, time: timeStr,
                    확정일시: confirmedAt,
                  }
                : t
            ));
            setSelectedTaskDetail(prev => prev ? {
              ...prev,
              scheduledAt: confirmedAt,
              confirmedAt, confirmedDate: dateStr, confirmedTime: timeStr,
              status: newStatus,
              state: newStatus === '확정' ? 'scheduled' : 'waiting',
              schedule: confirmedAt, time: timeStr,
            } : prev);
            addToast({ type: "schedule_change", title: "✓ 일정 변경됨", message: `${tk.customer || ""} · ${confirmedAt}` });
            addNotification({
              type: "schedule_changed",
              title: "일정 변경",
              message: tk.customer || "",
              subInfo: confirmedAt,
              taskId: tk.id,
            });
            // 2026-05-19 Phase 5 Step 0.C-4 — 변경 이력 audit log
            insertTaskChange({
              taskId:        tk.id,
              changeType:    "schedule",
              before:        { scheduledAt: tk.scheduledAt || null, status: tk.status || null },
              after:         { scheduledAt: confirmedAt, status: newStatus },
              note:          null,
              changedBy:     user?.user_id || user?.id || null,
              changedByName: user?.name || null,
            });
          } catch (e) {
            console.error('[V14 2B-2] 일정 에러:', e);
            alert(`일정 변경 에러: ${e.message || '실패'}`);
          }
        }}
        // V14 2B-2 — 상태 변경 (작업중 / 완료 / 등)
        onStatusChange={async (newStatus) => {
          const tk = selectedTaskDetail;
          if (!tk?.id || !newStatus) return;
          try {
            console.log('[V14 2B-2] updateTask 상태', { taskId: tk.id, status: newStatus });
            const res = await apiUpdateTask(tk.id, { status: newStatus });
            if (!res || res.ok === false) {
              alert(`상태 변경 실패: ${(res && res.error) || '실패'}`);
              return;
            }
            const stateMap = {
              '작업중': 'active', '진행중': 'active',
              '완료': 'done', '정산완료': 'done',
              '확정': 'scheduled',
              '미배정': 'waiting',
            };
            setApiTasks(prev => prev.map(t =>
              t.id === tk.id ? { ...t, status: newStatus, state: stateMap[newStatus] || t.state } : t
            ));
            setSelectedTaskDetail(prev => prev ? {
              ...prev, status: newStatus, state: stateMap[newStatus] || prev.state
            } : prev);
            addToast({ type: "status_change", title: `✓ ${newStatus}`, message: tk.customer || "" });
            // 2026-05-19 Phase 5 Step 0.C-4 — 변경 이력 audit log
            insertTaskChange({
              taskId:        tk.id,
              changeType:    "status",
              before:        { status: tk.status || null },
              after:         { status: newStatus },
              note:          null,
              changedBy:     user?.user_id || user?.id || null,
              changedByName: user?.name || null,
            });
          } catch (e) {
            console.error('[V14 2B-2] 상태 에러:', e);
            alert(`상태 변경 에러: ${e.message || '실패'}`);
          }
        }}
        // V14 2B-2 — 메모 변경
        onMemoUpdate={async (newMemo) => {
          const tk = selectedTaskDetail;
          if (!tk?.id) return;
          try {
            console.log('[V14 2B-2] updateTask 메모', { taskId: tk.id, memo: newMemo });
            const res = await apiUpdateTask(tk.id, { memo: newMemo, 작업메모: newMemo });
            if (!res || res.ok === false) {
              alert(`메모 변경 실패: ${(res && res.error) || '실패'}`);
              return;
            }
            setApiTasks(prev => prev.map(t =>
              t.id === tk.id ? { ...t, memo: newMemo, 작업메모: newMemo } : t
            ));
            setSelectedTaskDetail(prev => prev ? { ...prev, memo: newMemo } : prev);
            addToast({ type: "memo", title: "✓ 메모 저장됨", message: tk.customer || "" });
          } catch (e) {
            console.error('[V14 2B-2] 메모 에러:', e);
            alert(`메모 에러: ${e.message || '실패'}`);
          }
        }}
        user={user}
      />
    </Shell>;
  }
  if (screen === "recommend") {
    return <Shell t={t} toasts={toasts}>
      <RecommendScreen
        t={t}
        task={selectedTask}
        onBack={goBack}
        assigning={assigning}
        assignError={assignError}
        apiEngineers={apiEngineers}
        onAssign={async (eng) => {
          // V14 2B-3 — 진짜 assignEngineer API (시트 Q 배정기사 + R 상태 박힘)
          // V14 속도 Phase 1 — Optimistic Update / fetchTasks 박지 X / apiTasks 직접 update
          // V14 재배정 처리 — 옛 기사가 있으면 별도 흐름 (N + R 변경 X / '약속대기' 적용)
          if (!selectedTask?.id || !eng?.name) {
            addToast({ type: "completed", title: "배정 실패", message: "작업 또는 프로 정보 없음" });
            return;
          }
          // V14 재배정 처리 — 옛 기사가 있는지 확인
          const oldEngineer = selectedTask.assignedEngineer || selectedTask.engineer || "";
          const isReassignment = !!oldEngineer && oldEngineer !== eng.name;
          // 2026-05-19 Phase 5 Step 0.C-5-a — 기사 변경 사유 (재배정만 prompt / 신규 배정은 X)
          let assignReason = null;
          if (isReassignment) {
            assignReason = window.prompt(`기사 변경 사유 (${oldEngineer} → ${eng.name}):`, "");
            if (assignReason === null) return; // 사용자 취소
          }
          setAssigning(true);
          setAssignError("");
          try {
            // V14 재배정 — apiUpdateTask 호출 (Q + N catch X + R='약속대기' 한 번에)
            if (isReassignment) {
              console.log('[V14 재배정]', { taskId: selectedTask.id, oldEngineer, newEngineer: eng.name });
              const res = await apiUpdateTask(selectedTask.id, {
                assignedEngineer: eng.name,
                // V14 헌법 — 새 기사가 새 일정 입력 (옛 N 보존 X)
                scheduledAt: "",
                confirmedAt: "",
                confirmedDate: "",
                confirmedTime: "",
                status: "미배정",
              });
              if (!res || res.ok === false) {
                setAssignError((res && res.error) || '재배정 실패');
                return;
              }
              // V14 재배정 — Optimistic Update
              setApiTasks(prev => prev.map(t =>
                t.id === selectedTask.id
                  ? {
                      ...t,
                      assignedEngineer: eng.name, engineer: eng.name, 배정기사: eng.name,
                      scheduledAt: "", confirmedAt: "", 확정일시: "",
                      schedule: "협의", time: "협의",
                      status: '미배정', 상태: '미배정', state: 'waiting',
                    }
                  : t
              ));
              setSelectedTask(prev => prev ? {
                ...prev,
                assignedEngineer: eng.name, engineer: eng.name,
                scheduledAt: "", confirmedAt: "",
                schedule: "협의", time: "협의",
                status: '미배정', state: 'waiting',
              } : prev);
              // V14 — 작업 상세 화면 (selectedTaskDetail) 도 동기화 ⭐
              setSelectedTaskDetail(prev => prev ? {
                ...prev,
                assignedEngineer: eng.name, engineer: eng.name,
                배정기사: eng.name,
                scheduledAt: "", confirmedAt: "", 확정일시: "",
                schedule: "협의", time: "협의",
                status: '미배정', 상태: '미배정', state: 'waiting',
              } : prev);
              updateReception(selectedTask.id, {
                acceptedEngineer: eng.name,
                engineerId: eng.id || eng.engineerId,
                engineer: eng.name, assignedEngineer: eng.name,
                scheduledAt: "", confirmedAt: "",
                status: "미배정", state: "waiting",
                reassignedAt: new Date().toISOString(),
              });
              invalidateRecommendCache();
              addNotification({
                type: "reassignment",
                title: "프로 재배정",
                message: `${selectedTask?.customer || ""} (${selectedTask?.workType || ""})`,
                subInfo: `${oldEngineer} → ${eng.name} (일정 협의 필요)`,
                taskId: selectedTask?.id,
              });
              addToast({
                type: "reassignment",
                title: "✓ 재배정 완료",
                message: `${eng.name} 프로 / 일정 협의 필요`,
              });
              // 2026-05-19 Phase 5 Step 0.C-5-a — 변경 이력 audit log (재배정)
              insertTaskChange({
                taskId:        selectedTask.id,
                changeType:    "engineer",
                before:        { engineerName: oldEngineer || null },
                after:         { engineerName: eng.name, engineerId: eng.id || null },
                note:          assignReason || null,
                changedBy:     user?.user_id || user?.id || null,
                changedByName: user?.name || null,
              });
              setScreen("taskDetail");
              return;
            }

            // V14 새 배정 — assignEngineer 호출
            console.log('[V14 2B-3] assignEngineer', { taskId: selectedTask.id, engineerName: eng.name });
            const res = await apiAssignEngineer(selectedTask.id, eng.name);
            console.log('[V14 2B-3] 응답:', res);
            if (!res || res.ok === false) {
              setAssignError((res && res.error) || '배정 실패');
              return;
            }

            // 2026-05-15 Path B — 배정된 기사 1명에게 push 박기
            // 세척 = workflow="manual_with_recommendation" (수동 배정)
            // Migration 014 trigger가 push_candidates UPDATE 감지 → 자동 발송
            // push 실패해도 배정 자체는 OK (try/catch + log)
            if (eng?.id) {
              try {
                const { error: pushErr } = await supabase
                  .from('tasks')
                  .update({ push_candidates: [eng.id] })
                  .eq('id', selectedTask.id);
                if (pushErr) console.error('[Path B push]', pushErr);
              } catch (err) {
                console.error('[Path B push]', err);
              }
            }

            // [1-1] V14 속도 — apiTasks state 직접 update (즉시 UI 반영)
            // 2026-05-10 명세 — assignEngineer 후 R열="배정" (확정은 기사가 일정 박은 후)
            // 2026-05-10 hotfix — Optimistic 마킹 (_optimisticUntil) 추가 / 60초간 polling 덮어씀 방지
            // 2026-05-10 hotfix — 60초 → 5분 (300초) 보호 강화 / GAS R열 갱신 지연 catch
            const optimisticUntil = Date.now() + 300000;
            setApiTasks(prev => {
              const next = prev.map(t =>
                t.id === selectedTask.id
                  ? {
                      ...t,
                      _optimisticUntil: optimisticUntil,
                      assignedEngineer: eng.name,
                      engineer: eng.name,
                      배정기사: eng.name,
                      status: '배정',
                      상태: '배정',
                      state: 'scheduled',
                    }
                  : t
              );
              return next;
            });

            // [1-2] V14 속도 — selectedTask도 즉시 update (작업 상세 진입 시 즉시 반영)
            setSelectedTask(prev => prev ? {
              ...prev,
              assignedEngineer: eng.name,
              engineer: eng.name,
              status: '배정',
              state: 'scheduled',
            } : prev);
            // V14 — 작업 상세 화면 (selectedTaskDetail) 도 동기화 ⭐
            setSelectedTaskDetail(prev => prev ? {
              ...prev,
              assignedEngineer: eng.name, engineer: eng.name,
              배정기사: eng.name,
              status: '배정', 상태: '배정', state: 'scheduled',
            } : prev);

            // 옛 mock state 호환 (extraReceptions 사용 시)
            updateReception(selectedTask.id, {
              autoAssignStatus: "accepted",
              acceptedEngineer: eng.name,
              engineerId: eng.id || eng.engineerId,
              engineer: eng.name,
              assignedEngineer: eng.name,
              status: "배정",
              state: "scheduled",
              assignedAt: new Date().toISOString(),
            });

            // 추천 cache invalidate (배정된 기사 다음 추천에서 제외)
            invalidateRecommendCache();

            addNotification({
              type: "assignment",
              title: "프로 배정",
              message: `${selectedTask?.customer || ""} (${selectedTask?.workType || ""})`,
              subInfo: `${eng.name} 배정 완료`,
              taskId: selectedTask?.id,
            });
            addToast({ type: "assignment", title: "✓ 배정 완료", message: `${eng.name} 프로` });

            // 2026-05-19 Phase 5 Step 0.C-5-a — 변경 이력 audit log (신규 배정)
            insertTaskChange({
              taskId:        selectedTask.id,
              changeType:    "engineer",
              before:        { engineerName: oldEngineer || null },
              after:         { engineerName: eng.name, engineerId: eng.id || null },
              note:          null,  // 신규 배정은 사유 X
              changedBy:     user?.user_id || user?.id || null,
              changedByName: user?.name || null,
            });

            // [1-3] fetchTasks() 호출 X — Optimistic만 적용 (5~7초 lag 방지)
            // 다음 mount 시 자동 fetch / 또는 사용자가 새로고침 시

            // V14 Phase 2.5 — replaceScreen 사용 (recommend → newReception / stack 중복 방지)
            replaceScreen("newReception");
          } catch (e) {
            console.error('[V14 2B-3] 배정 에러:', e);
            setAssignError(e.message || '배정 실패');
          } finally {
            // 2026-05-10 fix — 모든 분기에서 setAssigning(false) 보장 (무한 로딩 방지)
            setAssigning(false);
          }
        }}
        onEngineerCardClick={(eng) => goEngineerDay(eng, "recommend")}
      />
    </Shell>;
  }
  if (screen === "autoAssign") {
    return <Shell t={t} toasts={toasts}>
      <AutoAssignScreen
        t={t}
        task={selectedTask}
        apiEngineers={apiEngineers}
        onBack={goBack}
        onComplete={async (eng) => {
          // V14 — apiAssignEngineer 호출 (시트 Q + R='확정' 박힘)
          console.log('[V14 AutoAssign] apiAssignEngineer', { taskId: selectedTask?.id, engineerName: eng.name });
          try {
            const res = await apiAssignEngineer(selectedTask?.id, eng.name);
            console.log('[V14 AutoAssign] apiAssignEngineer 응답:', res);
            if (!res || res.ok === false) {
              addToast({ type: "completed", title: "배정 실패", message: (res && res.error) || "시트 갱신 실패" });
              return;
            }
          } catch (e) {
            console.error('[V14 AutoAssign] apiAssignEngineer 에러:', e);
            addToast({ type: "completed", title: "배정 실패", message: e.message || "네트워크 오류" });
            return;
          }
          // 2026-05-22 — 강제 배정 / 전체 기사 검색 흐름 측 push_candidates UPDATE 추가.
          // Path B 측 동일 패턴 — Migration 014 trigger 발화 → 배정 기사에게 푸시 알림.
          // 알림 실패해도 배정 자체는 OK (try/catch + log).
          if (selectedTask?.id && eng?.id) {
            try {
              const { error: pushErr } = await supabase
                .from('tasks')
                .update({ push_candidates: [eng.id] })
                .eq('id', selectedTask.id);
              if (pushErr) console.error('[AutoAssign 강제배정 push]', pushErr);
            } catch (err) {
              console.error('[AutoAssign 강제배정 push]', err);
            }
          }
          // Step 5-3 v3 — task 카드 상태 업데이트 (pushing → accepted) + 새 접수 리스트로 복귀
          updateReception(selectedTask?.id, {
            autoAssignStatus: "accepted",
            acceptedEngineer: eng.name,
          });
          addNotification({
            type: "assignment",
            title: "자동 배정 완료",
            message: `${selectedTask?.customer || ""} (${selectedTask?.workType || ""})`,
            subInfo: `${eng.name} 자동 수락`,
            taskId: selectedTask?.id,
          });
          addToast({ type: "assignment", title: "자동 배정", message: `${eng.name} 프로 수락` });
          // status 분리 운영 (옵션 🅑):
          //   자동 배정도 일단 status="배정" (기사 통화 후 [✓ 일정 확정]에서 "확정"으로 전환)
          //   세척 측 Optimistic(line 2553)과 동일 패턴
          if (selectedTask?.id && eng?.name) {
            setApiTasks(prev => prev.map(t =>
              t.id === selectedTask.id
                ? {
                    ...t,
                    assignedEngineer: eng.name,
                    engineer: eng.name,
                    배정기사: eng.name,
                    status: '배정',
                    상태: '배정',
                    state: 'scheduled',
                    engineerPhone: eng.phone || getEngineerPhone(eng.name),
                  }
                : t
            ));
          }
          fetchTasks();  // V14 — 시트 갱신 catch (background)
          // V14 Phase 2.5 — replaceScreen 박기 (autoAssign → newReception / stack 중복 X)
          replaceScreen("newReception");
          setSelectedTask(null);
        }}
        onFallbackManual={() => setScreen("recommend")}
      />
    </Shell>;
  }
  if (screen === "assignedList") {
    return <Shell t={t} toasts={toasts}>
      <AssignedTasksScreen
        t={t}
        filter={assignedFilter}
        apiTasks={apiTasks}
        onBack={() => { goBack(); setAssignedFilter(null); }}
        onMemo={(task) => { setSelectedTask(task); setScreen("memoAdd"); }}
        onEdit={(task) => { setSelectedTask(task); setScreen("taskEdit"); }}
        onTaskClick={(task) => goTaskDetail(task, "assignedList")}
      />
    </Shell>;
  }
  if (screen === "inProgressList") {
    return <Shell t={t} toasts={toasts}>
      <InProgressListScreen
        t={t}
        onBack={goBack}
        apiTasks={apiTasks}
        onTaskClick={(task) => goTaskDetail(task, "inProgressList")}
      />
    </Shell>;
  }
  if (screen === "settlement") {
    return <Shell t={t} toasts={toasts}>
      <SettlementDailyClose
        onBack={goBack}
        onClickPrincipalSettlement={() => setScreen("principal_settlement")}
      />
    </Shell>;
  }
  // 2026-05-22 — 입금 내역 (회사 송금 통장 내역, 조회 전용)
  if (screen === "settlementHistory") {
    return <Shell t={t} toasts={toasts}>
      <SettlementHistoryContent
        t={t}
        apiTasks={apiTasks}
        onBack={goBack}
        onTaskClick={(task) => goTaskDetail(task, null)}
      />
    </Shell>;
  }
  if (screen === "principal_settlement") {
    return <Shell t={t} toasts={toasts}>
      <PrincipalSettlementScreen onBack={goBack}/>
    </Shell>;
  }
  // Step 6 — 기사 관리 (리스트 + 편집/추가)
  if (screen === "engineerList") {
    return <Shell t={t} toasts={toasts}>
      <EngineerListScreen
        onBack={goBack}
        onAdd={() => {
          setEditingEngineer(createEmptyEngineer());
          setEditingIsNew(true);
          setScreen("engineerEdit");
        }}
        onEdit={(eng) => {
          setEditingEngineer(eng);
          setEditingIsNew(false);
          setScreen("engineerEdit");
        }}
        onClickRegions={() => setScreen("regionList")}
      />
    </Shell>;
  }
  if (screen === "engineerEdit" && editingEngineer) {
    return <Shell t={t} toasts={toasts}>
      <EngineerEditScreen
        engineer={editingEngineer}
        isNew={editingIsNew}
        onBack={() => {
          setEditingEngineer(null);
          setEditingIsNew(false);
          goBack();
        }}
        onSaved={(saved) => {
          // saved === null → 삭제
          addToast({
            type: "assignment",
            title: saved === null ? "프로 삭제" : (editingIsNew ? "프로 추가" : "프로 저장"),
            message: editingEngineer.name || "—",
          });
          setEditingEngineer(null);
          setEditingIsNew(false);
          goBack();
        }}
      />
    </Shell>;
  }
  // Step 8 — 지역 관리 (리스트 + 편집/추가)
  if (screen === "regionList") {
    return <Shell t={t} toasts={toasts}>
      <RegionListScreen
        onBack={goBack}
        onAdd={() => {
          setEditingRegion(createEmptyRegion());
          setEditingRegionIsNew(true);
          setScreen("regionEdit");
        }}
        onEdit={(r) => {
          setEditingRegion(r);
          setEditingRegionIsNew(false);
          setScreen("regionEdit");
        }}
      />
    </Shell>;
  }
  if (screen === "regionEdit" && editingRegion) {
    return <Shell t={t} toasts={toasts}>
      <RegionEditScreen
        region={editingRegion}
        isNew={editingRegionIsNew}
        onBack={() => {
          setEditingRegion(null);
          setEditingRegionIsNew(false);
          goBack();
        }}
        onSaved={(saved) => {
          addToast({
            type: "assignment",
            title: saved === null ? "지역 삭제" : (editingRegionIsNew ? "지역 추가" : "지역 저장"),
            message: editingRegion.name || "—",
          });
          setEditingRegion(null);
          setEditingRegionIsNew(false);
          goBack();
        }}
      />
    </Shell>;
  }
  // Step 9 — 통합 설정
  if (screen === "settings") {
    return <Shell t={t} toasts={toasts}>
      <SettingsScreen
        user={user}
        themeMode={mode}
        onBack={goBack}
        onLogout={onLogout}
        onPrincipals={() => setScreen("principalList")}
        onEngineers={() => setScreen("engineerList")}
        onRates={() => setScreen("ratesManagement")}
        onRegions={() => setScreen("regionList")}
        onUsers={() => setScreen("userList")}
        onCompanyAccount={() => setScreen("companyAccount")}
        onNotifications={() => setScreen("notificationSettings")}
        onBackup={() => addToast({ type: "assignment", title: "백업 / 복원", message: "준비 중인 기능입니다" })}
        onUsolN={(menuId) => setScreen(menuId)}
        onSettlement={() => setScreen("settlement")}
        onPrincipalSettlement={() => setScreen("principal_settlement")}
        onCommissionPolicy={() => setScreen("commissionPolicy")}
        onToggleTheme={() => setMode(mode === "dark" ? "light" : "dark")}
      />
    </Shell>;
  }
  // Phase 2 — 수수료정책 관리 (admin/owner/operator)
  if (screen === "commissionPolicy") {
    return <Shell t={t} toasts={toasts}>
      <CommissionPolicyManagement user={user} onBack={goBack}/>
    </Shell>;
  }
  // V11-2-fix — 유솔 N 워크스페이스 (단일 라우트, 5탭 컨테이너 내부)
  // 2026-05-19 Phase 5 Step 0.B — onTaskClick prop drilling (Supabase row → v14 정규화 → AdminTaskDetailScreen)
  if (screen === "usol_n") {
    return <Shell t={t} toasts={toasts}>
      <UsolNScreen
        user={user}
        onBack={goBack}
        onTaskClick={(task) => {
          // UsolNScreen task = Supabase raw row (customer_name / district 측 snake_case)
          // _v14NormalizeTask는 customer / region 키 측 fallback이라 추가 별칭 매핑
          const adapted = {
            ...task,
            customer:  task.customer_name || task.customer,
            region:    task.district      || task.region,
            principal: "usol_n",  // AdminTaskDetailScreen 측 정산 사이클 섹션 조건 분기
          };
          goTaskDetail(_v14NormalizeTask(adapted), "usol_n");
        }}
      />
    </Shell>;
  }
  if (screen === "userList") {
    return <Shell t={t} toasts={toasts}>
      <UserListScreen
        onBack={goBack}
        onAdd={() => {
          setEditingUser(createEmptyUser());
          setEditingUserIsNew(true);
          setScreen("userEdit");
        }}
        onEdit={(u) => {
          setEditingUser(u);
          setEditingUserIsNew(false);
          setScreen("userEdit");
        }}
      />
    </Shell>;
  }
  if (screen === "userEdit" && editingUser) {
    return <Shell t={t} toasts={toasts}>
      <UserEditScreen
        user={editingUser}
        isNew={editingUserIsNew}
        onBack={() => {
          setEditingUser(null);
          setEditingUserIsNew(false);
          goBack();
        }}
        onSaved={(saved) => {
          addToast({
            type: "assignment",
            title: saved === null ? "사용자 삭제" : (editingUserIsNew ? "사용자 추가" : "사용자 저장"),
            message: editingUser.name || "—",
          });
          setEditingUser(null);
          setEditingUserIsNew(false);
          goBack();
        }}
      />
    </Shell>;
  }
  if (screen === "notificationSettings") {
    return <Shell t={t} toasts={toasts}>
   <NotiSettingsScreen user={user} onBack={goBack}/>
    </Shell>;
  }
  // Step 5-8 F-4 — 회사 계좌 관리 (운영자/관리자만 / PERMISSIONS["menu.company_account"])
  if (screen === "companyAccount") {
    return <Shell t={t} toasts={toasts}>
      <CompanyAccountScreen onBack={goBack}/>
    </Shell>;
  }
  // Step 7 — 원청 관리 (리스트 + 편집/추가 + 유솔 N CSV 업로드)
  if (screen === "principalList") {
    return <Shell t={t} toasts={toasts}>
      <PrincipalListScreen
        onBack={goBack}
        onAdd={() => {
          setEditingPrincipal(createEmptyPrincipal());
          setEditingPrincipalIsNew(true);
          setScreen("principalEdit");
        }}
        onEdit={(p) => {
          setEditingPrincipal(p);
          setEditingPrincipalIsNew(false);
          setScreen("principalEdit");
        }}
        onClickRates={() => setScreen("ratesManagement")}
      />
    </Shell>;
  }
  if (screen === "ratesManagement") {
    return <Shell t={t} toasts={toasts}>
      <RatesManagementScreen
        onBack={goBack}
      />
    </Shell>;
  }
  if (screen === "naverUpload") {
    return <Shell t={t} toasts={toasts}>
      <NaverUploadScreen
        onBack={goBack}
        onComplete={async (orders) => {
          // 2026-05-23 — DB 일괄 INSERT (옛 extraReceptions in-memory 제거)
          //   bulkInsertUsolNOrders 측 tasks + task_items 측 DB INSERT
          //   중복 orderId 측 skip / 이상값 측 warnings 분류
          const res = await bulkInsertUsolNOrders(orders);
          if (!res || res.ok === false) {
            addToast({
              type: "completed",
              title: "유솔 N 업로드 실패",
              message: res?.error || "알 수 없는 오류",
            });
            return;
          }
          // 결과 토스트 — 등록 / 중복 / 경고 / 에러 종합
          // 2026-05-23 진단용 — errors 측 첫 번째 메시지 측 토스트 측 표시 (사장님 측 콘솔 안 봐도 catch 가능)
          const parts = [];
          if (res.inserted > 0) parts.push(`${res.inserted}건 등록`);
          if (res.skipped  > 0) parts.push(`${res.skipped}건 중복 건너뜀`);
          if (res.warnings?.length > 0) parts.push(`경고 ${res.warnings.length}건`);
          if (res.errors?.length   > 0) parts.push(`❌ 실패 ${res.errors.length}건`);
          const firstError = res.errors?.[0];
          const errorDetail = firstError
            ? ` | 첫 에러: ${firstError.error || "알 수 없음"}${firstError.code ? ` (${firstError.code})` : ""}${firstError.details ? ` — ${firstError.details}` : ""}`
            : "";
          addToast({
            type: res.errors?.length > 0 ? "completed" : "new_reception",
            title: res.errors?.length > 0 ? "유솔 N 업로드 — 실패 발생" : "유솔 N 업로드 완료",
            message: (parts.join(" · ") || "변경 없음") + errorDetail,
          });
          addNotification({
            type: "new_reception",
            title: "유솔 N 업로드",
            message: `${res.inserted}건 등록 · ${res.skipped}건 중복`,
            subInfo: res.warnings?.length > 0
              ? `⚠️ 서비스종류 이상값 ${res.warnings.length}건 — 운영자 확인 필요`
              : "CSV 업로드",
          });
          // 경고 항목 측 콘솔 측 자세히 출력 (운영자 디버그)
          if (res.warnings?.length > 0) {
            console.warn("[유솔 N 업로드 경고]", res.warnings);
          }
          if (res.errors?.length > 0) {
            console.error("[유솔 N 업로드 에러]", res.errors);
          }
          // DB INSERT 후 fetchTasks 측 새로고침 (extraReceptions 측 안 씀)
          if (typeof fetchTasks === "function") fetchTasks();
          replaceScreen("newReception");
          setNewReceptionFilter(null);
        }}
      />
    </Shell>;
  }
  if (screen === "principalEdit" && editingPrincipal) {
    return <Shell t={t} toasts={toasts}>
      <PrincipalEditScreen
        principal={editingPrincipal}
        isNew={editingPrincipalIsNew}
        onGoCommissionPolicy={() => setScreen("commissionPolicy")}
        onBack={() => {
          setEditingPrincipal(null);
          setEditingPrincipalIsNew(false);
          goBack();
        }}
        onSaved={(saved) => {
          addToast({
            type: "assignment",
            title: saved === null ? "원청 삭제" : (editingPrincipalIsNew ? "원청 추가" : "원청 저장"),
            message: editingPrincipal.name || "—",
          });
          setEditingPrincipal(null);
          setEditingPrincipalIsNew(false);
          goBack();
        }}
      />
    </Shell>;
  }

  // 메인 대시보드
  return <Shell t={t} toasts={toasts}>
    <DashboardScreen
      t={t} mode={mode} setMode={setMode}
      onLogout={onLogout}
      user={user}
      dynamicStats={dynamicStats}
      apiTasks={apiTasks}
      apiEngineers={apiEngineers}
      onRefreshTasks={fetchTasks}
      activeTab={dashboardActiveTab}
      setActiveTab={setDashboardActiveTab}
      unreadCount={unreadCount}
      onClickBell={() => setScreen("notifications")}
      onClickAddReception={() => setScreen("newReceptionForm")}
      onClickNewReception={(filter) => { setNewReceptionFilter(filter || null); setScreen("newReception"); }}
      onClickAssignedList={(filter) => { setAssignedFilter(filter); setScreen("assignedList"); }}
      onClickLiveWork={(filter) => { setLiveWorkFilter(filter || null); setScreen("liveWork"); }}
      onClickInProgress={() => setScreen("inProgressList")}
      onClickSettlement={() => setScreen("settlement")}
      onClickManage={() => setScreen("engineerList")}
      onClickManagePrincipals={() => setScreen("principalList")}
      onClickSettlementHistory={() => setScreen("settlementHistory")}
      onClickSettings={() => setScreen("settings")}
      onClickUsolN={() => setScreen("usol_n")}
      onClickUrgentAssign={() => { setSelectedTask(URGENT_TASK); setScreen("recommend"); }}
      onEngineerClick={(eng) => goEngineerDay(eng, null)}
      onTaskClick={(task) => goTaskDetail(task, null)}
      onClickCancelHandle={(task) => setCancelHandleTask(task)}
    />

    {/* V14 큰 흐름 — 취소 요청 처리 모달 */}
    {cancelHandleTask && (
      <V14AdminModal onClose={() => { setCancelHandleTask(null); setCancelRejectReason(""); }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 8, color: t.text }}>🚨 취소 요청 처리</h3>
        <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 8 }}>
          {cancelHandleTask.principal} · {cancelHandleTask.customer}
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 12 }}>
          {cancelHandleTask.address}
        </div>
        <div style={{ background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>프로 요청 사유</div>
          <div style={{ fontSize: 12, color: t.text, lineHeight: 1.5 }}>{cancelHandleTask.memo || "(사유 없음)"}</div>
        </div>
        <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, display: "block", marginBottom: 4 }}>거절 사유 (거절 시 입력)</label>
        <textarea
          value={cancelRejectReason}
          onChange={(e) => setCancelRejectReason(e.target.value)}
          placeholder="예: 고객 직접 확인 / 다른 프로 배정"
          style={{ width: "100%", minHeight: 60, padding: 10, borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", background: t.bgInset, color: t.text }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            onClick={handleApproveCancel}
            style={{ flex: 1, padding: 12, background: "#FF3B5C", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
          >✓ 확인 (취소 처리)</button>
          <button
            disabled={!cancelRejectReason.trim()}
            onClick={handleRejectCancel}
            style={{ flex: 1, padding: 12, background: cancelRejectReason.trim() ? "#888" : "#ccc", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: cancelRejectReason.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}
          >✗ 거절</button>
        </div>
      </V14AdminModal>
    )}
  </Shell>;
}

// V14 — Admin 모달 wrapper (재사용)
function V14AdminModal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-primary, #fff)", color: "var(--text-primary, #1A1A1A)",
          borderRadius: 14, padding: 18,
          width: "100%", maxWidth: 380,
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          fontFamily: "'Pretendard', -apple-system, sans-serif",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================
// 시안 4-V4 — 메인 대시보드
// ============================================

function DashboardScreen({ t, mode, setMode, onLogout, user, dynamicStats, apiTasks = [], apiEngineers = [], onRefreshTasks, activeTab, setActiveTab, unreadCount, onClickBell, onClickAddReception, onClickNewReception, onClickAssignedList, onClickLiveWork, onClickInProgress, onClickSettlement, onClickUrgentAssign, onClickManage, onClickManagePrincipals, onClickSettlementHistory, onClickSettings, onClickUsolN, onEngineerClick, onTaskClick, onClickCancelHandle }) {
  // V14 — 새 접수 카운트 = dynamicStats.new (status='미배정'/'약속대기' 인 작업)
  const totalNew = dynamicStats?.new ?? 0;

  return (
    <div className="fade-in">
      {/* 상단 헤더 — 올잇 마크 + 메타 + 테마 토글 + 로그아웃 */}
      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "var(--bg-primary)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${t.border}`, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <OllitMark size={20} color={t.accent}/>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text, letterSpacing: -0.2 }}>올잇</span>
          <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>· 현장과 사람을 잇는</span>
          <div style={{ flex: 1 }}/>
          {Object.entries(THEMES).map(([key, theme]) => {
            const Icon = theme.icon;
            return (
              <button key={key} onClick={() => setMode(key)} style={{
                padding: "5px 8px",
                background: mode === key ? t.bgElevated : "transparent",
                border: mode === key ? `1px solid ${t.accent}` : `1px solid ${t.border}`,
                borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "system-ui",
                color: mode === key ? t.text : t.textMuted,
                display: "flex", alignItems: "center", gap: 3,
              }}><Icon size={11}/></button>
            );
          })}
          <button onClick={onClickBell} style={{
            position: "relative",
            padding: "5px 8px", background: "transparent",
            border: `1px solid ${t.border}`, borderRadius: 7,
            color: unreadCount > 0 ? t.accent : t.textMuted,
            cursor: "pointer", fontFamily: "system-ui",
            display: "flex", alignItems: "center",
          }}>
            <Bell size={11}/>
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -4,
                minWidth: 14, height: 14, padding: "0 3px",
                background: t.accent, color: "white",
                fontSize: 9, fontWeight: 800, lineHeight: "14px",
                borderRadius: 7, textAlign: "center",
                fontFamily: "system-ui",
              }}>{unreadCount}</span>
            )}
          </button>
          <button onClick={onClickSettings} title="설정" style={{ padding: "5px 8px", background: "transparent", border: `1px solid ${t.border}`, borderRadius: 7, color: t.textMuted, fontSize: 10, cursor: "pointer", fontFamily: "system-ui" }}>
            <Settings size={11}/>
          </button>
        </div>
      </div>

      <div style={{ padding: "20px 16px 0" }}>
        {/* 1. 인사말 */}
        <div style={{ marginBottom: 20 }}>
          <div className="mono" style={{ fontSize: 10, color: t.textMuted, letterSpacing: 2, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>
            {TODAY} · {NOW}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            안녕하세요 <span style={{ color: t.accent }}>{user?.name || ADMIN_USER}</span>님
          </div>
        </div>

        {/* 2. 작업 통계 — 핫핑크 = 새 접수 + 진행중 (사장님 KPI) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5, marginBottom: 14 }}>
          <StatBox t={t} label="새 접수" value={dynamicStats?.new        ?? TODAY_STATS.newReceived} color={t.accent}  onClick={() => onClickNewReception(null)}/>
          <StatBox t={t} label="배정 완료" value={dynamicStats?.assigned  ?? TODAY_STATS.assigned}    color={t.text}    onClick={() => onClickAssignedList("assigned")}/>
          <StatBox t={t} label="일정 확정" value={dynamicStats?.confirmed ?? TODAY_STATS.confirmed}   color={t.text}    onClick={() => onClickAssignedList("confirmed")}/>
          <StatBox t={t} label="진행중"   value={dynamicStats?.inProgress ?? TODAY_STATS.inProgress}  color={t.accent}  onClick={onClickInProgress}/>
          <StatBox t={t} label="완료"     value={dynamicStats?.completed  ?? TODAY_STATS.completed}   color={t.success} onClick={() => onClickLiveWork("completed-today")}/>
        </div>

        {/* 3. 돈 흐름 — 회사 마진만 핫핑크 (사장님 KPI) / 나머지 무채색 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <MoneyBox t={t} icon={<span style={{ fontSize: 12 }}>💰</span>} label="오늘 매출"     value={dynamicStats?.revenue?.total    ?? TODAY_STATS.revenue}      color={t.text}/>
          {dynamicStats?.revenue?.margin !== undefined && (
            <MoneyBox t={t} icon={<TrendingUp size={12}/>} label="회사 마진"     value={dynamicStats.revenue.margin}                                color={t.accent}/>
          )}
          {dynamicStats?.revenue?.margin === undefined && (
            <MoneyBox t={t} icon={<TrendingUp size={12}/>} label="회사 마진"     value={TODAY_STATS.myMargin}                                       color={t.accent}/>
          )}
          <MoneyBox t={t} icon={<span style={{ fontSize: 12 }}>👷</span>} label="프로 정산"          value={dynamicStats?.revenue?.engineer  ?? TODAY_STATS.engineerNet}  color={t.text}/>
          <MoneyBox t={t} icon={<span style={{ fontSize: 12 }}>🤝</span>} label="원청 수수료"        value={dynamicStats?.revenue?.principal ?? TODAY_STATS.principalFee} color={t.text}/>
        </div>

        {/* V14 큰 흐름 — 취소 요청 알림 (status='취소요청' 인 작업) */}
        {(apiTasks || []).filter(t => (t.status || t.상태) === '취소요청').map(task => (
          <div
            key={`cancel-req-${task.id}`}
            onClick={() => onClickCancelHandle && onClickCancelHandle(task)}
            className="clickable"
            style={{
              marginBottom: 12,
              background: "#FEE2E2",
              border: "2px solid #EF4444",
              borderRadius: 12,
              padding: "12px 14px",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>🚨</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#B91C1C", letterSpacing: 0.5 }}>
                취소 요청 접수됨
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#7F1D1D", marginBottom: 2 }}>
                  {task.customer} · {task.principal}
                </div>
                <div style={{ fontSize: 11, color: "#991B1B", lineHeight: 1.4 }}>
                  {task.region} · 사유: {(task.memo || "").slice(0, 40) || "(박지 X)"}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onClickCancelHandle && onClickCancelHandle(task); }}
                style={{
                  padding: "8px 14px", background: "#DC2626", color: "white", border: "none", borderRadius: 8,
                  fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                }}
              >처리</button>
            </div>
          </div>
        ))}

        {/* V14 — 긴급/당일 (apiTasks 사용 / 이지은 시뮬 폐기) */}
        {dynamicStats?.urgentTasks && dynamicStats.urgentTasks.length > 0 && (
          <div onClick={onClickUrgentAssign} className="clickable" style={{
            marginBottom: 16,
            background: t.warningBg,
            border: `1.5px solid ${t.warningBorder}`,
            borderRadius: 12,
            padding: "12px 14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <AlertTriangle size={13} style={{ color: t.warning }}/>
              <span style={{ fontSize: 10, fontWeight: 800, color: t.warning, letterSpacing: 0.5 }}>
                긴급 · 당일 작업 ({dynamicStats.urgentTasks.length}건)
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>
                  {dynamicStats.urgentTasks[0].customer} <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>· {dynamicStats.urgentTasks[0].principal}</span>
                </div>
                <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.5 }}>
                  {dynamicStats.urgentTasks[0].region} · {dynamicStats.urgentTasks[0].appliance || ""} {dynamicStats.urgentTasks[0].qty ? `×${dynamicStats.urgentTasks[0].qty}` : ""} · {dynamicStats.urgentTasks[0].schedule || dynamicStats.urgentTasks[0].time || "협의"}
                </div>
              </div>
              <button style={{
                padding: "8px 14px", background: t.accent, color: "white", border: "none", borderRadius: 8,
                fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
              }}>배정</button>
            </div>
          </div>
        )}
      </div>

      {/* 탭 */}
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 16, paddingBottom: 4 }}>
        <div style={{ padding: "0 16px 12px", display: "flex", gap: 6 }}>
          {["overview", "live", "engineers", "settlement"].map((tab) => {
            const labels = { overview: "개요", live: "작업", engineers: "프로", settlement: "정산" };
            const active = activeTab === tab;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1, padding: "9px 8px",
                background: active ? t.bgElevated : "transparent",
                border: active ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
                borderRadius: 9, fontSize: 11, fontWeight: 700,
                color: active ? t.text : t.textMuted,
                cursor: "pointer", fontFamily: "inherit",
              }}>{labels[tab]}</button>
            );
          })}
        </div>

        {activeTab === "overview"   && <OverviewTab t={t} totalNew={totalNew} apiTasks={apiTasks} onClickNewReception={onClickNewReception} onClickLiveWork={onClickLiveWork} onClickAddReception={onClickAddReception} onClickUsolN={onClickUsolN}/>}
        {activeTab === "live"       && <LiveWorkContent t={t} apiTasks={apiTasks} onTaskClick={onTaskClick}/>}
        {activeTab === "engineers"  && <EngineersTab t={t} apiEngineers={apiEngineers} apiTasks={apiTasks} onEngineerClick={onEngineerClick} onClickManage={onClickManage}/>}
        {activeTab === "settlement" && (
          <div style={{ padding: "0 16px 16px" }}>
            <SettlementContent t={t} apiTasks={apiTasks} user={user} onRefreshTasks={onRefreshTasks} onTaskClick={onTaskClick} onClickSettlementHistory={onClickSettlementHistory}/>
          </div>
        )}
      </div>

    </div>
  );
}

// 시안 4-V4 — 개요 탭 콘텐츠 (5/6/7 부분)
// 2026-05-11 — 옛 6개 카드 (workTypeOrder / workTypeCounts) 제거 / 새 작업 흐름 카드로 통합
function OverviewTab({ t, totalNew, apiTasks = [], onClickNewReception, onClickLiveWork, onClickAddReception, onClickUsolN }) {
  // 2026-05-21 Phase 5 Step 0.H — 작업 흐름 = 세척 / 냉매 2개 카드 (사장님 결정: 기타 제거)
  //   신규 / 배정 / 확정 = TASK_FILTERS 측 동일 (유솔N 본작업 냉매만 / 그 외 유솔N 제외 / 6원청 전부)
  //   진행 / 완료 = TASK_FILTERS 측 동일 (오늘 + 전부 포함)
  //   workType 분류 = 세척 / 냉매 (2개) — 정규식 측 측 측 측 measure 측 측 측 합계 측 측 (의도)
  const workTypeFlowCounts = useMemo(() => {
    const counts = {
      '세척':    { 신규: 0, 배정: 0, 확정: 0, 진행: 0, 완료: 0, 총: 0 },
      '냉매충전':{ 신규: 0, 배정: 0, 확정: 0, 진행: 0, 완료: 0, 총: 0 },
    };

    (apiTasks || []).forEach(task => {
      // workType 분류 — workItems 측 첫 매칭 측 우선 / 매칭 측 측 측 측 측 측 측
      const items = (task.workItems && task.workItems.length > 0)
        ? task.workItems
        : (task.workType ? [{ workType: task.workType }] : []);
      let workType = '';
      for (const item of items) {
        const wt = String(item.workType || "");
        if (/세척/.test(wt))           { workType = '세척'; break; }
        if (/냉매|가스|충전/.test(wt)) { workType = '냉매충전'; break; }
      }
      if (!workType || !counts[workType]) return;

      // 5단계 = TASK_FILTERS 측 동일 기준 적용
      if      (TASK_FILTERS.newReception(task)) { counts[workType]['신규']++; counts[workType]['총']++; }
      else if (TASK_FILTERS.assigned(task))     { counts[workType]['배정']++; counts[workType]['총']++; }
      else if (TASK_FILTERS.confirmed(task))    { counts[workType]['확정']++; counts[workType]['총']++; }
      else if (TASK_FILTERS.inProgress(task))   { counts[workType]['진행']++; counts[workType]['총']++; }
      else if (TASK_FILTERS.completed(task))    { counts[workType]['완료']++; counts[workType]['총']++; }
    });

    return counts;
  }, [apiTasks]);

  // 작업 흐름 카드 한 장 박는 헬퍼 (5단계 그리드)
  const FlowCard = ({ icon, title, flow }) => {
    const stages = [
      { key: '신규', label: '신규', color: t.text },
      { key: '배정', label: '배정', color: t.accent },
      { key: '확정', label: '확정', color: t.text },
      { key: '진행', label: '진행', color: t.warning },
      { key: '완료', label: '완료', color: t.success },
    ];
    return (
      <div style={{
        background: t.bgElevated,
        border: `1px solid ${t.border}`,
        borderRadius: 10, padding: 12, marginBottom: 8,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{icon} {title}</span>
          <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>{flow['총']}건</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, textAlign: "center" }}>
          {stages.map(({ key, label, color }) => {
            const value = flow[key] || 0;
            return (
              <div key={key} style={{
                background: t.bgInset || t.bg,
                padding: '6px 2px',
                borderRadius: 4,
                opacity: value > 0 ? 1 : 0.5,
              }}>
                <div style={{ fontSize: 9, color: t.textMuted, marginBottom: 2 }}>{label}</div>
                <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: value > 0 ? color : t.textMuted }}>{value}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const cleaningFlow    = workTypeFlowCounts['세척'];
  const refrigerantFlow = workTypeFlowCounts['냉매충전'];

  return (
    <div style={{ padding: "0 16px 16px" }}>
      {/* 2026-05-19 Phase 5 Step 0.B — 유솔N 사이클 진입 (단일 경로 / 설정 측 항목 제거) */}
      {onClickUsolN && (
        <button
          onClick={onClickUsolN}
          style={{
            width: "100%",
            padding: "12px 14px",
            background: t.bgElevated,
            border: `1px solid ${t.border}`,
            borderLeft: "3px solid #03C75A",
            borderRadius: 10,
            marginBottom: 14,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontFamily: "inherit",
            color: t.text,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>🟢 유솔N</span>
          <span style={{ fontSize: 16, color: t.textMuted }}>→</span>
        </button>
      )}

      {/* 2026-05-21 Phase 5 Step 0.H — 오늘 작업 흐름 (세척/냉매 2개 카드 / 사장님 결정 — 기타 제거) */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>
            📊 오늘 작업 흐름
          </span>
          <span className="mono" style={{ fontSize: 10, color: t.accent, fontWeight: 700 }}>
            {((cleaningFlow && cleaningFlow['총']) || 0) + ((refrigerantFlow && refrigerantFlow['총']) || 0)}건
          </span>
        </div>
        <FlowCard icon="❄️" title="세척" flow={cleaningFlow    || { 신규: 0, 배정: 0, 확정: 0, 진행: 0, 완료: 0, 총: 0 }}/>
        <FlowCard icon="⚡" title="냉매" flow={refrigerantFlow || { 신규: 0, 배정: 0, 확정: 0, 진행: 0, 완료: 0, 총: 0 }}/>
      </div>

      {/* + 새 접수 등록 (Step 5-1d: placeholder → 실제 폼 연결, FAB 제거) */}
      <button onClick={onClickAddReception} style={{
        width: "100%",
        padding: "14px",
        background: t.accent, color: "white", border: "none", borderRadius: 12,
        fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        <Plus size={16}/>
        <span>새 접수 등록</span>
      </button>
    </div>
  );
}

// 다른 탭 stub
function StubTab({ t, label }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>📋</div>
      <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 4 }}>{label} 탭</div>
      <div style={{ fontSize: 10, color: t.textDim }}>개요 탭에서 핵심 정보를 확인하세요</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 기사 탭 — Step 3-2 정정: 검색 + 자동 그룹 (필터 칩 제거 / 외근→활동중)
// ─────────────────────────────────────────────
function EngineersTab({ t, apiEngineers = [], apiTasks = [], onEngineerClick, onClickManage }) {
  const [search, setSearch] = useState("");

  // 자동 상태 계산 — Step 3-3: 활동중 그룹 분리 (진행중/이동중/외근중 → 별도 그룹)
  const computeStatus = (schedule) => {
    if (!schedule || schedule.length === 0) return { label: "미정", icon: "❓", color: t.textMuted, group: "waiting" };
    if (schedule.length === 1 && schedule[0].type === "off_full") return { label: "종일 휴무", icon: "🏖️", color: t.textMuted, group: "off" };
    const activeExt = schedule.find(s => s.type === "external" && s.state === "active");
    if (activeExt) return { label: "외근중", icon: "🌐", color: t.purple, group: "external" };
    const activeWork = schedule.find(s => s.type === "work" && s.state === "active");
    if (activeWork) return { label: "진행중", icon: "🟢", color: t.success, group: "active" };
    const movingWork = schedule.find(s => s.type === "work" && s.state === "moving");
    if (movingWork) return { label: "이동중", icon: "🟡", color: t.warning, group: "moving" };
    const partialOff = schedule.find(s => s.type === "off_partial");
    if (partialOff) return { label: partialOff.note, icon: "⏰", color: t.warning, group: "waiting" };
    const works = schedule.filter(s => s.type === "work");
    const allDone = works.length > 0 && works.every(s => s.state === "done");
    if (allDone) return { label: "오늘 종료", icon: "✓", color: t.textSecondary, group: "done" };
    return { label: "대기", icon: "⏳", color: t.textSecondary, group: "waiting" };
  };

  // 2026-05-17 Round 2 Fix #10 — apiEngineers (실 DB) + apiTasks (오늘 작업)로
  // engineersWithStatus 합성. apiEngineers가 비어있으면 ENGINEERS_DATA로 fallback
  // (ENABLE_MOCK=true 환경 보존).
  //
  // 2026-05-17 Round 2 Fix #11 — DB에 seed 등록된 29명 중 active 기사만 노출.
  // listEngineersFromDb는 inactive/quit 기사도 모두 반환하기 때문에
  // EngineersTab 진입 시점에 필터링 (다른 화면은 전체 명단이 필요할 수 있어
  // 데이터 레이어가 아니라 이 화면에서만 좁힘). active = is_active true.
  const activeApiEngineers = (apiEngineers || []).filter(
    eng => eng.active === true || eng.status === "active"
  );
  const useApiData = activeApiEngineers.length > 0;
  const todayStr = todayYmd();
  // 오늘 일정 = scheduledDate(또는 scheduledAt 정규화)가 오늘인 작업
  const todayTasks = apiTasks.filter(t => {
    const sched = t.scheduledDate || (t.scheduledAt ? toKstYmd(t.scheduledAt) : "");
    return sched === todayStr;
  });
  const engineersWithStatus = useApiData
    ? activeApiEngineers.map(eng => {
        // engineer 본인 작업 = 이름 매칭(시트 Q열 호환) 또는 engineerId 매칭
        const mySlots = todayTasks
          .filter(task =>
            (eng.name && (task.assignedEngineer === eng.name || task.engineer === eng.name)) ||
            ((eng.engineerId || eng.id) && (task.assignedEngineerId === (eng.engineerId || eng.id) || task.engineerId === (eng.engineerId || eng.id)))
          )
          .map(task => ({
            type: "work",
            state: task.state,
            customer: task.customer,
            workType: task.workType,
            region: task.region,
            note: task.workMemo || task.note || "",
            taskCode: task.taskCode,
            time: task.time,
            principal: task.principal,
            // 2026-05-17 Round 2 Fix #19 — EngineerCard의 "신규 +N" 카운트용
            assignedAt: task.assignedAt || null,
          }));
        return {
          ...eng,
          // 화면 표시용 fallback 필드 (mock은 추가 메타가 있었음)
          region: eng.region || "—",
          todaySchedule: mySlots,
          todayCount: mySlots.length,  // EngineerCard 라인의 "오늘 N건" 표시용
          status: computeStatus(mySlots),
        };
      })
    // 2026-05-17 Round 2 Fix #16 — 옛 ENGINEERS_DATA fallback 차단 (mock 누출 방지).
    // ENABLE_MOCK 토글이 어떤 경로로든 true가 되어도 EngineersTab엔 mock 표시 X.
    // apiEngineers fetch 실패 시 사용자가 빈 화면을 보면 진짜 원인이 표면화됨.
    : [];

  // 검색 (필터 칩 제거)
  const sLower = search.trim().toLowerCase();
  const searched = !sLower ? engineersWithStatus : engineersWithStatus.filter(eng => {
    if (eng.name.toLowerCase().includes(sLower)) return true;
    if (eng.region && eng.region.toLowerCase().includes(sLower)) return true;
    return eng.todaySchedule.some(s =>
      (s.customer && s.customer.toLowerCase().includes(sLower)) ||
      (s.workType && s.workType.toLowerCase().includes(sLower)) ||
      (s.region && s.region.toLowerCase().includes(sLower)) ||
      (s.note && s.note.toLowerCase().includes(sLower))
    );
  });

  // 그룹 자동 묶기 (6 그룹: active / moving / external / waiting / done / off)
  // 2026-05-21 Phase 5 Step 0.H-3 — 대기 그룹 측 측 정렬:
  //   "미정"(오늘 배정 작업 0건 / status.label === "미정")은 측 측
  //   "대기"(작업 있음 / partial off 등)는 측 측
  const grouped = {
    active:   searched.filter(e => e.status.group === "active"),
    moving:   searched.filter(e => e.status.group === "moving"),
    external: searched.filter(e => e.status.group === "external"),
    waiting:  searched.filter(e => e.status.group === "waiting").sort((a, b) => {
      const aUndecided = a.status?.label === "미정";
      const bUndecided = b.status?.label === "미정";
      if (aUndecided && !bUndecided) return 1;
      if (!aUndecided && bUndecided) return -1;
      return 0;
    }),
    done:     searched.filter(e => e.status.group === "done"),
    off:      searched.filter(e => e.status.group === "off"),
  };

  // 그룹 헤더 — 운영자 시각 (활동 우선) + 색깔 매칭
  // Step 5-3 fix — 활동중만 펼침 / 비활동(대기/오늘 종료/휴무) 모두 접힘
  const groupHeaders = [
    { id: "active",   label: "진행중",   icon: "🟢", color: t.success },
    { id: "moving",   label: "이동중",   icon: "🟡", color: t.warning },
    { id: "external", label: "외근중",   icon: "🌐", color: t.purple },
    { id: "waiting",  label: "대기",     icon: "⏳", color: t.textSecondary, defaultCollapsed: true },
    { id: "done",     label: "오늘 종료", icon: "✓",  color: t.textMuted,      defaultCollapsed: true },
    { id: "off",      label: "휴무",     icon: "🏖️", color: t.textMuted,      defaultCollapsed: true },
  ];

  return (
    <div style={{ padding: "0 16px 16px" }}>
      {/* 검색 + Step 6 [관리] 버튼 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}/>
          <input
            type="text"
            placeholder="프로 / 지역 / 작업 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 34px",
              background: t.bgInset, color: t.text,
              border: `1px solid ${t.border}`, borderRadius: 10,
              fontSize: 12, fontFamily: "inherit", outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        {onClickManage && (
          <button
            onClick={onClickManage}
            style={{
              padding: "0 14px",
              background: t.accentBg, border: `1px solid ${t.accent}`,
              borderRadius: 10, color: t.accent,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
            }}
          >관리</button>
        )}
      </div>

      {/* 그룹별 카드 */}
      {searched.length === 0 ? (
        <div style={{ padding: "30px 20px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
          검색 결과 없음
        </div>
      ) : (
        groupHeaders.map(g => {
          const list = grouped[g.id];
          if (!list || list.length === 0) return null;
          return (
            <EngineerGroup key={g.id} t={t}
              icon={g.icon} label={g.label} count={list.length}
              color={g.color}
              defaultCollapsed={g.defaultCollapsed}
              engineers={list}
              onEngineerClick={onEngineerClick}
              onTaskClick={(task, eng) => onEngineerClick && onEngineerClick(eng)}
            />
          );
        })
      )}
    </div>
  );
}

function EngineerGroup({ t, icon, label, count, color, defaultCollapsed, engineers, onEngineerClick, onTaskClick }) {
  const [collapsed, setCollapsed] = useState(!!defaultCollapsed);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const headerColor = color || t.textSecondary;

  function toggleExpand(engineerId) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(engineerId)) next.delete(engineerId);
      else next.add(engineerId);
      return next;
    });
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div onClick={() => setCollapsed(v => !v)} className="clickable" style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "6px 4px", marginBottom: 6,
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: headerColor }}>
          <span style={{ marginRight: 5 }}>{icon}</span>
          {label} <span className="mono" style={{ color: t.accent, marginLeft: 4 }}>{count}명</span>
        </div>
        {collapsed ? <ChevronDown size={14} style={{ color: t.textMuted }}/> : <ChevronUp size={14} style={{ color: t.textMuted }}/>}
      </div>
      {!collapsed && engineers.map(eng => (
        <EngineerCard
          key={eng.id} t={t} eng={eng}
          expanded={expandedIds.has(eng.id)}
          onToggle={() => toggleExpand(eng.id)}
          onTaskClick={(task) => onTaskClick && onTaskClick(task, eng)}
        />
      ))}
    </div>
  );
}

// V13-FINAL2-fix3 — 카드 클릭 = 그 기사 작업 인라인 펼침 (EngineerDay 진입 X)
// +N 위치 = 진행중 배지 앞
function EngineerCard({ t, eng, expanded, onToggle, onTaskClick }) {
  // 2026-05-17 Round 2 Fix #19 — 옛 getEngineerStats(eng.id, TODAY_DATE) 제거.
  // 그 헬퍼는 ENGINEER_ASSIGNMENTS mock + 하드코딩된 "2026-04-27"을 읽어서
  // 강병익 펼치면 정수아/박은서 등 mock customer 노출되던 root cause.
  // EngineersTab에서 박은 실데이터 eng.todaySchedule 사용.
  const items = Array.isArray(eng.todaySchedule) ? eng.todaySchedule : [];
  // 2026-05-17 Round 2 Fix #25 — 사장님 spec 🅑: "+N" = 그 기사의 오늘 작업 실제 숫자.
  // (옛 spec "오늘 새로 배정된 수"는 assignedAt 의존 → 누락/혼란 발생.)
  const additionalCount = items.length;

  return (
    <>
      <div onClick={onToggle} className="clickable" style={{
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderRadius: 12, padding: "10px 12px", marginBottom: expanded ? 4 : 6,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <EngineerBadge engineer={eng} role={eng.level === "main" ? "main" : (eng.level === "backup" || eng.level === "sub") ? "backup" : null} size="sm"/>
          <div style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
            minWidth: 110, justifyContent: "flex-end",
          }}>
            {/* +N 자리 — 진행중 앞 (catch fix3) */}
            <div style={{ width: 28, textAlign: "center" }}>
              {additionalCount > 0 && (
                <span className="mono" style={{
                  fontSize: 9, fontWeight: 700,
                  padding: "2px 6px",
                  background: "rgba(255,27,141,0.15)",
                  color: "#FF1B8D", borderRadius: 8,
                  whiteSpace: "nowrap",
                }}>+{additionalCount}</span>
              )}
            </div>
            <span style={{ fontSize: 10 }}>{eng.status.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: eng.status.color, whiteSpace: "nowrap" }}>
              {eng.status.label}
            </span>
            {/* 화살표 — 펼침 / 접힘 */}
            {expanded
              ? <ChevronDown size={13} style={{ color: t.textMuted, flexShrink: 0 }}/>
              : <ChevronRight size={13} style={{ color: t.textMuted, flexShrink: 0 }}/>}
          </div>
        </div>
      </div>

      {/* 펼침 영역 — 그 기사 작업 인라인 */}
      {expanded && items.length > 0 && (
        <div style={{ padding: "0 0 6px 12px", marginBottom: 8 }}>
          {items.map(task => (
            <EngineerTaskMiniCard
              key={task.taskId || task.id || `${eng.id}-${task.time}`}
              t={t} task={task}
              onClick={() => onTaskClick && onTaskClick(task)}
            />
          ))}
        </div>
      )}
      {expanded && items.length === 0 && (
        <div style={{
          padding: "8px 12px", marginLeft: 12, marginBottom: 8,
          fontSize: 10, color: t.textMuted,
          background: t.bgInset, borderRadius: 6,
        }}>
          오늘 일정 없음
        </div>
      )}
    </>
  );
}

function EngineerTaskMiniCard({ t, task, onClick }) {
  // 2026-05-20 Phase 5 Step 0.F-1 — 작업유형 색 사이드바 (옛 statusBorder → workTypeColors V14)
  //   외근 측 = 보라 (옛 spec keep)
  const barColor = task.type === "external"
    ? "rgba(127,119,221,0.8)"
    : getWorkTypeColors(task.workType).main;
  const statusLabel = (() => {
    if (task.type === "external")   return "외근";
    if (task.state === "active")    return "진행중";
    if (task.state === "moving")    return "이동중";
    if (task.state === "scheduled") return "예정";
    if (task.state === "waiting")   return "대기";
    if (task.state === "done")      return "완료";
    return "";
  })();
  // 2026-05-20 Phase 5 Step 0.F-6 — N 마크 복구 + 조건 보강
  const _principal = String(task.principal || task.client || task.원청 || "");
  const _principalCode = String(task.principalCode || task.principal_code || "").toLowerCase();
  const _wt = String(task.workType || "");
  const isUsolNCleaning = (
    _principalCode === "usol_n" ||
    _principal === "유솔홈케어 N" ||
    _principal === "유솔 N" ||
    task.principalId === "usol_n"
  ) && _wt.includes("세척");
  // task_items / workItems 전부 표시 spec
  const itemsText = Array.isArray(task.workItems) && task.workItems.length > 0
    ? task.workItems.map(it => {
        const a = it.appliance || it.workType || "";
        const q = it.qty || 1;
        return a ? `${a} ×${q}` : "";
      }).filter(Boolean).join(" / ")
    : (task.workType
        ? `${task.workType}${task.qty ? ` ×${task.qty}` : ""}`
        : "");
  // 시각 spec: scheduledTime 우선 (옛 "오후" 측 catch X)
  const timeText = task.scheduledTime || task.time || "";

  return (
    <div
      onClick={onClick}
      className="clickable"
      style={{
        padding: 10,
        background: t.bg,
        borderLeft: `4px solid ${barColor}`,
        borderRadius: "0 6px 6px 0",
        marginBottom: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
        <span>{task.customer || task.note || "—"}</span>
        {isUsolNCleaning && (
          <span style={{
            background: '#03C75A', color: 'white',
            fontSize: 8, padding: '1px 4px',
            borderRadius: 3, fontWeight: 800,
          }}>N</span>
        )}
        {statusLabel && (
          <span style={{ fontSize: 9, color: t.textSecondary, fontWeight: 500 }}>
            · {statusLabel}
          </span>
        )}
      </div>
      <div style={{ fontSize: 10, color: t.textMuted }}>
        {itemsText}
        {task.region ? ` · ${task.region}` : ""}
        {timeText ? ` · ${timeText}` : ""}
      </div>
    </div>
  );
}

function TimelineItem({ t, slot, onClick }) {
  // type 분기
  if (slot.type === "off_full") {
    return (
      <div style={{
        background: t.bgInset, borderRadius: 6, padding: "8px 10px",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ fontSize: 12 }}>🏖️</span>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>{slot.note}</span>
      </div>
    );
  }
  if (slot.type === "off_partial") {
    return (
      <div style={{
        background: t.warningBg, borderRadius: 6, padding: "6px 10px",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span className="mono" style={{ fontSize: 11, color: t.warning, fontWeight: 700, width: 56, flexShrink: 0 }}>{slot.time}</span>
        <span style={{ fontSize: 11 }}>⏰</span>
        <span style={{ fontSize: 11, color: t.warning, fontWeight: 700 }}>{slot.note}</span>
      </div>
    );
  }
  if (slot.type === "external") {
    const isActive = slot.state === "active";
    return (
      <div style={{
        background: t.purpleBg,
        border: isActive ? `1px solid ${t.purple}40` : "none",
        borderRadius: 6, padding: "6px 10px",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span className="mono" style={{ fontSize: 11, color: t.purple, fontWeight: 700, width: 96, flexShrink: 0 }}>{slot.time}</span>
        <span style={{ fontSize: 11 }}>🌐</span>
        <span style={{ fontSize: 11, color: t.purple, fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slot.note}</span>
      </div>
    );
  }
  // type === "work"
  const stateConfig = {
    done:      { Icon: CheckCircle2, color: t.textMuted, opacity: 0.5, strong: false },
    active:    { Icon: Zap,          color: t.success,   opacity: 1,   strong: true },
    moving:    { Icon: Zap,          color: t.warning,   opacity: 1,   strong: true },
    waiting:   { Icon: Clock,        color: t.textMuted, opacity: 0.7, strong: false },
    scheduled: { Icon: Calendar,     color: t.text,      opacity: 1,   strong: false },
  }[slot.state] || { Icon: Calendar, color: t.textMuted, opacity: 1, strong: false };
  const { Icon, color, opacity, strong } = stateConfig;

  return (
    <div onClick={onClick} className={onClick ? "clickable" : undefined} style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: strong ? "6px 8px" : "5px 4px",
      background: strong ? color + "1A" : "transparent",
      borderLeft: strong ? `2px solid ${color}` : "none",
      borderRadius: strong ? 2 : 0,
      paddingLeft: strong ? 8 : 4,
      opacity,
    }}>
      <span className="mono" style={{
        fontSize: 11, fontWeight: 700, color,
        width: 44, flexShrink: 0,
        textDecoration: slot.state === "done" ? "line-through" : "none",
      }}>{slot.time}</span>
      <Icon size={12} style={{ color, flexShrink: 0 }}/>
      <span style={{ fontSize: 11, color: t.text, fontWeight: 600, minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {slot.customer} <span style={{ color: t.textMuted, fontWeight: 500 }}>({slot.workType})</span>
      </span>
      <span style={{ fontSize: 10, color: t.textMuted, flexShrink: 0 }}>· {slot.region}</span>
      {onClick && <ChevronRight size={12} style={{ color: t.textMuted, flexShrink: 0 }}/>}
    </div>
  );
}

function EngineerActivityCard({ t, eng }) {
  const [expanded, setExpanded] = useState(false);
  const schedule = eng.todaySchedule || [];

  return (
    <div onClick={() => setExpanded(v => !v)} className="clickable" style={{
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 12, padding: "12px 14px", marginBottom: 8,
    }}>
      {/* 1행: EngineerBadge + ▼ */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <EngineerBadge engineer={eng} role={eng.level === "main" ? "main" : (eng.level === "backup" || eng.level === "sub") ? "backup" : null}/>
        <div style={{ marginLeft: "auto", display: "flex", color: t.textMuted }}>
          {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </div>
      </div>

      {/* 2행: 3박스 (배정 완료 / 일정 확정 / 완료) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
        <ActivityBox t={t} label="신규 배정" value={eng.assigned}  bg={t.warningBg} color={t.warning}/>
        <ActivityBox t={t} label="일정 확정" value={eng.confirmed} bg={t.bgInset}   color={t.text}/>
        <ActivityBox t={t} label="완료"      value={eng.completed} bg={t.successBg} color={t.success}/>
      </div>

      {/* 펼침: 오늘 스케쥴 */}
      {expanded && schedule.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
            오늘 스케쥴 · <span className="mono">{schedule.length}</span>건
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {schedule.map((slot, idx) => (
              <ScheduleRow key={idx} t={t} slot={slot}/>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityBox({ t, label, value, bg, color }) {
  return (
    <div style={{
      background: bg,
      borderRadius: 6, padding: "4px 6px", textAlign: "center",
    }}>
      <div style={{ fontSize: 8, color: t.textMuted, fontWeight: 700, letterSpacing: 0.2, marginBottom: 1, whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 13, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 오늘 스케쥴 row (펼침 영역)
// ─────────────────────────────────────────────
function ScheduleRow({ t, slot }) {
  const config = {
    done:      { Icon: CheckCircle2, color: t.textMuted,    bg: null,           strong: false },
    active:    { Icon: Zap,          color: t.accent,       bg: t.accentBg,     strong: true },
    next:      { Icon: Zap,          color: t.warning,      bg: t.warningBg,    strong: true },
    scheduled: { Icon: Calendar,     color: t.text,         bg: null,           strong: false },
    waiting:   { Icon: Clock,        color: t.warning,      bg: null,           strong: false },
  }[slot.state] || { Icon: Calendar, color: t.textMuted, bg: null, strong: false };
  const { Icon, color, bg, strong } = config;
  const isDone = slot.state === "done";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: strong ? "6px 8px" : "5px 0",
      background: bg || "transparent",
      borderLeft: strong ? `2px solid ${color}` : "none",
      borderRadius: strong ? 2 : 0,
      paddingLeft: strong ? 8 : 0,
      opacity: isDone ? 0.5 : 1,
    }}>
      <span className="mono" style={{
        fontSize: 11, fontWeight: 700, color,
        width: 44, flexShrink: 0,
        textDecoration: isDone ? "line-through" : "none",
      }}>{slot.time}</span>
      <Icon size={12} style={{ color, flexShrink: 0 }}/>
      <span style={{ fontSize: 11, color: t.text, fontWeight: 600 }}>
        {slot.customer} <span style={{ color: t.textMuted, fontWeight: 500 }}>({slot.workType})</span>
      </span>
      <span style={{ fontSize: 10, color: t.textMuted, marginLeft: "auto" }}>· {slot.region}</span>
    </div>
  );
}

// ============================================
// 보조 컴포넌트
// ============================================

function StatBox({ t, label, value, color, onClick }) {
  return (
    <div onClick={onClick} className={onClick ? "clickable" : ""} style={{
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 10, padding: "10px 8px", textAlign: "center",
    }}>
      <div style={{ fontSize: 7.5, color: t.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4, whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function MoneyBox({ t, icon, label, value, color }) {
  return (
    <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
        <span style={{ color: t.textMuted, display: "flex" }}>{icon}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>₩</span>
        <span className="mono" style={{ fontSize: 16, fontWeight: 800, color, letterSpacing: "-0.02em" }}>
          {value.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// ============================================
// Placeholder 화면 4개 — Step 2~5에서 시안 채우기
// ============================================

function PlaceholderScreen({ t, title, label, onBack }) {
  return (
    <div className="fade-in">
      <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
      </div>
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.4 }}>🚧</div>
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 4, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 10, color: t.textDim, lineHeight: 1.6 }}>
          다음 단계에 시안 적용 예정<br/>
          ← 뒤로 눌러서 흐름 확인
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 시안 3-V5 — 새 접수 리스트 (Step 2 ✓)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 배정 완료 / 일정 확정 화면 (Step 2-5b)
// ─────────────────────────────────────────────
function AssignedTasksScreen({ t, filter, apiTasks = [], onBack, onMemo, onEdit, onTaskClick }) {
  // 2026-05-21 Phase 5 Step 0.G-5-B — 메인 카운트 통일 (TASK_FILTERS 공유 / 사장님 spec 확정)
  //   배정 완료 = TASK_FILTERS.assigned (유솔N 본작업 냉매만 + status='배정' / 날짜 X)
  //   일정 확정 = TASK_FILTERS.confirmed (유솔N 본작업 냉매만 + status='확정' / 날짜 X)
  //   옛 spec (유솔N 전체 제외 + 오늘 날짜 필터) 측 제거 — 카드 카운트 측 일치 spec.
  const [query, setQuery] = useState("");
  const isAssigned = filter === "assigned";
  const baseSource = (apiTasks || []).filter(isAssigned ? TASK_FILTERS.assigned : TASK_FILTERS.confirmed);

  // 2026-05-21 Phase 5 Step 0.H — 검색란 추가 (InProgressListScreen 측 동일 spec)
  const q = query.trim().toLowerCase();
  const all = !q ? baseSource : baseSource.filter((s) => {
    const fields = [s.customer, s.region, s.workType, s.engineer, s.assignedEngineer, s.note, s.memo].filter(Boolean).join(" ").toLowerCase();
    return fields.includes(q);
  });

  const titleText = isAssigned
    ? `배정 완료 ${all.length}건`
    : `일정 확정 ${all.length}건`;

  return (
    <div className="fade-in">
      <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{titleText}</div>
      </div>

      <div style={{ padding: "14px 16px 20px" }}>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={13} style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            color: t.textMuted, pointerEvents: "none",
          }}/>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="고객 · 지역 · 작업 · 프로"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "8px 10px 8px 30px",
              background: t.bgInset, border: `1px solid ${t.border}`,
              borderRadius: 8, color: t.text,
              fontSize: 12, fontFamily: "inherit", outline: "none",
            }}
          />
        </div>
        {all.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
            {q ? "검색 결과가 없어요" : "해당 상태의 작업이 없어요"}
          </div>
        ) : all.map((task) => (
          <AssignedCard key={task.id || task.taskCode} t={t} task={task} onMemo={onMemo} onEdit={onEdit} onClick={onTaskClick}/>
        ))}
      </div>
    </div>
  );
}

function AssignedCard({ t, task, onMemo, onEdit, onClick }) {
  const isAssigned = task.assignmentStatus === "assigned";

  return (
    <div
      onClick={() => onClick && onClick(task)}
      style={{
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderRadius: 12, padding: "12px 14px", marginBottom: 8,
        cursor: onClick ? "pointer" : "default",
      }}>
      {/* 헤더: 원청 라벨 + 고객명 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <PrincipalLabel name={task.principal}/>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{task.customer}</span>
          {task.hasRefrigerant && task.workType !== "냉매충전" && (
            <Zap size={12} style={{ color: t.warning, flexShrink: 0 }} aria-label="냉매 포함"/>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 4, lineHeight: 1.5 }}>
        {task.region} · {task.workItems && task.workItems.length > 0 ? formatWorkItemsAppliance(task.workItems) : `${task.appliance || "—"} ×${task.qty || 1}`} · {task.schedule}
      </div>
      {task.estimateTotal > 0 && (
        <div className="mono" style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>
          견적 ₩{task.estimateTotal.toLocaleString()}
        </div>
      )}
      {task.memo && (
        <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 8, display: "flex", alignItems: "center", gap: 4, fontStyle: "italic" }}>
          <FileText size={10}/><span>{task.memo}</span>
        </div>
      )}

      {/* AdminApp-fix1 — 배정 정보 (무채색 / 정보) */}
      <div style={{
        background: t.bgInset || t.bgElevated,
        border: `1px solid ${t.border}`,
        borderRadius: 8, padding: "8px 10px", marginBottom: 6,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <User size={12} style={{ color: t.textSecondary }}/>
        <span style={{ fontSize: 11, color: t.text, fontWeight: 600 }}>
          {task.assignedEngineer} 프로 배정
        </span>
      </div>

      {/* 상태 박스 — status 기반 분기 (2026-05-15 사장님 spec) */}
      {task.status === '배정' && (
        <div style={{
          marginTop: 10,
          marginBottom: 8,
          padding: "6px 10px",
          background: "rgba(255, 193, 7, 0.04)",
          border: t.isLight
            ? "1px solid rgba(255, 152, 0, 0.40)"
            : "1px solid rgba(255, 193, 7, 0.35)",
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 500,
          color: t.isLight ? "#E65100" : "#FFD54F",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          🟡 약속 대기
        </div>
      )}
      {task.status === '확정' && (() => {
        const scheduledAt = task.scheduledAt || task.confirmedAt || task.확정일시 || "";
        const timeText = formatScheduleShort(scheduledAt) || task.schedule;
        return (
          <div style={{
            background: t.successBg, border: `1px solid ${t.successBorder}`,
            borderRadius: 8, padding: "8px 10px", marginBottom: 8,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <CheckCircle2 size={12} style={{ color: t.success }}/>
            <span style={{ fontSize: 11, color: t.success, fontWeight: 700 }}>
              일정 확정{timeText ? ` · ${timeText}` : ""}
            </span>
          </div>
        );
      })()}

      {/* 액션 4개 (균등) — V14 stopPropagation (카드 클릭 박지 X) */}
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 6 }}>
        <ActionIconBtn t={t} icon={<Phone size={13}/>}    href={`tel:${task.phone}`}         flex={1}/>
        <ActionIconBtn t={t} icon={<User size={13}/>}     href={`tel:${task.engineerPhone}`} flex={1}/>
        <ActionIconBtn t={t} icon={<FileText size={13}/>} onClick={() => onMemo && onMemo(task)} flex={1}/>
        <ActionIconBtn t={t} icon={<Edit3 size={13}/>}    onClick={() => onEdit && onEdit(task)} flex={1}/>
      </div>
    </div>
  );
}

function NewReceptionScreen({
  t, filter,
  extraReceptions = [],
  apiTasks = [],
  tasksLoading = false,
  tasksError = "",
  tasksDebug = null,
  onRefresh,
  receptionUpdates = {},
  onBack, onAssign, onClickAdd, onClickPushing, onClickAccepted, onCardMenuAction,
}) {
  // 2026-05-21 Phase 5 Step 0.G-5-C-2 — 메인 카운트 통일 (TASK_FILTERS 공유)
  //   상단 카드 "새 접수" + 새 접수 상세 = 동일 기준 (TASK_FILTERS.newReception)
  //   기준: 유솔N 본작업 냉매만 포함 / 그 외 유솔N 제외 / 6원청 전부 포함 / status='미배정'
  const computeTasks = () => {
    const wrap = (x) => ({
      ...x,
      workItems: x.workItems && x.workItems.length > 0
        ? x.workItems
        : (x.workType ? [{ workType: x.workType, appliance: x.appliance, qty: x.qty }] : []),
    });
    const isNewReception = TASK_FILTERS.newReception;
    // 2026-05-11 dedupe — apiTasks에 있는 ID는 extraReceptions에서 제외
    // (옵티미스틱 박힌 status가 apiTasks 측에만 박혀서, 중복 박힌 ID는 시트 측 우선)
    const apiTaskIds = new Set(apiTasks.map(t => String(t.id || "").trim()).filter(Boolean));
    const dedupedExtras = extraReceptions.filter(r => !apiTaskIds.has(String(r.id || "").trim()));
    const apiNew   = apiTasks.filter(isNewReception);
    const extraNew = dedupedExtras.filter(isNewReception);
    const allReceptions = [
      ...apiNew.map(wrap),     // 진짜 시트 (미배정/약속대기 전체)
      ...extraNew.map(wrap),   // 등록 직후 임시 (refetch 후 apiTasks가 진실)
    ];
    // 중복 제거 (id 기준 / api가 우선)
    const seen = new Set();
    const unique = allReceptions.filter(r => {
      if (!r.id || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    }).map(r => receptionUpdates[r.id] ? { ...r, ...receptionUpdates[r.id] } : r);
    // 작업유형별 분류 (메인 항목 기준)
    // 2026-05-26 fix: 측 catch 측 measurement workType 측 catch ("세척_벽걸이" 측 catch "냉매점검") 측 catch
    //   measurement 측 catch 측 catch 측 measurement 측 X 측 catch — service_types.code 기반 매칭 측 변경.
    //   카운트(_isUsolNMainRefrigerant)는 service_types.code 기반 측 catch — 분류 측 catch 통일.
    //   workItems 측 X 측 catch task 측 catch 옛 호환 측 catch r.workType fallback 유지.
    function getByType(type) {
      return unique.filter(r => {
        const items = Array.isArray(r.workItems) ? r.workItems : [];
        if (items.length === 0) return r.workType === type;
        const main = items[0];
        if (type === "세척") {
          return main.serviceCode === "cleaning"
            || String(main.workType || "").startsWith("세척");
        }
        if (type === "냉매충전") {
          return main.serviceCode === "refrigerant"
            || /냉매/.test(String(main.workType || ""));
        }
        return determineMainWorkType(r.workItems) === type;
      });
    }
    return {
      세척:    getByType("세척"),
      냉매충전: getByType("냉매충전"),
    };
  };
  const [tasks, setTasks] = useState(computeTasks);
  useEffect(() => {
    setTasks(computeTasks());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiTasks, extraReceptions, receptionUpdates]);
  const [memoTask, setMemoTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  // 2026-05-21 Phase 5 Step 0.H — 검색란 추가 (InProgressListScreen 측 동일 spec)
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filterByQuery = (arr) => {
    if (!q) return arr;
    return arr.filter((s) => {
      const fields = [s.customer, s.region, s.workType, s.engineer, s.assignedEngineer, s.note, s.memo].filter(Boolean).join(" ").toLowerCase();
      return fields.includes(q);
    });
  };
  const cleanings    = filterByQuery(tasks.세척);
  const refrigerants = filterByQuery(tasks.냉매충전);
  const total = cleanings.length + refrigerants.length;

  // 헤더 텍스트 + 그룹 표시 분기 (filter prop)
  const showCleanings    = !filter || filter === "세척";
  const showRefrigerants = !filter || filter === "냉매충전";
  const headerText =
    filter === "세척"     ? `에어컨 세척 ${cleanings.length}건` :
    filter === "냉매충전" ? `냉매 충전 ${refrigerants.length}건` :
                             `새 접수 ${total}건`;

  const saveTask = (updated) => {
    setTasks(prev => ({
      세척:    prev.세척.map(t => t.id === updated.id ? updated : t),
      냉매충전: prev.냉매충전.map(t => t.id === updated.id ? updated : t),
    }));
  };

  // 수정 화면 분기
  if (editingTask) {
    return <TaskEditScreen
      t={t}
      task={editingTask}
      onBack={() => setEditingTask(null)}
      onSave={(updated) => { saveTask(updated); setEditingTask(null); }}
    />;
  }

  return (
    <div className="fade-in">
      <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>
          {headerText}
        </div>
        {onClickAdd && (
          <button onClick={onClickAdd} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "6px 10px",
            background: t.accent, color: "white",
            border: "none", borderRadius: 8,
            fontSize: 11, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            <Plus size={12}/> 추가
          </button>
        )}
        {/* V14 2A — 새로고침 (시트 작업DB 다시 catch) */}
        {onRefresh && (
          <button onClick={onRefresh} disabled={tasksLoading} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "6px 10px",
            background: "transparent",
            border: `1px solid ${t.border}`, borderRadius: 8,
            fontSize: 11, fontWeight: 700, color: t.textSecondary,
            cursor: tasksLoading ? "not-allowed" : "pointer",
            opacity: tasksLoading ? 0.5 : 1,
            fontFamily: "inherit",
          }}>
            <RotateCcw size={12}/> {tasksLoading ? "..." : "새로고침"}
          </button>
        )}
      </div>

      {/* V14 2A — 로딩 / 에러 박기 */}
      {tasksLoading && total === 0 && (
        <div style={{ padding: 30, textAlign: "center", color: t.textMuted, fontSize: 12, fontWeight: 600 }}>
          시트 작업DB 불러오는 중...
        </div>
      )}
      {tasksError && (
        <div style={{
          margin: "10px 16px", padding: "10px 12px",
          background: t.dangerBg || "#FEE2E2",
          border: `1px solid ${t.danger || "#DC2626"}`,
          borderRadius: 8,
          fontSize: 12, fontWeight: 700, color: t.danger || "#B91C1C",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <span>⚠ {tasksError}</span>
          {onRefresh && (
            <button onClick={onRefresh} style={{
              padding: "4px 10px", background: "transparent",
              border: `1px solid ${t.danger || "#DC2626"}`, borderRadius: 6,
              fontSize: 11, fontWeight: 700, color: t.danger || "#B91C1C",
              cursor: "pointer", fontFamily: "inherit",
            }}>다시 catch</button>
          )}
        </div>
      )}

      {/* V14 2A 디버그 — 0건 catch 시 raw 응답 박기 (사장님 catch 위해 / F12 X 안 박아도 OK) */}
      {/* Phase 4-F-2: dev 모드에서만 노출 (운영 사용자에는 X) */}
      {process.env.NODE_ENV === 'development' && !tasksLoading && !tasksError && tasksDebug && (
        <div style={{
          margin: "10px 16px", padding: "10px 12px",
          background: "#FFFBEB",
          border: "1px solid #F59E0B",
          borderRadius: 8,
          fontSize: 11, fontWeight: 600, color: "#78350F",
          fontFamily: "inherit",
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🔍</span><span>API 응답 디버그 (0건 catch — fix 필요)</span>
          </div>
          <div style={{ marginBottom: 4 }}>· phase: <b>{tasksDebug.phase}</b></div>
          {tasksDebug.arrayKey && <div style={{ marginBottom: 4 }}>· 배열 key: <code style={{ background: "#FEF3C7", padding: "1px 4px", borderRadius: 3 }}>{tasksDebug.arrayKey}</code></div>}
          {tasksDebug.responseKeys && (
            <div style={{ marginBottom: 4 }}>· 응답 키: <code style={{ background: "#FEF3C7", padding: "1px 4px", borderRadius: 3 }}>{JSON.stringify(tasksDebug.responseKeys)}</code></div>
          )}
          {typeof tasksDebug.rawListLength === 'number' && (
            <div style={{ marginBottom: 4 }}>· raw list length: <b>{tasksDebug.rawListLength}</b></div>
          )}
          {tasksDebug.firstRowKeys && (
            <div style={{ marginBottom: 4 }}>· 첫 row 키: <code style={{ background: "#FEF3C7", padding: "1px 4px", borderRadius: 3 }}>{JSON.stringify(tasksDebug.firstRowKeys)}</code></div>
          )}
          {tasksDebug.firstRowSample && (
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>첫 row 샘플 보기 ▼</summary>
              <pre style={{
                marginTop: 4, padding: 8, background: "#1A1A1A", color: "#A7F3D0",
                borderRadius: 4, fontSize: 10, overflow: "auto", maxHeight: 200,
                fontFamily: "monospace",
              }}>{JSON.stringify(tasksDebug.firstRowSample, null, 2)}</pre>
            </details>
          )}
          {tasksDebug.response && tasksDebug.phase === 'no-array' && (
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>전체 응답 보기 ▼</summary>
              <pre style={{
                marginTop: 4, padding: 8, background: "#1A1A1A", color: "#FCA5A5",
                borderRadius: 4, fontSize: 10, overflow: "auto", maxHeight: 200,
                fontFamily: "monospace",
              }}>{JSON.stringify(tasksDebug.response, null, 2)}</pre>
            </details>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: "#92400E" }}>
            · 캡처 → 저한테 catch (fix 박을 수 있음)
          </div>
        </div>
      )}

      <div style={{ padding: "14px 16px 20px" }}>
        {/* 2026-05-21 Phase 5 Step 0.H — 검색란 (InProgressListScreen 측 동일 스타일) */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <Search size={13} style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            color: t.textMuted, pointerEvents: "none",
          }}/>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="고객 · 지역 · 작업 · 프로"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "8px 10px 8px 30px",
              background: t.bgInset, border: `1px solid ${t.border}`,
              borderRadius: 8, color: t.text,
              fontSize: 12, fontFamily: "inherit", outline: "none",
            }}
          />
        </div>
        {showCleanings && (
          <ReceptionGroup t={t} workType="세척" title="에어컨 세척" subtitle="신규" subtitleColor={t.textMuted} count={cleanings.length}>
            {cleanings.map((task) => (
              <CleaningCard key={task.id} t={t} task={task}
                onAssign={() => onAssign(task)}
                onMemo={() => setMemoTask(task)}
                onEdit={() => setEditingTask(task)}
                onCardMenuAction={onCardMenuAction}
              />
            ))}
          </ReceptionGroup>
        )}

        {showRefrigerants && (
          <ReceptionGroup t={t} workType="냉매충전" title="가스 충전" subtitle="자동 진행" subtitleColor={t.success} count={refrigerants.length}>
            {refrigerants.map((task) => (
              <RefrigerantCard key={task.id} t={t} task={task}
                onMemo={() => setMemoTask(task)}
                onEdit={() => setEditingTask(task)}
                onClickPushing={onClickPushing}
                onClickAccepted={onClickAccepted}
                onCardMenuAction={onCardMenuAction}
              />
            ))}
          </ReceptionGroup>
        )}
      </div>

      {memoTask && (
        <MemoBottomSheet t={t} task={memoTask}
          onClose={() => setMemoTask(null)}
          onSave={(updated) => { saveTask(updated); setMemoTask(null); }}
        />
      )}
    </div>
  );
}

function ReceptionGroup({ t, workType, title, subtitle, subtitleColor, count, children }) {
  const IconComp = WORK_TYPE_ICONS[workType] || Hash;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IconComp size={14} style={{ color: t.textSecondary }}/>
          <span style={{ fontSize: 12, fontWeight: 800 }}>{title}</span>
          <span style={{ fontSize: 10, color: subtitleColor, fontWeight: 600 }}>· {subtitle}</span>
        </div>
        <span className="mono" style={{ fontSize: 12, fontWeight: 800, color: t.accent }}>{count}건</span>
      </div>
      {children}
    </div>
  );
}

function PrincipalLabel({ name }) {
  const color = PRINCIPAL_COLORS[name] || "#888780";
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: "2px 6px",
      background: color + "26",       // hex + alpha 0.15
      color: color,
      borderRadius: 4,
      letterSpacing: 0.3,
      whiteSpace: "nowrap",
    }}>{name}</span>
  );
}

// Step 5-3 fix — 직급 라벨 (신입/경력/전문가)
// Step 5-3-4 — 모든 화면 통일 톤다운: 회색 배경 + 등급별 글자색 (핑크 강조 X)
// 사용: <CareerLabel eng={engObj}/> 또는 <CareerLabel level="expert"/>
function CareerLabel({ eng, level }) {
  const key = level || getCareerLevel(eng);
  const info = CAREER_LEVELS[key] || CAREER_LEVELS.career;
  return (
    <span style={{
      display: "inline-block",
      fontSize: 11,
      fontWeight: 500,
      padding: "2px 8px",
      background: "#2A2420",
      color: info.color,
      borderRadius: 4, letterSpacing: 0.3,
      whiteSpace: "nowrap",
    }}>{info.name}</span>
  );
}

// Step 5-3 fix — 메인/백업 라벨 (서브 alias 호환)
// Step 5-3-4 — 회색 배경 + 회색 글자 (메인/백업 둘 다 톤다운)
function LevelLabel({ t, level }) {
  const info = LEVEL_LABELS[level] || LEVEL_LABELS.backup;
  return (
    <span style={{
      display: "inline-block",
      fontSize: 11,
      fontWeight: 500,
      padding: "2px 8px",
      background: "#2A2420",
      color: "#888780",
      borderRadius: 4, letterSpacing: 0.3,
      whiteSpace: "nowrap",
    }}>{info.name}</span>
  );
}

function ActionIconBtn({ t, icon, onClick, href, flex }) {
  const baseStyle = {
    flex: flex ?? "0 0 auto",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${t.border}`,
    color: t.textSecondary,
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "inherit",
    textDecoration: "none",
  };
  if (href) return <a href={href} style={baseStyle}>{icon}</a>;
  return <button onClick={onClick} style={baseStyle}>{icon}</button>;
}

function CleaningCard({ t, task, onAssign, onMemo, onEdit, onCardMenuAction }) {
  // V14 2B-1 — 카드 body 클릭 → 작업 상세 진입 (기사 배정 / ⋯ 메뉴는 stopPropagation)
  const handleCardClick = () => {
    if (onCardMenuAction) onCardMenuAction("detail", task);
  };
  return (
    <div
      onClick={handleCardClick}
      className="clickable"
      style={{
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderRadius: 12, padding: "12px 14px", marginBottom: 8,
        overflow: "visible",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <PrincipalLabel name={task.principal}/>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{task.customer}</span>
          {task.hasRefrigerant && task.workType !== "냉매충전" && (
            <Zap size={12} style={{ color: t.warning, flexShrink: 0 }} aria-label="냉매 포함"/>
          )}
        </div>
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500, flexShrink: 0 }}>{task.time}</span>
        {onCardMenuAction && (
          <span onClick={(e) => e.stopPropagation()}>
            <TaskCardMenu task={task} onAction={onCardMenuAction}/>
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 4, lineHeight: 1.5 }}>
        {task.region} · {task.workItems && task.workItems.length > 0 ? formatWorkItemsAppliance(task.workItems) : `${task.appliance || "—"} ×${task.qty || 1}`} · {task.schedule}
      </div>
      {task.estimateTotal > 0 && (
        <div className="mono" style={{ fontSize: 11, color: t.textMuted, marginBottom: task.memo ? 6 : 10 }}>
          견적 ₩{task.estimateTotal.toLocaleString()}
        </div>
      )}
      {task.memo && (
        <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 10, display: "flex", alignItems: "center", gap: 4, fontStyle: "italic" }}>
          <FileText size={10}/><span>{task.memo}</span>
        </div>
      )}
      {/* 2026-05-14 — push_candidates 기반 알림 발송 표시 */}
      {(() => {
        const keys = Array.isArray(task.pushCandidates) ? task.pushCandidates : [];
        const engineerCount = keys.filter(k => /^E\d+$/.test(k)).length;
        if (engineerCount === 0) return null;
        return (
          <div style={{
            marginTop: 10,
            marginBottom: 8,
            padding: "6px 10px",
            background: "rgba(255, 27, 141, 0.04)",
            border: t.isLight
              ? "1px solid rgba(255, 27, 141, 0.40)"
              : "1px solid rgba(255, 27, 141, 0.35)",
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 500,
            color: t.isLight ? "#C2185B" : "#FF8FBC",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}>
            <span>📡</span>
            <span>{engineerCount}명의 프로에게 알림 발송됨</span>
          </div>
        );
      })()}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={(e) => { e.stopPropagation(); onAssign && onAssign(); }} style={{
          flex: 1,
          background: t.accent, color: "white", border: "none",
          padding: "10px",
          borderRadius: 8,
          fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
        }}>
          프로 배정 <ArrowRight size={14}/>
        </button>
      </div>
    </div>
  );
}

// Step 5-3 v3 — RefrigerantCard 정정
// autoAssignStatus 기반 상태 박스 + 카드 자체 클릭 분기 (pushing → 자동 배정 화면 / accepted → 작업 상세)
// legacy autoStatus / assignedEngineer 호환
function RefrigerantCard({ t, task, onMemo, onEdit, onClickPushing, onClickAccepted, onCardMenuAction }) {
  // 새 필드 우선 / 구 필드 fallback
  const status = task.autoAssignStatus
    || (task.autoStatus === "push" ? "pushing" : null)
    || (task.autoStatus === "assigned" ? "accepted" : null);
  const acceptedName = task.acceptedEngineer || task.assignedEngineer;
  const isPushing  = status === "pushing";
  const isAccepted = status === "accepted";
  const pushCount  = task.pushCount || (task.candidates?.length) || 4;

  // V14 2B-1 — pushing/accepted 면 → 그 분기 / 그 외 → 작업 상세
  const handleCardClick = () => {
    if (isPushing  && onClickPushing)  onClickPushing(task);
    else if (isAccepted && onClickAccepted) onClickAccepted(task);
    else if (onCardMenuAction)              onCardMenuAction("detail", task);
  };
  const isClickable = (isPushing && onClickPushing) || (isAccepted && onClickAccepted) || !!onCardMenuAction;

  return (
    <div
      onClick={isClickable ? handleCardClick : undefined}
      className={isClickable ? "clickable" : undefined}
      style={{
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderRadius: 12, padding: "12px 14px", marginBottom: 8,
        cursor: isClickable ? "pointer" : "default",
        overflow: "visible",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <PrincipalLabel name={task.principal}/>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{task.customer}</span>
          {task.hasRefrigerant && task.workType !== "냉매충전" && (
            <Zap size={12} style={{ color: t.warning, flexShrink: 0 }} aria-label="냉매 포함"/>
          )}
        </div>
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500, flexShrink: 0 }}>{task.time}</span>
        {onCardMenuAction && (
          <span onClick={(e) => e.stopPropagation()}>
            <TaskCardMenu task={task} onAction={onCardMenuAction}/>
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 4, lineHeight: 1.5 }}>
        {task.region} · {task.workItems && task.workItems.length > 0 ? formatWorkItemsAppliance(task.workItems) : `${task.appliance || "—"} ×${task.qty || 1}`} · {task.schedule}
      </div>
      {task.estimateTotal > 0 && (
        <div className="mono" style={{ fontSize: 11, color: t.textMuted, marginBottom: task.memo ? 6 : 10 }}>
          견적 ₩{task.estimateTotal.toLocaleString()}
        </div>
      )}
      {task.memo && (
        <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 10, display: "flex", alignItems: "center", gap: 4, fontStyle: "italic" }}>
          <FileText size={10}/><span>{task.memo}</span>
        </div>
      )}
      {/* 2026-05-14 — push_candidates 기반 알림 발송 표시 */}
      {(() => {
        const keys = Array.isArray(task.pushCandidates) ? task.pushCandidates : [];
        const engineerCount = keys.filter(k => /^E\d+$/.test(k)).length;
        if (engineerCount === 0) return null;
        return (
          <div style={{
            marginTop: 10,
            marginBottom: 8,
            padding: "6px 10px",
            background: "rgba(255, 27, 141, 0.04)",
            border: t.isLight
              ? "1px solid rgba(255, 27, 141, 0.40)"
              : "1px solid rgba(255, 27, 141, 0.35)",
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 500,
            color: t.isLight ? "#C2185B" : "#FF8FBC",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span>📡</span>
            <span>{engineerCount}명의 프로에게 알림 발송됨</span>
          </div>
        );
      })()}
      {isPushing && (
        <div style={{
          background: t.warningBg, border: `1px solid ${t.warningBorder}`,
          borderRadius: 8, padding: "8px 10px", marginBottom: 8,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: 11 }}>🟡</span>
          <span style={{ fontSize: 11, color: t.warning, fontWeight: 700, flex: 1 }}>
            프로 <span className="mono">{pushCount}</span>명 푸시 중
          </span>
          <span style={{ fontSize: 10, color: t.textMuted }}>수락 대기</span>
        </div>
      )}
      {isAccepted && (
        <div style={{
          background: t.successBg, border: `1px solid ${t.successBorder}`,
          borderRadius: 8, padding: "8px 10px", marginBottom: 8,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: 11 }}>🟢</span>
          <span style={{ fontSize: 11, color: t.success, fontWeight: 700, flex: 1 }}>
            <strong>{acceptedName || "—"}</strong> 프로 수락
          </span>
          <span style={{ fontSize: 10, color: t.textMuted }}>자동 배정 완료</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 메모 BottomSheet (Step 2-1)
// ─────────────────────────────────────────────
function MemoBottomSheet({ t, task, onClose, onSave }) {
  const [memo, setMemo] = useState(task.memo || "");
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)", zIndex: 300,
      }}/>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "fixed", left: "50%", bottom: 0, transform: "translateX(-50%)",
        width: "100%", maxWidth: 380,
        background: t.bgElevated,
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        padding: "12px 16px 20px",
        zIndex: 301,
        animation: "slideUp 0.25s ease-out",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.4)",
      }}>
        <div style={{ width: 36, height: 4, background: t.border, borderRadius: 2, margin: "0 auto 12px" }}/>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
          {task.customer} <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>· 메모</span>
        </div>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모를 입력하세요"
          style={{
            width: "100%", minHeight: 100,
            padding: "10px 12px",
            background: t.bgInset, color: t.text,
            border: `1px solid ${t.border}`, borderRadius: 10,
            fontSize: 12, fontFamily: "inherit", outline: "none",
            boxSizing: "border-box", resize: "vertical",
            marginBottom: 12,
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 12, background: "transparent", border: `1px solid ${t.border}`,
            color: t.textMuted, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>취소</button>
          <button onClick={() => onSave({ ...task, memo })} style={{
            flex: 1, padding: 12, background: t.accent, color: "white", border: "none",
            borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          }}>저장</button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// 작업 수정 화면 (Step 2-1)
// ─────────────────────────────────────────────
function TaskEditScreen({ t, task, onBack, onSave }) {
  const [form, setForm] = useState({
    customer:      task.customer || "",
    phone:         task.phone || "",
    region:        task.region || "",
    appliance:     task.appliance || "벽걸이",
    qty:           task.qty || 1,
    schedule:      task.schedule || "",
    estimateTotal: task.estimateTotal || 0,
    memo:          task.memo || "",
  });
  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    background: t.bgInset, color: t.text,
    border: `1px solid ${t.border}`, borderRadius: 10,
    fontSize: 12, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle = {
    fontSize: 10, fontWeight: 700, color: t.textMuted,
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 5, display: "block",
  };

  return (
    <div className="fade-in">
      <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ fontSize: 15, fontWeight: 800 }}>
          {task.customer} <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>· 작업 수정</span>
        </div>
      </div>

      <div style={{ padding: "16px 16px 24px" }}>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>고객명</label>
          <input type="text" value={form.customer} onChange={(e) => update("customer", e.target.value)} style={inputStyle}/>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>연락처</label>
          <input type="text" value={form.phone} onChange={(e) => update("phone", e.target.value)} className="mono" style={{ ...inputStyle, fontFamily: "inherit" }}/>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>주소 / 지역</label>
          <input type="text" value={form.region} onChange={(e) => update("region", e.target.value)} style={inputStyle}/>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>기종</label>
            <select value={form.appliance} onChange={(e) => update("appliance", e.target.value)} style={inputStyle}>
              <option value="벽걸이">벽걸이</option>
              <option value="스탠드">스탠드</option>
              <option value="천장형">천장형</option>
              <option value="시스템 멀티">시스템 멀티</option>
              <option value="1way">1way</option>
              <option value="4way">4way</option>
              <option value="이동식">이동식</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>수량</label>
            <input type="number" min="1" value={form.qty} onChange={(e) => update("qty", parseInt(e.target.value) || 1)} className="mono" style={{ ...inputStyle, fontFamily: "inherit" }}/>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>일정</label>
          <input type="text" value={form.schedule} onChange={(e) => update("schedule", e.target.value)} style={inputStyle} placeholder="예: 오늘 14:00, 내일 오전"/>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>견적 금액</label>
          <div style={{ position: "relative" }}>
            <input type="number" min="0" step="1000"
              value={form.estimateTotal}
              onChange={(e) => update("estimateTotal", parseInt(e.target.value) || 0)}
              className="mono"
              style={{ ...inputStyle, fontFamily: "inherit", paddingRight: 36 }}
              placeholder="0"/>
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: t.textMuted, fontWeight: 600, pointerEvents: "none" }}>원</span>
          </div>
          {form.estimateTotal > 0 && (
            <div className="mono" style={{ fontSize: 10, color: t.textMuted, marginTop: 4, textAlign: "right" }}>
              ₩{form.estimateTotal.toLocaleString()}
            </div>
          )}
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>메모</label>
          <textarea value={form.memo} onChange={(e) => update("memo", e.target.value)} placeholder="작업 메모"
            style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}/>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onBack} style={{
            flex: 1, padding: 12, background: "transparent", border: `1px solid ${t.border}`,
            color: t.textMuted, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>취소</button>
          <button onClick={() => onSave({ ...task, ...form })} style={{
            flex: 2, padding: 12, background: t.accent, color: "white", border: "none",
            borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          }}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 시안 1 — 실시간 작업 현황 (Step 3 ✓)
// ─────────────────────────────────────────────

// 작업 탭 — 6 그룹 (사장님 시각: 작업 기준 — Step 3-4)
// 운영자 우선순위 순서: 진행중 / 이동중 / 외근중 / 대기 / 예정 / 완료
const TASK_GROUPS = [
  { id: "active",    label: "진행중",  colorKey: "success",         predicate: (s) => s.type === "work"     && s.state === "active"  },
  { id: "moving",    label: "이동중",  colorKey: "warning",         predicate: (s) => s.type === "work"     && s.state === "moving"  },
  { id: "external",  label: "외근중",  colorKey: "purple",          predicate: (s) => s.type === "external"                          },
  { id: "waiting",   label: "대기",    colorKey: "textSecondary",   predicate: (s) => s.type === "work"     && s.state === "waiting" },
  { id: "scheduled", label: "예정",    colorKey: "textMuted",       predicate: (s) => s.type === "work"     && s.state === "scheduled" },
  { id: "done",      label: "완료",    colorKey: "textMuted",       predicate: (s) => s.type === "work"     && s.state === "done"    },
];

function LiveWorkScreen({ t, onBack, onTaskClick, initialFilter, apiTasks = [] }) {
  // 2026-05-19 Phase 5 Step 0.C-10 — TASKS_TODAY mock fallback 제거
  //   사장님 catch: 박소영 (관악구 김재현) 가짜 작업 측 TASKS_TODAY 측 잔존 measure 측.
  //   apiTasks 측 only.
  const baseSource = apiTasks || [];
  const activeCount = baseSource.filter(
    (s) => (s.type === "work" && (s.state === "active" || s.state === "moving")) || s.type === "external"
  ).length;
  // 2026-05-17 Round 1 Fix #4 — 메인 "완료" 카드 진입 시 헤더 분기.
  // "실시간"은 진행 중 작업 전용 표현이므로 완료 컨텍스트에선 사용 X.
  // 2026-05-18 — 헤더 카운트를 LiveWorkContent의 base 필터와 동일 spec으로 통일.
  // 옛(state==="done"만)은 트랙/날짜 무시라 본 영역(11) ↔ 헤더(12) mismatch.
  // 자정 넘으면 어제 done이 헤더에 남는 stale 문제도 함께 해결(todayYmd 매 호출 재계산).
  // 2026-05-21 Phase 5 Step 0.G-5-B — 메인 카운트 통일 (TASK_FILTERS 공유)
  //   완료 = isScheduledToday + isCompletedToday + status='완료'/'정산완료' (전부 포함)
  const isCompletedToday = initialFilter === "completed-today";
  const completedCount = isCompletedToday
    ? baseSource.filter(TASK_FILTERS.completed).length
    : 0;
  return (
    <div className="fade-in">
      <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {isCompletedToday ? "오늘 완료 작업" : "실시간 작업 현황"}
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
            {isCompletedToday ? (
              <>총 <span className="mono" style={{ color: t.success, fontWeight: 700 }}>{completedCount}</span>건</>
            ) : (
              <>활성 <span className="mono" style={{ color: t.success, fontWeight: 700 }}>{activeCount}</span>건 · 전체 <span className="mono" style={{ color: t.text, fontWeight: 700 }}>{baseSource.length}</span>건</>
            )}
          </div>
        </div>
      </div>
      <div style={{ paddingTop: 14 }}>
        <LiveWorkContent t={t} onTaskClick={onTaskClick} initialFilter={initialFilter} apiTasks={apiTasks}/>
      </div>
    </div>
  );
}

// ============================================
// Step 5-2 — 진행중 작업 화면 (메인 통계 "진행중" 클릭 진입)
// TASK_GROUPS 중 active / moving / external 3그룹만 표시
// ============================================
const IN_PROGRESS_GROUP_IDS = new Set(["active", "moving", "external"]);

function InProgressListScreen({ t, onBack, onTaskClick, apiTasks = [] }) {
  const [query, setQuery] = useState("");
  // 2026-05-21 Phase 5 Step 0.G-5-B — 메인 카운트 통일 (TASK_FILTERS 공유)
  //   진행중 = isScheduledToday + status='진행중'/'작업중' (원청 구분 없이 전부 포함)
  const baseSource = (apiTasks || []).filter(TASK_FILTERS.inProgress);
  const groups = TASK_GROUPS.filter(g => IN_PROGRESS_GROUP_IDS.has(g.id));

  const q = query.trim().toLowerCase();
  const filtered = !q ? baseSource : baseSource.filter((s) => {
    const fields = [s.customer, s.region, s.workType, s.engineer, s.note].filter(Boolean).join(" ").toLowerCase();
    return fields.includes(q);
  });
  const activeCount = filtered.length;

  return (
    <div className="fade-in">
      <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>진행중 작업</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
            활성 <span className="mono" style={{ color: t.success, fontWeight: 700 }}>{activeCount}</span>건
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={13} style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            color: t.textMuted, pointerEvents: "none",
          }}/>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="고객 · 지역 · 작업 · 프로"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "8px 10px 8px 30px",
              background: t.bgInset, border: `1px solid ${t.border}`,
              borderRadius: 8, color: t.text,
              fontSize: 12, fontFamily: "inherit", outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groups.map((g) => {
            const items = filtered.filter(g.predicate);
            if (items.length === 0) return null;
            return (
              <TaskGroupSection
                key={g.id}
                t={t}
                group={g}
                items={items}
                defaultOpen={true}
                onTaskClick={onTaskClick}
              />
            );
          })}
          {activeCount === 0 && (
            // Step 5-7-D — 작업 0건 fallback UI 강화
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <ClipboardList size={48} style={{ color: t.textMuted, opacity: 0.5, margin: "0 auto 16px" }}/>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 10 }}>
                {q ? "검색 결과가 없어요" : "아직 작업이 없어요"}
              </div>
              {!q && (
                <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>
                  새 접수를 등록하거나 시트에 추가하면 여기에 표시됩니다
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Step 5-2 — 정산 화면 (메인 통계 "완료" 클릭 진입)
// 탭 [기사 그룹][원청 그룹] · 그룹 카드 펼침/접힘
// ============================================
function getTodayDoneTasks() {
  return TASKS_TODAY.filter((s) => s.type === "work" && s.state === "done");
}

function groupDoneByEngineer(tasks) {
  const map = {};
  for (const task of tasks) {
    const key = task.engineer;
    if (!map[key]) {
      map[key] = {
        engineer: key,
        engineerId: task.engineerId,
        rank: task.engineerRank,
        level: task.engineerLevel,
        tasks: [],
        total: 0,
      };
    }
    map[key].tasks.push(task);
    // 2026-05-17 Round 2 Fix #14 — "정산금" = 회사 마진 + 원청 수수료 = principal + owner.
    // calculateCommission(task).amount는 task.estimateTotal(productPrice만, extra/travel 빠짐)
    // 기반이라 정확하지 X. compute_payment v7 보장: total = engineer + principal + owner.
    // 직영 100% 정책(engineer만 챙기는 작업)이라도 원청 수수료는 별도 입금되므로
    // principal_amount + owner_amount 직접 합산이 사장님 spec과 일치.
    const settleAmount = (Number(task.principal_amount) || 0) + (Number(task.owner_amount) || 0);
    map[key].total += settleAmount;
  }
  return Object.values(map);
}

function groupDoneByPrincipal(tasks) {
  const map = {};
  for (const task of tasks) {
    const key = task.principal;
    if (!map[key]) {
      map[key] = {
        principal: key,
        color: PRINCIPAL_COLORS[key] || "#888780",
        tasks: [],
        total: 0,
      };
    }
    map[key].tasks.push(task);
    // 2026-05-17 Round 2 Fix #15 — 원청 그룹 "정산금" = 회사가 그 원청에 송금해야 할 돈
    // = principal_amount 합. (기사 정산이나 회사 마진 X — 원청 몫만.)
    map[key].total += Number(task.principal_amount) || 0;
  }
  return Object.values(map);
}

function SettlementScreen({ t, onBack, onTaskClick, onClickManagePrincipals }) {
  const doneTasks = getTodayDoneTasks();
  const totalToday = doneTasks.reduce((sum, task) => sum + (calculateCommission(task).amount || 0), 0);
  const fmtKRW = (n) => `₩${(n || 0).toLocaleString("ko-KR")}`;

  return (
    <div className="fade-in">
      <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>정산 (오늘)</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
            완료 <span className="mono" style={{ color: t.success, fontWeight: 700 }}>{doneTasks.length}</span>건
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, letterSpacing: 0.5 }}>총</div>
          <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: t.accent }}>{fmtKRW(totalToday)}</div>
        </div>
      </div>
      <SettlementContent t={t} onTaskClick={onTaskClick} onClickManagePrincipals={onClickManagePrincipals} containerPadding="14px 16px 16px" tabPadding="0 0 12px"/>
    </div>
  );
}

// Step 5-3 — 정산 콘텐츠 분리: SettlementScreen (헤더+합계) + 대시보드 정산 탭에서 공유
function SettlementContent({ t, apiTasks = [], user, onRefreshTasks, onTaskClick, onClickSettlementHistory, containerPadding, tabPadding }) {
  const [activeTab, setActiveTab] = useState("engineers");  // "engineers" | "principals"
  const [expanded, setExpanded] = useState(() => new Set());

  // 2026-05-22 — 사장님 spec: 확인 완료해도 사라지지 않음, 맨 아래로 정렬.
  //   기준: 트랙 🅐 (isTrackARemittance) AND completedAt(KST) = 오늘.
  //   미확인(pending/reported/overdue) → 위, 확인 완료(confirmed) → 아래.
  // 2026-05-17 Round 2 Fix #13 — 메인 매출과 동일 dataset (트랙 🅐 + 오늘 완료).
  const todayStr = todayYmd();
  const doneTasks = (apiTasks && apiTasks.length > 0)
    ? apiTasks.filter(t => {
        if (!isTrackARemittance(t)) return false;
        const completed = t.completedAt || t.completed_at;
        if (!completed) return false;
        return toKstYmd(completed) === todayStr;
      })
    : getTodayDoneTasks();
  const engineerGroups = sortGroupsConfirmedLast(groupDoneByEngineer(doneTasks));
  const principalGroups = groupDoneByPrincipal(doneTasks);

  function toggle(key) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div style={{ padding: containerPadding || "0" }}>
      {/* 2026-05-22 — 입금 내역 진입점 (옛 "원청 관리" 버튼 자리, 원청 관리는 설정으로 이동) */}
      {onClickSettlementHistory && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 0 8px" }}>
          <button
            onClick={onClickSettlementHistory}
            style={{
              padding: "6px 12px", background: t.accentBg,
              border: `1px solid ${t.accent}`, borderRadius: 7,
              color: t.accent, fontSize: 11, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >📜 입금 내역</button>
        </div>
      )}
      <div style={{ padding: tabPadding || "0 0 12px", display: "flex", gap: 6 }}>
        {[
          { k: "engineers",  lbl: "👷 프로 그룹" },
          { k: "principals", lbl: "🏢 원청 그룹" },
        ].map((tab) => {
          const active = activeTab === tab.k;
          return (
            <button key={tab.k} onClick={() => setActiveTab(tab.k)} style={{
              flex: 1, padding: "9px 8px",
              background: active ? t.bgElevated : "transparent",
              border: active ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
              borderRadius: 9, fontSize: 11, fontWeight: 700,
              color: active ? t.text : t.textMuted,
              cursor: "pointer", fontFamily: "inherit",
            }}>{tab.lbl}</button>
          );
        })}
      </div>

      {doneTasks.length === 0 ? (
        // Step 5-7-D — 정산 0건 fallback UI 강화
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <Wallet size={48} style={{ color: t.textMuted, opacity: 0.5, margin: "0 auto 16px" }}/>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 10 }}>
            아직 정산 데이터가 없어요
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>
            작업 완료 후 정산 데이터가 자동으로 추가됩니다
          </div>
        </div>
      ) : activeTab === "engineers" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {engineerGroups.map((g) => {
            const key = `E-${g.engineerId || g.engineer}`;
            return (
              <SettlementEngineerCard
                key={key}
                t={t}
                group={g}
                open={expanded.has(key)}
                onToggle={() => toggle(key)}
                onTaskClick={onTaskClick}
                user={user}
                onRefreshTasks={onRefreshTasks}
              />
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {principalGroups.map((g) => {
            const key = `P-${g.principal}`;
            return (
              <SettlementPrincipalCard
                key={key}
                t={t}
                group={g}
                open={expanded.has(key)}
                onToggle={() => toggle(key)}
                onTaskClick={onTaskClick}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// 2026-05-22 — 그룹 정렬: 미확인(pending/reported/overdue) 위, 확인 완료 아래.
// 같은 그룹 내에서는 정산금 큰 순서 유지.
function sortGroupsConfirmedLast(groups) {
  return [...groups].sort((a, b) => {
    const aConfirmed = computeGroupStatus(a.tasks) === "confirmed" ? 1 : 0;
    const bConfirmed = computeGroupStatus(b.tasks) === "confirmed" ? 1 : 0;
    if (aConfirmed !== bConfirmed) return aConfirmed - bConfirmed;
    return (b.total || 0) - (a.total || 0);
  });
}

// 2026-05-17 Round 2 Fix #21 — 일별 통합 정산: 한 기사 = 한 상태.
// 모든 작업의 engineer_remit_* 상태를 보고 통합 상태(4종)를 산출.
//   confirmed = 모든 작업 운영자 확인 완료 (engineerRemitConfirmedAt 채워짐)
//   reported  = 모든 작업 기사 입금 보고 완료 (engineerRemittedAt 채워짐) — 확인 대기
//   overdue   = 23:00 KST 이후 + 일부 작업 보고 안 됨 (연체)
//   pending   = 그 외 (미입금)
function computeGroupStatus(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return "pending";
  if (tasks.every(t => t.engineerRemitConfirmedAt)) return "confirmed";
  if (tasks.every(t => t.engineerRemittedAt)) return "reported";
  const kstHourStr = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Seoul", hour: "numeric", hour12: false,
  });
  const kstHour = parseInt(kstHourStr, 10);
  if (kstHour >= 23 && tasks.some(t => !t.engineerRemittedAt)) return "overdue";
  return "pending";
}

// 2026-05-22 — 테마 토큰화 (라이트/다크 양쪽 대비 확보).
// 옛 하드코딩 톤은 다크 모드 전제라 라이트 모드에서 텍스트 묻힘 → t.* 토큰으로 통일.
function RemitStatusBadge({ status, t }) {
  const MAP = {
    pending:   { Icon: null,          fg: t.textMuted, bg: t.bgInset,   bd: t.borderStrong,  label: "미입금" },
    reported:  { Icon: Clock,         fg: t.info,      bg: t.infoBg,    bd: `${t.info}33`,   label: "확인 대기" },
    confirmed: { Icon: CheckCircle2,  fg: t.success,   bg: t.successBg, bd: t.successBorder, label: "입금 완료" },
    overdue:   { Icon: AlertTriangle, fg: t.danger,    bg: t.dangerBg,  bd: t.dangerBorder,  label: "연체" },
  };
  const cfg = MAP[status] || MAP.pending;
  const Icon = cfg.Icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 8,
      background: cfg.bg, color: cfg.fg,
      border: `1px solid ${cfg.bd}`,
      fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {Icon && <Icon size={10} aria-hidden="true"/>}
      {cfg.label}
    </span>
  );
}

function SettlementEngineerCard({ t, group, open, onToggle, onTaskClick, user, onRefreshTasks }) {
  const fmtKRW = (n) => `₩${(n || 0).toLocaleString("ko-KR")}`;
  // 2026-05-17 Round 2 Fix #21 — 그룹 헤더에 통합 상태 배지
  const groupStatus = computeGroupStatus(group.tasks);
  // 2026-05-17 Round 2 Fix #24 — 입금 확인 (그룹 일별 통합). reported 상태일 때만 노출.
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  async function handleConfirmRemit(e) {
    e.stopPropagation();  // 그룹 펼침/접힘 토글 방지
    if (confirming) return;
    // 2026-05-21 — user.user_id = UUID (RPC 응답) / user.userId = code ('A004') / user.id = undefined
    //   → engineer_remit_confirmed_by (uuid 컬럼) 에 user.user_id 사용
    const adminUserId = user?.user_id || user?.id;
    if (!adminUserId) {
      alert("관리자 사용자 ID를 찾을 수 없습니다.");
      return;
    }
    const taskIds = (group.tasks || []).map(t => t.id).filter(Boolean);
    if (taskIds.length === 0) return;
    setConfirming(true);
    try {
      const res = await confirmEngineerRemit(taskIds, adminUserId);
      if (!res || res.ok === false) {
        alert(`입금 확인 실패: ${(res && res.error) || "알 수 없는 오류"}`);
      } else {
        // 성공 — apiTasks 새로고침해서 status가 reported → confirmed로 반영되도록
        if (typeof onRefreshTasks === "function") onRefreshTasks();
      }
    } catch (err) {
      console.error("[SettlementEngineerCard] confirmRemit 예외:", err);
      alert(`입금 확인 예외: ${err?.message || err}`);
    } finally {
      setConfirming(false);
    }
  }

  // 2026-05-22 — 확인 취소 (confirmed → reported 되돌리기). 실수 정정용.
  async function handleCancelConfirm(e) {
    e.stopPropagation();
    if (cancelling) return;
    const ok = window.confirm(
      `${group.engineer} 기사의 입금 확인을 취소하시겠습니까?\n\n` +
      `완료 ${group.tasks.length}건 · 정산금 ${fmtKRW(group.total)}\n` +
      `상태가 "확인 대기"로 되돌아갑니다.`
    );
    if (!ok) return;
    const taskIds = (group.tasks || []).map(t => t.id).filter(Boolean);
    if (taskIds.length === 0) return;
    setCancelling(true);
    try {
      const res = await cancelConfirmRemit(taskIds);
      if (!res || res.ok === false) {
        alert(`확인 취소 실패: ${(res && res.error) || "알 수 없는 오류"}`);
      } else {
        if (typeof onRefreshTasks === "function") onRefreshTasks();
      }
    } catch (err) {
      console.error("[SettlementEngineerCard] cancelConfirm 예외:", err);
      alert(`확인 취소 예외: ${err?.message || err}`);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", padding: "10px 12px",
          background: "transparent", border: "none", cursor: "pointer",
          color: t.text, fontFamily: "inherit", textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <EngineerBadge
            engineer={{ name: group.engineer, careerLevel: getCareerLevel({ rank: group.rank, level: group.level }) }}
            role={group.level === "main" ? "main" : group.level === "backup" || group.level === "sub" ? "backup" : null}
            size="sm"
          />
          <div style={{ flex: 1 }}/>
          {/* 2026-05-17 Round 2 Fix #24 — 확인 대기 상태일 때만 입금 확인 버튼 노출 */}
          {groupStatus === "reported" && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleConfirmRemit}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleConfirmRemit(e); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                padding: "3px 8px", borderRadius: 8,
                background: confirming ? t.bgInset : "#0F6E56",
                color: confirming ? t.textMuted : "#9FE1CB",
                fontSize: 10, fontWeight: 700,
                cursor: confirming ? "wait" : "pointer",
                opacity: confirming ? 0.6 : 1,
                whiteSpace: "nowrap",
                userSelect: "none",
              }}
            >
              <CheckCircle2 size={10}/>
              {confirming ? "확인 중..." : "확인"}
            </span>
          )}
          {/* 2026-05-22 — 확인 완료 상태에서만 [확인 취소] 버튼 노출 (실수 정정용) */}
          {groupStatus === "confirmed" && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleCancelConfirm}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCancelConfirm(e); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                padding: "3px 8px", borderRadius: 8,
                background: cancelling ? t.bgInset : "rgba(192,57,43,0.18)",
                color: cancelling ? t.textMuted : "#FF8E7F",
                border: `1px solid ${cancelling ? t.border : "rgba(192,57,43,0.4)"}`,
                fontSize: 10, fontWeight: 700,
                cursor: cancelling ? "wait" : "pointer",
                opacity: cancelling ? 0.6 : 1,
                whiteSpace: "nowrap",
                userSelect: "none",
              }}
            >
              <RotateCcw size={10}/>
              {cancelling ? "취소 중..." : "확인 취소"}
            </span>
          )}
          {/* 2026-05-17 Round 2 Fix #21 — 그룹 통합 상태 배지 */}
          <RemitStatusBadge status={groupStatus} t={t}/>
          {open ? <ChevronUp size={14} style={{ color: t.textMuted }}/> : <ChevronDown size={14} style={{ color: t.textMuted }}/>}
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary }}>
          완료 <span className="mono" style={{ fontWeight: 700, color: t.text }}>{group.tasks.length}</span>건
          <span style={{ color: t.textDim, margin: "0 5px" }}>·</span>
          정산금 <span className="mono" style={{ fontWeight: 800, color: t.accent }}>{fmtKRW(group.total)}</span>
        </div>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          {group.tasks.map((task) => {
            // 2026-05-17 Round 2 Fix #20 — 사장님 spec: (모델×수량) + workType 아이콘.
            // appliance(벽걸이/스탠드)를 모델로 표시, workType은 ⚡/❄ 아이콘으로 압축.
            const itemSummary = `${task.appliance || "—"}×${task.qty || 1}`;
            const WorkIcon = task.workType === "냉매충전" ? Zap : Snowflake;
            // 2026-05-21 Phase 5 Step 0.H-3 — 세척 색 = 파랑 (t.info / 통일)
            const workColor = task.workType === "냉매충전" ? "#EF9F27" : t.info;
            // 2026-05-17 Round 2 Fix #14 — 작업당 표시값 = principal + owner (= 회사+원청 수수료).
            // 그룹 합계(groupDoneByEngineer)와 동일 계산식.
            const earning = (Number(task.principal_amount) || 0) + (Number(task.owner_amount) || 0);
            return (
              <div
                key={task.taskId}
                onClick={() => onTaskClick && onTaskClick(task)}
                className="clickable"
                style={{
                  padding: "8px 10px", background: t.bgInset, borderRadius: 8,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <WorkIcon size={13} style={{ color: workColor, flexShrink: 0 }}/>
                <span className="mono" style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>{task.time}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{task.customer}</span>
                <span style={{ fontSize: 11, color: t.textSecondary }}>({itemSummary})</span>
                <div style={{ flex: 1 }}/>
                <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: t.accent, whiteSpace: "nowrap" }}>{fmtKRW(earning)}</span>
              </div>
            );
          })}
          <div style={{ fontSize: 10, color: t.textMuted, paddingLeft: 4, paddingTop: 2 }}>
            원청: {[...new Set(group.tasks.map(x => x.principal).filter(Boolean))].join(", ") || "—"}
          </div>
        </div>
      )}
    </div>
  );
}

function SettlementPrincipalCard({ t, group, open, onToggle, onTaskClick }) {
  const fmtKRW = (n) => `₩${(n || 0).toLocaleString("ko-KR")}`;

  return (
    <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", padding: "10px 12px",
          background: "transparent", border: "none", cursor: "pointer",
          color: t.text, fontFamily: "inherit", textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13 }}>🏢</span>
          <PrincipalLabel name={group.principal}/>
          <div style={{ flex: 1 }}/>
          {open ? <ChevronUp size={14} style={{ color: t.textMuted }}/> : <ChevronDown size={14} style={{ color: t.textMuted }}/>}
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary }}>
          완료 <span className="mono" style={{ fontWeight: 700, color: t.text }}>{group.tasks.length}</span>건
          <span style={{ color: t.textDim, margin: "0 5px" }}>·</span>
          정산금 <span className="mono" style={{ fontWeight: 800, color: t.accent }}>{fmtKRW(group.total)}</span>
        </div>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          {group.tasks.map((task) => {
            const itemSummary = `${task.workType} ×${task.qty || 1}`;
            // 2026-05-17 Round 2 Fix #15 — 작업당 표시값 = task.principal_amount (회사→원청 송금액).
            // 그룹 합계(groupDoneByPrincipal)와 동일 계산식.
            const principalAmt = Number(task.principal_amount) || 0;
            return (
              <div
                key={task.taskId}
                onClick={() => onTaskClick && onTaskClick(task)}
                className="clickable"
                style={{
                  padding: "8px 10px", background: t.bgInset, borderRadius: 8,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <CheckCircle2 size={12} style={{ color: t.success, flexShrink: 0 }}/>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{task.customer}</span>
                <span style={{ fontSize: 11, color: t.textSecondary }}>({itemSummary})</span>
                <span style={{ fontSize: 10, color: t.textMuted, whiteSpace: "nowrap" }}>· {task.engineer}</span>
                <div style={{ flex: 1 }}/>
                <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: t.accent, whiteSpace: "nowrap" }}>{fmtKRW(principalAmt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LiveWorkContent({ t, onTaskClick, initialFilter, apiTasks = [] }) {
  const [query, setQuery] = useState("");

  // 2026-05-21 Phase 5 Step 0.H-5 — effectiveStatus 측 1분 자동 갱신
  //   작업 탭 측 = 예정 시간 측 측 작업 측 자동 진행중 카드 측 측 → 매 분 rerender
  const [, setMinuteTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMinuteTick(v => v + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // 2026-05-19 Phase 5 Step 0.C-10 — TASKS_TODAY mock fallback 제거 (가짜 작업 catch X)
  const dataSource = apiTasks || [];

  // 2026-05-17 Round 1 Fix #2 — 메인 "완료" 카드 진입 시 오늘+완료 사전 필터.
  // 진입 경로별 base 데이터 셋을 좁힌 뒤 검색어 필터를 그 위에 얹는다.
  // 2026-05-17 Round 2 Fix #17 — 메인 매출 / 정산 탭과 동일 dataset 사용:
  //   { completedAt 오늘 (KST), status='완료', isTrackARemittance() = true }
  // 옛 scheduledDate 비교는 어제 완료된 작업이 오늘 예정이면 잡혀 메인과 불일치.
  //
  // 2026-05-17 Round 2 Fix #18 — 사장님 spec 확정: 작업 탭은 "오늘 모니터링".
  // initialFilter 없는 일반 진입(하단 탭 등)에서도 오늘 작업만 표시.
  // 트랙 🅐/🅑 모두 노출(작업 진행 모니터링 목적 — 정산/매출 dataset과 다름).
  // "오늘 작업" = 오늘 일정 OR 오늘 완료 (어제 일정 ↔ 오늘 완료 케이스 catch).
  // 2026-05-19 Phase 5 Step 0.C-15 — _isLegacy 필터 롤백 (옛 0.C-11 spec 유지)
  const isCompletedToday = initialFilter === "completed-today";
  const todayStr = todayYmd();
  const base = isCompletedToday
    ? dataSource.filter((s) => {
        const scheduled = s.scheduledAt || s.scheduled_at || s.확정일시;
        const completed = s.completedAt || s.completed_at;
        if (!completed || !scheduled) return false;
        if (toKstYmd(scheduled) !== todayStr) return false;
        if (toKstYmd(completed) !== todayStr) return false;
        const st = String(s.status || s.상태 || "").trim();
        return st === "완료" || st === "정산완료";
      })
    : dataSource.filter((s) => {
        const scheduled = s.scheduledDate
          || (s.scheduledAt ? toKstYmd(s.scheduledAt) : "")
          || (s.service_scheduled_at ? toKstYmd(s.service_scheduled_at) : "");
        const completed = (s.completedAt || s.completed_at)
          ? toKstYmd(s.completedAt || s.completed_at)
          : "";
        return scheduled === todayStr || completed === todayStr;
      });

  // 검색: 고객명 / 지역 / 작업종류 / 기사명 / 외근 note
  const q = query.trim().toLowerCase();
  const matched = !q ? base : base.filter((s) => {
    const fields = [
      s.customer, s.region, s.workType, s.engineer, s.assignedEngineer, s.note,
    ].filter(Boolean).join(" ").toLowerCase();
    return fields.includes(q);
  });

  // 2026-05-21 Phase 5 Step 0.H — 작업 예정 시간 오름차순 정렬 (가까운 시간 측 측 측)
  //   scheduledAt(or scheduled_at) 측 측 측 task 측 목록 측 측 측
  const filtered = [...matched].sort((a, b) => {
    const sa = a.scheduledAt || a.scheduled_at || a.확정일시 || "";
    const sb = b.scheduledAt || b.scheduled_at || b.확정일시 || "";
    if (!sa && !sb) return 0;
    if (!sa) return 1;
    if (!sb) return -1;
    const ta = new Date(sa).getTime();
    const tb = new Date(sb).getTime();
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return 1;
    if (isNaN(tb)) return -1;
    return ta - tb;
  });

  return (
    <div style={{ padding: "0 16px 16px" }}>
      {/* 검색 */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={13} style={{
          position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
          color: t.textMuted, pointerEvents: "none",
        }}/>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="고객 · 지역 · 작업 · 프로"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "8px 10px 8px 30px",
            background: t.bgInset, border: `1px solid ${t.border}`,
            borderRadius: 8, color: t.text,
            fontSize: 12, fontFamily: "inherit", outline: "none",
          }}
        />
      </div>

      {/* 2026-05-17 Round 2 Fix #26 — 메인 "완료" 카드 진입 시 그룹화 건너뛰고 평면 리스트.
          사장님 spec: "리스트만" 명확. (옛엔 "완료 N건" 그룹 카드가 접힌 상태로 표시) */}
      {isCompletedToday ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
              오늘 완료된 작업이 없어요
            </div>
          ) : (
            filtered.map(task => (
              <TaskCard
                key={task.taskId || task.id}
                t={t}
                task={task}
                onClick={() => onTaskClick(task)}
              />
            ))
          )}
        </div>
      ) : (
        /* 6 그룹 — 일반 진입 (하단 탭 등) */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {TASK_GROUPS.map((g) => {
            const items = filtered.filter(g.predicate);
            if (items.length === 0) return null;
            return (
              <TaskGroupSection
                key={g.id}
                t={t}
                group={g}
                items={items}
                defaultOpen={g.id === "active"}
                onTaskClick={onTaskClick}
              />
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: "30px 20px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
              검색 결과가 없어요
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskGroupSection({ t, group, items, defaultOpen, onTaskClick }) {
  const [open, setOpen] = useState(defaultOpen);
  const color = t[group.colorKey] || t.textMuted;
  return (
    <div>
      {/* 그룹 헤더 */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "6px 4px", marginBottom: 6,
          background: "transparent", border: "none", cursor: "pointer",
          color: t.text, fontFamily: "inherit", textAlign: "left",
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }}/>
        <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>{group.label}</span>
        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: color }}>{items.length}</span>
        <div style={{ flex: 1 }}/>
        {open ? <ChevronUp size={14} style={{ color: t.textMuted }}/> : <ChevronDown size={14} style={{ color: t.textMuted }}/>}
      </button>
      {/* 카드 리스트 */}
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((task) => (
            <TaskCard key={task.taskId} t={t} task={task} groupColor={color} onClick={() => onTaskClick(task)}/>
          ))}
        </div>
      )}
    </div>
  );
}

// 기사 상세 활동 정보 — 신규 배정만 펼침 (Step 4-3)
function ActivityGroupSection({ t, group, defaultOpen, onTaskClick }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 6,
          padding: "6px 4px", marginBottom: 8,
          background: "transparent", border: "none", cursor: "pointer",
          color: t.text, fontFamily: "inherit", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 12 }}>{group.icon}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: group.color }}>{group.label}</span>
        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: group.color }}>{group.items.length}건</span>
        <div style={{ flex: 1 }}/>
        {open ? <ChevronUp size={14} style={{ color: t.textMuted }}/> : <ChevronDown size={14} style={{ color: t.textMuted }}/>}
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {group.items.map(task => (
            <TaskCard
              key={task.taskId} t={t} task={task}
              groupColor={group.color}
              showCompanyProfit={group.showProfit}
              onClick={() => onTaskClick && onTaskClick(task)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 2026-05-17 Round 2 Fix #22 — 사장님 spec 🅒: 1줄 컴팩트 카드 (높이 ~38px).
// 한 화면에 15~18건 모니터링 목적. 기사명을 작은 박스로 분리해 시각 영역 구분.
function TaskCard({ t, task, groupColor, onClick, showCompanyProfit }) {
  const isExternal = task.type === "external";
  const titleText = isExternal ? (task.note || "외근") : task.customer;
  const commission = (showCompanyProfit && !isExternal && task.principal && task.state === "done") ? calculateCommission(task) : null;
  const fmtKRW = (n) => `₩${(n || 0).toLocaleString("ko-KR")}`;

  // workType 아이콘 — 2026-05-21 Phase 5 Step 0.H-3: 세척 색 = 파랑 (t.info)
  const WorkIcon = task.workType === "냉매충전" ? Zap : Snowflake;
  const workColor = task.workType === "냉매충전" ? "#EF9F27" : t.info;

  // 정보 텍스트: "(모델×수량) · 지역 · 시간"
  //   2026-05-21 Phase 5 Step 0.H-3 — 작업 예정 시간 표시 (정렬 결과 catch 측 spec)
  const infoBits = [];
  if (!isExternal) {
    infoBits.push(`(${task.appliance || "—"}×${task.qty || 1})`);
  }
  if (task.region) infoBits.push(task.region);
  const timeText = formatTimeOnly(task.scheduledAt || task.scheduled_at);
  if (timeText) infoBits.push(timeText);
  const infoText = infoBits.join(" · ");

  // 상태 배지 (사장님 spec 색):
  //   완료=그린계열 / 진행(active/moving)=블루계열 / 예정·대기=중성 / 외근=보라
  const pill = (() => {
    if (isExternal)              return { bg: "rgba(127,119,221,0.18)", color: "#C8C2F1", label: "외근" };
    if (task.state === "done")   return { bg: "#0F6E56", color: "#9FE1CB", label: "완료" };
    if (task.state === "active") return { bg: "#185FA5", color: "#B5D4F4", label: "진행" };
    if (task.state === "moving") return { bg: "#185FA5", color: "#B5D4F4", label: "이동" };
    if (task.state === "waiting")   return { bg: "#2c2c2a", color: "#B4B2A9", label: "대기" };
    if (task.state === "scheduled") return { bg: "#2c2c2a", color: "#B4B2A9", label: "예정" };
    return null;
  })();

  return (
    <>
      <div onClick={onClick} className="clickable" style={{
        background: t.bgElevated,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        padding: "8px 10px",
        display: "flex", alignItems: "center", gap: 8,
        minHeight: 38,
      }}>
        {/* workType 아이콘 */}
        {!isExternal && (
          <WorkIcon size={13} style={{ color: workColor, flexShrink: 0 }}/>
        )}
        {/* 고객명 */}
        <span style={{
          fontSize: 12, fontWeight: 500, color: t.text,
          flexShrink: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          maxWidth: 90,
        }}>{titleText}</span>
        {/* (모델×수량) · 지역 */}
        <span style={{
          fontSize: 11, fontWeight: 400, color: "#888",
          flex: 1, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{infoText}</span>
        {/* 기사명 박스 */}
        {task.engineer && (
          <span style={{
            fontSize: 11, fontWeight: 500, color: "#ddd",
            background: "#2a2a2a",
            padding: "2px 8px", borderRadius: 4,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}>{task.engineer}</span>
        )}
        {/* 상태 배지 */}
        {pill && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            padding: "2px 7px", borderRadius: 8,
            background: pill.bg, color: pill.color,
            flexShrink: 0, whiteSpace: "nowrap",
          }}>{pill.label}</span>
        )}
      </div>

      {/* 회사 수익 (ActivityGroupSection의 showCompanyProfit 경로만 노출 — 임시 라벨) */}
      {commission && (
        <div style={{
          margin: "0 0 6px 12px",
          display: "flex", alignItems: "center", gap: 6, fontSize: 11,
          color: t.textMuted,
        }}>
          <span>🏢</span>
          <span style={{ fontWeight: 600 }}>회사 수익</span>
          <span className="mono" style={{ color: t.textSecondary, fontWeight: 700 }}>{fmtKRW(commission.amount)}</span>
          <div style={{ flex: 1 }}/>
          <span style={{ fontSize: 9, fontStyle: "italic" }}>임시</span>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// 시안 C — 기사 오늘 (Step 4)
// ─────────────────────────────────────────────

function EngineerDayScreen({ t, engineer, onBack, onTaskClick }) {
  if (!engineer) return <PlaceholderScreen t={t} title="프로 오늘" label="프로 정보 없음" onBack={onBack}/>;

  const schedule = engineer.todaySchedule || [];
  const stats = getEngineerStats(engineer.id, TODAY_DATE);

  // 활동 카드 렌더링용 — 기사 정보 주입 (TaskCard 재사용)
  const enrichedItems = stats.items.map((a, idx) => ({
    ...a,
    taskId:        `${engineer.id}-A-${idx}`,
    engineerId:    engineer.id,
    engineer:      engineer.name,
    engineerRank:  engineer.rank,
    engineerLevel: engineer.level,
  }));

  const groups = [
    { id: "assigned",  label: "신규 배정", icon: "📋", color: t.success,
      items: enrichedItems.filter(a => a.state === "waiting"),
      showProfit: false },
    { id: "confirmed", label: "일정 확정", icon: "📅", color: t.text,
      items: enrichedItems.filter(a => a.state === "scheduled" || a.state === "moving" || a.state === "active"),
      showProfit: false },
    { id: "completed", label: "완료",     icon: "✓",  color: t.textSecondary,
      items: enrichedItems.filter(a => a.state === "done" && a.completedDate === TODAY_DATE),
      showProfit: true },
  ];

  return (
    <div className="fade-in">
      {/* 헤더 */}
      <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <EngineerBadge engineer={engineer} role={engineer.level === "main" ? "main" : (engineer.level === "backup" || engineer.level === "sub") ? "backup" : null} size="lg"/>
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
            {engineer.region} · 오늘 일정 <span className="mono" style={{ color: t.text, fontWeight: 700 }}>{schedule.length}</span>건
          </div>
        </div>
        {stats.todayAssigned > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            padding: "4px 10px",
            background: t.bgInset, border: `1px solid ${t.border}`,
            color: t.textSecondary, borderRadius: 6,
            whiteSpace: "nowrap", flexShrink: 0,
            display: "inline-flex", alignItems: "baseline", gap: 3,
          }}>
            오늘 <span className="mono" style={{ fontWeight: 800 }}>+{stats.todayAssigned}</span>
          </span>
        )}
      </div>

      <div style={{ padding: "14px 16px 16px" }}>
        {/* 활동 요약 — 3박스 grid (사장님 catch: newAssigned / confirmed / todayDone) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
          <ActivityBox t={t} label="신규 배정" value={stats.newAssigned} bg={t.successBg} color={t.success}/>
          <ActivityBox t={t} label="일정 확정" value={stats.confirmed}   bg={t.bgInset}   color={t.text}/>
          <ActivityBox t={t} label="완료"     value={stats.todayDone}   bg={t.bgInset}   color={t.textSecondary}/>
        </div>

        {/* 타임라인 헤더 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Calendar size={12} style={{ color: t.textMuted }}/>
          <div style={{ fontSize: 10, fontWeight: 800, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>
            오늘 타임라인
          </div>
        </div>

        {/* 타임라인 카드 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {schedule.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>일정 없음</div>
          ) : schedule.map((slot, idx) => {
            const isWork = slot.type === "work";
            const handleClick = isWork && onTaskClick ? () => {
              // 단일 진실 소스: TASKS_TODAY 에서 매칭 항목 찾아 전달
              const match = TASKS_TODAY.find(x => x.engineerId === engineer.id && x.taskCode === slot.taskCode);
              onTaskClick(match || { ...slot, engineer: engineer.name, engineerRank: engineer.rank, engineerLevel: engineer.level, engineerId: engineer.id });
            } : undefined;
            return <TimelineItem key={idx} t={t} slot={slot} onClick={handleClick}/>;
          })}
        </div>

        {/* ───── 활동 정보 (Step 4-3: 신규 배정만 펼침 — 작업 탭과 일관) ───── */}
        {(groups[0].items.length + groups[1].items.length + groups[2].items.length) > 0 && (
          <>
            <div style={{ height: 1, background: t.border, margin: "0 0 14px" }}/>
            {groups.map(g => g.items.length === 0 ? null : (
              <ActivityGroupSection
                key={g.id} t={t} group={g}
                defaultOpen={g.id === "assigned"}
                onTaskClick={onTaskClick}
              />
            ))}
          </>
        )}

        {/* 기사 통화 */}
        {engineer.phone && (
          <a href={`tel:${engineer.phone}`} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "11px 14px",
            background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: 10,
            color: t.accent, fontSize: 12, fontWeight: 800, textDecoration: "none",
          }}>
            <Phone size={14}/>
            <span>프로 통화</span>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>{engineer.phone}</span>
          </a>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 작업 상세 — Step 4
// ─────────────────────────────────────────────

// 사진 박스 — 기본 접힘 (Step 4-4 정정 / 사장님 catch: 작업 상세 너무 길어짐 방지)
function PhotoBox({ t, photos }) {
  const [open, setOpen] = useState(false);
  const total = (photos.before || 0) + (photos.after || 0);
  const empty = total === 0;
  const handlePhotoClick = (label) => {
    // Drive 폴더의 사진 큰 보기 모달 — 준비 중인 기능
  };
  const handleFolderClick = () => {
    // 외부 Drive 폴더 새 탭으로 열기 (URL이 있을 때)
    if (photos.driveUrl) {
      window.open(photos.driveUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 10, padding: "12px 14px", marginBottom: 8,
    }}>
      {/* 헤더 (클릭 토글) */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 6,
          background: "transparent", border: "none", cursor: "pointer",
          color: t.text, fontFamily: "inherit", textAlign: "left", padding: 0,
        }}
      >
        <span style={{ fontSize: 13 }}>📷</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>작업 사진</span>
        <span style={{ color: t.textDim }}>·</span>
        {empty ? (
          <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>사진 없음</span>
        ) : (
          <span className="mono" style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>총 {total}장</span>
        )}
        <div style={{ flex: 1 }}/>
        {open
          ? <ChevronDown size={14} style={{ color: t.textMuted }}/>
          : <ChevronRight size={14} style={{ color: t.textMuted }}/>}
      </button>

      {/* 본문 (펼침 시) */}
      {open && (
        <div style={{ marginTop: 10 }}>
          {empty ? (
            <div style={{ padding: "10px 0", color: t.textMuted, fontSize: 11, textAlign: "center" }}>
              아직 사진이 등록되지 않았어요
            </div>
          ) : (
            <>
              {photos.before > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.textSecondary, marginBottom: 6 }}>
                    🔍 작업 전 ({photos.before}장)
                  </div>
                  <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                    {Array.from({ length: photos.before }).map((_, i) => (
                      <PhotoThumbnail key={`b-${i}`} t={t} type="before" label={`Before ${i + 1}`}
                        onClick={() => handlePhotoClick(`Before ${i + 1}`)}/>
                    ))}
                  </div>
                </>
              )}
              {photos.after > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.textSecondary, marginTop: 8, marginBottom: 6 }}>
                    ✨ 작업 후 ({photos.after}장)
                  </div>
                  <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                    {Array.from({ length: photos.after }).map((_, i) => (
                      <PhotoThumbnail key={`a-${i}`} t={t} type="after" label={`After ${i + 1}`}
                        onClick={() => handlePhotoClick(`After ${i + 1}`)}/>
                    ))}
                  </div>
                </>
              )}
              <button onClick={handleFolderClick} style={{
                marginTop: 10, width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 12px",
                background: t.bgInset, color: t.textSecondary,
                border: `1px solid ${t.border}`, borderRadius: 8,
                fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>
                📂 사진 폴더 보기 →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// 사진 썸네일 — CSS 단색 박스 (Step 4-4 / 외부 의존 X)
function PhotoThumbnail({ t, label, type, onClick }) {
  const isBefore = type === "before";
  return (
    <button onClick={onClick} className="clickable" style={{
      width: 60, height: 60,
      background: t.bgInset,
      border: `1px solid ${t.border}`,
      borderRadius: 6, cursor: "pointer",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 2, flexShrink: 0,
      fontFamily: "inherit", padding: 0,
    }}>
      <div style={{ fontSize: 16, lineHeight: 1 }}>{isBefore ? "🔍" : "✨"}</div>
      <div className="mono" style={{
        fontSize: 9, fontWeight: 700,
        color: t.textSecondary,
        lineHeight: 1.2,
      }}>{label}</div>
    </button>
  );
}

function TaskDetailScreen({ t, task, onBack, onCancelTask, onVisitOnly, onMemoAdd, onEdit, onHistory, onPartialCancel, onSetCompensation, user }) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showVisitOnlyDialog, setShowVisitOnlyDialog] = useState(false);
  const [showPartialDialog, setShowPartialDialog] = useState(false);
  const memos = task ? loadMemos(task.id) : [];
  const historyCount = task ? getHistoryCount(task.id) : 0;
  const canSeeHistory = user && ["owner", "admin"].includes(user.role);
  if (!task) return <PlaceholderScreen t={t} title="작업 상세" label="작업 정보 없음" onBack={onBack}/>;

  const isExternal = task.type === "external";
  const total      = (task.estimateTotal || 0) + (task.addonFee || 0);
  const principalColor = PRINCIPAL_COLORS[task.principal] || t.textSecondary;
  const fmtKRW = (n) => `₩${(n || 0).toLocaleString("ko-KR")}`;

  // 진행 상태 표기
  const stateLabel = (() => {
    if (isExternal) return { icon: "🌐", label: "외근", color: t.purple, sub: task.note };
    if (task.state === "done")      return { icon: "✓",  label: "완료",   color: t.textSecondary, sub: task.completedAt ? `완료 ${formatTimeOnly(task.completedAt)}` : null };
    if (task.state === "active")    return { icon: "🟢", label: "진행중", color: t.success,        sub: task.startedAt  ? `시작 ${formatTimeOnly(task.startedAt)}` : null };
    if (task.state === "moving")    return { icon: "🟡", label: "이동중", color: t.warning,        sub: null };
    if (task.state === "waiting")   return { icon: "⏳", label: "대기 중", color: t.textMuted,      sub: null };
    if (task.state === "scheduled") return { icon: "📅", label: "예정",   color: t.text,           sub: task.time ? `예정 ${task.time}` : null };
    return { icon: "—", label: "미정", color: t.textMuted, sub: null };
  })();

  const Box = ({ children, style }) => (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 10, padding: "12px 14px", marginBottom: 8,
      ...style,
    }}>{children}</div>
  );

  const Row = ({ icon, label, value, valueStyle }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, lineHeight: 1.6, fontSize: 12 }}>
      {icon && <span style={{ fontSize: 12, width: 16, textAlign: "center", flexShrink: 0 }}>{icon}</span>}
      {label && <span style={{ color: t.textMuted, fontWeight: 600, minWidth: 64, flexShrink: 0 }}>{label}</span>}
      <span style={{ color: t.text, flex: 1, minWidth: 0, ...(valueStyle || {}) }}>{value}</span>
    </div>
  );

  // V10 — 헤더 [⋯] 메뉴 액션 통합
  function handleMenuAction(action, taskArg) {
    if (action === "call") {
      const phone = taskArg.phone;
      if (phone) window.location.href = `tel:${phone}`;
      return;
    }
    if (action === "memo")        return onMemoAdd && onMemoAdd();
    if (action === "edit")        return onEdit && onEdit();
    if (action === "visit_only")  return setShowVisitOnlyDialog(true);
    if (action === "cancel")      return setShowCancelDialog(true);
    // 그 외 (detail/change_engineer/change_schedule/complete/partial)는 무시
    // (이 화면에서는 자체 액션 또는 단계별 큰 버튼이 처리)
  }

  return (
    <div className="fade-in">
      {/* 헤더 */}
      <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>작업 상세</div>
          {task.taskCode && (
            <div className="mono" style={{ fontSize: 10, color: t.textMuted, marginTop: 2, fontWeight: 600 }}>
              {task.taskCode}
            </div>
          )}
        </div>
        <TaskCardMenu task={task} onAction={handleMenuAction}/>
      </div>

      <div style={{ padding: "14px 16px 20px" }}>
        {/* 원청 + 작업번호 */}
        {(task.principal || task.taskCode) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            {task.principal && (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: "3px 8px",
                background: principalColor + "1F", color: principalColor,
                borderRadius: 4,
              }}>{task.principal}</span>
            )}
            {task.taskCode && (
              <span className="mono" style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>
                {task.taskCode}
              </span>
            )}
          </div>
        )}

        {/* 고객 정보 */}
        <Box>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Row icon="👤" value={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{isExternal ? (task.note || "외근") : (task.customer || "—")}</span>
                {task.hasRefrigerant && task.workType !== "냉매충전" && (
                  <Zap size={13} style={{ color: t.warning }} aria-label="냉매 포함"/>
                )}
              </span>
            }/>
            {task.phone && (
              <Row icon="📞"
                value={
                  <a href={`tel:${task.phone}`} className="mono" style={{ color: t.accent, fontWeight: 700, textDecoration: "none" }}>
                    {task.phone}
                  </a>
                }/>
            )}
            {task.address && <Row icon="📍" value={<span style={{ color: t.textSecondary }}>{task.address}</span>}/>}
          </div>
        </Box>

        {/* 작업 정보 */}
        <Box>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Step 5-1c — workItems 복수면 항목별 리스트 */}
            {/* Step 2-B-2 — KA 1way 분리 저장된 항목은 합쳐서 표시 */}
            {(() => {
              const displayItems = mergeKaOneway(task.workItems);
              if (!Array.isArray(displayItems) || displayItems.length <= 1) return null;
              return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ fontSize: 12, width: 16, textAlign: "center", flexShrink: 0 }}>🔧</span>
                  <span style={{ color: t.textMuted, fontWeight: 600 }}>작업 항목</span>
                  <span className="mono" style={{ color: t.accent, fontWeight: 800 }}>{displayItems.length}건</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 24, marginTop: 2 }}>
                  {displayItems.map((item, idx) => (
                    <div key={idx} style={{ fontSize: 12, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="mono" style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, minWidth: 18 }}>#{idx + 1}</span>
                      <span style={{ fontWeight: 700 }}>{item.workType}</span>
                      {item.workType !== "냉매충전" && item.appliance && (
                        <span style={{ color: t.textMuted }}>· {item.appliance}</span>
                      )}
                      <span className="mono" style={{ color: t.accent, fontWeight: 700 }}>×{item.qty || 1}</span>
                    </div>
                  ))}
                </div>
                <div style={{ paddingLeft: 24, fontSize: 10, color: t.textMuted, fontWeight: 600 }}>
                  · 총 작업 <span className="mono" style={{ color: t.textSecondary, fontWeight: 700 }}>{displayItems.reduce((s, x) => s + (x.qty || 0), 0)}</span>대
                </div>
              </>
              );
            })() || (
              <Row icon="🔧" value={
                <span>
                  <span style={{ fontWeight: 700 }}>{isExternal ? "외근" : task.workType}</span>
                  {task.qty ? <span style={{ color: t.textMuted }}> ×{task.qty}</span> : null}
                  {task.appliance ? <span style={{ color: t.textMuted }}> · {task.appliance}</span> : null}
                </span>
              }/>
            )}
            <Row icon="📅" value={
              <span className="mono" style={{ color: t.text, fontWeight: 700 }}>{task.time}</span>
            }/>
            {task.region && (
              <Row icon="📍" label="지역" value={<span style={{ color: t.textSecondary }}>{task.region}</span>}/>
            )}
          </div>
        </Box>

        {/* 금액 — state별 분기 (사장님 catch: 현장추가는 완료 후만 표시) */}
        {!isExternal && (task.estimateTotal != null) && (() => {
          const isDone = task.state === "done";
          const sumEstimate = task.estimateTotal || 0;
          const sumTotal    = isDone ? sumEstimate + (task.addonFee || 0) : sumEstimate;
          return (
            <Box>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: t.textMuted, fontWeight: 600 }}>💰 견적금액</span>
                  <span className="mono" style={{ color: t.text, fontWeight: 700 }}>{fmtKRW(sumEstimate)}</span>
                </div>
                {isDone && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: t.textMuted, fontWeight: 600 }}>현장 추가</span>
                    <span className="mono" style={{ color: task.addonFee ? t.warning : t.textMuted, fontWeight: 700 }}>
                      {fmtKRW(task.addonFee || 0)}
                    </span>
                  </div>
                )}
                <div style={{ height: 1, background: t.border, margin: "2px 0" }}/>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: t.text, fontWeight: 800 }}>{isDone ? "합계" : "예상 합계"}</span>
                  <span className="mono" style={{ color: t.text, fontWeight: 800, fontSize: 13 }}>{fmtKRW(sumTotal)}</span>
                </div>
                {!isDone && (
                  <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2, fontStyle: "italic" }}>
                    ※ 현장추가는 작업 완료 후 입력
                  </div>
                )}
              </div>
            </Box>
          );
        })()}

        {/* 회사 수익 — 사장님 catch (Step 4-2): 완료(done)에서만 표시 / "임시" 라벨 */}
        {!isExternal && task.principal && task.state === "done" && (() => {
          const c = calculateCommission(task);
          const rateText = c.rate == null ? `정액 ${fmtKRW(c.amount)}` : `${c.rate}% 비율`;
          return (
            <Box>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, width: 16, textAlign: "center", flexShrink: 0 }}>🏢</span>
                  <span style={{ color: t.text, fontWeight: 800 }}>회사 수익</span>
                  <div style={{ flex: 1 }}/>
                  <span style={{ fontSize: 9, color: t.textMuted, fontWeight: 600, fontStyle: "italic" }}>
                    임시 — 정책 v5 적용 예정
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: t.textMuted, fontWeight: 600 }}>원청</span>
                  <span style={{ color: principalColor, fontWeight: 800 }}>{task.principal}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: t.textMuted, fontWeight: 600 }}>정산 방식</span>
                  <span className="mono" style={{ color: t.textSecondary, fontWeight: 700 }}>{rateText}</span>
                </div>
                <div style={{ height: 1, background: t.border, margin: "2px 0" }}/>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: t.success, fontWeight: 800 }}>✓ 확정 수익</span>
                  <span className="mono" style={{
                    color: t.success, fontWeight: 800, fontSize: 13,
                  }}>{fmtKRW(c.amount)}</span>
                </div>
              </div>
            </Box>
          );
        })()}

        {/* 요청사항 */}
        {task.memo && (
          <Box>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.6, fontSize: 12 }}>
              <span style={{ fontSize: 12, width: 16, textAlign: "center", flexShrink: 0, marginTop: 1 }}>📝</span>
              <span style={{ color: t.textSecondary, fontStyle: "italic" }}>"{task.memo}"</span>
            </div>
          </Box>
        )}

        {/* 담당 기사 */}
        {task.engineer && (
          <Box>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ fontSize: 12, width: 16, textAlign: "center", flexShrink: 0 }}>👷</span>
              <EngineerBadge
                engineer={{ name: task.engineer, careerLevel: getCareerLevel({ rank: task.engineerRank, level: task.engineerLevel }) }}
                role={task.engineerLevel === "main" ? "main" : (task.engineerLevel === "backup" || task.engineerLevel === "sub") ? "backup" : null}
                size="lg"
              />
            </div>
          </Box>
        )}

        {/* 진행 상태 */}
        <Box>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ fontSize: 12, width: 16, textAlign: "center", flexShrink: 0 }}>📋</span>
            <span style={{ color: t.textMuted, fontWeight: 600, minWidth: 64 }}>진행 상태</span>
            <span style={{ fontSize: 12 }}>{stateLabel.icon}</span>
            <span style={{ color: stateLabel.color, fontWeight: 800 }}>{stateLabel.label}</span>
            {stateLabel.sub && (
              <span className="mono" style={{ color: t.textMuted, fontSize: 11, fontWeight: 600 }}>· {stateLabel.sub}</span>
            )}
          </div>
        </Box>

        {/* 작업 사진 — 완료(done)만 / Step 4-4 정정: 기본 접힘 */}
        {task.state === "done" && task.photos && (
          <PhotoBox t={t} photos={task.photos}/>
        )}

        {/* V10 — 통화/메모/수정은 헤더 [⋯] 메뉴로 통합 (큰 버튼 3개 제거) */}

        {/* Step 11 — 수정 이력 (운영자/관리자 + 1건 이상) */}
        {canSeeHistory && historyCount > 0 && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => onHistory && onHistory()}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "transparent",
                border: `1px solid ${t.border}`,
                color: t.textSecondary,
                fontSize: 12, fontWeight: 600,
                borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              📜 수정 이력 보기 <span className="mono" style={{ color: t.accent, fontWeight: 700 }}>({historyCount}건)</span>
            </button>
          </div>
        )}

        {/* Step 8+9 V8 — 메모 섹션 */}
        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: `1px solid ${t.border}`,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary }}>
              📝 메모 <span className="mono" style={{ color: t.textMuted, fontWeight: 600 }}>{memos.length}</span>
            </span>
            <button
              onClick={() => onMemoAdd && onMemoAdd()}
              style={{
                background: "transparent", border: `1px solid ${t.border}`,
                color: t.accent, fontSize: 11, fontWeight: 600,
                padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
              }}
            >＋ 메모 추가</button>
          </div>
          {memos.length === 0 ? (
            <div style={{
              fontSize: 11, color: t.textMuted,
              padding: "10px 12px",
              background: t.bgInset, borderRadius: 8,
              textAlign: "center",
            }}>아직 메모가 없습니다</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {memos.map(m => (
                <div key={m.id} style={{
                  background: t.bgElevated, border: `1px solid ${t.border}`,
                  borderRadius: 8, padding: "8px 10px",
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    marginBottom: 4, fontSize: 10, color: t.textMuted, fontWeight: 600,
                  }}>
                    <span>{getMemoTypeLabel(m.type)}</span>
                    <span className="mono">
                      {new Date(m.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: t.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2026-05-25 Round 2 — 액션 박스: 전 상태(취소 제외) 표시. 부분취소 + 전체취소.
              · 기존 'state !== "done"' 가드 제거 — 완료 건도 즉시 취소 가능 (사장님 spec).
              · 새 ◐ 부분 취소 버튼 — admin_partial_cancel_item RPC.
              · 기존 ⚫ 작업 취소 → admin_full_cancel RPC (옛 approveCancelAdapter 폐기). */}
        {!isExternal && task.status !== "취소" && (
          <div style={{
            marginTop: 18, paddingTop: 14,
            borderTop: `1px solid ${t.border}`,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            {(task.state === "active" || task.state === "moving") && (
              <button
                onClick={() => setShowVisitOnlyDialog(true)}
                style={{
                  width: "100%", padding: "12px",
                  background: "rgba(245, 158, 11, 0.10)",
                  border: "1px solid rgba(245, 158, 11, 0.30)",
                  color: "#FF1B8D", fontSize: 13, fontWeight: 600,
                  borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                }}
              >🚗 출장비만 정산 (작업 못함)</button>
            )}
            <button
              onClick={() => setShowPartialDialog(true)}
              style={{
                width: "100%", padding: "12px",
                background: "rgba(156, 163, 175, 0.10)",
                border: "1px solid rgba(156, 163, 175, 0.30)",
                color: "#9CA3AF", fontSize: 13, fontWeight: 600,
                borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
              }}
            >◐ 품목별 취소</button>
            <button
              onClick={() => setShowCancelDialog(true)}
              style={{
                width: "100%", padding: "12px",
                background: "rgba(239, 68, 68, 0.10)",
                border: "1px solid rgba(239, 68, 68, 0.30)",
                color: "#FF3D5A", fontSize: 13, fontWeight: 600,
                borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
              }}
            >⚫ 작업 전체 취소</button>
          </div>
        )}

        {/* 2026-05-25 Round 2 — 기사 수고비 컨트롤 (취소된 task + 배정기사 있을 때만).
              · admin_set_cancel_compensation RPC 호출.
              · 옵션 2개: visit_fee(출장비만, 30000 또는 task.travel_fee) / none(없음, 0). */}
        {task.status === "취소" && task.assigned_engineer_id && (
          <div style={{
            marginTop: 18, paddingTop: 14,
            borderTop: `1px solid ${t.border}`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 8 }}>
              기사 수고비 (취소 작업)
            </div>
            <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 10 }}>
              배정: <strong style={{ color: t.text }}>{task.assignedEngineer || "—"}</strong>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { kind: "visit_fee", label: "출장비만", amountHint: task.travel_fee ? `₩${Number(task.travel_fee).toLocaleString("ko-KR")}` : "₩30,000" },
                { kind: "none",      label: "없음",     amountHint: "₩0" },
              ].map(opt => {
                const active = task.cancelEngineerCompKind === opt.kind;
                return (
                  <button
                    key={opt.kind}
                    onClick={() => onSetCompensation && onSetCompensation(opt.kind)}
                    style={{
                      flex: 1, padding: "10px 8px",
                      background: active ? "rgba(255, 27, 141, 0.12)" : t.bgInset,
                      border: `1px solid ${active ? "#FF1B8D" : t.border}`,
                      color: active ? "#FF1B8D" : t.textSecondary,
                      fontSize: 12, fontWeight: 700,
                      borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                    }}
                  >
                    <span>{opt.label}</span>
                    <span className="mono" style={{ fontSize: 10, fontWeight: 500 }}>{opt.amountHint}</span>
                  </button>
                );
              })}
            </div>
            {task.cancelEngineerCompAmount != null && (
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 8, textAlign: "right" }}>
                현재 적용: <span className="mono">₩{Number(task.cancelEngineerCompAmount).toLocaleString("ko-KR")}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 취소 다이얼로그 */}
      {showCancelDialog && (
        <TaskCancelDialog
          task={task}
          onClose={() => setShowCancelDialog(false)}
          onConfirm={(reasonId, memo) => {
            setShowCancelDialog(false);
            onCancelTask && onCancelTask(reasonId, memo);
          }}
        />
      )}

      {/* 부분취소 다이얼로그 (Round 2) */}
      {showPartialDialog && (
        <PartialCancelDialog
          task={task}
          onClose={() => setShowPartialDialog(false)}
          onConfirm={async (itemIds, reason) => {
            setShowPartialDialog(false);
            if (onPartialCancel) await onPartialCancel(itemIds, reason);
          }}
        />
      )}

      {/* 출장비만 다이얼로그 */}
      {showVisitOnlyDialog && (
        <VisitOnlyDialog
          task={task}
          onClose={() => setShowVisitOnlyDialog(false)}
          onConfirm={(payload) => {
            setShowVisitOnlyDialog(false);
            onVisitOnly && onVisitOnly(payload);
          }}
        />
      )}
    </div>
  );
}

// Step 8+9 V2 — 작업 취소 다이얼로그 (사유 4개 + 메모)
function TaskCancelDialog({ task, onClose, onConfirm }) {
  const reasons = [
    { id: "customer", emoji: "🙅", label: "고객 사정으로 취소", desc: "일정 변경 / 단순 변심 등" },
    { id: "schedule", emoji: "📅", label: "일정 조율 실패",     desc: "프로·고객 시간이 안 맞음" },
    { id: "onsite",   emoji: "⚠️", label: "현장 작업 불가",     desc: "기종 다름 / 접근 불가 등" },
    { id: "other",    emoji: "📝", label: "기타",              desc: "메모에 상세 입력" },
  ];
  const [selectedId, setSelectedId] = useState("customer");
  const [memo, setMemo] = useState("");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)", zIndex: 100,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, maxHeight: "85vh",
          background: "#1A1512", borderRadius: "16px 16px 0 0",
          padding: "20px 16px", overflow: "auto",
          fontFamily: "-apple-system, 'Pretendard', sans-serif",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "#FAF8F5", marginBottom: 4 }}>
          작업 취소
        </div>
        <div style={{ fontSize: 11, color: "#888780", marginBottom: 16 }}>
          {task?.customer ? `${task.customer} · ` : ""}취소 사유를 선택해주세요
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {reasons.map(r => {
            const active = selectedId === r.id;
            return (
              <div
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                style={{
                  padding: "12px 14px",
                  background: active ? "rgba(239,68,68,0.10)" : "#221C18",
                  border: `1px solid ${active ? "#FF3D5A" : "#2A2420"}`,
                  borderRadius: 8, cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14 }}>{r.emoji}</span>
                  <span style={{
                    fontSize: 13, color: active ? "#FF3D5A" : "#FAF8F5",
                    fontWeight: active ? 600 : 500,
                  }}>{r.label}</span>
                </div>
                <div style={{ fontSize: 10, color: "#888780", paddingLeft: 22 }}>
                  {r.desc}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 6, fontWeight: 500 }}>
            메모 (선택)
          </div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 고객 일정이 갑자기 변경됨"
            rows={2}
            style={{
              width: "100%", background: "#221C18",
              border: "1px solid #2A2420", borderRadius: 8,
              padding: "10px 12px", color: "#fff",
              fontSize: 12, fontFamily: "inherit",
              outline: "none", boxSizing: "border-box", resize: "vertical",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, background: "#221C18", border: "1px solid #2A2420",
            color: "#888780", fontSize: 14, fontWeight: 500,
            padding: 12, borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
          }}>닫기</button>
          <button onClick={() => onConfirm(selectedId, memo)} style={{
            flex: 2, background: "#FF3D5A", border: "none",
            color: "#fff", fontSize: 14, fontWeight: 600,
            padding: 12, borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
          }}>취소 확정</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 시안 5-V3 — 추천 기사 (Step 2-3 ✓)
// ─────────────────────────────────────────────

// ============================================
// Step 5-3 — 자동 배정 화면 (auto_first_accept workflow)
// 후보 기사 알림 전송 → 3초 카운트다운 → 첫 후보 자동 수락 (Phase 1 mock)
// Phase 2 — Web Push + Supabase Realtime 실시간 처리
// ============================================
function AutoAssignScreen({ t, task, apiEngineers = [], onBack, onComplete, onFallbackManual }) {
  const [candidates, setCandidates] = useState([]);
  // 2026-05-21 — 전체 기사 검색 모달 (= 권한 측 측 기사 측 측 측 측 측 spec)
  const [showAllEngineers, setShowAllEngineers] = useState(false);
  // 2026-05-14 — 자동 수락 시뮬레이션 박지 X (countdown / acceptedEngineer state 박지 X)
  // 운영 의도: 기사 PWA 측 [수락] 박은 영역만 박힘 / 운영자 측 [강제 배정] 박은 영역만 박힘

  // Phase 3-10 — PWA 클라이언트 추천 (recommendEngineersGroupedAdapter)
  useEffect(() => {
    if (!task?.id) return;
    // 2026-05-14 — early return 박지 X / setCandidates 박힘 보장
    // 무한 catch 측 DB 사전 조회 측만 박음 (supabase.update 박는 영역에서 catch)
    let cancelled = false;
    const mainWorkType = determineMainWorkType(task.workItems) || task.workType;
    const region = task.region || "";
    const principal = task.principal || "";
    console.log('[Phase 3-10 AutoAssign] recommendEngineers', { workType: mainWorkType, principal, region });
    (async () => {
      try {
        const res = await recommendEngineersGroupedAdapter(mainWorkType, principal, region);
        console.log('[V14 AutoAssign] 응답:', res);
        if (cancelled) return;
        if (!res || res.ok === false) {
          // 폴백 (옛 시뮬 mock)
          const headItem = (task.workItems && task.workItems[0]) || { appliance: task.appliance };
          const broadcast = getAutoBroadcastCandidates(mainWorkType, region, headItem.appliance, task.pushCount || 10);
          setCandidates(broadcast);
          return;
        }
        // main / sub / capable 합쳐서 4명까지 박기
        const main    = res.main    || res.recommended?.main    || [];
        const sub     = res.sub     || res.recommended?.sub     || [];
        const capable = res.capable || res.recommended?.capable || [];
        const flat = Array.isArray(res.recommended) ? res.recommended : (Array.isArray(res.engineers) ? res.engineers : null);
        let allCandidates = [];
        if (flat && main.length === 0 && sub.length === 0 && capable.length === 0) {
          allCandidates = flat;
        } else {
          allCandidates = [...main, ...sub, ...capable];
        }
        // 2026-05-21 — 발송 대상 4 → 10명 (사장님 spec)
        const broadcast = allCandidates.slice(0, task.pushCount || 10);
        console.log('[V14 AutoAssign] candidates:', broadcast.length, '명');
        setCandidates(broadcast);

        // Phase 4 후속 — DB tasks.push_candidates 박음 (기사 PWA 측 Realtime 측 catch)
        // 2026-05-14 fix — 2중 방어:
        //   1차: module-level Set (위 박힌 영역 / 같은 페이지 라이프타임 catch)
        //   2차: DB 사전 조회 박은 후 빈 배열 측만 박음 (서버 측 보호 / 새로고침 박아도 catch)
        if (task?.id && broadcast.length > 0) {
          // 2026-05-15 fix — c.id만 박음 (GAS 시트 매칭 키 = engineer.id = "E022" 패턴)
          // 옛 [c.name, c.engineerId, c.id]: c.engineerId는 undefined (필드 X), c.name은 GAS 매칭 X
          //   → 50% 매칭 + 호출 부담 2배. 정답은 c.id 단독 = 100% 매칭.
          const candidateKeys = broadcast.map(c => c.id).filter(Boolean);
          try {
            // 사전 조회 — DB 측 push_candidates 박힌 영역 catch
            const { data: current, error: selErr } = await supabase
              .from('tasks')
              .select('push_candidates')
              .eq('id', task.id)
              .single();
            if (selErr) {
              console.error('[AutoAssign 사전 조회 에러]', selErr);
            }
            const existingDb = current?.push_candidates || [];
            if (existingDb.length > 0) {
              return;
            }

            const { error: pushErr } = await supabase
              .from('tasks')
              .update({ push_candidates: candidateKeys })
              .eq('id', task.id);
            if (pushErr) console.error('[AutoAssign push_candidates]', pushErr);
            else console.log('[AutoAssign] push_candidates 박힘:', candidateKeys.length, '명');
          } catch (pushErr) {
            console.error('[AutoAssign push_candidates] 에러:', pushErr);
          }
        }
      } catch (e) {
        console.error('[V14 AutoAssign] 에러:', e);
        if (cancelled) return;
        const headItem = (task.workItems && task.workItems[0]) || { appliance: task.appliance };
        const broadcast = getAutoBroadcastCandidates(mainWorkType, region, headItem.appliance, task.pushCount || 4);
        setCandidates(broadcast);
      }
    })();
    return () => { cancelled = true; };
    // 2026-05-14 fix — task 객체 identity 변경 catch 박지 X / id만 박음 (무한 루프 catch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  // 2026-05-14 — 자동 수락 시뮬레이션 박지 X
  // 옛 흐름:
  //   · 3초 카운트다운 박힘 → countdown===0 → setAcceptedEngineer(candidates[0]) 박음 (mock)
  //   · acceptedEngineer state 박힘 → "프로 수락!" 화면 박힘 → [확인] 박은 후 DB UPDATE
  // 신규 흐름:
  //   · 카운트다운 박지 X / 자동 수락 박지 X
  //   · 후보 카드 측 "수락 대기 중" 박힘 — 기사 PWA 측 [수락] 박은 영역 박힘
  //   · Realtime 측 자동 반영 박힘 (useRealtimeTasks)
  //   · 후보 카드 각각 측 [강제 배정] 버튼 박음 — onComplete 호출 (운영자 강제 배정)

  if (!task) {
    return <PlaceholderScreen t={t} title="자동 배정" label="작업 정보 없음" onBack={onBack}/>;
  }

  const mainWorkType = determineMainWorkType(task.workItems) || task.workType;
  const headItem = (task.workItems && task.workItems[0]) || { appliance: task.appliance, qty: task.qty };
  const principalColor = PRINCIPAL_COLORS[task.principal] || t.textSecondary;
  const itemSummary = (task.workItems && task.workItems.length > 0)
    ? formatWorkItems(task.workItems)
    : `${mainWorkType}${headItem.qty ? ` ×${headItem.qty}` : ""}`;

  // ===== 결과 화면 박지 X (자동 수락 시뮬레이션 박지 X / 2026-05-14)
  // 옛 흐름 측 박은 영역 — 강제 배정 박힌 영역 측 onComplete 박은 후 toast + replaceScreen 박음
  // eslint-disable-next-line no-constant-condition
  if (false) {
    return (
      <div className="fade-in">
        <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
            <ArrowLeft size={18}/>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>자동 배정 완료</div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
              {mainWorkType} · {extractZone(task.region) || task.region || "—"}
            </div>
          </div>
        </div>

        <div style={{ padding: "24px 16px 20px" }}>
          {/* 큰 성공 박스 — 가운데 강조 */}
          <div style={{
            background: t.successBg || "rgba(34,197,94,0.10)",
            border: `2px solid ${t.success}`,
            borderRadius: 16,
            padding: "32px 20px",
            textAlign: "center",
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 48, color: t.success, marginBottom: 12, fontWeight: 800, lineHeight: 1 }}>✓</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.success, marginBottom: 6 }}>
              {acceptedEngineer.name} 프로 수락!
            </div>
            <div style={{ fontSize: 11, color: t.textSecondary }}>자동 배정 완료</div>
          </div>

          {/* 작업 정보 박스 */}
          <div style={{
            background: t.bgElevated, border: `1px solid ${t.border}`,
            borderRadius: 12, padding: "12px 14px", marginBottom: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              {task.principal && <PrincipalLabel name={task.principal}/>}
              <span style={{ fontSize: 13, fontWeight: 800 }}>{task.customer || "—"}</span>
            </div>
            <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 4 }}>
              {itemSummary} · {task.region || "—"}
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span>담당:</span>
              <EngineerBadge engineer={acceptedEngineer} role={acceptedEngineer.level === "main" ? "main" : (acceptedEngineer.level === "backup" || acceptedEngineer.level === "sub") ? "backup" : null} size="sm"/>
              {acceptedEngineer.phone && (
                <a href={`tel:${acceptedEngineer.phone}`} className="mono" style={{ color: t.accent, fontWeight: 700, textDecoration: "none" }}>
                  {acceptedEngineer.phone}
                </a>
              )}
            </div>
          </div>

          {/* 후보 결과 박스 — 첫 후보 ✓ 강조 / 나머지 ⊘ 취소 */}
          {candidates.length > 0 && (
            <div style={{
              background: t.bgElevated, border: `1px solid ${t.border}`,
              borderRadius: 12, padding: "12px 14px", marginBottom: 12,
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
                후보 결과 ({candidates.length}명)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {candidates.map((eng) => {
                  const isAccepted = eng.id === acceptedEngineer.id;
                  const zones = getEngineerZoneList(eng.name, mainWorkType);
                  const zoneText = zones.length > 0 ? zones.slice(0, 3).join("·") : (eng.regionLabel || "—");
                  return (
                    <div key={eng.id} style={{
                      padding: "8px 10px",
                      background: isAccepted ? (t.accentBg || "rgba(255,27,141,0.08)") : t.bgInset,
                      border: isAccepted ? `1px solid ${t.accent}` : `1px solid transparent`,
                      borderRadius: 8,
                      display: "flex", alignItems: "center", gap: 6,
                      opacity: isAccepted ? 1 : 0.4,
                    }}>
                      <span style={{ fontSize: 12, color: isAccepted ? t.accent : t.textMuted, fontWeight: 800 }}>
                        {isAccepted ? "✓" : "⊘"}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isAccepted ? t.accent : t.textSecondary }}>{eng.name}</span>
                      <span style={{ fontSize: 10, color: t.textMuted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>— {zoneText}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: isAccepted ? t.accent : t.textMuted, whiteSpace: "nowrap" }}>
                        {isAccepted ? "수락!" : "취소"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 확인 버튼 */}
          <button
            onClick={() => onComplete(acceptedEngineer)}
            style={{
              width: "100%",
              padding: "14px",
              background: t.accent, color: "white", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            }}
          >확인</button>
        </div>
      </div>
    );
  }

  // ===== 수락 대기 중 / 후보 없음 화면 =====
  console.log('[AutoAssign] 후보 표시 — 기사 수락 대기 중', candidates.length, '명');

  return (
    <div className="fade-in">
      <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>수락 대기 중</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
            {mainWorkType} · {extractZone(task.region) || task.region || "—"}
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 16px 20px" }}>
        {/* 작업 정보 박스 */}
        <div style={{
          background: t.bgElevated, border: `1px solid ${t.border}`,
          borderRadius: 12, padding: "12px 14px", marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            {task.principal && (
              <span style={{
                fontSize: 9, fontWeight: 800, padding: "2px 6px",
                background: principalColor + "26", color: principalColor,
                borderRadius: 4,
              }}>{task.principal}</span>
            )}
            <span style={{ fontSize: 13, fontWeight: 800 }}>{task.customer || "—"}</span>
            <span style={{ fontSize: 11, color: t.textSecondary }}>({itemSummary})</span>
          </div>
          <div style={{ fontSize: 11, color: t.textSecondary }}>
            {task.region || "—"}{task.schedule ? ` · ${task.schedule}` : ""}
          </div>
        </div>

        {candidates.length === 0 ? (
          /* 후보 없음 */
          <div style={{
            background: t.bgElevated, border: `1px solid ${t.border}`,
            borderRadius: 12, padding: "20px 14px", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, marginBottom: 10, opacity: 0.4 }}>📡</div>
            <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 6 }}>후보 프로 없음</div>
            <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 14 }}>
              이 지역 ({extractZone(task.region) || "—"})에 배정 가능한 냉매 프로가 없습니다.
            </div>
            <button
              onClick={onFallbackManual}
              style={{
                padding: "8px 14px",
                background: t.bgInset, color: t.text,
                border: `1px solid ${t.border}`, borderRadius: 8,
                fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}
            >수동 배정으로</button>
          </div>
        ) : (
          /* 후보 알림 + 수락 대기 중 + 강제 배정 버튼 */
          <>
            {/* 상단 안내 */}
            <div style={{
              background: t.bgElevated, border: `1px solid ${t.border}`,
              borderRadius: 12, padding: "14px", marginBottom: 10,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 16, marginBottom: 6 }}>📡</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: t.text, marginBottom: 4 }}>
                <span className="mono" style={{ color: t.accent }}>{candidates.length}</span>명의 프로에게 알림 발송됨
              </div>
              <div style={{ fontSize: 11, color: t.textMuted }}>
                기사가 수락하면 자동으로 배정됩니다
              </div>
            </div>

            {/* 후보 카드 — 각각 [강제 배정] 버튼 박힘 */}
            <div style={{
              background: t.bgElevated, border: `1px solid ${t.border}`,
              borderRadius: 12, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
                알림 발송 ({candidates.length}명)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {candidates.map((eng) => {
                  const zones = getEngineerZoneList(eng.name, mainWorkType);
                  const zoneText = zones.length > 0 ? zones.slice(0, 3).join("·") : (eng.regionLabel || "—");
                  return (
                    <div key={eng.id} style={{
                      padding: "10px 12px", background: t.bgInset, borderRadius: 8,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ fontSize: 12 }}>⚪</span>
                      <EngineerBadge engineer={eng} size="sm"/>
                      <span style={{ fontSize: 10, color: t.textMuted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>— {zoneText}</span>
                      <button
                        onClick={() => onComplete(eng)}
                        style={{
                          padding: "6px 10px",
                          background: t.accent, color: "white",
                          border: "none", borderRadius: 6,
                          fontSize: 10, fontWeight: 700, cursor: "pointer",
                          fontFamily: "inherit", whiteSpace: "nowrap",
                        }}
                      >강제 배정</button>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 8, lineHeight: 1.5 }}>
                * 긴급/노쇼 측 [강제 배정] 사용 — 운영자 측 직접 배정 spec
              </div>
            </div>

            {/* 2026-05-21 — 전체 기사 검색 (권한 측 측 측 기사 측 측 측) */}
            <button
              onClick={() => setShowAllEngineers(true)}
              style={{
                marginTop: 10, width: "100%",
                padding: "12px 14px",
                background: t.bgInset, color: t.text,
                border: `1px dashed ${t.border}`, borderRadius: 10,
                fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              🔍 전체 기사에서 검색 (발송 대상 외)
            </button>
          </>
        )}

      </div>

      {/* 2026-05-21 — AllEngineersModal 측 (RecommendScreen 측 동일 spec) */}
      {showAllEngineers && (
        <AllEngineersModal
          task={task}
          engineers={apiEngineers && apiEngineers.length > 0 ? apiEngineers : undefined}
          onSelect={(engineerId, engineer) => {
            setShowAllEngineers(false);
            onComplete(engineer);
          }}
          onClose={() => setShowAllEngineers(false)}
        />
      )}
    </div>
  );
}

function RecommendScreen({ t, task, onBack, onAssign, onEngineerCardClick, assigning = false, assignError = "", apiEngineers = [] }) {
  // V11-10 — 모든 기사에서 선택 모달 (지역 매칭 X일 때 활성화)
  const [showAllEngineers, setShowAllEngineers] = useState(false);

  // V14 2B-3 — 진짜 시트 catch (옛 ENGINEERS_MASTER + ZONE_MAPPINGS mock 폐기)
  const [apiCandidates, setApiCandidates] = useState({ main: [], sub: [], capable: [] });
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiDebug, setApiDebug] = useState(null);

  const mainWorkType = task ? (determineMainWorkType(task.workItems) || task.workType) : "";
  const headItem = task ? ((task.workItems && task.workItems[0]) || { appliance: task.appliance, qty: task.qty }) : {};

  useEffect(() => {
    if (!task || !mainWorkType) return;
    let cancelled = false;
    (async () => {
      setApiLoading(true);
      setApiError("");
      setApiDebug(null);
      try {
        const region = task.region || "";
        const principal = task.principal || "";
        console.log('[Phase 3-10 추천] recommendEngineers', { workType: mainWorkType, principal, region });
        const res = await recommendEngineersGroupedAdapter(mainWorkType, principal, region);
        console.log('[V14 2B-3] 응답:', res);
        if (cancelled) return;
        if (!res || res.ok === false) {
          setApiError((res && res.error) || '추천 프로 catch X');
          setApiDebug({ phase: 'error', res });
          return;
        }
        // 응답 shape catch 다양성 (recommended / data / engineers / 그룹별 분리 등)
        const main    = res.main    || res.recommended?.main    || [];
        const sub     = res.sub     || res.recommended?.sub     || [];
        const capable = res.capable || res.recommended?.capable || [];
        // 응답이 평면 배열 (recommended)이면 group 박지 X → main에 박기
        const flat = Array.isArray(res.recommended) ? res.recommended : (Array.isArray(res.engineers) ? res.engineers : null);
        if (flat && main.length === 0 && sub.length === 0 && capable.length === 0) {
          setApiCandidates({ main: flat, sub: [], capable: [] });
        } else {
          setApiCandidates({ main, sub, capable });
        }
        // 0건이면 디버그 출력
        const total = main.length + sub.length + capable.length + (flat ? flat.length : 0);
        if (total === 0) {
          setApiDebug({
            phase: 'zero',
            responseKeys: Object.keys(res || {}),
            response: res,
          });
        }
      } catch (e) {
        console.error('[V14 2B-3] 에러:', e);
        if (!cancelled) {
          setApiError(e.message || '추천 프로 catch X');
          setApiDebug({ phase: 'exception', error: e.message });
        }
      } finally {
        if (!cancelled) setApiLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [task?.id, mainWorkType]);

  if (!task) {
    return <PlaceholderScreen t={t} title="추천 프로" label="작업 정보 없음" onBack={onBack}/>;
  }

  const candidates = apiCandidates;
  const totalCandidates = candidates.main.length + candidates.sub.length + candidates.capable.length;

  // Step 5-3-3 — 그룹명 정정 ("벽걸이 전문" → "벽걸이 가능" / 신입도 포함)
  const capableLabel = headItem.appliance ? `${headItem.appliance} 가능` : "기종 가능";
  const groups = [
    { id: "main",    color: "#FF1B8D", label: "지역 메인", list: candidates.main },
    { id: "sub",     color: "#888780", label: "지역 백업", list: candidates.sub },
    { id: "capable", color: "#FF1B8D", label: capableLabel, list: candidates.capable },
  ];

  return (
    <div className="fade-in">
      <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{task.customer || "—"}</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
            {task.region || "—"} · {mainWorkType}{headItem.appliance ? ` · ${headItem.appliance}` : ""}{headItem.qty ? ` ×${headItem.qty}` : ""}
          </div>
        </div>
      </div>

      {/* V14 2B-3 — 배정 중 / 배정 에러 */}
      {assigning && (
        <div style={{ padding: "8px 16px", background: t.bgInset, fontSize: 11, color: t.textSecondary, fontWeight: 700, textAlign: "center" }}>
          배정 중...
        </div>
      )}
      {assignError && (
        <div style={{
          margin: "8px 16px", padding: "10px 12px",
          background: t.dangerBg || "#FEE2E2",
          border: `1px solid ${t.danger || "#DC2626"}`,
          borderRadius: 8,
          fontSize: 11, fontWeight: 700, color: t.danger || "#B91C1C",
        }}>⚠ 배정 X — {assignError}</div>
      )}

      <div style={{ padding: "14px 16px 20px" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
          {apiLoading ? "추천 프로 catch 중..." : (
            <>
              추천 프로 <span className="mono" style={{ color: t.accent }}>{totalCandidates}</span>명
              <span style={{ color: t.textDim, margin: "0 5px" }}>·</span>
              {extractZone(task.region) || task.region || "지역 추출 X"}
            </>
          )}
        </div>

        {/* V14 2B-3 — API 에러 */}
        {apiError && (
          <div style={{
            margin: "10px 0", padding: "10px 12px",
            background: t.dangerBg || "#FEE2E2",
            border: `1px solid ${t.danger || "#DC2626"}`,
            borderRadius: 8,
            fontSize: 12, fontWeight: 700, color: t.danger || "#B91C1C",
          }}>⚠ {apiError}</div>
        )}

        {/* V14 2B-3 디버그 — 0건 catch 시 raw 응답 박기 */}
        {/* Phase 4-F-2: dev 모드에서만 노출 (운영 사용자에는 X) */}
        {process.env.NODE_ENV === 'development' && !apiLoading && !apiError && apiDebug && apiDebug.phase === 'zero' && (
          <div style={{
            margin: "10px 0", padding: "10px 12px",
            background: "#FFFBEB",
            border: "1px solid #F59E0B",
            borderRadius: 8,
            fontSize: 11, fontWeight: 600, color: "#78350F",
          }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>🔍 API 응답 디버그 (0건)</div>
            <div>응답 키: <code style={{ background: "#FEF3C7", padding: "1px 4px" }}>{JSON.stringify(apiDebug.responseKeys)}</code></div>
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>전체 응답 보기 ▼</summary>
              <pre style={{
                marginTop: 4, padding: 8, background: "#1A1A1A", color: "#A7F3D0",
                borderRadius: 4, fontSize: 10, overflow: "auto", maxHeight: 200,
                fontFamily: "monospace",
              }}>{JSON.stringify(apiDebug.response, null, 2)}</pre>
            </details>
          </div>
        )}

        {apiLoading ? null : totalCandidates === 0 && !apiError ? (
          <div style={{ padding: "32px 20px", textAlign: "center", background: t.bgElevated, borderRadius: 12, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 24, marginBottom: 10, opacity: 0.4 }}>🔍</div>
            <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 6 }}>이 지역에 등록된 프로가 없습니다</div>
            <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 14 }}>전체 프로 중 점수가 높은 순으로 직접 선택할 수 있습니다.</div>
            <button
              type="button"
              onClick={() => setShowAllEngineers(true)}
              style={{
                padding: "9px 16px",
                background: t.accent, color: "#fff",
                border: "none", borderRadius: 8,
                fontSize: 11, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >👥 전체 프로에서 선택</button>
          </div>
        ) : (
          groups.map((g, idx) => {
            if (g.list.length === 0) return null;
            return (
              <div key={g.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: idx === 0 ? 0 : 24, marginBottom: 12, padding: "0 4px" }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    backgroundColor: g.color,
                    flexShrink: 0,
                  }}/>
                  <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{g.label}</span>
                  <span style={{ fontSize: 13, color: g.color }}>{g.list.length}명</span>
                </div>
                {g.list.map((eng) => {
                  // V14 2B-3 — API 엔지니어 우선 (eng.matchedZone / cleanZones / refrigZones / region)
                  // 옛 ZONE_MAPPINGS fallback (API 응답 빈 키 catch X 시)
                  const taskZone = extractZone(task.region);
                  let infoText = "";
                  if (eng.matchedZone) {
                    infoText = String(eng.matchedZone);
                  } else if (g.id === "capable") {
                    // appliance 가능 — API의 appliances / 옛 fallback
                    const apps = Array.isArray(eng.appliances) ? eng.appliances
                              : (typeof eng.appliances === "string" ? eng.appliances.split(/[,·]/).map(s => s.trim()) : []);
                    const apiText = apps.filter(Boolean).join("·");
                    infoText = apiText || (getEngineerApplianceList(eng.name, mainWorkType).join("·") || "");
                  } else {
                    // main/sub: workType별 zones 박기
                    const apiZones = mainWorkType === "냉매충전"
                      ? (eng.refrigZones || eng.냉매_지역)
                      : (eng.cleanZones || eng.세척_지역);
                    const apiZonesArr = Array.isArray(apiZones) ? apiZones
                                      : (typeof apiZones === "string" ? apiZones.split(/[,]/).map(s => s.trim()).filter(Boolean) : []);
                    const matched = apiZonesArr.find(z => z === taskZone) || apiZonesArr[0];
                    infoText = matched || (getMatchedZone(eng.name, mainWorkType, taskZone) || "");
                  }
                  return (
                    <RecommendCard
                      key={`${g.id}-${eng.id}`}
                      t={t} eng={eng}
                      groupId={g.id}
                      infoText={infoText}
                      onAssign={() => onAssign(eng)}
                      onCardClick={() => onEngineerCardClick && onEngineerCardClick(eng)}
                    />
                  );
                })}
              </div>
            );
          })
        )}

        {/* V11-10 — 추천 결과가 있을 때도 전체 기사 버튼 노출 */}
        {totalCandidates > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.border}` }}>
            <button
              type="button"
              onClick={() => setShowAllEngineers(true)}
              style={{
                width: "100%", padding: "10px 14px",
                background: "transparent",
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                color: t.textSecondary,
                fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >👥 전체 프로에서 직접 선택</button>
          </div>
        )}
      </div>

      {showAllEngineers && (
        <AllEngineersModal
          task={task}
          engineers={apiEngineers && apiEngineers.length > 0 ? apiEngineers : undefined}
          onSelect={(engineerId, engineer) => {
            setShowAllEngineers(false);
            onAssign(engineer);
          }}
          onClose={() => setShowAllEngineers(false)}
        />
      )}
    </div>
  );
}

function RecommendCard({ t, eng, groupId, infoText, onAssign, onCardClick }) {
  // Step 5-3-3 — infoText 우선 (그룹 컨텍스트로 박힌 zones / appliances)
  const lineText = (infoText && infoText.trim()) || eng.region || eng.regionLabel || "";
  const showInfoLine = !!lineText || (typeof eng.todayCount === "number") || (eng.newCount > 0);
  // Step 8+9 V2 — 그룹별 role 매핑 (main 그룹 = 메인 / sub = 서브 / capable = role 없음)
  const role = groupId === "main" ? "main" : groupId === "sub" ? "backup" : null;

  return (
    <div onClick={onCardClick} className="clickable" style={{
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 12, padding: "12px 14px", marginBottom: 8,
    }}>
      {/* 1행: EngineerBadge + [배정] */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showInfoLine ? 8 : 0, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
          <EngineerBadge engineer={eng} role={role}/>
          {eng.nightOk && (
            <span style={{
              fontSize: 11, fontWeight: 500, padding: "2px 8px",
              background: t.bgInset, color: t.text,
              borderRadius: 4,
            }}>야간 OK</span>
          )}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onAssign(); }} style={{
          padding: "7px 14px",
          background: t.accent, color: "white", border: "none", borderRadius: 8,
          fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          flexShrink: 0,
        }}>배정</button>
      </div>

      {/* 2행: 작은 점 + 참고사항 (zones / appliances). 정보 없으면 라인 자체 숨김 */}
      {showInfoLine && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#888780" }}>
          <span style={{
            width: 3, height: 3, borderRadius: "50%",
            backgroundColor: "#888780", flexShrink: 0,
          }}/>
          {lineText && <span>{lineText}</span>}
          {typeof eng.todayCount === "number" && (
            <>
              {lineText && <span style={{ color: t.textDim }}>·</span>}
              <span>오늘 <span className="mono" style={{ color: t.text, fontWeight: 700 }}>{eng.todayCount}</span>건</span>
            </>
          )}
          {eng.newCount > 0 && (
            <span style={{ color: t.accent, fontWeight: 700 }}>(신규 +{eng.newCount})</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Step 5 — Toast 컨테이너 (3초 자동 사라짐, 상단 슬라이드)
// ============================================
function ToastContainer({ t, toasts }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div style={{
      position: "fixed", top: 16, left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999, display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none", width: "calc(100% - 32px)", maxWidth: 360,
    }}>
      {toasts.map(toast => {
        const meta = NOTI_TYPE_META[toast.type] || NOTI_TYPE_META.new_reception;
        const colorKey = meta.colorKey;
        const bg = t[colorKey + "Bg"] || t.bgElevated;
        const borderColor = t[colorKey + "Border"] || t.border;
        const accentColor = t[colorKey] || t.text;
        return (
          <div key={toast.id} className="fade-in" style={{
            background: t.bgElevated,
            border: `1.5px solid ${borderColor}`,
            borderLeft: `4px solid ${accentColor}`,
            borderRadius: 10, padding: "10px 12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            display: "flex", alignItems: "center", gap: 10,
            pointerEvents: "auto",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: bg, display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 14, flexShrink: 0,
            }}>{meta.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: accentColor, marginBottom: 2 }}>{toast.title}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{toast.message}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Step 5 — 알림 패널 화면
// ============================================
function NotificationScreen({ t, notifications, onBack, onMarkRead, onMarkAllRead, onClickItem }) {
  return (
    <div className="fade-in">
      {/* 운영자 PWA 전용 뒤로가기 헤더 */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary }}>뒤로</div>
      </div>
      <NotiScreen
        title="🔔 알림"
        notifications={notifications}
        onMarkAllRead={onMarkAllRead}
        onCardClick={onClickItem}
      />
    </div>
  );
}

// ============================================
// Step 5 — 새 접수 등록 폼 (해피콜 담당자 시각)
// ============================================
// 외부 정의 (내부 정의 시 매 렌더 새 컴포넌트 → input 포커스 손실)
function FormSection({ t, icon, label, required, error, children }) {
  return (
    <div style={{
      marginBottom: 12,
      background: t.bgElevated,
      border: `1px solid ${error ? t.danger : t.border}`,
      borderRadius: 10, padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>{label}</span>
        {required && <span style={{ fontSize: 11, color: t.accent, fontWeight: 800 }}>*</span>}
        {error && <span style={{ marginLeft: "auto", fontSize: 10, color: t.danger, fontWeight: 700 }}>{error}</span>}
      </div>
      {children}
    </div>
  );
}

function FormChip({ t, active, color, onClick, children }) {
  return (
    <button onClick={onClick} type="button" style={{
      padding: "6px 12px",
      background: active ? (color || t.accent) : t.bgInset,
      border: active ? `1px solid ${color || t.accent}` : `1px solid ${t.border}`,
      borderRadius: 999, fontSize: 11, fontWeight: 700,
      color: active ? "white" : t.textSecondary,
      cursor: "pointer", fontFamily: "inherit",
      whiteSpace: "nowrap", flexShrink: 0,
    }}>{children}</button>
  );
}

// V14 1F — 분배 미리보기 셀 (관리자만)
function FeePreviewCell({ t, label, value, color }) {
  return (
    <div style={{
      padding: "8px 6px", textAlign: "center",
      background: t.bg, borderRadius: 8,
      border: `1px solid ${t.border}`,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: t.textMuted,
        marginBottom: 2, letterSpacing: 0.3,
      }}>
        {label}
      </div>
      <div className="mono" style={{
        fontSize: 13, fontWeight: 800, color,
      }}>
        ₩{Number(value || 0).toLocaleString("ko-KR")}
      </div>
    </div>
  );
}

function NewReceptionFormScreen({ t, onBack, onSubmit }) {
  const [form, setForm] = useState({
    principal: "",
    channel: "",         // V14 1F — 채널 신규
    customer: "",
    phone: "",
    address: "",
    requestDate: "",
    requestTime: "",
    memo: "",
    estimateTotal: 0,
  });
  const [errors, setErrors] = useState({});

  // V14 1F — 진짜 API 등록 + 분배 미리보기 (관리자만)
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [feePreview, setFeePreview] = useState(null);   // { fee, policy, parsed } | null
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState("");

  // Step 5-1a — 카톡 자동 파싱 state
  const [kakaoText, setKakaoText] = useState("");
  const [parseResult, setParseResult] = useState(null);
  const [justFilled, setJustFilled] = useState(new Set());
  const [priceConfirm, setPriceConfirm] = useState(null);

  // Step 5-1b — 복수 작업 항목 + 일정 모드
  const [workItems, setWorkItems] = useState([]);          // [{ workType, appliance, qty }]
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState({ workType: "", appliance: "", qty: 1 });
  const [scheduleMode, setScheduleMode] = useState(null);  // null | "tbd" | "input"

  // Step 2-B-2 — KA 1way 자동 견적 계산 — 사용자가 견적을 직접 입력하면 자동 X
  const [estimateTouched, setEstimateTouched] = useState(false);

  // 2026-05-21 Migration 047 — 견적금액 미정 토글 (사장님 spec)
  //   현장 측 금액 확정 측 작업 (usol_n 냉매 / allday 일부 측) 측 spec
  //   체크 측: estimateTotal=0 + input disabled + product_price=0 측 저장
  //   기사 측 작업 완료 측 현장 추가금 측 측 (allday 측 동일 흐름)
  const [priceTBD, setPriceTBD] = useState(false);

  // V14 헌법 v6 — 작업유형 5가지 / 기종 7가지
  const workTypes = ["세척", "냉매충전", "출장비", "추가선택(YS-N)", "냉매점검(YS-N)"];
  const appliances = ["벽걸이", "1way", "스탠드", "4way", "원형", "투인원", "시스템멀티"];
  // 작업유형별 기종 풀 (V14 헌법 / 정책 시트와 일치)
  // 냉매충전은 원청별 분기 — getAppliancePool() 사용 (KA만 1way 첫 대 / 1way 추가 분리)
  const APPLIANCE_POOL = {
    "세척":           ["벽걸이", "1way", "스탠드", "4way", "원형", "투인원", "시스템멀티"],
    "출장비":         ["(공통)"],
    "추가선택(YS-N)": ["송풍팬분해", "실외기", "피톤치드"],
    "냉매점검(YS-N)": ["기본", "추가발생", "출장비"],
  };

  // 냉매충전 1way — UI에서는 모든 원청이 단일 "1way" 라벨 (KA 차등 단가는 자동 처리)
  // KA: 사용자가 "1way" + qty 입력 → 견적 자동 계산 (KA_1WAY_FIRST/ADDITIONAL) + 저장 시
  //     workItems가 "1way 첫 대" / "1way 추가" 두 행으로 자동 분리 → 시트 매칭
  // 다른 6 원청: 단일 "1way" 그대로 (단일 단가)
  // 함수 골격은 향후 다른 원청 / 다른 기종 차등 정책 박을 자리로 유지
  function getAppliancePool(workType, principalName) {
    if (workType === "냉매충전") {
      // 모든 원청 동일 풀 (KA 차등은 자동 계산 + 저장 시 분리로 처리)
      return ["벽걸이", "스탠드", "4way", "투인원", "1way"];
    }
    return APPLIANCE_POOL[workType] || [];
  }

  // V14 1F — 채널 5개 (사장님 spec)
  const CHANNELS = [
    { id: "카톡",   label: "카톡" },
    { id: "전화",   label: "전화" },
    { id: "네이버", label: "네이버" },
    { id: "직접",   label: "직접" },
    { id: "문자",   label: "문자" },
  ];

  // V14 2A — 주소 첫 한 단어 = 지역 (예: "강남구 도곡동" → "강남구")
  const region = (() => {
    const parts = (form.address || "").trim().split(/\s+/);
    return parts[0] || "";
  })();

  // Step 5-1c — 고객 자동 생성 (지역구 + 폰 4자리)
  // 예: 강남구 도곡동 + 010-1234-5678 → "강남5678"
  function autoGenerateCustomer(form, region) {
    if (form.customer && form.customer.trim()) return form.customer.trim();
    const digits = (form.phone || "").replace(/\D/g, "");
    const last4  = digits.length >= 4 ? digits.slice(-4) : "";
    let regionShort = "";
    const src = region || form.address || "";
    if (src) {
      // 지역구/시/동/군 추출 — 강남구 → 강남
      const m = src.match(/([가-힣]+?)(?:구|시|동|군)/);
      if (m) regionShort = m[1];
      else regionShort = src.split(/\s+/)[0];
    }
    if (regionShort && last4) return `${regionShort}${last4}`;
    if (regionShort)          return `${regionShort}고객`;
    if (last4)                return `고객${last4}`;
    return "고객 미정";
  }

  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  }

  function flashFields(keys) {
    const nextSet = new Set(keys);
    setJustFilled(nextSet);
    setTimeout(() => setJustFilled(new Set()), 1600);
  }

  function handleAutoFill() {
    const r = parseKakaoText(kakaoText);
    const filledKeys = [];
    setForm(prev => {
      const next = { ...prev };
      if (r.principal)    { next.principal = r.principal; filledKeys.push("principal"); }
      if (r.phone)        { next.phone = r.phone; filledKeys.push("phone"); }
      if (r.customer)     { next.customer = r.customer; filledKeys.push("customer"); }
      if (r.address)      { next.address = r.address; filledKeys.push("address"); }
      if (r.requestDate)  { next.requestDate = r.requestDate; filledKeys.push("requestDate"); }
      if (r.requestTime)  { next.requestTime = r.requestTime; filledKeys.push("requestTime"); }
      // 2026-05-23 — r.memo → form.memo 매핑 누락 정정 (KA 파서 측 메모 catch 측 폼 측 안 들어가던 함정)
      if (r.memo)         { next.memo = r.memo; filledKeys.push("memo"); }
      if (r.estimatedPrice && !r.priceNeedsConfirm) {
        next.estimateTotal = r.estimatedPrice;
        filledKeys.push("estimateTotal");
        // 카톡 텍스트에 명시된 견적은 사용자 의도값 — 자동 계산이 덮어쓰기 X
        setEstimateTouched(true);
      }
      return next;
    });

    // Step 5-1c — parseKakaoText의 workItems 직접 사용 (자동 추정 X)
    if (r.workItems && r.workItems.length > 0) {
      setWorkItems(r.workItems);
      filledKeys.push("workItems");
    }

    // 일정 자동 — 날짜/시간 둘 중 하나라도 있으면 input 모드
    if (r.requestDate || r.requestTime) {
      setScheduleMode("input");
    }

    flashFields(filledKeys);

    // 미인식 항목 계산
    const allKnown = ["원청", "이름", "연락처", "주소", "작업 종류", "기종", "일정", "금액"];
    const matchedSet = new Set(r.matched.map(m => m.split(" ")[0]));
    const unmatched = allKnown.filter(k => !matchedSet.has(k));
    setParseResult({ matched: r.matched, unmatched });

    if (r.priceNeedsConfirm) {
      setPriceConfirm({ rawValue: r.priceRawValue, estimated: r.estimatedPrice });
    }
  }

  function handleClear() {
    setKakaoText("");
    setForm({
      principal: "", customer: "", phone: "", address: "",
      requestDate: "", requestTime: "", memo: "", estimateTotal: 0,
    });
    setParseResult(null);
    setWorkItems([]);
    setShowAddItem(false);
    setEditItem({ workType: "", appliance: "", qty: 1 });
    setScheduleMode(null);
    setErrors({});
    setEstimateTouched(false);
  }

  function confirmPrice(yes) {
    if (yes && priceConfirm) {
      setForm(prev => ({ ...prev, estimateTotal: priceConfirm.estimated }));
      flashFields(["estimateTotal"]);
      // 사용자가 confirm 버튼 누른 견적값 — 자동 계산 덮어쓰기 X
      setEstimateTouched(true);
    }
    setPriceConfirm(null);
  }

  // Step 2-B-2 — KA + 냉매충전 + "1way" 항목 감지 시 견적 자동 계산
  // 첫 대 90,000 + 추가 (qty-1) × 70,000. 사용자가 견적을 직접 박은 후엔 X
  useEffect(() => {
    if (form.principal !== KA_PRINCIPAL_NAME) return;
    if (estimateTouched) return;
    const autoEstimate = calcKaOnewayEstimate(workItems);
    if (autoEstimate == null) return;
    setForm(prev =>
      prev.estimateTotal === autoEstimate ? prev : { ...prev, estimateTotal: autoEstimate }
    );
  }, [form.principal, workItems, estimateTouched]);

  // workItems 조작 (V14 헌법 — 모든 작업유형 기종/케이스 필수)
  function addWorkItem() {
    if (!editItem.workType) {
      setErrors(prev => ({ ...prev, addItem: "종류 선택" }));
      return;
    }
    if (!editItem.appliance) {
      setErrors(prev => ({ ...prev, addItem: "기종/케이스 선택" }));
      return;
    }
    const item = { ...editItem, qty: editItem.qty || 1 };
    setWorkItems(prev => [...prev, item]);
    setEditItem({ workType: "", appliance: "", qty: 1 });
    setShowAddItem(false);
    if (errors.workItems) setErrors(prev => ({ ...prev, workItems: null }));
    if (errors.addItem)   setErrors(prev => ({ ...prev, addItem: null }));
  }
  function removeWorkItem(idx) {
    setWorkItems(prev => prev.filter((_, i) => i !== idx));
  }
  function cancelAddItem() {
    setEditItem({ workType: "", appliance: "", qty: 1 });
    setShowAddItem(false);
    if (errors.addItem) setErrors(prev => ({ ...prev, addItem: null }));
  }

  // V14 1F — 분배 미리보기 (관리자만 catch / 기사 X)
  // 메인 항목 (workItems[0]) + 견적 박힐 때마다 debounce 500ms → calculateFee API 호출
  // Step 2-B-2 — KA + 냉매충전 + "1way" 케이스는 시트 매칭용 appliance="1way 첫 대"로 호출
  //              (KA estimate_remainder_split 정책은 두 행 모두 동일 — 견적 합산만 정확하면 분배 동일)
  useEffect(() => {
    if (!form.principal || workItems.length === 0 || !form.estimateTotal) {
      setFeePreview(null);
      setFeeError("");
      return;
    }
    // 2026-05-16 Phase 4 — 모든 항목 workType/appliance 박힘 박을 spec
    const allValid = workItems.every(i => i.workType && i.appliance);
    if (!allValid) {
      setFeePreview(null);
      return;
    }
    setFeeLoading(true);
    setFeeError("");
    const timer = setTimeout(async () => {
      try {
        // 2026-05-16 Phase 4 — calculateCommissionMultiRpc 측 멀티 항목 + qty 박은 spec
        // 단가형/비율형/정액형 분기 자동 박힘. 유솔N skip.
        const result = await calculateCommissionMultiRpc({
          principalName: form.principal,
          workItems,
          totalEstimate: form.estimateTotal,
          totalExtra: 0,
          totalNaverFee: 0,
        });
        if (result.skip) {
          setFeePreview({ skip: true, message: result.message });
        } else if (result.error) {
          setFeeError(result.error);
          setFeePreview(null);
        } else {
          // 옛 feePreview spec 호환 변환 (render 측 fee.principalFee 등 박혀있음)
          setFeePreview({
            ok: true,
            fee: {
              principalFee:   result.principal_amount,
              engineerAmount: result.engineer_amount,
              companyProfit:  result.company_margin,
            },
            policy: {
              policyText: CALC_METHOD_LABEL[result.calc_method] || result.calc_method || "—",
              calcMethod: result.calc_method,
            },
            parsed: { type: result.calc_method },
            total: form.estimateTotal,
            multi: true,
            items: result.items,
          });
        }
      } catch (e) {
        setFeeError(e.message);
        setFeePreview(null);
      } finally {
        setFeeLoading(false);
      }
    }, 500);
    return () => { clearTimeout(timer); setFeeLoading(false); };
  }, [form.principal, workItems, form.estimateTotal]);

  async function handleSubmit() {
    const errs = {};
    if (!form.principal)            errs.principal = "원청 선택";
    if (!form.channel)              errs.channel = "채널 선택";
    if (!form.phone.trim())         errs.phone = "연락처 입력";
    if (!form.address.trim())       errs.address = "주소 입력";
    if (workItems.length === 0)     errs.workItems = "작업 항목 1개 이상";
    // 2026-05-21 Migration 047 — 견적금액 미정 토글 시 검증 skip (product_price=0 측 저장)
    if (!priceTBD && (!form.estimateTotal || form.estimateTotal <= 0)) errs.estimateTotal = "견적 금액 입력";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const finalCustomer = autoGenerateCustomer(form, region);
    const scheduleType = scheduleMode === "input" ? "specific" : "tbd";
    const head = workItems[0] || {};

    // V14 1F — 진짜 createTask API (시트 작업DB row 박힘 / 작업번호 자동)
    // Step 2-B-2 — KA 1way 항목은 저장 직전 "1way 첫 대" / "1way 추가" 두 행으로 분리
    const splitItems = splitWorkItemsForKa1way(workItems, form.principal);
    setSubmitting(true);
    setSubmitError("");
    try {
      const taskData = {
        principal:     form.principal,         // V14 7개 헌법 이름
        channel:       form.channel,
        customer:      finalCustomer,
        phone:         form.phone,
        address:       form.address,
        region,
        workType:      head.workType,
        appliance:     head.appliance,
        qty:           head.qty || 1,
        workItems:     splitItems,              // 다중 항목 (KA 1way 분리됨 / 시트가 catch)
        quote:         form.estimateTotal,
        estimateTotal: form.estimateTotal,
        workDate:      form.requestDate,
        scheduledDate: form.requestDate,
        scheduledTime: form.requestTime,
        memo:          form.memo,
        // 2026-05-10 명세 — 신규 접수 default = "미배정"
        // (배정 흐름: 미배정 → 약속대기[냉매+추천] → 배정[운영자] → 확정[기사 일정] → 진행중 → 완료)
        // 약속대기는 냉매충전 + 자동 추천 흐름에서만 박음 (별도 화면 / 여기 X)
        status:        "미배정",
      };
      const res = await apiCreateTask(taskData);
      if (!res.ok) {
        // 2026-05-10 hotfix — timeout 시 "시트에 박혔을 수 있음" 안내 (재클릭 → 중복 방지)
        if (res.timeout) {
          setSubmitError("등록 처리 시간이 길어집니다. 시트에 이미 박혔을 수 있으니 새 접수 목록 새로고침 후 확인해주세요.");
        } else {
          setSubmitError(res.error || "등록 실패");
        }
        setSubmitting(false);
        return;
      }
      // V14 형식 작업번호 (예: O260507-001) — 부모로 전달
      // Step 2-B-2 — 부모도 분리된 workItems 받도록 (시트와 일관성)
      onSubmit({
        ...form,
        customer: finalCustomer,
        region,
        workItems: splitItems,
        scheduleType,
        taskId:        res.taskId,
        _v14ApiOk:     true,
      });
    } catch (e) {
      setSubmitError(e.message || "등록 실패");
      setSubmitting(false);
    }
  }

  // 입력 박스 공용 스타일
  const inputStyle = (hasError, fieldKey) => ({
    width: "100%", padding: "10px 12px",
    background: t.bgInset,
    border: `1px solid ${hasError ? t.danger : t.border}`,
    borderRadius: 8, fontSize: 13, color: t.text,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  });

  const principalColor = PRINCIPAL_COLORS[form.principal] || t.border;

  return (
    <div className="fade-in">
      {/* 헤더 */}
      <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, background: t.bg, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ fontSize: 16, fontWeight: 800 }}>새 접수 등록</div>
      </div>

      <div style={{ padding: "16px" }}>
        {/* 0. 빠른 입력 (카톡 자동 파싱) */}
        <div style={{
          marginBottom: 16,
          background: t.bgElevated,
          border: `1.5px solid ${t.accentBorder || t.accent}`,
          borderRadius: 10, padding: "12px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>📋</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>빠른 입력 (텍스트 자동 인식)</span>
          </div>
          <textarea
            value={kakaoText}
            onChange={(e) => setKakaoText(e.target.value)}
            placeholder={"고객 카톡 텍스트를 그대로 붙여넣으세요.\n예:\n원청: 쿨가이\n연락처: 010-5678-9012\n주소: 성동구 성수동\n작업유형: 냉매충전\n기종: 4way ×1\n견적: 100,000원"}
            style={{
              width: "100%", padding: "10px 12px",
              background: t.bgInset,
              border: `1px solid ${t.border}`,
              borderRadius: 8, fontSize: 12, color: t.text,
              fontFamily: "inherit", outline: "none",
              boxSizing: "border-box", minHeight: 100, resize: "vertical",
              lineHeight: 1.5,
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={handleAutoFill} disabled={!kakaoText.trim()} style={{
              flex: 1, padding: "8px 16px",
              background: kakaoText.trim() ? t.accent : t.bgInset,
              color: kakaoText.trim() ? "white" : t.textMuted,
              border: "none", borderRadius: 8,
              fontSize: 12, fontWeight: 800,
              cursor: kakaoText.trim() ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>자동 채우기 <ArrowRight size={12}/></button>
            <button onClick={handleClear} style={{
              padding: "8px 14px",
              background: "transparent",
              border: `1px solid ${t.border}`, borderRadius: 8,
              fontSize: 11, fontWeight: 700, color: t.textSecondary,
              cursor: "pointer", fontFamily: "inherit",
            }}>지우기</button>
          </div>

          {/* 결과 안내 */}
          {parseResult && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
              {parseResult.matched.length > 0 && (
                <div style={{ fontSize: 11, color: t.success, fontWeight: 600, lineHeight: 1.6 }}>
                  ✓ 인식: <span style={{ color: t.textSecondary, fontWeight: 700 }}>{parseResult.matched.join(", ")}</span>
                </div>
              )}
              {parseResult.unmatched.length > 0 && (
                <div style={{ fontSize: 11, color: t.warning, fontWeight: 600, lineHeight: 1.6 }}>
                  ⚠ 미인식: <span style={{ color: t.textSecondary, fontWeight: 700 }}>{parseResult.unmatched.join(", ")}</span> <span style={{ color: t.textMuted, fontWeight: 500 }}>(직접 선택)</span>
                </div>
              )}
              {form.estimateTotal > 0 && (
                <div style={{ marginTop: 4, fontSize: 11, color: t.textSecondary, fontWeight: 600 }}>
                  💰 추정 금액: <span className="mono" style={{ color: t.accent, fontWeight: 800 }}>₩{form.estimateTotal.toLocaleString()}</span>
                </div>
              )}
              {workItems.length > 1 && (
                <div style={{ marginTop: 4, fontSize: 10, color: t.textMuted, fontWeight: 500 }}>
                  · 작업 항목 {workItems.length}건 자동 추가 — 아래에서 확인/수정
                </div>
              )}
            </div>
          )}
        </div>

        {/* 1. 원청 — V14 헌법 7개 드롭다운 */}
        <FormSection t={t} icon="🏢" label="원청" required error={errors.principal}>
          <div style={{ position: "relative" }}>
            <select
              value={form.principal}
              onChange={(e) => update("principal", e.target.value)}
              style={{
                ...inputStyle(!!errors.principal),
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                paddingRight: 36,
                borderLeft: form.principal ? `4px solid ${principalColor}` : `1px solid ${errors.principal ? t.danger : t.border}`,
                cursor: "pointer",
              }}
            >
              <option value="">선택...</option>
              {PRINCIPALS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <ChevronDown size={16} style={{
              position: "absolute", right: 12, top: "50%",
              transform: "translateY(-50%)", color: t.textMuted, pointerEvents: "none",
            }}/>
          </div>
        </FormSection>

        {/* V14 1F — 채널 드롭다운 */}
        <FormSection t={t} icon="📥" label="채널" required error={errors.channel}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CHANNELS.map(c => (
              <FormChip
                t={t}
                key={c.id}
                active={form.channel === c.id}
                onClick={() => update("channel", c.id)}
              >{c.label}</FormChip>
            ))}
          </div>
        </FormSection>

        {/* 2. 고객 정보 — 이름 선택 (자동 생성) */}
        <FormSection t={t} icon="👤" label="고객 정보" required error={errors.phone}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              type="text"
              placeholder="이름 (없으면 자동 생성)"
              value={form.customer}
              onChange={(e) => update("customer", e.target.value)}
              className={justFilled.has("customer") ? "flash-highlight" : undefined}
              style={inputStyle(false)}
            />
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 500, lineHeight: 1.5 }}>
              · 비우면 자동 생성 (예: 강남1234 / 서초0001)
            </div>
            <input
              type="tel"
              placeholder="010-0000-0000"
              value={form.phone}
              onChange={(e) => update("phone", formatPhone(e.target.value))}
              className={justFilled.has("phone") ? "flash-highlight" : undefined}
              style={inputStyle(!!errors.phone)}
            />
          </div>
        </FormSection>

        {/* 3. 주소 */}
        <FormSection t={t} icon="📍" label="주소" required error={errors.address}>
          <input
            type="text"
            placeholder="강남구 도곡동 123-4"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            className={justFilled.has("address") ? "flash-highlight" : undefined}
            style={inputStyle(!!errors.address)}
          />
          {region && (
            <div style={{ marginTop: 6, fontSize: 10, color: t.textMuted, fontWeight: 600 }}>
              <MapPin size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }}/>
              지역 자동: <span style={{ color: t.textSecondary, fontWeight: 700 }}>{region}</span>
            </div>
          )}
        </FormSection>

        {/* 4. 작업 항목 — 복수 (Step 5-1b) */}
        <FormSection
          t={t}
          icon="🔧"
          label={`작업 항목${workItems.length > 0 ? ` (${workItems.length}건)` : ""}`}
          required
          error={errors.workItems}
        >
          {/* 항목 리스트 */}
          {workItems.length === 0 && !showAddItem && (
            <div style={{ padding: "16px 0", textAlign: "center", color: t.textMuted, fontSize: 12, fontWeight: 500 }}>
              아직 작업 항목이 없어요.
            </div>
          )}
          {workItems.length > 0 && (
            <div className={justFilled.has("workItems") ? "flash-highlight" : undefined}
              style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8, borderRadius: 8 }}>
              {workItems.map((item, idx) => (
                <div key={idx} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: t.bgInset,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8, padding: "10px 12px",
                }}>
                  <span className="mono" style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, minWidth: 20 }}>#{idx + 1}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: t.text, flex: 1 }}>
                    {item.workType} · {item.appliance || "—"} <span className="mono" style={{ color: t.accent }}>×{item.qty || 1}</span>
                  </span>
                  <button onClick={() => removeWorkItem(idx)} style={{
                    width: 26, height: 26,
                    background: "transparent",
                    border: `1px solid ${t.border}`, borderRadius: 6,
                    color: t.textMuted, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "inherit",
                  }}>
                    <XCircle size={14}/>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 인라인 추가 폼 */}
          {showAddItem ? (
            <div style={{
              background: t.bgInset,
              border: `1.5px solid ${errors.addItem ? t.danger : t.accent}`,
              borderRadius: 8, padding: "12px",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>종류</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {workTypes.map(w => (
                    <FormChip t={t} key={w} active={editItem.workType === w}
                      onClick={() => setEditItem(prev => ({ ...prev, workType: w }))}>{w}</FormChip>
                  ))}
                </div>
              </div>
              {/* V14 헌법 — 작업유형별 기종 풀 (정책 시트와 일치) */}
              {editItem.workType && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>
                    {editItem.workType === "추가선택(YS-N)" ? "추가 종류"
                      : editItem.workType === "냉매점검(YS-N)" ? "케이스"
                      : editItem.workType === "출장비" ? "구분"
                      : "기종"}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {getAppliancePool(editItem.workType, form.principal).map(a => (
                      <FormChip t={t} key={a} active={editItem.appliance === a}
                        onClick={() => setEditItem(prev => ({ ...prev, appliance: a }))}>{a}</FormChip>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>수량</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => setEditItem(prev => ({ ...prev, qty: Math.max(1, (prev.qty || 1) - 1) }))} style={{
                    width: 32, height: 32, background: t.bg,
                    border: `1px solid ${t.border}`, borderRadius: 8,
                    fontSize: 16, fontWeight: 800, color: t.text,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>−</button>
                  <span className="mono" style={{ fontSize: 16, fontWeight: 800, minWidth: 30, textAlign: "center" }}>{editItem.qty || 1}</span>
                  <button onClick={() => setEditItem(prev => ({ ...prev, qty: Math.min(99, (prev.qty || 1) + 1) }))} style={{
                    width: 32, height: 32, background: t.bg,
                    border: `1px solid ${t.border}`, borderRadius: 8,
                    fontSize: 16, fontWeight: 800, color: t.text,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>+</button>
                </div>
              </div>
              {errors.addItem && (
                <div style={{ fontSize: 10, color: t.danger, fontWeight: 700 }}>{errors.addItem}</div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button onClick={cancelAddItem} style={{
                  flex: 1, padding: "8px",
                  background: "transparent",
                  border: `1px solid ${t.border}`, borderRadius: 8,
                  fontSize: 11, fontWeight: 700, color: t.textSecondary,
                  cursor: "pointer", fontFamily: "inherit",
                }}>취소</button>
                <button onClick={addWorkItem} style={{
                  flex: 1, padding: "8px",
                  background: t.accent, color: "white",
                  border: "none", borderRadius: 8,
                  fontSize: 11, fontWeight: 800,
                  cursor: "pointer", fontFamily: "inherit",
                }}>추가</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddItem(true)} style={{
              width: "100%", padding: "10px",
              background: "transparent",
              border: `1px dashed ${t.border}`, borderRadius: 8,
              fontSize: 12, fontWeight: 700, color: t.textSecondary,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}>
              <Plus size={13}/> 작업 추가
            </button>
          )}
        </FormSection>

        {/* 4-1. 견적 금액 (Step 5-1c) — 단축 칩 + 직접 입력 / 2026-05-21 Migration 047 — 미정 토글 */}
        <FormSection t={t} icon="💰" label="견적 금액" required={!priceTBD} error={errors.estimateTotal}>
          {/* 2026-05-21 Migration 047 — 견적금액 미정 토글 */}
          <label style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 10px", marginBottom: 10,
            background: priceTBD ? t.accentBg : t.bgInset,
            border: `1px solid ${priceTBD ? t.accent : t.border}`,
            borderRadius: 8, cursor: "pointer",
            fontSize: 12, fontWeight: 600,
            color: priceTBD ? t.accent : t.textSecondary,
          }}>
            <input
              type="checkbox"
              checked={priceTBD}
              onChange={(e) => {
                const checked = e.target.checked;
                setPriceTBD(checked);
                if (checked) {
                  update("estimateTotal", 0);
                  setEstimateTouched(true);
                }
              }}
              style={{ margin: 0, cursor: "pointer" }}
            />
            <span>견적 금액 미정 (현장 측 측 확정)</span>
          </label>

          {/* 단축 칩 */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, marginBottom: 8, opacity: priceTBD ? 0.4 : 1, pointerEvents: priceTBD ? "none" : "auto" }}>
            {[10, 15, 20, 25, 30].map(n => {
              const value = n * 10000;
              const active = !priceTBD && form.estimateTotal === value;
              return (
                <FormChip t={t} key={n} active={active} onClick={() => { update("estimateTotal", value); setEstimateTouched(true); }}>{n}만</FormChip>
              );
            })}
          </div>
          {/* 직접 입력 + 원 라벨 */}
          <div style={{ position: "relative" }}>
            <input
              type="text"
              inputMode="numeric"
              placeholder={priceTBD ? "미정" : "직접 입력 (숫자만)"}
              value={priceTBD ? "" : (form.estimateTotal ? String(form.estimateTotal) : "")}
              onChange={(e) => {
                const onlyDigits = e.target.value.replace(/\D/g, "");
                update("estimateTotal", onlyDigits ? parseInt(onlyDigits) : 0);
                setEstimateTouched(true);
              }}
              disabled={priceTBD}
              className={justFilled.has("estimateTotal") ? "flash-highlight" : undefined}
              style={{
                ...inputStyle(!!errors.estimateTotal),
                paddingRight: 40,
                opacity: priceTBD ? 0.5 : 1,
                cursor: priceTBD ? "not-allowed" : "text",
              }}
            />
            <span style={{
              position: "absolute", right: 12, top: "50%",
              transform: "translateY(-50%)", color: t.textMuted,
              fontSize: 12, fontWeight: 700, pointerEvents: "none",
            }}>원</span>
          </div>
          {/* 현재 값 강조 표시 */}
          {!priceTBD && form.estimateTotal > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: t.textMuted, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <span>현재:</span>
              <span className="mono" style={{ color: t.accent, fontSize: 14, fontWeight: 800 }}>
                ₩{form.estimateTotal.toLocaleString()}
              </span>
            </div>
          )}

          {/* V14 1F — 분배 미리보기 (관리자만 catch / 기사 X) */}
          {(form.principal && workItems.length > 0 && form.estimateTotal > 0) && (
            <div style={{
              marginTop: 12,
              padding: "12px 14px",
              background: t.bgInset,
              border: `1px dashed ${t.accent}`,
              borderRadius: 10,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 800, color: t.accent,
                marginBottom: 8, letterSpacing: 0.5,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <span>🔒</span>
                <span>관리자만 보임</span>
                {feeLoading && <span style={{ marginLeft: "auto", color: t.textMuted, fontWeight: 600 }}>계산 중...</span>}
              </div>

              {feeError && (
                <div style={{ fontSize: 11, color: t.danger, fontWeight: 600 }}>
                  ⚠ {feeError}
                </div>
              )}

              {/* 2026-05-16 Phase 4 — 유솔N skip 메시지 */}
              {!feeError && feePreview && feePreview.skip && (
                <div style={{
                  fontSize: 11, color: t.textSecondary, fontWeight: 600,
                  padding: "8px 10px", background: t.bgInset || "rgba(0,0,0,0.04)",
                  borderRadius: 6, lineHeight: 1.5,
                }}>
                  ⚠️ {feePreview.message}
                  <br/>
                  <span style={{ fontSize: 10, color: t.textMuted }}>
                    네이버 정산 화면 측 처리 spec
                  </span>
                </div>
              )}

              {!feeError && feePreview && feePreview.fee && (
                <>
                  <div style={{
                    fontSize: 11, color: t.textSecondary, fontWeight: 600,
                    marginBottom: 8, lineHeight: 1.4,
                  }}>
                    정책: <span style={{ color: t.text, fontWeight: 800 }}>{feePreview.policy?.policyText || "—"}</span>
                    {feePreview.parsed?.type && (
                      <span style={{ color: t.textMuted, fontSize: 10, marginLeft: 4 }}>({feePreview.parsed.type})</span>
                    )}
                  </div>
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
                  }}>
                    <FeePreviewCell t={t} label="원청" value={feePreview.fee.principalFee} color={t.textSecondary}/>
                    <FeePreviewCell t={t} label="프로" value={feePreview.fee.engineerAmount} color={t.success || "#10B981"}/>
                    <FeePreviewCell t={t} label="회사" value={feePreview.fee.companyProfit} color={t.accent}/>
                  </div>
                  <div style={{
                    marginTop: 8, fontSize: 9, color: t.textMuted, fontWeight: 500,
                    lineHeight: 1.4,
                  }}>
                    · 메인 항목 ({workItems[0]?.workType} / {workItems[0]?.appliance}) 기준 / 견적 ₩{form.estimateTotal.toLocaleString()}
                  </div>
                  {/* Step 3 — 냉매충전은 기사별 비율 (50/60/100). 새 접수 시 미배정 = 기본 50% */}
                  {workItems[0]?.workType === "냉매충전" && (
                    <div style={{
                      marginTop: 4, fontSize: 9, color: t.textMuted, fontWeight: 500,
                      lineHeight: 1.4,
                    }}>
                      · 기사 미배정 — 기본 50% 비율 추정. 기사 배정 시 자동 갱신
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </FormSection>

        {/* 5. 일정 — 미정 / 입력 토글 (Step 5-1b) */}
        <FormSection t={t} icon="📅" label="고객 희망 일정">
          {scheduleMode === null && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setScheduleMode("tbd")} style={{
                flex: 1, padding: "12px 10px",
                background: t.bgInset,
                border: `1px solid ${t.border}`, borderRadius: 8,
                fontSize: 12, fontWeight: 700, color: t.textSecondary,
                cursor: "pointer", fontFamily: "inherit",
                lineHeight: 1.4,
              }}>
                미정<br/>
                <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>(프로님 컨택)</span>
              </button>
              <button onClick={() => setScheduleMode("input")} style={{
                flex: 1, padding: "12px 10px",
                background: t.bgInset,
                border: `1px solid ${t.border}`, borderRadius: 8,
                fontSize: 12, fontWeight: 700, color: t.textSecondary,
                cursor: "pointer", fontFamily: "inherit",
                lineHeight: 1.4,
              }}>
                일정 입력<br/>
                <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>(날짜 + 시간)</span>
              </button>
            </div>
          )}
          {scheduleMode === "tbd" && (
            <div>
              <div style={{
                padding: "10px 12px",
                background: t.successBg || t.bgInset,
                border: `1px solid ${t.successBorder || t.border}`,
                borderRadius: 8, marginBottom: 8,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <CheckCircle2 size={14} style={{ color: t.success }}/>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>미정 — 프로님이 고객 컨택 예정</span>
              </div>
              <button onClick={() => setScheduleMode("input")} style={{
                width: "100%", padding: "8px",
                background: "transparent",
                border: `1px solid ${t.border}`, borderRadius: 8,
                fontSize: 11, fontWeight: 700, color: t.textMuted,
                cursor: "pointer", fontFamily: "inherit",
              }}>← 일정 입력으로</button>
            </div>
          )}
          {scheduleMode === "input" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="date"
                value={form.requestDate}
                onChange={(e) => update("requestDate", e.target.value)}
                className={justFilled.has("requestDate") ? "flash-highlight" : undefined}
                style={inputStyle(false)}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <FormChip t={t} active={form.requestTime === "오전"} onClick={() => update("requestTime", form.requestTime === "오전" ? "" : "오전")}>오전</FormChip>
                <FormChip t={t} active={form.requestTime === "오후"} onClick={() => update("requestTime", form.requestTime === "오후" ? "" : "오후")}>오후</FormChip>
                <input
                  type="text"
                  placeholder="시간 (예: 14:00)"
                  value={(form.requestTime !== "오전" && form.requestTime !== "오후") ? form.requestTime : ""}
                  onChange={(e) => update("requestTime", e.target.value)}
                  className={justFilled.has("requestTime") ? "flash-highlight" : undefined}
                  style={{ ...inputStyle(false), flex: 1 }}
                />
              </div>
              <button onClick={() => { setScheduleMode("tbd"); update("requestDate", ""); update("requestTime", ""); }} style={{
                padding: "8px",
                background: "transparent",
                border: `1px solid ${t.border}`, borderRadius: 8,
                fontSize: 11, fontWeight: 700, color: t.textMuted,
                cursor: "pointer", fontFamily: "inherit",
              }}>← 미정으로</button>
            </div>
          )}
        </FormSection>

        {/* 6. 요청사항 */}
        <FormSection t={t} icon="📝" label="요청사항 (선택)">
          <textarea
            placeholder="100자 이내"
            maxLength={100}
            value={form.memo}
            onChange={(e) => update("memo", e.target.value)}
            style={{ ...inputStyle(false), minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
          />
        </FormSection>

        {/* V14 1F — 등록 에러 (createTask API 실패 시) */}
        {submitError && (
          <div style={{
            marginTop: 12, padding: "10px 12px",
            background: t.dangerBg || "#FEE2E2",
            border: `1px solid ${t.danger || "#DC2626"}`,
            borderRadius: 8,
            fontSize: 12, fontWeight: 700, color: t.danger || "#B91C1C",
          }}>
            ⚠ {submitError}
          </div>
        )}

        {/* 하단 액션 */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onBack} disabled={submitting} style={{
            flex: 1, padding: "12px",
            background: "transparent",
            border: `1px solid ${t.border}`, borderRadius: 10,
            fontSize: 13, fontWeight: 700, color: t.textSecondary,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.5 : 1,
            fontFamily: "inherit",
          }}>취소</button>
          <button onClick={handleSubmit} disabled={submitting} style={{
            flex: 2, padding: "12px",
            background: submitting ? t.bgInset : t.accent,
            color: submitting ? t.textMuted : "white",
            border: "none", borderRadius: 10,
            fontSize: 13, fontWeight: 800,
            cursor: submitting ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {submitting ? "등록 중..." : <>등록하기 <ArrowRight size={14}/></>}
          </button>
        </div>
      </div>

      {/* 금액 확인 모달 */}
      {priceConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16,
        }} onClick={() => confirmPrice(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: t.bgElevated,
            border: `1.5px solid ${t.warningBorder || t.border}`,
            borderRadius: 12, padding: "20px",
            width: "100%", maxWidth: 320,
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>💰</span>
              <div style={{ fontSize: 14, fontWeight: 800, color: t.warning }}>금액 확인</div>
            </div>
            <div style={{ fontSize: 13, color: t.text, lineHeight: 1.6, marginBottom: 4 }}>
              추정 금액: <span className="mono" style={{ fontSize: 16, fontWeight: 800, color: t.accent }}>₩{priceConfirm.estimated.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500, marginBottom: 16 }}>
              ('{priceConfirm.rawValue}' → {priceConfirm.rawValue}만원으로 인식)
            </div>
            <div style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600, marginBottom: 16 }}>
              맞으세요?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => confirmPrice(false)} style={{
                flex: 1, padding: "10px",
                background: "transparent",
                border: `1px solid ${t.border}`, borderRadius: 8,
                fontSize: 12, fontWeight: 700, color: t.textSecondary,
                cursor: "pointer", fontFamily: "inherit",
              }}>아니오 — 직접 입력</button>
              <button onClick={() => confirmPrice(true)} style={{
                flex: 1, padding: "10px",
                background: t.accent, color: "white",
                border: "none", borderRadius: 8,
                fontSize: 12, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
              }}>예</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

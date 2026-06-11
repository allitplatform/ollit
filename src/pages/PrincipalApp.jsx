import { useState, useEffect, useRef } from "react";
// 2026-06-03 — Principal 측측 측측 측측 측측 측측 측측: 글로벌 CSS 측 측측 (--text-primary 측).
//   원인: Principal 측측 측측 측측 `useState("dark")` 측측측 (= 측측 측측 X) 측측 글로벌 CSS 측측
//        App.jsx 측 loadTheme() 측측 측측측 측측 측측 (= 측측측 측측 측측 측측 측측 측측 측측 X).
//        측측측 측측 측측 측측 측측 → --text-primary = #1A1A1A → Principal 측측 (#1A1512) 측 측측 측측.
//   측측: 측측측 측측 측 applyThemeVars("dark") 측측 측측 측측 (= Admin/Engineer 측측 측측 동일 측측).
import { applyTheme as applyThemeVars, loadTheme } from "../styles/themes.js";
// 2026-06-04 — 폰트 크기 공용 헬퍼 (EngineerMeTab과 공유).
import { loadFontSize, applyFontSize, FONT_SIZE_OPTIONS } from "../utils/fontSize.js";
// 2026-06-04 — 푸시 알림 헬퍼 (EngineerMeTab 패턴 — partner role 호출).
import {
  subscribePushWithSync,
  unsubscribePushWithSync,
  isPushSupported,
  isStandalone,
  isIOS,
  getPermissionState,
  getCurrentSubscription,
} from "../utils/pushNotification.js";
import {
  loadTasksForRole as getTasks,
  createTaskAdapter as createTask,
  getTaskByIdDb,
  updateTaskAdapter,
} from "../data/tasksDb.js";
import { listPhotosByTask } from "../lib/photosDb.js";
import {
  Sun, Moon, RotateCcw, ClipboardPaste, Plus, Send, ArrowLeft,
  ClipboardList, Wallet, Building2, ChevronRight, AlertCircle,
  CheckCircle2, Clock, User, Phone, MapPin, Calendar, Snowflake,
  Hash, Edit3, Camera, FileText, Sparkles, Search, Filter, DollarSign,
  LogOut, Bell, ClipboardCheck, CalendarClock, XCircle,
} from "lucide-react";
import { useTasks } from "../shared/TasksContext.jsx";
import { filterTasksForPrincipal } from "../shared/tasks.js";
import { v14NormalizeTask, v14FindTaskList } from "../utils/v14Task.js";
import { useRealtimeTasks } from "../hooks/useRealtimeSubscription.js";
import { formatTimeOnly } from "../utils/dateLabel.js";
// 2026-05-23 — 유솔홈케어 통합 포털 1라운드: "작업 현황" 탭 측 컴포넌트
import { PrincipalListTab } from "../components/principal/PrincipalListTab.jsx";
import { PrincipalSettleTab } from "../components/principal/PrincipalSettleTab.jsx";
// 2026-06-06 — KA/crikrin 일정산 화면 (PartnerDailySettleTab). usol_n/usol_h 측 기존 PrincipalSettleTab 그대로.
import { PartnerDailySettleTab } from "../components/principal/PartnerDailySettleTab.jsx";
// 2026-06-06 — usol_h 전용 일정 탭 (날짜/기간 기반 작업 목록). 측 측 측 측 다른 원청 확장 가능 구조.
import { UsolHScheduleTab } from "../components/principal/UsolHScheduleTab.jsx";
import { UsolNOrders } from "../components/usol_n/UsolNOrders.jsx";
import { UsolNCsvMatch } from "../components/usol_n/UsolNCsvMatch.jsx";
import { NewReceptionScreenLite } from "../components/principal/NewReceptionScreenLite.jsx";
import { NotiScreen } from "../components/notifications/NotiScreen.jsx";
import {
  listNotifications as listStoredNotifications,
  markAllAsRead as markAllStoredAsRead,
  markAsRead as markStoredAsRead,
} from "../utils/notificationStore.js";
import { fetchNotiPrefs, setNotiPref, PARTNER_NOTI_KINDS } from "../lib/notiPrefsDb.js";
// 2026-06-06 — KA/crikrin 메시지 붙여넣기 파서 (UploadTab 측 호출).
import { parsePartnerPaste } from "../utils/partnerPasteParser.js";
// 2026-06-06 — 작업 기본 정보 편집 (5 필드만, RPC update_task_basic Mig 099).
import { TaskBasicEditScreen } from "../components/TaskBasicEditScreen.jsx";
// 2026-06-09 — 정산 표시 분기 (visit / refrigerant × usol_h).
import { isAllItemsVisit, isAllItemsRefrigerant, VISIT_ICON_EMOJI } from "../utils/visitFeeDetect.js";
import { fetchTaskItemsForDetail, getNaverSettleWeek } from "../lib/principalSettleDb.js";
import { getPartialReasonLabel } from "../components/EngineerTaskCompletionScreens.jsx";
import { getCancelActorLabel, getCancelReasonLabel } from "../data/cancelReasons.js";
import { getUserById } from "../data/users.js";
import { formatDateTimeKST } from "../utils/dateLabel.js";
// Round 2 — 원청 취소 RPC + 공유 다이얼로그
import { partnerFullCancel, partnerPartialCancelItem } from "../lib/cancelRpc.js";
import { FullCancelDialog, PartialCancelDialog } from "../components/CancelDialogs.jsx";
import { fetchPrincipalWeeklyRemittances } from "../lib/principalRemitDb.js";
import { fetchPrincipalAccounts, updatePrincipalAccount } from "../lib/principalsDb.js";
import { fetchPrincipalSidebarSummary } from "../lib/principalDashboardDb.js";
import { getStatusBadge as getPrincipalStatusBadge, getStatusLabel as getPrincipalStatusLabel } from "../utils/principalStatusBadge.js";
import { supabase } from "../lib/supabase.js";
// 2026-06-10 — PC 반응형 1차: 1024px 이상 PC 셸 분기.
import { useIsPc } from "../utils/useIsPc.js";

const NOW = "10:00";
const PC_SIDEBAR_W   = 240;
const PC_DETAIL_W    = 420;

// 2026-06-03 — KA / 크리크린 원청 PWA 분기 메타.
//   유솔(usol_h / usol_n)은 이 객체에 없음 — 기존 UsolNOrders + 수동 입력 흐름 그대로.
//   KA / crikrin은 냉매충전 단일 + 가격표 자동 채움 + 색상 분리.
// 2026-06-06 — 색 통일: 원청별 accent(KA 청록/crikrin 보라) 제거 → 앱 핑크.
//   accentColor 필드 자체 제거. UploadTab 측 t.accent (테마 핑크) 전달.
const PARTNER_PWA_CONFIG = {
  KA: {
    label:         "에어컨프로 (KA) · 직접 입력",
    workTypes:     ["냉매충전"],
    appliancePool: { "냉매충전": ["벽걸이", "스탠드", "4way", "투인원", "1way"] },
  },
  crikrin: {
    label:         "크리크린 · 직접 입력",
    workTypes:     ["냉매충전"],
    appliancePool: { "냉매충전": ["벽걸이", "스탠드", "4way", "투인원", "1way"] },
  },
};

// user.principals에서 KA / crikrin 우선순위로 partner 결정.
//   유솔 통합계정(usol_h+usol_n)이면 null 반환 → 기존 유솔 흐름 유지.
function _resolvePartnerCode(user) {
  const codes = Array.isArray(user?.principals)
    ? user.principals.map(p => p?.code).filter(Boolean)
    : [];
  for (const c of codes) {
    if (PARTNER_PWA_CONFIG[c]) return c;
  }
  return null;
}

// 2026-06-04 Phase 2-A — 작업 상세 정산 박스 분기 키.
//   true  → 유솔 흐름 (네이버 정산 + 트랙B 3단계 + 15%/85% 분해). 기존 SettleDetailBox 본문 유지.
//   false → 단순 흐름 (allday / KA / crikrin / usol_h 등). SettleDetailBoxSimple — DB principal_amount 직접 사용.
//   분기 키 = task.principalCode.
// 2026-06-09 — 유솔H 측 일반 원청 UI 전환 (사장님 spec 갱신).
//   네이버 월정산 특수 UI = usol_n 전용. usol_h 측 일반 일일정산 UI (allday/KA 등과 동일).
//   효과: usol_h 냉매 네이버바 / 출장비 배분 사고 자동 해결 (특수 UI 미진입).
//   유솔H 정책: 세척만 정산 / 냉매 "완료" 만 / 출장비 기사 100% (모든 원청 공용 분기 측 처리).
function isUsolFlow(task) {
  const code = task?.principalCode || "";
  return code === "usol_n";
}

// V14 Phase 4-F-1 — 헤더 양식 통일 (AdminApp 패턴 / 페이지 진입 시점 동적 날짜)
const TODAY = (() => {
  const d = new Date();
  const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const date = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return `${day} · ${date} ${month}`;
})();

// V14 Phase 5-A 보완 — 한국어 조사 자동 처리 (받침 유무로 분기)
// 한글 음절(0xAC00~0xD7A3): (코드 - 0xAC00) % 28 !== 0 → 받침 있음
function josa(word, withFinal, withoutFinal) {
  if (!word) return withoutFinal;
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xAC00 || last > 0xD7A3) return withoutFinal;
  const hasFinal = (last - 0xAC00) % 28 !== 0;
  return hasFinal ? withFinal : withoutFinal;
}

// 2026-05-23 — PRINCIPAL mock 제거. 색은 마젠타(정산 탭 일관), 라벨은 로그인 user 기반.
const PRINCIPAL_COLOR = "#FF4D9E";
const PRINCIPAL_BG    = "rgba(255,77,158,0.10)";

// 2026-06-04 — 인사말 표시명 정리.
//   user.name 측 "에어컨프로 사장님" 같이 들어오면 "사장님"/"사장" 트레일링 제거 + 중복 "님" 제거.
//   → 출력 헤더: "안녕하세요, {정리된 이름} 님" 형태로 사용.
function cleanGreetingName(rawName, fallback) {
  if (!rawName) return fallback;
  let s = String(rawName).trim();
  // 트레일링 "사장" / "사장님" 제거 (예: "에어컨프로 사장님" → "에어컨프로").
  s = s.replace(/\s*사장님?\s*$/, "").trim();
  // 트레일링 "님" 단독 제거 (중복 회피).
  s = s.replace(/\s*님\s*$/, "").trim();
  return s || fallback;
}

// user.principals → 표시용 원청 라벨 (공통 접두사 추출).
//   ["유솔홈케어 H", "유솔홈케어 N"]  → "유솔홈케어"
//   ["올데이케어"]                   → "올데이케어"
//   []                              → ""
function getPrincipalLabel(user) {
  if (!user || !Array.isArray(user.principals) || user.principals.length === 0) return "";
  const names = user.principals.map(p => p?.name).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  let prefix = names[0];
  for (const n of names) {
    while (prefix && !n.startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (!prefix) break;
  }
  prefix = (prefix || "").trim().replace(/[\s\-_·]+$/g, "");
  return prefix || names[0];
}

const SAMPLES = [
  {
    label: "정형",
    text: `성함: 조승빈
주소: 신림동 629-6 / 202호
연락처: 01094294445
가전 종류 및 갯수: 벽걸이에어컨 냉매충전
희망 날짜 및 시간대 (오전/오후):
4/23 오후`,
  },
  {
    label: "막무가내",
    text: `외도민: 논현동 97-2 103호
현관 비번 860903
아니 스탠드1 벽걸이1
+82 10-9053-9590
가격은 17
현장결제
비고: 다음주중 날잡아주세요!`,
  },
];

const THEMES = {
  dark: {
    name: "🌑 다크",
    bg: "#1A1512", bgElevated: "#221C18", bgInset: "#13100E",
    border: "rgba(255, 220, 200, 0.06)", borderStrong: "rgba(255, 220, 200, 0.10)",
    text: "#FAF8F5", textSecondary: "#C4B5A6", textMuted: "#8A7B6F", textDim: "#5C5048",
    accent: "#FF1B8D", accentBg: "rgba(255, 27, 141, 0.10)",
    success: "#10B981", successBg: "rgba(16, 185, 129, 0.10)",
    warning: "#FFB800", warningBg: "rgba(255, 184, 0, 0.10)",
    danger: "#FF3D5A", dangerBg: "rgba(239, 68, 68, 0.10)",
    info: "#3B82F6", infoBg: "rgba(59, 130, 246, 0.10)",
    isLight: false,
  },
  light: {
    name: "☀️ 라이트",
    bg: "#FAFAFA", bgElevated: "#FFFFFF", bgInset: "#F4F4F5",
    border: "rgba(0, 0, 0, 0.05)", borderStrong: "rgba(0, 0, 0, 0.09)",
    text: "#0A0A0A", textSecondary: "#404040", textMuted: "#737373", textDim: "#A3A3A3",
    accent: "#E91860", accentBg: "rgba(233, 24, 96, 0.06)",
    success: "#16A34A", successBg: "rgba(22, 163, 74, 0.08)",
    warning: "#FF1B8D", warningBg: "rgba(217, 119, 6, 0.08)",
    danger: "#FF3D5A", dangerBg: "rgba(220, 38, 38, 0.06)",
    info: "#2563EB", infoBg: "rgba(37, 99, 235, 0.06)",
    isLight: true,
  },
};

// ──────────────────────────────────────────────────────────
// 카톡 파서 (parseKakao) - v2: 막무가내 메시지 + 폴백 지원
// ──────────────────────────────────────────────────────────

const PHONE_PATTERNS = [
  /\+?82[-\s]?(?:0)?(10)[-\s]?(\d{3,4})[-\s]?(\d{4})/,   // +82 10-...
  /(01[016789])[-\s]?(\d{3,4})[-\s]?(\d{4})/,             // 010-... / 010 ...
  /(01[016789])(\d{7,8})/,                                 // 01094294445
];

function isPhoneInLine(line) {
  return PHONE_PATTERNS.some((re) => re.test(line));
}

function fmtPhone(nums) {
  const digits = nums.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  return digits;
}

function extractPhone(text) {
  let m = text.match(PHONE_PATTERNS[0]);
  if (m) return fmtPhone("0" + m[1] + m[2] + m[3]);
  m = text.match(PHONE_PATTERNS[1]);
  if (m) return fmtPhone(m[1] + m[2] + m[3]);
  m = text.match(PHONE_PATTERNS[2]);
  if (m) return fmtPhone(m[1] + m[2]);
  return "";
}

function looksLikeAddress(s) {
  if (!s) return false;
  return /[가-힣]+(시|구|동|로|길)(\s|$|[^가-힣])/.test(s)
      || /\d+호/.test(s)
      || /아파트|빌라|타워|단지|번지/.test(s);
}

// 가격 단위 정책:
//   "17만"/"17만원" → 170,000   (만 명시)
//   "170000원"/"170,000원" → 170,000   (원 명시, 그대로)
//   단위 없음 + 숫자 < 1000 → 만원으로 해석 (17 → 170,000)
//   단위 없음 + 숫자 ≥ 1000 → 원 그대로 (50000 → 50,000)
function parsePrice(text) {
  if (!text) return null;
  const s = String(text).replace(/\s/g, "");
  if (!/\d/.test(s)) return null;

  const hasMan = /만/.test(s);
  const hasWon = /원/.test(s);

  const m = s.match(/[\d,]+/);
  if (!m) return null;
  const n = parseInt(m[0].replace(/,/g, ""), 10);
  if (isNaN(n)) return null;

  if (hasMan) return n * 10000;
  if (hasWon) return n;
  return n < 1000 ? n * 10000 : n;
}

function parseKakao(text) {
  const result = {
    name: "", phone: "", address: "", workType: "", quantity: 1,
    dateText: "", timeText: "", estimateTotal: null, memo: "", raw: text,
  };
  if (!text || !text.trim()) return result;

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const consumed = new Set();

  // ── 1. Phone (전체 텍스트에서 검색) ──
  result.phone = extractPhone(text);

  // ── 2. 라벨 있는 줄 처리 ──
  // 라벨 길이는 30자까지 허용 ("희망 날짜 및 시간대 (오전/오후):" 같은 긴 라벨 대응)
  const labelRe = /^(.{1,30}?)\s*[:：]\s*(.*)$/;
  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const m = lines[i].match(labelRe);
    if (!m) continue;
    const label = m[1].trim();
    const value = m[2].trim();

    // 희망/날짜/시간 - 빈 값이면 다음 줄 참조
    if (/희망|날짜|시간/.test(label)) {
      const target = value || lines[i + 1] || "";
      const dm = target.match(/\d{1,2}[\/.\-]\d{1,2}|\d{4}-\d{1,2}-\d{1,2}/);
      if (dm) result.dateText = dm[0];
      const tm = target.match(/오전|오후|아침|점심|저녁|낮/);
      if (tm) result.timeText = tm[0];
      consumed.add(i);
      if (!value && lines[i + 1]) consumed.add(i + 1);
      continue;
    }

    if (!value) continue;

    if (/성함|이름|고객명/.test(label) && !result.name) {
      result.name = value;
      consumed.add(i);
    } else if (/연락처|전화|번호|핸드폰/.test(label)) {
      consumed.add(i); // 폰은 step 1에서 추출됨
    } else if (/주소|위치/.test(label) && !result.address) {
      result.address = value;
      consumed.add(i);
    } else if (/가전|작업|종류|기종/.test(label) && !result.workType) {
      result.workType = value;
      const qm = value.match(/(\d+)\s*[대개]/);
      if (qm) result.quantity = parseInt(qm[1], 10);
      consumed.add(i);
    } else if (/비고|메모|요청|특이/.test(label)) {
      result.memo = result.memo ? result.memo + " / " + value : value;
      consumed.add(i);
    } else if (/가격|금액|견적|비용/.test(label)) {
      const p = parsePrice(value);
      if (p !== null) result.estimateTotal = p;
      consumed.add(i);
    } else if (label.length <= 6 && !result.name) {
      // 짧은 라벨 + 주소/폰 = 닉네임 패턴 (예: "외도민: 논현동 97-2 103호")
      if (isPhoneInLine(value)) {
        result.name = label;
        consumed.add(i);
      } else if (looksLikeAddress(value)) {
        result.name = label;
        if (!result.address) result.address = value;
        consumed.add(i);
      }
    }
  }

  // ── 3. 폰만 있는 줄 정리 (메모로 새지 않게) ──
  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const stripped = lines[i].replace(/[\s+\-()]/g, "");
    if (/^\d{8,13}$/.test(stripped) && isPhoneInLine(lines[i])) {
      consumed.add(i);
    }
  }

  // ── 4. 작업종류 폴백 (라벨 없을 때 키워드 스캔) ──
  if (!result.workType) {
    const APPLIANCES = ["벽걸이", "스탠드", "시스템", "멀티", "천장", "캐리어", "창문형", "창문"];
    const OPS = ["세척", "설치", "철거", "이전", "냉매충전", "냉매", "점검", "수리", "충전"];
    const found = [];
    const ops = new Set();
    let totalQty = 0;

    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      const line = lines[i];
      let hit = false;

      for (const k of APPLIANCES) {
        const re = new RegExp(`${k}\\s*(\\d+)?\\s*[대개]?`, "g");
        let m;
        while ((m = re.exec(line)) !== null) {
          const qty = parseInt(m[1] || "1", 10);
          found.push({ pos: m.index, name: qty > 1 ? `${k} ${qty}대` : k });
          totalQty += qty;
          hit = true;
        }
      }
      for (const k of OPS) {
        if (line.includes(k)) { ops.add(k); hit = true; }
      }
      if (hit) consumed.add(i);
    }

    found.sort((a, b) => a.pos - b.pos);
    const parts = [];
    if (found.length) parts.push(found.map((a) => a.name).join("+"));
    if (ops.size) parts.push([...ops].join("+"));
    if (parts.length) {
      result.workType = parts.join(" ");
      if (totalQty > 0) result.quantity = totalQty;
    }
  }

  // ── 5. 주소 폴백 ──
  if (!result.address) {
    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      if (lines[i].length > 80) continue;
      if (looksLikeAddress(lines[i])) {
        result.address = lines[i];
        consumed.add(i);
        break;
      }
    }
  }

  // ── 6. 날짜/시간 폴백 (전체 스캔) ──
  if (!result.dateText) {
    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      const dm = lines[i].match(/\d{1,2}[\/.\-]\d{1,2}/);
      if (dm) { result.dateText = dm[0]; break; }
    }
  }
  if (!result.timeText) {
    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      const tm = lines[i].match(/오전|오후|아침|점심|저녁|낮/);
      if (tm) { result.timeText = tm[0]; break; }
    }
  }

  // ── 7. 가격 폴백 (라벨 없는 "가격은 17", "17만원" 등) ──
  if (result.estimateTotal === null) {
    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      const line = lines[i];
      const looksLikePrice =
        /가격|금액|견적|비용/.test(line) ||
        /\d\s*만원?(\s|$)/.test(line) ||
        /\d+\s*원(\s|$)/.test(line);
      if (!looksLikePrice) continue;
      const p = parsePrice(line);
      if (p !== null) {
        result.estimateTotal = p;
        consumed.add(i);
        break;
      }
    }
  }

  // ── 8. 메모 (남은 줄들 합침) ──
  const remaining = [];
  for (let i = 0; i < lines.length; i++) {
    if (!consumed.has(i)) remaining.push(lines[i]);
  }
  if (remaining.length) {
    const rest = remaining.join(" / ");
    result.memo = result.memo ? result.memo + " / " + rest : rest;
  }

  // ── 9. 메모/원본에서 상대날짜 힌트 추출 ──
  if (!result.dateText) {
    const src = result.memo || text;
    const rel = src.match(/오늘|내일|모레|이번주|다음주중?|이번달|주말|평일/);
    if (rel) result.dateText = rel[0];
  }

  // ── 10. 이름 폴백: 폰 뒷4자리 ──
  if (!result.name && result.phone) {
    const last4 = result.phone.replace(/\D/g, "").slice(-4);
    if (last4) result.name = `고객(${last4})`;
  }

  return result;
}

export default function PrincipalApp({ user, onLogout }) {
  // 2026-06-04 — localStorage 측 ollit_theme 측 우선 사용. 옛 'dark' 하드코딩 폐기.
  //   InfoTab 토글로 변경 시 즉시 applyThemeVars 발화 (mode useEffect 의존).
  const [mode, setMode] = useState(() => loadTheme());
  const [tab, setTab] = useState("list");
  const [submitted, setSubmitted] = useState(false);
  const [submittedTask, setSubmittedTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const t = THEMES[mode];
  // 2026-06-10 — PC 반응형 1차: 1024px 이상 PC 셸 (좌측 사이드바 + 메인 + 우측 상세 패널).
  const isPc = useIsPc();

  // 2026-06-08 — 인앱 알림 (IndexedDB notificationStore — 기사/운영자와 동일 저장소).
  const [notifications, setNotifications] = useState([]);
  useEffect(() => {
    let cancelled = false;
    async function reload() {
      const stored = await listStoredNotifications();
      if (cancelled) return;
      setNotifications((stored || []).map(s => ({
        id: s.id,
        type: "partner_message",   // 우선 fallback. NotiCard 측 pickIconFromTitle(title) 측 아이콘 선택.
        read: !!s.read,
        urgent: false,
        createdAt: new Date(s.timestamp || Date.now()),
        title: s.title || "",
        subtitle: s.body || "",
        relatedId: s.taskId || null,
        targetScreen: s.url || null,
      })));
    }
    reload();
    const handler = () => reload();
    window.addEventListener("notification:added", handler);
    return () => { cancelled = true; window.removeEventListener("notification:added", handler); };
  }, []);
  async function handleMarkAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await markAllStoredAsRead();
  }
  // 2026-06-11 — PC 알림 측 클릭 시 읽음만 (작업 상세 진입 X). 우측 상세 패널 측 표시.
  function handleMarkNotiRead(noti) {
    if (typeof noti.id === "number") markStoredAsRead(noti.id).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, read: true } : n));
  }
  async function handleNotiClick(noti) {
    if (typeof noti.id === "number") markStoredAsRead(noti.id).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, read: true } : n));
    if (!noti.relatedId) return;
    // 2026-06-11 — relatedId(taskId) → DB 단건 조회 후 작업 상세 진입 (AdminApp 동일 패턴).
    //   메모리 캐시가 없는 원청 시점이라도 완료/취소 무관 접근 가능.
    try {
      const row = await getTaskByIdDb(noti.relatedId);
      if (!row) return;
      setSelectedTask(v14NormalizeTask(row));
    } catch (e) {
      console.warn("[notiClick] task 조회 실패:", e);
    }
  }

  // 2026-06-03 — 글로벌 CSS 측 측측 (Principal 측측 측측 측측 dark 측측).
  //   측측: --text-primary 측측 LIGHT 측측 측측 측측 측측 측측 측측 측 측측 측 측측 측 측측.
  useEffect(() => {
    applyThemeVars(mode);
  }, [mode]);

  // NewTab 신규 접수용 mock fallback (사장님 spec — addTask만 필요)
  const { addTask } = useTasks();

  // 2026-05-23 — user.principals (Migration 057) → 옛 clientName fuzzy 폐기
  //   유솔홈케어 통합계정 측 user.principals = [{code:'usol_h',...}, {code:'usol_n',...}]
  // 2026-05-23 후속 — fetchTasks 와 PrincipalListTab 분리 (뷰 A=가벼운 fetch, 뷰 B=전체)
  const principalCodes = Array.isArray(user?.principals)
    ? user.principals.map(p => p?.code).filter(Boolean)
    : [];

  // 2026-06-09 — 유솔 통합계정 탭 분리 (유솔H / 유솔N).
  //   조건: user.principals 측 usol_h + usol_n 둘 다 있음 (통합계정).
  //   단일 계정 (usol_h만 또는 usol_n만) 측 탭 미표시 — selectedUsolCode 측 첫 코드 자동.
  //   list / settle 양쪽 탭 측 동일 selectedUsolCode 적용 (일관성).
  //   기본 탭 = 유솔N (활성 작업 65건 / 총 1,340건 — usol_h 15건 측 측 의미 큼).
  const isUsolUnified = principalCodes.includes("usol_h") && principalCodes.includes("usol_n");
  const [selectedUsolCode, setSelectedUsolCode] = useState(
    isUsolUnified ? "usol_n" : (principalCodes[0] || null)
  );
  // 통합계정 측 selectedUsolCode 측만 effective. 단일 계정 측 principalCodes 그대로.
  const effectiveCodes = isUsolUnified && selectedUsolCode
    ? [selectedUsolCode]
    : principalCodes;

  // 2026-06-11 — PC 사이드바 하단 요약 3개 (오늘접수 / 오늘작업 / 정산대기).
  //   useRef Map 캐시 (TTL 60s, key = effectiveCodes.join(',')). isPc 측만 fetch.
  //   tab 전환 / 다른 fetch 와 무관 — 사이드바 mount 1회 + TTL 만료 측만 갱신.
  const SIDEBAR_CACHE_TTL_MS = 60_000;
  const [sidebarSummary, setSidebarSummary] = useState({ todayReceived: 0, todayScheduled: 0, pendingSettle: 0 });
  const sidebarCache = useRef(new Map());
  useEffect(() => {
    if (!isPc) return;
    if (!Array.isArray(effectiveCodes) || effectiveCodes.length === 0) return;
    const cacheKey = effectiveCodes.join(",");
    const cached = sidebarCache.current.get(cacheKey);
    if (cached && Date.now() - cached.ts < SIDEBAR_CACHE_TTL_MS) {
      setSidebarSummary(cached.data);
      return;
    }
    let alive = true;
    fetchPrincipalSidebarSummary({ principalCodes: effectiveCodes })
      .then(res => {
        if (!alive || !res.ok) return;
        sidebarCache.current.set(cacheKey, { data: res.counts, ts: Date.now() });
        setSidebarSummary(res.counts);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPc, effectiveCodes.join(",")]);

  // 2026-06-03 — KA / crikrin 원청 분기 (유솔이면 null)
  const partnerCode = _resolvePartnerCode(user);
  const partnerConfig = partnerCode ? PARTNER_PWA_CONFIG[partnerCode] : null;
  const [quoteRates, setQuoteRates] = useState(null);

  useEffect(() => {
    if (!partnerCode) {
      setQuoteRates(null);
      return;
    }
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("principals")
        .select("code, quote_rates")
        .eq("code", partnerCode)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        console.warn("[PrincipalApp] quote_rates fetch 실패", error);
        setQuoteRates({});
        return;
      }
      setQuoteRates(data?.quote_rates || {});
    })();
    return () => { alive = false; };
  }, [partnerCode]);

  const reset = () => {
    setTab("list");
    setSubmitted(false);
    setSubmittedTask(null);
    setSelectedTask(null);
  };

  // 2026-06-10 — PC 셸 분기 (1024px 이상). 모바일 셸은 아래 기존 그대로.
  if (isPc) {
    return (
      <PcShell
        t={t}
        user={user}
        tab={tab}
        setTab={setTab}
        isPartnerMode={!!partnerConfig}
        hasSchedule={principalCodes.some(c => c === "usol_h" || c === "usol_n")}
        unreadCount={notifications.filter(n => !n.read).length}
        isUsolUnified={isUsolUnified}
        partnerCode={partnerCode}
        selectedUsolCode={selectedUsolCode}
        setSelectedUsolCode={setSelectedUsolCode}
        selectedTask={selectedTask}
        onCloseDetail={() => setSelectedTask(null)}
        onLogout={onLogout}
        sidebarSummary={sidebarSummary}
      >
        {submittedTask ? (
          <SubmittedScreen t={t} task={submittedTask} onContinue={() => { setSubmittedTask(null); setTab("list"); }}/>
        ) : (
          <>
            {tab === "list"   && <PrincipalListTab t={t} user={user} principalCodes={effectiveCodes} partnerCode={partnerCode} onSelect={setSelectedTask} selectedTaskId={selectedTask?.id}/>}
            {tab === "schedule" && <UsolHScheduleTab t={t} principalCodes={effectiveCodes} onSelect={setSelectedTask}/>}
            {tab === "upload" && <UploadTab t={t} user={user} partnerCode={partnerCode} partnerConfig={partnerConfig} quoteRates={quoteRates} onTaskClick={setSelectedTask} onSubmit={(task) => setSubmittedTask(task)} onBackToList={() => setTab("list")}/>}
            {tab === "settle" && (() => {
              const isUsolNOnly = effectiveCodes.length === 1 && effectiveCodes[0] === "usol_n";
              if (isUsolNOnly) {
                return <PrincipalSettleTab principalCodes={effectiveCodes} onSelect={setSelectedTask}/>;
              }
              return <PartnerDailySettleTab t={t} user={user} principalCodes={effectiveCodes} onTaskClick={setSelectedTask}/>;
            })()}
            {tab === "info"   && <InfoTab t={t} user={user} mode={mode} setMode={setMode} onLogout={onLogout}/>}
            {tab === "noti"   && (
              <NotiScreen
                notifications={notifications}
                onMarkAllRead={handleMarkAllRead}
                onCardClick={handleNotiClick}
                onMarkRead={handleMarkNotiRead}
                title="🔔 알림"
              />
            )}
          </>
        )}
      </PcShell>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", paddingTop: "env(safe-area-inset-top, 12px)" }}>
      {/* Step 5-6 UX hotfix — paddingTop env(safe-area-inset-top, 12px) — 휴대폰 status bar 영역 보호 */}
      <style>{`
        
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: slideUp 0.4s ease-out; }
        .mono { font-family: inherit; }
        .clickable { cursor: pointer; transition: all 0.15s; }
        .clickable:active { opacity: 0.7; transform: scale(0.98); }
        .tab-btn:hover { opacity: 0.8; }
      `}</style>

      {/* Step 5-6 UX — 상단 sticky 박스 (다크/라이트/로그아웃) 제거 */}

      <div style={{ maxWidth: 420, margin: "0 auto", background: t.bg, minHeight: "100vh", color: t.text, fontFamily: "'Pretendard', sans-serif", paddingBottom: 80 }}>
        
        <Header t={t} user={user}/>

        {submittedTask ? (
          <SubmittedScreen t={t} task={submittedTask} onContinue={() => { setSubmittedTask(null); setTab("list"); }}/>
        ) : (
          <>
            {/* 2026-05-25 — 작업 상세 떠있을 때도 리스트/탭 mount 유지 (display:none)
                → 뒤로가기 시 직전 화면(view A/B · filter · search · scroll) 그대로 복원 */}
            <div style={{ display: selectedTask ? "none" : "block" }}>
              {/* 2026-06-09 — 유솔 통합계정 (usol_h + usol_n) 측 list / settle 진입 시 sticky 탭. */}
              {isUsolUnified && !partnerCode && (tab === "list" || tab === "settle") && (
                <UsolTabSwitcher
                  t={t}
                  value={selectedUsolCode}
                  onChange={setSelectedUsolCode}
                />
              )}
              {tab === "list"   && <PrincipalListTab t={t} user={user} principalCodes={effectiveCodes} partnerCode={partnerCode} onSelect={setSelectedTask}/>}
              {tab === "schedule" && <UsolHScheduleTab t={t} principalCodes={effectiveCodes} onSelect={setSelectedTask}/>}
              {tab === "upload" && <UploadTab t={t} user={user} partnerCode={partnerCode} partnerConfig={partnerConfig} quoteRates={quoteRates} onTaskClick={setSelectedTask} onSubmit={(task) => setSubmittedTask(task)} onBackToList={() => setTab("list")}/>}
              {/* 2026-06-06 — KA/crikrin (partnerCode 존재) 측 PartnerDailySettleTab (일정산).
                  2026-06-09 — 유솔H 측 PartnerDailySettleTab 재사용 (사장님 spec 갱신):
                    유솔H 정산 = 일반 일일정산 UI (allday/KA 와 동일 — 헤더 / N월 누적 / 일별 묶음).
                    유솔N 만 옛 PrincipalSettleTab (네이버 월정산 특수 UI).
                  분기 키 = effectiveCodes 측 usol_n 단일 여부. 통합계정 측 selectedUsolCode 측 결정. */}
              {tab === "settle" && (() => {
                const isUsolNOnly = effectiveCodes.length === 1 && effectiveCodes[0] === "usol_n";
                if (isUsolNOnly) {
                  return <PrincipalSettleTab principalCodes={effectiveCodes} onSelect={setSelectedTask}/>;
                }
                return <PartnerDailySettleTab t={t} user={user} principalCodes={effectiveCodes} onTaskClick={setSelectedTask}/>;
              })()}
              {tab === "info"   && <InfoTab t={t} user={user} mode={mode} setMode={setMode} onLogout={onLogout}/>}
              {/* 2026-06-08 — 원청 인앱 알림 탭 */}
              {tab === "noti"   && (
                <NotiScreen
                  notifications={notifications}
                  onMarkAllRead={handleMarkAllRead}
                  onCardClick={handleNotiClick}
                  title="🔔 알림"
                />
              )}
            </div>
            {selectedTask && <TaskDetail t={t} task={selectedTask} user={user} onBack={() => setSelectedTask(null)}/>}
          </>
        )}

        {!selectedTask && !submittedTask && (
          <BottomNav
            t={t} tab={tab} onChange={setTab}
            isPartnerMode={!!partnerConfig}
            hasSchedule={principalCodes.some(c => c === "usol_h" || c === "usol_n")}
            unreadCount={notifications.filter(n => !n.read).length}
          />
        )}
      </div>
    </div>
  );
}

// 2026-06-10 — PC 셸 (1024px 이상). 좌측 사이드바 + 메인 + 우측 상세 패널.
//   원칙: 데이터·로직 컴포넌트 한 벌 공유, 배치만 분기. 기존 테마 토큰 그대로 사용.
function PcShell({
  t, user, tab, setTab,
  isPartnerMode, hasSchedule, unreadCount,
  isUsolUnified, partnerCode, selectedUsolCode, setSelectedUsolCode,
  selectedTask, onCloseDetail, onLogout,
  sidebarSummary,
  children,
}) {
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: t.bg,
      color: t.text,
      fontFamily: "'Pretendard', sans-serif",
    }}>
      <PcSidebar
        t={t} user={user}
        tab={tab} setTab={setTab}
        isPartnerMode={isPartnerMode}
        hasSchedule={hasSchedule}
        unreadCount={unreadCount}
        isUsolUnified={isUsolUnified}
        partnerCode={partnerCode}
        selectedUsolCode={selectedUsolCode}
        setSelectedUsolCode={setSelectedUsolCode}
        onLogout={onLogout}
        sidebarSummary={sidebarSummary}
      />
      <main style={{
        flex: 1,
        minWidth: 0,
        overflow: "auto",
        background: t.bg,
        height: "100vh",
      }}>
        {children}
      </main>
      {selectedTask && (
        <aside style={{
          width: PC_DETAIL_W,
          flexShrink: 0,
          borderLeft: `1px solid ${t.border}`,
          overflow: "auto",
          background: t.bg,
          position: "relative",
          height: "100vh",
        }}>
          <button
            onClick={onCloseDetail}
            aria-label="상세 닫기"
            style={{
              position: "absolute",
              top: 12, right: 14,
              background: "transparent",
              border: "none",
              color: t.textMuted,
              fontSize: 22,
              fontWeight: 700,
              cursor: "pointer",
              padding: 4,
              lineHeight: 1,
              zIndex: 5,
            }}
          >×</button>
          <TaskDetail t={t} task={selectedTask} user={user} onBack={onCloseDetail}/>
        </aside>
      )}
    </div>
  );
}

// 2026-06-11 — PC 사이드바 재디자인 (여백형 + 하단 요약).
//   상단: 원청 라벨 + 작은 세그먼트 (유솔H/N 통합계정 측만).
//   메뉴: 6개, 세로 가운데 정렬 (flex 1 + justify-center). 글자 14 / 아이콘 19.
//        활성 = 핑크 배경 (opacity 0.10) + 좌측 3px 핑크 바 + 핑크 텍스트.
//   하단: 요약 3개 (오늘접수 / 오늘작업 / 정산대기), border-top 위.
//   맨 아래: 로그아웃.
function PcSidebar({
  t, user, tab, setTab,
  isPartnerMode, hasSchedule, unreadCount,
  isUsolUnified, partnerCode, selectedUsolCode, setSelectedUsolCode,
  onLogout,
  sidebarSummary = { todayReceived: 0, todayScheduled: 0, pendingSettle: 0 },
}) {
  const tabs = [
    { id: "list",   icon: ClipboardList, label: "내 작업" },
    ...(hasSchedule ? [{ id: "schedule", icon: Calendar, label: "일정" }] : []),
    { id: "upload", icon: Plus,          label: isPartnerMode ? "접수" : "업로드" },
    { id: "settle", icon: Wallet,        label: "정산" },
    { id: "noti",   icon: Bell,          label: "알림", badge: unreadCount },
    { id: "info",   icon: User,          label: "내 정보" },
  ];
  const principalName = cleanGreetingName(user?.name || getPrincipalLabel(user), "원청");
  // usol_n 한정 정산대기 — 외 원청은 라벨 숨김 (요약 2개로 표시).
  const showPendingSettle = selectedUsolCode === "usol_n"
    || (!isUsolUnified && Array.isArray(user?.principals) && user.principals.some(p => p?.code === "usol_n"));

  return (
    <aside style={{
      width: PC_SIDEBAR_W,
      flexShrink: 0,
      background: t.bgElevated,
      borderRight: `1px solid ${t.border}`,
      display: "flex",
      flexDirection: "column",
      position: "sticky",
      top: 0,
      height: "100vh",
      overflowY: "auto",
    }}>
      {/* 상단 — 원청 라벨 + 작은 세그먼트 */}
      <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${t.border}` }}>
        <div className="mono" style={{
          fontSize: 9, color: t.textMuted, letterSpacing: 2,
          fontWeight: 600, textTransform: "uppercase", marginBottom: 4,
        }}>원청</div>
        <div style={{
          fontSize: 15, fontWeight: 800, color: t.text,
          lineHeight: 1.3, wordBreak: "keep-all",
          marginBottom: isUsolUnified && !partnerCode ? 12 : 0,
        }}>{principalName}</div>
        {/* 작은 세그먼트 — 트랙 안 활성만 핑크 채움 (통합계정 전용) */}
        {isUsolUnified && !partnerCode && (
          <UsolSegmentToggle t={t} value={selectedUsolCode} onChange={setSelectedUsolCode}/>
        )}
      </div>

      {/* 메뉴 — 계정 영역 바로 아래 flex-start. flex 1 측 남는 공간 차지.
            하단 요약 + 로그아웃 측 margin-top:auto 효과 측 바닥 부착. */}
      <nav style={{
        flex: 1,
        padding: "10px 10px 14px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        gap: 8,
      }}>
        {tabs.map(b => {
          const Icon = b.icon;
          const active = tab === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setTab(b.id)}
              className="tab-btn"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 14px",
                background: active ? "rgba(255,27,141,0.10)" : "transparent",
                border: "none",
                borderLeft: `3px solid ${active ? (t.accent || "#FF1B8D") : "transparent"}`,
                borderRadius: 8,
                color: active ? (t.accent || "#FF1B8D") : t.textSecondary,
                fontSize: 14,
                fontWeight: active ? 800 : 600,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <Icon size={20}/>
              <span style={{ flex: 1 }}>{b.label}</span>
              {b.badge > 0 && (
                <span style={{
                  minWidth: 18, height: 18, padding: "0 5px",
                  background: t.accent || "#FF1B8D", color: "#fff",
                  borderRadius: 9, fontSize: 10, fontWeight: 700,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>{b.badge > 99 ? "99+" : b.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 2026-06-11 — 하단 요약 세로 스택 (옛 grid 3등분 측 폐기 — 빈 공간 분산).
            각 행: 라벨 좌 / 숫자 우 (space-between).
            정산대기 숫자만 주황 (warn). 유솔H 측 정산대기 행 숨김. */}
      <div style={{
        padding: "12px 16px",
        borderTop: `1px solid ${t.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        <SidebarStat t={t} label="오늘 접수" value={sidebarSummary.todayReceived}/>
        <SidebarStat t={t} label="오늘 작업" value={sidebarSummary.todayScheduled}/>
        {showPendingSettle && (
          <SidebarStat t={t} label="정산 대기" value={sidebarSummary.pendingSettle} warn/>
        )}
      </div>

      {/* 맨 아래 — 로그아웃 */}
      <div style={{ padding: "10px 14px 16px", borderTop: `1px solid ${t.border}` }}>
        <button
          onClick={onLogout}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 12px",
            background: "transparent",
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            color: t.textMuted,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <LogOut size={14}/>
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  );
}

// 2026-06-11 — 2단 세로 스택 라디오 토글 (유솔H 위 / 유솔N 아래).
//   활성 = 핑크 #E0407E 꽉 채움 + 흰 글자.
//   비활성 = 연한 배경 (t.bgInset) + 회색 글자. 색 대비 강하게 → "둘 다 켜짐" 오해 X.
function UsolSegmentToggle({ t, value, onChange }) {
  const tabs = [
    { code: "usol_h", label: "유솔H" },
    { code: "usol_n", label: "유솔N" },
  ];
  const PINK_ACTIVE = "#E0407E";
  return (
    <div
      role="radiogroup"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        width: "100%",
      }}
    >
      {tabs.map(tab => {
        const active = value === tab.code;
        return (
          <button
            key={tab.code}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(tab.code)}
            style={{
              width: "100%",
              padding: "9px 12px",
              background: active ? PINK_ACTIVE : (t.bgInset || "rgba(0,0,0,0.18)"),
              border: `1px solid ${active ? PINK_ACTIVE : (t.border || "#2A2A2A")}`,
              borderRadius: 7,
              color: active ? "#fff" : (t.textSecondary || "#9CA3AF"),
              fontSize: 13,
              fontWeight: active ? 800 : 700,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
              textAlign: "center",
            }}
          >{tab.label}</button>
        );
      })}
    </div>
  );
}

// 2026-06-11 — 사이드바 하단 요약 1행 (세로 스택 안 한 줄).
//   라벨 좌 / 숫자 우 (space-between).
//   warn = 주황 (정산대기 측). accent = 핑크 (선택). 미지정 측 기본 텍스트 색.
function SidebarStat({ t, label, value, accent, warn }) {
  const numColor = warn
    ? "#F59E0B"
    : accent
    ? (t.accent || "#FF1B8D")
    : t.text;
  return (
    <div style={{
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 8,
    }}>
      <span style={{
        fontSize: 12,
        color: t.textSecondary || t.textMuted,
        fontWeight: 600,
        letterSpacing: 0.2,
      }}>{label}</span>
      <span className="mono" style={{
        fontSize: 16,
        fontWeight: 800,
        color: numColor,
        lineHeight: 1.1,
        letterSpacing: "-0.2px",
      }}>{Number(value || 0).toLocaleString()}</span>
    </div>
  );
}

// 2026-06-09 — 유솔H / 유솔N 탭 전환기 (통합계정 측만 노출).
//   sticky 상단. value/onChange 측 부모 (PrincipalApp) 측 selectedUsolCode 측.
//   list / settle 진입 측 같은 컨트롤 — 한 번 선택하면 양쪽 화면 일관.
function UsolTabSwitcher({ t, value, onChange }) {
  const tabs = [
    { code: "usol_h", label: "유솔H" },
    { code: "usol_n", label: "유솔N" },
  ];
  return (
    <div style={{
      position: "sticky",
      top: 0,
      zIndex: 5,
      background: t.bg,
      padding: "8px 14px 6px",
      display: "flex",
      gap: 6,
    }}>
      {tabs.map(tab => {
        const active = value === tab.code;
        return (
          <button
            key={tab.code}
            type="button"
            onClick={() => onChange(tab.code)}
            style={{
              flex: 1,
              padding: "9px 12px",
              background: active ? (t.accent || "#FF1B8D") : "transparent",
              border: `1px solid ${active ? (t.accent || "#FF1B8D") : (t.border || "#2A2A2A")}`,
              borderRadius: 999,
              color: active ? "#fff" : (t.textSecondary || "#9CA3AF"),
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function Header({ t, user }) {
  return (
    <div style={{ padding: "20px 20px 0" }}>
      <div style={{ marginBottom: 20 }}>
        <div className="mono" style={{ fontSize: 10, color: t.textMuted, letterSpacing: 2, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>
          {TODAY} · {NOW}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          안녕하세요, <span style={{ color: t.accent }}>{cleanGreetingName(user?.name || getPrincipalLabel(user), "원청")}</span> 님
        </div>
      </div>
    </div>
  );
}

// 2026-06-06 — upload 탭 라벨 원청별 분기.
//   isPartnerMode (KA/crikrin) → "접수" (NewReceptionScreenLite 직접 입력 단일 경로)
//   유솔(usol_h/usol_n)         → "업로드" (CSV/네이버 시트 업로드 + 수동 입력 혼합 흐름)
//   Plus 아이콘은 신규 생성 의미로 양쪽 공통 유지.
function BottomNav({ t, tab, onChange, isPartnerMode, hasSchedule, unreadCount = 0 }) {
  // 2026-06-06 — usol_h 측 "일정" 탭 (Calendar).
  // 2026-06-08 — 원청 인앱 알림 탭 추가 (info 앞).
  const tabs = [
    { id: "list",   icon: ClipboardList, label: "내 작업" },
    ...(hasSchedule ? [{ id: "schedule", icon: Calendar, label: "일정" }] : []),
    { id: "upload", icon: Plus,          label: isPartnerMode ? "접수" : "업로드" },
    { id: "settle", icon: Wallet,        label: "정산" },
    { id: "noti",   icon: Bell,          label: "알림", badge: unreadCount },
    { id: "info",   icon: User,          label: "내 정보" },
  ];
  return (
    <div style={{ 
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 420,
      background: t.bgElevated, borderTop: `1px solid ${t.border}`,
      display: "flex", padding: "8px 8px 12px",
      zIndex: 100,
    }}>
      {tabs.map(b => {
        const Icon = b.icon;
        const active = tab === b.id;
        const isPlus = b.id === "upload";
        return (
          <button key={b.id} onClick={() => onChange(b.id)} className="tab-btn" style={{
            flex: 1, background: "transparent", border: "none",
            padding: "8px 6px", cursor: "pointer", fontFamily: "inherit",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            color: active ? t.accent : t.textMuted,
          }}>
            <div style={{
              width: isPlus ? 36 : 24, height: isPlus ? 36 : 24,
              borderRadius: isPlus ? 12 : 0,
              background: isPlus ? (active ? t.accent : t.accentBg) : "transparent",
              color: isPlus ? (active ? "white" : t.accent) : (active ? t.accent : t.textMuted),
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}>
              <Icon size={isPlus ? 18 : 18}/>
              {b.badge > 0 && (
                <span style={{
                  position: "absolute", top: -4, right: -8,
                  minWidth: 16, height: 16, padding: "0 4px",
                  background: "#FF1B8D", color: "#fff",
                  borderRadius: 8, fontSize: 10, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{b.badge > 99 ? "99+" : b.badge}</span>
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700 }}>{b.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// 업로드 탭 — 원청별 분기.
//   유솔(partnerCode=null) → CSV 토글 2개 + UsolNOrders + 유솔H 직접 입력 (기존 흐름, 런처 → 폼)
//   KA / crikrin (partnerConfig 존재) → 2026-06-06 탭 진입 시 폼 직행 (런처 한 단계 제거).
function UploadTab({ t, user, partnerCode, partnerConfig, quoteRates, onTaskClick, onSubmit, onBackToList }) {
  const [sub, setSub] = useState("receive");   // 'receive' | 'settle'  (유솔만 사용)
  const [showNewForm, setShowNewForm] = useState(false);   // 유솔H 만 사용 (KA/crikrin 은 직행)

  // KA / crikrin 모드 — 단가표 fetch 끝나야 폼 진입
  const isPartnerMode = !!partnerConfig;

  // 2026-06-06 — 붙여넣기 prefill 상태 (KA/crikrin 전용).
  //   폼 unmount(제출 후 닫힘) 후에도 보존돼야 함 → UploadTab 측 보관.
  //   parseToken : 파싱 호출 1회당 증가 → 폼 useEffect 가 fresh-parse 감지에 사용.
  const [pasteText, setPasteText]           = useState("");
  const [parsedRecords, setParsedRecords]   = useState([]);
  const [parseToken, setParseToken]         = useState(0);

  function handleParse(text) {
    const recs = parsePartnerPaste(text, partnerCode);
    setParsedRecords(recs);
    setParseToken(n => n + 1);
  }
  function handleConsumeRecord(idx) {
    setParsedRecords(prev => prev.filter((_, i) => i !== idx));
    // 남은 record 가 1개면 폼 재진입 시 자동 prefill 되게 token 갱신.
    setParseToken(n => n + 1);
  }

  // 2026-06-06 — KA / crikrin: 탭 진입 시 폼 직행. 옛 런처(헤더+버튼) 한 단계 제거.
  //   onBack = list 탭 전환 (자연스러운 "뒤로"). 제출 후엔 parent submittedTask → success 화면 → list.
  //   단가표 로딩 중엔 폼 대신 안내 메시지 (KA 1way 분할 등 quote_rates 필수).
  if (isPartnerMode) {
    if (quoteRates === null) {
      return (
        <div className="fade-in" style={{
          padding: "60px 14px", textAlign: "center",
          color: t.textMuted, fontSize: 13, fontWeight: 600,
        }}>
          단가표 불러오는 중...
        </div>
      );
    }
    return (
      <NewReceptionScreenLite
        t={t}
        user={user}
        onBack={onBackToList || (() => {})}
        onSubmit={(task) => onSubmit?.(task)}
        principalCode={partnerCode}
        principalLabel={partnerConfig.label}
        workTypes={partnerConfig.workTypes}
        appliancePool={partnerConfig.appliancePool}
        quoteRates={quoteRates}
        accentColor={t.accent}
        pasteText={pasteText}
        onPasteTextChange={setPasteText}
        parsedRecords={parsedRecords}
        parseToken={parseToken}
        onParse={handleParse}
        onConsumeRecord={handleConsumeRecord}
      />
    );
  }

  // 유솔H — 옛 런처 + showNewForm 흐름 유지 (CSV 토글 사용 시나리오 보존).
  if (showNewForm) {
    return (
      <NewReceptionScreenLite
        t={t}
        user={user}
        onBack={() => setShowNewForm(false)}
        onSubmit={(task) => { setShowNewForm(false); onSubmit?.(task); }}
      />
    );
  }

  // 유솔 모드 — 기존 흐름 그대로
  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>📤 업로드</div>

      {/* 토글 — 접수 / 정산 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <UploadToggleBtn active={sub === "receive"} onClick={() => setSub("receive")} t={t}>접수 CSV</UploadToggleBtn>
        <UploadToggleBtn active={sub === "settle"}  onClick={() => setSub("settle")} t={t}>정산 CSV</UploadToggleBtn>
      </div>

      {sub === "receive" && (
        <>
          <UsolNOrders hideList onTaskClick={onTaskClick}/>
          <div style={{
            marginTop: 18, paddingTop: 14,
            borderTop: `1px solid ${t.border}`,
          }}>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginBottom: 8 }}>
              직접 입력 (유솔홈케어 H)
            </div>
            <button
              onClick={() => setShowNewForm(true)}
              style={{
                width: "100%", padding: "14px 16px",
                background: "transparent",
                border: `1px solid #FF4D9E`,
                borderRadius: 10,
                color: "#FF4D9E",
                fontSize: 13, fontWeight: 700,
                fontFamily: "inherit",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <Plus size={14}/><span>새 접수 등록</span>
            </button>
          </div>
        </>
      )}

      {sub === "settle" && <UsolNCsvMatch/>}
    </div>
  );
}

function UploadToggleBtn({ active, onClick, t, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 12px",
      background: active ? "#FF4D9E" : t.bgInset,
      color: active ? "#fff" : t.text,
      border: `1px solid ${active ? "#FF4D9E" : t.border}`,
      borderRadius: 10,
      fontSize: 12, fontWeight: 700,
      fontFamily: "inherit",
      cursor: "pointer",
    }}>{children}</button>
  );
}

function SubmittedScreen({ t, task, onContinue }) {
  return (
    <div className="fade-in" style={{ padding: "40px 20px", textAlign: "center" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: t.successBg, border: `2px solid ${t.success}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        marginBottom: 24,
      }}>
        <CheckCircle2 size={36} style={{ color: t.success }}/>
      </div>

      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
        접수 완료!
      </div>
      <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500, marginBottom: 30, lineHeight: 1.6 }}>
        올잇 운영팀에 접수되었어요<br/>
        곧 관리자 확인 후 프로 배정될 예정이에요
      </div>

      <div style={{
        background: t.bgElevated,
        borderRadius: 14, padding: "20px",
        marginBottom: 20, textAlign: "left",
      }}>
        <div className="mono" style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 12 }}>
          {task.id}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Row t={t} label="고객" value={task.customer}/>
          <Row t={t} label="연락처" value={task.phone} mono/>
          <Row t={t} label="주소" value={task.address}/>
          {/* 2026-05-26 fix: task.workType / task.quantity 측 NewReceptionScreenLite onSubmit payload 측 X →
              workItems[0] 측 catch — appliance × qty (앞서 admin/engineer 측 catch 측 패턴) */}
          <Row t={t} label="작업" value={(() => {
            const items = Array.isArray(task.workItems) ? task.workItems : [];
            const main = items[0];
            const wt   = main?.workType  || task.workType  || "—";
            const app  = main?.appliance || task.appliance || "";
            const qty  = main?.qty       || task.qty       || task.quantity || 1;
            const more = items.length > 1 ? ` 외 ${items.length - 1}건` : "";
            return app ? `${wt} · ${app} ×${qty}${more}` : `${wt} ×${qty}${more}`;
          })()}/>
          {task.scheduled && <Row t={t} label="희망일" value={task.scheduled}/>}
        </div>
      </div>

      <div style={{
        background: t.accentBg, border: `1px solid ${t.accent}40`,
        borderRadius: 12, padding: "12px 14px", marginBottom: 24,
        textAlign: "left",
      }}>
        <div style={{ fontSize: 11, color: t.accent, fontWeight: 700, marginBottom: 4 }}>
          📲 다음 단계
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.6 }}>
          1. 올잇 운영팀에 접수됨<br/>
          2. 관리자 확인 → 일정 확정<br/>
          3. 프로 배정 → 작업 진행<br/>
          4. 완료 사진 + 정산 내역 자동 업데이트
        </div>
      </div>

      <button onClick={onContinue} style={{
        width: "100%", padding: "16px",
        background: t.accent, color: "white",
        border: "none", borderRadius: 12,
        fontSize: 14, fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
      }}>
        내 작업 리스트 보기
      </button>
    </div>
  );
}

function Row({ t, label, value, mono }) {
  // 2026-06-11 — 상세 패널 측 정산 라벨/값 +2 (사장님 spec).
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <span style={{ fontSize: 13, color: t.textMuted, fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span className={mono ? "mono" : ""} style={{ fontSize: 14, fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function ListTab({ t, onSelect, tasks }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  
  let filtered = filter === "all" ? tasks : tasks.filter(x => x.status === filter);
  if (search) {
    filtered = filtered.filter(x => 
      x.customer.includes(search) || x.address.includes(search) || x.id.includes(search)
    );
  }
  
  const stats = {
    total: tasks.length,
    inProgress: tasks.filter(x => ["미배정", "확정", "진행중"].includes(x.status)).length,
    completed: tasks.filter(x => x.status === "완료").length,
  };

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📋 내 작업 리스트</div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          원청이 등록한 모든 작업
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <Stat t={t} label="전체" value={stats.total} color={t.text}/>
        <Stat t={t} label="진행중" value={stats.inProgress} color={t.warning}/>
        <Stat t={t} label="완료" value={stats.completed} color={t.success}/>
      </div>

      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}/>
        <input
          type="text"
          placeholder="고객명 / 주소 / 작업번호"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px 10px 38px",
            background: t.bgElevated, color: t.text,
            border: `1px solid ${t.border}`,
            borderRadius: 10, fontSize: 12,
            boxSizing: "border-box", outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["all", "미배정", "확정", "완료"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 12px",
            background: filter === f ? t.accent : t.bgInset,
            color: filter === f ? "white" : t.text,
            border: `1px solid ${filter === f ? t.accent : t.border}`,
            borderRadius: 8, fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {f === "all" ? "전체" : f}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
            검색 결과가 없어요
          </div>
        ) : filtered.map(task => (
          <TaskCard key={task.id} t={t} task={task} onClick={() => onSelect(task)}/>
        ))}
      </div>
    </div>
  );
}

function Stat({ t, label, value, color }) {
  return (
    <div style={{ padding: "10px 12px", background: t.bgElevated, borderRadius: 10, textAlign: "center" }}>
      <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function TaskCard({ t, task, onClick }) {
  const statusStyle = {
    "완료": { color: t.success, bg: t.successBg },
    "진행중": { color: t.warning, bg: t.warningBg },
    "확정": { color: t.text, bg: t.bgInset },
    "미배정": { color: t.danger, bg: t.dangerBg },
  };
  const ss = statusStyle[task.status] || { color: t.textMuted, bg: t.bgInset };

  return (
    <div onClick={onClick} className="clickable" style={{
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 4 }}>
            {task.id}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>
            {task.customer} <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>· {task.region}</span>
          </div>
          <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 4 }}>
            {task.workType} ({task.quantity}대)
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "4px 9px",
          background: ss.bg, color: ss.color,
          borderRadius: 5, flexShrink: 0,
        }}>
          {task.status}
        </span>
      </div>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 11, color: t.textMuted }}>
          {task.engineer ? <span>👤 {task.engineer}</span> : <span>배정 대기</span>}
          {task.scheduled && <span> · {task.scheduled.split(" ")[0]}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {task.principal_amount > 0 && (
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: PRINCIPAL_COLOR }}>
              +₩{(task.principal_amount / 1000).toFixed(0)}K
            </span>
          )}
          <ChevronRight size={14} style={{ color: t.textMuted }}/>
        </div>
      </div>
    </div>
  );
}

function TaskDetail({ t, task: initialTask, user, onBack }) {
  // 2026-06-04 — 정산 박스 라벨 측 원청 표시명 — 헤더 인사말과 동일 값 사용.
  //   cleanGreetingName(user.name || getPrincipalLabel(user)) → "에어컨프로" 등.
  const principalLabel = cleanGreetingName(user?.name || getPrincipalLabel(user), "원청");
  // 정산 탭에서 진입 시 부분 task — mount 시 full task refetch.
  //   목록 탭은 normalized task라 영향 X (덮어쓰면 동일 내용).
  // 2026-06-02 — 깜빡임 개선 (사장님 spec): partial initial은 spinner 노출, full은 즉시 표시.
  //   isInitialFull = task_no + address 모두 있음 → 즉시 표시 / partial → loading.
  // 2026-06-02 — 무한 스피너 해결: try/catch/finally로 감싸 fetch 실패 시 반드시 setLoading(false).
  //   실패 시 fetchError 상태로 안내 문구 표시 (영원히 안 멈추는 화면 방지).
  const isInitialFull = !!(initialTask?.task_no && initialTask?.address);
  const [task, setTask] = useState(initialTask);
  const [loading, setLoading] = useState(!isInitialFull);
  const [fetchError, setFetchError] = useState(null);
  useEffect(() => {
    setTask(initialTask);
    setLoading(!(initialTask?.task_no && initialTask?.address));
    setFetchError(null);
  }, [initialTask?.id]);
  useEffect(() => {
    if (!initialTask?.id) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const row = await getTaskByIdDb(initialTask.id);
        if (!alive) return;
        if (row) {
          const normalized = v14NormalizeTask(row);
          if (normalized) {
            setTask(normalized);
            setFetchError(null);
          } else {
            setFetchError("작업 정보 형식이 올바르지 않습니다");
          }
        } else {
          setFetchError("작업 정보를 찾을 수 없습니다");
        }
      } catch (e) {
        if (alive) setFetchError(e?.message || "작업 정보를 불러오지 못했습니다");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [initialTask?.id]);

  // 2026-05-24 — 상태 배지 측 PrincipalListTab 측 catch utility 측 catch 통일
  const ss = getPrincipalStatusBadge(task.status);
  const statusLabel = getPrincipalStatusLabel(task.status);

  // 완료 작업 사진 — 완료/visit_only 측만 fetch
  const [photos, setPhotos] = useState([]);
  useEffect(() => {
    if (!task?.id) return;
    if (task.status !== "완료" && task.status !== "visit_only") {
      setPhotos([]);
      return;
    }
    let alive = true;
    listPhotosByTask(task.id).then(res => {
      if (alive && res.ok) setPhotos(res.photos);
    });
    return () => { alive = false; };
  }, [task?.id, task?.status]);

  // 공유 작업 메모 (work_memo)
  const [memo, setMemo] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);
  const [memoSavedTick, setMemoSavedTick] = useState(0);
  useEffect(() => { setMemo(task?.workMemo || ""); }, [task?.workMemo]);
  const memoDirty = (memo || "") !== (task?.workMemo || "");

  async function saveMemo() {
    if (!task?.id || memoSaving) return;
    setMemoSaving(true);
    try {
      const prevMemo = task?.workMemo || "";
      const res = await updateTaskAdapter(task.id, { workMemo: memo });
      if (res && res.ok === false) throw new Error(res.error || "저장 실패");
      setTask(prev => ({ ...prev, workMemo: memo }));
      setMemoSavedTick(v => v + 1);
      // 2026-06-09 — 변경 이력 audit log (best-effort).
      //   change_type 'items' = task 내용 변경 (workMemo 도 task 본문 필드라 묶음).
      //   별도 'memo' enum 필요 시 Mig 099 + 본 호출 change_type 만 교체.
      try {
        const { insertTaskChange } = await import("../lib/taskChangesDb.js");
        await insertTaskChange({
          taskId:        task.id,
          changeType:    "items",
          before:        { workMemo: prevMemo },
          after:         { workMemo: memo },
          note:          "원청 공유 메모 변경",
          changedBy:     user?.id || user?.user_id || null,
          changedByName: user?.name || null,
          changedByRole: "원청",
        });
      } catch (logErr) {
        console.error("[PrincipalApp.saveMemo:audit] best-effort fail", logErr);
      }
    } catch (e) {
      alert("메모 저장 실패: " + (e.message || ""));
    } finally {
      setMemoSaving(false);
    }
  }

  // 2026-05-25 Round 2 — 원청 취소 액션 (전체 + 부분)
  const [showFullCancel, setShowFullCancel]       = useState(false);
  const [showPartialCancel, setShowPartialCancel] = useState(false);
  const [cancelBusy, setCancelBusy]               = useState(false);

  async function handleFullCancel(reason) {
    if (!task?.id || cancelBusy) return;
    setCancelBusy(true);
    try {
      const res = await partnerFullCancel(task.id, reason);
      if (!res?.ok) {
        alert("취소 실패: " + (res?.error || "알 수 없는 오류"));
        return;
      }
      setShowFullCancel(false);
      // Optimistic + refetch
      setTask(prev => ({ ...prev, status: "취소" }));
      const row = await getTaskByIdDb(task.id);
      if (row) {
        const normalized = v14NormalizeTask(row);
        if (normalized) setTask(normalized);
      }
    } finally {
      setCancelBusy(false);
    }
  }

  async function handlePartialCancel(itemIds, reason) {
    if (!task?.id || !Array.isArray(itemIds) || itemIds.length === 0) return;
    setCancelBusy(true);
    let ok = 0, fail = 0;
    try {
      for (const itemId of itemIds) {
        const res = await partnerPartialCancelItem(itemId, reason);
        if (res && res.ok) ok += 1; else fail += 1;
      }
      if (fail > 0) alert(`부분 취소 — 성공 ${ok} / 실패 ${fail}`);
      setShowPartialCancel(false);
      const row = await getTaskByIdDb(task.id);
      if (row) {
        const normalized = v14NormalizeTask(row);
        if (normalized) setTask(normalized);
      }
    } finally {
      setCancelBusy(false);
    }
  }

  // 2026-06-06 — 작업 기본 정보 편집 (5 필드) 모드 토글.
  const [editing, setEditing] = useState(false);
  async function refetchTask() {
    if (!task?.id) return;
    const row = await getTaskByIdDb(task.id);
    if (!row) return;
    const normalized = v14NormalizeTask(row);
    if (normalized) setTask(normalized);
  }

  // 상품주문별 정산 — task_items + remit 별도 fetch (mount 시)
  const [settleItems, setSettleItems] = useState([]);
  const [settleRemits, setSettleRemits] = useState([]);
  const [settleLoading, setSettleLoading] = useState(false);
  const [settleError, setSettleError] = useState("");

  useEffect(() => {
    if (!task?.id) return;
    let alive = true;
    setSettleLoading(true);
    setSettleError("");
    const principalCodes = task.principalCode ? [task.principalCode] : [];
    Promise.all([
      fetchTaskItemsForDetail(task.id),
      principalCodes.length > 0
        ? fetchPrincipalWeeklyRemittances({ principalCodes, monthsBack: 3 })
        : Promise.resolve({ ok: true, remits: [] }),
    ]).then(([itemsRes, remitRes]) => {
      if (!alive) return;
      if (!itemsRes.ok) setSettleError(itemsRes.error || "항목 조회 실패");
      setSettleItems(itemsRes.items || []);
      setSettleRemits(remitRes.remits || []);
    }).finally(() => { if (alive) setSettleLoading(false); });
    return () => { alive = false; };
  }, [task?.id, task?.principalCode]);

  // remitMap — `${principal_id}|${week_start}` → row
  const remitMap = (() => {
    const m = new Map();
    for (const r of settleRemits) m.set(`${r.principal_id}|${r.week_start}`, r);
    return m;
  })();
  
  // 일정 표시
  const scheduledDisplay = task.scheduledDate && task.scheduledTime
    ? `${task.scheduledDate} ${task.scheduledTime}`
    : task.requestedDate
      ? `희망: ${task.requestedDate} ${task.requestedTime || ""}`
      : null;

  // 2026-06-02 — early return은 모든 hooks 호출 이후이므로 React #310 위반 없음.
  //   loading + fetchError 분기 모두 hooks 끝난 뒤 안전한 위치에서 처리.
  if (loading) {
    return (
      <div className="fade-in" style={{ padding: "20px" }}>
        <button onClick={onBack} className="clickable" style={{
          background: "transparent", border: "none", color: t.textMuted,
          fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          padding: "6px 0", marginBottom: 16,
        }}>← 뒤로</button>
        <div style={{ marginTop: 60, textAlign: "center", color: t.textSecondary, fontSize: 12 }}>
          작업 정보 불러오는 중...
        </div>
      </div>
    );
  }
  // 2026-06-02 — fetch 실패 + 데이터 부족 시 안내 화면 (빈 화면 / 무한 스피너 방지).
  if (fetchError && !isInitialFull) {
    return (
      <div className="fade-in" style={{ padding: "20px" }}>
        <button onClick={onBack} className="clickable" style={{
          background: "transparent", border: "none", color: t.textMuted,
          fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          padding: "6px 0", marginBottom: 16,
        }}>← 뒤로</button>
        <div style={{ marginTop: 60, textAlign: "center", color: t.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 700, color: t.text, marginBottom: 6 }}>
            정보를 불러오지 못했어요
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 16 }}>
            {fetchError}
          </div>
          <button
            onClick={onBack}
            style={{
              background: t.bgElevated,
              border: `1px solid ${t.border}`,
              color: t.text,
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 2026-06-06 — 편집 모드 (5 필드 — update_task_basic RPC).
  if (editing) {
    return (
      <TaskBasicEditScreen
        t={t}
        task={task}
        actorUserId={user?.user_id || user?.userId || user?.id}
        accentColor={t.accent}
        onClose={() => setEditing(false)}
        onSaved={async () => { await refetchTask(); setEditing(false); }}
      />
    );
  }

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <button onClick={onBack} className="clickable" style={{
        background: "transparent", border: "none", color: t.textMuted,
        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        padding: "6px 0", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <ArrowLeft size={14}/><span>리스트로 돌아가기</span>
      </button>

      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 21, fontWeight: 800, color: t.text }}>
          {task.customer || "—"}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: ss.color, background: ss.bg,
          padding: "2px 7px", borderRadius: 8,
          whiteSpace: "nowrap",
        }}>
          {statusLabel}
        </span>
        {/* 2026-06-06 — 수정 버튼 (5 필드: 연락처/주소/고객명/희망일정/요청사항) */}
        <button onClick={() => setEditing(true)} style={{
          marginLeft: "auto",
          padding: "5px 12px",
          background: "transparent",
          border: `1px solid ${t.accent}`,
          borderRadius: 8,
          color: t.accent,
          fontSize: 11, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}>수정</button>
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.textMuted, marginBottom: 12 }}>
          작업 정보
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <LabelRow t={t} label="연락처" value={task.phone || "—"} mono/>
          <LabelRow t={t} label="주소"   value={task.address || "—"} wrap/>
          <LabelRow t={t} label="수량"   value={`${task.qty || 1}대`}/>
          {scheduledDisplay && <LabelRow t={t} label="일정" value={scheduledDisplay} highlight/>}
          {task.assignedEngineer && <LabelRow t={t} label="배정 프로" value={`${task.assignedEngineer} 프로님`}/>}
        </div>
      </div>

      {/* 📊 정산 — 작업 전체 합계 + 상품주문별 진행바 */}
      <SettleDetailBox
        t={t}
        task={task}
        principalLabel={principalLabel}
        items={settleItems}
        remitMap={remitMap}
        principalId={task.principalId}
        loading={settleLoading}
        error={settleError}
      />

      {photos.length > 0 && (
        <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.textMuted, marginBottom: 12 }}>
            완료 사진 ({photos.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {photos.map(p => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
                <img src={p.url} alt={p.step || ""} style={{
                  width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8,
                  background: t.bgInset, display: "block",
                }}/>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 작업 메모 — work_memo 공유 (운영자·원청·기사 모두 보고 수정) */}
      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.textMuted }}>작업 메모</span>
          {memoSavedTick > 0 && !memoDirty && !memoSaving && (
            <span style={{ fontSize: 11, color: "#5DCAA5", fontWeight: 700 }}>✓ 저장됨</span>
          )}
        </div>
        <textarea
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="메모 입력 — 운영자·원청·기사 공유"
          rows={3}
          style={{
            width: "100%", padding: "10px 12px",
            background: t.bgInset,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            color: t.text,
            fontSize: 14, fontWeight: 500,
            fontFamily: "inherit", outline: "none",
            resize: "vertical",
            lineHeight: 1.5,
            boxSizing: "border-box",
          }}
        />
        {memoDirty && (
          <button onClick={saveMemo} disabled={memoSaving} style={{
            marginTop: 8, padding: "8px 14px",
            background: "#FF4D9E", color: "#fff",
            border: "none", borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            fontFamily: "inherit",
            cursor: memoSaving ? "not-allowed" : "pointer",
            opacity: memoSaving ? 0.5 : 1,
          }}>{memoSaving ? "저장 중..." : "메모 저장"}</button>
        )}
      </div>

      {/* 2026-06-07 — 취소 정보 (status='취소' 일 때만, 읽기 전용 — 입력은 운영자만) */}
      {task.status === "취소" && (() => {
        const cat = task.categoryData || {};
        const reason       = task.cancelReason             || cat.cancelReason             || null;
        const actor        = task.cancelActor              || cat.cancelActor              || null;
        const actorUid     = task.cancelActorUserId        || cat.cancelActorUserId        || null;
        const principalCode = task.cancelActorPrincipalCode || cat.cancelActorPrincipalCode || null;
        const at           = task.cancelAt                 || cat.cancelAt                 || task.updatedAt || null;

        const u = actorUid ? getUserById(actorUid) : null;
        const name = u?.name || null;
        let actorLabel = (actor || name) ? getCancelActorLabel({ actor, name, principalCode }) : null;

        // actor 없으면 배정 기사 fallback (UsolNAssignList 동일 패턴).
        if (!actorLabel) {
          const engUid  = task.assignedEngineerId || task.assigned_engineer_id || null;
          const engUser = engUid ? getUserById(engUid) : null;
          const engName = engUser?.name || task.assignedEngineer || task.assigned_engineer || null;
          if (engName) actorLabel = `기사 ${engName}`;
        }

        const reasonLabel = reason ? (getCancelReasonLabel(reason) || reason) : null;
        const atLabel = at ? formatDateTimeKST(at) : null;

        return (
          <div style={{
            background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12,
            border: "1px solid rgba(220,38,38,0.25)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#FF3D5A", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
              ⛔ 취소 정보
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, flexShrink: 0 }}>취소자</span>
                <span style={{ fontSize: 13, color: t.textPrimary, fontWeight: 700, textAlign: "right" }}>
                  {actorLabel || "—"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, flexShrink: 0 }}>사유</span>
                <span style={{ fontSize: 13, color: t.textSecondary, textAlign: "right", lineHeight: 1.5, flex: 1 }}>
                  {reasonLabel || "—"}
                </span>
              </div>
              {atLabel && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, flexShrink: 0 }}>취소 시각</span>
                  <span className="mono" style={{ fontSize: 12, color: t.textSecondary }}>{atLabel}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 2026-05-25 Round 2 — 원청 취소 액션 박스 (status='취소' 인 task 는 미표시) */}
      {task.status !== "취소" && (
        <div style={{
          background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12,
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 2 }}>
            취소 처리
          </div>
          <button
            onClick={() => setShowPartialCancel(true)}
            style={{
              width: "100%", padding: "12px",
              background: "rgba(156, 163, 175, 0.10)",
              border: "1px solid rgba(156, 163, 175, 0.30)",
              color: "#9CA3AF", fontSize: 13, fontWeight: 600,
              borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
            }}
          >◐ 품목별 취소</button>
          <button
            onClick={() => setShowFullCancel(true)}
            style={{
              width: "100%", padding: "12px",
              background: "rgba(239, 68, 68, 0.10)",
              border: "1px solid rgba(239, 68, 68, 0.30)",
              color: "#FF3D5A", fontSize: 13, fontWeight: 600,
              borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
            }}
          >⛔ 작업 전체 취소</button>
        </div>
      )}

      {showFullCancel && (
        <FullCancelDialog
          task={task}
          onClose={() => setShowFullCancel(false)}
          onConfirm={handleFullCancel}
        />
      )}

      {showPartialCancel && (
        <PartialCancelDialog
          task={task}
          onClose={() => setShowPartialCancel(false)}
          onConfirm={handlePartialCancel}
        />
      )}

      {task.happycallMemo && (
        <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
            📝 관리자 메모
          </div>
          <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
            {task.happycallMemo}
          </div>
        </div>
      )}
    </div>
  );
}

// 📊 상품주문별 정산 박스 (TaskDetail "💰 금액 정보" 직후)
//   단계 판정 (1차 진단대로):
//     ① 정산대기     — naver_settled_at NULL
//     ② 네이버정산완료 — naver_settled_at 있음 + (③ 조건 X)
//     ③ 회사입금완료   — naver_settled_at 있음 + 측 주차 remit row confirmed_at 있음
//   금액 (net_amount = 운영팀이 입력한 네이버 정산금액):
//     유솔 수수료      = ROUND(net_amount × 0.15)
//     올데이케어 수수료 = net_amount − 유솔 수수료
//   net_amount NULL → 금액 3종 "—", 단계는 ① 정산대기.
function getItemStageKey(item, remitMap, principalId) {
  if (!item.naver_settled_at) return "wait";
  const wk = getNaverSettleWeek(item);
  if (!wk || !principalId) return "naver";
  const monday = wk.monday;
  const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  const remit = remitMap.get(`${principalId}|${weekStart}`);
  if (remit?.confirmed_at) return "company";
  return "naver";
}

const SETTLE_DETAIL_STAGES = [
  { key: "wait",    label: "정산대기",       color: "#9CA3AF" },
  { key: "naver",   label: "네이버정산완료", color: "#FACC15" },
  { key: "company", label: "회사입금완료",   color: "#5DCAA5" },
];

function StageProgress({ stage }) {
  const currentIdx = SETTLE_DETAIL_STAGES.findIndex(s => s.key === stage);
  const N = SETTLE_DETAIL_STAGES.length;
  // 측 단계 측 catch flex:1 → dot center 측 catch 측 측 측 (100/(2N))% offset.
  const sideOffset = `${100 / (2 * N)}%`;
  const lineSpan   = 100 - (100 / N); // 첫 dot 측 마지막 dot 사이 측 측 폭
  const safeIdx    = currentIdx < 0 ? 0 : currentIdx;
  const progressPct = N <= 1 ? 0 : (safeIdx / (N - 1)) * lineSpan;
  const currentColor = currentIdx >= 0 ? SETTLE_DETAIL_STAGES[currentIdx].color : "#9CA3AF";

  return (
    <div style={{ position: "relative", marginTop: 8, marginBottom: 10 }}>
      {/* 배경 라인 */}
      <div style={{
        position: "absolute", top: 6,
        left: sideOffset, right: sideOffset,
        height: 2, background: "#3A3A3A",
        zIndex: 0,
      }}/>
      {/* 진행 라인 */}
      <div style={{
        position: "absolute", top: 6,
        left: sideOffset,
        width: `${progressPct}%`, height: 2,
        background: currentColor,
        zIndex: 1,
        transition: "width 0.3s",
      }}/>

      {/* 단계 dot + 라벨 */}
      <div style={{ position: "relative", display: "flex", gap: 4, zIndex: 2 }}>
        {SETTLE_DETAIL_STAGES.map((s, idx) => {
          const isPast    = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const filled    = isPast || isCurrent;
          const dotSize   = isCurrent ? 12 : 8;
          return (
            <div key={s.key} style={{
              flex: 1,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              {/* dot wrapper — 측 dot 측 center y 정렬 (라인 위치 6 + 1 = 7) */}
              <div style={{
                width: 14, height: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{
                  width: dotSize, height: dotSize, borderRadius: "50%",
                  background: filled ? s.color : "#1F1F1F",
                  border: `2px solid ${filled ? s.color : "#3A3A3A"}`,
                  boxSizing: "border-box",
                  transition: "all 0.2s",
                }}/>
              </div>
              <div style={{
                fontSize: 9, fontWeight: isCurrent ? 700 : 500,
                color: filled ? s.color : "#666",
                whiteSpace: "nowrap",
              }}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 2026-06-09 — 출장비 task 정산 박스 (모든 원청 공용).
//   spec: 수수료 배분 블록 (sumUsol 15% / sumAllday 85%) 표시 X. 기사 100% / 30,000 만.
//   원인: 옛 유솔 본문은 sumSettle × 0.15 무조건 적용 → visit 30k → 4,500/25,500 모순 노출.
function SettleDetailBoxVisit({ t }) {
  return (
    <div style={settleBoxStyle(t)}>
      <SettleBoxHeader t={t}/>
      <div style={{
        padding: "18px 4px 6px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      }}>
        <span style={{
          fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: 0.5,
        }}>
          {VISIT_ICON_EMOJI} 출장비 · 기사 100%
        </span>
        <span className="mono" style={{
          fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: "-0.5px",
        }}>
          ₩30,000
        </span>
        <span style={{
          fontSize: 10, color: t.textMuted, fontWeight: 600,
        }}>
          (출장비만 — 작업 미실시)
        </span>
      </div>
    </div>
  );
}

// 2026-06-09 — usol_h 측 refrigerant only task 정산 박스 (PrincipalApp 한정).
//   spec: 정산금액 / 수수료배분 / 네이버 진행바 / 정산예정금액 전부 숨김. "완료" 안내만.
//   AdminApp 운영자 화면 — 본 분기 적용 X (사장님 spec — 운영자는 정산 표시 유지).
function SettleDetailBoxUsolHRefrigerant({ t }) {
  return (
    <div style={settleBoxStyle(t)}>
      <SettleBoxHeader t={t}/>
      <div style={{
        padding: "16px 4px 4px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      }}>
        <span style={{
          fontSize: 14, fontWeight: 800, color: t.success || "#1D9E75",
        }}>
          ✓ 완료
        </span>
        <span style={{
          fontSize: 10, color: t.textMuted, fontWeight: 600,
        }}>
          (냉매 작업 — 별도 정산)
        </span>
      </div>
    </div>
  );
}

function SettleDetailBox({ t, task, principalLabel, items, remitMap, principalId, loading, error }) {
  // 2026-06-09 — 분기 순서 (사장님 spec 갱신):
  //   (1) 출장비 task → SettleDetailBoxVisit (모든 원청 공용 — 기사 100% / 30,000)
  //   (2) usol_h refrigerant task → SettleDetailBoxUsolHRefrigerant ("완료" 만, 냉매 정산 제외)
  //   (3) !isUsolFlow(task) → SettleDetailBoxSimple (allday / KA / crikrin / usol_h 세척 — 견적금액 + 원청 수수료)
  //   (4) usol_n (=isUsolFlow) → 유솔 본문 (네이버 월정산 + 15%/85% 분해 — usol_n 전용)
  //   task 미전달 시 (Step 3 전 호출처) 안전망 — usol_n 본문 fallback (회귀 0).

  // (1) 출장비 task — 모든 원청 공용. 수수료 배분 숨김, "기사 100% / 30,000" 만.
  if (task && isAllItemsVisit(task)) {
    return <SettleDetailBoxVisit t={t}/>;
  }
  // (2) usol_h 측 refrigerant only task — 정산 정보 전부 숨김, "완료" 안내만.
  //   유솔H 정책: 냉매 정산 제외. AdminApp 운영자 화면은 본 분기 적용 X (사장님 spec — 운영자는 정산 표시 유지).
  if (task && task.principalCode === "usol_h" && isAllItemsRefrigerant(task)) {
    return <SettleDetailBoxUsolHRefrigerant t={t}/>;
  }
  // (3) 단순 흐름 — allday / KA / crikrin / usol_h 세척 등. 견적금액 + 원청 수수료 + 3단계 진행바.
  //   2026-06-09 — usol_h 측 isUsolFlow 측 false 측 → 본 분기 자동 진입 (옛 유솔 본문 미진입).
  if (task && !isUsolFlow(task)) {
    return <SettleDetailBoxSimple t={t} task={task} principalLabel={principalLabel} items={items} loading={loading} error={error}/>;
  }
  // (4) 유솔 본문 — usol_n 전용 (네이버 월정산 + 정산예정금액 + 15%/85% 분해).

  if (loading) {
    return (
      <div style={settleBoxStyle(t)}>
        <SettleBoxHeader t={t}/>
        <div style={{ padding: "20px 0", textAlign: "center", color: t.textMuted, fontSize: 12 }}>불러오는 중...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={settleBoxStyle(t)}>
        <SettleBoxHeader t={t}/>
        <div style={{ padding: "20px 0", textAlign: "center", color: "#EF4444", fontSize: 11 }}>⚠️ {error}</div>
      </div>
    );
  }
  if (!items || items.length === 0) return null;

  // 2026-06-02 — 헤더 메인 = 정산금액 (= SUM(subtotal) = 정산예정 합계). 사장님 spec.
  //   기존 SUM(net_amount, NULL 제외) 측 catch — net NULL task_item 측 측 0 측 catch
  //     (예: 진기선 YS-260520-014 → 0, 송은정 YS-260518-029 → 261,213 측 측 정산 측 측 측).
  //   새 spec: subtotal 측 measure (net NULL 측 측 측 계산) → 진기선 103,787 / 송은정 261,214.
  //   수수료 분해도 sumSettle 기준.
  //   "정산예정 합계" 별도 라인 제거 (= 헤더 메인 = 정산금액 = sumSettle 측 측 measure 측).
  //   task_item 슬라이더(getItemStageKey: naver_settled_at NULL → "정산대기") 측 그대로 — 측 측 spec 측.
  let sumCustomerPaid = 0;
  let sumSettle = 0;
  for (const it of items) {
    sumCustomerPaid += Number(it.customer_paid_amount) || 0;
    sumSettle       += Number(it.subtotal) || 0;
  }
  const sumUsol   = Math.round(sumSettle * 0.15);
  const sumAllday = sumSettle - sumUsol;

  return (
    <div style={settleBoxStyle(t)}>
      <SettleBoxHeader t={t}/>

      {/* (a) 작업 전체 금액 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SumLine label="고객 결제 합계" value={sumCustomerPaid} t={t} size="sm"/>
        <Divider t={t}/>
        <SumLine label="정산금액" value={sumSettle} t={t} size="lg"/>
        <SumLine label="└ 유솔 수수료 (15%)"      value={sumUsol}   color="#FF4D9E" indent t={t}/>
        <SumLine label="└ 올데이케어 수수료 (85%)" value={sumAllday} color="#5DCAA5" indent t={t}/>
      </div>

      {/* (b) 구분선 */}
      <div style={{ height: 1, background: t.border, margin: "16px 0" }}/>

      {/* (c) 상품주문별 진행 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map(item => (
          <ItemProgress
            key={item.id}
            t={t}
            item={item}
            stage={getItemStageKey(item, remitMap, principalId)}
          />
        ))}
      </div>
    </div>
  );
}

function settleBoxStyle(t) {
  return {
    background: t.bgElevated,
    borderRadius: 14,
    padding: "16px",
    marginBottom: 12,
  };
}

function SettleBoxHeader({ t }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 12 }}>
      정산
    </div>
  );
}

function SumLine({ label, value, color, size, indent, t }) {
  // size: "sm" | "md" | "lg"
  const isLg = size === "lg";
  const isSm = size === "sm";
  const valueSize  = isLg ? 17 : (isSm ? 13 : 13);
  const labelColor = color || (isLg ? t.text : t.textMuted);
  const valueColor = color || (isLg ? t.text : (isSm ? t.text : t.text));
  const valueWeight = isLg ? 800 : 700;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      paddingLeft: indent ? 12 : 0,
    }}>
      <span style={{ fontSize: 12, color: labelColor, fontWeight: indent ? 700 : 600 }}>{label}</span>
      <span className="mono" style={{ fontSize: valueSize, fontWeight: valueWeight, color: valueColor }}>
        ₩{(value || 0).toLocaleString()}
      </span>
    </div>
  );
}

function Divider({ t }) {
  return <div style={{ height: 1, background: t.border, marginTop: 2, marginBottom: 2 }}/>;
}

function ItemProgress({ t, item, stage }) {
  // 2026-05-25 Round 1 (c) — 취소 품목 분기 (Migration 070).
  //   is_canceled=true → ✗ 취소 배지 + ₩0 정적 표시. 사유 라벨 없으면 줄 생략.
  if (item?.is_canceled === true) {
    const workType  = item.work_types?.name || "";
    const appliance = item.appliance_types?.name || "";
    const qty       = item.qty || 1;
    const labelParts = [];
    if (workType) labelParts.push(workType);
    if (appliance && !(workType && workType.includes(appliance))) labelParts.push(appliance);
    labelParts.push(`${qty}대`);
    const itemLabel = labelParts.length > 1 ? labelParts.join(" · ") : (item.description || "—");
    const reasonLabel = getPartialReasonLabel(item.canceled_reason);
    return (
      <div style={{ opacity: 0.55 }}>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: t.textMuted || "#9CA3AF",
          marginBottom: 6,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          <span style={{ textDecoration: "line-through" }}>{itemLabel}</span>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: "#9CA3AF",
            background: "rgba(156, 163, 175, 0.18)",
            padding: "2px 7px",
            borderRadius: 6,
          }}>✗ 취소</span>
        </div>
        <div style={{
          padding: "10px 12px",
          background: t.bgInset || "#161619",
          border: `1px solid ${t.border || "#2A2A2A"}`,
          borderRadius: 8,
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8,
          fontSize: 12, fontWeight: 600,
          color: t.textMuted || "#9CA3AF",
        }}>
          {reasonLabel && (
            <>
              <span>사유: {reasonLabel}</span>
              <span style={{ color: t.textMuted }}>·</span>
            </>
          )}
          <span>
            <span className="mono" style={{ fontWeight: 800 }}>₩0</span>
          </span>
        </div>
      </div>
    );
  }

  // 2026-05-25 — 출장비(work_types.code='visit') 항목 분기.
  //   네이버 정산 흐름(정산대기→네이버정산완료→회사입금완료)이 무관 — 현장 현금 수령 완료 상태로 정적 표시.
  if (item?.work_types?.code === "visit") {
    const visitAmount = Number(item.subtotal) || Number(item.unit_price) * Number(item.qty || 1) || 0;
    const visitLabel  = item.work_types?.name || "출장비";
    return (
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 6 }}>
          {visitLabel}
        </div>
        <div style={{
          padding: "10px 12px",
          background: t.bgInset || "#161619",
          border: `1px solid ${t.border || "#2A2A2A"}`,
          borderRadius: 8,
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8,
          fontSize: 12, fontWeight: 600, color: t.text,
        }}>
          <span style={{ color: "#5DCAA5", fontWeight: 800 }}>✓</span>
          <span>현장 현금정산 완료</span>
          <span style={{ color: t.textMuted }}>·</span>
          <span>
            기사{" "}
            <span className="mono" style={{ fontWeight: 800 }}>
              ₩{visitAmount.toLocaleString()}
            </span>
          </span>
        </div>
      </div>
    );
  }

  const orderId   = item.product_order_id || "";
  const workType  = item.work_types?.name || "";
  const appliance = item.appliance_types?.name || "";
  const qty       = item.qty || 1;
  // workType이 appliance 문자열을 이미 포함하면 appliance 생략 (예: "세척_벽걸이" + "벽걸이")
  const labelParts = [];
  if (workType) labelParts.push(workType);
  if (appliance && !(workType && workType.includes(appliance))) labelParts.push(appliance);
  labelParts.push(`${qty}대`);
  const itemLabel = labelParts.length > 1 ? labelParts.join(" · ") : (item.description || "—");

  return (
    <div>
      {/* 상품 이름 — workType · appliance · qty */}
      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>
        {itemLabel}
      </div>
      {/* 상품주문번호 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, flexShrink: 0 }}>
          상품주문번호
        </span>
        <span className="mono" style={{
          fontSize: 12, fontWeight: 600, color: t.textSecondary || t.text,
          wordBreak: "break-all", letterSpacing: 0.2,
        }}>
          {orderId || "—"}
        </span>
      </div>
      {/* 주문별 정산금액 — 정산예정 / 올데이케어 정산금액 / 네이버 정산(상태바) */}
      <ItemAmounts t={t} item={item}/>
      {/* 진행바 */}
      <StageProgress stage={stage}/>
    </div>
  );
}

function ItemAmounts({ t, item }) {
  // 2026-05-24 — 사장님 spec:
  //   정산예정금액     = subtotal             (네이버 수수료 차감 후)
  //   올데이케어 정산금액 = net_amount - round(net_amount * 0.15)  (85% 몫)
  //   네이버 정산(상태바) = net_amount         (정산 완료 시) / "정산 전" (미정산)
  const settleAmt    = Number(item.subtotal) || 0;
  const net          = item.net_amount;
  const settled      = item.naver_settled_at != null && net != null;
  const usolFee      = settled ? Math.round(net * 0.15) : 0;
  const alldayAmount = settled ? (net - usolFee) : 0;

  const rowStyle = {
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
  };

  return (
    <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>정산예정금액</span>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
          ₩{settleAmt.toLocaleString()}
        </span>
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>올데이케어 정산금액</span>
        {settled ? (
          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
            ₩{alldayAmount.toLocaleString()}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: t.textMuted, fontStyle: "italic", fontWeight: 600 }}>
            정산 전
          </span>
        )}
      </div>
      {settled ? (
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>네이버 정산금액</span>
          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
            ₩{net.toLocaleString()}
          </span>
        </div>
      ) : (
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>네이버 정산</span>
          <span style={{ fontSize: 11, color: t.textMuted, fontStyle: "italic", fontWeight: 600 }}>
            정산 전
          </span>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 2026-06-04 Phase 2-A — 단순 흐름 정산 박스 (KA / crikrin 등 비-유솔 원청).
//
//   표시:
//     · 정산 금액 = task.totalAmount (= product + extra + travel, DB GENERATED).
//                   fallback: items 측 subtotal 합 (취소 제외).
//     · 원청 수수료 (N%) = task.principal_amount (DB compute_payment 결과 직접 사용).
//                          N% = principal_amount / totalAmount × 100 동적 계산 (하드코딩 금지).
//     · 진행바 (3단계: 배정 → 확정 → 완료) — accentColor 사용 (KA 청록 / crikrin 보라).
//
//   숨김 (유솔 본문 대비):
//     · 고객 결제 합계 / 기사몫 / 회사몫 / 올데이케어 / 네이버 정산 / 트랙B 3단계 진행바
//     · product_order_id (네이버 발주번호)
//
//   호출처: SettleDetailBox 측 isUsolFlow(task)=false 분기.
// ════════════════════════════════════════════════════════════

// 단순 흐름 진행바 — task.status / scheduledAt 기반 3단계 판정.
//   null 반환 → 호출처 측 진행바 숨김 (취소 / 취소요청).
//   '미배정' → 모두 비활성 (currentIdx=-1). 진행바 표시되지만 dot/라인 회색.
const SIMPLE_STAGE_DEFS = [
  { key: 'assigned',  label: '배정' },
  { key: 'scheduled', label: '확정' },
  { key: 'done',      label: '완료' },
];

function getSimpleStageKey(task) {
  const status = task?.status || '';
  if (status === '취소' || status === '취소요청') return null;        // 진행바 숨김
  if (status === '완료' || status === 'visit_only') return 'done';
  if (status === '확정' || status === '진행중')   return 'scheduled';
  if (task?.scheduledAt)                          return 'scheduled'; // 일정 있으면 확정 단계
  if (status === '미배정')                        return 'none';      // 진행바 표시 + 모두 비활성
  return 'assigned';  // 배정 / 약속대기 / 그 외
}

function SimpleStageProgress({ task, accentColor, t }) {
  const stageKey = getSimpleStageKey(task);
  if (stageKey === null) return null;  // 취소 계열 — 호출처 숨김

  const stages = SIMPLE_STAGE_DEFS;
  // stageKey='none' (미배정) → currentIdx=-1 → 모두 비활성.
  const currentIdx = stageKey === 'none'
    ? -1
    : stages.findIndex(s => s.key === stageKey);
  const N = stages.length;
  const sideOffset = `${100 / (2 * N)}%`;
  const lineSpan   = 100 - (100 / N);
  const safeIdx    = currentIdx < 0 ? 0 : currentIdx;
  const progressPct = currentIdx < 0 ? 0 : (safeIdx / (N - 1)) * lineSpan;
  const currentColor = currentIdx >= 0 ? accentColor : '#9CA3AF';

  // 2026-06-04 — 라이트/다크 분기. t.isLight 기준.
  //   다크 측 옛 색상 그대로 유지 (회귀 0): 배경라인 #3A3A3A / dot 비활성 #1F1F1F / 라벨 #666.
  //   라이트 측 옅은 회색 매칭.
  const isLight        = !!(t && t.isLight);
  const trackBg        = isLight ? "#E5E5E5" : "#3A3A3A";
  const dotEmptyBg     = isLight ? "#FFFFFF" : "#1F1F1F";
  const dotEmptyBorder = isLight ? "#D4D4D4" : "#3A3A3A";
  const labelEmptyClr  = isLight ? "#A3A3A3" : "#666";

  return (
    <div style={{ position: "relative", marginTop: 8, marginBottom: 10 }}>
      {/* 배경 라인 */}
      <div style={{
        position: "absolute", top: 6,
        left: sideOffset, right: sideOffset,
        height: 2, background: trackBg,
        zIndex: 0,
      }}/>
      {/* 진행 라인 */}
      <div style={{
        position: "absolute", top: 6,
        left: sideOffset,
        width: `${progressPct}%`, height: 2,
        background: currentColor,
        zIndex: 1,
        transition: "width 0.3s",
      }}/>
      {/* 단계 dot + 라벨 */}
      <div style={{ position: "relative", display: "flex", gap: 4, zIndex: 2 }}>
        {stages.map((s, idx) => {
          const isPast    = currentIdx >= 0 && idx < currentIdx;
          const isCurrent = currentIdx >= 0 && idx === currentIdx;
          const filled    = isPast || isCurrent;
          const dotSize   = isCurrent ? 12 : 8;
          return (
            <div key={s.key} style={{
              flex: 1,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              <div style={{
                width: 14, height: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{
                  width: dotSize, height: dotSize, borderRadius: "50%",
                  background: filled ? accentColor : dotEmptyBg,
                  border: `2px solid ${filled ? accentColor : dotEmptyBorder}`,
                  boxSizing: "border-box",
                  transition: "all 0.2s",
                }}/>
              </div>
              <div style={{
                fontSize: 9, fontWeight: isCurrent ? 700 : 500,
                color: filled ? accentColor : labelEmptyClr,
                whiteSpace: "nowrap",
              }}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettleDetailBoxSimple({ t, task, principalLabel, items, loading, error }) {
  if (loading) {
    return (
      <div style={settleBoxStyle(t)}>
        <SettleBoxHeader t={t}/>
        <div style={{ padding: "20px 0", textAlign: "center", color: t.textMuted, fontSize: 12 }}>불러오는 중...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={settleBoxStyle(t)}>
        <SettleBoxHeader t={t}/>
        <div style={{ padding: "20px 0", textAlign: "center", color: "#EF4444", fontSize: 11 }}>⚠️ {error}</div>
      </div>
    );
  }
  if (!items || items.length === 0) return null;

  // 2026-06-08 — KA / crikrin 한정: 외부 노출용으로 견적금액(product_price) 단일 표시.
  //   사장님 spec — extra_fee / travel_fee 합산 노출 금지. % 분모도 견적금액 기준 (35% / 20% 정합).
  //   그 외 비-유솔 원청 (allday / KB / yongin 등) 은 옛 totalAmount (product+extra+travel) 그대로 — 회귀 0.
  const code = task?.principalCode || "";
  const isStrictPartner = code === "KA" || code === "crikrin";

  const displayAmount = isStrictPartner
    ? Number(task?.productPrice ?? task?.product_price ?? 0)
    : (Number(task?.totalAmount) > 0
        ? Number(task.totalAmount)
        : items.reduce((s, it) => s + (it.is_canceled ? 0 : (Number(it.subtotal) || 0)), 0));

  // 원청 수수료 = DB principal_amount (compute_payment 계산 결과 직접).
  //   미계산 task (payments 없음, 또는 status='미배정' 측 trigger 호출 결과 0) 측 0 표시.
  const principalAmount = Number(task?.principal_amount) || 0;

  // N% = principal_amount / displayAmount × 100 — 동적 계산. 하드코딩 % 사용 금지.
  //   displayAmount 0 또는 principal_amount 0 측 라벨 측 % 생략 (= "{원청명} 수수료" 만).
  const feePct = displayAmount > 0 && principalAmount > 0
    ? Math.round((principalAmount / displayAmount) * 100)
    : 0;

  // 2026-06-04 — 라벨 측 원청 표시명 — 헤더 인사말과 동일 값(principalLabel prop).
  //   TaskDetail 측 cleanGreetingName(user.name || getPrincipalLabel(user)) 결과 전달.
  //   prop 누락 시 fallback "원청".
  const labelName = principalLabel || "원청";
  const feeLabel = feePct > 0
    ? `${labelName} 수수료 (${feePct}%)`
    : `${labelName} 수수료`;

  // 2026-06-04 — 상세 정산 박스 색상 통일 (#FF4D9E 핑크 고정).
  //   PARTNER_PWA_CONFIG.accentColor 는 폼/업로드 탭 측 그대로 유지, 상세 박스만 핑크.
  const FEE_COLOR = "#FF4D9E";

  return (
    <div style={settleBoxStyle(t)}>
      <SettleBoxHeader t={t}/>

      {/* 정산 합계 — 견적금액 + 원청 수수료 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SumLine label="견적금액" value={displayAmount} t={t} size="lg"/>
        <SumLine label={feeLabel} value={principalAmount} color={FEE_COLOR} indent t={t}/>
      </div>

      {/* 진행바 — 3단계 (배정 → 확정 → 완료). 취소 계열 task 측 null 반환 → 자동 숨김. */}
      <SimpleStageProgress task={task} accentColor={FEE_COLOR} t={t}/>

      <div style={{ height: 1, background: t.border, margin: "16px 0" }}/>

      {/* 상품주문별 — 라벨 + 단가만 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map(item => (
          <ItemProgressSimple key={item.id} t={t} item={item}/>
        ))}
      </div>
    </div>
  );
}

// 2026-06-04 Phase 2-A — 단순 흐름 상품주문 카드 (KA / crikrin 등).
//   숨김: product_order_id / ItemAmounts 3종 / StageProgress 3단계.
//   취소 row + 방문비 row 분기는 ItemProgress 측 동일 디자인 재사용.
//   일반 row = 라벨 (workType · appliance · qty대) + 단가 행 (₩단가 × N대 = ₩소계).
function ItemProgressSimple({ t, item }) {
  // 취소 분기 — ItemProgress 측 동일 (Migration 070).
  if (item?.is_canceled === true) {
    const workType  = item.work_types?.name || "";
    const appliance = item.appliance_types?.name || "";
    const qty       = item.qty || 1;
    const labelParts = [];
    if (workType) labelParts.push(workType);
    if (appliance && !(workType && workType.includes(appliance))) labelParts.push(appliance);
    labelParts.push(`${qty}대`);
    const itemLabel = labelParts.length > 1 ? labelParts.join(" · ") : (item.description || "—");
    const reasonLabel = getPartialReasonLabel(item.canceled_reason);
    return (
      <div style={{ opacity: 0.55 }}>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: t.textMuted || "#9CA3AF",
          marginBottom: 6,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          <span style={{ textDecoration: "line-through" }}>{itemLabel}</span>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: "#9CA3AF",
            background: "rgba(156, 163, 175, 0.18)",
            padding: "2px 7px",
            borderRadius: 6,
          }}>✗ 취소</span>
        </div>
        <div style={{
          padding: "10px 12px",
          background: t.bgInset || "#161619",
          border: `1px solid ${t.border || "#2A2A2A"}`,
          borderRadius: 8,
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8,
          fontSize: 12, fontWeight: 600,
          color: t.textMuted || "#9CA3AF",
        }}>
          {reasonLabel && (
            <>
              <span>사유: {reasonLabel}</span>
              <span style={{ color: t.textMuted }}>·</span>
            </>
          )}
          <span>
            <span className="mono" style={{ fontWeight: 800 }}>₩0</span>
          </span>
        </div>
      </div>
    );
  }

  // 방문비 분기 — ItemProgress 측 동일 (work_types.code='visit').
  if (item?.work_types?.code === "visit") {
    const visitAmount = Number(item.subtotal) || Number(item.unit_price) * Number(item.qty || 1) || 0;
    const visitLabel  = item.work_types?.name || "출장비";
    return (
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 6 }}>
          {visitLabel}
        </div>
        <div style={{
          padding: "10px 12px",
          background: t.bgInset || "#161619",
          border: `1px solid ${t.border || "#2A2A2A"}`,
          borderRadius: 8,
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8,
          fontSize: 12, fontWeight: 600, color: t.text,
        }}>
          <span style={{ color: "#5DCAA5", fontWeight: 800 }}>✓</span>
          <span>현장 현금정산 완료</span>
          <span style={{ color: t.textMuted }}>·</span>
          <span>
            기사{" "}
            <span className="mono" style={{ fontWeight: 800 }}>
              ₩{visitAmount.toLocaleString()}
            </span>
          </span>
        </div>
      </div>
    );
  }

  // 일반 row — 라벨 + 단가만 (네이버/진행바/상품주문번호 모두 숨김).
  const workType  = item.work_types?.name || "";
  const appliance = item.appliance_types?.name || "";
  const qty       = item.qty || 1;
  const labelParts = [];
  if (workType) labelParts.push(workType);
  if (appliance && !(workType && workType.includes(appliance))) labelParts.push(appliance);
  labelParts.push(`${qty}대`);
  const itemLabel = labelParts.length > 1 ? labelParts.join(" · ") : (item.description || "—");

  const unitPrice = Number(item.unit_price) || 0;
  const subtotal  = Number(item.subtotal) || (unitPrice * qty);

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 6 }}>
        {itemLabel}
      </div>
      <div style={{
        padding: "10px 12px",
        background: t.bgInset || "#161619",
        border: `1px solid ${t.border || "#2A2A2A"}`,
        borderRadius: 8,
        display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8,
        fontSize: 12, fontWeight: 600, color: t.text,
      }}>
        <span style={{ color: t.textMuted }}>
          ₩{unitPrice.toLocaleString()} × {qty}대
        </span>
        <span className="mono" style={{ fontWeight: 800, color: t.text }}>
          ₩{subtotal.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// 작업 정보 박스의 라벨 row — 아이콘 X, 라벨(고정폭 78px, 회색 12px) + 값(13~14px)
//   highlight=true → 일정 등 강조 row (노란색 14px 800)
function LabelRow({ t, label, value, mono, wrap, color, highlight }) {
  // 2026-06-11 — 상세 패널 폰트 +2 (사장님 spec "본문 표준 17 정합, 위계 유지").
  //   label 12 → 14 / value 13 → 15 (highlight 14 → 16). 라벨 폭 78 → 84 (가독성).
  const valueColor  = color || (highlight ? "#FACC15" : t.text);
  const valueSize   = highlight ? 16 : 15;
  const valueWeight = highlight ? 800 : 600;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{
        flexShrink: 0, width: 84,
        fontSize: 14, color: t.textMuted, fontWeight: 500,
        lineHeight: 1.5,
      }}>{label}</span>
      <span className={mono ? "mono" : ""} style={{
        flex: 1, minWidth: 0,
        fontSize: valueSize, fontWeight: valueWeight, color: valueColor,
        lineHeight: 1.5,
        wordBreak: wrap ? "break-word" : "normal",
        whiteSpace: wrap ? "normal" : "nowrap",
        overflow: wrap ? "visible" : "hidden",
        textOverflow: wrap ? "clip" : "ellipsis",
      }}>{value}</span>
    </div>
  );
}

function SettleTab({ t, tasks }) {
  const [period, setPeriod] = useState("today");
  const [view, setView] = useState("completed");

  const today = "2026-04-27";
  const safeTasks = tasks || [];

  // 헬퍼 - 작업당 수수료/금액 계산
  const getFee = (x) => Math.round((x.productPrice || x.estimateTotal || 0) * 0.5);
  const getAmount = (x) => (x.productPrice || x.estimateTotal || 0) + (x.extraFee || 0);
  
  // 헬퍼 - 날짜 매칭 (completedAt은 시간만 들어있을 수 있어서 scheduledDate로 보조 매칭)
  const matchToday = (x) => {
    if (x.scheduledDate === today) return true;
    if (x.completedAt && x.completedAt.startsWith(today)) return true;
    return false;
  };

  const completed = safeTasks.filter(x => x.status === "완료");
  const inProgress = safeTasks.filter(x => ["확정", "진행중"].includes(x.status));

  const todayCompleted = completed.filter(matchToday);
  const todayInProgress = inProgress.filter(matchToday);

  const periodCompleted = period === "today" ? todayCompleted : completed;
  const periodInProgress = period === "today" ? todayInProgress : inProgress;

  const completedFee = periodCompleted.reduce((sum, x) => sum + getFee(x), 0);
  const expectedFee = periodInProgress.reduce((sum, x) => sum + getFee(x), 0);
  const completedTotal = periodCompleted.reduce((sum, x) => sum + getAmount(x), 0);
  const expectedTotal = periodInProgress.reduce((sum, x) => sum + getAmount(x), 0);

  const showTasks = view === "completed" ? periodCompleted : periodInProgress;

  const periodLabel = period === "today" ? "오늘" : period === "week" ? "이번주" : "이번달";

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>💰 내 수수료</div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          원청이 받는 수수료 · 매일 정산
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { id: "today", label: "오늘", desc: "4/27" },
          { id: "week", label: "이번주", desc: "4/21~27" },
          { id: "month", label: "이번달", desc: "4월" },
        ].map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)} style={{
            flex: 1, padding: "10px 6px",
            background: period === p.id ? t.accent : t.bgInset,
            color: period === p.id ? "white" : t.text,
            border: `1px solid ${period === p.id ? t.accent : t.border}`,
            borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{p.label}</div>
            <div style={{ fontSize: 9, opacity: 0.7 }}>{p.desc}</div>
          </button>
        ))}
      </div>

      <div style={{
        background: PRINCIPAL_BG,
        border: `1.5px solid ${PRINCIPAL_COLOR}40`,
        borderRadius: 16, padding: "20px", marginBottom: 12
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: PRINCIPAL_COLOR, letterSpacing: 1, textTransform: "uppercase" }}>
            🏪 {periodLabel} 받을 수수료
          </div>
          {period === "today" && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", background: t.success, color: "white", borderRadius: 100 }}>
              매일 정산
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
          <span className="mono" style={{ fontSize: 32, fontWeight: 800, color: PRINCIPAL_COLOR }}>
            ₩{completedFee.toLocaleString()}
          </span>
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary }}>
          완료 {periodCompleted.length}건 · 고객 결제 ₩{completedTotal.toLocaleString()}
        </div>
        {period === "today" && completedFee > 0 && (
          <div style={{ marginTop: 12, padding: "8px 10px", background: t.successBg, borderRadius: 8, fontSize: 11, color: t.success, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={12}/>
            <span>다음 영업일에 입금 예정</span>
          </div>
        )}
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
          ⏳ 진행 중 (예상 수수료)
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600 }}>예상 수수료</span>
          <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: t.warning }}>
            ₩{expectedFee.toLocaleString()}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: t.textMuted }}>예상 결제</span>
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>
            ₩{expectedTotal.toLocaleString()} ({periodInProgress.length}건)
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button onClick={() => setView("completed")} style={{
          flex: 1, padding: "8px",
          background: view === "completed" ? t.accent : t.bgInset,
          color: view === "completed" ? "white" : t.text,
          border: `1px solid ${view === "completed" ? t.accent : t.border}`,
          borderRadius: 8, fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          완료 ({periodCompleted.length})
        </button>
        <button onClick={() => setView("progress")} style={{
          flex: 1, padding: "8px",
          background: view === "progress" ? t.accent : t.bgInset,
          color: view === "progress" ? "white" : t.text,
          border: `1px solid ${view === "progress" ? t.accent : t.border}`,
          borderRadius: 8, fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          진행 중 ({periodInProgress.length})
        </button>
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
          📋 작업별 수수료
        </div>
        {showTasks.length === 0 ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
            {view === "completed" ? `${periodLabel} 완료 작업이 없어요` : `${periodLabel} 진행 중 작업이 없어요`}
          </div>
        ) : showTasks.map((task, idx) => (
          <div key={task.id} style={{
            padding: "12px 0",
            borderBottom: idx < showTasks.length - 1 ? `1px solid ${t.border}` : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{task.customer}</div>
                <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                  {task.workType} · {task.scheduledTime || task.requestedTime || "일정 미정"}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: PRINCIPAL_COLOR }}>
                  ₩{getFee(task).toLocaleString()}
                </div>
                <div style={{ fontSize: 9, color: t.textMuted, marginTop: 2 }}>
                  결제 ₩{getAmount(task).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

function InfoTab({ t, user, mode, setMode, onLogout }) {
  const isPcInfo = useIsPc();
  const principalLabel = getPrincipalLabel(user) || "원청";
  const userName       = user?.name || `${principalLabel} 대표`;
  const userPhone      = user?.phone || "";
  const userCode       = user?.code || "";
  const handleLogout = () => {
    if (window.confirm("로그아웃 하시겠습니까?")) onLogout?.();
  };

  // 2026-06-04 — 다크/라이트 토글. setMode 호출 → PrincipalApp useEffect 측 applyThemeVars 발화.
  //   사장님 spec 이진 토글 (light/dark). 'auto'는 옛 themes.js 측 지원이나 UI에선 제외.
  const darkOn = mode !== "light";
  const handleDarkToggle = (value) => {
    if (typeof setMode === "function") setMode(value ? "dark" : "light");
  };

  // 2026-06-04 — 폰트 크기. utils/fontSize.js 공용 헬퍼 (EngineerMeTab 공유).
  const [fontSize, setFontSize] = useState(() => loadFontSize());
  useEffect(() => { applyFontSize(fontSize); }, [fontSize]);

  // 2026-06-08 — partner 5종 kind 토글 (Mig 108 + 106/107 짝).
  //   user_notification_preferences 본인 prefs 로드. row 없음 = ON (default).
  const userUuidForPrefs = user?.user_id || user?.userId || user?.id || "";
  const [kindPrefs, setKindPrefs] = useState(() => {
    const init = {}; for (const k of PARTNER_NOTI_KINDS) init[k] = true; return init;
  });
  const [kindLoading, setKindLoading] = useState(true);
  useEffect(() => {
    if (!userUuidForPrefs) { setKindLoading(false); return; }
    let cancelled = false;
    fetchNotiPrefs(userUuidForPrefs).then(res => {
      if (cancelled) return;
      if (res.ok) {
        // PARTNER_NOTI_KINDS 만 추출 (운영자 kind 는 무시)
        const next = {};
        for (const k of PARTNER_NOTI_KINDS) next[k] = res.prefs[k] !== false;
        setKindPrefs(next);
      }
      setKindLoading(false);
    });
    return () => { cancelled = true; };
  }, [userUuidForPrefs]);

  async function toggleKind(kind) {
    if (kindLoading || !userUuidForPrefs) return;
    const next = !kindPrefs[kind];
    setKindPrefs(prev => ({ ...prev, [kind]: next }));   // optimistic
    const res = await setNotiPref({
      userId:  userUuidForPrefs,
      kind,
      enabled: next,
      actorId: userUuidForPrefs,
    });
    if (!res.ok) {
      // rollback
      setKindPrefs(prev => ({ ...prev, [kind]: !next }));
      showPushToast(`⚠️ ${res.error || "토글 실패"}`);
    }
  }

  // 2026-06-04 — 푸시 알림 토글 (Mig 097 partner 분기 짝).
  //   localStorage 'ollit_push' (EngineerMeTab 공유 키) 우선, 마운트 시 실제 구독 상태 동기화.
  const [push, setPush] = useState(() => {
    try {
      const v = localStorage.getItem("ollit_push");
      if (v === "false") return false;
    } catch (e) { /* ignore */ }
    return true;
  });
  const [pushToast, setPushToast] = useState(null);

  function showPushToast(msg) {
    setPushToast(msg);
    setTimeout(() => setPushToast(null), 2400);
  }

  useEffect(() => {
    if (!isPushSupported()) return;
    let cancelled = false;
    getCurrentSubscription().then(sub => {
      if (cancelled) return;
      const granted = getPermissionState() === "granted";
      const next = !!(sub && granted);
      setPush(next);
      try { localStorage.setItem("ollit_push", String(next)); } catch (e) { /* ignore */ }
    });
    return () => { cancelled = true; };
  }, []);

  async function handlePushToggle(value) {
    if (value) {
      if (!isPushSupported()) {
        showPushToast("⚠️ 이 브라우저는 푸시 알림을 지원하지 않습니다");
        return;
      }
      if (isIOS() && !isStandalone()) {
        showPushToast("⚠️ 홈 화면에 추가한 후 다시 시도해주세요");
        return;
      }
      const userId = user?.user_id || user?.id || "";
      if (!userId) {
        showPushToast("⚠️ 로그인 정보가 없습니다");
        return;
      }
      const res = await subscribePushWithSync({
        userId,
        engineerId: "",
        role:       "partner",
      });
      if (res.ok) {
        setPush(true);
        try { localStorage.setItem("ollit_push", "true"); } catch (e) { /* ignore */ }
        showPushToast("✓ 푸시 알림이 활성화되었습니다");
      } else if (res.reason === "denied") {
        showPushToast("⚠️ 알림 권한이 거부되었습니다 (휴대폰 설정에서 변경)");
      } else if (res.reason === "no_vapid") {
        showPushToast("⚠️ 푸시 키가 설정되지 않았습니다");
      } else if (res.reason === "sync_failed") {
        setPush(true);
        try { localStorage.setItem("ollit_push", "true"); } catch (e) { /* ignore */ }
        showPushToast("✓ 활성화됨 (서버 sync 보류)");
      } else {
        showPushToast(`⚠️ ${res.error || "활성화 실패"}`);
      }
    } else {
      const userId = user?.user_id || user?.id || "";
      const res = await unsubscribePushWithSync({ userId, engineerId: "" });
      setPush(false);
      try { localStorage.setItem("ollit_push", "false"); } catch (e) { /* ignore */ }
      if (res.ok) showPushToast("✓ 푸시 알림이 비활성화되었습니다");
      else        showPushToast(`⚠️ ${res.error || "비활성화 실패"}`);
    }
  }

  // 2026-06-04 — 본인 원청 계좌 fetch (Mig 096 update_principal_account 짝).
  //   user.principals[].id 배열 (sign_in_with_phone Mig 057 응답) 기반.
  const [accounts, setAccounts] = useState([]);     // [{ id, code, name, bank_name, account_number, account_holder }]
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountToast, setAccountToast] = useState(null);

  const reloadAccounts = async () => {
    const ids = Array.isArray(user?.principals)
      ? user.principals.map(p => p?.id).filter(Boolean)
      : [];
    if (ids.length === 0) { setAccounts([]); return; }
    setAccountsLoading(true);
    const res = await fetchPrincipalAccounts(ids);
    if (res.ok) setAccounts(res.accounts);
    setAccountsLoading(false);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = Array.isArray(user?.principals)
        ? user.principals.map(p => p?.id).filter(Boolean)
        : [];
      if (ids.length === 0) { setAccounts([]); return; }
      setAccountsLoading(true);
      const res = await fetchPrincipalAccounts(ids);
      if (!alive) return;
      if (res.ok) setAccounts(res.accounts);
      setAccountsLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id]);

  function showAccountToast(msg) {
    setAccountToast(msg);
    setTimeout(() => setAccountToast(null), 2400);
  }

  return (
    <div className="fade-in" style={{
      // 2026-06-11 — PC: 중앙 1단 + max-width 640. 모바일: 옛 padding 20 그대로.
      padding: isPcInfo ? "32px 24px 80px" : "20px",
      minHeight: isPcInfo ? "100vh" : undefined,
      background: isPcInfo ? t.bg : undefined,
      boxSizing: "border-box",
    }}>
      <div style={{
        maxWidth: isPcInfo ? 1100 : "100%",
        margin: isPcInfo ? "0 auto" : undefined,
      }}>
      <div style={{ marginBottom: isPcInfo ? 18 : 16 }}>
        <div style={{ fontSize: isPcInfo ? 22 : 18, fontWeight: 800, marginBottom: 4 }}>👤 내 정보</div>
        <div style={{ fontSize: isPcInfo ? 13 : 12, color: t.textMuted }}>
          {userName}님
        </div>
      </div>

      {/* 2026-06-11 — PC 2단 grid (좌: 계정·계좌 / 우: 설정·로그아웃). 모바일 = block (옛 흐름). */}
      <div style={{
        display: isPcInfo ? "grid" : "block",
        gridTemplateColumns: isPcInfo ? "minmax(0, 1fr) minmax(0, 1fr)" : undefined,
        gap: isPcInfo ? 16 : 0,
        alignItems: isPcInfo ? "start" : undefined,
      }}>
      {/* 좌 — 계정 + 입금 계좌 */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: isPcInfo ? 16 : 0,
        minWidth: 0,
      }}>

      <div style={{
        background: t.bgElevated, borderRadius: 14,
        padding: isPcInfo ? "24px" : "20px",
        marginBottom: isPcInfo ? 0 : 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: PRINCIPAL_COLOR, color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Building2 size={28}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: isPcInfo ? 18 : 16, fontWeight: 800 }}>{principalLabel}</div>
            <div style={{ fontSize: isPcInfo ? 13 : 12, color: t.textMuted, fontWeight: 500 }}>
              {userName}님
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
          {userCode && <Row t={t} label="계정 코드" value={userCode} mono/>}
          {userPhone && <Row t={t} label="연락처" value={userPhone} mono/>}
        </div>
      </div>

      {/* 2026-06-04 — 계좌 카드 (소유 원청별, Mig 096 update_principal_account 짝) */}
      {accountsLoading && accounts.length === 0 ? (
        <div style={{
          background: t.bgElevated, borderRadius: 14, padding: "16px 18px", marginBottom: 16,
          fontSize: 12, color: t.textMuted, textAlign: "center",
        }}>계좌 정보 불러오는 중...</div>
      ) : accounts.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, marginBottom: 8, paddingLeft: 4 }}>
            입금 계좌
          </div>
          {accounts.map(acc => (
            <AccountCard
              key={acc.id}
              t={t}
              account={acc}
              userId={user?.user_id || user?.id}
              onUpdated={async () => {
                await reloadAccounts();
                showAccountToast("계좌가 업데이트되었습니다");
              }}
              onError={(msg) => showAccountToast(`⚠️ ${msg}`)}
            />
          ))}
        </div>
      ) : null}

      {/* 좌 칸 끝 / 우 칸 시작 — PC 2단 분리. */}
      </div>
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: isPcInfo ? 16 : 0,
        minWidth: 0,
      }}>

      {/* 2026-06-04 — 설정 카드: 다크/라이트 + 폰트 크기 */}
      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, marginBottom: 12 }}>
          설정
        </div>

        {/* 다크/라이트 토글 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${t.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>{darkOn ? "🌙" : "☀️"}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
              {darkOn ? "다크 모드" : "라이트 모드"}
            </span>
          </div>
          <button
            onClick={() => handleDarkToggle(!darkOn)}
            style={{
              width: 46, height: 26, borderRadius: 13,
              background: darkOn ? "#FF4D9E" : t.border,
              border: "none", padding: 0, cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
            }}
            aria-label="테마 토글"
          >
            <div style={{
              position: "absolute", top: 3, left: darkOn ? 23 : 3,
              width: 20, height: 20, borderRadius: "50%",
              background: "#fff",
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}/>
          </button>
        </div>

        {/* 푸시 알림 토글 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingBottom: 14, marginBottom: 14,
          borderBottom: push ? "none" : `1px solid ${t.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>{push ? "🔔" : "🔕"}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
              푸시 알림
            </span>
          </div>
          <button
            onClick={() => handlePushToggle(!push)}
            style={{
              width: 46, height: 26, borderRadius: 13,
              background: push ? "#FF4D9E" : t.border,
              border: "none", padding: 0, cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
            }}
            aria-label="푸시 토글"
          >
            <div style={{
              position: "absolute", top: 3, left: push ? 23 : 3,
              width: 20, height: 20, borderRadius: "50%",
              background: "#fff",
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}/>
          </button>
        </div>

        {/* 2026-06-08 — 원청 5종 kind 토글 (푸시 ON 일 때만 표시). Mig 108 짝. */}
        {push && (
          <div style={{
            paddingLeft: 26, paddingBottom: 14, marginBottom: 14,
            borderBottom: `1px solid ${t.border}`,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            {[
              { kind: "partnerAssign",   icon: ClipboardCheck, label: "작업 배정 알림" },
              { kind: "partnerSchedule", icon: CalendarClock,  label: "일정 확정 알림" },
              { kind: "partnerComplete", icon: CheckCircle2,   label: "작업 완료 알림" },
              { kind: "partnerCancel",   icon: XCircle,        label: "작업 취소 알림" },
              { kind: "partnerSettle",   icon: Wallet,         label: "정산 완료 알림" },
            ].map(opt => {
              const Icon = opt.icon;
              const on = kindPrefs[opt.kind] !== false;
              return (
                <div key={opt.kind} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  opacity: kindLoading ? 0.55 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon size={14} style={{ color: t.textMuted, flexShrink: 0 }}/>
                    <span style={{ fontSize: 12, color: t.text }}>{opt.label}</span>
                  </div>
                  <button
                    onClick={() => toggleKind(opt.kind)}
                    disabled={kindLoading}
                    style={{
                      width: 38, height: 22, borderRadius: 11,
                      background: on ? "#FF4D9E" : t.border,
                      border: "none", padding: 0,
                      cursor: kindLoading ? "default" : "pointer",
                      position: "relative",
                      transition: "background 0.2s",
                    }}
                    aria-label={`${opt.label} 토글`}
                  >
                    <div style={{
                      position: "absolute", top: 3, left: on ? 19 : 3,
                      width: 16, height: 16, borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.2s",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                    }}/>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 폰트 크기 선택 */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>
            글자 크기
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {FONT_SIZE_OPTIONS.map(size => {
              const labelMap = { small: "작게", medium: "보통", large: "크게" };
              const active = fontSize === size;
              return (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  style={{
                    flex: 1, padding: "10px 8px",
                    background: active ? "#FF4D9E" : t.bgInset,
                    color: active ? "#fff" : t.textSecondary,
                    border: active ? "1px solid #FF4D9E" : `1px solid ${t.border}`,
                    borderRadius: 10,
                    fontSize: size === "small" ? 11 : size === "large" ? 15 : 13,
                    fontWeight: active ? 800 : 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >{labelMap[size]}</button>
              );
            })}
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        style={{
          width: "100%", padding: "14px",
          background: t.dangerBg, color: t.danger,
          border: `1px solid ${t.danger}40`, borderRadius: 14,
          fontSize: 13, fontWeight: 700, fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          cursor: "pointer",
        }}
      >
        <LogOut size={16}/> 로그아웃
      </button>

      {/* 우 칸 끝 + 2단 grid 닫음 */}
      </div>
      </div>

      {/* 계좌 변경 토스트 */}
      {accountToast && (
        <div style={{
          position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
          background: t.bgElevated, color: t.text,
          border: `1px solid ${t.border}`, borderRadius: 10,
          padding: "10px 16px", fontSize: 12, fontWeight: 700,
          zIndex: 2000, boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          fontFamily: "inherit",
        }}>{accountToast}</div>
      )}

      {/* 푸시 토글 토스트 */}
      {pushToast && (
        <div style={{
          position: "fixed", bottom: 140, left: "50%", transform: "translateX(-50%)",
          background: t.bgElevated, color: t.text,
          border: `1px solid ${t.border}`, borderRadius: 10,
          padding: "10px 16px", fontSize: 12, fontWeight: 700,
          zIndex: 2000, boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          fontFamily: "inherit",
        }}>{pushToast}</div>
      )}
      </div>
    </div>
  );
}

// 2026-06-04 — 원청 계좌 카드 (InfoTab 측).
//   1) 현재 은행/번호/예금주 표시 + "수정" 버튼.
//   2) 수정 모드: 입력 폼 (3개 필드 모두 필수, 형식 검증 없음).
//   3) "저장" → 확인 다이얼로그 (변경 내용 표시) → 확인 시 RPC 호출 → onUpdated 콜백.
function AccountCard({ t, account, userId, onUpdated, onError }) {
  const [editing, setEditing]   = useState(false);
  const [bankName, setBankName] = useState(account?.bank_name      || "");
  const [accNum,   setAccNum]   = useState(account?.account_number || "");
  const [holder,   setHolder]   = useState(account?.account_holder || "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    if (!editing) {
      setBankName(account?.bank_name      || "");
      setAccNum(  account?.account_number || "");
      setHolder(  account?.account_holder || "");
    }
  }, [account, editing]);

  const hasAllFields =
    bankName.trim() !== "" &&
    accNum.trim()   !== "" &&
    holder.trim()   !== "";

  function handleSaveClick() {
    if (!hasAllFields) {
      onError?.("은행 / 번호 / 예금주 모두 입력해주세요");
      return;
    }
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!userId) {
      onError?.("로그인 정보가 없습니다");
      setConfirmOpen(false);
      return;
    }
    setSubmitting(true);
    const res = await updatePrincipalAccount({
      principalId:   account.id,
      bankName:      bankName.trim(),
      accountNumber: accNum.trim(),
      accountHolder: holder.trim(),
      actor:         userId,
    });
    setSubmitting(false);
    setConfirmOpen(false);
    if (res?.ok) {
      setEditing(false);
      onUpdated?.();
    } else {
      onError?.(res?.error || "변경 실패");
    }
  }

  const inputStyle = {
    width: "100%", padding: "10px 12px",
    background: t.bgInset, border: `1px solid ${t.border}`,
    borderRadius: 8, fontSize: 13, color: t.text,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      background: t.bgElevated, borderRadius: 14, padding: "16px 18px", marginBottom: 10,
      border: `1px solid ${t.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>
          {account?.name || "원청"}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: "6px 12px",
              background: "transparent",
              border: `1px solid ${t.border}`,
              color: t.textSecondary, borderRadius: 8,
              fontSize: 11, fontWeight: 700, fontFamily: "inherit",
              cursor: "pointer",
            }}
          >수정</button>
        )}
      </div>

      {!editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Row t={t} label="은행" value={account?.bank_name || "—"}/>
          <Row t={t} label="계좌번호" value={account?.account_number || "—"} mono/>
          <Row t={t} label="예금주" value={account?.account_holder || "—"}/>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>은행</div>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="예: 카카오뱅크" style={inputStyle}/>
          </div>
          <div>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>계좌번호</div>
            <input value={accNum} onChange={(e) => setAccNum(e.target.value)} placeholder="0000-00-0000000" style={inputStyle}/>
          </div>
          <div>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>예금주</div>
            <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="예: 홍길동" style={inputStyle}/>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button
              onClick={() => setEditing(false)}
              style={{
                flex: 1, padding: "10px",
                background: "transparent", border: `1px solid ${t.border}`,
                color: t.textSecondary, borderRadius: 8,
                fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                cursor: "pointer",
              }}
            >취소</button>
            <button
              onClick={handleSaveClick}
              disabled={!hasAllFields}
              style={{
                flex: 1, padding: "10px",
                background: hasAllFields ? "#FF4D9E" : t.bgInset,
                color: hasAllFields ? "#fff" : t.textMuted,
                border: "none", borderRadius: 8,
                fontSize: 12, fontWeight: 800, fontFamily: "inherit",
                cursor: hasAllFields ? "pointer" : "not-allowed",
              }}
            >저장</button>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, zIndex: 1500,
        }}>
          <div style={{
            width: "100%", maxWidth: 380,
            background: t.bgElevated, borderRadius: 14,
            border: `1px solid ${t.border}`,
            padding: "20px",
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: t.text, marginBottom: 12 }}>
              계좌 변경 확인
            </div>
            <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 14, lineHeight: 1.5 }}>
              아래 정보로 변경합니다. 진행하시겠습니까?
            </div>
            <div style={{
              background: t.bgInset, border: `1px solid ${t.border}`,
              borderRadius: 8, padding: "12px 14px",
              display: "flex", flexDirection: "column", gap: 6,
              marginBottom: 16,
            }}>
              <Row t={t} label="은행" value={bankName.trim()}/>
              <Row t={t} label="계좌번호" value={accNum.trim()} mono/>
              <Row t={t} label="예금주" value={holder.trim()}/>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                style={{
                  flex: 1, padding: "10px",
                  background: "transparent", border: `1px solid ${t.border}`,
                  color: t.textSecondary, borderRadius: 8,
                  fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >취소</button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                style={{
                  flex: 1, padding: "10px",
                  background: submitting ? t.bgInset : "#FF4D9E",
                  color: submitting ? t.textMuted : "#fff",
                  border: "none", borderRadius: 8,
                  fontSize: 12, fontWeight: 800, fontFamily: "inherit",
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >{submitting ? "저장 중..." : "확인"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Step 11 — 작업 수정 이력 (localStorage)
// 누가 / 언제 / 뭘 바꿨는지 자동 기록
// Phase 2 — Supabase task_history 테이블로 동일 인터페이스 사용

const STORAGE_KEY = "ollit_task_history_v1";
const MAX_ENTRIES = 1000;

function generateId() {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("이력 저장 실패:", e);
  }
}

export function saveTaskHistory(entry) {
  if (!entry || !entry.taskId) return null;
  const all = readAll();
  const record = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  all.unshift(record); // 최신이 위
  if (all.length > MAX_ENTRIES) all.length = MAX_ENTRIES;
  writeAll(all);
  return record;
}

export function loadTaskHistory(taskId = null) {
  const all = readAll();
  return taskId ? all.filter(h => h.taskId === taskId) : all;
}

export function getHistoryCount(taskId) {
  return loadTaskHistory(taskId).length;
}

// 필드명 → 한국어 라벨
export const FIELD_LABELS = {
  customer:        "고객명",
  customerName:    "고객명",
  phone:           "연락처",
  customerPhone:   "연락처",
  address:         "주소",
  region:          "지역",
  appliances:      "작업 기종/수량",
  appliance:       "기종",
  qty:             "수량",
  workItems:       "작업 항목",
  workType:        "작업 종류",
  scheduledAt:     "예정일시",
  schedule:        "일정",
  time:            "시간",
  totalAmount:     "총 금액",
  estimateTotal:   "견적 금액",
  extraFee:        "현장 추가금",
  addonFee:        "현장 추가금",
  engineerEarning: "기사 단가",
  companyMargin:   "회사 마진",
  principalFee:    "원청 수수료",
  engineerId:      "담당 기사",
  engineer:        "담당 기사",
  principalId:     "원청",
  principal:       "원청",
  status:          "상태",
  state:           "상태",
  note:            "비고",
  memo:            "메모",
};

// 액션명 → 이모지
export const ACTION_ICONS = {
  create:     "📥",
  edit:       "✏️",
  assign:     "👷",
  cancel:     "⚫",
  complete:   "✓",
  partial:    "🔶",
  visit_only: "🚗",
  memo:       "📝",
};

export function getFieldLabel(key) {
  return FIELD_LABELS[key] || key;
}

export function getActionIcon(action) {
  return ACTION_ICONS[action] || "📝";
}

// 값 표기 (객체/배열은 요약)
export function formatHistoryValue(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("ko-KR");
  if (Array.isArray(v)) {
    if (v.length === 0) return "(빈 목록)";
    const first = v[0];
    if (first && typeof first === "object" && first.workType) {
      return v.map(it => `${it.workType} ${it.appliance || ""}×${it.qty || 1}`).join(", ");
    }
    return v.length === 1 ? String(v[0]) : `${v.length}개 항목`;
  }
  if (typeof v === "object") return JSON.stringify(v).slice(0, 40);
  return String(v);
}

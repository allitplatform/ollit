// ============================================
// 올잇 통합 Task 데이터 (단일 진실 소스)
// V14 v6 — 동적 시뮬 (dateOffset + 시간 기반 status / 정체 X)
// 모듈 로드 시점에 today 기준 catch / 새로고침 시 자동 반영
// ============================================

// 오늘 기준 N일 전/후 ISO 날짜 (YYYY-MM-DD)
function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// 시간 기반 status 자동 catch
// - 과거 작업: 완료
// - 오늘 작업: 시작 전 = 확정 / 진행 중 = 진행중 / 종료 후 = 완료
// - 미래 작업: 확정 (또는 명시적 status 우선)
function statusByTime(date, startTime, endTime, override) {
  if (override) return override;
  const todayStr = new Date().toISOString().slice(0, 10);
  if (date < todayStr) return "완료";
  if (date > todayStr) return "확정";
  // 오늘
  const now = new Date();
  const startStr = `${date}T${startTime || "09:00"}:00`;
  const endStr   = `${date}T${endTime   || "18:00"}:00`;
  if (now < new Date(startStr)) return "확정";
  if (now < new Date(endStr))   return "진행중";
  return "완료";
}

// 시간 기반 startedAt / completedAt
function timestampsByStatus(status, startTime, endTime) {
  if (status === "완료")   return { startedAt: startTime, completedAt: endTime };
  if (status === "진행중") return { startedAt: startTime, completedAt: null };
  return { startedAt: null, completedAt: null };
}

// 동적 task — 시간 기반 status 자동
function dynamicTask(t) {
  const status = statusByTime(t.scheduledDate, t.scheduledTime, t.endTime, t._statusOverride);
  const { startedAt, completedAt } = timestampsByStatus(status, t.scheduledTime, t.endTime);
  const cleaned = { ...t, status, startedAt, completedAt };
  delete cleaned._statusOverride;
  return cleaned;
}

export const INITIAL_TASKS = [
  // ─── 기사 김동효(E001) 진행중 작업 ───
  {
    id: "A260427-001",
    client: "올데이케어",
    customer: "박지영", phone: "010-2345-6789",
    address: "강남구 역삼동", fullAddress: "테헤란로 152, 강남파이낸스센터 25층",
    workType: "세척", appliance: "벽걸이", qty: 1,
    requestedDate: "2026-04-27", requestedTime: "오전",
    receivedAt: "2026.04.25", channel: "카카오톡",
    happycallStatus: "assigned",
    happycallMemo: "고객님 친절하셨음. 시간 약속 잘 지키세요.",
    requestNote: "현관 비밀번호 1234, 강아지 있어요",
    assignedEngineer: "김동효",
    assignedEngineerId: "E001",
    recommendedEngineer: null,
    scheduledDate: "2026-04-27", scheduledTime: "09:00",
    // ⭐ 3-A차 추가: EngineerApp 호환 필드
    time: "09:00", endTime: "10:30", duration: "1.5h",
    distance: "12.4km", travelTime: "32분",
    // ─────────────────────────────
    status: "진행중",
    startedAt: "09:05", completedAt: null,
    estimateTotal: 80000,
    productPrice: 80000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 40, commission: 32000, engineerNet: 48000,
    workMemo: "", beforePhoto: false, afterPhoto: false,
    scheduleHistory: [],
    isUrgent: false,
  },
  {
    id: "A260427-002",
    client: "쿨가이",
    customer: "이상훈", phone: "010-3456-7890",
    address: "서초구 반포동", fullAddress: "신반포로 270, 반포자이 103-1502",
    workType: "세척", appliance: "스탠드", qty: 2,
    requestedDate: "2026-04-27", requestedTime: "낮 시간",
    receivedAt: "2026.04.24", channel: "전화",
    happycallStatus: "assigned",
    happycallMemo: "고객이 시간 변경 가능성 있다고 함. 미리 전화 권장.",
    requestNote: "퇴근 후 18시 이후 가능합니다. 주차는 지하 B2 손님용 자리 가능",
    assignedEngineer: "김동효",
    assignedEngineerId: "E001",
    recommendedEngineer: null,
    scheduledDate: "2026-04-27", scheduledTime: "11:30",
    // ⭐ 3-A차 추가
    time: "11:30", endTime: "13:30", duration: "2h",
    distance: "4.2km", travelTime: "15분",
    // ─────────────────────────────
    status: "확정",
    startedAt: null, completedAt: null,
    estimateTotal: 200000,
    productPrice: 200000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 40, commission: 80000, engineerNet: 120000,
    workMemo: "", beforePhoto: false, afterPhoto: false,
    scheduleHistory: [],
    isUrgent: false,
  },
  {
    id: "A260427-003",
    client: "올데이케어",
    customer: "김미경", phone: "010-4567-8901",
    address: "송파구 잠실동", fullAddress: "올림픽로 240, 트리지움 305-2201",
    workType: "냉매충전", appliance: "시스템 멀티", qty: 1,
    requestedDate: "2026-04-27", requestedTime: "오후",
    receivedAt: "2026.04.23", channel: "직접",
    happycallStatus: "assigned",
    happycallMemo: "냉매 부족 가능성 높음. R32 가스 확인.",
    requestNote: "에어컨에서 차가운 바람이 잘 안 나옵니다.",
    assignedEngineer: "김동효",
    assignedEngineerId: "E001",
    recommendedEngineer: null,
    scheduledDate: "2026-04-27", scheduledTime: "14:00",
    // ⭐ 3-A차 추가
    time: "14:00", endTime: "16:30", duration: "2.5h",
    distance: "8.7km", travelTime: "28분",
    // ─────────────────────────────
    status: "확정",
    startedAt: null, completedAt: null,
    estimateTotal: 120000,
    productPrice: 120000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 50, commission: 60000, engineerNet: 60000,
    workMemo: "", beforePhoto: false, afterPhoto: false,
    scheduleHistory: [],
    isUrgent: false,
  },
  
  // ─── 해피콜 미처리 작업 (기사 미배정) ───
  {
    id: "A260427-005",
    client: "올데이케어",
    customer: "박은서", phone: "010-1234-5678",
    address: "강남구 도곡동", fullAddress: "도곡로 123, 도곡래미안 304-1502",
    workType: "세척", appliance: "벽걸이", qty: 1,
    requestedDate: "2026-04-28", requestedTime: "오후",
    receivedAt: "2026.04.27 14:13", receivedAgo: "10분 전", channel: "전화",
    happycallStatus: "uncontacted",
    happycallMemo: "",
    requestNote: "",
    assignedEngineer: null, assignedEngineerId: null, recommendedEngineer: null,
    scheduledDate: null, scheduledTime: null,
    status: "약속대기",
    startedAt: null, completedAt: null,
    estimateTotal: 70000,
    productPrice: 70000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 40, commission: 28000, engineerNet: 42000,
    workMemo: "", beforePhoto: false, afterPhoto: false,
    scheduleHistory: [],
    isUrgent: false,
  },
  {
    id: "YS-260427-021",
    client: "유솔홈케어",
    customer: "박서연", phone: "010-7891-2345",
    address: "강남구 청담동", fullAddress: "도산대로 521, 청담힐",
    workType: "세척", appliance: "스탠드", qty: 1,
    requestedDate: "2026-04-28", requestedTime: "오후",
    receivedAt: "2026.04.27 14:05", receivedAgo: "18분 전", channel: "네이버",
    happycallStatus: "uncontacted",
    happycallMemo: "네이버 주문, 결제 완료",
    requestNote: "",
    assignedEngineer: null, assignedEngineerId: null, recommendedEngineer: null,
    scheduledDate: null, scheduledTime: null,
    status: "약속대기",
    startedAt: null, completedAt: null,
    estimateTotal: 168000,
    productPrice: 168000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 40, commission: 67200, engineerNet: 100800,
    workMemo: "", beforePhoto: false, afterPhoto: false,
    scheduleHistory: [],
    isUrgent: false,
  },
  {
    id: "A260427-006",
    client: "쿨가이",
    customer: "김민호", phone: "010-2345-6789",
    address: "송파구 잠실동", fullAddress: "올림픽로 240, 트리지움",
    workType: "세척", appliance: "스탠드", qty: 1,
    requestedDate: "2026-04-29", requestedTime: "오전",
    receivedAt: "2026.04.27 13:53", receivedAgo: "30분 전", channel: "전화",
    happycallStatus: "uncontacted",
    happycallMemo: "",
    requestNote: "",
    assignedEngineer: null, assignedEngineerId: null, recommendedEngineer: null,
    scheduledDate: null, scheduledTime: null,
    status: "약속대기",
    startedAt: null, completedAt: null,
    estimateTotal: 0,
    productPrice: 0, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 0, commission: 0, engineerNet: 0,
    workMemo: "", beforePhoto: false, afterPhoto: false,
    scheduleHistory: [],
    isUrgent: false,
  },
  {
    id: "MG-260427-008",
    client: "망고클린",
    customer: "김지수", phone: "010-9012-3456",
    address: "서초구 잠원동", fullAddress: "잠원로 80, 신반포자이",
    workType: "냉매충전", appliance: "벽걸이", qty: 2,
    requestedDate: "2026-04-29", requestedTime: "낮 시간",
    receivedAt: "2026.04.27 13:40", receivedAgo: "43분 전", channel: "전화",
    happycallStatus: "uncontacted",
    happycallMemo: "",
    requestNote: "",
    assignedEngineer: null, assignedEngineerId: null, recommendedEngineer: null,
    scheduledDate: null, scheduledTime: null,
    status: "약속대기",
    startedAt: null, completedAt: null,
    estimateTotal: 160000,
    productPrice: 160000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 40, commission: 64000, engineerNet: 96000,
    workMemo: "", beforePhoto: false, afterPhoto: false,
    scheduleHistory: [],
    isUrgent: false,
  },
  {
    id: "A260427-007",
    client: "용인컴퍼니",
    customer: "이지은", phone: "010-3456-7890",
    address: "서초구 반포동", fullAddress: "신반포로 270",
    workType: "설치", appliance: "벽걸이", qty: 2,
    requestedDate: "2026-04-27", requestedTime: "저녁",
    receivedAt: "2026.04.27 13:23", receivedAgo: "1시간 전", channel: "전화",
    happycallStatus: "uncontacted",
    happycallMemo: "",
    requestNote: "",
    assignedEngineer: null, assignedEngineerId: null, recommendedEngineer: null,
    scheduledDate: null, scheduledTime: null,
    status: "약속대기",
    startedAt: null, completedAt: null,
    estimateTotal: 321000,
    productPrice: 321000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 40, commission: 128400, engineerNet: 192600,
    workMemo: "", beforePhoto: false, afterPhoto: false,
    scheduleHistory: [],
    isUrgent: true, urgentReason: "당일 작업 요청",
  },
  
  // ─── 해피콜 통화 후 작업 (검토 단계) ───
  {
    id: "CC-260427-014",
    client: "크리크린",
    customer: "정수아", phone: "010-4567-1234",
    address: "송파구 잠실동", fullAddress: "올림픽로 300, 롯데캐슬",
    workType: "세척", appliance: "벽걸이", qty: 2,
    requestedDate: "2026-04-28", requestedTime: "오전",
    receivedAt: "2026.04.27 12:45", receivedAgo: "1시간 전", channel: "전화",
    happycallStatus: "contacted",
    happycallMemo: "1층 로비 인터폰으로 연락. 24호",
    requestNote: "",
    assignedEngineer: null, assignedEngineerId: null,
    recommendedEngineer: "김동효",
    scheduledDate: null, scheduledTime: null,
    status: "약속대기",
    startedAt: null, completedAt: null,
    estimateTotal: 150000,
    productPrice: 150000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 40, commission: 60000, engineerNet: 90000,
    workMemo: "", beforePhoto: false, afterPhoto: false,
    scheduleHistory: [],
    isUrgent: false,
  },
  {
    id: "A260427-008",
    client: "올데이케어",
    customer: "정도현", phone: "010-4567-8901",
    address: "강남구 청담동", fullAddress: "도산대로 450",
    workType: "설치", appliance: "벽걸이", qty: 1,
    requestedDate: "2026-04-28", requestedTime: "오후",
    receivedAt: "2026.04.27 12:30", receivedAgo: "2시간 전", channel: "지인소개",
    happycallStatus: "contacted",
    happycallMemo: "기존 에어컨 떼고 새 벽걸이 설치 부탁드려요. 주차 가능",
    requestNote: "",
    assignedEngineer: null, assignedEngineerId: null,
    recommendedEngineer: null,
    scheduledDate: null, scheduledTime: null,
    status: "약속대기",
    startedAt: null, completedAt: null,
    estimateTotal: 150000,
    productPrice: 150000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 40, commission: 60000, engineerNet: 90000,
    workMemo: "", beforePhoto: false, afterPhoto: false,
    scheduleHistory: [],
    isUrgent: false,
  },
  {
    id: "A260427-009",
    client: "쿨가이",
    customer: "박지영", phone: "010-5678-9012",
    address: "강남구 역삼동", fullAddress: "테헤란로 152",
    workType: "세척", appliance: "벽걸이", qty: 1,
    requestedDate: "2026-04-28", requestedTime: "오전",
    receivedAt: "2026.04.27 11:45", receivedAgo: "3시간 전", channel: "전화",
    happycallStatus: "contacted",
    happycallMemo: "현관 비밀번호 1234, 강아지 있어요",
    requestNote: "",
    assignedEngineer: null, assignedEngineerId: null,
    recommendedEngineer: "이재현",
    scheduledDate: null, scheduledTime: null,
    status: "약속대기",
    startedAt: null, completedAt: null,
    estimateTotal: 65000,
    productPrice: 65000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 40, commission: 26000, engineerNet: 39000,
    workMemo: "", beforePhoto: false, afterPhoto: false,
    scheduleHistory: [],
    isUrgent: false,
  },
  
  // ─── 김동효 약속대기 (해피콜 배정 완료, 기사가 약속 잡을 차례) ───
  {
    id: "A260427-004",
    client: "용인컴퍼니",
    customer: "정도현", phone: "010-5678-9012",
    address: "강남구 청담동", fullAddress: "도산대로 450, 청담힐스테이트 동405호",
    workType: "설치", appliance: "벽걸이", qty: 1,
    requestedDate: "2026-04-28", requestedTime: "오후",
    receivedAt: "2026.04.27", channel: "지인소개",
    happycallStatus: "assigned",
    happycallMemo: "",
    requestNote: "기존 에어컨 떼고 새 벽걸이 설치 부탁드려요",
    assignedEngineer: "김동효",
    assignedEngineerId: "E001",
    recommendedEngineer: null,
    scheduledDate: null, scheduledTime: null,
    // ⭐ 3-A차 추가: 약속대기 단계도 거리 정보는 있음 (시간은 미정)
    time: null, endTime: null, duration: null,
    distance: "6.1km", travelTime: "22분",
    // ─────────────────────────────
    status: "약속대기",
    startedAt: null, completedAt: null,
    estimateTotal: 150000,
    productPrice: 150000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 40, commission: 60000, engineerNet: 90000,
    workMemo: "", beforePhoto: false, afterPhoto: false,
    scheduleHistory: [],
    isUrgent: false,
  },

  // ============================================
  // V14 v6 — 김동효(E001) 시뮬 (동적: dateOffset + status 시간 기반)
  // 작업 종류 = 세척 / 냉매충전 만
  // 페이지 새로고침 시 today 기준 자동 반영 (정체 X)
  // 분포: -4일 3건 / -3일 2건 / -2일 2건 / -1일 2건 / 오늘 4건 / +2일 2건 = 15건
  // ============================================
  ...[
    // ── -4일 전 (예: today=5/5 → 5/1) ──
    { id: "O260501-001", client: "올데이케어", customer: "박지영", phone: "010-1111-2222",
      address: "강남구 역삼동", fullAddress: "역삼로 123",
      workType: "세척", appliance: "벽걸이", qty: 1,
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(-4), scheduledTime: "09:00",
      time: "09:00", endTime: "10:30", duration: "1.5h",
      estimateTotal: 60000, engineerNet: 40000,
    },
    { id: "YS260501-002", client: "유솔홈케어 H", customer: "이상훈", phone: "010-2222-3333",
      address: "서초구 반포동", fullAddress: "반포대로 100",
      workType: "세척", appliance: "스탠드", qty: 2,
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(-4), scheduledTime: "11:30",
      time: "11:30", endTime: "13:30", duration: "2h",
      estimateTotal: 220000, engineerNet: 120000,
    },
    { id: "A260501-003", client: "에어컨프로", customer: "김재현", phone: "010-3333-4444",
      address: "송파구 잠실동", fullAddress: "잠실로 200",
      workType: "세척", appliance: "4way", qty: 1,
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(-4), scheduledTime: "14:30",
      time: "14:30", endTime: "16:00", duration: "1.5h",
      estimateTotal: 130000, engineerNet: 70000,
    },

    // ── -3일 전 ──
    { id: "K-260502-001", client: "쿨가이", customer: "정민호", phone: "010-4444-5555",
      address: "용산구 한남동", fullAddress: "한남대로 150",
      workType: "세척", appliance: "스탠드", qty: 1,
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(-3), scheduledTime: "10:00",
      time: "10:00", endTime: "11:00", duration: "1h",
      estimateTotal: 110000, engineerNet: 60000,
    },
    { id: "YS-N260502-002", client: "유솔홈케어 N", customer: "박은서", phone: "010-5555-6666",
      address: "마포구 합정동", fullAddress: "합정로 80",
      workType: "세척", appliance: "벽걸이", qty: 1,
      orderType: "basic",
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(-3), scheduledTime: "13:00",
      time: "13:00", endTime: "14:00", duration: "1h",
      estimateTotal: 60000, engineerNet: 44000,
    },

    // ── -2일 전 ──
    { id: "O260503-001", client: "올데이케어", customer: "윤서연", phone: "010-6666-7777",
      address: "광진구 자양동", fullAddress: "자양로 50",
      workType: "세척", appliance: "4way", qty: 1,
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(-2), scheduledTime: "10:00",
      time: "10:00", endTime: "11:30", duration: "1.5h",
      estimateTotal: 130000, engineerNet: 70000,
    },
    { id: "CK260503-002", client: "크리크린", customer: "최동석", phone: "010-7777-8888",
      address: "성동구 옥수동", fullAddress: "옥수로 30",
      workType: "세척", appliance: "벽걸이", qty: 1,
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(-2), scheduledTime: "14:00",
      time: "14:00", endTime: "15:30", duration: "1.5h",
      estimateTotal: 60000, engineerNet: 40000,
    },

    // ── -1일 전 ──
    { id: "Y260504-001", client: "용인컴퍼니", customer: "임수아", phone: "010-8888-9999",
      address: "분당구 정자동", fullAddress: "정자로 200",
      workType: "세척", appliance: "벽걸이", qty: 1,
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(-1), scheduledTime: "10:00",
      time: "10:00", endTime: "11:30", duration: "1.5h",
      estimateTotal: 60000, engineerNet: 40000,
    },
    { id: "CK260504-002", client: "크리크린", customer: "장수빈", phone: "010-1010-2020",
      address: "일산 마두동", fullAddress: "마두로 100",
      workType: "세척", appliance: "4way", qty: 1,
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(-1), scheduledTime: "14:00",
      time: "14:00", endTime: "15:30", duration: "1.5h",
      estimateTotal: 130000, engineerNet: 70000,
    },

    // ── 오늘 (status 시간 기반 자동) ──
    { id: "O260505-001", client: "올데이케어", customer: "박지영", phone: "010-2020-3030",
      address: "중구 명동", fullAddress: "명동길 50",
      workType: "세척", appliance: "벽걸이", qty: 1,
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(0), scheduledTime: "09:00",
      time: "09:00", endTime: "10:30", duration: "1.5h",
      estimateTotal: 60000, engineerNet: 40000,
    },
    { id: "YS260505-002", client: "유솔홈케어 H", customer: "이상훈", phone: "010-3030-4040",
      address: "영등포구 여의도동", fullAddress: "국제금융로 200",
      workType: "세척", appliance: "스탠드", qty: 2,
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(0), scheduledTime: "11:30",
      time: "11:30", endTime: "13:30", duration: "2h",
      estimateTotal: 220000, engineerNet: 120000,
    },
    { id: "YS-N260505-003", client: "유솔홈케어 N", customer: "김미경", phone: "010-4040-5050",
      address: "강남구 청담동", fullAddress: "청담로 100",
      workType: "세척", appliance: "벽걸이", qty: 1,
      orderType: "basic",
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(0), scheduledTime: "14:30",
      time: "14:30", endTime: "15:30", duration: "1h",
      estimateTotal: 60000, engineerNet: 44000,
    },
    { id: "A260505-004", client: "에어컨프로", customer: "정수진", phone: "010-5050-6060",
      address: "송파구 잠실동", fullAddress: "잠실로 300",
      workType: "냉매충전", appliance: "4way", qty: 1,
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(0), scheduledTime: "16:00",
      time: "16:00", endTime: "17:30", duration: "1.5h",
      estimateTotal: 100000, engineerNet: 50000,
    },

    // ── +2일 후 (예정 / status 강제 '확정') ──
    { id: "A260507-001", client: "에어컨프로", customer: "강지훈", phone: "010-6060-7070",
      address: "강남구 청담동", fullAddress: "청담로 200, 청담아파트 101동 502호",
      workType: "세척", appliance: "4way", qty: 2,
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(2), scheduledTime: "10:00",
      time: "10:00", endTime: "12:30", duration: "2.5h",
      estimateTotal: 260000, engineerNet: 140000,
    },
    { id: "K-260507-002", client: "쿨가이", customer: "한미선", phone: "010-7070-8080",
      address: "용산구 이태원동", fullAddress: "이태원로 100, 이태원빌라 3층",
      workType: "세척", appliance: "4way", qty: 3,
      assignedEngineer: "김동효", assignedEngineerId: "E001",
      scheduledDate: dateOffset(2), scheduledTime: "14:00",
      time: "14:00", endTime: "17:00", duration: "3h",
      estimateTotal: 390000, engineerNet: 210000,
    },
  ].map(dynamicTask),
// V14 v6 — 옛 V11 시뮬도 dynamicTask 통과 (4월 작업 = 모두 '완료' 자동)
].map(t => t.scheduledDate && t.scheduledTime && t.endTime ? dynamicTask(t) : t);

// ============================================
// 헬퍼 함수 - 화면별 데이터 변환
// ============================================

// 해피콜 화면용 필터 (uncontacted/contacted/assigned 모두 보임)
export function filterTasksForHappycall(tasks) {
  return tasks; // 해피콜은 모든 작업 보여줌 (탭으로 분류)
}

// 기사 화면용 필터 (해당 기사에게 배정된 작업만)
// engineerId 매칭 (예: "E001" → 김동효 기사)
export function filterTasksForEngineer(tasks, engineerId) {
  if (!engineerId) return [];
  return tasks.filter(t => t.assignedEngineerId === engineerId);
}

// 원청 사장님 화면용 필터 (자기 원청의 작업만)
// clientName 매칭 (예: "쿨가이" → 쿨가이 원청 작업만)
export function filterTasksForPrincipal(tasks, clientName) {
  if (!clientName) return [];
  return tasks.filter(t => t.client === clientName);
}

// 작업번호 자동 생성 (원청 prefix 기반)
export function generateTaskId(client, prefixMap) {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const prefix = prefixMap[client] || "A";
  const sep = prefix === "A" ? "" : "-";
  return `${prefix}${sep}${dateStr}-${String(Math.floor(Math.random() * 999) + 100)}`;
}

// 작업 업데이트 (id 기반 부분 업데이트)
export function updateTaskInList(tasks, id, updates) {
  return tasks.map(t => t.id === id ? { ...t, ...updates } : t);
}

// ============================================
// 올잇 통합 Task 데이터 (단일 진실 소스) - 3-A차 보강판
// 위치: src/shared/tasks.js
// 변경 (3-A차):
//   - 김동효(E001) 배정된 3건의 작업에 EngineerApp 호환 필드 추가
//   - time, endTime, duration, distance, travelTime
//   - 다른 작업은 미터치 (약속대기 상태는 시간 정보 불필요)
// ============================================

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
    workType: "세척+점검", appliance: "스탠드", qty: 2,
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
    workType: "점검", appliance: "스탠드", qty: 1,
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
  // V14 v6 — 김동효(E001) 5월 시뮬 14건 (사장님 spec)
  // 작업 종류 = 세척 / 냉매충전 만 (점검/추가선택/냉매점검 X)
  // 완료 7건: 5/1 3건 + 5/2 2건 + 5/3 2건 → 정산에 표시
  // 예정 7건: 5/4~5/8 → 캘린더/알림만
  // 분포: 올데이 9 / KA 2 (이상훈+한미선) / KB 2 (한지원+윤서연) / 유솔N 1 (이수진)
  // ============================================

  // ── 5월 1일 (금) - 완료 3건 ──
  { id: "O260501-001", client: "올데이케어", customer: "박은서", phone: "010-1111-2222",
    address: "강남구 역삼동", fullAddress: "역삼로 123, 한국빌딩 1003호",
    workType: "세척", appliance: "벽걸이", qty: 1,
    assignedEngineer: "김동효", assignedEngineerId: "E001",
    scheduledDate: "2026-05-01", scheduledTime: "10:00",
    time: "10:00", endTime: "11:30", duration: "1.5h",
    status: "완료", startedAt: "10:00", completedAt: "11:25",
    estimateTotal: 60000, engineerNet: 40000, // 올데이 직영 벽걸이 40K
  },
  { id: "YS-N260501-002", client: "유솔홈케어 N", customer: "이수진", phone: "010-2222-3333",
    address: "서초구 서초동", fullAddress: "서초대로 456",
    workType: "세척", appliance: "벽걸이", qty: 1,
    orderType: "basic",
    assignedEngineer: "김동효", assignedEngineerId: "E001",
    scheduledDate: "2026-05-01", scheduledTime: "14:00",
    time: "14:00", endTime: "15:30", duration: "1.5h",
    status: "완료", startedAt: "14:00", completedAt: "15:25",
    estimateTotal: 60000, engineerNet: 44000, // 유솔N 본작업 단가 ×1.10
  },
  { id: "O260501-003", client: "올데이케어", customer: "박정민", phone: "010-9999-1111",
    address: "강남구 논현동", fullAddress: "논현로 100, 르엘아파트 305호",
    workType: "세척", appliance: "4way", qty: 1,
    assignedEngineer: "김동효", assignedEngineerId: "E001",
    scheduledDate: "2026-05-01", scheduledTime: "16:30",
    time: "16:30", endTime: "18:00", duration: "1.5h",
    status: "완료", startedAt: "16:30", completedAt: "17:55",
    estimateTotal: 130000, engineerNet: 70000, // 올데이 직영 4way 70K
  },

  // ── 5월 2일 (토) - 완료 2건 ──
  { id: "O260502-001", client: "올데이케어", customer: "정민호", phone: "010-3333-4444",
    address: "송파구 잠실동", fullAddress: "잠실로 789",
    workType: "세척", appliance: "스탠드", qty: 2,
    assignedEngineer: "김동효", assignedEngineerId: "E001",
    scheduledDate: "2026-05-02", scheduledTime: "10:00",
    time: "10:00", endTime: "12:00", duration: "2h",
    status: "완료", startedAt: "10:00", completedAt: "11:55",
    estimateTotal: 220000, engineerNet: 120000, // 올데이 직영 스탠드 60K×2
  },
  { id: "K-260502-002", client: "쿨가이", customer: "한지원", phone: "010-9999-2222",
    address: "서초구 방배동", fullAddress: "방배로 50, 그랜드빌라 201호",
    workType: "냉매충전", appliance: "벽걸이", qty: 1,
    assignedEngineer: "김동효", assignedEngineerId: "E001",
    scheduledDate: "2026-05-02", scheduledTime: "14:30",
    time: "14:30", endTime: "16:00", duration: "1.5h",
    status: "완료", startedAt: "14:30", completedAt: "15:55",
    estimateTotal: 80000, engineerNet: 40000, // KB 냉매 50% (총 80K)
  },

  // ── 5월 3일 (일) - 완료 2건 (사장님 spec catch: 누적 444K) ──
  { id: "O260503-001", client: "올데이케어", customer: "김도현", phone: "010-1010-3030",
    address: "강남구 대치동", fullAddress: "도곡로 200, 대치아파트 502호",
    workType: "세척", appliance: "4way", qty: 1,
    assignedEngineer: "김동효", assignedEngineerId: "E001",
    scheduledDate: "2026-05-03", scheduledTime: "10:00",
    time: "10:00", endTime: "11:30", duration: "1.5h",
    status: "완료", startedAt: "10:00", completedAt: "11:25",
    estimateTotal: 130000, engineerNet: 70000, // 올데이 직영 4way 70K
  },
  { id: "O260503-002", client: "올데이케어", customer: "한미경", phone: "010-2020-4040",
    address: "송파구 신천동", fullAddress: "올림픽로 100",
    workType: "세척", appliance: "스탠드", qty: 1,
    assignedEngineer: "김동효", assignedEngineerId: "E001",
    scheduledDate: "2026-05-03", scheduledTime: "14:00",
    time: "14:00", endTime: "15:30", duration: "1.5h",
    status: "완료", startedAt: "14:00", completedAt: "15:25",
    estimateTotal: 110000, engineerNet: 60000, // 올데이 직영 스탠드 60K
  },

  // ── 5월 4일 (월) — 오늘 — 예정 3건 (진행중 1 + 확정 2) ──
  { id: "O260504-001", client: "올데이케어", customer: "박지영", phone: "010-4444-5555",
    address: "강남구 청담동", fullAddress: "청담로 100, 청담아파트 201호",
    workType: "세척", appliance: "벽걸이", qty: 1,
    assignedEngineer: "김동효", assignedEngineerId: "E001",
    scheduledDate: "2026-05-04", scheduledTime: "09:05",
    time: "09:05", endTime: "10:30", duration: "1.5h",
    status: "진행중", startedAt: "09:05", completedAt: null,
    estimateTotal: 60000, engineerNet: 40000, // 올데이 직영 벽걸이 40K
  },
  { id: "A260504-002", client: "에어컨프로", customer: "이상훈", phone: "010-5555-6666",
    address: "서초구 반포동", fullAddress: "신반포로 270, 반포자이 103-1502",
    workType: "세척", appliance: "스탠드", qty: 2,
    assignedEngineer: "김동효", assignedEngineerId: "E001",
    scheduledDate: "2026-05-04", scheduledTime: "11:30",
    time: "11:30", endTime: "13:30", duration: "2h",
    status: "확정", startedAt: null, completedAt: null,
    estimateTotal: 220000, engineerNet: 120000, // KA 세척 스탠드 60K×2 (실제)
  },
  { id: "O260504-003", client: "올데이케어", customer: "김미경", phone: "010-6666-7777",
    address: "송파구 잠실동", fullAddress: "잠실대로 100, 잠실파크 1502호",
    workType: "냉매충전", appliance: "시스템 멀티", qty: 1,
    assignedEngineer: "김동효", assignedEngineerId: "E001",
    scheduledDate: "2026-05-04", scheduledTime: "14:00",
    time: "14:00", endTime: "16:30", duration: "2.5h",
    status: "확정", startedAt: null, completedAt: null,
    estimateTotal: 100000, engineerNet: 50000, // 올데이 직영 냉매 50%
  },

  // ── 5월 6일 (수) - 예정 2건 ──
  { id: "O260506-001", client: "올데이케어", customer: "최동석", phone: "010-7777-8888",
    address: "강남구 도곡동", workType: "세척", appliance: "벽걸이", qty: 1,
    assignedEngineer: "김동효", assignedEngineerId: "E001",
    scheduledDate: "2026-05-06", scheduledTime: "10:00",
    time: "10:00", endTime: "11:30", duration: "1.5h",
    status: "확정", estimateTotal: 60000, engineerNet: 40000, // 올데이 벽걸이 40K
  },
  { id: "K-260506-002", client: "쿨가이", customer: "윤서연", phone: "010-8888-9999",
    address: "서초구 양재동", workType: "냉매충전", appliance: "시스템 멀티", qty: 1,
    assignedEngineer: "김동효", assignedEngineerId: "E001",
    scheduledDate: "2026-05-06", scheduledTime: "14:00",
    time: "14:00", endTime: "16:00", duration: "2h",
    status: "확정", estimateTotal: 100000, engineerNet: 50000, // KB 냉매 50% (총 100K)
  },

  // ── 5월 8일 (금) - 예정 2건 ──
  { id: "O260508-001", client: "올데이케어", customer: "강지훈", phone: "010-1010-2020",
    address: "강남구 삼성동", workType: "냉매충전", appliance: "벽걸이", qty: 1,
    assignedEngineer: "김동효", assignedEngineerId: "E001",
    scheduledDate: "2026-05-08", scheduledTime: "10:30",
    time: "10:30", endTime: "12:00", duration: "1.5h",
    status: "확정", estimateTotal: 80000, engineerNet: 40000, // 올데이 직영 냉매 50% (총 80K)
  },
  { id: "A260508-002", client: "에어컨프로", customer: "한미선", phone: "010-5050-6060",
    address: "서초구 방배동", workType: "세척", appliance: "4way", qty: 3,
    assignedEngineer: "김동효", assignedEngineerId: "E001",
    scheduledDate: "2026-05-08", scheduledTime: "14:00",
    time: "14:00", endTime: "17:00", duration: "3h",
    status: "확정", estimateTotal: 390000, engineerNet: 210000, // KA 4way 단가 70K×3
  },
];

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

// V14 Task Utils — 시트 작업DB row → 내부 task object 변환
// AdminApp + EngineerApp + HappycallApp 공유 (재사용 module)

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
  "약속대기": "waiting", "미배정": "waiting", "대기": "waiting",
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
  const schedule  = t.schedule || [reqDate, reqTime].filter(Boolean).join(" ") || "협의";
  const scheduledAt = t.scheduledAt || t.확정일시 || t.confirmedAt || "";
  const summaryItems = v14ParseSummary(summary);
  const workType  = t.workType  || t.work_type || t.작업유형 || (summaryItems[0]?.workType)  || "";
  const appliance = t.appliance || t.기종      || (summaryItems[0]?.appliance) || "";
  const qty       = Number(t.qty || t.totalQty || t.수량 || (summaryItems[0]?.qty) || 1);
  const assignedEngineerName = t.assignedEngineer || t.engineer || t.배정기사 || "";
  const startedAt   = t.startedAt   || t.시작시간 || "";
  const completedAt = t.completedAt || t.완료시간 || "";
  let workItems = Array.isArray(t.workItems) && t.workItems.length > 0 ? t.workItems : null;
  if (!workItems && summaryItems.length > 0) workItems = summaryItems;
  else if (!workItems && workType) workItems = [{ workType, appliance, qty }];

  return {
    id, taskCode: id,
    customer, phone, address, region,
    principal, channel, workType, appliance, qty,
    summary, status,
    state: v14StatusToState(status),
    schedule, memo,
    estimateTotal: estimate,
    requestedDate: reqDate,
    requestedTime: reqTime,
    scheduledAt,
    scheduledDate: scheduledAt ? String(scheduledAt).slice(0, 10) : "",
    scheduledTime: scheduledAt && String(scheduledAt).length > 10 ? String(scheduledAt).slice(11, 16) : "",
    settlementStatus: settlement,
    workItems: workItems || [],
    time: reqTime || (scheduledAt && String(scheduledAt).length > 10 ? String(scheduledAt).slice(11, 16) : "") || reqDate || "협의",
    type: "work",
    assignedEngineer: assignedEngineerName,
    engineer: assignedEngineerName || null,
    startedAt, completedAt,
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
// 시트 Q 배정기사 = 이름 박힘 (예: "류근학")
// user 박은 거 = name 박힘 (예: "류근학") + engineerId 박힘 (예: "E016")
export function filterTasksForEngineerV14(tasks, engineerName, engineerId) {
  if (!engineerName && !engineerId) return [];
  return (tasks || []).filter(t => {
    if (engineerName && (t.assignedEngineer === engineerName || t.engineer === engineerName)) return true;
    if (engineerId && (t.assignedEngineerId === engineerId || t.engineerId === engineerId)) return true;
    return false;
  });
}

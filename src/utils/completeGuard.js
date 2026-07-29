// 2026-07-29 — 완료 파업 가드 (사장님 지시: "기종 선택하고 총액 입력 파업!").
//
// 사고 사례 A-260727-051 (설치 / 서울 강남구 개포동 / 김시율 프로):
//   작업 항목이 "설치 ×1 · 견적 ₩0" 상태로 완료됐다.
//   → 설치 종류(신규설치/이전설치/…)가 안 골라진 채였고,
//   → 작업 금액 0원, 380,000 전액이 '현장 추가금' 으로만 잡혔다.
//
// 왜 기존 가드가 못 잡았나:
//   needsApplianceSelection() 은 기종 검사 대상에서 설치를 일부러 뺐다 (2026-07-24).
//   설치는 appliance_types 에 행이 없어서 (5종이 work_types 로 들어감) 기종 칸이
//   항상 비어 있고, 그대로 검사하면 정상 건까지 전부 오탐하기 때문이었다.
//
// 이 파일의 판정 방식:
//   ① 세척·냉매충전·누설·누수 → 기존 needsApplianceSelection() 을 그대로 재사용.
//      = 기사 화면에 [기종 선택] 배너가 떠 있으면 완료 불가. 보이는 것과 일치.
//   ② 설치 → 기종 칸이 아니라 '종목 이름' 으로 판정.
//      기종을 고르면 sync 트리거가 work_types.name 을 "신규설치" 같은 5종 이름으로
//      바꿔 놓는다. 아직 "설치" 인 채면 = 안 고른 것.
//   ③ 총액 → 0원이면 완료 불가.
//
// 갇힘(deadlock) 방지 — 중요:
//   · 설치 판정은 그 원청에 설치 기종 선택지가 실제로 있을 때만 건다.
//     (설치 정책은 올데이케어에만 있어서 다른 원청은 팝업에서 고를 수가 없다.)
//   · 총액 검사는 기사앱 '완료 버튼' 이 아니라 '완료 확정 화면' 에서만 건다.
//     설치는 현장견적 종목이라 작업금액 0 저장이 정상이고, 기사가 금액을 넣을 수
//     있는 곳은 완료 화면의 '현장 추가금' 뿐이다. 완료 버튼에서 막으면 못 빠져나온다.
//
// 사용처:
//   · EngineerTaskDetailScreen  완료 버튼      → applianceBlockReason()
//   · TaskCompleteScreen        완료 확정 버튼 → amountBlockReason(task, 화면총액)
//   · AdminApp                  상태 변경      → completeBlockReason()
//
// 반환값: 막아야 하면 사람이 읽을 한국어 사유 문자열, 통과면 null.

import { needsApplianceSelection } from "../components/ApplianceSelectModal.jsx";
import { getServiceKind } from "./workTypeKind.js";
import { getAppliancePool, PRINCIPAL_NAME_TO_CODE } from "./receptionForm.js";

// 기종을 고르면 work_types.name 이 이 5개 중 하나로 바뀐다 (Mig 124/125).
const _INSTALL_SUBTYPES = ["신규설치", "이전설치", "철거", "실외기중고교체", "기계중고교체"];

const _CODE_TO_NAME = Object.fromEntries(
  Object.entries(PRINCIPAL_NAME_TO_CODE).map(([name, code]) => [code, name])
);

function _principalName(task) {
  const code = String(task?.principalCode || task?.principal_code || "").trim();
  if (code && _CODE_TO_NAME[code]) return _CODE_TO_NAME[code];
  return String(task?.principal || "").trim();
}

// 가드 자체를 걸지 않는 상태 (방문출장 / 취소 — 정산이 다른 경로).
function _skip(task) {
  return !task || task.status === "visit_only" || task.status === "취소";
}

// ── ① 항목 / 종목 / 기종 ────────────────────────────────────────────────
export function applianceBlockReason(task) {
  if (_skip(task)) return null;

  // 기사 화면 배너와 같은 판정 — 배너가 떠 있으면 완료 못 하게.
  if (needsApplianceSelection(task)) {
    return "기종이 아직 미정입니다.\n\n상세 화면 상단 [기종 선택] 버튼으로 먼저 지정하세요.";
  }

  // 설치 전용 추가 판정.
  const wi = Array.isArray(task.workItems) ? task.workItems : [];
  const first = wi[0] || {};
  const wt = String(first.workType || task.workType || "").trim();
  if (getServiceKind(wt) !== "install") return null;
  if (_INSTALL_SUBTYPES.includes(wt)) return null;      // 5종 중 하나 = 선택 완료

  // 선택지가 없는 원청이면 막지 않는다 (기사가 빠져나갈 방법이 없으므로).
  const pool = getAppliancePool("설치", _principalName(task));
  if (!Array.isArray(pool) || pool.length === 0) return null;

  return "설치 종류가 선택되지 않았습니다.\n\n[기종 선택] 버튼에서 "
       + "신규설치 / 이전설치 / 철거 / 실외기중고교체 / 기계중고교체\n"
       + "중 하나를 고른 뒤 완료하세요.";
}

// ── ② 총액 ──────────────────────────────────────────────────────────────
//   overrideTotal: 완료 화면처럼 아직 저장 전 금액이 화면에 있을 때 그 값을 넘긴다.
export function amountBlockReason(task, overrideTotal) {
  if (_skip(task)) return null;

  let total;
  if (overrideTotal !== undefined && overrideTotal !== null
      && Number.isFinite(Number(overrideTotal))) {
    total = Number(overrideTotal);
  } else {
    const base  = Number(task.estimateTotal ?? task.productPrice ?? 0) || 0;
    const extra = Number(task.extraFee  || 0) || 0;
    const trav  = Number(task.travelFee || 0) || 0;   // 출장비 건은 여기서 살아난다
    total = base + extra + trav;
  }
  if (total > 0) return null;
  return "총액이 0원입니다.\n\n작업 금액 또는 현장 추가금을 입력해야 완료할 수 있습니다.";
}

// ── ③ 둘 다 (관리자용) ──────────────────────────────────────────────────
export function completeBlockReason(task, overrideTotal) {
  return applianceBlockReason(task) || amountBlockReason(task, overrideTotal);
}

export default completeBlockReason;

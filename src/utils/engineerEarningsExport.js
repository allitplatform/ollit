// 2026-07-21 — 기사별 월 수익 엑셀(CSV) 다운로드 (사장님 spec).
//
// 사장님 spec: "기사님별 월을 고르면 출장비 포함 기사 수익 엑셀파일 다운로드" (운영자 PWA).
//   · 위치: PC 매출 리포트 → 👷 기사별 기여 (이 달) 표의 기사 행 ⬇ 버튼.
//   · dataset: getTasksByEngineerInRange (매출 리포트 표와 100% 동일 필터 — 숫자 일치 보장).
//     → track A 완료 + visit_only(출장비) 포함. 새 계산 0 — task 의 engineer_amount/travelFee 그대로.
//   · 파일: CSV (UTF-8 BOM — 한글 엑셀에서 바로 열림). 파일명 기사수익_{기사명}_{YYYY-MM}.csv
//
// ⚠️ CLAUDE.md 금지 어근 자가 검사 통과 의무.

import { toKstYmd } from "./dateLabel.js";
import {
  getTasksByEngineerInRange,
  getMonthRange,
  pickServiceCode,
} from "./revenueStats.js";

const SERVICE_KO = {
  cleaning:    "세척",
  refrigerant: "냉매",
  install:     "설치",
  leak:        "누설",
};

function serviceLabel(task) {
  if (task.status === "visit_only") return "출장(방문만)";
  const code = pickServiceCode(task);
  return SERVICE_KO[code] || "기타";
}

// CSV 필드 escape — 콤마/따옴표/줄바꿈 포함 시 감싸기
function esc(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// 기사 1명 × 1개월 → 작업별 행 (완료일 오름차순)
export function buildEngineerEarningsRows(apiTasks, ym, engineerId, user) {
  const [y, m] = String(ym).split("-").map(Number);
  const { start, end } = getMonthRange(y, m);
  const tasks = getTasksByEngineerInRange(apiTasks, start, end, engineerId, user);
  const rows = tasks.map(t => ({
    date:      toKstYmd(t.completedAt || t.completed_at) || "",
    taskNo:    t.taskNo || t.task_no || "",
    principal: String(t.principal || t.client || t.principalName || "").trim(),
    service:   serviceLabel(t),
    total:     Number(t.totalAmount || 0),
    travelFee: Number(t.travelFee || 0),
    engineer:  Number(t.engineer_amount || 0),
  }));
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows;
}

// CSV 문자열 생성 + 브라우저 다운로드
export function downloadEngineerEarningsCsv({ apiTasks, ym, engineerId, engineerName, user }) {
  const rows = buildEngineerEarningsRows(apiTasks, ym, engineerId, user);

  const header = ["완료일", "작업번호", "원청", "종류", "총액", "출장비", "기사 수익"];
  const lines = [header.join(",")];
  let sumTotal = 0, sumTravel = 0, sumEng = 0;
  for (const r of rows) {
    sumTotal  += r.total;
    sumTravel += r.travelFee;
    sumEng    += r.engineer;
    lines.push([
      esc(r.date), esc(r.taskNo), esc(r.principal), esc(r.service),
      r.total, r.travelFee, r.engineer,
    ].join(","));
  }
  lines.push("");
  lines.push(["합계", `${rows.length}건`, "", "", sumTotal, sumTravel, sumEng].join(","));

  // UTF-8 BOM — 한글 엑셀 인코딩 보장
  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `기사수익_${(engineerName || "기사").replace(/[\\/:*?"<>|]/g, "")}_${ym}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return rows.length;
}

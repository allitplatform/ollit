// 2026-10-06 — 협력사 작업 줄(sub_list_tasks / sub_search_tasks / sub_query_tasks 의 snake_case 행)을
//   화면 글자로 바꾸는 작은 함수들. PC 화면(타임라인·전체 작업)과 홈이 같이 쓴다.

export const SUB_DONE = ["완료", "visit_only", "정산완료"];

// 종목 판정(getCategoryMeta)이 읽는 꼴로
export function catTask(t) {
  return { workItems: Array.isArray(t.work_items) ? t.work_items : [], workType: t.work_type, categoryId: t.category_id };
}

// 작업 항목 요약 — "주방후드(업소용), 세척 1way ×2"
export function workLabel(t) {
  const items = Array.isArray(t.work_items) ? t.work_items : [];
  const names = items
    .map(i => [i.workType, i.appliance && i.appliance !== "(공통)" ? i.appliance : ""].filter(Boolean).join(" ")
      + (Number(i.qty) > 1 ? ` ×${i.qty}` : ""))
    .filter(Boolean);
  return names.join(", ") || t.work_type || "작업";
}

// 고객 동네 — 구·동까지만
export function townOf(t) {
  const tokens = String(t.address || "").trim().split(/\s+/).filter(Boolean);
  let i = tokens.findIndex(x => /(구|군|시)$/.test(x) && !/(특별시|광역시|특별자치시)$/.test(x));
  if (i >= 0 && /시$/.test(tokens[i]) && tokens[i + 1] && /(구|군)$/.test(tokens[i + 1])) i += 1;
  const gu = i >= 0 ? tokens[i] : (t.district || "");
  const dong = i >= 0 && tokens[i + 1] && /(동|읍|면|가|리)$/.test(tokens[i + 1]) ? tokens[i + 1] : "";
  return [gu, dong].filter(Boolean).join(" ");
}

export const kstYmd = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

// 방문일(한국 시간) — 일정일, 없으면 희망일, 그것도 없으면 완료일
export function visitYmd(t) {
  for (const iso of [t.scheduled_at]) {
    if (iso) { const d = new Date(iso); if (!Number.isNaN(d.getTime())) return kstYmd(d); }
  }
  if (t.requested_date) return t.requested_date;
  if (t.completed_at) { const d = new Date(t.completed_at); if (!Number.isNaN(d.getTime())) return kstYmd(d); }
  return t.visit_date || "";
}

// 방문 시각 "HH:MM" (없으면 "")
export function visitHm(t) {
  if (t.scheduled_at) {
    const d = new Date(t.scheduled_at);
    if (!Number.isNaN(d.getTime())) return d.toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
  }
  return t.requested_time ? String(t.requested_time).slice(0, 5) : "";
}

// 화면용 상태 — 담당 기사가 없으면 "미배정"
export function stageOf(t) {
  if (t.status === "취소") return "취소";
  if (SUB_DONE.includes(t.status)) return "완료";
  if (t.status === "진행중") return "진행";
  if (!t.assigned_engineer_id) return "미배정";
  if (t.status === "확정") return "일정확정";
  return "배정";
}

export const STAGE_STYLE = {
  "미배정":   { bg: "rgba(229,72,77,0.14)",  fg: "#E5484D" },
  "배정":     { bg: "rgba(245,158,11,0.16)", fg: "#D97706" },
  "일정확정": { bg: "rgba(59,130,246,0.16)", fg: "#3B82F6" },
  "진행":     { bg: "rgba(255,27,141,0.16)", fg: "#FF1B8D" },
  "완료":     { bg: "rgba(16,185,129,0.16)", fg: "#059669" },
  "취소":     { bg: "var(--bg-secondary)",   fg: "var(--text-secondary)" },
};

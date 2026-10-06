// 2026-10-06 Mig 234 — 새 작업 만들기의 "수행" 선택 (PC·모바일 접수 폼 공용).
//   원청(일을 준 곳)과 수행(일을 하는 곳)은 별개 축이다. 원청 선택은 그대로 두고 수행만 추가한다.
//   · 칩: [직영] + 활성 협력사 (목록에서 읽음, 기본 직영)
//   · 추천: 종목에 맞는 수수료 규칙을 가진 협력사가 1곳이면 "추천" 표시 (선택은 사람이 확정)
//   · 저장: 접수 저장 뒤 handOverToPerformer 로 협력사 넘기기 (운영자 상세의 [협력사로 넘기기] 와 같은 RPC)
import { useEffect, useMemo, useState } from "react";
import {
  useSubcontractorIndex, adminAssignTaskToSubcontractor, listSubcontractorFeeRules, listSubcontractorCategories,
} from "../lib/subcontractorsDb.js";
import { isHoodWork } from "../utils/workTypeKind.js";
import { useServiceCatalog } from "../lib/serviceCatalog.js";
import { fmtWon } from "../utils/money.js";

// 서비스 이름 → 종목(category) code.
//   서비스 목록(service_types → categories, 접수 화면이 쓰는 것과 같은 목록)에서 찾는다.
//   → 새 종목(예: 로봇청소기)의 서비스를 DB 에 추가하면 코드 수정 없이 여기서도 잡힌다.
//   목록을 아직 못 읽었거나 목록에 없는 이름이면 예전 방식(주방후드 이름 판별)으로 대신한다.
//   "공통" 묶음(출장비 등)은 특정 종목이 아니므로 추천하지 않는다.
function serviceGroupOf(workType, catalog) {
  const name = String(workType || "").trim();
  if (!name) return "";
  for (const g of (catalog || [])) {
    if ((g.items || []).some(it => it.name === name)) return g.key === "common" || g.key === "etc" ? "" : g.key;
  }
  return isHoodWork(name) ? "hood" : "";
}
function ruleCovers(rule, group) {
  // 추천은 종목 묶음이 정해진 경우(지금은 주방후드)에만 한다.
  //   service_code 가 비어 있는 규칙은 "모든 서비스" 라 그 종목도 포함한다 (화이트코어 35% 규칙이 이 형태).
  if (!group) return false;
  const code = String(rule.service_code || "");
  return !code || code.startsWith(group);
}
function ruleFor(rules, subId, group) {
  const mine = rules.filter(r => r.subcontractor_id === subId);
  return mine.find(r => ruleCovers(r, group)) || mine.find(r => !r.service_code) || null;
}

// 수행 선택 상태. workType: 대표 종목 이름.
export function usePerformer(workType) {
  const idx = useSubcontractorIndex();
  const subs = useMemo(() => [...idx.names.values()].filter(s => s.active !== false)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "ko")), [idx]);
  const catalog = useServiceCatalog(null);
  const [performer, setPerformer] = useState("");     // "" = 직영, 아니면 협력사 id
  const [rules, setRules] = useState([]);
  const [subCats, setSubCats] = useState(null);       // 협력사별 맡는 종목 (Mig 235). null = 아직 없음/못 읽음

  useEffect(() => {
    let alive = true;
    listSubcontractorFeeRules().then(res => { if (alive && res.ok) setRules(Array.isArray(res.rules) ? res.rules : []); });
    listSubcontractorCategories().then(res => { if (alive && res.ok) setSubCats(Array.isArray(res.by_sub) ? res.by_sub : []); });
    return () => { alive = false; };
  }, []);

  const group = serviceGroupOf(workType, catalog);
  const recommended = useMemo(() => {
    if (!group) return "";
    // 1순위: 협력사가 맡는 종목 (운영자가 협력사 관리에서 설정). 종목 code 는 묶음 이름과 같다 (hood).
    //   그 종목을 맡고, 수수료 규칙도 있는 협력사가 1곳이면 추천.
    const withRule = (id) => rules.some(r => r.subcontractor_id === id && ruleCovers(r, group));
    let ids;
    if (subCats && subCats.length > 0) {
      ids = [...new Set(subCats.filter(x => String(x.code || "") === group).map(x => x.subcontractor_id))].filter(withRule);
    } else {
      // 맡는 종목을 아직 못 읽으면 수수료 규칙만으로 판단
      ids = [...new Set(rules.filter(r => ruleCovers(r, group)).map(r => r.subcontractor_id))];
    }
    ids = ids.filter(id => subs.some(s => s.id === id));
    return ids.length === 1 ? ids[0] : "";
  }, [rules, group, subs, subCats]);

  const rule = performer ? ruleFor(rules, performer, group) : null;
  const name = performer ? (subs.find(s => s.id === performer)?.name || "협력사") : "";
  return { subs, performer, setPerformer, recommended, rule, name };
}

// 칩 줄. colors: { border, text, muted } (폼마다 테마 객체가 달라 색만 받는다)
export function PerformerChips({ state, colors = {} }) {
  const { subs, performer, setPerformer, recommended } = state;
  if (subs.length === 0) return null;
  const border = colors.border || "var(--border)";
  const text = colors.text || "var(--text-primary)";
  const muted = colors.muted || "var(--text-secondary)";
  const chip = (id, label, color) => {
    const active = performer === id;
    return (
      <button key={id || "own"} type="button" onClick={() => setPerformer(id)} style={{
        padding: "8px 14px", borderRadius: 999, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
        background: active ? color : "transparent",
        border: `2px solid ${active ? color : border}`,
        color: active ? "#fff" : text, fontWeight: active ? 800 : 600,
      }}>
        {label}
        {id && id === recommended && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: active ? "#fff" : "#8B5CF6" }}>추천</span>}
      </button>
    );
  };
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {chip("", "직영", "#FF1B8D")}
        {subs.map(s => chip(s.id, s.name, "#8B5CF6"))}
      </div>
      <div style={{ fontSize: 11, color: muted, marginTop: 8, lineHeight: 1.5 }}>
        {performer
          ? "접수와 동시에 이 협력사로 넘어갑니다. 담당 기사는 협력사 관리자가 지정합니다."
          : recommended
            ? "이 종목은 수수료 규칙이 있는 협력사가 있습니다. 협력사가 수행하면 위에서 골라 주세요."
            : "원청(일을 준 곳)과 별개로, 일을 하는 곳을 고릅니다."}
      </div>
    </div>
  );
}

// 협력사 분배 미리보기 문구 (견적 = 부가세 제외 공급가 기준)
export function SubFeePreview({ state, estimate, colors = {} }) {
  const { rule, name } = state;
  const text = colors.text || "var(--text-primary)";
  const muted = colors.muted || "var(--text-secondary)";
  const supply = Math.max(0, Math.round(Number(estimate) || 0));
  if (!rule) {
    return (
      <div style={{ fontSize: 12, color: muted, fontWeight: 600, lineHeight: 1.6 }}>
        {name}에 이 종목의 수수료 규칙이 없습니다. 접수는 되지만 완료 때 수수료가 0으로 계산될 수 있으니 수수료 규칙을 먼저 확인해 주세요.
      </div>
    );
  }
  const isRate = rule.fee_type === "rate";
  const fee = isRate ? Math.round(supply * Number(rule.fee_rate || 0)) : Math.round(Number(rule.fee_amount || 0));
  const pct = isRate ? `${Math.round(Number(rule.fee_rate || 0) * 1000) / 10}%` : "";
  return (
    <div style={{ fontSize: 12, color: text, fontWeight: 600, lineHeight: 1.7 }}>
      협력사 분배: {isRate ? `공급가 × ${pct} 수수료` : `건당 수수료 ${fmtWon(fee)}`}
      {supply > 0 && (
        <>
          <br/>견적 {fmtWon(supply)} 기준 → 올데이케어 수수료 <b>{fmtWon(fee)}</b> · {name} 몫 <b>{fmtWon(supply - fee)}</b>
        </>
      )}
      <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>
        견적은 부가세 제외 금액 기준입니다. 실제 수수료는 완료 때 받은 금액(공급가)으로 계산됩니다.
      </div>
    </div>
  );
}

// 접수 저장 뒤 협력사로 넘기기. 실패해도 접수 자체는 남으므로 결과만 돌려준다.
export async function handOverToPerformer(taskId, performerId) {
  if (!performerId || !taskId) return { ok: true, skipped: true };
  return adminAssignTaskToSubcontractor(taskId, performerId);
}

// 분배 미리보기 오류 문구 — 내부 오류 코드를 그대로 보여 주지 않는다.
export function friendlyFeeError(error) {
  const s = String(error || "");
  if (/policy_not_found/.test(s)) {
    return "이 종목은 직영 단가 규칙이 없습니다 — 협력사 수행을 선택하거나 운영자 단가표에 추가해 주세요.";
  }
  return s;
}

// 작업항목 표의 기종 표시 — 기종이 없는 종목의 "(공통)" 은 "—" 로.
export function applianceLabel(appliance) {
  const a = String(appliance || "").trim();
  return !a || a === "(공통)" ? "—" : a;
}

// Phase 2 — 수수료 정책 목록 화면 (admin / operator)
// 2026-07-21 — 조회 전용 잠금 + 가독성 재설계 (사장님 spec).
//   · 편집 모달 진입 제거: 정책 수정 = 정산 직결 — 지금까지처럼 마이그레이션 SQL로만 (Claude 세션).
//     (옛 편집 모달의 저장은 RPC 미경유 직접 update 경로 — RLS 정책과도 상충. 모달 파일은 미사용 처리.)
//   · 목록 = 원청별 그룹 + 표 형태 (항목 / 방식 / 기사 단가 / 수수료율 / 원청 정액).
//   · 데이터 소스 listCommissionPolicies (DB) 그대로 — 조회만.

import { useState, useEffect, useMemo } from "react";
import {
  listCommissionPolicies,
  PRINCIPAL_LABEL,
  SERVICE_LABEL,
  CALC_METHOD_LABEL,
  CALC_METHOD_DESC,
  QTY_LABEL,
} from "../../lib/commissionPoliciesDb.js";

const PRINCIPAL_OPTIONS = [
  { value: "", label: "전체" },
  { value: "allday",  label: "올데이케어" },
  { value: "KA",      label: "에어컨프로" },
  { value: "KB",      label: "쿨가이" },
  { value: "yongin",  label: "용인컴퍼니" },
  { value: "usol_h",  label: "유솔H" },
  { value: "usol_n",  label: "유솔N" },
  { value: "crikrin", label: "크리크린" },
  { value: "common",  label: "공통" },
];

const SERVICE_OPTIONS = [
  { value: "",            label: "전체" },
  { value: "cleaning",    label: "세척" },
  { value: "refrigerant", label: "냉매충전" },
  { value: "addon",       label: "추가선택" },
  { value: "visit_fee",   label: "출장비" },
];

// 원청 그룹 표시 순서 (필터 옵션 순서 재사용, "전체" 제외)
const GROUP_ORDER = PRINCIPAL_OPTIONS.filter(o => o.value).map(o => o.value);

export function CommissionPolicyScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterPrincipal, setFilterPrincipal] = useState("");
  const [filterService, setFilterService] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    const res = await listCommissionPolicies();
    if (!res.ok) {
      setError(res.error || "조회 실패");
      setRows([]);
    } else {
      setRows(res.data);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (filterPrincipal && r.principal_code !== filterPrincipal) return false;
      if (filterService   && r.service_code   !== filterService)   return false;
      if (q) {
        const hay = [
          r.policy_key, r.principal_code, r.service_code,
          r.appliance_code, r.calc_method, r.qty_condition,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, filterPrincipal, filterService]);

  // 원청별 그룹화 — GROUP_ORDER 순, 목록에 없는 코드는 뒤에.
  const groups = useMemo(() => {
    const byCode = new Map();
    for (const r of filtered) {
      const code = r.principal_code || "?";
      if (!byCode.has(code)) byCode.set(code, []);
      byCode.get(code).push(r);
    }
    const ordered = [];
    for (const code of GROUP_ORDER) {
      if (byCode.has(code)) { ordered.push([code, byCode.get(code)]); byCode.delete(code); }
    }
    for (const [code, list] of byCode) ordered.push([code, list]);
    return ordered;
  }, [filtered]);

  return (
    <div>
      {/* 안내 박스 — 조회 전용 */}
      <div style={infoBoxStyle}>
        🔒 정산 엔진이 실제 사용하는 정책입니다 (<b>조회 전용</b>). 변경이 필요하면 Claude 세션에서 SQL로 정확하게 진행하세요.
      </div>

      {/* 카운터 */}
      <div style={counterStyle}>
        <span style={{ color: "var(--text-primary)" }}>
          정책 <strong style={{ color: "#FF1B8D" }}>{filtered.length}</strong>
        </span>
        <span style={{ color: "var(--text-secondary)", marginLeft: 10 }}>
          · 전체 {rows.length}건
        </span>
      </div>

      {/* 필터 + 검색 */}
      <div style={filterBarStyle}>
        <select
          value={filterPrincipal}
          onChange={(e) => setFilterPrincipal(e.target.value)}
          style={selectStyle}
        >
          {PRINCIPAL_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>원청: {o.label}</option>
          ))}
        </select>
        <select
          value={filterService}
          onChange={(e) => setFilterService(e.target.value)}
          style={selectStyle}
        >
          {SERVICE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>서비스: {o.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="🔍 검색 (기종 · policy_key)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...searchStyle, flex: 1.4 }}
        />
      </div>

      {/* 에러 / 로딩 / 빈 결과 */}
      {error && (
        <div style={{ padding: "0 16px 12px" }}>
          <div style={errorStyle}>{error}</div>
        </div>
      )}
      {loading && <div style={emptyStyle}>로딩중...</div>}
      {!loading && filtered.length === 0 && <div style={emptyStyle}>조회 결과 없음</div>}

      {/* 원청별 그룹 표 */}
      {!loading && groups.map(([code, list]) => (
        <PolicyGroup key={code} code={code} list={list}/>
      ))}
      <div style={{ height: 24 }}/>
    </div>
  );
}

// ──────────────────────────────────────────────
// 원청 한 그룹 — 헤더 + 표
// ──────────────────────────────────────────────
function PolicyGroup({ code, list }) {
  const label = PRINCIPAL_LABEL[code] || code;
  return (
    <div style={{ margin: "0 16px 18px" }}>
      {/* 그룹 헤더 */}
      <div style={{
        display: "flex", alignItems: "baseline", gap: 8,
        padding: "0 2px 8px",
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{label}</span>
        <span className="mono" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{code}</span>
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{list.length}개</span>
      </div>

      {/* 표 */}
      <div style={{
        border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden",
        background: "var(--bg-secondary)",
      }}>
        {/* 표 헤더 */}
        <div style={gridRowStyle(true)}>
          <span>항목</span>
          <span>계산 방식</span>
          <span style={num}>기사 단가</span>
          <span style={num}>수수료율</span>
          <span style={num}>원청 정액</span>
        </div>
        {list.map(row => <PolicyTableRow key={row.id} row={row}/>)}
      </div>
    </div>
  );
}

function PolicyTableRow({ row }) {
  const serviceLabel = SERVICE_LABEL[row.service_code] || row.service_code;
  const calcLabel    = CALC_METHOD_LABEL[row.calc_method] || row.calc_method;
  const calcDesc     = CALC_METHOD_DESC[row.calc_method] || "";
  const qtyLabel     = row.qty_condition ? (QTY_LABEL[row.qty_condition] || row.qty_condition) : "";
  const hasFake      = !!(row.notes && row.notes.includes("fake_base"));

  return (
    <div style={gridRowStyle(false)} title={row.policy_key}>
      {/* 항목: 서비스 · 기종 (수량조건) */}
      <span style={{ minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>
          {serviceLabel}{row.appliance_code ? ` · ${row.appliance_code}` : ""}
        </span>
        {qtyLabel && (
          <span style={{ marginLeft: 6, fontSize: 10.5, color: "#FFB800", fontWeight: 600 }}>({qtyLabel})</span>
        )}
        {hasFake && (
          <span style={{ marginLeft: 6, fontSize: 10, color: "#FF1B8D" }} title="운영자만 볼 수 있는 가격">🔒</span>
        )}
      </span>

      {/* 계산 방식 */}
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span style={{ fontSize: 11.5, color: "#FF1B8D", fontWeight: 700 }}>{calcLabel}</span>
        {calcDesc && (
          <span style={{ marginLeft: 5, fontSize: 10.5, color: "var(--text-secondary)" }}>{calcDesc}</span>
        )}
      </span>

      {/* 숫자 3열 — 없으면 — */}
      <span style={numVal}>{row.engineer_base != null ? row.engineer_base.toLocaleString() : "—"}</span>
      <span style={numVal}>{row.fee_rate != null ? `${(row.fee_rate * 100).toFixed(0)}%` : "—"}</span>
      <span style={numVal}>{row.principal_fee ? Number(row.principal_fee).toLocaleString() : "—"}</span>
    </div>
  );
}

// 표 grid — 헤더/행 공용
function gridRowStyle(isHead) {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(150px, 1.4fr) minmax(170px, 1.6fr) 90px 70px 90px",
    gap: 10, alignItems: "center",
    padding: isHead ? "9px 14px" : "9px 14px",
    borderTop: isHead ? "none" : "1px solid var(--border)",
    background: isHead ? "var(--bg-elevated, var(--bg-tertiary))" : "transparent",
    fontSize: isHead ? 10.5 : 12,
    fontWeight: isHead ? 800 : 500,
    color: isHead ? "var(--text-secondary)" : "var(--text-primary)",
    letterSpacing: isHead ? 0.3 : 0,
  };
}
const num = { textAlign: "right" };
const numVal = {
  textAlign: "right",
  fontSize: 12, fontWeight: 700,
  color: "var(--text-primary)",
  fontVariantNumeric: "tabular-nums",
};

// ============= 스타일 =============
const infoBoxStyle = {
  margin: "12px 16px",
  padding: "10px 14px",
  background: "rgba(255, 27, 141, 0.06)",
  border: "1px solid rgba(255, 27, 141, 0.20)",
  borderRadius: 10,
  color: "var(--text-secondary)",
  fontSize: 12,
  lineHeight: 1.5,
};
const counterStyle = {
  padding: "14px 16px 8px",
  fontSize: 12,
};
const filterBarStyle = {
  display: "flex", gap: 8,
  padding: "0 16px 12px",
  flexWrap: "wrap",
};
const selectStyle = {
  flex: 1,
  minWidth: 140,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};
const searchStyle = {
  minWidth: 180,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "10px 14px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
const emptyStyle = {
  textAlign: "center",
  padding: 40,
  color: "var(--text-secondary)",
  fontSize: 13,
};
const errorStyle = {
  padding: "10px 14px",
  background: "rgba(255, 59, 92, 0.10)",
  border: "1px solid rgba(255, 59, 92, 0.30)",
  borderRadius: 10,
  color: "#FF3B5C",
  fontSize: 13,
};

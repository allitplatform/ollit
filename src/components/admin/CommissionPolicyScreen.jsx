// Phase 2 — 수수료 정책 목록 화면 (admin / operator 박은 영역)
// 디자인 — 원청관리 (PrincipalListScreen) 스타일 통일 (CSS 변수)
// db/migrations/009_commission_policies_v6.sql 박은 영역 박은 영역 78 row

import { useState, useEffect, useMemo } from "react";
import {
  listCommissionPolicies,
  PRINCIPAL_LABEL,
  SERVICE_LABEL,
  CALC_METHOD_DESC,
} from "../../lib/commissionPoliciesDb.js";
import { CommissionPolicyEditModal } from "./CommissionPolicyEditModal.jsx";

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

export function CommissionPolicyScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterPrincipal, setFilterPrincipal] = useState("");
  const [filterService, setFilterService] = useState("");
  const [editing, setEditing] = useState(null);

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

  const handleEditDone = (updated) => {
    setEditing(null);
    if (updated) {
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r));
    }
  };

  return (
    <div>
      {/* 카운터 */}
      <div style={counterStyle}>
        <span style={{ color: "var(--text-primary)" }}>
          정책 <strong style={{ color: "#FF1B8D" }}>{filtered.length}</strong>
        </span>
        <span style={{ color: "var(--text-secondary)", marginLeft: 10 }}>
          · 전체 {rows.length}건
        </span>
      </div>

      {/* 필터 */}
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
      </div>

      {/* 검색 */}
      <div style={{ padding: "0 16px 12px" }}>
        <input
          type="text"
          placeholder="🔍 policy_key / 기종 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchStyle}
        />
      </div>

      {/* 에러 */}
      {error && (
        <div style={{ padding: "0 16px 12px" }}>
          <div style={errorStyle}>{error}</div>
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div style={emptyStyle}>로딩중...</div>
      )}

      {/* 목록 */}
      {!loading && filtered.length === 0 && (
        <div style={emptyStyle}>조회 결과 없음</div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ padding: "0 16px 24px" }}>
          {filtered.map(row => (
            <PolicyRow key={row.id} row={row} onClick={() => setEditing(row)} />
          ))}
        </div>
      )}

      {/* 수정 모달 */}
      {editing && (
        <CommissionPolicyEditModal
          policy={editing}
          onClose={() => setEditing(null)}
          onSaved={handleEditDone}
        />
      )}
    </div>
  );
}

function PolicyRow({ row, onClick }) {
  const principalLabel = PRINCIPAL_LABEL[row.principal_code] || row.principal_code;
  const serviceLabel   = SERVICE_LABEL[row.service_code]     || row.service_code;
  const hasFake = !!(row.notes && row.notes.includes("fake_base"));

  return (
    <button type="button" onClick={onClick} style={rowStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 4, fontFamily: "monospace" }}>
            {row.policy_key}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>
            {principalLabel} · {serviceLabel}
            {row.appliance_code && ` · ${row.appliance_code}`}
            {row.qty_condition && (
              <span style={{ marginLeft: 6, fontSize: 11, color: "#FFB800", fontWeight: 500 }}>
                ({row.qty_condition})
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            <span style={{ color: "#FF1B8D", fontWeight: 600 }}>{row.calc_method}</span>
            <span style={{ marginLeft: 6 }}>· {CALC_METHOD_DESC[row.calc_method] || ""}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          {row.engineer_base != null && (
            <div>기사 {row.engineer_base.toLocaleString()}원</div>
          )}
          {row.fee_rate != null && (
            <div>비율 {(row.fee_rate * 100).toFixed(0)}%</div>
          )}
          {row.principal_fee && (
            <div>원청 {Number(row.principal_fee).toLocaleString()}원</div>
          )}
          {hasFake && (
            <div style={{ color: "#FF1B8D", fontSize: 10, marginTop: 2 }}>🔒 가짜단가</div>
          )}
        </div>
      </div>
    </button>
  );
}

// ============= 스타일 =============
const counterStyle = {
  padding: "14px 16px 8px",
  fontSize: 12,
};
const filterBarStyle = {
  display: "flex", gap: 8,
  padding: "0 16px 12px",
};
const selectStyle = {
  flex: 1,
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
  width: "100%",
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
const rowStyle = {
  width: "100%",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "12px 14px",
  marginBottom: 8,
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
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

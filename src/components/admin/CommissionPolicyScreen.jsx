// Phase 2 — 수수료 정책 목록 화면 (admin / operator 박은 영역)
// RLS — admin/operator 박은 영역 박을 영역 (가짜단가 JSON 박은 영역 박은 영역 박은 영역 박은 영역 박은 영역 박은 영역)
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

export function CommissionPolicyScreen({ onBack }) {
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
    <div style={{ padding: 16, minHeight: "100vh", background: "#0A0A0A", color: "#FFF" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        {onBack && (
          <button onClick={onBack} style={btnGhost}>← 뒤로</button>
        )}
        <div style={{ fontSize: 20, fontWeight: 700 }}>수수료 정책</div>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#888" }}>
          {filtered.length} / {rows.length} 정책
        </div>
      </div>

      {/* 필터 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
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
          placeholder="policy_key / 기종 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
      </div>

      {/* 에러 */}
      {error && (
        <div style={{
          marginBottom: 12, padding: 12,
          background: "rgba(255, 59, 92, 0.10)",
          border: "1px solid rgba(255, 59, 92, 0.30)",
          borderRadius: 8, color: "#FF3B5C", fontSize: 13,
        }}>{error}</div>
      )}

      {/* 로딩 */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#888" }}>로딩중...</div>
      )}

      {/* 목록 */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
          조회 결과 없음
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
    <button onClick={onClick} style={rowStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 2, fontFamily: "monospace" }}>
            {row.policy_key}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
            {principalLabel} · {serviceLabel}
            {row.appliance_code && ` · ${row.appliance_code}`}
            {row.qty_condition && (
              <span style={{ marginLeft: 6, fontSize: 12, color: "#FFB800" }}>
                ({row.qty_condition})
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#aaa" }}>
            {row.calc_method} · {CALC_METHOD_DESC[row.calc_method] || ""}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#ccc", whiteSpace: "nowrap" }}>
          {row.engineer_base != null && <div>기사 {row.engineer_base.toLocaleString()}원</div>}
          {row.fee_rate != null && <div>비율 {(row.fee_rate * 100).toFixed(0)}%</div>}
          {row.principal_fee && <div>원청 {Number(row.principal_fee).toLocaleString()}원</div>}
          {hasFake && <div style={{ color: "#FF1B8D", fontSize: 11 }}>🔒 가짜단가</div>}
        </div>
      </div>
    </button>
  );
}

// ============= 스타일 =============
const btnGhost = {
  background: "transparent",
  border: "1px solid #2A2A2A",
  color: "#FFF",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};
const selectStyle = {
  background: "#1C1C1E",
  border: "1px solid #2A2A2A",
  color: "#FFF",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "inherit",
};
const inputStyle = {
  background: "#1C1C1E",
  border: "1px solid #2A2A2A",
  color: "#FFF",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};
const rowStyle = {
  width: "100%",
  background: "#1C1C1E",
  border: "1px solid #2A2A2A",
  borderRadius: 10,
  padding: "12px 14px",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  color: "#FFF",
};

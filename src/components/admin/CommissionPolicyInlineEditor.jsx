// Phase B-1 — 원청 편집 측 수수료 정책 인라인 편집
// Phase B-2 — KA/KB 가짜단가 편집 추가
// PrincipalEditScreen 측 박은 영역
// 박은 영역: 작업 유형 탭 / 정책 카드 / 인라인 수정 / 변경 추적 / 가짜단가 (KA/KB)
// 박지 X: 새 원청 추가 (Phase B-3)

import { useState, useEffect, useMemo, useRef } from "react";
import {
  listCommissionPolicies,
  getPrincipalCode,
  CALC_METHOD_LABEL,
  CALC_METHOD_DESC,
  QTY_LABEL,
  SERVICE_LABEL,
} from "../../lib/commissionPoliciesDb.js";
import { FakeBaseEditor } from "./FakeBaseEditor.jsx";

const SERVICE_TABS = [
  { key: "cleaning",    label: "🧽 세척" },
  { key: "refrigerant", label: "❄️ 냉매충전" },
  { key: "addon",       label: "✨ 추가 옵션" },
  { key: "visit_fee",   label: "🚗 출장비" },
];

// 박은 영역: principalId (옛 system id — aircon_pro / cool_son 등)
//          onModifiedChange({ policies, fakeBase }) — 부모 측 박은 영역 박음
//            policies = { [policyId]: { engineer_base?, fee_rate?, principal_fee? } }  (Phase B-1)
//            fakeBase = { cleaningPolicyIds, notes } | null                            (Phase B-2)
export function CommissionPolicyInlineEditor({ principalId, onModifiedChange }) {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeService, setActiveService] = useState("cleaning");
  // modifiedMap = { [policyId]: { engineer_base?, fee_rate?, principal_fee? } }
  const [modifiedMap, setModifiedMap] = useState({});
  // Phase B-2 — 가짜단가 변경 (KA/KB 한정)
  const [modifiedFakeBase, setModifiedFakeBase] = useState(null);
  // 박은 영역 박은 영역 박은 영역 박은 영역 — 부모 박은 영역 호출 박은 영역 stale closure 박을 영역
  const onModifiedChangeRef = useRef(onModifiedChange);
  onModifiedChangeRef.current = onModifiedChange;

  const principalCode = useMemo(() => getPrincipalCode(principalId), [principalId]);

  useEffect(() => {
    if (!principalCode) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    listCommissionPolicies({ principalCode }).then(res => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error || "정책 조회 박지 X");
        setPolicies([]);
      } else {
        setPolicies(res.data || []);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [principalCode]);

  // 변경 박은 영역 → 부모 알림 (정책 + 가짜단가 통합)
  useEffect(() => {
    if (onModifiedChangeRef.current) {
      onModifiedChangeRef.current({
        policies: modifiedMap,
        fakeBase: modifiedFakeBase,
      });
    }
  }, [modifiedMap, modifiedFakeBase]);

  // 박힌 영역 박은 영역 박은 영역 박을 영역 (변경 박은 영역 박은 영역)
  const displayedPolicies = useMemo(() => {
    return policies.map(p => {
      const mod = modifiedMap[p.id];
      return mod ? { ...p, ...mod } : p;
    });
  }, [policies, modifiedMap]);

  // 작업 유형별 필터
  const filtered = useMemo(() => {
    return displayedPolicies.filter(p => p.service_code === activeService);
  }, [displayedPolicies, activeService]);

  // 작업 유형별 카운트
  const counts = useMemo(() => {
    const c = {};
    for (const p of policies) {
      c[p.service_code] = (c[p.service_code] || 0) + 1;
    }
    return c;
  }, [policies]);

  // 변경 박은 영역 박을 영역 — 정책별 patch 박음
  const handlePolicyChange = (policyId, originalPolicy, field, newValue) => {
    setModifiedMap(prev => {
      const next = { ...prev };
      const cur = { ...(next[policyId] || {}) };
      cur[field] = newValue;

      // 원본 박은 영역 박은 영역 박은 영역 → patch 박지 X (revert)
      const origValue = originalPolicy[field];
      const isSame = (cur[field] === origValue) ||
                     (cur[field] != null && origValue != null && Number(cur[field]) === Number(origValue));
      if (isSame) {
        delete cur[field];
      }

      if (Object.keys(cur).length === 0) {
        delete next[policyId];
      } else {
        next[policyId] = cur;
      }
      return next;
    });
  };

  if (loading) {
    return <div style={emptyStyle}>로딩중...</div>;
  }
  if (error) {
    return <div style={errorStyle}>{error}</div>;
  }
  if (policies.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          박힌 영역 박은 영역 박지 X
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
          (principal_code: {principalCode || "—"})
        </div>
      </div>
    );
  }

  const modifiedCount = Object.keys(modifiedMap).length;
  const fakeBaseChanged = !!modifiedFakeBase;

  return (
    <div>
      {/* 작업 유형 탭 */}
      <div style={tabBarStyle}>
        {SERVICE_TABS.map(tab => {
          const cnt = counts[tab.key] || 0;
          const active = activeService === tab.key;
          if (cnt === 0) return null;  // 0건 박은 영역 박은 영역 박지 X
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveService(tab.key)}
              style={{
                background: "transparent",
                border: "none",
                color: active ? "#FF1B8D" : "var(--text-secondary)",
                borderBottom: active ? "2px solid #FF1B8D" : "2px solid transparent",
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label} <span style={{ fontSize: 11, opacity: 0.7 }}>({cnt})</span>
            </button>
          );
        })}
      </div>

      {/* Phase B-2 — KA / KB 가짜단가 편집 (다른 원청은 null) */}
      <FakeBaseEditor
        principalId={principalId}
        onModifiedChange={setModifiedFakeBase}
      />

      {/* 변경 카운터 — sticky 강조 박은 영역 */}
      {(modifiedCount > 0 || fakeBaseChanged) && (
        <div style={modifiedNoticeStyle}>
          <span style={{ fontSize: 18 }}>📝</span>
          <span>
            {modifiedCount > 0 && (
              <>변경된 정책 <strong style={{ color: "#FF1B8D", fontSize: 16 }}>{modifiedCount}</strong>건</>
            )}
            {modifiedCount > 0 && fakeBaseChanged && <> · </>}
            {fakeBaseChanged && (
              <><strong style={{ color: "#FF1B8D" }}>가짜단가 수정됨</strong></>
            )}
            {" "}— <strong style={{ color: "#FF1B8D" }}>저장 버튼</strong> 박은 영역 박을 영역
          </span>
        </div>
      )}

      {/* 정책 카드 박은 영역 */}
      <div style={{ paddingTop: 8 }}>
        {filtered.map(policy => {
          const original = policies.find(p => p.id === policy.id);
          const isModified = !!modifiedMap[policy.id];
          return (
            <PolicyEditCard
              key={policy.id}
              policy={policy}
              original={original}
              isModified={isModified}
              onChange={(field, value) => handlePolicyChange(policy.id, original, field, value)}
            />
          );
        })}
        {filtered.length === 0 && (
          <div style={emptyStyle}>
            이 작업 유형 박은 영역 박은 영역 박지 X
          </div>
        )}
      </div>
    </div>
  );
}

// =========== PolicyEditCard ===========
function PolicyEditCard({ policy, original, isModified, onChange }) {
  const calcLabel = CALC_METHOD_LABEL[policy.calc_method] || policy.calc_method;
  const calcDesc  = CALC_METHOD_DESC[policy.calc_method] || "";
  const qtyLabel  = policy.qty_condition ? (QTY_LABEL[policy.qty_condition] || policy.qty_condition) : "";
  const hasFake = !!(policy.notes && policy.notes.includes("fake_base"));

  return (
    <div style={{
      ...cardStyle,
      border: isModified ? "2px solid #FF1B8D" : "1px solid var(--border)",
      background: isModified ? "rgba(255, 27, 141, 0.06)" : "var(--bg-secondary)",
      padding: isModified ? "11px 13px" : "12px 14px",  // border 박은 영역 박은 영역 박은 영역
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span>{policy.appliance_code || "(전체)"}</span>
            {qtyLabel && (
              <span style={{ fontSize: 11, color: "#FFB800", fontWeight: 500 }}>
                ({qtyLabel})
              </span>
            )}
            {isModified && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "#FF1B8D", color: "#FFF",
                fontSize: 10, fontWeight: 700,
                padding: "2px 8px", borderRadius: 10,
                letterSpacing: 0.3,
              }}>
                ● 수정됨
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
            <span style={{ color: "#FF1B8D", fontWeight: 600 }}>{calcLabel}</span>
            {calcDesc && <span style={{ marginLeft: 4 }}>· {calcDesc}</span>}
          </div>
        </div>
        {hasFake && (
          <div
            style={{ fontSize: 10, color: "#FF1B8D", whiteSpace: "nowrap" }}
            title="가짜단가 박혀있음 (Phase B-2 측 박을 영역)"
          >
            🔒 가짜단가
          </div>
        )}
      </div>

      {/* 수정 가능 필드 박은 영역 */}
      {original.engineer_base != null && (
        <FieldRow label="기사 단가">
          <NumberInput
            value={policy.engineer_base ?? ""}
            onChange={(v) => onChange("engineer_base", v)}
            suffix="원"
            step={1000}
          />
        </FieldRow>
      )}

      {original.fee_rate != null && (
        <FieldRow label="수수료율">
          <PercentInput
            value={policy.fee_rate ?? 0}
            onChange={(v) => onChange("fee_rate", v)}
          />
        </FieldRow>
      )}

      {original.principal_fee && (
        <FieldRow label="원청 정액">
          <NumberInput
            value={parseInt(policy.principal_fee, 10) || 0}
            onChange={(v) => onChange("principal_fee", String(v))}
            suffix="원"
            step={1000}
          />
        </FieldRow>
      )}

      {/* 수정 박지 X 박은 영역 박은 영역 박은 영역 박은 영역 박은 영역 박은 영역 박을 영역 */}
      {original.engineer_base == null && original.fee_rate == null && !original.principal_fee && (
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", padding: "8px 0", fontStyle: "italic" }}>
          수정 박을 영역 박은 영역 박지 X (계산방식 자체 박은 영역)
        </div>
      )}
    </div>
  );
}

// =========== FieldRow / NumberInput / PercentInput ===========
function FieldRow({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", width: 70, flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, suffix, step = 1 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        step={step}
        style={inputStyle}
      />
      {suffix && (
        <span style={{ fontSize: 11, color: "var(--text-secondary)", flexShrink: 0 }}>{suffix}</span>
      )}
    </div>
  );
}

function PercentInput({ value, onChange }) {
  // value = 0~1 (DB 박은 영역) / 화면 박은 영역 = 0~100
  const percent = Number(value) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        type="number"
        value={Number.isFinite(percent) ? percent.toFixed(0) : 0}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          const next = Number.isFinite(n) ? n / 100 : 0;
          if (next < 0 || next > 1) return;
          onChange(next);
        }}
        step={1}
        min={0}
        max={100}
        style={inputStyle}
      />
      <span style={{ fontSize: 11, color: "var(--text-secondary)", flexShrink: 0 }}>%</span>
    </div>
  );
}

// =========== 스타일 ===========
const tabBarStyle = {
  display: "flex",
  borderBottom: "1px solid var(--border)",
  marginBottom: 8,
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
};
const modifiedNoticeStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 14px",
  background: "rgba(255, 27, 141, 0.12)",
  border: "2px solid #FF1B8D",
  borderRadius: 10,
  color: "var(--text-primary)",
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 12,
  marginTop: 8,
  position: "sticky",
  top: 0,
  zIndex: 5,
  backdropFilter: "blur(4px)",
};
const cardStyle = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "12px 14px",
  marginBottom: 8,
};
const inputStyle = {
  width: "100%",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
const emptyStyle = {
  textAlign: "center",
  padding: 24,
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

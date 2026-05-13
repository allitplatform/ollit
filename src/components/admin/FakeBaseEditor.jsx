// Phase B-2 — KA / KB 가짜단가 편집
// 위치: PrincipalEditScreen 측 CommissionPolicyInlineEditor 하단
// 노출 조건: principalCode === "KA" || "KB"
// 저장 방식: KA/KB 세척 정책 6 row 모두 동일한 notes JSON 박기
//           ({ ...기존notes, fake_base: { ... } })

import { useState, useEffect, useMemo, useRef } from "react";
import {
  listCommissionPolicies,
  getPrincipalCode,
} from "../../lib/commissionPoliciesDb.js";

const APPLIANCES = [
  { key: "벽걸이", label: "벽걸이", realBase: 40000 },
  { key: "1way",   label: "1way",   realBase: 50000 },
  { key: "스탠드", label: "스탠드", realBase: 60000 },
  { key: "4way",   label: "4way",   realBase: 70000 },
  { key: "원형",   label: "원형",   realBase: 80000 },
  { key: "투인원", label: "투인원", realBase: 100000 },
];

// 박은 영역: principalId (옛 system id — aircon_pro / cool_son 등)
//          onModifiedChange({ cleaningPolicyIds, notes } | null)
export function FakeBaseEditor({ principalId, onModifiedChange }) {
  const principalCode = useMemo(() => getPrincipalCode(principalId), [principalId]);
  const isTarget = principalCode === "KA" || principalCode === "KB";

  const [fakeBase, setFakeBase] = useState({});
  const [originalFakeBase, setOriginalFakeBase] = useState({});
  const [baseNotesObj, setBaseNotesObj] = useState({}); // notes JSON 中 fake_base 외 키 보존용
  const [cleaningPolicyIds, setCleaningPolicyIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 부모 콜백 stale closure 방지
  const onModifiedChangeRef = useRef(onModifiedChange);
  onModifiedChangeRef.current = onModifiedChange;

  useEffect(() => {
    if (!isTarget) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setFakeBase({});
    setOriginalFakeBase({});
    setBaseNotesObj({});
    setCleaningPolicyIds([]);

    listCommissionPolicies({ principalCode, serviceCode: "cleaning" })
      .then(res => {
        if (cancelled) return;
        // Phase B-2 debug — 버그 2 진단용
        console.log("[FakeBase load] principalCode:", principalCode, "result:", res);
        console.log("[FakeBase load] first.notes:", res.data?.[0]?.notes);
        if (!res.ok) {
          setError(res.error || "가짜단가 로딩 실패");
          setLoading(false);
          return;
        }
        const policies = res.data || [];
        setCleaningPolicyIds(policies.map(p => p.id));

        // 첫 번째 정책의 notes 측 fake_base 추출
        const first = policies[0];
        if (first?.notes) {
          try {
            const parsed = JSON.parse(first.notes);
            const fb = parsed?.fake_base || {};
            console.log("[FakeBase load] parsed fake_base:", fb);
            setFakeBase(fb);
            setOriginalFakeBase(fb);
            setBaseNotesObj(parsed || {});
          } catch (e) {
            console.warn("[FakeBase] notes JSON 파싱 실패 — 빈 값으로 시작", e);
            setBaseNotesObj({});
          }
        }
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err?.message || "로딩 오류");
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [principalCode, isTarget]);

  // 변경 여부
  const hasChanges = useMemo(() => {
    return APPLIANCES.some(app =>
      (Number(fakeBase[app.key]) || 0) !== (Number(originalFakeBase[app.key]) || 0)
    );
  }, [fakeBase, originalFakeBase]);

  // 변경 시 부모 알림
  useEffect(() => {
    if (!isTarget) return;
    if (!onModifiedChangeRef.current) return;

    if (hasChanges && cleaningPolicyIds.length > 0) {
      const mergedNotes = { ...baseNotesObj, fake_base: fakeBase };
      onModifiedChangeRef.current({
        cleaningPolicyIds,
        notes: JSON.stringify(mergedNotes),
      });
    } else {
      onModifiedChangeRef.current(null);
    }
  }, [hasChanges, fakeBase, baseNotesObj, cleaningPolicyIds, isTarget]);

  function handleChange(applianceKey, raw) {
    const n = parseInt(raw, 10);
    const v = Number.isFinite(n) ? n : 0;
    setFakeBase(prev => ({ ...prev, [applianceKey]: v }));
  }

  if (!isTarget) return null;
  if (loading) {
    return <div style={{ padding: 16, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>로딩 중...</div>;
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: 16 }}>🔒</span>
        <span>가짜단가 ({principalCode})</span>
        {hasChanges && (
          <span style={modifiedBadgeStyle}>● 수정됨</span>
        )}
      </div>

      <div style={hintStyle}>
        운영자만 볼 수 있는 가격입니다. 원청 수수료 계산에 사용됩니다.
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>기종</th>
            <th style={{ ...thStyle, textAlign: "right" }}>실제 단가</th>
            <th style={{ ...thStyle, textAlign: "right" }}>가짜 단가</th>
            <th style={{ ...thStyle, textAlign: "right" }}>차이</th>
          </tr>
        </thead>
        <tbody>
          {APPLIANCES.map(app => {
            const fakeValue = Number(fakeBase[app.key]) || 0;
            const diff = fakeValue - app.realBase;
            const diffColor = diff > 0 ? "#10B981" : diff < 0 ? "#FF3B5C" : "var(--text-secondary)";
            return (
              <tr key={app.key}>
                <td style={tdStyle}>{app.label}</td>
                <td style={tdNumStyle}>{app.realBase.toLocaleString()}원</td>
                <td style={tdInputStyle}>
                  <input
                    type="number"
                    value={fakeValue || ""}
                    onChange={(e) => handleChange(app.key, e.target.value)}
                    step={1000}
                    style={inputStyle}
                  />
                </td>
                <td style={{ ...tdNumStyle, color: diffColor }}>
                  {diff > 0 ? "+" : ""}{diff.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {error && (
        <div style={errorStyle}>{error}</div>
      )}
    </div>
  );
}

// ===== 스타일 =====
const containerStyle = {
  marginTop: 16,
  padding: 16,
  background: "rgba(255, 27, 141, 0.04)",
  border: "1px solid rgba(255, 27, 141, 0.20)",
  borderRadius: 12,
};
const headerStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text-primary)",
  marginBottom: 6,
};
const modifiedBadgeStyle = {
  marginLeft: "auto",
  background: "#FF1B8D",
  color: "#FFF",
  fontSize: 10,
  fontWeight: 700,
  padding: "2px 8px",
  borderRadius: 10,
  letterSpacing: 0.3,
};
const hintStyle = {
  fontSize: 11,
  color: "var(--text-secondary)",
  marginBottom: 12,
  lineHeight: 1.5,
};
const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};
const thStyle = {
  padding: "8px 6px",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-secondary)",
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
};
const tdStyle = {
  padding: "10px 6px",
  fontSize: 13,
  color: "var(--text-primary)",
  borderBottom: "1px solid var(--border)",
};
const tdNumStyle = {
  ...tdStyle,
  textAlign: "right",
  fontFamily: "monospace",
};
const tdInputStyle = {
  ...tdStyle,
  padding: "6px",
};
const inputStyle = {
  width: "100%",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  color: "var(--text-primary)",
  fontFamily: "monospace",
  textAlign: "right",
  outline: "none",
  boxSizing: "border-box",
};
const errorStyle = {
  marginTop: 12,
  padding: "8px 12px",
  background: "rgba(255, 59, 92, 0.10)",
  border: "1px solid rgba(255, 59, 92, 0.30)",
  borderRadius: 8,
  color: "#FF3B5C",
  fontSize: 12,
};

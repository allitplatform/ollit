// Step 7 풀버전 — 원청 편집 (Phase B-1 — 수수료 정책 인라인 편집 박음)
// Step 5-3 — 시트 설정_원청 양방향 sync (savePrincipalWithSync / deletePrincipalWithSync)
import { useState, useCallback } from "react";
import {
  loadPrincipals, generatePrincipalId, autoPrefix,
  savePrincipalWithSync, deletePrincipalWithSync,
  PRINCIPAL_COLORS, STATUS_OPTIONS, VAT_OPTIONS,
} from "../data/principals.js";
import { CommissionPolicyInlineEditor } from "./admin/CommissionPolicyInlineEditor.jsx";
import { updateCommissionPolicy } from "../lib/commissionPoliciesDb.js";

export function PrincipalEditScreen({ principal, isNew, onSaved, onBack, onGoCommissionPolicy }) {
  const [data, setData] = useState(() => deepClone(principal));
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);  // Step 5-3 — { type: success|warn, message }
  const [busy, setBusy]   = useState(false);
  // Phase B-1 — 정책 변경 추적 ({ [policyId]: { engineer_base?, fee_rate?, principal_fee? } })
  const [modifiedPolicies, setModifiedPolicies] = useState({});
  const handlePolicyModified = useCallback((map) => {
    setModifiedPolicies(map || {});
  }, []);

  function updateName(name) {
    setData(d => ({ ...d, name, prefix: d.prefix || autoPrefix(name) }));
  }
  function updateField(field, value) {
    setData(d => ({ ...d, [field]: value }));
  }
  function updateContact(field, value) {
    setData(d => ({ ...d, contact: { ...d.contact, [field]: value } }));
  }

  async function handleSave() {
    setError("");
    setToast(null);
    const name = (data.name || "").trim();
    if (!name) { setError("이름을 입력해주세요"); return; }
    const list = loadPrincipals();
    let saved = { ...data, name, nickname: (data.nickname || "").trim() };
    if (isNew) {
      if (!saved.id) saved.id = generatePrincipalId(name);
      if (saved.prefix && list.some(p => p.prefix === saved.prefix && p.id !== saved.id)) {
        const ok = window.confirm(`"${saved.prefix}" prefix가 다른 원청에 이미 사용 중입니다.\n그래도 저장하시겠어요?`);
        if (!ok) return;
      }
    }
    setBusy(true);
    const res = await savePrincipalWithSync(saved);

    // Phase B-1 — 정책 변경 박혀있으면 Supabase 측 박음 (병행)
    const policyIds = Object.keys(modifiedPolicies);
    let policyFails = 0;
    if (policyIds.length > 0) {
      for (const pid of policyIds) {
        const patch = modifiedPolicies[pid];
        const r = await updateCommissionPolicy(pid, patch);
        if (!r.ok) policyFails += 1;
      }
    }

    setBusy(false);
    if (res.ok) {
      let msg = "원청 저장 완료";
      if (policyIds.length > 0) {
        if (policyFails === 0) {
          msg += ` · 정책 ${policyIds.length}건 박음`;
          setModifiedPolicies({});
        } else {
          msg += ` · 정책 ${policyIds.length - policyFails}/${policyIds.length}건 박음`;
        }
      }
      setToast({ type: policyFails > 0 ? "warn" : "success", message: msg });
      if (res.principalId && res.principalId !== saved.id) {
        saved = { ...saved, id: res.principalId };
      }
      setTimeout(() => onSaved && onSaved(saved), 600);
    } else {
      setToast({
        type: "warn",
        message: `로컬 저장 완료 / 시트 sync 실패: ${res.error || "알 수 없는 오류"} (저장 다시 누르면 재시도)`,
      });
    }
  }

  async function handleDelete() {
    if (isNew) return;
    const ok = window.confirm(`"${data.name}" 원청을 삭제할까요?\n\n정산 이력이 남아 있을 수 있습니다. 복구 불가합니다.`);
    if (!ok) return;
    setError("");
    setToast(null);
    setBusy(true);
    const res = await deletePrincipalWithSync(data.id);
    setBusy(false);
    if (res.ok) {
      setToast({ type: "success", message: "원청 삭제 완료" });
      setTimeout(() => onSaved && onSaved(null), 600);
    } else {
      setToast({
        type: "warn",
        message: `로컬 삭제 완료 / 시트 sync 실패: ${res.error || "알 수 없는 오류"}`,
      });
    }
  }

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif", paddingBottom: 80 }}>

      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>{isNew ? "원청 추가" : `${data.name || "—"} 편집`}</div>
        {!isNew && <button onClick={handleDelete} style={dangerBtnStyle}>삭제</button>}
      </div>

      <div style={{ padding: "16px" }}>

        <Section label="기본 정보">
          <Field label="이름">
            <Input value={data.name} onChange={updateName} placeholder="예: 올데이케어"/>
          </Field>
          <Field label="별명 (선택)">
            <Input value={data.nickname} onChange={(v) => updateField("nickname", v)} placeholder="예: 자체영업"/>
          </Field>
          <Field label="색깔">
            <ColorPicker value={data.color} onChange={(c) => updateField("color", c)}/>
          </Field>
          <Field label="작업번호 Prefix">
            <Input value={data.prefix} onChange={(v) => updateField("prefix", v)} placeholder="예: A-" mono/>
          </Field>
          <Field label="상태">
            <RadioRow
              options={Object.entries(STATUS_OPTIONS).map(([k, v]) => ({ key: k, label: v.name, color: v.color }))}
              value={data.status}
              onChange={(v) => updateField("status", v)}
            />
          </Field>
          <Field label="부가세 정책">
            <RadioRow
              options={Object.entries(VAT_OPTIONS).map(([k, v]) => ({ key: k, label: `${v.name} (${v.desc})` }))}
              value={data.vatPolicy || "included"}
              onChange={(v) => updateField("vatPolicy", v)}
            />
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.5 }}>
              별도 = 부가세 10% 가산 (예: 40,000 → 44,000)
            </div>
          </Field>
        </Section>

        <Section label="💰 수수료 정책">
          {isNew ? (
            <div style={{
              padding: 20,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>💡</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
                새 원청 박은 영역
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                먼저 기본 정보 박은 영역 저장 박은 영역.<br/>
                저장 후 → 박힐 영역 박은 영역 박은 영역 박을 영역 박은 영역 박을 영역.<br/>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>(Phase B-3 측 박음)</span>
              </div>
            </div>
          ) : (
            <CommissionPolicyInlineEditor
              principalId={data.id}
              onModifiedChange={handlePolicyModified}
            />
          )}
          {!isNew && onGoCommissionPolicy && (
            <div style={{ marginTop: 12, textAlign: "right" }}>
              <button
                type="button"
                onClick={onGoCommissionPolicy}
                style={{
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                전체 정책 관리 화면 →
              </button>
            </div>
          )}
        </Section>

        <Section label="담당자 (선택)">
          <Field label="이름">
            <Input value={data.contact?.manager || ""} onChange={(v) => updateContact("manager", v)} placeholder="담당자 이름"/>
          </Field>
          <Field label="전화">
            <Input value={data.contact?.phone || ""} onChange={(v) => updateContact("phone", v)} placeholder="010-0000-0000"/>
          </Field>
        </Section>

        {/* Step 5-8 F-7 — 원청 계좌 (시트 X/Y열 양방향 sync) */}
        <Section label="원청 계좌 (선택)">
          <Field label="은행">
            <Input
              value={data.bankName || ""}
              onChange={(v) => updateField("bankName", v)}
              placeholder="예: 우리은행 / 신한은행 / KB국민은행"
            />
          </Field>
          <Field label="계좌번호">
            <Input
              value={data.accountNumber || ""}
              onChange={(v) => updateField("accountNumber", v.replace(/[^0-9-]/g, ""))}
              placeholder="000-000-000000"
            />
          </Field>
          <Field label="예금주">
            <Input
              value={data.accountHolder || ""}
              onChange={(v) => updateField("accountHolder", v)}
              placeholder="원청 / 법인명"
            />
          </Field>
        </Section>

        <Section label="비고 (선택)">
          <textarea
            value={data.note || ""}
            onChange={(e) => updateField("note", e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: "vertical", minHeight: 60, fontFamily: "inherit" }}
          />
        </Section>

        {error && (
          <div style={{
            margin: "12px 0", padding: "10px 12px",
            background: "rgba(239, 68, 68, 0.10)",
            border: "1px solid rgba(239, 68, 68, 0.30)",
            borderRadius: 8, color: "#FF3D5A",
            fontSize: 12, textAlign: "center",
          }}>{error}</div>
        )}

        {/* Step 5-3 — 토스트 */}
        {toast && (
          <div style={{
            margin: "12px 0", padding: "10px 12px",
            background: toast.type === "success"
              ? "rgba(0, 135, 90, 0.10)"
              : "rgba(245, 158, 11, 0.10)",
            border: `1px solid ${
              toast.type === "success" ? "rgba(0, 135, 90, 0.30)" : "rgba(245, 158, 11, 0.40)"
            }`,
            borderRadius: 8,
            color: toast.type === "success" ? "#00875A" : "#B45309",
            fontSize: 12, lineHeight: 1.5, textAlign: "center",
          }}>{toast.message}</div>
        )}

        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <button onClick={onBack} style={cancelBtnStyle} disabled={busy}>취소</button>
          <button onClick={handleSave} style={{ ...saveBtnStyle, opacity: busy ? 0.6 : 1 }} disabled={busy}>
            {busy ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 헬퍼 =====
function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={sectionLabelStyle}>{label}</div>
      {children}
    </div>
  );
}
function SubSection({ title, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 600, marginBottom: 6 }}>
        {title}
        {hint && <span style={{ color: "var(--text-tertiary)", fontWeight: 400, marginLeft: 6 }}>· {hint}</span>}
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={subLabelStyle}>{label}</div>
      {children}
    </div>
  );
}
function Input({ value, onChange, placeholder, mono }) {
  return (
    <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...inputStyle, fontFamily: mono ? "inherit" : "inherit" }}/>
  );
}
function NumberInput({ value, onChange, suffix, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{label}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="number" value={value === 0 ? 0 : (value || "")}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          style={{ ...inputStyle, fontFamily: "inherit", flex: 1 }}/>
        {suffix && <span style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{suffix}</span>}
      </div>
    </div>
  );
}
function RadioRow({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(opt => {
        const active = value === opt.key;
        const color = opt.color || "#FF1B8D";
        return (
          <div key={opt.key} onClick={() => onChange(opt.key)}
            style={{
              padding: "8px 14px",
              background: active ? color + "20" : "var(--bg-secondary)",
              border: `1px solid ${active ? color : "var(--bg-tertiary)"}`,
              borderRadius: 7, fontSize: 12,
              color: active ? color : "var(--text-secondary)",
              cursor: "pointer", fontWeight: active ? 600 : 400, userSelect: "none",
            }}
          >{opt.label}</div>
        );
      })}
    </div>
  );
}
function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {PRINCIPAL_COLORS.map(c => {
        const selected = value === c;
        return (
          <div key={c} onClick={() => onChange(c)}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: c,
              border: selected ? "3px solid #FAF8F5" : "2px solid #2A2420",
              cursor: "pointer",
              boxShadow: selected ? `0 0 0 2px ${c}40` : "none",
            }}/>
        );
      })}
    </div>
  );
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

// ===== 스타일 =====
const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 16px", borderBottom: "1px solid var(--border)",
  position: "sticky", top: 0, background: "var(--bg-primary)", zIndex: 10,
};
const backBtnStyle = { background: "none", border: "none", color: "var(--text-primary)", fontSize: 18, cursor: "pointer", padding: 4 };
const titleStyle = { fontSize: 15, fontWeight: 500, flex: 1, textAlign: "center" };
const dangerBtnStyle = {
  background: "rgba(239, 68, 68, 0.10)", border: "1px solid rgba(239, 68, 68, 0.30)",
  color: "#FF3D5A", fontSize: 12, fontWeight: 500, padding: "6px 12px", borderRadius: 6,
  cursor: "pointer", fontFamily: "inherit",
};
const sectionLabelStyle = {
  fontSize: 11, color: "var(--text-primary)", fontWeight: 600, letterSpacing: 0.3, marginBottom: 10,
};
const subLabelStyle = { fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 500 };
const inputStyle = {
  width: "100%", background: "var(--bg-secondary)",
  border: "1px solid var(--border)", borderRadius: 8,
  padding: "10px 12px", color: "var(--text-primary)",
  fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};
const enableBtnStyle = {
  width: "100%",
  padding: "10px 16px", background: "#FF1B8D",
  border: "none", borderRadius: 8,
  color: "#fff", fontSize: 12, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
};
const typeAddBtnStyle = {
  width: "100%",
  padding: "10px 14px", background: "var(--bg-secondary)",
  border: "1px solid var(--border)", borderRadius: 8,
  color: "var(--text-primary)", fontSize: 12, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit",
  textAlign: "left",
};
const removeBtnStyle = {
  width: "100%", padding: 10, marginTop: 14,
  background: "transparent", border: "1px dashed var(--border)",
  borderRadius: 8, color: "var(--text-secondary)",
  fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
};
const cancelBtnStyle = {
  flex: 1, background: "var(--bg-secondary)", border: "1px solid var(--border)",
  color: "var(--text-secondary)", fontSize: 14, fontWeight: 500,
  padding: 12, borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
};
const saveBtnStyle = {
  flex: 2, background: "#FF1B8D", border: "none",
  color: "var(--text-primary)", fontSize: 14, fontWeight: 600,
  padding: 12, borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
};

export default PrincipalEditScreen;

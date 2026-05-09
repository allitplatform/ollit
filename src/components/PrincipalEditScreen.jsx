// Step 7 풀버전 — 원청 편집 (정책 type별 UI 분기)
// Step 5-3 — 시트 설정_원청 양방향 sync (savePrincipalWithSync / deletePrincipalWithSync)
import { useState } from "react";
import {
  loadPrincipals, generatePrincipalId, autoPrefix,
  savePrincipalWithSync, deletePrincipalWithSync,
  createEmptyPolicy, PRINCIPAL_COLORS, STATUS_OPTIONS, VAT_OPTIONS,
} from "../data/principals.js";
import {
  calcCleaning,
  calcRefrigerant,
  calcEstimateSplit,
  calcEstimateRemainderSplit,
  calcTotalSplit,
} from "../utils/commissionCalc.js";
import { ENGINEER_STANDARD_RATES, APPLIANCE_OPTIONS } from "../data/standardRates.js";

const WORK_TYPES = [
  { key: "cleaning",    label: "🧽 세척" },
  { key: "refrigerant", label: "냉매충전" },
];

const CLEANING_POLICY_TYPES = [
  { key: "standard",          label: "표준",     desc: "원청 수수료 + 프로 단가" },
  { key: "fake_split",        label: "쿨가이형", desc: "(총 - 가짜) × split%" },
  { key: "naver_settlement",  label: "네이버형", desc: "정산금 + 추가선택" },
];

const REFRIGERANT_POLICY_TYPES = [
  { key: "standard",                  label: "표준",         desc: "원청 % + 기사 %" },
  { key: "total_split",               label: "KB식(총금액)", desc: "총금액 × 원청% / × 기사% / 나머지 회사" },
  { key: "estimate_remainder_split",  label: "KA식",         desc: "견적 × 원청% / (잔여+추가) × 기사%" },
  { key: "estimate_split",            label: "옛 KB식",      desc: "견적 × 원청% / 견적 × 기사% / 추가 50:50 (legacy)" },
];

export function PrincipalEditScreen({ principal, isNew, onSaved, onBack }) {
  const [data, setData] = useState(() => deepClone(principal));
  const [activeTab, setActiveTab] = useState("refrigerant");
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);  // Step 5-3 — { type: success|warn, message }
  const [busy, setBusy]   = useState(false);

  function updateName(name) {
    setData(d => ({ ...d, name, prefix: d.prefix || autoPrefix(name) }));
  }
  function updateField(field, value) {
    setData(d => ({ ...d, [field]: value }));
  }
  function updateContact(field, value) {
    setData(d => ({ ...d, contact: { ...d.contact, [field]: value } }));
  }

  function updatePolicy(workType, mutator) {
    setData(d => {
      const cur = d.commissionPolicy[workType];
      if (!cur) return d;
      const next = mutator(deepClone(cur));
      return { ...d, commissionPolicy: { ...d.commissionPolicy, [workType]: next } };
    });
  }

  function setPolicyType(workType, policyType) {
    setData(d => ({
      ...d,
      commissionPolicy: { ...d.commissionPolicy, [workType]: createEmptyPolicy(workType, policyType) },
    }));
  }

  function togglePolicyOff(workType) {
    setData(d => ({ ...d, commissionPolicy: { ...d.commissionPolicy, [workType]: null } }));
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
    setBusy(false);
    if (res.ok) {
      setToast({ type: "success", message: "원청 저장 완료" });
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

  const currentPolicy = data.commissionPolicy[activeTab];

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
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {WORK_TYPES.map(wt => {
              const active = activeTab === wt.key;
              const hasPolicy = !!data.commissionPolicy[wt.key];
              return (
                <div key={wt.key} onClick={() => setActiveTab(wt.key)}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 7,
                    background: "var(--bg-secondary)",
                    border: active ? "2px solid #FF1B8D" : "1px solid var(--border)",
                    color: active ? "#FF1B8D" : "var(--text-secondary)",
                    fontSize: 12, cursor: "pointer", textAlign: "center",
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {wt.label}
                  {hasPolicy && <span style={{ marginLeft: 4, color: "#00875A" }}>●</span>}
                </div>
              );
            })}
          </div>

          {!currentPolicy ? (
            <PolicyEmptyState
              workType={activeTab}
              onAdd={(policyType) => setPolicyType(activeTab, policyType)}
            />
          ) : activeTab === "cleaning" ? (
            <CleaningPolicyEditor
              policy={currentPolicy}
              principalData={data}
              onMutate={(mutator) => updatePolicy("cleaning", mutator)}
              onChangeType={(policyType) => setPolicyType("cleaning", policyType)}
              onRemove={() => togglePolicyOff("cleaning")}
            />
          ) : (
            <RefrigerantPolicyEditor
              policy={currentPolicy}
              onMutate={(mutator) => updatePolicy("refrigerant", mutator)}
              onChangeType={(policyType) => setPolicyType("refrigerant", policyType)}
              onRemove={() => togglePolicyOff("refrigerant")}
            />
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

// ===== 정책 미설정 상태 =====
function PolicyEmptyState({ workType, onAdd }) {
  return (
    <div style={{
      background: "var(--bg-secondary)", padding: 16, borderRadius: 10,
      border: "1px dashed var(--border)",
    }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, textAlign: "center" }}>
        {workType === "cleaning" ? "세척" : "냉매충전"} 정책 미설정
      </div>
      {workType === "cleaning" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {CLEANING_POLICY_TYPES.map(pt => (
            <button key={pt.key} onClick={() => onAdd(pt.key)} style={typeAddBtnStyle}>
              + {pt.label} <span style={{ color: "var(--text-tertiary)", fontWeight: 400, marginLeft: 4 }}>· {pt.desc}</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {REFRIGERANT_POLICY_TYPES.map(pt => (
            <button key={pt.key} onClick={() => onAdd(pt.key)} style={typeAddBtnStyle}>
              + {pt.label} <span style={{ color: "var(--text-tertiary)", fontWeight: 400, marginLeft: 4 }}>· {pt.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== 세척 정책 편집 (type별 분기) =====
function CleaningPolicyEditor({ policy, principalData, onMutate, onChangeType, onRemove }) {
  return (
    <div>
      {/* 정책 type 라디오 */}
      <SubSection title="정책 종류">
        <RadioRow
          options={CLEANING_POLICY_TYPES.map(pt => ({ key: pt.key, label: pt.label }))}
          value={policy.type}
          onChange={onChangeType}
        />
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 6 }}>
          * 종류 변경 시 해당 type 기본값으로 초기화
        </div>
      </SubSection>

      {policy.type === "standard" && <StandardCleaningSection policy={policy} onMutate={onMutate}/>}
      {policy.type === "fake_split" && <FakeSplitSection policy={policy} onMutate={onMutate}/>}
      {policy.type === "naver_settlement" && <NaverSettlementSection policy={policy} onMutate={onMutate}/>}

      <CleaningSimulation policy={policy} principalData={principalData}/>

      <button onClick={onRemove} style={removeBtnStyle}>정책 제거</button>
    </div>
  );
}

function StandardCleaningSection({ policy, onMutate }) {
  // Step 5-3 hotfix 2 — policy.principal null safe (시트 병합 시 principal 객체 누락 catch)
  const principalType = policy.principal?.type || "none";
  return (
    <SubSection title="원청 수수료" hint="프로 = 표준 단가표 적용 / 회사 = 나머지">
      <RadioRow
        options={[
          { key: "none",  label: "없음" },
          { key: "rate",  label: "정률 (%)" },
          { key: "fixed", label: "정액 (원)" },
        ]}
        value={principalType}
        onChange={(v) => onMutate(p => {
          if (!p.principal) p.principal = { type: v, base: "total", value: 0 };
          else p.principal.type = v;
          return p;
        })}
      />
      {principalType === "rate" && (
        <div style={{ marginTop: 10 }}>
          <NumberInput value={policy.principal?.value || 0} suffix="%"
            onChange={(v) => onMutate(p => {
              if (!p.principal) p.principal = { type: "rate", base: "total", value: v };
              else p.principal.value = v;
              return p;
            })}/>
        </div>
      )}
      {principalType === "fixed" && (
        <div style={{ marginTop: 10 }}>
          <NumberInput value={policy.principal?.value || 0} suffix="원"
            onChange={(v) => onMutate(p => {
              if (!p.principal) p.principal = { type: "fixed", base: "total", value: v };
              else p.principal.value = v;
              return p;
            })}/>
        </div>
      )}
    </SubSection>
  );
}

function FakeSplitSection({ policy, onMutate }) {
  return (
    <>
      <SubSection title="가짜 단가표 (쿨가이형)" hint="실제 단가보다 높게 표기 → 차액의 split%가 원청">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {APPLIANCE_OPTIONS.map(a => (
            <NumberInput
              key={a}
              label={a}
              value={(policy.fakeRates && policy.fakeRates[a]) || 0}
              suffix="원"
              onChange={(v) => onMutate(p => {
                p.fakeRates = { ...(p.fakeRates || {}), [a]: v };
                return p;
              })}
            />
          ))}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 8 }}>
          참고: 실제 프로 단가 = {Object.entries(ENGINEER_STANDARD_RATES).map(([k, v]) => `${k} ${v.toLocaleString()}`).join(" / ")}
        </div>
      </SubSection>
      <SubSection title="원청 split 비율">
        <NumberInput value={policy.splitRate} suffix="%"
          onChange={(v) => onMutate(p => { p.splitRate = v; return p; })}/>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
          (총금액 - 가짜 단가 합계) × split% = 원청 수수료
        </div>
      </SubSection>
    </>
  );
}

function NaverSettlementSection({ policy, onMutate }) {
  return (
    <>
      <SubSection title="원청 수수료 (정산예정금액 기준)">
        <NumberInput value={policy.principal.value} suffix="%"
          onChange={(v) => onMutate(p => { p.principal.value = v; return p; })}/>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
          정산예정금액 × N% = 원청 수수료
        </div>
      </SubSection>
      <SubSection title="추가선택 정책" hint="추가선택은 별도 분배">
        <Field label="원청 비율 (%)">
          <NumberInput value={policy.additionalsPolicy?.principalRate || 0} suffix="%"
            onChange={(v) => onMutate(p => {
              p.additionalsPolicy = { ...(p.additionalsPolicy || {}), principalRate: v };
              return p;
            })}/>
        </Field>
        <Field label="프로 비율 (%)">
          <NumberInput value={policy.additionalsPolicy?.engineerRate || 0} suffix="%"
            onChange={(v) => onMutate(p => {
              p.additionalsPolicy = { ...(p.additionalsPolicy || {}), engineerRate: v };
              return p;
            })}/>
        </Field>
      </SubSection>
    </>
  );
}

function CleaningSimulation({ policy, principalData }) {
  const [appliance, setAppliance] = useState("벽걸이");
  const [count, setCount] = useState(1);
  const [total, setTotal] = useState(100000);

  const calc = calcCleaning({
    policy,
    principal: principalData,
    appliances: [{ type: appliance, count }],
    total,
  });

  const vatHint = (principalData?.vatPolicy || "included") === "excluded"
    ? " · 부가세 별도 (단가 ×1.10)"
    : "";

  return (
    <SubSection title="🧮 시뮬레이션" hint={`기준: ${calc.vatPolicy === "excluded" ? "별도" : "포함"}${vatHint}`}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <Field label="기종">
          <select value={appliance} onChange={(e) => setAppliance(e.target.value)} style={{ ...inputStyle, fontFamily: "inherit" }}>
            {APPLIANCE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <NumberInput label="수량" value={count} onChange={setCount}/>
      </div>
      <NumberInput
        label={policy.type === "naver_settlement" ? "정산예정금액" : "총금액"}
        value={total} suffix="원" onChange={setTotal}
      />
      <ResultBox calc={calc}/>
    </SubSection>
  );
}

// ===== 냉매 정책 편집 (type별 분기) =====
function RefrigerantPolicyEditor({ policy, onMutate, onChangeType, onRemove }) {
  const policyType = policy.type || "standard";
  return (
    <div>
      <SubSection title="정책 종류">
        <RadioRow
          options={REFRIGERANT_POLICY_TYPES.map(pt => ({ key: pt.key, label: pt.label }))}
          value={policyType}
          onChange={onChangeType}
        />
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 6 }}>
          * 종류 변경 시 해당 type 기본값으로 초기화
        </div>
      </SubSection>

      {policyType === "estimate_remainder_split"
        ? <RefrigerantRemainderSection policy={policy} onMutate={onMutate}/>
        : policyType === "total_split"
        ? <RefrigerantTotalSection     policy={policy} onMutate={onMutate}/>
        : <RefrigerantStandardSection  policy={policy} onMutate={onMutate}/>}

      <RefrigerantSimulation policy={policy}/>

      <button onClick={onRemove} style={removeBtnStyle}>정책 제거</button>
    </div>
  );
}

// 표준 / KB식 — 기존 형식 (principal.type/base/value + engineer.base/value)
function RefrigerantStandardSection({ policy, onMutate }) {
  return (
    <>
      <SubSection title="원청 수수료" hint="원청이 가져감">
        <RadioRow
          options={[
            { key: "none",  label: "없음" },
            { key: "rate",  label: "정률 (%)" },
            { key: "fixed", label: "정액 (원)" },
          ]}
          value={policy.principal?.type || "none"}
          onChange={(v) => onMutate(p => { p.principal = { ...(p.principal || {}), type: v }; return p; })}
        />
        {policy.principal?.type === "rate" && (
          <>
            <div style={{ marginTop: 10 }}>
              <RadioRow
                options={[
                  { key: "estimate", label: "견적금액 기준" },
                  { key: "total",    label: "총금액 기준" },
                ]}
                value={policy.principal.base}
                onChange={(v) => onMutate(p => { p.principal.base = v; return p; })}
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <NumberInput value={policy.principal.value} suffix="%"
                onChange={(v) => onMutate(p => { p.principal.value = v; return p; })}/>
            </div>
          </>
        )}
        {policy.principal?.type === "fixed" && (
          <div style={{ marginTop: 10 }}>
            <NumberInput value={policy.principal.value} suffix="원"
              onChange={(v) => onMutate(p => { p.principal.value = v; return p; })}/>
          </div>
        )}
      </SubSection>

      {policy.engineer && (
        <SubSection title="프로 수익" hint="프로가 받음">
          <RadioRow
            options={[
              { key: "estimate", label: "견적금액 기준" },
              { key: "total",    label: "총금액 기준" },
            ]}
            value={policy.engineer.base}
            onChange={(v) => onMutate(p => { p.engineer.base = v; return p; })}
          />
          <div style={{ marginTop: 10 }}>
            <NumberInput value={policy.engineer.value} suffix="%"
              onChange={(v) => onMutate(p => { p.engineer.value = v; return p; })}/>
          </div>
        </SubSection>
      )}
    </>
  );
}

// 총금액_분배 (KB식 / Step 4) — 총금액(견적+추가) × 원청% / × 기사% / 나머지 = 회사
function RefrigerantTotalSection({ policy, onMutate }) {
  return (
    <>
      <SubSection title="원청 수수료" hint="총금액 × N%">
        <NumberInput value={policy.principalRate ?? 35} suffix="%"
          onChange={(v) => onMutate(p => { p.principalRate = v; return p; })}/>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
          (견적 + 현장추가) × N% = 원청 수수료
        </div>
      </SubSection>
      <SubSection title="기사 비율" hint="총금액 × N% (Step 3 — 기사별 50/60/100 동적)">
        <NumberInput value={policy.engineerRate ?? 50} suffix="%"
          onChange={(v) => onMutate(p => { p.engineerRate = v; return p; })}/>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
          (견적 + 현장추가) × N% = 기사 / 나머지 = 회사
        </div>
      </SubSection>
    </>
  );
}

// 견적_잔여_분배 (KA식) — 견적 × 원청% / (잔여+추가) × 기사% / 나머지 = 회사
function RefrigerantRemainderSection({ policy, onMutate }) {
  return (
    <>
      <SubSection title="원청 수수료" hint="견적 × N%">
        <NumberInput value={policy.principalRate ?? 35} suffix="%"
          onChange={(v) => onMutate(p => { p.principalRate = v; return p; })}/>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
          견적의 N% = 원청 수수료 (현장추가금 X)
        </div>
      </SubSection>
      <SubSection title="기사 풀 비율" hint="(견적 - 원청 + 추가) × N%">
        <NumberInput value={policy.engineerRate ?? 50} suffix="%"
          onChange={(v) => onMutate(p => { p.engineerRate = v; return p; })}/>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
          잔여 풀 (견적 - 원청 + 현장추가금) × N% = 기사 / 나머지 = 회사
        </div>
      </SubSection>
    </>
  );
}

function RefrigerantSimulation({ policy }) {
  const [estimate, setEstimate] = useState(100000);
  const [extra, setExtra] = useState(30000);

  let calc;
  if (policy.type === "estimate_remainder_split") {
    calc = calcEstimateRemainderSplit({ policy, estimate, extra });
  } else if (policy.type === "total_split") {
    calc = calcTotalSplit({ policy, estimate, extra });
  } else if (policy.type === "estimate_split") {
    calc = calcEstimateSplit({ policy, estimate, extra });
  } else {
    calc = calcRefrigerant({ policy, estimate, extra });
  }

  return (
    <SubSection title="🧮 시뮬레이션">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <NumberInput value={estimate} suffix="원" label="견적" onChange={setEstimate}/>
        <NumberInput value={extra}    suffix="원" label="현장추가" onChange={setExtra}/>
      </div>
      <ResultBox calc={calc}/>
    </SubSection>
  );
}

// ===== 결과 박스 =====
function ResultBox({ calc }) {
  return (
    <div style={{
      background: "var(--bg-inset)", borderRadius: 8, padding: 12, marginTop: 10,
    }}>
      <ResultRow color="#FF1B8D" label="원청"      value={calc.principal} total={calc.total}/>
      <ResultRow color="#00875A" label="프로"      value={calc.engineer}  total={calc.total}/>
      <ResultRow color="#FF1B8D" label="회사 마진" value={calc.company}   total={calc.total} isNegative={calc.isNegative}/>
      <div style={{
        borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 8,
        display: "flex", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>총금액</span>
        <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 700, fontFamily: "inherit" }}>
          {(calc.total || 0).toLocaleString()}원
        </span>
      </div>
    </div>
  );
}

function ResultRow({ color, label, value, total, isNegative }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: isNegative ? "#FF3D5A" : color }}/>
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{pct}%</span>
      </div>
      <span style={{
        fontSize: 12, fontWeight: 700, fontFamily: "inherit",
        color: isNegative ? "#FF3D5A" : "var(--text-primary)",
      }}>
        {(value || 0).toLocaleString()}원
      </span>
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

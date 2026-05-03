// Step 6 — 기사 편집/추가 화면
// 사장님 catch: 직급/상태/작업종류별 역할/지역/기종 직접 컨트롤
import { useState, useMemo } from "react";
import {
  loadEngineers, saveEngineers, generateId,
  CAREER_LEVELS, STATUS_OPTIONS, ROLE_OPTIONS, APPLIANCE_OPTIONS,
  SEOUL_DISTRICTS, GG_INCHEON,
} from "../data/engineers.js";

export function EngineerEditScreen({ engineer, isNew, onSaved, onBack }) {
  const [form, setForm] = useState(() => ({
    ...engineer,
    workTypes: {
      cleaning:    { ...engineer.workTypes.cleaning    },
      refrigerant: { ...engineer.workTypes.refrigerant },
    },
  }));
  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function updateWork(type, field, value) {
    setForm(prev => ({
      ...prev,
      workTypes: {
        ...prev.workTypes,
        [type]: { ...prev.workTypes[type], [field]: value },
      },
    }));
  }

  function toggleArrayItem(arr, item) {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
  }

  function handleSave() {
    setError("");
    const name = (form.name || "").trim();
    if (!name) {
      setError("이름을 입력해주세요");
      return;
    }
    const list = loadEngineers();
    let saved = { ...form, name };
    if (isNew) {
      saved.id = generateId(name);
      saveEngineers([saved, ...list]);
    } else {
      saveEngineers(list.map(e => e.id === saved.id ? saved : e));
    }
    onSaved && onSaved(saved);
  }

  function handleDelete() {
    if (isNew) return;
    const ok = window.confirm(`${form.name} 기사를 삭제할까요?\n\n복구 불가합니다.`);
    if (!ok) return;
    const list = loadEngineers();
    saveEngineers(list.filter(e => e.id !== form.id));
    onSaved && onSaved(null);
  }

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Spoqa Han Sans Neo', sans-serif", paddingBottom: 80 }}>

      {/* 헤더 */}
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>{isNew ? "기사 추가" : "기사 편집"}</div>
        {!isNew && (
          <button onClick={handleDelete} style={deleteBtnStyle}>삭제</button>
        )}
      </div>

      <div style={{ padding: "16px" }}>
        {/* 기본 정보 */}
        <Section label="기본 정보">
          <Field label="이름">
            <input
              type="text" placeholder="예: 김동효"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="전화번호">
            <input
              type="text" placeholder="예: 010-9238-0412"
              value={form.phone || ""}
              onChange={(e) => updateField("phone", e.target.value)}
              style={inputStyle}
            />
          </Field>
        </Section>

        {/* 직급 */}
        <Section label="직급">
          <RadioRow
            options={Object.entries(CAREER_LEVELS).map(([k, v]) => ({ key: k, label: v.name, color: v.color }))}
            value={form.careerLevel}
            onChange={(v) => updateField("careerLevel", v)}
          />
        </Section>

        {/* 상태 */}
        <Section label="상태">
          <RadioRow
            options={Object.entries(STATUS_OPTIONS).map(([k, v]) => ({ key: k, label: v.name, color: v.color }))}
            value={form.status}
            onChange={(v) => updateField("status", v)}
          />
        </Section>

        {/* 작업 종류 */}
        <Section label="🧽 세척">
          <WorkTypeEditor
            work={form.workTypes.cleaning}
            onChange={(field, value) => updateWork("cleaning", field, value)}
            onToggleZone={(z) => updateWork("cleaning", "zones", toggleArrayItem(form.workTypes.cleaning.zones, z))}
            onToggleAppliance={(a) => updateWork("cleaning", "appliances", toggleArrayItem(form.workTypes.cleaning.appliances, a))}
          />
        </Section>

        <Section label="냉매충전">
          <WorkTypeEditor
            work={form.workTypes.refrigerant}
            onChange={(field, value) => updateWork("refrigerant", field, value)}
            onToggleZone={(z) => updateWork("refrigerant", "zones", toggleArrayItem(form.workTypes.refrigerant.zones, z))}
            onToggleAppliance={(a) => updateWork("refrigerant", "appliances", toggleArrayItem(form.workTypes.refrigerant.appliances, a))}
          />
        </Section>

        {/* 메모 */}
        <Section label="메모 (선택)">
          <textarea
            placeholder="예: 신입 / 벽걸이만 가능"
            value={form.note || ""}
            onChange={(e) => updateField("note", e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
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

        {/* 저장 버튼 */}
        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <button onClick={onBack} style={cancelBtnStyle}>취소</button>
          <button onClick={handleSave} style={saveBtnStyle}>저장</button>
        </div>
      </div>
    </div>
  );
}

function WorkTypeEditor({ work, onChange, onToggleZone, onToggleAppliance }) {
  const isOn = work.role !== "none";
  const [zoneSearch, setZoneSearch] = useState("");

  const filteredSeoul = useMemo(
    () => zoneSearch ? SEOUL_DISTRICTS.filter(z => z.includes(zoneSearch)) : SEOUL_DISTRICTS,
    [zoneSearch]
  );
  const filteredGG = useMemo(
    () => zoneSearch ? GG_INCHEON.filter(z => z.includes(zoneSearch)) : GG_INCHEON,
    [zoneSearch]
  );

  return (
    <>
      <RadioRow
        options={Object.entries(ROLE_OPTIONS).map(([k, v]) => ({ key: k, label: v }))}
        value={work.role}
        onChange={(v) => onChange("role", v)}
      />

      {isOn && (
        <>
          {/* 가능 지역 */}
          <div style={{ marginTop: 16 }}>
            <div style={subLabelStyle}>가능 지역 ({work.zones.length})</div>
            <input
              type="text" placeholder="🔍 지역 검색 (예: 강남)"
              value={zoneSearch}
              onChange={(e) => setZoneSearch(e.target.value)}
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            <div style={subLabelStyle}>서울</div>
            <div style={chipGridStyle}>
              {filteredSeoul.map(z => (
                <ChipCheck key={z} label={z} on={work.zones.includes(z)} onClick={() => onToggleZone(z)}/>
              ))}
              {filteredSeoul.length === 0 && (
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>매칭 없음</span>
              )}
            </div>
            <div style={{ ...subLabelStyle, marginTop: 12 }}>경기/인천</div>
            <div style={chipGridStyle}>
              {filteredGG.map(z => (
                <ChipCheck key={z} label={z} on={work.zones.includes(z)} onClick={() => onToggleZone(z)}/>
              ))}
              {filteredGG.length === 0 && (
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>매칭 없음</span>
              )}
            </div>
          </div>

          {/* 가능 기종 */}
          <div style={{ marginTop: 16 }}>
            <div style={subLabelStyle}>가능 기종 ({work.appliances.length})</div>
            <div style={chipGridStyle}>
              {APPLIANCE_OPTIONS.map(a => (
                <ChipCheck key={a} label={a} on={work.appliances.includes(a)} onClick={() => onToggleAppliance(a)}/>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 6, lineHeight: 1.5 }}>
              * 기종 미선택 시 지역만 매칭 (모든 기종 가능). 특정 기종만 선택하면 그 기종 작업만 매칭.
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={sectionLabelStyle}>{label}</div>
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

function RadioRow({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(opt => {
        const active = value === opt.key;
        const color = opt.color || "#FF1B8D";
        return (
          <div
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              padding: "8px 14px",
              background: active ? color + "20" : "var(--bg-secondary)",
              border: `1px solid ${active ? color : "var(--bg-tertiary)"}`,
              borderRadius: 7, fontSize: 12,
              color: active ? color : "var(--text-secondary)",
              cursor: "pointer", fontWeight: active ? 600 : 400,
              userSelect: "none",
            }}
          >{opt.label}</div>
        );
      })}
    </div>
  );
}

function ChipCheck({ label, on, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "6px 12px",
        background: "var(--bg-secondary)",
        border: on ? "2px solid #FF1B8D" : "1px solid var(--border)",
        borderRadius: 6, fontSize: 11,
        color: on ? "#FF1B8D" : "var(--text-secondary)",
        cursor: "pointer", fontWeight: on ? 500 : 400,
        userSelect: "none",
      }}
    >{on ? "✓ " : ""}{label}</div>
  );
}

const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 16px", borderBottom: "1px solid var(--border)",
  position: "sticky", top: 0, background: "var(--bg-primary)", zIndex: 10,
};
const backBtnStyle = { background: "none", border: "none", color: "var(--text-primary)", fontSize: 18, cursor: "pointer", padding: 4 };
const titleStyle = { fontSize: 15, fontWeight: 500 };
const deleteBtnStyle = {
  background: "rgba(239, 68, 68, 0.10)", border: "1px solid rgba(239, 68, 68, 0.30)",
  color: "#FF3D5A", fontSize: 12, fontWeight: 500,
  padding: "6px 12px", borderRadius: 6, cursor: "pointer",
  fontFamily: "inherit",
};
const sectionLabelStyle = {
  fontSize: 11, color: "var(--text-primary)", fontWeight: 600,
  letterSpacing: 0.3, marginBottom: 10, textTransform: "none",
};
const subLabelStyle = {
  fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 500,
};
const inputStyle = {
  width: "100%", background: "var(--bg-secondary)",
  border: "1px solid var(--border)", borderRadius: 8,
  padding: "10px 12px", color: "var(--text-primary)",
  fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};
const chipGridStyle = {
  display: "flex", flexWrap: "wrap", gap: 6,
};
const cancelBtnStyle = {
  flex: 1, background: "var(--bg-secondary)", border: "1px solid var(--border)",
  color: "var(--text-secondary)", fontSize: 14, fontWeight: 500,
  padding: 12, borderRadius: 10, cursor: "pointer",
  fontFamily: "inherit",
};
const saveBtnStyle = {
  flex: 2, background: "#FF1B8D", border: "none",
  color: "var(--text-primary)", fontSize: 14, fontWeight: 600,
  padding: 12, borderRadius: 10, cursor: "pointer",
  fontFamily: "inherit",
};

export default EngineerEditScreen;

// Step 8 — 지역 편집/추가 화면
import { useState } from "react";
import {
  loadRegions, saveRegions, generateRegionId,
  REGION_SUBGROUPS,
} from "../data/regions.js";
import { loadEngineers } from "../data/engineers.js";

export function RegionEditScreen({ region, isNew, onSaved, onBack }) {
  const [data, setData] = useState({ ...region });
  const [error, setError] = useState("");

  function updateField(field, value) {
    setData(d => ({ ...d, [field]: value }));
  }

  function handleSave() {
    setError("");
    const name = (data.name || "").trim();
    if (!name) { setError("지역 이름을 입력해주세요"); return; }

    const all = loadRegions();

    // 중복 검증
    if (isNew && all.some(r => r.name === name && r.subgroupId === data.subgroupId)) {
      setError(`"${name}" 이미 등록되어 있습니다`);
      return;
    }

    let saved = { ...data, name };
    if (isNew) {
      saved.id = generateRegionId(name);
      saveRegions([...all, saved]);
    } else {
      saveRegions(all.map(r => r.id === saved.id ? saved : r));
    }
    onSaved && onSaved(saved);
  }

  function handleDelete() {
    if (isNew) return;
    // 담당 기사 경고
    const engineers = loadEngineers();
    const usedBy = engineers.filter(e => {
      const cleaning = e.workTypes?.cleaning?.zones || [];
      const refrigerant = e.workTypes?.refrigerant?.zones || [];
      return cleaning.includes(data.name) || refrigerant.includes(data.name);
    });

    let msg = `"${data.name}" 지역을 삭제할까요?\n\n복구 불가합니다.`;
    if (usedBy.length > 0) {
      msg = `⚠️ ${usedBy.length}명 프로가 이 지역을 담당하고 있습니다:\n${usedBy.map(e => "· " + e.name).join("\n")}\n\n그래도 삭제할까요?`;
    }
    if (!window.confirm(msg)) return;

    const all = loadRegions();
    saveRegions(all.filter(r => r.id !== data.id));
    onSaved && onSaved(null);
  }

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif", paddingBottom: 80 }}>
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>{isNew ? "지역 추가" : `${data.name || "—"} 편집`}</div>
        {!isNew && (
          <button onClick={handleDelete} style={dangerBtnStyle}>삭제</button>
        )}
      </div>

      <div style={{ padding: "16px" }}>
        <Field label="지역 이름">
          <input
            type="text" placeholder="예: 강남구 / 천안시"
            value={data.name || ""}
            onChange={(e) => updateField("name", e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="소속">
          <select
            value={data.subgroupId || "seoul"}
            onChange={(e) => updateField("subgroupId", e.target.value)}
            style={{ ...inputStyle, fontFamily: "inherit" }}
          >
            {REGION_SUBGROUPS.map(sg => (
              <option key={sg.id} value={sg.id}>{sg.name}</option>
            ))}
          </select>
        </Field>

        <Field label="활성 여부">
          <div
            onClick={() => updateField("active", !data.active)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px",
              background: "var(--bg-secondary)", border: "1px solid var(--border)",
              borderRadius: 8, cursor: "pointer",
            }}
          >
            <div style={{
              width: 36, height: 20, borderRadius: 10,
              background: data.active ? "#00875A" : "var(--bg-tertiary)",
              position: "relative", transition: "background 0.2s",
              flexShrink: 0,
            }}>
              <div style={{
                position: "absolute", top: 2,
                left: data.active ? 18 : 2,
                width: 16, height: 16, borderRadius: "50%",
                background: "var(--text-primary)", transition: "left 0.2s",
              }}/>
            </div>
            <span style={{ fontSize: 12, color: data.active ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {data.active ? "활성 (작업 받음)" : "비활성 (작업 안 받음)"}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
            비활성 시 작업을 받지 않으며 프로 매칭에서도 제외됩니다
          </div>
        </Field>

        {error && (
          <div style={{
            margin: "12px 0", padding: "10px 12px",
            background: "rgba(239, 68, 68, 0.10)",
            border: "1px solid rgba(239, 68, 68, 0.30)",
            borderRadius: 8, color: "#FF3D5A",
            fontSize: 12, textAlign: "center",
          }}>{error}</div>
        )}

        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <button onClick={onBack} style={cancelBtnStyle}>취소</button>
          <button onClick={handleSave} style={saveBtnStyle}>저장</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 500 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 16px", borderBottom: "1px solid var(--border)",
  position: "sticky", top: 0, background: "var(--bg-primary)", zIndex: 10,
};
const backBtnStyle = { background: "none", border: "none", color: "var(--text-primary)", fontSize: 18, cursor: "pointer", padding: 4 };
const titleStyle = { fontSize: 15, fontWeight: 500, flex: 1, textAlign: "center" };
const dangerBtnStyle = {
  background: "rgba(239, 68, 68, 0.10)", border: "1px solid rgba(239, 68, 68, 0.30)",
  color: "#FF3D5A", fontSize: 12, fontWeight: 500,
  padding: "6px 12px", borderRadius: 6, cursor: "pointer",
  fontFamily: "inherit",
};
const inputStyle = {
  width: "100%", background: "var(--bg-secondary)",
  border: "1px solid var(--border)", borderRadius: 8,
  padding: "10px 12px", color: "var(--text-primary)",
  fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
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

export default RegionEditScreen;

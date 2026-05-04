// Step 7 V2 — 단가표 관리 화면 (별도 메뉴)
// 사장님이 단가표 직접 편집 / localStorage 보관
import { useState } from "react";
import { loadRates, saveRates, APPLIANCE_OPTIONS } from "../data/standardRates.js";

export function RatesManagementScreen({ onBack }) {
  const [rates, setRates]     = useState(() => loadRates());
  const [autoSync, setAutoSync] = useState(true);
  const [savedAt, setSavedAt]   = useState("");

  function updateCleaning(type, value) {
    const v = parseInt(value, 10) || 0;
    setRates(prev => {
      const next = {
        ...prev,
        cleaning: { ...prev.cleaning, [type]: v },
      };
      if (autoSync) {
        next.coolguyFake = { ...prev.coolguyFake, [type]: v + 10000 };
      }
      return next;
    });
  }

  function updateCoolguy(type, value) {
    const v = parseInt(value, 10) || 0;
    setRates(prev => ({
      ...prev,
      coolguyFake: { ...prev.coolguyFake, [type]: v },
    }));
  }

  function handleSave() {
    saveRates(rates);
    setSavedAt(new Date().toLocaleTimeString("ko-KR"));
  }

  function handleAutoFillCoolguy() {
    setRates(prev => {
      const newCoolguy = {};
      APPLIANCE_OPTIONS.forEach(t => {
        newCoolguy[t] = (prev.cleaning[t] || 0) + 10000;
      });
      return { ...prev, coolguyFake: newCoolguy };
    });
  }

  function handleReset() {
    if (!window.confirm("기본 단가로 초기화할까요?\n현재 저장된 단가가 사라집니다.")) return;
    localStorage.removeItem("ollit_standard_rates_v1");
    setRates(loadRates());
  }

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif", paddingBottom: 80 }}>
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>기사 단가표</div>
        <button onClick={handleSave} style={saveBtnStyle}>저장</button>
      </div>

      <div style={{ padding: 16 }}>
        {/* 안내 */}
        <InfoBox>
          ℹ️ 모든 원청 공통 기사 단가표<br/>
          · 원청별 부가세 정책 <strong>자동 적용</strong><br/>
          · 유솔 N (부가세 별도) → 기사 단가 ×1.10 자동
        </InfoBox>

        {savedAt && (
          <div style={{
            marginTop: 10, padding: "8px 12px",
            background: "rgba(29, 158, 117, 0.10)",
            border: "1px solid rgba(29, 158, 117, 0.30)",
            borderRadius: 8, color: "#00875A",
            fontSize: 11, textAlign: "center",
          }}>
            ✓ 저장 완료 ({savedAt})
          </div>
        )}

        {/* 세척 표준 */}
        <Section title="🧽 세척 표준 단가" subtitle="기사 1대당 (부가세 포함 기준)">
          {APPLIANCE_OPTIONS.map(type => (
            <RateRow
              key={type} label={type}
              value={rates.cleaning[type] || 0}
              onChange={(v) => updateCleaning(type, v)}
            />
          ))}
        </Section>

        {/* 쿨가이 */}
        <Section title="🎭 쿨가이 가짜 단가" subtitle="실제 + 10,000원 자동">
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: 10, padding: "8px 10px",
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            borderRadius: 8,
          }}>
            <label style={{ flex: 1, fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="checkbox" checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                style={{ accentColor: "#FF1B8D" }}
              />
              자동 동기화 (+10,000)
            </label>
            <button onClick={handleAutoFillCoolguy} style={syncBtnStyle}>
              지금 동기화
            </button>
          </div>
          {APPLIANCE_OPTIONS.map(type => {
            const fakeVal = rates.coolguyFake[type] || 0;
            const realVal = rates.cleaning[type] || 0;
            const diff = fakeVal - realVal;
            return (
              <RateRow
                key={type} label={type}
                value={fakeVal}
                hint={diff !== 0 ? `${diff > 0 ? "+" : ""}${diff.toLocaleString()}` : null}
                onChange={(v) => updateCoolguy(type, v)}
              />
            );
          })}
        </Section>

        {/* 부가세 안내 */}
        <InfoBox color="#FF1B8D">
          📋 부가세 정책은 <strong>원청 관리</strong> 화면에서 설정<br/>
          · 유솔 N = 부가세 별도 (기사 단가 ×1.10)<br/>
          · 나머지 5곳 = 부가세 포함 (단가 그대로)
        </InfoBox>

        <div style={{ marginTop: 18 }}>
          <button onClick={handleReset} style={resetBtnStyle}>기본 단가로 초기화</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 10 }}>
          · {subtitle}
        </div>
      )}
      {children}
    </div>
  );
}

function RateRow({ label, value, hint, onChange }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", marginBottom: 6,
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      borderRadius: 8,
    }}>
      <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>{label}</span>
      <input
        type="number"
        value={value === 0 ? 0 : value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 110, background: "var(--bg-inset)",
          border: "1px solid var(--border)", borderRadius: 6,
          padding: "8px 10px", color: "var(--text-primary)",
          fontSize: 13, fontFamily: "monospace",
          outline: "none", textAlign: "right",
        }}
      />
      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>원</span>
      {hint && (
        <span style={{
          fontSize: 10, color: "var(--text-secondary)",
          minWidth: 50, textAlign: "right", fontFamily: "monospace",
        }}>{hint}</span>
      )}
    </div>
  );
}

function InfoBox({ children, color = "#FF1B8D" }) {
  return (
    <div style={{
      padding: "12px 14px",
      background: color + "12",
      border: `1px solid ${color}40`,
      borderRadius: 8,
      fontSize: 11, color: "var(--text-primary)", lineHeight: 1.6,
    }}>
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
const titleStyle = { fontSize: 15, fontWeight: 500 };
const saveBtnStyle = {
  background: "#FF1B8D", border: "none", color: "var(--text-primary)",
  fontSize: 13, fontWeight: 600, padding: "6px 14px",
  borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
};
const syncBtnStyle = {
  padding: "6px 12px",
  background: "var(--bg-secondary)",
  border: "2px solid #FF1B8D",
  borderRadius: 6, color: "#FF1B8D",
  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  whiteSpace: "nowrap",
};
const resetBtnStyle = {
  width: "100%", padding: 10,
  background: "transparent", border: "1px dashed var(--border)",
  borderRadius: 8, color: "var(--text-tertiary)",
  fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
};

export default RatesManagementScreen;

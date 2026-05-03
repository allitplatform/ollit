// Step 9 — 사용자 편집 / 추가 (V4 명확화: 드롭다운 + 권한 안내)
import { useState } from "react";
import {
  loadUsers, saveUsers, generateUserId, ROLES, PERMISSIONS,
} from "../data/users.js";
import { loadPrincipals } from "../data/principals.js";
import { loadEngineers, CAREER_LEVELS } from "../data/engineers.js";

export function UserEditScreen({ user, isNew, onSaved, onBack }) {
  const [data, setData] = useState({ ...user });
  const [error, setError] = useState("");

  function updateField(field, value) {
    setData(d => ({ ...d, [field]: value }));
  }

  function handleSave() {
    setError("");
    const name = (data.name || "").trim();
    const loginId = (data.loginId || "").trim();
    if (!name)    { setError("이름을 입력해주세요"); return; }
    if (!loginId) { setError("로그인 ID를 입력해주세요"); return; }
    if (!/^[a-z][a-z0-9._]*$/i.test(loginId)) {
      setError("로그인 ID는 영문/숫자/마침표만 사용 (영문 시작)");
      return;
    }

    const list = loadUsers();
    if (isNew && list.some(u => u.loginId === loginId)) {
      setError(`"${loginId}"는 이미 사용 중입니다`);
      return;
    }

    let saved = { ...data, name, loginId };
    if (isNew) {
      saved.id = generateUserId(loginId);
      saveUsers([saved, ...list]);
    } else {
      saveUsers(list.map(u => u.id === saved.id ? saved : u));
    }
    onSaved && onSaved(saved);
  }

  function handleDelete() {
    if (isNew) return;
    if (!window.confirm(`"${data.name}" 사용자를 삭제할까요?\n\n복구 불가합니다.`)) return;
    const list = loadUsers();
    saveUsers(list.filter(u => u.id !== data.id));
    onSaved && onSaved(null);
  }

  // 선택 역할의 권한 미리보기
  const rolePermissions = Object.entries(PERMISSIONS)
    .filter(([_, allowed]) => allowed.includes(data.role))
    .map(([perm]) => perm);

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Spoqa Han Sans Neo', sans-serif", paddingBottom: 80 }}>
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>{isNew ? "사용자 추가" : "사용자 편집"}</div>
        {!isNew && (
          <button onClick={handleDelete} style={dangerBtnStyle}>삭제</button>
        )}
      </div>

      <div style={{ padding: "16px" }}>
        <Field label="이름">
          <input
            type="text" placeholder="예: 김지혜"
            value={data.name || ""}
            onChange={(e) => updateField("name", e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="로그인 ID (영문/숫자)">
          <input
            type="text" placeholder="예: kim.jihye"
            value={data.loginId || ""}
            onChange={(e) => updateField("loginId", e.target.value)}
            style={{ ...inputStyle, fontFamily: "monospace" }}
          />
        </Field>

        <Field label="비밀번호">
          <input
            type="text" placeholder={isNew ? "초기 비밀번호" : "변경하지 않으려면 비워두세요"}
            value={data.password || ""}
            onChange={(e) => updateField("password", e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="역할">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(ROLES).map(([k, r]) => {
              const active = data.role === k;
              return (
                <div
                  key={k}
                  onClick={() => updateField("role", k)}
                  style={{
                    padding: "10px 14px",
                    background: active ? r.color + "20" : "var(--bg-secondary)",
                    border: `1px solid ${active ? r.color : "var(--bg-tertiary)"}`,
                    borderRadius: 8, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 10,
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: r.color, flexShrink: 0,
                  }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? r.color : "var(--text-primary)" }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
                      {r.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Field>

        {data.role === "engineer" && <EngineerLinkField data={data} updateField={updateField}/>}
        {data.role === "principal" && <PrincipalLinkField data={data} updateField={updateField}/>}
        {["owner", "admin", "happycall"].includes(data.role) && (
          <RoleScopeInfo role={data.role}/>
        )}

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
              position: "relative", flexShrink: 0,
            }}>
              <div style={{
                position: "absolute", top: 2,
                left: data.active ? 18 : 2,
                width: 16, height: 16, borderRadius: "50%",
                background: "var(--text-primary)",
              }}/>
            </div>
            <span style={{ fontSize: 12, color: data.active ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {data.active ? "활성 (로그인 가능)" : "비활성 (로그인 불가)"}
            </span>
          </div>
        </Field>

        {/* 권한 미리보기 */}
        <Field label={`권한 미리보기 (${rolePermissions.length}개)`}>
          <div style={{
            background: "var(--bg-inset)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "10px 12px",
            fontSize: 10, color: "var(--text-secondary)", fontFamily: "monospace",
            maxHeight: 140, overflow: "auto",
          }}>
            {rolePermissions.map(p => (
              <div key={p} style={{ color: "#00875A", lineHeight: 1.7 }}>✓ {p}</div>
            ))}
            {rolePermissions.length === 0 && <div style={{ color: "var(--text-tertiary)" }}>권한 없음</div>}
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

// ===== 연결 필드 (V4 명확화) =====
function EngineerLinkField({ data, updateField }) {
  const engineers = loadEngineers();
  const selected = engineers.find(e => e.id === data.engineerId);
  return (
    <Field label="연결할 기사">
      <select
        value={data.engineerId || ""}
        onChange={(e) => updateField("engineerId", e.target.value)}
        style={{ ...inputStyle, fontFamily: "inherit" }}
      >
        <option value="">선택해주세요</option>
        {engineers.map(eng => {
          const lvl = CAREER_LEVELS[eng.careerLevel];
          return (
            <option key={eng.id} value={eng.id}>
              {eng.name} ({lvl?.name || "—"})
            </option>
          );
        })}
      </select>
      <InfoBox color="#FF1B8D">
        ℹ️ 이 사용자는 <strong>{selected?.name || "선택한 기사"}</strong>의 작업만 볼 수 있습니다.<br/>
        · 자기 작업: 보임<br/>
        · 자기 수익: 보임 (단가 × 수량)<br/>
        · 회사 마진: 안 보임<br/>
        · 다른 기사 작업: 안 보임
      </InfoBox>
    </Field>
  );
}

function PrincipalLinkField({ data, updateField }) {
  const principals = loadPrincipals();
  const selected = principals.find(p => p.id === data.principalId);
  return (
    <Field label="소속 원청">
      <select
        value={data.principalId || ""}
        onChange={(e) => updateField("principalId", e.target.value)}
        style={{ ...inputStyle, fontFamily: "inherit" }}
      >
        <option value="">선택해주세요</option>
        {principals.map(p => (
          <option key={p.id} value={p.id}>
            {p.name}{p.nickname ? ` (${p.nickname})` : ""}
          </option>
        ))}
      </select>
      <InfoBox color="#FF1B8D">
        ℹ️ 이 사용자는 <strong>{selected?.name || "선택한 원청"}</strong>의 작업만 볼 수 있습니다.<br/>
        · 다른 원청 작업: 안 보임<br/>
        · 회사 마진: 안 보임<br/>
        · 기사 단가: 안 보임 (쿨가이는 가짜 단가만)<br/>
        · 고객 연락처: 마스킹 (010-****-1234)
      </InfoBox>
    </Field>
  );
}

function RoleScopeInfo({ role }) {
  const TEXT = {
    owner:     "전체 권한 (회사 마진 / 가짜 단가 / 모든 데이터)",
    admin:     "운영 권한 (회사 마진 보임 / 가짜 단가는 안 보임)",
    happycall: "접수 / 일정 권한 (수수료 / 마진 정보는 안 보임)",
  };
  return (
    <div style={{ marginBottom: 18 }}>
      <InfoBox color="#00875A">
        ℹ️ 이 역할은 별도 연결 없이 모든 데이터에 접근합니다.<br/>
        · {TEXT[role]}
      </InfoBox>
    </div>
  );
}

function InfoBox({ children, color = "#FF1B8D" }) {
  return (
    <div style={{
      marginTop: 8,
      padding: "10px 12px",
      background: color + "12",
      border: `1px solid ${color}40`,
      borderRadius: 8,
      fontSize: 11, color: "var(--text-primary)", lineHeight: 1.6,
    }}>
      {children}
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

export default UserEditScreen;

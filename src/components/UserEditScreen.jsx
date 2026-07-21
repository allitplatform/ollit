// 2026-07-21 v3 — 사용자 편집 재설계 (사장님 spec).
//   · 로직 무손상: Mig 103 RPC 3종 (admin_upsert_user / set_user_roles / reset_user_password) 흐름 그대로.
//   · 레이아웃만 재구성: PC(1024px+) 2단 — 좌 "기본 정보"(이름/전화/비번/활성) / 우 "역할"(선택+연결+권한).
//     모바일 1열. 역할 선택은 컴팩트 행 (옛 세로 풀스택 → 정리).
//   · 권한 미리보기는 접이식 (기본 접힘 — 매번 스크롤 차지하던 것 정리).
//   · 역할 색은 data/users.js ROLES 정비본 사용 (관리자 색 묻힘 fix).
import { useState, useEffect } from "react";
import {
  loadUsers, saveUsers, generateUserId, ROLES, PERMISSIONS,
} from "../data/users.js";
import { loadPrincipals } from "../data/principals.js";
import { loadEngineers, CAREER_LEVELS } from "../data/engineers.js";
import {
  upsertUserToDb, setUserRolesToDb, resetUserPasswordToDb,
} from "../lib/usersDb.js";

// PWA role → DB default_role (admin_upsert_user 신규 INSERT 시)
const PWA_ROLE_TO_DEFAULT = {
  owner:     "owner",
  admin:     "admin",
  engineer:  "engineer",
  happycall: "operator",
  principal: "operator",   // principal 신규는 본 화면 범위 밖 — 안전 fallback
};

function useIsPc() {
  const [isPc, setIsPc] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const fn = (e) => setIsPc(e.matches);
    mq.addEventListener ? mq.addEventListener("change", fn) : mq.addListener(fn);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", fn) : mq.removeListener(fn);
    };
  }, []);
  return isPc;
}

export function UserEditScreen({ user, isNew, onSaved, onBack }) {
  const isPc = useIsPc();
  const [data, setData] = useState({ ...user });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [originalRole] = useState(user?.role || "");
  const [showPerms, setShowPerms] = useState(false);  // 권한 미리보기 접이식

  function updateField(field, value) {
    setData(d => ({ ...d, [field]: value }));
  }

  // ── 저장 (로직 v2 그대로 — Mig 103) ──────────────────────────
  async function handleSave() {
    setError("");
    const name = (data.name || "").trim();
    if (!name) { setError("이름을 입력해주세요"); return; }
    const phone = (data.phone || "").trim();
    if (!phone) { setError("전화번호를 입력해주세요 (= 로그인 아이디)"); return; }

    setBusy(true);
    try {
      // [1] users 행 upsert
      const patch = {
        name,
        phone,
        is_active: !!data.active,
      };
      if (data.email)  patch.email  = String(data.email);
      if (data.region) patch.region = String(data.region);
      if (isNew) {
        patch.default_role = PWA_ROLE_TO_DEFAULT[data.role] || "operator";
      }

      const up = await upsertUserToDb({
        code: isNew ? null : (data.id || data.userId || null),
        patch,
      });
      if (!up.ok) { setError(up.error || "저장 실패"); setBusy(false); return; }
      const userIdForRoles = up.userId;   // DB UUID — set_user_roles 에서 사용
      const savedCode      = up.code || data.id;

      // [2] 역할 변경 — 기존 != 새 역할이면 set_user_roles 호출 (DB UUID 필요)
      //     신규(isNew)는 admin_upsert_user 가 이미 default_role 1개 INSERT 함 → skip.
      if (!isNew && data.role && data.role !== originalRole) {
        if (!userIdForRoles) {
          setError("역할 변경 실패: 사용자 UUID 미수신");
          setBusy(false);
          return;
        }
        const rr = await setUserRolesToDb({
          userId:   userIdForRoles,
          pwaRoles: [data.role],
        });
        if (!rr.ok) { setError(rr.error || "역할 변경 실패"); setBusy(false); return; }
      }

      // [3] 비번 입력됐으면 리셋
      if (data.password && String(data.password).length > 0) {
        if (!userIdForRoles) {
          setError("비번 리셋 실패: 사용자 UUID 미수신");
          setBusy(false);
          return;
        }
        if (String(data.password).length < 4) {
          setError("비밀번호는 4자 이상");
          setBusy(false);
          return;
        }
        const rp = await resetUserPasswordToDb({
          userId:      userIdForRoles,
          newPassword: data.password,
        });
        if (!rp.ok) { setError(rp.error || "비번 리셋 실패"); setBusy(false); return; }
      }

      // [4] localStorage 캐시 즉시 갱신 (UI 즉시 반영)
      const list = loadUsers();
      const saved = { ...data, name, phone, id: savedCode || data.id };
      if (isNew) {
        if (!saved.id) saved.id = generateUserId(savedCode || "user");
        saveUsers([saved, ...list]);
      } else {
        saveUsers(list.map(u => u.id === saved.id ? saved : u));
      }
      setBusy(false);
      onSaved && onSaved(saved);
    } catch (e) {
      console.error("[UserEditScreen.handleSave]", e);
      setError(e?.message || "저장 중 오류");
      setBusy(false);
    }
  }

  // ── 비활성 (로직 v2 그대로 — "삭제" 아님, is_active=false) ──────
  async function handleDelete() {
    if (isNew) return;
    if (!window.confirm(`"${data.name}" 을(를) 비활성으로 끄시겠어요?\n\n로그인 불가 상태가 됩니다 (행은 보존).`)) return;
    setBusy(true);
    try {
      const up = await upsertUserToDb({
        code:  data.id || data.userId,
        patch: { is_active: false },
      });
      if (!up.ok) { setError(up.error || "비활성 실패"); setBusy(false); return; }
      const list = loadUsers();
      saveUsers(list.map(u => u.id === data.id ? { ...u, active: false } : u));
      setBusy(false);
      onSaved && onSaved({ ...data, active: false });
    } catch (e) {
      console.error("[UserEditScreen.handleDelete]", e);
      setError(e?.message || "비활성 중 오류");
      setBusy(false);
    }
  }

  // 선택 역할의 권한 미리보기
  const rolePermissions = Object.entries(PERMISSIONS)
    .filter(([_, allowed]) => allowed.includes(data.role))
    .map(([perm]) => perm);

  const selectedRole = ROLES[data.role];

  // ── 카드: 기본 정보 ──
  const basicCard = (
    <Card title="👤 기본 정보">
      <Field label="이름">
        <input
          type="text" placeholder="예: 김지혜"
          value={data.name || ""}
          onChange={(e) => updateField("name", e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field label="전화번호 (= 로그인 아이디)" hint="⚠️ 바꾸면 새 번호로만 로그인할 수 있어요.">
        <input
          type="tel" placeholder="예: 010-1234-5678"
          value={data.phone || ""}
          onChange={(e) => updateField("phone", e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field label="비밀번호"
        hint={isNew
          ? "비워두면 휴대폰 끝 4자리로 자동 설정돼요."
          : "입력 시 리셋됩니다 — 사용자는 다음 로그인에서 본인 비번을 다시 설정해야 해요."}>
        <input
          type="text" placeholder={isNew ? "비워두면 자동 설정" : "변경하지 않으려면 비워두세요"}
          value={data.password || ""}
          onChange={(e) => updateField("password", e.target.value)}
          style={inputStyle}
        />
      </Field>

      {/* 활성 토글 */}
      <div
        onClick={() => updateField("active", !data.active)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px",
          background: "var(--bg-secondary)", border: "1px solid var(--border)",
          borderRadius: 10, cursor: "pointer",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>
            {data.active ? "활성" : "비활성"}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-secondary)", marginTop: 2 }}>
            {data.active ? "로그인 가능" : "로그인 불가 (계정은 보존)"}
          </div>
        </div>
        <Switch on={!!data.active}/>
      </div>
    </Card>
  );

  // ── 카드: 역할 ──
  const roleCard = (
    <Card title="🎭 역할" sub={selectedRole ? selectedRole.name : "선택해주세요"}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {Object.entries(ROLES).map(([k, r]) => {
          const active = data.role === k;
          return (
            <div
              key={k}
              onClick={() => updateField("role", k)}
              style={{
                padding: "10px 14px",
                background: active ? r.color + "1C" : "var(--bg-secondary)",
                border: `1px solid ${active ? r.color : "var(--border)"}`,
                borderRadius: 9, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <span style={{
                width: 9, height: 9, borderRadius: "50%",
                background: r.color, flexShrink: 0,
                boxShadow: active ? `0 0 0 3px ${r.color}30` : "none",
              }}/>
              <span style={{
                fontSize: 13, fontWeight: active ? 800 : 600,
                color: active ? r.color : "var(--text-primary)",
                flexShrink: 0,
              }}>{r.name}</span>
              <span style={{ fontSize: 10.5, color: "var(--text-secondary)", marginLeft: "auto", textAlign: "right" }}>
                {r.desc}
              </span>
            </div>
          );
        })}
      </div>

      {data.role === "engineer" && <EngineerLinkField data={data} updateField={updateField}/>}
      {data.role === "principal" && <PrincipalLinkField data={data} updateField={updateField}/>}
      {["owner", "admin", "happycall"].includes(data.role) && (
        <RoleScopeInfo role={data.role}/>
      )}

      {/* 권한 미리보기 — 접이식 */}
      <div>
        <button onClick={() => setShowPerms(v => !v)} style={{
          background: "transparent", border: "none", padding: "4px 0",
          fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)",
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span>{showPerms ? "▾" : "▸"}</span>
          권한 미리보기 ({rolePermissions.length}개)
        </button>
        {showPerms && (
          <div style={{
            marginTop: 6,
            background: "var(--bg-inset, var(--bg-secondary))", border: "1px solid var(--border)",
            borderRadius: 8, padding: "10px 12px",
            fontSize: 10, color: "var(--text-secondary)",
            maxHeight: 160, overflow: "auto",
          }}>
            {rolePermissions.map(p => (
              <div key={p} style={{ color: "#00875A", lineHeight: 1.7 }}>✓ {p}</div>
            ))}
            {rolePermissions.length === 0 && <div style={{ color: "var(--text-tertiary)" }}>권한 없음</div>}
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif", paddingBottom: 80 }}>
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>{isNew ? "사용자 추가" : `사용자 편집${data.name ? " — " + data.name : ""}`}</div>
        {!isNew ? (
          <button onClick={handleDelete} disabled={busy} style={dangerBtnStyle}>끄기(비활성)</button>
        ) : <div style={{ width: 40 }}/>}
      </div>

      <div style={{ padding: isPc ? "24px 28px" : 16, maxWidth: 1120, margin: "0 auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: isPc ? "1fr 1fr" : "1fr",
          gap: 20, alignItems: "start",
        }}>
          {basicCard}
          {roleCard}
        </div>

        {error && (
          <div style={{
            margin: "16px 0 0", padding: "10px 12px",
            background: "rgba(239, 68, 68, 0.10)",
            border: "1px solid rgba(239, 68, 68, 0.30)",
            borderRadius: 8, color: "#FF3D5A",
            fontSize: 12, textAlign: "center",
          }}>{error}</div>
        )}

        <div style={{ marginTop: 20, display: "flex", gap: 10, maxWidth: isPc ? 480 : "none" }}>
          <button onClick={onBack} disabled={busy} style={cancelBtnStyle}>취소</button>
          <button onClick={handleSave} disabled={busy} style={{ ...saveBtnStyle, opacity: busy ? 0.6 : 1 }}>
            {busy ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 연결 필드 (V4 명확화 — 내용 유지, 스타일만 카드 톤) =====
function EngineerLinkField({ data, updateField }) {
  const engineers = loadEngineers();
  const selected = engineers.find(e => e.id === data.engineerId);
  return (
    <Field label="연결할 프로">
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
        ℹ️ 이 사용자는 <strong>{selected?.name || "선택한 프로"}</strong>의 작업만 볼 수 있습니다.<br/>
        · 자기 작업: 보임<br/>
        · 자기 수익: 보임 (단가 × 수량)<br/>
        · 회사 마진: 안 보임<br/>
        · 다른 프로 작업: 안 보임
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
      <InfoBox color="#0EA5E9">
        ℹ️ 이 사용자는 <strong>{selected?.name || "선택한 원청"}</strong>의 작업만 볼 수 있습니다.<br/>
        · 다른 원청 작업: 안 보임<br/>
        · 회사 마진: 안 보임<br/>
        · 프로 단가: 안 보임 (쿨가이는 가짜 단가만)<br/>
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
    <InfoBox color="#00875A">
      ℹ️ 이 역할은 별도 연결 없이 모든 데이터에 접근합니다.<br/>
      · {TEXT[role]}
    </InfoBox>
  );
}

// ===== 공용 소품 =====
function Card({ title, sub, children }) {
  return (
    <section style={{
      background: "var(--bg-elevated, var(--bg-secondary))",
      border: "1px solid var(--border)",
      borderRadius: 14, overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "baseline", gap: 8,
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{title}</h2>
        {sub && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{sub}</span>}
      </div>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </section>
  );
}

function Switch({ on }) {
  return (
    <div style={{
      width: 38, height: 21, borderRadius: 999,
      background: on ? "#00875A" : "var(--bg-tertiary, var(--border))",
      position: "relative", flexShrink: 0,
      transition: "background 0.15s",
    }}>
      <div style={{
        position: "absolute", top: 2.5, left: on ? 19 : 3,
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff", transition: "left 0.18s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }}/>
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

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 700 }}>
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 5, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 16px", borderBottom: "1px solid var(--border)",
  position: "sticky", top: 0, background: "var(--bg-primary)", zIndex: 10,
};
const backBtnStyle = { background: "none", border: "none", color: "var(--text-primary)", fontSize: 18, cursor: "pointer", padding: 4 };
const titleStyle = { fontSize: 15, fontWeight: 700, flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
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
  flex: 2, background: "var(--accent, #FF1B8D)", border: "none",
  color: "#fff", fontSize: 14, fontWeight: 700,
  padding: 12, borderRadius: 10, cursor: "pointer",
  fontFamily: "inherit",
};

export default UserEditScreen;

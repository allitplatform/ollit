// V14 — 기사 PWA 내 정보 (단순 / 5개 메뉴)
// 헤더 + 프로필 + 메뉴 리스트 (담당구역 / 계좌 / 화면모드 / 운영팀 / 로그아웃)
// 활동 통계 / AI / 알림설정 / 위치권한 X (사장님 catch)

import { EngineerBottomNav } from "./EngineerBottomNav.jsx";

export function EngineerMeTab({
  engineer,
  theme = "dark",
  onChangeTheme,
  onContactOps,
  onChangeAccount,
  onRegions,
  onLogout,
  onTabChange,
  unreadCount = 0,
}) {
  const eng = engineer || {};
  const themeLabel = theme === "light" ? "라이트" : theme === "auto" ? "자동" : "다크";

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      paddingBottom: 80,
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>👤 내 정보</div>
      </div>

      {/* 프로필 */}
      <div style={{
        padding: "32px 16px 28px",
        borderBottom: "1px solid var(--border)",
        textAlign: "center",
      }}>
        <div style={{
          width: 84, height: 84, borderRadius: "50%",
          background: "#FF1B8D",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, fontWeight: 800, color: "#fff",
          marginBottom: 14,
        }}>
          {(eng.name || "?").charAt(0)}
        </div>
        <div style={{
          fontSize: 22, fontWeight: 800,
          color: "var(--text-primary)",
        }}>
          {eng.name || "—"} 기사
        </div>
        <div style={{
          fontSize: 14,
          fontFamily: "inherit", fontWeight: 700,
          color: "var(--text-secondary)",
          marginTop: 6,
        }}>
          {eng.phone || "—"}
        </div>
        {eng.companyName && (
          <div style={{ marginTop: 10 }}>
            <span style={{
              display: "inline-flex", padding: "4px 10px",
              background: "rgba(255,27,141,0.10)",
              borderRadius: 6,
              fontSize: 12, color: "#FF1B8D", fontWeight: 800,
            }}>
              {eng.companyName}
            </span>
          </div>
        )}
      </div>

      {/* 메뉴 리스트 */}
      <div style={{ padding: 16 }}>
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}>
          {/* 1. 담당 구역 */}
          <MenuRow
            icon="📍"
            label="담당 구역"
            desc={(eng.regions || []).join(" · ") || "—"}
            onClick={onRegions}
          />
          <Divider/>

          {/* 2. 계좌 변경 */}
          <MenuRow
            icon="💳"
            label="계좌 변경"
            desc={
              eng.bankName && eng.accountNumber
                ? `${eng.bankName} ${eng.accountNumber}`
                : "—"
            }
            onClick={onChangeAccount}
          />
          <Divider/>

          {/* 3. 화면 모드 — 인라인 토글 3개 */}
          <div style={{ padding: "14px 14px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 18, marginRight: 12 }}>🌗</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>화면 모드</div>
                <div style={{
                  fontSize: 12, color: "var(--text-secondary)",
                  fontWeight: 600, marginTop: 2,
                }}>
                  현재 {themeLabel} 모드
                </div>
              </div>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6,
              marginLeft: 30,
            }}>
              <ThemeBtn label="☀️ 라이트" active={theme === "light"} onClick={() => onChangeTheme && onChangeTheme("light")}/>
              <ThemeBtn label="🌙 다크"   active={theme === "dark"}  onClick={() => onChangeTheme && onChangeTheme("dark")}/>
              <ThemeBtn label="⚙️ 자동"   active={theme === "auto"}  onClick={() => onChangeTheme && onChangeTheme("auto")}/>
            </div>
          </div>
          <Divider/>

          {/* 4. 운영팀 연락 */}
          <MenuRow
            icon="💬"
            label="운영팀 연락"
            desc="문의 / 변경 요청"
            onClick={onContactOps}
          />
          <Divider/>

          {/* 5. 로그아웃 */}
          <div
            onClick={onLogout}
            style={{
              display: "flex", alignItems: "center", padding: "14px 14px",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 18, marginRight: 12 }}>🚪</span>
            <div style={{
              flex: 1,
              fontSize: 16, fontWeight: 700,
              color: "#FF3B5C",
            }}>
              로그아웃
            </div>
          </div>
        </div>
      </div>

      <EngineerBottomNav active="me" onChange={onTabChange} unreadCount={unreadCount}/>
    </div>
  );
}

function MenuRow({ icon, label, desc, onClick }) {
  return (
    <div
      onClick={onClick}
      className="clickable"
      style={{
        display: "flex", alignItems: "center", padding: "14px 14px",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={{ fontSize: 18, marginRight: 12 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
          {label}
        </div>
        {desc && (
          <div style={{
            fontSize: 13, color: "var(--text-secondary)",
            fontWeight: 600, marginTop: 3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {desc}
          </div>
        )}
      </div>
      <span style={{ fontSize: 18, color: "var(--text-secondary)" }}>›</span>
    </div>
  );
}

function ThemeBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 8px",
      background: active ? "#FF1B8D" : "transparent",
      border: active ? "1px solid #FF1B8D" : "1px solid var(--border)",
      borderRadius: 8,
      color: active ? "#fff" : "var(--text-secondary)",
      fontSize: 13, fontWeight: 700,
      cursor: "pointer", fontFamily: "inherit",
    }}>
      {label}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--border)" }}/>;
}

export default EngineerMeTab;

// V13-FINAL2 — 기사 PWA 내 정보 탭
// 평점 X / 전담 배지 X (사장님 catch)
// 누적 작업 + 완료율 (2박스 / 더 큼)
// 운영팀 연락 = 노랑 강조 (전화 + 채팅)
// AI 도우미 = NEW 배지

import { EngineerBottomNav } from "./EngineerBottomNav.jsx";

const ICON_PHONE_WHITE = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
       stroke="#fff" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

export function EngineerMeTab({
  engineer,
  monthStats,
  isDark,
  locationGranted,
  onToggleTheme,
  onCallOps,
  onChatOps,
  onEdit,
  onChangeAccount,
  onNotiSettings,
  onLocationSettings,
  onRegions,
  onAi,
  onHelp,
  onAppInfo,
  onLogout,
  onTabChange,
  unreadCount = 0,
}) {
  const eng = engineer || {};
  const stats = monthStats || {};

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      paddingBottom: 80,
      color: "var(--text-primary)",
    }}>
      {/* 헤더 */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>👤 내 정보</div>
      </div>

      {/* V13-FINAL2-fix2 — 프로필 크게 (76 / 22 / 14) */}
      <div style={{
        padding: "28px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{
          width: 76, height: 76, borderRadius: "50%",
          background: "#FF1B8D",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, fontWeight: 700, color: "#fff",
        }}>
          {(eng.name || "?").charAt(0)}
        </div>
        <div style={{ flex: 1 }}>
          {eng.companyName && (
            <div>
              <span style={{
                display: "inline-flex", padding: "3px 8px",
                background: "rgba(255,27,141,0.15)", borderRadius: 6,
                fontSize: 10, color: "#FF1B8D", fontWeight: 700,
              }}>
                {eng.companyName}
              </span>
            </div>
          )}
          <div style={{
            fontSize: 22, fontWeight: 700,
            marginTop: eng.companyName ? 6 : 0,
          }}>
            {eng.name || "—"} 프로
          </div>
          <div style={{
            fontSize: 14, color: "var(--text-primary)",
            marginTop: 4, fontFamily: "monospace",
            fontWeight: 500,
          }}>
            {eng.phone || "—"}
          </div>
        </div>
      </div>

      {/* 2. 입금 받을 계좌 */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          fontSize: 13, color: "var(--text-secondary)",
          fontWeight: 700, marginBottom: 8,
        }}>
          🏦 입금 받을 계좌
        </div>
        <div style={{
          background: "var(--bg-secondary)",
          borderRadius: 10, padding: 12,
        }}>
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: 6,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {eng.bankName || "—"}
            </div>
            <button onClick={onChangeAccount} style={{
              padding: "4px 8px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text-secondary)",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            }}>
              변경
            </button>
          </div>
          <div style={{ fontSize: 14, fontFamily: "monospace", marginBottom: 4 }}>
            {eng.accountNumber || "—"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            예금주: {eng.accountHolder || "—"}
          </div>
        </div>
      </div>

      {/* 3. 담당 구역 (표시만 / 변경은 운영팀 요청) */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          fontSize: 13, color: "var(--text-secondary)",
          fontWeight: 700, marginBottom: 8,
        }}>
          🚗 담당 구역
        </div>
        <div
          onClick={onRegions}
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 10, padding: 12, cursor: "pointer",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 4,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              {(eng.regions || []).join(" · ") || "—"}
            </span>
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>›</span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
            변경은 운영팀에 요청
          </div>
        </div>
      </div>

      {/* 4. 이번 달 활동 */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          fontSize: 13, color: "var(--text-secondary)",
          fontWeight: 700, marginBottom: 8,
        }}>
          📊 이번 달 활동 ({stats.month || new Date().getMonth() + 1}월)
        </div>
        <div style={{
          background: "var(--bg-secondary)",
          borderRadius: 10, padding: 12,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <StatRow label="완료한 작업" value={`${stats.count || 0}건`}/>
            <StatRow
              label="총 수익"
              value={`₩${(stats.earning || 0).toLocaleString("ko-KR")}`}
              color="#FF1B8D"
            />
            <StatRow label="평균 일일 작업" value={`${stats.avgPerDay || 0}건`}/>
            <StatRow label="작업 시간" value={`${stats.totalHours || 0}h`}/>
          </div>
        </div>
      </div>

      {/* 4. 운영팀 연락 (노랑 강조) ⭐ */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          fontSize: 13, color: "var(--text-secondary)",
          fontWeight: 700, marginBottom: 8,
        }}>
          🆘 운영팀 연락
        </div>
        <div style={{
          background: "rgba(255,179,0,0.08)",
          border: "1px solid rgba(255,179,0,0.3)",
          borderRadius: 10, padding: 4,
        }}>
          <div style={{
            display: "flex", alignItems: "center",
            padding: 12,
          }}>
            <span style={{ fontSize: 18, marginRight: 10 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#FFB300" }}>
                긴급 / 도움 요청
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                현장 문제 / 일정 문의
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(255,179,0,0.15)", margin: "0 12px" }}/>

          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 8,
          }}>
            <button
              onClick={onCallOps}
              style={{
                padding: 10,
                background: "#FFB300", border: "none",
                borderRadius: 6, color: "#fff",
                fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: 6,
              }}
            >
              {ICON_PHONE_WHITE} 전화
            </button>
            <button
              onClick={onChatOps}
              style={{
                padding: 10,
                background: "transparent",
                border: "1px solid #FFB300",
                borderRadius: 6, color: "#FFB300",
                fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: 6,
              }}
            >
              💬 채팅
            </button>
          </div>
        </div>
      </div>

      {/* 5. 설정 */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          fontSize: 13, color: "var(--text-secondary)",
          fontWeight: 700, marginBottom: 8,
        }}>
          ⚙️ 설정
        </div>
        <div style={{
          background: "var(--bg-secondary)",
          borderRadius: 10, padding: 4,
        }}>
          <SettingRow icon="🌙" label="다크 모드" toggle={!!isDark} onToggle={onToggleTheme}/>
          <Divider/>
          <SettingRow
            icon="🔔" label="알림 설정"
            desc="새 배정 / 일정 변경 / 정산"
            onClick={onNotiSettings}
          />
          <Divider/>
          <SettingRow
            icon="📍" label="위치 권한"
            desc={locationGranted ? "허용됨" : "필요"}
            descColor={locationGranted ? "#00875A" : "#FF3D5A"}
            onClick={onLocationSettings}
          />
        </div>
      </div>

      {/* 6. 도움 (AI / 도움말 / 앱 정보) */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          background: "var(--bg-secondary)",
          borderRadius: 10, padding: 4,
        }}>
          <SettingRow
            icon="🤖" label="AI 도우미"
            desc="작업 질문 / 추천 / 자주 묻는 질문"
            descColor="#FF1B8D"
            badge="NEW"
            onClick={onAi}
          />
          <Divider/>
          <SettingRow icon="❓" label="도움말" onClick={onHelp}/>
          <Divider/>
          <SettingRow icon="📋" label="앱 정보" rightText="v1.0.0" onClick={onAppInfo}/>
        </div>
      </div>

      {/* 7. 로그아웃 */}
      <div style={{ padding: "14px 16px" }}>
        <button onClick={onLogout} style={{
          width: "100%", padding: 12,
          background: "transparent",
          border: "1px solid #FF3D5A",
          borderRadius: 8, color: "#FF3D5A",
          fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          로그아웃
        </button>
      </div>

      <EngineerBottomNav active="me" onChange={onTabChange} unreadCount={unreadCount}/>
    </div>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{
        fontSize: 14, fontWeight: 700, fontFamily: "monospace",
        color: color || "var(--text-primary)",
      }}>
        {value}
      </span>
    </div>
  );
}

function SettingRow({ icon, label, desc, descColor, toggle, onToggle, badge, rightText, onClick }) {
  const clickable = onClick || onToggle;
  return (
    <div
      onClick={() => {
        if (onToggle !== undefined) onToggle && onToggle(!toggle);
        else if (onClick) onClick();
      }}
      style={{
        display: "flex", alignItems: "center", padding: 12,
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <span style={{ fontSize: 15, marginRight: 10 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        {desc && (
          <div style={{
            fontSize: 11,
            color: descColor || "var(--text-secondary)",
            marginTop: 2,
          }}>
            {desc}
          </div>
        )}
      </div>
      {toggle !== undefined ? (
        <ToggleSwitch on={toggle}/>
      ) : badge ? (
        <span style={{
          padding: "2px 6px", background: "rgba(255,27,141,0.15)",
          borderRadius: 8, fontSize: 8,
          color: "#FF1B8D", fontWeight: 700,
        }}>
          {badge}
        </span>
      ) : rightText ? (
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{rightText}</span>
      ) : (
        <span style={{ fontSize: 15, color: "var(--text-secondary)" }}>›</span>
      )}
    </div>
  );
}

function ToggleSwitch({ on }) {
  return (
    <div style={{
      width: 36, height: 20, borderRadius: 10,
      background: on ? "#FF1B8D" : "var(--border)",
      position: "relative",
      transition: "background 0.2s",
    }}>
      <div style={{
        position: "absolute", top: 2,
        left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff",
        transition: "left 0.2s",
      }}/>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--border)", margin: "0 12px" }}/>;
}

export default EngineerMeTab;

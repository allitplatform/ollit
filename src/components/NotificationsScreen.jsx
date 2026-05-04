// Step 8+9 V3 — 알림 (자체 시스템 + PWA 푸시)
// 외부 메신저 (텔레그램 등) 사용 안 함 — 자체 운영
import { useState } from "react";

const STORAGE_KEY = "ollit_notification_settings_v1";

const DEFAULT_SETTINGS = {
  // 채널
  inApp:    true,    // 시스템 알림 (인앱) — 기본 ON
  webPush:  false,   // PWA 푸시 — Phase 1B
  email:    false,   // 이메일 — Phase 3
  // 알림 종류
  newOrder:        true,
  assignment:      true,
  scheduleChange:  true,
  taskComplete:    true,
  taskCancel:      true,   // 부분완료 / 출장비만 / 취소
  settlement:      false,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) { console.error(e); }
  return DEFAULT_SETTINGS;
}

function saveSettings(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (e) { console.error(e); }
}

export function NotificationsScreen({ onBack }) {
  const [settings, setSettings] = useState(() => loadSettings());

  function toggle(key) {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    saveSettings(next);
  }

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif", paddingBottom: 80 }}>
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>알림</div>
        <div style={{ width: 40 }}/>
      </div>

      <div style={{ padding: 16 }}>
        <InfoBox>
          ℹ️ 올잇 시스템 안에서 알림을 받습니다.<br/>
          외부 메신저는 사용하지 않습니다.
        </InfoBox>

        {/* 채널 */}
        <SectionLabel>발송 채널</SectionLabel>

        <ChannelCard
          icon="🔔" name="시스템 알림 (인앱)"
          status="✓ 활성"
          statusColor="#00875A"
          desc="앱 안에서 빨간 점으로 표시"
          enabled={settings.inApp}
          onToggle={() => toggle("inApp")}
          interactive={true}
        />

        <ChannelCard
          icon="📱" name="푸시 알림 (PWA)"
          status="준비중 (Phase 1B)"
          desc="휴대폰 잠금화면에 알림"
          enabled={false}
          interactive={false}
        />

        <ChannelCard
          icon="📧" name="이메일"
          status="준비중 (Phase 3)"
          desc="정산 / 일일 리포트만"
          enabled={false}
          interactive={false}
        />

        {/* 종류 */}
        <SectionLabel>알림 종류</SectionLabel>
        <ToggleRow label="새 접수 알림"           checked={settings.newOrder}        onToggle={() => toggle("newOrder")}/>
        <ToggleRow label="배정 알림"              checked={settings.assignment}      onToggle={() => toggle("assignment")}/>
        <ToggleRow label="일정 변경 알림"         checked={settings.scheduleChange}  onToggle={() => toggle("scheduleChange")}/>
        <ToggleRow label="작업 완료 알림"         checked={settings.taskComplete}    onToggle={() => toggle("taskComplete")}/>
        <ToggleRow label="부분완료/출장비만/취소 알림" checked={settings.taskCancel} onToggle={() => toggle("taskCancel")}/>
        <ToggleRow label="정산 완료 알림"         checked={settings.settlement}      onToggle={() => toggle("settlement")}/>
      </div>
    </div>
  );
}

function ChannelCard({ icon, name, status, statusColor, desc, enabled, onToggle, interactive }) {
  return (
    <div style={{
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "14px",
      marginBottom: 8, opacity: interactive ? 1 : 0.7,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{name}</div>
          <div style={{ fontSize: 10, color: statusColor || "var(--text-secondary)", marginTop: 2 }}>{status}</div>
        </div>
        {interactive && onToggle ? (
          <div onClick={onToggle} style={{ cursor: "pointer" }}>
            <Toggle enabled={enabled}/>
          </div>
        ) : (
          <Toggle enabled={enabled} disabled/>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {desc}
      </div>
    </div>
  );
}

function Toggle({ enabled, disabled }) {
  return (
    <div style={{
      width: 36, height: 20, borderRadius: 10,
      background: enabled ? "#00875A" : "var(--bg-tertiary)",
      position: "relative", flexShrink: 0,
      opacity: disabled ? 0.5 : 1,
    }}>
      <div style={{
        position: "absolute", top: 2,
        left: enabled ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%",
        background: "var(--text-primary)", transition: "left 0.2s",
      }}/>
    </div>
  );
}

function ToggleRow({ label, checked, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", marginBottom: 6,
        background: "var(--bg-secondary)", border: "1px solid var(--border)",
        borderRadius: 8, cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{label}</span>
      <Toggle enabled={checked}/>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, color: "var(--text-secondary)", fontWeight: 600,
      marginTop: 18, marginBottom: 8, letterSpacing: 0.3,
    }}>{children}</div>
  );
}

function InfoBox({ children }) {
  return (
    <div style={{
      background: "rgba(6,182,212,0.08)",
      border: "1px solid rgba(6,182,212,0.30)",
      borderRadius: 10, padding: "12px 14px", marginBottom: 8,
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

export default NotificationsScreen;

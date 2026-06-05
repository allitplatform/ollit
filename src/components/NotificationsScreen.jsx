// Step 8+9 V3 — 알림 (시스템 + PWA 푸시)
// 인앱 알림 (배지 등) / 외부 메신저 X / 자체 운영
// Step 6-2 — 푸시 알림 hook 박힘 (Phase 1B)
import { useState, useEffect } from "react";
import {
  subscribePushWithSync,
  unsubscribePushWithSync,
  isPushSupported,
  isStandalone,
  isIOS,
  getPermissionState,
  getCurrentSubscription,
} from "../utils/pushNotification.js";
import { getCurrentUser } from "../data/users.js";

const STORAGE_KEY = "ollit_notification_settings_v1";

const DEFAULT_SETTINGS = {
  inApp:    true,
  webPush:  false,
  email:    false,
  newOrder:        true,
  assignment:      true,
  scheduleChange:  true,
  taskComplete:    true,
  taskCancel:      true,
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

export function NotificationsScreen({ user, onBack }) {
  const [settings, setSettings] = useState(() => loadSettings());

  function toggle(key) {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    saveSettings(next);
  }

  // Step 6-2 — 푸시 알림 hook 박힘
  const currentUser = getCurrentUser(user);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushToast, setPushToast] = useState(null);

  useEffect(() => {
    if (!isPushSupported()) return;
    let cancelled = false;
    getCurrentSubscription().then(sub => {
      if (cancelled) return;
      const granted = getPermissionState() === "granted";
      setPushOn(!!(sub && granted));
    });
    return () => { cancelled = true; };
  }, []);

  function showPushToast(msg) {
    setPushToast(msg);
    setTimeout(() => setPushToast(null), 2800);
  }

  async function handlePushToggle() {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (!pushOn) {
        if (!isPushSupported()) { showPushToast("⚠️ 이 브라우저는 푸시 알림을 지원하지 않습니다"); return; }
        if (isIOS() && !isStandalone()) { showPushToast("⚠️ 홈 화면에 추가한 후 다시 시도해주세요"); return; }
        const res = await subscribePushWithSync({
          // 2026-06-06 — sign_in_with_phone (Mig 057) 응답 측 user_id (snake_case) 우선.
          //   옛 userId / id fallback 유지 — 다른 로그인 경로 호환.
          //   SettingsScreen 30c0fba 와 동일 패턴 — 본 화면 누락 정정.
          //   옛: userId가 buildAppUser code ('A004') 로 전달 → API UUID 검증 실패 → 400 → admin 구독 0건 사고.
          userId: currentUser?.user_id || currentUser?.userId || currentUser?.id || "",
          role:   currentUser?.role   || "admin",
        });
        if (res.ok) {
          setPushOn(true);
          showPushToast("✓ 푸시 알림이 활성화되었습니다");
        } else if (res.reason === "denied") {
          showPushToast("⚠️ 알림 권한이 거부되었습니다 (브라우저 설정에서 변경)");
        } else if (res.reason === "no_vapid") {
          showPushToast("⚠️ 푸시 설정이 되지 않았습니다");
        } else if (res.reason === "sync_failed") {
          setPushOn(true);
          showPushToast("✓ 활성화됨 (시트 sync 보류)");
        } else {
          showPushToast(`⚠️ ${res.error || "활성화 실패"}`);
        }
      } else {
        const res = await unsubscribePushWithSync({
          // 2026-06-06 — user_id 우선 (subscribe 라인 측 동일 매핑).
          userId: currentUser?.user_id || currentUser?.userId || currentUser?.id || "",
        });
        setPushOn(false);
        if (res.ok) showPushToast("✓ 푸시 알림이 비활성화되었습니다");
        else        showPushToast(`⚠️ ${res.error || "비활성화 실패"}`);
      }
    } finally {
      setPushBusy(false);
    }
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

        {/* Step 6-2 — 푸시 알림 (PWA) hook 박힘 */}
        <ChannelCard
          icon="📲" name="푸시 알림 (PWA)"
          status={pushBusy ? "처리 중.." : (pushOn ? "✓ 활성화됨" : "꺼짐 — 켜려면 클릭")}
          statusColor={pushOn ? "#00875A" : undefined}
          desc="브라우저 / 잠금화면에 알림"
          enabled={pushOn}
          onToggle={handlePushToggle}
          interactive={true}
        />

        <ChannelCard
          icon="✉️" name="이메일"
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

      {/* Step 6-2 — 푸시 토스트 박힘 */}
      {pushToast && (
        <div style={{
          position: "fixed", left: "50%", bottom: 80,
          transform: "translateX(-50%)",
          background: "rgba(0, 135, 90, 0.95)", color: "#fff",
          padding: "12px 18px", borderRadius: 10,
          fontSize: 12, fontWeight: 600,
          maxWidth: "90%", textAlign: "center", lineHeight: 1.5,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 9999, fontFamily: "inherit",
          pointerEvents: "none",
        }}>
          {pushToast}
        </div>
      )}
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
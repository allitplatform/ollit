// Step 8+9 V3 — 알림 (시스템 + PWA 푸시)
// 인앱 알림 (배지 등) / 외부 메신저 X / 자체 운영
// 2026-06-06 — 6 kind 토글 DB 연동 (Mig 101 user_notification_preferences).
//   row 없음 = 켜짐. UPSERT 측 set_notification_pref RPC.
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
import { fetchNotiPrefs, setNotiPref, NOTI_KINDS } from "../lib/notiPrefsDb.js";

// 채널 설정 (인앱/이메일) 은 여전히 localStorage. 6 kind 는 DB.
const CHANNEL_KEY = "ollit_notification_channels_v1";
const DEFAULT_CHANNELS = { inApp: true, email: false };

function loadChannels() {
  try {
    const raw = localStorage.getItem(CHANNEL_KEY);
    if (raw) return { ...DEFAULT_CHANNELS, ...JSON.parse(raw) };
  } catch (e) { console.error(e); }
  return DEFAULT_CHANNELS;
}
function saveChannels(s) {
  try { localStorage.setItem(CHANNEL_KEY, JSON.stringify(s)); }
  catch (e) { console.error(e); }
}

// 6 kind 기본값 — DB row 없을 때 ON.
const DEFAULT_KIND_PREFS = NOTI_KINDS.reduce((acc, k) => { acc[k] = true; return acc; }, {});

export function NotificationsScreen({ user, onBack }) {
  const [channels, setChannels] = useState(() => loadChannels());
  const [kindPrefs, setKindPrefs] = useState(DEFAULT_KIND_PREFS);
  const [kindLoading, setKindLoading] = useState(true);
  const [kindSavingKey, setKindSavingKey] = useState(null);

  // Step 6-2 — 푸시 알림 hook
  const currentUser = getCurrentUser(user);
  const userUuid = currentUser?.user_id || currentUser?.userId || currentUser?.id || "";

  // 마운트 시 본인 prefs 로드
  useEffect(() => {
    if (!userUuid) { setKindLoading(false); return; }
    let alive = true;
    fetchNotiPrefs(userUuid).then(res => {
      if (!alive) return;
      if (res.ok) setKindPrefs(res.prefs);
      setKindLoading(false);
    });
    return () => { alive = false; };
  }, [userUuid]);

  function toggleChannel(key) {
    const next = { ...channels, [key]: !channels[key] };
    setChannels(next);
    saveChannels(next);
  }

  async function toggleKind(kind) {
    if (kindSavingKey) return;
    if (!userUuid) {
      showPushToast("⚠️ 로그인 정보가 없어 저장할 수 없습니다");
      return;
    }
    const nextEnabled = !kindPrefs[kind];
    setKindSavingKey(kind);
    // 옵티미스틱
    setKindPrefs(prev => ({ ...prev, [kind]: nextEnabled }));
    const res = await setNotiPref({
      userId:  userUuid,
      kind,
      enabled: nextEnabled,
      actorId: userUuid,
    });
    if (!res.ok) {
      // 롤백
      setKindPrefs(prev => ({ ...prev, [kind]: !nextEnabled }));
      showPushToast(`⚠️ 저장 실패: ${res.error || "알 수 없는 오류"}`);
    }
    setKindSavingKey(null);
  }
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
          enabled={channels.inApp}
          onToggle={() => toggleChannel("inApp")}
          interactive={true}
        />

        {/* Step 6-2 — 푸시 알림 (PWA) hook */}
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

        {/* 종류 — 2026-06-06 DB 연동 (Mig 101) */}
        <SectionLabel>
          알림 종류
          {kindLoading ? <span style={{ marginLeft: 8, fontWeight: 400, color: "#9CA3AF" }}>(불러오는 중...)</span> : null}
        </SectionLabel>
        <ToggleRow label="새 접수 알림"               checked={kindPrefs.newOrder}       onToggle={() => toggleKind("newOrder")}       disabled={kindLoading}/>
        <ToggleRow label="배정 알림"                  checked={kindPrefs.assignment}     onToggle={() => toggleKind("assignment")}     disabled={kindLoading}/>
        <ToggleRow label="일정 변경 알림"             checked={kindPrefs.scheduleChange} onToggle={() => toggleKind("scheduleChange")} disabled={kindLoading}/>
        <ToggleRow label="작업 완료 알림"             checked={kindPrefs.taskComplete}   onToggle={() => toggleKind("taskComplete")}   disabled={kindLoading}/>
        {/* 2026-06-07 — 라벨 정정 ("부분완료/출장비만/취소" → "취소 알림"). 실제 매칭이 "작업 취소"만이라 정확화. */}
        <ToggleRow label="취소 알림"                  checked={kindPrefs.partialEtc}     onToggle={() => toggleKind("partialEtc")}     disabled={kindLoading}/>
        <ToggleRow label="정산 완료 알림"             checked={kindPrefs.settleComplete} onToggle={() => toggleKind("settleComplete")} disabled={kindLoading}/>
        {/* 2026-06-07 — 신규 4종 (트리거 title 그대로 매칭) */}
        <ToggleRow label="작업 시작 알림"             checked={kindPrefs.taskStart}      onToggle={() => toggleKind("taskStart")}      disabled={kindLoading}/>
        <ToggleRow label="기사 수락 알림"             checked={kindPrefs.engineerAccept} onToggle={() => toggleKind("engineerAccept")} disabled={kindLoading}/>
        <ToggleRow label="취소 요청 알림"             checked={kindPrefs.cancelRequest}  onToggle={() => toggleKind("cancelRequest")}  disabled={kindLoading}/>
        <ToggleRow label="냉매 수락 마감 알림"        checked={kindPrefs.refrigClosed}   onToggle={() => toggleKind("refrigClosed")}   disabled={kindLoading}/>
      </div>

      {/* Step 6-2 — 푸시 토스트 */}
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

function ToggleRow({ label, checked, onToggle, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onToggle}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", marginBottom: 6,
        background: "var(--bg-secondary)", border: "1px solid var(--border)",
        borderRadius: 8, cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{label}</span>
      <Toggle enabled={checked} disabled={disabled}/>
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
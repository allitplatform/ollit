// 2026-07-21 — 설정 통합 재설계 (사장님 승인 시안 기준).
//   · 옛 "일반"(허브) + "알림 설정"(NotificationsScreen) → 이 한 화면으로 통합.
//   · 제거: 원청/프로/단가/지역/수수료정책/사용자/회사계좌 중복 링크, 정산(5원청)·회사→원청 레거시 링크,
//           시트 백업(구글시트 옛 시스템), 내 계정 빈 기능, 설정 검색창, 이메일 채널(사장님 spec),
//           유솔N 잔재 컴포넌트, localStorage 개수 표시(부정확).
//   · 유지: 냉매충전 자동배정 푸시(Mig 179 — 맨 위 배치), 운영팀 전화번호(Mig 104),
//           인앱/푸시 채널 토글, 알림 종류 토글(Mig 101 DB), 테마, 글자 크기(3단계), 로그아웃.
//   · PC(1024px+) 2단 그리드: 좌 운영+개인 / 우 알림. 모바일 1열.
//   · 진입: screen === "settings" 그리고 옛 "notificationSettings" 도 이 화면으로 (AdminApp 분기 병합).
import { useState, useEffect } from "react";
import { hasPermission, getCurrentUser, ROLES } from "../data/users.js";
import {
  subscribePushWithSync,
  unsubscribePushWithSync,
  isPushSupported,
  isStandalone,
  isIOS,
  getPermissionState,
  getCurrentSubscription,
} from "../utils/pushNotification.js";
import { getOpsPhone, setOpsPhone } from "../lib/tenantSettingsDb.js";
import { fetchNotiPrefs, setNotiPref, NOTI_KINDS } from "../lib/notiPrefsDb.js";
import {
  Inbox, UserCheck, CalendarClock, CheckCircle2, XCircle, Wallet,
  PlayCircle, ThumbsUp, AlertTriangle, ClipboardCheck,
} from "lucide-react";

// ── 글자 크기 (V14 Step 4 유지 — 키/attribute 그대로) ──────────────
function loadFontSize() {
  try {
    const v = localStorage.getItem("ollit_admin_font_size");
    if (v === "small" || v === "medium" || v === "large") return v;
  } catch (e) {}
  return "medium";
}
function applyFontSize(size) {
  if (typeof document !== "undefined") {
    document.documentElement.removeAttribute("data-font-size");
    document.documentElement.setAttribute("data-admin-font-size", size);
  }
  try { localStorage.setItem("ollit_admin_font_size", size); } catch (e) {}
}

// ── 인앱 채널 (localStorage 키 유지 — 이메일 항목은 UI에서 제거, 값은 무시) ──
const CHANNEL_KEY = "ollit_notification_channels_v1";
const DEFAULT_CHANNELS = { inApp: true, email: false };
function loadChannels() {
  try {
    const raw = localStorage.getItem(CHANNEL_KEY);
    if (raw) return { ...DEFAULT_CHANNELS, ...JSON.parse(raw) };
  } catch (e) {}
  return DEFAULT_CHANNELS;
}
function saveChannels(s) {
  try { localStorage.setItem(CHANNEL_KEY, JSON.stringify(s)); } catch (e) {}
}

// 알림 종류 기본값 — DB row 없음 = ON (Mig 101 규약 유지)
const DEFAULT_KIND_PREFS = NOTI_KINDS.reduce((acc, k) => { acc[k] = true; return acc; }, {});

// PC 분기 — AdminApp isPc 패턴과 동일 기준 (1024px)
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

export function SettingsScreen({
  user, onBack, onLogout,
  themeMode, onToggleTheme,
  autoPushOn, onToggleAutoPush,  // 냉매충전 자동배정 푸시 (Mig 179)
  // 2026-07-21 v2 — 사장님 spec: 공지/사용자/회사계좌 사이드바에서 빼고 설정 안 "관리" 카드로.
  onAnnouncements, onUsers, onCompanyAccount,
}) {
  const currentUser = getCurrentUser(user);
  const isPc = useIsPc();
  const canOps = hasPermission(currentUser, "menu.users");  // 운영 설정 노출 권한 (기존 기준 유지)

  // ── 글자 크기 ──
  const [fontSize, setFontSize] = useState(() => loadFontSize());
  useEffect(() => { applyFontSize(fontSize); }, [fontSize]);

  // ── 토스트 (푸시/저장 공용) ──
  const [toast, setToast] = useState(null);
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  // ── 운영팀 전화번호 (Mig 104) ──
  const [opsPhoneInput, setOpsPhoneInput] = useState("");
  const [opsPhoneSaved, setOpsPhoneSaved] = useState("");
  const [opsPhoneBusy,  setOpsPhoneBusy]  = useState(false);
  const [opsPhoneMsg,   setOpsPhoneMsg]   = useState(null);
  useEffect(() => {
    let alive = true;
    getOpsPhone().then(res => {
      if (!alive) return;
      const p = res.phone || "";
      setOpsPhoneInput(p);
      setOpsPhoneSaved(p);
    });
    return () => { alive = false; };
  }, []);
  async function handleSaveOpsPhone() {
    if (opsPhoneBusy) return;
    setOpsPhoneBusy(true);
    setOpsPhoneMsg(null);
    try {
      const res = await setOpsPhone(opsPhoneInput);
      if (!res.ok) {
        setOpsPhoneMsg({ type: "error", text: res.error || "저장 실패" });
      } else {
        const next = res.phone || "";
        setOpsPhoneSaved(next);
        setOpsPhoneMsg({ type: "ok", text: next ? "✓ 저장됨" : "✓ 번호가 비워졌어요 (기사 앱 버튼 숨김)" });
        setTimeout(() => setOpsPhoneMsg(null), 2500);
      }
    } finally {
      setOpsPhoneBusy(false);
    }
  }

  // ── 인앱 채널 ──
  const [channels, setChannels] = useState(() => loadChannels());
  function toggleChannel(key) {
    const next = { ...channels, [key]: !channels[key] };
    setChannels(next);
    saveChannels(next);
  }

  // ── 푸시 (PWA) 구독 ──
  const [pushOn, setPushOn]     = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
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
  async function handlePushToggle() {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (!pushOn) {
        if (!isPushSupported()) { showToast("⚠️ 이 브라우저는 푸시 알림을 지원하지 않습니다"); return; }
        if (isIOS() && !isStandalone()) { showToast("⚠️ 홈 화면에 추가한 후 다시 시도해주세요"); return; }
        const res = await subscribePushWithSync({
          // sign_in_with_phone (Mig 057) 응답 user_id (snake_case) 우선 — 옛 매핑 누락 사고 방지.
          userId: currentUser?.user_id || currentUser?.userId || currentUser?.id || "",
          role:   currentUser?.role   || "admin",
        });
        if (res.ok) {
          setPushOn(true);
          showToast("✓ 푸시 알림이 활성화되었습니다");
        } else if (res.reason === "denied") {
          showToast("⚠️ 알림 권한이 거부되었습니다 (브라우저 설정에서 변경)");
        } else if (res.reason === "no_vapid") {
          showToast("⚠️ 푸시 키가 설정되지 않았습니다");
        } else if (res.reason === "sync_failed") {
          setPushOn(true);
          showToast("✓ 활성화됨 (시트 sync 보류)");
        } else {
          showToast(`⚠️ ${res.error || "활성화 실패"}`);
        }
      } else {
        const res = await unsubscribePushWithSync({
          userId: currentUser?.user_id || currentUser?.userId || currentUser?.id || "",
        });
        setPushOn(false);
        if (res.ok) showToast("✓ 푸시 알림이 비활성화되었습니다");
        else        showToast(`⚠️ ${res.error || "비활성화 실패"}`);
      }
    } finally {
      setPushBusy(false);
    }
  }

  // ── 알림 종류 (Mig 101 DB) ──
  const userUuid = currentUser?.user_id || currentUser?.userId || currentUser?.id || "";
  const [kindPrefs, setKindPrefs]         = useState(DEFAULT_KIND_PREFS);
  const [kindLoading, setKindLoading]     = useState(true);
  const [kindSavingKey, setKindSavingKey] = useState(null);
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
  async function toggleKind(kind) {
    if (kindSavingKey) return;
    if (!userUuid) { showToast("⚠️ 로그인 정보가 없어 저장할 수 없습니다"); return; }
    const nextEnabled = !kindPrefs[kind];
    setKindSavingKey(kind);
    setKindPrefs(prev => ({ ...prev, [kind]: nextEnabled }));  // 옵티미스틱
    const res = await setNotiPref({ userId: userUuid, kind, enabled: nextEnabled, actorId: userUuid });
    if (!res.ok) {
      setKindPrefs(prev => ({ ...prev, [kind]: !nextEnabled }));  // 롤백
      showToast(`⚠️ 저장 실패: ${res.error || "알 수 없는 오류"}`);
    }
    setKindSavingKey(null);
  }

  // 알림 종류 목록 — role 분기 (원청 5종 / 운영자·관리자 9종, NotificationsScreen 규약 유지)
  const isPartner = currentUser?.role === "partner" || currentUser?.role === "principal";
  const KIND_ROWS = isPartner ? [
    { icon: ClipboardCheck, label: "작업 배정",  kind: "partnerAssign" },
    { icon: CalendarClock,  label: "일정 확정",  kind: "partnerSchedule" },
    { icon: CheckCircle2,   label: "작업 완료",  kind: "partnerComplete" },
    { icon: XCircle,        label: "작업 취소",  kind: "partnerCancel" },
    { icon: Wallet,         label: "정산 완료",  kind: "partnerSettle" },
  ] : [
    { icon: Inbox,          label: "새 접수",    kind: "newOrder" },
    { icon: UserCheck,      label: "배정",       kind: "assignment" },
    { icon: CalendarClock,  label: "일정 변경",  kind: "scheduleChange" },
    { icon: PlayCircle,     label: "작업 시작",  kind: "taskStart" },
    { icon: CheckCircle2,   label: "작업 완료",  kind: "taskComplete" },
    { icon: XCircle,        label: "취소",       kind: "partialEtc" },
    { icon: AlertTriangle,  label: "취소 요청",  kind: "cancelRequest" },
    { icon: ThumbsUp,       label: "기사 수락",  kind: "engineerAccept" },
    { icon: Wallet,         label: "정산 완료",  kind: "settleComplete" },
  ];

  // ── 카드들 ──
  const opsCard = canOps && (
    <Card title="📡 운영" sub="회사 전체에 적용">
      {/* 냉매충전 자동배정 푸시 — 성수기 스위치. 맨 위 (사장님 승인 시안) */}
      {typeof onToggleAutoPush === "function" && (
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          background: autoPushOn ? "var(--accent-bg, rgba(255,27,141,0.12))" : "var(--bg-secondary)",
          border: `1px solid ${autoPushOn ? "rgba(255,27,141,0.45)" : "var(--border)"}`,
          borderRadius: 12, padding: 16,
        }}>
          <span style={{ fontSize: 22 }}>📡</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>냉매충전 자동배정 푸시</div>
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              {autoPushOn
                ? "켜짐 — 접수 시 기사들에게 알림 발송, 선착 수락"
                : "꺼짐 — 알림 없이 바로 수동 배정 화면 (성수기 모드)"}
            </div>
          </div>
          <button onClick={onToggleAutoPush} style={{
            flexShrink: 0, padding: "9px 20px", borderRadius: 999, border: "none",
            fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            background: autoPushOn ? "var(--accent, #FF1B8D)" : "var(--bg-tertiary, var(--bg-secondary))",
            color: autoPushOn ? "#fff" : "var(--text-secondary)",
            boxShadow: autoPushOn ? "none" : "inset 0 0 0 1px var(--border)",
          }}>{autoPushOn ? "ON" : "OFF"}</button>
        </div>
      )}

      {/* 운영팀 전화번호 (Mig 104) */}
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>📞 운영팀 전화번호</div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 2 }}>
          기사 앱 "내 정보 → 📞 전화" 버튼이 거는 번호. 비우면 버튼이 숨겨져요.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            type="tel"
            value={opsPhoneInput}
            onChange={(e) => setOpsPhoneInput(e.target.value)}
            placeholder="예: 010-1234-5678"
            style={{
              flex: 1, padding: "10px 12px", fontSize: 13,
              border: "1px solid var(--border)", borderRadius: 9,
              background: "var(--bg-secondary)", color: "var(--text-primary)",
              fontFamily: "inherit", outline: "none", minWidth: 0,
            }}
          />
          <button
            onClick={handleSaveOpsPhone}
            disabled={opsPhoneBusy || opsPhoneInput === opsPhoneSaved}
            style={{
              padding: "10px 18px", fontSize: 12.5, fontWeight: 800,
              border: "none", borderRadius: 9,
              background: opsPhoneBusy || opsPhoneInput === opsPhoneSaved ? "var(--bg-secondary)" : "var(--accent, #FF1B8D)",
              color: opsPhoneBusy || opsPhoneInput === opsPhoneSaved ? "var(--text-secondary)" : "#fff",
              cursor: opsPhoneBusy || opsPhoneInput === opsPhoneSaved ? "default" : "pointer",
              fontFamily: "inherit",
            }}>
            {opsPhoneBusy ? "저장 중..." : "저장"}
          </button>
        </div>
        {opsPhoneMsg && (
          <div style={{
            marginTop: 6, fontSize: 11, fontWeight: 600,
            color: opsPhoneMsg.type === "ok" ? "#059669" : "#DC2626",
          }}>{opsPhoneMsg.text}</div>
        )}
      </div>
    </Card>
  );

  // 2026-07-21 v2 — 관리 카드 (사이드바에서 옮겨온 3개 진입점. 공지는 월 2회 수준 저빈도 — 사장님 확인).
  const manageCard = (
    <Card title="🗂 관리" sub="관리 화면으로 이동">
      {typeof onAnnouncements === "function" && (
        <NavRow icon="📢" label="공지사항" desc="전체 기사 공지 작성 + 푸시 발송" onClick={onAnnouncements}/>
      )}
      {typeof onUsers === "function" && hasPermission(currentUser, "menu.users") && (
        <NavRow icon="👥" label="사용자" desc="계정 · 역할 · 비밀번호 리셋" onClick={onUsers}/>
      )}
      {typeof onCompanyAccount === "function" && hasPermission(currentUser, "menu.company_account") && (
        <NavRow icon="💳" label="회사 계좌" desc="기사 송금 안내에 쓰이는 계좌" onClick={onCompanyAccount}/>
      )}
    </Card>
  );

  const notiCard = (
    <Card title="🔔 알림" sub="이 기기·내 계정에 적용">
      <ChannelRow
        icon="🔔" name="시스템 알림 (인앱)" desc="앱 안에서 빨간 점으로 표시"
        on={channels.inApp} onToggle={() => toggleChannel("inApp")}
      />
      <ChannelRow
        icon="📲" name="푸시 알림 (PWA)"
        desc={pushBusy ? "처리 중..." : "브라우저 / 잠금화면에 알림"}
        on={pushOn} onToggle={handlePushToggle}
      />
      {/* 이메일 채널 — 2026-07-21 사장님 spec 으로 제거 (Phase 3 준비중 표기까지 삭제) */}

      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-secondary)", marginTop: 4 }}>
        알림 종류{kindLoading ? " (불러오는 중...)" : ""}
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: isPc ? "1fr 1fr" : "1fr",
        gap: 8,
      }}>
        {KIND_ROWS.map(({ icon: Icon, label, kind }) => (
          <div key={kind}
            onClick={kindLoading ? undefined : () => toggleKind(kind)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 9,
              background: "var(--bg-secondary)", fontSize: 12, fontWeight: 600,
              cursor: kindLoading ? "default" : "pointer",
              opacity: kindLoading ? 0.55 : 1,
            }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
              <Icon size={14} style={{ color: "var(--text-secondary)", flexShrink: 0 }} aria-hidden="true"/>
              {label}
            </span>
            <Switch on={!!kindPrefs[kind]} disabled={kindLoading}/>
          </div>
        ))}
      </div>
    </Card>
  );

  const personalCard = (
    <Card title="🎨 개인" sub="이 기기에만 적용">
      {/* 내 정보 — 표시 전용 (옛 '내 계정' 빈 클릭 제거) */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 10,
        background: "var(--bg-secondary)", border: "1px solid var(--border)",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "var(--accent-bg, rgba(255,27,141,0.12))", color: "var(--accent, #FF1B8D)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, fontSize: 14, flexShrink: 0,
        }}>{(currentUser?.name || "—").slice(0, 1)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>{currentUser?.name || "—"}</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
            {ROLES[currentUser?.role]?.name || currentUser?.role || "—"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>테마</span>
        <div style={{ display: "flex", gap: 5 }}>
          <SegButton label="🌙 다크"   active={themeMode === "dark"}  onClick={() => themeMode !== "dark"  && onToggleTheme?.()}/>
          <SegButton label="☀️ 라이트" active={themeMode !== "dark"}  onClick={() => themeMode === "dark"  && onToggleTheme?.()}/>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>글자 크기</span>
        <div style={{ display: "flex", gap: 5 }}>
          <SegButton label="작게" active={fontSize === "small"}  onClick={() => setFontSize("small")}/>
          <SegButton label="보통" active={fontSize === "medium"} onClick={() => setFontSize("medium")}/>
          <SegButton label="크게" active={fontSize === "large"}  onClick={() => setFontSize("large")}/>
        </div>
      </div>
    </Card>
  );

  return (
    <div style={{
      background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)",
      fontFamily: "-apple-system, 'Pretendard', sans-serif",
      paddingBottom: "calc(80px + env(safe-area-inset-bottom))",
    }}>
      {/* 헤더 — 모바일 back 유지. PC 는 사이드바 진입이라 back 은 있어도 무해. */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, background: "var(--bg-primary)", zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: "var(--text-primary)",
          fontSize: 18, cursor: "pointer", padding: 4,
        }}>←</button>
        <div style={{ fontSize: 15, fontWeight: 700 }}>설정</div>
        <div style={{ width: 40 }}/>
      </div>

      <div style={{ padding: isPc ? "24px 28px" : 16, maxWidth: 1120, margin: "0 auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: isPc ? "1fr 1fr" : "1fr",
          gap: 20, alignItems: "start",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {opsCard}
            {manageCard}
            {personalCard}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {notiCard}
          </div>
        </div>

        <div style={{ marginTop: 28, maxWidth: isPc ? 360 : "none" }}>
          <button onClick={onLogout} style={{
            width: "100%", padding: 12,
            background: "rgba(239, 68, 68, 0.10)",
            border: "1px solid rgba(239, 68, 68, 0.30)",
            color: "#FF3D5A", fontSize: 13, fontWeight: 600,
            borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
          }}>로그아웃</button>
        </div>

        <div style={{
          textAlign: "center", marginTop: 24,
          fontSize: 10, color: "var(--text-tertiary)", letterSpacing: 0.5,
        }}>올잇 v1.0</div>
      </div>

      {toast && (
        <div style={{
          position: "fixed", left: "50%", bottom: "calc(96px + env(safe-area-inset-bottom))",
          transform: "translateX(-50%)",
          background: "rgba(0, 135, 90, 0.95)", color: "#fff",
          padding: "12px 18px", borderRadius: 10,
          fontSize: 12, fontWeight: 600,
          maxWidth: "90%", textAlign: "center", lineHeight: 1.5,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 9999, fontFamily: "inherit",
          pointerEvents: "none",
        }}>{toast}</div>
      )}
    </div>
  );
}

// ── 공용 소품 ─────────────────────────────────────────────
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

// 2026-07-21 v2 — 관리 카드용 이동 행 (공지/사용자/회사계좌)
function NavRow({ icon, label, desc, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10,
      background: "var(--bg-secondary)", cursor: "pointer",
    }}>
      <span style={{ fontSize: 17, width: 24, textAlign: "center" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 10.5, color: "var(--text-secondary)", marginTop: 2 }}>{desc}</div>
      </div>
      <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>›</span>
    </div>
  );
}

function ChannelRow({ icon, name, desc, on, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10,
      background: "var(--bg-secondary)", cursor: "pointer",
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{name}</div>
        <div style={{ fontSize: 10.5, color: "var(--text-secondary)", marginTop: 2 }}>{desc}</div>
      </div>
      <Switch on={on}/>
    </div>
  );
}

function Switch({ on, disabled }) {
  return (
    <div style={{
      width: 38, height: 21, borderRadius: 999,
      background: on ? "#00875A" : "var(--bg-tertiary, var(--border))",
      position: "relative", flexShrink: 0,
      opacity: disabled ? 0.5 : 1,
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

function SegButton({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 13px", borderRadius: 8,
      border: `1px solid ${active ? "var(--accent, #FF1B8D)" : "var(--border)"}`,
      background: active ? "var(--accent, #FF1B8D)" : "transparent",
      color: active ? "#fff" : "var(--text-secondary)",
      fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12,
    }}>{label}</button>
  );
}

export default SettingsScreen;

// Step 9 — 통합 설정 (3 카테고리)
// 운영 / 시스템 / 개인 + 권한 적용 + 검색
// V11-2 — 유솔 N (별도) 카테고리 추가 (운영자/관리자만)
// V14 Step 4 — 글자 크기 조절 3단계 박힘 (EngineerMeTab 패턴)
// Step 6-2 (2-D) — 푸시 알림 토글 박음 (AdminApp / 운영자 + 관리자)
import { useState, useMemo, useEffect } from "react";
import { hasPermission, getCurrentUser, ROLES } from "../data/users.js";
import { loadPrincipals } from "../data/principals.js";
import { loadEngineers } from "../data/engineers.js";
import { loadRegions } from "../data/regions.js";
import { loadRates } from "../data/standardRates.js";
import { canAccessMenu } from "../data/permissions.js";
import { USOL_N_ENTRY, showUsolNEntry, GENERAL_MENU, showGeneralSettlementGroup } from "../data/menuStructure.js";
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

// V14 Step 4.3 — AdminApp 전용 글자 크기 (EngineerApp 옛 키 'ollit_font_size' 박지 X)
// 새 키: 'ollit_admin_font_size'
// 새 attribute: 'data-admin-font-size' (CSS scope 분리 / src/index.css)
// 새 비율 (사장님 결정 5/8): 100% / 120% / 140%
function loadFontSize() {
  try {
    const v = localStorage.getItem("ollit_admin_font_size");
    if (v === "small" || v === "medium" || v === "large") return v;
  } catch (e) {}
  return "medium";
}
function applyFontSize(size) {
  if (typeof document !== "undefined") {
    // 옛 EngineerApp attribute 박지 X (충돌 catch)
    document.documentElement.removeAttribute("data-font-size");
    document.documentElement.setAttribute("data-admin-font-size", size);
  }
  try { localStorage.setItem("ollit_admin_font_size", size); } catch (e) {}
}

// Step 5-7 — 시트 백업 (Google Sheets URL — 사장님이 [파일 → 사본 만들기])
const SHEET_BACKUP_URL = "https://docs.google.com/spreadsheets/d/1z9ttYktjGQ8MPQb14Etd-1o6CYua0wAC7DwiiZopsag/edit";

export function SettingsScreen({
  user, onBack, onLogout,
  onPrincipals, onEngineers, onRates, onRegions,
  onUsers, onNotifications, onBackup,
  onCompanyAccount,  // Step 5-8 F-4
  onUsolN, onSettlement, onPrincipalSettlement,
  onAnnouncements,  // 2026-07-24 — 공지사항 (개요 탭에서 설정으로 이동)
  onEngineerCalendar,  // 2026-07-24 — 기사별 달력 (개요 탭 타일 제거 → 설정으로 이동)
  onCommissionPolicy,  // Phase 2 — 수수료정책 관리 (admin/owner/operator)
  themeMode, onToggleTheme,
  autoPushOn, onToggleAutoPush,  // 2026-07-14 — 냉매충전 자동배정 푸시 ON/OFF (Mig 179)
}) {
  const [search, setSearch] = useState("");
  const currentUser = getCurrentUser(user);

  // V14 Step 4 — 글자 크기 (3단계: small/medium/large / EngineerMeTab과 동기)
  const [fontSize, setFontSize] = useState(() => loadFontSize());
  useEffect(() => { applyFontSize(fontSize); }, [fontSize]);

  // Step 5-7 — 시트 백업 토스트
  const [backupToast, setBackupToast] = useState(false);
  function handleSheetBackup() {
    try { window.open(SHEET_BACKUP_URL, "_blank"); } catch (e) { /* */ }
    setBackupToast(true);
    setTimeout(() => setBackupToast(false), 5000);
  }

  // Step 6-2 (2-D) — 푸시 알림 토글 (운영자/관리자)
  const [pushOn, setPushOn]       = useState(false);
  const [pushBusy, setPushBusy]   = useState(false);
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

  // 2026-06-07 — 운영팀 전화번호 (tenants.ops_phone, Mig 104).
  //   기사 PWA "📞 전화" 버튼이 이 값으로 tel: 링크 구성. 빈 값이면 버튼 숨김.
  const [opsPhoneInput, setOpsPhoneInput]   = useState("");
  const [opsPhoneSaved, setOpsPhoneSaved]   = useState("");
  const [opsPhoneBusy,  setOpsPhoneBusy]    = useState(false);
  const [opsPhoneMsg,   setOpsPhoneMsg]     = useState(null);
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

  async function handlePushToggle() {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (!pushOn) {
        if (!isPushSupported()) { showPushToast("⚠️ 이 브라우저는 푸시 알림을 지원하지 않습니다"); return; }
        if (isIOS() && !isStandalone()) { showPushToast("⚠️ 홈 화면에 추가한 후 다시 시도해주세요"); return; }
        const res = await subscribePushWithSync({
          // 2026-06-05 — sign_in_with_phone (Mig 057) 응답 측 user_id (snake_case) 우선.
          //   옛 userId / id fallback 유지 — 다른 로그인 경로 호환.
          //   옛 spec 측 user_id 매핑 누락 → 빈 문자열 전달 → /api/push/subscribe 400 → admin 구독 0건 사고.
          userId: currentUser?.user_id || currentUser?.userId || currentUser?.id || "",
          role:   currentUser?.role   || "admin",
        });
        if (res.ok) {
          setPushOn(true);
          showPushToast("✓ 푸시 알림이 활성화되었습니다");
        } else if (res.reason === "denied") {
          showPushToast("⚠️ 알림 권한이 거부되었습니다 (브라우저 설정에서 변경)");
        } else if (res.reason === "no_vapid") {
          showPushToast("⚠️ 푸시 키가 설정되지 않았습니다");
        } else if (res.reason === "sync_failed") {
          setPushOn(true);
          showPushToast("✓ 활성화됨 (시트 sync 보류)");
        } else {
          showPushToast(`⚠️ ${res.error || "활성화 실패"}`);
        }
      } else {
        const res = await unsubscribePushWithSync({
          // 2026-06-05 — user_id 우선 (subscribe 라인 측 동일 매핑).
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

  const counts = useMemo(() => {
    try {
      const principals = loadPrincipals();
      const engineers  = loadEngineers();
      const regions    = loadRegions();
      const rates      = loadRates();
      return {
        principals: principals.length,
        engineers:  engineers.length,
        regions:    regions.filter(r => r.active).length,
        rates:      Object.keys(rates.cleaning || {}).length,
      };
    } catch (e) {
      return { principals: 0, engineers: 0, regions: 0, rates: 0 };
    }
  }, []);

  // 카테고리 정의
  const operations = [
    { key: "principals",    icon: "🏪", label: "원청 관리",    sub: `${counts.principals}곳`, perm: "menu.principals", onClick: onPrincipals },
    { key: "engineers",     icon: "👷", label: "프로 관리",    sub: `${counts.engineers}명`,  perm: "menu.engineers",  onClick: onEngineers },
    { key: "rates",         icon: "💰", label: "단가표",       sub: `세척 ${counts.rates}종 + 쿨가이`, perm: "menu.rates",  onClick: onRates },
    { key: "regions",       icon: "📍", label: "지역 관리",    sub: `활성 ${counts.regions}개`, perm: "menu.regions",  onClick: onRegions },
    { key: "commission_policy", icon: "📊", label: "수수료정책 관리", sub: "Supabase 78 정책 + 계산기", onClick: onCommissionPolicy },
  ];
  const system = [
    { key: "users",           icon: "👥", label: "사용자 / 권한", sub: "5역할",  perm: "menu.users",         onClick: onUsers },
    { key: "company_account", icon: "💳", label: "회사 계좌",     sub: "변경 가능 (운영자)", perm: "menu.company_account", onClick: onCompanyAccount },
    { key: "announcements",   icon: "📢", label: "공지사항 관리", sub: "기사 공지", onClick: onAnnouncements },
    // 2026-07-24 — 개요 탭 달력 타일 제거 → 설정으로 이동 (사장님 spec: 통장·손익 타일이 대체)
    { key: "engineer_calendar", icon: "📅", label: "기사별 달력", sub: "월간 배정 달력", onClick: onEngineerCalendar },
       { key: "notifications",   icon: "🔔", label: "알림",         sub: "시스템 / 푸시 / 이메일", perm: "menu.notifications", onClick: onNotifications },
    { key: "backup",          icon: "💾", label: "시트 백업",     sub: "Google Sheets에서 사본 만들기", perm: "menu.backup", onClick: handleSheetBackup },
  ];
  const personal = [
    { key: "theme",   icon: themeMode === "dark" ? "🌙" : "☀️", label: "테마", sub: themeMode === "dark" ? "다크" : "라이트", onClick: onToggleTheme },
    { key: "account", icon: "👤", label: "내 계정", sub: `${currentUser?.name || "—"} · ${ROLES[currentUser?.role]?.name || "—"}`, onClick: () => {} },
  ];

  // 검색 필터 + 권한 필터
  const filterItems = (items) => items
    .filter(i => !i.perm || hasPermission(currentUser, i.perm))
    .filter(i => !search || i.label.includes(search) || (i.sub || "").includes(search));

  const opFiltered  = filterItems(operations);
  const sysFiltered = filterItems(system);
  const perFiltered = personal.filter(i => !search || i.label.includes(search) || (i.sub || "").includes(search));

  // V11-3 — 일반 정산 그룹 (5원청 매일 마감 / 회사 → 원청)
  const settlementVisible = showGeneralSettlementGroup(currentUser, hasPermission);
  const settlementHandlers = {
    settlement:           onSettlement,
    principal_settlement: onPrincipalSettlement,
  };
  const settlementFiltered = settlementVisible
    ? GENERAL_MENU
        .filter(m => hasPermission(currentUser, m.perm))
        .filter(m => !search || m.label.includes(search) || (m.sub || "").includes(search))
        .map(m => ({
          key: m.id, icon: m.icon, label: m.label, sub: m.sub,
          onClick: () => settlementHandlers[m.id]?.(),
        }))
    : [];

  // V11-2-fix — 유솔 N 단일 항목 (네이버 초록 강조)
  const usolNVisible = showUsolNEntry(currentUser);
  const showUsolNRow = usolNVisible &&
    (!search || USOL_N_ENTRY.label.includes(search) || (USOL_N_ENTRY.sub || "").includes(search));

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif", paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}>
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>설정</div>
        <div style={{ width: 40 }}/>
      </div>

      <div style={{ padding: 16 }}>
        <input
          type="text" placeholder="🔍 설정 검색"
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={searchStyle}
        />

        {opFiltered.length > 0 && (
          <Section label="📦 운영">
            {opFiltered.map(item => <SettingRow
              key={item.key}
              icon={item.icon}
              label={item.label}
              sub={item.sub}
              onClick={item.onClick}
            />)}
            {/* 2026-07-14 — 냉매충전 자동배정 푸시 ON/OFF (Mig 179 / 사장님 spec).
                  성수기 = 기사들이 일하느라 수락 못 함 → 끄고 바로 수동 배정. */}
            {typeof onToggleAutoPush === "function" && hasPermission(currentUser, "menu.users") && (
              <div style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "12px 14px",
                marginTop: 8,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                    📡 냉매충전 자동배정 푸시
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {autoPushOn
                      ? "켜짐 — 접수 시 기사들에게 알림 발송, 선착 수락"
                      : "꺼짐 — 알림 없이 바로 수동 배정 화면 (성수기 모드)"}
                  </div>
                </div>
                <button
                  onClick={onToggleAutoPush}
                  style={{
                    flexShrink: 0,
                    padding: "8px 16px",
                    borderRadius: 999,
                    border: "none",
                    fontSize: 12, fontWeight: 800,
                    cursor: "pointer", fontFamily: "inherit",
                    background: autoPushOn ? "var(--accent, #FF1B8D)" : "var(--bg-secondary)",
                    color: autoPushOn ? "#fff" : "var(--text-secondary)",
                    boxShadow: autoPushOn ? "none" : "inset 0 0 0 1px var(--border)",
                  }}
                >{autoPushOn ? "ON" : "OFF"}</button>
              </div>
            )}
          </Section>
        )}

        {sysFiltered.length > 0 && (
          <Section label="⚙️ 시스템">
            {sysFiltered.map(item => <SettingRow
              key={item.key}
              icon={item.icon}
              label={item.label}
              sub={item.sub}
              onClick={item.onClick}
            />)}
            {/* 2026-06-07 — 운영팀 전화번호 (Mig 104). 권한자(menu.users)만 표시. */}
            {hasPermission(currentUser, "menu.users") && (
              <div style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "12px 14px",
                marginTop: 8,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                  📞 운영팀 전화번호
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>
                  기사 앱 "내 정보 → 📞 전화" 버튼이 거는 번호. 비우면 버튼 자체가 숨겨져요.
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="tel"
                    value={opsPhoneInput}
                    onChange={(e) => setOpsPhoneInput(e.target.value)}
                    placeholder="예: 010-1234-5678"
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      fontSize: 13,
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      background: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={handleSaveOpsPhone}
                    disabled={opsPhoneBusy || opsPhoneInput === opsPhoneSaved}
                    style={{
                      padding: "8px 14px",
                      fontSize: 12, fontWeight: 700,
                      border: "none", borderRadius: 8,
                      background: opsPhoneBusy || opsPhoneInput === opsPhoneSaved ? "var(--bg-secondary)" : "#FF1B8D",
                      color: opsPhoneBusy || opsPhoneInput === opsPhoneSaved ? "var(--text-secondary)" : "#fff",
                      cursor: opsPhoneBusy || opsPhoneInput === opsPhoneSaved ? "default" : "pointer",
                      fontFamily: "inherit",
                    }}>
                    {opsPhoneBusy ? "저장 중..." : "저장"}
                  </button>
                </div>
                {opsPhoneMsg && (
                  <div style={{
                    marginTop: 6, fontSize: 11,
                    color: opsPhoneMsg.type === "ok" ? "#059669" : "#DC2626",
                    fontWeight: 600,
                  }}>{opsPhoneMsg.text}</div>
                )}
              </div>
            )}
          </Section>
        )}

        {settlementFiltered.length > 0 && (
          <Section label="💰 정산 (5원청)">
            {settlementFiltered.map(item => <SettingRow
              key={item.key}
              icon={item.icon}
              label={item.label}
              sub={item.sub}
              onClick={item.onClick}
            />)}
          </Section>
        )}

        {/* 2026-05-19 Phase 5 Step 0.B — 유솔N 진입 = 개요 탭 박스 단일 경로. 설정 측 항목 제거. */}

        {perFiltered.length > 0 && (
          <Section label="🎨 개인">
            {perFiltered.map(item => <SettingRow
              key={item.key}
              icon={item.icon}
              label={item.label}
              sub={item.sub}
              onClick={item.onClick}
            />)}
            {/* V14 Step 4 — 글자 크기 조절 3단계 박힘 (EngineerApp 패턴 catch) */}
            <FontSizeRow fontSize={fontSize} onChange={setFontSize}/>
          </Section>
        )}

        <div style={{ marginTop: 30 }}>
          <button onClick={onLogout} style={logoutBtnStyle}>로그아웃</button>
        </div>

        <div style={{
          textAlign: "center", marginTop: 24,
          fontSize: 10, color: "var(--text-tertiary)", letterSpacing: 0.5,
        }}>
          올잇 v1.0 · Phase 1A
        </div>
      </div>

      {/* Step 6-2 (2-D) — 푸시 토글 토스트 */}
      {pushToast && (
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
        }}>
          {pushToast}
        </div>
      )}

      {/* Step 5-7 — 시트 백업 안내 토스트 */}
      {backupToast && (
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
        }}>
          📊 Google Sheets 새 탭에서 열림 — [파일 → 사본 만들기] 클릭하면 백업 완료
        </div>
      )}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: 11, color: "var(--text-secondary)", fontWeight: 600,
        marginBottom: 8, letterSpacing: 0.3,
      }}>{label}</div>
      <div style={{
        background: "var(--bg-secondary)", border: "1px solid var(--border)",
        borderRadius: 10, overflow: "hidden",
      }}>
        {children}
      </div>
    </div>
  );
}

function UsolNSection({ children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: 11, color: "#03C75A", fontWeight: 700,
        marginBottom: 8, letterSpacing: 0.3,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{
          display: "inline-block", width: 8, height: 8,
          borderRadius: "50%", background: "#03C75A",
        }}/>
        <span>유솔 N (네이버 결제)</span>
      </div>
      <div style={{
        background: "linear-gradient(135deg, rgba(3,199,90,0.08), rgba(255,27,141,0.02))",
        border: "1px solid rgba(3,199,90,0.4)",
        borderRadius: 10, overflow: "hidden",
      }}>
        {children}
      </div>
    </div>
  );
}

function UsolNRow({ icon, label, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "13px 14px",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#03C75A" }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{sub}</div>}
      </div>
      <span style={{ fontSize: 11, color: "#03C75A" }}>›</span>
    </div>
  );
}

function SettingRow({ icon, label, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 14px",
        cursor: onClick ? "pointer" : "default",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{sub}</div>}
      </div>
      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>›</span>
    </div>
  );
}

// V14 Step 4 — 글자 크기 row (작게/보통/크게 / EngineerMeTab 패턴 박힘)
function FontSizeRow({ fontSize, onChange }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "14px 14px",
      borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>🔠</span>
      <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
        글자 크기
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <FontSizeButton label="작게" size="small"  current={fontSize} onChange={onChange}/>
        <FontSizeButton label="보통" size="medium" current={fontSize} onChange={onChange}/>
        <FontSizeButton label="크게" size="large"  current={fontSize} onChange={onChange}/>
      </div>
    </div>
  );
}

function FontSizeButton({ label, size, current, onChange }) {
  const isActive = current === size;
  const fs = size === "small" ? 11 : size === "large" ? 14 : 12;
  return (
    <button onClick={() => onChange(size)} style={{
      background: isActive ? "#FF1B8D" : "transparent",
      border: isActive ? "1px solid #FF1B8D" : "1px solid var(--border)",
      color: isActive ? "#fff" : "var(--text-secondary)",
      padding: "5px 10px",
      borderRadius: 8,
      fontSize: fs,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
    }}>
      {label}
    </button>
  );
}

const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 16px", borderBottom: "1px solid var(--border)",
  position: "sticky", top: 0, background: "var(--bg-primary)", zIndex: 10,
};
const backBtnStyle = { background: "none", border: "none", color: "var(--text-primary)", fontSize: 18, cursor: "pointer", padding: 4 };
const titleStyle = { fontSize: 15, fontWeight: 500 };
const searchStyle = {
  width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 10, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13,
  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  marginBottom: 18,
};
const logoutBtnStyle = {
  width: "100%", padding: "12px",
  background: "rgba(239, 68, 68, 0.10)",
  border: "1px solid rgba(239, 68, 68, 0.30)",
  color: "#FF3D5A", fontSize: 13, fontWeight: 600,
  borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
};

export default SettingsScreen;

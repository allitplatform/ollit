// V14 — 내 정보 탭 (사장님 spec 마지막 화면)
// 5섹션: 프로필 카드 / 운영팀 문의 / 설정 / 정보 / 로그아웃
// 다크모드 + 글자 크기 = 전역 적용 / 통계 X / 비밀번호 변경 = 다음 단계
// Step 5-8 F-5 — 계좌 카드 (내 계좌만 / 회사·원청은 정산탭·운영자 영역에서 처리)

import { useState, useEffect } from "react";
import { EngineerBottomNav } from "./EngineerBottomNav.jsx";
import { useIsDark } from "../hooks/useIsDark.js";
import {
  subscribePushWithSync,
  unsubscribePushWithSync,
  isPushSupported,
  isStandalone,
  isIOS,
  getPermissionState,
  getCurrentSubscription,
} from "../utils/pushNotification.js";
// 2026-06-04 — 폰트 크기 공용 헬퍼 (src/utils/fontSize.js 추출). PrincipalApp InfoTab 도 동일 헬퍼 사용.
import { loadFontSize, applyFontSize } from "../utils/fontSize.js";
import { REGISTERED_USERS } from "../shared/users.js";
import { loadEngineers as loadSheetEngineers } from "../data/engineers.js";
import { EngineerBusinessInfoCard } from "./EngineerBusinessInfoCard.jsx";

const APP_VERSION = "v1.0 · Phase 1A";

// V14 — 카카오 채널 URL (사장님 채널 받으면 적용)
const KAKAO_CHANNEL_URL = ""; // ⚠️ 사장님 카톡 채널/오픈채팅 URL

function loadPush() {
  try {
    const v = localStorage.getItem("ollit_push");
    if (v === "false") return false;
  } catch (e) {}
  return true;
}

export function EngineerMeTab({
  engineer,
  theme = "dark",
  onChangeTheme,
  onContactOps,
  onMessageOps,
  onChangePassword,
  onChangeAccount,  // Step 5-8 F-5 — 내 계좌 편집 진입
  onLogout,
  onTabChange,
  unreadCount = 0,
}) {
  const isDark = useIsDark();
  const eng = engineer || {};

  // 사장님 spec 다크 토글 = 이진 (light/dark). 'auto'는 토글에서 제외.
  const darkOn = theme === "dark" || (theme === "auto" && isDark);
  const [push, setPush] = useState(() => loadPush());
  const [fontSize, setFontSize] = useState(() => loadFontSize());
  // Step 5-8 design 🅓 — 계좌번호 복사 토스트 (정산 탭 패턴)
  const [copyToast, setCopyToast] = useState(null);

  useEffect(() => { applyFontSize(fontSize); }, [fontSize]);

  // Step 5-8 design 🅓 — clipboard 복사 (정산 탭 copyToClipboard 동일 패턴 / 폴백)
  async function handleCopyAccount() {
    const text = (eng.accountNumber || "").replace(/-/g, "");
    if (!text) {
      setCopyToast("복사할 계좌번호가 없습니다");
      setTimeout(() => setCopyToast(null), 2200);
      return;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyToast("계좌번호 복사됨");
    } catch (err) {
      setCopyToast("복사 실패. 직접 입력해주세요");
    }
    setTimeout(() => setCopyToast(null), 2200);
  }

  function handleDarkToggle(value) {
    if (onChangeTheme) onChangeTheme(value ? "dark" : "light");
  }

  // 옛 단순 토글 (localStorage만) 보존 — 시범 호환
  function handlePushTogglePref(value) {
    setPush(value);
    try { localStorage.setItem("ollit_push", String(value)); } catch (e) {}
  }

  // Step 6-2 (2-D) — 진짜 푸시 권한 + 구독 흐름
  // 마운트 시 현재 구독 상태로 토글 동기화
  useEffect(() => {
    if (!isPushSupported()) return;
    let cancelled = false;
    getCurrentSubscription().then(sub => {
      if (cancelled) return;
      const granted = getPermissionState() === "granted";
      const next = !!(sub && granted);
      setPush(next);
      try { localStorage.setItem("ollit_push", String(next)); } catch (e) {}
    });
    return () => { cancelled = true; };
  }, []);

  // Step 6-2 hotfix-2 — multi-source engineerId / userId 매핑 (Step 5-8 패턴)
  // eng prop에 id 박지 X 케이스 catch — REGISTERED_USERS + loadSheetEngineers fallback
  //
  // 2026-05-27 ★ 긴급 수정 — 모든 기사가 E022로 저장되던 버그.
  //   REGISTERED_USERS 36개 row에 userId 필드 자체 없음 (code 필드만 존재).
  //   옛 조건 `u.userId === eng?.userId` → `undefined === undefined === true` →
  //   find() 가 항상 첫 row (A001 조동욱, engineerId="E022") 매칭 →
  //   어떤 기사가 로그인하든 푸시 구독 시 engineerId="E022" 저장 →
  //   조동욱 알림이 다른 기사 전부에게 도착.
  //   수정: truthy 가드 + REGISTERED_USERS 키 정정 (userId → code).
  //   sheetList find / fromRegistered.userId fallback 도 같은 함정 가능성 — 가드 추가.
  function resolveEngineerIds() {
    const fromRegistered = REGISTERED_USERS.find(u =>
      (eng?.userId && u.code  === eng.userId) ||
      (eng?.id     && u.code  === eng.id)     ||
      (eng?.phone  && u.phone === eng.phone)  ||
      (eng?.name   && u.name  === eng.name)
    );
    const sheetList = loadSheetEngineers();
    const fromSheet = sheetList.find(e =>
      (eng?.engineerId           && e.id   === eng.engineerId) ||
      (fromRegistered?.engineerId && e.id   === fromRegistered.engineerId) ||
      (eng?.name                 && e.name  === eng.name)  ||
      (eng?.phone                && e.phone === eng.phone)
    );
    // 2026-05-28 — 신규 기사 안전망 (옵션 A):
    //   login RPC (sign_in_with_phone) 응답 = { user_id, code, name, phone, roles, ... }
    //   신규 기사 폰에서는 REGISTERED_USERS (코드 안 고정 36명) + sheetList (localStorage 캐시)
    //   양쪽 결손 → 옛 fallback (eng.engineerId / eng.id) 도 결손 → "" → /api/push/subscribe 400.
    //   → eng.code (login 응답) 를 마지막 fallback 으로 추가. 기존 기사 무영향 (앞 fallback 우선).
    const finalEngineerId =
      eng?.engineerId ||
      fromRegistered?.engineerId ||
      fromSheet?.id ||
      eng?.id ||
      eng?.code ||
      "";
    // login RPC 응답 user_id (snake) fallback 추가 — userId(camel) 옛 호환 유지.
    const finalUserId = eng?.userId || eng?.user_id || "";
    return { finalEngineerId, finalUserId };
  }

  async function handlePushToggle(value) {
    if (value) {
      // ON 흐름
      if (!isPushSupported()) {
        showLocalToast("⚠️ 이 브라우저는 푸시 알림을 지원하지 않습니다");
        return;
      }
      if (isIOS() && !isStandalone()) {
        showLocalToast("⚠️ 홈 화면에 추가한 후 다시 시도해주세요");
        return;
      }
      const { finalEngineerId, finalUserId } = resolveEngineerIds();
      const res = await subscribePushWithSync({
        userId:     finalUserId,
        engineerId: finalEngineerId,
        role:       "engineer",
      });
      if (res.ok) {
        handlePushTogglePref(true);
        showLocalToast("✓ 푸시 알림이 활성화되었습니다");
      } else if (res.reason === "denied") {
        showLocalToast("⚠️ 알림 권한이 거부되었습니다 (휴대폰 설정에서 변경)");
      } else if (res.reason === "no_vapid") {
        showLocalToast("⚠️ 푸시 키가 설정되지 않았습니다");
      } else if (res.reason === "no_engineer_id") {
        // 2026-05-28 옵션 C — 식별자 결손 분리 안내. 옵션 A 적용 후엔 도달 어려운 안전망.
        showLocalToast("⚠️ 기사 식별 실패 — 운영팀에 문의해주세요");
      } else if (res.reason === "sync_failed") {
        // 로컬 구독은 살아있음 / 시트 sync만 실패 → 토글 ON 유지
        handlePushTogglePref(true);
        showLocalToast("✓ 활성화됨 (시트 sync 보류)");
      } else {
        showLocalToast(`⚠️ ${res.error || "활성화 실패"}`);
      }
    } else {
      // OFF 흐름
      const { finalEngineerId, finalUserId } = resolveEngineerIds();
      const res = await unsubscribePushWithSync({
        userId:     finalUserId,
        engineerId: finalEngineerId,
      });
      handlePushTogglePref(false);
      if (res.ok) showLocalToast("✓ 푸시 알림이 비활성화되었습니다");
      else        showLocalToast(`⚠️ ${res.error || "비활성화 실패"}`);
    }
  }

  // 토스트 (간단 버전 — copyToast 자리 재사용)
  function showLocalToast(msg) {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(null), 2400);
  }

  function handleLogoutClick() {
    if (typeof window !== "undefined" && window.confirm("로그아웃 하시겠습니까?")) {
      onLogout && onLogout();
    }
  }

  function handleHelp()    { alert("준비 중입니다."); }
  function handleTerms()   { alert("준비 중입니다."); }
  function handlePassword(){ if (onChangePassword) onChangePassword(); else alert("준비 중입니다. 운영팀에 문의해주세요."); }
  function handleKakao()   {
    if (KAKAO_CHANNEL_URL) {
      window.open(KAKAO_CHANNEL_URL, "_blank");
    } else {
      alert("카톡 채널 준비 중입니다. 운영팀에 전화 부탁드립니다.");
    }
  }

  // 카드 공통 스타일
  const cardStyle = {
    background: isDark ? "#1C1C1E" : "#FFFFFF",
    border: `1px solid ${isDark ? "#2A2A2A" : "#EFE9E0"}`,
    borderRadius: 18,
    marginBottom: 14,
  };

  const initial = (eng.name || "?").charAt(0);
  const role = eng.role || "프로";
  const company = eng.companyName || eng.company || "올데이케어";

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      paddingBottom: 80,
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.4px" }}>
          👤 내 정보
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* 프로필 카드 */}
        <div style={{
          ...cardStyle,
          padding: "22px 18px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: "50%",
            background: "#FFB8D6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 28, color: "#FF1B8D", fontWeight: 700 }}>
              {initial}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 20, fontWeight: 700,
              color: isDark ? "#FAF8F5" : "#1A1A1A",
              letterSpacing: "-0.3px",
              marginBottom: 4,
            }}>
              {eng.name || "—"}
            </div>
            <div style={{
              fontSize: 13,
              color: isDark ? "#C8C8C8" : "#555",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}>
              <span style={{
                background: isDark ? "#2D0F1E" : "#FFE5F2",
                color: isDark ? "#FF4DA6" : "#FF1B8D",
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                fontWeight: 700,
              }}>
                {role}
              </span>
              <span>{company}</span>
            </div>
          </div>
        </div>

        {/* 운영팀 문의 카드 */}
        <div style={{ ...cardStyle, padding: "16px 18px" }}>
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: isDark ? "#FAF8F5" : "#1A1A1A",
            marginBottom: 14,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            💬 운영팀 문의
          </div>
          <div style={{ display: "grid", gridTemplateColumns: onContactOps ? "1fr 1fr" : "1fr", gap: 8 }}>
            {onContactOps && (
              <button onClick={onContactOps} style={{
                background: "#34C759",
                color: "#fff",
                border: "none",
                padding: 14,
                borderRadius: 12,
                fontSize: 14, fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                📞 전화
              </button>
            )}
            <button onClick={handleKakao} style={{
              background: "#FEE500",
              border: "none",
              color: "#391B1B",
              padding: 14,
              borderRadius: 12,
              fontSize: 14, fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#391B1B" aria-hidden="true">
                <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.74 5.16 4.36 6.55-.18.61-.65 2.18-.74 2.51-.12.4.15.4.31.29.13-.09 2.04-1.39 2.85-1.95.4.06.81.1 1.22.1 5.52 0 10-3.48 10-7.79S17.52 3 12 3z"/>
              </svg>
              카톡 문의
            </button>
          </div>
        </div>

        {/* 2026-06-18 Mig 141 — 사업자 정보 카드 (본인 입력, actor = userId) */}
        {(() => {
          const selfUserId = eng?.user_id || eng?.userId || "";
          if (!selfUserId) return null;
          return (
            <EngineerBusinessInfoCard
              userId={selfUserId}
              actor={selfUserId}
              isDark={isDark}
              cardStyle={cardStyle}
              onToast={showLocalToast}
            />
          );
        })()}

        {/* Step 5-8 design 🅓 — 정산 계좌 카드 (정산 탭 회사 송금 카드와 통일 디자인) */}
        <div style={{ ...cardStyle, padding: 18 }}>
          {/* 헤더 */}
          <div style={{
            fontSize: 14, fontWeight: 500,
            color: isDark ? "#BBB" : "#6B6359",
            marginBottom: 14,
            display: "flex", alignItems: "center", gap: 6,
            letterSpacing: "-0.1px",
          }}>
            💳 정산 계좌
          </div>

          {(() => {
            const bank   = (eng.bankName      || "").trim();
            const holder = (eng.accountHolder || eng.name || "").trim();
            const number = (eng.accountNumber || "").trim();
            const empty  = !bank && !holder && !number;
            if (empty) {
              return (
                <div style={{
                  fontSize: 13, fontStyle: "italic",
                  color: isDark ? "#777" : "#9A9A9A",
                  paddingBottom: 14, marginBottom: 14,
                  borderBottom: `0.5px solid ${isDark ? "#2A2A2A" : "#F5F2ED"}`,
                }}>
                  계좌 정보가 없습니다
                </div>
              );
            }
            return (
              <>
                {/* 은행 · 예금주 */}
                <div style={{
                  fontSize: 15, fontWeight: 500,
                  color: isDark ? "#FAF8F5" : "#1A1A1A",
                  marginBottom: 6,
                  letterSpacing: "-0.1px",
                }}>
                  {bank || "은행 미입력"} · {holder || "예금주 미입력"}
                </div>

                {/* 계좌번호 + 복사 */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  paddingBottom: 14, marginBottom: 14,
                  borderBottom: `0.5px solid ${isDark ? "#2A2A2A" : "#F5F2ED"}`,
                }}>
                  <div style={{
                    flex: 1, minWidth: 0,
                    fontSize: 14,
                    color: isDark ? "#BBB" : "#6B6359",
                    fontFamily: "monospace",
                    letterSpacing: 0.4,
                    overflowWrap: "anywhere",
                  }}>
                    {number || "계좌번호 미입력"}
                  </div>
                  <button onClick={handleCopyAccount} style={{
                    padding: "5px 12px",
                    background: isDark ? "rgba(255,255,255,0.06)" : "#F5F2ED",
                    border: "none",
                    borderRadius: 8,
                    color: isDark ? "#BBB" : "#6B6359",
                    fontSize: 12, fontFamily: "inherit",
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <span>📋</span> 복사
                  </button>
                </div>
              </>
            );
          })()}

          {/* 변경 신청 버튼 */}
          <button onClick={onChangeAccount} style={{
            width: "100%",
            padding: 13,
            background: "#FF1B8D",
            border: "none", borderRadius: 12,
            color: "#fff",
            fontSize: 14, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
            letterSpacing: "-0.1px",
          }}>
            ✏️ 변경 신청
          </button>
        </div>

        {/* 설정 카드 */}
        <div style={{ ...cardStyle, padding: "6px 0" }}>
          <SectionHeader isDark={isDark}>설정</SectionHeader>
          <SettingRow icon="🌙" label="다크 모드" isDark={isDark}
            rightSlot={<Toggle on={darkOn} onChange={handleDarkToggle}/>}/>
          <SettingRow icon="🔔" label="푸시 알림" isDark={isDark}
            rightSlot={<Toggle on={push} onChange={handlePushToggle}/>}/>
          <SettingRow icon="🔠" label="글자 크기" isDark={isDark}
            rightSlot={
              <div style={{ display: "flex", gap: 4 }}>
                <FontSizeButton label="작게" size="small"  current={fontSize} onChange={setFontSize} isDark={isDark}/>
                <FontSizeButton label="기본" size="medium" current={fontSize} onChange={setFontSize} isDark={isDark}/>
                <FontSizeButton label="크게" size="large"  current={fontSize} onChange={setFontSize} isDark={isDark}/>
              </div>
            }/>
          <SettingRow icon="🔒" label="비밀번호 변경" isDark={isDark} onClick={handlePassword}
            rightSlot={<Chevron isDark={isDark}/>} isLast/>
        </div>

        {/* 정보 카드 */}
        <div style={{ ...cardStyle, padding: "6px 0" }}>
          <SectionHeader isDark={isDark}>정보</SectionHeader>
          <SettingRow icon="📖" label="도움말"   isDark={isDark} onClick={handleHelp}
            rightSlot={<Chevron isDark={isDark}/>}/>
          <SettingRow icon="📜" label="이용 약관" isDark={isDark} onClick={handleTerms}
            rightSlot={<Chevron isDark={isDark}/>}/>
          <SettingRow icon="ℹ️" label="버전" isDark={isDark}
            rightSlot={
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: isDark ? "#999" : "#6B6359",
              }}>
                {APP_VERSION}
              </span>
            } isLast/>
        </div>

        {/* 로그아웃 */}
        <button onClick={handleLogoutClick} style={{
          width: "100%",
          background: isDark ? "transparent" : "#FFFFFF",
          border: "1.5px solid #FF3B5C",
          color: isDark ? "#FF6B85" : "#FF3B5C",
          padding: 16,
          borderRadius: 14,
          fontSize: 15, fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          marginTop: 4,
        }}>
          🚪 로그아웃
        </button>
      </div>

      <EngineerBottomNav active="me" onChange={onTabChange} unreadCount={unreadCount}/>

      {/* Step 5-8 design 🅓 — 계좌번호 복사 토스트 */}
      {copyToast && (
        <div style={{
          position: "fixed", left: "50%", bottom: "calc(96px + env(safe-area-inset-bottom))",
          transform: "translateX(-50%)",
          background: "rgba(0, 135, 90, 0.95)", color: "#fff",
          padding: "10px 16px", borderRadius: 10,
          fontSize: 12, fontWeight: 600,
          maxWidth: "85%", textAlign: "center", lineHeight: 1.5,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 9999, fontFamily: "inherit",
          pointerEvents: "none",
        }}>
          {copyToast}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ isDark, children }) {
  return (
    <div style={{
      fontSize: 11,
      color: isDark ? "#999" : "#6B6359",
      fontWeight: 700,
      letterSpacing: 0.3,
      padding: "12px 18px 6px",
    }}>
      {children}
    </div>
  );
}

function SettingRow({ icon, label, rightSlot, onClick, isLast, isDark }) {
  return (
    <div onClick={onClick} style={{
      padding: "14px 18px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: isLast ? "none" : `0.5px solid ${isDark ? "#2A2A2A" : "#F5F2ED"}`,
      cursor: onClick ? "pointer" : "default",
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{
          fontSize: 14,
          color: isDark ? "#FAF8F5" : "#1A1A1A",
          fontWeight: 600,
        }}>
          {label}
        </span>
      </div>
      <div style={{ flexShrink: 0 }}>{rightSlot}</div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{
      width: 44, height: 26,
      background: on ? "#FF1B8D" : "#E5E0D6",
      borderRadius: 999,
      padding: 2,
      display: "flex",
      justifyContent: on ? "flex-end" : "flex-start",
      boxSizing: "border-box",
      cursor: "pointer",
      transition: "background 0.2s",
    }}>
      <div style={{
        width: 22, height: 22,
        background: "#fff",
        borderRadius: "50%",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }}/>
    </div>
  );
}

function FontSizeButton({ label, size, current, onChange, isDark }) {
  const isActive = current === size;
  const fontSize = size === "small" ? 12 : size === "large" ? 14 : 13;
  return (
    <button onClick={() => onChange(size)} style={{
      background: isActive ? "#FF1B8D" : (isDark ? "transparent" : "#fff"),
      border: isActive ? "1px solid #FF1B8D" : `1px solid ${isDark ? "#2A2A2A" : "#EFE9E0"}`,
      color: isActive ? "#fff" : (isDark ? "#999" : "#555"),
      padding: "5px 11px",
      borderRadius: 8,
      fontSize: fontSize,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
    }}>
      {label}
    </button>
  );
}

function Chevron({ isDark }) {
  return (
    <span style={{ color: isDark ? "#555" : "#B0A99E", fontSize: 16 }}>›</span>
  );
}

// Step 5-8 F-5 — 계좌 한 블록 (예금주 · 은행 / 번호 / 부가 액션)
function AccountBlock({ isDark, label, sub, holder, bank, number, actionLabel, onAction }) {
  const empty = !holder && !bank && !number;
  return (
    <div style={{
      padding: "12px 18px",
      borderBottom: `0.5px solid ${isDark ? "#2A2A2A" : "#F5F2ED"}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: isDark ? "#FAF8F5" : "#1A1A1A",
            marginBottom: 4,
          }}>
            {label}
          </div>
          {sub && (
            <div style={{
              fontSize: 11, color: isDark ? "#999" : "#6B6359",
              marginBottom: 8,
            }}>
              {sub}
            </div>
          )}
          {empty ? (
            <div style={{ fontSize: 12, color: isDark ? "#777" : "#9A9A9A", fontStyle: "italic" }}>
              계좌 정보가 없습니다
            </div>
          ) : (
            <>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: isDark ? "#FAF8F5" : "#1A1A1A",
              }}>
                {holder || "—"} · {bank || "—"}
              </div>
              <div style={{
                fontSize: 12, color: isDark ? "#999" : "#6B6359",
                fontFamily: "monospace", letterSpacing: 0.3, marginTop: 2,
              }}>
                {number || "—"}
              </div>
            </>
          )}
        </div>
        {onAction && (
          <button onClick={onAction} style={{
            background: "transparent",
            border: `1px solid ${isDark ? "#2A2A2A" : "#EFE9E0"}`,
            color: isDark ? "#FF4DA6" : "#FF1B8D",
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            flexShrink: 0,
          }}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default EngineerMeTab;

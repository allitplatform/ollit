import { useState, useEffect } from "react";
import { LoginScreen } from "./components/LoginScreen.jsx";
import EngineerApp from "./pages/EngineerApp.jsx";
import HappycallApp from "./pages/HappycallApp.jsx";
import AdminApp from "./pages/AdminApp.jsx";
import PrincipalApp from "./pages/PrincipalApp.jsx";
import LandingApp from "./pages/LandingApp.jsx";
import MarketingPwaApp from "./pages/MarketingPwaApp.jsx";

// 2026-06-23 — 마케팅 랜딩 도메인 / 경로 진입 시 LandingApp 만 렌더 (운영 PWA 분기 차단).
//   2026-06-24 — 올데이케어.kr (한글 도메인) 추가:
//     · punycode 형태: xn--2n1bk06aikal6b92t.kr (브라우저 hostname 일반 값)
//     · 한글 디코딩 대비: '올데이케어' 도 같이 체크
//   ollit.vercel.app 등 운영 PWA 호스트는 영향 X (기존 분기 그대로).
function _isLandingRoute() {
  if (typeof window === "undefined") return false;
  const host = (window.location.hostname || "").toLowerCase();
  const path = window.location.pathname || "";
  const search = window.location.search || "";
  if (host.includes("alldaycare")) return true;
  if (host.includes("xn--2n1bk06aikal6b92t")) return true;  // 올데이케어.kr punycode
  if (host.includes("올데이케어")) return true;             // 한글 디코딩 대비
  if (path.startsWith("/landing")) return true;
  if (path.startsWith("/privacy")) return true;             // 2026-06-24 — 개인정보처리방침 페이지
  if (search.includes("page=landing")) return true;
  return false;
}

// 2026-08-03 — 올잇 마케팅 PWA 경로 (/mkt). 같은 로그인(폰번호+비밀번호)을 쓰되,
//   로그인 후 역할 분기 대신 마케팅 관제판(MarketingPwaApp)으로 진입.
//   접근은 대표/운영자(owner) 역할만. manifest 를 /mkt-manifest.json 으로 바꿔
//   홈 화면 추가 시 "올잇마케팅" 별도 앱으로 설치되게 한다.
function _isMktRoute() {
  if (typeof window === "undefined") return false;
  return (window.location.pathname || "").startsWith("/mkt");
}
import { TasksProvider } from "./shared/TasksContext.jsx";
import { SplashScreen } from "./components/SplashScreen.jsx";
import { applyTheme, loadTheme } from "./styles/themes.js";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt.jsx";
import { KakaoBypassScreen } from "./components/KakaoBypassScreen.jsx";
import { isKakaoInApp, tryBypassKakao } from "./lib/kakaoBypass.js";
import { PasswordChangeScreen } from "./components/PasswordChangeScreen.jsx";
import {
  // 2026-07-24 — addNotification import 제거 (중복 저장 수리 — 저장은 SW 한 곳만)
  clearAll as clearAllStoredNotifications,
} from "./utils/notificationStore.js";
import { switchActiveRole } from "./lib/roles.js";

// Phase 2 — 자동 로그인 (localStorage)
// auth.js 측 LS_KEY = "allit.user" 박은 영역 박은 영역 (signInWithPhone 측 박은 영역 박은 영역 박은 영역)
const STORAGE_KEY = "allit.user";

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // user_id (RPC 응답) 또는 role 박은 영역 박은 영역 박은 영역 — LoginScreen 박은 영역 박은 영역 role 박음
    if (!parsed?.role && !parsed?.user_id) return null;
    return parsed;
  } catch { return null; }
}

// 메인 App: 로그인 상태에 따라 화면 분기
// TasksProvider를 최상위로 두어 로그인/로그아웃 시에도 task state 유지
export default function App() {
  // 2026-06-23 — 마케팅 랜딩 도메인 / 경로 진입 시 LandingApp 만 렌더. 운영 PWA hook 전부 우회.
  if (_isLandingRoute()) return <LandingApp />;

  // V14 — 카톡 인앱 브라우저 감지 (최우선)
  const [kakaoChecked, setKakaoChecked] = useState(false);
  const [showKakaoScreen, setShowKakaoScreen] = useState(false);

  // 첫 렌더 1.5초 스플래시 (올잇 마크 + 펄스)
  const [splashDone, setSplashDone] = useState(false);
  // 로그인 상태 (현재 로그인한 유저 정보) — V14 Phase 4-D: localStorage 자동 복원
  const [currentUser, setCurrentUser] = useState(() => readStoredUser());

  // 카톡 인앱 감지 + 우회 시도 (마운트 직후 1회)
  useEffect(() => {
    if (isKakaoInApp()) {
      tryBypassKakao();
      // 우회 성공 시 페이지가 외부 브라우저로 이동 → 이 컴포넌트 unmount
      // 1.5초 후에도 같은 페이지면 우회 실패 → 안내 화면 표시
      const timer = setTimeout(() => {
        setShowKakaoScreen(true);
        setKakaoChecked(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
    setKakaoChecked(true);
  }, []);

  // 앱 시작 시 저장된 테마 적용 (CSS 변수 세팅)
  useEffect(() => {
    applyTheme(loadTheme());
  }, []);

  // 2026-08-03 — /mkt 경로면 manifest 를 마케팅용으로 교체 (별도 PWA 설치용)
  useEffect(() => {
    if (!_isMktRoute()) return;
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.setAttribute("href", "/mkt-manifest.json");
    document.title = "올잇 마케팅";
  }, []);

  // V14 — 앱 시작 시 저장된 글자 크기 적용 (data-font-size → CSS zoom)
  useEffect(() => {
    let saved = "medium";
    try {
      const v = localStorage.getItem("ollit_font_size");
      if (v === "small" || v === "medium" || v === "large") saved = v;
    } catch (e) {}
    document.documentElement.setAttribute("data-font-size", saved);
  }, []);

  // 2026-05-11 진단 — 콘솔에서 켤 수 있는 normalize 진단 플래그
  if (typeof window !== "undefined" && typeof window.__DEBUG_NORMALIZE === "undefined") {
    window.__DEBUG_NORMALIZE = false;
  }

  // 2026-05-10 — service worker push 메시지 수신 → 카운터 갱신 트리거.
  // 2026-07-24 fix — 인앱 알림함 2줄 중복 (사장님 리포트: 역할 1개인데도 2개).
  //   원인: SW push 핸들러가 IndexedDB 직접 저장 + 앱도 여기서 addNotificationToStore
  //         → 앱이 열려 있을 때 받은 푸시만 2번 저장 (양쪽이 동시에 써서 dedup 도 무력).
  //   수리: 저장은 SW 한 곳만 (백그라운드 포함 항상 저장됨). 앱은 새로고침 신호만.
  //         SW 저장 커밋보다 postMessage 가 먼저 도착할 수 있어 400ms 지연 후 dispatch.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const handler = (event) => {
      if (event.data?.type !== "PUSH_RECEIVED") return;
      setTimeout(() => {
        try {
          window.dispatchEvent(new CustomEvent("notification:added"));
        } catch (e) { /* */ }
      }, 400);
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  // 카톡 인앱 — 안내 화면 표시 (다른 화면 진입 차단)
  if (showKakaoScreen) {
    return <KakaoBypassScreen/>;
  }

  // 카톡 검증 끝나기 전엔 splash 유지
  if (!kakaoChecked || !splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)}/>;
  }

  // 로그인 콜백 — Phase 2: 항상 localStorage 박음 (auth.js 박은 영역 박은 영역 박은 영역 박은 영역 박은 영역)
  // isQuickLogin 박은 영역 박은 영역 박은 영역 박을 영역 박혀있어 박힘 박을 영역 (점진 교체 박을 영역)
  const handleLogin = (user, isQuickLogin = false) => {
    setCurrentUser(user);
    if (!isQuickLogin) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(user)); } catch {}
    }
  };

  // 로그아웃 콜백 — localStorage 제거 + 인앱 알림(IndexedDB) 비움
  // 2026-06-11 — 계정 격리 최소안 (A). 발송/저장 측 recipientUserId 미도입 상태라
  //   같은 기기에 다른 계정으로 다시 로그인하면 옛 사용자 알림이 그대로 보이는 문제 해소.
  //   clearAll 실패해도 로그아웃 자체는 진행 (사일런트).
  const handleLogout = () => {
    setCurrentUser(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    clearAllStoredNotifications().catch(() => {});
  };

  // Phase 2 — 강제 비번 변경 완료 콜백 (must_change_password=false 박음)
  const handlePasswordChanged = (updatedUser) => {
    setCurrentUser(updatedUser);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser)); } catch {}
  };

  // 2026-06-06 — 다중 role (engineer+admin) 사용자 역할 전환 핸들러.
  //   currentUser.role 만 swap → App.jsx renderScreen switch 측 다른 앱 측 측.
  //   side-effect: EngineerApp/AdminApp 측 unmount→mount → Realtime 구독 자동 재구독.
  //   push 구독은 그대로 — kind 게이트 (Mig 101) 만 적용되므로 영향 없음.
  const handleSwitchRole = (newDbRole) => {
    if (!currentUser) return;
    if (currentUser.dbRole === newDbRole) return;
    const updated = switchActiveRole(currentUser, newDbRole);
    setCurrentUser(updated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
  };

  // 화면 분기 (TasksProvider 안쪽에서 결정)
  const renderScreen = () => {
    if (!currentUser) {
      return <LoginScreen onLogin={handleLogin} />;
    }
    // Phase 2 — 첫 로그인 강제 비번 변경 (must_change_password === true 만 차단)
    // 시범 빠른 로그인은 필드 없음(undefined) → 통과
    if (currentUser.must_change_password === true) {
      return <PasswordChangeScreen user={currentUser} onComplete={handlePasswordChanged} />;
    }
    // 2026-08-03 — /mkt = 올잇 마케팅 PWA. 대표/운영자만, 그 외 역할은 안내 후 로그아웃 유도.
    //   주의: DB_TO_APP_ROLE 이 owner → "admin" 으로 변환하므로 role 이 아니라
    //   dbRole / roles[] 의 원본 값("owner")으로 판정해야 한다.
    if (_isMktRoute()) {
      const mktAllowed = currentUser.dbRole === "owner"
        || (Array.isArray(currentUser.roles) && currentUser.roles.includes("owner"))
        || currentUser.role === "owner";
      if (mktAllowed) {
        return <MarketingPwaApp user={currentUser} onLogout={handleLogout} />;
      }
      return (
        <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#F5F5F5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "'Pretendard', sans-serif", padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>올잇 마케팅</div>
          <div style={{ fontSize: 13, color: "#B9BDC4", lineHeight: 1.7 }}>이 화면은 마케팅 운영 계정 전용입니다.<br/>계정 권한을 확인해 주세요.</div>
          <button onClick={handleLogout} style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "#FF1B8D", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>다른 계정으로 로그인</button>
        </div>
      );
    }
    switch (currentUser.role) {
      case "engineer":
        return <EngineerApp user={currentUser} onLogout={handleLogout} onSwitchRole={handleSwitchRole} />;
      case "happycall":
        // 2026-07-27 — 해피콜 직원 채용 (사장님 확정): 운영자 앱 재사용 + 돈·관리 숨김.
        //   옛 목업 HappycallApp (4월 시연용) 라우팅 폐기 — 파일은 보존.
        return <AdminApp user={currentUser} onLogout={handleLogout} happycallMode />;
      case "admin":
        return <AdminApp user={currentUser} onLogout={handleLogout} onSwitchRole={handleSwitchRole} />;
      case "principal":
        return <PrincipalApp user={currentUser} onLogout={handleLogout} />;
      default:
        return <LoginScreen onLogin={handleLogin} />;
    }
  };

  return (
    <TasksProvider>
      {renderScreen()}
      {/* 2026-06-06 — RoleSwitcher 측 측측 각 앱 헤더 inline 측측 측측. floating 모드 X. */}
      {/* PWA 자동 안내 모달 — 1.5초 후 / standalone X / 24시간 dismiss / 카톡 외 인앱 catch */}
      <PWAInstallPrompt/>
    </TasksProvider>
  );
}

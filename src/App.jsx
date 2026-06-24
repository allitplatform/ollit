import { useState, useEffect } from "react";
import { LoginScreen } from "./components/LoginScreen.jsx";
import EngineerApp from "./pages/EngineerApp.jsx";
import HappycallApp from "./pages/HappycallApp.jsx";
import AdminApp from "./pages/AdminApp.jsx";
import PrincipalApp from "./pages/PrincipalApp.jsx";
import LandingApp from "./pages/LandingApp.jsx";

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
import { TasksProvider } from "./shared/TasksContext.jsx";
import { SplashScreen } from "./components/SplashScreen.jsx";
import { applyTheme, loadTheme } from "./styles/themes.js";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt.jsx";
import { KakaoBypassScreen } from "./components/KakaoBypassScreen.jsx";
import { isKakaoInApp, tryBypassKakao } from "./lib/kakaoBypass.js";
import { PasswordChangeScreen } from "./components/PasswordChangeScreen.jsx";
import {
  addNotification as addNotificationToStore,
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

  // 2026-05-10 — service worker push 메시지 수신 → IndexedDB 저장 + 카운터 갱신 트리거
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const handler = (event) => {
      if (event.data?.type !== "PUSH_RECEIVED") return;
      const payload = event.data.data || {};
      const { title, body, url, taskId } = payload;
      addNotificationToStore({ title, body, url, taskId }).then(() => {
        // 카운터 갱신 트리거 (커스텀 이벤트)
        try {
          window.dispatchEvent(new CustomEvent("notification:added"));
        } catch (e) { /* */ }
      });
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
    switch (currentUser.role) {
      case "engineer":
        return <EngineerApp user={currentUser} onLogout={handleLogout} onSwitchRole={handleSwitchRole} />;
      case "happycall":
        return <HappycallApp user={currentUser} onLogout={handleLogout} />;
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

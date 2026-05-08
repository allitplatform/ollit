import { useState, useEffect } from "react";
import { LoginScreen } from "./components/LoginScreen.jsx";
import EngineerApp from "./pages/EngineerApp.jsx";
import HappycallApp from "./pages/HappycallApp.jsx";
import AdminApp from "./pages/AdminApp.jsx";
import PrincipalApp from "./pages/PrincipalApp.jsx";
import { TasksProvider } from "./shared/TasksContext.jsx";
import { SplashScreen } from "./components/SplashScreen.jsx";
import { applyTheme, loadTheme } from "./styles/themes.js";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt.jsx";
import { KakaoBypassScreen } from "./components/KakaoBypassScreen.jsx";
import { isKakaoInApp, tryBypassKakao } from "./lib/kakaoBypass.js";
import { PasswordChangeScreen } from "./components/PasswordChangeScreen.jsx";

// V14 Phase 4-D — 자동 로그인 (localStorage)
const STORAGE_KEY = "ollit_currentUser";

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.userId || !parsed?.role) return null;
    return parsed;
  } catch { return null; }
}

// 메인 App: 로그인 상태에 따라 화면 분기
// TasksProvider를 최상위로 두어 로그인/로그아웃 시에도 task state 유지
export default function App() {
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

  // 카톡 인앱 — 안내 화면 표시 (다른 화면 진입 차단)
  if (showKakaoScreen) {
    return <KakaoBypassScreen/>;
  }

  // 카톡 검증 끝나기 전엔 splash 유지
  if (!kakaoChecked || !splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)}/>;
  }

  // 로그인 콜백 — V14 Phase 4-D: V14 path만 localStorage 저장 (시범 빠른 로그인은 저장 X)
  const handleLogin = (user, isQuickLogin = false) => {
    setCurrentUser(user);
    if (!isQuickLogin) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(user)); } catch {}
    }
  };

  // 로그아웃 콜백 — localStorage 제거
  const handleLogout = () => {
    setCurrentUser(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  // V14 Phase 4-E-1 — 강제 비번 변경 완료 콜백
  const handlePasswordChanged = (updatedUser) => {
    setCurrentUser(updatedUser);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser)); } catch {}
  };

  // 화면 분기 (TasksProvider 안쪽에서 결정)
  const renderScreen = () => {
    if (!currentUser) {
      return <LoginScreen onLogin={handleLogin} />;
    }
    // V14 Phase 4-E-1 — 첫 로그인 강제 비번 변경 (passwordChanged === false 만 차단)
    // 시범 7계정은 passwordChanged 필드 없음(undefined) → 통과
    if (currentUser.passwordChanged === false) {
      return <PasswordChangeScreen user={currentUser} onComplete={handlePasswordChanged} />;
    }
    switch (currentUser.role) {
      case "engineer":
        return <EngineerApp user={currentUser} onLogout={handleLogout} />;
      case "happycall":
        return <HappycallApp user={currentUser} onLogout={handleLogout} />;
      case "admin":
        return <AdminApp user={currentUser} onLogout={handleLogout} />;
      case "principal":
        return <PrincipalApp user={currentUser} onLogout={handleLogout} />;
      default:
        return <LoginScreen onLogin={handleLogin} />;
    }
  };

  return (
    <TasksProvider>
      {renderScreen()}
      {/* PWA 자동 안내 모달 — 1.5초 후 / standalone X / 24시간 dismiss / 카톡 외 인앱 catch */}
      <PWAInstallPrompt/>
    </TasksProvider>
  );
}

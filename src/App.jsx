import { useState, useEffect } from "react";
import { LoginScreen } from "./components/LoginScreen.jsx";
import EngineerApp from "./pages/EngineerApp.jsx";
import HappycallApp from "./pages/HappycallApp.jsx";
import AdminApp from "./pages/AdminApp.jsx";
import PrincipalApp from "./pages/PrincipalApp.jsx";
import { TasksProvider } from "./shared/TasksContext.jsx";
import { SplashScreen } from "./components/SplashScreen.jsx";
import { applyTheme, loadTheme } from "./styles/themes.js";

// 메인 App: 로그인 상태에 따라 화면 분기
// TasksProvider를 최상위로 두어 로그인/로그아웃 시에도 task state 유지
export default function App() {
  // 첫 렌더 1.5초 스플래시 (올잇 마크 + 펄스)
  const [splashDone, setSplashDone] = useState(false);
  // 로그인 상태 (현재 로그인한 유저 정보)
  const [currentUser, setCurrentUser] = useState(null);

  // 앱 시작 시 저장된 테마 적용 (CSS 변수 세팅)
  useEffect(() => {
    applyTheme(loadTheme());
  }, []);

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)}/>;
  }

  // 로그인 콜백
  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  // 로그아웃 콜백
  const handleLogout = () => {
    setCurrentUser(null);
  };

  // 화면 분기 (TasksProvider 안쪽에서 결정)
  const renderScreen = () => {
    if (!currentUser) {
      return <LoginScreen onLogin={handleLogin} />;
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
    </TasksProvider>
  );
}

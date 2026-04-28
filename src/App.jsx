import { useState } from "react";
import LoginScreen from "./pages/LoginScreen.jsx";
import EngineerApp from "./pages/EngineerApp.jsx";
import HappycallApp from "./pages/HappycallApp.jsx";
import AdminApp from "./pages/AdminApp.jsx";
import PrincipalApp from "./pages/PrincipalApp.jsx";

// 메인 App: 로그인 상태에 따라 화면 분기
export default function App() {
  // 로그인 상태 (현재 로그인한 유저 정보)
  const [currentUser, setCurrentUser] = useState(null);

  // 로그인 콜백
  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  // 로그아웃 콜백
  const handleLogout = () => {
    setCurrentUser(null);
  };

  // 로그인 안 됨 → 로그인 화면
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // 역할별 화면 분기
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
      // 알 수 없는 역할 → 로그아웃
      return <LoginScreen onLogin={handleLogin} />;
  }
}

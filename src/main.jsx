import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Step 6-1 (1단계) — Service Worker 등록 (PROD only)
// 푸시 알림 핸들러 박은 service-worker.js 사용 (옛 sw.js는 자동 대체됨 / activate 시 옛 캐시 정리)
// 2026-06-23 — 마케팅 랜딩 도메인/경로 진입 시 PWA SW 등록 차단 (별도 진실 — 운영 PWA 와 분리).
function _isLandingRoute() {
  const host = (window.location.hostname || "").toLowerCase();
  const path = window.location.pathname || "";
  const search = window.location.search || "";
  return host.includes("alldaycare") || path.startsWith("/landing") || search.includes("page=landing");
}
if ("serviceWorker" in navigator && import.meta.env.PROD && !_isLandingRoute()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("[Step 6-1] SW 등록 완료:", reg.scope))
      .catch((err) => console.warn("[Step 6-1] SW 등록 실패:", err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Step 6-1 (1단계) — Service Worker 등록 (PROD only)
// 푸시 알림 핸들러 박은 service-worker.js 사용 (옛 sw.js는 자동 대체됨 / activate 시 옛 캐시 정리)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
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

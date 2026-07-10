import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Step 6-1 (1단계) — Service Worker 등록 (PROD only)
// 푸시 알림 핸들러 박은 service-worker.js 사용 (옛 sw.js는 자동 대체됨 / activate 시 옛 캐시 정리)
// 2026-06-23 — 마케팅 랜딩 도메인/경로 진입 시 PWA SW 등록 차단 (별도 진실 — 운영 PWA 와 분리).
//   2026-06-24 — 올데이케어.kr 추가 (punycode xn--2n1bk06aikal6b92t / 한글 디코딩 둘 다).
function _isLandingRoute() {
  const host = (window.location.hostname || "").toLowerCase();
  const path = window.location.pathname || "";
  const search = window.location.search || "";
  return (
    host.includes("alldaycare") ||
    host.includes("xn--2n1bk06aikal6b92t") ||  // 올데이케어.kr punycode
    host.includes("올데이케어") ||             // 한글 디코딩 대비
    path.startsWith("/landing") ||
    path.startsWith("/privacy") ||             // 2026-06-24 — 개인정보처리방침
    search.includes("page=landing")
  );
}
if ("serviceWorker" in navigator && import.meta.env.PROD && !_isLandingRoute()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("[Step 6-1] SW 등록 완료:", reg.scope))
      .catch((err) => console.warn("[Step 6-1] SW 등록 실패:", err));
  });
}

// 2026-07-10 — GA4 (Google Analytics 4) 손님용 랜딩 host 에서만 로드.
//   ⚠️ 운영 PWA (ollit.vercel.app 운영자 화면) 는 절대 로드 X — _isLandingRoute() true 인 경우만.
//   ⚠️ PII (이름/전화/주소) 이벤트 파라미터 절대 삽입 X — service_type 만.
//   · 측정 ID: G-D7PDSCVHBS
//   · page_view: 스크립트 초기화 시 자동
//   · 전환 이벤트 generate_lead: handleSubmit 성공 콜백 측에서 발화 (LandingApp.jsx)
if (import.meta.env.PROD && _isLandingRoute()) {
  const GA_ID = "G-D7PDSCVHBS";
  // dataLayer / gtag stub — 스크립트 load 지연 시에도 event push 가능.
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

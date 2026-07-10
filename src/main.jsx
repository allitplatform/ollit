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
  s.onload  = () => console.log("[GA4] gtag.js loaded", GA_ID);
  s.onerror = (e) => console.warn("[GA4] gtag.js load failed (ad-blocker?)", e);
  document.head.appendChild(s);
  console.log("[GA4] init", GA_ID, "host=", window.location.hostname);
}

// 2026-07-10 — 네이버 프리미엄 로그분석 (wcslog.js).
//   ⚠️ 로드 조건 = GA4 와 완전 동일 (랜딩 host + PROD only). 운영 PWA 는 X.
//   · SPA 라 최초 진입 시 1회 실행. wcs.inflow() 로 네이버 광고 유입 파라미터 캡처.
//   · guard: window.wcs 없으면 skip (차단기/네트워크 대비).
if (import.meta.env.PROD && _isLandingRoute()) {
  const NAVER_SITE_ID = "s_27453e8ff114";
  // wcs_add / _nasa stub — 스크립트 load 전에도 참조 안전.
  window.wcs_add       = window.wcs_add || {};
  window.wcs_add["wa"] = NAVER_SITE_ID;
  window._nasa         = window._nasa || {};
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://wcs.naver.net/wcslog.js";
  s.onload = () => {
    try {
      if (window.wcs && typeof window.wcs.inflow === "function") {
        window.wcs.inflow();
        if (typeof window.wcs_do === "function") window.wcs_do();
        console.log("[NAVER] wcs loaded", NAVER_SITE_ID);
      } else {
        console.warn("[NAVER] wcs unavailable after script load");
      }
    } catch (err) {
      console.warn("[NAVER] wcs init throw", err);
    }
  };
  s.onerror = (e) => console.warn("[NAVER] wcslog.js load failed (ad-blocker?)", e);
  document.head.appendChild(s);
  console.log("[NAVER] init", NAVER_SITE_ID, "host=", window.location.hostname);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

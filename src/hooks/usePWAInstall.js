// src/hooks/usePWAInstall.js
// PWA 홈 화면 추가 안내 - iOS / Android / 인앱 분기 + 디스미스 로직 (24시간)

import { useEffect, useState } from "react";
import { isInAppBrowser, isKakaoInApp } from "../lib/kakaoBypass.js";

const STORAGE_KEY_DISMISSED_AT = "ollit_pwa_dismissed_at";
const STORAGE_KEY_DISMISSED_FOREVER = "ollit_pwa_dismissed_forever";
const REMIND_AFTER_HOURS = 24; // 사장님 spec: 24시간

// 플랫폼 감지 (인앱 우선)
function detectPlatform() {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();

  // 카톡은 KakaoBypassScreen이 별도 처리 → 여기선 'inApp' 반환 X
  // 카톡 외 인앱(NAVER/FB/Instagram/Line/Daum)만 'inApp' 모드
  if (isInAppBrowser() && !isKakaoInApp()) return "inApp";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "other";
}

// 이미 PWA로 실행 중인지
function isStandalone() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.navigator.standalone === true) return true;
  return false;
}

// 안내 띄울지 결정
function shouldShowBanner() {
  if (isStandalone()) return false;

  try {
    if (localStorage.getItem(STORAGE_KEY_DISMISSED_FOREVER) === "true") {
      return false;
    }
  } catch (e) {}

  try {
    const lastDismissed = localStorage.getItem(STORAGE_KEY_DISMISSED_AT);
    if (lastDismissed) {
      const hoursAgo = (Date.now() - Number(lastDismissed)) / (1000 * 60 * 60);
      if (hoursAgo < REMIND_AFTER_HOURS) return false;
    }
  } catch (e) {}

  return true;
}

export function usePWAInstall() {
  const [platform] = useState(() => detectPlatform());
  const [showModal, setShowModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    if (!shouldShowBanner()) return;

    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowModal(true), 1000);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // iOS / 인앱 브라우저는 beforeinstallprompt 이벤트 X → 1.5초 후 자동 표시
    if (platform === "ios" || platform === "inApp") {
      const timer = setTimeout(() => {
        if (shouldShowBanner()) setShowModal(true);
      }, 1500);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [platform]);

  async function handleAdd() {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        markDismissedForever();
      } catch (e) {
        markDismissedForever();
      }
      setDeferredPrompt(null);
    } else {
      markDismissedForever();
    }
    setShowModal(false);
  }

  function handleLater() {
    markDismissedAt();
    setShowModal(false);
  }

  return {
    showModal,
    platform,
    handleAdd,
    handleLater,
  };
}

function markDismissedForever() {
  try {
    localStorage.setItem(STORAGE_KEY_DISMISSED_FOREVER, "true");
  } catch (e) {}
}

function markDismissedAt() {
  try {
    localStorage.setItem(STORAGE_KEY_DISMISSED_AT, String(Date.now()));
  } catch (e) {}
}

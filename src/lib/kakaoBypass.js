// V14 — 카톡 인앱 브라우저 감지 + 외부 브라우저 우회
// iOS = kakaotalk://web/openExternal / Android = intent:// scheme

export function isKakaoInApp() {
  if (typeof navigator === "undefined") return false;
  return /KAKAOTALK/i.test(navigator.userAgent);
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

// 외부 브라우저 우회 시도
// 성공하면 페이지가 외부 브라우저로 이동 (이 컴포넌트는 unmount됨)
// 실패하면 그대로 카톡 인앱 — 안내 화면 표시
export function tryBypassKakao() {
  if (!isKakaoInApp() || typeof window === "undefined") return false;

  const url = window.location.href;

  if (isIOS()) {
    // iOS — kakaotalk scheme으로 Safari 외부 열기
    window.location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(url);
    return true;
  }

  if (isAndroid()) {
    // Android — intent scheme으로 Chrome 강제 호출
    const stripped = url.replace(/^https?:\/\//, "");
    window.location.href =
      "intent://" + stripped +
      "#Intent;scheme=https;package=com.android.chrome;end";
    return true;
  }

  return false;
}

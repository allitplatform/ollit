// 2026-07-13 — 재사용 새로고침 버튼 (사장님 spec: 대시보드 + 목록 화면 공용).
//
// Props:
//   onRefresh   — 재조회 함수 (async, Promise 반환).
//   title       — 접근성 라벨 (기본 '새로고침').
//   size        — 아이콘 크기 (기본 14).
//   loading     — 부모가 로딩 상태 소유 시 명시 전달 (선택). 없으면 내부 관리.
//   dark        — 다크 테마 강제 (기본 true — 관리자 앱 다크 톤).
//
// 동작:
//   · 클릭 → onRefresh() await. 진행 중 스핀 애니메이션 (transform rotate).
//   · 로딩 중 disabled → 연타 방지 (사장님 spec).
//   · onRefresh 예외는 삼킴 (콘솔 warn) — UI 는 로딩 해제 후 원복.

import { useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";

export function RefreshButton({
  onRefresh,
  title = "새로고침",
  size = 14,
  loading: externalLoading,
  dark = true,
}) {
  const [internalLoading, setInternalLoading] = useState(false);
  const controlled = typeof externalLoading === "boolean";
  const loading = controlled ? externalLoading : internalLoading;

  const handleClick = useCallback(async () => {
    if (loading) return;
    if (!controlled) setInternalLoading(true);
    try {
      const res = onRefresh?.();
      if (res && typeof res.then === "function") await res;
    } catch (e) {
      console.warn("[RefreshButton] onRefresh 실패", e);
    } finally {
      if (!controlled) setInternalLoading(false);
    }
  }, [loading, onRefresh, controlled]);

  const border = dark ? "var(--border, #2A2A2A)" : "#E5EAF1";
  const bg     = dark ? "var(--bg-secondary, #1A1A1A)" : "#F4F6FA";
  const color  = dark ? "var(--text-secondary, #B5B0A8)" : "#4A5A70";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={loading ? "새로고침 중…" : title}
      aria-label={title}
      style={{
        width: 32, height: 32,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        color,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
        fontFamily: "inherit",
        transition: "background 0.15s ease, opacity 0.15s ease",
      }}>
      <RefreshCw
        size={size}
        style={{
          animation: loading ? "ollit-spin 0.9s linear infinite" : "none",
        }}
      />
      {/* 인라인 keyframes (별도 css 파일 회피 — 재사용 컴포넌트 self-contained). */}
      <style>{`
        @keyframes ollit-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}

export default RefreshButton;

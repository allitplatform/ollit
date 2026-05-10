// Phase 1-B 2-E ─ 실시간 새로고침 hook
// push event 받기 + 폴링 백업
// 2026-05-10 — enabled 옵션 추가 (입력 화면 진입 시 폴링 끊기 / 입력 초기화 방지)
import { useEffect, useRef } from 'react';

export function useRealtime(onUpdate, intervalMs = 60000, options = {}) {
  const { enabled = true } = options || {};
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  useEffect(() => {
    if (!onUpdate || !enabled) return;

    // 1. service worker 메시지 받기 (push event 시 즉시)
    const handleMessage = (event) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        console.log('[realtime] push 받음 → 새로고침');
        if (onUpdateRef.current) onUpdateRef.current();
      }
    };

    let swRegistered = false;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
      swRegistered = true;
    }

    // 2. 폴링 백업 (기본 60초)
    const interval = setInterval(() => {
      console.log('[realtime] 폴링');
      if (onUpdateRef.current) onUpdateRef.current();
    }, intervalMs);

    return () => {
      if (swRegistered) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
      clearInterval(interval);
    };
  }, [intervalMs, enabled]);
}
// Phase 1-B 2-E ─ 실시간 새로고침 hook
// push event 받기 + 폴링 백업
import { useEffect, useRef } from 'react';

export function useRealtime(onUpdate, intervalMs = 30000) {
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  useEffect(() => {
    if (!onUpdate) return;
    
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
    
    // 2. 폴링 백업 (기본 30초)
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
  }, [intervalMs]);
}
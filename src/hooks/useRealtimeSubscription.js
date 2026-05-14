// Phase 4 후속 — Supabase Realtime 구독 hook
//
// 옛: useRealtime(fetchTasks, 60000) — 60초 폴링
// 신규: useRealtimeTasks(onChange) — WebSocket 실시간 catch (1초 안)
//
// 장점:
//   · 깜박임 박지 X (백그라운드 변경 감지)
//   · 즉시 반영 (1초 안)
//   · 서버 부하 감소 (60초마다 호출 X)
//
// DB 의존:
//   · tasks 테이블 측 Realtime 활성화 박혀있어야 (대표님 SQL 실행 완료)
//
// 사용:
//   useRealtimeTasks((payload) => fetchTasks({ background: true }));
//   또는 payload 분기 (eventType: 'INSERT' / 'UPDATE' / 'DELETE')

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

// tasks 테이블 변경 구독
// onChange(payload) — payload = { eventType, new, old, schema, table, commit_timestamp }
export function useRealtimeTasks(onChange) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          const id = payload.new?.id || payload.old?.id;
          console.log('[Realtime] tasks', payload.eventType, id);
          // 진단용 — UPDATE 측 push_candidates 측 변경 catch
          if (payload.eventType === 'UPDATE') {
            console.log('[DIAG realtime UPDATE]', {
              taskId: payload.new?.id,
              pushCount: payload.new?.push_candidates?.length,
              time: Date.now(),
            });
          }
          if (onChangeRef.current) onChangeRef.current(payload);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}

// 일반 테이블 측 구독 (재사용 박을 차례)
// 사용: useRealtimeTable('photos', (payload) => { ... });
export function useRealtimeTable(tableName, onChange) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!tableName) return;
    const channel = supabase
      .channel(`${tableName}-changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => {
          const id = payload.new?.id || payload.old?.id;
          console.log(`[Realtime] ${tableName}`, payload.eventType, id);
          if (onChangeRef.current) onChangeRef.current(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName]);
}

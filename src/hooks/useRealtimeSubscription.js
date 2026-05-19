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

import { useEffect, useRef, useId } from 'react';
import { supabase } from '../lib/supabase.js';

// tasks 테이블 변경 구독
// onChange(payload) — payload = { eventType, new, old, schema, table, commit_timestamp }
// 2026-05-19 Phase 5 Step 0.C-9-fix — useId 측 channel 이름 unique 부여
//   옛: 'tasks-changes' 고정 → 같은 channel 측 다중 subscribe 충돌
//   에러: "cannot add postgres_changes callbacks ... after subscribe()" + status CLOSED
//   정정: useId() 측 컴포넌트 instance별 unique suffix.
export function useRealtimeTasks(onChange) {
  const onChangeRef = useRef(onChange);
  const channelId = useId();
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    const channel = supabase
      .channel(`tasks-changes-${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          const id = payload.new?.id || payload.old?.id;
          console.log('[Realtime] tasks', payload.eventType, id);
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
        console.log(`[Realtime] tasks-changes-${channelId} status:`, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);
}

// 일반 테이블 측 구독 (재사용)
// 사용: useRealtimeTable('photos', (payload) => { ... });
// 사용 + filter: useRealtimeTable('task_items', cb, `task_id=eq.${taskId}`);
//   Supabase Realtime postgres_changes filter spec — eq / neq / gt / lt / in 측 지원.
// 2026-05-19 Phase 5 Step 0.C-9-fix — useId 측 channel 이름 unique 부여 (다중 subscribe 충돌 차단)
export function useRealtimeTable(tableName, onChange, filter = null) {
  const onChangeRef = useRef(onChange);
  const channelId = useId();
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!tableName) return;
    const channelName = `${tableName}-${channelId}${filter ? `-${filter}` : ''}`;
    const config = { event: '*', schema: 'public', table: tableName };
    if (filter) config.filter = filter;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        config,
        (payload) => {
          const id = payload.new?.id || payload.old?.id;
          console.log(`[Realtime] ${tableName}`, payload.eventType, id, filter || '');
          if (onChangeRef.current) onChangeRef.current(payload);
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] ${channelName} status:`, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, filter, channelId]);
}

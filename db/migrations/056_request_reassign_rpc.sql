-- ============================================
-- Migration 056 — request_reassign RPC (기사 재배정 요청 + 운영자 push)
-- 작성일  : 2026-05-22
-- 범위    : 신규 RPC request_reassign(p_task_id, p_reason)
--           · category_data.reassignRequest jsonb 머지 (reason, requestedAt)
--           · 운영자(role='admin')에게 push 알림 발사
--
-- 사장님 spec:
--   · 기사가 작업에서 [재배정 요청] 버튼 → 사유 입력 → 운영자에게 전송
--   · 거절 단계 없음 — 요청 오면 운영자가 다른 기사로 무조건 교체
--   · status 변경 없음 (배정/확정/진행중 그대로 유지)
--   · 시점 제한 없음 (배정/확정/진행중 측만 클라이언트 측 노출)
--
-- 동작 흐름:
--   1) 클라이언트 측 supabase.rpc('request_reassign', {p_task_id, p_reason}) 호출
--   2) RPC 측 tasks.category_data 측 reassignRequest 키 머지
--      · { reason: <p_reason>, requestedAt: <ISO 8601 UTC> }
--      · 다른 jsonb 키 (consent / cancelReason / visitOnly 등) 보존
--   3) 운영자 push 발사 (mark_visit_only 패턴 동일)
--      · title: '🔁 재배정 요청'
--      · body:  '<기사명> · <고객> · <사유>'
--      · target: role='admin'
--      · taskId 포함 (SW dedup 정상화)
--
-- 운영자 측 처리:
--   · AdminTaskDetailScreen 측 ReassignRequestCard 측 표시
--   · [변경] 버튼 측 다른 기사 선택 → assignEngineerAdapter 측 후처리 측 reassignRequest 키 삭제 (Phase 2)
--   · Migration 050/051 시나리오 8 측 새 기사 / 옛 기사 / 운영자 push 자동 발사
--
-- 의존:
--   · pg_net extension (Migration 014 이전 설치 완료)
--   · Vault PUSH_API_KEY
--   · Migration 050 측 시나리오 8 (재배정 push trigger)
--
-- 회귀 방지:
--   · status 변경 X — 다른 trigger 측 영향 0
--   · category_data 측 다른 키 보존 (jsonb || 측 머지)
--   · push 실패 시 silent skip (UPDATE 자체는 통과)
--
-- 실행:
--   · Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
--   · CREATE OR REPLACE 측 재실행 안전 (idempotent)
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION request_reassign(
  p_task_id uuid,
  p_reason  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task      tasks%ROWTYPE;
  v_eng_name  text;
  api_key     text;
  push_url    text := 'https://ollit.vercel.app/api/push/send';
  task_body   text;
BEGIN
  -- 1) task 존재 확인
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;

  -- 2) engineer name lookup
  IF v_task.assigned_engineer_id IS NOT NULL THEN
    SELECT name INTO v_eng_name FROM users WHERE id = v_task.assigned_engineer_id;
  END IF;

  -- 3) category_data.reassignRequest 머지 (다른 키 보존)
  UPDATE tasks SET
    category_data = COALESCE(category_data, '{}'::jsonb)
                    || jsonb_build_object(
                         'reassignRequest', jsonb_build_object(
                           'reason',      COALESCE(p_reason, ''),
                           'requestedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                         )
                       ),
    updated_at = NOW()
  WHERE id = p_task_id;

  -- 4) 운영자 push 발사
  SELECT decrypted_secret INTO api_key
    FROM vault.decrypted_secrets
    WHERE name = 'PUSH_API_KEY'
    LIMIT 1;

  IF api_key IS NULL OR api_key = '' THEN
    RAISE NOTICE '[request_reassign] PUSH_API_KEY 없음 — push skip';
    RETURN jsonb_build_object('ok', true, 'task_id', p_task_id, 'note', 'push skipped');
  END IF;

  task_body := COALESCE(v_eng_name, '기사')
            || ' · ' || COALESCE(v_task.customer_name, '고객')
            || ' · ' || COALESCE(p_reason, '사유 없음');

  PERFORM net.http_post(
    url     := push_url,
    headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
    body    := jsonb_build_object(
      'targetType', 'role',
      'targetId',   'admin',
      'title',      '🔁 재배정 요청',
      'body',       task_body,
      'url',        '/',
      'tag',        'reassign-request-' || p_task_id::text,
      'taskId',     p_task_id::text
    )
  );

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id);
END;
$$;

COMMENT ON FUNCTION request_reassign(uuid, text) IS
  '기사 재배정 요청 — category_data.reassignRequest 머지 + 운영자 push 발사 (Migration 056)';

COMMIT;

-- ============================================
-- 검증 SQL
-- ============================================
-- 1) RPC 등록 확인:
-- SELECT obj_description(p.oid, 'pg_proc') AS note
-- FROM pg_proc p WHERE p.proname = 'request_reassign';
-- → 기대: '기사 재배정 요청 — category_data.reassignRequest 머지 + 운영자 push 발사 (Migration 056)'
--
-- 2) 1건 호출 검증:
-- SELECT request_reassign('<task uuid>'::uuid, '고객 일정 변경 요청');
-- → 기대: {"ok": true, "task_id": "..."}
--
-- 3) jsonb 머지 확인:
-- SELECT category_data->>'reassignRequest' FROM tasks WHERE id = '<task uuid>';
-- → 기대: '{"reason": "고객 일정 변경 요청", "requestedAt": "2026-05-22T..."}'
--
-- 4) push 발사 확인:
-- SELECT id, status_code, content::jsonb->>'sent' AS sent, created
-- FROM net._http_response
-- WHERE created > NOW() - INTERVAL '5 minutes'
-- ORDER BY created DESC LIMIT 10;

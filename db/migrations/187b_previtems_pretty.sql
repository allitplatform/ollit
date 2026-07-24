-- ============================================
-- Migration 187b — prevItems 표기 정리 (2026-07-21)
--   187 백필 결과 "냉매_스탠드 스탠드" 처럼 작업명 안에 기종이 이미 있어 중복 표기.
--   → 언더스코어 제거 + 기종명이 작업명에 없을 때만 덧붙임.
--   ① 함수 v4.1 (표기만 수정) ② 기존 prevItems 전체 재작성 (덮어씀).
-- 실행: Supabase SQL Editor → 통째 → Run
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION mark_visit_only(
  p_task_id  uuid,
  p_reason   text,
  p_memo     text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task             tasks%ROWTYPE;
  v_visit_wt_id      uuid;
  v_task_snapshot    jsonb;
  v_items_snapshot   jsonb;
  v_payments_snapshot jsonb;
  v_snapshot         jsonb;
  v_new_rule         boolean;
  v_fee              int;
  v_eng              int;
  v_own              int;
  -- v4 (Mig 187) — 이전 기종 요약 (화면 표시용)
  v_prev_summary     text;
BEGIN
  -- ─── [0] task 존재 확인 ───
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;

  -- v2 (Mig 178) — 처리 시각 기준.
  v_new_rule := now() >= '2026-07-15 00:00:00 Asia/Seoul'::timestamptz;
  v_fee := CASE WHEN v_new_rule THEN 40000 ELSE 30000 END;
  v_eng := CASE WHEN v_new_rule THEN 24000 ELSE v_fee END;
  v_own := v_fee - v_eng;

  -- v3 (Mig 180) — 냉매 100%(직영) 기사는 출장비도 100%.
  IF v_new_rule AND v_task.assigned_engineer_id IS NOT NULL THEN
    DECLARE v_rate int;
    BEGIN
      SELECT COALESCE(refrigerant_rate, 50) INTO v_rate
      FROM users WHERE id = v_task.assigned_engineer_id;
      IF v_rate >= 100 THEN
        v_eng := v_fee;
        v_own := 0;
      END IF;
    END;
  END IF;

  -- ─── [0.4] v4 — 이전 기종 요약 (삭제 직전, 사람이 읽는 문자열) ───
  --   예: "세척 벽걸이 ×2, 세척 스탠드 ×1" / 냉매점검 등 appliance 없으면 work_type 이름만.
  SELECT COALESCE(string_agg(
    trim(concat(
      replace(COALESCE(wt.name, ''), '_', ' '),
      CASE WHEN apt.name IS NOT NULL AND position(apt.name IN COALESCE(wt.name, '')) = 0
           THEN ' ' || apt.name ELSE '' END,
      CASE WHEN ti.qty > 1 THEN ' ×' || ti.qty ELSE '' END)),
    ', ' ORDER BY ti.id), '')
  INTO v_prev_summary
  FROM task_items ti
  LEFT JOIN work_types      wt  ON wt.id  = ti.work_type_id
  LEFT JOIN appliance_types apt ON apt.id = ti.appliance_type_id
  WHERE ti.task_id = p_task_id;

  -- ─── [0.5] 스냅샷 수집 (Mig 137 그대로) ───
  v_task_snapshot := jsonb_build_object(
    'status',         v_task.status,
    'product_price',  v_task.product_price,
    'extra_fee',      v_task.extra_fee,
    'travel_fee',     v_task.travel_fee,
    'received_total', v_task.received_total,
    'total_amount',   v_task.total_amount,
    'payment_method', v_task.payment_method
  );

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'work_type_id',      ti.work_type_id,
      'appliance_type_id', ti.appliance_type_id,
      'qty',               ti.qty,
      'unit_price',        ti.unit_price,
      'order_type',        ti.order_type,
      'subtotal',          ti.subtotal,
      'received_amount',   ti.received_amount,
      'is_canceled',       COALESCE(ti.is_canceled, false),
      'product_order_id',  ti.product_order_id
    )
    ORDER BY ti.id
  ), '[]'::jsonb)
  INTO v_items_snapshot
  FROM task_items ti
  WHERE ti.task_id = p_task_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'policy_key',       p.policy_key,
      'calc_method',      p.calc_method,
      'product_price',    p.product_price,
      'extra_fee',        p.extra_fee,
      'travel_fee',       p.travel_fee,
      'naver_fee',        p.naver_fee,
      'engineer_amount',  p.engineer_amount,
      'principal_amount', p.principal_amount,
      'owner_amount',     p.owner_amount,
      'track',            p.track,
      'status',           p.status
    )
  ), '[]'::jsonb)
  INTO v_payments_snapshot
  FROM payments p
  WHERE p.task_id = p_task_id;

  v_snapshot := jsonb_build_object(
    'task',       v_task_snapshot,
    'task_items', v_items_snapshot,
    'payments',   v_payments_snapshot
  );

  -- ─── [0.6] task_changes audit ───
  INSERT INTO task_changes (
    task_id, tenant_id, change_type,
    before_data, after_data, note, changed_by
  ) VALUES (
    p_task_id, v_task.tenant_id, 'visit_only',
    v_snapshot,
    jsonb_build_object(
      'type',     'mark',
      'reason',   COALESCE(p_reason, ''),
      'memo',     COALESCE(p_memo, ''),
      'markedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ),
    p_reason,
    auth.uid()
  );

  -- ─── [1] visit work_type ───
  SELECT id INTO v_visit_wt_id FROM work_types WHERE code = 'visit' LIMIT 1;
  IF v_visit_wt_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'visit work_type 시드 누락');
  END IF;

  -- ─── [2] 기존 task_items 제거 ───
  DELETE FROM task_items WHERE task_id = p_task_id;

  -- ─── [3] visit_fee row 신규 ───
  INSERT INTO task_items (task_id, work_type_id, appliance_type_id, qty, unit_price)
  VALUES (p_task_id, v_visit_wt_id, NULL, 1, v_fee);

  -- ─── [4] tasks UPDATE — v4: prevItems 추가 ───
  UPDATE tasks SET
    status         = 'visit_only',
    product_price  = 0,
    extra_fee      = 0,
    travel_fee     = v_fee,
    received_total = NULL,
    completed_at   = NOW(),
    category_data  = COALESCE(category_data, '{}'::jsonb)
                     || jsonb_build_object('visitOnly',
                          jsonb_build_object(
                            'reason',    COALESCE(p_reason, ''),
                            'memo',      COALESCE(p_memo, ''),
                            'prevItems', COALESCE(v_prev_summary, ''),
                            'markedAt',  to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                          )),
    updated_at     = NOW()
  WHERE id = p_task_id;

  -- ─── [5] payments DELETE + visit 1행 ───
  DELETE FROM payments WHERE task_id = p_task_id;

  INSERT INTO payments (
    task_id, computed_by,
    policy_key, calc_method,
    product_price, extra_fee, travel_fee, naver_fee,
    engineer_amount, principal_amount, owner_amount,
    status, track
  ) VALUES (
    p_task_id, auth.uid(),
    'common_visit_fee', '출장비_30K',
    0, 0, v_fee, 0,
    v_eng, 0, v_own,
    '미정산', 'A'
  );

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id);
END;
$$;

-- ─── 재백필 (이번엔 기존 값 덮어씀 — 표기 정리) ───
WITH latest_mark AS (
  SELECT DISTINCT ON (tc.task_id)
    tc.task_id, tc.before_data
  FROM task_changes tc
  WHERE tc.change_type = 'visit_only'
    AND tc.after_data->>'type' = 'mark'
  ORDER BY tc.task_id, tc.changed_at DESC
),
summaries AS (
  SELECT
    lm.task_id,
    COALESCE(string_agg(
      trim(concat(
        replace(COALESCE(wt.name, ''), '_', ' '),
        CASE WHEN apt.name IS NOT NULL AND position(apt.name IN COALESCE(wt.name, '')) = 0
             THEN ' ' || apt.name ELSE '' END,
        CASE WHEN (it->>'qty')::int > 1 THEN ' ×' || (it->>'qty') ELSE '' END)),
      ', '), '') AS summary
  FROM latest_mark lm
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(lm.before_data->'task_items', '[]'::jsonb)) AS it
  LEFT JOIN work_types      wt  ON wt.id  = NULLIF(it->>'work_type_id', '')::uuid
  LEFT JOIN appliance_types apt ON apt.id = NULLIF(it->>'appliance_type_id', '')::uuid
  GROUP BY lm.task_id
)
UPDATE tasks t SET
  category_data = jsonb_set(
    COALESCE(t.category_data, '{}'::jsonb),
    '{visitOnly,prevItems}',
    to_jsonb(s.summary),
    true
  ),
  updated_at = now()
FROM summaries s
WHERE t.id = s.task_id
  AND t.status = 'visit_only'
  AND s.summary <> '';

COMMIT;

SELECT id, customer_name, category_data->'visitOnly'->>'prevItems' AS prev_items
FROM tasks WHERE status = 'visit_only' ORDER BY completed_at DESC LIMIT 20;

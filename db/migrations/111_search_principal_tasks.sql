-- ============================================================================
-- Migration 111 — search_principal_tasks RPC (4개 OR ILIKE 검색)
-- 2026-06-11
--
-- 배경:
--   원청 PWA PC 내 작업 검색 — 사장님 spec 4개 컬럼 OR ILIKE:
--     · tasks.customer_name           (고객)
--     · tasks.address                 (주소)
--     · users.name                    (기사) — assigned_engineer_id 측 lookup
--     · task_items.product_order_id   (상품주문번호) — task_id 측 1:N
--   PostgREST .or 측 left JOIN nested 측 불가 → RPC 측 DB SQL 측 처리.
--   응답 = task_id 배열 + total_count. 클라 측 rowToTask 매핑 재사용 (중복 회피).
--
-- 사장님 spec:
--   · activeOnly = true  → status IN ('배정', '확정', '진행중') 만.
--   · activeOnly = false → 모든 status.
--   · search 측 공백/NULL 측 매칭 X (전체 통과).
--   · ORDER BY status_order ASC, scheduled_at DESC NULLS LAST (Migration 110 컬럼 재사용).
--   · LIMIT / OFFSET 페이징. count(*) OVER () 측 전체 건수 동시 반환.
--
-- 회귀:
--   · CREATE OR REPLACE FUNCTION — 재실행 idempotent.
--   · SECURITY DEFINER + STABLE — RLS 우회 측 안전 (anon 측 호출).
--   · GRANT EXECUTE TO anon — PWA 측 직접 호출.
--
-- 실행:
--   · Supabase SQL Editor → 통째 붙여넣기 → Run.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION search_principal_tasks(
  p_principal_ids uuid[],
  p_active_only   boolean DEFAULT true,
  p_search        text    DEFAULT '',
  p_limit         int     DEFAULT 100,
  p_offset        int     DEFAULT 0
)
RETURNS TABLE (
  task_id     uuid,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH filtered AS (
  SELECT DISTINCT
    t.id,
    t.status_order,
    t.scheduled_at
  FROM tasks t
  LEFT JOIN users u       ON u.id  = t.assigned_engineer_id
  LEFT JOIN task_items ti ON ti.task_id = t.id
  WHERE t.tenant_id = '11111111-1111-1111-1111-111111111111'
    AND t.principal_id = ANY(p_principal_ids)
    AND (
      NOT p_active_only
      OR t.status IN ('배정', '확정', '진행중')
    )
    AND (
      p_search IS NULL OR p_search = ''
      OR t.customer_name      ILIKE '%' || p_search || '%'
      OR t.address            ILIKE '%' || p_search || '%'
      OR u.name               ILIKE '%' || p_search || '%'
      OR ti.product_order_id  ILIKE '%' || p_search || '%'
    )
), counted AS (
  SELECT
    id,
    status_order,
    scheduled_at,
    count(*) OVER () AS total_count
  FROM filtered
)
SELECT
  id          AS task_id,
  total_count
FROM counted
ORDER BY status_order ASC, scheduled_at DESC NULLS LAST
LIMIT p_limit
OFFSET p_offset;
$$;

COMMENT ON FUNCTION search_principal_tasks(uuid[], boolean, text, int, int) IS
  '원청 PWA 내 작업 검색 RPC (Migration 111) — 4개 OR ILIKE: customer_name / address / users.name / task_items.product_order_id. task_id + total_count 반환. 클라 측 .in("id", ids) 측 매핑 재사용.';

GRANT EXECUTE ON FUNCTION
  search_principal_tasks(uuid[], boolean, text, int, int)
  TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 SQL
-- ============================================================================
--
-- 1) RPC 등록 확인:
-- SELECT proname, obj_description(p.oid, 'pg_proc') AS note
-- FROM pg_proc p WHERE p.proname = 'search_principal_tasks';
--
-- 2) usol_n 측 1건 검색 (예: 고객 이름 일부):
-- SELECT * FROM search_principal_tasks(
--   ARRAY[(SELECT id FROM principals WHERE code='usol_n')]::uuid[],
--   true,             -- active_only
--   '김',             -- search
--   10, 0
-- );
--
-- 3) 상품주문번호 검색:
-- SELECT * FROM search_principal_tasks(
--   ARRAY[(SELECT id FROM principals WHERE code='usol_n')]::uuid[],
--   false,
--   '2023',           -- 주문번호 패턴
--   10, 0
-- );
--
-- 4) 기사 이름 검색:
-- SELECT * FROM search_principal_tasks(
--   ARRAY[(SELECT id FROM principals WHERE code='usol_n')]::uuid[],
--   false,
--   '안',             -- 기사 이름 일부
--   10, 0
-- );

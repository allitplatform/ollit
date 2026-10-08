-- Migration 262 — 접수에 광고 유입정보(검색어·광고그룹·순위) 저장 (2026-10-08)
--
-- 목적: 키워드별 접수 효율을 알 수 없던 문제 해결.
--   네이버 파워링크는 자동 추적(프리미엄 로그 분석)을 켜면 랜딩 URL 에
--   n_keyword / n_ad_group / n_rank / n_query 등을 붙여 보낸다.
--   지금은 랜딩이 그 값을 읽지 않고 버려, 접수 1건이 어느 검색어에서 왔는지 알 수 없었다.
--   이 마이그레이션 이후 접수 행에 그 정보가 남아 키워드별 접수당 광고비를 계산할 수 있다.
--
-- 왜 source 가 아니라 새 컬럼인가:
--   mig 198 의 source 는 left(p_source, 40) 으로 40자까지만 저장된다.
--   랜딩이 이미 폼 위치·종목·희망일을 담아 거의 다 채우고 있어 검색어를 넣을 자리가 없다.
--
-- 실행: Supabase SQL 편집기에 전체 붙여넣기 → Run. (사장님/코코 수동 배포)
-- 배포 순서 무관: 랜딩이 먼저 배포돼도 7번째 인자가 없는 함수가 거부하면
--   랜딩이 6인자로 한 번 더 보내도록 되어 있다.

BEGIN;

-- [1] 컬럼
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS ad_params jsonb;

COMMENT ON COLUMN public.inquiries.ad_params IS
  '광고 유입정보. 네이버 자동추적/UTM 파라미터를 그대로 저장. 예: {"kw":"에어컨이전설치","grp":"...","rank":"2","q":"에어컨 이전설치","media":"naver"}';

-- 키워드별 집계를 쓰는 조회가 많아질 것이므로 인덱스 하나
CREATE INDEX IF NOT EXISTS inquiries_ad_kw_idx
  ON public.inquiries ((ad_params->>'kw'))
  WHERE ad_params IS NOT NULL;

-- [2] create_inquiry_v2 를 7인자로 교체
--     6인자와 7인자(DEFAULT 있음)를 동시에 두면 6개로 호출할 때 어느 쪽인지 모호해져
--     PostgreSQL 이 오류를 낸다. 그래서 기존 6인자를 지우고 7인자만 남긴다.
--     이름 있는 인자로 호출하므로 기존 랜딩(6개 전달)도 그대로 작동한다 — p_ad_params 는 NULL.
DROP FUNCTION IF EXISTS public.create_inquiry_v2(text,text,text,text,boolean,text);

CREATE OR REPLACE FUNCTION public.create_inquiry_v2(
  p_service_type   text,
  p_name           text,
  p_phone          text,
  p_address        text,
  p_agreed_privacy boolean,
  p_source         text  DEFAULT NULL,
  p_ad_params      jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- 검증·삽입은 기존 함수 그대로 (오류코드 invalid_name 등 동일하게 전파됨)
  PERFORM public.create_inquiry(p_service_type, p_name, p_phone, p_address, p_agreed_privacy);

  IF p_source IS NULL AND p_ad_params IS NULL THEN
    RETURN;
  END IF;

  -- 방금 삽입된 행(같은 전화번호의 최신 행)
  SELECT id INTO v_id
    FROM public.inquiries
   WHERE phone = p_phone
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.inquiries
     SET source    = COALESCE(left(p_source, 40), source),
         ad_params = COALESCE(p_ad_params, ad_params)
   WHERE id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_inquiry_v2(text,text,text,text,boolean,text,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.create_inquiry_v2(text,text,text,text,boolean,text,jsonb) TO anon, authenticated;

COMMIT;

-- PostgREST 가 함수 시그니처를 캐시하므로 스키마를 다시 읽게 한다
NOTIFY pgrst, 'reload schema';

-- VERIFY (실행 후 확인)
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'inquiries' AND column_name = 'ad_params';

SELECT p.pronargs AS 인자수, pg_get_function_identity_arguments(p.oid) AS 인자
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'create_inquiry_v2';

-- 광고 유입 접수가 쌓이면 이 조회로 키워드별 접수 건수를 본다
-- SELECT ad_params->>'kw' AS 검색어, count(*) AS 접수
--   FROM public.inquiries
--  WHERE ad_params->>'kw' IS NOT NULL
--    AND created_at >= now() - interval '30 days'
--    AND status <> 'spam'
--  GROUP BY 1 ORDER BY 2 DESC;

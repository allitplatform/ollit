-- Migration 211 — inquiries.service_type 허용값 확장: hood / grave / move_in (2026-10-02)
-- 목적: 랜딩 접수(주방후드 hood.html · 벌초 care.html · 입주청소 ipju.html)가 전부 'unknown' 으로
--       저장돼 종목별 집계가 안 되던 것을 종목 코드로 저장.
--         hood    = 주방후드 (후드 설치는 기존 'install' 사용)
--         grave   = 벌초·산소
--         move_in = 입주청소
-- 실행: Supabase SQL 편집기에 전체 붙여넣기 → Run. (사장님/코코 수동 배포)
--
-- 배포 순서는 상관없음: 랜딩 페이지는 새 코드가 거부되면 'unknown' 으로 한 번 더 보내도록 되어 있어
--   이 파일을 실행하기 전에도 접수는 예전처럼 들어온다. 실행한 뒤부터 새 코드로 저장된다.
--
-- [1] create_inquiry 허용 목록(화이트리스트)에 3개 추가
--     함수 원본(117_inquiries.sql)이 레포 밖이라 본문을 복제하지 않고,
--     운영 DB 의 현재 함수 정의에서 허용 목록 줄만 바꿔 다시 만든다.
--     허용 목록 줄을 찾지 못하면 오류를 내고 전체가 취소된다 (아무것도 바뀌지 않음).
-- [2] inquiries_service_type_check 제약도 같은 10개로 교체
-- 기존 데이터는 건드리지 않는다 (소급 분류는 맨 아래 참고 조회만).

BEGIN;

-- [1]
DO $mig$
DECLARE
  v_cnt int;
  v_def text;
  v_new text;
BEGIN
  SELECT count(*) INTO v_cnt
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'create_inquiry' AND p.pronargs = 5;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'public.create_inquiry(인자 5개) 가 %개 — 직접 확인 필요', v_cnt;
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'create_inquiry' AND p.pronargs = 5;

  IF v_def LIKE '%''move_in''%' THEN
    RAISE NOTICE 'create_inquiry: 이미 적용됨 — 건너뜀';
  ELSE
    v_new := regexp_replace(
      v_def,
      '''water_leak''(\s*)\)',
      '''water_leak'',''hood'',''grave'',''move_in''\1)',
      'g'
    );
    IF v_new = v_def THEN
      RAISE EXCEPTION 'create_inquiry 에서 허용 목록 줄(… ''water_leak'')) 을 찾지 못함 — 함수 본문을 직접 확인';
    END IF;
    EXECUTE v_new;
    RAISE NOTICE 'create_inquiry: 허용 목록에 hood / grave / move_in 추가';
  END IF;
END
$mig$;

-- [2]
ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_service_type_check;
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_service_type_check
  CHECK (service_type = ANY (ARRAY[
    'refrigerant'::text, 'cleaning'::text, 'repair'::text,
    'install'::text, 'unknown'::text,
    'leak'::text, 'water_leak'::text,
    'hood'::text, 'grave'::text, 'move_in'::text
  ]));

COMMIT;

-- VERIFY (실행 후 확인)
SELECT pg_get_constraintdef(oid) AS 제약
FROM pg_constraint
WHERE conrelid = 'public.inquiries'::regclass AND conname = 'inquiries_service_type_check';

SELECT (pg_get_functiondef(p.oid) LIKE '%''move_in''%') AS 함수_허용목록_적용됨
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'create_inquiry' AND p.pronargs = 5;

-- 참고 — 기존 unknown 접수를 source 접두사로 소급 분류할 수 있는지 (조회만, 변경 없음)
--   source 가 남아 있는 행만 분류된다. create_inquiry_v2 가 없던 시기(404 폴백)에 들어온 행은 source 가 NULL 이라 불가.
-- SELECT CASE
--          WHEN source LIKE 'hood_landing%' AND split_part(source, '/', 2) = 'install' THEN 'install'
--          WHEN source LIKE 'hood_landing%'  THEN 'hood'
--          WHEN source LIKE 'grave_landing%' THEN 'grave'
--          WHEN source LIKE 'ipju_landing%'  THEN 'move_in'
--          ELSE '(분류 불가)'
--        END AS 소급_종목,
--        count(*) AS 건수
--   FROM public.inquiries
--  WHERE service_type = 'unknown'
--  GROUP BY 1 ORDER BY 2 DESC;

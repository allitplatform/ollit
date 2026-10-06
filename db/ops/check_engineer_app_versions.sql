-- ============================================================================
-- 기사별 앱 버전 확인 - 211b 실행 조건 ("기사 전원 새 버전") 판단용
-- 작성 2026-10-06 · 선행: 211a 실행 + 코드 배포
--
-- 읽는 법
--   새 버전 앱은 열릴 때마다 버전을 남깁니다 (user_app_versions).
--   옛 버전 앱은 기록을 남기지 못하므로 "기록 없음" = 아직 새 버전으로 연 적이 없음.
--   기준 버전: '20261006-guard' (src/lib/appVersion.js 의 APP_VERSION)
--
-- 211b 실행 조건
--   [1] 요약에서 "확인 필요" 가 0 이거나, 남은 사람이 전부 현재 일하지 않는 기사일 때.
--   [2] 목록에서 "확인 필요" 인 기사에게 앱을 한 번 닫았다 열어 달라고 요청 -> 다시 조회.
--
-- 한계
--   · 한 사람이 폰 2대를 쓰면 한 대만 새 버전이어도 "새 버전" 으로 보입니다.
--   · 기록은 "그 기기가 새 버전으로 한 번 열렸다" 는 뜻입니다. 그 뒤로는 계속 새 버전입니다.
-- ============================================================================

-- [1] 요약
WITH eng AS (
  SELECT u.id, u.code, u.name, u.last_login_at
    FROM users u
   WHERE u.is_active = true
     AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'engineer')
), recent AS (
  -- 최근 30일 안에 배정받은 적이 있는 기사 = 현재 일하는 기사
  SELECT DISTINCT t.assigned_engineer_id AS id
    FROM tasks t
   WHERE t.assigned_engineer_id IS NOT NULL
     AND COALESCE(t.assigned_at, t.updated_at) >= now() - interval '30 days'
)
SELECT
  COUNT(*)                                                                         AS 활성_기사,
  COUNT(*) FILTER (WHERE v.app_version >= '20261006-guard')                        AS 새_버전,
  COUNT(*) FILTER (WHERE (v.app_version IS NULL OR v.app_version < '20261006-guard')
                     AND r.id IS NOT NULL)                                         AS 확인_필요,
  COUNT(*) FILTER (WHERE (v.app_version IS NULL OR v.app_version < '20261006-guard')
                     AND r.id IS NULL)                                             AS 기록없음_최근작업없음
FROM eng e
LEFT JOIN user_app_versions v ON v.user_id = e.id
LEFT JOIN recent r            ON r.id = e.id;

-- [2] 기사별 목록 (확인 필요가 위로)
WITH recent AS (
  SELECT t.assigned_engineer_id AS id, COUNT(*) AS n
    FROM tasks t
   WHERE t.assigned_engineer_id IS NOT NULL
     AND COALESCE(t.assigned_at, t.updated_at) >= now() - interval '30 days'
   GROUP BY 1
)
SELECT
  u.code                                                   AS 기사코드,
  u.name                                                   AS 이름,
  CASE
    WHEN v.app_version >= '20261006-guard' THEN '새 버전'
    WHEN COALESCE(r.n, 0) > 0              THEN '확인 필요'
    ELSE '기록 없음 (최근 30일 작업 없음)'
  END                                                      AS 상태,
  v.app_version                                            AS 기록된_버전,
  to_char(v.last_seen_at AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI') AS 마지막_접속,
  COALESCE(r.n, 0)                                         AS 최근30일_배정건수,
  EXISTS (SELECT 1 FROM user_sessions s
           WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now())
                                                           AS 재로그인_함
FROM users u
LEFT JOIN user_app_versions v ON v.user_id = u.id
LEFT JOIN recent r            ON r.id = u.id
WHERE u.is_active = true
  AND EXISTS (SELECT 1 FROM user_roles ro WHERE ro.user_id = u.id AND ro.role = 'engineer')
ORDER BY
  CASE WHEN v.app_version >= '20261006-guard' THEN 2
       WHEN COALESCE(r.n, 0) > 0              THEN 0
       ELSE 1 END,
  u.code;

-- [3] 참고 - 운영자·해피콜·원청 계정의 버전과 재로그인 여부 (세션 필수 전환 판단용)
SELECT
  u.code, u.name,
  (SELECT string_agg(DISTINCT ro.role, ',') FROM user_roles ro WHERE ro.user_id = u.id) AS 역할,
  v.app_version                                                                          AS 기록된_버전,
  to_char(v.last_seen_at AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI')                     AS 마지막_접속,
  EXISTS (SELECT 1 FROM user_sessions s
           WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now())     AS 재로그인_함
FROM users u
LEFT JOIN user_app_versions v ON v.user_id = u.id
WHERE u.is_active = true
  AND EXISTS (SELECT 1 FROM user_roles ro WHERE ro.user_id = u.id AND ro.role <> 'engineer')
ORDER BY u.code;

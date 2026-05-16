-- 020_payments_anon_select.sql
-- 2026-05-16 — payments anon select 정책 추가 (tasks와 동일 패턴)
-- 배경: PWA에서 auth.uid() = NULL이라 기존 owner/operator/engineer 정책 적용 안 됨
-- tasks는 t_anon_select가 있어서 읽혔지만 payments는 없어서 못 읽음
-- 결과: 화면에서 정산 정보 0원으로 표시되던 문제 해결

CREATE POLICY payments_anon_select ON payments
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid
    )
  );

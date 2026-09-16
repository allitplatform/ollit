@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === ollit push ===
git push origin main
if %errorlevel% neq 0 (
  echo.
  echo [FAIL] push 실패 - 위 메시지를 Claude에게 보여주세요
) else (
  echo.
  echo [OK] push 완료 - Vercel 배포 2~3분 후 반영됩니다
)
pause

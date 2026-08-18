@echo off
chcp 65001 >nul
setlocal

cd /d "E:\05 Pojects\Forms"
if errorlevel 1 (
  echo [ERROR] Project folder not found: E:\05 Pojects\Forms
  goto :end
)

echo ============================================================
echo   Pushing the Excel export feature to GitHub
echo   Repo: moali30/measurement   Branch: master
echo ============================================================
echo.

echo [1/4] Current status:
git status --short
echo.

echo [2/4] Staging the 4 changed files...
git add "src/app/actions/dashboard.ts" "src/app/dashboard/forms/page.tsx" "src/lib/excel-export.ts" "src/types/export.ts"
if errorlevel 1 goto :fail
git status --short
echo.

echo [3/4] Committing...
git commit -m "feat: export survey results to Excel directly from the forms list page"
if errorlevel 1 (
  echo [WARN] Commit failed or there was nothing to commit. Continuing to push...
)
echo.

echo [4/4] Pushing to origin/master...
git push origin master
if errorlevel 1 goto :fail

echo.
echo ============================================================
echo   DONE. Vercel will start a new deployment shortly.
echo ============================================================
goto :end

:fail
echo.
echo ============================================================
echo   FAILED. Copy the error above and send it to Claude.
echo ============================================================

:end
echo.
pause
endlocal

@echo off
:: =====================================================
:: 易捷加油 · 一键推送与部署脚本 (Windows)
:: =====================================================
:: 用法：
::   deploy.bat
:: =====================================================

setlocal enabledelayedexpansion

cd /d "%~dp0"

set GITHUB_REMOTE=https://github.com/Fcai168/recharge-h5.git
set BRANCH=main

echo.
echo ============================================
echo   YiJie Recharge System - Deploy Script
echo ============================================
echo.

:: 1. 检查 git
where git >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Git not installed
  exit /b 1
)

:: 2. 状态
echo [INFO] Current status:
git status --short
echo.

:: 3. 拉取远程
git remote | findstr origin >nul 2>nul
if %errorlevel% equ 0 (
  echo [INFO] Pulling from remote...
  git pull --rebase origin %BRANCH% 2>nul
)

:: 4. 添加
echo [INFO] Adding files...
git add -A

:: 5. 检查变更
git diff --cached --quiet
if %errorlevel% equ 0 (
  echo [INFO] No changes to commit
) else (
  :: 6. 提交
  echo [INFO] Committing...
  for /f "tokens=*" %%a in ('powershell -c "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"') do set TIMESTAMP=%%a
  git commit -m "chore: 充值系统更新 %TIMESTAMP%"
  if !errorlevel! equ 0 (
    echo [OK] Committed
  )
)

:: 7. 设置远程
git remote | findstr origin >nul 2>nul
if %errorlevel% neq 1 (
  echo [INFO] Adding remote: %GITHUB_REMOTE%
  git remote add origin %GITHUB_REMOTE%
)

:: 8. 推送
echo.
echo [INFO] Pushing to GitHub: %GITHUB_REMOTE%
git push -u origin %BRANCH%

if %errorlevel% equ 0 (
  echo.
  echo ============================================
  echo   [OK] Push successful!
  echo ============================================
  echo.
  echo GitHub: https://github.com/Fcai168/recharge-h5
  echo.
  echo Next steps:
  echo   1. https://dash.cloudflare.com -^> Workers ^& Pages
  echo   2. Connect GitHub repo Fcai168/recharge-h5
  echo   3. Build output: /
  echo.
) else (
  echo.
  echo [ERROR] Push failed
  echo.
  echo Troubleshooting:
  echo   1. Make sure https://github.com/Fcai168/recharge-h5 exists
  echo   2. Check GitHub credentials (Personal Access Token)
  echo   3. Set credential helper:
  echo      git config --global credential.helper manager
  echo.
)

endlocal

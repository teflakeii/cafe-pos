@echo off
REM First-time setup on Windows. Double-click to run.
REM Installs dependencies, writes env files, builds all apps, then creates + seeds the database.
setlocal
cd /d "%~dp0..\.."

echo === Cafe POS setup ===
echo.
echo [1/5] Installing dependencies...
call corepack pnpm install || goto :err
echo [2/5] Writing local configuration...
call node scripts/win-setup.mjs --prepare-env || goto :err
echo [3/5] Generating Prisma client...
call corepack pnpm db:generate || goto :err
echo [4/5] Building backend, POS and admin...
call corepack pnpm build || goto :err
echo [5/5] Creating database + admin user...
call node scripts/win-setup.mjs || goto :err

echo.
echo Setup complete. Run Start.cmd (or the desktop shortcut) to launch.
echo Default login: owner@cafe.local  /  Owner123!
pause
exit /b 0

:err
echo.
echo *** Setup FAILED. Read the messages above. ***
pause
exit /b 1

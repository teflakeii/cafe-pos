@echo off
REM First-time setup on Windows. Double-click to run.
REM Installs dependencies, builds all apps, then creates + seeds the database.
setlocal
cd /d "%~dp0..\.."

echo === Cafe POS setup ===
echo.
echo [1/4] Installing dependencies...
call pnpm install || goto :err
echo [2/4] Generating Prisma client...
call pnpm db:generate || goto :err
echo [3/4] Building backend, POS and admin...
call pnpm build || goto :err
echo [4/4] Creating database + admin user...
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

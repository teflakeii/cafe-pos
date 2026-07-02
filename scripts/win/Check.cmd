@echo off
REM Verify Cafe POS is ready to start on Windows.
setlocal
cd /d "%~dp0..\.."
node scripts/win-check.mjs

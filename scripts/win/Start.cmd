@echo off
REM Launch Cafe POS (backend + POS + admin) and open the POS window.
REM Keep this window open while using the app; close it (or run Stop.cmd) to quit.
setlocal
cd /d "%~dp0..\.."
node scripts/win-start.mjs

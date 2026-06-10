@echo off
REM Stop all Cafe POS services. This stops every Node process on this PC,
REM which is fine on a dedicated POS machine.
echo Stopping Cafe POS services...
taskkill /F /IM node.exe >nul 2>&1
echo Done.
timeout /t 2 /nobreak >nul

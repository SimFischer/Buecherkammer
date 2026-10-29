@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Bitte zuerst Node.js installieren.
  pause
  exit /b 1
)
echo Im Browser oeffnen: http://127.0.0.1:4173
echo Zum Beenden dieses Fenster schliessen oder Strg+C druecken.
node server.mjs
pause

@echo off
echo Starting Ollama Data Converter API...
echo.
echo Make sure Ollama is running (you usually do NOT need to run "ollama serve" if "ollama list" works)
echo.

REM Auto-pick a free port (try 8010..8015) to avoid "port already in use"
set PORT=
for %%P in (8010 8011 8012 8013 8014 8015) do (
  netstat -ano | findstr ":%%P " >nul 2>&1
  if errorlevel 1 (
    set PORT=%%P
    goto :PORT_FOUND
  )
)

:PORT_FOUND
if "%PORT%"=="" (
  echo ERROR: Could not find a free port in range 8010-8015.
  echo Close the existing converter API, or edit this file to use another range.
  echo.
  pause
  exit /b 1
)

echo Using PORT=%PORT%
echo.
python main.py

pause


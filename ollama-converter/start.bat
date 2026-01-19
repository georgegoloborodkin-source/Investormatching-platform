@echo off
echo Starting Data Converter API (Claude mode)...
echo.
echo No Ollama required when CONVERTER_PROVIDER=claude.
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
set CONVERTER_PROVIDER=claude
set ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
set ANTHROPIC_API_KEY=REPLACE_WITH_YOUR_KEY

if "%ANTHROPIC_API_KEY%"=="REPLACE_WITH_YOUR_KEY" (
  echo ERROR: ANTHROPIC_API_KEY is not set. Edit start.bat and paste your new key.
  echo.
  pause
  exit /b 1
)

python main.py

pause


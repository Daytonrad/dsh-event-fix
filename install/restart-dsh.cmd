@echo off
rem Keep DSH web alive across host-side source edits.
rem
rem Why: a `link:` plugin's host module is loaded once at startup, and the HMR
rem watcher ignores `**/node_modules` — a linked package lives there while the
rem real source sits in the repo, so client edits are picked up per request but
rem host edits are not. The page then looks new while the data is old.
rem
rem Usage:
rem   install\restart-dsh.cmd           start if the port is free, else no-op
rem   install\restart-dsh.cmd --force   always restart
rem
rem Registered as a task that repeats every couple of minutes, so a process
rem killed by an outside supervisor comes back on its own. The port check makes
rem the repetition a cheap no-op when the server is already up.
setlocal enableextensions enabledelayedexpansion

set "DS_ROOT=E:\program\DeepSeek"
set "DSH_HOME=%DS_ROOT%\.dsh"
set "DS_PORT=3080"
set "DS_LOG=%~dp0..\.scratch\dsh-restart.out.log"
set "DS_NODE=%DS_ROOT%\runtime\node-v24.19.0-win-x64\node.exe"
set "DS_CLI=%DS_ROOT%\app\node_modules\@deepseek-ai\dsh\lib\bin.js"

if not exist "%DS_NODE%" (
  echo restart-dsh: portable node not found under "%DS_ROOT%" 1>&2
  exit /b 1
)

set "ALIVE="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%DS_PORT% .*LISTENING"') do (
  if not "%%P"=="0" set "ALIVE=%%P"
)

if defined ALIVE (
  if /i not "%~1"=="--force" exit /b 0
  echo stopping pid !ALIVE! on port %DS_PORT%
  taskkill /F /PID !ALIVE! >nul 2>&1
  ping -n 2 127.0.0.1 >nul
)

rem A stale proxy turns every model request into "Connection error".
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "ALL_PROXY="
set "NODE_USE_ENV_PROXY=0"
set "PATH=%DS_ROOT%\runtime\node-v24.19.0-win-x64;%PATH%"

cd /d "%DS_ROOT%"
echo [%DATE% %TIME%] starting dsh web >> "%DS_LOG%"
"%DS_NODE%" "%DS_CLI%" web --no-open >> "%DS_LOG%" 2>&1
echo [%DATE% %TIME%] dsh web exited with %ERRORLEVEL% >> "%DS_LOG%"
exit /b 0

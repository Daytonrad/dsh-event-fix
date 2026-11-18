@echo off
rem Restart DSH web so host-side source edits take effect.
rem
rem Why this exists: a `link:` plugin's source is not hot-reloaded. The HMR
rem watcher ignores `**/node_modules`, and the linked package lives there while
rem the real source sits in the repo, so a new bundle hot-applies but an edited
rem host module never does. The client half is read from disk per request, which
rem is why the page can look new while the data is stale.
rem
rem Usage: install\restart-dsh.cmd
rem It kills the process listening on the port, then starts a fresh one and
rem prints a token URL — the token changes on every restart, so open that URL.
setlocal enableextensions enabledelayedexpansion

set "DS_ROOT=E:\program\DeepSeek"
set "DSH_HOME=%DS_ROOT%\.dsh"
set "DS_PORT=3080"
set "DS_LOG=%~dp0..\.scratch\dsh-restart.out.log"

rem A stale proxy turns every model request into "Connection error".
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "ALL_PROXY="
set "NODE_USE_ENV_PROXY=0"
set "PATH=%DS_ROOT%\runtime\node-v24.19.0-win-x64;%PATH%"

if not exist "%DS_ROOT%\runtime\node-v24.19.0-win-x64\node.exe" (
  echo restart-dsh: portable node not found under "%DS_ROOT%" 1>&2
  exit /b 1
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%DS_PORT% .*LISTENING"') do (
  if not "%%P"=="0" (
    echo stopping old instance on port %DS_PORT% ^(pid %%P^)
    taskkill /F /PID %%P >nul 2>&1
  )
)

rem `timeout` fails without a console; ping is the portable sleep here.
ping -n 2 127.0.0.1 >nul

cd /d "%DS_ROOT%"
set "DS_NODE=%DS_ROOT%\runtime\node-v24.19.0-win-x64\node.exe"
set "DS_CLI=%DS_ROOT%\app\node_modules\@deepseek-ai\dsh\lib\bin.js"
echo starting dsh web, log: %DS_LOG%
"%DS_NODE%" "%DS_CLI%" web --no-open >> "%DS_LOG%" 2>&1
exit /b %ERRORLEVEL%

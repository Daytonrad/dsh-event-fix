@echo off
setlocal enableextensions
rem Portable `dsh` shim for installations that ship their own Node runtime and
rem are not on PATH (the common Windows case). Copy it into a directory that is
rem already on PATH, e.g. %USERPROFILE%\.local\bin, and adjust DS_ROOT.
set "DS_ROOT=E:\program\DeepSeek"
set "DS_NODE=%DS_ROOT%\runtime\node-v24.19.0-win-x64\node.exe"
set "DS_CLI=%DS_ROOT%\app\node_modules\@deepseek-ai\dsh\lib\bin.js"

if not exist "%DS_NODE%" (
  echo dsh: portable node not found at "%DS_NODE%" 1>&2
  exit /b 1
)
if not exist "%DS_CLI%" (
  echo dsh: CLI not found at "%DS_CLI%" 1>&2
  exit /b 1
)

if not defined DSH_HOME set "DSH_HOME=%DS_ROOT%\.dsh"
set "PATH=%DS_ROOT%\runtime\node-v24.19.0-win-x64;%PATH%"

rem Model providers use Node's environment proxy support; a stale value makes
rem every request fail with "Connection error". Strip it when booting an app,
rem keep it for `plugin` because pnpm needs the network.
if /i "%~1"=="web" goto strip_proxy
if /i "%~1"=="tui" goto strip_proxy
if /i "%~1"=="headless" goto strip_proxy
goto run

:strip_proxy
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "ALL_PROXY="
set "NODE_USE_ENV_PROXY=0"

:run
"%DS_NODE%" "%DS_CLI%" %*
exit /b %ERRORLEVEL%

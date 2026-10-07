@echo off
title Kactus - Servidor Local
cd /d "%~dp0"

set "URL=http://localhost:3003"

REM "/inicio" = aberto pela pasta Inicializar do Windows: sobe tudo, mas sem
REM abrir o navegador no PC (o uso e pelo iPhone)
set "ABRIR_NAVEGADOR=1"
if /i "%~1"=="/inicio" set "ABRIR_NAVEGADOR=0"

REM O Explorer pode estar com um PATH antigo (sem pnpm/uv): garante as pastas aqui
set "PATH=%APPDATA%\npm;%USERPROFILE%\.local\bin;%ProgramFiles%\nodejs;%PATH%"

REM pnpm instalado de dentro do app do Claude fica numa pasta virtual que o
REM Explorer nao enxerga: se faltar, instala de verdade (so na primeira vez)
where pnpm >nul 2>&1 && goto :tem_pnpm
echo Instalando o pnpm (so desta vez)...
call npm install -g pnpm@12.3.4
where pnpm >nul 2>&1 || (
    echo Nao consegui instalar o pnpm. Abra um terminal e rode: npm install -g pnpm
    pause
    exit /b 1
)
:tem_pnpm

REM Se o Kactus ja estiver rodando, so abre o navegador
netstat -ano | findstr ":3003 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    if "%ABRIR_NAVEGADOR%"=="1" start "" "%URL%"
    exit /b
)

REM Endereco do iPhone (Tailscale), se estiver instalado
set "TSNAME="
set "TSEXE=%ProgramFiles%\Tailscale\tailscale.exe"
if exist "%TSEXE%" for /f "delims=" %%a in ('powershell -NoProfile -Command "try { ((& $env:TSEXE status --json | ConvertFrom-Json).Self.DNSName).TrimEnd('.') } catch {}"') do set "TSNAME=%%a"

echo ==========================================
echo   Iniciando Kactus...
echo ==========================================
echo.
echo Site:   %URL%
if defined TSNAME echo iPhone: https://%TSNAME%
echo API:    http://127.0.0.1:8000
if "%ABRIR_NAVEGADOR%"=="1" echo O navegador abre sozinho quando o site estiver pronto.
echo Para encerrar, feche esta janela ou aperte Ctrl+C.
echo.

REM Espera o site responder e abre o navegador (em paralelo)
REM (ping como pausa: o "timeout" falha em segundo plano e o laco acabava antes do site subir)
if "%ABRIR_NAVEGADOR%"=="1" start "" /b cmd /q /c "for /l %%i in (1,1,90) do (curl -s -o nul %URL% && (start "" %URL% & exit) || ping -n 3 127.0.0.1 >nul)"

REM Sobe API (FastAPI) + site (Next.js)
call pnpm dev

echo.
echo Servidor encerrado.
pause

@echo off
title Kactus - Servidor Local
cd /d "%~dp0"

set "URL=http://localhost:3003"

REM "/inicio" = aberto pela pasta Inicializar do Windows: sobe tudo, mas sem
REM abrir o navegador no PC (o uso e pelo iPhone)
REM e usa o modo rapido (build de producao), bem mais leve para o celular
set "ABRIR_NAVEGADOR=1"
set "MODO=dev"
if /i "%~1"=="/inicio" set "ABRIR_NAVEGADOR=0"
if /i "%~1"=="/inicio" set "MODO=rapido"

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
if "%MODO%"=="rapido" echo Modo:   rapido - versao otimizada; mudancas no codigo so aparecem ao reabrir
if "%ABRIR_NAVEGADOR%"=="1" echo O navegador abre sozinho quando o site estiver pronto.
echo Para encerrar, feche esta janela ou aperte Ctrl+C.
echo.

REM Espera o site responder e abre o navegador (em paralelo)
REM (ping como pausa: o "timeout" falha em segundo plano e o laco acabava antes do site subir)
if "%ABRIR_NAVEGADOR%"=="1" start "" /b cmd /q /c "for /l %%i in (1,1,90) do (curl -s -o nul %URL% && (start "" %URL% & exit) || ping -n 3 127.0.0.1 >nul)"

REM Sobe API (FastAPI) + site (Next.js). Se cair, sobe de novo sozinho: o iPhone
REM so mostra tela branca quando o servidor esta fora. Para parar de vez, feche
REM esta janela (ou Ctrl+C e responda S).
:subir
if not "%MODO%"=="rapido" goto :modo_dev

REM Modo rapido (/inicio): versao otimizada do site em apps\web\.next-prod
REM (~0,25 MB de JS no painel, contra ~12 MB do dev). Refaz o build so quando
REM algum arquivo do site mudou; se o build falhar, cai para o modo normal.
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\precisa-build.ps1"
if not errorlevel 1 goto :start_rapido
echo Preparando a versao rapida do site, so quando o codigo muda: 1 a 2 minutos...
call pnpm build:prod
if not errorlevel 1 goto :start_rapido
echo.
echo O build falhou: subindo no modo normal, mais lento no iPhone.
set "MODO=dev"
goto :modo_dev

:start_rapido
call pnpm start:prod
goto :caiu

:modo_dev
call pnpm dev

:caiu
echo.
echo Servidor caiu. Subindo de novo em 5 segundos... (feche a janela para encerrar)
ping -n 6 127.0.0.1 >nul
goto :subir

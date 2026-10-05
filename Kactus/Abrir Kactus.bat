@echo off
title Kactus - Servidor Local
cd /d "%~dp0"

set "URL=http://localhost:3003"

REM Se o Kactus ja estiver rodando, so abre o navegador
netstat -ano | findstr ":3003 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    start "" "%URL%"
    exit /b
)

echo ==========================================
echo   Iniciando Kactus...
echo ==========================================
echo.
echo Site: %URL%
echo API:  http://127.0.0.1:8000
echo O navegador abre sozinho quando o site estiver pronto.
echo Para encerrar, feche esta janela ou aperte Ctrl+C.
echo.

REM Espera o site responder e abre o navegador (em paralelo)
start "" /b cmd /c "for /l %%i in (1,1,90) do (curl -s -o nul %URL% && (start "" %URL% & exit) || timeout /t 2 /nobreak >nul)"

REM Sobe API (FastAPI) + site (Next.js)
call pnpm dev

echo.
echo Servidor encerrado.
pause

@echo off
title WorkShift - Portal do Colaborador
echo ========================================================
echo   WorkShift - Portal do Colaborador (Modo Servidor Local)
echo ========================================================
echo.
echo Verificando instalacao do Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [AVISO] Node.js nao encontrado no seu computador.
    echo Abrindo a versao standalone direta no seu navegador padrao...
    start "" "CLIQUE_AQUI_PARA_ABRIR.html"
    pause
    exit /b
)

echo Node.js detectado! Instalando dependencias (caso necessario)...
call npm install
echo.
echo Iniciando o servidor de desenvolvimento...
echo Abrindo em http://localhost:3000
start "" "http://localhost:3000"
call npm run dev
pause

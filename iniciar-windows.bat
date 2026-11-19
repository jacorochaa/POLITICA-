@echo off
cd /d "%~dp0"
title Colinha e Moldura - servidor local
echo.
echo   Colinha ^& Moldura rodando em http://localhost:8000
echo   Para encerrar, feche esta janela.
echo.
start "" http://localhost:8000
where py >nul 2>nul && (py -m http.server 8000 & goto :eof)
where python >nul 2>nul && (python -m http.server 8000 & goto :eof)
echo Python nao encontrado.
echo Instale em https://www.python.org/downloads/ e marque "Add python.exe to PATH".
pause

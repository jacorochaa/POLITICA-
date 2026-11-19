@echo off
cd /d "%~dp0"
title Colinha e Moldura - servidor local
echo.
echo   Colinha ^& Moldura rodando em http://localhost:8000
echo   Para encerrar, feche esta janela.
echo.

rem Usa o Python se estiver instalado de verdade (o atalho da Microsoft Store nao conta);
rem se nao houver Python, usa o Node.
py -c "pass" >nul 2>nul && goto :py
python -c "pass" >nul 2>nul && goto :python
node -v >nul 2>nul && goto :node

echo Nao encontrei Python nem Node neste computador.
echo Instale um dos dois:
echo   Python: https://www.python.org/downloads/  (marque "Add python.exe to PATH")
echo   Node:   https://nodejs.org/
pause
goto :eof

:py
start "" http://localhost:8000
py -m http.server 8000
goto :eof

:python
start "" http://localhost:8000
python -m http.server 8000
goto :eof

:node
start "" http://localhost:8000
node scripts\servidor.mjs 8000
goto :eof

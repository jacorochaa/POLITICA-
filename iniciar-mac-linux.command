#!/bin/sh
# Inicia o site em http://localhost:8000 (Mac: dois cliques; Linux: ./iniciar-mac-linux.command)
cd "$(dirname "$0")" || exit 1
echo "Colinha & Moldura rodando em http://localhost:8000 (Ctrl+C para encerrar)"
(sleep 1; open http://localhost:8000 2>/dev/null || xdg-open http://localhost:8000 2>/dev/null) &
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server 8000
else
  python -m http.server 8000
fi

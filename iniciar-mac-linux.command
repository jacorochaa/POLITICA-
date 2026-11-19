#!/bin/sh
# Inicia o site em http://localhost:8000 (Mac: dois cliques; Linux: ./iniciar-mac-linux.command)
# Usa o Python se estiver instalado; se nao, usa o Node.
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  servidor="python3 -m http.server 8000"
elif command -v python >/dev/null 2>&1; then
  servidor="python -m http.server 8000"
elif command -v node >/dev/null 2>&1; then
  servidor="node scripts/servidor.mjs 8000"
else
  echo "Nao encontrei Python nem Node. Instale um dos dois:"
  echo "  Python: https://www.python.org/downloads/"
  echo "  Node:   https://nodejs.org/"
  exit 1
fi
echo "Colinha & Moldura rodando em http://localhost:8000 (Ctrl+C para encerrar)"
(sleep 1; open http://localhost:8000 2>/dev/null || xdg-open http://localhost:8000 2>/dev/null) &
exec $servidor

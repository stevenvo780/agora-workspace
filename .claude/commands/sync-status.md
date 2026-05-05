---
description: Diagnóstico del sistema de sincronización Agora (daemon agora-host-sync, RTDB, MinIO/Firestore consistencia). Invoca sync-debugger con el síntoma reportado por el user. Úsalo cuando se reporte "no sincroniza", "el archivo no aparece", "ya no funciona como antes", desfases entre web y workspace.
argument-hint: "[síntoma libre, ej: 'el workspace X no recibe RTDB'] [--ws <wsId>]"
---

# /sync-status — Diagnóstico de sincronización Agora

Síntoma + contexto: $ARGUMENTS

## Pasos

1. **Quick health pass** (sin agente, rápido):
   ```bash
   ssh nas ssh stev-server 'systemctl status agora-host-sync --no-pager | head -10' 2>/dev/null
   ssh nas ssh stev-server 'tail -30 /home/stev/logs/agora-host-sync.log' 2>/dev/null
   ssh nas ssh stev-server 'docker ps --filter name=edu-worker --format "{{.Names}}\t{{.Status}}" | wc -l' 2>/dev/null
   ```
   Reportá resumen (1 línea) por chequeo.

2. **Si el quick pass muestra cualquier anomalía** (daemon down, workers <25, errores en log) → invocá `sync-debugger` agent con el síntoma + el contexto recogido.

3. **Si el quick pass está OK pero el user sigue reportando issue** → invocá igual `sync-debugger` (puede ser regresión sutil — payload RTDB, canal personal, hash duplicado).

4. **Forwardear el verdict del agente** sin modificar. Si el agente propone fix, mostrá los archivos involucrados con `file:line` y preguntá al user si querés que lo apliques (no aplicar sin confirmación).

## Reglas

- NO declares "sync OK" sin haber corrido el quick pass mínimo.
- Si la causa raíz es Docker daemon crash (HTTP/2 framer panic), recordá al user que es bug del entorno, no del proyecto, y proponé `apt upgrade docker-ce` en próxima ventana de mantenimiento.
- Para acciones destructivas (reiniciar daemon, recrear workers, borrar archivo desincronizado) → SIEMPRE pedir confirmación.

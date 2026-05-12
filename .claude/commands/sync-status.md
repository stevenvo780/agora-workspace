---
description: Diagnóstico del sistema de sincronización Agora (daemon agora-host-sync, RTDB, MinIO/Firestore consistencia). Invoca sync-debugger con el síntoma reportado por el user. Úsalo cuando se reporte "no sincroniza", "el archivo no aparece", "ya no funciona como antes", desfases entre web y workspace.
argument-hint: "[síntoma libre, ej: 'el workspace X no recibe RTDB'] [--ws <wsId>]"
---

# /sync-status — Diagnóstico de sincronización Agora

Síntoma + contexto: $ARGUMENTS

## Pasos

1. **Quick health pass** (sin agente, rápido):
   ```bash
   ssh humanizar2 'systemctl status agora-host-sync --no-pager | head -10'
   ssh humanizar2 'tail -30 /home/humanizar/logs/agora-host-sync.log'
   ssh humanizar2 'docker ps --filter name=edu-worker --format "{{.Names}}\t{{.Status}}" | wc -l'
   # Custom claims Firebase (RTDB workspace membership):
   gcloud compute ssh agora-hub --zone=us-central1-a --project=udea-filosofia --quiet --command='sudo journalctl -u edu-hub --since "5 minutes ago" --no-pager | grep -ciE "claim|permission denied|unauthorized"'
   # SA Firebase PEM (newlines correctos):
   gcloud run services describe agora-backend --region=us-central1 --project=udea-filosofia --format='value(spec.template.spec.containers[0].env)' | tr ',' '\n' | grep -c 'FIREBASE_DATABASE_URL'
   ```
   Reportá resumen (1 línea) por chequeo.

2. **Si el quick pass muestra cualquier anomalía** (daemon down, workers <30, errores en log, claims fallando, FIREBASE_DATABASE_URL ausente) → invocá `sync-debugger` agent con el síntoma + el contexto recogido.

3. **Si el quick pass está OK pero el user sigue reportando issue** → invocá igual `sync-debugger` (puede ser regresión sutil — payload RTDB sin `timestamp/type/source`, canal `personal_<uid>` mal armado, hash duplicado, custom claim no propagado).

4. **Forwardear el verdict del agente** sin modificar. Si el agente propone fix, mostrá los archivos involucrados con `file:line` y preguntá al user si querés que lo apliques (no aplicar sin confirmación).

## Reglas

- NO declares "sync OK" sin haber corrido el quick pass mínimo.
- Si la causa raíz es Docker daemon crash (HTTP/2 framer panic), recordá al user que es bug del entorno, no del proyecto, y proponé `apt upgrade docker-ce` en próxima ventana de mantenimiento.
- Si la causa es SA Firebase PEM corrupto (newlines como espacios → `DECODER routines::unsupported`), regenerar con `printf '%s' "$KEY"` no `echo`.
- Si la causa es `personal_<uid>` mal armado (sin uid), buscar en `AgoraFront/src/lib/sync-channel.ts` y `AgoraBack/src/lib/sync/channelResolver.ts`.
- Para acciones destructivas (reiniciar daemon, recrear workers, borrar archivo desincronizado) → SIEMPRE pedir confirmación.

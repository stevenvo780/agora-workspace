# Runbooks operativos — Agora

## Sync roto

1. Revisar `GET /health/deep` de AgoraBack y `GET /health` de AgoraHub.
2. Confirmar `WORKER_SYNC_SECRET` entre Back/host-sync y `WORKER_SOCKET_SECRET` entre Hub/workers. Durante rotación validar también `WORKER_SECRET_PREVIOUS`.
3. En `stev-server`, revisar `systemctl status agora-host-sync` y últimos logs.
4. Verificar un workspace con `worker-list`, luego un `worker-commit` pequeño.
5. Si RTDB no publica, revisar `syncEventsOutbox` y ejecutar `/api/cron/drain-outbox`.

## Pagos fallidos

1. Confirmar que `MERCADOPAGO_WEBHOOK_SECRET` existe en producción.
2. Revisar logs `[mp/webhook]` con `X-Request-Id`.
3. Reprocesar sólo eventos verificados contra MercadoPago.
4. No activar suscripciones manuales salvo con usuario admin/RBAC real.

## Worker caído

1. Revisar `GET /agent/workspace-status`.
2. Validar heartbeat `lastHeartbeatAt` y `metrics.consecutiveErrors`.
3. En host, revisar `docker ps --filter name=edu-worker`.
4. Si el contenedor está `exited`, dejar que host-sync lo reviva o iniciar con `edu-worker-manager`.
5. Comandos agente pendientes deben reintentarse; no se persisten.

## Worker en restart loop con imagen vieja (zombie)

Síntoma: la UI muestra `<workspace> worker offline`, pero el container existe en
`docker ps -a` con estado `Restarting (137) N days ago`. `edu-worker-manager update all`
no lo recicla porque solo toca containers en estado `running`. `agora-host-sync`
solo hace `docker start` sobre `exited`, no recrea desde cero.

```bash
# 1. Confirmar el container y el imagen vieja:
ssh stev@100.98.8.227 "docker inspect edu-worker-<wsId> --format 'Image:{{.Image}} Status:{{.State.Status}} ExitCode:{{.State.ExitCode}}'"

# 2. Intentar remove normal:
ssh stev@100.98.8.227 "docker rm -f edu-worker-<wsId>"

# 3. Si docker daemon devuelve 'tried to kill container, but did not receive an exit event'
#    (bug HTTP/2 de Docker 28.2.2), buscar el proceso node/app/index.js huérfano:
ssh stev@100.98.8.227 "ps auxf | grep -E 'node /app/index.js' | grep -v grep"

# 4. Kill -9 al PID que tenga fecha START vieja (días/semanas atrás, sin parent):
ssh stev@100.98.8.227 "echo <PASSWORD> | sudo -S kill -9 <PID>"

# 5. Reintentar el remove:
ssh stev@100.98.8.227 "docker rm -f edu-worker-<wsId>"

# 6. Recrear container con la imagen latest actual:
ssh stev@100.98.8.227 "echo <PASSWORD> | sudo -S edu-worker-manager add <wsId>"

# 7. Verificar revival y autenticación al hub:
ssh stev@100.98.8.227 "docker ps --filter name=edu-worker-<wsId> && journalctl --user -u edu-hub --since '30 seconds ago' --no-pager | grep <wsId>"
```

Causa típica: container creado hace mucho con imagen vieja que crashea al iniciar
antes de pasar el primer heartbeat. `update all` no lo toca porque no está running,
y termina como container huérfano sin forma autonómica de recuperación.

## RTDB sin eventos

1. Validar `FIREBASE_DATABASE_URL` en Back.
2. Confirmar que el payload trae `timestamp`, `type`, `source` y `schemaVersion`.
3. Para personal workspace, el canal esperado es `sync-events/personal_<uid>`.
4. Revisar outbox y drainer antes de asumir pérdida de datos.

## MinIO inaccesible

1. Revisar credenciales S3 y bucket `NAS_S3_BUCKET`.
2. Confirmar conectividad desde Back y host-sync.
3. No borrar metadata Firestore hasta recuperar blobs o confirmar reconciliación.

## Deploy y smoke

1. Deployar servicio afectado.
2. Ejecutar `npm run smoke` con `AGORA_BACKEND_URL`, `AGORA_HUB_URL` y/o `AGORA_FRONT_URL`.
3. Probar flujo real afectado antes de declarar cierre.

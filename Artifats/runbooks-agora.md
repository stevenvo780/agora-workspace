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

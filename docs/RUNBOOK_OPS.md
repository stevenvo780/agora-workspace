# RUNBOOK_OPS — procedimientos operacionales Agora

Procedimientos copy-paste-ready para incidentes, rollback y recovery.
Pensado para pre-release y operación 24/7. Las credenciales y URLs sensibles
viven en `AgoraFront/.claude/secrets.md` (gitignored).

Cada bloque trae:
- **Cuándo usarlo** (síntoma)
- **Comando exacto**
- **Verificación post-acción**

---

## Tabla de contenidos

1. [Rollback Cloud Run (AgoraBack)](#1-rollback-cloud-run-agoraback)
2. [Restart hub edu-hub](#2-restart-hub-edu-hub)
3. [Restart workers humanizar2](#3-restart-workers-humanizar2)
4. [Regenerar Service Account Firebase](#4-regenerar-service-account-firebase)
5. [Recovery MinIO corrupto](#5-recovery-minio-corrupto)
6. [Recovery Firestore desde backup](#6-recovery-firestore-desde-backup)
7. [Deshabilitar agente IA temporalmente](#7-deshabilitar-agente-ia-temporalmente)
8. [Verificar workers conectados al hub](#8-verificar-workers-conectados-al-hub)
9. [Limpiar cache cliente (deploy nuevo no se ve)](#9-limpiar-cache-cliente-deploy-nuevo-no-se-ve)
10. [Maintenance mode (front en mantenimiento)](#10-maintenance-mode-front-en-mantenimiento)
11. [Rotar WORKER_SECRET sin downtime](#11-rotar-worker_secret-sin-downtime)
12. [Reanudar daemon agora-host-sync caído](#12-reanudar-daemon-agora-host-sync-caído)
13. [Rotar Service Account Firebase (procedimiento real ejecutado)](#13-rotar-service-account-firebase-procedimiento-real-ejecutado)
14. [Backfill custom claims de workspaces](#14-backfill-custom-claims-de-workspaces)
15. [Subir/bajar rate limit del agente IA](#15-subirbajar-rate-limit-del-agente-ia)
16. [Resetear contador diario de tokens de un user](#16-resetear-contador-diario-de-tokens-de-un-user)
17. [Forzar update del Service Worker en clientes existentes (PWA)](#17-forzar-update-del-service-worker-en-clientes-existentes-pwa)
18. [Activar TTL automático en `users/{uid}/agentUsage`](#18-activar-ttl-automático-en-usersuidagentusage)
19. [Cerrar / reabrir puerto raw 3010 del hub](#19-cerrar--reabrir-puerto-raw-3010-del-hub)
20. [Disparar backfill del citation graph manual](#20-disparar-backfill-del-citation-graph-manual)
21. [Reload de Caddy en la VM del hub](#21-reload-de-caddy-en-la-vm-del-hub)

---

## 1. Rollback Cloud Run (AgoraBack)

**Cuándo**: una revision nueva de `agora-backend` rompe producción (errores
5xx, latencia alta, lógica de agente IA roja).

### Paso 1 — identificar la revision previa estable

```bash
gcloud run revisions list \
  --service=agora-backend \
  --region=us-central1 \
  --project=udea-filosofia \
  --format='table(metadata.name, status.conditions[0].lastTransitionTime, status.conditions[0].status)' \
  --limit=10
```

La revision activa hoy aparece marcada como `Ready: True`. La anterior
suele ser la inmediata anterior por fecha. Identifica el nombre exacto
(ej. `agora-backend-00123-xyz`).

### Paso 2 — derivar 100% del tráfico a esa revision

```bash
gcloud run services update-traffic agora-backend \
  --to-revisions=<previous-revision-name>=100 \
  --region=us-central1 \
  --project=udea-filosofia
```

### Paso 3 — verificación

```bash
# Health
curl -sf https://agora-backend-578238159459.us-central1.run.app/health
# Debe responder: {"status":"ok"}

# Confirmar que la revision activa es la esperada
gcloud run services describe agora-backend \
  --region=us-central1 \
  --project=udea-filosofia \
  --format='value(status.traffic[0].revisionName,status.traffic[0].percent)'
```

> **Nota**: el rollback es instantáneo. Si Cloud Scheduler está apuntando al
> servicio (cron jobs), los jobs siguen funcionando.

---

## 2. Restart hub edu-hub

**Cuándo**: clientes browser no reciben terminal output, comandos del agente
quedan colgados, `/health` no responde en `127.0.0.1:3010`.

El hub corre en `humanizar2` (NetBird `100.98.5.11`) como `systemd --user`
unit del usuario `humanizar`.

### Acción

```bash
ssh nas ssh humanizar2 'systemctl --user restart edu-hub'
```

### Verificación

```bash
# El servicio quedó active
ssh nas ssh humanizar2 'systemctl --user status edu-hub | head -20'

# El health local responde
ssh nas ssh humanizar2 'curl -s http://127.0.0.1:3010/health'

# El hub público responde (proxy desde Vercel)
curl -s https://agora.elenxos.com/api/diag | python3 -m json.tool
```

> Estado en memoria del hub se PIERDE en restart: sesiones PTY, comandos
> agente pendientes, suscripciones workspace. Los clientes browser
> deben reconectar; los workers se re-registran solos en <5s.

---

## 3. Restart workers humanizar2

**Cuándo**: workers no responden a comandos, terminales colgadas, daemon
docker crasheó (bug HTTP/2 conocido).

### Restart de un worker específico

```bash
ssh nas ssh humanizar2 'docker restart edu-worker-<wsId>'
```

### Restart de TODOS los workers (destructivo, requiere sudo)

```bash
ssh nas ssh humanizar2 'echo "$SUDO_PASS" | sudo -S edu-worker-manager restart all'
```

Si `edu-worker-manager` no existe o falla, fallback manual:

```bash
ssh nas ssh humanizar2 \
  'docker ps --filter name=edu-worker --format "{{.Names}}" | xargs -r docker restart'
```

### Verificación

```bash
ssh nas ssh humanizar2 'docker ps --filter name=edu-worker --format "table {{.Names}}\t{{.Status}}"'
```

Todos los workers deben aparecer en estado `Up ...`. Si alguno aparece
`Exited`, el daemon `agora-host-sync` lo revivirá en el siguiente ciclo
(cada 5s).

---

## 4. Regenerar Service Account Firebase

**Cuándo**: la SA actual está comprometida o expiró. Aplica a `udea-filosofia`.

### Paso 1 — crear nueva key en GCP

```bash
gcloud iam service-accounts keys create /tmp/firebase-sa.json \
  --iam-account=firebase-adminsdk-xxxx@udea-filosofia.iam.gserviceaccount.com \
  --project=udea-filosofia
```

### Paso 2 — actualizar Secret Manager (consumido por Cloud Run)

```bash
gcloud secrets versions add firebase-service-account \
  --data-file=/tmp/firebase-sa.json \
  --project=udea-filosofia
```

### Paso 3 — actualizar Vercel (AgoraFront lee `FIREBASE_SERVICE_ACCOUNT`)

```bash
# Borrar valor previo
vercel env rm FIREBASE_SERVICE_ACCOUNT production
# Re-add (debe ser una sola línea, sin newline al final)
cat /tmp/firebase-sa.json | jq -c | tr -d '\n' | vercel env add FIREBASE_SERVICE_ACCOUNT production
```

### Paso 4 — actualizar VMs (hub + daemon)

```bash
# Copiar al host
scp /tmp/firebase-sa.json nas:/tmp/
ssh nas scp /tmp/firebase-sa.json humanizar2:/tmp/
# Sustituir en /etc/edu-hub/hub.env y reiniciar
ssh nas ssh humanizar2 'sudo cp /tmp/firebase-sa.json /etc/agora/firebase-sa.json && systemctl --user restart edu-hub && systemctl restart agora-host-sync'
```

### Paso 5 — redeploys

```bash
# Cloud Run (lee secret al boot)
cd AgoraBack && gcloud run deploy agora-backend --source . --region us-central1

# Vercel (env vars no se aplican en caliente)
cd ../AgoraFront && vercel deploy --prod --yes
```

### Paso 6 — revocar la key vieja

```bash
gcloud iam service-accounts keys list \
  --iam-account=firebase-adminsdk-xxxx@udea-filosofia.iam.gserviceaccount.com \
  --project=udea-filosofia

gcloud iam service-accounts keys delete <KEY_ID_VIEJA> \
  --iam-account=firebase-adminsdk-xxxx@udea-filosofia.iam.gserviceaccount.com \
  --project=udea-filosofia
```

Luego: `rm -f /tmp/firebase-sa.json`.

---

## 5. Recovery MinIO corrupto

**Cuándo**: bucket `agora-blobs` con datos perdidos o corruptos. Asume que
existe el bucket mirror `agora-blobs-backup` (depende del PR #119 deployado).

### Paso 1 — confirmar estado del bucket

```bash
ssh nas 'docker exec agora-minio mc ls --recursive adm/agora-blobs/ | wc -l'
ssh nas 'docker exec agora-minio mc ls --recursive adm/agora-blobs-backup/ | wc -l'
```

Si el backup tiene MÁS objetos que el primario, hay pérdida real.

### Paso 2 — restore del path afectado (caso parcial)

```bash
# Restaurar carpeta workspaces/<wsId>/
ssh nas 'docker exec agora-minio mc mirror --overwrite \
  adm/agora-blobs-backup/workspaces/<wsId>/ \
  adm/agora-blobs/workspaces/<wsId>/'
```

### Paso 3 — restore completo (último recurso)

```bash
# Mirror completo del backup → primario
ssh nas 'docker exec agora-minio mc mirror --overwrite \
  adm/agora-blobs-backup/ adm/agora-blobs/'
```

> Después del mirror, forzar refresh RTDB para que los clientes invaliden cache:
> usar el tool del agente `force_emit_sync_ping` o llamar el endpoint
> `POST /api/sync/refresh-workspace` con HMAC.

### Verificación

```bash
ssh nas 'docker exec agora-minio mc stat adm/agora-blobs/workspaces/<wsId>/<doc>'
```

---

## 6. Recovery Firestore desde backup

**Cuándo**: documentos perdidos o colección corrupta. Asume backups
automáticos diarios en `gs://agora-firestore-backups-udea-filosofia/`.

### Paso 1 — listar backups disponibles

```bash
gsutil ls gs://agora-firestore-backups-udea-filosofia/
# Backups con formato: YYYY-MM-DDTHH:MM:SS_*
```

### Paso 2 — restore de una colección específica

```bash
# Importa SOLO la colección `documents` desde el backup elegido
gcloud firestore import \
  gs://agora-firestore-backups-udea-filosofia/<BACKUP_ID>/ \
  --collection-ids=documents \
  --project=udea-filosofia
```

### Paso 3 — restore completo (DESTRUCTIVO — sobreescribe todo)

```bash
gcloud firestore import \
  gs://agora-firestore-backups-udea-filosofia/<BACKUP_ID>/ \
  --project=udea-filosofia
```

> Confirmar SIEMPRE con el user antes de un restore total. Es destructivo
> sobre cualquier escritura posterior al backup.

### Verificación

Consulta del documento esperado desde Firestore UI o:

```bash
gcloud firestore documents describe \
  --collection=documents \
  --document=<doc-id> \
  --project=udea-filosofia
```

---

## 7. Deshabilitar agente IA temporalmente

**Cuándo**: el agente IA está causando errores masivos, consumiendo crédito
de proveedor, o se detectó vulnerabilidad en una tool.

### Opción A — flag desde Cloud Run env var (recomendado)

```bash
gcloud run services update agora-backend \
  --region=us-central1 \
  --project=udea-filosofia \
  --update-env-vars=AGENT_DISABLED=true
```

El backend devuelve `503 Service Unavailable` en todas las rutas
`/api/agora-ai/*` cuando `AGENT_DISABLED=true`. Aplicar instantáneo
(crea nueva revision con la env actualizada).

### Opción B — flag desde Vercel (front oculta UI del agente)

```bash
printf 'true' | vercel env add NEXT_PUBLIC_AGENT_DISABLED production
vercel deploy --prod --yes   # requiere redeploy
```

El front oculta el botón "Agente IA" y los slash commands del agente.

### Re-habilitar

```bash
# Backend
gcloud run services update agora-backend \
  --region=us-central1 \
  --project=udea-filosofia \
  --remove-env-vars=AGENT_DISABLED

# Front
vercel env rm NEXT_PUBLIC_AGENT_DISABLED production
vercel deploy --prod --yes
```

---

## 8. Verificar workers conectados al hub

**Cuándo**: chequeo de salud rápido o tras un incidente.

```bash
# Contador de workers registrados (últimos 5 min)
ssh nas ssh humanizar2 \
  'journalctl --user -u edu-hub --since "5 minutes ago" | grep "Worker registered" | wc -l'

# Lista detallada
ssh nas ssh humanizar2 \
  'journalctl --user -u edu-hub --since "5 minutes ago" | grep "Worker registered"'

# Conteo de containers vivos en el host
ssh nas ssh humanizar2 \
  'docker ps --filter name=edu-worker --format "{{.Names}}" | wc -l'
```

El conteo de containers y el conteo de "Worker registered" en los últimos
5 minutos deben coincidir (±1, hay reconexiones normales). En operación
estable: 27 workers conectados.

---

## 9. Limpiar cache cliente (deploy nuevo no se ve)

**Cuándo**: el user reporta que ve la versión vieja del front tras un deploy.

### Paso 1 — re-aliasear el deployment (purge CDN Vercel)

```bash
# Después de vercel deploy --prod --yes, obtener URL temporal:
# Production: https://visormarkdown-xxx.vercel.app
vercel alias set <visormarkdown-xxx>.vercel.app agora.elenxos.com
```

Esto invalida el alias del CDN y los clientes nuevos ven la versión nueva
inmediatamente.

### Paso 2 — limpiar service worker en el browser del user

Pegar en la consola del navegador:

```javascript
navigator.serviceWorker.getRegistrations().then(rs => {
  rs.forEach(r => r.unregister());
  console.log('SW unregistered:', rs.length);
});
caches.keys().then(keys => {
  keys.forEach(k => caches.delete(k));
  console.log('Cache cleared:', keys);
});
// Luego hard-reload:
location.reload(true);
```

### Paso 3 — verificación

Abrir `agora.elenxos.com` en ventana incógnito y confirmar que la versión
nueva carga (revisar `<meta name="generator">` o un commit hash visible).

---

## 10. Maintenance mode (front en mantenimiento)

**Cuándo**: ventana de mantenimiento programada, migración de base de datos
en curso, o incidente mayor mientras se trabaja en él.

### Activar

Crear un deployment con bandera de mantenimiento. La forma más rápida es
una env var que el middleware/proxy del front consume:

```bash
printf 'true' | vercel env add NEXT_PUBLIC_MAINTENANCE_MODE production
vercel deploy --prod --yes
```

El proxy Next.js (`middleware.ts` / `proxy.ts`) intercepta toda request y
devuelve una página de mantenimiento estática, excepto para `/api/diag`
(que sigue respondiendo para monitoreo) y rutas de admin.

### Desactivar

```bash
vercel env rm NEXT_PUBLIC_MAINTENANCE_MODE production
vercel deploy --prod --yes
```

> Si `middleware.ts` no implementa esta lógica todavía, alternativa:
> aliasear `agora.elenxos.com` a un deployment estático con HTML "en
> mantenimiento" y volver al deployment real al terminar.

### Verificación

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://agora.elenxos.com
# Debe devolver 503 con MAINTENANCE_MODE=true; 200 sin él
```

---

## 11. Rotar WORKER_SECRET sin downtime

**Cuándo**: el secret se filtró o pasa el ciclo de rotación (90 días).

El sistema soporta rotación con `WORKER_SECRET_PREVIOUS` (el viejo se
acepta durante el período de gracia).

### Paso 1 — generar nuevo secret

```bash
openssl rand -hex 32
# guardar el valor de salida
```

### Paso 2 — distribuir como PREVIOUS (paso de gracia)

Configurar el secret VIEJO como `WORKER_SECRET_PREVIOUS` en todos los
consumidores:

```bash
# AgoraBack (Cloud Run)
gcloud run services update agora-backend \
  --region=us-central1 \
  --update-env-vars=WORKER_SECRET_PREVIOUS=<viejo>

# AgoraHub (humanizar2 → /etc/edu-hub/hub.env)
ssh nas ssh humanizar2 'sudo sed -i "s/^WORKER_SECRET_PREVIOUS=.*/WORKER_SECRET_PREVIOUS=<viejo>/" /etc/edu-hub/hub.env && systemctl --user restart edu-hub'

# Vercel (AgoraFront)
printf '<viejo>' | vercel env add WORKER_SECRET_PREVIOUS production
```

### Paso 3 — sustituir WORKER_SECRET por el nuevo en todos lados

```bash
# Mismo procedimiento que paso 2 pero con WORKER_SECRET=<nuevo>
# AgoraBack, AgoraHub, AgoraFront, daemon agora-host-sync, cada worker container
```

Para workers (re-crear con el secret nuevo):

```bash
ssh nas ssh humanizar2 'echo $SUDO_PASS | sudo -S edu-worker-manager update all'
```

### Paso 4 — verificación (24-48h de operación normal)

Monitorear logs del hub: no debe aparecer ningún "WORKER_SECRET_PREVIOUS fallback used"
en el período de gracia.

### Paso 5 — limpiar PREVIOUS

```bash
# Después del período de gracia, borrar WORKER_SECRET_PREVIOUS de todos lados
gcloud run services update agora-backend --region=us-central1 --remove-env-vars=WORKER_SECRET_PREVIOUS
vercel env rm WORKER_SECRET_PREVIOUS production
# etc.
```

---

## 12. Reanudar daemon agora-host-sync caído

**Cuándo**: archivos en `/workspace` no se reflejan en MinIO ni Firestore.
"No sincroniza" reportado por el user.

### Paso 1 — estado del daemon

```bash
ssh nas ssh humanizar2 'systemctl status agora-host-sync'
ssh nas ssh humanizar2 'tail -100 /home/humanizar/logs/agora-host-sync.log'
```

### Paso 2 — restart

```bash
ssh nas ssh humanizar2 'sudo systemctl restart agora-host-sync'
```

### Paso 3 — verificación

```bash
# Debe estar active (running)
ssh nas ssh humanizar2 'systemctl status agora-host-sync | head -5'

# Los logs deben mostrar ciclos cada 5s sin errores
ssh nas ssh humanizar2 'tail -f /home/humanizar/logs/agora-host-sync.log'
```

Tras 1-2 ciclos, hacer un cambio chico en un workspace y confirmar que
aparece en MinIO y Firestore. Para diagnóstico profundo, usar el comando
`/sync-status` del harness Claude o el agente `sync-debugger`.

---

## 13. Rotar Service Account Firebase (procedimiento real ejecutado)

**Cuándo**: la SA del proyecto `udea-filosofia` fue ejecutada y validada
end-to-end en la sesión 2026-05-11 (incidente: key con material corrupto
que rompía el hub). Documenta el flujo exacto, no la versión idealizada.

> Diferencia con §4: §4 cubre el caso "rotación con redeploy completo
> (Cloud Run + Vercel)". Esta sección documenta el caso "el hub necesita
> SA en `/opt/edu-hub/.env` o `/etc/edu-hub/hub.env` y no se enteró del
> Secret Manager".

### Paso 1 — generar nueva key

```bash
gcloud iam service-accounts keys create /tmp/firebase-sa-new.json \
  --iam-account=firebase-adminsdk-fbsvc@udea-filosofia.iam.gserviceaccount.com \
  --project=udea-filosofia
```

### Paso 2 — subir al Secret Manager

```bash
gcloud secrets versions add firebase-service-account \
  --data-file=/tmp/firebase-sa-new.json \
  --project=udea-filosofia
```

Verificar:

```bash
gcloud secrets versions list firebase-service-account --project=udea-filosofia --limit=3
```

### Paso 3 — sincronizar al hub (VM `agora-hub`)

El hub corre en `humanizar2` y lee la SA desde `/opt/edu-hub/.env` (o
`/etc/edu-hub/hub.env` según install). El Secret Manager NO se propaga
solo: hay que escribir el archivo.

```bash
# Copiar al host
scp /tmp/firebase-sa-new.json nas:/tmp/
ssh nas scp /tmp/firebase-sa-new.json humanizar2:/tmp/

# Reemplazar en .env del hub (cuidado: una sola línea, sin newline)
SA_JSON=$(jq -c . /tmp/firebase-sa-new.json | tr -d '\n')
ssh nas ssh humanizar2 "sudo sed -i \"s|^FIREBASE_SERVICE_ACCOUNT=.*|FIREBASE_SERVICE_ACCOUNT='${SA_JSON//\'/\\\'}'|\" /opt/edu-hub/.env"

# Restart del hub para que cargue
ssh nas ssh humanizar2 'systemctl --user restart edu-hub'
```

### Paso 4 — limpiar SA local

```bash
rm -f /tmp/firebase-sa-new.json
ssh nas 'rm -f /tmp/firebase-sa-new.json'
ssh nas ssh humanizar2 'rm -f /tmp/firebase-sa-new.json'
```

### Paso 5 — revocar key vieja

```bash
gcloud iam service-accounts keys list \
  --iam-account=firebase-adminsdk-fbsvc@udea-filosofia.iam.gserviceaccount.com \
  --project=udea-filosofia

gcloud iam service-accounts keys delete <KEY_ID_VIEJA> \
  --iam-account=firebase-adminsdk-fbsvc@udea-filosofia.iam.gserviceaccount.com \
  --project=udea-filosofia
```

### Verificación

```bash
# Hub responde y firma tokens con la SA nueva
ssh nas ssh humanizar2 'systemctl --user status edu-hub | head -10'
curl -s https://agora.elenxos.com/api/diag | python3 -m json.tool | grep firebase
```

Si el hub queda en `failed` revisar `journalctl --user -u edu-hub --since "5 min ago"` —
suele ser un escape mal hecho del JSON al sustituir en `.env`.

---

## 14. Backfill custom claims de workspaces

**Cuándo**: tras crear/migrar workspaces y antes de que Firebase Auth
emita tokens con el claim de membership. También cuando el trigger de
Cloud Function aún no está deployado y hay que sincronizar a mano.

El script lee `members/` y escribe `customClaims.workspaces` en cada user
afectado.

```bash
# Requiere SA local (no usa Secret Manager). NO subirla al repo.
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa.json

cd AgoraBack
node functions/scripts/backfill-claims.mjs

# Limpiar SA local apenas termine
rm -f /tmp/firebase-sa.json
```

### Verificación

El script imprime, por user, el `customClaims.workspaces` antes/después.
Spot-check de un user:

```bash
# Confirmar claims activos vía Admin SDK
gcloud firestore documents describe \
  --collection=users \
  --document=<uid> \
  --project=udea-filosofia
```

El próximo `getIdTokenResult({forceRefresh:true})` en el front trae los
claims nuevos (los users existentes deben re-login o llamar `forceRefresh`
explícito, sus tokens viejos no incluyen el claim).

### Observaciones encontradas en este corrido

- 2 uids huérfanos en `members/` que ya no existen en `users/` — el
  script los reporta y skipea. Listarlos para limpieza:
  ```bash
  node functions/scripts/backfill-claims.mjs --dry-run --report-orphans
  ```

---

## 15. Subir/bajar rate limit del agente IA

**Cuándo**: el agente está consumiendo demasiado crédito de proveedor
(LLM), o se quiere abrir más cuota para QA/demos. Se controla con la env
var `AGORA_AI_DAILY_TOKEN_BUDGET` en Cloud Run.

### Subir / bajar

```bash
# Bajar a 50k tokens/día por user (ej: tras spike)
gcloud run services update agora-backend \
  --region=us-central1 \
  --project=udea-filosofia \
  --update-env-vars=AGORA_AI_DAILY_TOKEN_BUDGET=50000

# Subir a 500k (ej: QA día completo)
gcloud run services update agora-backend \
  --region=us-central1 \
  --project=udea-filosofia \
  --update-env-vars=AGORA_AI_DAILY_TOKEN_BUDGET=500000
```

El cambio crea una nueva revision; el rate limit lo aplica el backend al
contador de tokens diarios persistido en Firestore
(`users/{uid}/agentUsage/daily-{YYYY-MM-DD}.tokens`).

### Verificación

```bash
# Revision activa muestra la env actualizada
gcloud run services describe agora-backend \
  --region=us-central1 --project=udea-filosofia \
  --format='value(spec.template.spec.containers[0].env)' | grep AGORA_AI_DAILY_TOKEN_BUDGET
```

Forzar un turn del agente y revisar que el header
`x-agora-ai-tokens-remaining` (o el campo equivalente en SSE) coincide
con el nuevo budget menos lo ya consumido.

---

## 16. Resetear contador diario de tokens de un user

**Cuándo**: un user específico chocó el rate limit (por tests, por bug
del agente, o por concesión manual). No reinicia el contador global,
sólo el suyo del día actual.

```bash
# UID del user objetivo
UID=<firebase-uid>
DAY=$(date -u +%Y-%m-%d)

gcloud firestore documents delete \
  --collection=users \
  --document="${UID}/agentUsage/daily-${DAY}" \
  --project=udea-filosofia
```

> Path es jerárquico: `users/{uid}/agentUsage/daily-{YYYY-MM-DD}`.
> El backend recrea el doc en el próximo tool call con `tokens=0`.

### Alternativa segura (no destructiva) — set a un valor concreto

```bash
# Setear `tokens` a 0 sin borrar el doc (preserva otros campos como expiresAt)
echo '{"fields":{"tokens":{"integerValue":"0"}}}' | \
  gcloud firestore documents patch \
    --collection=users \
    --document="${UID}/agentUsage/daily-${DAY}" \
    --update-mask=tokens \
    --project=udea-filosofia \
    --data-file=-
```

### Verificación

Próximo tool call del agente con ese user devuelve `tokens-remaining` =
budget completo.

---

## 17. Forzar update del Service Worker en clientes existentes (PWA)

**Cuándo**: deploy de PWA con cambios en el SW (precache, runtime
caching, scope) y los clientes existentes siguen viendo la versión
vieja porque el SW se actualiza en segundo plano y sólo activa al cerrar
todas las pestañas.

### Snippet para pegar en la consola del browser del user

```javascript
navigator.serviceWorker.getRegistrations().then(rs => {
  rs.forEach(r => r.unregister());
  console.log('SW unregistered:', rs.length);
});
caches.keys().then(ks => {
  ks.forEach(k => caches.delete(k));
  console.log('Cache cleared:', ks);
});
// Hard reload tras limpiar:
setTimeout(() => location.reload(true), 500);
```

### Fuerza de servidor (próximo deploy)

Si el SW del front respeta `skipWaiting` y `clients.claim()`, basta con
hacer el deploy nuevo: el SW nuevo se activa al primer reload. Si no, se
queda en `waiting` indefinidamente y los clientes deben pasar por el
snippet de arriba.

Para asegurar que el siguiente deploy aplique automáticamente, confirmar
en `AgoraFront/public/sw.js` (o el manifest generado por el plugin PWA):

```javascript
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => clients.claim());
```

### Verificación

```bash
# El service worker servido debe tener el commit hash nuevo
curl -s https://agora.elenxos.com/sw.js | head -20
```

En DevTools del browser: Application → Service Workers → `activated and
running` con la versión nueva. No debe quedar ninguno `redundant`.

---

## 18. Activar TTL automático en `users/{uid}/agentUsage`

**Cuándo**: la colección `agentUsage` crece sin podar (un doc por user
por día). TTL evita scripts de limpieza manual.

> **Acción pendiente del user** — la policy se crea desde la consola
> Firestore, no hay gcloud directo todavía. Documentar para no olvidar.

### Pasos en consola

1. Firebase Console → Firestore → Time-to-live (TTL).
2. Click "Crear regla".
3. Collection group: `agentUsage`.
4. Campo TTL: `expiresAt`.
5. Crear.

El backend ya escribe `expiresAt` = `now + 90d` cuando crea/actualiza
el doc diario; cuando la policy esté activa, Firestore borra esos docs
automáticamente al pasar `expiresAt`.

### Verificación

```bash
# Consultar la policy (gcloud firestore admin)
gcloud firestore field ttl describe agentUsage.expiresAt \
  --collection-group=agentUsage \
  --project=udea-filosofia
```

Estado debe ser `ACTIVE`. La primera limpieza tarda hasta 24h tras crear
la policy.

---

## 19. Cerrar / reabrir puerto raw 3010 del hub

**Cuándo**: hoy el puerto **3010** está cerrado en GCP firewall — todo
tráfico al hub pasa por TLS via `agora.elenxos.com` (Caddy en la VM).
Reabrirlo solo si hay un cliente legacy que aún apunta raw.

### Reabrir (emergencia)

```bash
gcloud compute firewall-rules create allow-hub-3010 \
  --project=udea-filosofia \
  --network=default \
  --direction=INGRESS \
  --priority=1000 \
  --action=ALLOW \
  --rules=tcp:3010 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=agora-hub
```

> **Riesgo**: expone socket.io sin TLS. Sólo abrir para diagnóstico
> puntual; cerrar inmediatamente después.

### Cerrar

```bash
gcloud compute firewall-rules delete allow-hub-3010 \
  --project=udea-filosofia --quiet
```

### Verificación

```bash
# Lista de reglas activas
gcloud compute firewall-rules list \
  --project=udea-filosofia \
  --filter='name~allow-hub-3010'

# Confirmar que el endpoint TLS sigue OK (no debe verse afectado)
curl -sI https://agora.elenxos.com/api/diag
```

Para conectarse al hub desde dev local sin abrir el puerto, hacer port-
forward via NetBird o SSH tunnel:

```bash
ssh nas ssh -L 3010:127.0.0.1:3010 humanizar2 -N
```

---

## 20. Disparar backfill del citation graph manual

**Cuándo**: workspaces con `citation_graph` vacío que necesitan ser
populados sin esperar al cron diario. También útil para QA del módulo
de grafo.

### Disparo del job de Cloud Scheduler

```bash
gcloud scheduler jobs run citations-backfill-daily \
  --location=us-central1 \
  --project=udea-filosofia
```

### Verificación

```bash
# Ver últimas ejecuciones del job
gcloud logging read 'resource.type="cloud_scheduler_job" AND resource.labels.job_id="citations-backfill-daily"' \
  --project=udea-filosofia --limit=5 \
  --format='value(timestamp,severity,httpRequest.status)'

# Confirmar que la edge collection se pobló
gcloud firestore documents list \
  --collection=concept-edges \
  --project=udea-filosofia --limit=10
```

### Observación pendiente (2026-05-11)

En el sweep de la sesión `concept-edges` aparece **vacío** en
`udea-filosofia`. Hay dos hipótesis abiertas:

1. El módulo no está activo en backend (feature flag o env var).
2. El job corre pero el path de escritura es otro (`citationEdges/`,
   `graph/edges/`, etc.).

Próximo paso sugerido: leer `AgoraBack/src/jobs/citations-backfill*.ts`
y confirmar el path real antes de declarar el cron "deployado y
funcionando".

---

## 21. Reload de Caddy en la VM del hub

**Cuándo**: cambio en el `Caddyfile` (nuevo dominio, ajuste de proxy,
header) y necesitamos aplicarlo sin restart completo.

```bash
gcloud compute ssh agora-hub --zone=us-central1-a --project=udea-filosofia \
  --command='sudo systemctl reload caddy'
```

> `reload` reaplica config sin tirar conexiones. Si `caddy validate` da
> error de sintaxis, el reload aborta y el daemon viejo sigue corriendo.

### Verificación

```bash
gcloud compute ssh agora-hub --zone=us-central1-a --project=udea-filosofia \
  --command='sudo systemctl status caddy | head -15'

# Endpoint público responde con cert nuevo
curl -sI https://agora.elenxos.com | head -5
```

Si Caddy queda en `failed`, restart completo:

```bash
gcloud compute ssh agora-hub --zone=us-central1-a --project=udea-filosofia \
  --command='sudo systemctl restart caddy && sudo journalctl -u caddy --since "1 min ago"'
```

---

## Notas operacionales

- **Siempre confirmar con el user** antes de cualquier acción destructiva
  (rollback, restore, restart masivo).
- **Verificar evidencia** después de cada acción: no asumir éxito sin
  curl/log que lo confirme.
- **Secrets**: ver `AgoraFront/.claude/secrets.md`. Nunca pegar en este
  documento.
- **Convenciones de SSH**: `ssh nas` (jump host NAS) → `ssh humanizar2`
  (host activo). Las claves SSH ya están configuradas.
- Para diagnóstico amplio sin contexto previo, usar `/diag` (harness
  Claude) que ejecuta health check por capa.

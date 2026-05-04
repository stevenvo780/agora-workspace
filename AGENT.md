# CLAUDE.md — guía de trabajo para Claude en el workspace Agora

> Este archivo está en la raíz del workspace local (`EducacionCooperativa/`).
> Léelo al empezar cada sesión: te orienta entre los 7 repos y las 4 capas
> de despliegue. Las credenciales y URLs sensibles **no** están aquí — viven
> en `AgoraFront/.claude/secrets.md` (gitignored).

## 1. Qué es Agora

Plataforma educativa colaborativa con 3 superpoderes:
1. **Editor MDX rico** (LaTeX, Mermaid, kanban, snippets, glosario semántico).
2. **Lógica formal**: editor `.st` con 11 perfiles lógicos, formalizador
   automático, mesa semántica, linter académico.
3. **Terminal de trabajo por workspace**: cada usuario tiene un container
   Docker con `/workspace` montado y sincronizado contra MinIO + Firestore.

Usuarios objetivo: estudiantes y docentes; también devs que quieren web +
terminal + git en un solo lugar.

## 2. Estructura local del workspace

```
EducacionCooperativa/                    ← este wrapper local (NO repo git)
├── AgoraFront/   stevenvo780/EducacionCooperativa  ← Next.js / Vercel
├── AgoraBack/    stevenvo780/agora-backend         ← Express / Cloud Run
├── AgoraHub/     stevenvo780/agora-hub             ← socket.io / stev-server
├── AgoraWorker/  stevenvo780/agora-worker          ← Docker / DockerHub
├── AgoraCli/     stevenvo780/agora-cli             ← CLI local (sin publicar)
├── ST/           stevenvo780/ST                    ← npm @stevenvo780/st-lang
├── Autologic/    stevenvo780/auto.logic            ← npm @stevenvo780/autologic
├── README.md
└── CLAUDE.md     ← este archivo
```

Cada subdirectorio es un repo git independiente. **Cuando navegues, primero
identifica en qué repo estás trabajando** (`pwd` te lo dice).

## 3. Stack y arquitectura

```
Browser
  ↓
agora.elenxos.com (Vercel — AgoraFront)
  ├─ páginas Next.js + auth (Firebase Auth)
  └─ llamadas API vía NEXT_PUBLIC_API_BASE_URL
                                              ▼
                                        Cloud Run (AgoraBack)
                                          ├─ /api/* Express + route handlers estilo Next
                                          ├─ /api/agora-ai/stream
                                          ├─ tools del agente ejecutadas en Back
                                          └─ Firestore + MinIO + Forgejo + Hub/workers

stev-server  (NetBird 100.98.8.227)
  ├─ AgoraHub (edu-hub.service user) — socket.io 3010
  ├─ agora-host-sync.service — daemon que sincroniza workers ↔ NAS
  └─ ~27 containers edu-worker-<wsId> (imagen stevenvo780/edu-worker:latest)

NAS  (NetBird 100.98.67.189)
  ├─ MinIO (S3-compatible)        bucket agora-blobs
  ├─ Forgejo (Git)                 org "agora", 1 repo por workspace
  ├─ Postgres 17                   (preflight para migraciones futuras)
  └─ Firebase Auth + Firestore + RTDB (proyecto udea-filosofia, no en el NAS)
```

### Reglas críticas de la arquitectura (no romper)
- Payload RTDB DEBE incluir `timestamp` (no sólo `ts`), `type`, `source`
  para que `useSyncEvents` lo capte. Ver `AgoraFront/src/lib/nas-events.ts`.
- `firebase-admin` necesita `databaseURL` o los pings fallan en silencio.
  Ver `AgoraFront/src/lib/firebase-admin.ts`.
- Personal workspace usa canal RTDB `sync-events/personal_<uid>`,
  **NO** `sync-events/personal`.
- `WORKER_SECRET` es **idéntico** y **sin newline** en: AgoraBack, AgoraHub,
  cada worker container y el daemon `agora-host-sync`. Si lo cargas desde
  shell usa `printf` (no `echo`).
- `BACKEND_INTERNAL_SECRET`/`HUB_INTERNAL_SECRET` protege el endpoint interno
  `/api/agora-ai/internal/execute-tool`, que hoy queda como compatibilidad:
  el stream principal ejecuta tools directamente dentro de AgoraBack.
- El daemon de sync trackea `{ localHash, remoteHash }` por path. **NO**
  simplificar a un solo hash — eso causó un loop de re-pull histórico.

## 4. Despliegues

### AgoraFront (Vercel) — DEPLOY MANUAL ÚNICAMENTE

> **Importante**: el auto-deploy via `git push` está roto desde 2026-05-04
> porque AgoraFront consume `@agora/contracts`, `@stevenvo780/st-lang` y
> `@stevenvo780/autologic` con `file:../...` y Vercel hace build aislado
> sin acceso a esos paths hermanos. Cada `git push` a master genera un
> deploy "Error" que NO afecta el alias actual pero ensucia el historial.

Flujo manual obligatorio:
```bash
cd AgoraFront
node scripts/prepare-deploy.mjs              # empaqueta deps file:../* a tarballs
npm install --no-audit --no-fund             # resuelve tarballs locales
vercel pull --yes --environment=production   # solo si .vercel/ no está pulled
vercel build --prod --yes                    # build local en .vercel/output/
vercel deploy --prebuilt --prod --yes        # despliega lo prebuilt
# captura el deployment-url devuelto y aliasea:
vercel alias set <visormarkdown-XXX>-stevenvo780s-projects.vercel.app agora.elenxos.com
node scripts/prepare-deploy.mjs restore      # restaura package.json + lockfile
```

Tras tocar env vars Vercel:
```bash
printf 'valor-sin-newline' | vercel env add NOMBRE production
# requiere redeploy manual (no auto) para que las funciones la lean
```

Limpiar deploys Error en historial:
```bash
vercel remove <deployment-url> --safe --yes
```

### AgoraBack (Cloud Run, proyecto GCP `udea-filosofia`)
```bash
cd AgoraBack
node scripts/prepare-deploy.mjs              # empaqueta @agora/contracts + ST + Autologic
gcloud run deploy agora-backend --source . --region us-central1
node scripts/prepare-deploy.mjs restore      # restaura package.json + lockfile
# blue/green automático; revision nueva recibe tráfico al pasar health check
```

URL del servicio: `https://agora-backend-578238159459.us-central1.run.app`.
Health: `curl <URL>/health` debe responder `{"status":"ok"}`.

Secrets cableados (no tocar a menos que sea necesario):
- `HUB_INTERNAL_SECRET` (Secret Manager `hub-internal-secret`) → leído al boot.
- IAM bindings: `secretmanager.secretAccessor`, `datastore.user`,
  `firebase.sdkAdminServiceAgent` para la SA `<projectNumber>-compute@`.

### AgoraHub (stev-server)
```bash
cd AgoraHub
npm run build
# desde AgoraWorker/desplieges-prod/ (donde viven los scripts):
cd ../AgoraWorker/desplieges-prod
./deploy_hub.sh
```

Internamente: `scp dist/index.js` al stev-server, mover a
`/home/stev/edu-hub/dist/`, `systemctl --user restart edu-hub`. Health
local: `curl http://127.0.0.1:3010/health`.

### AgoraWorker (DockerHub + stev-server)
```bash
cd AgoraWorker/worker
docker build -t stevenvo780/edu-worker:latest .
docker push stevenvo780/edu-worker:latest
# en stev-server:
ssh nas 'ssh stev@stev-server "echo PASS | sudo -S edu-worker-manager update all"'
```

`edu-worker-manager update all` recrea los ~27 containers con la imagen
nueva. Cada worker se reconecta al hub en <5s.

## 5. Operación de la infraestructura

Acceso a hosts y servicios: **`AgoraFront/.claude/secrets.md`** (gitignored).

Hosts:
- **NAS** — `nas@100.98.67.189` (NetBird). Hostea MinIO, Forgejo, Postgres,
  filebrowser. `docker exec agora-{minio,forgejo,...}` para acción directa.
- **stev-server** — `stev@100.98.8.227` (NetBird) o LAN fallback. Hostea
  workers Docker, daemon `agora-host-sync` y el `edu-hub`. Acceso por
  jump host (NAS): `ssh nas ssh stev-server '...'`.
- **GCP** — proyecto `udea-filosofia` (mismo que Firebase). `gcloud auth
  login` ya está; `gcloud config set project udea-filosofia` por defecto.

Comandos diagnóstico frecuentes:
```bash
# Estado del daemon de sync
ssh nas ssh stev-server 'systemctl status agora-host-sync'
ssh nas ssh stev-server 'tail -50 /home/stev/logs/agora-host-sync.log'

# Estado del hub
ssh nas ssh stev-server 'systemctl --user status edu-hub'
ssh nas ssh stev-server 'curl -s http://127.0.0.1:3010/health'

# Workers
ssh nas ssh stev-server 'docker ps --filter name=edu-worker --format "table {{.Names}}\t{{.Status}}"'

# Bucket MinIO (creds en secrets.md):
ssh nas 'docker exec agora-minio mc ls --recursive adm/agora-blobs/ | head'

# Health pública del Hub (Vercel)
curl -s https://agora.elenxos.com/api/diag | python3 -m json.tool

# Cloud Run logs últimos eventos
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="agora-backend"' --limit 10 --order=desc --format='value(timestamp,httpRequest.status,textPayload)'
```

## 6. Workers — comportamiento conocido

- Docker 28.2.2 en stev-server crashea ocasionalmente con un bug HTTP/2
  (`golang.org/x/net/http2.(*Framer).ReadFrame`). Cuando crashea, todos los
  workers reciben SIGTERM→SIGKILL. `agora-host-sync` los revive en el
  siguiente ciclo (cada 5s).
- El handler `agent-command` del worker (en `AgoraWorker/worker/index.js`)
  valida con whitelist (~40 binarios seguros). Si el agente IA pide un
  comando fuera de la whitelist, responde `binary "x" no está en la whitelist`.
- Para añadir un worker manualmente sin sudo: replica `docker run` con
  `--network=host`, `--user=estudiante`, mounts en
  `/home/stev/edu-worker/...`, env igual a otro worker pero con
  `WORKER_TOKEN=<wsId>`.
- Existe `edu-worker-manager add <wsId>` que requiere sudo.

## 7. Cómo me suele pedir el user las cosas

- Español, casual, con typos, mensajes largos. Reproducible.
- Quiere **rigor**: si reporto "funciona" debe estar verificado en
  producción con evidencia (logs, queries reales). Nunca asumir.
- Detecta cuando soy "indulgente conmigo mismo" — me llama la atención y
  con razón. Si un test falla, no lo escondo: lo investigo a fondo.
- Pide que le proponga acciones cuando hay decisiones (no las tome solo).
  Para acciones destructivas en infra, **siempre** confirmar antes.
- Le gustan commits pequeños con mensaje claro. Mensajes en español,
  primera línea ≤72 chars, body explica el *por qué*.
- Suele cerrar la frase con propuesta para próxima iteración. No abro
  nuevas iteraciones por iniciativa propia salvo continuación obvia.
- Cuando un cambio rompe algo en otra capa (sync vs UI vs server) lo dice
  directo: "ya no funciona como antes". Tomarlo como señal de regresión.
- Si pregunta algo amplio ("revisa bugs"), audito en serio: leo logs
  reales, ejecuto tests, no salgo con un "todo bien" sin evidencia.

## 8. Convenciones de código

- TypeScript strict en todos los repos. Nunca `any` salvo cast puntual.
- Componentes React `'use client'` cuando hace falta. Server actions /
  route handlers en App Router.
- **Comentarios**: solo cuando el *por qué* no es obvio. Nunca `OPT:`,
  `ARQUITECTURA:`, `v2 (...)`, "este código antes hacía X". El user los
  detesta — limpian la intención del código.
- Sin docs `.md` autogenerados a menos que el user los pida.
- Tests unitarios en `tests/` con vitest. Playwright para E2E (rara vez).
- Para logs server: `console.warn`/`console.error` con `[scope] mensaje`.
- En **AgoraFront/AgoraBack**: contratos de borde compartidos en
  `@agora/contracts`; cualquier dato que cruza red/disco debe validarse con
  schema/parser, no con `as Tipo` directo en el borde.
- En **AgoraBack**: el agente ejecuta tools con `executeAgentTool` dentro del
  propio backend. El endpoint `/api/agora-ai/internal/execute-tool` existe como
  compatibilidad protegida, no como ruta principal del stream.

## 9. Lo que NO hacer

- Nunca subir secretos al repo. `AgoraFront/.claude/secrets.md` está
  gitignored. Si aparece en `git status` algo similar, **detenerse**.
- Nunca destructivo en infra sin confirmar (`docker rm`, `mc rm` masivo,
  `git push --force`, borrar workspace, `gcloud run services delete`).
- No re-introducir defaults agresivos (`.syncignore` con `node_modules/`)
  que se imponen al user. El daemon trae unos pocos hard-coded
  (vim swap, `.DS_Store`); el resto va por el `.syncignore` editable.
- No cantar victoria sin verificar. Si una verificación tiene timing,
  espera el ciclo completo o mete polling.
- No mover archivos entre repos sin commitear en ambos lados.

## 10. Tareas pendientes recurrentes

Si reaparecen, comunicar al user:

- **Retirar las rutas bare deprecated** de AgoraBack cuando pase el sunset
  (`BARE_API_ROUTES_SUNSET`, default 2026-08-01). Hasta entonces deben
  responder con `Deprecation`, `Sunset` y `Link rel="canonical"`.
- **Docker daemon** crashes recurrentes en stev-server — recomendar
  `apt upgrade docker-ce` cuando haya ventana de mantenimiento.
- **MinIO basura histórica** (~32 objetos en raíz) — no afecta nada
  pero ensucia.
- **Vulnerabilidades npm** en Front/Hub/Worker/Autologic — priorizar
  critical/high y validar con tests de smoke por servicio.
- **`MERCADOPAGO_WEBHOOK_SECRET`** debe estar en producción de AgoraBack:
  el webhook hace fail-closed sin secret.
- **`noUncheckedIndexedAccess`** activado en el slice de contratos/lib/tipos
  de AgoraFront vía `tsconfig.contracts.json`. Habilitarlo en todo descubre
  muchos errores reales — migración aparte.

### Resueltos (no perseguir)
- ~~Storage usage en Firebase Storage~~ → migrado: lee `size` de Firestore.
- ~~Outbox sin drainer~~ → `/api/cron/drain-outbox` cada 5min.
- ~~Workspace personal sync rechazado~~ → `isPersonalWorkspaceId` +
  `userId` en HMAC en todos `/api/sync/*`.
- ~~Stream agente caía con cap 15min Vercel~~ → migrado a Cloud Run con
  budget 760s + truncated:true gracioso.
- ~~Mono-repo gigante~~ → split a 7 repos con historial preservado
  (`git filter-repo`).

## 11. Archivos que casi nunca tocar

- `AgoraFront/src/generated/*` — regenerados por scripts. Si aparecen
  modificados sin haberlos pedido: `git checkout -- src/generated/`.
- `AgoraFront/src/components/mosaic-editor/` y `MosaicEditor.tsx` — el
  editor MDX es delicado. Cambios chicos OK; refactor grande pedirlo.
- `AgoraWorker/worker/build/` — artefactos de empaquetado.
- `ST/dist/`, `Autologic/dist/` — outputs npm publish, regenerables.

## 12. Notas sobre los repos hermanos

### ST y Autologic
Son librerías npm publicadas (`@stevenvo780/st-lang`, `@stevenvo780/autologic`).
AgoraFront las consume vía `package.json`. Si el user pide cambios al
runtime ST o al formalizador, trabajalos en sus repos respectivos y
luego `npm publish` + `npm update` en AgoraFront.

### AgoraCli
Aún no publicado. Vive en su propio repo para que en el futuro `npm i -g
@stevenvo780/agora-cli` funcione. Por ahora se ejecuta con `node src/index.mjs`.

### AgoraHub vs AgoraWorker
Comparten el `WORKER_SECRET` para HMAC. Si tocas el protocolo
socket.io entre ambos, **actualiza ambos** y ten cuidado con el orden de
deploy: hub primero (acepta clientes nuevos y viejos un rato), luego
workers.

### AgoraBack interno
`BACKEND_INTERNAL_SECRET` (fallback: `HUB_INTERNAL_SECRET`) protege el endpoint
interno de tools. Si lo rotas, actualiza el secreto de AgoraBack antes de
redeployar cualquier consumidor de compatibilidad.

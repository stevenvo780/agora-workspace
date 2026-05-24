# CLAUDE.md — guía de trabajo para Claude en el workspace Agora

> Este archivo está en la raíz del workspace local (`EducacionCooperativa/`).
> Léelo al empezar cada sesión: te orienta entre los 7 repos y las 4 capas
> de despliegue. Las credenciales y URLs sensibles **no** están aquí — viven
> en `AgoraFront/.claude/secrets.md` (gitignored).

## 1. Qué es Agora

Plataforma educativa colaborativa con 3 superpoderes:
1. **Editor MDX rico** (LaTeX, Mermaid, kanban, snippets, glosario semántico).
2. **Lógica formal**: editor `.st` con 11 perfiles lógicos, formalizador
   automático, mesa semántica, linter académico. Rutas: `/st-playground-v3`
   (AI co-pilot 3 columnas) y `/st-notebook` (cells code+markdown, persistencia
   Firestore `users/{uid}/notebooks`).
3. **Terminal de trabajo por workspace**: cada usuario tiene un container
   Docker con `/workspace` montado y sincronizado contra MinIO + Firestore.

Ecosistema ST publicado (independiente de Agora):
- `@stevenvo780/st-mcp@0.1.0` — MCP server, 4 tools: check/derive/countermodel/formalize
- `@stevenvo780/st-cli@0.1.0` — CLI, 6 subcomandos: check/derive/countermodel/formalize/export/repl
- `vscode-st@0.1.0.vsix` — Extensión VSCode (LSP + grammar + snippets). Build local; marketplace pendiente PAT Azure.
- GitHub Action `verify-st-claims-v1` — `.github/actions/verify-st-claims/` en repo ST.

Usuarios objetivo: estudiantes y docentes; también devs que quieren web +
terminal + git en un solo lugar.

## 2. Estructura local del workspace

```
EducacionCooperativa/                    ← este wrapper local (NO repo git)
├── AgoraFront/   stevenvo780/EducacionCooperativa  ← Next.js / Vercel
├── AgoraBack/    stevenvo780/agora-backend         ← Express / Cloud Run
├── AgoraHub/     stevenvo780/agora-hub             ← socket.io / agora-storage VPS
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
                                          ├─ /api/agora-ai/stream (rate-limit + chats persistidos)
                                          ├─ tools del agente ejecutadas en Back
                                          └─ Firestore + MinIO + Forgejo + Hub/workers

agora-storage  (Hostinger VPS, IP 76.13.118.239, Ubuntu 24.04, 2 CPU AMD EPYC, 8 GB RAM)
  Dominios: s3.elenxos.com · git.elenxos.com · hub.elenxos.com
  ├─ Caddy (TLS Let's Encrypt automático)
  ├─ edu-hub systemd (socket.io puerto 3010, user no-root edu-hub)
  └─ Docker Compose (/opt/agora-stack/):
     ├─ agora-minio   (MinIO S3, bucket agora-blobs, ~3909 objetos)
     ├─ agora-forgejo (Forgejo v11, 13 repos org "agora")
     └─ agora-postgres (Postgres 17, DB forgejo)

humanizar2  (NetBird 100.98.5.11, user `humanizar`) — MUERTO FÍSICAMENTE (2026-05-24)
  Migración a nuevo server: PENDING (el user gestiona hardware).
  Workers offline hasta que el nuevo host esté disponible.
  ├─ agora-host-sync.service — daemon de sync (offline)
  └─ ~35 containers edu-worker-<wsId> — OFFLINE hasta migración

Firebase Auth + Firestore + RTDB (proyecto udea-filosofia)
  Service Account rotada (Secret Manager v3 activa, v1/v2 disabled)

NAS (NetBird 100.98.67.189) — RETIRADO de producción. Mantener apagado.
agora-hub (GCP Compute Engine us-central1) — RETIRADO (apagado tras migración a Hostinger).
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
- `NEXUS_URL` debe estar seteado en AgoraBack (Cloud Run) para que las
  tools del agente que llaman al worker (`run_command`, `read_file`,
  `write_file`, etc.) sepan a dónde apuntar. Default real:
  `https://hub.elenxos.com`.
- Daemon `agora-host-sync` ignora `.scratch/`, `.agent-tmp/`, `tmp-*`,
  `*.tmp` (Bug I-2 Opción B). Si añadís hard-coded patterns, NO te
  pases — el `.syncignore` editable del workspace debe seguir mandando.
- Vault de API keys del agente IA (`users/{uid}/agentSecrets/{provider}`)
  cifra con AES-256-GCM/HKDF derivado de `WORKER_SECRET`. Rotar el secret
  invalida todas las keys guardadas — coordinarlo con el user.

## 4. Despliegues

### AgoraFront (Vercel)

Desde el split a 7 repos (commit `858d0ec`), AgoraFront consume
`@agora/contracts`, `@stevenvo780/st-lang` y `@stevenvo780/autologic`
desde el registro npm — ya **no** hay deps `file:../*` y por tanto el
script histórico `scripts/prepare-deploy.mjs` fue eliminado. El deploy
es un único comando:

```bash
cd AgoraFront
npm run typecheck && npm run build           # sanity local antes de subir
vercel deploy --prod --yes                   # build + deploy en Vercel
# si el proyecto NO tiene production aliasing automático, aliasea manualmente:
vercel alias set <visormarkdown-XXX>.vercel.app agora.elenxos.com
```

`vercel deploy --prod` devuelve `Production: https://visormarkdown-…vercel.app`
y `Aliased: https://agora.elenxos.com` cuando el alias automático está
configurado.

Tras tocar env vars Vercel:
```bash
printf 'valor-sin-newline' | vercel env add NOMBRE production
# requiere redeploy (no se aplica en caliente) para que las funciones la lean.
```

Limpiar deploys Error del historial:
```bash
vercel remove <deployment-url> --safe --yes
```

### AgoraBack (Cloud Run, proyecto GCP `udea-filosofia`)

Mismo principio: `@agora/contracts`, ST y Autologic vienen de npm, sin
empaquetado previo. Deploy directo:

```bash
cd AgoraBack
npm run typecheck
gcloud run deploy agora-backend --source . --region us-central1
# blue/green automático; revision nueva recibe tráfico al pasar health check
```

URL del servicio: `https://agora-backend-578238159459.us-central1.run.app`.
Health: `curl <URL>/health` debe responder `{"status":"ok"}`.

Secrets cableados (no tocar a menos que sea necesario):
- `HUB_INTERNAL_SECRET` (Secret Manager `hub-internal-secret`) → leído al boot.
- IAM bindings: `secretmanager.secretAccessor`, `datastore.user`,
  `firebase.sdkAdminServiceAgent` para la SA `<projectNumber>-compute@`.

### AgoraHub (Hostinger VPS `agora-storage`)
```bash
cd AgoraHub
npm run build
# desde AgoraWorker/desplieges-prod/ (donde viven los scripts):
cd ../AgoraWorker/desplieges-prod
./deploy_hub.sh
```

Internamente: `scp dist/index.js` al VPS `76.13.118.239` (root via SSH key),
mover a `/opt/edu-hub/dist/`, `systemctl restart edu-hub` (user `edu-hub`
no-root via systemd).

Health: `curl https://hub.elenxos.com/health` (Caddy frente al
3010, `protocols h1` only por engine.io). El firewall raw 3010 está
cerrado; solo 443 acepta tráfico externo.

> Migración 2026-05: el hub vivía en VM GCP `agora-hub` (e2-micro).
> Hoy corre en Hostinger VPS `agora-storage` junto a MinIO y Forgejo.
> `humanizar2` (host de workers) murió físicamente el 2026-05-24.
> Workers offline hasta que el user migre a nuevo hardware.
> Cuando el nuevo host esté listo, los workers reconectarán con `NEXUS_URL=https://hub.elenxos.com`.

### AgoraWorker (DockerHub + humanizar2)

> **ESTADO (2026-05-24): humanizar2 muerto físicamente. Workers offline.**
> Imagen publicada en DockerHub; deploy pendiente hasta que el user provea nuevo host.

```bash
cd AgoraWorker/worker
docker build -t stevenvo780/edu-worker:latest .
docker push stevenvo780/edu-worker:latest
# cuando haya nuevo host (reemplaza humanizar2):
ssh <nuevo-host> 'echo PASS | sudo -S edu-worker-manager update all'
```

`edu-worker-manager update all` recrea los containers con la imagen
nueva. Cada worker se reconecta al hub en <5s.

## 5. Operación de la infraestructura

Acceso a hosts y servicios: **`AgoraFront/.claude/secrets.md`** (gitignored).

Hosts:
- **agora-storage** — `root@76.13.118.239` (Hostinger VPS, SSH key). Hostea
  MinIO (`s3.elenxos.com`), Forgejo (`git.elenxos.com`), AgoraHub
  (`hub.elenxos.com`) y Postgres 17. Docker Compose en `/opt/agora-stack/`.
  `docker compose -f /opt/agora-stack/docker-compose.yml exec agora-minio ...`
  para acción directa. Primario de producción.
- **humanizar2** — MUERTO FÍSICAMENTE (2026-05-24). Workers y daemon
  `agora-host-sync` offline. Migración a nuevo hardware: PENDING (el user gestiona).
  No intentar conectar hasta que el user confirme nuevo host.
- **GCP** — proyecto `udea-filosofia` (mismo que Firebase). `gcloud auth
  login` ya está; `gcloud config set project udea-filosofia` por defecto.
  Cloud Run para AgoraBack.
- **NAS** (`nas@100.98.67.189`) y **agora-hub** (GCP `34.72.204.171`) —
  RETIRADOS de producción. Mantener apagados. Ver historial en git.

Comandos diagnóstico frecuentes:
```bash
# Estado del daemon de sync (humanizar2 OFFLINE — skip hasta nueva migración)
# ssh humanizar2 'systemctl status agora-host-sync'
# ssh humanizar2 'tail -50 /home/humanizar/logs/agora-host-sync.log'

# Estado del hub (Hostinger VPS)
ssh root@76.13.118.239 'systemctl status edu-hub'
curl -s https://hub.elenxos.com/health

# Workers OFFLINE (humanizar2 muerto) — cuando haya nuevo host, actualizar alias
# ssh <nuevo-host> 'docker ps --filter name=edu-worker --format "table {{.Names}}\t{{.Status}}"'

# Bucket MinIO (creds en secrets.md):
ssh root@76.13.118.239 'docker compose -f /opt/agora-stack/docker-compose.yml exec agora-minio mc ls --recursive adm/agora-blobs/ | head'

# Health pública del Hub (Vercel)
curl -s https://agora.elenxos.com/api/diag | python3 -m json.tool

# Cloud Run logs últimos eventos
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="agora-backend"' --limit 10 --order=desc --format='value(timestamp,httpRequest.status,textPayload)'
```

## 6. Workers — comportamiento conocido

> **humanizar2 MUERTO (2026-05-24). Workers offline. Sección preservada para
> cuando el user migre a nuevo hardware.**

- Docker 28.2.2 crasheaba ocasionalmente con bug HTTP/2
  (`golang.org/x/net/http2.(*Framer).ReadFrame`). Al migrar a nuevo host,
  evaluar actualizar a Docker más reciente antes de arrastrar este problema.
- El handler `agent-command` del worker (en `AgoraWorker/worker/index.js`)
  valida con whitelist (~40 binarios seguros). Si el agente IA pide un
  comando fuera de la whitelist, responde `binary "x" no está en la whitelist`.
- Para añadir un worker manualmente sin sudo: replica `docker run` con
  `--network=host`, `--user=estudiante`, mounts en
  `/home/<nuevo-host>/edu-worker/...`, env igual a otro worker pero con
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

- **Migración workers a nuevo hardware** — humanizar2 muerto. El user gestiona
  nuevo host. Cuando esté listo: instalar Docker, `edu-worker-manager`, imagen
  `stevenvo780/edu-worker:latest`, y `agora-host-sync` daemon. Actualizar
  `NEXUS_URL` y secrets. Workers ofline mientras tanto.
- **vscode-st marketplace** — `vscode-st@0.1.0.vsix` build local listo. Falta
  PAT Azure para publicar en VS Code Marketplace (el user lo gestiona).
- **Retirar las rutas bare deprecated** de AgoraBack cuando pase el sunset
  (`BARE_API_ROUTES_SUNSET`, default 2026-08-01). Hasta entonces deben
  responder con `Deprecation`, `Sunset` y `Link rel="canonical"`.
- **MinIO basura histórica** (~32 objetos en raíz) — no afecta nada
  pero ensucia.
- **Vulnerabilidades npm** en Front/Hub/Worker/Autologic — priorizar
  critical/high y validar con tests de smoke por servicio.
- **`MERCADOPAGO_WEBHOOK_SECRET`** debe estar en producción de AgoraBack:
  el webhook hace fail-closed sin secret.
- ~~`noUncheckedIndexedAccess` solo en slice de contratos/lib~~ → ya está
  global en `tsconfig.json` (commits `84b6d51` + `f5cdce7`). typecheck limpio.

### Resueltos (no perseguir)
- ~~Storage usage en Firebase Storage~~ → migrado: lee `size` de Firestore.
- ~~Outbox sin drainer~~ → `/api/cron/drain-outbox` cada 5min.
- ~~Workspace personal sync rechazado~~ → `isPersonalWorkspaceId` +
  `userId` en HMAC en todos `/api/sync/*`.
- ~~Stream agente caía con cap 15min Vercel~~ → migrado a Cloud Run con
  budget 760s + truncated:true gracioso.
- ~~Mono-repo gigante~~ → split a 7 repos con historial preservado
  (`git filter-repo`).
- ~~Hub en stev-server con `systemd --user`~~ → migrado a VM dedicada
  GCP `agora-hub` (e2-micro) → migrado definitivamente a Hostinger VPS
  `agora-storage` (76.13.118.239) con MinIO + Forgejo + Postgres. GCP
  `agora-hub` retirado y apagado.
- ~~Service Account Firebase sin rotación~~ → rotada (Secret Manager v3
  enabled, v1/v2 disabled). Backfill custom claims ejecutado.
- ~~Agente IA sin rate limit~~ → daily token budget 500k + hourly cap
  100 msgs + abuse-block 5×429 en 10min. Tracking en
  `users/{uid}/agentUsage/daily-{YYYY-MM-DD}`.
- ~~Chats del agente IA solo en localStorage~~ → persistencia Firestore
  `users/{uid}/agentChats` + subcollection `messages` con
  `useAgentChatHistory` hook cross-device.
- ~~Workspace search solo metadata~~ → ahora consulta
  `searchableContent`.
- ~~Custom claims no se cableaban en mutaciones members~~ →
  `syncWorkspaceClaims` cableado en backend (Cloud Function trigger
  creado pero no deployado — defense in depth, no se necesita).
- ~~Citaciones sin grafo~~ → subcollection
  `documents/{docId}/citations` + tools agente
  `query_citation_graph`, `find_related_via_graph`, `expand_context`.
  Endpoint admin `/api/admin/citations/backfill` + cron diario 04:00 UTC.
- ~~Upload >50MB cortaba~~ → endpoints multipart
  (`/api/upload/multipart/{initiate,sign-part,complete,abort}`).
- ~~Git providers solo Forgejo interno~~ → vault AES-256-GCM +
  isomorphic-git para vincular repos externos (GitHub, GitLab, SSH).
- ~~next-pwa@5.6.0 EOL~~ → migrado a `@ducanh2912/next-pwa@10.2.9`
  (fork mantenido) + SW auto-registra en App Router.
- ~~ST V4 evolution~~ → 52+ módulos en `@stevenvo780/st-lang@4.5.0` (de 3.2.3). 1583 → 4041 tests. Releases v4.0.0 → v4.5.0.
- ~~ST Ciclo 3 features~~ → `@stevenvo780/st-lang@4.15.0`: proof-mining, stnb notebook format, dl-hybrid DDL, lemma-rag RAG. 4041 → 6333+ → 6565+ tests. `@4.15.1` agrega subpath tactic-dsl (workaround `createRequire` en AgoraBack resuelto). AgoraFront y AgoraBack consumen 4.15.x en prod.
- ~~Bug unify/occursIn~~ → fix `b5ae00d` (fast-check seed `286462923`). Correctness issue en unificación, resuelto antes de 4.15.0.
- ~~ST Playground sin AI co-pilot~~ → `/st-playground-v3` (3 columnas responsive + AI) + `/st-notebook` (cells code+markdown, Firestore `users/{uid}/notebooks`). Deployed en Vercel.
- ~~AgoraBack sin tools ST~~ → 2 nuevas tools del agente: `st_proof_mine` y `st_tactic_apply`. Deployed en Cloud Run revision `agora-backend-00159-b7l`.
- ~~Firestore rules sin notebooks~~ → rules para `users/{uid}/notebooks` deployed.
- ~~RTDB rules sin collab~~ → rules para `/collab/{workspaceId}/{docId}` con `auth.token.workspaces` custom claims deployed.
- ~~Editor MDX rehidratación al reabrir~~ → bug lazy-plugin remount en `MosaicEditor.tsx`, fix aplicado.
- ~~KaTeX no renderizaba en cells ST notebook~~ → `remark-math` + `rehype-katex` integrados.

## 11. Harness de Claude Code en este workspace

Configuración instalada para evitar declaraciones falsas de éxito ("lo
logré", "funciona", "listo") sin verificación real, y para tener un
equipo de subagents especializados en los puntos de dolor del proyecto.

### 11.1 Stop hook anti-victoria-falsa

- `~/.claude/hooks/verify-completion.sh` — Stop hook que parsea el
  transcript, detecta frases de victoria y exige ≥1 tool call de
  verificación (Bash/Read/Grep/Glob/WebFetch/Agent/etc.) tras el último
  prompt humano. Si no hay verificación, retorna
  `{"decision":"block","reason":"..."}` y el modelo es forzado a continuar.
- `EducacionCooperativa/.claude/settings.json` — registra el hook +
  permisos seguros (deny destructivos, ask para deploys, allow para
  diagnóstico). Env: `CLAUDE_MIN_VERIFICATIONS=1`.
- `EducacionCooperativa/AgoraFront/.claude/settings.json` — mismo hook +
  `additionalDirectories` para los 6 subrepos hermanos.

### 11.2 Subagents especializados

Definidos en `.claude/agents/`. Llamados via Agent tool (`subagent_type`).
Sweet spot mantenido en 4 agentes (anti-pattern: >10-15 diluye routing).

| Agent | Color | Cuándo invocarlo |
|-------|-------|------------------|
| `code-reviewer` | 🟢 | Pre-commit/PR sobre diff. Audita convenciones (TS strict, sin `any`, contratos de borde, payloads RTDB completos, lint rules). Read-only. |
| `security-auditor` | 🔴 | Pre-commit y pre-deploy. Detecta secrets/env leaks, canal sync sin uid, `WORKER_SECRET` sin `.trim()`, env vars protegidas fuera de `src/lib/env.ts`. Read-only. |
| `deploy-verifier` | 🔵 | INMEDIATAMENTE post-deploy. Valida Vercel/Cloud Run/Hub/Workers con curl + gcloud + ssh. Devuelve verdict con evidencia. |
| `sync-debugger` | 🟡 | Cuando el user reporta "no sincroniza" / "ya no funciona como antes". Especialista en regresiones RTDB/daemon/MinIO históricas. |

### 11.3 Slash commands (orquestación)

Definidos en `.claude/commands/`. Invocados con `/<nombre>`.

| Command | Qué hace |
|---------|----------|
| `/diag [capa]` | Health check de front/back/hub/workers/nas con tabla de status. |
| `/audit-changes [ref]` | Lanza `code-reviewer` + `security-auditor` en paralelo sobre el diff. Verdict consolidado. |
| `/verify-deploy [target]` | Lanza `deploy-verifier` sobre el target del último deploy. |
| `/sync-status [síntoma]` | Quick health pass + `sync-debugger` si hay anomalía. |

### 11.4 Cuándo NO usar agents

- Tareas cortas/secuenciales (<10 archivos, <3 pasos): hacela en main, el
  overhead de fork no compensa.
- Review del propio trabajo en el mismo turno: el fork "rubber-stampea".
  Para code review serio esperá un turno fresco o usá `/audit-changes`.
- Steps con dependencias serias entre ellos: no son paralelizables.

### 11.5 Operación del harness

**Desactivar el hook temporalmente** (si molesta para exploración):
```bash
export CLAUDE_MIN_VERIFICATIONS=0   # threshold a 0 = nunca bloquea
```
o editar `settings.json` y poner `disableAllHooks: true`.

**Extender el harness a otros subrepos** — los agents/commands de
`EducacionCooperativa/.claude/` SÓLO se cargan cuando Claude abre con
cwd en el workspace root. Si abrís Claude en un subrepo, el harness no
los ve. Para portarlo, copiar `.claude/agents/`, `.claude/commands/` y
el bloque `hooks` de `settings.json` a `<subrepo>/.claude/`.

**Patrones que el hook detecta** (case-insensitive): "lo logré",
"funciona perfectamente/bien/correctamente", "todo bien/listo",
"ya está listo", "completado exitosamente", "sin problemas",
"funcionando perfectamente", "exitoso/exitosa", "ya quedó", "solucionado",
"arreglado completamente", "works perfectly", "all good/set",
"everything works", "works as expected", "successfully completed".

**Falsos positivos esperados**: ~5%. Remedio: ejecutar 1 tool de
verificación (cualquier `Read` o `Bash`) o reformular sin la frase.

**Importante**: hooks/agents/commands recién creados NO los detecta el
watcher hasta reiniciar Claude Code o abrir `/hooks` una vez (el watcher
sólo vigila directorios que tenían settings al iniciar la sesión).

## 12. Archivos que casi nunca tocar

- `AgoraFront/src/generated/*` — regenerados por scripts. Si aparecen
  modificados sin haberlos pedido: `git checkout -- src/generated/`.
- `AgoraFront/src/components/mosaic-editor/` y `MosaicEditor.tsx` — el
  editor MDX es delicado. Cambios chicos OK; refactor grande pedirlo.
- `AgoraWorker/worker/build/` — artefactos de empaquetado.
- `ST/dist/`, `Autologic/dist/` — outputs npm publish, regenerables.

## 13. Notas sobre los repos hermanos

### ST y Autologic
Son librerías npm publicadas (`@stevenvo780/st-lang`, `@stevenvo780/autologic`).
AgoraFront las consume vía `package.json`. Si el user pide cambios al
runtime ST o al formalizador, trabajalos en sus repos respectivos y
luego `npm publish` + `npm update` en AgoraFront.

ST está en `@stevenvo780/st-lang@4.15.1` (era 3.2.3 → 4.5.0 → 4.15.x). 52+ módulos de v4.5
más módulos Ciclo 3: `./reasoning/proof-mining`, `./format/stnb` (notebook .stnb),
`./logic/profiles/dl-hybrid` + `./reasoning/dl-hybrid` (DDL subset),
`./reasoning/lemma-rag` (RAG HashEmbedding R^256). Suite: 6565+ tests (era 1583 → 4041).
Versiones y tags en GitHub: v4.0.0 → v4.15.1.

Ecosistema ST (repos/paquetes adicionales en el mismo repo `ST/`):
- `@stevenvo780/st-mcp@0.1.0` — publicado en npm. MCP server, 4 tools: check/derive/countermodel/formalize.
- `@stevenvo780/st-cli@0.1.0` — publicado en npm. CLI, 6 subcomandos: check/derive/countermodel/formalize/export/repl.
- `vscode-st@0.1.0.vsix` — build local (`.github/actions/verify-st-claims/` Docker action tag `verify-st-claims-v1`). Marketplace VS Code pendiente PAT Azure.

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

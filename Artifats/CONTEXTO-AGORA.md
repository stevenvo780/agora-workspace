# CONTEXTO AGORA — Artifact maestro

> Documento de contexto consolidado del workspace Agora (7 repos, 4 capas de
> despliegue). Generado el 2026-05-26 a partir de todos los `.md` operativos
> del workspace. Sirve para **cobrar contexto rápido** al retomar trabajo y
> como índice de dónde mirar. Fuente de verdad viva: `CLAUDE.md` (raíz) y los
> READMEs/RUNBOOKs de cada repo. **No contiene secretos** (viven en
> `AgoraFront/.claude/secrets.md`, gitignored).

---

## 0. Setup MCP — 16 instancias Chrome paralelas para testeo

Config en `/workspace/EducacionCooperativa/.mcp.json`: 16 servidores MCP
`agora-chrome-1 … agora-chrome-16`, cada uno
`npx -y chrome-devtools-mcp@latest --headless --isolated`.

- **Por qué N instancias y no una compartida**: el plugin por defecto
  (`chrome-devtools` / `playwright`) expone **un solo browser compartido** →
  2+ agentes paralelos se pisan (regla histórica "Playwright = 1 agente
  serial"). Con `--isolated` cada servidor levanta **su propio proceso Chrome
  con user-data-dir temporal** = cookie-jar/sesión/localStorage separados.
  Eso permite loguear **16 usuarios de Agora distintos en paralelo**
  (estudiante, docente, admin, anónimo…) sin colisión.
- **Binario**: Chrome for Testing se descarga una sola vez (cache puppeteer
  compartido); sólo los perfiles son por-instancia y se limpian al cerrar.
- **Activación** (no se aplica en caliente): reiniciar Claude Code; al volver,
  aprobar los servidores `agora-chrome-*` (o `/mcp` → habilitarlos). Los
  `.mcp.json` de proyecto requieren trust del usuario.
- **Convención de uso con subagentes**: asignar a cada agente de testeo una
  instancia fija → `mcp__agora-chrome-3__navigate_page`,
  `mcp__agora-chrome-3__click`, etc. N agentes ⇒ N instancias distintas.
- **Recursos**: máquina local 125 GiB RAM / 32 cores → 16 Chrome headless van
  sobradas. Los 16 procesos `npx` arrancan al iniciar sesión; cada Chrome sólo
  se lanza en la primera tool-call de su servidor.

---

## 1. Qué es Agora

Plataforma educativa colaborativa con 3 superpoderes:
1. **Editor MDX rico** — LaTeX, Mermaid, kanban, snippets, glosario semántico.
2. **Lógica formal** — editor `.st` con 11 perfiles lógicos, formalizador
   automático (Autologic), mesa semántica, linter académico. Rutas
   `/st-playground-v3` (AI co-pilot) y `/st-notebook` (cells, Firestore).
3. **Terminal por workspace** — container Docker con `/workspace` montado y
   sincronizado contra MinIO + Firestore + Forgejo.

Usuarios: estudiantes, docentes y devs que quieren web + terminal + git juntos.

---

## 2. Topología de infraestructura y hosts

**Vercel — AgoraFront**
- Prod: `agora.elenxos.com`. Proyecto `stevenvo780/EducacionCooperativa`.
- Auto-deploy histórico desde rama roto por deps; deploy manual obligatorio.

**Cloud Run — AgoraBack** (GCP proyecto `udea-filosofia`)
- `https://agora-backend-578238159459.us-central1.run.app`, región `us-central1`.
- Health `/health` → `{"status":"ok"}`; `/health/deep` → estado env vars.
- SA `firebase-adminsdk-fbsvc@udea-filosofia.iam.gserviceaccount.com`.
- Secret Manager: `firebase-service-account`, `hub-internal-secret`.
- Config: `--memory 1Gi --cpu 1 --timeout 3600 --concurrency 40 --max-instances 5`.

**agora-storage — Hostinger VPS `76.13.118.239`** (`root@`, SSH key, Ubuntu 24.04)
- MinIO (`s3.elenxos.com`, bucket `agora-blobs` ~3909 objetos)
- Forgejo v11 (`git.elenxos.com`), Postgres 17
- AgoraHub (`hub.elenxos.com`, socket.io 3010 interno, Caddy TLS `h1` only,
  user `edu-hub` no-root, systemd `edu-hub.service`)
- Docker Compose en `/opt/agora-stack/docker-compose.yml`. Sólo 443 externo.

**ils-server — Hostinger VPS `srv936994.hstgr.cloud`** (host de workers)
- NetBird `100.98.245.50`, NAT `148.230.88.162`, alias SSH `ils-server`.
- Ubuntu 24.04.4, Docker CE 29.5.2 (sin bug HTTP/2 de humanizar2), 4 cores/7.8 GB.
- User `humanizar` (UID 1001, grupo docker). ~43 containers `edu-worker-<id>`.
- Config workers `/etc/edu-worker/worker.env`. Daemon `agora-host-sync.service`
  en `/opt/agora-host-sync/`, logs `/home/humanizar/logs/agora-host-sync.log`.

**Firebase / GCP** (`udea-filosofia`)
- Auth + Firestore + RTDB. Backups Firestore en
  `gs://agora-firestore-backups-udea-filosofia/` (lifecycle 30d, Scheduler
  `firestore-daily-backup` 03:00 UTC). Scheduler `citations-backfill-daily`.

**RETIRADOS** (mantener apagados): NAS `100.98.67.189`, agora-hub GCP,
humanizar2 (muerto físicamente 2026-05-24).

---

## 3. Servicios

### AgoraFront (Next.js 15 App Router / Vercel)
- Consume `@agora/contracts`, `@stevenvo780/st-lang`, `@stevenvo780/autologic`
  desde npm (no `file:../`). PWA `@ducanh2912/next-pwa@10.2.9`.
- Storage: Firestore, RTDB (sync events), MinIO, Forgejo. Auth Firebase + custom
  claims por workspace (`syncWorkspaceClaims`). Env vía `@/lib/env`.
- Rutas API clave: `/api/diag` (health cacheado), `/api/sync/*` (worker-* HMAC
  + manifest/signed-url/commit Firebase auth), `/api/workspaces/*`
  (CRUD + provision-git + git/{status,commit,log,issue-token}),
  `/api/documents/*`, `/api/auth/*`.
- Scripts ops one-shot en `ops/`: `orphan-sync-cleanup.mjs` (docs Firestore con
  blob huérfano → loop infinito del daemon), `fix-folder-rename-pdf.mjs`,
  `minio-cleanup/`.
- Deploy: `npm run typecheck && npm run build && vercel deploy --prod --yes`
  (+ `vercel alias set <url> agora.elenxos.com` si falta). Env vars con
  `printf 'valor' | vercel env add NOMBRE production` (sin newline) + redeploy.
- Archivos delicados: `src/components/mosaic-editor/`, `MosaicEditor.tsx`,
  `src/generated/*`.

### AgoraBack (Express / Cloud Run)
- Monta handlers vía `src/routes/nextApiRouter.ts` bajo `/api/*` y, por
  compatibilidad, también sin prefijo (rutas bare, sunset 2026-08-01).
- Endpoints clave: `POST /api/agora-ai/stream` (chat agente, 145 tools,
  `executeAgentTool` in-process), `/api/agora-ai/chats*` (persistencia
  Firestore `users/{uid}/agentChats`), `/api/agora-ai/keys` (vault BYOK
  AES-256-GCM/HKDF), `/api/agora-ai/internal/execute-tool` (compat,
  `BACKEND_INTERNAL_SECRET`), `POST /api/public/st/evaluate` (ST como servicio,
  `X-ST-API-Key`, 60/min · 1000/día), `/api/st-libraries`,
  `/api/upload/multipart/*` (>50MB), `/api/documents/:id/citations`,
  `/api/admin/citations/backfill`, `POST /api/payments/webhook` (MercadoPago,
  requiere `MERCADOPAGO_WEBHOOK_SECRET` — fail-closed), `/api/sync/worker-*`.
- Crons (Cloud Scheduler): `/api/cron/check-subscriptions` (06:00 UTC),
  `/api/cron/drain-outbox` (cada 5min).
- toolExecutor particionado por dominio en `src/lib/agora-ai/toolExecutors/*.ts`
  (no reconsolidar). Deploy: `npm run typecheck && gcloud run deploy
  agora-backend --source . --region us-central1`.
- Rutas bare deprecated: 84, responden `Deprecation/Sunset/Link canonical`.
  Remoción tras 2026-08-01 (borrar bloque en `nextApiRouter.ts` ~L53-57;
  verificar antes URL del webhook MP y que el daemon use prefijo `/api/`).

### AgoraHub (socket.io + Express / agora-storage)
- Coordina browser clients, workers de terminal y comandos del agente. systemd
  `edu-hub.service` (user `edu-hub`), Caddy `h1` only. Estado en memoria se
  pierde en restart (clientes reconectan solos).
- REST: `/health`, `/agent/workspace-status`, `POST /agent/run-command`
  (rate-limited), `/status` (admin). Eventos Socket.IO: `create-session`,
  `join-session`, `restore-session`, `execute`, `resize`, `kill-session`,
  `workspace:subscribe`, `doc-change`.
- Env: `WORKER_SOCKET_SECRET` (nuevo), `WORKER_SECRET` (fallback),
  `WORKER_SECRET_PREVIOUS`, `CLIENT_ORIGIN`, `FIREBASE_SERVICE_ACCOUNT`.
- Deploy: `cd AgoraHub && npm run build && cd ../AgoraWorker/desplieges-prod &&
  ./deploy_hub.sh` (scp dist → agora-storage, `systemctl restart edu-hub`).
  **Orden: hub primero, luego workers.**

### AgoraWorker (Docker / DockerHub + ils-server)
- Tres partes:
  1. `worker/` — imagen `stevenvo780/edu-worker:latest` (Node + PTY). Whitelist
     ~40 binarios. cwd `/workspace`. Policy tri-tier: destructivos
     (`rm`/`mv`/`truncate`) → confirm siempre; safe-reads (`ls`/`cat`/`pwd`) →
     directo; resto → confirm.
  2. `worker-host-sync/` — daemon `agora-host-sync.service` en ils-server.
     Sincroniza `/home/humanizar/edu-worker/workspaces/<wsId>/` ↔ MinIO +
     AgoraBack cada 5s, revive containers exited. Ignora `.scratch/`,
     `.agent-tmp/`, `tmp-*`, `*.tmp`. Métricas Prometheus `127.0.0.1:9090`.
     Fix 2026-05-25: lee `WORKER_TOKEN` real vía `docker inspect` para
     workspaces personales (`personal:<uid>`) en vez del wsId crudo.
  3. `desplieges-prod/` — scripts `deploy_hub.sh`, `deploy_docker.sh`,
     `update_st_workers.sh`, `deploy_sync_daemon.sh`.
- Deploy imagen: `docker build -t stevenvo780/edu-worker:latest . && docker
  push && ssh ils-server 'sudo edu-worker-manager update all'`.

### AgoraCli (`@stevenvo780/agora-cli`, publicado npm)
- `agora login | workspaces | clone <wsId> | pull | push -m | watch | status |
  init <dir> | logout`. Cada workspace = repo Forgejo (`agora/<wsId>` shared,
  `agora/personal-<uid>` personal). Config `~/.agora/config.json` (chmod 600).
  Web + CLI + terminal convergen en el mismo repo (workers `git pull --rebase`
  cada 60s).

---

## 4. Ecosistema lógico — ST + Autologic

### ST (`@stevenvo780/st-lang@4.15.1`)
- Lenguaje ejecutable para lógica formal, argumentación y formalización
  documental. Scripting declarativo (`let`/`set`/`if`/`for`/`fn`/`theory`/
  `import`) + Text Layer + alias en español. 80+ módulos, 6565+ tests
  (era 1583 → 4041 → 5964 → 6565+).
- **11 perfiles**: `classical.{propositional,first_order}`, `modal.k`,
  `deontic.standard`, `epistemic.s5`, `aristotelian.syllogistic`,
  `intuitionistic.propositional`, `temporal.ltl`, `probabilistic.basic`,
  `paraconsistent.belnap`, `arithmetic`.
- **Módulos Ciclo 3 (v4.15.x)**: `./reasoning/proof-mining`, `./format/stnb`
  (notebook `.stnb`), `./logic/profiles/dl-hybrid` + `./reasoning/dl-hybrid`
  (DDL subset), `./reasoning/lemma-rag` (RAG HashEmbedding R^256),
  `./reasoning/tactic-dsl` (subpath añadido en 4.15.1 — resolvió el workaround
  `createRequire` de AgoraBack).
- **Subpaths oficiales** (los únicos expuestos): barrel `@stevenvo780/st-lang`,
  `/api`, `/types`, `/protocol` + los Ciclo 3. Funciones clave: `evaluate`,
  `parse`, `typeCheck`, `createInterpreter`, `listProfiles`, `streamEval`,
  `solveCDCLv2`, `DerivationCache`, `signProof`/`verifyProof` (Ed25519),
  `exportToCoq`/Lean4.
- Sin breaking changes en API pública desde 3.3.0 (todo aditivo).

### Ecosistema ST (todos v0.1.0)
- `@stevenvo780/st-mcp` — MCP server, 4 tools: check/derive/countermodel/
  formalize (publicado npm).
- `@stevenvo780/st-cli` — CLI, 6 subcomandos: check/derive/countermodel/
  formalize/export/repl (publicado npm).
- `vscode-st@0.1.0.vsix` — LSP + grammar + snippets, build local. **Pendiente**:
  PAT Azure para Marketplace.
- GitHub Action `verify-st-claims-v1` — Docker action en
  `.github/actions/verify-st-claims/`.

### Autologic (`@stevenvo780/autologic`, publicado npm)
- Formalizador texto natural → ST ejecutable. Dos modos:
  1. **Reglas** (default): NLP determinista, ~200 marcadores ES/EN, stemming
     Snowball, correferencia Dice/Jaccard. 0 deps runtime, ~30 KB.
  2. **LLM/SLM** (`formalizeWithLLM`): providers `openai` (gpt-4o), `ollama`
     (qwen2.5:7b), `web-distilled` (Qwen2.5-0.5B ONNX local vía
     `@huggingface/transformers`, modelo `stevenvo780/autologic-slm-onnx`).
- peerDep `@stevenvo780/st-lang >= 3.0.0`. En AgoraFront:
  `src/lib/buildSTFromSemantic.ts` + `src/components/FormalizerPlayground.tsx`.
- Pipeline: Segmenter → Discourse Analyzer → Atom Extractor → Formula Builder →
  ST Generator → Validator. NL Linter (4 reglas). 74 tests, ~80% coverage.
- API: `formalize`, `formalizeWithLLM`, `lintNaturalLanguage`,
  `parseTextWithLLM`, `compileAST`, clase `Autologic`.

---

## 5. Procedimientos operativos (RUNBOOK_OPS.md / RUNBOOK_BACKUPS.md)

**Rollback Cloud Run** (§1):
```bash
gcloud run revisions list --service=agora-backend --region=us-central1 --project=udea-filosofia
gcloud run services update-traffic agora-backend --to-revisions=<rev>=100 --region=us-central1 --project=udea-filosofia
```
**Restart hub** (§2): `ssh root@76.13.118.239 'systemctl restart edu-hub'` →
`curl -s https://hub.elenxos.com/health`.
**Restart workers** (§3): `ssh ils-server 'sudo edu-worker-manager restart all'`.
**Restart daemon sync** (§12): `ssh ils-server 'sudo systemctl restart agora-host-sync'`.

**Backups**:
- Firestore: Scheduler diario 03:00 UTC → `gs://agora-firestore-backups-udea-filosofia/`.
  Manual: `gcloud scheduler jobs run firestore-daily-backup --location=us-central1 --project=udea-filosofia`.
- MinIO: mirror diario 02:00 UTC (`minio-mirror-backup.sh`), `agora-blobs` → `agora-blobs-backup`.

**Recovery**:
- Firestore: `gcloud firestore import gs://.../<TIMESTAMP>/ --project=udea-filosofia` (parcial con `--collection-ids=`).
- MinIO parcial: `mc cp --recursive --overwrite adm/agora-blobs-backup/workspaces/<wsId>/ adm/agora-blobs/workspaces/<wsId>/`.

**Rotación `WORKER_SECRET` sin downtime** (§11): generar nuevo → distribuir
viejo como `WORKER_SECRET_PREVIOUS` en Back/Hub/Vercel → sustituir nuevo en
todos → `edu-worker-manager update all` → limpiar `PREVIOUS` tras 24-48h.
**Rotación SA Firebase** (§13): `gcloud iam service-accounts keys create` →
`gcloud secrets versions add firebase-service-account` → copiar a agora-storage
→ restart edu-hub → redeploy Back y Front → revocar key vieja.

**Control agente IA**: deshabilitar `--update-env-vars=AGENT_DISABLED=true`;
rate limit `AGORA_AI_DAILY_TOKEN_BUDGET=<v>`; resetear user → borrar
`users/{uid}/agentUsage/daily-{YYYY-MM-DD}`.
**Maintenance mode**: `printf 'true' | vercel env add NEXT_PUBLIC_MAINTENANCE_MODE production && vercel deploy --prod --yes`.

Diagnóstico frecuente: ver `CLAUDE.md §5` o skill `/diag`.

---

## 6. API de tools del agente IA — 145 tools

Definidas en `AgoraBack/src/lib/agora-ai/toolDefinitions.ts` (al 2026-05-12).
Resumen por dominio (detalle en `AGENT_TOOLS_API.md`):

- **§1 Documentos & carpetas (16)**: list/read/create/update/rename/move/delete/
  search/duplicate_document, rename/delete/list/create_folder,
  upload_external_url, download_workspace_bundle, get_document_content_at_revision.
- **§2 Workspace & contexto (6)**: get_workspace_info, inspect_workspace,
  search_workspace, read_workspace_bundle, list_workspaces, sync_status.
- **§3 Worker/terminal (11)**: get_worker_status, run_worker_command (confirm),
  list/read/write_worker_file (write confirm), tail_worker_logs,
  kill_worker_process, restart/start_worker (stubs), list/kill_terminal_session.
- **§4 Git (9)**: status/log/diff, commit_workspace (confirm), pull,
  push_branch (confirm), create_branch, checkout, revert_commit (confirm).
- **§5 Snippets (8)** · **§6 Kanban (10)** (incl. bulk_create hasta 50).
- **§7 Lógica & ST (9)**: check_logic, formalize_text, list_st_profiles,
  validate_st_syntax, run_st_program, render_st_glossary, explain_formalization,
  prove_step, compare_logic_profiles.
- **§8 Semántico/glosario (11)** · **§9 Inteligencia documental (10)**
  (summarize/compare/analyze/outline, extract_pending_tasks, find_broken_links/
  duplicates, extract_text_from_pdf, lint_document/st_document).
- **§10 Grafo de citas (3)**: query_citation_graph, find_related_via_graph,
  expand_context.
- **§11 UI (5)** · **§12 Admin workspace (9)** · **§13 Observabilidad (11)**.
- **§14 Sync RTDB (3)** (force_emit_sync_ping) · **§15 Suscripciones (4)** ·
  **§16 Diccionario linter (3)**.
- **§17 Plan/memoria/hooks (11)**: agent_plan_set (obligatorio ≥3 tools o
  destructivo), plan_update/get/clear, agent_remember/recall/list/forget,
  spawn_subagent (stub), set/list_hooks, turn_snapshot*, dry_run_info.
- **§18 Externos (2)**: fetch_url (bloquea localhost/IP privadas), read_agora_doc.

5 tools marcadas `DEPRECATED:` para retirar próximo sprint.

---

## 7. Estado del proyecto (SPRINT_POST_BETA, cierre 2026-05-12)

14/15 items DONE; 8 nuevos descubiertos, ninguno bloquea GA. **Pendientes**:
1. Heap editor < 5 MB (bajó 12 → 7-9 MB; falta benchmark + sprint dedicado).
2. `AgoraAIChat` rehidratación del `agentRun` (tool calls viejos sin link al run).
3. Cloud Function trigger custom claims (hoy backfill manual `backfill-claims.mjs`).
4. Verificar `category:"No estructurado"` residual en algún endpoint admin.
5. 2 uids huérfanos en `members/` (limpiar o asignar a "system").
6. **`concept-edges = 0`** — colección vacía tras cron citation graph; auditar
   `AgoraBack/src/jobs/citations-backfill*.ts` (hipótesis: feature flag o
   nombre de colección). **No declarar "funciona" sin verificar que se popula.**
7. 3-4 tools en `accessPolicy.ts` sin exposición en `toolDefinitions.ts`.
8. TTL automático en `users/{uid}/agentUsage` (acción del user en consola
   Firestore, campo `expiresAt`).

Baja prioridad: MinIO basura raíz (~32 objetos), vulns npm low transitorias,
CORS "Origen null" → bajar a debug, `MERCADOPAGO_WEBHOOK_SECRET` en prod.

---

## 8. Gotchas — cosas que NO romper

- **Payload RTDB** DEBE incluir `timestamp` (no sólo `ts`), `type`, `source`
  o `useSyncEvents` no lo capta. Ver `AgoraFront/src/lib/nas-events.ts`.
- **`firebase-admin` necesita `databaseURL`** o los pings fallan en silencio.
- **Canal personal** `sync-events/personal_<uid>`, NO `sync-events/personal`.
- **`WORKER_SECRET` sin newline** (cargar con `printf`, no `echo`); idéntico en
  Back, Hub, cada worker y el daemon.
- **Daemon trackea `{ localHash, remoteHash }` por path** — no simplificar a un
  solo hash (causó loop de re-pull histórico).
- **Daemon ignora** `.scratch/`, `.agent-tmp/`, `tmp-*`, `*.tmp`; el
  `.syncignore` editable debe seguir mandando (no meter defaults agresivos).
- **Orden de deploy**: hub primero, luego workers.
- **`NEXUS_URL`** en AgoraBack (default `https://hub.elenxos.com`) o las tools
  worker del agente no saben a dónde apuntar.
- **Vault `users/{uid}/agentSecrets`** cifra con clave derivada de
  `WORKER_SECRET` — rotarlo invalida todas las keys (coordinar con el user).
- **Rutas bare** deben responder `Deprecation/Sunset/Link` hasta 2026-08-01.
- **`AGENT.md`** del repo es versión vieja del `CLAUDE.md`; la verdad viva es
  `CLAUDE.md` (raíz + `AgoraFront/.claude/`).
- Referencias a `humanizar2` en RUNBOOK_OPS están desactualizadas → host activo
  de workers es `ils-server` (`100.98.245.50`).

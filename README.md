# Agora — Workspace local

Este directorio NO es un repo git. Es un **workspace local** que agrupa
los 7 repos del ecosistema Agora para tenerlos abiertos en el mismo IDE.

```
EducacionCooperativa/
├── AgoraFront/   stevenvo780/EducacionCooperativa  → Vercel auto-deploy
├── AgoraBack/    stevenvo780/agora-backend         → Cloud Run (gcloud run deploy --source .)
├── AgoraHub/     stevenvo780/agora-hub             → systemd edu-hub.service en VM GCP `agora-hub`
├── AgoraWorker/  stevenvo780/agora-worker          → docker push stevenvo780/edu-worker:latest
├── AgoraCli/     stevenvo780/agora-cli             → npm publish (pendiente)
├── ST/           stevenvo780/ST                    → npm @stevenvo780/st-lang (publicado)
└── Autologic/    stevenvo780/auto.logic            → npm @stevenvo780/autologic (publicado)
```

Cada subdirectorio es un repo git independiente con su `.git/`, sus PRs y su CI.

## Roles de cada repo

| Repo | Rol | Notas |
|------|-----|-------|
| **AgoraFront** | Frontend Next.js 15 — UI completa (editor MDX, terminal web, chat IA, kanban, búsqueda, formalizador). Integra Firebase Auth + Firestore + MinIO + Forgejo. | Despliegue auto en Vercel desde push a master. URL prod: `agora.elenxos.com`. |
| **AgoraBack** | Servicio IA agéntico (Express + TS) que hospeda el streaming SSE de OpenAI/Anthropic/Gemini/DeepSeek sin el cap de 15 min de Vercel. Las tools se delegan al hub via HTTP. | Cloud Run en `us-central1`. URL: `agora-backend-578238159459.us-central1.run.app`. |
| **AgoraHub** | TermiCoop Hub: socket.io server que coordina los workers Docker (terminales, sesiones SSH) y expone HTTP `/agent/*` para que el agente IA ejecute comandos en workers. | systemd `edu-hub.service` (user `edu-hub` no-root) en VM GCP `agora-hub` (e2-micro free tier, `hub.humanizar-dev.cloud`, Caddy h1). Carpeta `ops/` con docker-compose de NAS. |
| **AgoraWorker** | Worker Docker que corre por workspace (`edu-worker-<wsId>`). Da terminal Linux + handler `agent-command`. Incluye el daemon `worker-host-sync/` que mantiene `/workspace/<wsId>/` espejado contra MinIO+Firestore. | Imagen `stevenvo780/edu-worker:latest` en DockerHub. Daemon `agora-host-sync.service` en `humanizar2`. Carpeta `desplieges-prod/` con scripts deploy. |
| **AgoraCli** | CLI de terminal para Agora fuera de la web (clone, edit local, push). | Sin publicar aún. |
| **ST** | `@stevenvo780/st-lang` — lenguaje ejecutable de lógica formal con 11 perfiles (proposicional, primer orden, modal K, deóntico, epistémico, intuicionista, LTL, Belnap, silogístico, probabilístico, aritmético). Lo usa el editor MDX para validar `.st`. | Publicado en npm. v3.2.2. |
| **Autologic** | `@stevenvo780/autologic` — formalizador automático texto natural → ST sin IA, basado en reglas NLP. Bilingüe ES/EN. Lo usa el FormalizerPlayground. | Publicado en npm. v2.2.2. |

## Clonar el workspace en otra máquina

```bash
git clone git@github.com:stevenvo780/agora-workspace.git EducacionCooperativa
cd EducacionCooperativa
git clone git@github.com:stevenvo780/EducacionCooperativa.git AgoraFront
git clone git@github.com:stevenvo780/agora-backend.git        AgoraBack
git clone git@github.com:stevenvo780/agora-hub.git            AgoraHub
git clone git@github.com:stevenvo780/agora-worker.git         AgoraWorker
git clone git@github.com:stevenvo780/agora-cli.git            AgoraCli
git clone git@github.com:stevenvo780/ST.git                   ST
git clone git@github.com:stevenvo780/auto.logic.git           Autologic
mkdir -p packages
git clone git@github.com:stevenvo780/agora-contracts.git      packages/agora-contracts
npm install
```

`agora-workspace` es el repo de coordinación: contiene `package.json` con npm
workspaces, `Artifats/`, scripts CI/smoke, docker-compose y la documentación
raíz. Los subrepos viven dentro pero cada uno tiene su `.git/` propio.

## Comandos típicos

| Tarea | Comando |
|-------|---------|
| Dev frontend | `cd AgoraFront && npm run dev` |
| Test frontend | `cd AgoraFront && npx vitest run` |
| Deploy frontend | `git push` (Vercel auto) o `cd AgoraFront && vercel --prod --yes` |
| Deploy backend Cloud Run | `cd AgoraBack && gcloud run deploy agora-backend --source . --region us-central1` |
| Build hub | `cd AgoraHub && npm run build` |
| Deploy hub a `agora-hub` (GCP) | `cd AgoraWorker/desplieges-prod && ./deploy_hub.sh` |
| Build & push worker | `cd AgoraWorker/worker && docker build -t stevenvo780/edu-worker:latest . && docker push stevenvo780/edu-worker:latest` |
| Update todos los workers | `cd AgoraWorker/desplieges-prod && ./update_st_workers.sh` |
| Publicar ST | `cd ST && npm publish` |
| Publicar Autologic | `cd Autologic && npm publish` |

## Producción

- **Frontend**: <https://agora.elenxos.com> — Vercel desde `master` de AgoraFront.
- **Backend IA**: `https://agora-backend-578238159459.us-central1.run.app` (rewrite desde `agora.elenxos.com/api/agora-ai/stream`). min-instances 0 (cold starts absorbidos).
- **Hub TermiCoop**: `https://hub.humanizar-dev.cloud` (Caddy h1 only frente a `:3010`), systemd `edu-hub.service` en VM GCP `agora-hub` (e2-micro free tier).
- **Workers**: 35 contenedores Docker `edu-worker-*` en `humanizar2`, administrados por `agora-host-sync.service`. Apuntan al hub vía `NEXUS_URL=https://hub.humanizar-dev.cloud`.
- **Costos GCP estimados**: <$1/mes en total (Cloud Run cold-starts + Compute Engine e2-micro free tier + Cloud Scheduler + Cloud Logging dentro de free tier).

Para detalles operacionales, infra, secretos y comandos diagnóstico:
ver [`CLAUDE.md`](./CLAUDE.md) en este mismo directorio.

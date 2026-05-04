# Auditoría Docker/deploy — Agora

## Dockerfiles

| Servicio | Estado | Nota |
|---|---|---|
| Front | Existe `AgoraFront/Dockerfile` | Revisar non-root y healthcheck antes de producción Docker. |
| Back | Existe `AgoraBack/Dockerfile` | Usado para Cloud Run; smoke con `/health`. |
| Hub | Existe `AgoraHub/Dockerfile` | Añadir healthcheck de `/health` si se opera como container. |
| Worker | Existe `AgoraWorker/worker/Dockerfile` | Validar usuario no root y volumen `/workspace`. |
| ST | No requiere Dockerfile runtime principal | Librería/CLI npm; empaquetado aparte. |

## Compose local

Se agregó `docker-compose.yml` para levantar MinIO, Back, Hub y un worker de desarrollo. Firebase emulator/Forgejo siguen como integración futura; el compose sirve como esqueleto local de smoke, no como paridad total de producción.

## Flujo de deploy por servicio

- Front: Vercel desde `AgoraFront`.
- Back: Cloud Run desde `AgoraBack`.
- Hub: `AgoraWorker/desplieges-prod/deploy_hub.sh`.
- Worker: build/push DockerHub y `edu-worker-manager update all`.

## Smoke post-deploy

Usar:

```bash
AGORA_BACKEND_URL=https://... AGORA_HUB_URL=https://... npm run smoke
```

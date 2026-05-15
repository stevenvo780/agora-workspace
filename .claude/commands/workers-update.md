---
description: Rebuild de imagen edu-worker + push a DockerHub + rollout en humanizar2 (edu-worker-manager update all). Verifica que los workers reconectan al hub tras el restart.
argument-hint: "[mensaje commit opcional para el log]"
---

# /workers-update — Rebuild + rollout edu-worker

Nota del rollout: `$ARGUMENTS` (si vacío, sólo "rolling update").

## Pasos

```bash
# 1. Build local con tag latest
cd /home/operador/proyectos/humanizar/EducacionCooperativa/AgoraWorker/worker
docker build -t stevenvo780/edu-worker:latest . 2>&1 | tail -5

# 2. Push a DockerHub
docker push stevenvo780/edu-worker:latest 2>&1 | tail -5

# 3. Capturar SHA de la imagen pushada
NEW_SHA=$(docker images stevenvo780/edu-worker:latest --no-trunc --format '{{.ID}}' | head -1)
echo "Imagen push: $NEW_SHA"

# 4. Rollout en humanizar2
ssh humanizar2 'echo ZYJWwwG3LcUO2m9kTrfR95 | sudo -S edu-worker-manager update all 2>&1 | tail -20'

# 5. Validar workers vivos post-rollout
ssh humanizar2 'docker ps --filter name=edu-worker --format "{{.Names}}\t{{.Status}}" | wc -l'
ssh humanizar2 'docker ps -a --filter name=edu-worker --filter "status=exited" --format "{{.Names}}" | head'

# 6. Verificar reconexión al hub (deben aparecer registers nuevos)
ssh root@76.13.118.239 'journalctl -u edu-hub --since "60 seconds ago" --no-pager | grep -c "Worker registered"'
```

## Validación post-rollout

- Total workers vivos: ~35/35 (baseline).
- Exited count: 0 (si hay >2 exited, el daemon `agora-host-sync` debería revivirlos en 5-15s).
- Hub log: `Worker registered for Workspace: ...` para los wsIds rotados.

Si algún worker NO reconecta, verificar:
- `ssh humanizar2 'docker logs edu-worker-<wsId> --tail 30'` — buscar errores HTTP/2 o auth.
- `NEXUS_URL` del container `docker inspect edu-worker-<wsId> | grep NEXUS_URL` debe ser `https://hub.elenxos.com`.

## NO hacer

- NO uses `--no-cache` salvo necesidad (slow).
- NO actualices `WORKER_SECRET` aquí — eso requiere coordinación con AgoraBack + AgoraHub.
- NO rebootes humanizar2 — solo `edu-worker-manager update all`.

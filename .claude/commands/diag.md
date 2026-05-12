---
description: Health check completo del sistema Agora — Vercel front, Cloud Run back, hub agora-hub (GCP VM), workers humanizar2, NAS (MinIO/Forgejo). Reporta estado por capa con evidencia concreta. Uso típico al empezar día o tras un incidente.
argument-hint: "[capa opcional: front|back|hub|workers|nas|all (default: all)]"
---

# /diag — Health check del workspace Agora

Capa solicitada: $ARGUMENTS (si vacío → `all`).

## Ejecutá los chequeos siguientes en paralelo y reportá una tabla de status

### Front (Vercel — agora.elenxos.com)
```bash
curl -s -o /dev/null -w "front /api/diag: HTTP %{http_code} (%{time_total}s) " https://agora.elenxos.com/api/diag
curl -sI -m 5 https://agora.elenxos.com/api/diag | grep -i "x-cache\|cache-control" | head -2
curl -s https://agora.elenxos.com/api/diag | jq -c '{nas: .nas.health, forgejo: .forgejo.health}' 2>/dev/null
```

### Back (Cloud Run — proyecto udea-filosofia)
```bash
curl -s -o /dev/null -w "back /health: HTTP %{http_code} (%{time_total}s)\n" https://agora-backend-578238159459.us-central1.run.app/health
gcloud run services describe agora-backend --region=us-central1 --project=udea-filosofia --format='value(status.traffic[].revisionName,status.traffic[].percent)'
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="agora-backend" AND severity>=ERROR' --limit 5 --format='value(timestamp,severity,textPayload,jsonPayload.message)' --freshness=1h --project=udea-filosofia
```

### Hub (GCP VM `agora-hub`, edu-hub.service, hub.humanizar-dev.cloud)
```bash
curl -s -o /dev/null -w "hub /health: HTTP %{http_code} (%{time_total}s)\n" https://hub.humanizar-dev.cloud/health
gcloud compute ssh agora-hub --zone=us-central1-a --project=udea-filosofia --quiet --command='sudo systemctl is-active edu-hub && sudo journalctl -u edu-hub --since "5 minutes ago" --no-pager | grep -ciE "error|denied|fail|unhandled"'
```

### Workers (containers Docker en humanizar2)
```bash
ssh humanizar2 'docker ps --filter name=edu-worker --format "{{.Names}}\t{{.Status}}" | wc -l'
ssh humanizar2 'docker ps -a --filter name=edu-worker --filter "status=exited" --format "{{.Names}}\t{{.Status}}" | head'
ssh humanizar2 'systemctl status agora-host-sync --no-pager 2>&1 | head -5'
```

### NAS (MinIO + Forgejo)
```bash
ssh nas 'docker ps --filter name=agora --format "{{.Names}}\t{{.Status}}"'
ssh nas 'docker exec agora-minio mc admin info adm 2>/dev/null | head'
```

## Output esperado

Tabla compacta:

```
CAPA            STATUS    DETALLE
front           🟢/🔴/⚪   <ms o error> (x-cache: HIT|MISS)
back            🟢/🔴/⚪   <ms o error> + ERROR count 1h
hub             🟢/🔴/⚪   <active|inactive> + errors 5min
workers         🟢/🔴/⚪   <up>/35 baseline (exited count)
sync-daemon     🟢/🔴/⚪   <active|loop|down>
nas-minio       🟢/🔴/⚪   <up|down>
nas-forgejo     🟢/🔴/⚪   <up|down>
```

🟢 = OK, 🔴 = falla, ⚪ = no chequeable.

Si CUALQUIER capa está 🔴, no declares "todo bien" — listá qué falla y propone qué agente del workspace usar (`sync-debugger` para el daemon, `deploy-verifier` para deploys).

---
description: Health check completo del sistema Agora — Vercel front, Cloud Run back, hub stev-server, daemon de sync, workers Docker, NAS (MinIO/Forgejo). Reporta estado por capa con evidencia concreta. Uso típico al empezar día o tras un incidente.
argument-hint: "[capa opcional: front|back|hub|workers|nas|all (default: all)]"
---

# /diag — Health check del workspace Agora

Capa solicitada: $ARGUMENTS (si vacío → `all`).

## Ejecutá los chequeos siguientes en paralelo y reportá una tabla de status

### Front (Vercel — agora.elenxos.com)
```bash
curl -s -o /dev/null -w "front /api/diag: HTTP %{http_code} (%{time_total}s)\n" https://agora.elenxos.com/api/diag
curl -s https://agora.elenxos.com/api/diag | jq -c '{ok: (.error == null), rtdb: .rtdb, minio: .minio}' 2>/dev/null || echo "front diag no parseable"
vercel ls --prod 2>/dev/null | head -5
```

### Back (Cloud Run — proyecto udea-filosofia)
```bash
SERVICE_URL=$(gcloud run services describe agora-backend --region us-central1 --format='value(status.url)' 2>/dev/null)
curl -s -o /dev/null -w "back /health: HTTP %{http_code} (%{time_total}s)\n" "$SERVICE_URL/health"
curl -s "$SERVICE_URL/health" 2>/dev/null | jq -c .
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="agora-backend" AND severity>=ERROR' --limit 5 --format='value(timestamp,textPayload)' --freshness=1h 2>/dev/null
```

### Hub (stev-server, edu-hub.service)
```bash
ssh nas ssh stev-server 'systemctl --user status edu-hub --no-pager 2>&1 | head -10' 2>/dev/null
ssh nas ssh stev-server 'curl -s http://127.0.0.1:3010/health' 2>/dev/null
```

### Workers (containers Docker en stev-server)
```bash
ssh nas ssh stev-server 'docker ps --filter name=edu-worker --format "{{.Names}}\t{{.Status}}" | wc -l' 2>/dev/null
ssh nas ssh stev-server 'docker ps --filter name=edu-worker --format "{{.Names}}\t{{.Status}}" | grep -v "Up " | head' 2>/dev/null
ssh nas ssh stev-server 'systemctl status agora-host-sync --no-pager 2>&1 | head -5' 2>/dev/null
```

### NAS (MinIO + Forgejo)
```bash
ssh nas 'docker ps --filter name=agora --format "{{.Names}}\t{{.Status}}"' 2>/dev/null
ssh nas 'docker exec agora-minio mc admin info adm 2>/dev/null | head' 2>/dev/null
```

## Output esperado

Tabla compacta:

```
CAPA            STATUS    DETALLE
front           🟢/🔴/⚪   <ms o error>
back            🟢/🔴/⚪   <ms o error>
hub             🟢/🔴/⚪   <active|inactive>
workers         🟢/🔴/⚪   <up>/<expected> (~27 baseline)
sync-daemon     🟢/🔴/⚪   <active|loop|down>
nas-minio       🟢/🔴/⚪   <up|down>
nas-forgejo     🟢/🔴/⚪   <up|down>
```

🟢 = OK, 🔴 = falla, ⚪ = no chequeable (red sin acceso, etc.).

Si CUALQUIER capa está 🔴, no declares "todo bien" — listá qué falla y propone qué agente del workspace usar (`sync-debugger` para el daemon, `deploy-verifier` para deploys).

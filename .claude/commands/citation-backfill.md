---
description: Disparar backfill del citation graph para un workspace específico (o todos los pendientes via Cloud Scheduler). Verifica que las edges quedaron escritas.
argument-hint: "[wsId opcional, o 'all' para disparar el cron Scheduler completo]"
---

# /citation-backfill — Disparar backfill del citation graph

Target: `$ARGUMENTS` (si vacío o `all` → Cloud Scheduler cron diario).

## Si `$ARGUMENTS` está vacío o es 'all'

```bash
# Disparar el cron daily de Cloud Scheduler
gcloud scheduler jobs run citations-backfill-daily \
  --location=us-central1 \
  --project=udea-filosofia

# Ver últimas ejecuciones
gcloud logging read 'resource.type="cloud_scheduler_job" AND resource.labels.job_id="citations-backfill-daily"' \
  --limit=3 --project=udea-filosofia \
  --format='value(timestamp,severity,httpRequest.status)'
```

## Si `$ARGUMENTS` es un wsId específico

```bash
WS_ID="$ARGUMENTS"

# Obtener Firebase ID token del owner (necesita credenciales del user en .claude/secrets.md)
# Asumiendo que ya tenés el token en $TOKEN:

# Disparar backfill manual
curl -X POST "https://agora-backend-578238159459.us-central1.run.app/api/admin/citations/backfill" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"workspaceId\":\"$WS_ID\",\"force\":true}" \
  | jq -c '{docsProcessed, edgesWritten, conceptEdges, durationMs, errors: (.errors | length)}'

# Validar resultado: edges>0 esperado si los docs tienen [[wiki-links]] o [md](./otro.md)
curl -sf -H "Authorization: Bearer $TOKEN" \
  "https://agora-backend-578238159459.us-central1.run.app/api/workspaces/$WS_ID/citation-graph?depth=2" \
  | jq -c '{nodes: (.nodes | length), edges: (.edges | length), truncated}'
```

## Output esperado

Por workspace procesado:
- `docsProcessed`: número de docs escaneados.
- `edgesWritten`: edges nuevas escritas a `documents/{docId}/citations` subcollection.
- `errors`: lista vacía si OK.

Validación del grafo workspace-wide:
- `edges > 0` si el workspace tiene wiki-links/markdown-links/bib references.
- `edges = 0` puede ser correcto si los docs son texto plano sin referencias (e.g. workspace de notas LaTeX puras).

## Si `edges=0` persiste tras backfill

Investigar:
- ¿Los docs tienen sintaxis `[[doc-name]]` o `[texto](./otro.md)`? Sample un par con `read_document`.
- ¿El parser está activo? `grep -n "parseAndPersistCitations" AgoraBack/src/lib/citations/`.
- ¿`concept-edges` está habilitado? (módulo de aristas semánticas, hoy en 0).

Bug histórico: el endpoint workspace-wide retornaba 0 edges por cap en `expandSubgraph` — fix en revision `agora-backend-00093-qwm` o posterior. Verificar revision activa con `/diag back`.

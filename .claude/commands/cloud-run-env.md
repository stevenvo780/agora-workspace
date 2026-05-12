---
description: Actualizar env var de Cloud Run agora-backend sin perder las demás (usa --update-env-vars, NO --set-env-vars). Valida revisión nueva + health post-deploy.
argument-hint: "<KEY>=<VALUE>  (e.g. AGORA_AI_DAILY_TOKEN_BUDGET=1000000)"
---

# /cloud-run-env — Update env var Cloud Run safe

Variable a setear: `$ARGUMENTS`

## ⚠️ Regla crítica
- Usar **`--update-env-vars`** (ADD/UPDATE preserva las demás).
- NUNCA `--set-env-vars` con 1 sola key (REEMPLAZA todas las env vars existentes).
- Ya pasaron 2 incidentes en sesiones anteriores: `--set-env-vars` borró NAS_S3_*, FORGEJO_*, FIREBASE_DATABASE_URL y la nueva revisión no arrancó.

## Pasos

```bash
# 1. Confirmar la env actual antes de tocar nada
gcloud run services describe agora-backend --region=us-central1 --project=udea-filosofia --format='value(spec.template.spec.containers[0].env)' | tr ',' '\n' | head -30

# 2. Aplicar (--update-env-vars preserva el resto)
gcloud run services update agora-backend \
  --region=us-central1 \
  --project=udea-filosofia \
  --update-env-vars=$ARGUMENTS \
  --quiet

# 3. Verificar revision activa + value aplicado
gcloud run services describe agora-backend --region=us-central1 --project=udea-filosofia \
  --format='value(status.traffic[].revisionName,status.traffic[].percent)'
gcloud run services describe agora-backend --region=us-central1 --project=udea-filosofia \
  --format='value(spec.template.spec.containers[0].env)' | tr ',' '\n' | grep "$(echo $ARGUMENTS | cut -d= -f1)"

# 4. Health post-deploy
curl -sf -m 5 https://agora-backend-578238159459.us-central1.run.app/health

# 5. Confirmar no hay errores nuevos
gcloud logging read 'resource.type="cloud_run_revision" AND severity>=ERROR' --limit 5 --order=desc --format='value(timestamp,textPayload)' --freshness=2m --project=udea-filosofia
```

## Output esperado
- Revision nueva sirviendo 100% traffic.
- Health 200 con timestamp post-update.
- 0 errores ERROR en últimos 2 minutos.

Si el deploy falla por env perdida (ej. "FALTAN env vars críticas"), abortá y usá `--update-env-vars` (NO `--set-env-vars`).

---
description: Verifica que un deploy reciente está vivo y sirviendo tráfico — invoca deploy-verifier sobre el target especificado (front, back, hub, worker, all). Úsalo INMEDIATAMENTE tras ejecutar el comando de deploy, antes de declarar éxito al user.
argument-hint: "[target: front|back|hub|worker|all (default: all)] [--deployment-url <url>]"
---

# /verify-deploy — Validación post-deploy con evidencia

Target: $ARGUMENTS

## Pasos

1. **Identificar qué deploy se acaba de hacer**:
   - Si el user pasó `--deployment-url`, usá ese.
   - Si no, infiérilo del último command bash en el transcript:
     - `vercel deploy --prod` → target=front
     - `gcloud run deploy agora-backend` → target=back
     - Hostinger VPS `agora-storage` systemctl restart edu-hub → target=hub
     - `docker push stevenvo780/edu-worker` o `edu-worker-manager update all` → target=worker
   - Si no hay pista, asumí `all`.

2. **Chequeos rápidos antes de invocar el agente** (1 línea por chequeo):
   ```bash
   # Front
   curl -sI -m 5 https://agora.elenxos.com/api/diag | head -3
   curl -sI -m 5 https://agora.elenxos.com/sw.js | head -3
   curl -s -m 5 https://agora.elenxos.com/api/diag | grep -oiE 'content-security-policy.*cdnjs' | head -1

   # Back
   curl -sf -m 5 https://agora-backend-578238159459.us-central1.run.app/health
   gcloud run services describe agora-backend --region=us-central1 --project=udea-filosofia --format='value(status.traffic[].revisionName,status.traffic[].percent)'

   # Hub
   curl -sf -m 5 https://hub.elenxos.com/health

   # Workers
   ssh humanizar2 'docker ps --filter name=edu-worker --format "{{.Names}}" | wc -l'
   ```

3. **Invocar deploy-verifier** vía Agent tool:
   - `subagent_type: "deploy-verifier"` — input: "Verificá el deploy de `<target>`. Deployment URL (si aplica): `<url>`. Chequeos rápidos ya corridos: <copiar output>. Reportá CHECKS, ANOMALÍAS, VERDICT con evidencia copiable."

4. **Forwardear el verdict al user** SIN modificar:
   - Si el agent dijo `DEPLOY_HEALTHY` → confirmá con la evidencia que dio.
   - Si dijo `DEPLOY_DEGRADED` → listá las anomalías y propones rollback o investigación.
   - Si dijo `DEPLOY_FAILED` → propones rollback inmediato:
     - **Front**: `vercel alias set <previous-deployment> agora.elenxos.com`
     - **Back**: `gcloud run services update-traffic agora-backend --to-revisions=<previous>=100 --region=us-central1`
     - **Hub** (Hostinger VPS `agora-storage`): `ssh root@76.13.118.239` + checkout commit anterior + `sudo systemctl restart edu-hub`
     - **Worker**: `docker pull stevenvo780/edu-worker:<previous-sha> && ssh humanizar2 'edu-worker-manager update all'`

## Validaciones específicas adicionales

### Front (Vercel)
- SW registrado: `curl -sI https://agora.elenxos.com/sw.js` debe responder 200 + `content-type: application/javascript`.
- CSP correcto: `cdnjs.cloudflare.com` debe estar en `script-src` y `worker-src` (PDF.js worker).
- `x-vercel-cache: HIT` indica que ISR sirvió desde edge cache (no es regresión, es esperado).

### Back (Cloud Run)
- Revisión nueva sirviendo 100% del tráfico.
- `gcloud logging read ... severity>=ERROR --freshness=2m` debe estar vacío.
- Env vars críticas preservadas: `FORGEJO_*`, `NAS_S3_*`, `FIREBASE_DATABASE_URL`.

### Hub (Hostinger VPS `agora-storage`, 76.13.118.239)
- Caddy h1-only (engine.io necesita HTTP/1.1 para WebSocket upgrade).
- `ssh root@76.13.118.239 'systemctl is-active edu-hub'` → `active`.

### Worker
- ~35 containers vivos post-rollout (baseline).
- Hub log muestra "Worker registered for Workspace: ..." para los wsIds rotados.

## NUNCA

- NO digas "deploy ok" sin haber pasado por el agente. El hook `verify-completion.sh` te bloqueará si lo intentás sin tool calls de verificación.
- NO uses `--set-env-vars` en Cloud Run con 1 sola key (reemplaza todas). Usar `/cloud-run-env` que envuelve `--update-env-vars`.

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
     - `vercel deploy --prebuilt --prod` → target=front
     - `gcloud run deploy agora-backend` → target=back
     - `./deploy_hub.sh` → target=hub
     - `docker push stevenvo780/edu-worker` o `edu-worker-manager update` → target=worker
   - Si no hay pista, asumí `all`.

2. **Invocar deploy-verifier** vía Agent tool:
   - `subagent_type: "deploy-verifier"` — input: "Verificá el deploy de `<target>`. Deployment URL (si aplica): `<url>`. Reportá CHECKS, ANOMALÍAS, VERDICT con evidencia copiable."

3. **Forwardear el verdict al user** SIN modificar:
   - Si el agent dijo `DEPLOY_HEALTHY` → confirmá con la evidencia que dio
   - Si dijo `DEPLOY_DEGRADED` → listá las anomalías y propones rollback o investigación
   - Si dijo `DEPLOY_FAILED` → propones rollback inmediato:
     - Front: `vercel alias set <previous-deployment> agora.elenxos.com`
     - Back: `gcloud run services update-traffic agora-backend --to-revisions=<previous>=100 --region=us-central1`
     - Hub: ssh + checkout commit anterior + redeploy
     - Worker: `docker pull stevenvo780/edu-worker:<previous-tag> && edu-worker-manager update all`

4. **NUNCA** digas "deploy ok" sin haber pasado por el agente. El hook `verify-completion.sh` te bloqueará si lo intentás sin tool calls de verificación.

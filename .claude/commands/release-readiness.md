---
description: Validación pre-release — typecheck + lint + tests + build en los 4 repos (AgoraFront, AgoraBack, AgoraHub, AgoraWorker) + smokes públicos. Veredicto GO / GO con caveats / NO-GO con evidencia.
argument-hint: "[repo opcional: front|back|hub|worker|all (default: all)]"
---

# /release-readiness — Validación completa pre-release

Scope: $ARGUMENTS (si vacío → `all`).

## Por cada repo, ejecutá en paralelo

### AgoraFront
```bash
cd /home/operador/proyectos/humanizar/EducacionCooperativa/AgoraFront
npm run typecheck 2>&1 | tail -3
npm run lint 2>&1 | tail -3
npm run test:unit 2>&1 | tail -5
npm run build 2>&1 | tail -10
```

### AgoraBack
```bash
cd /home/operador/proyectos/humanizar/EducacionCooperativa/AgoraBack
npm run typecheck 2>&1 | tail -3
npm run lint 2>&1 | tail -3
npm test 2>&1 | tail -5
npm run build 2>&1 | tail -10
```

### AgoraHub
```bash
cd /home/operador/proyectos/humanizar/EducacionCooperativa/AgoraHub
npm run build 2>&1 | tail -5
npm test 2>&1 | tail -3
```

### AgoraWorker
```bash
cd /home/operador/proyectos/humanizar/EducacionCooperativa/AgoraWorker/worker
node --check index.js && echo "syntax OK" || echo "syntax FAIL"
npm test 2>&1 | tail -3
```

## Smokes públicos
```bash
curl -sf -o /dev/null -w "Front:  %{http_code} %{time_total}s\n" -m 8 https://agora.elenxos.com/api/diag
curl -sf -o /dev/null -w "Back:   %{http_code} %{time_total}s\n" -m 8 https://agora-backend-578238159459.us-central1.run.app/health
curl -sf -o /dev/null -w "Hub:    %{http_code} %{time_total}s\n" -m 8 https://hub.elenxos.com/health
ssh humanizar2 'docker ps --filter name=edu-worker --format "{{.Names}}" | wc -l'
```

## Veredicto

Tabla por repo:
```
REPO        TYPECHECK  LINT  TESTS       BUILD
Front       ✅/❌       ✅/❌  XXX/XXX     ✅/❌
Back        ✅/❌       ✅/❌  XXX/XXX     ✅/❌
Hub         n/a        n/a   XX/XX       ✅/❌
Worker      ✅/❌       n/a   XX/XX       n/a
```

Smokes:
```
LAYER     STATUS    DETALLE
front     🟢/🔴     200 0.5s
back      🟢/🔴     200 0.4s
hub       🟢/🔴     200 0.4s
workers   🟢/🔴     35/35
```

**Veredicto final**:
- 🟢 **GO**: TODO verde + smokes 200 + 0 errores Cloud Run últimos 30min.
- 🟡 **GO con caveats**: 1-2 warnings menores no-blockers (tests skip, lint warnings).
- 🔴 **NO-GO**: typecheck/lint/build/tests rotos, o smokes <200.

NO declares GO sin haber visto exit code 0 en cada paso.

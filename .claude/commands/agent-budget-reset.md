---
description: Resetear contador diario de tokens del agente IA para un user específico (sin afectar otros). Útil cuando un user golpea el cap (AGORA_AI_DAILY_TOKEN_BUDGET) y necesita seguir trabajando antes del reset automático a medianoche UTC.
argument-hint: "<firebase-uid>  (e.g. 21VuZW4cdXd9jGKOgPa5YQegICw1)"
---

# /agent-budget-reset — Reset contador diario tokens de un user

UID objetivo: `$ARGUMENTS`

## Pasos

```bash
UID="$ARGUMENTS"
DAY=$(date -u +%Y-%m-%d)

# 1. Confirmar el doc existe + ver consumo actual
gcloud firestore documents describe \
  --collection=users \
  --document="${UID}/agentUsage/daily-${DAY}" \
  --project=udea-filosofia 2>&1 | head -20

# 2. Borrar el doc (el backend lo recrea en el próximo tool call con tokens=0)
gcloud firestore documents delete \
  --collection=users \
  --document="${UID}/agentUsage/daily-${DAY}" \
  --project=udea-filosofia

# 3. Confirmar borrado
gcloud firestore documents describe \
  --collection=users \
  --document="${UID}/agentUsage/daily-${DAY}" \
  --project=udea-filosofia 2>&1 | head -3
# Debe responder "NOT_FOUND"
```

## Alternativa no-destructiva (preservar otros campos del doc)

```bash
# Setear tokens a 0 sin borrar (preserva expiresAt, byProvider history, etc.)
echo '{"fields":{"promptTokens":{"integerValue":"0"},"completionTokens":{"integerValue":"0"}}}' | \
  gcloud firestore documents patch \
    --collection=users \
    --document="${UID}/agentUsage/daily-${DAY}" \
    --update-mask=promptTokens,completionTokens \
    --project=udea-filosofia \
    --data-file=-
```

## Si el cap global es bajo (no solo user puntual)

Mejor subir el cap global vía `/cloud-run-env`:
```
/cloud-run-env AGORA_AI_DAILY_TOKEN_BUDGET=2000000
```

O por proveedor (DeepSeek es barato, OpenAI no):
```
/cloud-run-env AGORA_AI_BUDGET_DEEPSEEK=3000000
```

## Verificación

Próximo tool call del agente con ese user devuelve `tokens-remaining = budget completo`.

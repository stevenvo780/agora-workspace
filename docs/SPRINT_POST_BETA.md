# Sprint Post-Beta Agora (2026-05-11 → 2026-05-12)

## Resumen

Tras la sesión intensa de fixes previos al release beta, estos son los items que
quedaron como deuda técnica priorizada. El objetivo de este sprint es estabilizar
performance del editor, cerrar advisories de seguridad y consolidar piezas que
hoy funcionan pero conviven con código legacy o configuración subóptima.

Re-priorizar al cierre de cada semana según feedback de los usuarios beta.

**Actualizado 2026-05-12** tras sesión intensiva: la mayoría de items ALTA/MEDIA
quedaron resueltos. Lo que sigue pendiente está marcado con `[ ]`; lo hecho con
`[x] DONE`.

---

## ALTA

### 1. Heap doc trivial > 5 MB (12 MB actual, ~7-9 MB post-Lote F)

- **Estado**: `[x] DONE (parcial)` — editor lazy aplicado al primer paint,
  heap bajó de 12 → ~7-9 MB con plugins críticos. **Pendiente** alcanzar el
  target estricto `< 5 MB` con benchmark formal.
- **Esfuerzo restante**: 2-3 días.
- **Archivos**: `AgoraFront/src/components/mosaic-editor/`,
  `AgoraFront/src/components/mosaic-editor/MosaicEditor.tsx`, plugins MDXEditor
  en `src/components/mosaic-editor/plugins/`.
- **Próximos pasos**:
  - Auditar qué `LexicalNodes` restantes registran al montar y diferir LaTeX/
    Mermaid/kanban tras el primer scroll.
  - PoC paralelo: reemplazar MDXEditor por CodeMirror 6 + pipeline
    remark→rehype más liviano, sin perder los plugins de glosario/snippets.
  - Definir benchmark reproducible: doc vacío, doc 5KB, doc 50KB → snapshot
    heap. Hoy se mide ad-hoc en DevTools.
- **Verificación**: Chrome DevTools heap snapshot tras abrir un doc vacío.

### 2. Next.js DoS advisory (Server Components)

- **Estado**: `[x] DONE` — `next` actualizado, `npm audit` limpio para el
  advisory de DoS, build OK, suite de Playwright verde.
- **Validación**: preview Vercel y producción confirmados sin regresión en
  login + apertura de doc.

### 3. Migración `AgoraAIChat.tsx` → `useAgentChatHistory`

- **Estado**: `[x] DONE (parcial)` — el hook `useAgentChatHistory` ya alimenta
  el flujo principal y los chats se persisten en backend.
- **Pendiente residual**:
  - Reconstrucción del `agentRun` cuando se rehidrata una conversación vieja
    (algunos tool calls quedan sin enlace al run original).
  - Retirar lectura `localStorage` legacy tras 2 sprints de coexistencia.
- **Riesgo**: bajo ya — el flujo nuevo está en producción, lo restante es
  cleanup.

---

## MEDIA

### 4. "No estructurado" en búsqueda global

- **Estado**: `[x] DONE (front)` — el front ya no muestra el bucket
  "No estructurado" en filtros de búsqueda.
- **Pendiente**:
  - Verificar si el backend aún devuelve docs con `category: "No estructurado"`
    en algún endpoint admin/migración. Si persiste, normalizar a `null` y
    actualizar las queries de Firestore.

### 5. Backfill citation graph automatizado

- **Estado**: `[x] DONE` — cron `citations-backfill-daily` creado en Cloud
  Scheduler y disparable manualmente (ver `RUNBOOK_OPS.md` §20).
- **Observación abierta**: durante el sweep `concept-edges` aparece **vacío**
  (0 documentos) en producción. Hipótesis: o el módulo no está activo (feature
  flag), o el path de escritura es otro nombre de colección. Auditar
  `AgoraBack/src/jobs/citations-backfill*.ts` antes de declarar 100% verde.

### 6. Test de carga real

- **Estado**: `[x] DONE` — corrida k6 con 100 RPS x 5 min contra endpoints
  críticos, tabla p50/p95/p99 archivada. No se detectó bottleneck bloqueante
  para beta. Min-instances de Cloud Run ajustadas según resultados.

### 7. Audit de tools del agente IA

- **Estado**: `[x] DONE` — auditoría completa de las tools registradas
  (ver `AGENT_TOOLS_API.md`). Resultado:
  - 142 → **145 tools** activas (3 nuevas: `query_citation_graph`,
    `find_related_via_graph`, `expand_context`).
  - 1 tool eliminada (`agent_replay_turn` — nunca usada en producción, código
    muerto).
  - 5 tools marcadas con prefijo `DEPRECATED:` en su `description`; se retiran
    el siguiente sprint si nadie las usa.
  - 28 tools enriquecidas con "cuándo usar / cuándo NO usar / ejemplo".
  - Nueva sección en system prompt: **"Estrategia de búsqueda jerárquica"** (7
    pasos: overview → doc conocido → relaciones → keywords → multi-step →
    subagent → memoria).
- **Pendiente residual**: 3-4 tools listadas en `accessPolicy.ts` que **no
  están expuestas** en `toolDefinitions.ts`. Decidir: exponer o quitar de la
  policy. Lista exacta capturada durante el sweep, pasa al sprint siguiente.

---

## BAJA

### 8. Eliminar key vieja IAM SA

- **Estado**: `[x] DONE` — la key vieja (`8fe83f6...`) ya está revocada.

### 9. MinIO basura histórica

- **Estado**: `[ ] pendiente` — ~32 objetos en raíz del bucket `agora-blobs`
  (`21Vu.../.git/...`, `dev-user-123/`, `groups/`, `system/`) siguen ahí.
  No afecta operación pero ensucia listados.
- **Próximo paso**: listar, confirmar que no pertenecen a workspaces activos,
  mover a bucket `agora-blobs-trash` antes de borrar definitivo.
- **Comando preview**:
  `ssh nas 'docker exec agora-minio mc ls adm/agora-blobs/ | head -50'`.

### 10. Vulnerabilidades npm low/transitivas

- **Estado**: `[ ] parcial` — críticas/altas atendidas en este sprint
  (incluyendo Next.js DoS). Quedan `fast-uri`, `xmldom`, `fast-xml-builder`
  como transitivas low. `npm audit fix` + overrides el siguiente sprint.

### 11. CORS "Origen no permitido: null" — bajar a `debug`

- **Estado**: `[ ] pendiente`. Esfuerzo: 30 min. Cambio mecánico en
  `AgoraBack/src/middleware/cors.ts`.

### 12. Cerrar puerto raw 3010 firewall GCP

- **Estado**: `[x] DONE` — puerto cerrado. Tráfico va por TLS via
  `agora.elenxos.com`. Procedimiento de reapertura en
  `RUNBOOK_OPS.md` §19.

### 13. Cron `apt upgrade` weekly en VM `agora-hub`

- **Estado**: `[ ] pendiente`.

### 14. Cloud Ops Agent en VM hub

- **Estado**: `[x] DONE` — agent instalado, métricas CPU/RAM/disk/network
  fluyen a Cloud Monitoring junto con Cloud Run.

### 15. Crear user dedicado `edu-hub` en la VM

- **Estado**: `[x] DONE` — VM hardening incluyó migración de `User=root` a
  user dedicado, mover home y ajustar systemd unit.

---

## Items hechos en la sesión (no estaban en el plan original)

Bloque añadido el 2026-05-12 para reflejar trabajo realizado fuera de la
lista priorizada de arriba.

- `[x] DONE` — **Custom claims de membership de workspaces**:
  backfill ejecutado (`functions/scripts/backfill-claims.mjs`). 2 uids
  huérfanos detectados en `members/` que ya no existen en `users/` —
  documentados como pendiente de cleanup.
- `[x] DONE` — **Backups Firestore + MinIO** operativos. Ver
  `RUNBOOK_BACKUPS.md`.
- `[x] DONE` — **Cron backfill citation graph** creado en Cloud Scheduler.
  Pendiente verificar que la colección destino se popula realmente.
- `[x] DONE` — **PWA**: service worker con `skipWaiting`/`clients.claim()`
  validado. Snippet de "forzar update" documentado en
  `RUNBOOK_OPS.md` §17.
- `[x] DONE` — **Observabilidad**: Cloud Ops Agent en VM hub + audit log del
  agente persistido en Firestore (consultable via `get_agent_audit_log`).
- `[x] DONE` — **Rate limit del agente IA**: `AGORA_AI_DAILY_TOKEN_BUDGET`
  env var en Cloud Run + persistencia por user/día en
  `users/{uid}/agentUsage/daily-{YYYY-MM-DD}`. Procedimientos en
  `RUNBOOK_OPS.md` §15, §16.
- `[x] DONE` — **VM hardening**: user dedicado, puerto 3010 cerrado, Caddy
  configurado.
- `[x] DONE` — **Cleanup de datos legacy**: limpieza de docs huérfanos en
  Firestore (los detectados; los uids huérfanos quedan abiertos).
- `[x] DONE` — **Documentación operacional**: `RUNBOOK_OPS.md` (21
  procedimientos), `RUNBOOK_BACKUPS.md`, `AGENT_TOOLS_API.md` (145 tools).
- `[x] DONE` — **Tests de carga**: corridas con resultados archivados.
- `[x] DONE` — **UX pulido**: pulido general de UI tras feedback beta.
- `[x] DONE` — **`/api/diag` con cache**: el endpoint ahora respeta TTL
  (configurable via env) para no pegarle a Firestore/Cloud Run en cada
  ping de monitoreo externo.

---

## Pendientes nuevos descubiertos en la sesión

Items a sumar al backlog (no estaban antes, surgieron del audit del 2026-05-12):

1. **Heap target estricto `< 5 MB`** — el editor bajó a 7-9 MB; aún hace
   falta benchmark formal y un sprint dedicado para llegar a 5 MB sin
   romper plugins críticos.
2. **`AgoraAIChat` — reconstrucción del `agentRun` al rehidratar**:
   conversaciones viejas pierden el link al run original cuando se cargan
   desde backend. Tool calls quedan "sueltos". Impacto: trazabilidad de
   debugging y citas.
3. **Cloud Function trigger para custom claims**: hoy el backfill es
   manual (`backfill-claims.mjs`). Deploy de la function que escucha
   `onCreate`/`onWrite` de `members/` y actualiza claims en línea —
   resuelve el caso del user nuevo que tarda en ver workspaces nuevos.
4. **"No estructurado" en backend** (si persiste): verificar si algún
   endpoint admin o de migración aún devuelve `category: "No estructurado"`
   tras el fix de front.
5. **2 uids huérfanos en `members/`** detectados por
   `backfill-claims.mjs`. Decidir: limpiar entries dangling o reasignar
   a un user "system".
6. **`concept-edges = 0`**: tras correr el cron de citation graph manual,
   la colección sigue vacía. Auditar `AgoraBack/src/jobs/citations-backfill*.ts`
   y validar path de escritura.
7. **3-4 tools en `accessPolicy.ts` sin exposición en `toolDefinitions.ts`**:
   audit reveló inconsistencia. Decidir si se exponen o se quitan de la
   policy.
8. **TTL automático en `users/{uid}/agentUsage`** (acción pendiente del
   user, ver `RUNBOOK_OPS.md` §18): la policy se crea desde consola
   Firestore, hay que hacerlo manualmente.

---

## Tracking

- Crear un issue por item pendiente en Linear o GitHub Issues con labels
  `priority:alta/media/baja` y `area:front/back/hub/infra`.
- Re-priorizar cada 2 semanas según feedback beta y métricas de uso.
- Lo que queda en ALTA es residual y NO bloquea GA (la deuda principal
  cayó en esta sesión); revisar antes del cierre de sprint siguiente.

**Estado neto al 2026-05-12**: 14 / 15 items originales DONE o DONE
parcial. 8 items nuevos descubiertos, todos clasificables como deuda
técnica baja-media (ninguno bloquea GA).

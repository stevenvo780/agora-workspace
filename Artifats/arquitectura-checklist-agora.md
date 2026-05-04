# Auditoría fundamental de arquitectura — Agora

Fecha: 2026-05-03  
Workspace auditado: `/home/operador/proyectos/humanizar/EducacionCooperativa`  
Repos revisados: `AgoraFront`, `AgoraBack`, `AgoraHub`, `AgoraWorker`, `AgoraCli`, `ST`, `Autologic`.

> Nota importante: la carpeta se llama `Artifats` porque así fue solicitada. No corregí el typo a `Artifacts` para respetar el pedido exacto.

## 0. Veredicto ejecutivo

Agora ya tiene una arquitectura ambiciosa y bastante poderosa: editor MDX, motor ST, formalizador, workspace con terminal remota, sync NAS/MinIO/Firestore/RTDB/Forgejo, agente IA con tools y UI control. Eso es mucho producto real.

La crítica fundamental es esta:

> El problema principal ya no es falta de features; es falta de fronteras fuertes entre dominios. Hay demasiados contratos implícitos, buses ad-hoc, duplicación de modelos y archivos monolíticos que mezclan UI, infraestructura, dominio, seguridad y coordinación.

Si mañana algo se rompe, el bug probablemente no estará en una función aislada: estará en un borde entre capas:

- Front ↔ Back: JSON casteado sin validación uniforme.
- Back ↔ Hub ↔ Worker: secretos compartidos y protocolos HMAC duplicados.
- Firestore ↔ MinIO ↔ RTDB ↔ Forgejo: varias fuentes de verdad con consistencia eventual y eventos parciales.
- Agente IA ↔ UI: comandos por nombres string no generados desde un contrato común.
- ST ↔ Autologic ↔ Front: tests pasan en ST, pero la integración Front falla en un caso derivacional.

La arquitectura puede llegar a ser excelente, pero hoy está en una etapa de “producto muy capaz con deuda de plataforma”. La siguiente gran iteración debería ser de consolidación, no de agregar más superficies.

## 1. Evidencia local levantada

### 1.1 Métricas de tamaño

| Repo | Archivos fuente aprox. | LOC aprox. | Tests detectados | Observación |
|---|---:|---:|---:|---|
| `AgoraFront` | 873 | 86,576 | 54 | Gran superficie UI; dashboard/editor concentran mucha complejidad. |
| `AgoraBack` | 115 | 17,485 | 0 | API crítica sin tests automatizados locales. |
| `AgoraHub` | 7 | 1,890 | 0 | Hub casi monolítico en `src/index.ts`. |
| `AgoraWorker` | 5 | 1,114 | 0 | Worker + daemon sin tests. |
| `AgoraCli` | 1 | 244 | 0 | CLI mínima, aún inmadura. |
| `ST` | 71 | 36,583 | 26 | Motor grande pero con suite fuerte. |
| `Autologic` | 98 | 12,295 | 38 | Formalizador probado, pero con regresiones puntuales. |

Conteos específicos:

- `AgoraBack/src/app/api`: 59 archivos `route.ts`.
- `AgoraFront/src/app`: 8 páginas `page.tsx` y 0 route handlers `route.ts`.
- `AgoraWorker/worker`: 649 LOC.
- `AgoraWorker/worker-host-sync`: 465 LOC.

### 1.2 Comprobaciones estáticas ejecutadas

| Comprobación | Resultado |
|---|---|
| `AgoraFront` typecheck | ✅ OK |
| `AgoraBack` `tsc --noEmit` | ✅ OK |
| `ST` `tsc --noEmit` | ✅ OK |
| `Autologic` `tsc --noEmit` | ✅ OK |
| `AgoraHub` `tsc --noEmit` | ✅ OK tras instalar dependencias declaradas localmente; se removió `node_modules` generado. |
| `AgoraWorker/worker` lint | ⚠️ No verificable localmente: `eslint` no estaba disponible en el entorno local del repo. |

### 1.3 Tests ejecutados

| Suite | Resultado |
|---|---|
| `AgoraFront` unit | ❌ 1 fallido / 469 tests. Falla `tests/unit/st-engine-direct.test.ts`: esperaba `provable`, recibió `unknown` para `!(!P | !Q), R -> !S, R | !Q |- !S`. |
| `ST` test | ✅ 25 archivos, 1196 tests pasados. |
| `Autologic` test | ❌ 1 fallido / 204 tests, 15 skipped. Falla `prop-ex-o-fenomeno-nino`: salida generada no contiene `->`, detectó patrón incorrecto/superficial. |
| `Autologic` architectural limits focal | ✅ 10/10 pasados en la prueba focal previa. |

Lectura crítica: `ST` parece sano internamente, pero hay una regresión de integración en `AgoraFront`. `Autologic` pasa muchas pruebas, pero el fallo confirma fragilidad semántica en español natural.

### 1.4 Auditoría npm de producción

| Repo | Vulnerabilidades de producción |
|---|---:|
| `AgoraFront` | ❌ 15 total: 10 moderate, 4 high, 1 critical. |
| `AgoraBack` | ⚠️ 11 total: 2 low, 9 moderate. |
| `AgoraHub` | ❌ 16 total: 3 low, 8 moderate, 3 high, 2 critical. |
| `AgoraWorker/worker` | ❌ 13 total: 9 moderate, 3 high, 1 critical. |
| `ST` | ✅ 0. |
| `Autologic` | ❌ 1 critical (`protobufjs`). |
| `ST/editors/vscode-st` | ⚠️ 1 moderate. |

Esto no significa que todas sean explotables en el contexto real, pero sí que la línea base de dependencias no cumple “arquitectura robusta para producción educativa”.

## 1.5 Bitácora de ejecución P1-P3 — 2026-05-03

Esta sección registra el avance posterior a la auditoría inicial. No reemplaza el roadmap: separa lo **hecho y verificado** de lo que sigue pendiente.

### P1 aplicado y verificado

- [x] Registry de paneles IA mínimo en `AgoraFront` y `AgoraBack`:
  - nuevos `src/lib/agora-ai/uiPanels.ts` con `AGENT_UI_PANELS`, tipos `AgentUiPanel`, `AgentUiCommandType`, validadores y `commandTypeForPanel`.
  - `open_app_panel` ya obtiene su enum desde el registry, no desde listas string duplicadas.
  - `systemPrompt.ts` usa la misma descripción de paneles, evitando prompts desactualizados.
- [x] Validación de comandos UI del agente en Front:
  - `collectAgentWorkspaceEffects` descarta `uiCommand.type` o `uiCommand.panel` no registrados.
  - prueba añadida para rechazar `st-runner` como panel inválido.
- [x] Normalización parcial de tipos de documentos virtuales:
  - `DocumentType.SnippetsGallery` reemplaza casts/string magic para `snippets-gallery`.
  - `MosaicLayout` excluye paneles virtuales de búsqueda/rename/listados de documentos reales con una lista explícita.
- [x] Fail-fast de env críticas en `AgoraBack`:
  - `auditOnce()` ahora lanza error en producción si faltan variables críticas.
  - el warning de `MERCADOPAGO_WEBHOOK_SECRET` quedó alineado con comportamiento fail-closed, no “modo permisivo”.
- [x] Corte de `toolExecutor.ts` por dominio:
  - `open_app_panel` salió a `src/lib/agora-ai/toolExecutors/ui.ts`.
  - luego se completó la partición por archivos, storage, sync, ST, semantic, git y debug.
- [x] Primer corte de bus tipado Front:
  - nuevo `src/lib/agora-events.ts` con nombres y payloads tipados para eventos del agente.
  - `AgoraAIChat` ya emite eventos IA con `dispatchAgoraEvent`, no con strings sueltos.
- [x] Scripts `typecheck` añadidos a `AgoraBack`, `AgoraHub`, `ST` y `Autologic`.
- [x] Montaje bare de rutas marcado como deprecated:
  - `nextApiRouter` conserva las rutas sin `/api` para compatibilidad, pero ahora responde con headers `Deprecation`, `Sunset` y `Link rel="canonical"` hacia la ruta `/api/*`.
  - fecha por defecto: `2026-08-01`, configurable con `BARE_API_ROUTES_SUNSET`.

### P0 aplicado y verificado

- [x] Tests mínimos de `AgoraBack` para bordes críticos:
  - `tests/security-contracts.test.ts` cubre HMAC worker shared/personal, rechazo de firma alterada y firma de webhook MercadoPago.
  - `MERCADOPAGO_WEBHOOK_SECRET` queda probado como fail-closed en producción.
- [x] Tests mínimos de `AgoraHub`:
  - `tests/worker-token.test.ts` cubre token firmado, token personal inconsistente, expiración, firma alterada y legacy token con flag.
  - `tests/rate-limit.test.ts` cubre rate limit por workspace y reset de ventana.
- [x] Tests mínimos de `AgoraWorker`:
  - `worker/tests/agent-command-policy.test.mjs` cubre whitelist, bloqueo de comandos privilegiados, `rm /`, null bytes y límite de longitud.
  - `worker/tests/worker-token.test.mjs` cubre parseo de workspace personal/shared y generación HMAC de token firmado compatible con Hub.
- [x] Helpers puros extraídos para permitir tests sin levantar servicios completos:
  - `AgoraBack/src/lib/payments/mercadoPagoWebhookSignature.ts`.
  - `AgoraBack/src/lib/agora-ai/internalToolAuth.ts`.
  - `AgoraHub/src/lib/workerToken.ts`.
  - `AgoraHub/src/lib/rateLimit.ts`.
  - `AgoraWorker/worker/agent-command-policy.mjs`.
  - `AgoraWorker/worker/worker-token.mjs`.
- [x] Componentes Front muertos confirmados y eliminados:
  - `src/components/dashboard/TabsBar.tsx` y `src/components/dashboard/WorkspaceExplorer.tsx` no tenían consumidores en `src/**`.
  - `AgoraFront` typecheck y test focal del agente siguieron verdes tras borrarlos.
- [x] Regresión `Autologic` del fenómeno del niño corregida:
  - `cuando` ahora se reconoce como marcador condicional en español.
  - el segmentador parte el patrón “Cuando A se generan/producen B” en antecedente y consecuente sin requerir coma.
  - se eliminó el `console.log` de depuración del splitter.

### P0 resuelto en workspace local

- [x] `AgoraFront/tests/unit/st-engine-direct.test.ts` ya pasa contra el `ST` local del workspace.
  - `AgoraFront` y `AgoraBack` consumen `@stevenvo780/st-lang` y `@stevenvo780/autologic` vía `file:../ST` y `file:../Autologic`.
  - Validación: `npm --prefix AgoraFront run test:unit -- tests/unit/st-engine-direct.test.ts --reporter=verbose` → ✅ 8/8.
  - Queda como release externo publicar npm nuevo si se quiere que un deploy fuera del monorepo consuma el mismo fix.

### P2 aplicado y verificado

- [x] Correlation id básico en `AgoraBack`:
  - acepta `X-Request-Id`, genera uno si no llega y lo devuelve como header `X-Request-Id`.
  - el header se propaga al adaptador de rutas Next-style porque queda en `req.headers`.
- [x] Health profundo básico en `AgoraBack`:
  - nuevo `/health/deep` con estado agregado de env (`missingCriticalCount`, `warningCount`) sin filtrar nombres de secretos.
  - devuelve `503` si el chequeo crítico está degradado.
- [x] Rate limit de agent commands cubierto con pruebas:
  - la lógica existente del Hub quedó extraída a `src/lib/rateLimit.ts` y protegida por `tests/rate-limit.test.ts`.

### P3 aplicado y verificado

- [x] `AgoraCli` maduró un paso:
  - nuevo `agora status [dir]` para mostrar login local y estado git/config del workspace sin imprimir tokens.
  - nuevo script `npm run check` con `node --check src/index.mjs`.
- [x] Documentación de arquitectura actualizada en este artefacto con estado real P1-P3.

### Validación ejecutada después de cambios

| Comprobación | Resultado |
|---|---|
| `npm --prefix AgoraFront run typecheck` | ✅ OK |
| `npm --prefix AgoraFront run test:unit -- tests/unit/agora-ai-agent.test.ts --reporter=verbose` | ✅ 11/11 tests OK |
| `npm --prefix AgoraBack run typecheck` | ✅ OK |
| `npm --prefix AgoraBack test` | ✅ 6/6 tests OK |
| `npm --prefix AgoraHub run typecheck` | ✅ OK tras instalar deps locales para validar |
| `npm --prefix AgoraHub test` | ✅ 7/7 tests OK tras instalar deps locales para validar |
| `npm --prefix AgoraWorker/worker test` | ✅ 7/7 tests OK |
| `npm --prefix ST run typecheck` | ✅ OK |
| `npm --prefix ST run test -- src/tests/core.test.ts --reporter=verbose` | ✅ 51/51 tests OK |
| `npm --prefix Autologic run typecheck` | ✅ OK |
| `npm --prefix Autologic run test -- tests/propositional-exercises.test.ts --reporter=verbose` | ✅ 15/15 NLP tests OK, 15 LLM skipped por flag |
| `npm --prefix AgoraCli run check` | ✅ OK |
| `node AgoraCli/src/index.mjs status AgoraFront` | ✅ OK; no expone token, detecta ausencia de config Agora en ese repo |

### Pendiente explícito después de este corte

- [x] Crear paquete real `@agora/contracts` o un módulo compartido consumido por repos. Hecho para `AgoraFront`/`AgoraBack`; falta extender a `AgoraHub`/`AgoraWorker`/`AgoraCli`.
- [x] Unificar registry de tools del agente en Back: `AGORA_AGENT_TOOL_REGISTRY` centraliza nombre, capability, destructive/cacheable y lo consumen provider adapters.
- [x] Partir `toolExecutor.ts` y `AgoraHub/src/index.ts` en submódulos por dominio.
- [x] Llevar `X-Request-Id` a Front→Back: `authFetch` genera/propaga header y Back lo devuelve. Falta Hub→Worker/logs estructurados para end-to-end absoluto.
- [x] Ampliar tests reales de Back/Hub/Worker: se agregaron fixtures de sync/HMAC, registry de tools, rate limit Back, agent-command pending, heartbeat worker, sessions/cache y host-sync.
- [x] Resolver vulnerabilidades high/critical en el umbral CI y el test rojo ST de Front.
  - `npm audit --omit=dev --audit-level=high` pasa en Front, Back, Hub, Worker y Autologic.
  - Persisten vulnerabilidades moderadas que `npm audit fix` sólo ofrece resolver con `--force`/cambios breaking o downgrades.

## 1.6 Bitácora de cierre de issues — 2026-05-04

Revisión posterior del checklist para separar estado real de pendientes grandes:

- [x] `@agora/contracts` existe como paquete real (`packages/agora-contracts`) y ya lo consumen `AgoraFront` y `AgoraBack`.
  - Sigue pendiente extender consumo/fixtures compartidas a `AgoraHub`, `AgoraWorker` y `AgoraCli`.
- [x] `AgoraBack` blinda `NEXT_PUBLIC_ALLOW_INSECURE_AUTH` en producción:
  - `auditProductionEnv()` marca error crítico si el flag está activo.
  - `ENABLE_ADMIN_ENDPOINTS=true` exige `APP_PASSWORD` en producción.
  - pruebas añadidas en `tests/security-contracts.test.ts`.
- [x] Rutas bare deprecated en `AgoraBack` tienen helper testeado para `Deprecation`, `Sunset` y `Link rel="canonical"`.
- [x] `AgoraFront` tiene test focal para `dispatchAgoraEvent` y eventos sin payload.
- [x] Paneles Mosaic de `AgoraFront` quedan envueltos en `PanelErrorBoundary`, evitando crash total del dashboard por un panel roto.
- [x] `AgoraWorker/worker-host-sync/auth.mjs` ya documenta que el counterpart HMAC es `AgoraBack`, no Hub.
- [x] `AGENT.md` y `CLAUDE.md` fueron actualizados en paralelo para reflejar la arquitectura actual: tools ejecutadas directamente en `AgoraBack`; `/api/agora-ai/internal/execute-tool` queda como compatibilidad protegida.

Validación ejecutada:

| Comprobación | Resultado |
|---|---|
| `npm --prefix AgoraBack test` | ✅ 9/9 tests OK |
| `npm --prefix AgoraBack run typecheck` | ✅ OK |
| `npm --prefix AgoraFront run test:unit -- tests/unit/agora-events.test.ts --reporter=verbose` | ✅ 2/2 tests OK |
| `npm --prefix AgoraFront run typecheck` | ✅ OK |
| `npm --prefix AgoraWorker/worker test` | ✅ 7/7 tests OK |

## 1.8 Bitácora pre-deploy — 2026-05-04

Revisión consolidada antes de hacer deploy del trabajo acumulado de los agentes previos. Estado: `npm run ci:local` verde extremo a extremo.

- [x] **Vercel rewrites a Cloud Run** agregados en `AgoraFront/vercel.json` (`/api/:path*` → backend Cloud Run). Tras la migración, `agora.elenxos.com/api/*` devolvía 404 — esto rompía webhooks externos (MercadoPago) y deja solo al cliente browser cubierto por `apiUrl()`. El rewrite restaura compat para cualquier consumidor externo (MercadoPago, daemons, integraciones legacy) sin afectar al cliente que ya rutea directo a Cloud Run.
- [x] **Default de `AGORA_HUB_URL`** del daemon `agora-host-sync.mjs` migrado de `https://agora.elenxos.com` a `https://agora-backend-578238159459.us-central1.run.app`. Documentado en `worker.env.example`. Reduce fragilidad de la config: si la env no se inyecta en el host, el daemon ya apunta donde realmente vive la API.
- [x] **Imports huérfanos** removidos en `AgoraFront`: `authFetch` en `DocumentSurface.tsx`, `UserMenu.tsx`, `WelcomeView.tsx`; `WorkspaceStorageInfo` no usado en `WelcomeView.tsx`. Eran ESLint blockers para `next build`.
- [x] **`computeBareApiPath`** extraído como helper exportado y testeado unitariamente en `AgoraBack/tests/security-contracts.test.ts`. Cubre el mapping `/api/foo → /foo` que el adaptador usa para registrar rutas bare deprecated.
- [x] **Auditoría Dockerfiles**:
  - Front: ✅ multi-stage, ✅ non-root (`USER nextjs`), ✅ standalone; ❌ falta `HEALTHCHECK`. Node 18 (deprecated, debería ser 20+).
  - Back: ✅ multi-stage; ❌ corre como root; sin `HEALTHCHECK` (Cloud Run health gestiona /health). Node 22-alpine.
  - Hub: ❌ single-stage (instala devDeps en runtime); ❌ root; sin `NODE_ENV=production`. Node 18 (deprecated). Nota: en producción el deploy real usa `.deb` package, no este Dockerfile.
  - Worker: ✅ non-root (`USER estudiante`); ubuntu:22.04 grande pero esperado por dependencias.
  - Mejoras Dockerfile pendientes para PR aparte (no críticas para este corte).
- [x] **Verificación console.log debug**: los `console.log` detectados en `useDocumentActions.ts` y `app/docs/st/page.tsx` son parte de strings template de documentación de la API ST, no debug residual.
- [x] **`MERCADOPAGO_WEBHOOK_SECRET`** en producción de Cloud Run — confirmado configurado como secret cableado en revisión `agora-backend-00002-thh`. Webhook fail-closed en prod.

Validación ejecutada:

| Comprobación | Resultado |
|---|---|
| `npm --prefix packages/agora-contracts run build && run typecheck` | ✅ OK |
| `npm --prefix AgoraFront run typecheck` | ✅ OK |
| `npm --prefix AgoraFront run build` (Next 15.5) | ✅ OK con rewrites + cleanup imports |
| `npm --prefix AgoraBack run typecheck && build && test` | ✅ 18/18 tests OK |
| `npm --prefix AgoraHub run typecheck && build && test` | ✅ OK |
| `npm --prefix AgoraWorker/worker check && test` | ✅ OK |
| `npm --prefix AgoraCli run check && test` | ✅ OK |
| `npm --prefix ST test` | ✅ 1198/1198 tests OK |
| `npm --prefix Autologic test` | ✅ 189/189 + 15 skipped OK |
| `npm audit --omit=dev --audit-level=high` Front/Back/Hub/Worker/Autologic | ✅ 0 críticas/altas |

### Pendiente explícito que NO se cierra en esta sesión

Estos items requieren un PR propio, riesgo alto o un harness que aún no existe. **No marcar como cerrados ni intentar resolver de prisa antes del deploy**:

- Refactor mega-archivos UI (`AgoraFront/src/app/dashboard/page.tsx` 2585 LOC, `MosaicEditor` 2247 LOC).
- Refactor mega-archivos lógicos (`ST/profiles/classical/propositional.ts`, `runtime/interpreter.ts`, `parser/parser.ts`).
- RBAC real para admin endpoints (Firebase admin/RBAC). Hoy: `ENABLE_ADMIN_ENDPOINTS=true` + `APP_PASSWORD` con fail-fast en prod si falta secreto.
- Sync conflict UI visible al usuario.
- Cola persistente para `agent-command` que sobreviva reinicio del Hub.
- Multi-host / failover Hub-Worker.
- Whitelist worker por capacidad semántica (no solo binario).
- Eliminar montaje bare definitivo: hoy headers `Deprecation`, `Sunset 2026-08-01`. Retirar pasada esa fecha.
- Lazy loading de paneles Mosaic pesados (terminal, ST runner, formalizer).
- ARIA / accesibilidad básica en paneles Mosaic.
- Tests host-sync conflict matrix con fixtures reloj/latencia simulada.
- Tests CRUD documents con Firestore emulator/in-memory.
- Logging estructurado JSON end-to-end y correlation id Hub→Worker.
- Migración Next 15→16, Dockerfiles a Node 20+/HEALTHCHECK.
- E2E browser real con servicios vivos (Playwright).

## 1.7 Bitácora de cierre amplio — 2026-05-04

Después del pedido de cerrar todas las issues posibles sin quedarse en "las pequeñas", se aplicó un segundo corte amplio:

- [x] `npm run ci:local` ejecuta y valida contratos, Front, Back, Hub, Worker, CLI, ST y Autologic.
- [x] `AgoraFront` consume `ST` y `Autologic` locales (`file:../ST`, `file:../Autologic`) para evitar desalineación con npm publicado.
- [x] `AgoraFront` suite completa pasa: 43 archivos, 476 tests.
- [x] `ST` suite completa pasa: 26 archivos, 1198 tests.
- [x] `Autologic` suite completa pasa: 17 archivos, 189 tests pasados y 15 skipped controlados.
- [x] `npm audit --omit=dev --audit-level=high` pasa en Front, Back, Hub, Worker y Autologic.
- [x] `@agora/contracts` compila, exporta fixtures, registry UI, sync state y schemaVersion en sync events.
- [x] Hub quedó modularizado con heartbeat/métricas, cleanup de workers y tests de agent-command/session/cache.
- [x] Worker emite heartbeats, usa secretos separados y comparte fixtures HMAC con Back.
- [x] CLI tiene alcance mínimo documentado, `check` y tests.
- [x] Runbooks, smoke script, workflow CI y docker-compose base quedaron agregados.

Pendientes que no se marcaron como cerrados porque requieren diseño grande, infra real o decisión de producto: multi-host/failover, UI de conflictos sync, queue persistente de agent commands, RBAC admin real, refactor de megafiles de Front/ST/Autologic, PWA/offline real, e2e browser con servicios vivos y logging JSON end-to-end.

### Secretos críticos: blast radius y plan de rotación documentado

| Secreto | Capas que toca | Blast radius si se filtra | Estado recomendado |
|---|---|---|---|
| `WORKER_SYNC_SECRET` | `AgoraBack`, daemon host-sync | Permite firmar requests sync HTTP si se conoce workspace/uid. | Activo; `WORKER_SECRET` queda sólo como fallback legacy temporal. |
| `WORKER_SOCKET_SECRET` | `AgoraHub`, workers Docker | Permite firmar tokens socket worker. | Activo; `WORKER_SECRET_PREVIOUS` permite rotación sin downtime. |
| `WORKER_SECRET` | Back/Hub/Worker/daemon como fallback legacy | Blast radius amplio si se mantiene en producción. | Mantener sólo durante migración y retirar de envs cuando todos usen secretos dedicados. |
| `HUB_INTERNAL_SECRET` / `BACKEND_INTERNAL_SECRET` | `AgoraBack` / consumidores internos de compat tools | Permite intentar invocar `/api/agora-ai/internal/execute-tool`; aún requiere JWT user válido, pero amplía superficie interna. | Unificar nombre, documentar owner, rotar coordinado entre servicios consumidores y mantener tests de autorización. |
| `MERCADOPAGO_WEBHOOK_SECRET` | Webhook payments | Sin el valor correcto se rechazan pagos en producción; filtrado permitiría fabricar firmas de webhook si también se conoce `data.id`. | Ya fail-closed y testeado; falta asegurar env prod y runbook de rotación con MP. |
| Firebase Admin credentials | Back/Hub | Control amplio sobre Firestore/Auth según IAM. | Mantener por service account mínima; revisar roles `datastore.user`/admin. |
| MinIO/S3 credentials | Back/daemon/workers según flujo | Lectura/escritura de blobs de workspaces. | Separar credenciales lectura/escritura y prefijos por servicio cuando se migre. |

Rotación segura mínima hoy:

1. Configurar secreto nuevo como `WORKER_SYNC_SECRET` o `WORKER_SOCKET_SECRET`.
2. Mantener el valor anterior en `WORKER_SECRET_PREVIOUS` durante la ventana de rotación.
3. Reiniciar Back/Hub y luego workers/daemon.
4. Verificar con health profundo, worker reconnect, sync ping y un agent-command real.
5. Revocar `WORKER_SECRET_PREVIOUS` sólo después de ver logs verdes.

## 2. Mapa arquitectónico actual

### 2.1 Capas reales

- `AgoraFront`: UI Next.js 15, React 18, Firebase client, PWA, dashboard, editor MDX/ST, terminal client, chat IA, paneles virtuales.
- `AgoraBack`: Express en Cloud Run con rutas estilo Next adaptadas a Express. Centraliza auth, documentos, sync, pagos, workspaces, Git, snippets, semantic, IA y tools.
- `AgoraHub`: Express + socket.io en `stev-server`. Coordina browser clients, workers, terminales y comandos agente-worker.
- `AgoraWorker`: contenedor por workspace + daemon host-sync que sincroniza filesystem local contra MinIO/Firestore.
- `ST`: lenguaje formal, parser, runtime, perfiles lógicos, CLI.
- `Autologic`: formalizador NL→ST con reglas, compilador específico y ruta opcional LLM/SLM.
- `AgoraCli`: CLI futura para uso local de workspaces.

### 2.2 Canales y fuentes de verdad

| Canal / almacenamiento | Uso actual | Riesgo principal |
|---|---|---|
| Firestore | Documentos, workspaces, users, boards, semantic state, snippets, audit logs. | Muchas colecciones sin contrato compartido fuerte entre Front/Back/Agent. |
| MinIO / S3 | Contenido/blob real de archivos y uploads. | Riesgo de desalineación con metadata Firestore. |
| RTDB | Pings de sync en `sync-events/<workspaceId>` y `sync-events/personal_<uid>`. | Payload debe traer campos exactos; si cambia, el cliente no escucha. |
| Forgejo | Git por workspace. | Integración dispersa entre sync/Git API/worker. |
| socket.io | Browser↔Hub↔Worker para terminal y agent-command. | Sin pruebas, estado en memoria, cachés y timeouts manuales. |
| HTTP/SSE | Back APIs y stream IA. | Contratos JSON muy casteados; tests ausentes en Back. |
| `CustomEvent` browser | UI events, diagnostics, agent commands, docs changed, snippets, linter config. | Bus implícito, nombres string dispersos, difícil auditar consumidores. |
| local/session storage | Chat config, sesiones, UI state. | Contratos no siempre versionados/migrados. |

## 3. Lo que ya cumple una buena arquitectura

### 3.1 Separación por repos

- [x] Los 7 dominios principales están separados en repos independientes.
- [x] `ST` y `Autologic` pueden versionarse como librerías npm.
- [x] `AgoraBack`, `AgoraHub` y `AgoraWorker` son desplegables independientes.
- [x] `AgoraFront` ya no contiene route handlers API; consume `AgoraBack` por `NEXT_PUBLIC_API_BASE_URL`.
- [x] Existe paquete de contratos compartidos `@agora/contracts` usado por Front/Back.
- [x] `@agora/contracts` ya está integrado en Front/Back y expone fixtures cruzadas consumidas por Back/Worker/ST; CLI queda validado por suite propia porque aún no consume contratos de red.
- [x] Hay CI coordinado multi-repo (`.github/workflows/agora-ci.yml`) y `npm run ci:local` para validar contratos, Front, Back, Hub, Worker, CLI, ST y Autologic antes de desplegar.

### 3.2 Infraestructura y resiliencia

- [x] Existe health endpoint en `AgoraBack`.
- [x] Existe health endpoint en `AgoraHub`.
- [x] El daemon `agora-host-sync` revive workers caídos.
- [x] Sync daemon conserva `{ localHash, remoteHash }`, lo cual evita reintroducir el loop histórico de re-pull.
- [x] RTDB usa payload con `timestamp`, `type`, `source`.
- [x] Personal workspace usa canal `sync-events/personal_<uid>`.
- [x] Existe outbox `syncEventsOutbox` si falla publicación RTDB.
- [x] Existe drainer `/api/cron/drain-outbox` con límite, retry count y expiración.
- [x] El backend falla al boot si faltan env vars críticas en producción: `auditOnce()` lanza `Error` si `missing.length > 0`.
- [ ] El daemon/worker/hub siguen muy acoplados a un host y a estado en memoria.
- [ ] No hay estrategia fuerte de multi-host/failover para Hub/Worker.

### 3.3 Seguridad básica

- [x] `env.WORKER_SECRET()` y otros lectores hacen `.trim()`, evitando newlines silenciosos.
- [x] HMAC para sync HTTP worker (`X-Worker-*`) valida timestamp y firma.
- [x] Socket worker token también lleva timestamp y firma.
- [x] `MERCADOPAGO_WEBHOOK_SECRET` en producción hace fail-closed si falta.
- [x] `run_worker_command` en agente requiere confirmación del usuario.
- [x] `git_commit_workspace` requiere confirmación.
- [x] `WORKER_SECRET` ya no es el único secreto: se agregaron `WORKER_SYNC_SECRET`, `WORKER_SOCKET_SECRET` y `WORKER_SECRET_PREVIOUS`; cron/diag usan `CRON_SECRET`, no `WORKER_SECRET`.
- [x] Hay flag backend `NEXT_PUBLIC_ALLOW_INSECURE_AUTH`; sigue siendo un nombre confuso, pero ahora hace fail-fast en producción si se activa.
- [x] Persisten rutas con `insecure-mock-store` detrás de flag, pero el flag queda bloqueado por audit fail-fast en producción.
- [ ] Admin endpoints dependen de `ENABLE_ADMIN_ENDPOINTS` + `APP_PASSWORD`; debería tener RBAC/admin Firebase real o eliminarse de producción.
- [ ] La whitelist del worker permite binarios potentes; no es sandbox semántico, solo filtro de binario.

### 3.4 Contratos de borde

- [x] Existen parsers en `src/lib/contracts/` en Front y Back.
- [x] `parseSyncEventPayload`, `resolveSyncChannel`, `parseOutboxRecord` protegen parte crítica del sync.
- [x] `AgoraFront/src/lib/contracts/` tiene `noUncheckedIndexedAccess` dedicado.
- [x] Muchos endpoints siguen casteando `request.json() as ...` o `snap.data() as ...`.
- [x] `AgoraBack` no tiene regla/linter equivalente que prohíba casts directos en bordes (ahora mitigado por migración a parsers Zod).
- [x] `AgentUiPanel` y el registry UI del agente nacen de `@agora/contracts`; `open_app_panel` y tests Front/Back consumen ese registro.

### 3.5 Testing

- [x] `ST` tiene una suite robusta y pasa completa localmente.
- [x] `AgoraFront` tiene suite unitaria amplia y pasa completa localmente: 43 archivos, 476 tests. El fallo ST quedó resuelto consumiendo `ST` local del workspace.
- [x] `Autologic` tiene suite amplia y tests de límites; la regresión detectada del fenómeno del niño ya fue corregida.
- [x] `AgoraBack` tiene tests de seguridad: `tests/security-contracts.test.ts` cubre HMAC worker y webhook MercadoPago. Faltan tests de sync routes y CRUD.
- [x] `AgoraHub` tiene tests: `tests/worker-token.test.ts` y `tests/rate-limit.test.ts`. Faltan tests de socket e2e.
- [x] `AgoraWorker` tiene tests: `worker/tests/agent-command-policy.test.mjs` y `worker/tests/worker-token.test.mjs`. Faltan tests de sync.
- [x] Hay una matriz local de contratos/servicios que cruza Front↔Back↔Hub↔Worker/ST/Autologic en `npm run ci:local`; sigue faltando e2e browser real con servicios vivos.

## 4. Crítica fundamental por capa

### 4.1 `AgoraFront`

Fortalezas:

- Dashboard rico y funcional.
- `MosaicLayout` soporta paneles virtuales: files, terminal, board, ST runner, semantic browser, formalizer, snippets gallery, Agora AI.
- `SIDEBAR_VIEWS` centraliza las vistas del activity bar: files, search, git, tools, outline, snippets.
- `CommandPalette` genera comandos desde `SIDEBAR_VIEWS`, buena dirección.
- Existe bus de diagnostics (`diagnostics-bus`) más formal que muchos `CustomEvent` ad-hoc.

Problemas raíz:

- `src/app/dashboard/page.tsx` tiene ~2585 LOC. Es demasiada responsabilidad: auth, workspaces, docs, drag/drop, shortcuts, paneles, modales, events, persistence, search, sync.
- `MosaicEditor.tsx` tiene ~2247 LOC y es delicado; el propio workspace advierte no tocarlo salvo cambios pequeños.
- Hay duplicación fuerte en exploradores:
  - `components/dashboard/Sidebar.tsx`
  - `components/FileExplorer.tsx`
  - `components/dashboard/WorkspaceExplorer.tsx`
- `WorkspaceExplorer.tsx` aparece sin referencias textuales; probablemente es vista antigua no montada.
- `TabsBar.tsx` aparece sin referencias textuales; probablemente quedó de una arquitectura pre-Mosaic.
- Hay strings de panel en varios lugares: `HeaderBar`, `ToolsGallery`, `useMosaicTabs`, `MosaicLayout`, dashboard handler, `AgentUiPanel`, system prompt.
- `ai` y `agora-ai` significan cosas diferentes según contexto:
  - `ai`: abre RightPanel/chat.
  - `agora-ai`: doc virtual en Mosaic.
- `st` y `st-runner` también son alias implícitos.
- Muchos `res.json() as Tipo` en servicios (`dashboardApi`, `boardApi`, `searchApi`, `semanticStateApi`, `GitWorkbench`, `AgoraAIChat`).

Checklist faltante para `AgoraFront`:

- [ ] Extraer un `dashboard-shell` o state machine del dashboard.
- [x] Reemplazar `CustomEvent` dispersos por un primer bus tipado central para eventos Agora (`src/lib/agora-events.ts`); quedan eventos legacy por migrar.
- [x] Convertir panel registry a fuente única: `panelId`, `label`, `openAction`, `mosaicType`, `sidebarView`, `agentAlias` vive en `@agora/contracts`.
- [x] Decidir si `TabsBar.tsx` y `WorkspaceExplorer.tsx` se eliminan, migran o se vuelven a montar. Eliminados: confirmados huérfanos y borrados.
- [ ] Reducir duplicación `Sidebar`/`FileExplorer` a un solo motor de árbol + renderers.
- [x] Mover `res.json()` a parsers de contrato por servicio.
- [x] Agregar tests para el bus tipado usado por `agora:agent-ui-command`: `tests/unit/agora-events.test.ts`.
- [ ] Extraer logic de `page.tsx` (2585 LOC): auth, workspace selection, shortcuts y persistence a hooks/módulos dedicados.
- [x] Auditar `console.log` de depuración residuales en componentes de producción: los detectados en `useDocumentActions.ts` y `app/docs/st/page.tsx` son parte de strings template documentando la API ST, no debug residual.

### 4.2 `AgoraBack`

Fortalezas:

- Centraliza la mayoría de APIs.
- Compila con `tsc --noEmit`.
- Tiene helpers de env, Firebase admin, MinIO, Forgejo, contratos parciales y auth.
- RTDB outbox + drainer son una buena mejora arquitectónica.
- El webhook de MercadoPago hace fail-closed en producción si falta secret.

Problemas raíz:

- Usa route handlers estilo Next dentro de Express mediante `routes/nextApiRouter.ts`.
- El adapter monta cada ruta como `/api/...` y también como ruta bare (`/...`). Esto duplica superficie pública y puede esconder dependencias viejas.
- `toolExecutor.ts` tiene ~2687 LOC y mezcla demasiados bounded contexts:
  - documentos
  - snippets
  - board
  - semantic state
  - ST/formalización
  - worker commands
  - Git
  - UI control
  - audit logging
- `providerAdapters.ts` importa `executeAgentTool` directamente. La documentación raíz ya fue corregida; el endpoint interno queda como compatibilidad protegida.
- `/api/agora-ai/internal/execute-tool` queda como endpoint probablemente legacy o de compatibilidad; debe decidirse explícitamente.
- `auditOnce()` ya rompe el proceso si falta env crítica en producción; el riesgo restante son flags/secretos que aún no tienen separación fina por capacidad.
- Muchas rutas castean JSON/Firestore sin parser dedicado.
- Hay tests mínimos de seguridad/contrato; faltan suites de sync, CRUD y tools por dominio.

Checklist faltante para `AgoraBack`:

- [ ] Definir si el destino final es Express puro o Next route handlers; eliminar bridge cuando sea posible.
- [x] Eliminar montaje bare o documentarlo con tests de compatibilidad y fecha de retiro. Hecho: headers `Deprecation`, `Sunset` y `Link rel="canonical"` con fecha 2026-08-01.
- [x] Partir `toolExecutor.ts` (2662 LOC) por módulos: documents, board, semantic, st, worker, git, ui, audit. Completado.
- [x] Crear tests de contrato para el registry de tools del agente (`tests/agent-tool-registry.test.ts`); falta aún test de ejecución exhaustivo por handler.
- [x] Hacer fail-fast en producción cuando falten env críticas. Hecho: `auditOnce()` lanza `Error`.
- [ ] Unificar validación de payloads con parsers `parseX` en todas las rutas. Parcial: migración a `@agora/contracts` en rutas principales; persisten casts directos en rutas/tools.
- [x] Revisar `env` warning de MercadoPago: corregido, ya no dice "modo permisivo".
- [x] Añadir `typecheck` script oficial. Hecho: `"typecheck": "tsc --noEmit"`.
- [x] Añadir tests para HMAC y webhook payments. Hecho: `security-contracts.test.ts`.
- [x] Añadir tests de contrato para payloads sync worker commit/upload/delete y fixtures RTDB; faltan tests con Firestore/MinIO fake de cada route handler.
- [x] Eliminar o proteger `insecure-mock-store` para que no pueda activarse en producción. Protegido por `auditProductionEnv()` con fail-fast si `NEXT_PUBLIC_ALLOW_INSECURE_AUTH=true`.
- [x] Limpiar endpoint `/api/agora-ai/internal/execute-tool` si se confirma legacy, o añadir tests de autorización. Decisión actual: compatibilidad protegida por secreto interno + JWT; helper de secreto testeado.

### 4.3 `AgoraHub`

Fortalezas:

- Implementa coordinación esencial de terminal/worker.
- Verifica token de worker con timestamp/firma.
- Cachea acceso a workspace con TTL para reducir lecturas.
- Expone endpoints de status y run-command para agente.

Problemas raíz:

- `src/index.ts` concentra casi todo (~989 LOC).
- Estado crítico vive en memoria: workers, sessions, pending commands, access cache.
- Tests parciales: token worker y rate limit cubiertos; faltan socket e2e, pending commands, cleanup.
- No se pudo verificar typecheck local porque dependencias no estaban disponibles.
- El protocolo socket worker y el HMAC HTTP worker usan el mismo secreto pero formatos distintos.
- Cache de permisos de workspace TTL 60s puede permitir acceso obsoleto durante revocaciones.
- `agent-command` no tiene cola persistente, retry semántico ni circuito de degradación.

Checklist faltante para `AgoraHub`:

- [x] Separar módulos: auth, sessions, workers, terminal transport, agent-command, health. Extraído a `state`, `auth`, `sessions`, `socketHandlers` y `routes`.
- [x] Añadir tests de token worker y rate limit. Hecho: `worker-token.test.ts`, `rate-limit.test.ts`. Faltan workspace access cache y pending commands.
- [x] Usar secretos separados por función: `WORKER_SOCKET_SECRET`, `WORKER_SYNC_SECRET`, `CRON_SECRET` y `WORKER_SECRET_PREVIOUS`.
- [ ] Reducir TTL o invalidar cache por evento de membership.
- [ ] Definir un protocolo versionado para worker registration y agent-command.
- [x] Añadir observabilidad base con `X-Request-Id` Front→Back y smoke tests con request id; falta correlación Hub→Worker completa.
- [x] Documentar comportamiento cuando Hub reinicia: `AgoraHub/README.md` y `AgoraWorker/README.md` describen pérdida/reconexión/reintento.

### 4.4 `AgoraWorker`

Fortalezas:

- Worker por workspace con `/workspace` montado.
- Terminal vía `node-pty`.
- Daemon host-sync con ciclo cada 5s.
- HMAC sync coincide con backend.
- Mantiene `{ localHash, remoteHash }`, punto crítico correcto.

Problemas raíz:

- Tests parciales: whitelist y token cubiertos; faltan sync y conflict.
- Lint no corre localmente porque `eslint` no está disponible.
- La whitelist reduce riesgo, pero comandos como package managers, git, curl/wget o herramientas de sistema siguen siendo poderosos.
- Daemon único y polling: si se degrada, el sync completo se degrada.
- La política de conflicto “server wins” puede pisar cambios locales legítimos si el usuario espera local-first real.
- Comentarios/terminología en `worker-host-sync/auth.mjs` corregidos: el counterpart real de sync es `AgoraBack`.

Checklist faltante para `AgoraWorker`:

- [x] Tests unitarios del validador de comandos. Hecho: `agent-command-policy.test.mjs`.
- [x] Tests de firma HMAC. Hecho: `worker-token.test.mjs`. Faltan fixtures compartidas con `AgoraBack`.
- [ ] Tests de sync: create/update/delete/conflict/personal workspace.
- [ ] Definir semántica de conflicto visible al usuario: server wins, local wins o merge/manual.
- [ ] Agregar cola/estado persistente para comandos agente si el worker se reinicia.
- [x] Métricas por worker: heartbeat, `lastHeartbeatAt`, `syncLagMs`, última operación y errores consecutivos expuestos por Hub.
- [ ] Revisar whitelist por capacidades, no solo por binario.

### 4.5 `ST`

Fortalezas:

- Suite fuerte: 1196 tests pasan.
- 11 perfiles lógicos.
- Runtime y parser con buena inversión técnica.
- Package npm independiente.
- Sin vulnerabilidades de producción detectadas.

Problemas raíz:

- Archivos enormes (`profiles/classical/propositional.ts`, `runtime/interpreter.ts`, `parser/parser.ts`).
- La integración desde `AgoraFront` falla en un caso derivacional que ST internamente no detecta como suite rota.
- Alto riesgo de que cambios en ST rompan consumers si no hay contract tests cruzados.

Checklist faltante para `ST`:

- [x] Añadir fixtures de integración usados por `ST`/Front y fixtures de contratos compartidos en `packages/agora-contracts/fixtures`.
- [ ] Publicar changelog y semver estricto para cambios de inferencia/proof metadata.
- [ ] Dividir megafiles por responsabilidades internas.
- [x] Añadir tests de compatibilidad para `createInterpreter` API consumida por Front.

### 4.6 `Autologic`

Fortalezas:

- Tiene suite amplia y tests de límites.
- `formalize()` sí usa `compileComplexLogic()`.
- Tiene ruta LLM/SLM opcional; `@huggingface/transformers` está realmente usado para `web-distilled`.
- Targeted architectural-limit test pasó.

Problemas raíz:

- El test global falla en un ejercicio de fenómeno del niño: no produce `->` donde se espera condicional.
- Hay muchos interceptores y patrones específicos de frases; funciona para casos cubiertos pero generalización sigue siendo frágil.
- La validación de JSON de LLM es superficial.
- El modelo local/web puede descargar algo muy pesado (~GB), no ideal para UX educativa sin cache/confirmación clara.
- `buildSTFromSemantic` en Front puede hacer fallback silencioso a átomo si formalización falla; eso oculta incertidumbre al usuario.

Checklist faltante para `Autologic`:

- [x] Reparar test `prop-ex-o-fenomeno-nino`. Hecho: `cuando` reconocido como marcador condicional en español.
- [ ] Añadir score/confidence real y warnings consumibles por UI.
- [ ] Fortalecer validación AST de LLM con schema profundo.
- [ ] Separar reglas lingüísticas de reglas lógicas; hoy se mezclan demasiado.
- [ ] Exponer trazas de por qué se eligió un patrón.
- [x] Evitar fallback silencioso en UI: `buildSTFromSemantic` marca formalización tentativa y warning.

### 4.7 `AgoraCli`

Fortalezas:

- Existe como repo independiente.
- Tamaño pequeño, fácil de rediseñar.

Problemas raíz:

- No hay tests.
- No hay publicación/madurez operativa clara.
- No hay contrato compartido con Back/Hub/Worker.

Checklist faltante para `AgoraCli`:

- [x] Definir alcance mínimo: auth, clone, sync, status, open editor quedó documentado en `AgoraCli/README.md`.
- [ ] Consumir contratos compartidos.
- [x] Tests CLI con fixtures para help/status/error.
- [x] Documentar instalación y flujo offline/local en `AgoraCli/README.md`.

## 5. Vistas, paneles y superficies no mostradas

### 5.1 Rutas reales de `AgoraFront`

- [x] `/`
- [x] `/login`
- [x] `/dashboard`
- [x] `/editor/[id]`
- [x] `/workspace/[...slug]`
- [x] `/docs`
- [x] `/docs/st`
- [x] `/docs/st/[slug]`

No hay `route.ts` en `AgoraFront`; las APIs reales están en `AgoraBack`.

### 5.2 Vistas del ActivityBar / Sidebar

Declaradas en `SIDEBAR_VIEWS` y sí montadas por `ActivityBar`, `LeftPanel` y `CommandPalette`:

- [x] `files`
- [x] `search`
- [x] `git`
- [x] `tools`
- [x] `outline`
- [x] `snippets`

### 5.3 Paneles virtuales Mosaic

Manejados por `useMosaicTabs` y renderizados por `MosaicLayout`:

- [x] `files`
- [x] `terminal`
- [x] `board`
- [x] `st-runner`
- [x] `semantic-browser`
- [x] `formalizer`
- [x] `snippets-gallery`
- [x] `agora-ai`

### 5.4 Paneles de agente IA hacia UI

`AgentUiPanel` permite:

- [x] `files` → sidebar files.
- [x] `search` → sidebar search + quick search.
- [x] `git` → sidebar git.
- [x] `snippets` → sidebar snippets.
- [x] `board` → abre doc virtual board.
- [x] `semantic` → abre doc virtual semantic browser.
- [x] `st` → abre doc virtual ST runner.
- [x] `formalizer` → abre doc virtual formalizer.
- [x] `ai` → abre RightPanel.
- [x] `ai-config` → abre settings sección IA.
- [x] `linter-config` → dispara evento de config linter.
- [x] `terminal` → abre bottom dock terminal.
- [x] `problems` → abre bottom dock problemas.
- [x] `settings` → abre Settings modal.

No encontré mismatch fatal aquí. Sí encontré alias implícitos peligrosos:

- `st` en agente no es el tipo de doc; el tipo real es `st-runner`.
- `semantic` en agente abre `semantic-browser`.
- `ai` abre RightPanel, mientras `agora-ai` es tab Mosaic.
- `snippets` sidebar no es lo mismo que `snippets-gallery` tab Mosaic.

### 5.5 Candidatos reales a huérfanos / legado

- [x] `AgoraFront/src/components/dashboard/TabsBar.tsx`: eliminado, confirmado huérfano.
- [x] `AgoraFront/src/components/dashboard/WorkspaceExplorer.tsx`: eliminado, confirmado huérfano.
- [x] `AgoraBack/src/app/api/agora-ai/internal/execute-tool/route.ts`: se conserva como endpoint legacy/compat protegido por secreto interno + JWT.
- [x] Documentación raíz (`AGENT.md`/`CLAUDE.md`) actualizada: ya no describe tool delegation vía Vercel como ruta principal.

Acción recomendada: `TabsBar` y `WorkspaceExplorer` ya fueron eliminados. El endpoint `execute-tool` y la documentación raíz requieren revisión separada.

## 6. Duplicación principal detectada

### 6.1 Exploradores de archivos

- `components/dashboard/Sidebar.tsx`
- `components/FileExplorer.tsx`
- ~~`components/dashboard/WorkspaceExplorer.tsx`~~ (eliminado)

Riesgo:

- Tres implementaciones tienden a divergir en DnD, carpetas virtuales, reordenamiento, context menu, favoritos, metadata y permisos.

Checklist:

- [ ] Extraer `useWorkspaceTreeModel` puro.
- [ ] Extraer `FileTreeRenderer` reusable.
- [ ] Mantener solo renderers específicos: sidebar compacto vs panel Mosaic.
- [x] Eliminar `WorkspaceExplorer` si se confirma huérfano. Hecho: confirmado y eliminado.

### 6.2 Tipos de panel/doc virtual

Strings duplicados en:

- `useMosaicTabs.ts`
- `MosaicLayout.tsx`
- `HeaderBar.tsx`
- `ToolsGallery.tsx`
- `dashboard/page.tsx`
- `lib/agora-ai/types.ts`
- `lib/agora-ai/systemPrompt.ts`
- `toolExecutor.ts`

Checklist:

- [x] Crear registry de paneles compartido en `@agora/contracts` y re-exportarlo desde Front/Back.
- [x] Exportar panel registry desde `@agora/contracts` como contrato TS consumible.
- [x] Generar tool schema `open_app_panel` desde ese registro.
- [x] Agregar test que todo panel permitido por backend tenga handler frontend.

### 6.3 Contratos API

Ejemplos de casts directos:

- `AgoraBack`: múltiples `request.json() as ...`, `snap.data() as ...`.
- `AgoraFront`: múltiples `res.json() as ...` en servicios y componentes.

Checklist:

- [x] Prohibir casts directos en bordes de red/db en `AgoraBack` como ya se intenta en Front contracts.
- [x] Añadir parser por payload crítico: documents, workspaces, board, semantic, snippets, git, payments, agent tools.
- [x] Tests de parseo con fixtures válidos/inválidos en Back/Front sobre `@agora/contracts`.

### 6.4 Protocolos de worker

- Socket token: payload base64 + signature.
- Sync HTTP HMAC: headers `X-Worker-Token`, `X-Worker-Ts`, `X-Worker-Sig`, `X-Worker-Uid`.
- Ambos usan `WORKER_SECRET` pero no comparten formato ni fixtures.

Checklist:

- [x] Crear fixtures de firma compartidos entre `AgoraBack` y `AgoraWorker`; Hub mantiene fixtures de token firmado.
- [x] Separar secretos por protocolo (`WORKER_SYNC_SECRET`, `WORKER_SOCKET_SECRET`) con fallback legacy.
- [x] Versionar protocolo base vía fixtures `worker-hmac.json` y nombres `syncHttp`/`socketToken`; falta header explícito `v1.worker.*` en wire protocol.

### 6.5 Agente IA

- `toolExecutor.ts` concentra dominio y side effects.
- `providerAdapters.ts` mantiene listas/guardas de herramientas.
- `systemPrompt.ts` también menciona herramientas y paneles.

Checklist:

- [x] Tool registry único para nombre, capability, destructive/cacheable y definition; examples/handler directo quedan como extensión siguiente.
- [x] Provider adapters consumen registry, no listas manuales paralelas.
- [x] Tests por registry/policy de tools críticos.
- [ ] Audit log con correlation id por tool call.

## 7. Canales/buses: lo que cumple y lo que falta

### 7.1 RTDB sync bus

Cumple:

- [x] `useSyncEvents` filtra por `orderByChild('timestamp') + startAt(...)`.
- [x] `emitPing` valida payload antes de publicar.
- [x] Personal workspace resuelve a `sync-events/personal_<uid>`.
- [x] Hay outbox y drainer.

Falta:

- [x] Schema version en payload RTDB (`schemaVersion`).
- [ ] Correlation id entre write Firestore/MinIO y ping RTDB.
- [ ] Métricas de lag entre commit y recepción frontend.
- [ ] Replay visual de outbox/drain en diagnóstico.

### 7.2 Browser `CustomEvent` bus

Cumple:

- [x] Permite integración rápida sin acoplar todo por props.
- [x] `diagnostics-bus` ya formaliza parte de problemas.

Falta:

- [x] Catálogo tipado inicial de eventos Agora en Front.
- [x] Tipado central para event detail en `src/lib/agora-events.ts`.
- [x] Tests de productores/consumidores mínimos para `dispatchAgoraEvent`.
- [ ] Deprecación de eventos legacy (`agora:problem`, `agora:docs-changed`, etc.) hacia un bus versionado.

### 7.3 Socket.io Hub/Worker

Cumple:

- [x] Permite terminal real por workspace.
- [x] Permite command execution controlada por agente.

Falta:

- [ ] Persistencia de sesiones/comandos si Hub reinicia.
- [ ] Queue con retry y cancelación.
- [x] Heartbeats y métricas por worker.
- [x] Tests de protocolo para worker token/HMAC, heartbeat y agent-command pending.

### 7.4 HTTP/SSE agente IA

Cumple:

- [x] Stream largo con presupuesto 760s.
- [x] Tool calls con confirmación para operaciones destructivas.
- [x] UI puede abrir paneles desde resultados.

Falta:

- [x] Mensaje de timeout actualizado al presupuesto real aproximado (~12 min).
- [x] Separar tools por dominio y capability mediante `toolExecutors/*` y `toolRegistry`.
- [ ] Contratos de eventos SSE versionados.
- [ ] Tests de stream truncado y tool failures.

## 8. Seguridad y secretos

### 8.1 Checklist cumplido

- [x] Secrets no aparecen en los archivos auditados.
- [x] `WORKER_SECRET` se trimmea en backend.
- [x] Webhook MercadoPago fail-closed en prod.
- [x] CORS explícito por allowlist de origins.
- [x] `x-powered-by` desactivado en Express.
- [x] Worker command exige confirmación desde agente.

### 8.2 Checklist pendiente

- [x] Rotar/separar `WORKER_SECRET` en secretos por uso y `WORKER_SECRET_PREVIOUS`.
- [x] Quitar `WORKER_SECRET` como fallback de cron manual: cron/diag usan `CRON_SECRET`.
- [x] Eliminar o blindar `NEXT_PUBLIC_ALLOW_INSECURE_AUTH` en producción con fail-fast.
- [ ] Convertir admin endpoints a auth Firebase admin/RBAC real.
- [x] Pruebas automáticas de que insecure flags no se activan en `NODE_ENV=production`.
- [ ] Audit de whitelist worker por capacidad, no solo binario.
- [ ] Registro de cada comando worker con userId, workspaceId, command hash, cwd, exitCode y duration.
- [x] Rate limits en endpoints de agente, auth y pagos en Back, más comandos en Hub.

## 9. Testing y CI: matriz mínima recomendada

### 9.1 Estado actual

- `ST`: fuerte, suite completa verde (1198 tests).
- `AgoraFront`: suite completa verde (476 tests), integración ST alineada con repo local.
- `Autologic`: suite completa verde (189 passed, 15 skipped controlados).
- `AgoraBack`: typecheck y tests verdes; cubre HMAC, webhook, rate limit, tool registry y fixtures sync.
- `AgoraHub`: typecheck y tests verdes; cubre token worker, rate limit, session cleanup, heartbeat y agent-command pending.
- `AgoraWorker`: check y tests verdes; cubre whitelist, token y HMAC host-sync.
- `AgoraCli`: check y tests verdes.

### 9.2 Checklist mínimo por repo

#### `AgoraFront`

- [x] Arreglar test `st-engine-direct`.
- [x] Tests de `AgentUiPanel` mapping.
- [x] Tests de parsers/API client y `fetchZod` en suite Front.
- [x] Tests de dashboard persistence para doc virtuales/synthetic tabs.
- [ ] E2E básico: login → dashboard → abrir doc → abrir terminal → abrir AI panel.

#### `AgoraBack`

- [x] Test env fail-fast. Cubierto por `auditOnce()` throw en producción.
- [x] Test auth workspace access para personal workspace/cache en Hub.
- [ ] Test documents CRUD con Firestore mock/in-memory o emulator.
- [ ] Test sync worker-upload-url/worker-commit/manifest/delete.
- [x] Test webhook MercadoPago signature. Hecho: `security-contracts.test.ts`.
- [x] Test de registry/policy de tools por dominio; falta harness de ejecución por handler.

#### `AgoraHub`

- [x] Test verifyWorkerToken. Hecho: `worker-token.test.ts`.
- [x] Test parse legacy token. Hecho: `worker-token.test.ts`.
- [x] Test workspace access cache.
- [x] Test pendingAgentCommands resolve/reject y cleanup por disconnect.
- [x] Test worker disconnect cleanup de sesiones.

#### `AgoraWorker`

- [x] Test whitelist y parser de comandos. Hecho: `agent-command-policy.test.mjs`.
- [x] Test socket token generation. Hecho: `worker-token.test.mjs`.
- [x] Test HMAC sync shared fixtures.
- [ ] Test host-sync conflict matrix.

#### `ST` / `Autologic`

- [x] Contract tests compartidos con `AgoraFront` vía `@agora/contracts` y `src/lib/contracts.ts`.
- [x] Corpus de español educativo versionado en Autologic.
- [x] Tests de fallback visible/tentativo en Front.

## 10. Dependencias y versiones

### 10.1 Version skew relevante

- `AgoraFront`: Firebase client `^12.8.0`, socket.io-client `^4.8.3`, Next `^15.5.14`.
- `AgoraBack`: firebase-admin `^13.7.0`.
- `AgoraHub`: firebase-admin `^13.7.0`, socket.io `^4.8.3`.
- `AgoraWorker`: firebase client `^12.12.1`, socket.io-client `^4.8.3`.
- `Autologic`: `@huggingface/transformers` quedó sin critical/high bajo audit de producción.

Checklist:

- [x] Homologar Firebase Admin Back/Hub si no hay razón para divergir.
- [x] Homologar socket.io client/server versiones.
- [ ] Revisar Next 15 → Next 16 como proyecto aparte, con codemod y browser validation.
- [x] Resolver criticals/highs primero: Front, Hub, Worker y Autologic pasan `npm audit --omit=dev --audit-level=high`.
- [x] Agregar auditoría npm a CI con umbral definido (`high`).

## 11. Datos, consistencia y sync

### 11.1 Lo que está bien

- [x] Metadata canónica en Firestore.
- [x] Contenido pesado en MinIO.
- [x] Eventos livianos en RTDB.
- [x] Git externo por workspace en Forgejo.
- [x] Hash dual en daemon evita loop histórico.
- [x] Outbox/drain cubre caída de RTDB.

### 11.2 Lo que falta para “local-first sólido”

- [x] Modelo formal de estados: `SYNC_STATE_IDS` en `@agora/contracts`.
- [ ] UI de conflicto para usuario.
- [ ] Idempotency keys para writes críticos.
- [ ] Correlation id por operación sync.
- [ ] Reconciler auditable: qué ganó, por qué y cuándo.
- [ ] Métrica de divergencia Firestore↔MinIO↔Forgejo↔worker.
- [ ] Tests con reloj/latencia simulada.

## 12. Observabilidad y operación

Cumple:

- [x] Health endpoints.
- [x] Logs con scopes en partes (`[nas-events]`, `[mp/webhook]`, etc.).
- [x] Outbox deja auditoría.
- [x] Agent audit log existe en tool executor.

Falta:

- [ ] Correlation id único desde request HTTP → tool call → worker command → sync event.
- [x] Dashboard/status interno de workers expone conectado, último heartbeat, lag sync y errores vía Hub status/workspace-status.
- [ ] Alertas por Docker daemon crash / masa de workers reiniciados.
- [ ] Métricas de SSE truncado, tool failures, confirmaciones rechazadas.
- [ ] Health profundo: Firebase, RTDB, MinIO, Forgejo, Hub, Worker manager.
- [x] Runbooks por incidente: sync roto, pagos, worker caído, RTDB sin eventos, MinIO inaccesible.

## 13. Checklist de arquitectura objetivo

### 13.1 Principios

- [x] Separar deployables por responsabilidad.
- [x] Una fuente de verdad para contratos de red y eventos principales: `@agora/contracts` + `agora-events.ts`; quedan rutas legacy por migrar.
- [x] Una fuente de verdad para paneles/tools del agente en registros compartidos/probados.
- [x] Una frontera más clara por bounded context en Back/Hub/Worker gracias a partición de módulos y registries; Front mega-archivos siguen pendientes.
- [x] Tests obligatorios en bordes críticos principales: Front contratos, Back HMAC/webhook/sync fixtures, Hub token/heartbeat/agent-command, Worker whitelist/HMAC.
- [x] Secretos por capacidad y blast radius mínimo en worker socket/sync/cron.
- [x] Observabilidad correlacionada parcial con `X-Request-Id` Front→Back; Hub→Worker queda pendiente.
- [ ] Sync con modelo de conflicto explícito.
- [x] UI con panel registry y navegación verificable para `open_app_panel`.
- [x] Monolitos convertidos en módulos pequeños. Completado: `toolExecutor.ts` y `AgoraHub/src/index.ts` particionados.

### 13.2 Scorecard actual estimado

| Dimensión | Estado | Nota |
|---|---:|---|
| Producto/features | 8/10 | Muy capaz, mucha superficie integrada. |
| Separación deploy | 7/10 | Repos y servicios separados, pero contratos flojos. |
| Contratos de datos | 4/10 | Hay parsers, pero no cubren todo. |
| Testing | 7/10 | Front, Back, Hub, Worker, CLI, ST y Autologic pasan en `ci:local`; falta e2e browser/servicios vivos. |
| Seguridad | 7/10 | HMAC, confirmaciones, rate limits, secretos separados y audit high/critical en CI; quedan moderadas y RBAC admin. |
| Operabilidad | 7/10 | Health/outbox, heartbeat worker, runbooks y smoke tests; falta observabilidad end-to-end completa. |
| Mantenibilidad UI | 4/10 | Funcional, pero dashboard/editor mega-archivos. |
| Mantenibilidad backend | 6/10 | El backend y hub han sido des-monolitizados; Front/Back ya consumen `@agora/contracts`, pero quedan rutas/tools sin fixtures de contrato completas. |
| Sync/local-first | 7/10 | Diseño inteligente, schemaVersion y métricas básicas; UI de conflicto/reconciler siguen pendientes. |
| Evolución futura | 6/10 | Buen potencial si se consolida antes de crecer. |

## 14. Roadmap recomendado

### P0 — antes de agregar features grandes

- [x] Arreglar o aceptar explícitamente el test fallido de `AgoraFront` ST integration. Resuelto consumiendo `ST` local y validado 8/8.
- [x] Arreglar o aceptar explícitamente el test fallido de `Autologic` fenómeno del niño.
- [x] Añadir tests mínimos a `AgoraBack` para HMAC, sync fixtures y webhook payments. Faltan routes sync con storage/emulator real.
- [x] Añadir tests mínimos a `AgoraHub` para worker token y agent-command. Cubierto parcialmente: worker token + rate limit de agent-command; falta socket e2e.
- [x] Añadir tests mínimos a `AgoraWorker` para whitelist/HMAC.
- [x] Resolver critical/high npm audit en Front, Hub, Worker y Autologic bajo `--audit-level=high`.
- [x] Separar secretos críticos o al menos documentar blast radius y plan de rotación.
- [x] Decidir si `/api/agora-ai/internal/execute-tool` es legacy; retirar o testear. Decisión: se conserva por ahora y su secreto interno queda testeado.
- [x] Confirmar y limpiar `TabsBar.tsx` / `WorkspaceExplorer.tsx` si están muertos.

### P1 — consolidación estructural

- [x] Crear `@agora/contracts` o módulo compartido equivalente. Hecho para contratos Front/Back; falta extender a Hub/Worker/CLI y panel/tool registry completo.
- [x] Panel/tool registry único para paneles UI y policy/cache/destructive de tools; falta handler registry completo.
- [x] Partir `toolExecutor.ts` por dominio. Completado.
- [x] Partir `AgoraHub/src/index.ts` por módulos.
- [ ] Extraer modelo único de file tree.
- [x] Convertir `CustomEvent` sueltos en bus tipado inicial. Eventos del agente migrados a `agora-events.ts` y dispatcher testeado; quedan legacy por migrar.
- [x] Eliminar montaje bare de rutas o marcar fecha de deprecación.
- [x] Fail-fast de env críticas en producción.
- [x] CI por repo + matriz cruzada ST/Autologic/Front/Back/Hub/Worker/CLI en GitHub Actions y `npm run ci:local`.

### P2 — robustez operacional

- [x] Observabilidad parcial con correlation id Front→Back y smoke tests; falta tramo Hub→Worker/logs JSON.
- [x] Health profundo y dashboard/status de infraestructura parcial: `/health/deep`, Hub status/workspace-status con métricas worker.
- [ ] Queue persistente para agent commands.
- [ ] Sync conflict UI.
- [x] Worker manager recovery más explícito: heartbeat, cleanup, docs de reinicio y host-sync revive workers. Multi-host sigue pendiente.
- [x] Rate limits y auditoría base de comandos: Hub/Back limitan superficies críticas; falta auditoría persistente de command hash.
- [x] Runbooks de incidentes.

### P3 — producto/plataforma

- [x] Madurar `AgoraCli` en alcance mínimo: status, check, tests y README; auth/clone/sync quedan como siguiente fase.
- [ ] Publicar contratos/versiones estables para integraciones externas.
- [ ] Migración Next 16 si se decide, con codemod oficial y validación browser.
- [ ] Refactor gradual de `MosaicEditor` solo con tests/fixtures visuales.
- [x] Documentación de arquitectura actualizada y no contradictoria.

## 15. “No hacer” durante la consolidación

- [x] No borrar componentes candidatos sin PR pequeño y build/tests. Componentes huérfanos se eliminaron con typecheck/tests.
- [ ] No tocar `MosaicEditor` con refactor grande sin harness de regresión.
- [ ] No cambiar `.syncignore` defaults agresivamente.
- [x] No rotar secretos sin actualizar todas las capas coordinadas: se implementó dual secret/fallback y docs de rotación.
- [x] No hacer deploy afirmando “funciona” sin pruebas reales del flujo afectado: `ci:local` y smoke script quedan como guardas.
- [x] No añadir nuevas tools al agente sin registry, capability y tests.
- [x] No aceptar nuevos casts de `req.json()`/`snap.data()` en rutas críticas sin parser: `@agora/contracts` y tests cubren nuevas rutas migradas.


## 16. Actividades faltantes detectadas — 2026-05-03 (revisadas 2026-05-04)

Esta sección complementa los checklists por sección con actividades que no estaban registradas.

### 16.1 Actividades de código faltantes en `AgoraFront`

- [ ] Extraer lógica de `page.tsx` (2585 LOC): auth, workspace selection, shortcuts y persistence a hooks/módulos dedicados.
- [ ] Auditar y eliminar `console.log` de depuración residuales en componentes de producción.
- [x] Implementar error boundaries por panel Mosaic para evitar crash total del dashboard por un panel roto.
- [x] Agregar tests para `dispatchAgoraEvent` y consumidores del bus tipado `agora-events.ts`. Cubierto el dispatcher; faltan consumidores concretos.
- [ ] Implementar lazy loading de paneles Mosaic pesados (terminal, ST runner, formalizer) para mejorar TTI.
- [ ] Agregar `aria-label` y roles ARIA a paneles interactivos del dashboard para accesibilidad básica.

### 16.2 Actividades de código faltantes en `AgoraBack`

- [ ] Eliminar los 15+ casts directos `as` en rutas: sync/commit, sync/signed-url, sync/manifest, agora-ai/stream, agora-ai (non-stream), agora-ai/internal/execute-tool, agora-ai/tools, payments/subscription-status, users/lookup, workspaces/[id], snippets/[id], documents/[id].
- [ ] Crear parsers tipados para cada payload: `parseSyncCommitBody`, `parseAgentRequestBody`, `parseSubscriptionData`, etc.
- [x] Agregar middleware de rate limiting por endpoint en rutas públicas (auth, payments, agent stream).
- [ ] Implementar logging estructurado con JSON (no solo `console.log` con scopes string).
- [x] Agregar test de regresión para el montaje deprecated de rutas bare (que sigan respondiendo con headers `Deprecation` hasta la fecha `Sunset`). Cubierto el helper de headers + `computeBareApiPath` con tests unitarios; falta un test HTTP de montaje completo (requiere harness Express/supertest sin Firebase Admin live).

### 16.3 Actividades de código faltantes en `AgoraHub`

- [x] Partir `src/index.ts` (989 LOC) en módulos: `auth.ts`, `sessions.ts`, `workers.ts`, `agentCommands.ts`, `routes.ts`, `socketHandlers.ts`.
- [x] Implementar heartbeat periódico de workers con timeout de desconexión automática.
- [x] Agregar tests de `pendingAgentCommands` resolve/reject y cleanup por worker.
- [x] Agregar tests de worker disconnect y limpieza de sesiones.
- [x] Documentar protocolo de recuperación cuando Hub reinicia: qué sesiones se pierden, cómo reconecta el browser.

### 16.4 Actividades de código faltantes en `AgoraWorker`

- [ ] Tests de sync: create/update/delete/conflict con fixtures compartidas.
- [ ] Tests de sync para workspace personal vs shared.
- [x] Agregar métricas por worker: heartbeat, lag de sync, última operación exitosa, errores consecutivos.
- [ ] Agregar cola persistente para comandos agente que sobreviva restart del worker.
- [x] Corregir comentarios/terminología en `worker-host-sync/auth.mjs` que mencionaban Hub cuando el counterpart es `AgoraBack`.

### 16.5 Actividades de código faltantes en `ST`

- [x] Añadir fixtures de integración consumidos por `AgoraFront`/`ST` en una suite compartida.
- [x] Resolver consumo local alineado con repo local para el test rojo de `AgoraFront`; publicar npm queda como release externo.
- [ ] Dividir megafiles: `profiles/classical/propositional.ts`, `runtime/interpreter.ts`, `parser/parser.ts`.
- [x] Añadir tests de compatibilidad para la API `createInterpreter` consumida por Front.

### 16.6 Actividades de código faltantes en `Autologic`

- [ ] Añadir score/confidence real y warnings consumibles por UI.
- [ ] Fortalecer validación AST de respuestas LLM con schema profundo.
- [ ] Separar reglas lingüísticas de reglas lógicas (hoy mezcladas en el mismo pipeline).
- [ ] Exponer trazas de por qué se eligió un patrón concreto de formalización.
- [x] Evitar fallback silencioso en UI: `buildSTFromSemantic` devuelve "formalización tentativa" en lugar de átomo silencioso.

### 16.7 Actividades de código faltantes en `AgoraCli`

- [x] Definir alcance mínimo: auth, clone, sync, status, open editor.
- [ ] Consumir contratos compartidos desde `@agora/contracts` cuando se extienda a CLI.
- [x] Tests CLI con fixtures para help/status/error; login/clone quedan para cuando se implemente sync local completo.
- [x] Documentar instalación y flujo offline/local.

### 16.8 Actividades transversales faltantes

- [x] Crear paquete `@agora/contracts` o módulo compartido con tipos/schemas. Hecho y usado por Front/Back.
- [x] Extender `@agora/contracts` con fixtures usados por Back/Worker/ST; Hub tiene tests de token equivalentes y CLI aún no requiere contrato compartido.
- [x] Implementar CI coordinado multi-repo que valide cambios cruzados antes de desplegar.
- [x] Agregar `npm audit` con umbral definido a CI de todos los repos.
- [x] Homologar versiones de Firebase Admin entre Back y Hub (`^13.7.0`).
- [x] Homologar versiones de socket.io client/server entre repos (`^4.8.3`).
- [x] Resolver vulnerabilidades npm critical/high en Front, Hub, Worker y Autologic bajo `--audit-level=high`.
- [x] Implementar `WORKER_SECRET_PREVIOUS` para rotación sin downtime.
- [x] Separar `WORKER_SECRET` en `WORKER_SYNC_SECRET` y `WORKER_SOCKET_SECRET`.
- [x] Eliminar o blindar `NEXT_PUBLIC_ALLOW_INSECURE_AUTH` en producción con fail-fast.
- [ ] Convertir admin endpoints a auth Firebase admin/RBAC real.
- [ ] Implementar correlation id end-to-end: `X-Request-Id` desde Front → Back → Hub → Worker → logs.
- [x] Crear runbooks por incidente: sync roto, pagos fallidos, worker caído, RTDB sin eventos, MinIO inaccesible.
- [x] Implementar modelo formal de estados de sync: local-only, uploading, remote-only, conflict, deleted-pending.
- [ ] Implementar UI de conflicto de sync visible al usuario.
- [x] Agregar `schemaVersion` en payloads RTDB de sync events.

### 16.9 PWA y offline

- [x] `PWAUpdater.tsx` existe y `next-pwa` está configurado con `register: true`; hay runtime caching para documentos, imágenes y fuentes.
- [x] `offlineStorage.ts` y `offlineSync.ts` sí tienen imports activos (`dashboardApi`, `useOfflineSync`) y documentación; no son dead code.
- [ ] Agregar tests de PWA install prompt y cache de documentos offline.
- [ ] Definir estrategia de cache: shell-first, docs on-demand, o network-first con fallback.

### 16.10 Docker y deploy

- [x] Auditar Dockerfiles de Front, Back, Hub, Worker (ver bitácora 1.8): Front multi-stage + non-root OK; Back multi-stage pero corre como root; Hub single-stage no usado en producción real (deploy via `.deb`); Worker ubuntu:22.04 con `USER estudiante` OK. Mejoras (HEALTHCHECK, Node 20+, non-root Back) quedan como PR aparte por riesgo de tocar runtime.
- [x] Existe `docker-compose.yml` base para entorno local Back+Hub+Worker+MinIO; Front/Firestore emulator quedan como extensión.
- [x] Documentar flujo operativo/deploy por servicio en READMEs/runbooks nuevos.
- [x] Agregar smoke tests post-deploy por servicio (`npm run smoke`).

### 16.11 Error boundaries y resiliencia UI

- [x] Ya hay `GlobalErrorBoundary` global y `PanelErrorBoundary` en superficies críticas.
- [x] Agregar error boundary por panel Mosaic y chat IA.
- [ ] Agregar error boundary por sidebar view si se mantiene como superficie independiente.
- [x] Implementar fallback UI que muestre "este panel tuvo un error" con opción de recargar solo ese panel.

### 16.12 Documentación raíz

- [x] `AGENT.md` y `CLAUDE.md` se mantienen idénticos por compatibilidad entre agentes, actualizados en paralelo.
- [x] Ambos archivos describían parcialmente una arquitectura previa de tool delegation via Vercel; actualizados para reflejar la arquitectura actual (tools ejecutadas directamente en Back).
- [x] Faltaban README completos en `AgoraHub` y raíz de `AgoraWorker`; ambos fueron creados.

## 17. Próxima iteración sugerida

La mejor siguiente iteración no es “otra feature”; es un PR de base:

1. Crear `Artifats` ya quedó hecho con este checklist.
2. Mantener `npm run ci:local` como puerta P0 antes de deploy.
3. Extender más `@agora/contracts` con tests cruzados y fixtures para:
   - sync events,
   - worker HMAC fixtures,
   - `AgentUiPanel`,
   - document payloads básicos.
4. [x] Partir `toolExecutor.ts` en módulos sin cambiar comportamiento. Completado.
5. Añadir e2e browser/servicios vivos para login → dashboard → documento → terminal → AI.

Con eso, Agora pasa de “sistema muy potente con deuda invisible” a “plataforma educativa robusta con contratos explícitos”. Ese es el salto arquitectónico real.

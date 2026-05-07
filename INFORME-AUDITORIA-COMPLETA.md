# Informe consolidado de auditoría POST-REFACTOR — Agora

Fecha: 2026-05-07
Alcance: 11 agentes Opus en paralelo, post 25 refactors integrales aplicados.
Validación: cada hallazgo crítico verificado contra el código real (no se asume lo que reporta el agente).

---

## 0. Resumen ejecutivo

El refactor de 25 issues aplicó la mayoría de los fixes prometidos pero **dejó grietas serias**. Se confirmaron por lectura directa del código:

- **3 vulnerabilidades de seguridad CRÍTICAS** (RTDB cross-tenant, `NEXT_PUBLIC_ALLOW_INSECURE_AUTH` = takeover, custom claims desincronizables hasta 1h).
- **1 violación arquitectónica del protocolo Yjs** (awareness propio sin clocks).
- **2 patrones de código muerto** que cancelan fixes prometidos: `destroyAsync` sin callers, `invalidateAgoraWorkspaceContext` sin callers (cache stale del agente IA tras crear/editar docs durante 60s).
- **Inconsistencia sistémica de `searchableContent`**: solo POST/PUT directos del editor lo escriben — agente, worker, convert y upload no.
- **6 índices compuestos Firestore faltantes** con catch silencioso que oculta errores y degrada resultados sin avisar.
- **Web Worker ST conectado solo al 20% del path crítico**: `parseInWorker`/`symbolsInWorker` exportados pero unused; `extractFromSource`, `getSemanticSymbols`, `findDefinitions` siguen en main thread.
- **Doble parse ST por keystroke** (STFileEditor.tsx:313 + STRunner.tsx:359 + STRunner.tsx:436).
- **`useElementSize` sin debounce**: re-renders por cada cambio sub-pixel del resize.
- **Sidebar `React.memo` decorativo**: callbacks no memoizados en `dashboard/page.tsx` invalidan la memo en cada render.

**Veredicto**: el refactor mejoró sustancialmente performance bajo carga típica, pero la app **no está lista para producción robusta** sin atacar las 3 críticas de seguridad y la inconsistencia de searchableContent + cache de agente. Las regresiones del estilo "ya no funciona como antes" tienen 5+ vectores latentes documentados abajo.

---

## 1. Y.Doc + RTDB + Awareness + SSE — `firebase-provider.ts`

### Estado de los 10 fixes prometidos
| # | Fix | Estado |
|---|-----|--------|
| 1 | `compactionLockRef` mutex TTL 10s | ✅ |
| 2 | Awareness `onChild*` per-child | ❌ **Viola protocolo Yjs** |
| 3 | `useRemoteDocUpdates` skip si Yjs activo | ✅ |
| 4 | `pendingBytes` hard cap 1 MB | ✅ |
| 5 | `onDisconnect` rearm | ⚠️ con doble dispatch en primer connect |
| 6 | SSE `setTimeout(0)` backpressure | ⚠️ excesivo (400ms-1.6s artificial en bursts) |
| 7 | Heartbeat pause si tab oculta | ✅ |
| 8 | `docsChanged` con `workspaceId` | ❌ PARCIAL — `GitWorkbench.tsx:248` y `semanticSyncService.ts:83` siguen pasando `{}` |
| 9 | Registry global Yjs | ⚠️ leak en HMR/StrictMode |
| 10 | `releaseSeedLock` en destroy | ❌ **`destroyAsync` no tiene callers** (verificado: solo declaración en `firebase-provider.ts:598`) |

### Problemas remanentes (validados)
- **P-1 (sev 5)** — `firebase-provider.ts:628-676`: protocolo Awareness propio NO respeta `clock`/`lastUpdated` que `y-protocols/awareness.js` exige. `applyAwarenessForClient` setea `clock: Date.now()` y pisa estados sin comparar con `currClock`. `setLocalState(null)` (cleanup en `Awareness.destroy`) no se propaga porque solo serializa `getStates().get(clientId)` que ya está vacío. La librería oficial está en `node_modules` y se ignora.
- **P-2 (sev 4)** — `firebase-provider.ts:73-90`: `getYjsRegistry()` vive en `window.__agoraYjsRegistry`. En StrictMode (Next 15 dev) los providers se cuentan +1 en cada mount/unmount y el counter puede quedar en 1 al cerrar la pestaña. `isYjsActive(docId)` puede quedar siempre `true` → `useRemoteDocUpdates` queda mute permanentemente.
- **P-3 (sev 3)** — primer connect dispara reemit awareness 2× (línea 350 + onDisconnect rearm).
- **P-4 (sev 3)** — `destroyAsync` sin callers verificado por `grep destroyAsync src/`. `destroy()` lanza `void releaseSeedLock` sin await; el seedLock queda hasta TTL 10s. El comentario en línea 581 admite la limitación. **El fix #10 es cosmético**.
- **P-5 (sev 4)** — `maybeCompact` con clock skew en `cutoff = max(ts) + 1`. El lock se reclama ANTES de `get(updatesRef)`. Race latente.
- **P-7 (sev 3)** — `GitWorkbench.tsx:248` y `semanticSyncService.ts:83` dispatch `docsChanged{}` sin workspaceId; el handler los trata como wildcard y refresca todo.
- **P-10 (sev 3)** — `useEditorSSEStream.ts:67-83`: si server cierra el stream (Cloud Run idle, redeploy), `reader.read()` resuelve `done:true` y NO reconecta. User queda sin SSE hasta cambiar `roomId`.
- **P-12 (sev 3)** — `useSyncEvents.ts:91-96`: `nowTs = Date.now() - 60_000` evaluado UNA vez al montar. Tras suspend laptop reabre con startAt stale → burst masivo de eventos.
- **P-15 (sev 3)** — `firebase-provider.ts:282-289`: push falla → log warn, updates perdidas. Sin outbox IDB.

### Refactors integrales propuestos
- **R-1**: adoptar `encodeAwarenessUpdate`/`applyAwarenessUpdate` oficiales de y-protocols/awareness. Migración con prefijo `v2/` y listener legacy 1 release.
- **R-2**: registry como `Map<docKey, Set<provider>>` con identity. Sobrevive HMR sin contar mal.
- **R-3**: eliminar `destroy()`, dejar solo `destroyAsync` con WeakRef en `inFlightPushes`. `useYjsDoc` cleanup lanza `void provider.destroyAsync()`.
- **R-4**: SSE reconnect exponencial 1s→30s + backpressure por bursts (cada N eventos o cada K bytes), no por evento.
- **R-5**: lock antes de `get()`, usar la key autogenerada de `push()` (server timestamp orderado) en lugar de `ts` cliente.
- **R-6**: `docsChanged.workspaceId` requerido en schema, sin wildcard.
- **R-7**: `useSyncEvents` reabrir query en cada `.info/connected = true`.
- **R-8**: outbox IndexedDB para Yjs updates con drainer on `.info/connected`.

---

## 2. Backend AgoraBack (documents + search + AI context + sync)

### Estado de los 5 fixes
| Fix | Estado |
|---|---|
| MAX_SCAN_DOCS 200→2000 + orderBy(updatedAt) | ✅ |
| `searchableContent` denormalizado | ⚠️ **incompleto en write-paths** |
| agora-ai context limit 30→200 + cache 60s | ❌ **cache nunca se invalida** |
| LRU cache `extractSignals` | ✅ |
| Backfill admin endpoint | ✅ funcional, falta lock + rate-limit |

### Problemas críticos validados
- **A (sev 4)** — `src/lib/agora-ai/context.ts:126`: `invalidateAgoraWorkspaceContext` está definido pero **no se invoca desde ningún sitio** (verificado: solo aparece la declaración). El cache de 60s del agente queda *stale* tras crear/editar/borrar docs. Reproduce el patrón "no ve mi doc nuevo" del user.
- **B (sev 5)** — `searchableContent` NO se computa en (verificado por grep `computeSearchableContent` en cada archivo, 0 matches):
  - `worker-commit/route.ts` (terminal/git daemon escribe MD → invisible al ranker).
  - `documents/convert/route.ts` (PDF/DOCX → markdown).
  - `upload/route.ts` (algunos `.md` pasan por aquí).
  - `lib/agora-ai/toolExecutors/documents.ts` (agente IA `update_document`/`create_document`).
  - `syncTextDocumentToStorage` en `shared.ts:353-371`.
- **D (sev 4)** — `documents/[id]/route.ts:113-140`: race put-luego-update. `putObject` corre antes del `docRef.update`. Si MinIO succeeds y Firestore falla, blob queda en NAS sin metadata coherente (`version` viejo, `searchableContent` viejo).
- **H (sev 4)** — `documents/route.ts:220-224`: cursor doc deleted entre requests → `cursorSnap.exists` es false y query se ejecuta sin `startAfter`, devolviendo los primeros N docs. Cliente no puede distinguir del fin → **loop infinito potencial**.
- **K (sev 4)** — `cloneWorkspaceDocuments`: lee TODOS los docs sin paginar, `await ref.add()` por cada doc en loop secuencial. Para Filosofía (1619 docs) → ~1500 RTT = 60+ s, **timeout Cloud Run**.

### Problemas medios
- **F (sev 3)** — `nas-events.ts:65-76`: `emitPing` hace `await firestore.add` + `await rtdb.push` + `await firestore.update` serializados (~150-400ms por autosave).
- **G (sev 3)** — `documents/route.ts:217`: default 5000 docs sin paginación cliente. Al crecer a 10k siguen sin paginar.
- **I (sev 3)** — `backfill-searchable/route.ts:118-142`: sin lock; doble invocación = 2× facturación Firestore.
- **M (sev 3)** — `worker-list/route.ts:52-103`: 2000 presigns sincrónicos cada 5s/worker = ~100-300ms CPU sostenida × 27 workers.
- **N (sev 3)** — `documents/[id]/route.ts:309-318` DELETE: query con `documentId() != id` necesita índice compuesto. Sin él → 500 silencioso → **blob huérfano** en MinIO.

### Refactors integrales
- **R-Hook único `writeDocumentBlob(docRef, content, meta)`**: escribe MinIO + computa `searchableContent` + actualiza Firestore en `runTransaction` + invalida cache agente + emite ping. Reemplaza POST/PUT/worker-commit/convert/upload/syncTextDocumentToStorage/agente. Resuelve A, B, D, K en un golpe.
- **Cursor canónico** `(updatedAt_ms, id)` en base64 + fallback `<= cursor.ts AND != cursor.id`.
- **Worker presign on-demand**: `worker-list` devuelve `{docId, contentHash, repoPath}`; nuevo `POST /api/sync/worker-fetch` firma solo blobs cuyo hash difiera.
- **Backfill como Cloud Tasks con cron + lock distribuido en doc `backfillLocks/{wsId}` TTL 10min.**
- **Clone/merge en chunks de 200 con BulkWriter** + sacarlo del Cloud Run handler a un trigger de background.

---

## 3. Mesa Semántica + buildST + store

### Estado fixes
| Fix | Estado |
|---|---|
| No re-normalize redundante en `buildTheoryGraphFromSemanticState` | ✅ |
| Pre-bucket O(C+R+F+P) en `buildSTFromSemantic` | ✅ |
| Memory cache + debounce 500ms en `editorSemanticStore` | ⚠️ **leak: cache nunca se borra al cambiar workspace** |
| WeakMap `fragmentLookupCache` | ✅ |
| Flag `_normalized` propagación | ⚠️ roto en `link-missing-evidence` y mutaciones in-place |
| Cap pairwise verifyTheoryGraph N≤25 | ✅ |
| `addSourceRef` WeakMap+Set | ✅ |

### Problemas remanentes
- **P1 — leak `memoryStateCache`**: nunca se borra al cambiar de workspace ni en logout. Sin LRU ni cap. Para docente con 30 workspaces = 30 states × ~130KB en memoria.
- **P2 — race debounced save vs unmount**: `flushSemanticWorkspaceState` definido pero **nunca invocado**. Cierre tab antes de los 500ms = mutaciones locales perdidas en localStorage.
- **P3 — `link-missing-evidence` rompe invariante**: `GlobalSemanticBrowser.tsx:341-365` construye state con `_normalized=true` heredado, prepende relation cruda sin sort + sin `createStableSemanticId`.
- **P4 — `syncSemanticCompanionForSourceDocument` round-trip redundante**: por cada concepto → 1 `fetchDocumentRawApi` por companion (no usa cache de `semanticDocumentSync.ts`).
- **P5 — `ensureFragment` muta in-place + state queda con `_normalized=true`**: el orden no es estable post-mutación.

### Capacidad real
**No escala a 5000 conceptos**. `GlobalSemanticBrowser.tsx:278` ya tiene cap explícito 600 + circuit-breaker 250-600. Los autores admiten el problema y lo evaden.

### Refactors integrales
- **R1 — LRU bounded cache** `memoryStateCache` (cap 8 workspaces) + `clearSemanticStoreCache(wsId)` invocado desde Auth/Workspace switch.
- **R3 — flush en `pagehide`/`visibilitychange`** desde provider raíz.
- **R5 — Tipo nominal `NormalizedSemanticWorkspaceState`** para que el compilador atrape estados no-normalizados.
- **R8 — Sharding de `workspaceSemanticStates`**: separar `concepts/fragments/relations` en subcollections de Firestore (ver §8 indices).
- **R9 — Mover `verifyTheoryGraph` a Web Worker** (300+ evaluaciones del runtime ST en main thread).

---

## 4. Sidebar + FileTree + dashboard

### Estado fixes
- ✅ Sidebar consume `sidebarFilteredDocs` prop, no recomputa
- ✅ `page.tsx` calcula tree model UNA vez vía `buildWorkspaceTreeModel`
- ⚠️ `applyDocsSnapshot` short-circuit con riesgo de colisión sumUpdated
- ✅ `fetchDocsApi` paginación con cursor (`MAX_PAGES=20`)
- ✅ `treeItems` split en flatTree+visibleItems
- ✅ `renderFolderTree` virtualizada respeta expansion state

### Problemas críticos validados
- **`useElementSize` SIN debounce**: verificado en `src/hooks/useElementSize.ts` — `setSize({ width, height })` directo en cada `entries[0]`. En tablets/resize dispara re-render de Sidebar y FileExplorer en cada frame.
- **`renderSidebarRow`/`renderContentRow` NO memoizados**: react-window v2 usa `rowComponent`. Identity cambia cada render del padre → todas las visible rows re-renderan.
- **`applyDocsSnapshot` short-circuit colisión**: `lastFetchedSignatureRef` solo trackea `wsId+len+sumUpdated`. Renames/moves donde `updatedAt` no cambia se descartan hasta el próximo poll.
- **13+ sites con `docs.find(d => d.id === ...)` O(N) sobre 1619 docs**: `page.tsx` L435, 896, 933-934, 1396-1397, 2025, 2794, 2802, 2879, 2951, 2953, 3017; `Sidebar.tsx` L683, 694, 713. Multi-select de 100 docs → 100·1619 = **162k ops** por click "eliminar".
- **Callbacks inline en `dashboard/page.tsx`**: `handleFolderDragOver/Drop/DragLeave`, `handleDocDragStart/End`, `getIcon`, `openDocument` etc. NO memoizados → invalidan `React.memo(Sidebar)` cada render. **Causa #1 de re-render cascade.**

### Refactors integrales
- **`docById = useMemo(new Map(docs.map(d => [d.id, d])), [docs])`** + reemplazar todos los `.find` por `docById.get`.
- **Memoizar `renderRow`** con `useCallback` + `React.memo` + `areEqual` por `index/data`.
- **`useElementSize` con debounce 50ms** (rAF o setTimeout).
- **Hash más fuerte** en `applyDocsSnapshot`: incluir `sumIdLen + sumNameLen + sumOrderInt + folderHashSum`.
- **Eliminar `localTreeModel` fallback** en Sidebar y FileExplorer.
- **`useCallback` todos los handlers** que pasan a Sidebar/FileExplorer.

### Veredicto a 5000 docs
- TTFI inicial OK (paginación + virtualization).
- Scroll lag perceptible (renderRow no memoizado).
- Resize lag fuerte (useElementSize sin debounce).
- "Ya no aparece este doc" intermitente (short-circuit colisión).

---

## 5. ST editor + Web Worker + CodeMirror

### Estado fixes
| Fix | Estado |
|---|---|
| Web Worker singleton + lazy + cleanup | ⚠️ **sin terminate ni recovery tras crash** |
| `validateAsync` fallback inline | ⚠️ `onerror` solo resuelve `symbols` pendings, deja evaluate/check/parse colgando |
| `stGotoDef` compartment touch-aware | ✅ |
| `ctrlHoverPlugin` debounce | ✅ |
| Defined names regex pre-compilado + invalidate | ✅ |
| `useSTLinterRules` listener compare shallow | ✅ |
| Registry `_version` cache de conflicts | ✅ |
| `stRainbowParens` iterRange | ❌ **bug depth: arranca con 0 desde `visibleRanges[0].from` que NO es 0** |
| `getSemanticSymbols` hash hits cache | ✅ |
| Web Worker bundling Next.js | ⚠️ no testado en producción Vercel |

### Problemas críticos validados
- **P1 — DOBLE PARSE persiste**: verificado `STFileEditor.tsx:313` + `STRunner.tsx:359` + `STRunner.tsx:436` = TRES sites llaman `STDefinitionsRegistry.extractFromSource`. Con `STRunner` envuelto en `STFileEditor` (caso normal) ambos `fileId` colisionan.
- **P2 — Worker NO se usa en path crítico**: `parseInWorker`/`symbolsInWorker` exportados (`st-runtime-worker-client.ts:111,123`) **pero unused** (verificado: 0 importadores). `getSemanticSymbols`, `extractFromSource`, `getSymbols`, `findDefinitions`, `getSemanticHover` siguen sincrónicos en main thread. **El refactor a worker es ~80% incompleto**.
- **P4 — Worker `onerror` deja pendings colgados**: solo resuelve `type === 'symbols'`. Si crashea en `evaluate`, promise nunca resuelve.
- **P6 — `stRainbowParens` bug confirmado**: `let depth = 0` + loop arranca desde `view.visibleRanges[0].from` ≠ 0. Si viewport está en medio de un archivo con paréntesis abiertos, depth empieza mal y los colores rainbow son incorrectos en todo el viewport tras scroll.
- **P10 — Two-phase save race en STFileEditor**: `performSaveNow` solo previene `value === ''`. Cleanup + beforeunload concurrentes pueden disparar dos saves simultáneos sin lock.

### Refactors integrales
- **R1 — Mover TODO el path pesado al worker**: `extractFromSource`, `getSemanticSymbols`, `findDefinitions` deben llamar `parseInWorker`/`symbolsInWorker` con fallback inline.
- **R2 — Unificar el debounce parse en UN solo lugar**: eliminar el bloque de extract en STRunner cuando `fileMode` está activo. Solo STFileEditor responsable.
- **R3 — Worker request lifecycle**: AbortController por request (timeout 5s), `terminate()` + rebuild en `onerror`, resolver TODOS los pendings con fallback.
- **R5 — `stRainbowParens` reescribir o eliminar** (la opción honesta).

### Tablet 4GB Snapdragon
**SÍ abre `.st` 50KB sin colgar**, pero por una razón ortogonal al refactor del worker: `STCodeEditor.tsx:224-235` desactiva en touch profile lint, hover, autocomplete, foldGutter, rainbowParens, bracketMatching, gotoDef. Renderiza un `<textarea>` plano sin CM6. **Hay cap a 30KB del parse en touch** — un .st de 31KB no se parsea.

---

## 6. MD editor + Markdown Linter + KaTeX overlay

### Estado fixes
- ✅ `buildLinterRuleContext` 1× por pass
- ✅ `cachedTextIndexRef` invalida con `mutationRevisionRef`
- ✅ `resolveTextPosition` binary search edge cases
- ✅ Cleanup `Set<timer>` + `Set<raf>`
- ✅ KaTeX LRU eviction (500)
- ✅ IntersectionObserver cleanup margin 200px
- ⚠️ Reglas usan ctx — `academic-rules.ts` 4/4 reglas SIN ctx (verificado: `check: (text: string)` en líneas 24, 97, 138, 198)
- ❌ `noteDiagnostics` en MosaicEditor.tsx:227-267 sigue O(N·M)

### Problemas críticos validados
- **`academic-rules.ts` no usa ctx** (verificado: 4 firmas `check: (text: string): LinterDiagnostic[]`). Pierde el beneficio del refactor de `LinterRuleContext`.
- **`noteDiagnostics` O(N·M)**: 200 notas × 100KB = 20M chars escaneados + 200 substring + 200 split por cada cambio de `semanticState.fragments`/`statsContent`.
- **`extractHeadings` 5x sin ctx** (thesis-rules): 5 reglas lo llaman cada una.
- **`findBibliographySection` 4x sin ctx** (citation-rules).
- **`getMathRangesByLine` 4x sin ctx** (spelling-rules).
- **Worker NO se reinicia tras crash**: `useMarkdownLinter.ts:236` setea `workerAvailableRef.current = false` y nunca crea nuevo worker. Tras un error queda en main-thread fallback **toda la sesión**.

### Refactors integrales
- **Extender `LinterRuleContext`** con `mathRangesByLine`, `headings`, `bibliographySectionLineIdx`, `bibliographyEntries`. Migrar `academic-rules`, `thesis-rules`, `citation-rules`, `spelling-rules` a consumir del ctx.
- **Worker self-healing**: `onerror` recrea con backoff exponencial (3 intentos).
- **Reescribir `noteDiagnostics`**: prefix-sums + `String.prototype.matchAll` con regex anchored, O(M+N·k).
- **Coalesce MutationObservers**: un solo MO en editable que feedea EventBus interno (LinterPlugin + KaTeX overlay actualmente tienen 3 separados).

### Robustez 100KB + 30 reglas + 100 fórmulas
Aguanta sin caer pero con jank en escenarios extremos. Para uso típico (tesis 30-50KB, 5-15 notas, 50 fórmulas) va sobrado.

---

## 7. Cross-cutting (providers, IDB, Service Worker, Redux, error boundaries)

### Hallazgos críticos
- **`viewer-cache.ts`**: comentario promete "200 MB cap" pero solo hay TTL lazy 14d. **Sin LRU real ni quota check** (`navigator.storage.estimate()` no se consulta). Bug latente: cuota IDB → "el viewer no carga PDFs nuevos" tras uso prolongado.
- **`offlineStorage.ts:179-191`**: `cacheDocuments`/`cacheDocContent` insertan sin límite. `_cachedAt` se escribe pero **nunca se lee para evict**. Crece sin freno.
- **`next-pwa@5.6.0`**: librería **discontinuada**. Reglas de runtimeCaching duplicadas (custom + spread `...runtimeCaching`).
- **Solo 1 `GlobalErrorBoundary` global**: crash en un panel del mosaic tira **toda la UI** a fallback.
- **`GlobalErrorCatcher.tsx`**: sin throttle/dedup → toast spam en cascada.
- **`diagnostics-bus.ts`**: monkeypatcha `console.error/warn` **sin reversa**. Frágil para tests/HMR.
- **`TerminalContext.tsx:179`**: `lastDocChange` en context global → cualquier consumidor de `useTerminal()` re-renderea en cada doc-change del worker.
- **Redux `dashboardSlice`**: god slice con 18 piezas heterogéneas (modales UI + dominio). Selector inline en `dashboard/page.tsx:311-328` retorna objeto nuevo cada select, depende de `shallowEqual`.

### Refactors integrales
- **`idb-eviction.ts` unificado**: LRU + quota check + on-quota-exceeded handler para offlineStorage y viewer-cache. Ejecutar al boot y on-error.
- **Migrar a `@ducanh2912/next-pwa`** (fork mantenido).
- **Error boundaries por panel del mosaic** (envolver cada `MosaicWindow`).
- **Split del `dashboardSlice`**: `uiSlice` + `workspacesSlice` + `editorPrefsSlice`.
- **Mini-bus tipado sin window**: EventEmitter3 o nano-events.
- **`installConsoleHook(target=console)` reversible** que devuelva `dispose()`.
- **Mover `lastDocChange`** a `agora-events`, fuera del context global.

---

## 8. Firestore schema + indices + costs

### Hallazgos críticos
**Solo 3 índices declarados** en `firestore.indexes.json` (verificado): `subscriptions(status,endDate)`, `snippets(workspaceId,order)`, `snippets(ownerId,workspaceId,order)`. **Faltan al menos 7 críticos**:

| Query | Endpoint | Estado |
|---|---|---|
| `documents (workspaceId, updatedAt DESC)` | `/api/search/semantic` | ❌ catch silencioso → fallback sin orden |
| `documents (ownerId, workspaceId, updatedAt DESC)` | `/api/search/semantic` personal | ❌ |
| `documents (workspaceId, name, folder)` | `/api/sync/worker-commit:86` | ❌ auto-creable runtime |
| `documents (ownerId, workspaceId, name, folder)` | worker-commit personal | ❌ |
| `documents (storagePath, __name__)` con `!=` | DELETE doc cleanup | ❌ → blob huérfano si falla |
| `agentAuditLog (uid, workspaceId, createdAt DESC)` | observability | ❌ catch devuelve `[]` |
| `syncEventsOutbox (workspaceId, createdAt DESC)` | drainer | ❌ |

### Riesgos arquitectónicos
- **`workspaceSemanticStates/{wsId}` MONOLÍTICO**: hasta ~66KB conocido (Filosofía 6.6% del cap 1MB). Cada POST sobrescribe entero (sin merge). A 20-30 conceptos × 5KB cada uno **rompe**.
- **`worker-list` polling sin cache**: 27 workers × 1619 reads / 5s = ~750M reads/día sostenidos.
- **RTDB `sync-events` sin compaction**: jamás se borran. Crecimiento indefinido.
- **MinIO sin lifecycle rules** (verificado: 0 hits): blobs huérfanos persisten para siempre.
- **DELETE workspace deja basura**: NO borra `workspaceSemanticStates/{id}`, `agentAuditLog`, `syncEventsOutbox`, `snippets`.
- **`cloneWorkspaceDocuments` secuencial**: 1500 awaits en loop = 60+s timeout para Filosofía.
- **`enforceStorageQuota`**: lee TODOS los docs del owner sin paginar, cache 10min. Primera write tras expirar = >5s en usuario con 10k docs.
- **Backup `backup.mjs` one-shot manual**: no automático, sin cron, sin verificación periódica de restorabilidad. PITR Firestore no activado.

### Refactors integrales priorizados (BLOQUEANTES para escalar)
1. **Crear los 7 índices compuestos** + quitar `.catch(() => null)` que los ocultan.
2. **Endurecer reglas RTDB** con check de membership por workspace (ver §9).
3. **Sharding `workspaceSemanticStates`**: subcollections `concepts`, `fragments`, `relations`. Migration con dual-write.
4. **Cache `worker-list`** en Hub con ETag por max(updatedAt) del workspace.
5. **MinIO lifecycle rules**: abort multipart >7d, GC blobs huérfanos semanal.
6. **RTDB compaction job**: cron borra `sync-events` con `timestamp < now - 24h`.
7. **Cloud Run cron** para `backup.mjs` adaptado a MinIO + Firestore.
8. **Cascade DELETE workspace completo**.
9. **`cloneWorkspaceDocuments` con `BulkWriter`** + concurrency cap 50.
10. **`storageUsageBytes` incremental** en `users/{uid}` (atomic increment) en lugar de recalcular.

### Capacidad actual estimada
**Soporta hoy**: workspaces ≤2000 docs, ≤30 users concurrentes, ≤30 workers. Filosofía (1619 docs) ya está al límite del flat-listing.

**Rompe en orden**:
1. Workspace pasa ~3000 docs → `worker-list`/`search/semantic` recortan resultados sin avisar (cap 2000).
2. Semantic state >150-200KB (15-20% cap) → writes fallan intermitente.
3. RTDB sin GC degrada listener inicial tras meses.
4. Costo Firestore se dispara con N workers.

**Para 100 workspaces × 5000 docs cada uno**: indispensable hacer #1, #2, #3, #4, #5 antes.

---

## 9. Seguridad + auth + privacy (CRÍTICO)

### Vulnerabilidades CRÍTICAS validadas

#### 🔴 #1 — RTDB rules permiten cross-tenant leak (CVSS ~8.5)
Verificado en `AgoraFront/database.rules.json`:
```json
"sync-events": {
  "$workspaceId": { ".read": "auth != null", ".write": "auth != null" }
}
```
**Cualquier user autenticado lee y escribe `sync-events/<otro_workspace>`**. Vector: leak de paths/hashes/IDs ajenos + inyección de pings falsos que disparan refresh/pull en clientes ajenos. Contraste con `presence/$wsId` que SÍ verifica `personal_<auth.uid>` prueba que la falta es bug, no diseño.

**Hot-fix de 10 líneas**:
```json
"sync-events": {
  "$workspaceId": {
    ".read": "auth != null && (root.child('workspace_members').child($workspaceId).child(auth.uid).exists() || $workspaceId == 'personal_' + auth.uid)",
    ".write": "auth != null && (root.child('workspace_members').child($workspaceId).child(auth.uid).exists() || $workspaceId == 'personal_' + auth.uid)"
  }
}
```
Requiere mantener `workspace_members/<wsId>/<uid>:true` desde server.

#### 🔴 #2 — `NEXT_PUBLIC_ALLOW_INSECURE_AUTH=true` = takeover total (CVSS ~7.5)
Validado en `AgoraBack/src/lib/server-auth.ts`:
- Línea 23: `const allowInsecureAuth = process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true'`.
- Línea 40-42: `if (allowInsecureAuth && INSECURE_UID_PATTERN.test(token)) return { uid: token, email: null }`.
- Línea 53: `if (allowInsecureAuth) return true` para CUALQUIER `isWorkspaceMember`.

Si la flag aparece accidentalmente en producción (variable `NEXT_PUBLIC_*` pública), un atacante envía `Authorization: Bearer victim_uid` y obtiene admin total.

**Hot-fix**: en `server-auth.ts` agregar:
```ts
if (process.env.NODE_ENV === 'production' && allowInsecureAuth) {
  throw new Error('SECURITY: NEXT_PUBLIC_ALLOW_INSECURE_AUTH must not be enabled in production');
}
```
Ejecutar al import.

#### 🔴 #3 — Custom claim `workspaces[]` desincronizable hasta 1h (CVSS ~8.0)
`firestore.rules` confía en `request.auth.token.workspaces[]` para autorizar. `syncWorkspaceClaims` se llama con `.catch(() => {})` fire-and-forget en `/api/auth/login`. Tras `removeMember`/`acceptInvite`, **token sigue válido hasta 1h** (Firebase ID token TTL). Ex-miembros pueden acceder vía Firestore SDK directo.

**Mitigación**: forzar `auth.currentUser.getIdToken(true)` en cliente tras invite/accept/remove + push via RTDB `claims-version/<uid>` para trigger refresh.

### Vulnerabilidades ALTAS
- **Webhook MP always-200**: `payments/webhook/route.ts:159` log `error.message` al webhook source + nunca reintenta payments fallidos.
- **Documents listing leaks signed URLs**: `documents/route.ts:233` devuelve `url` viejo no caducado en GET masivo.
- **`canAccessDoc` sin role check**: cualquier miembro escribe/borra docs → no hay viewer/editor/admin.
- **Tools del agente `confirmed: true` derrotable por prompt injection**: viene del LLM payload + profile `developer` (default) salta confirmación + whitelist `FORBIDDEN_COMMAND_PATTERNS` no bloquea `bash -c`, `node -e`, `curl | sh`, `find / -delete`.
- **`fetchUrlText:56` con `redirect: 'follow'`**: SSRF clásico — host inicial validado pero servidor HTTP redirige a `http://169.254.169.254/...` (GCP metadata) y `fetch` lo sigue sin re-validar.
- **`signed-url` op=put con `fileSize` opcional**: cliente solicita PUT sin declarar size → quota check pasa con 0 → sube N GB.

### Privacy gaps
- Email en `localStorage('agora_user_email')` → XSS exfiltra.
- `paymentEvents` sin política de retención (GDPR Art. 5(1)(e)).
- No hay endpoint `/api/users/me DELETE` → right to erasure no cubierto.
- Sin Content-Security-Policy headers.
- Tokens en `localStorage`: cualquier XSS exfiltra credenciales.

### Refactors arquitectónicos requeridos
- **Modelo de roles**: `members: [{ uid, role: 'viewer'|'editor'|'admin' }]`. `canAccessDoc` exige `role >= editor`.
- **Confirmación server-side por sesión** (no del LLM payload). Cambiar default `developer` → `workspace`.
- **Custom redirect handler en `fetchUrlText`** que re-valide cada hop.
- **`fileSize` mandatory** en `/api/sync/signed-url` PUT + bucket policy MinIO max-size por path.

---

## 10. Boards + Snippets

### Hallazgos a validar/refinar (validación parcial)
- `KanbanBoard.tsx:565` `onSnapshot` guard descarta updates remotos durante drag local sin re-fetch al soltar — **alta**.
- `KanbanBoard.tsx:478-490` `cardListShallowEqual` ignora campos que cambian remotamente — missed renders.
- `snippetApi.ts:53` `fetchSnippets` swallows errors sin propagarlos.
- `KanbanBoard.tsx:771-776` `handleDragEnd Promise.all` sin retry → estado UI inconsistente con DB si un PATCH falla.

### Refactors integrales
- Unificar `loadBoard` + `subscribeBoardApi` (eliminar fetch, solo onSnapshot).
- Re-fetch tras drag-end para captar updates perdidos.
- `Promise.allSettled` + retry con backoff.
- Hook `useKanbanDrag` para limpiar componente.
- Para escalar 200+ cards: virtualizar cards dentro de columna, paginate en subscribe (limit 500 + cursor), índice composite `(columnId, order)`, `writeBatch` en lugar de N PATCH paralelos, **fractional indexing** en lugar de `generateOrder()`.

---

## 11. Agora AI Chat

### Estado fixes
- ✅ persist debounce 500ms + skip streaming (parcial, no flush al pasar loading→false)
- ✅ Virtuoso virtualization
- ✅ autoConfirmedRef cleanup
- ✅ Truncate step.content + result.data
- ✅ syncPartialRun throttle 250ms
- 🔴 **`React.memo` ChatMessage tiene BUG**: compara `steps?.length` solamente

### Bugs críticos
- **`AgoraAIChat.tsx:405-422`**: memo skipea render cuando solo crece `content` del último step (mismo `length` → UI congelada en thinking/plan). **Fix**: cambiar a `prev.msg.agentRun !== next.msg.agentRun`.
- **`AgoraAIChat.tsx:317-318, 337-338`**: `remarkPlugins={[remarkGfm, remarkMath]}` y `rehypePlugins={[rehypeKatex]}` creados inline cada render → ReactMarkdown recompila el processor unified.
- **`AgoraAIChat.tsx:798-799`**: SSE buffer sin cap → OOM si server emite >100MB.
- **`chatHistory.ts:188`**: `localStorage.setItem` sin try/catch → `QuotaExceededError` silencioso.
- **Dead code**: `bottomRef` (L485, 535) nunca scrollIntoView; `userScrolledUpRef` set pero nunca read; rama `mode === 'chat'` (L1053, 1439) modo eliminado; path non-stream `fetchZod('/api/agora-ai')` (L1448-1455).

### Refactors integrales
- `Markdown = memo(({content}) => <ReactMarkdown>...)` con `remarkPlugins`/`rehypePlugins` const top-level.
- `ChatMessage` memo por identity (`prev.msg.agentRun !== next.msg.agentRun`).
- SSE buffer cap 4MB con `publishAgentProblem` al exceder.
- `saveChatSessions` try/catch QuotaExceeded + escalation a usuario.
- Lazy bundle `toolDefinitions` (50-100KB).
- Mover `saveChatSessions` FUERA del reducer de `setSessions` (anti-pattern).

---

## 12. Mapa consolidado de problemas críticos validados

| # | Severidad | Capa | Problema | Archivo:línea | Fix mínimo |
|---|-----------|------|----------|---------------|------------|
| 1 | 🔴 CRÍTICA | Seguridad | RTDB sync-events cross-tenant | `database.rules.json:5-6` | 10 líneas en rules |
| 2 | 🔴 CRÍTICA | Seguridad | `NEXT_PUBLIC_ALLOW_INSECURE_AUTH` total takeover | `server-auth.ts:23,40,53` | throw en boot prod |
| 3 | 🔴 CRÍTICA | Seguridad | Custom claims desincronizable 1h | `firestore.rules` | refresh tras invite/remove |
| 4 | 🔴 CRÍTICA | Backend | `searchableContent` no se computa en worker/agente/convert/upload | varios | hook único `writeDocumentBlob` |
| 5 | 🔴 CRÍTICA | Backend | `invalidateAgoraWorkspaceContext` sin callers (cache stale 60s) | `context.ts:126` | invocar en POST/PUT/DELETE |
| 6 | 🟠 ALTA | Y.Doc | Awareness propio viola protocolo Yjs | `firebase-provider.ts:628-676` | adoptar y-protocols/awareness |
| 7 | 🟠 ALTA | Y.Doc | `destroyAsync` sin callers | `firebase-provider.ts:598` | unificar destroy() |
| 8 | 🟠 ALTA | Firestore | 7 índices compuestos faltantes | `firestore.indexes.json` | declarar + quitar catch silencioso |
| 9 | 🟠 ALTA | Firestore | `workspaceSemanticStates` monolítico cerca de 1MB | colección | sharding subcollections |
| 10 | 🟠 ALTA | Firestore | RTDB sync-events sin compaction | RTDB root | cron job |
| 11 | 🟠 ALTA | Firestore | DELETE workspace deja basura | `workspaces/[id]/route.ts` | cascade complete |
| 12 | 🟠 ALTA | Sidebar | Callbacks inline en page.tsx invalidan memo | `dashboard/page.tsx` | useCallback all |
| 13 | 🟠 ALTA | Sidebar | `useElementSize` sin debounce | `useElementSize.ts:29-34` | rAF debounce 50ms |
| 14 | 🟠 ALTA | Sidebar | 13+ `docs.find` O(N) | `dashboard/page.tsx` varios | `docById` Map |
| 15 | 🟠 ALTA | ST | Worker NO se usa en path crítico | `st-runtime-worker-client.ts` | mover extractFromSource al worker |
| 16 | 🟠 ALTA | ST | Doble parse extractFromSource | `STFileEditor.tsx:313` + `STRunner.tsx:359,436` | unificar en STFileEditor |
| 17 | 🟠 ALTA | ST | `stRainbowParens` depth bug en visibleRanges | `st-rainbow-parens.ts:31` | reescribir o eliminar |
| 18 | 🟠 ALTA | MD | `noteDiagnostics` O(N·M) | `MosaicEditor.tsx:227-267` | prefix-sums + matchAll |
| 19 | 🟠 ALTA | MD | `academic-rules` 4 reglas sin ctx | `academic-rules.ts:24,97,138,198` | migrar firma |
| 20 | 🟠 ALTA | MD | Worker linter sin auto-recovery | `useMarkdownLinter.ts:236` | `onerror` recrea con backoff |
| 21 | 🟠 ALTA | Cross-cutting | IDB caches sin eviction (offlineStorage + viewer-cache) | `offlineStorage.ts`, `viewer-cache.ts` | `idb-eviction.ts` unificado |
| 22 | 🟠 ALTA | AgoraAI | `ChatMessage` memo skipea última step | `AgoraAIChat.tsx:405-422` | `prev.msg.agentRun !== next.msg.agentRun` |
| 23 | 🟠 ALTA | AgoraAI | `remarkPlugins`/`rehypePlugins` inline cada render | `AgoraAIChat.tsx:317-318` | const top-level |
| 24 | 🟡 MEDIA | Seguridad | `canAccessDoc` sin role | `documents/[id]/route.ts` | members con role |
| 25 | 🟡 MEDIA | Seguridad | Tools agente confirmation derrotable + SSRF redirect | `accessPolicy.ts`, `intelligence.ts:56` | server-side flag + custom redirect |
| 26 | 🟡 MEDIA | Y.Doc | Compaction race en cutoff | `firebase-provider.ts:479-568` | usar push key |
| 27 | 🟡 MEDIA | Y.Doc | docsChanged sin workspaceId | `GitWorkbench.tsx:248`, `semanticSyncService.ts:83` | param requerido |
| 28 | 🟡 MEDIA | Y.Doc | SSE sin reconnect | `useEditorSSEStream.ts:67-83` | exponential backoff |
| 29 | 🟡 MEDIA | Y.Doc | useSyncEvents nowTs stale | `useSyncEvents.ts:91-96` | reabrir on .info/connected |
| 30 | 🟡 MEDIA | Backend | put-luego-update race | `documents/[id]/route.ts:113-140` | runTransaction |
| 31 | 🟡 MEDIA | Backend | cursor deleted = loop | `documents/route.ts:220-224` | cursor (updatedAt,id) |
| 32 | 🟡 MEDIA | Backend | cloneWorkspaceDocuments secuencial | `workspaces/[id]/route.ts` | BulkWriter |
| 33 | 🟡 MEDIA | Backend | worker-list 2000 presigns/5s | `worker-list/route.ts:52-103` | on-demand |
| 34 | 🟡 MEDIA | Mesa | memoryStateCache leak entre WS | `editorSemanticStore.ts:77` | LRU 8 |
| 35 | 🟡 MEDIA | Mesa | flushSemanticWorkspaceState sin callers | varios | invocar en pagehide |
| 36 | 🟡 MEDIA | Cross-cutting | `dashboardSlice` god slice + selector inline 18 fields | `dashboardSlice.ts`, `dashboard/page.tsx:311-328` | split en 3 slices |
| 37 | 🟡 MEDIA | Cross-cutting | 1 boundary global → crash tira UI | `GlobalErrorBoundary.tsx` | boundary por panel |
| 38 | 🟡 MEDIA | Cross-cutting | TerminalContext lastDocChange global | `TerminalContext.tsx:179` | mover a agora-events |

---

## 13. Plan recomendado de iteración (priorizado por impacto)

### Sprint 1 (hot-fixes seguridad, ~1 día)
1. **RTDB rules sync-events** con check de membership (#1).
2. **Hard fail** en `server-auth.ts` si `allowInsecureAuth` en producción (#2).
3. **Custom claims refresh** vía RTDB push tras invite/remove + `getIdToken(true)` cliente (#3).

### Sprint 2 (write-path unificado, ~2 días)
4. Hook único `writeDocumentBlob(docRef, content, meta)` que invoca `searchableContent` + `invalidateAgoraWorkspaceContext` + emite ping en `runTransaction`. Reemplaza 6 callsites (#4, #5, #30).
5. Cursor canónico `(updatedAt_ms, id)` (#31).

### Sprint 3 (índices Firestore + RTDB, ~1 día)
6. Declarar 7 índices compuestos en `firestore.indexes.json` + `firebase deploy --only firestore:indexes` (#8).
7. Quitar `.catch(() => null)` que esconden errores de índice — convertir en `console.error` específico.
8. RTDB compaction job (cron diario borra `sync-events` >24h) (#10).

### Sprint 4 (Sidebar perf, ~1 día)
9. `useCallback` + `React.memo` en handlers + `renderRow` (#12).
10. `useElementSize` con rAF debounce 50ms (#13).
11. `docById = useMemo(new Map(...))` y reemplazar 13+ `docs.find` (#14).
12. Hash más fuerte en `applyDocsSnapshot`.

### Sprint 5 (Y.Doc resilience, ~2 días)
13. Adoptar `encodeAwarenessUpdate`/`applyAwarenessUpdate` oficiales (#6).
14. Eliminar `destroy()`, dejar solo `destroyAsync` (#7).
15. SSE reconnect exponencial (#28).
16. `docsChanged.workspaceId` requerido (#27).
17. `useSyncEvents` reabrir on connected (#29).

### Sprint 6 (ST Worker integral, ~2 días)
18. Mover `extractFromSource`, `getSemanticSymbols`, `findDefinitions` al worker (#15).
19. Unificar el debounce parse en STFileEditor (#16).
20. Worker `onerror` recrea con backoff + cancela todos pendings (#15, #20).
21. Eliminar/reescribir `stRainbowParens` (#17).

### Sprint 7 (MD linter ctx + AgoraAI fixes, ~1 día)
22. Migrar `academic-rules` a ctx (#19).
23. Extender `LinterRuleContext` con `headings`, `bibliographySectionLineIdx`, `mathRangesByLine`.
24. `noteDiagnostics` con prefix-sums (#18).
25. `ChatMessage` memo por agentRun identity (#22).
26. `remarkPlugins`/`rehypePlugins` const top-level (#23).
27. SSE buffer cap 4MB.

### Sprint 8 (cross-cutting + IDB eviction, ~2 días)
28. `idb-eviction.ts` unificado para offlineStorage + viewer-cache (#21).
29. Migrar `next-pwa@5.6` → `@ducanh2912/next-pwa`.
30. Error boundaries por panel del mosaic (#37).
31. Split `dashboardSlice` (#36).
32. `installConsoleHook` reversible.
33. Mover `lastDocChange` a `agora-events` (#38).

### Sprint 9 (escalabilidad — para 5000 conceptos / 5000 docs / 100 workspaces)
34. Sharding `workspaceSemanticStates` en subcollections (#9).
35. Cache `worker-list` en Hub con ETag.
36. MinIO lifecycle rules + GC blobs huérfanos.
37. Cascade DELETE workspace completo (#11).
38. `cloneWorkspaceDocuments` con `BulkWriter`.
39. `storageUsageBytes` incremental.
40. `verifyTheoryGraph` a Web Worker.
41. Cloud Run cron para `backup.mjs` automatizado.

---

## 14. Riesgos NO resueltos (decisión consciente para Sprint 10+)

- **Modelo de roles workspace** (viewer/editor/admin): refactor estructural, requiere migración de docs `members[string]` → `members[{uid, role}]`.
- **CSP headers** + tokens fuera de localStorage (sessionStorage + re-auth por tab) — reduce blast radius XSS.
- **`/api/users/me DELETE`** — right to erasure GDPR-compliance.
- **Fractional indexing en boards** — solo necesario si se confirma uso de >100 cards/columna.
- **Postgres17 en NAS** — sin producto vivo encima; decidir si se elimina o se le da uso.

---

## 15. Conclusión

El refactor previo de 25 issues fue **mayoritariamente correcto pero superficial en 3 áreas**:

1. **Web Worker ST** — se construyó la infraestructura pero solo el 20% del path crítico la usa.
2. **Awareness Yjs** — se reescribió a `onChild*` sin respetar el protocolo binario que la librería oficial impone.
3. **searchableContent** — se denormalizó en 2 sites pero quedaron 5 write-paths sin actualizarlo.

Sumado a las 3 vulnerabilidades de seguridad CRÍTICAS validadas, hay trabajo concreto y prioritizable para 9 sprints. La capa de datos en su forma actual escala hasta workspaces de ~2000 docs y workspaces semánticos de ~150KB; para crecer 10× hay que sharding, índices y GC.

**Próximo paso recomendado al user**: ejecutar Sprint 1 (3 hot-fixes seguridad de impacto inmediato) antes del próximo deploy, y planear Sprints 2-9 en backlog priorizado.

---

*Auditoría conducida 2026-05-07 con 11 agentes Opus en paralelo. Cada hallazgo crítico verificado contra el código real (lecturas de `firebase-provider.ts`, `server-auth.ts`, `database.rules.json`, `firestore.indexes.json`, `useElementSize.ts`, `st-rainbow-parens.ts`, `academic-rules.ts`, grep de `destroyAsync`, `invalidateAgoraWorkspaceContext`, `parseInWorker`, `extractFromSource`, `computeSearchableContent`).*

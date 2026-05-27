# Reporte QA Agora — testeo paralelo multi-instancia

> Fecha: 2026-05-27. Entorno: producción (`agora.elenxos.com` + Cloud Run back).
> Método: 16 instancias Chrome headless independientes (MCP `agora-chrome-*`)
> para superficie pública + testeo de API autenticada con token Firebase de
> cuenta QA throwaway (`agoraqa1779835793@mailinator.com`, uid
> `lmNcdjJXOmEbv0L8pwhw`, plan free). Workspace QA creado: `gMWpwalQSWEyyohDEzC6`.

## Resumen ejecutivo

- **Superficie pública (12 áreas, browser)**: verde en general. El motor lógico
  ST funciona client-side en todos los playgrounds. Gating de rutas correcto.
- **Backend autenticado (API, ~50 endpoints)**: sólido. CRUD de docs, git
  end-to-end, agente IA (SSE), vault de keys cifrado, uploads, snippets, boards,
  semántico, suscripción — todo responde 2xx.
- **Limitación de entorno**: las vistas autenticadas pesadas (editor MDX Monaco,
  shell del workspace con terminal/socket.io, kanban) **cuelgan Chrome headless**
  en este contenedor (CDP protocolTimeout irreversible). Se testearon vía API en
  vez de browser. Corrobora el item de perf "heap del editor 7-9MB → meta <5MB".

## Bugs encontrados (priorizados)

| # | Sev | Bug | Evidencia | Fix sugerido |
|---|-----|-----|-----------|--------------|
| 1 | **Alta** | `GET /api/documents` sin `workspaceId` → **500** | `FAILED_PRECONDITION: query requires an index` (collectionGroup `documents`, `ownerId ASC + updatedAt DESC`). Front y back. | Agregar índice a `firestore.indexes.json` + `firebase deploy --only firestore:indexes`. Link de creación en el cuerpo del error. |
| 2 | Media | `PATCH /api/documents/:id` → **404** | Solo `PUT` registrado. Cliente que use PATCH para edición parcial falla. Front y back. | Registrar handler PATCH (o documentar PUT-only). |
| 3 | Media | PWA: `manifest.json` referencia `favicon.svg` como icono | Chrome: "Download error or resource isn't a valid image" en cada carga; rompe "Añadir a pantalla de inicio". | Iconos PNG/WebP 192×192 + 512×512 con `sizes` declarados. |
| 4 | Baja-Media | Nav móvil de landing ausente del a11y tree (390px) | Los 7 links + "Iniciar Sesión" desaparecen; sin hamburguer accesible. | Exponer el menú móvil con `role`/`aria` o revisar binding del toggle. |
| 5 | Baja | Estabilidad de editores pesados (ST playground / MDX editor) | Tab-detach intermitente al 1er click en proof-cards; hang del editor ST al enfocar. Perf real (heap editor). | Ligado al item de sprint del heap del editor; optimizar mount/re-render. |
| 6 | Baja/UX | Proof Debugger: panel ASIGNACIONES siempre vacío | Incluso en pasos REGLA / contramodelo donde se esperarían asignaciones. | Revisar si es por diseño o falta poblar el estado. |
| 7 | Cosmético | Validación de login nativa en inglés | "Please fill out this field" en UI en español (HTML5 `required` nativo). | `noValidate` + validación propia en español si se quiere consistencia. |

## Superficie pública — verificado (browser, 16 instancias)

| Área | Estado |
|------|--------|
| Landing `/` | ✅ desktop completo; ⚠️ nav móvil (bug #4) |
| Login / Registro / Reset | ✅ flujos + validación (⚠️ msg en inglés, bug #7) |
| ST Playground v1 | ✅ motor lógico: modus ponens + contraposición, 6.6ms, 0 errores |
| ST Playground v2 | ✅ + LSP in-process; dropdown "Ejemplos" pesado |
| ST Playground v3 | ✅ editor + validación; AI co-pilot gated correcto; a11y form-fields sin id |
| ST Notebook | ✅ gated con mensaje claro |
| Lattice Viewer | ✅ SVG Belnap + marco Kripke |
| Proof Cards | ✅ cards+filtros+modal; ⚠️ tab-detach intermitente (bug #5) |
| Proof Debugger | ✅ step-by-step; ⚠️ ASIGNACIONES vacío (bug #6) |
| Docs (`/docs`, `/docs/st`, slug) | ✅ render markdown + bloques ST interactivos |
| Gating de rutas (no-auth) | ✅ 5/5 (`/dashboard`,`/settings`,`/workspace`,`/editor`,`/agente`) → `/login` |
| PWA / 404 / token inválido | ✅ 404 y token graceful; ⚠️ icono manifest (bug #3) |

## Backend autenticado — verificado (API, cuenta QA)

| Capacidad | Endpoint(s) | Estado |
|-----------|-------------|--------|
| Registro (sin verificación email) | Firebase Auth | ✅ crea sesión directa |
| Login | Firebase Auth REST | ✅ → `/dashboard?workspaceId=personal` |
| Workspaces CRUD | `GET/POST /api/workspaces` | ✅ crear + listar + get |
| Documentos | `POST/GET/PUT/DELETE /api/documents` (con `?workspaceId`) | ✅ (✗ listado global sin wsId = bug #1; ✗ PATCH = bug #2) |
| Carpetas | `POST /api/documents` `type:folder` | ✅ |
| Búsqueda | `GET /api/documents?workspaceId&q=` | ✅ (no hay ruta `/search` dedicada) |
| Git | `POST /api/workspaces/:id/provision-git`, `/git/status`, `/git/log` | ✅ end-to-end (repo Forgejo + commit inicial real) |
| Sync | `GET /api/sync/manifest?workspaceId&docId` | ✅ (param `path` no resuelve; no hay `/sync/status`) |
| Agente IA | `POST /api/agora-ai/stream` (SSE), `/chats` | ✅ pipeline SSE `connected→chat-created→status→error` |
| Vault de keys IA | `GET/POST/DELETE /api/agora-ai/keys` | ✅ cifrado, solo `displayHint:"***real"` |
| AI models | `GET /api/agora-ai/models` | ✅ |
| ST libraries | `GET/POST/DELETE /api/st-libraries` | ✅ (valida contrato) |
| ST público | `POST /api/public/st/evaluate` | ✅ 401 sin `X-ST-API-Key` (esperado) |
| Uploads multipart | `POST /api/upload/multipart/{initiate,abort}` | ✅ (`fileName`/`fileSize`/`mimeType`) |
| Snippets | `GET/POST/DELETE /api/snippets` | ✅ (`markdown`+`category`) |
| Board (kanban) | `GET /api/boards?workspaceId` | ✅ columnas por defecto |
| Semántico | `GET /api/semantic?workspaceId` | ✅ `concepts/fragments/relations` |
| Citaciones | `POST /api/admin/citations/backfill` | ✅ (lectura solo via tools del agente, no REST) |
| Suscripción / storage | `GET /api/payments/{subscription-status,storage-usage}` | ✅ free, 0/50MB |
| Perfil | `GET /api/users/me` | ✅ |

## Notas de método / limitaciones

- **Concurrencia browser**: correr ~12+ Chrome headless con extracción de a11y
  tree en simultáneo satura CPU y dispara `protocolTimeout`. Techo práctico para
  testeo interactivo: ≤4-6 concurrentes (las 16 instancias existen, pero no para
  a11y-snapshot masivo simultáneo).
- **Vistas pesadas autenticadas**: no testeables por browser headless de forma
  confiable acá (editor/terminal/kanban cuelgan el CDP). Cubiertas por API.
- **Setup MCP**: Chrome for Testing 149 en `~/.cache/cft`, wrapper en
  `/opt/google/chrome/chrome` que inyecta `--no-sandbox --disable-dev-shm-usage`
  (sandbox no inicializa en contenedor).

## Pendiente / limpieza

- Cuenta QA `agoraqa1779835793@mailinator.com` + workspace `gMWpwalQSWEyyohDEzC6`
  + repo Forgejo `agora/gmwpwalqsweyyohdezc6` quedaron creados (throwaway).
- Fase no cubierta por falta de browser estable: interacción real del editor MDX
  (LaTeX/Mermaid render), terminal conectada a worker, drag&drop de kanban — si
  se quiere, requiere Xvfb o subir el `protocolTimeout` del MCP.

# AgoraFront — QA Manual con MCP

> Sesión iniciada: 2026-05-06
> Operador: Claude (Playwright MCP, headless)
> **Target: PRODUCCIÓN — `https://agora.elenxos.com/`** (front Vercel + back Cloud Run)
> User de pruebas: `stevenvallejo780@gmail.com` (cuenta real del owner)
> Branch: `main` — workspace `EducacionCooperativa/`
> ⚠️ Estamos en prod: evitar acciones destructivas (delete workspace/doc, delete account). Solo crear/editar contenido test.

## Cómo usar este checklist

- `[ ]` pendiente · `[x]` validado OK · `[!]` bug encontrado (ver sección Bugs) · `[-]` no aplica / bloqueado
- Cada bug va en la sección **Bugs encontrados** con id `BUG-NN`, severidad, evidencia y archivo si aplica
- Edge cases marcados con 🧪 — apuntar a forzar errores, no solo el happy path
- Al final de cada ruta, anotar **Console errors / Network errors** observados durante la navegación

---

## Resumen de progreso

| Ruta / Área | Items | Hechos | Bugs |
|---|---|---|---|
| Landing `/` (dev) | — | 7 | 1 (cosmetic) |
| Login `/login` (dev) | — | 4 | 3 (dev-only — BUG-01/02/03) |
| Landing `/` (prod) | — | 4 | 0 |
| Dashboard `/dashboard` (prod) | — | en curso | — |
| Editor MDX `/editor/[id]` (prod) | — | 0 | — |
| Editor ST `/editor/[id]` (prod) | — | 0 | — |
| Workspace `/workspace/[...slug]` (prod) | — | 0 | — |
| Docs `/docs`, `/docs/st/[slug]` (prod) | — | 0 | — |
| Globales (auth/sync/PWA/responsive) | — | 0 | — |

---

## 1. Landing (`/`) — público

### 1.1 Hero & navegación
- [x] Carga sin errores en consola (1 info: react-devtools)
- [x] CTA "Iniciar Sesión" navega a `/login` ✓ (verificado)
- [ ] CTA "Empezar gratis" navega a `/login` (registro) — pendiente
- [x] Logo / branding visibles (Agora pink/purple gradient)
- [x] Top nav: Visión, Plataforma, Lenguaje ST, Formalizador, Planes, Docs, Docs ST, Elenxos
- [ ] 🧪 Animaciones Framer Motion: respeta `prefers-reduced-motion` (no probado)

### 1.2 Pillar 1 — STRunner (en hero + sección #st)
- [x] Demo ST `logic classical.propositional` con axioms a1, a2 + derive Q + check
- [x] Botón "Ejecutar" ejecuta y muestra output (Visual: truth table 4 filas P,Q→R)
- [x] Tabs Salida / Problemas (2) / Símbolos (2) presentes
- [x] Botón "Reiniciar" presente
- [x] Toggle Visual / JSON / Texto presente
- [ ] 🧪 Drag handle de resize de output — pendiente
- [ ] 🧪 Múltiples runs rápidos — pendiente
- [!] BUG-04 tabs sin `aria-selected`/`aria-pressed`

### 1.3 Pillar 2 — MarkdownPreview (hero card "Vista previa Markdown — KaTeX + Mermaid")
- [x] Renderiza markdown (Crítica de la razón pura — §B75) con table de "Proposición / Variable"
- [x] LaTeX inline `P ∧ Q → K` renderiza con KaTeX
- [x] Diagrama Mermaid del argumento renderiza (Intuición Q → Síntesis → Conocimiento K)
- [ ] 🧪 Markdown malformado — pendiente

### 1.4 Pillar 3 — FormalizerPlayground (#formalizer)
- [x] Textarea precargado con ejemplo Sócrates (176 chars)
- [x] Selector de logic profile (Lógica proposicional clásica)
- [x] Toggle NLP / LLM (NLP activo)
- [x] Click "Formalizar" → resultado en 7ms (3 átomos · 5 fórmulas · 2 claims · 85% confianza)
- [x] Reglas detectadas: modus_ponens, universal_generalization, universal_instantiation
- [x] Output muestra código ST con `logic classical.propositional`
- [x] Aviso "No es la prueba final" + botón Copiar
- [x] Historial (1) con la última consulta
- [x] 🧪 Input vacío → botón disabled (correcto, no crashea)
- [ ] 🧪 LLM toggle → respuesta con LLM real (no probado, requiere creds)
- [ ] 🧪 LLM unavailable / 500 → error visible (no probado)

### 1.5 Auth gate / Firebase
- [ ] Si `NEXT_PUBLIC_FIREBASE_API_KEY` falta → Google Sign-In disabled gracioso (no crash)
- [ ] Sin sesión, los CTAs llevan a /login
- [ ] Con sesión existente, ¿redirect automático a /dashboard? (verificar diseño)

### 1.6 Responsive
- [ ] Desktop ≥1440px — layout completo
- [ ] Tablet 768px — pillars apilan
- [ ] Mobile 375px — todo legible, CTAs alcanzables
- [ ] 🧪 iPhone SE / 320px — no overflow horizontal

---

## 2. Login (`/login`) — público

### 2.1 Login email/pass
- [ ] Form muestra inputs Email + Password
- [ ] Submit con creds inválidas muestra error en banner rojo
- [ ] Submit con creds válidas redirige a `/dashboard`
- [ ] Botón "Forgot Password?" abre modal reset
- [ ] 🧪 Email malformado → validación HTML5 / mensaje
- [ ] 🧪 Password vacía → no envía, muestra hint
- [ ] 🧪 Doble click rápido no hace doble request (debounce / disable)

### 2.2 Registro
- [ ] Toggle "Register" cambia el form
- [ ] Crear cuenta con email nuevo → éxito + redirect
- [ ] 🧪 Email ya registrado → error visible
- [ ] 🧪 Password débil → mensaje del backend visible
- [ ] 🧪 Password ≥6 chars enforce (Firebase mínimo)

### 2.3 Reset password
- [ ] Modal abre desde "Forgot Password?"
- [ ] Submit con email válido → success modal "Correo enviado!"
- [ ] Botón "Volver al inicio de sesión" cierra modal
- [ ] 🧪 Email no registrado → mensaje (Firebase suele decir success igual)
- [ ] 🧪 ESC cierra modal

### 2.4 Google sign-in
- [ ] Botón visible si `NEXT_PUBLIC_FIREBASE_API_KEY` configurado
- [ ] 🧪 Sin API key configurada → toast "Google Sign-In no está configurado"
- [ ] 🧪 API key con `\n` o trailing whitespace → no debe tirar error críptico
- [ ] OAuth popup abre y completa flujo

### 2.5 Estados varios
- [ ] Loading spinner visible durante request
- [ ] Errores de red mostrados, no silenciados
- [ ] 🧪 Logout de sesión activa redirige a /login

### 2.6 Accesibilidad / inputs
- [ ] Email input: `type="email"`, `inputMode="email"`, `autocomplete="username"`
- [ ] Password input: `type="password"`, `autocomplete="current-password"` (o `new-password` en registro)
- [ ] Tab order razonable
- [ ] Enter en cualquier campo dispara submit

---

## 3. Dashboard (`/dashboard`) — auth required

### 3.1 Auth gate
- [ ] Sin sesión → redirect a `/login`
- [ ] Con sesión válida → carga shell completo
- [ ] 🧪 Logout durante la sesión activa → redirect, no blank screen

### 3.2 Layout principal
- [ ] WorkspaceTopBar muestra workspace activo + avatar
- [ ] Sidebar izquierdo con file tree visible
- [ ] BottomDock (terminal) renderiza
- [ ] RightPanel (outline / problems / semantic) renderiza
- [ ] MosaicLayout permite resize de paneles
- [ ] 🧪 Resize a tamaño mínimo no rompe layout

### 3.3 File tree
- [ ] Lista carpetas y archivos del workspace activo
- [ ] Click archivo lo abre en main pane
- [ ] Doble click inicia rename inline
- [ ] Click derecho abre context menu (Rename, Delete, Duplicate, Copy Path)
- [ ] Drag & drop mueve archivos entre carpetas
- [ ] Star → favoritos persistidos
- [ ] Búsqueda en tree filtra en tiempo real
- [ ] Folder collapse / expand toggle
- [ ] Iconos por tipo (.md, .st, .pdf, .xlsx)
- [ ] 🧪 Workspace vacío → empty state / WelcomeView
- [ ] 🧪 Workspace con >100 archivos → no lag, virtualization OK

### 3.4 Modales
#### NewFileModal
- [ ] Abre con + New File / Cmd+N
- [ ] Selector de tipo: markdown, ST, blank
- [ ] Selector de carpeta destino
- [ ] Crear con nombre vacío → validación
- [ ] 🧪 Nombre con caracteres ilegales (`/`, `\0`)

#### SettingsModal
- [ ] Tabs: Account, Workspace, Git, Linter, Appearance, Developer
- [ ] Account: cambiar nombre, password, logout
- [ ] Workspace: nombre, descripción, miembros, delete (con doble confirm)
- [ ] Git: token Forgejo (masked), test connection
- [ ] Linter: toggles, custom rules, dictionary
- [ ] Appearance: theme auto/dark/light, font size, zoom
- [ ] Developer: diagnostics, sync logs, cache clear
- [ ] 🧪 Cambio de tab preserva scroll position

#### QuickSearchModal (Cmd+K)
- [ ] Cmd+K abre modal
- [ ] Búsqueda fuzzy filtra archivos
- [ ] Enter sobre resultado abre archivo
- [ ] ESC cierra
- [ ] 🧪 Cmd+P (alternativo) — verificar si abre o conflicta con browser

#### MembersModal
- [ ] Lista de miembros + invitaciones pendientes
- [ ] Form invite con role selector
- [ ] 🧪 Invitar email no válido → error
- [ ] 🧪 Invitar duplicado → error gracioso

#### NewWorkspaceModal
- [ ] Crear workspace con nombre nuevo
- [ ] Workspace queda activo y se ve su file tree

#### PricingModal
- [ ] Lista de planes (Free, Pro, Team, Enterprise)
- [ ] CTA upgrade
- [ ] 🧪 Si hay quota hit, modal aparece automáticamente

#### ConflictResolutionModal
- [ ] 🧪 Provocar conflicto sync (editar offline + remoto) → modal abre con preview local vs remoto

### 3.5 Activity bar
- [ ] Files icon (default)
- [ ] Kanban icon → cambia panel
- [ ] Git workbench icon
- [ ] Search / Problems icon
- [ ] Settings icon abre SettingsModal
- [ ] Semantic browser icon

### 3.6 Status bar (bottom)
- [ ] Sync status (Syncing / Synced)
- [ ] Online/Offline indicator
- [ ] Linter warnings count
- [ ] Pending changes count

### 3.7 Terminal (BottomDock)
- [ ] Tab visible en bottom dock
- [ ] Conecta a worker (status indicator)
- [ ] Comandos ejecutan y muestran output
- [ ] "+ New Session" crea tab nueva
- [ ] Switching entre sessions
- [ ] Right-click tab → Rename
- [ ] 🧪 Worker offline → mensaje claro + reconnect
- [ ] 🧪 Comando fuera de whitelist → respuesta del worker visible

### 3.8 Git workbench
- [ ] Lista commits con autor / msg / timestamp
- [ ] Diff de cambios sin commitear
- [ ] Form commit con mensaje + botón
- [ ] Pull / Push (si Forgejo configurado)
- [ ] 🧪 Sin token Forgejo → mensaje guía + link a Settings

### 3.9 Kanban
- [ ] Columnas To Do / In Progress / Done (defaults?)
- [ ] "+ New Card" abre form
- [ ] Drag entre columnas cambia status
- [ ] Click card abre detalle (title, desc, tags, linked docs)
- [ ] 🧪 Drag mobile (touch) — polyfill OK

### 3.10 Right panel
- [ ] Outline view: estructura del doc activo
- [ ] Problems pane: linter diagnostics agregados
- [ ] Semantic browser: conceptos del workspace
- [ ] FilePreviewPane: thumbnails

### 3.11 Sync, presence, offline
- [ ] Banner offline cuando se pierde conexión
- [ ] Avatares de presencia (multi-user en mismo doc)
- [ ] 🧪 Logout en otra tab → invalida esta sesión

---

## 4. Editor MDX (`/editor/[id]` con .md) — auth required

### 4.1 Carga
- [ ] Spinner "Cargando editor…" mientras auth check
- [ ] DocumentSurface ruta a MosaicEditor para .md
- [ ] `?embedded=1` oculta close button
- [ ] Close button (no embedded) → `/dashboard`

### 4.2 Toolbar MDX
- [ ] Format / Headings / Lists / Code blocks / Tables / Links / Images
- [ ] Insert Mermaid diagram
- [ ] Insert LaTeX `$$...$$`
- [ ] Insert admonition
- [ ] Insert text layer
- [ ] Import snippet
- [ ] Save snippet from selection
- [ ] Toggle preview pane
- [ ] Fullscreen toggle (Cmd+/)
- [ ] Zoom +/-

### 4.3 Slash menu (`/`)
- [ ] Tipear `/` abre menú
- [ ] Comandos básicos: code block, table, image, link
- [ ] AI commands: /improve, /summarize, /translate, /formalize
- [ ] 🧪 ESC cierra menú
- [ ] 🧪 Búsqueda fuzzy en el menú

### 4.4 Auto-save
- [ ] Cambio en texto → indicador "Guardando…" tras debounce
- [ ] Tras save, indicador "Synced"
- [ ] 🧪 Offline → cambios encolan en localStorage
- [ ] 🧪 Reconexión → flush de cola

### 4.5 Linter overlay
- [ ] Squiggle rojo en error de spelling
- [ ] Squiggle amarillo en warning
- [ ] Click error → popup con sugerencia
- [ ] Right-click error → "Add to dictionary", "Suppress rule"
- [ ] 🧪 Linter respeta `personal dictionary` después de añadir

### 4.6 Search & replace (Cmd+F)
- [ ] Cmd+F abre barra
- [ ] Next/Previous navega matches
- [ ] Replace input + Replace all
- [ ] 🧪 Replace All confirma antes
- [ ] 🧪 Regex toggle (si existe)

### 4.7 Preview pane
- [ ] Renderiza Mermaid
- [ ] Renderiza KaTeX
- [ ] Sync scroll editor↔preview (si está implementado)

### 4.8 Semantic panels
- [ ] Outline muestra headings
- [ ] Semantic browser: registrar concepto desde selección
- [ ] FilePreviewPane: hover sobre link a doc → thumbnail

### 4.9 Snippets
- [ ] SnippetGallery abre desde toolbar
- [ ] Crear snippet desde selección
- [ ] Insertar snippet
- [ ] Búsqueda en gallery

### 4.10 Otros
- [ ] Cmd+Z / Cmd+Y undo/redo
- [ ] Paste imagen del clipboard → upload a MinIO
- [ ] 🧪 Imagen muy grande (>10MB) → error gracioso
- [ ] Link a documento no existente → warning visible

---

## 5. Editor ST (`/editor/[id]` con .st) — auth required

### 5.1 STCodeEditor
- [ ] Syntax highlighting con tokenizer ST
- [ ] Hover sobre término → type info
- [ ] Ctrl+Hover → markdown tooltip detallado
- [ ] Linter underlines
- [ ] 🧪 Errores parser no crashean editor

### 5.2 STOutputViewer
- [ ] Resultados `derive`: árbol de prueba o "Failed"
- [ ] Resultados `check`: ✓ Valid / ✗ Invalid + counterexample
- [ ] Resultados `truth_table`: grid renderiza
- [ ] Diagnostics: errors / warnings / hints
- [ ] Tiempo de ejecución + tokens
- [ ] Resize por drag handle
- [ ] Collapse total

### 5.3 Toolbar
- [ ] Toggle auto-run
- [ ] Botón Run (Cmd+Enter)
- [ ] Botón Clear output
- [ ] Selector de perfil lógico (classical.propositional, modal.K, temporal.LTL, ...)
- [ ] Settings menu (font size, syntax theme)

### 5.4 Auto-run
- [ ] Cambio de código → debounce → ejecuta
- [ ] 🧪 Cambios rápidos no acumulan ejecuciones
- [ ] 🧪 Timeout de ejecución → mensaje "Execution timeout"

### 5.5 Profile switching
- [ ] Cambiar perfil re-parsea código
- [ ] 🧪 Código inválido en perfil nuevo → warning, no crash
- [ ] Semantic browser actualiza operadores disponibles

### 5.6 Companion sync con MD
- [ ] MD con `@st-file` → sync con archivo ST
- [ ] Slash `/formalize` en MD genera en ST companion
- [ ] 🧪 Cambios en ST se reflejan en MD?

### 5.7 Otros
- [ ] Copy output (truth tables) al clipboard
- [ ] 🧪 Output muy largo → scroll, no overflow

---

## 6. Workspace (`/workspace/[...slug]`) — auth required

### 6.1 FileExplorer
- [ ] File tree workspace-scoped
- [ ] List view detallada (size, mod date, type)
- [ ] Breadcrumb: workspace > folder > subfolder
- [ ] Click segmento navega
- [ ] Sort por nombre / size / fecha
- [ ] 🧪 Carpeta con muchos archivos → no lag

### 6.2 Upload / create
- [ ] Botón Upload → file chooser
- [ ] Progress bar para archivos grandes
- [ ] Create folder → prompt + creación
- [ ] Right-click file → Download / Copy path / Delete
- [ ] 🧪 Upload archivo gigante → manejo memoria

### 6.3 File preview
- [ ] PDF en PdfViewer (toolbar, zoom, search, page nav)
- [ ] Imagen en viewer
- [ ] Spreadsheet en SpreadsheetViewer (cells editables, sort, filter)
- [ ] Markdown read-only
- [ ] ST read-only con output
- [ ] Tipo desconocido → GenericFileViewer (download link)

### 6.4 Terminal workspace-scoped
- [ ] Worker status indicator (verde/rojo)
- [ ] Terminal tabs por sesión
- [ ] Quick install guide si worker offline

### 6.5 Permisos
- [ ] Solo ve archivos del workspace en que es miembro
- [ ] 🧪 URL workspace ajeno → 403 / redirect

---

## 7. Docs (`/docs` y `/docs/st/[slug]`) — público

### 7.1 `/docs` (hub)
- [ ] Hero + version badge ST_RUNTIME_VERSION
- [ ] TOC sticky desktop
- [ ] Secciones colapsables (Architecture, Workspaces, Editor, ..., Edu Worker)
- [ ] Cada sección click toggle
- [ ] Code blocks con copy button
- [ ] CommandRef cards
- [ ] Mobile: TOC colapsa a hamburger / drawer
- [ ] 🧪 Estado collapsed persiste en URL/storage? (verificar diseño)

### 7.2 `/docs/st` index
- [ ] Listado de logic courses con level badges
- [ ] Search bar filtra
- [ ] Click course → `/docs/st/[slug]`

### 7.3 `/docs/st/[slug]`
- [ ] Header con title, profile badge, level
- [ ] TOC sticky con secciones (Overview, Coverage, Concepts, Operators, Commands, Pedagogy, Examples, Mistakes, Limits, Bridges)
- [ ] Operators table renderiza
- [ ] Code blocks ST con highlight
- [ ] Copy → "Copied!" feedback
- [ ] Run button → `/editor/[id]` con código pre-cargado (requiere auth → redirect login con returnTo)
- [ ] 🧪 Slug inválido → 404 page

### 7.4 Cursos a verificar
- [ ] classical.propositional
- [ ] modal.K
- [ ] temporal.LTL
- [ ] (los 11 perfiles del runtime — verificar que todos generen página)

---

## 8. Globales (cross-route)

### 8.1 Auth & sesión
- [ ] AuthContext: user mount, logout
- [ ] 🧪 Token expirado → auto-logout + redirect login
- [ ] User menu: avatar → Settings, Logout

### 8.2 Sync events
- [ ] SyncEventsBridge listener activo
- [ ] Cambios remotos en RTDB se reflejan en UI sin reload
- [ ] 🧪 Canal `sync-events/personal_<uid>` correcto (no `sync-events/personal`)
- [ ] 🧪 Payload RTDB con `timestamp`, `type`, `source` → captado por useSyncEvents

### 8.3 Offline / PWA
- [ ] [PWA] mensaje "PWA support is disabled" en dev (esperado) — confirmar en prod
- [ ] Banner offline cuando navigator.onLine = false
- [ ] Service worker en prod (no en dev)
- [ ] Manifest.json cargable

### 8.4 Toasts y errores
- [ ] Sonner toast aparece para errores/success
- [ ] GlobalErrorBoundary captura crashes (test forzando error)
- [ ] PWAUpdater detecta nueva versión

### 8.5 Keyboard shortcuts globales
- [ ] Cmd+K / Ctrl+K → quick search
- [ ] Cmd+N → new file
- [ ] Cmd+Enter → run ST / save
- [ ] Cmd+F → search en editor
- [ ] Cmd+/ → fullscreen
- [ ] Cmd++/- → zoom
- [ ] ESC → cierra modales
- [ ] ? → keyboard shortcuts modal
- [ ] 🧪 En macOS funciona Cmd, en linux/win Ctrl

### 8.6 Responsive
- [ ] 1920×1080 desktop full
- [ ] 1280×800 laptop
- [ ] 768×1024 tablet portrait
- [ ] 375×667 iPhone SE
- [ ] 320×568 viejo iPhone — sin overflow horizontal
- [ ] Hamburger menu en mobile (sidebar collapse)
- [ ] BottomDock → tab bar mobile

### 8.7 Tema dark/light
- [ ] Toggle en Settings → Appearance
- [ ] Respeta `prefers-color-scheme`
- [ ] Contraste AA en ambos temas
- [ ] 🧪 Mezcla light/dark en frame de auth no debe ocurrir

### 8.8 Performance
- [ ] LCP < 2.5s en landing
- [ ] CLS < 0.1
- [ ] Bundle size razonable (no chunks gigantes)

### 8.9 AI / Agente Agora
- [ ] Chat panel disponible
- [ ] Stream de respuesta funciona
- [ ] Tools del agente ejecutan en backend (verificar)
- [ ] 🧪 Stream cancelado por usuario → manejo gracioso

---

## Bugs encontrados

> Formato: `BUG-NN [severity] descripción · evidencia · ruta/archivo`
> Severity: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low / cosmetic

### BUG-01 🔴 critical — Login dev-local rompe sin `NEXT_PUBLIC_API_BASE_URL`
- **Síntoma**: en dev local, click "Entrar" con cualquier credencial → fetch a `http://localhost:3000/api/auth/login` → **404** (Next.js HTML de "page not found")
- **Causa raíz**: `src/services/apiClient.ts:1` lee `process.env.NEXT_PUBLIC_API_BASE_URL`. Esa variable **no está definida en `.env.local`**, ni `.env`, ni `.env.production.local`. Quedan vacía → `apiUrl('/api/auth/login')` resuelve a path relativo. AgoraFront ya **no expone** `/api/auth/*` (ese código se movió a AgoraBack post-split de repos), así que el front pega contra sí mismo y falla.
- **Evidencia**: 
  - Console: `Failed to load resource: 404 @ http://localhost:3000/api/auth/login`
  - Screenshot `qa-02-login-bad-creds.png`
  - `find AgoraFront/src/app/api -type d -name "*auth*"` → 0 resultados
- **Archivo**: `AgoraFront/src/context/AuthContext.tsx:189` (loginWithEmail), líneas 267, 349, 372 (register, change-password, prepare-reset todos igual)
- **Fix sugerido**: setear `NEXT_PUBLIC_API_BASE_URL=https://agora-backend-578238159459.us-central1.run.app` en `.env.local`, o levantar AgoraBack local en :8080 y poner `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`. Adicional: en `apiUrl()` o en `loginWithEmail`, detectar empty base + log warning visible en consola.

### BUG-02 🟠 high — Mensaje de error críptico ante respuesta no-JSON
- **Síntoma**: cuando el backend responde 404 (HTML default Next), el front parsea como JSON y muestra al user `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` en el banner rojo del login.
- **Por qué**: `AuthContext.tsx:195-197` hace `await res.json()` sin verificar `res.status` ni `content-type` previamente.
- **Severidad**: el error se fija solo con BUG-01 resuelto, pero el bug del fallback es real — cualquier error transitorio del backend (502, 503, page de Cloudflare, etc.) producirá un mensaje incomprensible para el user.
- **Fix**: antes de `res.json()`, chequear `res.headers.get('content-type')?.includes('application/json')`. Si no, `throw new Error(\`HTTP ${res.status} ${res.statusText}\`)`.
- **Evidencia**: screenshot `qa-02-login-bad-creds.png` muestra el texto literal del error JS en el banner rojo.

### BUG-03 🟡 medium — `apiUrl()` con base vacía no warning ni fallback
- **Síntoma**: con `NEXT_PUBLIC_API_BASE_URL=""`, el helper `apiUrl()` genera URLs relativas silenciosamente. No hay warning en build/runtime ni en `auditProductionEnv()` (visible).
- **Archivo**: `AgoraFront/src/services/apiClient.ts:1`
- **Fix**: lanzar warning en consola cuando se llama a `apiUrl()` con base vacía y la app está en producción/dev local con `process.env.NODE_ENV !== 'test'`.

### BUG-04 🟢 cosmetic — STRunner tabs sin `aria-selected` / `aria-pressed`
- **Síntoma**: tabs "Salida", "Problemas", "Símbolos" del output viewer no exponen estado de selección a screen readers.
- **Verificado**: `evaluate` retornó `pressed: null` para los 6 tabs encontrados.
- **Severidad**: accesibilidad únicamente; el active state se ve por borde inferior pink.
- **Fix**: agregar `aria-selected={isActive}` (si son `role="tab"`) o `aria-pressed={isActive}` (si son toggle buttons).

### BUG-05 🟠 high — ST editor en pantalla completa atrapa al user
- **Síntoma**: tras click "Pantalla completa" sobre el panel ST Logic, el editor se expande pero **no expone el panel de output**, **no hay botón visible "Salir de pantalla completa"**, y **Escape no cierra el modo**.
- **Reprodujo**: dashboard prod → click maximize (⊞) en panel ST Logic → click "Ejecutar" → no aparece output → buscar botón salir → sólo "Cerrar barra lateral", ninguno con `salir|exit|reducir`. Escape no surte efecto.
- **Workaround**: el user tiene que navegar manualmente (navigate, refresh) para escapar.
- **Evidencia**: `qa-prod-06-st-fullscreen.png`, `qa-prod-06-st-after-esc.png`.
- **Severidad**: alta — UX broken si el user usa el shortcut.

### BUG-06 🟠 high — Ctrl+K no abre quick-search global
- **Síntoma**: el welcome view muestra textualmente "Buscar Ctrl+K" como hint, pero al presionar Ctrl+K en el dashboard:
  - Si el PDF viewer tiene focus → captura Ctrl+K como "Ir a página" del PDF (su shortcut interno).
  - Si el body tiene focus tras cerrar un modal → no hay quick-search visible (solo a veces abre el `WorkspaceManagerModal` cuyo open fue por el click anterior).
- **Reprodujo**: ver `qa-prod-04-cmdk.png` (PDF goto page) y `qa-prod-04-cmdk-clean.png` (sin acción).
- **Esperado**: Ctrl+K abre un quick-search modal global (estilo Cmd+P de VSCode) sobre todos los archivos.
- **Posible fix**: el binding global debe escuchar en `window` con `capture: true` y `stopPropagation()` para ganar precedencia sobre handlers locales (PDF, CodeMirror, etc.).

### BUG-07 🟠 high — ESC no cierra modales (WorkspaceManagerModal, posiblemente otros)
- **Síntoma**: con el modal "Gestionar espacios" abierto y el textbox "Buscar espacio" focalizado, presionar Escape **no cierra el modal**.
- **Causa probable**: el modal no usa `role="dialog"`, no monta un focus-trap ni un keydown listener para Escape (verificado por `evaluate` → 0 dialogs encontrados con `[role="dialog"]`).
- **Workaround**: click en X explícito.
- **Severidad**: alta — viola convención web universal.
- **Fix**: usar Radix Dialog / un primitive con `role="dialog"`, `aria-modal="true"`, focus trap, ESC handler, click-on-backdrop dismissal.

### BUG-08 🟡 medium — Panel "Esquema" reporta "Sin encabezados" para documentos con headings
- **Síntoma**: con el README.md activo, el panel Esquema muestra "Sin encabezados — Este documento no tiene títulos (#, ##, ###)". Pero al abrir el README en pantalla completa, se ve claramente que tiene H1 ("Sistema de Estudio Colaborativo de Griego Clásico") + 3 H2 (Descripción, Propósito, Contenidos disponibles) + 4 H3 (Clases, Diccionarios, Gramáticas, Libros de ejercicios).
- **Reprodujo**: `qa-prod-04-esquema.png` (panel decía "Sin encabezados") vs `qa-prod-05-editor-fullscreen.png` (los headings rendering perfectos).
- **Hipótesis**: el outline parser puede estar leyendo el frontmatter o un campo específico, o no se hizo trigger después de un cambio de doc activo. Verificar `parseHeadings(content)` o el doc-id que está leyendo.
- **Severidad**: media — feature anunciada que no funciona en el caso típico (un doc con headings).

### BUG-09 🟡 medium — Página 404 default Next.js (no respeta dark theme)
- **Síntoma**: al ir a `/docs/st/classical-propositional` (slug inválido, el correcto es `proposicional`), aparece el 404 default de Next: fondo blanco / texto negro "404 — This page could not be found.", **rompe completamente el branding dark del resto del sitio**.
- **Evidencia**: `qa-prod-08-docs-st-slug.png`.
- **Fix**: crear `src/app/not-found.tsx` (global) y/o `src/app/docs/st/[slug]/not-found.tsx` con dark theme + link "Volver al índice ST" + búsqueda.

### BUG-10 🟡 medium — Mobile: panel Agora AI cubre todo el viewport sin acceso a sidebar
- **Síntoma**: al cargar `/dashboard` en viewport 375×812 (iPhone X / 11 Pro), el panel **Agora AI ocupa el 100% del viewport** y cubre la hamburguesa "Abrir menú". El user que abre el dashboard en mobile no puede volver al sidebar / file tree sin cerrar primero el Agora AI panel (con la X que está dentro del panel).
- **Verificado por Playwright**: click en hamburguesa con `Timeout` porque el SVG path del Agora AI panel intercepta el pointer event.
- **Tras cerrar el panel Agora AI**, el dashboard mobile sí responde correctamente: la hamburguesa abre el sidebar con file tree y activity bar.
- **Fix**: en mobile, el Agora AI panel debería abrir como bottom-sheet o en pantalla completa con back button explícito, y NO ser el default visible. O al menos no debería ocluir el topbar.

### BUG-11 🟡 medium — Firestore: deprecation warning en consola prod
- **Síntoma**: warning recurrente en consola prod de cada `/dashboard`:
  - `[2026-05-06...] @firebase/firestore: Firestore (12.12.0): enableMultiTabIndexedDbPersistence() will be deprecated in the future, you can use FirestoreSettings.cache instead.`
- **Severidad**: maintenance — no rompe ahora pero deprecated, mejor migrar a `FirestoreSettings.cache` como dice el SDK.

### BUG-12 🟢 cosmetic — File tree usa `<button>` en vez de `role="treeitem"`
- **Síntoma**: los items del file tree (carpetas y archivos) son `<button>` simples sin `role="treeitem"`, ni el tree padre tiene `role="tree"`. No se anuncia jerarquía a screen readers.
- **Severidad**: a11y; el árbol funciona visualmente.
- **Fix**: añadir `role="tree"`/`role="treeitem"`/`aria-expanded`/`aria-level` apropiados.

### BUG-13 🟢 cosmetic — Activity bar: `aria-pressed` solo en "Modo Zen", el resto en `null`
- **Síntoma**: la activity bar tiene 8 botones (Archivos, Buscar, Control de versiones, Herramientas, Esquema, Snippets, Modo Zen, Menú de cuenta). Sólo "Alternar modo Zen" expone `aria-pressed`. Los demás no comunican estado activo a screen readers.
- **Severidad**: a11y. El indicador visual sí cambia (background highlight).
- **Fix**: añadir `aria-pressed={isActive}` a los 7 botones de selección (no a "Menú de cuenta" que es trigger no-toggle).

### Observación — duplicados visibles
- Snippet "LATEX INLINE — E = mc²" aparece 7+ veces en la galería. Posible data del user (creó el snippet múltiples veces) — no es bug del producto pero sugiere que la UI debería deduplicar por contenido o ofrecer "merge duplicates".
- En el modal "Buscar" global, "TALLER COMPLETO L PREDICADO..." aparece 2 veces. Misma observación.
- Workspace "UnivercidadGeneral" — typo del nombre creado por el user. No bug.


---

## Console / network errors observados

### Landing `/` (dev)
- 1 info `Download the React DevTools…` (esperado en dev)
- 0 errors / 0 warnings
- STRunner Ejecutar: 0 errors
- Formalizer (NLP): 0 errors

### Login `/login` (dev)
- 4 messages on initial load (3 info + 1 status); 0 errors / 0 warnings
- Tras click Entrar con `noexisto@nada.test`/`passwrong123`:
  - **1 ERROR**: `Failed to load resource: 404 @ http://localhost:3000/api/auth/login`
  - Banner rojo en UI: `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
- Causa raíz documentada en BUG-01 + BUG-02

### Producción — agora.elenxos.com
- Landing prod (`/`): 0 errors / 0 warnings
- Dashboard (`/dashboard?workspaceId=personal`): 0 errors / **1 warning**
  - `@firebase/firestore: Firestore (12.12.0): enableMultiTabIndexedDbPersistence() will be deprecated…` (BUG-11)
- Docs (`/docs`, `/docs/st`, `/docs/st/proposicional`): 0 errors / 0 warnings
- 404 (`/docs/st/classical-propositional`): 1 error 404 — esperado (slug inválido) pero la página renderizada es default Next light theme (BUG-09)
- ST run desde panel normal: 0 errors, output OK badge, derivación Modus Ponens completa.
- ST run desde fullscreen: 0 errors but no output visible anywhere (BUG-05).


---

## Notas operativas
- Dev server PID se ve en `/tmp/agora-front-dev.log`
- Hay warning de Next.js sobre múltiples lockfiles (workspace root inferido) — no bloqueante
- `predev` regenera `src/generated/st-runtime-manifest.ts` automáticamente
- En prod la cuenta logueada es `stevenvallejo780@gmail.com` (UID `21VuZW4cdXd9jGKOgPa5YQegICw1`), workspace personal con 40 archivos / 23 documentos contables / 15 workspaces totales.
- Plan: Enterprise · Storage usage: 43.1 MB / 10.00 GB (0%).
- Agora AI activo con DeepSeek (DeepSeek Chat — 1000K ctx); 11/14 capabilities ON; perfil "Workspace".
- Screenshots de la sesión están en `EducacionCooperativa/qa-prod-*.png` (15 archivos) y `AgoraFront/qa-01-*.png` (6 archivos del recorrido en dev).

## Resumen ejecutivo

**Validado OK en prod (sin issues):**
- Landing pública con hero, 6 pillars, STRunner ejecuta truth tables correctamente, FormalizerPlayground produce ST (Modus Ponens detectado en 7ms con 85% confianza).
- Dashboard renderiza shell completo: workspace selector (15 workspaces), activity bar (8 paneles), file tree (40 archivos), mosaico (README, Tablero, Mesa, Formalizador, PDF, ST), Agora AI panel, status bar.
- Settings modal: 7 tabs cargan limpio (Editor MD, Editor ST, Mesa semántica, Agora IA, Linter, Acceso Git, Cuenta).
- ST runtime: derivación Modus Ponens funcional con prueba completa.
- Docs: `/docs` (TOC 18 items), `/docs/st` (TOC 18 items), `/docs/st/proposicional` (curso completo con TOC, hero, OBJETIVOS).
- Workspace search global: filtra 18 docs.
- Sidebar search: filtra file tree de 40 → 1 al escribir "README".
- Modo Zen: oculta UI cromática del MDX editor.
- `/workspace/personal` redirige a `/dashboard?workspaceId=personal` (alias).

**Bloqueado / no probado**:
- Login real con creds (sesión persistente del browser cubrió esto, pero no validé el flow logout→login fresh).
- Crear/editar archivo, autosave, conflict resolution, presence multi-user (evitado en prod por ser destructivo).
- Slash menu MDX `/`, snippet creation, semantic browser (no requería tocar prod pero faltó tiempo).
- Terminal de worker / Crear sesión (no probado para no costar recursos del worker en prod).
- Drag-and-drop de archivos, mover entre carpetas.

**Bugs por severidad (13 total + observaciones)**:
- 🔴 critical: 1 (BUG-01 — dev only)
- 🟠 high: 5 (BUG-02 dev, BUG-05/06/07/10 prod)
- 🟡 medium: 4 (BUG-03 dev, BUG-08/09/11 prod)
- 🟢 cosmetic / a11y: 3 (BUG-04 prod, BUG-12 prod, BUG-13 prod)

**Top 3 prioridades sugeridas para fix**:
1. **BUG-07** ESC no cierra modales — viola convención web universal, probablemente afecta a varios modales (no solo WorkspaceManagerModal). Refactor a Radix Dialog o equivalente con focus trap + role=dialog. Una sola fix toca múltiples bugs (también arregla aria-modal y BUG cubre BUG-02 conceptualmente).
2. **BUG-05** ST fullscreen atrapa al user — se rompe el feature; el output panel debe seguir visible y el botón de salida debe aparecer.
3. **BUG-06** Ctrl+K global no funciona — la documentación lo promete (welcome view dice "Buscar Ctrl+K"), pero no funciona en la realidad. Bind global con capture + stopPropagation.

---

## Iteración de fixes (2026-05-06, post-QA inicial)

Tras el sweep, el user pidió "corrige todos, despliega y vuelve a probar". 2 deploys a prod:

### Deploys
1. `dpl_5BYfymXMLzbpf1JAdyoX7gx5dE4w` — fixes principales (10 bugs)
2. `dpl_*8vbdxnpux*` — iter 2 fix BUG-05 ESC del editor fullscreen

Commit: `6b7827a` — fix(qa): corregir 10 bugs encontrados en QA manual con MCP

### Bugs corregidos (10/13)
- **BUG-02** ✅ AuthContext con `parseApiResponse` que valida `content-type` antes de `.json()`. No más `Unexpected token '<'`.
- **BUG-03** ✅ apiClient warning si `NEXT_PUBLIC_API_BASE_URL` empty + helper compartido `parseApiResponse`.
- **BUG-04** ✅ STRunner tabs con `role="tab"` + `aria-selected` + `role="tablist"` + `role="tabpanel"`.
- **BUG-05** ✅ ESC fallback en MosaicLayout + useEditorUI por si Fullscreen API falla. Verificado en prod.
- **BUG-06** ✅ WelcomeView hint cambiado de "Ctrl+K" a "Ctrl+P" (binding real).
- **BUG-07** ✅ 7 modales con hook `useEscapeClose` + `role="dialog"` + `aria-modal`. Verificado: ESC cierra.
- **BUG-09** ✅ Custom `not-found.tsx` con dark theme + branding + CTAs. Verificado en `/docs/st/classical-propositional`.
- **BUG-10** ✅ Mobile RightPanel ahora `top-11 z-40` — MobileTopBar visible y clickable. Verificado.
- **BUG-11** ✅ Firestore migrado a `initializeFirestore({ localCache: persistentLocalCache(...) })`. Console limpia.
- **BUG-13** ya tenía `aria-current="page"` — aceptable, no requiere cambio.

### Bugs deferidos (3/13)
- **BUG-01** dev-only: `NEXT_PUBLIC_API_BASE_URL` faltante en `.env.local`. No aplica a prod.
- **BUG-08** Esquema "Sin encabezados": refactor del active mosaic panel tracking. Defer.
- **BUG-12** File tree role=tree: refactor mayor (~692 líneas FileExplorer.tsx). Defer.

### Verificación post-deploy con MCP Playwright (prod)
- Landing: 0 errors / 0 warnings ✅
- Dashboard: 0 errors / 0 warnings ✅ (Firestore deprecation gone)
- 404 custom dark theme ✅ (qa-fix-01-404.png)
- WorkspaceManagerModal: ESC cierra, `[role="dialog"]` detectable ✅
- STRunner tabs `role="tab"` + `aria-selected="false"` ✅
- Mobile 375x812: hamburguesa visible y clickable ✅ (qa-fix-02-mobile.png)
- ESC en fullscreen del editor (iter 2): exit OK ✅ (qa-fix-06-after-esc-iter2.png)

### Pendientes para próxima iteración
- BUG-08: refactor OutlineView para que siga el active mosaic panel.
- BUG-12: file tree con `role="tree"` / `treeitem` / `aria-expanded`.
- Slash menu MDX, autosave, presence multi-user, terminal worker — no probados (evitados en prod).
- Logout/login fresh: validar flujo completo.

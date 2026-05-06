# QA Checklist V2 — Inventario Exhaustivo + Validación

> Inicio: 2026-05-06 ~12:40 UTC
> Target: prod `https://agora.elenxos.com`
> Convenciones: `[ ]` no probado · `[x]` validado MCP · `[!]` bug encontrado (BUG-N) · `[~]` parcial · `[-]` no aplica
> Cada `[x]` debe tener evidencia: screenshot o test específico con MCP browser.

## Sumario rápido (se actualiza cada ciclo)

| Área | Items | Validados | Bugs | Pendientes |
|------|-------|-----------|------|------------|
| 1. Landing `/` | 35 | 0 | 0 | 35 |
| 2. Login `/login` | 18 | 0 | 0 | 18 |
| 3. Dashboard shell | 65 | 0 | 0 | 65 |
| 4. Sidebar views | 45 | 0 | 0 | 45 |
| 5. Central mosaic | 38 | 0 | 0 | 38 |
| 6. Right panel (AI) | 28 | 0 | 0 | 28 |
| 7. Bottom dock | 22 | 0 | 0 | 22 |
| 8. Status bar | 12 | 0 | 0 | 12 |
| 9. Modales | 50 | 0 | 0 | 50 |
| 10. Editor `/editor/[id]` | 35 | 0 | 0 | 35 |
| 11. Workspace `/workspace/[...slug]` viewers | 30 | 0 | 0 | 30 |
| 12. Docs `/docs` | 12 | 0 | 0 | 12 |
| 13. Docs ST `/docs/st` + slug | 18 | 0 | 0 | 18 |
| 14. Sub-componentes específicos | 60 | 0 | 0 | 60 |
| 15. Edge cases / states | 25 | 0 | 0 | 25 |
| 16. Keyboard shortcuts | 22 | 0 | 0 | 22 |
| 17. Eventos globales | 30 | 0 | 0 | 30 |
| **TOTAL** | **545** | **0** | **0** | **545** |

---

## 1. Landing `/`

### 1.1 Header sticky
- [ ] Logo "Agora" + icon BookOpen visibles
- [ ] Nav link "Visión" → scroll a #vision
- [ ] Nav link "Plataforma" → scroll a #pillars
- [ ] Nav link "Lenguaje ST" → scroll a #st
- [ ] Nav link "Formalizador" → scroll a #formalizer
- [ ] Nav link "Planes" → scroll a #pricing
- [ ] Nav link "Docs" → /docs
- [ ] Nav link "Docs ST" → /docs/st
- [ ] Nav link "Elenxos" → externo
- [ ] CTA "Iniciar Sesión" (no auth) → /login
- [ ] CTA "Empezar gratis" (no auth) → /login (registro)
- [ ] CTA "Dashboard" (auth) → /dashboard
- [ ] Loading state "Cargando…" durante auth check

### 1.2 Hero
- [ ] Badge inicial "Lógica formal · Markdown · Terminales"
- [ ] H1 anim con gradient
- [ ] Descripción
- [ ] Gradientes radiales decorativos NO causan overflow

### 1.3 Pillar cards (6)
- [ ] ST — Lenguaje de Lógica Formal (Code2, rose-pink)
- [ ] Editor Académico de Nueva Generación (Edit3, violet-purple)
- [ ] Formalización y Análisis Semántico (FlaskConical, emerald)
- [ ] Terminales Linux en la Nube (Terminal, sky)
- [ ] Colaboración Académica Real (Users, amber)
- [ ] Agora AI — Asistente (Brain, fuchsia)

### 1.4 Demos del hero (lazy)
- [ ] STRunner: Script/REPL toggle, Ejecutar, Reiniciar, Visual/JSON/Texto
- [ ] STRunner edge: input vacío, syntax error, 11 perfiles
- [ ] MarkdownPreview: render correcto LaTeX, Mermaid, tables
- [ ] FormalizerPlayground: NLP/LLM toggle, profile dropdown, Formalizar, History
- [ ] FormalizerPlayground edge: input vacío disabled, LLM error

### 1.5 Workflow steps + pricing + footer
- [ ] 4 workflow steps animados
- [ ] 4 pricing cards (Gratuito, Básico, Pro, Enterprise)
- [ ] Pricing CTA → /login o checkout
- [ ] Footer dinámico con year + ELENXOS_BRAND footerDisclaimer

---

## 2. Login `/login`

### 2.1 Tabs
- [ ] Tab "Iniciar Sesión" (default activo)
- [ ] Tab "Registrarse" (toggle)
- [ ] Active tab styling correcto

### 2.2 Form
- [ ] Email input: type=email, autocomplete=email, inputMode=email, autoCapitalize=off, spellCheck=false
- [ ] Password input: autocomplete current-password (login) / new-password (register)
- [ ] Submit "Entrar" funciona con creds correctas
- [ ] Submit error con creds incorrectas (mostrar mensaje claro, no JSON)
- [ ] Loading state durante submit

### 2.3 Reset password modal
- [ ] Click "¿Olvidaste tu contraseña?" abre modal
- [ ] Form email reset
- [ ] Submit → success message
- [ ] Submit error si email inválido
- [ ] Back button "← Volver al inicio de sesión"
- [ ] ESC cierra modal

### 2.4 Google sign-in
- [ ] Botón "Continuar con Google" visible
- [ ] Click abre OAuth (no probado en MCP — requiere flow externo)

### 2.5 Volver al inicio
- [ ] Link "← Volver al inicio" → /

---

## 3. Dashboard `/dashboard` shell

### 3.1 Top bar
- [ ] Workspace selector con icono + nombre
- [ ] Click workspace selector abre WorkspaceManagerModal
- [ ] Avatar user clickable → user menu
- [ ] Indicator presence (verde) si online

### 3.2 Activity bar (8 botones)
- [ ] Archivos (active default)
- [ ] Buscar
- [ ] Control de versiones
- [ ] Herramientas
- [ ] Esquema
- [ ] Snippets
- [ ] Modo Zen toggle (Eye/EyeOff)
- [ ] Menú de cuenta (avatar)
- [ ] Active button con línea izquierda mandy-400

### 3.3 Header bar (right side toolbar)
- [ ] Open file tabs (con close X)
- [ ] +Terminal session
- [ ] Toolbar buttons (Board, ST Runner, Semantic, Formalizer, Snippets, AgoraAI)
- [ ] Tools menu (...) con submenu
- [ ] Search button (Cmd+P)

### 3.4 Mobile top bar (<768px)
- [ ] Hamburguesa abre drawer
- [ ] Workspace label + indicator
- [ ] Search icon
- [ ] User avatar

### 3.5 Status bar (footer)
- [ ] Workspace name + icon
- [ ] Worker status (verde/rojo/grey)
- [ ] Linter status badge (X/Y)
- [ ] Sync status ("Guardado" / "Syncing")
- [ ] Plan badge (Free/Pro/Enterprise)
- [ ] Storage usage MB/GB
- [ ] Cursor position (línea, col) en editor

### 3.6 Layout y interacciones generales
- [ ] Mosaic resize handles funcionan
- [ ] Right panel collapse toggle
- [ ] Bottom dock collapse toggle
- [ ] Mobile: panel Agora AI no cubre topbar
- [ ] Modo Zen oculta UI cromática

---

## 4. Sidebar views (cada vista de Activity bar)

### 4.1 Archivos (FileExplorer)
- [ ] Tree expand/collapse folders
- [ ] Click file abre en mosaico
- [ ] Search en tree filtra
- [ ] +Nuevo archivo abre NewFileModal
- [ ] +Nueva carpeta funciona
- [ ] Subir archivo (file input)
- [ ] Subir carpeta (directory input)
- [ ] Drag & drop reordena dentro carpeta
- [ ] Drag & drop mueve doc a carpeta
- [ ] Drag & drop reordena carpetas
- [ ] Multi-select (Ctrl+click)
- [ ] Shift+click rango selección
- [ ] Right-click context menu (Rename, Delete, Duplicate, Download, Properties)
- [ ] Inline rename (doble click)
- [ ] Star toggle (favoritos persistido)
- [ ] Collapse/expand all
- [ ] Sidebar collapse toggle (Ctrl+B)

### 4.2 Buscar (SearchPanel)
- [ ] Input búsqueda funciona
- [ ] Filter chips: Todos/Documento/Concepto/Fragmento/Autor/Obra
- [ ] Click resultado abre doc
- [ ] Keyboard nav ↑↓
- [ ] Enter abre, Esc limpia

### 4.3 Control de versiones (GitWorkbench)
- [ ] Empty state si sin repo
- [ ] Botón "Crear repositorio"
- [ ] Status (uncommitted)
- [ ] Diff viewer
- [ ] Commit form + button
- [ ] Pull/Push (si Forgejo conectado)
- [ ] Branch selector
- [ ] Log/history

### 4.4 Herramientas (ToolsGallery)
- [ ] Tablero card → abre KanbanBoard
- [ ] ST Logic card → abre STRunner
- [ ] Semántica card → abre SemanticBrowser
- [ ] Formalizar card → abre FormalizerPlayground
- [ ] Documentación card → /docs
- [ ] Elenxos card → externo

### 4.5 Esquema (OutlineView)
- [ ] Renderiza headings de doc activo
- [ ] Click heading scroll al doc
- [ ] Empty state si no docs
- [ ] No virtual panel = no Esquema (debería sigue al active textual)

### 4.6 Snippets (SnippetGallery)
- [ ] Lista snippets defaults
- [ ] Search snippets
- [ ] Filter por categoría
- [ ] +Crear snippet
- [ ] Editar snippet inline
- [ ] Borrar snippet con confirm
- [ ] Insertar snippet en editor activo

---

## 5. Central mosaic (panels)

### 5.1 Mosaic layout
- [ ] Drag-resize columns/rows
- [ ] Open multiple panels
- [ ] Maximize panel ("Pantalla completa")
- [ ] Salir pantalla completa (X o ESC)
- [ ] Close panel (X)
- [ ] Position menu (rotate split, swap)
- [ ] Empty mosaic → "Bienvenido a Agora" welcome view

### 5.2 Per panel header buttons
- [ ] ⊞ ArrowLeftRight: swap panels
- [ ] ⤢ Maximize/Minimize
- [ ] ✕ Close panel
- [ ] Drag handle (mover panel)

### 5.3 Panels específicos en mosaic
- [ ] README.md panel (MosaicEditor)
- [ ] Tablero (KanbanBoard)
- [ ] Mesa Semántica (GlobalSemanticBrowser)
- [ ] Formalizador (FormalizerPlayground)
- [ ] PDF viewer (PdfViewer)
- [ ] ST Logic (STRunner)
- [ ] Snippets gallery
- [ ] Welcome view (cuando vacío)

---

## 6. Right panel — Agora AI Chat

### 6.1 UI
- [ ] Header con icono + "Agora AI" + close X
- [ ] Message list scrollable
- [ ] Input textarea con placeholder
- [ ] Send button (enabled si hay texto)
- [ ] Model selector (DeepSeek/ChatGPT/Claude/Gemini/Ollama)
- [ ] Provider indicator
- [ ] Workspace context indicator
- [ ] Token counter
- [ ] Iteration counter

### 6.2 Funcionalidad
- [ ] Enviar mensaje (Enter)
- [ ] Shift+Enter nueva línea
- [ ] Recibir respuesta (streaming)
- [ ] Tool call rendering
- [ ] Thinking block expandible
- [ ] Plan block
- [ ] Usage stats footer
- [ ] Message hover actions: Copy, Rerun, Edit, Delete
- [ ] Stop button durante stream
- [ ] Reset conversation

### 6.3 Settings AI (en Settings modal)
- [ ] Provider selector
- [ ] API key input
- [ ] Model selector dinámico
- [ ] Acceso profile (Solo lectura/Editor seguro/Workspace/Desarrollador)
- [ ] 14 capabilities toggles
- [ ] User instructions textarea (max 2000 chars)

---

## 7. Bottom dock

### 7.1 Tabs
- [ ] Terminal tab
- [ ] Problemas tab + badge count
- [ ] Salida ST tab (cuando ST executes)
- [ ] Símbolos tab
- [ ] Custom registered channels

### 7.2 Terminal
- [ ] Empty state "Sin sesión seleccionada"
- [ ] +Crear terminal button
- [ ] Si sin worker: "Sin worker activo"
- [ ] Session selector dropdown
- [ ] Rename session
- [ ] Delete session
- [ ] Xterm input/output
- [ ] Copy/paste
- [ ] Resize

### 7.3 Problemas
- [ ] Lista diagnostics con severity icon
- [ ] Click line jump al editor
- [ ] Filter dropdown ("Todos los orígenes")
- [ ] Limpiar button
- [ ] Sort options

---

## 8. Status bar elementos

- [ ] Workspace name
- [ ] Worker status (green/red/grey con tooltip)
- [ ] Connection status (Conectado)
- [ ] Word/char/line count
- [ ] Saved indicator
- [ ] Linter pill (Reglas X/Y)
- [ ] Problemas badge clickable → abre Problemas tab
- [ ] Plan badge
- [ ] Storage usage
- [ ] Cursor position
- [ ] Encoding
- [ ] File type
- [ ] Zoom level

---

## 9. Modales

### 9.1 NewFileModal
- [ ] Tipo selector: Markdown / ST / Folder
- [ ] Name input con validación
- [ ] Folder selector
- [ ] Cancel + Create
- [ ] Click backdrop cierra
- [ ] ESC cierra

### 9.2 NewWorkspaceModal
- [ ] Name input con aria-label
- [ ] Plan info
- [ ] Crear button
- [ ] Cancel cierra
- [ ] ESC cierra

### 9.3 MembersModal
- [ ] Lista miembros con role
- [ ] Email invite con email/inputMode
- [ ] Role selector
- [ ] Send invite button
- [ ] Remove member con confirm
- [ ] ESC cierra

### 9.4 ChangePasswordModal
- [ ] 3 password inputs con autocomplete correcto
- [ ] Validation min 6 chars
- [ ] Match confirm
- [ ] Error message
- [ ] Success message
- [ ] ESC cierra

### 9.5 PricingModal
- [ ] 4 plan cards
- [ ] Current plan badge
- [ ] Upgrade button (CTA)
- [ ] WhatsApp Enterprise link
- [ ] Storage usage indicator
- [ ] ESC cierra

### 9.6 ConflictResolutionModal
- [ ] Diff viewer
- [ ] Keep local / Keep server / Manual merge
- [ ] ESC cierra

### 9.7 WorkspaceManagerModal
- [ ] Lista workspaces (paginada/scroll)
- [ ] Search workspace
- [ ] +Nuevo workspace
- [ ] Action menu por workspace
- [ ] Switch workspace funciona
- [ ] ESC cierra modal

### 9.8 SettingsModal (7 tabs)
- [ ] Editor Markdown tab (toolbar visibility toggles)
- [ ] Editor ST tab
- [ ] Mesa semántica tab (mode radio: assisted/hybrid/expert)
- [ ] Agora IA tab (provider, key, model, profile, capabilities)
- [ ] Linter Markdown tab (rules + custom dictionary)
- [ ] Acceso Git tab (token, repos, copy, regenerate)
- [ ] Cuenta y permisos tab (cambiar pwd, miembros)

### 9.9 QuickSearchModal
- [ ] Input auto-focused
- [ ] Filter chips Todos/Documento/Concepto/Fragmento/Autor/Obra
- [ ] Loading state
- [ ] Results render
- [ ] Tip "usa Ctrl+P para abrir"
- [ ] Keyboard ↑↓ Enter Esc
- [ ] ESC cierra

### 9.10 FilePropertiesModal
- [ ] Metadata read-only
- [ ] Rename inline
- [ ] Download
- [ ] Delete con confirm
- [ ] Move to folder
- [ ] ESC cierra

---

## 10. Editor `/editor/[id]`

### 10.1 Carga inicial
- [ ] Loading "Cargando documento..."
- [ ] Auth gate (redirect si no logueado)
- [ ] Embedded mode (?embedded=1)
- [ ] Salir button → /dashboard

### 10.2 Toolbar MDX
- [ ] Format: Bold, Italic, Underline, Strike, Code, Block type
- [ ] Headings dropdown
- [ ] Lists: bullet, ordered, checklist
- [ ] Code block insert
- [ ] Tables insert
- [ ] Links/images insert
- [ ] Cite/quote
- [ ] Slash menu (`/`)
- [ ] Snippets dropdown
- [ ] Mermaid editor
- [ ] LaTeX editor
- [ ] Admonitions (note/warning/danger/tip/info)
- [ ] Text Layer toggle
- [ ] View modes (Edit/Preview/Raw)
- [ ] Fullscreen toggle (mosaic-toolbar)
- [ ] Zoom +/-
- [ ] Linter toggle
- [ ] Linter config

### 10.3 Editor body
- [ ] Auto-save tras debounce
- [ ] Linter underlines
- [ ] Cmd+F search bar
- [ ] Cmd+Z undo, Cmd+Y redo
- [ ] Slash menu acciones
- [ ] Paste imagen → upload MinIO
- [ ] Multi-cursor (collab si hay otros users)

### 10.4 Lateral panels
- [ ] Mesa semántica side panel
- [ ] Outline side panel (auto)

---

## 11. Workspace `/workspace/[...slug]` viewers

### 11.1 PdfViewer
- [ ] Toolbar: page nav, zoom, search, download, print, fullscreen
- [ ] Selección texto
- [ ] Snippet desde selección
- [ ] Mobile gestures (pinch zoom, pan)

### 11.2 Image / Manuscript
- [ ] Zoom + pan
- [ ] Fullscreen
- [ ] Download

### 11.3 Audio / Video
- [ ] HTML5 player completo
- [ ] Waveform (audio)
- [ ] Captions (video si soporta)

### 11.4 Spreadsheet
- [ ] Grid render
- [ ] Sheet selector
- [ ] Export CSV/XLSX

### 11.5 Notebook
- [ ] Cells render (code/markdown/output)

### 11.6 Otros viewers (DOCX, ODT, RTF, EPUB, FB2, PowerPoint, Comic, MusicXml, TEI, Subtitle, Source Text, Generic)
- [ ] Cada uno renderiza sin crash
- [ ] Download fallback

---

## 12. Docs `/docs`

- [ ] TOC sticky desktop
- [ ] TOC drawer mobile
- [ ] Hero "Bienvenido al Futuro del Aprendizaje"
- [ ] Version badge
- [ ] Secciones colapsables (Architecture, Workspaces, Editor, etc.)
- [ ] Code blocks con copy button
- [ ] CommandRef cards
- [ ] Back to home link
- [ ] Footer dinámico year

---

## 13. Docs ST `/docs/st` + `/docs/st/[slug]`

### 13.1 Hub `/docs/st`
- [ ] TOC sticky con cursos
- [ ] Hero "¿Qué es ST?"
- [ ] Version v3.2.3 badge
- [ ] 11 cursos lógicos cards
- [ ] "Abrir guía" buttons → slug

### 13.2 Slug `/docs/st/[slug]`
- [ ] Header con title + profile + level
- [ ] TOC sticky con secciones
- [ ] Sections (Panorama, Motor v2, Cobertura, Conceptos, Operadores, Comandos, Pedagogía, Ejemplos, Errores, Límites, Conexiones)
- [ ] Code blocks runnable (Run button)
- [ ] Copy button
- [ ] Volver al índice ST
- [ ] Descargar script completo
- [ ] Repositorio ST link

### 13.3 11 slugs validados
- [ ] proposicional, primer-orden, modal-k, deontica, epistemica, intuicionista, temporal, aritmetica, aristotelica, belnap, probabilistica
- [ ] Slug inválido → 404 custom dark page

---

## 14. Sub-componentes

### 14.1 KanbanBoard
- [ ] +Card por columna
- [ ] Drag card entre columnas
- [ ] Drag card dentro columna
- [ ] Drag column reorder
- [ ] Card edit title (doble click)
- [ ] Card actions menu
- [ ] Delete card con confirm
- [ ] +Columna
- [ ] Rename columna
- [ ] Delete columna

### 14.2 STRunner
- [ ] Script/REPL toggle
- [ ] Ejecutar (Cmd+Enter)
- [ ] Reiniciar
- [ ] Visual/JSON/Texto switcher
- [ ] Output expand/collapse
- [ ] Diagnostics panel
- [ ] Symbols panel
- [ ] Settings menu
- [ ] History
- [ ] Profile selector dropdown
- [ ] Auto-run toggle
- [ ] Tabs role + aria-selected

### 14.3 PdfViewer (detalle)
- [ ] Page input (input directo + arrows)
- [ ] Zoom slider
- [ ] Search en PDF
- [ ] Match count
- [ ] Selection → snippet

### 14.4 FormalizerPlayground
- [ ] NLP/LLM toggle
- [ ] Profile dropdown 11 perfiles
- [ ] Auto-run checkbox
- [ ] History con re-select
- [ ] LLM config collapse
- [ ] Output graphic/JSON/text

### 14.5 SemanticBrowser (7 tabs)
- [ ] Resumen tab con metric cards
- [ ] Conceptos tab + ConceptCard + edit/delete
- [ ] Notas tab + FragmentCard
- [ ] Evidencias tab
- [ ] Fijados tab
- [ ] Relaciones tab + RelationCard
- [ ] Archivos ST tab + STFilesPanel
- [ ] Filter input
- [ ] Mode selector (Híbrido/Espacio)
- [ ] Verificación argumental quick fixes

### 14.6 AgoraAIChat
- [ ] Tools usage rendering
- [ ] Provider/model selector
- [ ] Capabilities toggles
- [ ] Mode toggle (Standard/Agent/Expert)
- [ ] Workspace context indicator
- [ ] Stop streaming
- [ ] Message rerun/edit/delete

### 14.7 MosaicEditor
- [ ] Toolbar completa (cada grupo)
- [ ] Slash menu
- [ ] Linter overlay
- [ ] Presence avatars (multi-user)
- [ ] Collaboration cursors
- [ ] Search bar
- [ ] FilePreviewPane
- [ ] Register concept dialog
- [ ] Import snippet dialog

---

## 15. Edge cases / states

- [ ] Workspace vacío → WelcomeView
- [ ] No docs → empty file tree
- [ ] No snippets → empty gallery
- [ ] No search results → "Sin resultados"
- [ ] Loading docs (skeleton)
- [ ] Network error → toast / banner
- [ ] Offline mode → banner + sync queue
- [ ] Conflict resolution
- [ ] Plan/quota gate → PricingModal
- [ ] Permission denied → message
- [ ] Mobile vs desktop layouts
- [ ] iPad portrait/landscape
- [ ] iPhone SE (320×568)
- [ ] iPhone X (375×812)
- [ ] Large desktop (1920×1080)
- [ ] Worker offline → mensaje + reconnect option
- [ ] AI agent stop streaming
- [ ] AI agent tool error → mensaje
- [ ] Token expired → refresh / re-login
- [ ] Logout durante actividad → redirect
- [ ] Linter timeout
- [ ] PDF render error → fallback iframe
- [ ] ST runtime error → diagnostics panel
- [ ] Markdown malformed → preserva display

---

## 16. Keyboard shortcuts

- [ ] Cmd+P / Ctrl+P → QuickSearch
- [ ] Cmd+E / Ctrl+E → QuickSearch alt
- [ ] Cmd+, / Ctrl+, → Settings
- [ ] Cmd+N / Ctrl+N → New file
- [ ] Cmd+S / Ctrl+S → Sync now
- [ ] Cmd+B / Ctrl+B → Sidebar toggle (chord Ctrl+K B)
- [ ] Ctrl+K Z / F11 → Zen mode
- [ ] Ctrl+K S → Keyboard shortcuts modal
- [ ] Ctrl+K W → Close all tabs
- [ ] Ctrl+K H → Problems pane
- [ ] Ctrl+K T → Settings
- [ ] Ctrl+K P → Copy active doc path
- [ ] Ctrl+K R → Reveal active in sidebar
- [ ] Ctrl+K O → Upload folder
- [ ] Ctrl+W → Close active tab
- [ ] F1 → Command Palette
- [ ] F11 → Zen mode
- [ ] ? → Keyboard help (si shortcut existe)
- [ ] ESC → Cierra modales abiertos
- [ ] Editor Cmd+B → Bold
- [ ] Editor Cmd+I → Italic
- [ ] Editor Cmd+/ → Slash menu

---

## 17. Eventos globales (`agora-events.ts`)

- [ ] agora:agent-tool-result
- [ ] agora:worker-command-result
- [ ] agora:agent-ui-command
- [ ] agora:agent-diagnostic
- [ ] agora:documents-mutated
- [ ] agora:docs-changed
- [ ] agora:open-documents
- [ ] agora:rtdb-event
- [ ] agora:problem
- [ ] agora:document-content
- [ ] agora:doc-content-updated
- [ ] agora:jump-to-line
- [ ] agora:insert-snippet
- [ ] agora:open-ai-config
- [ ] agora:open-linter-config
- [ ] agora:open-bottom-dock
- [ ] agora:plan-required
- [ ] agora:md-diagnostics
- [ ] agora:st-diagnostics
- [ ] agora:st-editor-config-changed
- [ ] agora:st-source-saved
- [ ] agora:semantic-preferences-changed
- [ ] agora:focus-document-section
- [ ] agora:touch-drag-* (5 eventos)
- [ ] agora:prompt-user-choice
- [ ] agora:show-diff
- [ ] agora:agent-status
- [ ] agora:agent-plan

---

## Bugs encontrados (V2)

> Severity: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low

_(vacío al inicio — se actualiza cada ciclo)_
## Sweep V2 (sesión 2026-05-06 ~13:00) — Resultados

### Validados con MCP
- Landing: 9 nav links, 6 pillars, 4 plans, 3 demos (STRunner/MarkdownPreview/Formalizer), 4 workflow steps, 6 sections (#vision/#pillars/#st/#formalizer/#workflow/#pricing), footer dinámico ✅
- Login: 2 tabs con role=tab+aria-selected (fix), email autocomplete/inputMode/spellCheck OK, password autocomplete OK, submit/google/forgot/volver buttons ✅
- Dashboard shell: 8/8 activity bar buttons, 4/4 bottom dock tabs, right panel Agora AI, status bar (Worker/Conexión/Guardado/Linter/Problemas) ✅
- Mosaic panels: ST (Script/REPL/Ejecutar/syntax-highlight), Formalizer (auto checkbox/Formalizar/select), Mesa Semántica (Resumen/Conceptos), PDF (page/Abrir/Descargar) ✅
- Modales (con role=dialog + ESC): WorkspaceManagerModal abierto/cerrado vía ESC tras fix de hook ✅
- Keyboard shortcuts: F1 → Command Palette ✅, Ctrl+, → Settings ✅, Ctrl+P → QuickSearch ✅, Ctrl+B → toggle sidebar ✅, Ctrl+Shift+E → Files ✅
- Formalizer: 11 perfiles ST disponibles, NLP+LLM toggles ✅
- /docs/st/proposicional: 24 code blocks, 24 Run, 24 Copy, 12 TOC links, 46 headings, Volver/Descargar/Repo links ✅
- Search panel: query "README" → 1 resultado correcto ✅
- Logout + login fresh end-to-end con creds reales ✅

### Bugs encontrados y fixed
- **BUG-V2-1** 🟢: tabs login sin role=tab/aria-selected → fix aplicado.
- **BUG-V2-2** 🟢: useEscapeClose throws TypeError si target=document (sintético) → defensive `target instanceof Element` aplicado.

### Confirmaciones de bugs deferidos / data-only
- File tree usa `<div onClick>` no `role="tree"` (BUG-12 deferido — refactor mayor).
- Snippets duplicados existentes en BD: ~140 cards visibles (FOL · Silogismo universal x17, Mermaid x18, etc.). Mi fix de `seedDefaultSnippets` previene NUEVOS duplicados, pero los ~120+ existentes son data legacy. Cleanup require server-side script o feature UI.

### Items NO probados (requieren tests destructivos / interactivos)
- Click slash menu MDX en editor (requiere editor focused)
- Insert snippet desde gallery
- Crear/borrar archivo real (evitado en prod)
- Drag-drop en file tree
- Crear sesión terminal (requiere worker activo)
- Send AI message (cuesta $)
- Workspace switching real (requiere navegación)
- Real-time presence multi-user
- Conflict resolution (necesita conflicto)

### Commits sesión V2
- c2281f2 fix(a11y): tabs login + useEscapeClose seguro

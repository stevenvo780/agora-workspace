# AGENT_TOOLS_API — Catálogo de tools del agente Agora

Auto-generado desde `AgoraBack/src/lib/agora-ai/toolDefinitions.ts`.
Lista exhaustiva de las **145 tools** que el agente IA puede ejecutar en
runtime. Cada entrada incluye: descripción, parámetros con tipo, capability
requerida (ver `accessPolicy.ts`), categoría funcional y un ejemplo de
invocación JSON.

> **Cómo se ejecuta una tool**: el modelo emite un tool call en el formato
> de su proveedor (OpenAI/Anthropic/Gemini/Ollama). `AgoraBack` valida el
> nombre contra `AGORA_AGENT_TOOLS`, chequea la `accessPolicy` del user y
> ejecuta el handler en `src/lib/agora-ai/toolExecutors/*.ts`.

## Cambios en esta versión (2026-05-12)

- **Total**: 142 → **145 tools**.
- **Eliminada**: `agent_replay_turn` (nunca usada en producción, código
  muerto).
- **Deprecated**: 5 tools marcadas con prefijo `DEPRECATED:` en su
  `description`; se retiran el siguiente sprint si nadie las consume.
- **Enriquecidas**: 28 tools con campos extra "cuándo usar / cuándo NO
  usar / ejemplo" para que el LLM las descubra y use mejor.
- **Nueva sección en system prompt**: **"Estrategia de búsqueda
  jerárquica"** (7 pasos) — ver al final de este doc.
- **3 tools nuevas en §10 (búsqueda & grafo)**: `query_citation_graph`,
  `find_related_via_graph`, `expand_context` (la sección ya existía pero
  estaba marcada con 3 entradas placeholder; ahora están implementadas y
  enriquecidas).

---

## Capabilities (perfiles de acceso)

Definidas en `accessPolicy.ts`. Cada tool requiere una capability; la
política de acceso (`AgentAccessPolicy`) controla cuáles están habilitadas.

| Capability | Significado |
|------------|-------------|
| `workspaceContext` | Lectura del workspace activo (siempre necesaria). |
| `documentsRead` | Lee documentos, snippets, semántico de solo lectura, etc. |
| `documentsWrite` | Crea/actualiza documentos, snippets, conceptos. |
| `documentsDelete` | Elimina documentos, carpetas, archivos. |
| `snippets` | Operaciones sobre snippets reutilizables. |
| `board` | Operaciones sobre tablero Kanban. |
| `semantic` | Glosario semántico y relaciones. |
| `logic` | Runtime ST, formalizador, perfiles lógicos. |
| `gitRead` | git status/log/diff. |
| `gitWrite` | git commit/pull/push/checkout/revert/branch. |
| `workerRead` | Lee archivos del worker / sesiones / logs. |
| `workerCommand` | Ejecuta comandos shell, escribe archivos, mata procesos. |
| `uiControl` | Abre paneles, muestra diffs, prompts al user. |
| `debug` | Publica notas de debug del agente. |

### Perfiles preconfigurados

| Profile | Capabilities habilitadas | Uso |
|---------|--------------------------|-----|
| `read_only` | workspaceContext, documentsRead, semantic, logic, uiControl, debug | Lectura segura. |
| `editor` | + documentsWrite, snippets, board | Editor seguro: crea/edita sin borrar ni terminal. |
| `workspace` | + gitRead, workerRead | Default cliente. Trabajo diario. |
| `developer` | TODAS (auto-confirma destructivas) | Power user / Claude harness. |
| `custom` | Definidas por user | Mix manual de capabilities y per-tool overrides. |

---

## Categorías (índice rápido)

| Categoría | Tools | Sección |
|-----------|-------|---------|
| Documentos & carpetas | 16 | [§1](#1-documentos--carpetas) |
| Workspace & contexto | 6 | [§2](#2-workspace--contexto) |
| Worker / terminal | 11 | [§3](#3-worker--terminal) |
| Git | 9 | [§4](#4-git) |
| Snippets | 8 | [§5](#5-snippets) |
| Kanban (tablero) | 10 | [§6](#6-kanban-tablero) |
| Lógica & ST | 9 | [§7](#7-lógica--st) |
| Semántico (glosario) | 11 | [§8](#8-semántico-glosario) |
| Inteligencia documental | 7 | [§9](#9-inteligencia-documental) |
| Búsqueda & grafo de citas | 3 | [§10](#10-búsqueda--grafo-de-citas) |
| UI / control de paneles | 5 | [§11](#11-ui--control-de-paneles) |
| Administración del workspace | 9 | [§12](#12-administración-del-workspace) |
| Observabilidad & auditoría | 11 | [§13](#13-observabilidad--auditoría) |
| Sync (RTDB / outbox) | 3 | [§14](#14-sync-rtdb--outbox) |
| Suscripciones & cuotas | 4 | [§15](#15-suscripciones--cuotas) |
| Diccionario del linter | 3 | [§16](#16-diccionario-del-linter) |
| Agente: plan / memoria / hooks | 11 | [§17](#17-agente-plan--memoria--hooks) |
| Externos | 2 | [§18](#18-externos) |
| **TOTAL** | **145** | — |

> Nota: el §17 bajó de 12 a 11 al retirar `agent_replay_turn`. El §10 pasa
> de 0/3 placeholders a **3 tools implementadas y descritas**.

---

## 1. Documentos & carpetas

### `list_documents`
- **Capability**: `documentsRead`
- **Descripción**: Lista documentos del workspace actual. Default hasta 100 (subible a 500). Paginación via `cursor` cuando `page.hasMore=true`.
- **Parámetros**:
  - `folder` (string, opcional) — Carpeta concreta.
  - `type` (enum DocumentType, opcional) — Filtra por tipo.
  - `limit` (number 1..500, default 100) — Items devueltos.
  - `pageSize` (number, default 2000, máx 10000) — Tamaño página Firestore.
  - `cursor` (string, opcional) — Cursor opaco para paginar.
- **Ejemplo**: `{ "name": "list_documents", "args": { "folder": "Clase 1", "limit": 50 } }`

### `read_document`
- **Capability**: `documentsRead`
- **Descripción**: Lee contenido completo de un doc. Si hay ambigüedad devuelve `{ ambiguous: true, candidates: [...] }`.
- **Parámetros**: `documentId` (string, requerido).
- **Ejemplo**: `{ "name": "read_document", "args": { "documentId": "abc123" } }`

### `create_document`
- **Capability**: `documentsWrite`
- **Descripción**: Crea documento de texto o carpeta.
- **Parámetros**: `title` (string, req), `content` (string), `folder` (string), `type` (enum Text|Folder).
- **Ejemplo**: `{ "name": "create_document", "args": { "title": "Nota nueva", "content": "# Hola", "folder": "Clase 1" } }`

### `update_document`
- **Capability**: `documentsWrite`
- **Descripción**: Actualiza contenido y/o título.
- **Parámetros**: `documentId` (req), `content`, `title`.

### `rename_document`
- **Capability**: `documentsWrite`
- **Descripción**: Renombra sin tocar contenido.
- **Parámetros**: `documentId` (req), `newTitle` (req).

### `move_document`
- **Capability**: `documentsWrite`
- **Descripción**: Mueve doc a otra carpeta.
- **Parámetros**: `documentId` (req), `targetFolder` (req).

### `delete_document`
- **Capability**: `documentsDelete`
- **Descripción**: Elimina doc. Requiere `confirmed:true`.
- **Parámetros**: `documentId` (req), `confirmed` (bool).

### `search_documents`
- **Capability**: `documentsRead`
- **Descripción**: Busca por nombre/carpeta/contenido. Paginado.
- **Parámetros**: `query` (req), `limit` (1..25), `pageSize`, `cursor`.

### `duplicate_document`
- **Capability**: `documentsWrite`
- **Descripción**: Clona un doc con nombre nuevo opcional. Hidrata contenido real desde MinIO.
- **Parámetros**: `documentId` (req), `newName`, `targetFolder`.

### `rename_folder`
- **Capability**: `documentsWrite`
- **Descripción**: Renombra carpeta y reasigna en cascada todos los docs hijos. Atómico via batch.
- **Parámetros**: `fromPath` (req), `toName` (req).

### `delete_folder`
- **Capability**: `documentsDelete`
- **Descripción**: Elimina carpeta. Requiere `cascade:true` si tiene hijos. Destructivo.
- **Parámetros**: `folderPath` (req), `cascade` (bool), `confirmed` (bool).

### `list_folders`
- **Capability**: `documentsRead`
- **Descripción**: Lista las CARPETAS del workspace. PRIMER PASO para preguntas académicas.
- **Parámetros**: (none).

### `create_folder`
- **Capability**: `documentsWrite`
- **Descripción**: Crea nueva carpeta lógica.
- **Parámetros**: `name` (req), `parentFolder`.

### `upload_external_url`
- **Capability**: `documentsWrite`
- **Descripción**: Descarga URL pública e ingiere como doc markdown. Bloquea localhost. Requiere `confirmed:true`.
- **Parámetros**: `url` (req), `targetFolder`, `name`, `confirmed`.

### `download_workspace_bundle`
- **Capability**: `documentsRead`
- **Descripción**: Manifiesto de docs del workspace o carpeta. El zip binario va por `/api/workspaces/:id/export`.
- **Parámetros**: `folderPath` (opcional).

### `get_document_content_at_revision`
- **Capability**: `documentsRead`
- **Descripción**: Stub: no implementado en Firestore. Sugiere usar `git_log`/`git_show` del worker.
- **Parámetros**: `documentId` (req), `revision`.

---

## 2. Workspace & contexto

### `get_workspace_info`
- **Capability**: `documentsRead`
- **Descripción**: Info del workspace activo, miembros y metadatos.
- **Parámetros**: (none).

### `inspect_workspace`
- **Capability**: `documentsRead`
- **Descripción**: Inventario completo (carpetas, docs, snippets, tablero, semántico, worker opcional). Paginado.
- **Parámetros**: `includeWorker` (bool), `limit` (5..100), `pageSize`, `cursor`.

### `search_workspace`
- **Capability**: `documentsRead`
- **Descripción**: Busca docs + snippets + conceptos + cards Kanban en una página.
- **Parámetros**: `query` (req), `limit` (1..25), `pageSize`, `cursor`.

### `read_workspace_bundle`
- **Capability**: `documentsRead`
- **Descripción**: Lee paquete de contexto del workspace (filtros por carpeta, query o documentIds).
- **Parámetros**: `documentIds` (string[]), `folder`, `query`, `includeContent`, `includeSnippets`, `includeSemantic`, `maxDocuments` (1..50), `maxCharsPerDocument` (500..12000), `pageSize`, `cursor`.

### `list_workspaces`
- **Capability**: `documentsRead`
- **Descripción**: Lista todos los workspaces a los que el user tiene acceso.
- **Parámetros**: `limit` (1..100, default 25).

### `sync_status`
- **Capability**: `workerRead`
- **Descripción**: Resumen sync: docs Firestore, worker conectado, estado Git.
- **Parámetros**: (none).

---

## 3. Worker / terminal

### `get_worker_status`
- **Capability**: `workerRead`
- **Descripción**: Consulta si hay worker conectado y sesiones activas.
- **Parámetros**: (none).

### `run_worker_command`
- **Capability**: `workerCommand`
- **Descripción**: Ejecuta shell dentro del worker (`/workspace`). Requiere confirmación.
- **Parámetros**: `command` (req), `cwd`, `timeoutMs` (1000..25000), `maxOutputChars` (1000..20000), `expectChanges` (bool), `reason`, `confirmed`.
- **Ejemplo**: `{ "name": "run_worker_command", "args": { "command": "npm test", "reason": "Validar suite tras cambio", "confirmed": true } }`

### `list_worker_files`
- **Capability**: `workerRead`
- **Descripción**: Lista archivos en `/workspace` con comando read-only controlado.
- **Parámetros**: `path` (default "."), `maxDepth` (1..6), `limit` (1..200).

### `read_worker_file`
- **Capability**: `workerRead`
- **Descripción**: Lee archivo del worker (`head -c N`).
- **Parámetros**: `path` (req), `maxBytes` (256..200000, default 50000).

### `write_worker_file`
- **Capability**: `workerCommand`
- **Descripción**: Escribe a archivo en `/workspace` (sobrescribe). Crea directorios padre. Requiere `confirmed:true`.
- **Parámetros**: `path` (req), `content` (req), `confirmed`.

### `tail_worker_logs`
- **Capability**: `workerRead`
- **Descripción**: `tail -n` de un archivo en el worker.
- **Parámetros**: `path` (req), `lines` (1..500, default 100).

### `kill_worker_process`
- **Capability**: `workerCommand`
- **Descripción**: Envía señal a PID dentro del worker.
- **Parámetros**: `pid` (req), `signal` (TERM|KILL|HUP|INT|QUIT), `confirmed`.

### `restart_worker`
- **Capability**: `workerCommand`
- **Descripción**: Stub: hoy sugiere `pkill -f /app/index.js`. Cloud Run no controla Docker directo.
- **Parámetros**: `confirmed` (bool).

### `start_worker`
- **Capability**: `workerCommand`
- **Descripción**: Stub: crear container requiere sudo en host, no expuesto desde Cloud Run.
- **Parámetros**: (none).

### `list_active_terminal_sessions`
- **Capability**: `documentsRead`
- **Descripción**: Sesiones PTY activas del worker.
- **Parámetros**: (none).

### `kill_terminal_session`
- **Capability**: `workerCommand`
- **Descripción**: Stub: no hay endpoint REST directo desde Cloud Run.
- **Parámetros**: `sessionId` (req), `confirmed`.

---

## 4. Git

### `git_status`
- **Capability**: `gitRead`
- **Descripción**: Estado Git en Forgejo: docs nuevos/modificados/limpios.
- **Parámetros**: (none).

### `git_log`
- **Capability**: `gitRead`
- **Descripción**: Historial de commits Git del workspace.
- **Parámetros**: `limit` (1..50).

### `git_diff`
- **Capability**: `gitRead`
- **Descripción**: `git diff` en worker. Soporta `path` y `staged:true` (index).
- **Parámetros**: `path`, `staged` (bool).

### `git_commit_workspace`
- **Capability**: `gitWrite`
- **Descripción**: Crea commit con docs nuevos/modificados. Requiere `confirmed`.
- **Parámetros**: `message` (req), `documentIds` (string[]), `confirmed`.

### `git_pull`
- **Capability**: `gitWrite`
- **Descripción**: `git pull` del worker (modifica filesystem).
- **Parámetros**: `remote` (default "origin"), `branch`.

### `git_push_branch`
- **Capability**: `gitWrite`
- **Descripción**: `git push`. Requiere `confirmed:true`.
- **Parámetros**: `remote`, `branch`, `confirmed`.

### `git_create_branch`
- **Capability**: `gitWrite`
- **Descripción**: `git checkout -b <branch>` en worker.
- **Parámetros**: `branch` (req).

### `git_checkout`
- **Capability**: `gitWrite`
- **Descripción**: `git checkout <target>` (branch o commit).
- **Parámetros**: `target` (req).

### `git_revert_commit`
- **Capability**: `gitWrite`
- **Descripción**: Crea commit reverso. Requiere `confirmed:true`.
- **Parámetros**: `sha` (req), `confirmed`.

---

## 5. Snippets

### `list_snippets`
- **Capability**: `snippets`
- **Descripción**: Lista snippets del workspace.
- **Parámetros**: (none).

### `create_snippet`
- **Capability**: `snippets`
- **Descripción**: Crea snippet con markdown.
- **Parámetros**: `title` (req), `markdown` (req), `description`, `category`.

### `read_snippet`
- **Capability**: `snippets`
- **Descripción**: Lee snippet por ID o título.
- **Parámetros**: `snippetId` (req).

### `search_snippets`
- **Capability**: `snippets`
- **Descripción**: Busca en título/categoría/desc/markdown.
- **Parámetros**: `query` (req), `limit` (1..25).

### `update_snippet`
- **Capability**: `snippets`
- **Descripción**: Actualiza snippet.
- **Parámetros**: `snippetId` (req), `title`, `markdown`, `description`, `category`, `order`.

### `delete_snippet`
- **Capability**: `snippets`
- **Descripción**: Elimina snippet.
- **Parámetros**: `snippetId` (req).

### `apply_snippet_to_document`
- **Capability**: `documentsWrite`
- **Descripción**: Inserta snippet al inicio/final/cursor de un doc.
- **Parámetros**: `documentId` (req), `snippetId` (req), `position` (start|end|cursor), `confirmed`.

### `import_snippets_from_url`
- **Capability**: `snippets`
- **Descripción**: Importa hasta 50 snippets desde URL JSON. Requiere `confirmed:true`.
- **Parámetros**: `url` (req), `confirmed`.

---

## 6. Kanban (tablero)

### `get_board`
- **Capability**: `board`
- **Descripción**: Tablero Kanban con columnas y cards de TAREAS (no contenido académico).
- **Parámetros**: (none).

### `create_board_column`
- **Capability**: `board`
- **Descripción**: Crea columna.
- **Parámetros**: `name` (req), `order`.

### `rename_board_column`
- **Capability**: `board`
- **Descripción**: Renombra columna.
- **Parámetros**: `columnId` (req), `name` (req).

### `delete_board_column`
- **Capability**: `board`
- **Descripción**: Elimina columna y sus cards. Requiere `confirmed:true`.
- **Parámetros**: `columnId` (req), `confirmed`.

### `create_board_card`
- **Capability**: `board`
- **Descripción**: Crea card en columna.
- **Parámetros**: `columnId` (req), `title` (req), `description`, `sourceDocId`, `sourceDocName`, `sourceFragment`, `sourcePath`.

### `update_board_card`
- **Capability**: `board`
- **Descripción**: Actualiza card.
- **Parámetros**: `cardId` (req), `title`, `description`, `columnId`, `order`.

### `move_board_card`
- **Capability**: `board`
- **Descripción**: Mueve card a otra columna.
- **Parámetros**: `cardId` (req), `targetColumnId` (req), `order`.

### `delete_board_card`
- **Capability**: `board`
- **Descripción**: Elimina card. Requiere `confirmed:true`.
- **Parámetros**: `cardId` (req), `confirmed`.

### `bulk_create_board_cards`
- **Capability**: `board`
- **Descripción**: Crea hasta 50 cards en una llamada.
- **Parámetros**: `cards` (array de `{ columnId, title, description? }`, req).

### `archive_board_card`
- **Capability**: `board`
- **Descripción**: Archiva/desarchiva card.
- **Parámetros**: `cardId` (req), `archived` (bool).

---

## 7. Lógica & ST

### `check_logic`
- **Capability**: `logic`
- **Descripción**: Formaliza texto a ST y lo ejecuta. **Úsalo siempre** que el user pregunte validez/contradicciones/silogismos.
- **Parámetros**: `text` (req), `profile`, `language` (es|en).

### `formalize_text`
- **Capability**: `logic`
- **Descripción**: Solo formaliza (no ejecuta). Si necesitas ejecutar, usa `check_logic`.
- **Parámetros**: `text` (req), `profile`, `language`.

### `list_st_profiles`
- **Capability**: `logic`
- **Descripción**: Lista perfiles lógicos disponibles (classical.propositional, fol, modal.K, etc.).
- **Parámetros**: (none).

### `validate_st_syntax`
- **Capability**: `logic`
- **Descripción**: Valida sintaxis ST sin ejecutar.
- **Parámetros**: `program` (req).

### `run_st_program`
- **Capability**: `logic`
- **Descripción**: Ejecuta programa ST. Devuelve salida, diagnostics, trazas.
- **Parámetros**: `program` (req).

### `render_st_glossary`
- **Capability**: `logic`
- **Descripción**: Ejecuta y devuelve glosario activo de definiciones/interpretaciones.
- **Parámetros**: `program` (req), `format` (plain|markdown).

### `explain_formalization`
- **Capability**: `logic`
- **Descripción**: Formaliza y explica pedagógicamente.
- **Parámetros**: `text` (req), `profile`, `language`.

### `prove_step`
- **Capability**: `logic`
- **Descripción**: Pide al runtime ST probar conclusión desde axiomas. Devuelve `provable|unknown|unprovable`.
- **Parámetros**: `program` (req), `conclusion` (req), `fromAxioms` (string[]).

### `compare_logic_profiles`
- **Capability**: `logic`
- **Descripción**: Evalúa fórmula en N perfiles a la vez.
- **Parámetros**: `formula` (req), `profiles` (string[]).

---

## 8. Semántico (glosario)

### `get_semantic_state`
- **Capability**: `semantic`
- **Descripción**: Estado semántico: conceptos, fragmentos, relaciones.
- **Parámetros**: (none).

### `list_concepts`
- **Capability**: `semantic`
- **Descripción**: Lista CONCEPTOS del glosario (no carpetas).
- **Parámetros**: `query`, `limit` (1..50).

### `define_concept`
- **Capability**: `semantic`
- **Descripción**: Crea/actualiza concepto en glosario.
- **Parámetros**: `title` (req), `definition`, `formula`, `logicProfile`, `docName`, `docId`, `excerpt`.

### `update_concept`
- **Capability**: `semantic`
- **Descripción**: Edita concepto existente. Cambios parciales en title/definition/formula/logicProfile/status.
- **Parámetros**: `conceptId`, `id` (alias), `title`, `definition`, `formula`, `logicProfile`, `status` (draft|validated|archived).

### `delete_concept`
- **Capability**: `semantic`
- **Descripción**: Elimina concepto y relaciones en cascada. Requiere `confirmed:true`.
- **Parámetros**: `conceptId`, `id`, `title`, `confirmed`.

### `create_relation`
- **Capability**: `semantic`
- **Descripción**: Crea relación entre conceptos.
- **Parámetros**: `sourceConceptId` (req), `targetConceptId` (req), `relationType` (supports|contradicts|implies|depends-on|defines|example-of|evidence-for|evidence-against|restates|questions|related-to).

### `update_relation`
- **Capability**: `semantic`
- **Descripción**: Edita relación.
- **Parámetros**: `relationId`, `id`, `relationType`, `status` (draft|validated|archived).

### `delete_relation`
- **Capability**: `semantic`
- **Descripción**: Elimina relación. Requiere `confirmed:true`.
- **Parámetros**: `relationId`, `id`, `confirmed`.

### `find_orphaned_concepts`
- **Capability**: `semantic`
- **Descripción**: Conceptos sin relaciones (cleanup).
- **Parámetros**: (none).

### `merge_concepts`
- **Capability**: `semantic`
- **Descripción**: Fusiona conceptos: relaciones de `fromId` van a `intoId`. Requiere `confirmed:true`.
- **Parámetros**: `fromId` (req), `intoId` (req), `confirmed`.

### `formalize_document_section`
- **Capability**: `logic`
- **Descripción**: Formaliza sección de doc (delimitada por heading) usando autologic.
- **Parámetros**: `documentId` (req), `headingTitle`, `profile`.

---

## 9. Inteligencia documental

### `summarize_document`
- **Capability**: `documentsRead`
- **Descripción**: Resumen extractivo del doc.
- **Parámetros**: `documentId` (req), `maxSentences` (1..8).

### `compare_documents`
- **Capability**: `documentsRead`
- **Descripción**: Compara dos docs (similitudes, diferencias, estructura).
- **Parámetros**: `leftDocumentId` (req), `rightDocumentId` (req).

### `analyze_document`
- **Capability**: `documentsRead`
- **Descripción**: Análisis: headings, checklist, links, fórmulas, métricas.
- **Parámetros**: `documentId` (req).

### `outline_document`
- **Capability**: `documentsRead`
- **Descripción**: Esquema (headings markdown) del doc.
- **Parámetros**: `documentId` (req).

### `extract_pending_tasks`
- **Capability**: `board`
- **Descripción**: Extrae pendientes markdown y opcionalmente crea cards Kanban.
- **Parámetros**: `documentId` (req), `createCards` (bool), `targetColumnId`.

### `find_broken_links`
- **Capability**: `documentsRead`
- **Descripción**: Enlaces markdown a docs inexistentes. Paginado.
- **Parámetros**: `documentId` (req), `pageSize`, `cursor`.

### `find_duplicates`
- **Capability**: `documentsRead`
- **Descripción**: Detecta duplicados (hash) y similares (Jaccard). Requiere `confirm:true`.
- **Parámetros**: `minSimilarity` (0.1..1), `confirm`, `pageSize`, `cursor`.

### `extract_text_from_pdf`
- **Capability**: `documentsRead`
- **Descripción**: Extrae texto plano de PDF subido al workspace (requiere `storagePath` MinIO).
- **Parámetros**: `documentId` (req).

### `lint_document`
- **Capability**: `documentsRead`
- **Descripción**: Linter ligero (~7 reglas regex) para markdown. Para 53 reglas completas usar panel Problemas.
- **Parámetros**: `documentId` (req).

### `lint_st_document`
- **Capability**: `documentsRead`
- **Descripción**: Runtime ST sobre doc `.st`. Devuelve diagnostics (errors, warnings, contramodelos).
- **Parámetros**: `documentId` (req).

---

## 10. Búsqueda & grafo de citas

### `query_citation_graph`
- **Capability**: `documentsRead`
- **Descripción**: Subgrafo de docs conectados al focus por citas (wiki-links, links MD, conceptos, bib). Úsalo PRIMERO para preguntas sobre doc específico.
- **Cuándo usar**: el user pregunta "qué se relaciona con X", "qué cita a Y",
  "vecindario del doc Z". Devuelve nodos + aristas, ideal para mapear
  conexiones rápido sin pegar reads grandes.
- **Cuándo NO usar**: si no conoces el `focusDocId` aún → primero
  `search_documents` o `find_related_via_graph` que acepta query
  textual. No sirve para búsqueda lexical pura.
- **Parámetros**: `focusDocIds` (req string[]), `depth` (1..3, default 1), `kinds` (wiki|link|concept|bib)[].
- **Ejemplo**: `{ "name": "query_citation_graph", "args": { "focusDocIds": ["abc123"], "depth": 2, "kinds": ["wiki","concept"] } }`

### `find_related_via_graph`
- **Capability**: `documentsRead`
- **Descripción**: Búsqueda híbrida: lexical + expansión via grafo. Para "docs relacionados con X".
- **Cuándo usar**: tienes una query textual ("modal logic", "Kant ética")
  y quieres rankear no sólo por match lexical sino también por proximidad
  en el grafo. Mejor recall que `search_documents` para preguntas
  conceptuales.
- **Cuándo NO usar**: si la query es muy específica (nombre exacto de
  archivo, ID) — usá `search_documents`. Si querés navegar desde un doc
  conocido sin query, usá `expand_context`.
- **Parámetros**: `query` (req), `seedDocId`, `limit` (default 15, máx 50).
- **Ejemplo**: `{ "name": "find_related_via_graph", "args": { "query": "silogismo categórico", "seedDocId": "abc123", "limit": 20 } }`

### `expand_context`
- **Capability**: `documentsRead`
- **Descripción**: Dado docs iniciales, expande via citas. Úsalo ANTES de `read_workspace_bundle` para enriquecer contexto sin escanear todo.
- **Cuándo usar**: ya tenés docs iniciales (de un `search` o respuesta
  previa) y querés enriquecer el contexto antes de pasarlo al modelo.
  Más barato que `read_workspace_bundle` con `query`.
- **Cuándo NO usar**: si no tenés docs iniciales aún. Si querés docs
  RELEVANTES por query textual, usá `find_related_via_graph`. Si querés
  el grafo entero, usá `query_citation_graph`.
- **Parámetros**: `initialDocIds` (req string[]), `hops` (1..2, default 1).
- **Ejemplo**: `{ "name": "expand_context", "args": { "initialDocIds": ["abc123","def456"], "hops": 1 } }`

---

## 11. UI / control de paneles

### `open_app_panel`
- **Capability**: `uiControl`
- **Descripción**: Pide a la UI abrir/enfocar un panel (files, terminal, board, semantic, etc.).
- **Parámetros**: `panel` (enum, req), `folder`.

### `focus_document_section`
- **Capability**: `uiControl`
- **Descripción**: Scrollea/selecciona sección del doc abierto.
- **Parámetros**: `documentId` (req), `headingTitle`, `line`.

### `prompt_user_choice`
- **Capability**: `uiControl`
- **Descripción**: Presenta pregunta con 2-8 opciones. Espera respuesta.
- **Parámetros**: `question` (req), `choices` (req string[]).

### `show_diff_to_user`
- **Capability**: `uiControl`
- **Descripción**: Muestra diff before→after y pide confirmación antes de aplicar.
- **Parámetros**: `title`, `before`, `after`.

### `report_status_to_user`
- **Capability**: `uiControl`
- **Descripción**: Status persistente ("Estoy haciendo X de Y, Z%").
- **Parámetros**: `status` (req), `detail`.

---

## 12. Administración del workspace

### `invite_member`
- **Capability**: `documentsWrite` (admin)
- **Descripción**: Añade userId/email a invitaciones pendientes. Solo owner. Requiere `confirmed:true`.
- **Parámetros**: `userIdOrEmail` (req), `confirmed`.

### `remove_member`
- **Capability**: `documentsWrite` (admin)
- **Descripción**: Quita miembro (no owner). Solo owner. Requiere `confirmed:true`.
- **Parámetros**: `userId` (req), `confirmed`.

### `change_workspace_settings`
- **Capability**: `documentsWrite` (admin)
- **Descripción**: Modifica name/description/visibility. Solo owner.
- **Parámetros**: `name`, `description`, `visibility` (private|shared).

### `transfer_workspace_ownership`
- **Capability**: `documentsWrite` (admin)
- **Descripción**: Transfiere ownership. Pierdes permisos admin. Requiere `confirmed:true`.
- **Parámetros**: `newOwnerId` (req), `confirmed`.

### `list_members`
- **Capability**: `documentsWrite` (admin)
- **Descripción**: Miembros + invitaciones pendientes.
- **Parámetros**: (none).

### `accept_invite`
- **Capability**: `documentsWrite` (admin)
- **Descripción**: Acepta invitación pendiente.
- **Parámetros**: `workspaceId`.

### `decline_invite`
- **Capability**: `documentsWrite` (admin)
- **Descripción**: Rechaza invitación pendiente.
- **Parámetros**: `workspaceId`.

### `provision_workspace_git`
- **Capability**: `documentsWrite` (admin)
- **Descripción**: Idempotente: asegura repo Forgejo y acceso del user.
- **Parámetros**: `workspaceId`.

### `add_favorite` / `remove_favorite` / `list_favorites`
- **Capability**: `documentsWrite` / `documentsRead`
- **Descripción**: Gestiona favoritos del user.
- **Parámetros**: `documentId` (req, salvo `list_favorites`).

---

## 13. Observabilidad & auditoría

### `list_recent_actions`
- **Capability**: `documentsRead`
- **Descripción**: Últimas tools ejecutadas por el agente para este user/workspace.
- **Parámetros**: `limit`, `sinceMs`.

### `get_agent_audit_log`
- **Capability**: `documentsRead`
- **Descripción**: Audit log persistido del agente. Filtrable por tool.
- **Parámetros**: `limit`, `tool`.

### `inspect_sync_outbox`
- **Capability**: `documentsRead`
- **Descripción**: Eventos sync pendientes (`syncEventsOutbox`).
- **Parámetros**: `limit`.

### `get_document_sync_state`
- **Capability**: `documentsRead`
- **Descripción**: Estado sync de un doc: `synced|storage-only|firestore-only|empty`.
- **Parámetros**: `documentId` (req).

### `get_storage_usage`
- **Capability**: `documentsRead`
- **Descripción**: Uso de espacio: documentCount, totalBytes, minioBytes, firestoreBytes.
- **Parámetros**: (none).

### `find_large_documents`
- **Capability**: `documentsRead`
- **Descripción**: Docs con size > minBytes (default 100KB). Paginado.
- **Parámetros**: `minBytes`, `limit` (1..50, default 20), `pageSize`, `cursor`.

### `list_recent_workspace_activity`
- **Capability**: `documentsRead`
- **Descripción**: Docs editados en últimas N horas.
- **Parámetros**: `sinceHours` (1..720, default 24), `limit`.

### `get_repo_info`
- **Capability**: `documentsRead`
- **Descripción**: Info del repo Forgejo del workspace.
- **Parámetros**: `workspaceId`.

### `list_workspace_repos`
- **Capability**: `documentsRead`
- **Descripción**: Lista repos Forgejo accesibles para el user.
- **Parámetros**: (none).

### `report_debug`
- **Capability**: `debug`
- **Descripción**: Publica nota de debug del agente en bus de Problemas.
- **Parámetros**: `severity` (error|warning|info|hint), `message` (req), `detail`, `code`.

### `find_unused_snippets`
- **Capability**: `documentsRead`
- **Descripción**: Snippets cuyo título no aparece en ningún doc (heurística).
- **Parámetros**: (none).

---

## 14. Sync (RTDB / outbox)

### `force_emit_sync_ping`
- **Capability**: `documentsRead`
- **Descripción**: Emite manualmente ping RTDB para refrescar clientes. `op = created|updated|deleted|refresh`.
- **Parámetros**: `op`, `path`.

### `inspect_sync_outbox` (ver §13)
### `get_document_sync_state` (ver §13)

---

## 15. Suscripciones & cuotas

### `get_subscription_status`
- **Capability**: `documentsRead`
- **Descripción**: Plan actual del user y datos de suscripción.
- **Parámetros**: (none).

### `list_quota`
- **Capability**: `documentsRead`
- **Descripción**: Cuotas: documentCount, workspacesAccessible, storageBytesUsed.
- **Parámetros**: (none).

### `get_workspace_quota_detail`
- **Capability**: `documentsRead`
- **Descripción**: Detalle del workspace activo (name, type, plan).
- **Parámetros**: (none).

### `start_subscription_checkout`
- **Capability**: `documentsWrite` (admin)
- **Descripción**: Sugiere abrir panel pricing. Checkout real en MP Bricks.
- **Parámetros**: `plan` (req).

---

## 16. Diccionario del linter

### `list_dictionary_words`
- **Capability**: `documentsRead`
- **Descripción**: Palabras del diccionario personal del linter.
- **Parámetros**: (none).

### `add_word_to_dictionary`
- **Capability**: `documentsWrite`
- **Descripción**: Añade palabra al diccionario personal.
- **Parámetros**: `word` (req).

### `remove_word_from_dictionary`
- **Capability**: `documentsWrite`
- **Descripción**: Quita palabra.
- **Parámetros**: `word` (req).

---

## 17. Agente: plan / memoria / hooks

### `agent_plan_set`
- **Capability**: `uiControl`
- **Descripción**: Crea plan visible al user (≤30 pasos). OBLIGATORIO en tareas multi-paso (≥3 tools o cambios destructivos).
- **Parámetros**: `steps` (req string[], ≤280 chars c/u).

### `agent_plan_update_step`
- **Capability**: `uiControl`
- **Descripción**: Actualiza estado de paso: `pending|in_progress|completed|skipped|failed`.
- **Parámetros**: `stepIndex` (req), `status` (req), `notes`.

### `agent_plan_get`
- **Capability**: `uiControl`
- **Descripción**: Devuelve plan activo y estado.
- **Parámetros**: (none).

### `agent_plan_clear`
- **Capability**: `uiControl`
- **Descripción**: Descarta plan activo.
- **Parámetros**: (none).

### `agent_remember`
- **Capability**: `uiControl`
- **Descripción**: Guarda hecho persistente (`scope=user` o `workspace`). Valor = JSON serializable.
- **Parámetros**: `key` (req, 1..80 chars), `value` (req, any), `scope` (user|workspace, default workspace).
- **Ejemplo**: `{ "name": "agent_remember", "args": { "key": "user.field_of_study", "value": "filosofía", "scope": "user" } }`

### `agent_recall_memory`
- **Capability**: `uiControl`
- **Descripción**: Recupera memoria por key.
- **Parámetros**: `key`, `scope`.

### `agent_list_memories`
- **Capability**: `uiControl`
- **Descripción**: Lista keys de ambos scopes.
- **Parámetros**: (none).

### `agent_forget`
- **Capability**: `uiControl`
- **Descripción**: Elimina memoria.
- **Parámetros**: `key` (req), `scope`.

### `spawn_subagent`
- **Capability**: `uiControl`
- **Descripción**: Stub: lanzará subagente con contexto limitado. Hoy devuelve contrato.
- **Parámetros**: `task` (req), `scope` (read-only|workspace|full), `maxIterations`.

### `agent_set_hooks`
- **Capability**: `uiControl`
- **Descripción**: Configura hooks PreToolUse/PostToolUse/UserPromptSubmit en Firestore. Requiere `confirmed:true`.
- **Parámetros**: `preToolUse` (string[]), `postToolUse` (string[]), `userPromptSubmit` (string[]), `confirmed`.

### `agent_list_hooks`
- **Capability**: `uiControl`
- **Descripción**: Lista hooks configurados.
- **Parámetros**: (none).

### `agent_save_turn_snapshot`
- **Capability**: `uiControl`
- **Descripción**: Guarda snapshot del turn (messages + toolCalls) en Firestore.
- **Parámetros**: `turnId`, `summary`, `messages` (array), `toolCalls` (array).

### `agent_list_turn_snapshots`
- **Capability**: `uiControl`
- **Descripción**: Lista snapshots.
- **Parámetros**: `limit`.

### `agent_clear_turn_snapshot`
- **Capability**: `uiControl`
- **Descripción**: Elimina snapshot.
- **Parámetros**: `turnId` (req).

### `agent_dry_run_info`
- **Capability**: `uiControl`
- **Descripción**: Indica si el contexto está en dry-run (tools destructivas no aplican).
- **Parámetros**: (none).

---

## 18. Externos

### `fetch_url`
- **Capability**: `documentsRead`
- **Descripción**: Descarga contenido textual de URL pública (http/https). Bloquea localhost/IPs privadas. Devuelve `{status, contentType, bodyText, bytesRead, truncated}`.
- **Parámetros**: `url` (req), `maxBytes` (1024..200000, default 50000), `timeoutMs` (1000..30000, default 8000).

### `read_agora_doc`
- **Capability**: `documentsRead`
- **Descripción**: Lee documentación oficial de Agora en `agora.elenxos.com/docs`. Sin slug devuelve slugs disponibles.
- **Parámetros**: `slug` (opcional), `maxBytes` (default 80000).

---

## Convenciones de invocación

### Formato OpenAI

```json
{
  "type": "function",
  "function": {
    "name": "list_documents",
    "arguments": "{\"folder\":\"Clase 1\",\"limit\":50}"
  }
}
```

### Formato Anthropic

```json
{
  "type": "tool_use",
  "id": "tool_call_abc",
  "name": "list_documents",
  "input": { "folder": "Clase 1", "limit": 50 }
}
```

### Formato Gemini

Las funciones se serializan SIN `additionalProperties` (no soportado).
Ver `stripAdditionalProperties` en `toolDefinitions.ts`.

### Subset para Ollama

Para modelos chicos (qwen3:14b u Ollama core), solo se exponen ~25 tools
esenciales definidas en `OLLAMA_CORE_TOOL_NAMES` (ver `toolDefinitions.ts`).

---

## Confirmaciones destructivas

Las siguientes tools requieren `confirmed:true` (o equivalente) en el
segundo turno tras pedir consentimiento al user:

- `delete_document`, `delete_folder`, `delete_concept`, `delete_relation`
- `delete_board_column`, `delete_board_card`, `kill_terminal_session`
- `run_worker_command` (con `expectChanges:true`)
- `write_worker_file`, `kill_worker_process`, `restart_worker`
- `git_commit_workspace`, `git_push_branch`, `git_revert_commit`
- `invite_member`, `remove_member`, `transfer_workspace_ownership`
- `merge_concepts`, `apply_snippet_to_document`
- `upload_external_url`, `import_snippets_from_url`
- `agent_set_hooks`
- `find_duplicates` (con `confirm:true` en la primera llamada)

El perfil `developer` omite estas confirmaciones (auto-confirm). Ver
`AGENT_AUTO_CONFIRM_PROFILES` en `accessPolicy.ts`.

---

## Estrategia de búsqueda jerárquica (system prompt)

Documentada también en `AgoraBack/src/lib/agora-ai/systemPrompt.ts`. Es la
heurística que el agente sigue cuando recibe una pregunta y necesita
contexto del workspace. Los 7 pasos van de cheap → expensive: parar al
encontrar respuesta evita lecturas masivas.

1. **Overview rápido** — `get_workspace_info` o `inspect_workspace`
   (`includeWorker:false`) para mapear carpetas y categorías sin leer
   contenido.
2. **Doc conocido** — si el user nombra/cita un doc específico, ir directo
   con `read_document` o `search_documents` con query exacta.
3. **Relaciones** — para preguntas conceptuales ("qué dice X sobre Y"),
   usar `query_citation_graph` o `find_related_via_graph` antes de
   enumerar docs.
4. **Keywords** — `search_documents` o `search_workspace` con queries
   lexicales acotadas (limit ≤ 25). Iterar si los hits no son relevantes.
5. **Multi-step** — combinar resultados de pasos previos con
   `expand_context` o `read_workspace_bundle` (filtrado por
   `documentIds`/`folder`). Evita el bundle completo del workspace.
6. **Subagent** — si la tarea es exploratoria larga y se beneficia de
   un fork con scope limitado, usar `spawn_subagent` (stub hoy, contrato
   definido). Útil para "analiza este folder y dame un resumen".
7. **Memoria** — `agent_recall_memory` antes de re-escanear: si el user
   ya estableció contexto persistente (campo de estudio, doc principal,
   convenciones), úsalo en vez de redescubrirlo.

> **Regla práctica**: si dos pasos consecutivos no aportan info nueva
> (no nuevos hits, no nuevos nodos), parar y responder con lo que se
> tiene. Mejor un "no encontré X, querés que busque en Y" que un loop
> de exploración.

---

## Referencias

- Definiciones: `AgoraBack/src/lib/agora-ai/toolDefinitions.ts`
- Política de acceso: `AgoraBack/src/lib/agora-ai/accessPolicy.ts`
- Executors: `AgoraBack/src/lib/agora-ai/toolExecutors/*.ts`
- Registro: `AgoraBack/src/lib/agora-ai/toolRegistry.ts`
- System prompt: `AgoraBack/src/lib/agora-ai/systemPrompt.ts`
- Documentación más amplia: `AgoraFront/README.md` (sección "Agora AI Chat") + `CLAUDE.md` raíz.

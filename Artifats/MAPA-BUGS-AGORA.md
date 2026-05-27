# Mapa de bugs Agora — campaña QA masiva 2026-05-27

> Resultado de la campaña de testing masivo (E2E browser con 16 instancias Chrome
> GPU + edge-cases por API). Severidad + ubicación + real vs by-design/falso-positivo.
> Cuenta QA: `agoraqa1779835793@mailinator.com`. Verificados = comprobados por el main.
> AgoraBack rev final de campaña: `agora-backend-00210-fnc`. AgoraFront: Vercel live.

---

## ✅ Resueltos + deployados + verificados en prod (campaña 2026-05-27)

### Cluster seguridad auth
- **A1. Rate-limit `/api/auth/login`**: 10 fallidos/15min por IP+email → `429`. Deployado.
- **A2. Timeout + MAX_LEN en `/api/public/st/evaluate`**: `Promise.race` temporal + límite de longitud de fórmula. Deployado.
- **A3. SSRF en `import_snippets_from_url`**: blocklist RFC-1918/link-local portado desde `documents.ts`. Deployado.
- **A4. Path traversal multipart `sign-part`**: `path.posix.normalize` + rechazo de `..` antes del `startsWith`. Deployado.
- **B1 (parcial) — Anti-enum `prepare-reset`**: responde siempre `200` independiente de si el email existe. Sin rate-limit de reset-email bombing. Deployado.
- **B2. `register` email malformado → `400`** (era `500` con mensaje interno de Firebase). Deployado.
- **B3. `git/log` enmascara email del autor** (PII — `stevenvallejo780@gmail.com` → redactado). Deployado.
- **B4. `git/issue-token` revoca tokens previos** (anti-sprawl, un token activo por usuario). Deployado.
- **SSRF git-info personal workspace**: corregido junto al cluster auth.

### Invitación de miembros (C1)
- `invite` valida formato de email con regex antes del write → inválido `→ 400`.
- Self-invite del owner rechazado `→ 400`.
- Verificado E2E: diálogo UI "Email inválido" visible + respuestas API `400/400/200` correctas.
- Back rev `00202-sq8`, front Vercel READY al momento de la corrección; rev final `00210-fnc`.

### Git workbench (3 bugs corregidos)
- **Commit multi-archivo no atómico**: front pasó de loop por-archivo a 1 batch `POST /contents`. Ahora los archivos se commitean atómicamente en un solo commit.
- **Historial no se refrescaba tras commit**: auto-refetch implementado.
- **"Diff vs parent" → `404`**: usaba ruta `.diff` contra `/api/v1`; corregido a ruta web Forgejo. Ahora `→ 200`.
- Verificado E2E browser + network tab.

### UX / validación
- **Overflow horizontal móvil** (360/390/414px): `overflow-x-hidden` en wrapper landing. Verificado en 360/390/414/768/1280.
- **Agente IA — mensaje vacío `→ 400`**: no crea chat fantasma. Verificado E2E.
- **Agente IA — cap 200 chats/usuario**: storage abuse limitado. Deployado.
- **i18n mensajes de error login/register**: traducidos al español. Verificado en vivo.

### Privacidad / hygiene
- **SSE `/documents/:id/stream`**: allowlist de campos; ya no expone `ownerId`/`searchableContent`/`contentHash`. Deployado.
- **`404 /api/*` → JSON**: catch-all Express 4 devuelve JSON en vez de HTML. Verificado.
- **st-libraries enumeración**: `subscribe` → `404` unificado (priv-existente y no-existente idénticos). Deployado.
- **st-libraries charset de fórmula**: caracteres inválidos `→ 400`. Deployado.
- **Header `Deprecation/Sunset`**: formato RFC 9745 (HTTP-date). Deployado.

### Sistema git — integridad e integración externa
- Commit web → Forgejo → clone HTTPS con contenido real: verificado funcionando.
- Import repositorio GitHub externo público (sin token): verificado funcionando.

### Ronda QA final
- 10 agentes E2E browser real: todas las áreas en verde al cierre de campaña.

---

## 🔴 Backlog abierto — bugs confirmados, sin corregir por decisión (riesgo > valor)

| # | Sev | Bug | Nota |
|---|-----|-----|------|
| B5 | Media | **Rate limiter ST in-memory** (`Map` en proceso) no compartido entre instancias Cloud Run → límite efectivo ×N. Aplica también a cualquier rate-limit nuevo de auth. Fix: store compartido (Firestore/Redis). | Decisión pendiente del user. |
| B6 | Media | **500 con error crudo** en varios endpoints: `multipart/complete` doble (msg MinIO), `PATCH /api/boards` card inexistente (stacktrace Firestore), `POST /api/boards` card sin `description`, `POST /api/semantic` body no-JSON. Patrón: faltan try/catch que traduzcan a 4xx. | Revisión sistemática pendiente. |
| B7 | Media | **Share de docs medio-implementado**: `POST /share` genera token nuevo cada vez, sin endpoint de revocación ni consumidor. Tokens acumulados en Firestore. | Requiere diseño completo de feature. |
| B8 | Media | **ST Playground — botones rotos**: Reset dispara navegación en vez de `setCode(default)`. Menú "Ejemplos" no carga código en v2 (stale ref Monaco). | UI flagship; programar sprint. |

### Menor / cosmético (backlog abierto por decisión)

- **Editor `$$…$$`**: renderiza KaTeX inline en vez de `.katex-display` (math correcto, no centrado).
- **Editor preview sin syntax highlight** en bloques de código (en el editor Monaco sí).
- **Subir `.txt` crea `.md` companion**: probable "importar como documento", a confirmar diseño.
- **RTDB `permission_denied` en `/collab/<wsId>` recién creado**: probable lag de propagación de custom claim (transitorio).
- **`GET /api/documents/:id`**: mismo leak de `ownerId` que el SSE. Puede ser intencional (exponer a miembros); a definir.
- **`remove_member` → `200` para userId inexistente** (debería `404`).
- **C2 st-libraries**: no valida sintaxis ST de la `formula` (garbage `🔥@@@` → `201`).
- **C4 Semantic**: `relationType "related-to"` mutado silenciosamente a `"supports"` (`workspace-state.ts:365`).
- **C7 a11y**: `/st-playground-v3` — 6 `role=tab` sin `id`/`aria-controls`; textarea co-pilot sin `<label>`.
- **C8 Docs**: cursos fuera de orden numérico en "Escuela de Lógicas" (`AgoraFront/src/app/docs/st/page.tsx:978`).
- **C9 `ST_VERSION` hardcoded `"3.2.3"`** en respuesta de evaluate público (motor real: 4.15.1).
- **C10 proof-debugger**: botón "Último paso" crashea el tab en Contramodelo (a verificar si es app o renderer headless); `lattice-viewer` `400` en primer fetch al montar.
- **C11 Boards/snippets CRUD**: `DELETE` card/columna inexistente → `200`; card con `columnId` inexistente → huérfana; `POST /api/boards` devuelve `200` no `201`.

---

## ✅ Sólido (verificado, sin bugs)

- Endpoints protegidos por secreto: cron, worker-HMAC, webhook MP, internal-tool → todos rechazan `401/403` sin secreto.
- Vault de API keys: nunca expone la key cruda (solo `displayHint`), IDOR-safe.
- IDOR en documents/workspaces/semantic/chats: protegido (`403/404`).
- Headers de seguridad: CSP, HSTS preload, X-Frame DENY, nosniff, sin stack traces.
- Superficie pública/UI: landing, login, ST playgrounds (motor lógico), lattice, proof-cards, docs, gating de rutas.
- Sistema git: integridad commit → Forgejo → clone HTTPS + import GitHub externo público.

---

## By-design / falsos positivos (no perseguir)

- **C3 stored-XSS en `searchableContent`**: investigado → `searchableContent` nunca se renderiza como HTML en el cliente. No explotable. Falso positivo confirmado, no se tocó.
- Semantic "relaciones huérfanas/ciclos/IDs dup": el endpoint guarda un state-blob del cliente, no impone integridad relacional.
- Documents "title ignorado": el campo de nombre es `name`, no `title` (asunción errada del agente).
- `GET /api/payments/webhook` → `200`: es el endpoint de verificación de MercadoPago.
- CORS preflight de origin malicioso → `200`: no explotable (sin `Access-Control-Allow-Origin` en la respuesta).

---

## Config pendiente (no bug)

- **`MERCADOPAGO_WEBHOOK_SECRET` ausente en Cloud Run** → webhook fail-closed → ningún pago real de MP se procesa. (Documentado en CLAUDE.md §10.)

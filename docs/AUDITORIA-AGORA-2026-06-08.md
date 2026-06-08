# Auditoría general de Agora — 2026-06-08

> Auditoría de production-readiness: bugs, completitud, documentación, readiness
> comercial y E2E real de navegador. Metodología abajo. **Honestidad ante todo**:
> marco qué verifiqué yo personalmente contra el código/prod (alta confianza) y
> qué viene del fan-out de agentes con verificación adversarial (confianza media).

## Veredicto ejecutivo

**Agora es un producto sólido y usable** — el núcleo (auth, CRUD de docs, editor MDX
con KaTeX/Mermaid, ST playground/notebook, terminal, sync, agente IA) funciona E2E,
verificado en navegador real. **No hay P0 abiertos** (ni data-loss masivo, ni crash
generalizado, ni hueco de seguridad cross-tenant trivial).

**Pero todavía NO está "comercialmente suficiente" para cobrar con tranquilidad**, por
cuatro frentes concretos:
1. **Pagos frágiles en prod**: el webhook de MercadoPago rechaza todos los eventos
   (falta `MERCADOPAGO_WEBHOOK_SECRET` en Cloud Run) → la activación de plan depende
   100% del fallback `/api/payments/verify`. Single point of failure sobre el ingreso.
2. **Sin páginas legales** (TOS / Privacidad / Cookies) pese a cobrar y recolectar datos.
3. **Bugs reales que pega el usuario**: grafo de citaciones caído en workspace personal,
   corrupción silenciosa de archivos plain-text, feedback de pago/guardado ausente.
4. **Documentación operativa muy desactualizada**: ~18 docs/scripts apuntan a hosts
   muertos (humanizar2, NAS, agora-hub GCP, stev-server) tras las migraciones.

Conteo confirmado (estático): **0 P0 · 25 P1 · 49 P2 · 15 P3** (89 findings tras
verificación adversarial; 5 descartados como falsos positivos). E2E navegador: **10/10
flujos sin fallo duro**, 3 pass / 7 partial, núcleo funcional.

---

## Top must-fix antes de cobrar (priorizado)

| # | Severidad | Qué | Dónde | Estado verificación |
|---|-----------|-----|-------|---------------------|
| 1 | **P1 comercial** | `MERCADOPAGO_WEBHOOK_SECRET` ausente en prod → webhook fail-closed rechaza TODO evento de pago; activación depende solo de `/verify` | Cloud Run env (falta) + `payments/webhook/route.ts:53` | ✅ verificado en prod (gcloud) + código |
| 2 | **P1 comercial/legal** | No hay TOS / Privacidad / Cookies | `AgoraFront/src/app/` (no existen) | ✅ confirmado |
| 3 | **P1 bug** | Grafo de citaciones **403 en workspace personal** (alias `personal` sin normalizar a `personal:<uid>`) — feature caída por defecto | `CitationGraphView.tsx:143` + `citation-graph/route.ts:41` + `MosaicLayout`/`PERSONAL_WORKSPACE_ID='personal'` | ✅ reproducido E2E + código |
| 4 | **P1 bug (data)** | Archivos plain-text (.py/.yaml/.json/dotfiles) corrompidos por `unescapeLatex` al guardar | `MosaicEditor.tsx:1941` (handler compartido sin chequear `isPlainText`) | ✅ verificado en código |
| 5 | **P1 bug (resiliencia)** | El worker mata TODOS los PTYs en `disconnect` mientras el hub asume que sobreviven → grace+re-attach inútil ante corte de red real | `AgoraWorker/worker/index.js:393-401` vs `AgoraHub/src/sessions.ts:72` | ✅ verificado en código (ver nota) |
| 6 | **P1 sync** | `worker-delete` no encuentra archivos de raíz (mismatch de folder con `worker-commit`) | `sync/worker-delete/route.ts:37` | 🟡 verificación adversarial |
| 7 | **P1 sync** | `worker-list` arma el cursor desde el array filtrado, no del último doc Firestore → puede saltarse archivos en paginación | `sync/worker-list/route.ts` | 🟡 verificación adversarial |
| 8 | **P2 bug** | Crash de clipboard en "Compartir enlace": alert de error falso + URL nunca mostrada (en contexto no-HTTPS) | `FileExplorer.tsx:528` | ✅ verificado en código |
| 9 | **P2 comercial** | Botón "Suscribirse" queda colgado en "Procesando…" si el checkout falla (sin reset ni error claro) | flujo `create-preference` | ✅ reproducido E2E |
| 10 | **P2 comercial** | Plan Básico y Pro anuncian el mismo storage (1 GB); inconsistencias landing vs config canónica | `PricingModal` / `page.tsx:221` vs `subscription.ts:78` | ✅ reproducido E2E |

---

## Metodología y alcance

- **2 workflows fan-out** (tiering por [preferencia del user]: ~85-90% Sonnet, Opus solo
  para verify de P0/P1 de correctness/seguridad y síntesis):
  - **Auditoría estática**: 12 finders Sonnet escopados por subsistema → verificación
    adversarial (Opus en P0/P1 de bug/seguridad/race) → 89 findings confirmados.
  - **E2E navegador**: 10 flujos contra el lab, 1 instancia Chrome MCP por flujo → triage
    Opus de fallos (separa bug real vs artefacto del lab).
- **Infra usada y verificada hoy**: VM `docker-lab` (`deploy@172.25.0.250`, 8/8 containers
  healthy, seed de prod re-aplicado), 20 browsers Chrome MCP (login E2E real), prod sano
  (front/back/hub/s3/git todos 200). **Documentado en `dev-env/QA-INFRA.md`** (era el gap
  pedido: VM + browsers + SSH no estaban en el repo).
- **Verificación personal (alta confianza)**: hice un pase adversarial propio sobre los
  hallazgos más severos. Esto **descartó/corrigió 3 P1 que eran falsos o mal enmarcados**
  (ver sección "Falsos positivos") — exactamente el tipo de rigor para no cantar victoria
  ni inflar el reporte.
- **Honestidad sobre cobertura**: el grueso de los 89 findings viene del fan-out con
  verificación adversarial (confianza media-alta); ~10 los verifiqué yo línea-a-línea
  (alta). ST/Autologic (190k LOC, 6565+ tests) se auditó en su superficie de integración,
  no re-auditando la librería. Lo no cubierto a fondo: colaboración Yjs multi-usuario,
  carga/perf bajo concurrencia, multipart >50MB real.

---

## 1. Bugs de correctness (P1)

**Confirmados por mí (alta confianza):**

- **Grafo de citaciones 403 en workspace personal.** El front pasa el `workspaceId` crudo
  `'personal'` a `CitationGraphView` (`PERSONAL_WORKSPACE_ID = 'personal'`), sin normalizar
  a la clave compuesta `personal:<uid>`. El backend (`citation-graph/route.ts:41-49`)
  devuelve 403 si es workspace personal y no empieza con `personal:`. Otros endpoints
  (`/api/semantic`) sí normalizan, lo que enmascaró el bug. **Feature caída por defecto.**
  Fix: normalizar en el front (`personal:${uid}`) o que el backend resuelva el alias con
  `auth.uid`.
- **Corrupción de archivos plain-text por `unescapeLatex`.** `CodeMirrorPlain` (usado para
  `.py`, `.yaml`, `.json`, `.editorconfig`, dotfiles — formatos que el producto promociona)
  comparte el handler `handleMdxChange`, que llama `unescapeLatex(rawMd)` incondicionalmente
  (`MosaicEditor.tsx:1941`) sin chequear `isPlainText`. Des-escapa secuencias tipo `\=`,`\$`
  en archivos no-markdown al guardar → corrupción silenciosa del contenido del usuario.
  Fix: saltar `unescapeLatex` cuando `isPlainText`.
- **Grace/re-attach del agente inútil ante corte de red real.** El worker mata TODOS los
  PTYs en `socket.on('disconnect')` (`worker/index.js:393-401`), pero el hub asume lo
  contrario (`sessions.ts:72`: *"Los PTYs siguen vivos en el worker"*). El E2E previo que
  "validó" la resiliencia usó `docker pause` — que **no** dispara el handler de disconnect
  del worker — y por eso pasó; un parpadeo de red real sí lo dispara y mata las sesiones.
  Fix: grace del lado del worker (no matar PTYs inmediatamente en disconnect; esperar
  re-conexión/timeout). **Nota:** el fix de hub (`dc65dc7`) está bien pero es insuficiente solo.

**Verificación adversarial del fan-out (confianza media, revisar antes de tocar):**

- **`worker-delete` no encuentra archivos de raíz** por mismatch de cómputo de folder con
  `worker-commit` (`sync/worker-delete/route.ts:37`).
- **`worker-list` cursor desde array filtrado** en vez del último doc Firestore → riesgo de
  saltarse archivos en paginación.
- **`CodeMirrorPlain`/plain-text** además: `handleMdxChange` es el mismo para ambos editores.
- Token budget no se actualiza si el run del agente termina por soft-timeout/error (P2).
- `agora-ai/stream` incrementa el contador de mensajes ANTES de reclamar el rate-limit →
  conteo inflado en rate-limit hit (P2).
- `workerTokenCache` en `agora-host-sync` sin TTL → stale tras reemplazo de container (P2).

---

## 2. Seguridad

Sin hueco cross-tenant trivial, pero varios hardening reales:

- **Default de access-policy del agente = 'developer' (god-mode).** El stream usa
  `DEFAULT_AGENT_ACCESS_POLICY = 'developer'` (auto-confirma acciones destructivas, todas las
  tools) como fallback, en vez del `DEFAULT_CLIENT_AGENT_ACCESS_POLICY = 'workspace'` que
  existe pero **no se cablea**. Un cliente autenticado sin policy explícita obtiene god-mode
  sobre su propio workspace; y puede auto-asignarse `profile:'developer'` (`normalizeAgentAccessPolicy`
  lo acepta). **No es acceso no-autenticado** (hay `requireAuth` → 401), pero sí debilita la
  defensa-en-profundidad contra prompt-injection. Fix: default a 'workspace', exigir gesto
  explícito para 'developer'. **(P1 reclasificado de la finding original errónea de "no autenticado".)**
- **Inyección por newline en whitelist de comandos del worker.** `validateAgentCommand`
  (`agent-command-policy.mjs:28-57`) no rechaza newlines y solo valida el primer binario por
  segmento de pipe, no por segmento de newline → bypass de whitelist con `cmd_permitido\ncmd_prohibido`.
- **`/api/diag` sin auth expone topología** de infra (parcial — revisar qué expone).
- **Firestore rule deja al sync-agent listar TODOS los documentos** sin filtrar workspace
  (`firestore.rules:86`).
- **`sync/signed-url op=put` y `sync/commit` no aplican restricción de rol viewer** → un
  miembro viewer puede subir/bumpear versiones.
- **Gemini: apiKey en query string** (queda en access logs) + URL injection por `model` sin validar.
- **`drain-outbox` compara `CRON_SECRET` sin timing-safe**; IP spoofeable en rate-limit de
  register/login por extracción inconsistente de IP.
- **Deps con CVE**: `ws 8.18.3` (GHSA-58qx-3vcg-4xpx) en AgoraHub **prod**; `vitest 2.1.9`
  (CVSS 9.8, devtool Autologic); `qs <=6.15.1` DoS en Back/Hub; `picomatch 4.0.3` ReDoS en ST.

---

## 3. E2E navegador (lab, datos seed de prod)

**10/10 flujos sin fallo duro.** Núcleo funcional verificado en navegador real:
- ✅ Login + dashboard (71 archivos, storage 224MB/10GB), CRUD completo (crear/editar/
  renombrar/borrar con autosave + persistencia), KaTeX inline+bloque, Mermaid SVG, ST
  playground v3 (check/derive/countermodel correctos), ST notebook (cells + persistencia),
  **terminal + backspace** (fix `f98cc19` confirmado: `echoX`+BS+`echo OK` → ejecuta `OK`),
  share público read-only (backend 200, página sin sesión solo-lectura), búsqueda global,
  control de versiones, esquema, snippets.

**Bugs reales de producto hallados (no artefactos del lab):**
- Grafo citaciones 403 (ver §1), clipboard crash al compartir (§Top #8), botón checkout
  colgado (§Top #9), planes mismo storage (§Top #10), treeitem no abre por teclado/a11y,
  notebook "Guardar" sin feedback + sin hint de sintaxis ST, login sin labels/id (a11y),
  share solo por right-click, Ctrl+K no abre búsqueda.

**Artefactos del lab (NO son bugs de prod) — confirmados por triage Opus:**
- Pérdida de sesión por emulador Firebase + key demo (`accounts:lookup` 400). DeepSeek 412
  "no hay key" por `WORKER_SECRET` distinto en lab (la key se cifró contra otro secret).
  MercadoPago 500 por credenciales MP ausentes en lab. 404 `/api/documents/{id}/stream`
  por falta del rewrite `/api/*`→backend que prod sí tiene vía `vercel.json`.
  `qa-mermaid-test.md` vacío (fixture sobrescrito offline el 2026-06-02). 401 transitorios
  por refresh de token (auto-recuperan).

---

## 4. Comercial / product-readiness

- **Pagos (crítico)**: `MERCADOPAGO_ACCESS_TOKEN` ✅ presente en prod; `MERCADOPAGO_WEBHOOK_SECRET`
  ❌ ausente → webhook **fail-closed** rechaza todo evento (`webhook/route.ts:53` + warning
  explícito en `env.ts:115`). Hay fallback `/api/payments/verify` (usa el access token), pero
  depende de que el cliente lo llame al volver del checkout y de que `mpPaymentId` se persista
  sin el webhook. **Validar el flujo pago→activación E2E con un pago real antes de promocionar.**
- **Redirect `?payment=failure` ignorado** → el usuario no recibe feedback si el pago falla
  (`useSubscription.ts:45`). **Sin UI de cancelación** pese a que el footer dice "puedes
  cancelar en cualquier momento".
- **Legal**: faltan TOS, Privacidad, Cookies (cobrando + recolectando datos en prod).
- **Landing**: CTAs de precios llevan a login, no a checkout del plan; claim "Acceso root
  completo" para terminales cloud (revisar exactitud); inconsistencias de features Pro
  landing vs `subscription.ts`.
- **`planId` sin validar** (`isPlanId`) al persistir desde `external_reference` del webhook/callback.
- **SEO/LCP**: landing y login renderizan 100% client-side (`ssr:false`) → malo para SEO y
  primera carga.

---

## 5. Completitud / flujos a medio cablear

- **Crons en `vercel.json` son vestigiales** (no disparan en Cloud Run). **PERO los 4 sí
  corren** vía **Cloud Scheduler** (verificado en GCP: drain-outbox */5, check-subscriptions,
  citations-backfill, compact-sync-events, + backup Firestore diario). → No es un bug; es
  limpieza de docs (quitar los crons engañosos de `vercel.json`).
- `compact-sync-events` procesa solo los primeros 100 workspaces sin paginación (sí es real).
- Tools del agente stub/rotas: `download_workspace_bundle` apunta a endpoint inexistente;
  `kill_terminal_session`/`start_worker` `notImplementedFully` con refs de host viejas;
  `semantic_search_workspace` registrado como stub.
- Drag-drop de imágenes en el editor escribe `/placeholder.png` silenciosamente
  (`MosaicEditor.tsx:1857`).
- `useAgentChatHistory` sin refresh cross-device/cross-tab en tiempo real.
- Ruta legacy `/api/agora-ai` (no-stream) sin rate-limit ni persistencia de chat.
- `documents DELETE` no emite `op='deleted'` → el daemon depende solo del full-reconcile.

---

## 6. Documentación (gran tema)

**~18 findings de docs, casi todos el mismo patrón: el repo no se actualizó tras las
migraciones de infra.** Referencias a hosts MUERTOS:
- `humanizar2` (host de workers, muerto 2026-05-24) en `AgoraFront/CLAUDE.md`, `AgoraWorker/README`,
  `worker-host-sync/README`.
- `NAS` (apagado) en `RUNBOOK_BACKUPS.md` (comandos MinIO vía `nass-stev`, backup crontab).
- `agora-hub` VM GCP (apagada) + dominio `hub.humanizar-dev.cloud` (34.72.204.171) en
  `README.md` raíz, `AgoraHub/README`, `AgoraFront/README`, `install-worker.sh`, `deploy_hub.sh`.
- `stev-server` (100.98.8.227) en `AgoraWorker/desplieges-prod/README` y 3 scripts de deploy.
- `RUNBOOK_OPS.md`: procedimientos de hub/workers y firewall apuntan a la VM GCP apagada.
- `AGENT.md` es copia obsoleta de CLAUDE.md (arquitectura de 2+ migraciones atrás).
- Versiones stale: README raíz dice ST v3.2.2 / Autologic v2.2.2 (real: st-lang 4.15.x /
  autologic 2.2.5); AgoraBack README dice st-lang@4.5.0.
- Docs de usuario incorrectas: `docs/page.tsx:441` dice que las keys IA van a localStorage
  (son vault server-side AES-256); URL de Vercel obsoleta hardcodeada en comando de install.
- `AgoraFront/.github/workflows/test.yml` corre tests Python inexistentes → **el suite TS
  nunca se ejecuta en CI** (P1 DX real).
- **Gap cerrado hoy**: el setup de QA (VM docker-lab + 20 browsers + SSH) ahora está en
  `dev-env/QA-INFRA.md`.

→ Recomendación: un barrido único "post-migración" de docs (buscar `humanizar2`, `agora-hub`,
`hub.humanizar-dev.cloud`, `nass-stev`, `stev-server`, `34.72.204.171`) + arreglar el CI de Front.

---

## 7. Riesgos operacionales (verificados por mí, fuera del fan-out)

- **Código de prod desplegado pero NO en `origin`**: commits sin pushear en 5 repos —
  AgoraBack +4 (incl. `7c72964` = rev viva `00230-58m` en Cloud Run), AgoraWorker +4,
  AgoraFront +2, AgoraHub +1, AgoraCli +1. **La fuente del prod actual vive solo en esta
  máquina.** Si se pierde, no hay rollback/reproducción desde el remoto. → Pushear (con tu OK).
- **`AgoraHub/.env` con secretos NO gitignored** (sin trackear, pero un `git add .` lo subiría;
  contiene `WORKER_SECRET`/`HUB_INTERNAL_SECRET`/`BACKEND_INTERNAL_SECRET` — valores de lab,
  pero viola la regla #9). → Agregar `.env` a `AgoraHub/.gitignore`.
- `AgoraHub/dist/` trackeado y sucio (artefactos build regenerables en git).

---

## 8. Dependencias

Accionables critical/high: `ws 8.18.3` (AgoraHub prod), `qs <=6.15.1` (Back/Hub),
`picomatch 4.0.3` ReDoS (ST), `vitest 2.1.9` CVSS 9.8 (devtool Autologic). `firebase-admin`
moderate sin fix en el major actual → ignorar.

---

## Falsos positivos descartados en mi verificación (transparencia)

1. **"Los 4 crons nunca corren"** → FALSO: Cloud Scheduler los dispara (verificado en GCP).
2. **"MercadoPago webhook fail-open silencioso"** → INVERTIDO: es fail-**closed** (rechaza
   sin secret). El problema real es el secret ausente en prod, no un fail-open.
3. **"Cliente no autenticado obtiene god-mode"** → FALSO: `requireAuth` gatea con 401. Lo
   real es el default 'developer' para clientes autenticados (reclasificado, sigue siendo válido).

(De los 94 findings crudos, el fan-out ya había auto-descartado 5 como false_positive; estos
3 los corregí yo sobre los que habían pasado.)

---

## Apéndice

- Findings estáticos completos (89): `qa-artifacts/audit-2026-06-08-static-findings.json`.
- Resultados E2E + triage: salida del workflow E2E (10 flujos).
- Screenshots E2E: `qa-shots/audit-2026-06-08/`.
- Infra de pruebas: `dev-env/QA-INFRA.md`.

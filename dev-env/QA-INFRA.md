# QA-INFRA — Infraestructura de pruebas de Agora (VM docker-lab + browsers + E2E)

> Cómo está montado el entorno para QA/E2E **sin tocar producción**: una VM con
> Docker que corre el stack completo de Agora con datos seed de prod, y una flota
> de navegadores Chrome controlables por MCP para E2E real de navegador.
>
> Las credenciales sensibles de **prod** (passwords SSH, secrets) viven en
> `AgoraFront/.claude/secrets.md` (gitignored). Este doc cubre solo el lab y los
> browsers, que están en red privada.

---

## 1. VM `docker-lab` — stack Agora dockerizado

| Qué | Valor |
|-----|-------|
| Acceso SSH | `deploy@172.25.0.250` (red privada RFC1918) |
| Auth | key passwordless (`~/.ssh/id_*` del host de trabajo); **no hay alias `docker-lab` en `~/.ssh/config`** → usar la IP, o añadir el alias |
| Privilegios | `sudo` NOPASSWD |
| Docker | Docker CE 29.5.2 (sin el bug HTTP/2 de 28.2.2) |
| Compose project | `dev-env` en `/home/deploy/agora/dev-env` (dos files) |
| Datos | seed del backup real de prod 2026-05-29 (Firestore 16 colecciones, Auth 104 users, RTDB 32MB, MinIO ~4090 objetos) |

**Levantar el stack** (los containers existen como `Exited`; `up -d` los revive):

```bash
ssh deploy@172.25.0.250 'cd /home/deploy/agora/dev-env \
  && docker compose -f docker-compose.dev.yml up -d \
  && docker compose -f docker-compose.apps.yml up -d'
```

8 containers: `agora-dev-{front,back,hub,worker,firebase,forgejo,postgres,minio}`.
Sano = `firebase/postgres/minio` healthy + smokes 200 (sección 3).

**Gotcha obligatorio tras levantar — re-aplicar el passwordHash del user dev.**
El emulador re-importa el seed de prod en cada boot, lo que **borra** el
`passwordHash` de `devpass123`. Re-aplicarlo o el login web falla:

```bash
ssh deploy@172.25.0.250 'docker exec agora-dev-back node --input-type=module -e "
import crypto from \"node:crypto\";
const pw=\"devpass123\", salt=crypto.randomBytes(16);
const d=crypto.scryptSync(pw,salt,64,{N:16384,r:8,p:1});
const hash=[\"scrypt\",\"16384\",\"8\",\"1\",salt.toString(\"base64\"),d.toString(\"base64\")].join(\"\$\");
const uid=\"21VuZW4cdXd9jGKOgPa5YQegICw1\";
const host=process.env.FIRESTORE_EMULATOR_HOST||\"127.0.0.1:8080\";
const r=await fetch(\`http://\${host}/v1/projects/udea-filosofia/databases/(default)/documents/users/\${uid}?updateMask.fieldPaths=passwordHash\`,{method:\"PATCH\",headers:{Authorization:\"Bearer owner\",\"Content-Type\":\"application/json\"},body:JSON.stringify({fields:{passwordHash:{stringValue:hash}}})});
console.log(\"passwordHash PATCH:\", r.status);
"'
```

**Bajar:** `docker compose -f docker-compose.apps.yml down && docker compose -f docker-compose.dev.yml down`.

---

## 2. Puertos / URLs del lab (en `172.25.0.250`)

| Servicio | Puerto | Health |
|----------|--------|--------|
| front (Next) | 3000 | `/login` 200 |
| back (Express) | 8081 | `/health` 200 |
| hub (socket.io) | 3010 | `/health` 200 |
| worker | host net | se registra en el hub (workspace `shared` = `0vPS7sDhhkCeUUUmksUZ`) |
| Firestore emul | 8080 | `GET /` 200 |
| Auth emul | 9099 | — |
| RTDB emul | 9000 | — |
| Storage emul | 9199 | — |
| MinIO API / consola | 9100 / 9101 | `/minio/health/live` 200 |
| Forgejo / Postgres | 3030 / 5432 | — |

**Credenciales lab:** login web `stevenvallejo780@gmail.com` / `devpass123`
(custom-auth contra `users/{uid}.passwordHash`, no el Auth SDK). UID dev
`21VuZW4cdXd9jGKOgPa5YQegICw1`. MinIO `minioadmin`/`minioadmin`, bucket `agora-blobs`.

**Targeting de E2E:** el front del lab se buildea con `AgoraFront/.env.local`
apuntando a la **IP del lab** (`NEXT_PUBLIC_API_BASE_URL=http://172.25.0.250:8081`),
así que el navegador habla con la IP del lab, no con localhost. **Navegar directo a
`http://172.25.0.250:3000`** — el túnel SSH no sirve. CORS/CSP del lab ya incluyen la
IP (fix en el build del front + `ALLOWED_ORIGINS` del back).

---

## 3. Smokes del lab (verificar antes de E2E)

```bash
ssh deploy@172.25.0.250 'for u in \
  "back  http://127.0.0.1:8081/health" \
  "hub   http://127.0.0.1:3010/health" \
  "front http://127.0.0.1:3000/login" \
  "minio http://127.0.0.1:9100/minio/health/live" \
  "fs    http://127.0.0.1:8080/"; do \
  n=${u%% *}; url=${u##* }; printf "%-6s %s\n" "$n" "$(curl -s -o /dev/null -w %{http_code} --max-time 8 $url)"; done'
```

---

## 4. Flota de navegadores Chrome (MCP) para E2E real

- **20 instancias** `agora-chrome-1` … `agora-chrome-20` definidas en
  `.mcp.json` (raíz del workspace), cada una un `chrome-devtools-mcp` headless
  `--isolated` (cookies/storage aislados por instancia → no chocan).
- **Corren en el host de trabajo** (no en el lab); el host alcanza el lab por red
  privada (`172.25.0.250`, ~5ms).
- **Cap de concurrencia:** un Workflow corre máx `min(16, nproc-2)` agentes. Regla:
  **1 agente : 1 instancia chrome** evita choques. Hasta 16 flujos E2E en paralelo.

**Gotcha del binario chrome** (rompe todas las instancias si falta):
el `--executablePath` apunta a
`/home/dev/.cache/cft/chrome/linux-149.0.7827.22/chrome-linux64/chrome`, que **no
existe** por defecto. Recrear el symlink al chrome del sistema:

```bash
mkdir -p /home/dev/.cache/cft/chrome/linux-149.0.7827.22/chrome-linux64
ln -sf /opt/google/chrome/chrome \
  /home/dev/.cache/cft/chrome/linux-149.0.7827.22/chrome-linux64/chrome
mkdir -p /home/dev/.chrome-tmp/cache
```

**Login E2E vía MCP** (desde un agente/Claude): `navigate_page` a
`http://172.25.0.250:3000/login` → `take_snapshot` → `fill` email+password →
`click "Entrar"` → `wait_for ["Espacio","Archivos","HERRAMIENTAS"]`. Cerrar el
modal "Novedades v1.0" con `click "Entendido, no mostrar más"`.

**Notas de E2E en el lab:**
- "worker offline" en el workspace **personal** es esperado (solo corre el worker
  `shared`); para QA de terminal, cambiar al workspace compartido.
- El rate-limit de login es por **fallos** (10/15min/email): los logins exitosos no
  lo tocan, pero no reintentar login en bucle.
- 404 en `/api/documents/{id}/stream` y pérdidas de sesión al recargar son
  **artefactos del lab** (falta el rewrite `/api/*`→back que prod tiene vía
  `vercel.json`; emulador Auth con key demo). No confundir con bugs de prod.

---

## 5. Acceso SSH a producción (referencia)

Para QA/diagnóstico contra prod, no contra el lab:
- **ils-server** (workers): `ils-server@100.98.245.50` (NetBird). Password y gotcha
  `MaxStartups` (conexiones de a una, nunca ráfagas) en `secrets.md`.
- **agora-storage** (MinIO/Forgejo/Hub/Postgres): `root@76.13.118.239`.
- Pasos para autorizar la key y `sudo NOPASSWD`: `docs/ACCESOS-QA-ejecutar.md`.
- Prod read-only (Firestore/Auth) con token gcloud: ver el header
  `X-Goog-User-Project: udea-filosofia` (sin él, 403 quota project).

---

## 6. Workflows de auditoría reutilizables

Los dos workflows de la auditoría 2026-06-08 (fan-out Sonnet + verify Opus) quedaron
persistidos en la sesión y son re-lanzables con `scriptPath`:
- **Auditoría estática** — 12 finders por subsistema (bugs/seguridad/completitud/
  docs/comercial/deps) → verify adversarial → síntesis.
- **E2E navegador** — 10 flujos contra el lab, 1 instancia chrome por flujo → triage Opus.

Tiering: Sonnet para el grueso (E2E, CRUD, smokes, mapeo), Opus solo para verify de
P0/P1 de correctness/seguridad y síntesis.

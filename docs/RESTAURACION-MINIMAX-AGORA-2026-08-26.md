# Restauración de MiniMax en Agora — 2026-08-26

## Conclusión

MiniMax no había sido borrado del código: la implementación del 19 de agosto quedó en ramas de trabajo de Front y Back sin integrarse a `main`. El 25 de agosto se desplegó `main` para publicar el arreglo de edición en tiempo real; ese despliegue sustituyó el Front que contenía MiniMax y por eso el proveedor desapareció de la UI. El backend seguía exponiendo `MiniMax-M3`, pero también estaba expuesto a perderlo en el próximo despliegue porque sus commits tampoco estaban en `main`.

Se integraron ambas ramas, se desplegaron los dos servicios y se verificó que el Front servido incluye la configuración MiniMax y que el backend productivo publica el modelo.

## Cambios integrados

### Front — `stevenvo780/EducacionCooperativa`

- PR: <https://github.com/stevenvo780/EducacionCooperativa/pull/11>
- Merge SHA: `61774eb1af958d494bfcc9bcac7e96a85d1ea3a0`
- Recuperados sobre el `main` que ya contenía el fix del editor:
  - tipos y catálogo del proveedor `minimax`;
  - modelo `MiniMax-M3`;
  - entrada de API key y metadatos en Settings;
  - persistencia de selección e historial;
  - guía explícita para no mezclar modelos de otra familia.

### Back — `stevenvo780/agora-backend`

- PR: <https://github.com/stevenvo780/agora-backend/pull/1>
- Merge SHA: `09abf1b9495697c82cf337ce48e60bbcdebd752a`
- Integrados en `main`:
  - adaptador MiniMax con endpoint oficial y continuación de output;
  - registro de modelo, tipos, secretos y persistencia;
  - selección de modelos limitada a la familia del proveedor;
  - correcciones asociadas de `retryAfter` y conteo de tokens facturables.

## Verificación local

### Front

- `NODE_ENV=test npm run test:unit -- --run tests/unit/agora-ai-minimax.test.ts`: RC 0, 4 pasados, 0 saltados.
- `npm run typecheck`: RC 0.
- ESLint sobre los ocho archivos afectados: RC 0.
- `npm run build`: RC 0; 35 páginas generadas.
- Suite completa: 773 pasados, 0 saltados, 1 fallo preexistente ajeno a MiniMax. `tests/unit/basic-domain.test.ts` aún espera 10 GB para Enterprise, mientras la configuración vigente es 100 GB.

### Back

- Cuatro suites específicas de contratos, continuación, familia de modelo y usage tracking: RC 0, 54 pasados, 0 saltados.
- `npm run typecheck`: RC 0.
- ESLint sobre los archivos afectados: RC 0.
- `npm run build`: RC 0.
- Suite completa: 373 pasados, 0 saltados, 1 fallo preexistente ajeno a MiniMax. El contrato antiguo espera `Deprecation: true` y `Sunset: 2026-08-01`; la implementación actual devuelve fechas HTTP completas.
- Lint global conserva dos fallos preexistentes fuera del diff: `toolExecutors/intelligence.ts` y `toolExecutors/shared.ts`.

## Producción y evidencia

### Front

- Proyecto Vercel canónico: `visormarkdown`.
- Deployment: `dpl_FGDPtCeivnvmPNbYpd2LVGu3QUWW`.
- Estado: `READY`, target `production`.
- Alias: <https://agora.elenxos.com>.
- `/dashboard`: HTTP 200.
- Los chunks servidos en producción contienen `minimax`, `MiniMax` y la metadata del proveedor:
  - `/_next/static/chunks/8315.58ac672f4e2a21a8.js`;
  - `/_next/static/chunks/5216.6f144cf8ab2b04ab.js`;
  - `/_next/static/chunks/8016.9a90688430c518b2.js`.

El primer intento desde el worktree creó por error el proyecto aislado `agora-front-minimax-20260826`. No recibió el dominio productivo y fue eliminado completamente después de publicar en `visormarkdown`.

### Back

- Servicio Cloud Run: `agora-backend`.
- Revisión: `agora-backend-00266-mxg`.
- Tráfico: 100%.
- `/health`: HTTP 200, `status: ok`.
- `/api/agora-ai/models`: devuelve `MiniMax-M3`, familia `minimax`, estado `official`.

No se hizo una llamada facturable a la API externa de MiniMax: la integración se verificó por tests, artefacto Front y registro/backend vivo sin consumir saldo ni usar una credencial de usuario.

## Rollback

- Front: `vercel rollback dpl_6MnHqkSrAajUWP9QXasg7k3QF5Ju` desde el proyecto `visormarkdown`.
- Back: `gcloud run services update-traffic agora-backend --region us-central1 --to-revisions agora-backend-00265-lfg=100`.

Ambos rollbacks son independientes. El rollback del Front restaura la versión previa pero vuelve a retirar MiniMax de la UI; el del Back vuelve a la revisión anterior que ya publicaba el modelo, aunque su código no estaba consolidado en `main`.

# Fix: ediciones del agente visibles en tiempo real

Fecha: 2026-08-25 UTC

## Síntoma

Cuando el agente sobrescribía un archivo existente desde `write_worker_file`, el contenido se guardaba en el worker y llegaba a MinIO/Firestore, pero el editor abierto seguía mostrando la revisión anterior. Crear otro archivo sí aparecía.

## Causa confirmada

`MosaicEditor` deduplicaba cargas raw usando únicamente `storagePath` (o URL). Un overwrite conserva el mismo `storagePath`, así que el snapshot de Firestore llegaba pero `maybeLoadRawContent` lo clasificaba como “ya cargado” y no volvía a leer `/api/documents/:id/raw`.

Además, `write_worker_file` no estaba incluido entre las mutaciones de documentos que disparan el refresh inmediato al terminar una ejecución del agente.

## Corrección

- La clave de revisión ahora combina ubicación + `updatedAt`, sin exponer `contentHash` interno al cliente.
- Si una revisión nueva llega mientras una lectura raw anterior sigue en vuelo, sólo la respuesta más nueva puede aplicarse.
- `write_worker_file` se clasifica como mutación y solicita refresh del workspace.
- Se añadieron regresiones para mismo `storagePath` con distinta revisión y para los eventos de `write_worker_file`.

## Verificación

- Regresión dirigida: 16 pasados, 0 saltados, RC 0.
- Typecheck: RC 0.
- ESLint de los cinco archivos tocados: RC 0.
- Build Next de producción: RC 0, 35 páginas generadas.
- Suite completa con `NODE_ENV=test`: 773 pasados, 0 saltados, 1 fallo preexistente y ajeno (`basic-domain.test.ts`: expectativa Enterprise 10 GB frente a configuración vigente 100 GB).
- Smoke producción: `https://agora.elenxos.com` HTTP 200; `/api/diag` confirma NAS y Forgejo `health: ok`.

## Publicación

- PR: https://github.com/stevenvo780/EducacionCooperativa/pull/10
- Main: `95732b24a6e5e7ca6721bb06a15c3a10a9b3f8eb`
- Deployment Vercel activo: `dpl_6MnHqkSrAajUWP9QXasg7k3QF5Ju`
- Estado: `READY`, alias `agora.elenxos.com` verificado.

Los checks de GitHub Actions quedaron en fallo sin ejecutar ningún step (problema del runner/plataforma); la misma matriz relevante se ejecutó localmente como consta arriba.

## Rollback

El deployment anterior quedó preservado como `dpl_134FPw9KQuPpQvcEsxWMPUiEiJ9y`.

```bash
vercel rollback dpl_134FPw9KQuPpQvcEsxWMPUiEiJ9y --yes
```

El rollback de código es un `git revert 95732b24a6e5e7ca6721bb06a15c3a10a9b3f8eb` en `main`; no se cambió esquema, datos ni secretos.

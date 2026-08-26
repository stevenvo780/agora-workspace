# Auditoría de integración de ramas de Agora — 2026-08-26

## Resultado

Toda la funcionalidad activa encontrada está en la rama por defecto `main` de los siete repos de producto y en `main` del wrapper documental. No todas las ramas históricas son ancestros de `main`: AgoraFront conserva snapshots del monorepo de enero-marzo y ramas de trabajo recientes. Eso es historia preservada, no trabajo activo pendiente de merge.

No se mezclaron esas ramas antiguas porque hacerlo reintroduciría arquitecturas retiradas y borraría cientos de archivos actuales. Se compararon commits, equivalencia de parches, árboles y capacidades presentes en `main`.

## Estado por repo

- Wrapper `agora-workspace`: `main` `9167b23ea6db`; ninguna rama remota pendiente. Cinco ramas locales de worktrees están siete commits detrás y cero delante.
- AgoraFront (`EducacionCooperativa`): `main` `61774eb1af95`; contiene el fix de edición en tiempo real y MiniMax. La rama `socrates/restore-minimax-20260826` tiene árbol idéntico a `main`.
- AgoraBack: `main` `09abf1b94956`; las dos ramas MiniMax conservadas tienen árbol idéntico a `main`.
- AgoraHub: `main` `1cd9f955efcc`; ninguna rama remota delante.
- AgoraWorker: `main` `b33a623f7928`; la rama Ryzen está dos commits detrás y cero delante.
- AgoraCli: `main` `38e2e0fa94d7`; ninguna rama remota delante.
- ST: `main` `e34d51adabeb`; `dev` y la rama Codex están detrás y cero delante.
- Autologic: `main` `8866a786ed44`; ninguna rama remota pendiente.

Los punteros locales `main` de Front, Back, Hub, Worker y CLI quedaron alineados con sus `origin/main` sin cambiar las ramas actualmente checkout ni tocar árboles sucios.

## Ramas históricas de AgoraFront

### Parches ya contenidos

Las ramas `codex/fix-app-crash-on-tablet-when-coding`, `codex/improve-touch-functionality-for-tablet`, `copilot/add-e2e-and-unit-tests`, `copilot/add-editor-support-for-formats`, `copilot/add-file-explorer-view`, `copilot/add-user-registration-screen`, `copilot/fix-logout-button-and-invitations` y `feature/git-ui-tools` no aportan parches únicos frente al `main` actual.

Las ramas `socrates/fix-agent-edit-realtime-20260825` y `socrates/restore-minimax-20260826` corresponden a cambios ya mergeados por PR #10 y #11. La segunda tiene árbol idéntico a `main`; la rama MiniMax anterior carece de cambios posteriores de `main`, pero su funcionalidad MiniMax sí está integrada.

### Snapshots del monorepo

`dev`, `move-storage` y `refactor-next` divergieron en enero-febrero, antes del split. Sus commits únicos afectan principalmente rutas antiguas `services/hub`, `services/worker`, artefactos `.next`, paquetes `.deb` y scripts de despliegue que luego se separaron en AgoraHub, AgoraWorker y AgoraBack.

Se verificaron equivalentes actuales para autenticación/registro, remoción de miembros, tokens HMAC de workers, sync por workspace, manejo de extensiones/MIME, deploys y persistencia. Mergearlas hoy eliminaría entre 188 mil y 200 mil líneas de la arquitectura vigente.

### Drafts obsoletos cerrados

- PR #7, touch/tablet: cerrado como `superseded`. `main` ya tiene `TouchSensor` en Kanban, perfil touch, `touch-drag-polyfill`, drop documental en Mosaic y salida de fullscreen/ESC.
- PR #6, editor colaborativo WebSocket: cerrado como `superseded`. El viejo `public/js` fue reemplazado por MosaicEditor, Yjs sobre Firebase RTDB, awareness/presencia, SSE/RTDB para cambios externos y el registro moderno de visores/conversores.

Las ramas no se borraron; quedan como historial recuperable. Después del cierre no quedan PR abiertos en ninguno de los ocho repos auditados.

## Verificación

- Inventario remoto actualizado con `git fetch origin --tags` en los ocho repos.
- Comparación por repo: default branch remoto, ahead/behind, `git cherry`, `git diff` de árboles y commits únicos.
- Pruebas vigentes del reemplazo táctil/editor: 13 pasadas, 0 saltadas, RC 0 (`touch-drag-polyfill`, `st-editor-config`, `document-blob-revision`).
- Las verificaciones anteriores de MiniMax siguen vigentes: Front 4/4, Back 54/54, typecheck y builds en verde; producción Front/Back verificada.

## Árboles sucios preservados

No se descartó ni sobrescribió trabajo local. Permanecen tal como estaban:

- wrapper: cambios de harness, configuración y artefactos QA ajenos a esta auditoría;
- Front: manifiesto ST generado y `AGENTS.md` sin trackear;
- Hub: eliminaciones locales de `dist/` generado;
- ST: eliminaciones locales de `.next/trace*`.

Ninguno de esos elementos se clasificó como rama funcional pendiente ni fue añadido a `main` sin revisión.

## Reversión

- Reabrir drafts: `gh pr reopen 7 --repo stevenvo780/EducacionCooperativa` y lo mismo para `6`.
- Los punteros locales `main` pueden recrearse en cualquier repo con `git branch -f main origin/main`; no se cambió ningún remoto ni se borró rama alguna.

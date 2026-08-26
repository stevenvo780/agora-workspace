# Auditoría de integración de ramas de Agora — 2026-08-26

## Resultado

Toda la funcionalidad activa encontrada está en la rama por defecto `main` de los siete repos de producto y en `main` del wrapper documental. Se compararon commits, equivalencia de parches, árboles y capacidades presentes en `main`; no quedó trabajo activo pendiente de merge ni PR abierto.

Las ramas obsoletas se limpiaron el 2026-08-26. Los cinco snapshots divergentes con historia útil se preservaron primero como tags anotados y publicados. No se mezclaron esas ramas antiguas porque hacerlo reintroduciría arquitecturas retiradas y borraría cientos de archivos actuales.

## Estado por repo

- Wrapper `agora-workspace`: `main` de auditoría `8be4821f3f57`; ninguna rama remota o local secundaria.
- AgoraFront (`EducacionCooperativa`): `main` `61774eb1af95`; contiene el fix de edición en tiempo real y MiniMax.
- AgoraBack: `main` `09abf1b94956`; contiene MiniMax y el arreglo de edición en tiempo real correspondiente al backend.
- AgoraHub: `main` `1cd9f955efcc`; ninguna rama remota delante.
- AgoraWorker: `main` `b33a623f7928`; la rama Ryzen obsoleta estaba dos commits detrás y cero delante.
- AgoraCli: `main` `38e2e0fa94d7`; ninguna rama remota delante.
- ST: `main` `e34d51adabeb`; las ramas `dev` y Codex obsoletas estaban detrás y cero delante.
- Autologic: `main` `8866a786ed44`; ninguna rama remota pendiente.

Los ocho worktrees principales quedaron sobre `main`, con `HEAD == origin/main`, una sola rama local y una sola rama remota (`main`) por repo. Se preservaron los árboles sucios existentes.

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

Después del cierre no quedan PR abiertos en ninguno de los ocho repos auditados.

## Limpieza ejecutada

- Se publicaron cinco tags de archivo antes de borrar las ramas divergentes: `archive/front-dev-20260201` (`a0df7e8`), `archive/front-move-storage-20260215` (`b050558`), `archive/front-refactor-next-20260129` (`4edbd31`), `archive/front-touch-pr7-20260318` (`e301318`) y `archive/front-websocket-pr6-20260128` (`9ab9230`). Los cinco tags se verificaron contra sus objetos remotos pelados.
- Se eliminaron 20 ramas remotas obsoletas: 15 de Front, 2 de Back, 1 de Worker y 2 de ST. `socrates/fix-agent-edit-realtime-20260825` ya no existía en el remoto al ejecutar la limpieza y su referencia local de seguimiento se podó.
- Se eliminaron 15 ramas locales obsoletas: 5 worktrees históricos del wrapper, 3 de Front, 3 de Back, 1 de Hub, 2 de Worker y 1 de CLI.
- Se retiraron únicamente los dos worktrees temporales creados para restaurar MiniMax y el enlace temporal `/workspace/.worktrees/packages`; no se tocó ningún worktree de Prizma ni datos de usuario.

## Verificación

- Inventario remoto actualizado con `git fetch origin --tags` en los ocho repos.
- Comparación por repo: default branch remoto, ahead/behind, `git cherry`, `git diff` de árboles y commits únicos.
- Verificación posterior a limpieza con `git ls-remote --heads origin`: los ocho repos exponen únicamente `refs/heads/main`; sus ramas locales también contienen únicamente `main` y todos tienen `HEAD == origin/main`.
- GitHub: 0 PR abiertos en cada uno de los ocho repos.
- Pruebas vigentes del reemplazo táctil/editor: 13 pasadas, 0 saltadas, RC 0 (`touch-drag-polyfill`, `st-editor-config`, `document-blob-revision`).
- Las verificaciones anteriores de MiniMax siguen vigentes: Front 4/4, Back 54/54, typecheck y builds en verde; producción Front/Back verificada.

## Árboles sucios preservados

No se descartó ni sobrescribió trabajo local. Permanecen tal como estaban:

- wrapper: cambios de harness, configuración y artefactos QA ajenos a esta auditoría;
- Front: manifiesto ST generado y `AGENTS.md` sin trackear;
- Hub: eliminaciones locales de `dist/` generado;
- ST: eliminaciones locales de `.next/trace*`.

El diff del manifiesto Front (`5c5bb0b7...`), su `AGENTS.md` (`3b734bd0...`) y el diff de `dist/` del Hub (`18f63695...`) conservaron el mismo SHA-256 antes y después del cambio a `main`.

Ninguno de esos elementos se clasificó como rama funcional pendiente ni fue añadido a `main` sin revisión.

## Reversión

- Reabrir drafts: `gh pr reopen 7 --repo stevenvo780/EducacionCooperativa` y lo mismo para `6`.
- Restaurar un snapshot archivado, por ejemplo `dev`: `git push origin archive/front-dev-20260201:refs/heads/dev` desde AgoraFront. Los otros cuatro tags se restauran con el mismo patrón.
- Las ramas de trabajo ya integradas se pueden recrear desde `main`; sus funcionalidades permanecen en `main` y sus commits continúan alcanzables por los PR mergeados o por el reflog local mientras no expire.

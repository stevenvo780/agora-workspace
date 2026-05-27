# Artifats — índice de documentos

Carpeta de artefactos de operación y QA del workspace Agora. No contiene secretos.

| Archivo | Contenido |
|---------|-----------|
| `CONTEXTO-AGORA.md` | Documento maestro de contexto del workspace: topología de infra, stack, servicios, runbooks operativos, tools del agente IA (145), gotchas críticos. Sirve para cobrar contexto rápido al retomar trabajo. |
| `MAPA-BUGS-AGORA.md` | Mapa de bugs de la campaña QA masiva 2026-05-27. Organizado en: resueltos+deployados+verificados, backlog abierto (con tabla de severidad), sólido sin bugs, falsos positivos confirmados. |
| `REPORTE-QA-AGORA.md` | Reporte de la sesión de testeo: método (16 Chrome headless paralelos, cuenta QA throwaway), tabla de bugs encontrados con severidad y fix sugerido, cobertura de superficie pública (12 áreas) y backend autenticado (~50 endpoints), limitaciones del entorno. |
| `arquitectura-checklist-agora.md` | Auditoría fundamental de arquitectura (2026-05-03) sobre los 7 repos del ecosistema: checklist de diseño, deuda y riesgos estructurales. |
| `docker-deploy-audit-agora.md` | Auditoría de Docker/deploy: estado de Dockerfiles por servicio, non-root, healthchecks y notas pre-producción. |
| `runbooks-agora.md` | Runbooks operativos: procedimientos paso a paso para incidentes (sync roto, secrets/rotación, salud de servicios). |

---

## Resumen ejecutivo — campaña QA 2026-05-27

Campaña de testeo masivo sobre producción (`agora.elenxos.com` + Cloud Run `agora-backend-00210-fnc`) con 16 instancias Chrome headless independientes y cuenta QA throwaway. Resultado: plataforma verificada limpia al cierre. Todos los bugs de seguridad y los de mayor impacto funcional fueron corregidos y deployados en la misma sesión: cluster de seguridad auth (rate-limit login, anti-enumeración, SSRF, path-traversal, timeout DoS), validación de invitaciones de miembros, 3 bugs del workbench git (commit atómico, historial auto-refresh, diff 404→200), overflow móvil, agente IA (mensaje vacío, cap de chats), i18n de errores, leak SSE, 404 JSON, git interno+GitHub externo confirmados. El backlog que quedó abierto es menor (cosmético, UX bajo riesgo, o requiere diseño de feature completo) y fue dejado por decisión explícita riesgo > valor.

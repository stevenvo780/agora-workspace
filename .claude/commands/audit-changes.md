---
description: Auditoría completa de cambios sin commitear — invoca code-reviewer y security-auditor en paralelo sobre el diff actual. Úsalo antes de commit/PR/deploy. Devuelve verdict consolidado (READY/NEEDS_FIXES/BLOCKED) con la lista de issues priorizados.
argument-hint: "[ref opcional: HEAD (default) | --staged | <branch>...HEAD]"
---

# /audit-changes — Review + Security audit del diff

Scope del diff: $ARGUMENTS (si vacío → `HEAD` = unstaged + staged).

## Pasos

1. **Recopilar contexto del cambio** (1 sola vez, compartido):
   ```bash
   git status
   git diff --stat $ARGUMENTS
   git diff $ARGUMENTS --name-only
   ```
   Si NO hay cambios → reportar "Nothing to audit" y salir.

2. **Lanzar AMBOS agentes en paralelo** vía Agent tool (un solo mensaje con dos tool calls):
   - `subagent_type: "code-reviewer"` — input: "Audita el diff de `$ARGUMENTS` contra las convenciones del workspace"
   - `subagent_type: "security-auditor"` — input: "Audita el diff de `$ARGUMENTS` por secrets/env leaks/violaciones de seguridad"

3. **Consolidar verdict**:
   ```
   === AUDIT CONSOLIDADO ===

   CODE REVIEW: <verdict del agent>
     - <issues clave, top 3>

   SECURITY AUDIT: <verdict del agent>
     - <issues clave, top 3>

   === DECISIÓN FINAL ===
   ✅ READY_TO_COMMIT     → ambos agentes pasaron
   ⚠️  NEEDS_FIXES         → al menos uno tiene HIGH/MEDIUM
   🛑 BLOCKED              → al menos uno tiene CRITICAL

   Próxima acción sugerida:
   <fix concreto del issue más severo, con file:line>
   ```

## Reglas

- NO te saltes ningún agente — los dos siempre.
- NO declares READY si security-auditor encontró algo CRITICAL.
- Los reportes de los agentes son la fuente de verdad — no inventes issues ni ocultes los reportados.
- Si un agente falla en ejecutarse, reportalo explícito ("security-auditor failed: <razón>") y marcá BLOCKED hasta resolver.

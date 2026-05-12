---
description: Estado git de los 7 repos del workspace (AgoraFront, AgoraBack, AgoraHub, AgoraWorker, AgoraCli, ST, Autologic) — uncommitted changes, ahead/behind origin, último commit. Útil antes de lanzar agentes paralelos para detectar trabajo en curso.
---

# /repo-status — Estado git de los 7 repos

## Ejecutá en paralelo

```bash
for repo in AgoraFront AgoraBack AgoraHub AgoraWorker AgoraCli ST Autologic; do
  echo "=== $repo ==="
  cd "/home/operador/proyectos/humanizar/EducacionCooperativa/$repo" 2>/dev/null && {
    git fetch origin --quiet 2>&1 | tail -2
    echo "Branch: $(git branch --show-current)"
    echo "Ahead/behind origin: $(git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo 'no upstream')"
    UNCOMMITTED=$(git status --porcelain | wc -l)
    echo "Uncommitted files: $UNCOMMITTED"
    git log -1 --format='Last commit: %h %s (%cr by %an)'
    echo ""
  } || echo "(no se pudo abrir $repo)"
done
```

## Output esperado

Tabla por repo:
```
REPO          BRANCH    AHEAD/BEHIND   UNCOMMITTED   LAST COMMIT
AgoraFront    master    0/0            0             abc123 docs(claude): ...
AgoraBack     master    0/0            3             def456 feat(api): ...
...
```

## Interpretación

- **Uncommitted >0**: hay trabajo sin commitear (puede ser WIP del user o de otro agente). Antes de lanzar un agente que toque ese repo, considerar `git stash` o coordinar.
- **Ahead >0**: hay commits locales no pusheados.
- **Behind >0**: el remoto avanzó (hacer `git pull --rebase` antes de commitear).
- **No upstream**: branch local sin tracking — configurar con `git push -u origin <branch>`.

## NO hacer

- NO ejecutes `git stash` automáticamente — pueden ser cambios reales del user.
- NO hagas `git pull` sin antes verificar uncommitted (puede haber conflictos).
- NO commitees aquí — este command es read-only.

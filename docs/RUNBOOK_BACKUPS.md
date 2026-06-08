# Runbook — Backups Firestore + MinIO

Estado: implementado 2026-05-11. Sin backup, una pérdida de datos no es recuperable; este runbook documenta qué corre, dónde queda guardado y cómo restaurar.

---

## 1. Firestore — export diario a GCS

**Schedule**: 03:00 UTC todos los días (Cloud Scheduler job `firestore-daily-backup`, región `us-central1`).

**Bucket**: `gs://agora-firestore-backups-udea-filosofia` (us-central1, UBLA, lifecycle 30d auto-delete).

**Colecciones exportadas** (whitelist explícita):
`users`, `workspaces`, `documents`, `agentChats`, `agentSecrets`, `subscriptions`, `snippets`, `syncEventsOutbox`, `boards`.

**SA / permisos**:
- Cloud Scheduler invoca con OAuth como `578238159459-compute@developer.gserviceaccount.com` → role `roles/datastore.importExportAdmin` (proyecto `udea-filosofia`).
- Firestore service agent `service-578238159459@gcp-sa-firestore.iam.gserviceaccount.com` escribe al bucket via `roles/storage.admin`.

**Layout de cada export**:
```
gs://agora-firestore-backups-udea-filosofia/YYYY-MM-DDTHH:MM:SS_NNNNN/
  ├── YYYY-MM-DDTHH:MM:SS_NNNNN.overall_export_metadata
  └── all_namespaces/
      ├── kind_<collection>/
      │   ├── all_namespaces_kind_<collection>.export_metadata
      │   └── output-<n>
```

**Tamaño de referencia**: 1ª corrida = 13 MB total (al 2026-05-11).

### Verificación rutinaria

```bash
# Última corrida exitosa
gcloud logging read 'resource.type="cloud_scheduler_job" AND resource.labels.job_id="firestore-daily-backup"' \
  --project=udea-filosofia --limit=4 \
  --format='value(timestamp,severity,httpRequest.status)'

# Listar exports persistidos
gcloud storage ls gs://agora-firestore-backups-udea-filosofia/ --project=udea-filosofia

# Tamaño acumulado
gcloud storage du -s gs://agora-firestore-backups-udea-filosofia/ --project=udea-filosofia
```

### Disparar manualmente

```bash
gcloud scheduler jobs run firestore-daily-backup --location=us-central1 --project=udea-filosofia
# o export directo bajo el user actual:
gcloud firestore export gs://agora-firestore-backups-udea-filosofia/manual-$(date -u +%Y%m%dT%H%M%S) \
  --project=udea-filosofia --async
```

### Restore Firestore

> ATENCIÓN: el import **sobrescribe** documentos existentes con el mismo path. Confirmar con el user antes de tocar producción. Para safety, hacer primero un dry-run en un proyecto sandbox o restaurar a colecciones renombradas.

```bash
# 1. Listar prefijos de export disponibles
gcloud storage ls gs://agora-firestore-backups-udea-filosofia/

# 2. Restore TOTAL (todas las colecciones del export elegido):
gcloud firestore import gs://agora-firestore-backups-udea-filosofia/<TIMESTAMP_FOLDER>/ \
  --project=udea-filosofia --async

# 3. Restore parcial (subset de colecciones):
gcloud firestore import gs://agora-firestore-backups-udea-filosofia/<TIMESTAMP_FOLDER>/ \
  --collection-ids=users,workspaces \
  --project=udea-filosofia --async

# 4. Seguir progreso:
gcloud firestore operations list --project=udea-filosofia --limit=5

# 5. Cancelar si fuera necesario:
gcloud firestore operations cancel <OPERATION_NAME> --project=udea-filosofia
```

**Notas de restore**:
- El export es punto-en-el-tiempo eventually consistent (Firestore puede haber estado siendo escrito durante el export).
- Restore reaplica writes preservando IDs; no recrea índices automáticamente — los índices viven aparte y persisten.
- Las RTDB rules / Firestore security rules **no** se incluyen en el export; manejarlas con `firebase deploy --only firestore:rules`.

### Costos

| Concepto | Tarifa | Estimado mensual |
|---|---|---|
| Storage Standard us-central1 | $0.020 / GB / mes | 30 days × 13 MB ≈ 0.4 GB → **~$0.008/mes** |
| Operaciones de read durante export | Se cuentan como reads regulares de Firestore (1 read por doc exportado) | depende del crecimiento; hoy ~marginal |
| Network egress (intra-region) | $0 (us-central1 → us-central1) | $0 |

A escalas razonables (~100x el tamaño actual) el bucket cuesta < $1/mes.

---

## 2. MinIO — mirror diario intra-VPS

**Schedule**: 02:00 UTC diario via crontab del user `root` en el VPS `agora-storage` (`76.13.118.239`).

**Origen**: `adm/agora-blobs` (alias `mc adm` configurado en el container `agora-minio`).
**Destino**: `adm/agora-blobs-backup` (mismo MinIO, mismo VPS).

**Script**: `/root/scripts/minio-mirror-backup.sh` (`set -euo pipefail`, log a `/root/logs/minio-mirror-backup.log`, autotrunca a 1 MB cuando supera 5 MB).

**Comando central**:
```bash
docker compose -f /opt/agora-stack/docker-compose.yml exec agora-minio mc mirror --overwrite --remove --quiet \
  adm/agora-blobs adm/agora-blobs-backup
```

`--overwrite` reaplica cambios; `--remove` borra del mirror lo que ya no existe en source (lo que mantiene la copia 1:1).

**Tamaño / tiempo de referencia (2026-05-11)**: 976 MiB / 3905 objects sincronizados en ~14s.

### Verificación

```bash
# Última corrida
ssh root@76.13.118.239 'tail -20 /root/logs/minio-mirror-backup.log'

# Comparación de tamaño origen vs mirror
ssh root@76.13.118.239 'docker compose -f /opt/agora-stack/docker-compose.yml exec agora-minio mc du adm/agora-blobs && docker compose -f /opt/agora-stack/docker-compose.yml exec agora-minio mc du adm/agora-blobs-backup'

# Cron registrado
ssh root@76.13.118.239 'crontab -l | grep minio'
```

### Restore MinIO

#### Caso A — un workspace/objeto perdido en `agora-blobs`

```bash
# Identificar el prefijo del workspace (usualmente workspaces/<wsId>/...)
ssh root@76.13.118.239 'docker compose -f /opt/agora-stack/docker-compose.yml exec agora-minio mc ls --recursive adm/agora-blobs-backup/workspaces/<wsId>/ | head'

# Copiar de mirror -> source (overwrite explícito)
ssh root@76.13.118.239 'docker compose -f /opt/agora-stack/docker-compose.yml exec agora-minio mc cp --recursive --overwrite \
  adm/agora-blobs-backup/workspaces/<wsId>/ adm/agora-blobs/workspaces/<wsId>/'
```

#### Caso B — restore total

```bash
# Sincronizar mirror -> source (cuidado: --remove borra del source lo que no esté en mirror)
# Hacerlo SIN --remove primero para evitar pérdida adicional:
ssh root@76.13.118.239 'docker compose -f /opt/agora-stack/docker-compose.yml exec agora-minio mc mirror --overwrite adm/agora-blobs-backup adm/agora-blobs'

# Luego, si se quiere alinear 100% (sólo si el incidente lo justifica):
ssh root@76.13.118.239 'docker compose -f /opt/agora-stack/docker-compose.yml exec agora-minio mc mirror --overwrite --remove adm/agora-blobs-backup adm/agora-blobs'
```

### Limitaciones del mirror intra-VPS

- **No es offsite**: si el VPS falla / lo borran, ambos buckets se van. Para offsite real, programar un `rclone sync` semanal a GCS u otro destino — fuera de alcance de este lote.
- **No protege contra ransomware del propio MinIO** si el atacante tiene credenciales válidas (el `--remove` propaga el daño en el próximo ciclo).
- Mitigaciones futuras: object lock + versioning en MinIO; snapshot del dataset que contiene `/data/agora-blobs-backup`.

---

## 3. Tabla resumen

| Componente | Frecuencia | Retención | Ubicación | Tamaño hoy |
|---|---|---|---|---|
| Firestore export | Diario 03:00 UTC | 30 días (lifecycle GCS) | `gs://agora-firestore-backups-udea-filosofia/` | 13 MB / corrida |
| MinIO mirror | Diario 02:00 UTC | Continuo (1:1 con source) | `adm/agora-blobs-backup` (agora-storage, 76.13.118.239) | 976 MiB |

---

## 4. Cambios IAM aplicados

- `roles/storage.admin` → `service-578238159459@gcp-sa-firestore.iam.gserviceaccount.com` (necesario para que Firestore escriba al bucket).
- `roles/datastore.importExportAdmin` → `578238159459-compute@developer.gserviceaccount.com` (necesario para que Cloud Scheduler invoque `:exportDocuments`).

Para revocar, simétrico con `gcloud projects remove-iam-policy-binding`.

---

## 5. Pendientes / mejoras propuestas (NO implementadas en este lote)

- Off-site real (GCS espejo del bucket MinIO o backup a otro NAS) — costo adicional por egress.
- Alerting si el job de Firestore falla 2 días seguidos (Cloud Monitoring alert sobre `logName="cloudscheduler.googleapis.com/executions"` con `severity>=ERROR` filtrado por job_id).
- Probar end-to-end un restore en un proyecto sandbox para validar tiempos reales y procedimiento.
- Versionado en MinIO para resistir borrados accidentales (`mc version enable adm/agora-blobs`) — cambio aparte porque afecta el formato del bucket.

---

## 6. Procedimientos relacionados

- **Rotación de Service Account Firebase** (la SA que escribe los exports y
  la que usa el backfill de claims): `RUNBOOK_OPS.md` §4 y §13.
- **Recovery MinIO desde mirror**: `RUNBOOK_OPS.md` §5 cubre el flow corto;
  esta página (§2 caso A/B) es la referencia detallada.
- **Recovery Firestore desde backup**: `RUNBOOK_OPS.md` §6 cubre el flow
  corto; §1 de esta página es la referencia detallada con opciones
  parciales/totales.

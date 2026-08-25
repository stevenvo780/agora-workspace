# Incidente MinIO de Agora — 2026-08-25

## Resumen

La creación y lectura de archivos devolvía HTTP 500 porque Caddy no podía
conectar con MinIO en `127.0.0.1:9000`. El contenedor `agora-minio` estaba
detenido desde el 23 de agosto, mientras Front, Back, Hub, Forgejo y Postgres
seguían atendiendo.

## Causa observada

- El 23-ago a las 14:14:49 UTC se ordenó detener `docker.service` en el VPS.
- Docker no terminó dentro del timeout y systemd lo mató con SIGKILL.
- Al volver, containerd registró shims huérfanos, healthchecks vencidos y una
  tormenta de reinicios en varios contenedores.
- MinIO intentó reiniciarse repetidamente, pero terminó detenido. Su estado
  registró `OOMKilled=false`, disco al 34 %, inodos al 8 % y memoria disponible;
  no hay evidencia de corrupción, OOM ni falta de capacidad.
- Los journals no registran el comando exacto ni permiten atribuir con certeza
  qué automatización o sesión ordenó detener Docker. Sí prueban que no fue una
  caída aislada de MinIO.

## Reparación y verificación

- Se reactivó `agora-minio` sin recrear el contenedor ni tocar su volumen.
- Estado Docker: `running/healthy`, política `unless-stopped`.
- Health local y público: HTTP 200.
- Prueba funcional S3: escribir, leer, comparar y borrar un objeto temporal,
  exitosa. El objeto de prueba fue eliminado.
- El diagnóstico del Front reportó `nas.health=ok` y `forgejo.health=ok`.
- Se ejecutó manualmente el job `reconcile-storage`, que había acumulado ocho
  fallos durante la caída; terminó HTTP 200 en 13,1 s.
- Desde la recuperación no aparecieron nuevos 5xx de AgoraBack en la ventana
  auditada.

## Estado del resto de Agora

- Front: producción Vercel `Ready`, despliegue del 19-ago-2026.
- Back: revisión `agora-backend-00265-lfg`, 100 % del tráfico, health OK.
- Hub: servicio systemd activo y health público OK.
- Forgejo y Postgres: contenedores activos; health OK.
- Capacidad del VPS: 64 GB libres, 8 % de inodos usados y 6,2 GB de memoria
  disponible durante la auditoría.
- Sincronización: 705 polls HTTP 200 de 40 workspaces distintos en diez minutos.
- Repos locales: remotos refrescados; ninguna rama con upstream estaba atrasada.
  Se preservaron sin tocar los cambios locales preexistentes.
- El acceso SSH documentado para `ils-server` está obsoleto o no es accesible
  desde este contenedor. La actividad de los 40 workspaces verifica el plano de
  sync de forma indirecta, pero falta corregir el inventario del host de workers
  para recuperar observabilidad directa.

## Prevención instalada

Se añadió `agora-minio-guard.timer`, que cada dos minutos comprueba el estado
del contenedor. Si Docker quedó arriba pero MinIO no, ejecuta `docker compose up
-d minio` y exige health ready. Si el contenedor está ejecutándose pero falla
tres comprobaciones consecutivas de readiness, lo reinicia. No reinicia un
MinIO saludable.

Archivos versionados:

- `scripts/systemd/agora-minio-ensure`
- `scripts/systemd/agora-minio-guard.service`
- `scripts/systemd/agora-minio-guard.timer`

## Hallazgos fuera del alcance de Agora

El VPS compartido conserva contenedores Cauce detenidos y una unidad fallida de
leadgen. No se tocaron: no pertenecen al runtime de Agora y deben coordinarse
con el owner correspondiente. Tampoco se modificaron secretos ni datos.

## Reversión

```bash
sudo systemctl disable --now agora-minio-guard.timer
sudo rm /etc/systemd/system/agora-minio-guard.timer
sudo rm /etc/systemd/system/agora-minio-guard.service
sudo rm /usr/local/sbin/agora-minio-ensure
sudo systemctl daemon-reload
```

La reversión elimina únicamente la guarda; no detiene MinIO ni modifica datos.

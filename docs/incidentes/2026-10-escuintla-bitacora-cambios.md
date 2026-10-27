# Bitácora de cambios: corrección del congelamiento de métricas en IGSS Escuintla

| | |
|---|---|
| **Servidor** | 10.0.6.33 (usuario `api`), carpeta `~/node-postgres-docker` |
| **Contenedores** | `node-api` (api-SIASA) y `postgres-db` |
| **Fechas de ejecución** | 14/10/2026 18:11 UTC al 15/10/2026 15:23 UTC |
| **Ejecutado por** | Claude Code, con autorización de soporte SIASA |
| **Respaldo en el servidor** | `~/respaldos/2026-10-14-incidente/` |
| **Evidencia en este repositorio** | [`evidencia-escuintla-2026-10/`](evidencia-escuintla-2026-10/) |
| **Informe del incidente** | [2026-10-escuintla-metricas-congeladas.md](2026-10-escuintla-metricas-congeladas.md) |

Todas las horas están en **UTC**. Hora de Guatemala = UTC − 6.

---

## 1. Resumen

| # | Qué se hizo | Resultado |
|---|---|---|
| 1 | Se confirmó la causa del incidente con el log del servidor | El 30/09 18:33 UTC la conexión con el EBO se cortó y la lectura quedó **atascada** hasta el reinicio manual del 13/10 05:19 UTC |
| 2 | Se corrigió el atasco en `modbus_rtu.js` | Probado: el código original se bloquea; el corregido se recupera en 5 s |
| 3 | Se apagó el lector v2 (no se usa) | Reconexiones al EBO: de **42 cada 10 min a 0** |
| 4 | Se apagó el log detallado del puente BACnet y se activó la rotación del log | Disco: de **85 % a 36 %** (34 GB liberados); el log ya no puede crecer más de 500 MB |
| 5 | Se restringió Postgres a `127.0.0.1` y se encendió | Ya no está expuesto a la red con `admin/admin123`; **no se reactivó la inserción de métricas** |
| 6 | Base de datos y usuario propios para los eventos (`siasa_eventos`) | El usuario no puede entrar a `mi_basedatos` |
| 7 | Módulo de monitoreo de eventos (`monitoreo/eventos_modbus.js`) | Detecta, registra y expone el estado; el correo queda listo, **pendiente de la cuenta SMTP** |

---

## 2. Causa confirmada

Evidencia: [`log_30sep-02oct_sin_bridge.txt`](evidencia-escuintla-2026-10/log_30sep-02oct_sin_bridge.txt) y [`log_12oct-13oct_sin_bridge.txt`](evidencia-escuintla-2026-10/log_12oct-13oct_sin_bridge.txt).

| Hora (UTC) | Hora (Guatemala) | Evento |
|---|---|---|
| 30/09 00:00 – 18:33 | 29/09 18:00 – 30/09 12:33 | Conexión estable, sin reconexiones |
| **30/09 18:33:03** | **30/09 12:33** | `Error actualizando snapshot modbus-auto-v2: Port Not Open` (3 veces): el EBO cerró la conexión |
| 30/09 18:33 – 13/10 05:19 | 12 días 10 h 46 min | **Ninguna línea de Modbus** en el log: la lectura quedó atascada y la API entregó la última lectura buena |
| **13/10 05:19:32** | **12/10 23:19** | `Cerrando servicio...`: reinicio manual de `node-api`. A los 18 s volvió a leer |

**Mecanismo:** cuando una lectura falla por timeout, el código cierra la conexión con `await client.close()`. La librería `modbus-serial` 8.0.23 solo resuelve esa promesa si el socket emite `close` estando abierto. Como el EBO ya había cerrado el socket, la promesa no se resolvía nunca y bloqueaba la cola de lecturas para siempre, sin escribir nada en el log. Solo un reinicio la liberaba.

**Reproducción:** [`pruebas/prueba_reset.js`](evidencia-escuintla-2026-10/pruebas/prueba_reset.js) simula un EBO que cierra el socket con una lectura pendiente.

| Código | Resultado |
|---|---|
| Original | `RESULTADO: BLOQUEADO (sin respuesta tras 30.007s, conexiones=1)` |
| Corregido | `RESULTADO: RECUPERADO (conexiones=2, 5.051s)` |

---

## 3. Acciones, en orden

### 3.1 Inspección inicial (solo lectura) — 14/10 18:11

- Huella del servidor verificada contra la conocida: `ED25519 SHA256:Bb69l1ntj0vdQOq2q3QLKW2mRuRn2i1BgWufCuTPhaY`.
- Código desplegado **idéntico** a la carpeta local `api-SIASA` (mismos MD5 de `index.js`, `lectura_Ebo.js`, `lectura_Ebo_v2.js`, `modbus_rtu.js`, `mqtt_to_bacnet_bridge.js`).
- `MQTT_ENABLED=false` en `/app/.env`: la inserción de métricas está apagada.
- Log del contenedor: **36 717 598 853 bytes** (36.7 GB), sin rotación. Disco al 84 %.
- Postgres detenido desde el 10/05/2026, con el puerto 5432 expuesto a toda la red.

### 3.2 Respaldo — 14/10 18:53

```
~/respaldos/2026-10-14-incidente/antes/
  docker-compose.yml  .env  index.js  modbus_rtu.js  package.json
  inspect-node-api.json  inspect-postgres-db.json  estado-servidor.txt
  reconexiones-ultimos-10min.txt (42)  respuesta-modbus-auto.json  tamano-log.txt
  procesos-docker-logs-atascados.txt  SHA256SUMS
```

### 3.3 Procesos atascados — 14/10 ~19:00

Se detuvieron 3 procesos `docker logs --since 2026-10-01 ...` que corrían como root desde el 13/10 05:15 UTC (37 h), leyendo el log completo. Comando: `sudo kill -9 649427 649426 649424`. Evidencia: `antes/procesos-docker-logs-atascados.txt`.

### 3.4 Corrección del atasco — 14/10 19:04:32

Archivo: `api/modbus_cliente/modbus_rtu.js`.

- `resetModbus()` espera el cierre como máximo 3 s (`MODBUS_RESET_CLOSE_TIMEOUT_MS`) y después **destruye el socket**.
- Cada reconexión escribe en el log `[MODBUS-EVENTO] RECONEXION` con el motivo (máximo una línea por minuto, con conteo).
- Se exportan `resetModbus` y `getResetTotal` para el vigilante.

Despliegue: `pscp` del archivo, verificación de MD5, `docker restart node-api`.

### 3.5 Causa de las reconexiones y apagado del lector v2 — 14/10 19:04 a 19:09

El nuevo log mostró el motivo de las reconexiones:

```
[MODBUS-EVENTO] {"evento":"RECONEXION","motivo":"dir 5620: Data length error, expected 207 got 209","reconexiones":6}
```

El lector **v2** (que no se usa: `MODBUS_AUTO_ACTIVE_VERSION=1`) fallaba en el registro 5620 cada 30 s y forzaba 2 reconexiones. Cada reconexión pasaba por el código donde ocurrió el atasco.

Cambios en `api/.env` (19:09:17, `docker restart node-api`):

```diff
-MQTT_BACNET_LOG_MESSAGES=true
-MQTT_BACNET_LOG_OBJECT_VALUES=true
+MQTT_BACNET_LOG_MESSAGES=false
+MQTT_BACNET_LOG_OBJECT_VALUES=false
+MODBUS_AUTO_V2_POLL_MS=0
```

| Verificación | Antes | Después |
|---|---|---|
| Reconexiones | 42 en 10 min | 0 |
| Crecimiento del log | ~250 MB/día | ~10 MB/día (10 976 bytes en 95 s) |
| Potencia ION7400-1 | cambiando | cambiando (150.31 → 139.37 kW) |

### 3.6 Evidencia del log antes de eliminarlo — 14/10 19:13 a 19:18

```
~/respaldos/2026-10-14-incidente/logs/
  node-api_historial-completo_sin-puente.json.gz        33 MB   (21/04/2026 – 14/10/2026 19:09, sin líneas del puente)
  node-api_completo_2026-09-25_a_2026-10-14.json.gz    741 MB   (todo, incluido el puente)
  SHA256SUMS
```

Verificado con `gzip -t`. Contiene las 3 líneas `Port Not Open` del 30/09 18:33 y los 62 reinicios (`Cerrando servicio`) desde abril.

SHA256:
```
54d1bc8b172fbbaf459016378e9b500f860a65cc09fcfd5f4312c3008ffd2107  node-api_completo_2026-09-25_a_2026-10-14.json.gz
bf4822d91dbaa8457c6d671ec15c68a8f908e91dffcb73583ef14bd3b61973c3  node-api_historial-completo_sin-puente.json.gz
```

> **Nota:** el log entre el 14/10 19:13 UTC y el 15/10 14:55 UTC (~20 h, ya con la corrección aplicada) no quedó en el respaldo y se eliminó al recrear el contenedor. No contiene evidencia del incidente.

### 3.7 `docker-compose.yml` — 14/10 ~20:07

```diff
+x-logging: &logging
+  driver: json-file
+  options:
+    max-size: "50m"
+    max-file: "10"
 ...
   postgres:
     ports:
-      - "5432:5432"
+      - "127.0.0.1:5432:5432"
+    logging: *logging
 ...
   api:
+    logging: *logging
```

Como Docker 28.2.2 y docker-compose 1.29.2 fallan al **recrear** contenedores (`KeyError: 'ContainerConfig'`), cada servicio se eliminó y se creó de nuevo: `docker-compose rm -sf <servicio>` y luego `docker-compose up -d --no-deps <servicio>`. Los datos de Postgres están en el volumen `node-postgres-docker_postgres_data` y no se tocaron.

### 3.8 Encendido de Postgres — 14/10 20:07:15

- `5432/tcp -> 127.0.0.1:5432` (solo local).
- Durante 75 s: **ninguna inserción** en `mi_basedatos` y **ninguna conexión** (`pg_stat_user_tables` y `pg_stat_activity`).
- `sensores_mqtt`: 1 752 611 filas, la última del 10/04/2026. No crece.

### 3.9 Base de datos de eventos — 14/10 ~20:08

```sql
CREATE USER siasa_eventos WITH PASSWORD '<aleatoria de 32 caracteres>';
CREATE DATABASE siasa_eventos OWNER siasa_eventos;
REVOKE CONNECT ON DATABASE mi_basedatos FROM PUBLIC;
GRANT CONNECT ON DATABASE mi_basedatos TO admin;
```

- Clave: solo en el servidor, en `~/respaldos/2026-10-14-incidente/.clave_siasa_eventos` (permiso 600) y en `api/.env`.
- Prueba: `siasa_eventos` entra a su base; a `mi_basedatos` recibe `permission denied`.

### 3.10 Módulo de monitoreo — código probado en local el 14/10 20:00, desplegado el 15/10 14:55

| Archivo | Cambio |
|---|---|
| `api/monitoreo/eventos_modbus.js` | **Nuevo.** Detección de eventos, base propia, correo, estado |
| `api/index.js` | Se conecta el monitor a la lectura; respuesta con `lectura`; rutas `/estado`, `/eventos`, `/alertas/prueba`; doble candado `MQTT_SENSOR_DB_ENABLED` |
| `api/modbus_cliente/modbus_rtu.js` | Contador de reconexiones exportado |
| `api/.env` | Bloque `# 2026-10-14 monitoreo de eventos y alertas` |

MD5 desplegados (iguales en local y servidor):
```
9593b8e98c72c05e068f31651896bc0e  index.js
ffb98ac9d86ac32fce177f360b938c6b  monitoreo/eventos_modbus.js
0386b80c16a7e831fb92274091e8f05b  modbus_cliente/modbus_rtu.js
```

Prueba local con datos simulados ([`pruebas/resultado_monitor.txt`](evidencia-escuintla-2026-10/pruebas/resultado_monitor.txt)): los 9 escenarios abren, notifican y cierran sus eventos; 4 medidores congelados a la vez generan **un solo** correo agrupado.

### 3.11 Recreación de `node-api` — 15/10 14:55:03 a 14:55:14

| | Antes | Después |
|---|---|---|
| Disco | 85 % (11 GB libres) | **36 % (45 GB libres)** |
| Configuración del log | sin límite | `max-size: 50m`, `max-file: 10` |
| Política de reinicio | always | always |

### 3.12 Verificación final — 15/10 15:23

| Prueba | Resultado |
|---|---|
| `GET /api/ebo/modbus-auto/estado` | `estado: ok`, última lectura hace 3 s, 0 reconexiones, 13 medidores |
| `GET /api/ebo/modbus-auto/eventos` | Lee de la base: evento `API_REINICIADA` registrado |
| `GET /api/ebo/modbus-auto` | **Los mismos 13 medidores** que antes del cambio; valores cambiando (134.91 → 135.28 kW); campo nuevo `lectura` |
| Reconexiones desde el arranque | 1 (la conexión inicial) |
| Puente BACnet | Corriendo, conectado a MQTT 10.0.6.35 |

Evidencia: `despues/estado.json`, `despues/eventos.json`, `despues/respuesta-modbus-auto-1.json` y `-2.json`.

---

### 3.13 Correo de alertas y panel de monitoreo — 15/10 22:56 a 22:59

Respaldo previo: `~/respaldos/2026-10-15-correo/antes/` (`index.js`, `.env`, `eventos_modbus.js`, `SHA256SUMS`).

| Archivo | Cambio |
|---|---|
| `api/monitoreo/plantilla_correo.js` | **Nuevo.** Correo HTML: línea de tiempo (detectado, notificado, resuelto), ficha completa del dispositivo, lectura del medidor con barras por fase, causa probable, pasos a seguir y botones |
| `api/monitoreo/panel.html` | **Nuevo.** Panel de eventos en `http://10.0.6.33:3001/monitoreo` |
| `api/monitoreo/eventos_modbus.js` | Guarda la ficha y la última lectura de cada medidor; envía HTML; correo de prueba con datos reales; vista previa |
| `api/monitoreo/package.json` + `node_modules/` | `nodemailer` 6.10.1, instalado dentro de `api/monitoreo` (persiste aunque se recree el contenedor) |
| `api/index.js` | Rutas `POST /alertas/prueba?dispositivo=&evento=`, `GET /alertas/vista-previa`, `GET /monitoreo` |
| `api/.env` | Bloque `# 2026-10-15 correo de alertas (Microsoft 365)` |

Configuración del correo (la clave está solo en el `.env` del servidor):

| Variable | Valor |
|---|---|
| Servidor | `smtp.office365.com:587` (STARTTLS). El MX de `siasa.gt` es Microsoft 365 |
| Remitente | `Alarmas SIASA <alarmas.atlas@siasa.gt>` |
| Destinatarios | `chernandez@siasa.gt`, `wgarcia@siasa.gt`, `wguerrero@siasa.gt` |

Verificación:

| Prueba | Resultado |
|---|---|
| Conexión del contenedor a `smtp.office365.com:587` | `220 ... Microsoft ESMTP MAIL Service ready` |
| Lectura de la clave por `dotenv` | 20 caracteres, idéntica a la entregada (comparada por MD5, sin mostrarla) |
| Arranque | `MONITOREO_INICIADO` con `correo: activo` y `base_de_eventos: postgres/siasa_eventos` |
| Correo de prueba (HES107 / ION7400-1) | **Aceptado por Microsoft 365** el 15/10 22:58:44 UTC, id `<9f68a42d-41db-81f2-eaed-27a0f9d2f227@siasa.gt>` |
| `GET /monitoreo` | 200; muestra estado `OK`, 13/13 medidores en línea, 0 reconexiones, correo activo |

Evidencia: [`correo-y-panel/`](evidencia-escuintla-2026-10/correo-y-panel/) (captura del correo, HTML del correo y captura del panel).

---

### 3.14 `online: false` para medidores sin comunicación — 19/10 16:02

**Problema:** el ION7400-2 (HES108) estaba desconectado (WorkStation lo mostraba `[Offline]` con 51.92 kW), pero la API lo entregaba con `online: "true"` y el correo `MEDIDOR_SIN_CAMBIO` decía "EN LÍNEA". El EBO retiene el último valor del medidor y lo sigue sirviendo por Modbus: la lectura responde, por eso la API lo daba por en línea.

Respaldo previo: `~/respaldos/2026-10-19-online-congelado/antes/` (`index.js`, `eventos_modbus.js`, `.env`, `SHA256SUMS`).

| Archivo | Cambio |
|---|---|
| `api/monitoreo/eventos_modbus.js` | Si las métricas de un medidor no cambian en `ALERTA_OFFLINE_SIN_CAMBIO_MIN` (5 min), se marca `status: offline`, `online: false` y `error` con la hora del último dato, y **todas sus métricas en 0** (no se entrega el último valor retenido por el EBO). Abre `MEDIDOR_FUERA_DE_LINEA` con inicio en el último cambio (el correo dice "FUERA DE LÍNEA"). No aplica con voltajes en cero (eso es `MEDIDOR_EN_CERO`). Vuelve a `online: true` en cuanto cambian los valores |
| `api/monitoreo/eventos_modbus.js` | Al arrancar, cierra en la base los eventos que dejó abiertos el proceso anterior (`cerrado_por: reinicio de la API`) |
| `api/index.js` | `/api/ebo/modbus-auto` ya no quita de la respuesta los medidores fuera de línea: los entrega con `online: "false"` |
| `api/.env` | `ALERTA_OFFLINE_SIN_CAMBIO_MIN=15` (0 desactiva la regla). Primero se puso en 5 min. A las 16:07 también marcó el ION7400-1; por precaución se subió a 15 min a las 16:09 UTC. El muestreo de 16:09 a 16:29 UTC (cada 5 s) mostró que los otros 11 medidores cambian cada 15-20 s como máximo, y que el ION7400-1 **no cambió en todo el período**, igual que el ION7400-2: probablemente también está sin comunicación (falta confirmarlo en WorkStation). Con esos datos, el umbral se podría bajar a 3-5 min |

MD5 desplegados (16:10 UTC): `c4e8d15b4c481f070662e9b3f7b2f948 index.js`, `449c70fbf4158de7e7418244d2139e42 monitoreo/eventos_modbus.js`.

Revertir: copiar los archivos del respaldo a `api/` y `docker restart node-api`.

### 3.15 Resumen diario: sin correo, consulta bajo demanda — 19/10 17:41 UTC

Respaldo previo: `~/respaldos/2026-10-19-resumen/antes/`.

| Archivo | Cambio |
|---|---|
| `api/monitoreo/eventos_modbus.js` | El resumen se arma en `armarResumen()`. A las 07:00 solo se envía si `ALERTA_RESUMEN_DIARIO_CORREO=true` (la limpieza diaria de eventos antiguos sigue igual) |
| `api/index.js` | Nueva ruta `GET /api/ebo/modbus-auto/resumen` (HTML, igual al correo) y `?formato=texto` (texto plano) |
| `api/.env` | `ALERTA_RESUMEN_DIARIO_CORREO=false` |

MD5: `2ed60886c5af90f85a9a23e74421853f index.js`, `1c8a132bb30ef13673c4f5728ec79fdb monitoreo/eventos_modbus.js`.

Consulta: `http://10.0.6.33:3001/api/ebo/modbus-auto/resumen?api_key=<MODBUS_AUTO_API_KEY>` (o con el header `x-api-key`). Sin clave responde 401.

### 3.16 Correo de medidor fuera de línea / en línea de nuevo — 19/10 18:13 UTC

Respaldo previo: `~/respaldos/2026-10-19-correo-colores/antes/`.

| Correo | Cómo se ve |
|---|---|
| Al desconectarse | Encabezado rojo `CRÍTICO` "Medidor fuera de línea", pastilla roja `FUERA DE LÍNEA`, aviso "Medidor sin comunicación" y **métricas en 0 en rojo** |
| Al volver | Encabezado verde `RESUELTO` "**Medidor en línea de nuevo**" (también en el asunto), pastilla verde `EN LÍNEA` y lectura real |

Archivos: `monitoreo/plantilla_correo.js` (colores y textos) y `monitoreo/eventos_modbus.js` (`tituloCierre` del asunto). MD5: `6de047dcbd95b335e01aed552ae26d79 eventos_modbus.js`, `4f9b77b0dc4c58221261474cd59a70cd plantilla_correo.js`.

**18:26 UTC:** `ALERTA_OFFLINE_SIN_CAMBIO_MIN` bajó de 15 a **5 min** (también el valor por defecto en el código; MD5 `8534979999caa3c6cb05b0b528d965e4 eventos_modbus.js`). Motivo: los medidores en línea cambian cada 15-20 s, y el aviso del ION7400-1 a los 5 min (16:07 UTC) resultó correcto: estuvo sin comunicación hasta las 17:29 UTC.

Verificado en el servidor antes del cambio: el ION7400-1 volvió a las 11:29:24 (hora de Guatemala) y llegó el correo verde con 149.1 kW.

### 3.17 Un solo correo por desconexión y uno por reconexión — 19/10 18:41 UTC

Respaldo previo: `~/respaldos/2026-10-19-restaurar-eventos/antes/` (`eventos_modbus.js`, `.env`).

| Antes | Ahora |
|---|---|
| Al reiniciar la API se cerraban los eventos abiertos y, si el medidor seguía desconectado, a los 5 min llegaba **otro correo rojo** | Al arrancar se recuperan de la base los eventos de medidores ya notificados: el medidor sigue `online: "false"` desde el primer momento, con el **mismo código de evento** y **sin correo nuevo** |
| Mientras seguía desconectado, recordatorio cada 4 h | `ALERTA_RECORDATORIO_HORAS=0`: sin recordatorios (antes, 0 habría enviado correos sin parar; se corrigió en el código) |
| — | Si el medidor volvió mientras la API estaba reiniciándose, sale **un solo** correo verde "Medidor en línea de nuevo" |

Detalles: los eventos que no son de medidores (por ejemplo `DATOS_CONGELADOS`) se siguen cerrando al arrancar, porque se vuelven a evaluar solos. La API espera hasta 60 s (`ALERTA_ESPERA_RESTAURACION_S`) a la base de eventos antes de evaluar los medidores; si la base no responde, sigue como antes.

MD5: `efe3114efbf9120b2203d2be2c520278 monitoreo/eventos_modbus.js`.

Verificado 18:41 UTC: log `EVENTOS_RESTAURADOS {"restaurados":1,"medidores":["ION7400-2"]}`; el ION7400-2 siguió `online: "false"` con el evento `ESC-20261019-182636-cb9f` y no salió ningún correo.

### 3.18 Medidores de generador y "sin cambio" con 0 V — 20/10 04:51 a 04:59 UTC (todas las sedes)

Motivo: en Retalhuleu el PM2130-3 (HDR052) **solo mide cuando el generador está encendido**; con el generador apagado tiene 0 V y salieron dos correos críticos que no eran fallas ("voltaje en cero" y "sin cambio").

| Cambio | Detalle |
|---|---|
| Medidor de generador (`MEDIDORES_GENERADOR`, inventario/nombre/id separados por coma) | Con 0 V queda **"en espera (generador apagado)"**: sin alarma de voltaje en cero ni de sin cambio. Cuando aparece voltaje 60 s seguidos (`ALERTA_GENERADOR_CONFIRMACION_S`) se abre `GENERADOR_EN_MARCHA` y sale un correo **informativo** (azul) "Generador en marcha"; cuando vuelve a 0 V 60 s seguidos, correo "Generador apagado" con la duración. `ALERTA_GENERADOR_CORREO=false` los apaga. Si se desconecta con el generador en marcha (valores congelados), es fuera de línea como cualquier medidor |
| `MEDIDOR_SIN_CAMBIO` con 0 V | Ya no se abre (con 0 V las métricas no cambian por definición; lo cubre `MEDIDOR_EN_CERO`). Si estaba abierto, se cierra sin correo |
| `/estado` y `/resumen` | Estados `en_espera_generador_apagado` y `generador_en_marcha`; el resumen indica "mide solo con el generador encendido" |
| Correo | Etiqueta del dispositivo "EN ESPERA · GENERADOR APAGADO" o "GENERADOR EN MARCHA" |

Configurado solo en Retalhuleu: `MEDIDORES_GENERADOR=HDR052`. Al reiniciar, las dos alarmas abiertas del HDR052 se cerraron **sin correo** (`reclasificado: medidor de generador`).

Desplegado en las 10 sedes (respaldo `~/respaldos/2026-10-20-generador/antes/`), reinicio de `node-api` en cada una, **0 correos** por el despliegue. MD5: `27d8fc9f2fcc6c4245e505cd4c202818 eventos_modbus.js`, `3edc85fd439162c77a30e1db22b6bf3e plantilla_correo.js`. Probado antes en local: pico de una lectura (no avisa), arranque, apagado, reinicio con alarmas viejas abiertas y medidor normal en 0 V.

---

## 4. Cómo usar lo nuevo

**Panel de eventos:** `http://10.0.6.33:3001/monitoreo`. Pide la API key de `/api/ebo/modbus-auto` la primera vez y la recuerda en el navegador. Muestra:
- el estado de la lectura, los eventos abiertos y los 13 medidores;
- los eventos por día y el historial con filtros;
- el detalle de cada evento al hacer clic;
- los botones para la vista previa del correo y el correo de prueba.

Se actualiza cada 15 s.

Todas las rutas van en el puerto 3001, con el header `x-api-key`:

```bash
K=$(grep ^MODBUS_AUTO_API_KEY= ~/node-postgres-docker/api/.env | cut -d= -f2-)

# Estado en vivo (general y por medidor)
curl -s -H "x-api-key: $K" http://10.0.6.33:3001/api/ebo/modbus-auto/estado

# Historial de eventos
curl -s -H "x-api-key: $K" "http://10.0.6.33:3001/api/ebo/modbus-auto/eventos?desde=2026-10-15&abiertos=true"

# Eventos en el log
docker logs --since 24h node-api 2>&1 | grep "MODBUS-EVENTO"
```

**Eventos que se detectan:**

| Evento | Severidad | Cuándo |
|---|---|---|
| `DATOS_CONGELADOS` | Crítico | Sin lectura buena por 5 min. Incluye la causa probable según el error |
| `LECTURA_ATASCADA` | Advertencia | Lectura en curso más de 60 s. El vigilante reconecta |
| `VIGILANTE_REINICIO` | Crítico | Lectura atascada 10 min: la API se reinicia sola |
| `RECONEXIONES_FRECUENTES` | Advertencia | Más de 10 reconexiones en una hora |
| `MEDIDOR_SIN_CAMBIO` | Crítico | Métricas de un medidor idénticas 15 min |
| `MEDIDOR_FUERA_DE_LINEA` | Crítico | El medidor no responde 3 min, o sus valores no cambian en 15 min (el EBO repite el último valor). La API lo entrega con `online: "false"` |
| `MEDIDOR_EN_CERO` | Crítico | Voltajes de todas las fases en 0 V por 3 min |
| `API_REINICIADA` | Informativo | La API arrancó |

---

## 5. Cómo revertir

```bash
cd ~/node-postgres-docker
R=~/respaldos/2026-10-14-incidente/antes

# Código y variables
cp $R/index.js api/index.js
cp $R/modbus_rtu.js api/modbus_cliente/modbus_rtu.js
cp $R/.env api/.env
rm -rf api/monitoreo

# Compose (sin rotación de log, Postgres como antes)
cp $R/docker-compose.yml docker-compose.yml
docker-compose rm -sf api && docker-compose up -d --no-deps api
docker-compose stop postgres     # Postgres estaba detenido antes
```

**No se recomienda revertir `modbus_rtu.js`:** el código original es el que se atasca.

---

## 6. Pendientes

| # | Pendiente | Responsable | Cómo |
|---|---|---|---|
| 1 | ~~Activar el correo~~ | — | **Hecho el 15/10** (sección 3.13) |
| 2 | ~~Confirmar la salida al puerto 587~~ | — | **Hecho**: el contenedor llega a `smtp.office365.com:587` |
| 2b | Integrar el panel de eventos en el dashboard principal | Soporte SIASA | El código del dashboard no está en este repositorio. Mientras tanto, el panel está en `http://10.0.6.33:3001/monitoreo` |
| 3 | El dashboard debe usar `lectura.scanned_at` y `lectura.stale` | Equipo del dashboard | Cuando esté listo, poner `ALERTA_RESPONDER_503=true` para no entregar datos viejos |
| 4 | **Puente WISE de cadena de frío** (alias `aiNraw`): sigue sin corregir | Soporte SIASA | Ver el informe de incidente, sección 9. Coordinar antes, porque cambia las temperaturas que lee el EBO |
| 5 | Error del lector v2 en el registro 5620 (`Data length error, expected 207 got 209`) | Soporte SIASA | Solo si se vuelve a usar v2 |
| 6 | Cambiar claves por defecto: Postgres `admin/admin123`, `JWT_SECRET=supersecret` | Soporte SIASA | Ya no están expuestas a la red, pero siguen siendo débiles |
| 7 | 62 reinicios de `node-api` desde abril | Soporte SIASA | Revisar en `node-api_historial-completo_sin-puente.json.gz` si fueron manuales y por qué |
| 8 | Aplicar las correcciones en las demás sedes | Soporte SIASA | Usan los mismos archivos; validar cada copia antes |

# Bitácora de cambios: corrección del congelamiento de métricas en IGSS Villa Nueva

| | |
|---|---|
| **Servidor** | 10.0.3.33 (usuario `api`), carpeta `~/node-postgres-docker` |
| **EBO** | EBO-ASP-VILLA NUEVA, 10.0.3.26:502 |
| **Medidores** | 7: 6 PM2130 (CIV051 a CIV056) y 1 ION7400 (CIV050) |
| **Incidente reportado** | 07/09/2026 12:00 al 21/09/2026 12:00 (hora de Guatemala) |
| **Fecha de ejecución** | 17/10/2026, 02:18 a 04:49 UTC (16/10/2026, 20:18 a 22:49 hora de Guatemala) |
| **Ejecutado por** | Claude Code, con autorización de soporte SIASA |
| **Respaldo en el servidor** | `~/respaldos/2026-10-17-villanueva/` |
| **Evidencia** | [`evidencia-villanueva-2026-10/`](evidencia-villanueva-2026-10/) |
| **Referencia** | Misma corrección que en Escuintla: [bitácora de Escuintla](2026-10-escuintla-bitacora-cambios.md) |

Todas las horas están en **UTC**. Hora de Guatemala = UTC − 6.

---

## 1. Resumen

| # | Qué se hizo | Resultado |
|---|---|---|
| 1 | Se confirmó la causa con el log del servidor | **Misma causa que Escuintla**: el 07/09 17:09 UTC el EBO cerró la conexión y la lectura quedó atascada hasta el reinicio manual del 21/09 22:16 UTC |
| 2 | Se corrigió el atasco en `modbus_rtu.js` | Probado con el código de Villa Nueva: el original se bloquea; el corregido se recupera en 5 s |
| 3 | Se apagó el lector v2 (no se usa) | Menos carga y menos reconexiones hacia el EBO |
| 4 | Rotación del log | El log ya no puede crecer más de 500 MB |
| 5 | Postgres restringido a `127.0.0.1` y encendido | Ya no está expuesto a la red; **no se reactivó la inserción de métricas** |
| 6 | Base y usuario propios para los eventos (`siasa_eventos`) | El usuario no puede entrar a `mi_basedatos` |
| 7 | Módulo de monitoreo, correo y panel | Correo de prueba aceptado por Microsoft 365; panel en `http://10.0.3.33:3001/monitoreo` |

---

## 2. Causa confirmada

Evidencia: [`log_06sep-22sep_sin_wise.txt`](evidencia-villanueva-2026-10/log_06sep-22sep_sin_wise.txt) (todas las líneas del período, sin las del módulo WISE).

| Hora (UTC) | Hora (Guatemala) | Evento |
|---|---|---|
| **07/09 17:09:30** | **07/09 11:09** | `Error actualizando V2: Port Not Open` (2 veces): el EBO cerró la conexión |
| 07/09 17:09 – 21/09 22:16 | 14 días y 5 h | **Ninguna línea de Modbus** en el log: la lectura quedó atascada y la API entregó la última lectura buena |
| **21/09 22:16:01** | **21/09 16:16** | `Cerrando servicio...`: **reinicio manual** de `node-api`. Se reconecta al EBO de inmediato |

Es el mismo mecanismo de Escuintla: al cerrar la conexión, `resetModbus()` esperaba una confirmación de la librería `modbus-serial` que nunca llegaba porque el socket ya estaba cerrado, y la cola de lecturas quedaba bloqueada para siempre sin escribir nada en el log.

**Reproducción con el código de Villa Nueva** ([`pruebas/`](evidencia-villanueva-2026-10/pruebas/)):

| Código | Resultado |
|---|---|
| Original (respaldo del servidor) | `RESULTADO: BLOQUEADO (sin respuesta tras 30.003s, conexiones=1)` |
| Corregido | `RESULTADO: RECUPERADO (conexiones=2, 5.048s)` |

**Riesgo vigente antes de la corrección:** el 07/10/2026 02:21 UTC hubo otra reconexión al EBO que pasó por el mismo código. Esa vez se recuperó, pero pudo haber vuelto a congelarse.

---

## 3. Acciones, en orden

### 3.1 Inspección (solo lectura) — 17/10 02:18

- **Huella SSH:** el servidor 10.0.3.33 tiene **la misma huella y el mismo machine-id que el de Escuintla (10.0.6.33)**. Se verificó que son máquinas distintas (IP, contenedores y estado diferentes): fueron **clonadas de la misma imagen**. Ver pendientes.
- `node-api` iniciado el 21/09/2026 22:16 UTC, 0 reinicios automáticos.
- Log de 6.7 MB, completo desde el 21/04/2026 (el período del incidente estaba disponible). Disco al 31 %.
- `MODBUS_AUTO_ACTIVE_VERSION=1`, lector v2 leyendo cada 30 s, `MQTT_ENABLED=false`.
- Postgres apagado desde el 28/04/2026, con el puerto 5432 expuesto a toda la red.
- Código desplegado **idéntico** a la copia local `api-SIASA-VillaNueva` (MD5 de `index.js`, `lectura_Ebo.js`, `lectura_Ebo_v2.js` y `modbus_rtu.js`). Distinto al de Escuintla.
- La sede no usa el puente MQTT → BACnet.

### 3.2 Respaldo y evidencia — 17/10 04:32

```
~/respaldos/2026-10-17-villanueva/
  antes/   docker-compose.yml  .env  index.js  modbus_rtu.js  package.json
           inspect-node-api.json  inspect-postgres-db.json  estado-servidor.txt
           respuesta-modbus-auto.json  SHA256SUMS
  logs/    node-api_log-completo_2026-04-21_a_2026-10-17.json.gz   (425 KB, todo el log)
           node-api_sin-wise.json.gz                                (sin líneas WISE)
           SHA256SUMS
```

Verificado con `gzip -t`; contiene las 2 líneas `Port Not Open` del 07/09.

### 3.3 Código (en la copia local `api-SIASA-VillaNueva`, luego desplegado)

| Archivo | Cambio |
|---|---|
| `modbus_cliente/modbus_rtu.js` | Igual a la corrección de Escuintla (cierre con límite de 3 s y destrucción del socket, registro de reconexiones). IP del EBO por defecto: 10.0.3.26 |
| `monitoreo/eventos_modbus.js`, `plantilla_correo.js`, `panel.html`, `package.json` | Nuevos: el mismo módulo de Escuintla |
| `index.js` | Mismos cambios que en Escuintla, aplicados sobre el código propio de Villa Nueva: monitor conectado a la lectura, campo `lectura` en la respuesta, rutas `/estado`, `/eventos`, `/alertas/prueba`, `/alertas/vista-previa` y `/monitoreo`, y doble candado de MQTT |

MD5 desplegados (iguales en local y servidor):
```
4aff3541726b84bbc7724f6266ff78e2  index.js
76a185a074fc4325aecc516c2d854ce1  modbus_cliente/modbus_rtu.js
045174bc6f49f85d0a1ab8f141bdf130  monitoreo/eventos_modbus.js
```

### 3.4 `docker-compose.yml` — 17/10 ~04:40

```diff
+x-logging: &logging
+  driver: json-file
+  options:
+    max-size: "50m"
+    max-file: "10"
   postgres:
     ports:
-      - "5432:5432"
+      - "127.0.0.1:5432:5432"
+    logging: *logging
   api:
+    logging: *logging
```

### 3.5 Postgres — 17/10 04:41:00

- `5432/tcp -> 127.0.0.1:5432`.
- Durante 75 s: **ninguna inserción** y **ninguna conexión**. `sensores_mqtt`: 1 609 039 filas, la última del 10/04/2026; no crece.
- Se creó la base `siasa_eventos` con su usuario propio (clave aleatoria de 32 caracteres en `~/respaldos/2026-10-17-villanueva/.clave_siasa_eventos`, permiso 600). Prueba: a `mi_basedatos` recibe `permission denied`.

### 3.6 Configuración — `api/.env`

- `MODBUS_AUTO_V2_POLL_MS=30000` comentado y reemplazado por `MODBUS_AUTO_V2_POLL_MS=0`.
- Bloques `# 2026-10-17 monitoreo de eventos y alertas` y `# 2026-10-17 correo de alertas (Microsoft 365)`: sede **Villa Nueva**, prefijo **VNU**, misma cuenta y destinatarios que Escuintla.
- `nodemailer` 6.10.1 instalado en `api/monitoreo/node_modules`.
- Verificado con `dotenv`: clave del correo de 20 caracteres e idéntica a la entregada; `MODBUS_AUTO_V2_POLL_MS=0`; versión activa 1.

### 3.7 Recreación de `node-api` — 17/10 04:46:30 a 04:46:31

- Configuración del log: `max-size: 50m`, `max-file: 10`.
- Al arrancar: `MONITOREO_INICIADO` con `correo: activo` y `base_de_eventos: postgres/siasa_eventos`.

### 3.8 Verificación — 17/10 04:48

| Prueba | Resultado |
|---|---|
| `GET /api/ebo/modbus-auto/estado` | `estado: ok`, antigüedad 5 s, 0 reconexiones, 7 medidores en línea |
| `GET /api/ebo/modbus-auto/eventos` | Lee de la base: `API_REINICIADA` registrado |
| `GET /api/ebo/modbus-auto` | Los mismos 7 medidores; valores cambiando (51.22 → 56.14 kW); campo `lectura` presente |
| Correo de prueba (CIV050 · ION7400-1) | **Aceptado por Microsoft 365** para los 3 destinatarios, id `<ed5ef01a-b7ba-06d4-7a60-c355f6c00df4@siasa.gt>` |
| `GET /monitoreo` | 200; estado `OK`, 7/7 medidores, correo activo |
| Resumen diario | Programado a las 07:00; **primer envío: 17/10/2026 07:00** (hora de Guatemala) |

### 3.9 Mejoras del 19/10/2026 (mismo modelo que Escuintla) — 19/10 19:16 a 19:22 UTC

Escuintla es el modelo para todas las sedes: se aplicaron aquí las mejoras de la [bitácora de Escuintla](2026-10-escuintla-bitacora-cambios.md), secciones 3.14 a 3.17.

Respaldo previo: `~/respaldos/2026-10-19-mejoras/antes/` (`index.js`, `eventos_modbus.js`, `plantilla_correo.js`, `.env`, `SHA256SUMS`).

| Mejora | Detalle |
|---|---|
| Medidor sin comunicación → `online: "false"` | Si sus métricas no cambian en 5 min (el EBO repite el último valor), la API lo entrega con `online: "false"`, **métricas en 0** y `error` con la hora del último dato. Antes se quitaba de la respuesta |
| Correos | Rojo al desconectarse (métricas en 0 en rojo); verde "Medidor en línea de nuevo" al volver |
| Un solo correo por evento | Al reiniciar la API se recuperan los eventos abiertos de la base: no se repite el correo. Sin recordatorios cada 4 h |
| Resumen diario | Ya **no se envía por correo**. Se consulta en `http://10.0.3.33:3001/api/ebo/modbus-auto/resumen?api_key=<MODBUS_AUTO_API_KEY>` (`&formato=texto` para texto plano) |

Archivos (copia local `api-SIASA-VillaNueva` y servidor):

| Archivo | Cambio | MD5 |
|---|---|---|
| `index.js` | Medidores fuera de línea en la respuesta; ruta `/api/ebo/modbus-auto/resumen` | `6785c0fe7011c418235a79eb50a82c12` |
| `monitoreo/eventos_modbus.js` | Igual al de Escuintla | `efe3114efbf9120b2203d2be2c520278` |
| `monitoreo/plantilla_correo.js` | Igual al de Escuintla | `4f9b77b0dc4c58221261474cd59a70cd` |
| `.env` | `ALERTA_OFFLINE_SIN_CAMBIO_MIN=5`, `ALERTA_RECORDATORIO_HORAS=0`, `ALERTA_RESUMEN_DIARIO_CORREO=false` | — |

Reinicio de `node-api`: 19/10 19:20:46 UTC. Verificación (19:22 UTC): arranque sin errores, base de eventos lista, los 7 medidores `online: "true"` con valores reales, `/resumen` responde 200 (401 sin clave), **0 correos** enviados por el reinicio. No se enviaron correos de prueba.

Revertir: copiar los archivos de `~/respaldos/2026-10-19-mejoras/antes/` a `api/` (y `monitoreo/`) y `docker restart node-api`.

---

## 4. Cómo revertir

```bash
cd ~/node-postgres-docker
R=~/respaldos/2026-10-17-villanueva/antes
cp $R/index.js api/index.js
cp $R/modbus_rtu.js api/modbus_cliente/modbus_rtu.js
cp $R/.env api/.env
rm -rf api/monitoreo
cp $R/docker-compose.yml docker-compose.yml
docker-compose rm -sf api && docker-compose up -d --no-deps api
docker-compose stop postgres
```

**No se recomienda revertir `modbus_rtu.js`:** el código original es el que se bloquea.

---

## 5. Pendientes

| # | Pendiente | Motivo |
|---|---|---|
| 1 | Confirmar la recepción del correo de prueba y del primer resumen diario (17/10 07:00) | Microsoft 365 aceptó el envío; la entrega en los buzones la confirman los destinatarios |
| 2 | **Regenerar las llaves SSH del servidor** (`ssh-keygen -A` con respaldo) y el machine-id | Villa Nueva y Escuintla comparten llaves y machine-id porque se clonaron: una llave robada de un servidor sirve para suplantar al otro |
| 3 | Cambiar la clave del buzón `alarmas.atlas@siasa.gt` en todas las sedes | Se compartió por un canal no seguro |
| 4 | Cambiar las credenciales por defecto de Postgres (`admin/admin123`) y `JWT_SECRET` | Ya no están expuestas a la red, pero son débiles |
| 5 | El módulo WISE de la sede falla de forma continua (`connect EHOSTUNREACH` a 10.0.33.44: 47 363 líneas en el log) | No afecta a los medidores, pero indica que ese equipo no es alcanzable |
| 6 | Aplicar la misma corrección en las demás sedes | Usan los mismos archivos de lectura |

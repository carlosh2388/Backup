# Bitácora de cambios: modelo Escuintla en IGSS Gineco, Amatitlán y Palín

| | |
|---|---|
| **Fecha de ejecución** | 19/10/2026, 19:39 a 22:46 UTC (13:39 a 16:46 hora de Guatemala) |
| **Ejecutado por** | Claude Code, con autorización de soporte SIASA |
| **Modelo aplicado** | [Bitácora de Escuintla](2026-10-escuintla-bitacora-cambios.md) (secciones 3.4 a 3.17) y [Villa Nueva](2026-10-villanueva-bitacora-cambios.md) |
| **Correos de prueba** | Ninguno (a pedido de soporte SIASA: solo correos de eventos reales) |

Todas las horas están en **UTC**. Hora de Guatemala = UTC − 6.

## 1. Sedes

| Sede | Servidor | EBO | Medidores | Prefijo de eventos | Respaldo en el servidor |
|---|---|---|---|---|---|
| Gineco | 10.0.2.33 | EBO-ASP-GINECO 10.0.2.26:502 | 8: 6 PM2130 (HGO109 a HGO114) y 2 ION7400 (HGO107, HGO108) | `GIN` | `~/respaldos/2026-10-19-gineco/` |
| Amatitlán | 10.0.4.33 | EBO-ASP-AMATITLAN 10.0.4.26:502 | 4: 3 PM2130 (UAA036 a UAA038) y 1 ION7400 (UAA035) | `AMA` | `~/respaldos/2026-10-19-amatitlan/` |
| Palín | 10.0.5.33 | EBO-ASP-PALIN 10.0.5.26:502 | 4: 3 PM2130 (CDP024 a CDP026) y 1 ION7400 (CDP023) | `PAL` | `~/respaldos/2026-10-19-palin/` |

Cada respaldo tiene `antes/` (`docker-compose.yml`, `.env`, `index.js`, `modbus_rtu.js`, `package.json`, `inspect-*.json`, respuesta de la API, `SHA256SUMS`), `logs/` (log completo del contenedor y versión sin BACnet/WISE, verificados con `gzip -t`) y `.clave_siasa_eventos` (permiso 600).

## 2. Estado encontrado (inspección de solo lectura, 19:39)

| | Gineco | Amatitlán | Palín |
|---|---|---|---|
| Monitor de eventos y correo | No | No | No |
| Corrección del atasco (`modbus_rtu.js`) | No | No | No |
| Postgres | Apagado; puerto 5432 abierto a la red (`admin/admin123`) | Igual | Igual |
| Rotación del log | No | No | No |
| `index.js` | Original de Villa Nueva + puente MQTT→BACnet | Idéntico al original de Villa Nueva | Idéntico al original de Villa Nueva |
| Log | ~79 000 líneas/hora: **~570 reconexiones/hora** al EBO y el puente BACnet registrando cada mensaje | Solo errores WISE | Solo errores WISE |
| Medidores | 8 en línea | 4 en línea | 4 en línea |

**Llaves SSH y machine-id:** los tres servidores tienen la misma huella (`SHA256:Bb69l1ntj0vdQOq2q3QLKW2mRuRn2i1BgWufCuTPhaY`) y el mismo machine-id que Escuintla y Villa Nueva: se clonaron de la misma imagen. Ver pendientes.

**Historial de congelamientos en los logs:** no se encontró un congelamiento largo como el de Escuintla o Villa Nueva. En Amatitlán hubo un corte de ~10 min el 16/04/2026 (03:11 `Port Not Open`, recuperado con el reinicio de las 03:20). Los logs de Gineco cubren desde el 08/05/2026; los de Amatitlán y Palín desde el 13/04/2026.

## 3. Cambios (iguales en las tres sedes)

| Archivo | Cambio |
|---|---|
| `api/modbus_cliente/modbus_rtu.js` | Corrección del atasco de Escuintla (cierre con límite de 3 s y destrucción del socket, registro de reconexiones). Solo cambia la IP del EBO por defecto |
| `api/index.js` | El de Villa Nueva corregido: monitor conectado a la lectura, medidores fuera de línea con `online: "false"`, rutas `/estado`, `/eventos`, `/resumen`, `/monitoreo`, doble candado de MQTT. **Gineco:** además conserva su puente MQTT→BACnet |
| `api/monitoreo/` | Igual a Escuintla: `eventos_modbus.js`, `plantilla_correo.js`, `panel.html`, `package.json`, `node_modules/nodemailer` (6.10.1) |
| `api/.env` | Lector v2 apagado (`MODBUS_AUTO_V2_POLL_MS=0`), bloque de monitoreo (sede, prefijo, base de eventos, umbrales: `ALERTA_OFFLINE_SIN_CAMBIO_MIN=5`, `ALERTA_RECORDATORIO_HORAS=0`, `ALERTA_RESUMEN_DIARIO_CORREO=false`) y bloque de correo (Microsoft 365, misma cuenta y destinatarios que Escuintla). **Gineco:** `MQTT_BACNET_LOG_MESSAGES=false` y `MQTT_BACNET_LOG_OBJECT_VALUES=false` |
| `docker-compose.yml` | Rotación del log (`max-size: 50m`, `max-file: 10`) y Postgres solo en `127.0.0.1:5432` |
| Postgres | Recreado (datos intactos en el volumen); base `siasa_eventos` con usuario propio; `mi_basedatos` solo para `admin` (probado: `siasa_eventos` recibe `permission denied`) |
| `node-api` | Recreado con `docker-compose rm -sf api && docker-compose up -d --no-deps api` (en Gineco eliminó el contenedor huérfano `e4882498b98f_node-api` de una recreación fallida anterior) |

MD5 desplegados:

| Archivo | Gineco | Amatitlán | Palín |
|---|---|---|---|
| `index.js` | `f8a07f6deea16d0fa6a5c7a8596822cd` | `6785c0fe7011c418235a79eb50a82c12` | `6785c0fe7011c418235a79eb50a82c12` |
| `modbus_cliente/modbus_rtu.js` | `eb667afa5d49b8173c7a0d46a7a176b9` | `f042ceae27dba32c5d346bd06fe9bf6c` | `f54b7b1de369f54418fece101165f767` |
| `modbus_cliente/lectura_Ebo.js` | `cba47545aaa2f996d0724577cd7181c0` (ver 4) | sin cambio | sin cambio |
| `monitoreo/eventos_modbus.js` | `efe3114efbf9120b2203d2be2c520278` | igual | igual |
| `monitoreo/plantilla_correo.js` | `4f9b77b0dc4c58221261474cd59a70cd` | igual | igual |

## 4. Gineco: reconexiones constantes al EBO (corregido)

Al activar el monitor apareció `RECONEXIONES_FRECUENTES` (572/hora) y salió **un correo de advertencia** (22:11:52, "[ADVERTENCIA] SIASA Gineco - 1 advertencia(s)"). El problema ya existía antes (4 800 conexiones Modbus por hora en el log), pero no se registraba.

**Causa (sonda de solo lectura al EBO):** las direcciones Modbus 254-255 (registros 255-256 = **ION7400-1 Active Power A**) no existen en el EBO de Gineco (`exception 4` / `exception 2`). El lector pedía el bloque desde la 254, el bloque entero fallaba y la lectura registro por registro recibía `Data length error, expected 7 got 9` en cada registro, y cada uno forzaba una reconexión (~8 por ciclo de 5 s).

**Corrección:** `lectura_Ebo.js` acepta `MODBUS_AUTO_SKIP_REGISTERS` (lista de registros a no leer); en Gineco `MODBUS_AUTO_SKIP_REGISTERS=255,256`. El bloque ahora empieza en la dirección 256 y se lee de una vez. Reinicio: 22:17:33.

| | Antes | Después |
|---|---|---|
| Reconexiones | ~570/hora | **0** |
| Líneas de log | ~79 000/hora | ~200/hora |
| ION7400-1 Active Power A | 0 (el EBO no lo publica) | 0 (igual) |

**Pendiente en el EBO:** publicar el punto Active Power A del ION7400-1 (HGO107) en el servidor Modbus de la AS-P de Gineco, si se necesita ese valor.

## 5. Verificación final (22:46, más de 5 min después del último reinicio)

| | Gineco | Amatitlán | Palín |
|---|---|---|---|
| Estado | `ok` | `ok` | `ok` |
| Medidores | 8/8 en línea, todos cambiando | 4/4 | 4/4 |
| Medidores congelados | Ninguno | Ninguno | Ninguno |
| Reconexiones desde el arranque | 0 | 0 | 0 |
| Correo | activo (`smtp.office365.com:587` alcanzable) | activo | activo |
| Base de eventos | ok | ok | ok |
| `/resumen` (con clave / sin clave), `/monitoreo` | 200 / 401, 200 | 200 / 401, 200 | 200 / 401, 200 |
| Escrituras nuevas en `mi_basedatos` | 0 | 0 | 0 |
| Correos por el despliegue | 0 (solo la advertencia del punto 4) | 0 | 0 |

Consultas (puerto 3001, `?api_key=<MODBUS_AUTO_API_KEY>` o header `x-api-key`):

| Sede | Resumen | Panel |
|---|---|---|
| Gineco | `http://10.0.2.33:3001/api/ebo/modbus-auto/resumen` | `http://10.0.2.33:3001/monitoreo` |
| Amatitlán | `http://10.0.4.33:3001/api/ebo/modbus-auto/resumen` | `http://10.0.4.33:3001/monitoreo` |
| Palín | `http://10.0.5.33:3001/api/ebo/modbus-auto/resumen` | `http://10.0.5.33:3001/monitoreo` |

## 6. Copias locales

Se actualizaron con el código del servidor `api-SIASA-Gineco`, `api-SIASA-Amatitlan` y `api-SIASA-Palin`. **Incidente:** esas carpetas ya existían y no se revisaron antes de copiar: se sobrescribieron sus archivos de código (`index.js`, `modbus_cliente/`, `bacnet/`, `auth/`, `db/`, `public/`, `wise_cliente/`, `Dockerfile`, `package*.json`, `docker-compose.yml`) y el `.env`. Los documentos, `data/` y `node_modules/` no se tocaron.

- Recuperados desde el historial de VS Code: `.env` de Gineco (01/10/2026) y de Palín (28/08/2026), y `bacnet/mqtt_to_bacnet_bridge.js` de Gineco (06/10/2026). La versión del servidor quedó al lado como `*.servidor-2026-10-19`.
- El resto de los archivos de código locales anteriores **no se pudo recuperar** desde aquí. Las versiones que corrían en los servidores antes del cambio están en `~/respaldos/2026-10-19-<sede>/antes/`.

## 7. Cómo revertir (por sede)

```bash
cd ~/node-postgres-docker
R=~/respaldos/2026-10-19-<sede>/antes
cp $R/index.js api/index.js
cp $R/modbus_rtu.js api/modbus_cliente/modbus_rtu.js
cp $R/lectura_Ebo.js api/modbus_cliente/lectura_Ebo.js   # solo Gineco
cp $R/.env api/.env
rm -rf api/monitoreo
cp $R/docker-compose.yml docker-compose.yml
docker-compose rm -sf api && docker-compose up -d --no-deps api
docker-compose stop postgres
```

**No se recomienda revertir `modbus_rtu.js`:** el código original es el que se atasca.

## 8. Pendientes

| # | Pendiente | Motivo |
|---|---|---|
| 1 | Regenerar llaves SSH y machine-id de los servidores | Comparten llaves con Escuintla y Villa Nueva (clonados) |
| 2 | Cambiar la clave del buzón `alarmas.atlas@siasa.gt` y las credenciales por defecto de Postgres y `JWT_SECRET` | Igual que en las demás sedes |
| 3 | Gineco: publicar en el EBO el Active Power A del ION7400-1 | Hoy siempre vale 0 |
| 4 | Módulo WISE de Amatitlán y Palín: `timeout of 10000ms exceeded` continuo | No afecta a los medidores |

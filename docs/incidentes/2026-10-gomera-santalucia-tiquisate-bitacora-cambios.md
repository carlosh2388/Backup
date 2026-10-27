# Bitácora de cambios: modelo Escuintla en IGSS La Gomera, Santa Lucía, Tiquisate, Mazatenango y Retalhuleu

| | |
|---|---|
| **Fecha de ejecución** | 19/10/2026 23:19 UTC a 20/10/2026 ~04:45 UTC (19/10/2026 17:19 a ~22:45 hora de Guatemala) |
| **Ejecutado por** | Claude Code, con autorización de soporte SIASA |
| **Modelo aplicado** | [Bitácora de Escuintla](2026-10-escuintla-bitacora-cambios.md) y el mismo procedimiento de [Gineco, Amatitlán y Palín](2026-10-gineco-amatitlan-palin-bitacora-cambios.md) |
| **Correos de prueba** | Ninguno |

Todas las horas están en **UTC**. Hora de Guatemala = UTC − 6.

## 1. Sedes

| Sede | Servidor | EBO | Medidores | Prefijo | Estado |
|---|---|---|---|---|---|
| La Gomera | 10.0.7.33 | EBO-ASP-LA GOMERA 10.0.7.26:502 | 4: 3 PM2130 (CGL023 a CGL025) y 1 ION7400 (CGL022) | `GOM` | Desplegado 20/10 04:10 (tras un corte de red, ver 4) |
| Santa Lucía | 10.0.8.33 | EBO-ASP-SANTA LUCIA 10.0.8.26:502 | 4: 3 PM2130 (HSL049 a HSL051) y 1 ION7400 (HSL048) | `SLU` | Desplegado 20/10 03:45 |
| Tiquisate | 10.0.9.33 | EBO-ASP-TIQUISATE 10.0.9.26:502 | 2: 1 PM2130 (HTI044) y 1 ION7400 (HTI043) | `TIQ` | Desplegado 20/10 03:54 |
| Retalhuleu | 10.0.11.33 | EBO-ASP-RETALHULEU 10.0.11.26:502 | 4: 3 PM2130 (HDR051 a HDR053) y 1 ION7400 (HDR050) | `RET` | Desplegado 20/10 04:17 (ver 5) |
| Mazatenango | 10.0.10.33 | EBO-ASP-MAZATENANGO 10.0.10.26:502 | 7: 6 PM2130 (HMA097 a HMA102) y 1 ION7400 (HMA096) | `MAZ` | Desplegado 20/10 04:19; reconexiones corregidas 04:37 (ver 6) |

Respaldo en cada servidor: `~/respaldos/2026-10-19-<sede>/` (`antes/`, `logs/` y `.clave_siasa_eventos`), igual que en las sedes anteriores.

## 2. Estado encontrado (inspección de solo lectura, 19/10 23:19)

Las tres sedes estaban igual que Amatitlán y Palín antes del cambio: `index.js` idéntico al original de Villa Nueva, sin monitor ni corrección del atasco, Postgres apagado con el puerto 5432 abierto a la red, sin rotación del log, lector v2 cada 30 s. Todos los medidores en línea. Logs tranquilos (solo errores del módulo WISE). Misma huella SSH y machine-id que las demás sedes (clonadas).

**Historial en los logs:** sin `Port Not Open` ni `Timed out` en Santa Lucía (desde 14/04/2026) ni en Tiquisate (desde 21/04/2026); solo reinicios puntuales. No hubo congelamientos largos.

## 3. Cambios

Idénticos a [Amatitlán y Palín](2026-10-gineco-amatitlan-palin-bitacora-cambios.md#3-cambios-iguales-en-las-tres-sedes): `modbus_rtu.js` corregido (solo cambia la IP del EBO), `index.js` de Villa Nueva corregido, `monitoreo/` de Escuintla, bloques de monitoreo y correo en `.env` (5 min sin datos → `online: "false"`, sin recordatorios, sin resumen por correo), lector v2 apagado, rotación del log, Postgres solo local con base `siasa_eventos`.

| Archivo | Santa Lucía | Tiquisate |
|---|---|---|
| `index.js` | `6785c0fe7011c418235a79eb50a82c12` | `6785c0fe7011c418235a79eb50a82c12` |
| `modbus_cliente/modbus_rtu.js` | `2a37f264100d7511618b215211e481ee` | `df5ef16af45a619a02fe656335b57d17` |
| `monitoreo/eventos_modbus.js` | `efe3114efbf9120b2203d2be2c520278` | igual |
| `monitoreo/plantilla_correo.js` | `4f9b77b0dc4c58221261474cd59a70cd` | igual |

Verificación al arrancar:

| | Santa Lucía | Tiquisate |
|---|---|---|
| Medidores | 4/4 en línea | 2/2 en línea |
| Reconexiones | 0 | 0 |
| Correo / base de eventos | activo / ok | activo / ok |
| `/resumen` con clave / sin clave, `/monitoreo` | 200 / 401, 200 | 200 / 401, 200 |
| Correos por el despliegue | 0 | 0 |

## 4. La Gomera: corte de red durante el despliegue

A las ~23:25 UTC, mientras se subía el paquete, el servidor 10.0.7.33 dejó de responder (`Connection timed out`): sin ping, sin SSH (22) y sin la API (3001). Volvió a las 04:07 UTC sin haberse reiniciado (179 días encendido), es decir, fue un **corte de red** de ~4 h 40 min. El código no se había modificado; se desplegó a las 04:10. Santa Lucía y Tiquisate también tuvieron cortes breves (la red hacia las sedes pasa por ZeroTier).

`MD5`: `index.js` `6785c0fe7011c418235a79eb50a82c12`, `modbus_rtu.js` `d51bad528f79f8e1af7e6aa341dbddad`. Historial: sin congelamientos (log desde 14/04/2026).

## 5. Retalhuleu

- `index.js` propio: el original de Villa Nueva con un cambio en el estado de transferencia del ION (si llegan las dos señales a la vez, toma "comercial"). Se conservó sobre el `index.js` corregido. `MD5` `b15876f3bdf2ce0f96c134b9ff573ae7`; `modbus_rtu.js` `86aaffb303d800881c5eeb0f34d1f20f`.
- **Postgres estaba encendido y abierto a la red** desde el 09/10/2026. Antes de recrearlo se comprobó que nadie lo usaba (0 conexiones, 0 escrituras en 30 s). Ahora solo escucha en `127.0.0.1`.
- **HDR052 (PM2130-3) con voltajes y corrientes en 0 y frecuencia fija en 40 Hz.** Abrió `MEDIDOR_EN_CERO` (correo 04:20) y `MEDIDOR_SIN_CAMBIO` (correo 04:32). Soporte SIASA confirmó que **ese medidor solo mide cuando el generador está encendido**: se configuró `MEDIDORES_GENERADOR=HDR052` (20/10 04:51) y ambas alarmas se cerraron sin correo. Ahora queda "en espera" con el generador apagado y avisa "Generador en marcha" / "Generador apagado". Detalle en la [bitácora de Escuintla, 3.18](2026-10-escuintla-bitacora-cambios.md).
- Historial: 166 `Port Not Open` el 15/04/2026 entre las 17:00 y 18:00 UTC.

## 6. Mazatenango: reconexiones constantes al EBO (corregido)

- `index.js` propio: el original de Villa Nueva con otra función de formato de métricas en la respuesta V2 (no se usa). Se conservó sobre el corregido. `MD5` `fd9309795abcf897de9c37f1972baaa3`; `modbus_rtu.js` `88493543a6febf13267cef7d12a3c244`.
- Antes del cambio: **~4 800 conexiones Modbus por hora**. Con el monitor: `RECONEXION ... dir 274: Data length error, expected 7 got 9` y advertencia `RECONEXIONES_FRECUENTES` (**salió un correo de advertencia** a las 04:34:50).
- **Causa (sonda de solo lectura):** la dirección 272 (registros 273-274 = **ION7400-1 Apparent Power Del C Peak Demand**) no existe en el EBO (`exception 4`); el bloque 272-289 fallaba entero. Mismo mecanismo que en [Gineco](2026-10-gineco-amatitlan-palin-bitacora-cambios.md#4-gineco-reconexiones-constantes-al-ebo-corregido).
- **Corrección:** `lectura_Ebo.js` con `MODBUS_AUTO_SKIP_REGISTERS` (`MD5` `aa0526fd665511654b3e0cac1147d9f0`) y en `.env` `MODBUS_AUTO_SKIP_REGISTERS=273,274`. Reinicio 04:37:47. Reconexiones: **0**. Ese valor queda en 0 (el EBO no lo publica).

## 7. Copias locales

Las carpetas locales `api-SIASA-Gomera`, `api-SIASA-SantaLucia`, `api-SIASA-Tiquisate`, `api-SIASA-Mazatenango` y `api-SIASA-Retalhuleu` **no se modificaron** (para no repetir lo ocurrido en Gineco, Amatitlán y Palín). Lo desplegado está en los servidores y su versión anterior en `~/respaldos/2026-10-19-<sede>/antes/` (en Mazatenango también `lectura_Ebo.js`).

## 8. Cómo revertir

Igual que en [Amatitlán y Palín](2026-10-gineco-amatitlan-palin-bitacora-cambios.md#7-cómo-revertir-por-sede), con `R=~/respaldos/2026-10-19-<sede>/antes` (en Mazatenango, copiar también `$R/lectura_Ebo.js`).

## 9. Pendientes

| # | Pendiente |
|---|---|
| 1 | ~~Retalhuleu: HDR052 en 0 V~~ Resuelto: es medidor de generador (`MEDIDORES_GENERADOR=HDR052`) |
| 2 | Mazatenango: publicar en el EBO el punto Apparent Power Del C Peak Demand del ION7400-1, si se necesita |
| 3 | Revisar la conexión ZeroTier de La Gomera (corte de ~4 h 40 min el 19/10) |
| 4 | Regenerar llaves SSH y machine-id (servidores clonados) |
| 5 | Cambiar la clave del buzón de alarmas, `admin/admin123` y `JWT_SECRET` |
| 6 | Módulo WISE: `timeout` continuo (no afecta a los medidores) |

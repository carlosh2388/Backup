# api-SIASA en las sedes del IGSS: inventario, monitoreo y operación

| | |
|---|---|
| **Alcance** | Las 10 sedes con api-SIASA leyendo medidores de energía a través del EBO |
| **Estado a la fecha** | Las 10 sedes con el mismo modelo (Escuintla), desplegado del 14/10 al 20/10/2026 |
| **Dirigido a** | Soporte SIASA y centro de monitoreo |
| **Actualizado** | 20/10/2026 |

Las horas de las bitácoras están en UTC. Hora de Guatemala = UTC − 6.

---

## 1. Resumen

Cada sede tiene un servidor con api-SIASA (contenedor `node-api`) que lee por Modbus TCP los medidores del hospital a través del EBO (AS-P de EcoStruxure) y entrega los datos en `GET /api/ebo/modbus-auto` (puerto 3001).

Tras el congelamiento de datos de Escuintla y Villa Nueva (septiembre y octubre de 2026), todas las sedes tienen ahora el mismo modelo:

- **La lectura no se atasca**: la corrección de `modbus_rtu.js` evita el bloqueo que dejó a Escuintla 12 días y a Villa Nueva 14 días con datos fijos.
- **Detección de medidores sin comunicación**: si un medidor no entrega datos nuevos en **5 minutos** (el EBO repite el último valor), la API lo entrega con `online: "false"` y **métricas en 0**.
- **Correos al centro de monitoreo**: uno al ocurrir el evento y uno al resolverse, sin repeticiones ni recordatorios.
- **Estado consultable** en cada sede: estado en vivo, historial de eventos, resumen y panel.
- **Servidor más seguro y estable**: rotación del log y Postgres accesible solo desde el propio servidor.

---

## 2. Inventario de sedes

Patrón de red: servidor `10.0.N.33`, EBO `10.0.N.26:502`. Acceso: usuario `api` (credenciales de soporte SIASA), carpeta `~/node-postgres-docker`. El usuario no tiene `sudo`.

| Sede | Servidor | EBO | Medidores | Prefijo de eventos | Desplegado |
|---|---|---|---|---|---|
| Escuintla (modelo) | 10.0.6.33 | EBO-ASP-ESCUINTLA 10.0.6.26 | 13 | `ESC` | 14-15/10/2026 |
| Villa Nueva | 10.0.3.33 | EBO-ASP-VILLA NUEVA 10.0.3.26 | 7 | `VNU` | 17/10/2026 |
| Gineco | 10.0.2.33 | EBO-ASP-GINECO 10.0.2.26 | 8 | `GIN` | 19/10/2026 |
| Amatitlán | 10.0.4.33 | EBO-ASP-AMATITLAN 10.0.4.26 | 4 | `AMA` | 19/10/2026 |
| Palín | 10.0.5.33 | EBO-ASP-PALIN 10.0.5.26 | 4 | `PAL` | 19/10/2026 |
| La Gomera | 10.0.7.33 | EBO-ASP-LA GOMERA 10.0.7.26 | 4 | `GOM` | 20/10/2026 |
| Santa Lucía | 10.0.8.33 | EBO-ASP-SANTA LUCIA 10.0.8.26 | 4 | `SLU` | 20/10/2026 |
| Tiquisate | 10.0.9.33 | EBO-ASP-TIQUISATE 10.0.9.26 | 2 | `TIQ` | 20/10/2026 |
| Mazatenango | 10.0.10.33 | EBO-ASP-MAZATENANGO 10.0.10.26 | 7 | `MAZ` | 20/10/2026 |
| Retalhuleu | 10.0.11.33 | EBO-ASP-RETALHULEU 10.0.11.26 | 4 | `RET` | 20/10/2026 |

### 2.1 Medidores por sede

| Sede | PM2130 (inventario) | ION7400 (inventario) |
|---|---|---|
| Escuintla | PM2130-1 HES111 · PM2130-2 HES116 · PM2130-3 HES117 · PM2130-4 HES114 · PM2130-5 HES112 · PM2130-6 HES113 · PM2130-7 HES115 | ION7400-1 HES107 · ION7400-2 HES108 · ION7400-3 HES105 · ION7400-4 HES106 · ION7400-5 HES109 · ION7400-6 HES110 |
| Villa Nueva | PM2130-1 CIV053 · PM2130-2 CIV054 · PM2130-3 CIV056 · PM2130-4 CIV055 · PM2130-5 CIV051 · PM2130-6 CIV052 | ION7400-1 CIV050 |
| Gineco | PM2130-1 HGO112 · PM2130-2 HGO113 · PM2130-3 HGO110 · PM2130-4 HGO111 · PM2130-5 HGO109 · PM2130-6 HGO114 | ION7400-1 HGO107 · ION7400-2 HGO108 |
| Amatitlán | PM2130-1 UAA038 · PM2130-2 UAA036 · PM2130-3 UAA037 | ION7400-1 UAA035 |
| Palín | PM2130-1 CDP024 · PM2130-2 CDP025 · PM2130-3 CDP026 | ION7400-1 CDP023 |
| La Gomera | PM2130-1 CGL023 · PM2130-2 CGL024 · PM2130-3 CGL025 | ION7400-1 CGL022 |
| Santa Lucía | PM2130-1 HSL049 · PM2130-2 HSL050 · PM2130-3 HSL051 | ION7400-1 HSL048 |
| Tiquisate | PM2130-1 HTI044 | ION7400-1 HTI043 |
| Mazatenango | PM2130-1 HMA098 · PM2130-2 HMA099 · PM2130-3 HMA100 · PM2130-4 HMA101 · PM2130-5 HMA097 · PM2130-6 HMA102 | ION7400-1 HMA096 |
| Retalhuleu | PM2130-1 HDR053 · PM2130-2 HDR051 · **PM2130-3 HDR052 (medidor de generador)** · | ION7400-1 HDR050 |

### 2.2 Particularidades por sede

| Sede | Particularidad | Configuración |
|---|---|---|
| Escuintla | `index.js` propio (modelo). Puente MQTT → BACnet activo, con el log detallado apagado | `MQTT_BACNET_LOG_MESSAGES=false`, `MQTT_BACNET_LOG_OBJECT_VALUES=false` |
| Gineco | Puente MQTT → BACnet activo (log detallado apagado). El EBO **no publica** ION7400-1 *Active Power A*: forzaba ~570 reconexiones/hora | `MODBUS_AUTO_SKIP_REGISTERS=255,256` |
| Mazatenango | El EBO **no publica** ION7400-1 *Apparent Power Del C Peak Demand*: forzaba ~4 800 conexiones/hora | `MODBUS_AUTO_SKIP_REGISTERS=273,274` |
| Retalhuleu | HDR052 **solo mide con el generador encendido** (0 V con generador apagado = en espera, no falla) | `MEDIDORES_GENERADOR=HDR052` |
| Retalhuleu | `index.js` con regla propia del estado de transferencia del ION | — |
| Mazatenango | `index.js` con otra función de formato en la respuesta V2 (no se usa) | — |
| Todas | Lector v2 apagado (no se usa; `MODBUS_AUTO_ACTIVE_VERSION=1`) | `MODBUS_AUTO_V2_POLL_MS=0` |

Los registros que se saltan (`MODBUS_AUTO_SKIP_REGISTERS`) siempre valen 0 en la respuesta. Para tener esos valores hay que publicar el punto en el servidor Modbus de la AS-P de la sede.

---

## 3. Cómo funciona

```
Medidores --> EBO (AS-P) 10.0.N.26:502 --Modbus TCP--> api-SIASA (node-api) --HTTP :3001--> Plataforma / dashboard
                                                            |
                                                            +--> Monitor de eventos --> Correo (Microsoft 365)
                                                            |                       --> Base siasa_eventos (Postgres local)
                                                            +--> Vigilante (reconecta / reinicia si la lectura se atasca)
```

- La API lee el EBO cada 5 s y guarda la última lectura en memoria.
- El **monitor** (`monitoreo/eventos_modbus.js`) revisa cada lectura y cada medidor, abre y cierra eventos, los guarda en la base `siasa_eventos` y envía los correos.
- **El EBO retiene el último valor** de un medidor que perdió comunicación (en WorkStation aparece `[Offline]`) y lo sigue sirviendo por Modbus. Por eso la API detecta la desconexión por **valores sin cambio**: un medidor en línea cambia cada 15-20 s (muestreo del 19/10/2026).

### 3.1 Eventos

**De la lectura (toda la sede):**

| Evento | Cuándo | Severidad | Correo |
|---|---|---|---|
| `DATOS_CONGELADOS` | Sin lectura buena del EBO por 5 min | Crítico | Inmediato y al resolverse |
| `LECTURA_ATASCADA` | Lectura en curso más de 60 s (el vigilante reconecta) | Advertencia | Agrupado cada 15 min |
| `VIGILANTE_REINICIO` | Lectura atascada 10 min: la API se reinicia sola | Crítico | Inmediato |
| `RECONEXIONES_FRECUENTES` | Más de 10 reconexiones al EBO en 1 hora | Advertencia | Agrupado cada 15 min |
| `API_REINICIADA` | La API arrancó | Informativo | No |

**De cada medidor:**

| Evento | Cuándo | Severidad | Correo |
|---|---|---|---|
| `MEDIDOR_FUERA_DE_LINEA` | Sin datos nuevos 5 min (el EBO repite el último valor), o el medidor no responde 3 min. La API entrega `online: "false"` y métricas en 0 | Crítico | Rojo al ocurrir; verde **"Medidor en línea de nuevo"** al volver |
| `MEDIDOR_EN_CERO` | Voltajes de todas las fases en 0 V por 3 min (medidor comunicando) | Crítico | Al ocurrir y al resolverse |
| `MEDIDOR_SIN_CAMBIO` | Métricas idénticas 15 min (en la práctica lo cubre la regla de 5 min; no se abre con 0 V) | Crítico | Al ocurrir y al resolverse |
| `GENERADOR_EN_MARCHA` | Solo medidores de generador: aparece voltaje 60 s seguidos | Informativo | Azul **"Generador en marcha"**; verde **"Generador apagado"** al volver a 0 V |

Si fallan 3 o más medidores a la vez, sale **un solo correo agrupado** (probable falla común del EBO).

### 3.2 Reglas de los correos

- **Un correo al abrir y uno al cerrar** cada evento. Sin recordatorios (`ALERTA_RECORDATORIO_HORAS=0`).
- **Los reinicios de la API no repiten correos**: al arrancar recupera de la base los eventos de medidores ya notificados y los continúa.
- **Sin resumen diario por correo** (`ALERTA_RESUMEN_DIARIO_CORREO=false`); se consulta en `/resumen`.
- **Sin correos de prueba**: solo eventos reales.
- Máximo 20 correos por hora por sede.
- Remitente `Alarmas SIASA <alarmas.atlas@siasa.gt>` (Microsoft 365, `smtp.office365.com:587`). Destinatarios: `chernandez@siasa.gt`, `wgarcia@siasa.gt`, `wguerrero@siasa.gt`.

### 3.3 Medidor de generador

Para medidores que solo miden con el generador encendido (`MEDIDORES_GENERADOR`, por inventario, nombre o id):

| Situación | Resultado |
|---|---|
| Generador apagado (0 V) | Sin alarma. Estado `en_espera_generador_apagado` |
| Voltaje 60 s seguidos | `GENERADOR_EN_MARCHA` + correo informativo |
| Vuelve a 0 V 60 s seguidos | Cierre + correo "Generador apagado" con la duración |
| Valores congelados con el generador en marcha | `MEDIDOR_FUERA_DE_LINEA`, como cualquier medidor |

Limitación: con el generador apagado no se distingue un medidor desconectado (el EBO también entrega 0).

---

## 4. Consultas

**Monitoreo central (las 10 sedes en una sola vista):** http://10.30.10.27:8080 — Next.js en el servidor 10.30.10.27, con su propia clave de acceso. Detalle en [`monitoreo-central/README.md`](../../monitoreo-central/README.md).

Por sede, todas en el puerto **3001**, con la clave `MODBUS_AUTO_API_KEY` de la sede (header `x-api-key` o `?api_key=` en el navegador). Sin clave responden 401.

| Ruta | Devuelve |
|---|---|
| `GET /api/ebo/modbus-auto` | Lectura de los medidores (`online`, métricas) y `lectura` (hora y antigüedad del dato) |
| `GET /api/ebo/modbus-auto/estado` | Estado general (`ok`, `lento`, `degradado`, `congelado`, `sin_cambio`), eventos abiertos y estado de cada medidor |
| `GET /api/ebo/modbus-auto/eventos?desde=&hasta=&dispositivo=&abiertos=true` | Historial de eventos |
| `GET /api/ebo/modbus-auto/resumen` | Resumen de la sede (HTML; `&formato=texto` para texto plano) |
| `GET /monitoreo` | Panel de eventos (pide la clave la primera vez) |

| Sede | Resumen | Panel |
|---|---|---|
| Escuintla | http://10.0.6.33:3001/api/ebo/modbus-auto/resumen | http://10.0.6.33:3001/monitoreo |
| Villa Nueva | http://10.0.3.33:3001/api/ebo/modbus-auto/resumen | http://10.0.3.33:3001/monitoreo |
| Gineco | http://10.0.2.33:3001/api/ebo/modbus-auto/resumen | http://10.0.2.33:3001/monitoreo |
| Amatitlán | http://10.0.4.33:3001/api/ebo/modbus-auto/resumen | http://10.0.4.33:3001/monitoreo |
| Palín | http://10.0.5.33:3001/api/ebo/modbus-auto/resumen | http://10.0.5.33:3001/monitoreo |
| La Gomera | http://10.0.7.33:3001/api/ebo/modbus-auto/resumen | http://10.0.7.33:3001/monitoreo |
| Santa Lucía | http://10.0.8.33:3001/api/ebo/modbus-auto/resumen | http://10.0.8.33:3001/monitoreo |
| Tiquisate | http://10.0.9.33:3001/api/ebo/modbus-auto/resumen | http://10.0.9.33:3001/monitoreo |
| Mazatenango | http://10.0.10.33:3001/api/ebo/modbus-auto/resumen | http://10.0.10.33:3001/monitoreo |
| Retalhuleu | http://10.0.11.33:3001/api/ebo/modbus-auto/resumen | http://10.0.11.33:3001/monitoreo |

En el servidor:

```bash
K=$(grep ^MODBUS_AUTO_API_KEY= ~/node-postgres-docker/api/.env | cut -d= -f2-)
curl -s -H "x-api-key: $K" http://127.0.0.1:3001/api/ebo/modbus-auto/estado
docker logs --since 24h node-api 2>&1 | grep MODBUS-EVENTO
```

---

## 5. Configuración (`api/.env`)

Valores iguales en todas las sedes (cambian `SEDE_NOMBRE`, `SEDE_PREFIJO`, las URL y las claves):

| Variable | Valor | Para qué |
|---|---|---|
| `ALERTA_OFFLINE_SIN_CAMBIO_MIN` | 5 | Minutos sin datos nuevos para `online: "false"` (0 desactiva) |
| `ALERTA_FUERA_DE_LINEA_MIN` | 3 | Minutos sin respuesta del medidor |
| `ALERTA_EN_CERO_MIN` | 3 | Minutos con 0 V |
| `ALERTA_SIN_CAMBIO_MIN` | 15 | Minutos con métricas idénticas |
| `ALERTA_CONGELADO_MIN` | 5 | Minutos sin lectura buena del EBO |
| `ALERTA_ATASCADA_S` / `VIGILANTE_REINICIO_MIN` | 60 / 10 | Lectura atascada: reconectar / reiniciar |
| `ALERTA_RECORDATORIO_HORAS` | 0 | Sin recordatorios |
| `ALERTA_RESUMEN_DIARIO_CORREO` | false | Sin resumen por correo |
| `ALERTA_RESPONDER_503` | false | Con `true`, la API responde 503 en vez de datos viejos si la lectura está congelada (cuando el dashboard use `lectura.stale`) |
| `MQTT_SENSOR_DB_ENABLED` | false | Doble candado: no insertar métricas en `mi_basedatos` |
| `MODBUS_AUTO_V2_POLL_MS` | 0 | Lector v2 apagado |
| `MEDIDORES_GENERADOR` | (solo Retalhuleu) | Medidores de generador |
| `MODBUS_AUTO_SKIP_REGISTERS` | (solo Gineco y Mazatenango) | Registros que el EBO no publica |
| `ALERTA_GENERADOR_CONFIRMACION_S` / `ALERTA_GENERADOR_CORREO` | 60 / true | Modo generador |

Las claves (`SMTP_CLAVE`, `EVENTOS_DB_PASSWORD`, `MODBUS_AUTO_API_KEY`) están **solo en el `.env` de cada servidor**. La clave de la base de eventos también está en `~/respaldos/<fecha>-<sede>/.clave_siasa_eventos` (permiso 600).

`docker-compose.yml`: rotación del log (`max-size: 50m`, `max-file: 10`) y Postgres en `127.0.0.1:5432`. La base `mi_basedatos` solo acepta al usuario `admin`; los eventos van en la base `siasa_eventos` con su propio usuario.

---

## 6. Código desplegado

| Archivo | Qué es | Versión (MD5) |
|---|---|---|
| `monitoreo/eventos_modbus.js` | Monitor de eventos (igual en las 10 sedes) | `27d8fc9f2fcc6c4245e505cd4c202818` |
| `monitoreo/plantilla_correo.js` | Plantilla HTML de los correos (igual en las 10 sedes) | `3edc85fd439162c77a30e1db22b6bf3e` |
| `monitoreo/panel.html`, `monitoreo/node_modules/nodemailer` | Panel y librería de correo (nodemailer 6.10.1) | — |
| `modbus_cliente/modbus_rtu.js` | Conexión Modbus con la corrección del atasco; solo cambia la IP del EBO por defecto | Uno por sede |
| `index.js` | Escuintla: propio. Demás: el de Villa Nueva corregido, más el cambio propio de Gineco, Mazatenango o Retalhuleu | Ver bitácoras |
| `modbus_cliente/lectura_Ebo.js` | Con `MODBUS_AUTO_SKIP_REGISTERS` | Solo Gineco y Mazatenango |

Copias locales: Escuintla en la raíz de `api-SIASA`, Villa Nueva en `api-SIASA-VillaNueva`. Las carpetas `api-SIASA-<sede>` de las demás sedes tienen versiones anteriores: **lo vigente está en los servidores** (y su versión previa en los respaldos).

---

## 7. Operación

### 7.1 Qué hacer al recibir un correo

| Correo | Primera verificación | Escalar a |
|---|---|---|
| Medidor fuera de línea | WorkStation: ¿el medidor aparece `[Offline]`? Pantalla y alimentación del medidor | Técnico de campo |
| Medidor en línea de nuevo | — (registrar en bitácora con la duración) | — |
| Medidor con voltaje en cero | ¿Hubo corte en ese tablero? | Mantenimiento eléctrico |
| Generador en marcha / apagado | ¿Corte de la red comercial o prueba programada? | Mantenimiento eléctrico |
| Datos congelados | Abrir `/estado`: revisar `ultimo_error`. Si es de red, revisar red y EBO; si es `Timed out`, el vigilante reinicia solo | Soporte SIASA |
| Reconexiones frecuentes | Log: `docker logs --since 1h node-api 2>&1 \| grep RECONEXION` (muestra la dirección que falla) | Soporte SIASA |
| Varios medidores con eventos | Probable falla común del EBO o del bus de medidores | Soporte SIASA / integrador del EBO |

### 7.2 Reinicios

- Cambios de código o de `.env`: `docker restart node-api` (el código está montado desde `api/`).
- Cambios de `docker-compose.yml`: `docker-compose rm -sf api && docker-compose up -d --no-deps api` (Docker 28 con docker-compose 1.29.2 falla al recrear con `KeyError: 'ContainerConfig'`).
- Un reinicio **no** genera correos nuevos. Un medidor que se desconecta justo durante el reinicio tarda hasta 5 min en marcarse.

### 7.3 Diagnóstico de reconexiones constantes

Si una sede muestra miles de `Modbus conectado` por hora o `RECONEXION ... Data length error`:

1. Ver la dirección en el log `[MODBUS-EVENTO] RECONEXION`.
2. Probar el rango con una sonda de solo lectura (de a 2 registros) para ubicar la dirección que el EBO no publica (`exception 2` o `exception 4`).
3. Agregar esos registros (dirección + 1) a `MODBUS_AUTO_SKIP_REGISTERS` y reiniciar.

Así se resolvieron Gineco y Mazatenango.

### 7.4 Agregar o actualizar una sede

1. Inspección de solo lectura (código, `.env`, contenedores, log, respuesta de la API).
2. Respaldo en `~/respaldos/<fecha>-<sede>/antes/` y log completo en `logs/`.
3. Código: `modbus_rtu.js` corregido, `index.js` con el monitor (conservando los cambios propios de la sede), `monitoreo/`.
4. `.env`: bloques de monitoreo y correo; `docker-compose.yml`: rotación del log y Postgres local.
5. Postgres y base `siasa_eventos`; recrear `node-api`.
6. Verificar: medidores en línea, 0 reconexiones, correo activo, `/resumen`, sin escrituras en `mi_basedatos`; y repetir pasados 5 min.
7. Documentar en la bitácora de la sede. **No enviar correos de prueba.**

### 7.5 Revertir

En cada servidor, los archivos anteriores están en `~/respaldos/<fecha>-<sede>/antes/`. Procedimiento en cada bitácora. **No se recomienda revertir `modbus_rtu.js`**: el código original es el que se atasca.

| Respaldo | Contenido |
|---|---|
| `~/respaldos/2026-10-14-incidente/`, `2026-10-15-correo/`, `2026-10-19-*` | Escuintla (por etapa) |
| `~/respaldos/2026-10-17-villanueva/`, `2026-10-19-mejoras/` | Villa Nueva |
| `~/respaldos/2026-10-19-<sede>/` | Gineco, Amatitlán, Palín, La Gomera, Santa Lucía, Tiquisate, Mazatenango, Retalhuleu |
| `~/respaldos/2026-10-20-generador/` | Las 10 sedes: monitor antes del modo generador |

---

## 8. Estado al 20/10/2026

| Sede | Estado | Observación |
|---|---|---|
| Escuintla | ok, 12/13 en línea | ION7400-3 (HES105) sin comunicación desde el 19/10 15:16 (Guatemala). ION7400-1 y -2 tuvieron cortes ese día y volvieron |
| Villa Nueva, Gineco, Amatitlán, Palín, Santa Lucía, Tiquisate, Mazatenango | ok, todos en línea | 0 reconexiones |
| La Gomera | ok, 4/4 | Corte de red (ZeroTier) de ~4 h 40 min el 19/10 |
| Retalhuleu | ok, 3/4 + HDR052 en espera | HDR052 es medidor de generador |

**Historial encontrado en los logs:** congelamientos largos solo en Escuintla (30/09 al 13/10/2026) y Villa Nueva (07/09 al 21/09/2026). Cortes breves de `Port Not Open` en Amatitlán (16/04/2026, ~10 min) y Retalhuleu (15/04/2026, ~1 h).

---

## 9. Pendientes

| # | Pendiente | Sedes |
|---|---|---|
| 1 | Revisar en sitio el ION7400-3 (HES105) | Escuintla |
| 2 | Publicar en el EBO los puntos que faltan (ION7400-1 *Active Power A* en Gineco, *Apparent Power Del C Peak Demand* en Mazatenango), si se necesitan | Gineco, Mazatenango |
| 3 | Revisar la conexión ZeroTier (cortes de varias horas) | La Gomera (y en general) |
| 4 | **Regenerar llaves SSH y machine-id**: los 10 servidores se clonaron de la misma imagen y comparten llave (`SHA256:Bb69l1ntj0vdQOq2q3QLKW2mRuRn2i1BgWufCuTPhaY`) | Todas |
| 5 | Cambiar la clave del buzón `alarmas.atlas@siasa.gt`, `admin/admin123` de Postgres y `JWT_SECRET` | Todas |
| 6 | Dashboard: usar `lectura.scanned_at` / `lectura.stale` y tratar `online: "false"`; luego activar `ALERTA_RESPONDER_503=true` | Todas |
| 7 | Integrar el panel de eventos en el dashboard principal | Todas |
| 8 | Módulo WISE con `timeout` o `EHOSTUNREACH` continuo (no afecta a los medidores) | Varias |

---

## 10. Documentos relacionados

| Documento | Contenido |
|---|---|
| [Arquitectura general](../arquitectura/arquitectura-general-sedes.md) | Diagramas de la arquitectura, flujos de datos y de alertas, puertos y componentes |
| [Informe del incidente de Escuintla](../incidentes/2026-10-escuintla-metricas-congeladas.md) | Causa del congelamiento de 12 días |
| [Informe técnico](../informes/2026-10-escuintla-informe-tecnico-congelamiento-y-alertas.md) | Propuesta del sistema de alertas |
| [Bitácora de Escuintla](../incidentes/2026-10-escuintla-bitacora-cambios.md) | Modelo: todos los cambios, en orden (incluye 3.14 a 3.18) |
| [Bitácora de Villa Nueva](../incidentes/2026-10-villanueva-bitacora-cambios.md) | Corrección del congelamiento de 14 días y mejoras |
| [Bitácora de Gineco, Amatitlán y Palín](../incidentes/2026-10-gineco-amatitlan-palin-bitacora-cambios.md) | Despliegue y corrección de reconexiones de Gineco |
| [Bitácora de La Gomera, Santa Lucía, Tiquisate, Mazatenango y Retalhuleu](../incidentes/2026-10-gomera-santalucia-tiquisate-bitacora-cambios.md) | Despliegue, reconexiones de Mazatenango y medidor de generador |
| [Plan de monitoreo](plan-monitoreo-api-siasa.md) | Vigilancia externa de las sedes |

# Monitoreo central SIASA

Panel único con el estado de las 10 sedes api-SIASA del IGSS: lectura del EBO, medidores, eventos abiertos e historial de 7 días.

| | |
|---|---|
| **Servidor** | 10.30.10.27 (usuario `api`), carpeta `~/monitoreo-central` |
| **Panel** | http://10.30.10.27:8080 |
| **Tecnología** | Next.js 14.2.35 (App Router, React 18, TypeScript), salida `standalone`, contenedor Docker `monitoreo-central` |
| **Diseño** | UI/UX Pro Max: estilo "Minimalism & Swiss Style" para tablero denso, oscuro por defecto con tema claro, estados verde/ámbar/rojo con ícono y texto, Fira Sans / Fira Code |

## Cómo funciona

```
navegador ──(clave central)──> Next.js :8080 ──(API key de cada sede)──> api-SIASA :3001 de las 10 sedes
                                   │                                         /api/ebo/modbus-auto/estado  (cada 15 s)
                                   │                                         /api/ebo/modbus-auto         (cada 15 s, kW por medidor)
                                   └─ colector + data/historial.json         /api/ebo/modbus-auto/eventos (cada 60 s, 7 días)
```

- **El colector** (`lib/colector.ts`) corre dentro del servidor de Next.js (se inicia en `instrumentation.ts`) y consulta las sedes en paralelo.
- **Las API keys de las sedes** están solo en `config/sedes.json` (permiso 600). El navegador nunca las recibe: solo pide `/api/vista` con la clave del monitoreo central.
- Una sede que no responde en 60 s aparece como **"Sin respuesta"** con el error y los últimos datos recibidos.
- El monitoreo central **no envía correos**: los correos los envía cada sede.

## Vista: centro de mando

Aprobada a partir del mockup `mockup/centro-de-mando.html` (UI/UX Pro Max: "Real-Time Operations", mosaico tipo bento, tema oscuro de sala de control). La pantalla responde en orden: ¿hay algo que atender?, ¿dónde?, ¿qué tan grave?, ¿qué pasó?

| Zona | Qué muestra |
|---|---|
| **Banda de estado** | Una frase con el estado general ("Todo en orden" en verde, o "N sedes requieren atención" en el color del caso más grave) y un botón por problema que lleva a la sede |
| **Mapa de sedes** | Las 10 sedes en posiciones aproximadas, con el color de su estado, medidores en línea y un pulso en las que tienen problema. Clic o Enter selecciona la sede |
| **Disponibilidad** | Anillo con el % de medidores en línea, sedes operando, medidores fuera de línea, sedes sin respuesta y reconexiones de la última hora |
| **Actividad en vivo** | Lo último que pasó en todas las sedes (desconexiones, reconexiones, generador, sedes que dejan de responder), lo más reciente resaltado |
| **Sedes** | Lista con un cuadrito por medidor (color de su estado) y una tira de las últimas 24 h (peor estado de cada hora). Filtros y búsqueda por sede o inventario |
| **Detalle de la sede** | Eventos abiertos y un mosaico por medidor: kW (ION: potencia activa, indicando si es del generador; PM2130: demanda), voltaje y corriente promedio, estado |
| **Eventos por día** | 7 días por sede; rojo con «!» = día con eventos críticos |
| **Modo pantalla** | Pantalla completa para un monitor fijo: recorre cada 10 s las sedes con problema (o todas si no hay) |

Si nadie elige una sede, el detalle muestra la más grave. Indicador **"En vivo"** con la antigüedad del dato (**"Desactualizado"** si pasan 45 s sin datos); botones para pausar, actualizar y salir.

**Historial (`data/historial.json`):** una foto de cada sede cada 5 min (24 h), el último estado conocido de cada sede (para ver sus medidores aunque no responda tras un reinicio) y los avisos propios del monitoreo central ("la sede dejó de responder / responde de nuevo"). Se guarda en disco y sobrevive a reinicios.

## Archivos

| Archivo | Contenido |
|---|---|
| `lib/colector.ts` | Consulta de las sedes y armado de la vista (servidor) |
| `app/api/vista/route.ts` | `GET /api/vista`, protegido con el header `x-clave` |
| `app/api/salud/route.ts` | `GET /api/salud` (sin clave): el colector está activo |
| `components/` | `Tablero` (estado, actualización, modo pantalla) y `Paneles` (banda de estado, mapa, disponibilidad, actividad, sedes, detalle, eventos por día) |
| `data/historial.json` | **Solo en el servidor.** Historial de 24 h, último estado por sede y avisos propios |
| `mockup/centro-de-mando.html` | Mockup aprobado (datos de ejemplo) |
| `config/sedes.json` | **Solo en el servidor.** `[{ id, nombre, ip, puerto, key, orden }]` |
| `.env` | **Solo en el servidor.** `CENTRAL_CLAVE` (clave del panel) y tiempos |

Variables (`.env`): `CENTRAL_CLAVE` (obligatoria), `CENTRAL_INTERVALO_S` (15), `CENTRAL_EVENTOS_S` (60), `CENTRAL_DIAS` (7), `CENTRAL_TIMEOUT_S` (8), `CENTRAL_SIN_RESPUESTA_S` (60).

## Operación

```bash
cd ~/monitoreo-central
docker-compose build && docker-compose up -d     # construir y levantar
docker logs --since 1h monitoreo-central          # log: [CENTRAL] SEDE_SIN_RESPUESTA / SEDE_RESPONDE
curl -s http://127.0.0.1:8080/api/salud           # salud
```

- **Cambiar la clave del panel:** editar `CENTRAL_CLAVE` en `.env` y `docker-compose up -d` (recrea el contenedor).
- **Agregar una sede:** agregarla a `config/sedes.json` (con su `MODBUS_AUTO_API_KEY`) y `docker restart monitoreo-central`.
- **Si la API key de una sede cambia:** actualizarla en `config/sedes.json` y reiniciar; mientras tanto la sede aparece como "Sin respuesta" con `HTTP 401`.
- Docker 29 con docker-compose 1.29.2: si `up -d` falla al recrear (`KeyError: 'ContainerConfig'`), usar `docker-compose rm -sf monitoreo-central && docker-compose up -d`.

## Desarrollo local

```bash
npm install
# config/sedes.json y .env con CENTRAL_CLAVE (no se versionan)
npm run dev        # http://localhost:3000
npm run typecheck && npm run build
```

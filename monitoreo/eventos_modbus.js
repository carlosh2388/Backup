// ======================================================
//  MONITOREO DE LA LECTURA MODBUS DEL EBO
//  Detecta eventos (datos congelados, lectura atascada, medidor sin cambio...),
//  los escribe en el log ([MODBUS-EVENTO]), los guarda en su propia base de datos
//  (EVENTOS_DB_*, separada de mi_basedatos) y avisa por correo.
//  Origen: incidente Escuintla 30/09/2026 - 13/10/2026 (datos congelados 12 dias sin aviso).
// ======================================================

const crypto = require("crypto");
const { Pool } = require("pg");
const plantilla = require("./plantilla_correo");

function num(value, fallback) {
  if (value == null || String(value).trim() === "") return fallback;
  const parsed = Number(String(value).split("#")[0].trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback = false) {
  if (value == null || String(value).trim() === "") return fallback;
  return /^(1|true|si|yes)$/i.test(String(value).trim());
}

const env = process.env;
const CFG = {
  sede: env.SEDE_NOMBRE || "Sede",
  prefijo: (env.SEDE_PREFIJO || env.SEDE_NOMBRE || "SED").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "SED",
  zona: env.ALERTAS_ZONA_HORARIA || "America/Guatemala",
  urlEstado: env.ALERTAS_URL_ESTADO || "",
  urlMonitoreo: env.ALERTAS_URL_MONITOREO || (env.ALERTAS_URL_ESTADO || "").replace(/\/api\/ebo\/modbus-auto\/estado.*$/, "/monitoreo"),
  congeladoMs: num(env.ALERTA_CONGELADO_MIN, 5) * 60000,
  degradadoMs: num(env.ALERTA_DEGRADADO_S, 60) * 1000,
  lentaMs: num(env.ALERTA_LECTURA_LENTA_S, 15) * 1000,
  atascadaMs: num(env.ALERTA_ATASCADA_S, 60) * 1000,
  reinicioAtascadaMs: num(env.VIGILANTE_REINICIO_MIN, 10) * 60000,
  vigilanteReinicio: bool(env.VIGILANTE_REINICIO_ACTIVO, true),
  sinCambioMs: num(env.ALERTA_SIN_CAMBIO_MIN, 15) * 60000,
  fueraDeLineaMs: num(env.ALERTA_FUERA_DE_LINEA_MIN, 3) * 60000,
  // El EBO retiene el último valor de un medidor sin comunicación y lo sigue entregando por Modbus:
  // si sus métricas no cambian en este tiempo, se reporta online=false. 0 desactiva la regla.
  // Los medidores en línea cambian cada 15-20 s (muestreo del 19/10/2026): 5 min deja amplio margen.
  offlinePorCongeladoMs: num(env.ALERTA_OFFLINE_SIN_CAMBIO_MIN, 5) * 60000,
  enCeroMs: num(env.ALERTA_EN_CERO_MIN, 3) * 60000,
  // Medidores que solo miden con el generador encendido (inventario, nombre o id, separados por coma).
  // Con 0 V no es una falla: quedan "en espera" y se avisa cuando el generador arranca y cuando se apaga.
  medidoresGenerador: String(env.MEDIDORES_GENERADOR || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  generadorConfirmacionMs: num(env.ALERTA_GENERADOR_CONFIRMACION_S, 60) * 1000,
  generadorCorreo: bool(env.ALERTA_GENERADOR_CORREO, true),
  reconexionesPorHora: num(env.ALERTA_RECONEXIONES_POR_HORA, 10),
  recordatorioMs: num(env.ALERTA_RECORDATORIO_HORAS, 4) * 3600000, // 0 = sin recordatorios
  esperaRestauracionMs: num(env.ALERTA_ESPERA_RESTAURACION_S, 60) * 1000,
  agruparAdvertenciasMs: num(env.ALERTA_AGRUPAR_ADVERTENCIAS_MIN, 15) * 60000,
  maxCorreosPorHora: num(env.ALERTA_MAX_CORREOS_POR_HORA, 20),
  resumenDiarioHora: env.ALERTA_RESUMEN_DIARIO_HORA || "07:00",
  resumenDiarioCorreo: bool(env.ALERTA_RESUMEN_DIARIO_CORREO, true),
  resumenLogMs: num(env.ALERTA_RESUMEN_LOG_MIN, 15) * 60000,
  retencionMeses: num(env.EVENTOS_RETENCION_MESES, 12),
  responder503: bool(env.ALERTA_RESPONDER_503, false),
  correo: {
    activo: bool(env.ALERTAS_CORREO_ACTIVO, false),
    host: env.SMTP_HOST || "",
    port: num(env.SMTP_PORT, 587),
    secure: bool(env.SMTP_SEGURO, false),
    user: env.SMTP_USUARIO || "",
    pass: env.SMTP_CLAVE || "",
    de: env.ALERTAS_CORREO_DE || env.SMTP_USUARIO || "",
    para: env.ALERTAS_CORREO_PARA || "",
    cc: env.ALERTAS_CORREO_CC || ""
  },
  db: {
    host: env.EVENTOS_DB_HOST || "",
    port: num(env.EVENTOS_DB_PORT, 5432),
    database: env.EVENTOS_DB_NAME || "siasa_eventos",
    user: env.EVENTOS_DB_USER || "siasa_eventos",
    password: env.EVENTOS_DB_PASSWORD || ""
  }
};

const SEVERIDAD_TEXTO = { critico: "CRÍTICO", advertencia: "ADVERTENCIA", info: "INFORMATIVO" };

// Causa probable y acción sugerida por tipo de evento (lo que llega en el correo).
const GUIA = {
  DATOS_CONGELADOS: {
    titulo: "Datos congelados: la API no obtiene lecturas nuevas del EBO",
    causa: null, // se calcula con el último error
    accion: [
      "Abrir el estado en vivo (enlace abajo) y revisar 'ultimo_error'.",
      "Si el error es de conexión (ECONNREFUSED, EHOSTUNREACH, Port Not Open): revisar la red hacia el EBO y que el EBO esté encendido. Reiniciar la API no ayuda.",
      "Si el error es 'Timed out' o no hay error: reiniciar node-api (docker restart node-api). Si persiste, revisar el servidor Modbus TCP de la AS-P.",
      "Mientras dure, los valores del dashboard NO son actuales."
    ]
  },
  LECTURA_ATASCADA: {
    titulo: "Lectura del EBO atascada",
    causa: "El EBO responde muy lento o la conexión quedó colgada. El vigilante cerró la conexión y reconectó.",
    accion: [
      "No requiere acción inmediata: el vigilante reconecta solo.",
      "Si se repite varias veces en el día, revisar la carga del servidor Modbus de la AS-P y los clientes conectados."
    ]
  },
  RECONEXIONES_FRECUENTES: {
    titulo: "Reconexiones frecuentes con el EBO",
    causa: "Red inestable, EBO saturado de conexiones, o un bloque de registros que responde con error.",
    accion: [
      "Revisar en el log las líneas [MODBUS-EVENTO] RECONEXION: indican la dirección y el error.",
      "Revisar los clientes conectados al servidor Modbus TCP de la AS-P."
    ]
  },
  MEDIDOR_SIN_CAMBIO: {
    titulo: "Medidor sin cambio",
    causa: "El EBO perdió comunicación con el medidor y repite el último valor.",
    accion: [
      "Revisar en WorkStation el estado de comunicación del medidor.",
      "Si el EBO lo muestra sin comunicación: revisar el bus RS-485 y la alimentación del medidor (técnico de campo).",
      "Si en el EBO los valores sí cambian: escalar a soporte SIASA (falla de api-SIASA)."
    ]
  },
  MEDIDOR_FUERA_DE_LINEA: {
    titulo: "Medidor fuera de línea",
    tituloCierre: "Medidor en línea de nuevo",
    causa: "El EBO perdió comunicación con el medidor (en WorkStation aparece [Offline]) y repite el último valor: medidor apagado, cable de red o RS-485, o dirección Modbus.",
    accion: [
      "Revisar en WorkStation el estado de comunicación del medidor.",
      "Verificar que la pantalla del medidor esté encendida.",
      "Revisar alimentación y cableado (técnico de campo)."
    ]
  },
  MEDIDOR_EN_CERO: {
    titulo: "Medidor con voltaje en cero",
    causa: "Corte de energía real en ese tablero, o falla de lectura.",
    accion: ["Confirmar con mantenimiento si hubo corte en ese tablero.", "Si es un corte real: seguir el protocolo eléctrico del hospital."]
  },
  GENERADOR_EN_MARCHA: {
    titulo: "Generador en marcha",
    tituloCierre: "Generador apagado",
    causa: "Este medidor solo registra voltaje cuando el generador está encendido: hubo transferencia a generador (corte de la red comercial o prueba programada).",
    accion: [
      "Confirmar con mantenimiento si es un corte de la energía comercial o una prueba del generador.",
      "Si es un corte: seguir el protocolo eléctrico del hospital y vigilar el combustible y el tiempo de marcha."
    ]
  },
  API_REINICIADA: {
    titulo: "API reiniciada",
    causa: "Reinicio manual, del servidor o del vigilante.",
    accion: ["Verificar que el estado vuelva a 'ok' en menos de 1 minuto."]
  },
  VIGILANTE_REINICIO: {
    titulo: "El vigilante reinicia la API",
    causa: "La lectura del EBO estuvo atascada demasiado tiempo.",
    accion: ["Docker vuelve a levantar la API. Verificar que el estado vuelva a 'ok'.", "Si se repite, escalar a soporte SIASA."]
  }
};

// ------------------------------------------------------
//  Estado en memoria
// ------------------------------------------------------
const inicioProceso = Date.now();
const st = {
  ultimaOk: null,
  ultimoIntento: null,
  ultimoError: null,
  ultimoErrorEn: null,
  fallasConsecutivas: 0,
  duracionUltimaMs: null,
  enCursoDesde: null,
  lecturasOk: 0,
  lecturasFallidas: 0,
  sumaDuracionMs: 0,
  ultimoLogFallaAt: 0,
  ultimoLogLentaAt: 0,
  medidores: new Map(), // deviceId -> { nombre, inventario, area, firma, cambioEn, offlineDesde, ceroDesde, online, ultimaVez }
  reconexiones: [], // timestamps
  ultimoTotalReset: 0,
  dependencias: {}
};

const abiertos = new Map(); // clave -> evento

// ------------------------------------------------------
//  Utilidades
// ------------------------------------------------------
function iso(ms) {
  return ms ? new Date(ms).toISOString() : null;
}

function horaLocal(ms) {
  if (!ms) return "-";
  try {
    return new Date(ms).toLocaleString("es-GT", { timeZone: CFG.zona, hour12: false });
  } catch (_) {
    return new Date(ms).toISOString();
  }
}

function duracionTexto(ms) {
  if (ms == null) return "-";
  const s = Math.round(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} d ${h} h ${m} min`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

function nuevoCodigo(ms) {
  const d = new Date(ms);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  const fecha = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
  return `${CFG.prefijo}-${fecha}-${crypto.randomBytes(2).toString("hex")}`;
}

function logEvento(obj) {
  console.warn(`[MODBUS-EVENTO] ${JSON.stringify({ t: new Date().toISOString(), sede: CFG.sede, ...obj })}`);
}

function causaPorError(error, enCurso) {
  const msg = String(error || "");
  if (enCurso) return "La lectura está atascada: el EBO no responde y la conexión no se libera.";
  if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|Port Not Open|ECONNRESET|EPIPE/i.test(msg)) {
    return "Sin conexión con el EBO: red caída, EBO apagado o puerto 502 bloqueado.";
  }
  if (/timed out|timeout|ETIMEDOUT/i.test(msg)) {
    return "El EBO acepta la conexión pero no responde Modbus (saturado, demasiadas conexiones o servidor Modbus colgado).";
  }
  if (!msg) return "Desconocida: revisar el log del contenedor.";
  return `Error de lectura: ${msg}`;
}

// ------------------------------------------------------
//  Base de datos (propia, separada de mi_basedatos)
// ------------------------------------------------------
let pool = null;
let tablaLista = false;
const colaDb = [];
const MAX_COLA_DB = 5000;

function dbActiva() {
  return Boolean(CFG.db.host && CFG.db.password);
}

// Eventos que dejó abiertos el proceso anterior (reinicio de la API).
// Los de medidores ya notificados se recuperan tal cual: no se repite el correo de apertura y,
// cuando el medidor se normaliza, sale un solo correo de cierre. Los demás se cierran aquí
// (si la condición sigue, este proceso los vuelve a abrir).
const restaurados = new Map(); // nombre del medidor -> { MEDIDOR_FUERA_DE_LINEA: ev, ... }
let restauracionLista = false;

async function restaurarAbiertos() {
  const r = await pool.query(
    `SELECT codigo, evento, severidad, dispositivo, inventario, inicio, detalle, notificado_en
       FROM api_eventos WHERE fin IS NULL AND sede = $1 AND inicio < $2`,
    [CFG.sede, iso(inicioProceso)]
  );
  // Si la base respondió tarde (los medidores ya se evaluaron sin ella), solo se cierran.
  const tarde = restauracionLista;
  const aCerrar = [];
  r.rows.forEach((row) => {
    if (tarde || !/^(MEDIDOR_|GENERADOR_)/.test(row.evento) || !row.dispositivo || !row.notificado_en) {
      aCerrar.push(row.codigo);
      return;
    }
    const k = `${row.evento}|${row.dispositivo}`;
    if (abiertos.has(k)) { aCerrar.push(row.codigo); return; }
    const notificadoEn = new Date(row.notificado_en).getTime();
    const ev = {
      codigo: row.codigo, evento: row.evento, severidad: row.severidad, dispositivo: row.dispositivo,
      inventario: row.inventario, inicio: new Date(row.inicio).getTime(), detalle: row.detalle || {},
      notificado: true, notificadoEn, ultimoAviso: notificadoEn, restaurado: true
    };
    abiertos.set(k, ev);
    if (!restaurados.has(row.dispositivo)) restaurados.set(row.dispositivo, {});
    restaurados.get(row.dispositivo)[row.evento] = ev;
  });
  if (aCerrar.length) {
    await pool.query(
      `UPDATE api_eventos
          SET fin = $2, duracion_s = GREATEST(0, EXTRACT(EPOCH FROM ($2::timestamptz - inicio))::int),
              detalle = COALESCE(detalle, '{}'::jsonb) || '{"cerrado_por":"reinicio de la API"}'::jsonb
        WHERE codigo = ANY($1)`,
      [aCerrar, iso(Date.now())]
    );
  }
  restauracionLista = true;
  if (r.rowCount) {
    logEvento({ evento: "EVENTOS_RESTAURADOS", restaurados: r.rowCount - aCerrar.length, cerrados: aCerrar.length,
      medidores: [...restaurados.keys()] });
  }
}

async function prepararTabla() {
  if (!dbActiva() || tablaLista) return tablaLista;
  if (!pool) {
    pool = new Pool({
      host: CFG.db.host,
      port: CFG.db.port,
      database: CFG.db.database,
      user: CFG.db.user,
      password: CFG.db.password,
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
    pool.on("error", (err) => {
      console.error("[MODBUS-EVENTO] error en conexion a base de eventos:", err.message);
    });
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_eventos (
      id              BIGSERIAL PRIMARY KEY,
      codigo          TEXT UNIQUE NOT NULL,
      sede            TEXT NOT NULL,
      evento          TEXT NOT NULL,
      severidad       TEXT NOT NULL,
      dispositivo     TEXT,
      inventario      TEXT,
      inicio          TIMESTAMPTZ NOT NULL,
      fin             TIMESTAMPTZ,
      duracion_s      INTEGER,
      detalle         JSONB,
      notificado_en   TIMESTAMPTZ,
      cierre_notificado_en TIMESTAMPTZ,
      intentos_correo SMALLINT NOT NULL DEFAULT 0,
      creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query("CREATE INDEX IF NOT EXISTS api_eventos_inicio_idx ON api_eventos (inicio DESC)");
  await pool.query("CREATE INDEX IF NOT EXISTS api_eventos_abiertos_idx ON api_eventos (fin) WHERE fin IS NULL");
  await restaurarAbiertos();
  tablaLista = true;
  console.log(`[MODBUS-EVENTO] base de eventos lista (${CFG.db.host}/${CFG.db.database})`);
  return true;
}

function encolarDb(sql, params) {
  if (!dbActiva()) return;
  if (colaDb.length >= MAX_COLA_DB) colaDb.shift();
  colaDb.push({ sql, params });
}

let vaciando = false;
async function vaciarColaDb() {
  if (!dbActiva() || vaciando || colaDb.length === 0) return;
  vaciando = true;
  try {
    await prepararTabla();
    while (colaDb.length > 0) {
      const op = colaDb[0];
      await pool.query(op.sql, op.params);
      colaDb.shift();
    }
  } catch (err) {
    const ahora = Date.now();
    if (ahora - (vaciarColaDb.ultimoAviso || 0) > 600000) {
      console.error(`[MODBUS-EVENTO] no se pudo guardar en la base de eventos (${colaDb.length} pendientes): ${err.message}`);
      vaciarColaDb.ultimoAviso = ahora;
    }
  } finally {
    vaciando = false;
  }
}

function guardarApertura(ev) {
  encolarDb(
    `INSERT INTO api_eventos (codigo, sede, evento, severidad, dispositivo, inventario, inicio, detalle)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (codigo) DO NOTHING`,
    [ev.codigo, CFG.sede, ev.evento, ev.severidad, ev.dispositivo || null, ev.inventario || null, iso(ev.inicio), JSON.stringify(ev.detalle || {})]
  );
}

function guardarCierre(ev) {
  encolarDb(
    `UPDATE api_eventos SET fin = $2, duracion_s = $3, detalle = $4 WHERE codigo = $1`,
    [ev.codigo, iso(ev.fin), Math.round((ev.fin - ev.inicio) / 1000), JSON.stringify(ev.detalle || {})]
  );
}

function guardarNotificacion(ev, campo) {
  encolarDb(
    `UPDATE api_eventos SET ${campo === "cierre" ? "cierre_notificado_en" : "notificado_en"} = now(), intentos_correo = intentos_correo + 1 WHERE codigo = $1`,
    [ev.codigo]
  );
}

async function limpiarAntiguos() {
  if (!dbActiva() || !tablaLista) return;
  try {
    const r = await pool.query(
      `DELETE FROM api_eventos WHERE fin IS NOT NULL AND inicio < now() - ($1 || ' months')::interval`,
      [String(CFG.retencionMeses)]
    );
    if (r.rowCount > 0) console.log(`[MODBUS-EVENTO] limpieza: ${r.rowCount} eventos de más de ${CFG.retencionMeses} meses eliminados`);
  } catch (err) {
    console.error("[MODBUS-EVENTO] error en limpieza de eventos:", err.message);
  }
}

// ------------------------------------------------------
//  Correo
// ------------------------------------------------------
let transporte = null;
let correoMotivoInactivo = null;
const colaCorreo = []; // { ev, tipo: 'apertura'|'cierre'|'recordatorio'|'grupo'|'resumen'|'prueba', asunto, texto, intentos }
const enviadosUltimaHora = [];

function prepararTransporte() {
  if (transporte) return transporte;
  if (!CFG.correo.activo) {
    correoMotivoInactivo = "ALERTAS_CORREO_ACTIVO no está en true";
    return null;
  }
  if (!CFG.correo.host || !CFG.correo.para) {
    correoMotivoInactivo = "faltan SMTP_HOST o ALERTAS_CORREO_PARA";
    return null;
  }
  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch (_) {
    correoMotivoInactivo = "falta instalar nodemailer (npm install nodemailer)";
    return null;
  }
  transporte = nodemailer.createTransport({
    host: CFG.correo.host,
    port: CFG.correo.port,
    secure: CFG.correo.secure,
    auth: CFG.correo.user ? { user: CFG.correo.user, pass: CFG.correo.pass } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000
  });
  correoMotivoInactivo = null;
  return transporte;
}

function textoEvento(ev, tipo) {
  const guia = GUIA[ev.evento] || {};
  const lineas = [];
  lineas.push(`Sede:            ${CFG.sede}`);
  if (ev.dispositivo) lineas.push(`Dispositivo:     ${ev.dispositivo}${ev.inventario ? ` (inventario ${ev.inventario})` : ""}`);
  if (ev.detalle?.area) lineas.push(`Ubicación:       ${ev.detalle.area}`);
  lineas.push(`Evento:          ${ev.evento} - ${guia.titulo || ""}`);
  lineas.push(`Severidad:       ${SEVERIDAD_TEXTO[ev.severidad] || ev.severidad}`);
  lineas.push(`Desde:           ${horaLocal(ev.inicio)} (${CFG.zona})`);
  if (tipo === "cierre") {
    lineas.push(`Hasta:           ${horaLocal(ev.fin)}`);
    lineas.push(`Duración:        ${duracionTexto(ev.fin - ev.inicio)}`);
  } else {
    lineas.push(`Lleva:           ${duracionTexto(Date.now() - ev.inicio)}`);
  }
  if (ev.detalle?.mensaje) lineas.push(`Detalle:         ${ev.detalle.mensaje}`);
  if (tipo !== "cierre") {
    const causa = ev.detalle?.causa || guia.causa;
    if (causa) lineas.push("", `Causa probable:  ${causa}`);
    if (guia.accion?.length) {
      lineas.push("", "Qué hacer:");
      guia.accion.forEach((a, i) => lineas.push(`  ${i + 1}. ${a}`));
    }
  } else {
    lineas.push("", "El evento se cerró: los datos volvieron a la normalidad.");
  }
  lineas.push("", `Estado de la lectura del EBO: ${estadoGeneral().estado} (última lectura buena: ${horaLocal(st.ultimaOk)})`);
  if (CFG.urlEstado) lineas.push(`Estado en vivo:  ${CFG.urlEstado}`);
  lineas.push(`Id. de evento:   ${ev.codigo}`);
  return lineas.join("\n");
}

function asuntoEvento(ev, tipo) {
  const guia = GUIA[ev.evento] || {};
  const pref = tipo === "cierre" ? "[RESUELTO]" : tipo === "recordatorio" ? `[RECORDATORIO ${SEVERIDAD_TEXTO[ev.severidad]}]` : `[${SEVERIDAD_TEXTO[ev.severidad]}]`;
  const tituloEv = (tipo === "cierre" && guia.tituloCierre) || guia.titulo || ev.evento;
  return `${pref} SIASA ${CFG.sede}${ev.dispositivo ? ` - ${ev.inventario ? `${ev.inventario} ` : ""}${ev.dispositivo}` : ""} - ${tituloEv}`;
}

const EBO_TEXTO = `${env.MODBUS_NAME || env.MODBUS_SITE_NAME || "EBO"} ${env.MODBUS_HOST || "10.0.6.26"}:${env.MODBUS_PORT || 502}`;

function urlsCorreo() {
  return { monitoreo: CFG.urlMonitoreo || null, estado: CFG.urlEstado || null };
}

// Ficha del medidor tal como está en este momento (características y última lectura).
function datosDispositivo(nombreOInventario) {
  if (!nombreOInventario) return null;
  const buscado = String(nombreOInventario).toLowerCase();
  for (const [id, m] of st.medidores) {
    if ([id, m.nombre, m.inventario].some((x) => x && String(x).toLowerCase() === buscado)) {
      return { id, nombre: m.nombre, online: m.online, generador: m.generador || null, info: m.info || {}, metricas: m.metricas || {}, fuente: EBO_TEXTO, momento: horaLocal(m.ultimaVez) };
    }
  }
  return null;
}

function datosLectura() {
  return {
    ebo: EBO_TEXTO,
    ultimaOk: horaLocal(st.ultimaOk),
    ultimoError: st.ultimoError,
    fallas: st.fallasConsecutivas,
    medidores: st.medidores.size ? `${st.medidores.size} (todos los de la sede)` : null
  };
}

function htmlEvento(ev, tipo, { prueba = false, dispositivo = undefined } = {}) {
  return plantilla.correoEvento({
    tipo,
    ev,
    guia: GUIA[ev.evento] || {},
    sede: CFG.sede,
    horaLocal,
    duracionTexto,
    estadoTexto: estadoGeneral().estado,
    dispositivo: dispositivo !== undefined ? dispositivo : datosDispositivo(ev.dispositivo),
    lectura: datosLectura(),
    urls: urlsCorreo(),
    prueba
  });
}

function encolarCorreo(item) {
  // El HTML se arma al momento del evento, con los datos de ese instante.
  if (!item.html) {
    try {
      if (item.ev && ["apertura", "cierre", "recordatorio"].includes(item.tipo)) {
        item.html = htmlEvento(item.ev, item.tipo);
      } else if (item.eventos && /^grupo/.test(item.tipo)) {
        item.html = plantilla.correoGrupo({
          tipo: item.tipo === "grupo-cierre" ? "cierre" : "apertura",
          severidad: item.tipo === "grupo-advertencia" ? "advertencia" : "critico",
          eventos: item.eventos,
          sede: CFG.sede,
          horaLocal,
          duracionTexto,
          estadoTexto: estadoGeneral().estado,
          urls: urlsCorreo(),
          acciones: (GUIA[item.eventos[0]?.evento] || {}).accion
        });
      }
    } catch (err) {
      console.error("[MODBUS-EVENTO] no se pudo armar el HTML del correo:", err.message);
    }
  }
  colaCorreo.push({ intentos: 0, ...item });
}

async function procesarCorreos() {
  if (colaCorreo.length === 0) return;
  const t = prepararTransporte();
  if (!t) return; // quedan en cola; el estado muestra el motivo
  const ahora = Date.now();
  while (enviadosUltimaHora.length && ahora - enviadosUltimaHora[0] > 3600000) enviadosUltimaHora.shift();

  while (colaCorreo.length > 0) {
    if (enviadosUltimaHora.length >= CFG.maxCorreosPorHora) {
      if (ahora - (procesarCorreos.avisoLimite || 0) > 3600000) {
        logEvento({ evento: "LIMITE_CORREOS", pendientes: colaCorreo.length });
        procesarCorreos.avisoLimite = ahora;
      }
      return;
    }
    const item = colaCorreo[0];
    try {
      await t.sendMail({
        from: CFG.correo.de,
        to: CFG.correo.para,
        cc: CFG.correo.cc || undefined,
        subject: item.asunto,
        text: item.texto,
        html: item.html || undefined
      });
      colaCorreo.shift();
      enviadosUltimaHora.push(Date.now());
      if (item.ev && item.tipo === "apertura") guardarNotificacion(item.ev, "apertura");
      if (item.ev && item.tipo === "cierre") guardarNotificacion(item.ev, "cierre");
      (item.eventos || []).forEach((ev) => guardarNotificacion(ev, item.tipo === "grupo-cierre" ? "cierre" : "apertura"));
      logEvento({ evento: "CORREO_ENVIADO", tipo: item.tipo, asunto: item.asunto });
    } catch (err) {
      item.intentos += 1;
      logEvento({ evento: "CORREO_FALLIDO", tipo: item.tipo, intentos: item.intentos, error: err.message });
      if (item.intentos >= 50) colaCorreo.shift();
      return; // reintenta en el siguiente ciclo
    }
  }
}

// ------------------------------------------------------
//  Apertura y cierre de eventos
// ------------------------------------------------------
// Correos de medidores que se acumulan durante una evaluación para poder agruparlos.
const pendientesMedidores = { apertura: [], cierre: [] };
const MIN_PARA_AGRUPAR = 3;

function abrir(evento, severidad, { dispositivo = null, inventario = null, detalle = {}, inicio = Date.now(), clave = null, diferir = false, notificar = false } = {}) {
  const k = clave || `${evento}|${dispositivo || ""}`;
  if (abiertos.has(k)) return abiertos.get(k);
  const ev = { codigo: nuevoCodigo(inicio), evento, severidad, dispositivo, inventario, inicio, detalle, notificado: false, ultimoAviso: null };
  abiertos.set(k, ev);
  logEvento({ evento, accion: "abierto", severidad, codigo: ev.codigo, dispositivo, inventario, inicio: iso(inicio), ...detalle });
  guardarApertura(ev);
  if (severidad === "critico" || notificar) {
    if (diferir) pendientesMedidores.apertura.push(ev);
    else encolarCorreo({ ev, tipo: "apertura", asunto: asuntoEvento(ev, "apertura"), texto: textoEvento(ev, "apertura") });
    ev.notificado = true;
    ev.notificadoEn = Date.now();
    ev.ultimoAviso = Date.now();
  }
  return ev;
}

function cerrar(evento, dispositivo = null, detalleExtra = {}, { diferir = false, silencioso = false } = {}) {
  const k = `${evento}|${dispositivo || ""}`;
  const ev = abiertos.get(k);
  if (!ev) return null;
  abiertos.delete(k);
  ev.fin = Date.now();
  ev.detalle = { ...ev.detalle, ...detalleExtra };
  logEvento({ evento, accion: "cerrado", codigo: ev.codigo, dispositivo, duracion_s: Math.round((ev.fin - ev.inicio) / 1000), ...detalleExtra });
  guardarCierre(ev);
  if (ev.notificado && !silencioso) {
    if (diferir) pendientesMedidores.cierre.push(ev);
    else encolarCorreo({ ev, tipo: "cierre", asunto: asuntoEvento(ev, "cierre"), texto: textoEvento(ev, "cierre") });
  }
  return ev;
}

// Si varios medidores fallan a la vez (el EBO perdió el bus, por ejemplo), se manda un solo correo.
function enviarPendientesMedidores() {
  ["apertura", "cierre"].forEach((tipo) => {
    const lista = pendientesMedidores[tipo].splice(0);
    if (lista.length === 0) return;
    if (lista.length < MIN_PARA_AGRUPAR) {
      lista.forEach((ev) => encolarCorreo({ ev, tipo, asunto: asuntoEvento(ev, tipo), texto: textoEvento(ev, tipo) }));
      return;
    }
    const primero = lista[0];
    const guia = GUIA[primero.evento] || {};
    const lineas = [
      tipo === "cierre"
        ? `${lista.length} medidores volvieron a la normalidad en ${CFG.sede}.`
        : `${lista.length} medidores presentan eventos al mismo tiempo en ${CFG.sede}. Cuando fallan varios a la vez, lo más probable es una falla común: el EBO perdió comunicación con el bus de medidores, o la AS-P tiene un problema.`,
      ""
    ];
    lista.forEach((ev) => {
      lineas.push(`  - ${ev.inventario ? `${ev.inventario} ` : ""}${ev.dispositivo}: ${ev.evento} desde ${horaLocal(ev.inicio)}${tipo === "cierre" ? `, duró ${duracionTexto(ev.fin - ev.inicio)}` : ""} (${ev.codigo})`);
    });
    if (tipo !== "cierre" && guia.accion?.length) {
      lineas.push("", "Qué hacer:");
      lineas.push("  1. Revisar en WorkStation el estado de comunicación de los medidores y del bus RS-485 de la AS-P.");
      guia.accion.forEach((a, i) => lineas.push(`  ${i + 2}. ${a}`));
    }
    lineas.push("", `Estado de la lectura del EBO: ${estadoGeneral().estado} (última lectura buena: ${horaLocal(st.ultimaOk)})`);
    if (CFG.urlEstado) lineas.push(`Estado en vivo:  ${CFG.urlEstado}`);
    const asunto = tipo === "cierre"
      ? `[RESUELTO] SIASA ${CFG.sede} - ${lista.length} medidores normalizados`
      : `[CRÍTICO] SIASA ${CFG.sede} - ${lista.length} medidores con eventos (posible falla común del EBO)`;
    encolarCorreo({ tipo: `grupo-${tipo}`, asunto, texto: lineas.join("\n"), eventos: lista });
  });
}

function registrarPuntual(evento, severidad, detalle = {}) {
  // Evento sin duración (reinicios): se abre y se cierra en el mismo momento.
  const ev = abrir(evento, severidad, { detalle, clave: `${evento}|${Date.now()}|${Math.random()}` });
  for (const [k, v] of abiertos) if (v === ev) abiertos.delete(k);
  ev.fin = ev.inicio;
  guardarCierre(ev);
  return ev;
}

// ------------------------------------------------------
//  Evaluación
// ------------------------------------------------------
function firmaMetricas(metrics) {
  const partes = [];
  Object.keys(metrics || {}).sort().forEach((k) => {
    if (/transfer|status|count/i.test(k)) return;
    const m = metrics[k];
    const v = m && typeof m === "object" && "value" in m ? m.value : m;
    if (typeof v === "number" || (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))) {
      partes.push(`${k}=${Number(v)}`);
    }
  });
  return partes.join("|");
}

function voltajesEnCero(metrics) {
  const volt = Object.keys(metrics || {}).filter((k) => /volt/i.test(k) && !/unbalance|thd|desbal/i.test(k));
  if (volt.length === 0) return false;
  return volt.every((k) => {
    const m = metrics[k];
    const v = Number(m && typeof m === "object" && "value" in m ? m.value : m);
    return Number.isFinite(v) && Math.abs(v) < 1;
  });
}

// Misma estructura de métricas con los valores en 0 (y los indicadores booleanos en false).
function metricasEnCero(metrics) {
  const cero = (v) => (typeof v === "boolean" ? false : typeof v === "number" || Number.isFinite(Number(v)) ? 0 : v);
  const salida = {};
  Object.entries(metrics || {}).forEach(([k, m]) => {
    salida[k] = m && typeof m === "object" && "value" in m ? { ...m, value: cero(m.value) } : cero(m);
  });
  return salida;
}

function esMedidorGenerador(id, nombre, inventario) {
  if (CFG.medidoresGenerador.length === 0) return false;
  return [id, nombre, inventario].some((x) => x && CFG.medidoresGenerador.includes(String(x).toLowerCase()));
}

function evaluarMedidores(raw, ahora) {
  // Al arrancar se espera a recuperar de la base los eventos abiertos (unos segundos) para no repetir correos.
  if (!restauracionLista) {
    if (!dbActiva() || ahora - inicioProceso > CFG.esperaRestauracionMs) restauracionLista = true;
    else return;
  }
  const devices = raw?.modbus_ebo?.devices || {};
  Object.entries(devices).forEach(([id, d]) => {
    if (!/^(ion_7400|pm_2130)/.test(String(id))) return;
    const nombre = d?.name || id;
    const inventario = d?.code_inventory || null;
    let online = d?.status === "online" || d?.status === true || d?.status === "true" || d?.online === true;
    const firma = firmaMetricas(d?.metrics);
    let m = st.medidores.get(id);
    if (!m) {
      m = { nombre, inventario, area: d?.area || null, firma, cambioEn: ahora, offlineDesde: null, ceroDesde: null };
      // Evento abierto antes del reinicio: se continúa desde su inicio (sin nuevo correo de apertura).
      const previo = restaurados.get(nombre) || {};
      const desde = previo.MEDIDOR_FUERA_DE_LINEA?.inicio ?? previo.MEDIDOR_SIN_CAMBIO?.inicio;
      if (desde != null) m.cambioEn = desde;
      if (previo.MEDIDOR_FUERA_DE_LINEA) m.offlineDesde = previo.MEDIDOR_FUERA_DE_LINEA.inicio;
      if (previo.MEDIDOR_EN_CERO) m.ceroDesde = previo.MEDIDOR_EN_CERO.inicio;
      restaurados.delete(nombre);
      st.medidores.set(id, m);
    }
    if (firma && firma !== m.firma) {
      m.firma = firma;
      m.cambioEn = ahora;
    }

    // Valores retenidos por el EBO: la lectura Modbus responde, pero el medidor no entrega datos nuevos.
    // Se marca fuera de línea en la lectura (la respuesta de la API y el correo usan este estado).
    // No aplica con voltajes en cero (eso es MEDIDOR_EN_CERO, con el medidor comunicando).
    const congelado = online && CFG.offlinePorCongeladoMs > 0 && Boolean(firma) &&
      !voltajesEnCero(d?.metrics) && ahora - m.cambioEn >= CFG.offlinePorCongeladoMs;
    if (congelado) {
      online = false;
      d.status = "offline";
      d.online = false;
      d.error = `Sin datos nuevos desde ${horaLocal(m.cambioEn)}: el EBO repite el último valor (medidor sin comunicación).`;
      d.metrics = metricasEnCero(d.metrics); // no se entrega el último valor retenido
    }

    m.nombre = nombre;
    m.inventario = inventario;
    m.area = d?.area || m.area;
    m.online = online;
    m.ultimaVez = ahora;
    m.info = {
      type: d?.type, model: d?.model, area: d?.area, building: d?.building, floor: d?.floor, room: d?.room,
      group: d?.group, fase_energy: d?.fase_energy, capacity: d?.capacity, code_inventory: d?.code_inventory
    };
    m.metricas = d?.metrics || {};
    const base = { dispositivo: nombre, inventario, detalle: { area: m.area } };

    // Fuera de línea
    if (!online) {
      // Con valores retenidos, el medidor está fuera de línea desde su último cambio.
      if (!m.offlineDesde) m.offlineDesde = congelado ? m.cambioEn : ahora;
      if (ahora - m.offlineDesde >= CFG.fueraDeLineaMs) {
        const mensaje = congelado
          ? `El medidor no entrega datos nuevos desde hace ${duracionTexto(ahora - m.offlineDesde)}: el EBO lo reporta sin comunicación y repite el último valor.`
          : `El EBO reporta el medidor fuera de línea desde hace ${duracionTexto(ahora - m.offlineDesde)}.`;
        abrir("MEDIDOR_FUERA_DE_LINEA", "critico", { ...base, diferir: true, inicio: m.offlineDesde, detalle: { ...base.detalle, mensaje } });
      }
      return; // sin datos válidos: no se evalúa lo demás
    }
    if (m.offlineDesde) {
      m.offlineDesde = null;
      cerrar("MEDIDOR_FUERA_DE_LINEA", nombre, {}, { diferir: true });
    }

    const enCero = voltajesEnCero(d?.metrics);

    // Sin cambio (solo se alcanza si ALERTA_SIN_CAMBIO_MIN es menor que ALERTA_OFFLINE_SIN_CAMBIO_MIN, o esa regla está en 0).
    // Con 0 V las métricas no cambian por definición: eso lo cubre MEDIDOR_EN_CERO (o el modo generador).
    if (firma && (m.cambioEn === ahora || enCero)) {
      cerrar("MEDIDOR_SIN_CAMBIO", nombre, {}, { diferir: true, silencioso: enCero });
    } else if (firma && ahora - m.cambioEn >= CFG.sinCambioMs) {
      abrir("MEDIDOR_SIN_CAMBIO", "critico", { ...base, diferir: true, inicio: m.cambioEn, detalle: { ...base.detalle, mensaje: `Todas las métricas idénticas desde hace ${duracionTexto(ahora - m.cambioEn)}.` } });
    }

    // Medidor de generador: con 0 V está en espera (no es falla); con voltaje, el generador está en marcha.
    if (esMedidorGenerador(id, nombre, inventario)) {
      if (cerrar("MEDIDOR_EN_CERO", nombre, { reclasificado: "medidor de generador: 0 V con el generador apagado" }, { silencioso: true })) {
        m.ceroDesde = null;
      }
      const estadoLeido = enCero ? "apagado" : "en_marcha";
      if (!m.generador) m.generador = estadoLeido; // primera lectura: se toma tal cual
      if (estadoLeido === m.generador) {
        m.generadorCandidatoDesde = null;
      } else {
        // El cambio se confirma tras ALERTA_GENERADOR_CONFIRMACION_S seguidos (evita avisos por picos de lectura).
        if (!m.generadorCandidatoDesde) m.generadorCandidatoDesde = ahora;
        if (ahora - m.generadorCandidatoDesde >= CFG.generadorConfirmacionMs) {
          m.generador = estadoLeido;
          m.generadorCandidatoDesde = null;
        }
      }
      if (m.generador === "en_marcha") {
        abrir("GENERADOR_EN_MARCHA", "info", {
          ...base,
          notificar: CFG.generadorCorreo,
          inicio: m.generadorDesde || ahora,
          detalle: { ...base.detalle, mensaje: `El generador está en marcha: ${inventario ? `${inventario} ` : ""}${nombre} registra voltaje. Este medidor solo mide con el generador encendido.` }
        });
        if (!m.generadorDesde) m.generadorDesde = ahora;
      } else {
        m.generadorDesde = null;
        cerrar("GENERADOR_EN_MARCHA", nombre, { mensaje_cierre: "El generador se apagó: el medidor volvió a 0 V (en espera)." });
      }
      return;
    }

    // Voltaje en cero
    if (enCero) {
      if (!m.ceroDesde) m.ceroDesde = ahora;
      if (ahora - m.ceroDesde >= CFG.enCeroMs) {
        abrir("MEDIDOR_EN_CERO", "critico", { ...base, diferir: true, inicio: m.ceroDesde, detalle: { ...base.detalle, mensaje: "Voltajes de todas las fases en 0 V." } });
      }
    } else if (m.ceroDesde) {
      m.ceroDesde = null;
      cerrar("MEDIDOR_EN_CERO", nombre, {}, { diferir: true });
    }
  });
  enviarPendientesMedidores();
}

function estadoGeneral(ahora = Date.now()) {
  const antig = st.ultimaOk ? ahora - st.ultimaOk : ahora - inicioProceso;
  let estado = "ok";
  let motivo = null;
  if (!st.ultimaOk && ahora - inicioProceso < CFG.degradadoMs) {
    estado = "iniciando";
  } else if (antig >= CFG.congeladoMs) {
    estado = "congelado";
    motivo = `sin lectura buena desde hace ${duracionTexto(antig)}`;
  } else if (antig >= CFG.degradadoMs) {
    estado = "degradado";
    motivo = `sin lectura buena desde hace ${duracionTexto(antig)}`;
  } else if (st.duracionUltimaMs != null && st.duracionUltimaMs >= CFG.lentaMs) {
    estado = "lento";
    motivo = `la última lectura tardó ${duracionTexto(st.duracionUltimaMs)}`;
  }
  if (estado === "ok" && [...abiertos.values()].some((e) => e.evento === "MEDIDOR_SIN_CAMBIO")) {
    estado = "sin_cambio";
    motivo = "uno o más medidores con valores idénticos";
  }
  return { estado, motivo, antiguedadMs: antig };
}

function evaluarPeriodico() {
  const ahora = Date.now();
  const g = estadoGeneral(ahora);
  const enCurso = st.dependencias.obtenerEnCursoDesde ? st.dependencias.obtenerEnCursoDesde() : st.enCursoDesde;

  // Datos congelados (solo cuenta un error ocurrido después de la última lectura buena)
  if (g.estado === "congelado") {
    const errorVigente = st.ultimoErrorEn && (!st.ultimaOk || st.ultimoErrorEn > st.ultimaOk) ? st.ultimoError : null;
    abrir("DATOS_CONGELADOS", "critico", {
      inicio: st.ultimaOk || inicioProceso,
      detalle: {
        mensaje: `La API no obtiene lecturas nuevas del EBO desde ${horaLocal(st.ultimaOk || inicioProceso)}.`,
        causa: causaPorError(errorVigente, Boolean(enCurso)),
        ultimo_error: errorVigente
      }
    });
  }

  // Lectura atascada + vigilante
  if (enCurso && ahora - enCurso >= CFG.atascadaMs) {
    const ev = abrir("LECTURA_ATASCADA", "advertencia", { inicio: enCurso, detalle: { mensaje: `Lectura en curso desde hace ${duracionTexto(ahora - enCurso)}.` } });
    if (!ev.reconectadoEn || ahora - ev.reconectadoEn >= CFG.atascadaMs) {
      ev.reconectadoEn = ahora;
      logEvento({ evento: "VIGILANTE_RECONEXION", en_curso_s: Math.round((ahora - enCurso) / 1000) });
      if (st.dependencias.reconectar) {
        Promise.resolve().then(() => st.dependencias.reconectar("vigilante: lectura atascada")).catch(() => {});
      }
    }
    if (CFG.vigilanteReinicio && !st.saliendo && ahora - enCurso >= CFG.reinicioAtascadaMs) {
      st.saliendo = true;
      registrarPuntual("VIGILANTE_REINICIO", "critico", { mensaje: `Lectura atascada ${duracionTexto(ahora - enCurso)}: se reinicia el proceso.` });
      // Da tiempo a guardar el evento y a enviar el correo antes de salir; Docker (restart: always) levanta la API.
      setTimeout(() => {
        Promise.allSettled([vaciarColaDb(), procesarCorreos()]).finally(() => process.exit(1));
      }, 3000);
    }
  } else if (!enCurso && abiertos.has("LECTURA_ATASCADA|")) {
    cerrar("LECTURA_ATASCADA");
  }

  // Reconexiones frecuentes
  if (st.dependencias.obtenerTotalReconexiones) {
    const total = st.dependencias.obtenerTotalReconexiones();
    const nuevas = Math.max(0, total - st.ultimoTotalReset);
    st.ultimoTotalReset = total;
    for (let i = 0; i < nuevas; i++) st.reconexiones.push(ahora);
  }
  while (st.reconexiones.length && ahora - st.reconexiones[0] > 3600000) st.reconexiones.shift();
  if (st.reconexiones.length > CFG.reconexionesPorHora) {
    abrir("RECONEXIONES_FRECUENTES", "advertencia", { detalle: { mensaje: `${st.reconexiones.length} reconexiones en la última hora.` } });
  } else if (st.reconexiones.length <= Math.floor(CFG.reconexionesPorHora / 2)) {
    cerrar("RECONEXIONES_FRECUENTES", null, { reconexiones_ultima_hora: st.reconexiones.length });
  }

  // Recordatorios de críticos abiertos
  for (const ev of abiertos.values()) {
    if (CFG.recordatorioMs > 0 && ev.severidad === "critico" && ev.notificado && ev.ultimoAviso && ahora - ev.ultimoAviso >= CFG.recordatorioMs) {
      ev.ultimoAviso = ahora;
      encolarCorreo({ ev, tipo: "recordatorio", asunto: asuntoEvento(ev, "recordatorio"), texto: textoEvento(ev, "recordatorio") });
    }
  }
}

function agruparAdvertencias() {
  const pendientes = [...abiertos.values()].filter((e) => e.severidad === "advertencia" && !e.notificado);
  if (pendientes.length === 0) return;
  pendientes.forEach((e) => { e.notificado = true; e.notificadoEn = Date.now(); e.ultimoAviso = Date.now(); });
  const texto = pendientes.map((e) => textoEvento(e, "apertura")).join("\n\n------------------------------\n\n");
  encolarCorreo({
    tipo: "grupo-advertencia",
    asunto: `[ADVERTENCIA] SIASA ${CFG.sede} - ${pendientes.length} advertencia(s)`,
    texto,
    eventos: pendientes,
    html: pendientes.length === 1 ? htmlEvento(pendientes[0], "apertura") : undefined
  });
}

function minutosLocales(ms) {
  try {
    const partes = new Intl.DateTimeFormat("en-GB", { timeZone: CFG.zona, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
    const [h, m] = partes.split(":").map(Number);
    return h * 60 + m;
  } catch (_) {
    const d = new Date(ms);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

// Resumen de la sede (estado, eventos abiertos y medidores). Se consulta en GET /api/ebo/modbus-auto/resumen
// y, con ALERTA_RESUMEN_DIARIO_CORREO=true, también se envía por correo a la hora del resumen diario.
function armarResumen(ahora = Date.now()) {
  const dia = new Date(ahora).toLocaleDateString("en-CA", { timeZone: CFG.zona });
  const g = estadoGeneral(ahora);
  const lineas = [
    `Resumen diario de la lectura del EBO - ${CFG.sede}`,
    `Fecha: ${horaLocal(ahora)}`,
    "",
    `Estado actual: ${g.estado}${g.motivo ? ` (${g.motivo})` : ""}`,
    `Última lectura buena: ${horaLocal(st.ultimaOk)}`,
    `Eventos abiertos: ${abiertos.size}`
  ];
  for (const e of abiertos.values()) lineas.push(`  - ${e.evento}${e.dispositivo ? ` ${e.dispositivo}` : ""} desde ${horaLocal(e.inicio)} (${e.codigo})`);
  lineas.push("", "Medidores:");
  for (const m of st.medidores.values()) {
    const estadoTxt = !m.online ? "fuera de línea"
      : m.generador === "apagado" ? "en espera (mide solo con el generador encendido; generador apagado)"
      : m.generador === "en_marcha" ? "en línea (generador en marcha)"
      : "en línea";
    lineas.push(`  - ${m.nombre}${m.inventario ? ` (${m.inventario})` : ""}: ${estadoTxt}, último cambio ${horaLocal(m.cambioEn)}`);
  }
  lineas.push("", "Si el centro de monitoreo no recibe este resumen a la hora habitual, la API o el servidor de la sede está caído.");
  if (CFG.urlEstado) lineas.push(`Estado en vivo: ${CFG.urlEstado}`);
  return {
    asunto: `[RESUMEN] SIASA ${CFG.sede} - ${g.estado.toUpperCase()}`,
    texto: lineas.join("\n"),
    html: plantilla.correoResumen({
      sede: CFG.sede,
      fecha: dia,
      estado: g.estado,
      motivo: g.motivo,
      ultimaOk: horaLocal(st.ultimaOk),
      abiertos: [...abiertos.values()],
      medidores: [...st.medidores.values()],
      urls: urlsCorreo(),
      horaLocal
    })
  };
}

let ultimoResumenDia = null;
function quizasResumenDiario() {
  const [hh, mm] = CFG.resumenDiarioHora.split(":").map(Number);
  const objetivo = (hh || 0) * 60 + (mm || 0);
  const ahora = Date.now();
  const dia = new Date(ahora).toLocaleDateString("en-CA", { timeZone: CFG.zona });
  const min = minutosLocales(ahora);
  if (min < objetivo || min > objetivo + 10 || ultimoResumenDia === dia) return;
  ultimoResumenDia = dia;
  if (CFG.resumenDiarioCorreo) encolarCorreo({ tipo: "resumen", ...armarResumen(ahora) });
  limpiarAntiguos();
}

function resumenLog() {
  const prom = st.lecturasOk > 0 ? Math.round(st.sumaDuracionMs / st.lecturasOk) : null;
  const g = estadoGeneral();
  logEvento({
    evento: "RESUMEN",
    estado: g.estado,
    lecturas_ok: st.lecturasOk,
    lecturas_fallidas: st.lecturasFallidas,
    duracion_promedio_ms: prom,
    reconexiones_ultima_hora: st.reconexiones.length,
    eventos_abiertos: abiertos.size,
    pendientes_db: colaDb.length,
    pendientes_correo: colaCorreo.length
  });
  st.lecturasOk = 0;
  st.lecturasFallidas = 0;
  st.sumaDuracionMs = 0;
}

// ------------------------------------------------------
//  API pública
// ------------------------------------------------------
function inicioLectura() {
  st.enCursoDesde = Date.now();
  st.ultimoIntento = st.enCursoDesde;
}

function lecturaOk(raw, duracionMs) {
  const ahora = Date.now();
  st.enCursoDesde = null;
  st.ultimaOk = ahora;
  st.fallasConsecutivas = 0;
  st.duracionUltimaMs = duracionMs ?? null;
  st.lecturasOk += 1;
  st.sumaDuracionMs += duracionMs || 0;
  if (duracionMs != null && duracionMs >= CFG.lentaMs && ahora - st.ultimoLogLentaAt > 60000) {
    st.ultimoLogLentaAt = ahora;
    logEvento({ evento: "LECTURA_LENTA", duracion_ms: duracionMs });
  }
  if (abiertos.has("DATOS_CONGELADOS|")) {
    cerrar("DATOS_CONGELADOS", null, { recuperado_en: iso(ahora) });
  }
  if (abiertos.has("LECTURA_ATASCADA|")) cerrar("LECTURA_ATASCADA");
  evaluarMedidores(raw, ahora);
}

function lecturaFallida(error, duracionMs) {
  const ahora = Date.now();
  st.enCursoDesde = null;
  st.ultimoError = String(error?.message || error || "error desconocido");
  st.ultimoErrorEn = ahora;
  st.fallasConsecutivas += 1;
  st.duracionUltimaMs = duracionMs ?? null;
  st.lecturasFallidas += 1;
  if (st.fallasConsecutivas === 1 || ahora - st.ultimoLogFallaAt >= 60000) {
    st.ultimoLogFallaAt = ahora;
    logEvento({ evento: "LECTURA_FALLIDA", error: st.ultimoError, fallas_consecutivas: st.fallasConsecutivas });
  }
}

function obtenerEstado() {
  const ahora = Date.now();
  const g = estadoGeneral(ahora);
  const enCurso = st.dependencias.obtenerEnCursoDesde ? st.dependencias.obtenerEnCursoDesde() : st.enCursoDesde;
  const porDispositivo = new Map();
  for (const e of abiertos.values()) if (e.dispositivo) porDispositivo.set(e.dispositivo, e);
  return {
    sede: CFG.sede,
    estado: g.estado,
    motivo: g.motivo,
    ultima_lectura_ok: iso(st.ultimaOk),
    antiguedad_s: Math.round(g.antiguedadMs / 1000),
    ultimo_intento: iso(st.ultimoIntento),
    ultimo_error: st.ultimoError,
    ultimo_error_en: iso(st.ultimoErrorEn),
    fallas_consecutivas: st.fallasConsecutivas,
    lectura_en_curso_desde: iso(enCurso),
    duracion_ultima_lectura_ms: st.duracionUltimaMs,
    reconexiones_ultima_hora: st.reconexiones.length,
    eventos_abiertos: [...abiertos.values()].map((e) => ({
      codigo: e.codigo, evento: e.evento, severidad: e.severidad, dispositivo: e.dispositivo, inventario: e.inventario, desde: iso(e.inicio)
    })),
    dispositivos: [...st.medidores.entries()].map(([id, m]) => {
      const ev = porDispositivo.get(m.nombre);
      let estado = m.online ? "ok" : "fuera_de_linea";
      if (m.online && m.generador === "apagado") estado = "en_espera_generador_apagado";
      if (m.online && m.generador === "en_marcha") estado = "generador_en_marcha";
      if (ev?.evento === "MEDIDOR_SIN_CAMBIO") estado = "sin_cambio";
      if (ev?.evento === "MEDIDOR_EN_CERO") estado = "en_cero";
      return {
        id, nombre: m.nombre, inventario: m.inventario, area: m.area, estado,
        ...(m.generador ? { medidor_de_generador: true } : {}),
        ultimo_cambio: iso(m.cambioEn), evento: ev?.codigo || null
      };
    }),
    base_de_eventos: dbActiva() ? (tablaLista ? "ok" : "sin conexion") : "desactivada",
    pendientes_base: colaDb.length,
    correo: prepararTransporte() ? "activo" : `desactivado: ${correoMotivoInactivo}`,
    pendientes_correo: colaCorreo.length,
    proceso_iniciado: iso(inicioProceso)
  };
}

function infoLectura() {
  const g = estadoGeneral();
  return {
    scanned_at: iso(st.ultimaOk),
    antiguedad_s: Math.round(g.antiguedadMs / 1000),
    estado: g.estado,
    stale: g.estado === "degradado" || g.estado === "congelado"
  };
}

function debeResponder503() {
  return CFG.responder503 && estadoGeneral().estado === "congelado";
}

async function consultarEventos({ desde, hasta, dispositivo, abiertos: soloAbiertos, limite } = {}) {
  if (!dbActiva()) {
    return { origen: "memoria", eventos: obtenerEstado().eventos_abiertos };
  }
  await prepararTabla();
  const cond = [];
  const params = [];
  if (desde) { params.push(desde); cond.push(`inicio >= $${params.length}`); }
  if (hasta) { params.push(hasta); cond.push(`inicio <= $${params.length}`); }
  if (dispositivo) { params.push(dispositivo); cond.push(`(dispositivo = $${params.length} OR inventario = $${params.length})`); }
  if (String(soloAbiertos) === "true") cond.push("fin IS NULL");
  params.push(Math.min(Math.max(Number(limite) || 200, 1), 2000));
  const r = await pool.query(
    `SELECT codigo, sede, evento, severidad, dispositivo, inventario, inicio, fin, duracion_s, detalle, notificado_en, cierre_notificado_en
       FROM api_eventos ${cond.length ? `WHERE ${cond.join(" AND ")}` : ""}
      ORDER BY inicio DESC LIMIT $${params.length}`,
    params
  );
  return { origen: "base de datos", total: r.rowCount, eventos: r.rows };
}

// Arma un evento simulado con los datos reales y actuales de un medidor.
function eventoDePrueba({ dispositivo, evento } = {}) {
  const tipoEvento = GUIA[evento] && /^MEDIDOR_/.test(evento) ? evento : "MEDIDOR_SIN_CAMBIO";
  const disp = datosDispositivo(dispositivo || "HES107") || datosDispositivo([...st.medidores.keys()][0]);
  const ahora = Date.now();
  const ev = {
    codigo: `${nuevoCodigo(ahora)}-PRUEBA`,
    evento: tipoEvento,
    severidad: "critico",
    dispositivo: disp?.nombre || null,
    inventario: disp?.info?.code_inventory || null,
    inicio: ahora - 15 * 60000,
    notificadoEn: ahora,
    detalle: {
      area: disp?.info?.area || null,
      mensaje: "Evento simulado para probar el formato del correo: todas las métricas idénticas desde hace 15 min."
    }
  };
  return { ev, disp };
}

function vistaPreviaCorreo(opciones = {}) {
  const { ev, disp } = eventoDePrueba(opciones);
  return htmlEvento(ev, "apertura", { prueba: true, dispositivo: disp });
}

async function enviarCorreoPrueba(opciones = {}) {
  const t = prepararTransporte();
  if (!t) return { enviado: false, motivo: correoMotivoInactivo };
  const { ev, disp } = eventoDePrueba(opciones);
  const asunto = `[PRUEBA] SIASA ${CFG.sede} - ${ev.inventario ? `${ev.inventario} ` : ""}${ev.dispositivo || ""} - ${(GUIA[ev.evento] || {}).titulo || ev.evento}`;
  const info = await t.sendMail({
    from: CFG.correo.de,
    to: CFG.correo.para,
    cc: CFG.correo.cc || undefined,
    subject: asunto,
    text: `CORREO DE PRUEBA (evento simulado, datos reales del dispositivo)\n\n${textoEvento(ev, "apertura")}`,
    html: htmlEvento(ev, "apertura", { prueba: true, dispositivo: disp })
  });
  logEvento({ evento: "CORREO_PRUEBA", asunto, para: CFG.correo.para, id_mensaje: info?.messageId || null });
  return { enviado: true, para: CFG.correo.para, cc: CFG.correo.cc || null, asunto, dispositivo: ev.dispositivo, id_mensaje: info?.messageId || null };
}

let iniciado = false;
function iniciar(dependencias = {}) {
  if (iniciado) return;
  iniciado = true;
  st.dependencias = dependencias;
  registrarPuntual("API_REINICIADA", "info", { mensaje: "La API arrancó." });
  setInterval(evaluarPeriodico, 5000).unref();
  setInterval(agruparAdvertencias, CFG.agruparAdvertenciasMs).unref();
  setInterval(() => { procesarCorreos().catch(() => {}); }, 15000).unref();
  setInterval(() => { vaciarColaDb().catch(() => {}); }, 15000).unref();
  setInterval(quizasResumenDiario, 60000).unref();
  setInterval(resumenLog, CFG.resumenLogMs).unref();
  prepararTabla().then(() => limpiarAntiguos()).catch((err) => {
    if (dbActiva()) console.error("[MODBUS-EVENTO] base de eventos no disponible todavía:", err.message);
  });
  prepararTransporte();
  logEvento({
    evento: "MONITOREO_INICIADO",
    base_de_eventos: dbActiva() ? `${CFG.db.host}/${CFG.db.database}` : "desactivada",
    correo: transporte ? "activo" : `desactivado: ${correoMotivoInactivo}`,
    umbrales_min: {
      congelado: CFG.congeladoMs / 60000,
      sin_cambio: CFG.sinCambioMs / 60000,
      fuera_de_linea: CFG.fueraDeLineaMs / 60000,
      atascada_s: CFG.atascadaMs / 1000,
      reinicio_vigilante: CFG.reinicioAtascadaMs / 60000
    }
  });
}

module.exports = {
  iniciar,
  inicioLectura,
  lecturaOk,
  lecturaFallida,
  obtenerEstado,
  infoLectura,
  debeResponder503,
  consultarEventos,
  enviarCorreoPrueba,
  vistaPreviaCorreo,
  armarResumen,
  // para pruebas
  _evaluarPeriodico: evaluarPeriodico,
  _agruparAdvertencias: agruparAdvertencias,
  _procesarCorreos: procesarCorreos,
  _colaCorreo: colaCorreo,
  _vaciarColaDb: vaciarColaDb
};

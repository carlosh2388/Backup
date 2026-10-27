// ======================================================
//  Colector de sedes (solo servidor)
//  Consulta cada sede (api-SIASA :3001): /estado y la lectura cada 15 s, /eventos cada 60 s.
//  Guarda un historial de 24 h (foto cada 5 min) y la actividad en data/historial.json.
//  Las API keys viven solo en config/sedes.json (permiso 600): el navegador nunca las recibe.
// ======================================================
import fs from "node:fs";
import path from "node:path";
import type { Actividad, Dispositivo, EventoAbierto, HoraHistorial, Lectura, Nivel, Sede, Severidad, TipoActividad, Totales, Vista } from "./tipos";

interface SedeConfig {
  id: string;
  nombre: string;
  ip: string;
  puerto: number;
  key: string;
  orden: number;
  lat: number | null;
  lon: number | null;
}

interface EstadoRemoto {
  estado: string;
  motivo: string | null;
  antiguedad_s: number;
  ultima_lectura_ok: string | null;
  ultimo_error: string | null;
  reconexiones_ultima_hora: number;
  correo: string;
  base_de_eventos: string;
  proceso_iniciado: string | null;
  eventos_abiertos: { codigo: string; evento: string; severidad: Severidad; dispositivo: string | null; inventario: string | null; desde: string }[];
  dispositivos: { id: string; nombre: string; inventario: string | null; area: string | null; estado: string; ultimo_cambio: string | null; evento: string | null; medidor_de_generador?: boolean }[];
}

interface EventoRemoto {
  codigo: string;
  evento: string;
  severidad: Severidad;
  dispositivo: string | null;
  inventario: string | null;
  inicio: string;
  fin: string | null;
  duracion_s: number | null;
  detalle?: { mensaje?: string };
}

type Metrica = { value?: number | string | null } | number | null | undefined;
interface DispositivoLectura { device_id: string; metrics?: Record<string, Metrica | Record<string, Metrica>> }

interface Seguimiento {
  estado: EstadoRemoto | null;
  lecturas: Record<string, Lectura>;
  eventos: EventoRemoto[];
  ultimaOk: number | null;
  error: string | null;
  latenciaMs: number | null;
}

interface Foto { t: number; nivel: Nivel; en_linea: number; total: number }
// ultimos: último estado conocido de cada sede, para conocer sus medidores aunque no responda tras un reinicio
interface Persistido { historial: Record<string, Foto[]>; propios: Actividad[]; ultimos: Record<string, { t: number; estado: EstadoRemoto }> }

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
const CFG = {
  archivoSedes: process.env.CENTRAL_SEDES || path.join(process.cwd(), "config", "sedes.json"),
  archivoDatos: process.env.CENTRAL_DATOS || path.join(process.cwd(), "data", "historial.json"),
  intervaloMs: num(process.env.CENTRAL_INTERVALO_S, 15) * 1000,
  eventosMs: num(process.env.CENTRAL_EVENTOS_S, 60) * 1000,
  fotoMs: num(process.env.CENTRAL_FOTO_MIN, 5) * 60000,
  timeoutMs: num(process.env.CENTRAL_TIMEOUT_S, 8) * 1000,
  dias: num(process.env.CENTRAL_DIAS, 7),
  sinRespuestaMs: num(process.env.CENTRAL_SIN_RESPUESTA_S, 60) * 1000,
  zona: process.env.CENTRAL_ZONA || "America/Guatemala"
};

// Ubicación aproximada de cada sede (para el mapa). Se puede sobrescribir con lat/lon en sedes.json.
const UBICACION: Record<string, [number, number]> = {
  gineco: [14.6, -90.53], villanueva: [14.52, -90.59], amatitlan: [14.47, -90.63], palin: [14.4, -90.7],
  escuintla: [14.3, -90.79], santalucia: [14.33, -91.02], gomera: [14.08, -91.05], tiquisate: [14.28, -91.36],
  mazatenango: [14.53, -91.5], retalhuleu: [14.54, -91.68]
};

const NOMBRE_EVENTO: Record<string, string> = {
  MEDIDOR_FUERA_DE_LINEA: "fuera de línea",
  MEDIDOR_EN_CERO: "voltaje en cero",
  MEDIDOR_SIN_CAMBIO: "sin cambio",
  GENERADOR_EN_MARCHA: "generador en marcha",
  DATOS_CONGELADOS: "Datos congelados",
  LECTURA_ATASCADA: "Lectura atascada",
  RECONEXIONES_FRECUENTES: "Reconexiones frecuentes",
  VIGILANTE_REINICIO: "Reinicio por vigilante"
};
const CIERRE_EVENTO: Record<string, string> = {
  MEDIDOR_FUERA_DE_LINEA: "en línea de nuevo",
  MEDIDOR_EN_CERO: "voltaje normal de nuevo",
  MEDIDOR_SIN_CAMBIO: "vuelve a cambiar",
  GENERADOR_EN_MARCHA: "generador apagado (en espera)"
};

const G = globalThis as unknown as {
  __colectorSIASA?: { sedes: SedeConfig[]; seg: Map<string, Seguimiento>; iniciado: number; datos: Persistido };
};

function log(obj: Record<string, unknown>) {
  console.log(`[CENTRAL] ${JSON.stringify({ t: new Date().toISOString(), ...obj })}`);
}

function cargarSedes(): SedeConfig[] {
  const lista = JSON.parse(fs.readFileSync(CFG.archivoSedes, "utf8")) as Partial<SedeConfig>[];
  return lista.map((s, i) => {
    const id = String(s.id);
    const ub = UBICACION[id];
    return {
      id, nombre: String(s.nombre), ip: String(s.ip), puerto: s.puerto || 3001, key: String(s.key), orden: s.orden ?? i,
      lat: s.lat ?? ub?.[0] ?? null, lon: s.lon ?? ub?.[1] ?? null
    };
  });
}

function cargarDatos(): Persistido {
  try {
    const d = JSON.parse(fs.readFileSync(CFG.archivoDatos, "utf8")) as Persistido;
    return { historial: d.historial || {}, propios: d.propios || [], ultimos: d.ultimos || {} };
  } catch {
    return { historial: {}, propios: [], ultimos: {} };
  }
}

function guardarDatos() {
  const c = G.__colectorSIASA;
  if (!c) return;
  try {
    fs.mkdirSync(path.dirname(CFG.archivoDatos), { recursive: true });
    const tmp = `${CFG.archivoDatos}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(c.datos));
    fs.renameSync(tmp, CFG.archivoDatos);
  } catch (err) {
    log({ evento: "HISTORIAL_NO_GUARDADO", error: (err as Error).message });
  }
}

async function pedir<T>(sede: SedeConfig, ruta: string): Promise<{ datos: T; ms: number }> {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), CFG.timeoutMs);
  const t0 = Date.now();
  try {
    const r = await fetch(`http://${sede.ip}:${sede.puerto}${ruta}`, { headers: { "x-api-key": sede.key }, signal: ctl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { datos: (await r.json()) as T, ms: Date.now() - t0 };
  } catch (err) {
    const e = err as Error & { cause?: { code?: string } };
    throw new Error(e.name === "AbortError" ? `sin respuesta en ${CFG.timeoutMs / 1000} s` : e.cause?.code || e.message);
  } finally {
    clearTimeout(tm);
  }
}

function registrarPropio(sede: SedeConfig, tipo: TipoActividad, titulo: string, detalle: string | null) {
  const c = G.__colectorSIASA!;
  // Tras un reinicio no se repite el aviso si el último de esa sede ya dice lo mismo
  if (c.datos.propios.find((a) => a.sede_id === sede.id)?.tipo === tipo) return;
  const t = new Date().toISOString();
  c.datos.propios.unshift({ id: `central-${sede.id}-${t}`, t, tipo, sede: sede.nombre, sede_id: sede.id, titulo, detalle });
  c.datos.propios = c.datos.propios.slice(0, 200);
}

const valor = (m: Metrica): number | null => {
  const v = m && typeof m === "object" ? m.value : m;
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
};
const promedio = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

function lecturaDe(d: DispositivoLectura): Lectura {
  const m = d.metrics || {};
  const esIon = "comercial" in m || "generador" in m;
  if (esIon) {
    const com = (m.comercial || {}) as Record<string, Metrica>;
    const gen = (m.generador || {}) as Record<string, Metrica>;
    const kwCom = valor(com.active_power_total);
    const kwGen = valor(gen.active_power_total);
    const usaGen = (kwGen ?? 0) > 0 && !((kwCom ?? 0) > 0);
    const g = usaGen ? gen : com;
    return {
      kw: usaGen ? kwGen : kwCom, tipo_kw: "potencia", fuente: usaGen ? "generador" : "comercial",
      v_prom: promedio([valor(g.voltage_a_n), valor(g.voltage_b_n), valor(g.voltage_c_n)]),
      a_prom: promedio([valor(g.current_a), valor(g.current_b), valor(g.current_c)])
    };
  }
  const p = m as Record<string, Metrica>;
  return {
    kw: valor(p.demand_total), tipo_kw: "demanda", fuente: null,
    v_prom: promedio([valor(p.voltage_a_n), valor(p.voltage_b_n), valor(p.voltage_c_n)]),
    a_prom: promedio([valor(p.current_a), valor(p.current_b), valor(p.current_c)])
  };
}

async function consultarSede(sede: SedeConfig) {
  const s = G.__colectorSIASA!.seg.get(sede.id)!;
  try {
    const { datos, ms } = await pedir<EstadoRemoto>(sede, "/api/ebo/modbus-auto/estado");
    if (s.error) {
      log({ sede: sede.nombre, evento: "SEDE_RESPONDE", tras_error: s.error });
      registrarPropio(sede, "ok", "La sede responde de nuevo", null);
    }
    s.estado = datos;
    s.ultimaOk = Date.now();
    s.latenciaMs = ms;
    s.error = null;
    G.__colectorSIASA!.datos.ultimos[sede.id] = { t: s.ultimaOk, estado: datos };
  } catch (err) {
    const msg = (err as Error).message;
    if (!s.error) {
      log({ sede: sede.nombre, evento: "SEDE_SIN_RESPUESTA", error: msg });
      registrarPropio(sede, "sin_respuesta", "La sede dejó de responder", msg);
    }
    s.error = msg;
    return;
  }
  try {
    const { datos } = await pedir<{ devices?: DispositivoLectura[] }>(sede, "/api/ebo/modbus-auto");
    const l: Record<string, Lectura> = {};
    (datos.devices || []).forEach((d) => { l[d.device_id] = lecturaDe(d); });
    s.lecturas = l;
  } catch {
    // se conservan las últimas lecturas
  }
}

async function consultarEventos(sede: SedeConfig) {
  const s = G.__colectorSIASA!.seg.get(sede.id)!;
  const desde = new Date(Date.now() - CFG.dias * 86400000).toISOString();
  try {
    const { datos } = await pedir<{ eventos?: EventoRemoto[] }>(sede, `/api/ebo/modbus-auto/eventos?desde=${encodeURIComponent(desde)}&limite=1000`);
    s.eventos = (datos.eventos || []).filter((x) => x.evento !== "API_REINICIADA");
  } catch {
    // se conservan los últimos eventos obtenidos
  }
}

function nivelDe(seg: Seguimiento, ahora: number): Nivel {
  const est = seg.estado;
  if (!seg.ultimaOk || ahora - seg.ultimaOk > CFG.sinRespuestaMs) return "sin_respuesta";
  const abiertos = est?.eventos_abiertos || [];
  if (["congelado", "degradado"].includes(est?.estado || "") || abiertos.some((a) => a.severidad === "critico")) return "critico";
  if (abiertos.length || (est && est.estado !== "ok")) return "advertencia";
  return "ok";
}

const enLineaDe = (est: EstadoRemoto | null) =>
  (est?.dispositivos || []).filter((d) => d.estado === "ok" || d.estado === "generador_en_marcha").length;

function tomarFoto() {
  const c = G.__colectorSIASA!;
  const ahora = Date.now();
  c.sedes.forEach((s) => {
    const seg = c.seg.get(s.id)!;
    const lista = c.datos.historial[s.id] || (c.datos.historial[s.id] = []);
    lista.push({ t: ahora, nivel: nivelDe(seg, ahora), en_linea: enLineaDe(seg.estado), total: seg.estado?.dispositivos.length ?? 0 });
    while (lista.length && ahora - lista[0].t > 25 * 3600000) lista.shift();
  });
  guardarDatos();
}

export function iniciarColector() {
  if (G.__colectorSIASA) return;
  const sedes = cargarSedes();
  const datos = cargarDatos();
  const seg = new Map<string, Seguimiento>();
  // Se parte del último estado guardado (sin marcarlo como respuesta reciente: hasta que la sede responda, figura "sin respuesta")
  sedes.forEach((s) => seg.set(s.id, { estado: datos.ultimos[s.id]?.estado ?? null, lecturas: {}, eventos: [], ultimaOk: null, error: null, latenciaMs: null }));
  G.__colectorSIASA = { sedes, seg, iniciado: Date.now(), datos };
  const ciclo = (fn: (s: SedeConfig) => Promise<void>, ms: number) => {
    const correr = () => void Promise.allSettled(sedes.map(fn));
    correr();
    setInterval(correr, ms).unref();
  };
  ciclo(consultarSede, CFG.intervaloMs);
  ciclo(consultarEventos, CFG.eventosMs);
  setTimeout(tomarFoto, 30000).unref(); // primera foto cuando ya hay datos
  setInterval(tomarFoto, CFG.fotoMs).unref();
  log({ evento: "COLECTOR_INICIADO", sedes: sedes.map((s) => s.nombre), intervalo_s: CFG.intervaloMs / 1000, historial: CFG.archivoDatos });
}

export function infoColector() {
  const c = G.__colectorSIASA;
  return { activo: Boolean(c), sedes: c?.sedes.length ?? 0, iniciado: c ? new Date(c.iniciado).toISOString() : null };
}

const diaLocal = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: CFG.zona });
const PEOR: Record<Nivel, number> = { sin_respuesta: 3, critico: 2, advertencia: 1, ok: 0 };

function historial24(fotos: Foto[], ahora: number): HoraHistorial[] {
  const out: HoraHistorial[] = [];
  const finHora = Math.ceil(ahora / 3600000) * 3600000;
  for (let i = 23; i >= 0; i--) {
    const fin = finHora - i * 3600000;
    const ini = fin - 3600000;
    const enHora = fotos.filter((f) => f.t >= ini && f.t < fin);
    if (!enHora.length) { out.push({ hora: new Date(ini).toISOString(), nivel: null, min_en_linea: null, total: null }); continue; }
    const peor = enHora.reduce((a, f) => (PEOR[f.nivel] > PEOR[a.nivel] ? f : a));
    out.push({ hora: new Date(ini).toISOString(), nivel: peor.nivel, min_en_linea: Math.min(...enHora.map((f) => f.en_linea)), total: Math.max(...enHora.map((f) => f.total)) });
  }
  return out;
}

const durTxt = (s: number | null) => {
  if (s == null) return "";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ${m % 60} min` : `${Math.floor(h / 24)} d ${h % 24} h`;
};

function actividadDe(sede: SedeConfig, eventos: EventoRemoto[]): Actividad[] {
  const out: Actividad[] = [];
  eventos.forEach((e) => {
    const equipo = e.inventario ? `${e.inventario} ${e.dispositivo || ""}`.trim() : null;
    const nombre = NOMBRE_EVENTO[e.evento] || e.evento;
    const titulo = equipo ? `${equipo} · ${nombre}` : nombre;
    const tipo: TipoActividad = e.evento === "GENERADOR_EN_MARCHA" ? "info" : e.severidad === "critico" ? "critico" : e.severidad === "advertencia" ? "advertencia" : "info";
    out.push({ id: `${e.codigo}-a`, t: e.inicio, tipo, sede: sede.nombre, sede_id: sede.id, titulo, detalle: e.detalle?.mensaje || null });
    if (e.fin) {
      const cierre = CIERRE_EVENTO[e.evento] || "resuelto";
      out.push({
        id: `${e.codigo}-c`, t: e.fin, tipo: e.evento === "GENERADOR_EN_MARCHA" ? "info" : "ok", sede: sede.nombre, sede_id: sede.id,
        titulo: equipo ? `${equipo} · ${cierre}` : `${nombre} · ${cierre}`, detalle: e.duracion_s != null ? `duró ${durTxt(e.duracion_s)}` : null
      });
    }
  });
  return out;
}

export function armarVista(): Vista {
  iniciarColector();
  const c = G.__colectorSIASA!;
  const ahora = Date.now();
  const dias: string[] = [];
  for (let i = CFG.dias - 1; i >= 0; i--) dias.push(diaLocal(ahora - i * 86400000));
  let actividad: Actividad[] = c.datos.propios.filter((a) => ahora - new Date(a.t).getTime() < CFG.dias * 86400000);

  const lista: Sede[] = c.sedes
    .slice()
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
    .map((s) => {
      const e = c.seg.get(s.id)!;
      const est = e.estado;
      const nivel = nivelDe(e, ahora);
      const dispositivos: Dispositivo[] = (est?.dispositivos || []).map((d) => ({
        id: d.id, nombre: d.nombre, inventario: d.inventario, area: d.area, estado: d.estado,
        ultimo_cambio: d.ultimo_cambio, evento: d.evento, generador: Boolean(d.medidor_de_generador), lectura: e.lecturas[d.id] || null
      }));
      const medidores = { total: dispositivos.length, ok: 0, fuera: 0, alerta: 0, espera: 0, generador: 0 };
      dispositivos.forEach((d) => {
        if (d.estado === "ok") medidores.ok++;
        else if (d.estado === "fuera_de_linea") medidores.fuera++;
        else if (d.estado === "en_espera_generador_apagado") medidores.espera++;
        else if (d.estado === "generador_en_marcha") medidores.generador++;
        else medidores.alerta++;
      });
      const abiertos: EventoAbierto[] = (est?.eventos_abiertos || []).map((a) => ({ ...a, titulo: (NOMBRE_EVENTO[a.evento] || a.evento).replace(/^\w/, (x) => x.toUpperCase()) }));
      const por_dia: Sede["por_dia"] = Object.fromEntries(dias.map((d) => [d, { total: 0, criticos: 0 }]));
      e.eventos.forEach((x) => {
        const d = diaLocal(new Date(x.inicio).getTime());
        if (por_dia[d]) { por_dia[d].total++; if (x.severidad === "critico") por_dia[d].criticos++; }
      });
      actividad = actividad.concat(actividadDe(s, e.eventos));
      return {
        id: s.id, nombre: s.nombre, ip: s.ip, lat: s.lat, lon: s.lon, panel: `http://${s.ip}:${s.puerto}/monitoreo`,
        nivel, sin_respuesta: nivel === "sin_respuesta", error: e.error,
        ultima_consulta_ok: e.ultimaOk ? new Date(e.ultimaOk).toISOString() : c.datos.ultimos[s.id] ? new Date(c.datos.ultimos[s.id].t).toISOString() : null,
        latencia_ms: e.latenciaMs,
        estado: est ? {
          estado: est.estado, motivo: est.motivo, antiguedad_s: est.antiguedad_s, ultima_lectura_ok: est.ultima_lectura_ok,
          ultimo_error: est.ultimo_error, reconexiones_ultima_hora: est.reconexiones_ultima_hora,
          correo: est.correo, base_de_eventos: est.base_de_eventos, proceso_iniciado: est.proceso_iniciado
        } : null,
        medidores, dispositivos, abiertos, por_dia,
        historial: historial24(c.datos.historial[s.id] || [], ahora)
      };
    });

  const totales: Totales = { sedes: 0, sedes_responden: 0, sedes_ok: 0, sedes_criticas: 0, sedes_advertencia: 0, medidores: 0, medidores_ok: 0, medidores_fuera: 0, medidores_alerta: 0, medidores_espera: 0, medidores_sin_datos: 0, abiertos: 0, criticos: 0, reconexiones: 0, correo_activo: 0 };
  lista.forEach((s) => {
    totales.sedes++;
    if (!s.sin_respuesta) totales.sedes_responden++;
    if (s.nivel === "ok") totales.sedes_ok++;
    if (s.nivel === "critico") totales.sedes_criticas++;
    if (s.nivel === "advertencia") totales.sedes_advertencia++;
    totales.medidores += s.medidores.total;
    if (s.sin_respuesta) { totales.medidores_sin_datos += s.medidores.total; return; }
    totales.medidores_ok += s.medidores.ok + s.medidores.generador;
    totales.medidores_fuera += s.medidores.fuera;
    totales.medidores_alerta += s.medidores.alerta;
    totales.medidores_espera += s.medidores.espera;
    totales.abiertos += s.abiertos.length;
    totales.criticos += s.abiertos.filter((x) => x.severidad === "critico").length;
    totales.reconexiones += s.estado?.reconexiones_ultima_hora || 0;
    if (String(s.estado?.correo || "").startsWith("activo")) totales.correo_activo++;
  });

  actividad.sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime());
  return { generado: new Date(ahora).toISOString(), zona: CFG.zona, dias, intervalo_s: CFG.intervaloMs / 1000, totales, sedes: lista, actividad: actividad.slice(0, 60) };
}

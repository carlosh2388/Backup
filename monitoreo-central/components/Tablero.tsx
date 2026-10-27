"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icono from "./Icono";
import { ActividadVivo, BandaEstado, CalorEventos, DetalleSede, Disponibilidad, ListaSedes, type Filtro } from "./Paneles";
import Mapa from "./Mapa";
import { dur, fechaHora } from "@/lib/formato";
import type { Nivel, Vista } from "@/lib/tipos";

const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const ORDEN: Record<Nivel, number> = { critico: 0, sin_respuesta: 1, advertencia: 2, ok: 3 };
const ROTACION_MS = 10000;

export default function Tablero() {
  const [listo, setListo] = useState(false);
  const [clave, setClave] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista | null>(null);
  const [ultimaOk, setUltimaOk] = useState(0);
  const [errorRed, setErrorRed] = useState<string | null>(null);
  const [pausado, setPausado] = useState(false);
  const [tv, setTv] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [texto, setTexto] = useState("");
  const [ahora, setAhora] = useState(() => Date.now());
  const [errAcceso, setErrAcceso] = useState("");
  const [entrando, setEntrando] = useState(false);
  const campoClave = useRef<HTMLInputElement>(null);
  const eligioUsuario = useRef(false);

  useEffect(() => { setClave(leer("central_clave")); setListo(true); }, []);
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, []);

  const pedir = useCallback(async (c: string) => {
    const r = await fetch("/api/vista", { headers: { "x-clave": c }, cache: "no-store" });
    if (r.status === 401) return { ok: false as const };
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { ok: true as const, datos: (await r.json()) as Vista };
  }, []);

  const aplicar = useCallback((v: Vista) => {
    setVista(v);
    setUltimaOk(Date.now());
    setErrorRed(null);
    // Sin elección del usuario: se muestra la sede más grave
    setSel((actual) => {
      if (actual && (eligioUsuario.current || tv) && v.sedes.some((s) => s.id === actual)) return actual;
      return v.sedes.slice().sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel] || a.nombre.localeCompare(b.nombre))[0]?.id ?? null;
    });
  }, [tv]);

  const cargar = useCallback(async () => {
    if (!clave) return;
    try {
      const r = await pedir(clave);
      if (!r.ok) { guardar("central_clave", null); setClave(null); setErrAcceso("La clave no es válida."); return; }
      aplicar(r.datos);
    } catch (e) {
      setErrorRed((e as Error).message);
    }
  }, [clave, pedir, aplicar]);

  // Actualización automática (se detiene en pausa o con la pestaña oculta)
  useEffect(() => {
    if (!clave || pausado) return;
    let vivo = true;
    let t: ReturnType<typeof setTimeout>;
    const ciclo = async () => {
      if (!document.hidden) await cargar();
      if (vivo) t = setTimeout(ciclo, (vista?.intervalo_s || 15) * 1000);
    };
    ciclo();
    const alVolver = () => { if (!document.hidden) cargar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { vivo = false; clearTimeout(t); document.removeEventListener("visibilitychange", alVolver); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, pausado, cargar]);

  // Modo pantalla: recorre las sedes con problemas (o todas si no hay) y entra en pantalla completa
  useEffect(() => {
    document.body.classList.toggle("tv", tv);
    if (!tv || !vista) return;
    const t = setInterval(() => {
      const conProblema = vista.sedes.filter((s) => s.nivel !== "ok").sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel]);
      const lista = (conProblema.length ? conProblema : vista.sedes).map((s) => s.id);
      setSel((actual) => lista[(lista.indexOf(actual || "") + 1) % lista.length]);
    }, ROTACION_MS);
    return () => clearInterval(t);
  }, [tv, vista]);

  const alternarTv = async () => {
    const nuevo = !tv;
    setTv(nuevo);
    try {
      if (nuevo && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      if (!nuevo && document.fullscreenElement) await document.exitFullscreen();
    } catch { /* el navegador puede negar la pantalla completa */ }
  };
  useEffect(() => {
    const salirFs = () => { if (!document.fullscreenElement) setTv(false); };
    document.addEventListener("fullscreenchange", salirFs);
    return () => document.removeEventListener("fullscreenchange", salirFs);
  }, []);

  useEffect(() => { if (listo && !clave) setTimeout(() => campoClave.current?.focus(), 30); }, [listo, clave]);

  const elegir = useCallback((id: string) => {
    eligioUsuario.current = true;
    setSel(id);
    if (window.matchMedia("(max-width: 1280px)").matches) document.getElementById("detNombre")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const entrar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const c = String(new FormData(e.currentTarget).get("clave") || "").trim();
    if (!c) return;
    setEntrando(true); setErrAcceso("");
    try {
      const r = await pedir(c);
      if (!r.ok) { setErrAcceso("La clave no es válida."); return; }
      guardar("central_clave", c);
      setClave(c);
      aplicar(r.datos);
    } catch {
      setErrAcceso("No se pudo conectar con el servidor.");
    } finally {
      setEntrando(false);
    }
  };
  const salir = () => { guardar("central_clave", null); setClave(null); setVista(null); setUltimaOk(0); };

  if (!listo) return null;

  if (!clave) {
    return (
      <section className="acceso">
        <form onSubmit={entrar} autoComplete="off">
          <div className="logo" aria-hidden="true"><Icono n="lock" /></div>
          <h2>Centro de mando · Energía IGSS</h2>
          <p>Ingrese la clave del monitoreo central. Se recuerda en este navegador.</p>
          <label htmlFor="clave">Clave de acceso</label>
          <input ref={campoClave} id="clave" name="clave" type="password" required autoComplete="current-password" aria-describedby="errAcceso" />
          <div className="err" id="errAcceso" role="alert">{errAcceso}</div>
          <button className="btn primario" type="submit" disabled={entrando}>{entrando ? "Verificando…" : "Entrar"}</button>
        </form>
      </section>
    );
  }

  // Indicador "en vivo": solo es en vivo si el último dato es reciente
  const edad = ultimaOk ? (ahora - ultimaOk) / 1000 : null;
  const intervalo = vista?.intervalo_s || 15;
  let claseVivo = "", textoVivo = "Conectando…";
  if (edad != null) {
    if (pausado) { claseVivo = "pausa"; textoVivo = `En pausa · datos de ${fechaHora(new Date(ultimaOk).toISOString())}`; }
    else if (edad > intervalo * 3) { claseVivo = "viejo"; textoVivo = `Desactualizado · ${dur(edad)}`; }
    else textoVivo = `En vivo · hace ${dur(edad)}`;
  }
  const sede = vista?.sedes.find((s) => s.id === sel) ?? null;

  return (
    <>
      <header className="top">
        <div className="logo" aria-hidden="true"><Icono n="zap" /></div>
        <div>
          <h1>Centro de mando · Energía IGSS</h1>
          <p>{vista ? `${vista.totales.sedes} sedes · ${vista.totales.medidores} medidores · lectura Modbus de los EBO` : "Cargando…"}</p>
        </div>
        <div className="der">
          <span className={`vivo ${claseVivo}`} role="status" aria-live="polite"><i aria-hidden="true" />{textoVivo}</span>
          <button className={`btn${tv ? " on" : ""}`} type="button" onClick={alternarTv} aria-pressed={tv}><Icono n="tv" />{tv ? "Salir de pantalla" : "Modo pantalla"}</button>
          <span className="ocultar-tv" style={{ display: "contents" }}>
            <button className="btn icono" type="button" onClick={() => setPausado((p) => !p)} aria-label={pausado ? "Reanudar la actualización automática" : "Pausar la actualización automática"} title={pausado ? "Reanudar" : "Pausar"}><Icono n={pausado ? "play" : "pause"} /></button>
            <button className="btn icono" type="button" onClick={() => cargar()} aria-label="Actualizar ahora" title="Actualizar ahora"><Icono n="refresh" /></button>
            <button className="btn icono" type="button" onClick={salir} aria-label="Salir y olvidar la clave" title="Salir"><Icono n="logout" /></button>
          </span>
        </div>
      </header>

      <main>
        {errorRed && <div className="aviso-red" role="alert"><Icono n="wifi-off" />No se pudo consultar el monitoreo central ({errorRed}). Se muestran los últimos datos recibidos.</div>}

        {!vista ? (
          <div className="bento">{["mapa", "lista", "feed", "kpi", "det", "calor"].map((a) => <div key={a} className="esqueleto" style={{ gridArea: a, minHeight: 200 }} aria-hidden="true" />)}</div>
        ) : (
          <>
            <BandaEstado vista={vista} ahora={ahora} onElegir={elegir} />
            <div className="bento">
              <Mapa vista={vista} sel={sel} onElegir={elegir}
                onVerDetalle={(id) => { elegir(id); setTimeout(() => document.getElementById("detNombre")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80); }} />
              <Disponibilidad vista={vista} />
              <ActividadVivo vista={vista} ahora={ahora} onElegir={elegir} />
              <ListaSedes vista={vista} sel={sel} filtro={filtro} texto={texto} onFiltro={setFiltro} onTexto={setTexto} onElegir={elegir} />
              <DetalleSede sede={sede} ahora={ahora} />
              <CalorEventos vista={vista} onElegir={elegir} />
            </div>
          </>
        )}
      </main>
    </>
  );
}

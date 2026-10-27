import { useCallback, useEffect, useRef, useState } from "react";
import Icono from "./Icono";
import { ESTADO_MEDIDOR, NIVEL, dur, desdeHace } from "@/lib/formato";
import type { Nivel, Sede, Vista } from "@/lib/tipos";

// ------------------------------------------------------------------
// Mapa de sedes: costa del Pacífico (aproximada), monitoreo central en Ciudad de Guatemala
// y una línea de datos animada hacia cada sede. Rojo latiendo = alarma (crítico o sin respuesta).
// Se puede ampliar (pantalla grande), acercar (rueda, +/−, doble clic) y mover (arrastrar).
// ------------------------------------------------------------------
const W = 640, H = 420;
const LON0 = -91.95, LON1 = -90.25, LAT0 = 13.8, LAT1 = 14.8;
const px = (lon: number) => ((lon - LON0) / (LON1 - LON0)) * W;
const py = (lat: number) => ((LAT1 - lat) / (LAT1 - LAT0)) * H;
const ZOOM_MAX = 5;           // ancho mínimo visible = W / ZOOM_MAX
const PASO = 1.35;            // factor de cada paso de acercamiento

// Costa del Pacífico (puntos aproximados de oeste a este)
const COSTA: [number, number][] = [[-91.95, 14.33], [-91.82, 14.25], [-91.7, 14.18], [-91.58, 14.11], [-91.45, 14.05], [-91.3, 13.98], [-91.15, 13.93], [-90.98, 13.92], [-90.82, 13.92], [-90.65, 13.9], [-90.48, 13.89], [-90.25, 13.82]];
const costaD = COSTA.map(([lon, lat], i) => `${i ? "L" : "M"}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`).join(" ");
const tierraD = `M0 0 L${W} 0 L${W} ${py(13.82).toFixed(1)} ${COSTA.slice().reverse().map(([lon, lat]) => `L${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`).join(" ")} Z`;
const VOLCANES: [string, number, number][] = [["Volcán de Fuego", -90.88, 14.47], ["Volcán de Agua", -90.74, 14.47]];
const CENTRAL = { lon: -90.42, lat: 14.7 };

// Etiqueta de cada sede: [desplazamiento x, desplazamiento y] respecto del punto
const ETQ: Record<string, [number, number]> = {
  gineco: [16, -2], villanueva: [16, 2], amatitlan: [-16, -6], palin: [16, 10], escuintla: [16, 16],
  santalucia: [0, 32], gomera: [16, 0], tiquisate: [0, 30], mazatenango: [0, -30], retalhuleu: [0, 30]
};

interface Caja { x: number; y: number; w: number; h: number }

// Medidores que requieren atención (el de generador en espera o en marcha no es una falla)
const SIN_PROBLEMA = new Set(["ok", "generador_en_marcha", "en_espera_generador_apagado"]);
const conProblema = (s: Sede) => s.dispositivos.filter((d) => !SIN_PROBLEMA.has(d.estado));

// Texto corto bajo el nombre de la sede: qué falla, o cuántos medidores hay en línea
function resumenPlaca(s: Sede): string {
  if (s.sin_respuesta) return "sin respuesta";
  const mal = conProblema(s);
  if (mal.length === 1) return `${mal[0].inventario || mal[0].nombre} ${(ESTADO_MEDIDOR[mal[0].estado]?.txt || mal[0].estado).toLowerCase()}`;
  if (mal.length > 1) return `${mal.length} medidores con falla`;
  return `${s.medidores.ok + s.medidores.generador}/${s.medidores.total} en línea`;
}
const COMPLETA: Caja = { x: 0, y: 0, w: W, h: H };

function ajustar(c: Caja): Caja {
  const w = Math.min(W, Math.max(W / ZOOM_MAX, c.w));
  const h = (w / W) * H;
  return { w, h, x: Math.min(W - w, Math.max(0, c.x)), y: Math.min(H - h, Math.max(0, c.y)) };
}

function Etiqueta({ x, y, dx, dy, nombre, sub, nivel }: { x: number; y: number; dx: number; dy: number; nombre: string; sub: string; nivel: Nivel }) {
  const ancho = Math.max(nombre.length * 7.2, sub.length * 6.2) + 18;
  const alto = 34;
  const izq = dx < 0 ? x + dx - ancho : dx > 0 ? x + dx : x - ancho / 2;
  const arr = y + dy - alto / 2;
  return (
    <g className={`placa ${nivel}`} aria-hidden="true">
      <rect x={izq} y={arr} width={ancho} height={alto} rx={8} />
      <text className="pn" x={izq + 9} y={arr + 14}>{nombre}</text>
      <text className="ps" x={izq + 9} y={arr + 27}>{sub}</text>
    </g>
  );
}

export default function Mapa({ vista, sel, onElegir, onVerDetalle }: { vista: Vista; sel: string | null; onElegir: (id: string) => void; onVerDetalle: (id: string) => void }) {
  const [sobre, setSobre] = useState<string | null>(null);
  const [fijada, setFijada] = useState<string | null>(null); // ficha que queda abierta al hacer clic
  const [vb, setVb] = useState<Caja>(COMPLETA);
  const [ampliado, setAmpliado] = useState(false);
  const [ficha, setFicha] = useState<{ x: number; y: number; abajo: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cajaRef = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x: number; y: number; vb: Caja; movio: boolean } | null>(null);
  const huboArrastre = useRef(false);

  const sedes = vista.sedes.filter((s) => s.lat != null && s.lon != null);
  const cx0 = px(CENTRAL.lon), cy0 = py(CENTRAL.lat);
  const enfocada: Sede | undefined = sedes.find((s) => s.id === (sobre ?? fijada));
  const zoom = W / vb.w;

  // Coordenada del mapa bajo un punto de la pantalla
  const aMapa = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const acercar = useCallback((factor: number, centro?: { x: number; y: number }) => {
    setVb((c) => {
      const cx = centro?.x ?? c.x + c.w / 2, cy = centro?.y ?? c.y + c.h / 2;
      const w = c.w / factor, h = c.h / factor;
      return ajustar({ w, h, x: cx - ((cx - c.x) / c.w) * w, y: cy - ((cy - c.y) / c.h) * h });
    });
  }, []);

  // Rueda del mouse: acerca hacia el cursor (listener no pasivo para evitar que la página se desplace)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rueda = (e: WheelEvent) => {
      e.preventDefault();
      const p = aMapa(e.clientX, e.clientY);
      acercar(e.deltaY < 0 ? PASO : 1 / PASO, p ?? undefined);
    };
    svg.addEventListener("wheel", rueda, { passive: false });
    return () => svg.removeEventListener("wheel", rueda);
  }, [aMapa, acercar]);

  // Arrastrar para mover
  const alPresionar = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    huboArrastre.current = false;
    arrastre.current = { x: e.clientX, y: e.clientY, vb, movio: false };
  };
  const alMover = (e: React.PointerEvent<SVGSVGElement>) => {
    const a = arrastre.current;
    const svg = svgRef.current;
    if (!a || !svg) return;
    const dxp = e.clientX - a.x, dyp = e.clientY - a.y;
    if (!a.movio && Math.hypot(dxp, dyp) < 4) return;
    if (!a.movio) { a.movio = true; svg.setPointerCapture(e.pointerId); }
    const r = svg.getBoundingClientRect();
    const escala = Math.max(a.vb.w / r.width, a.vb.h / r.height);
    setVb(ajustar({ ...a.vb, x: a.vb.x - dxp * escala, y: a.vb.y - dyp * escala }));
  };
  const alSoltar = () => {
    huboArrastre.current = Boolean(arrastre.current?.movio);
    arrastre.current = null;
  };

  // Ficha de la sede bajo el mouse: sigue al punto aunque cambie el acercamiento
  useEffect(() => {
    const svg = svgRef.current, caja = cajaRef.current;
    if (!enfocada || !svg || !caja) { setFicha(null); return; }
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(px(enfocada.lon!), py(enfocada.lat!)).matrixTransform(m);
    const r = caja.getBoundingClientRect();
    const x = Math.min(r.width - 150, Math.max(150, p.x - r.left)); // la ficha (290 px) no se sale por los lados
    const y = p.y - r.top;
    setFicha({ x, y, abajo: y < r.height * 0.45 });                  // se abre hacia donde hay más espacio
  }, [enfocada, vb, ampliado]);

  // Vista ampliada: Esc cierra y la página de fondo no se desplaza
  useEffect(() => {
    if (!ampliado) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAmpliado(false); };
    document.addEventListener("keydown", tecla);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", tecla); document.body.style.overflow = ""; };
  }, [ampliado]);

  const elegir = (id: string) => {
    if (huboArrastre.current) { huboArrastre.current = false; return; }
    onElegir(id);
    setFijada((f) => (f === id ? null : id));
  };
  const verDetalle = (id: string) => { setAmpliado(false); setFijada(null); onVerDetalle(id); };

  return (
    <>
      {ampliado && <div className="mapa-velo" onClick={() => setAmpliado(false)} aria-hidden="true" />}
      <section className={`tile c-mapa${ampliado ? " ampliado" : ""}`} aria-labelledby="tMapa" {...(ampliado ? { role: "dialog", "aria-modal": true } : {})}>
        <h3 id="tMapa">
          <Icono n="map" />Sedes en el mapa
          <span className="der mapa-controles">
            <button type="button" className="btn icono chico" onClick={() => acercar(PASO)} disabled={zoom >= ZOOM_MAX - 0.01} aria-label="Acercar" title="Acercar">+</button>
            <button type="button" className="btn icono chico" onClick={() => acercar(1 / PASO)} disabled={zoom <= 1.01} aria-label="Alejar" title="Alejar">−</button>
            <button type="button" className="btn icono chico" onClick={() => setVb(COMPLETA)} disabled={zoom <= 1.01} aria-label="Ver el mapa completo" title="Ver el mapa completo"><Icono n="refresh" /></button>
            <button type="button" className={`btn chico${ampliado ? " on" : ""}`} onClick={() => setAmpliado((a) => !a)} aria-label={ampliado ? "Cerrar el mapa ampliado" : "Ampliar el mapa"}>
              <Icono n={ampliado ? "close" : "expand"} />{ampliado ? "Cerrar" : "Ampliar"}
            </button>
          </span>
        </h3>
        <div className="mapa-caja" ref={cajaRef}>
          <svg ref={svgRef} className={`mapa${arrastre.current?.movio ? " moviendo" : ""}`} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            preserveAspectRatio="xMidYMid meet" role="group" aria-label="Mapa de sedes con su estado y su conexión con el monitoreo central"
            onPointerDown={alPresionar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}
            onClick={() => { if (!huboArrastre.current) setFijada(null); huboArrastre.current = false; }}
            onDoubleClick={(e) => { const p = aMapa(e.clientX, e.clientY); acercar(PASO * PASO, p ?? undefined); }}>
            <defs>
              <linearGradient id="gMar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0B2540" /><stop offset="1" stopColor="#06182B" /></linearGradient>
              <radialGradient id="gTierra" cx="70%" cy="10%" r="90%"><stop offset="0" stopColor="#15213A" /><stop offset="1" stopColor="#0E1627" /></radialGradient>
              <pattern id="gRejilla" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#1A2742" strokeWidth="1" /></pattern>
              <radialGradient id="gBrilloOk"><stop offset="0" stopColor="#22C55E" stopOpacity=".55" /><stop offset="1" stopColor="#22C55E" stopOpacity="0" /></radialGradient>
              <radialGradient id="gBrilloMal"><stop offset="0" stopColor="#EF4444" stopOpacity=".7" /><stop offset="1" stopColor="#EF4444" stopOpacity="0" /></radialGradient>
              <radialGradient id="gBrilloWarn"><stop offset="0" stopColor="#F59E0B" stopOpacity=".55" /><stop offset="1" stopColor="#F59E0B" stopOpacity="0" /></radialGradient>
              {/* Flechas al final de cada línea (llegan al monitoreo central) */}
              {[["fOk", "#22C55E"], ["fWarn", "#F59E0B"], ["fCrit", "#EF4444"]].map(([id, c]) => (
                <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 1 L9 5 L0 9 Z" fill={c} />
                </marker>
              ))}
            </defs>

            {/* Fondo: mar, tierra, rejilla y costa */}
            <rect width={W} height={H} fill="url(#gMar)" />
            <path d={tierraD} fill="url(#gTierra)" />
            <path d={tierraD} fill="url(#gRejilla)" opacity=".55" />
            <path className="costa-linea" d={costaD} />
            <path className="costa-ola" d={costaD} transform="translate(0 7)" />
            <path className="costa-ola" d={costaD} transform="translate(0 15)" opacity=".5" />
            <text className="mar" x={px(-91.5)} y={H - 16}>OCÉANO PACÍFICO</text>
            {VOLCANES.map(([n, lon, lat]) => (
              <g key={n} className="volcan" transform={`translate(${px(lon)} ${py(lat)})`}><title>{n}</title><path d="M-7 5 L0 -6 L7 5 Z" /></g>
            ))}

            {/* Líneas de datos: cada sede envía sus datos al monitoreo central (el flujo va de la sede a la central) */}
            {sedes.map((s) => {
              const x = px(s.lon!), y = py(s.lat!);
              const mx = (x + cx0) / 2, my = Math.min(y, cy0) - 30;
              // La línea termina en el borde del ícono central, para que se vea la flecha
              const ang = Math.atan2(cy0 - my, cx0 - mx);
              const fx = cx0 - Math.cos(ang) * 17, fy = cy0 - Math.sin(ang) * 17;
              const clase = s.sin_respuesta ? "enlace cortado" : s.nivel === "critico" ? "enlace critico" : s.nivel === "advertencia" ? "enlace advertencia" : "enlace";
              const flecha = s.sin_respuesta ? undefined : s.nivel === "critico" ? "url(#fCrit)" : s.nivel === "advertencia" ? "url(#fWarn)" : "url(#fOk)";
              return <path key={`l-${s.id}`} className={`${clase}${s.id === sel ? " sel" : ""}`} d={`M${x} ${y} Q${mx} ${my} ${fx} ${fy}`} markerEnd={flecha} />;
            })}

            {/* Monitoreo central */}
            <g className="central" transform={`translate(${cx0} ${cy0})`}>
              <rect x={-12} y={-12} width={24} height={24} rx={6} />
              <path d="M-5 -5h10v10h-10z M-2 -2h4v4h-4z" />
              <text x={-18} y={-2} textAnchor="end">Monitoreo central</text>
              <text className="ps" x={-18} y={11} textAnchor="end">Ciudad de Guatemala</text>
            </g>

            {/* Sedes (la seleccionada al final para que quede encima) */}
            {sedes.slice().sort((a, b) => (a.id === sel ? 1 : 0) - (b.id === sel ? 1 : 0)).map((s) => {
              const x = px(s.lon!), y = py(s.lat!);
              const n = NIVEL[s.nivel];
              const alarma = s.nivel === "critico" || s.nivel === "sin_respuesta";
              const enLinea = s.medidores.ok + s.medidores.generador;
              const [dx, dy] = ETQ[s.id] || [16, 0];
              const brillo = alarma ? "url(#gBrilloMal)" : s.nivel === "advertencia" ? "url(#gBrilloWarn)" : "url(#gBrilloOk)";
              return (
                <g key={s.id} className={`nodo ${s.nivel}${s.id === sel ? " sel" : ""}`} tabIndex={0} role="button"
                  aria-label={`${s.nombre}: ${n.txt}${s.sin_respuesta ? "" : `, ${enLinea} de ${s.medidores.total} medidores en línea`}`}
                  aria-pressed={s.id === sel}
                  onClick={(e) => { e.stopPropagation(); elegir(s.id); }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  onMouseEnter={() => setSobre(s.id)} onMouseLeave={() => setSobre(null)}
                  onFocus={() => setSobre(s.id)} onBlur={() => setSobre(null)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); elegir(s.id); } }}>
                  <circle cx={x} cy={y} r={alarma ? 30 : 22} fill={brillo} className={alarma ? "brillo-alarma" : ""} />
                  {alarma && <><circle className="onda" cx={x} cy={y} r={10} /><circle className="onda o2" cx={x} cy={y} r={10} /></>}
                  <circle className="base" cx={x} cy={y} r={s.id === sel ? 11 : 9} fill={n.color} />
                  {s.sin_respuesta
                    ? <path className="glifo" d={`M${x - 4} ${y - 4} L${x + 4} ${y + 4} M${x + 4} ${y - 4} L${x - 4} ${y + 4}`} />
                    : s.nivel === "ok" ? <circle cx={x} cy={y} r={3} fill="#052E16" /> : <path className="glifo" d={`M${x} ${y - 4} V${y + 1} M${x} ${y + 4} v0.5`} />}
                  <Etiqueta x={x} y={y} dx={dx} dy={dy} nombre={s.nombre} nivel={s.nivel} sub={resumenPlaca(s)} />
                </g>
              );
            })}
          </svg>

          <div className="mapa-zoom mono" aria-hidden="true">{zoom > 1.01 ? `${zoom.toFixed(1)}×` : "Rueda o +/− para acercar · arrastrar para mover"}</div>

          {enfocada && ficha && (() => {
            const fija = fijada === enfocada.id;
            const mal = conProblema(enfocada);
            const abajo = ficha.abajo;
            const ahora = Date.now();
            return (
              <div className={`mapa-ficha${abajo ? " abajo" : ""}${fija ? " fija" : ""}`} style={{ left: ficha.x, top: ficha.y }}
                role={fija ? "dialog" : "tooltip"} aria-label={`Estado de ${enfocada.nombre}`}
                onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                <div className="mf-cab">
                  <b>{enfocada.nombre}</b>
                  <span className={`pill ${enfocada.nivel}`}><Icono n={NIVEL[enfocada.nivel].ico} />{NIVEL[enfocada.nivel].txt}</span>
                  {fija && <button type="button" className="mf-cerrar" onClick={() => setFijada(null)} aria-label="Cerrar la ficha"><Icono n="close" /></button>}
                </div>

                {enfocada.sin_respuesta ? (
                  <div className="mf-falla">
                    <Icono n="wifi-off" />
                    <span><b>La sede no responde</b><small>{enfocada.error || "sin datos"} · {enfocada.medidores.total || "sus"} medidores sin datos</small></span>
                  </div>
                ) : mal.length > 0 ? (
                  <>
                    <div className="mf-titulo">{mal.length === 1 ? "Dispositivo con falla" : `${mal.length} dispositivos con falla`}</div>
                    {mal.map((d) => {
                      const e = ESTADO_MEDIDOR[d.estado] || { txt: d.estado, ico: "alert" };
                      return (
                        <div key={d.id} className="mf-falla">
                          <Icono n={e.ico} />
                          <span>
                            <b>{d.inventario || d.nombre} · {e.txt}</b>
                            <small>{d.nombre}{d.area ? ` · ${d.area}` : ""} · hace {dur(desdeHace(d.ultimo_cambio, ahora))}</small>
                          </span>
                        </div>
                      );
                    })}
                  </>
                ) : enfocada.abiertos.length > 0 ? (
                  enfocada.abiertos.map((a) => (
                    <div key={a.codigo} className="mf-falla advertencia"><Icono n="alert" /><span><b>{a.titulo}</b><small>hace {dur(desdeHace(a.desde, ahora))}</small></span></div>
                  ))
                ) : null}

                {!enfocada.sin_respuesta && (
                  <>
                    <div className="mf-fila"><span>Medidores en línea</span><b>{enfocada.medidores.ok + enfocada.medidores.generador}/{enfocada.medidores.total}</b></div>
                    <div className="mf-fila"><span>Lectura del EBO</span><b>{enfocada.estado ? `${enfocada.estado.estado} · ${dur(enfocada.estado.antiguedad_s)}` : "—"}</b></div>
                    <div className="mf-fila"><span>Respuesta</span><b>{enfocada.latencia_ms != null ? `${enfocada.latencia_ms} ms` : "—"}</b></div>
                  </>
                )}

                {fija
                  ? <button type="button" className="btn chico mf-boton" onClick={() => verDetalle(enfocada.id)}><Icono n="list" />Ver detalle de la sede</button>
                  : <div className="mf-pie">Clic para fijar y ver qué dispositivo falla</div>}
              </div>
            );
          })()}
        </div>
        <div className="leyenda-mapa">
          <span><i style={{ background: "var(--ok)" }} />Operando</span>
          <span><i style={{ background: "var(--warn)" }} />Advertencia</span>
          <span><i className="alarma" style={{ background: "var(--crit)" }} />Alarma: crítico o sin respuesta</span>
          <span><i className="linea" />Línea de datos con el monitoreo central</span>
        </div>
      </section>
    </>
  );
}

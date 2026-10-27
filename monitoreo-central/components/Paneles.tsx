import { useMemo } from "react";
import Icono from "./Icono";
import { COLOR_ACTIVIDAD, ESTADO_MEDIDOR, NIVEL, cuando, dur, desdeHace, hace, horaCorta, kw, sevIcono, sevNivel } from "@/lib/formato";
import type { Nivel, Sede, Vista } from "@/lib/tipos";

type Elegir = (id: string) => void;
const ORDEN: Record<Nivel, number> = { critico: 0, sin_respuesta: 1, advertencia: 2, ok: 3 };

// ------------------------------------------------------------------
// 1. Banda de estado: responde "¿hay algo que atender?"
// ------------------------------------------------------------------
export function BandaEstado({ vista, ahora, onElegir }: { vista: Vista; ahora: number; onElegir: Elegir }) {
  const t = vista.totales;
  const conProblema = vista.sedes.filter((s) => s.nivel !== "ok").sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel]);
  const peor: Nivel = conProblema[0]?.nivel ?? "ok";
  const titulo = conProblema.length === 0
    ? "Todo en orden"
    : `${conProblema.length} ${conProblema.length === 1 ? "sede requiere" : "sedes requieren"} atención`;
  const partes = [
    `${t.sedes_ok} de ${t.sedes} sedes operando con normalidad`,
    `${t.medidores_ok} de ${t.medidores} medidores en línea`,
    t.criticos ? `${t.criticos} ${t.criticos === 1 ? "evento crítico abierto" : "eventos críticos abiertos"}` : "sin eventos críticos"
  ];

  // Un botón por problema: cada evento abierto, o la sede si no responde
  const items: { key: string; nivel: Nivel; sede: Sede; titulo: string; sub: string }[] = [];
  conProblema.forEach((s) => {
    if (s.sin_respuesta) {
      items.push({ key: `${s.id}-sr`, nivel: "sin_respuesta", sede: s, titulo: `${s.nombre} no responde`, sub: `${s.error || "sin datos"}${s.ultima_consulta_ok ? ` · ${hace(s.ultima_consulta_ok, ahora)}` : ""}` });
      return;
    }
    if (!s.abiertos.length) items.push({ key: `${s.id}-e`, nivel: s.nivel, sede: s, titulo: `${s.nombre} · lectura ${s.estado?.estado ?? "—"}`, sub: s.estado?.motivo || "" });
    s.abiertos.forEach((a) => items.push({
      key: a.codigo, nivel: sevNivel(a.severidad) === "info" ? "advertencia" : sevNivel(a.severidad) as Nivel, sede: s,
      titulo: `${s.nombre} · ${a.inventario ? `${a.inventario} ` : ""}${a.titulo.toLowerCase()}`,
      sub: `${a.dispositivo || ""}${a.dispositivo ? " · " : ""}${hace(a.desde, ahora)}`
    }));
  });
  const visibles = items.slice(0, 3);

  return (
    <section className={`estado ${peor}`} aria-labelledby="tEstado">
      <div className="grande" aria-hidden="true"><Icono n={peor === "ok" ? "check" : peor === "sin_respuesta" ? "wifi-off" : "alert"} /></div>
      <div>
        <h2 id="tEstado">{titulo}</h2>
        <p>{partes.join(" · ")}</p>
      </div>
      {visibles.length > 0 && (
        <div className="pendientes">
          {visibles.map((i) => (
            <button key={i.key} type="button" className={`pend ${i.nivel}`} onClick={() => onElegir(i.sede.id)}>
              <span className={`pill ${i.nivel}`}><Icono n={NIVEL[i.nivel].ico} />{NIVEL[i.nivel].txt}</span>
              <span><b>{i.titulo}</b><small>{i.sub}</small></span>
            </button>
          ))}
          {items.length > visibles.length && <span className="pend mas">y {items.length - visibles.length} más</span>}
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------
// 3. Disponibilidad
// ------------------------------------------------------------------
export function Disponibilidad({ vista }: { vista: Vista }) {
  const t = vista.totales;
  const pct = t.medidores ? Math.round((t.medidores_ok / t.medidores) * 100) : 0;
  const r = 46, circ = 2 * Math.PI * r;
  const color = pct >= 98 ? "var(--ok)" : pct >= 90 ? "var(--warn)" : "var(--crit)";
  const sinResp = t.sedes - t.sedes_responden;
  return (
    <section className="tile c-kpi" aria-labelledby="tKpi">
      <h3 id="tKpi"><Icono n="gauge" />Disponibilidad</h3>
      <div className="kpi-fila">
        <div className="anillo" role="img" aria-label={`${pct} por ciento de los medidores en línea: ${t.medidores_ok} de ${t.medidores}`}>
          <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true">
            <circle cx="56" cy="56" r={r} fill="none" stroke="#1C2740" strokeWidth="12" />
            <circle className="v" cx="56" cy="56" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(pct / 100) * circ} ${circ}`} />
          </svg>
          <div className="txt"><b>{pct}%</b><small>{t.medidores_ok}/{t.medidores} en línea</small></div>
        </div>
        <div className="mini">
          <div className={t.sedes_ok === t.sedes ? "ok" : "advertencia"}><b>{t.sedes_ok}/{t.sedes}</b><small>sedes operando</small></div>
          <div className={t.medidores_fuera ? "critico" : "ok"}><b>{t.medidores_fuera}</b><small>{t.medidores_fuera === 1 ? "medidor fuera de línea" : "medidores fuera de línea"}</small></div>
          <div className={sinResp ? "sin_respuesta" : "ok"}><b>{sinResp}</b><small>{sinResp === 1 ? "sede sin respuesta" : "sedes sin respuesta"}</small></div>
          <div className={t.reconexiones > 10 ? "advertencia" : "ok"}><b>{t.reconexiones}</b><small>reconexiones (1 h)</small></div>
        </div>
      </div>
      {(t.medidores_espera > 0 || t.medidores_sin_datos > 0 || t.medidores_alerta > 0) && (
        <p className="nota">
          {[t.medidores_espera ? `${t.medidores_espera} en espera (generador)` : "", t.medidores_alerta ? `${t.medidores_alerta} con alerta` : "", t.medidores_sin_datos ? `${t.medidores_sin_datos} sin datos (sede sin respuesta)` : ""].filter(Boolean).join(" · ")}
        </p>
      )}
    </section>
  );
}

// ------------------------------------------------------------------
// 4. Actividad en vivo
// ------------------------------------------------------------------
export function ActividadVivo({ vista, ahora, onElegir }: { vista: Vista; ahora: number; onElegir: Elegir }) {
  return (
    <section className="tile c-feed" aria-labelledby="tFeed">
      <h3 id="tFeed"><Icono n="activity" />Actividad en vivo<span className="der mono">{vista.dias.length} días</span></h3>
      <div className="feed">
        {vista.actividad.length === 0 && <div className="vacio"><Icono n="check" />Sin actividad en los últimos días</div>}
        {vista.actividad.map((a) => {
          const nuevo = (desdeHace(a.t, ahora) ?? 1e9) < 15 * 60;
          return (
            <button key={a.id} type="button" className={`ev${nuevo ? " nuevo" : ""}`} onClick={() => onElegir(a.sede_id)} title={a.detalle || undefined}>
              <span className="p" style={{ background: COLOR_ACTIVIDAD[a.tipo] }} aria-hidden="true" />
              <span>
                <b>{a.sede}</b> · {a.titulo}{a.detalle && a.tipo === "ok" ? ` · ${a.detalle}` : ""}
                <span className="q mono" style={{ display: "block" }}>{cuando(a.t, ahora)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// 5. Lista de sedes con filtros
// ------------------------------------------------------------------
export type Filtro = "todas" | "alertas" | "sin_respuesta";

export function ListaSedes({ vista, sel, filtro, texto, onFiltro, onTexto, onElegir }: {
  vista: Vista; sel: string | null; filtro: Filtro; texto: string;
  onFiltro: (f: Filtro) => void; onTexto: (t: string) => void; onElegir: Elegir;
}) {
  const lista = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return vista.sedes
      .filter((s) => (filtro === "alertas" ? s.nivel === "critico" || s.nivel === "advertencia" : filtro === "sin_respuesta" ? s.sin_respuesta : true))
      .filter((s) => !q || [s.nombre, s.ip, ...s.dispositivos.flatMap((d) => [d.inventario, d.nombre])].some((x) => String(x || "").toLowerCase().includes(q)))
      .sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel] || a.nombre.localeCompare(b.nombre));
  }, [vista, filtro, texto]);

  const colorHora = (n: Nivel | null) => (n ? NIVEL[n].color : "var(--muted)");
  return (
    <section className="tile c-lista" aria-labelledby="tLista">
      <h3 id="tLista"><Icono n="list" />Sedes<span className="der">últimas 24 h</span></h3>
      <div className="filtros" role="group" aria-label="Filtrar sedes">
        {([["todas", "Todas"], ["alertas", "Con alertas"], ["sin_respuesta", "Sin respuesta"]] as [Filtro, string][]).map(([id, txt]) => (
          <button key={id} type="button" className="chip" aria-pressed={filtro === id} onClick={() => onFiltro(id)}>{txt}</button>
        ))}
        <label className="buscar"><span className="sr">Buscar sede o inventario</span><Icono n="search" />
          <input type="search" placeholder="Sede o inventario" value={texto} onChange={(e) => onTexto(e.target.value)} />
        </label>
      </div>
      <div className="filas">
        {lista.length === 0 && <div className="vacio"><Icono n="search" />Ninguna sede coincide</div>}
        {lista.map((s) => {
          const enLinea = s.medidores.ok + s.medidores.generador;
          return (
            <button key={s.id} type="button" className="fila" aria-pressed={s.id === sel} onClick={() => onElegir(s.id)}
              aria-label={`${s.nombre}: ${NIVEL[s.nivel].txt}, ${enLinea} de ${s.medidores.total} medidores en línea`}>
              <span className={`s${s.nivel === "critico" || s.nivel === "sin_respuesta" ? " alarma" : ""}`} style={{ background: NIVEL[s.nivel].color }} aria-hidden="true" />
              <span style={{ minWidth: 0 }}>
                <span className="nom">{s.nombre}</span>
                <span className="puntos" aria-hidden="true">
                  {s.dispositivos.map((d) => <i key={d.id} title={`${d.inventario || d.nombre}: ${(ESTADO_MEDIDOR[d.estado] || { txt: d.estado }).txt}`} style={{ background: s.sin_respuesta ? "var(--crit)" : (ESTADO_MEDIDOR[d.estado]?.color || "var(--warn)") }} />)}
                </span>
                <span className="tira" aria-hidden="true">
                  {s.historial.map((h) => <i key={h.hora} title={`${horaCorta(h.hora)}: ${h.nivel ? NIVEL[h.nivel].txt : "sin datos"}`} style={{ background: colorHora(h.nivel) }} />)}
                </span>
              </span>
              <span className="der">
                <b>{s.sin_respuesta ? "—" : `${enLinea}/${s.medidores.total}`}</b>
                {s.sin_respuesta ? "sin respuesta" : s.medidores.espera ? `en línea · ${s.medidores.espera} en espera` : "en línea"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// 6. Detalle de la sede seleccionada
// ------------------------------------------------------------------
export function DetalleSede({ sede, ahora }: { sede: Sede | null; ahora: number }) {
  if (!sede) return <section className="tile c-detalle"><div className="vacio">Seleccione una sede</div></section>;
  const n = NIVEL[sede.nivel];
  const est = sede.estado;
  const enLinea = sede.medidores.ok + sede.medidores.generador;
  return (
    <section className="tile c-detalle" aria-labelledby="detNombre" aria-live="polite">
      <div className="det-cab">
        <div>
          <h4 id="detNombre">{sede.nombre}</h4>
          <div className="sub">{sede.ip} · {sede.sin_respuesta ? "sin respuesta" : est ? `lectura del EBO ${est.estado} · hace ${dur(est.antiguedad_s)}` : "sin datos"}</div>
        </div>
        <span className={`pill ${sede.nivel}`}><Icono n={n.ico} />{n.txt}</span>
        <div className="det-datos">
          {sede.sin_respuesta ? (
            <><span><b>{sede.error || "—"}</b>error</span><span><b>{hace(sede.ultima_consulta_ok, ahora)}</b>última respuesta</span></>
          ) : (
            <>
              <span><b>{enLinea}/{sede.medidores.total}</b>en línea</span>
              <span><b>{est?.reconexiones_ultima_hora ?? "—"}</b>reconexiones (1 h)</span>
              <span><b>{est && String(est.correo).startsWith("activo") ? "activo" : est?.correo ?? "—"}</b>correo</span>
              <span><b>{sede.latencia_ms != null ? `${sede.latencia_ms} ms` : "—"}</b>respuesta</span>
            </>
          )}
        </div>
        <a className="btn" href={sede.panel} target="_blank" rel="noopener noreferrer" aria-label={`Abrir el panel de ${sede.nombre} en una pestaña nueva`}><Icono n="external" />Abrir panel</a>
      </div>

      {sede.sin_respuesta && (
        <div className="det-alerta sin_respuesta"><Icono n="wifi-off" /><span><b>La sede no responde.</b> Se muestran los últimos datos recibidos. Revisar la red hacia {sede.ip} o el servidor de la sede.</span></div>
      )}
      {sede.abiertos.map((a) => (
        <div key={a.codigo} className={`det-alerta ${sevNivel(a.severidad)}`}>
          <Icono n={sevIcono(a.severidad)} />
          <span><b>{a.titulo}</b>{a.inventario ? ` · ${a.inventario} ${a.dispositivo || ""}` : ""} · desde {cuando(a.desde, ahora)} ({dur(desdeHace(a.desde, ahora))}) · <span className="mono">{a.codigo}</span></span>
        </div>
      ))}

      <div className="medidores">
        {sede.dispositivos.map((d) => {
          const e = ESTADO_MEDIDOR[d.estado] || { txt: d.estado, cls: "advertencia", ico: "alert" };
          const cls = sede.sin_respuesta ? "sin_respuesta" : e.cls === "ok" ? "" : e.cls;
          const l = d.lectura;
          const fuera = d.estado === "fuera_de_linea";
          return (
            <div key={d.id} className={`med ${cls}`}>
              <div className="inv">{d.inventario || "—"}</div>
              <div className="eq" title={`${d.nombre} · ${d.area || ""}`}>{d.nombre} · {d.area || "—"}</div>
              <div className="kw">{kw(fuera ? 0 : l?.kw)} <small>kW {l?.tipo_kw === "demanda" ? "demanda" : l?.fuente === "generador" ? "generador" : ""}</small></div>
              <div className="va">{l?.v_prom != null && !fuera ? `${kw(l.v_prom)} V` : "— V"} · {l?.a_prom != null && !fuera ? `${kw(l.a_prom)} A` : "— A"}</div>
              <div className="est"><Icono n={sede.sin_respuesta ? "wifi-off" : e.ico} />{sede.sin_respuesta ? "sin datos · sede sin respuesta" : fuera ? `Fuera de línea · ${dur(desdeHace(d.ultimo_cambio, ahora))}` : e.txt}</div>
            </div>
          );
        })}
        {sede.dispositivos.length === 0 && <div className="vacio">Sin datos de medidores todavía</div>}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// 7. Eventos por día
// ------------------------------------------------------------------
export function CalorEventos({ vista, onElegir }: { vista: Vista; onElegir: Elegir }) {
  const dd = (d: string) => { const [, m, x] = d.split("-"); return `${x}/${m}`; };
  const sedes = vista.sedes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
  return (
    <section className="tile c-calor" aria-labelledby="tCalor">
      <h3 id="tCalor"><Icono n="grid" />Eventos por día<span className="der">rojo = con críticos</span></h3>
      <div className="calor" role="table" aria-label="Eventos por día y sede">
        <span role="columnheader" />
        {vista.dias.map((d) => <span key={d} className="h" role="columnheader">{dd(d)}</span>)}
        <span className="h" role="columnheader">Total</span>
        {sedes.map((s) => {
          const total = vista.dias.reduce((a, d) => a + (s.por_dia[d]?.total || 0), 0);
          return [
            <button key={`${s.id}-n`} type="button" className="n" onClick={() => onElegir(s.id)}>{s.nombre}</button>,
            ...vista.dias.map((d) => {
              const v = s.por_dia[d] || { total: 0, criticos: 0 };
              const etq = `${s.nombre} ${dd(d)}: ${v.total} eventos, ${v.criticos} críticos`;
              return <span key={`${s.id}-${d}`} className={`c ${v.criticos ? "b" : v.total ? "a" : ""}`} title={etq} aria-label={etq} role="cell">{v.total || ""}{v.criticos ? "!" : ""}</span>;
            }),
            <span key={`${s.id}-t`} className="t" role="cell">{total}</span>
          ];
        })}
      </div>
      <p className="nota">Hora de Guatemala. «!» = el día tuvo eventos críticos. No incluye reinicios de la API.</p>
    </section>
  );
}

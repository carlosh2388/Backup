import type { Nivel, Severidad, TipoActividad } from "./tipos";

export const ZONA = "America/Guatemala";

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-GT", { timeZone: ZONA, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-GT", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" });
}

export function dur(segundos: number | null | undefined): string {
  if (segundos == null || !Number.isFinite(segundos)) return "—";
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

export const desdeHace = (iso: string | null | undefined, ahora: number) => (iso ? (ahora - new Date(iso).getTime()) / 1000 : null);
export const hace = (iso: string | null | undefined, ahora: number) => (iso ? `hace ${dur(desdeHace(iso, ahora))}` : "—");

/** "hace 18 min" si es de hoy, si no la fecha y hora. */
export function cuando(iso: string, ahora: number): string {
  const s = desdeHace(iso, ahora) ?? 0;
  return s < 12 * 3600 ? `hace ${dur(s)}` : fechaHora(iso);
}

export const NIVEL: Record<Nivel, { txt: string; ico: string; color: string }> = {
  ok: { txt: "Operando", ico: "check", color: "var(--ok)" },
  advertencia: { txt: "Advertencia", ico: "alert", color: "var(--warn)" },
  critico: { txt: "Crítico", ico: "x", color: "var(--crit)" },
  // Sede sin respuesta = alarma: rojo como el crítico, se distingue por el ícono y el texto
  sin_respuesta: { txt: "Sin respuesta", ico: "wifi-off", color: "var(--crit)" }
};

export const ESTADO_MEDIDOR: Record<string, { txt: string; cls: string; ico: string; color: string }> = {
  ok: { txt: "En línea", cls: "ok", ico: "check", color: "var(--ok)" },
  fuera_de_linea: { txt: "Fuera de línea", cls: "critico", ico: "x", color: "var(--crit)" },
  en_cero: { txt: "Voltaje en cero", cls: "critico", ico: "alert", color: "var(--crit)" },
  sin_cambio: { txt: "Sin cambio", cls: "advertencia", ico: "alert", color: "var(--warn)" },
  en_espera_generador_apagado: { txt: "En espera · generador", cls: "espera", ico: "generator", color: "var(--off)" },
  generador_en_marcha: { txt: "Generador en marcha", cls: "info", ico: "generator", color: "var(--info)" }
};

export const COLOR_ACTIVIDAD: Record<TipoActividad, string> = {
  critico: "var(--crit)", advertencia: "var(--warn)", info: "var(--info)", ok: "var(--ok)", sin_respuesta: "var(--crit)"
};

export const sevNivel = (s: Severidad): "critico" | "advertencia" | "info" => (s === "critico" ? "critico" : s === "advertencia" ? "advertencia" : "info");
export const sevIcono = (s: Severidad) => (s === "info" ? "info" : "alert");

export const kw = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("es-GT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

// Tipos compartidos entre el colector (servidor) y la vista (navegador).

export type Nivel = "ok" | "advertencia" | "critico" | "sin_respuesta";
export type Severidad = "critico" | "advertencia" | "info";
export type TipoActividad = "critico" | "advertencia" | "info" | "ok" | "sin_respuesta";

export interface EventoAbierto {
  codigo: string;
  evento: string;
  titulo: string;
  severidad: Severidad;
  dispositivo: string | null;
  inventario: string | null;
  desde: string;
}

export interface Lectura {
  kw: number | null;            // ION: potencia activa total; PM2130: demanda total
  tipo_kw: "potencia" | "demanda" | null;
  fuente: "comercial" | "generador" | null; // solo ION
  v_prom: number | null;
  a_prom: number | null;
}

export interface Dispositivo {
  id: string;
  nombre: string;
  inventario: string | null;
  area: string | null;
  estado: string;
  ultimo_cambio: string | null;
  evento: string | null;
  generador: boolean;
  lectura: Lectura | null;
}

export interface EstadoLectura {
  estado: string;
  motivo: string | null;
  antiguedad_s: number;
  ultima_lectura_ok: string | null;
  ultimo_error: string | null;
  reconexiones_ultima_hora: number;
  correo: string;
  base_de_eventos: string;
  proceso_iniciado: string | null;
}

export interface Medidores {
  total: number;
  ok: number;
  fuera: number;
  alerta: number;
  espera: number;
  generador: number;
}

// Una hora del historial: el peor estado visto en esa hora (null = sin datos del monitoreo central)
export interface HoraHistorial {
  hora: string;
  nivel: Nivel | null;
  min_en_linea: number | null;
  total: number | null;
}

export interface Sede {
  id: string;
  nombre: string;
  ip: string;
  lat: number | null;
  lon: number | null;
  panel: string;
  nivel: Nivel;
  sin_respuesta: boolean;
  error: string | null;
  ultima_consulta_ok: string | null;
  latencia_ms: number | null;
  estado: EstadoLectura | null;
  medidores: Medidores;
  dispositivos: Dispositivo[];
  abiertos: EventoAbierto[];
  por_dia: Record<string, { total: number; criticos: number }>;
  historial: HoraHistorial[];
}

export interface Actividad {
  id: string;
  t: string;
  tipo: TipoActividad;
  sede: string;
  sede_id: string;
  titulo: string;
  detalle: string | null;
}

export interface Totales {
  sedes: number;
  sedes_responden: number;
  sedes_ok: number;
  sedes_criticas: number;
  sedes_advertencia: number;
  medidores: number;
  medidores_ok: number;
  medidores_fuera: number;
  medidores_alerta: number;
  medidores_espera: number;
  medidores_sin_datos: number;
  abiertos: number;
  criticos: number;
  reconexiones: number;
  correo_activo: number;
}

export interface Vista {
  generado: string;
  zona: string;
  dias: string[];
  intervalo_s: number;
  totales: Totales;
  sedes: Sede[];
  actividad: Actividad[];
}

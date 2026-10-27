BEGIN;

-- =========================
-- TABLAS SEGUN EXCEL
-- =========================

CREATE TABLE IF NOT EXISTS mi_basedatos.public.sedes (
  id_sitio TEXT PRIMARY KEY,
  sede_principal TEXT,
  prefijo_sitio TEXT,
  punto_monitoreo TEXT,
  direccion TEXT,
  localizacion_gps TEXT
);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.bd_ubi_exac (
  id TEXT PRIMARY KEY,
  descripcion TEXT,
  valor TEXT,
  tipo_entorno TEXT
);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.contactos (
  id_contacto TEXT PRIMARY KEY,
  nombre_encargado TEXT,
  cargo TEXT,
  telefono TEXT,
  nombre_hospital TEXT,
  id_sitio TEXT REFERENCES mi_basedatos.public.sedes(id_sitio) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.infra_dc (
  id_infra TEXT PRIMARY KEY,
  nombre_hospital TEXT,
  id_sitio TEXT REFERENCES mi_basedatos.public.sedes(id_sitio) ON DELETE SET NULL,
  gabinete TEXT,
  rack TEXT,
  pdu TEXT,
  ups TEXT
);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.catalogo_equipos (
  marca_modelo TEXT PRIMARY KEY,
  fabricante TEXT,
  voltaje_operacion NUMERIC,
  tipo_sensor TEXT,
  vida_util TEXT,
  datasheet TEXT
);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.protocolos (
  id TEXT PRIMARY KEY,
  descripcion TEXT,
  valor TEXT
);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.cat_aplicaciones (
  aplicacion_variable TEXT,
  sufijo_id TEXT,
  unidad TEXT,
  rango_min NUMERIC,
  rango_max NUMERIC,
  tipo_sensor_sugerido TEXT
);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.estado_disp (
  id TEXT PRIMARY KEY,
  descripcion TEXT,
  valor TEXT,
  motivo_cambio TEXT
);

-- =========================
-- INVENTARIO (TABLA MAESTRA)
-- =========================

ALTER TABLE mi_basedatos.public.device_inventory
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS code_compuesto TEXT,
  ADD COLUMN IF NOT EXISTS brand_model TEXT,
  ADD COLUMN IF NOT EXISTS hospital TEXT,
  ADD COLUMN IF NOT EXISTS site_code TEXT,
  ADD COLUMN IF NOT EXISTS area_functional TEXT,
  ADD COLUMN IF NOT EXISTS area_code TEXT,
  ADD COLUMN IF NOT EXISTS infra_id TEXT,
  ADD COLUMN IF NOT EXISTS variable_measure TEXT,
  ADD COLUMN IF NOT EXISTS variable_suffix TEXT,
  ADD COLUMN IF NOT EXISTS value_min NUMERIC,
  ADD COLUMN IF NOT EXISTS value_max NUMERIC,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS ip TEXT,
  ADD COLUMN IF NOT EXISTS ip_gateway TEXT,
  ADD COLUMN IF NOT EXISTS mascara TEXT,
  ADD COLUMN IF NOT EXISTS accessory TEXT,
  ADD COLUMN IF NOT EXISTS port_associated TEXT,
  ADD COLUMN IF NOT EXISTS protocol TEXT,
  ADD COLUMN IF NOT EXISTS location_exact TEXT,
  ADD COLUMN IF NOT EXISTS cabinet TEXT,
  ADD COLUMN IF NOT EXISTS cabinet_module TEXT,
  ADD COLUMN IF NOT EXISTS rack TEXT,
  ADD COLUMN IF NOT EXISTS pdu TEXT,
  ADD COLUMN IF NOT EXISTS ups TEXT,
  ADD COLUMN IF NOT EXISTS area_manager TEXT,
  ADD COLUMN IF NOT EXISTS area_role TEXT,
  ADD COLUMN IF NOT EXISTS area_phone TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT,
  ADD COLUMN IF NOT EXISTS change_reason TEXT,
  ADD COLUMN IF NOT EXISTS sede_id TEXT,
  ADD COLUMN IF NOT EXISTS contacto_id TEXT,
  ADD COLUMN IF NOT EXISTS protocolo_id TEXT,
  ADD COLUMN IF NOT EXISTS estado_id TEXT;

DROP INDEX IF EXISTS public.uq_device_inventory_codigo;

CREATE TABLE IF NOT EXISTS mi_basedatos.public.device_code_counters (
  sede_id TEXT PRIMARY KEY REFERENCES mi_basedatos.public.sedes(id_sitio) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Relaciones opcionales (se pueden activar si ya tienes datos consistentes)

-- Relaciones directas por IDs (seguras)
ALTER TABLE mi_basedatos.public.device_inventory
  ADD CONSTRAINT fk_inv_sede
    FOREIGN KEY (sede_id) REFERENCES mi_basedatos.public.sedes(id_sitio)
    ON DELETE SET NULL NOT VALID,
  ADD CONSTRAINT fk_inv_contacto
    FOREIGN KEY (contacto_id) REFERENCES mi_basedatos.public.contactos(id_contacto)
    ON DELETE SET NULL NOT VALID,
  ADD CONSTRAINT fk_inv_infra
    FOREIGN KEY (infra_id) REFERENCES mi_basedatos.public.infra_dc(id_infra)
    ON DELETE SET NULL NOT VALID,
  ADD CONSTRAINT fk_inv_protocolo
    FOREIGN KEY (protocolo_id) REFERENCES mi_basedatos.public.protocolos(id)
    ON DELETE SET NULL NOT VALID,
  ADD CONSTRAINT fk_inv_estado
    FOREIGN KEY (estado_id) REFERENCES mi_basedatos.public.estado_disp(id)
    ON DELETE SET NULL NOT VALID,
  ADD CONSTRAINT fk_inv_catalogo
    FOREIGN KEY (brand_model) REFERENCES mi_basedatos.public.catalogo_equipos(marca_modelo)
    ON DELETE SET NULL NOT VALID;

-- Relaciones por campos comunes (habilitar si hay consistencia y unicidad)
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_sedes_prefijo
--   ON mi_basedatos.public.sedes(prefijo_sitio);
-- ALTER TABLE mi_basedatos.public.device_inventory
--   ADD CONSTRAINT fk_inv_site_code
--     FOREIGN KEY (site_code) REFERENCES mi_basedatos.public.sedes(prefijo_sitio)
--     ON DELETE SET NULL NOT VALID;

-- CREATE UNIQUE INDEX IF NOT EXISTS uq_protocolos_valor
--   ON mi_basedatos.public.protocolos(valor);
-- ALTER TABLE mi_basedatos.public.device_inventory
--   ADD CONSTRAINT fk_inv_protocol_valor
--     FOREIGN KEY (protocol) REFERENCES mi_basedatos.public.protocolos(valor)
--     ON DELETE SET NULL NOT VALID;

-- CREATE UNIQUE INDEX IF NOT EXISTS uq_estado_disp_valor
--   ON mi_basedatos.public.estado_disp(valor);
-- ALTER TABLE mi_basedatos.public.device_inventory
--   ADD CONSTRAINT fk_inv_estado_valor
--     FOREIGN KEY (estado) REFERENCES mi_basedatos.public.estado_disp(valor)
--     ON DELETE SET NULL NOT VALID;

-- =========================
-- VISTA CON NOMBRES EXACTOS DEL EXCEL (HOJA MAESTRA)
-- =========================

CREATE OR REPLACE VIEW mi_basedatos.public.maestra AS
SELECT
  code_compuesto AS "Codigo_Sitio-Codigo_Area-DevID-Variable_a_medir",
  brand_model AS "Marca Modelo",
  device_id AS "DevID",
  hospital AS "Hospital",
  site_code AS "Codigo_Sitio",
  area_functional AS "Area_Funcional",
  area_code AS "Codigo_Area",
  infra_id AS "ID_infra",
  variable_measure AS "Variable_a_medir",
  variable_suffix AS "Sufijo_Var",
  value_min AS "valor_min",
  value_max AS "Valor_Max",
  unit AS "unidad",
  ip AS "IP",
  ip_gateway AS "IP_Gateway",
  mascara AS "Mascara",
  accessory AS "Accesorio_Sonda",
  port_associated AS "Puerto_asociado",
  protocol AS "Protocolo",
  location_exact AS "Ubicacion_Exacta",
  cabinet AS "Gabinete",
  cabinet_module AS "Modulo_de_Gabinete",
  rack AS "Rack",
  pdu AS "PDU",
  ups AS "UPS",
  area_manager AS "Jefe_de_Area",
  area_role AS "Cargo",
  area_phone AS "Telefono",
  estado AS "Estado",
  change_reason AS "Motivo_de_cambio"
  ,codigo AS "Codigo_Inventario"
FROM mi_basedatos.public.device_inventory;

COMMIT;


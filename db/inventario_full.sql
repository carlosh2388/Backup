BEGIN;

-- =========================
-- CATALOGOS BASE
-- =========================

CREATE TABLE IF NOT EXISTS mi_basedatos.public.device_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.manufacturers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.device_models (
  id SERIAL PRIMARY KEY,
  manufacturer_id INTEGER REFERENCES mi_basedatos.public.manufacturers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (manufacturer_id, name)
);

-- =========================
-- CATALOGOS EXCEL
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
  aplicacion_variable TEXT PRIMARY KEY,
  sufijo_id TEXT,
  unidad TEXT,
  rango_min NUMERIC,
  rango_max NUMERIC,
  tipo_sensor_sugerido TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cat_aplicaciones_aplicacion_variable
  ON mi_basedatos.public.cat_aplicaciones(aplicacion_variable);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.estado_disp (
  id TEXT PRIMARY KEY,
  descripcion TEXT,
  valor TEXT,
  motivo_cambio TEXT
);

-- =========================
-- INVENTARIO (TABLA MAESTRA)
-- =========================

CREATE TABLE IF NOT EXISTS mi_basedatos.public.device_inventory (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  codigo TEXT,
  name TEXT NOT NULL,
  description TEXT,
  code_compuesto TEXT,
  numero_interno INTEGER,
  brand_model TEXT,
  hospital TEXT,
  site_code TEXT,
  area_functional TEXT,
  area_code TEXT,
  infra_id TEXT,
  variable_measure TEXT,
  variable_suffix TEXT,
  value_min NUMERIC,
  value_max NUMERIC,
  unit TEXT,
  ip TEXT,
  ip_gateway TEXT,
  mascara TEXT,
  accessory TEXT,
  port_associated TEXT,
  protocol TEXT,
  location_exact TEXT,
  cabinet TEXT,
  cabinet_module TEXT,
  rack TEXT,
  pdu TEXT,
  ups TEXT,
  area_manager TEXT,
  area_role TEXT,
  area_phone TEXT,
  estado TEXT,
  change_reason TEXT,
  sede_id TEXT,
  contacto_id TEXT,
  protocolo_id TEXT,
  estado_id TEXT,
  device_type_id INTEGER REFERENCES mi_basedatos.public.device_types(id) ON DELETE SET NULL,
  location_id INTEGER REFERENCES mi_basedatos.public.locations(id) ON DELETE SET NULL,
  manufacturer_id INTEGER REFERENCES mi_basedatos.public.manufacturers(id) ON DELETE SET NULL,
  model_id INTEGER REFERENCES mi_basedatos.public.device_models(id) ON DELETE SET NULL,
  install_date DATE,
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'mantenimiento', 'baja')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE mi_basedatos.public.device_inventory
  ADD COLUMN IF NOT EXISTS numero_interno INTEGER,
  ADD COLUMN IF NOT EXISTS codigo TEXT;

DROP INDEX IF EXISTS public.uq_device_inventory_codigo;

CREATE TABLE IF NOT EXISTS mi_basedatos.public.device_code_counters (
  sede_id TEXT PRIMARY KEY REFERENCES mi_basedatos.public.sedes(id_sitio) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

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
  ADD CONSTRAINT fk_inv_variable_measure
    FOREIGN KEY (variable_measure) REFERENCES mi_basedatos.public.cat_aplicaciones(aplicacion_variable)
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

-- =========================
-- CONFIGURACION APP (MQTT)
-- =========================
CREATE TABLE IF NOT EXISTS mi_basedatos.public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO mi_basedatos.public.app_settings (key, value)
VALUES
  ('mqtt_dashboard_host', '192.168.70.6'),
  ('mqtt_inventory_host', '10.0.5.35'),
  ('mqtt_port', '1883')
ON CONFLICT (key) DO NOTHING;

-- =========================
-- MQTT SOURCE (DASHBOARD / INVENTARIO)
-- =========================
ALTER TABLE IF EXISTS mi_basedatos.public.sensores_mqtt
  ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE IF EXISTS mi_basedatos.public.sensores_mqtt
  ADD COLUMN IF NOT EXISTS mqtt_host TEXT;

ALTER TABLE IF EXISTS mi_basedatos.public.sensores_mqtt
  ADD COLUMN IF NOT EXISTS mqtt_port INTEGER;

CREATE INDEX IF NOT EXISTS idx_sensores_mqtt_source
  ON mi_basedatos.public.sensores_mqtt(source);

CREATE INDEX IF NOT EXISTS idx_sensores_mqtt_source_timestamp_desc
  ON mi_basedatos.public.sensores_mqtt(source, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_sensores_mqtt_source_device_timestamp_desc
  ON mi_basedatos.public.sensores_mqtt(source, device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_sensores_mqtt_source_host_device_timestamp_desc
  ON mi_basedatos.public.sensores_mqtt(source, mqtt_host, device_id, timestamp DESC);

-- =========================
-- TRIGGERS / INDICES
-- =========================

CREATE OR REPLACE FUNCTION mi_basedatos.public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_device_inventory_updated_at
  ON mi_basedatos.public.device_inventory;
CREATE TRIGGER trg_device_inventory_updated_at
BEFORE UPDATE ON mi_basedatos.public.device_inventory
FOR EACH ROW
EXECUTE FUNCTION mi_basedatos.public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_device_inventory_device_id
  ON mi_basedatos.public.device_inventory(device_id);

CREATE INDEX IF NOT EXISTS idx_device_inventory_created_at_desc
  ON mi_basedatos.public.device_inventory(created_at DESC);

-- =========================
-- INSTALADORES Y ASIGNACIONES
-- =========================

CREATE TABLE IF NOT EXISTS mi_basedatos.public.contractor_companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.installers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  company_id INTEGER REFERENCES mi_basedatos.public.contractor_companies(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE mi_basedatos.public.installers
  ADD COLUMN IF NOT EXISTS company_id INTEGER
    REFERENCES mi_basedatos.public.contractor_companies(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS mi_basedatos.public.device_assignments (
  id SERIAL PRIMARY KEY,
  installer_id INTEGER NOT NULL
    REFERENCES mi_basedatos.public.installers(id) ON DELETE RESTRICT,
  sede_id TEXT
    REFERENCES mi_basedatos.public.sedes(id_sitio) ON DELETE SET NULL,
  folio TEXT,
  location_id INTEGER
    REFERENCES mi_basedatos.public.locations(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'en_progreso', 'completado', 'cancelado')),
  notes TEXT,
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE mi_basedatos.public.device_assignments
  ADD COLUMN IF NOT EXISTS sede_id TEXT
    REFERENCES mi_basedatos.public.sedes(id_sitio) ON DELETE SET NULL;

ALTER TABLE mi_basedatos.public.device_assignments
  ADD COLUMN IF NOT EXISTS folio TEXT;

CREATE TABLE IF NOT EXISTS mi_basedatos.public.device_assignment_items (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL
    REFERENCES mi_basedatos.public.device_assignments(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL
    REFERENCES mi_basedatos.public.device_inventory(device_id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, device_id)
);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.assignment_folio_seq (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_device_assignments_installer
  ON mi_basedatos.public.device_assignments(installer_id);
CREATE INDEX IF NOT EXISTS idx_device_assignments_location
  ON mi_basedatos.public.device_assignments(location_id);
CREATE INDEX IF NOT EXISTS idx_device_assignments_sede
  ON mi_basedatos.public.device_assignments(sede_id);

CREATE INDEX IF NOT EXISTS idx_device_assignment_items_device_id
  ON mi_basedatos.public.device_assignment_items(device_id);
CREATE INDEX IF NOT EXISTS idx_device_assignment_items_assignment
  ON mi_basedatos.public.device_assignment_items(assignment_id);

-- =========================
-- VISTA MAESTRA (EXCEL)
-- =========================

CREATE OR REPLACE VIEW mi_basedatos.public.maestra AS
SELECT
  di.code_compuesto,
  di.device_id,
  di.codigo,
  di."name",
  di.hospital,
  di.area_functional,
  di.variable_measure,
  di.variable_suffix,
  di.value_min,
  di.value_max,
  di.unit,
  di.ip,
  di.ip_gateway,
  di.mascara,
  di.accessory,
  di.port_associated,
  p.descripcion AS protocolo_descripcion,
  m.description AS fabricante_descripcion,
  dt.description AS tipo_descripcion,
  dm.description AS modelo_descripcion,
  di.numero_interno,
  di.created_at,
  ed.descripcion AS estado_descripcion,
  COALESCE(s.sede_principal, di.hospital) AS sede
FROM mi_basedatos.public.device_inventory di
LEFT JOIN mi_basedatos.public.manufacturers m
  ON m.id = di.manufacturer_id
LEFT JOIN mi_basedatos.public.protocolos p
  ON p.id = di.protocolo_id
LEFT JOIN mi_basedatos.public.device_types dt
  ON dt.id = di.device_type_id
LEFT JOIN mi_basedatos.public.device_models dm
  ON dm.id = di.model_id
LEFT JOIN mi_basedatos.public.estado_disp ed
  ON ed.id = di.estado_id
LEFT JOIN mi_basedatos.public.sedes s
  ON s.id_sitio = di.sede_id;

-- Stock manual por sede y tipo
CREATE TABLE IF NOT EXISTS mi_basedatos.public.device_stock_sede_type (
  id serial PRIMARY KEY,
  sede_id text NOT NULL,
  device_type_id int NOT NULL,
  total int NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE (sede_id, device_type_id)
);

COMMIT;

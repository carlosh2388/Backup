BEGIN;

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

CREATE TABLE IF NOT EXISTS mi_basedatos.public.device_inventory (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  code_compuesto TEXT,
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
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

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

CREATE TABLE IF NOT EXISTS mi_basedatos.public.installers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.device_assignments (
  id SERIAL PRIMARY KEY,
  installer_id INTEGER NOT NULL
    REFERENCES mi_basedatos.public.installers(id) ON DELETE RESTRICT,
  location_id INTEGER
    REFERENCES mi_basedatos.public.locations(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'en_progreso', 'completado', 'cancelado')),
  notes TEXT,
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mi_basedatos.public.device_assignment_items (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL
    REFERENCES mi_basedatos.public.device_assignments(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL
    REFERENCES mi_basedatos.public.device_inventory(device_id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_device_assignments_installer
  ON mi_basedatos.public.device_assignments(installer_id);
CREATE INDEX IF NOT EXISTS idx_device_assignments_location
  ON mi_basedatos.public.device_assignments(location_id);

CREATE INDEX IF NOT EXISTS idx_device_assignment_items_device_id
  ON mi_basedatos.public.device_assignment_items(device_id);
CREATE INDEX IF NOT EXISTS idx_device_assignment_items_assignment
  ON mi_basedatos.public.device_assignment_items(assignment_id);

-- =========================
-- DATOS DE PRUEBA (DINAMICOS)
-- =========================

INSERT INTO mi_basedatos.public.device_types (name, description)
VALUES
  ('Ambiental', 'Sensores de calidad ambiental'),
  ('Energia', 'Medidores y energia'),
  ('Seguridad', 'Sensores de seguridad')
ON CONFLICT (name) DO NOTHING;

INSERT INTO mi_basedatos.public.locations (name, description)
VALUES
  ('Sala Presidencial', 'Nivel 1'),
  ('Data Center', 'Nivel 2'),
  ('Oficina 3', 'Nivel 3')
ON CONFLICT (name) DO NOTHING;

INSERT INTO mi_basedatos.public.manufacturers (name, description)
VALUES
  ('SenseAir', 'Fabricante CO2'),
  ('Bosch', 'Fabricante multi-sensor'),
  ('Schneider', 'Fabricante industrial')
ON CONFLICT (name) DO NOTHING;

INSERT INTO mi_basedatos.public.device_models (manufacturer_id, name, description)
SELECT m.id, v.name, v.description
FROM (VALUES
  ('SenseAir', 'S8', 'CO2 sensor'),
  ('Bosch', 'BME680', 'Temp/Humedad/TVOC'),
  ('Schneider', 'PM8000', 'Medidor energia')
) AS v(manufacturer_name, name, description)
JOIN mi_basedatos.public.manufacturers m
  ON m.name = v.manufacturer_name
ON CONFLICT (manufacturer_id, name) DO NOTHING;

INSERT INTO mi_basedatos.public.installers (name, phone, email)
VALUES
  ('Juan Perez', '555-0101', 'juan.perez@siasa.local'),
  ('Maria Lopez', '555-0102', 'maria.lopez@siasa.local')
ON CONFLICT DO NOTHING;

WITH src AS (
  SELECT
    s.device_id,
    MAX(s.device_name) AS device_name,
    MAX(s."timestamp") AS last_ts
  FROM mi_basedatos.public.sensores_mqtt s
  WHERE s.device_id IS NOT NULL
  GROUP BY s.device_id
),
filtered AS (
  SELECT s.device_id, s.device_name, s.last_ts
  FROM src s
  LEFT JOIN mi_basedatos.public.device_inventory di
    ON di.device_id = s.device_id
  WHERE di.device_id IS NULL
  ORDER BY s.last_ts DESC
  LIMIT 50
),
numbered AS (
  SELECT
    ROW_NUMBER() OVER (ORDER BY last_ts DESC, device_id) AS n,
    device_id,
    device_name
  FROM filtered
)
INSERT INTO mi_basedatos.public.device_inventory
  (device_id, name, description, device_type_id, location_id, manufacturer_id, model_id, install_date, status)
SELECT
  v.device_id,
  COALESCE(NULLIF(v.device_name, ''), 'Sensor ' || v.n) AS name,
  'Carga desde sensores_mqtt' AS description,
  t.id,
  l.id,
  m.id,
  dm.id,
  v.install_date,
  v.status
FROM (
  SELECT
    n,
    device_id,
    device_name,
    CASE
      WHEN n % 3 = 1 THEN 'Ambiental'
      WHEN n % 3 = 2 THEN 'Energia'
      ELSE 'Seguridad'
    END AS type_name,
    CASE
      WHEN n % 3 = 1 THEN 'Sala Presidencial'
      WHEN n % 3 = 2 THEN 'Data Center'
      ELSE 'Oficina 3'
    END AS location_name,
    CASE
      WHEN n % 3 = 1 THEN 'SenseAir'
      WHEN n % 3 = 2 THEN 'Bosch'
      ELSE 'Schneider'
    END AS manufacturer_name,
    CASE
      WHEN n % 3 = 1 THEN 'S8'
      WHEN n % 3 = 2 THEN 'BME680'
      ELSE 'PM8000'
    END AS model_name,
    (CURRENT_DATE - (n - 1))::date AS install_date,
    CASE
      WHEN n % 3 = 0 THEN 'mantenimiento'
      ELSE 'activo'
    END AS status
  FROM numbered
) AS v
JOIN mi_basedatos.public.device_types t ON t.name = v.type_name
JOIN mi_basedatos.public.locations l ON l.name = v.location_name
JOIN mi_basedatos.public.manufacturers m ON m.name = v.manufacturer_name
JOIN mi_basedatos.public.device_models dm ON dm.name = v.model_name AND dm.manufacturer_id = m.id
ON CONFLICT (device_id) DO NOTHING;

INSERT INTO mi_basedatos.public.device_assignments
  (installer_id, location_id, quantity, status, notes)
SELECT
  i.id,
  l.id,
  2,
  'pendiente',
  'Asignacion de prueba'
FROM mi_basedatos.public.installers i
JOIN mi_basedatos.public.locations l ON l.name = 'Sala Presidencial'
WHERE i.name = 'Juan Perez'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO mi_basedatos.public.device_assignment_items
  (assignment_id, device_id)
SELECT a.id, v.device_id
FROM mi_basedatos.public.device_assignments a
JOIN (
  SELECT device_id
  FROM mi_basedatos.public.device_inventory
  ORDER BY created_at DESC
  LIMIT 2
) AS v ON TRUE
WHERE a.notes = 'Asignacion de prueba'
ON CONFLICT DO NOTHING;

COMMIT;

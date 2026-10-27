-- Importación completa de códigos de Escuintla.
-- Fuente: tabla de Codigos_Sede_Escuintla.xlsx
-- 121 códigos HES / 158 códigos compuestos individuales.
BEGIN;

CREATE TABLE IF NOT EXISTS public.device_inventory_codes (
  id BIGSERIAL PRIMARY KEY,
  inventory_id INTEGER NULL
    REFERENCES public.device_inventory(id) ON DELETE CASCADE,
  codigo VARCHAR(20) NOT NULL,
  code_compuesto TEXT NOT NULL,
  analog_pin VARCHAR(10),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_device_inventory_codes_compuesto UNIQUE (code_compuesto)
);

CREATE INDEX IF NOT EXISTS idx_device_inventory_codes_inventory
  ON public.device_inventory_codes(inventory_id);

CREATE INDEX IF NOT EXISTS idx_device_inventory_codes_codigo
  ON public.device_inventory_codes(codigo);

CREATE TABLE IF NOT EXISTS public.device_code_counters (
  sede_id TEXT PRIMARY KEY
    REFERENCES public.sedes(id_sitio) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

WITH datos_excel (codigo, code_compuesto) AS (
  VALUES
  ('HES001', 'HES-BOM-FFBF509E-H2O-1-AI0'),
  ('HES002', 'HES-BOM-ffbf5064-BA-2-AI0'),
  ('HES003', 'HES-BOM-FFB34EB5-BA-3-AI0'),
  ('HES004', 'HES-CUA-ffb34ec3-CL-2-AI0'),
  ('HES005', 'HES-CUA-ffb34ec3-CL-2-AI1'),
  ('HES006', 'HES-CL-FFBF507D-AC-1-AI0'),
  ('HES007', 'HES-BAN-FFBF509A-CF-3-AI1'),
  ('HES007', 'HES-BAN-1E510995-8'),
  ('HES008', 'HES-BAN-FFBF509A-CF-3-AI0'),
  ('HES008', 'HES-BAN-1E511833-7'),
  ('HES009', 'HES-BAN-FFBF509A-CF-3-AI2'),
  ('HES009', 'HES-BAN-1E510963-11'),
  ('HES010', 'HES-BAN-FFBB71BB-CF-1-AI0'),
  ('HES010', 'HES-BAN-1E511071-9'),
  ('HES011', 'HES-BAN-FFBB71BB-CF-1-AI1'),
  ('HES011', 'HES-BAN-1E510871-6'),
  ('HES012', 'HES-BAN-FFBB71BB-CF-1-AI3'),
  ('HES012', 'HES-BAN-1E511738-10'),
  ('HES013', 'HES-BAN-FFBB71BB-CF-1-AI2'),
  ('HES013', 'HES-BAN-1E511860-3'),
  ('HES014', 'HES-BAN-FFBF5092-CF-2-AI0'),
  ('HES014', 'HES-BAN-1D228864-1'),
  ('HES015', 'HES-BAN-FFBF5092-CF-2-AI2'),
  ('HES015', 'HES-BAN-1F458718-5'),
  ('HES016', 'HES-BAN-FFBF5092-CF-2-AI3'),
  ('HES016', 'HES-BAN-1D221028-2'),
  ('HES017', 'HES-BAN-FFBF5092-CF-2-AI1'),
  ('HES017', 'HES-BAN-1F454065-4'),
  ('HES018', 'HES-FAR-FFBB71B7-CF-2-AI0'),
  ('HES018', 'HES-FAR-1E516637-3'),
  ('HES019', 'HES-FAR-FFBB71B7-CF-2-AI1'),
  ('HES019', 'HES-FAR-1E511028-4'),
  ('HES020', 'HES-CLI-ffb34ebc-CF-2-AI1'),
  ('HES020', 'HES-CLI-1E511702-2'),
  ('HES021', 'HES-CLI-ffb34ebc-CF-2-AI0'),
  ('HES021', 'HES-CLI-1E510105-1'),
  ('HES022', 'HES-BOD-ffbb71ac-CF-1-AI0'),
  ('HES022', 'HES-BOD-1E511408-1'),
  ('HES023', 'HES-CLI-ffb34ebc-CF-2-AI2'),
  ('HES023', 'HES-CLI-1F458178-6'),
  ('HES024', 'HES-CLI-ffb34ebc-CF-2-AI3'),
  ('HES024', 'HES-CLI-1F451435-4'),
  ('HES025', 'HES-FAR-FFB4F12D-CF-1-AI2'),
  ('HES025', 'HES-FAR-1E512247-2'),
  ('HES026', 'HES-FAR-FFB4F12D-CF-1-AI3'),
  ('HES026', 'HES-FAR-1E510065-6'),
  ('HES026', 'HES-BOD-1E511037-2'),
  ('HES027', 'HES-FAR-FFB4F12D-CF-1-AI0'),
  ('HES027', 'HES-BOD-1F451918-4'),
  ('HES027', 'HES-FAR-1E511749-7'),
  ('HES028', 'HES-FAR-FFB4F12D-CF-1-AI1'),
  ('HES028', 'HES-FAR-1E511053-5'),
  ('HES028', 'HES-BOD-1F456546-5'),
  ('HES029', 'HES-LAB-FFBB71AE-CF-1-AI0'),
  ('HES029', 'HES-LAB-1E512177-4'),
  ('HES030', 'HES-LAB-FFBB71AE-CF-1-AI1'),
  ('HES030', 'HES-LAB-1E511896-5'),
  ('HES031', 'HES-LAB-FFBB71B4-CF-1-AI2'),
  ('HES031', 'HES-LAB-1E518673-2'),
  ('HES032', 'HES-LAB-FFBB71B4-CF-1-AI1'),
  ('HES032', 'HES-LAB-1E514801-3'),
  ('HES033', 'HES-LAB-FFBB71B4-CF-1-AI0'),
  ('HES033', 'HES-LAB-1E512349-1'),
  ('HES034', 'HES-UNI-FFBF5067-CF-1-AI0'),
  ('HES034', 'HES-UNI-1d051245'),
  ('HES034', 'HES-UNI-1e512018-2'),
  ('HES035', 'HES-UNI-FFBF5067-CF-1-AI3'),
  ('HES035', 'HES-UNI-1f453524-5'),
  ('HES036', 'HES-UNI-FFBF5067-CF-1-AI2'),
  ('HES036', 'HES-UNI-1f458278-6'),
  ('HES037', 'HES-UNI-FFBF5067-CF-1-AI1'),
  ('HES037', 'HES-UNI-1e510086-3'),
  ('HES037', 'HES-UNI-1f458030-4'),
  ('HES038', 'HES-BAN-0d486410-AIR-1'),
  ('HES039', 'HES-BAN-0f136348-AIR-2'),
  ('HES040', 'HES-BAN-0d488290-AIR-3'),
  ('HES041', 'HES-BAN-0d486071-AIR-4'),
  ('HES042', 'HES-BOD-0d486787-AIR-1'),
  ('HES043', 'HES-BOD-0e029218-AIR-2'),
  ('HES044', 'HES-CON-0e422728-AIR-1'),
  ('HES045', 'HES-CON-0e429477-AIR-2'),
  ('HES046', 'HES-CON-0f131662-AIR-3'),
  ('HES047', 'HES-CON-0f130161-AIR-4'),
  ('HES048', 'HES-CON-0f131758-AIR-5'),
  ('HES049', 'HES-CON-0f130340-AIR-6'),
  ('HES050', 'HES-CON-0e422691-AIR-8'),
  ('HES051', 'HES-CON-0f131822-AIR-7'),
  ('HES052', 'HES-EME-0e023328-AIR-1'),
  ('HES053', 'HES-EME-0e023232-AIR-3'),
  ('HES054', 'HES-EME-0e023010-AIR-2'),
  ('HES055', 'HES-QUI-0e028893-AIR-2'),
  ('HES056', 'HES-EME-0d483351-AIR-5'),
  ('HES057', 'HES-ENC-0e429062-AIR-1'),
  ('HES058', 'HES-ENC-0f130514-AIR-2'),
  ('HES059', 'HES-ENC-0e429083-AIR-3'),
  ('HES060', 'HES-ENC-0f131656-AIR-4'),
  ('HES061', 'HES-ENC-0f130171-AIR-6'),
  ('HES062', 'HES-ENC-0e429159-AIR-5'),
  ('HES063', 'HES-UNI-0d486319-AIR-4'),
  ('HES064', 'HES-ENC-0f130740-AIR-8'),
  ('HES065', 'HES-ENC-0e422697-AIR-9'),
  ('HES066', 'HES-ENC-0f130251-AIR-14'),
  ('HES067', 'HES-ENC-0f130745-AIR-15'),
  ('HES068', 'HES-ENC-0f131446-AIR-12'),
  ('HES069', 'HES-ENC-0f131821-AIR-13'),
  ('HES070', 'HES-ENC-0e429397-AIR-10'),
  ('HES071', 'HES-ENC-0f132095-AIR-11'),
  ('HES072', 'HES-ENC-0f133237-AIR-16'),
  ('HES073', 'HES-MDS-0f137399-AIR-15'),
  ('HES074', 'HES-MDS-0f136411-AIR-16'),
  ('HES075', 'HES-MDS-0f137246-AIR-9'),
  ('HES076', 'HES-MDS-0f139516-AIR-7'),
  ('HES077', 'HES-MDS-0f139006-AIR-11'),
  ('HES078', 'HES-MDS-0f139180-AIR-6'),
  ('HES079', 'HES-MDS-0F137821-AIR-1'),
  ('HES080', 'HES-MDS-0F137572-AIR-2'),
  ('HES081', 'HES-MDS-0f139683-AIR-10'),
  ('HES082', 'HES-MDS-0f136009-AIR-8'),
  ('HES083', 'HES-MDS-0f137592-AIR-13'),
  ('HES084', 'HES-MDS-0f135654-AIR-14'),
  ('HES085', 'HES-FAR-0d484497-AIR-1'),
  ('HES086', 'HES-FAR-0e028896-AIR-2'),
  ('HES087', 'HES-INT-0e423102-AIR-1'),
  ('HES088', 'HES-INT-0f131508-AIR-2'),
  ('HES089', 'HES-INT-0f131559-AIR-3'),
  ('HES090', 'HES-LAB-0e029565-AIR-1'),
  ('HES091', 'HES-LAB-0d486792-AIR-2'),
  ('HES092', 'HES-LAB-0d486397-AIR-3'),
  ('HES093', 'HES-LAB-0d484659-AIR-4'),
  ('HES094', 'HES-LAB-0d485220-AIR-5'),
  ('HES095', 'HES-LAB-0e029534-AIR-6'),
  ('HES096', 'HES-NEO-0e429241-AIR-1'),
  ('HES097', 'HES-QUI-0d486199-AIR-1'),
  ('HES098', 'HES-UNI-0f130263-AIR-7'),
  ('HES099', 'HES-QUI-0e028122-AIR-3'),
  ('HES100', 'HES-QUI-0e028108-AIR-4'),
  ('HES101', 'HES-QUI-0d488520-AIR-5'),
  ('HES102', 'HES-QUI-0e029203-AIR-6'),
  ('HES103', 'HES-RAY-0e429245-AIR-1'),
  ('HES104', 'HES-RAY-0e422698-AIR-2'),
  ('HES105', 'HES-CON-11C34903-PWR-1'),
  ('HES106', 'HES-CON-11D37703-PWR-1'),
  ('HES107', 'HES-CUA-11C35303-PWR-1'),
  ('HES108', 'HES-CUA-11D52003-PWR-2'),
  ('HES109', 'HES-MDS-10A45603-PWR-1'),
  ('HES110', 'HES-MDS-09C22103-PWR-2'),
  ('HES111', 'HES-EME-20103317-PRE-1'),
  ('HES112', 'HES-FAR-02203835-PRE-1'),
  ('HES113', 'HES-INT-20103790-PRE-1'),
  ('HES114', 'HES-LAB-20103796-PRE-1'),
  ('HES115', 'HES-NEO-20103662-PRE-1'),
  ('HES116', 'HES-QUI-20103817-PRE-1'),
  ('HES117', 'HES-QUI-20103798-PRE-2'),
  ('HES118', 'HES-CUA-00047ce9-TH-1'),
  ('HES119', 'HES-CUA-00047ce8-TH-2'),
  ('HES120', 'HES-MDS-00047ce1-TH-3'),
  ('HES121', 'HES-FAR-FFC1DD98-CF-3-AI0'),
  ('HES121', 'HES-FAR-1E511347-1')
),
datos_preparados AS (
  SELECT
    codigo,
    code_compuesto,
    UPPER(REGEXP_REPLACE(code_compuesto, '[^A-Z0-9]', '', 'g')) AS normalizado,
    UPPER(SPLIT_PART(code_compuesto, '-', 3)) AS identificador_dispositivo,
    UPPER(SUBSTRING(code_compuesto FROM '(AI[0-3])$')) AS analog_pin
  FROM datos_excel
),
resueltos AS (
  SELECT
    datos.codigo,
    datos.code_compuesto,
    datos.analog_pin,
    dispositivo.id AS inventory_id
  FROM datos_preparados datos
  LEFT JOIN LATERAL (
    SELECT inventario.id
    FROM public.device_inventory inventario
    WHERE UPPER(REGEXP_REPLACE(inventario.code_compuesto, '[^A-Z0-9]', '', 'g'))
            = datos.normalizado
       OR UPPER(RIGHT(inventario.device_id, 8)) = datos.identificador_dispositivo
    ORDER BY
      CASE
        WHEN UPPER(REGEXP_REPLACE(inventario.code_compuesto, '[^A-Z0-9]', '', 'g'))
             = datos.normalizado
        THEN 0 ELSE 1
      END,
      inventario.id
    LIMIT 1
  ) dispositivo ON TRUE
)
INSERT INTO public.device_inventory_codes (
  inventory_id,
  codigo,
  code_compuesto,
  analog_pin
)
SELECT
  inventory_id,
  codigo,
  code_compuesto,
  analog_pin
FROM resueltos
ON CONFLICT (code_compuesto) DO UPDATE
SET inventory_id = EXCLUDED.inventory_id,
    codigo = EXCLUDED.codigo,
    analog_pin = EXCLUDED.analog_pin,
    updated_at = NOW();

-- Sincroniza el campo codigo de la fila padre.
-- Un canal: HES038. Varios canales del mismo device_id: HES004 / HES005.
WITH codigos_por_dispositivo AS (
  SELECT
    inventory_id,
    STRING_AGG(DISTINCT codigo, ' / ' ORDER BY codigo) AS codigos
  FROM public.device_inventory_codes
  WHERE inventory_id IS NOT NULL
  GROUP BY inventory_id
)
UPDATE public.device_inventory inventario
SET codigo = resumen.codigos,
    updated_at = NOW()
FROM codigos_por_dispositivo resumen
WHERE inventario.id = resumen.inventory_id;

-- Escuintla ya utiliza HES001-HES121; el próximo registro será HES122.
INSERT INTO public.device_code_counters (sede_id, last_number, updated_at)
VALUES ('S-008', 121, NOW())
ON CONFLICT (sede_id) DO UPDATE
SET last_number = GREATEST(
      public.device_code_counters.last_number,
      EXCLUDED.last_number
    ),
    updated_at = NOW();

CREATE OR REPLACE VIEW public.v_device_inventory_codes AS
SELECT
  codigos.id,
  codigos.codigo,
  codigos.code_compuesto,
  codigos.analog_pin,
  codigos.inventory_id,
  inventario.device_id,
  inventario.name AS dispositivo,
  inventario.sede_id,
  sedes.sede_principal AS sede
FROM public.device_inventory_codes codigos
LEFT JOIN public.device_inventory inventario
  ON inventario.id = codigos.inventory_id
LEFT JOIN public.sedes sedes
  ON sedes.id_sitio = inventario.sede_id;

COMMIT;

-- Resultado general: deben aparecer 158 filas.
SELECT *
FROM public.v_device_inventory_codes
ORDER BY codigo, code_compuesto;

-- Diagnóstico: códigos cuyo dispositivo padre no fue encontrado.
SELECT codigo, code_compuesto, analog_pin
FROM public.device_inventory_codes
WHERE inventory_id IS NULL
ORDER BY codigo, code_compuesto;

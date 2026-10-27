-- SOLUCIÓN COMPLETA ESCUINTLA
-- Separa por / los códigos compuestos del Excel y asigna el mismo HES a cada registro.
-- No modifica code_compuesto; únicamente actualiza device_inventory.codigo.
-- Para bases repetidas utiliza port_associated (AI0, AI1, AI2 o AI3).
WITH datos_excel (codigo, codigos_compuestos) AS (
  VALUES
  ('HES001', 'HES-BOM-FFBF509E-H2O-1 A· AI0'),
  ('HES002', 'HES-BOM-ffbf5064-BA-2 A· AI0'),
  ('HES003', 'HES-BOM-FFB34EB5-BA-3 A· AI0'),
  ('HES004', 'HES-CUA-ffb34ec3-CL-2 A· AI0'),
  ('HES005', 'HES-CUA-ffb34ec3-CL-2 A· AI1'),
  ('HES006', 'HES-CL-FFBF507D-AC-1 A· AI0'),
  ('HES007', 'HES-BAN-FFBF509A-CF-3 A· AI1 /HES-BAN-1E510995-8'),
  ('HES008', 'HES-BAN-FFBF509A-CF-3 A· AI0 /HES-BAN-1E511833-7'),
  ('HES009', 'HES-BAN-FFBF509A-CF-3 A· AI2 /HES-BAN-1E510963-11'),
  ('HES010', 'HES-BAN-FFBB71BB-CF-1 A· AI0 /HES-BAN-1E511071-9'),
  ('HES011', 'HES-BAN-FFBB71BB-CF-1 A· AI1 /HES-BAN-1E510871-6'),
  ('HES012', 'HES-BAN-FFBB71BB-CF-1 A· AI3 /HES-BAN-1E511738-10'),
  ('HES013', 'HES-BAN-FFBB71BB-CF-1 A· AI2 /HES-BAN-1E511860-3'),
  ('HES014', 'HES-BAN-FFBF5092-CF-2 A· AI0 /HES-BAN-1D228864-1'),
  ('HES015', 'HES-BAN-FFBF5092-CF-2 A· AI2 /HES-BAN-1F458718-5'),
  ('HES016', 'HES-BAN-FFBF5092-CF-2 A· AI3 /HES-BAN-１D22１０２８－２'),
  ('HES017', 'HES-BAN-FFBF5092-CF-2 A· AI1 /HES-BAN-1F454065-4'),
  ('HES018', 'HES-FAR-FFBB71B7-CF-2 A· AI0 /HES-FAR-1E516637-3'),
  ('HES019', 'HES-FAR-FFBB71B7-CF-2 A· AI1 /HES-FAR-1E511028-4'),
  ('HES020', 'HES-CLI-ffb34ebc-CF-2 A· AI1 /HES-CLI-1E511702-2'),
  ('HES021', 'HES-CLI-ffb34ebc-CF-2 A· AI0 /HES-CLI-1E510105-1'),
  ('HES022', 'HES-BOD-ffbb71ac-CF-1 A· AI0 /HES-BOD-1E511408-1'),
  ('HES023', 'HES-CLI-ffb34ebc-CF-2 A· AI2 /HES-CLI-1F458178-6'),
  ('HES024', 'HES-CLI-ffb34ebc-CF-2 A· AI3 /HES-CLI-1F451435-4'),
  ('HES025', 'HES-FAR-FFB4F12D-CF-1 A· AI2 /HES-FAR-1E512247-2'),
  ('HES026', 'HES-FAR-FFB4F12D-CF-1 A· AI3 /HES-FAR-1E510065-6 / HES-BOD-1E511037-2'),
  ('HES027', 'HES-FAR-FFB4F12D-CF-1 A· AI0 /HES-BOD-1F451918-4 / HES-FAR-1E511749-7'),
  ('HES028', 'HES-FAR-FFB4F12D-CF-1 A· AI1 /HES-FAR-1E511053-5 / HES-BOD-1F456546-5'),
  ('HES029', 'HES-LAB-FFBB71AE-CF-1 A· AI0 /HES-LAB-1E512177-4'),
  ('HES030', 'HES-LAB-FFBB71AE-CF-1 A· AI1/HES-LAB-1E511896-5'),
  ('HES031', 'HES-LAB-FFBB71B4-CF-1 A· AI2 /HES-LAB-1E518673-2'),
  ('HES032', 'HES-LAB-FFBB71B4-CF-1 A· AI1 /HES-LAB-1E514801-3'),
  ('HES033', 'HES-LAB-FFBB71B4-CF-1 A· AI0 /HES-LAB-1E512349-1'),
  ('HES034', 'HES-UNI-FFBF5067-CF-1 A· AI0 / HES-UNI-1d051245 / 1 HES-UNI-１e5１20１8－２'),
  ('HES035', 'HES-UNI-FFBF5067-CF-１ A· AI3 / HES-UNI-１f４５３５２４－５'),
  ('HES036', 'HES-UNI-FFBF5067-CF-１ A· AI2 / HES-UNI-１f４５８２７８－６'),
  ('HES037', 'HES-UNI-FFBF5067-CF-1 A· AI1 / HES-UNI-1e510086-3 / HES-UNI-1f458030-4'),
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
  ('HES121', 'HES-FAR-FFC1DD98-CF-3 A· AI0 /HES-FAR-1E511347-1')
),
mapeo AS (
  SELECT
    datos_excel.codigo,
    BTRIM(
      REGEXP_REPLACE(
        parte.codigo_compuesto,
        '^[0-9]+\\s+(HES-)',
        '\\1',
        'i'
      )
    ) AS code_compuesto_nuevo
  FROM datos_excel
  CROSS JOIN LATERAL REGEXP_SPLIT_TO_TABLE(
    datos_excel.codigos_compuestos,
    '\\s*/\\s*'
  ) AS parte(codigo_compuesto)
),
mapeo_preparado AS (
  SELECT
    codigo,
    code_compuesto_nuevo,
    UPPER(
      REGEXP_REPLACE(
        REPLACE(REPLACE(code_compuesto_nuevo, 'Â', ''), '·', '-'),
        '\\s+',
        '',
        'g'
      )
    ) AS codigo_normalizado,
    UPPER(
      REPLACE(
        SUBSTRING(code_compuesto_nuevo FROM 'AI([0-3O])\\s*$'),
        'O',
        '0'
      )
    ) AS numero_ai,
    UPPER(
      REGEXP_REPLACE(
        REPLACE(
          REPLACE(REGEXP_REPLACE(
            code_compuesto_nuevo,
            'A?[^A-Za-z0-9]*AI[0-3O]\\s*$',
            '',
            'i'
          ), 'Â', ''),
          '·',
          '-'
        ),
        '\\s+',
        '',
        'g'
      )
    ) AS codigo_base_normalizado
  FROM mapeo
  WHERE code_compuesto_nuevo <> ''
),
inventario_preparado AS (
  SELECT
    inventario.id,
    UPPER(
      REGEXP_REPLACE(
        REPLACE(BTRIM(inventario.code_compuesto), '·', '-'),
        '\\s+',
        '',
        'g'
      )
    ) AS codigo_actual_normalizado,
    UPPER(
      REPLACE(
        REGEXP_REPLACE(
          COALESCE(inventario.port_associated, inventario.variable_suffix, ''),
          '[^0-3O]',
          '',
          'g'
        ),
        'O',
        '0'
      )
    ) AS numero_ai
  FROM public.device_inventory inventario
),
coincidencias AS (
  SELECT
    inventario.id,
    mapeo.codigo,
    mapeo.code_compuesto_nuevo,
    ROW_NUMBER() OVER (
      PARTITION BY inventario.id
      ORDER BY
        CASE
          WHEN inventario.codigo_actual_normalizado = mapeo.codigo_normalizado
          THEN 0
          ELSE 1
        END,
        mapeo.codigo
    ) AS prioridad,
    COUNT(*) OVER (PARTITION BY inventario.id) AS total_coincidencias
  FROM inventario_preparado inventario
  INNER JOIN mapeo_preparado mapeo
    ON inventario.codigo_actual_normalizado = mapeo.codigo_normalizado
    OR (
      mapeo.numero_ai IS NOT NULL
      AND inventario.codigo_actual_normalizado = mapeo.codigo_base_normalizado
      AND inventario.numero_ai = mapeo.numero_ai
    )
),
actualizados AS (
  UPDATE public.device_inventory inventario
  SET codigo = coincidencia.codigo,
      updated_at = NOW()
  FROM coincidencias coincidencia
  WHERE inventario.id = coincidencia.id
    AND coincidencia.prioridad = 1
    AND coincidencia.total_coincidencias = 1
  RETURNING
    inventario.id,
    inventario.device_id,
    inventario.port_associated,
    inventario.variable_suffix,
    inventario.code_compuesto,
    inventario.codigo
)
SELECT *
FROM actualizados
ORDER BY codigo, code_compuesto;

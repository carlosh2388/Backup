BEGIN;

DROP VIEW IF EXISTS public.maestra;

CREATE VIEW public.maestra AS
SELECT
  di.code_compuesto,
  di.device_id,
  di.codigo,
  di.name,
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
FROM public.device_inventory di
LEFT JOIN public.manufacturers m ON m.id = di.manufacturer_id
LEFT JOIN public.protocolos p ON p.id = di.protocolo_id
LEFT JOIN public.device_types dt ON dt.id = di.device_type_id
LEFT JOIN public.device_models dm ON dm.id = di.model_id
LEFT JOIN public.estado_disp ed ON ed.id = di.estado_id
LEFT JOIN public.sedes s ON s.id_sitio = di.sede_id;

COMMIT;

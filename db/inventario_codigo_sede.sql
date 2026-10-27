BEGIN;

ALTER TABLE public.device_inventory
  ADD COLUMN IF NOT EXISTS codigo TEXT;

ALTER TABLE public.device_inventory
  DROP CONSTRAINT IF EXISTS device_inventory_codigo_key;

DROP INDEX IF EXISTS public.uq_device_inventory_codigo;

CREATE TABLE IF NOT EXISTS public.device_code_counters (
  sede_id TEXT PRIMARY KEY REFERENCES public.sedes(id_sitio) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO public.device_code_counters (sede_id, last_number)
SELECT s.id_sitio,
       COALESCE(MAX(
         CASE
           WHEN d.codigo ~ '[0-9]+$'
           THEN substring(d.codigo FROM '([0-9]+)$')::integer
           ELSE 0
         END
       ), 0)
FROM public.sedes s
LEFT JOIN public.device_inventory d ON d.sede_id = s.id_sitio
WHERE NULLIF(BTRIM(s.prefijo_sitio), '') IS NOT NULL
GROUP BY s.id_sitio
ON CONFLICT (sede_id) DO UPDATE
SET last_number = GREATEST(public.device_code_counters.last_number, EXCLUDED.last_number),
    updated_at = NOW();

COMMIT;

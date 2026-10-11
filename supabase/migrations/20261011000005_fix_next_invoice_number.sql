-- ============================================================================
-- Fix next_invoice_number : SECURITY DEFINER pour contourner RLS sur counters
-- ============================================================================
CREATE OR REPLACE FUNCTION public.next_invoice_number() RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  annee  int;
  numero int;
BEGIN
  annee := EXTRACT(YEAR FROM now())::int;
  INSERT INTO counters (name, value) VALUES ('invoice:' || annee, 1)
    ON CONFLICT (name) DO UPDATE SET value = counters.value + 1
  RETURNING value INTO numero;
  RETURN 'F' || annee || '-' || lpad(numero::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO service_role;

-- Diagnostic temporaire : lire l'état réel des politiques dans la base.
-- Les fichiers SQL du dépôt peuvent avoir divergé ; cette fonction dit ce qui
-- est réellement appliqué. Elle est retirée par la migration suivante.
CREATE OR REPLACE FUNCTION public._diag()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'tables', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.relname) FROM (
        SELECT c.relname,
               c.relrowsecurity  AS rls,
               c.relforcerowsecurity AS force,
               (SELECT count(*)::int FROM pg_policies p
                 WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
      ) t
    ),
    'policies', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.tablename, t.policyname) FROM (
        SELECT tablename, policyname, permissive, roles::text AS roles, cmd, qual, with_check
        FROM pg_policies WHERE schemaname = 'public'
      ) t
    ),
    'columns_vehicles', (
      SELECT jsonb_agg(c.column_name ORDER BY c.ordinal_position)
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'vehicles'
    )
  );
$$;

REVOKE ALL ON FUNCTION public._diag() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._diag() TO service_role;

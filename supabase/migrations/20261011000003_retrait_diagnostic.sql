-- Retire la fonction de diagnostic : elle n'a servi qu'à comparer l'état réel
-- de la base aux fichiers du dépôt.
DROP FUNCTION IF EXISTS public._diag();

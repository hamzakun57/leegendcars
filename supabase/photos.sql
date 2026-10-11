-- Les photos de véhicules sont visibles par tous : c'est la vitrine de
-- l'agence. Elles vivaient dans le bucket « uploads », privé, que l'ancien
-- serveur exposait via une route /uploads/. Sur Netlify il n'y a plus de
-- serveur : ces images devenaient inaccessibles au public.
--
-- Solution : un second bucket, public, pour les photos de flotte uniquement.
-- Les pièces jointes de dossier (CIN, permis, contrats signés) restent dans
-- « uploads », privé : elles ne doivent jamais être devinables.
--
-- On ne rend PAS « uploads » public : il contient les documents des clients.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos', 'photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Lecture publique des photos de flotte, y compris via l'API.
DROP POLICY IF EXISTS "photos de flotte lisibles par tous" ON storage.objects;
CREATE POLICY "photos de flotte lisibles par tous" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'photos');

-- Écriture réservée au service de confiance (clé service_role) : le navigateur
-- passe par la fonction « upload », qui valide les octets avant de stocker.
DROP POLICY IF EXISTS "photos de flotte ecrits par le service" ON storage.objects;
CREATE POLICY "photos de flotte ecrits par le service" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos');
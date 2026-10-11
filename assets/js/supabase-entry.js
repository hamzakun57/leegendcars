/**
 * Point d'entrée du client Supabase pour le navigateur.
 *
 * Il n'est jamais chargé tel quel : `npm run build` l'empaquette dans
 * assets/vendor/supabase.bundle.js. Ce fichier se contente de réexporter ce
 * que le reste de l'application utilise.
 */
import { createClient } from "@supabase/supabase-js";

export { createClient };

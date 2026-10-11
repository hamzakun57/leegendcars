/**
 * Contrôle d'accès des fonctions.
 *
 * Ces fonctions utilisent la clé « service_role », qui contourne toutes les
 * règles RLS. C'est précisément pour cela qu'elles ne doivent répondre qu'à un
 * administrateur identifié : chaque appel vérifie le jeton, puis le rôle.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { ErreurHttp } from "./http.ts";

const projet = () => Deno.env.get("SUPABASE_URL") || "";
const service = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

/**
 * Renvoie l'utilisateur authentifié, ou lève une erreur.
 * Le jeton est validé par Supabase lui-même : c'est lui qui vérifie la
 * signature et l'expiration, nous ne faisons que le lire.
 */
export async function exigerAdmin(requete: Request) {
  const entete = requete.headers.get("authorization") || "";
  const jeton = entete.replace(/^Bearer\s+/i, "").trim();
  if (!jeton) throw new ErreurHttp(401, "Session requise.");

  const admin = createClient(projet(), service(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.getUser(jeton);
  if (error || !data?.user) throw new ErreurHttp(401, "Session expirée, reconnectez-vous.");

  const { data: profil, error: e2 } = await admin
    .from("admin_accounts")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (e2) throw e2;
  if (!profil || profil.role !== "admin") {
    throw new ErreurHttp(403, "Ce compte n'a pas accès à l'administration.");
  }

  return { user: data.user, client: admin };
}

/** Client privilégié, à n'utiliser qu'après exigerAdmin(). */
export const clientService = () =>
  createClient(projet(), service(), { auth: { persistSession: false, autoRefreshToken: false } });

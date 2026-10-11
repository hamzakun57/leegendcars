/**
 * Envoi et suppression de fichiers.
 *
 * Tout passe par ici : les photos de véhicules et les pièces jointes des
 * dossiers. C'est volontaire — la validation des octets ne peut pas être
 * exécutée dans le navigateur, donc le stockage n'est accessible qu'à cette
 * fonction, qui exige un administrateur authentifié.
 */
import { corps, ErreurHttp, gerer, json } from "../_shared/http.ts";
import { exigerAdmin } from "../_shared/auth.ts";
import {
  BUCKET, cheminPublic, envoyer, MAX_DOC, MAX_ENVOI, MAX_PHOTO, nomSure, tailleLot, valider,
} from "../_shared/fichiers.ts";

Deno.serve((requete) =>
  gerer(requete, async () => {
    const { client } = await exigerAdmin(requete);
    const data = await corps(requete);

    /* ---------- suppression ---------- */
    if (data.action === "delete") {
      const nom = nomSure(data.stored_name);
      if (!nom) throw new ErreurHttp(400, "Fichier non reconnu.");
      /* Un même nom peut désigner une pièce de dossier (dans reservations/)
         ou une photo de véhicule (à la racine). On tente les deux, comme le
         faisait le serveur : aucun n'est devinable, donc aucun n'est risqué. */
      const bare = nom.split("/").pop() as string;
      const candidats = [...new Set([nom, `uploads/reservations/${bare}`])];

      /* Appel brut plutôt que storage.remove() : Supabase répond 400 si un
         DELETE arrive avec un Content-Type JSON mais sans corps. On contrôle
         donc les en-têtes, et on ne considère la suppression acquise que si
         le stockage a réellement confirmé. */
      const base = (Deno.env.get("SUPABASE_URL") || "") + `/storage/v1/object/${BUCKET}/`;
      const entetes = {
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
      };
      let supprime = false;
      for (const chemin of candidats) {
        const r = await fetch(base + chemin, { method: "DELETE", headers: entetes });
        if (r.ok || r.status === 404) supprime = true;
      }
      return json({ ok: true, supprime });
    }

    const fichiers = Array.isArray(data.files) ? data.files : [];
    const avertissements: string[] = [];

    /* ---------- photos de véhicules ---------- */
    if (Array.isArray(data.photos)) {
      if (tailleLot(data.photos) > MAX_ENVOI) {
        throw new ErreurHttp(413, `Photos trop lourdes (max ${Math.round(MAX_ENVOI / 1048576)} Mo par envoi).`);
      }
      const chemins: string[] = [];
      for (const dataUrl of data.photos.slice(0, 12)) {
        try {
          const f = await envoyer(client, valider(dataUrl, { max: MAX_PHOTO }));
          chemins.push(f.chemin);
        } catch (e) {
          avertissements.push(e.message);
        }
      }
      return json({ ok: true, paths: chemins, warnings: avertissements });
    }

    /* ---------- pièces jointes d'un dossier ---------- */
    if (!data.reservation_id) throw new ErreurHttp(400, "Dossier manquant.");
    const { data: dossier, error } = await client
      .from("reservations")
      .select("id, status")
      .eq("id", Number(data.reservation_id))
      .maybeSingle();
    if (error) throw error;
    if (!dossier) throw new ErreurHttp(404, "Réservation introuvable.");
    if (dossier.status !== "confirmee" && dossier.status !== "livree") {
      throw new ErreurHttp(409, "Confirmez la réservation avant d'ajouter une pièce jointe.");
    }

    if (tailleLot(fichiers) > MAX_ENVOI) {
      throw new ErreurHttp(413, `Envoi trop lourd (max ${Math.round(MAX_ENVOI / 1048576)} Mo par envoi).`);
    }

    const kind = ["piece", "contrat", "facture", "permis"].includes(String(data.kind)) ? String(data.kind) : "piece";
    const nom = String(data.name || "").slice(0, 120) || "document";

    for (const dataUrl of fichiers.slice(0, 6)) {
      try {
        const f = await envoyer(client, valider(dataUrl, { max: MAX_DOC, allowPdf: true, sousDossier: "reservations" }));
        await client.from("attachments").insert({
          reservation_id: Number(data.reservation_id),
          kind,
          stored_name: f.nom,
          original_name: nom,
          mime: f.mime,
          size: f.taille,
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        avertissements.push(e.message);
      }
    }

    const { data: pieces } = await client
      .from("attachments")
      .select("*")
      .eq("reservation_id", Number(data.reservation_id))
      .order("id", { ascending: false });

    if (!pieces || !pieces.length) {
      throw new ErreurHttp(422, avertissements.join(" ; ") || "Aucun fichier reçu.");
    }
    return json({ ok: true, attachments: pieces, warnings: avertissements }, 201);
  })
);

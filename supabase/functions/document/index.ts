/**
 * Contrat et facture d'une réservation.
 *
 * La génération se fait ici, et non dans le navigateur : ces documents ont
 * une valeur contractuelle et doivent rendre à l'identique quel que soit
 * l'appareil qui les ouvre. On renvoie du HTML prêt à imprimer — c'est
 * l'écran qui déclenche l'impression, comme avant.
 *
 * La fonction exige un administrateur : un visiteur ne peut pas déclencher la
 * production d'un contrat, même en connaissant une référence.
 */
import { corps, ErreurHttp, gerer, html } from "../_shared/http.ts";
import { exigerAdmin } from "../_shared/auth.ts";
import { chargerDossier } from "../_shared/dossier.ts";
import { contractHtml } from "../_shared/contract.js";
import { invoiceHtml } from "../_shared/invoice.js";

Deno.serve((requete) =>
  gerer(requete, async () => {
    const { client } = await exigerAdmin(requete);
    const data = await corps(requete);
    const id = Number(data.id);
    if (!id) throw new ErreurHttp(400, "Réservation manquante.");

    const dossier = await chargerDossier(client, id);
    if (!dossier) throw new ErreurHttp(404, "Réservation introuvable.");
    if (dossier.status !== "confirmee" && dossier.status !== "livree") {
      throw new ErreurHttp(409, "Confirmez la réservation avant de générer le document.");
    }

    const facture = data.document === "invoice";
    const maintenant = new Date().toISOString();

    /* Deux champs à tenir à jour : invoice_number est la colonne, invoiceNumber
       et contractNumber sont ce que lisent les gabarits. Ne mettre à jour que
       la colonne produirait une facture au numéro vide. */
    if (!facture && dossier.contract_number !== dossier.ref) {
      await client.from("reservations").update({ contract_number: dossier.ref, updated_at: maintenant }).eq("id", id);
      dossier.contract_number = dossier.ref;
      dossier.contractNumber = dossier.ref;
    } else if (facture && !dossier.invoice_number) {
      const { data: numero, error } = await client.rpc("next_invoice_number");
      if (error) throw error;
      await client.from("reservations").update({ invoice_number: numero, updated_at: maintenant }).eq("id", id);
      dossier.invoice_number = numero;
      dossier.invoiceNumber = numero;
    }

    const { data: vehicule } = dossier.vehicle_slug
      ? await client.from("vehicles").select("*").eq("slug", dossier.vehicle_slug).maybeSingle()
      : { data: null };

    return html(facture ? invoiceHtml(dossier, vehicule) : contractHtml(dossier, vehicule));
  })
);

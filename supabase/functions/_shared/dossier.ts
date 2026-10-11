/**
 * Dossier complet d'une réservation.
 *
 * Reprise exacte des calculs du serveur (server/db.js, getDossier) : totaux,
 * mode de règlement, équipements, signature. Un contrat ou une facture
 * calculés ici doivent afficher les mêmes chiffres que ceux affichés à
 * l'écran.
 */

const PAY_LABEL: Record<string, string> = {
  especes: "Espèce",
  cb: "Carte bancaire",
  virement: "Virement",
  cheque: "Chèque",
};

const parse = (brut: unknown): Record<string, any> => {
  try {
    const v = typeof brut === "string" ? JSON.parse(brut || "{}") : brut;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};

export async function chargerDossier(client: any, id: number) {
  const { data: r, error } = await client.from("reservations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!r) return null;

  const [{ data: payments }, { data: attachments }] = await Promise.all([
    client
      .from("payments")
      .select("*")
      .eq("reservation_id", id)
      .order("paid_at", { ascending: false })
      .order("id", { ascending: false }),
    client.from("attachments").select("*").eq("reservation_id", id).order("id", { ascending: false }),
  ]);

  const opts = parse(r.options);
  const equip = parse(r.equipment);
  const reglements = payments || [];
  const paymentMode = r.payment_mode || (reglements[0] && reglements[0].method) || "especes";

  const extra = r.extra_fee || 0;
  const totalTTC = (r.total || 0) + extra;
  const totalPaid = r.total_paid || 0;

  return {
    ...r,
    options: {
      radio: "radio" in opts ? !!opts.radio : r.baby_seat === false,
      gps: "gps" in opts ? !!opts.gps : false,
      babySeat: "babySeat" in opts ? !!opts.babySeat : !!r.baby_seat,
      climatiseur: "climatiseur" in opts ? !!opts.climatiseur : true,
    },
    equipment: {
      batterie: !!equip.batterie,
      outils: !!equip.outils,
      retroExt: !!equip.retroExt,
      feux: !!equip.feux,
      galerie: !!equip.galerie,
      posteRadio: "posteRadio" in equip ? !!equip.posteRadio : true,
      pressuSecours: !!equip.pressuSecours,
      alarmeCigare: !!equip.alarmeCigare,
    },
    paymentMode,
    paymentModeLabel: PAY_LABEL[paymentMode] || paymentMode,
    insurance: r.insurance || "Normale",
    contractNumber: r.contract_number || r.ref,
    invoiceNumber: r.invoice_number || "",
    signatureStatus: r.signature_status || "",
    signatureName: r.signature_name || "",
    signatureMode: r.signature_mode || "",
    signatureSignedAt: r.signature_signed_at || "",
    signatureRequestedAt: r.signature_requested_at || "",
    signatureData: r.signature_data || "",
    signatureSigned: !!r.signature_data,
    kmDone: r.kms_depart && r.kms_return ? Math.max(0, r.kms_return - r.kms_depart) : 0,
    extraFee: extra,
    totalTTC,
    totalPaid,
    reste: totalTTC - totalPaid,
    payments: reglements,
    attachments: attachments || [],
    dossierOpen: ["confirmee", "livree"].indexOf(r.status) >= 0,
  };
}

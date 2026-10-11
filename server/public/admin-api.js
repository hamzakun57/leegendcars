/**
 * Couche d'accès aux données du back-office.
 *
 * L'écran (admin.js) appelle « api("/api/admin/…") » et attend une forme de
 * données précise. Cet adaptateur répond à ces mêmes appels, mais en parlant
 * directement à Supabase avec la session de l'administrateur — sans serveur
 * intermédiaire. Rien à changer dans l'écran : c'est toute l'idée.
 *
 * Les calculs que faisait le serveur (totaux, mode de règlement, kilométrage,
 * signatures) sont repris ici à l'identique, pour qu'un dossier affiche
 * exactement les mêmes chiffres qu'avant.
 */
(function () {
  "use strict";

  const CFG = window.LCAdminConfig || (window.DATA && window.DATA.CFG) || {};
  const MODE = CFG.source === "supabase" ? "supabase" : "api";

  /* ------------------------------------------------------------------ */
  /* Client                                                             */
  /* ------------------------------------------------------------------ */
  let client = null;

  function getClient() {
    if (client) return client;
    if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) {
      throw new Error("Configuration Supabase manquante.");
    }
    if (!window.SupabaseJS || !window.SupabaseJS.createClient) {
      throw new Error("Client Supabase absent : lancez « npm run build ».");
    }
    client = window.SupabaseJS.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "lc_admin_session" },
      db: { schema: "public" },
    });
    return client;
  }

  /* Un échec réseau n'est pas un 401 : on ne doit pas rediriger vers la
     connexion quand Supabase est simplement injoignable. */
  const surErreur = (e) => {
    throw new Error((e && e.message) || "Erreur Supabase");
  };

  /* ------------------------------------------------------------------ */
  /* Recalculs — mêmes règles que server/db.js                        */
  /* ------------------------------------------------------------------ */
  const json = (brut, defaut) => {
    try {
      const v = typeof brut === "string" ? JSON.parse(brut || "") : brut;
      return v && typeof v === "object" ? v : defaut;
    } catch (e) {
      return defaut;
    }
  };

  const PAY_LABEL = { especes: "Espèce", cb: "Carte bancaire", virement: "Virement", cheque: "Chèque" };
  const STATUTS_FERMES = ["confirmee", "livree"];

  function computeTotals(r) {
    const extra = r.extra_fee || 0;
    const ttc = (r.total || 0) + extra;
    const paid = r.total_paid || 0;
    return { extraFee: extra, totalTTC: ttc, totalPaid: paid, reste: ttc - paid };
  }

  /* Le dossier enrichi. L'ordre des clés reprend celui du serveur pour que
     les captures d'écran restent comparables. */
  function dossier(r, paiements, pieces) {
    if (!r) return null;
    const payments = paiements || [];
    const attachments = pieces || [];
    const opts = json(r.options, {});
    const equip = json(r.equipment, {});
    const paymentMode = r.payment_mode || (payments[0] && payments[0].method) || "especes";

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
      ...computeTotals(r),
      payments,
      attachments,
      dossierOpen: STATUTS_FERMES.indexOf(r.status) >= 0,
    };
  }

  /* Charge le dossier complet d'une réservation. */
  async function chargerDossier(id) {
    const c = getClient();
    const { data: r, error } = await c.from("reservations").select("*").eq("id", id).maybeSingle();
    if (error) return surErreur(error);
    if (!r) return null;
    const [{ data: payments }, { data: pieces }] = await Promise.all([
      c.from("payments").select("*").eq("reservation_id", id).order("paid_at", { ascending: false }).order("id", { ascending: false }),
      c.from("attachments").select("*").eq("reservation_id", id).order("id", { ascending: false }),
    ]);
    return dossier(r, payments || [], pieces || []);
  }

  /* ------------------------------------------------------------------ */
  /* Routage                                                            */
  /* ------------------------------------------------------------------ */
  async function router(methode, chemin, corps, requete) {
    const c = getClient();
    const url = new URL(chemin, "https://x");
    const q = url.searchParams;
    /* Le chemin doit être coupé AVANT la requête : sinon le dernier segment
       vaut « reservations?limit=50 » et plus aucune route ne correspond. */
    const seg = url.pathname.split("/").filter(Boolean); // ["api","admin",...]

    /* ---------------- session ---------------- */
    if (seg[2] === "login" && methode === "POST") {
      const { data, error } = await c.auth.signInWithPassword({
        email: corps.email || corps.username,
        password: corps.password,
      });
      if (error || !data?.user) throw new Error("Identifiants incorrects");
      const admin = await estAdmin(data.user.id);
      if (!admin) {
        await c.auth.signOut();
        throw new Error("Ce compte n'a pas accès à l'administration.");
      }
      return { ok: true };
    }
    if (seg[2] === "logout") {
      await c.auth.signOut();
      return { ok: true };
    }
    if (seg[2] === "me") {
      const { data } = await c.auth.getSession();
      const user = data?.session?.user || null;
      /* Même forme que le serveur : l'écran lit « username ». */
      return { user: user ? { username: user.email } : null, needsSetup: false };
    }
    if (seg[2] === "password" && methode === "POST") {
      const { data } = await c.auth.getSession();
      if (!data?.user) throw new Error("Non autorisé");
      /* Supabase demande le mot de passe actuel : c'est lui qui vérifie. */
      const { error } = await c.auth.updateUser({ password: corps.next });
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    /* ---------------- tableau de bord ---------------- */
    if (seg[2] === "stats" && seg[3] === "vehicles") {
      const { data, error } = await c.rpc("vehicle_stats", {
        p_from: q.get("from") || null,
        p_to: q.get("to") || null,
      });
      if (error) return surErreur(error);

      const global = data.reduce(
        (a, v) => ({
          rentals: a.rentals + v.rentals,
          jours: a.jours + v.jours,
          ca: a.ca + v.ca,
          encaisse: a.encaisse + v.encaisse,
          annulees: a.annulees + v.annulees,
          nouvelles: a.nouvelles + v.nouvelles,
        }),
        { rentals: 0, jours: 0, ca: 0, encaisse: 0, annulees: 0, nouvelles: 0 }
      );
      global.reste = global.ca - global.encaisse;
      global.prixMoyen = global.jours ? Math.round(global.ca / global.jours) : 0;

      const vehicles = data.map((v) => {
        const base = v.jours + v.jours_bloques;
        return {
          slug: v.slug, name: v.name, active: v.active,
          rentals: v.rentals, jours: v.jours, ca: v.ca, encaisse: v.encaisse,
          reste: v.ca - v.encaisse,
          prixMoyen: v.jours ? Math.round(v.ca / v.jours) : 0,
          part: global.ca ? Math.round((v.ca / global.ca) * 1000) / 10 : 0,
          annulees: v.annulees, nouvelles: v.nouvelles,
          joursBloques: v.jours_bloques,
          occupation: base ? Math.round((v.jours / base) * 100) : 0,
        };
      });
      return { from: q.get("from") || "0000-01-01", to: q.get("to") || "9999-12-31", global, vehicles };
    }

    if (seg[2] === "stats") {
      const limit = Number(q.get("limit")) || 1;
      const parStatut = {};
      for (const s of ["nouvelle", "confirmee", "annulee", "livree"]) {
        const { count } = await c
          .from("reservations").select("id", { count: "exact", head: true }).eq("status", s).limit(limit);
        parStatut[s] = count || 0;
      }
      const { count: total } = await c.from("reservations").select("id", { count: "exact", head: true }).limit(1);
      const { count: vehicules } = await c.from("vehicles").select("slug", { count: "exact", head: true }).limit(1);
      const { count: actifs } = await c.from("vehicles").select("slug", { count: "exact", head: true }).eq("active", 1).limit(1);
      return {
        total: total || 0,
        nouvelles: parStatut.nouvelle,
        confirmees: parStatut.confirmee,
        annulees: parStatut.annulee,
        livrees: parStatut.livree,
        vehicles: vehicules || 0,
        activeVehicles: actifs || 0,
      };
    }

    /* ---------------- réservations ---------------- */
    if (seg[2] === "reservations" && seg.length === 3 && methode === "GET") {
      let requeteL = c.from("reservations").select("*").order("created_at", { ascending: false });
      if (q.get("status")) requeteL = requeteL.eq("status", q.get("status"));
      if (q.get("q")) {
        const motif = `%${q.get("q")}%`;
        requeteL = requeteL.or(
          `first_name.ilike.${motif},last_name.ilike.${motif},phone.ilike.${motif},ref.ilike.${motif},vehicle_name.ilike.${motif}`
        );
      }
      const limit = Number(q.get("limit")) || 200;
      const offset = Number(q.get("offset")) || 0;
      const { data, error } = await requeteL.range(offset, offset + limit - 1);
      if (error) return surErreur(error);
      return { reservations: (data || []).map((r) => ({ ...r, ...computeTotals(r), dossierOpen: STATUTS_FERMES.indexOf(r.status) >= 0 })) };
    }

    if (seg[2] === "reservations" && seg.length === 3 && methode === "POST") {
      const clientId = Number(corps.client_id) || 0;
      let fiche = null;
      if (clientId) {
        const { data } = await c.from("clients").select("*").eq("id", clientId).maybeSingle();
        if (!data) throw new Error("Fiche client introuvable");
        fiche = data;
      }
      const v = corps.vehicle_slug ? await lireVehicule(corps.vehicle_slug) : null;
      if (corps.vehicle_slug && !v) throw new Error("Complétez : Véhicule.");

      const first = (corps.first_name || (fiche && fiche.first_name) || "").trim();
      const last = (corps.last_name || (fiche && fiche.last_name) || "").trim();
      const licence = (corps.licence_number || (fiche && fiche.licence_number) || "").trim();
      const licenceDate = corps.licence_date || (fiche && fiche.licence_date) || "";
      const pickup = (corps.pickup || "").trim();
      const ret = (corps.ret || "").trim();
      const pickupDate = corps.pickup_date || "";
      const returnDate = corps.return_date || "";

      const manque = [];
      if (!first) manque.push("Prénom du client");
      if (!last) manque.push("Nom du client");
      if (!licence) manque.push("Numéro de permis");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(licenceDate)) manque.push("Date du permis");
      if (!pickup) manque.push("Lieu de prise en charge");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) manque.push("Date de départ");
      if (!ret) manque.push("Lieu de retour");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) manque.push("Date de retour");
      if (manque.length) throw new Error("Complétez : " + manque.join(", ") + ".");

      const tarif = calculerTarif(v, pickupDate, returnDate, Number(corps.baby_seat) || 0);
      const ref = "LC-" + Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[^A-Z0-9]/g, "X").slice(0, 6);
      const maintenant = new Date().toISOString();

      const ligne = {
        ref, first_name: first, last_name: last,
        country_code: (corps.country_code || "").trim(),
        phone: (corps.phone || (fiche && fiche.phone) || "").trim(),
        licence_number: licence, licence_date: licenceDate,
        passport: (corps.passport || (fiche && fiche.passport) || "").trim(),
        vehicle_slug: v ? v.slug : "", vehicle_name: v ? v.name : "",
        pickup, ret, pickup_date: pickupDate, pickup_time: corps.pickup_time || "",
        return_date: returnDate, return_time: corps.return_time || "",
        baby_seat: Number(corps.baby_seat) || 0,
        one_way: pickup !== ret ? 1 : 0,
        days: tarif.days, daily: tarif.daily, seat_total: tarif.seatTotal, total: tarif.total,
        notes: (corps.notes || "").slice(0, 1000),
        summary: [
          "Réservation saisie par l'agent", `Client : ${first} ${last}`,
          `Véhicule : ${v ? v.name : "—"}`,
          `Prise en charge : ${pickup} le ${pickupDate}`, `Retour : ${ret} le ${returnDate}`,
          `Estimation : ${tarif.days} jour(s) × ${tarif.daily} MAD = ${tarif.total} MAD`,
        ].join("\n"),
        client_id: clientId,
        created_by: (corps.created_by || "").trim() || "",
        status: STATUTS_FERMES.indexOf(corps.status) >= 0 ? corps.status : "confirmee",
        confirmed_at: new Date().toISOString(),
        d1_cin: (fiche && fiche.cin) || (corps.cin || "").trim(),
        d1_nationality: (fiche && fiche.nationality) || (corps.nationality || "").trim(),
        d1_address: (fiche && fiche.address) || (corps.address || "").trim(),
        d1_birthdate: (fiche && fiche.birthdate) || (corps.birthdate || "").trim(),
        created_at: maintenant, updated_at: maintenant,
      };

      const { data, error } = await c.from("reservations").insert(ligne).select().maybeSingle();
      if (error) return surErreur(error);
      const d = await chargerDossier(data.id);
      return { ok: true, reservation: d, days: tarif.days, daily: tarif.daily, seatTotal: tarif.seatTotal, total: tarif.total };
    }

    if (seg[2] === "reservations" && seg.length === 3 && methode === "DELETE") {
      const { error } = await c.from("reservations").delete().eq("id", seg[3]);
      if (error) return surErreur(error);
      return { ok: true };
    }

    if (seg[2] === "reservations" && seg.length === 4) {
      const id = Number(seg[3]);
      if (methode === "GET") {
        const d = await chargerDossier(id);
        if (!d) throw new Error("Réservation introuvable");
        return { reservation: d };
      }
      if (methode === "PATCH") return modifierDossier(id, corps);
      if (methode === "DELETE") {
        const { error } = await c.from("reservations").delete().eq("id", id);
        if (error) return surErreur(error);
        return { ok: true };
      }
    }

    /* ---------------- règlements ---------------- */
    if (seg[2] === "payments" && methode === "DELETE") {
      const { data: ligne, error } = await c.from("payments").select("reservation_id").eq("id", seg[3]).maybeSingle();
      if (error) return surErreur(error);
      if (!ligne) throw new Error("Règlement introuvable");
      const { error: e2 } = await c.from("payments").delete().eq("id", seg[3]);
      if (e2) return surErreur(e2);
      await c.rpc("recalc_paid", { p_reservation: ligne.reservation_id });
      return { ok: true };
    }

    /* ---------------- véhicules ---------------- */
    if (seg[2] === "vehicles" && seg.length === 3) {
      if (methode === "GET") {
        const { data, error } = await c.from("vehicles").select("*").order("sort_order").order("name");
        if (error) return surErreur(error);
        return { vehicles: (data || []).map(enrichirVehicule) };
      }
      if (methode === "POST") {
        const slug = normaliser(corps.slug || corps.name);
        if (!slug) throw new Error("Nom requis");
        const deja = await lireVehicule(slug);
        if (deja) throw new Error("Ce slug existe déjà");
        const v = await ecrireVehicule(corps, slug, null);
        if (!v.ok) throw new Error(v.error);
        return { ok: true, vehicle: v.vehicle, warnings: v.warnings };
      }
    }

    if (seg[2] === "vehicles" && seg.length === 4) {
      const slug = decodeURIComponent(seg[3]);
      if (methode === "PUT") {
        const actuel = await lireVehicule(slug);
        if (!actuel) throw new Error("Véhicule introuvable");
        const v = await ecrireVehicule(corps, slug, corps.slug && corps.slug !== slug ? normaliser(corps.slug) : null);
        if (!v.ok) throw new Error(v.error);
        return { ok: true, vehicle: v.vehicle, warnings: v.warnings };
      }
      if (methode === "DELETE") {
        const { count } = await c
          .from("reservations").select("id", { count: "exact", head: true }).eq("vehicle_slug", slug).limit(1);
        if (count > 0) {
          throw new Error(
            `Impossible de supprimer : ${count} réservation(s) liée(s). Désactivez le véhicule à la place.`
          );
        }
        const { error } = await c.from("vehicles").delete().eq("slug", slug);
        if (error) return surErreur(error);
        return { ok: true };
      }
    }

    /* ---------------- clients ---------------- */
    if (seg[2] === "clients" && seg.length === 3) {
      if (methode === "GET") {
        let l = c.from("clients").select("*").order("last_name").order("first_name", { ascending: false });
        if (q.get("type")) l = l.eq("client_type", q.get("type"));
        if (q.get("q")) {
          const motif = `%${q.get("q")}%`;
          l = l.or(
            `last_name.ilike.${motif},first_name.ilike.${motif},phone.ilike.${motif},email.ilike.${motif},` +
            `cin.ilike.${motif},passport.ilike.${motif},licence_number.ilike.${motif},entry_number.ilike.${motif}`
          );
        }
        const { data, error } = await l;
        if (error) return surErreur(error);
        const TYPES = ["particulier", "professionnel", "entreprise"];
        return {
          clients: (data || []).map((r) => ({
            ...r,
            client_type: TYPES.indexOf(r.client_type) >= 0 ? r.client_type : "particulier",
            full_name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.last_name || "",
          })),
        };
      }
      if (methode === "POST") {
        if (!String(corps.last_name || "").trim()) throw new Error("Le nom est obligatoire");
        const maintenant = new Date().toISOString();
        const { data, error } = await c
          .from("clients").insert({ ...nettoyerClient(corps), created_at: maintenant, updated_at: maintenant })
          .select().maybeSingle();
        if (error) return surErreur(error);
        return { ok: true, client: data };
      }
    }

    if (seg[2] === "clients" && seg.length === 4) {
      const id = Number(seg[3]);
      if (methode === "PATCH") {
        if ("last_name" in corps && !String(corps.last_name || "").trim()) {
          throw new Error("Le nom est obligatoire");
        }
        const { data, error } = await c
          .from("clients").update({ ...nettoyerClient(corps), updated_at: new Date().toISOString() })
          .eq("id", id).select().maybeSingle();
        if (error) return surErreur(error);
        if (!data) throw new Error("Client introuvable");
        return { ok: true, client: data };
      }
      if (methode === "DELETE") {
        const { data, error } = await c.from("clients").delete().eq("id", id).select().maybeSingle();
        if (error) return surErreur(error);
        if (!data) throw new Error("Client introuvable");
        return { ok: true };
      }
    }

    /* ---------------- indisponibilités ---------------- */
    if (seg[2] === "blocked") {
      if (methode === "GET" && seg.length === 3) {
        let l = c.from("blocked_dates").select("*").order("start_date");
        if (q.get("vehicle")) l = l.eq("vehicle_slug", q.get("vehicle"));
        const { data, error } = await l;
        if (error) return surErreur(error);
        return { blocked: data || [] };
      }
      if (methode === "POST" && seg.length === 3) {
        const v = await lireVehicule(corps.vehicle_slug);
        if (!v) throw new Error("Véhicule inconnu");
        if (!estDate(corps.start_date) || !estDate(corps.end_date)) {
          throw new Error("Dates invalides (AAAA-MM-JJ)");
        }
        if (corps.end_date < corps.start_date) throw new Error("La fin doit être après le début");
        const { data, error } = await c
          .from("blocked_dates")
          .insert({
            vehicle_slug: corps.vehicle_slug,
            start_date: corps.start_date,
            end_date: corps.end_date,
            reason: (corps.reason || "").slice(0, 120),
            created_at: new Date().toISOString(),
          })
          .select("id").maybeSingle();
        if (error) return surErreur(error);
        return { ok: true, id: data.id };
      }
      if (methode === "DELETE" && seg.length === 4) {
        const { error } = await c.from("blocked_dates").delete().eq("id", seg[3]);
        if (error) return surErreur(error);
        return { ok: true };
      }
    }

    /* ---------------- maintenance ---------------- */
    if (seg[2] === "maintenance" && seg.length === 3 && methode === "GET") {
      let l = c.from("maintenance").select("*, vehicles(name)").order("due_date", { ascending: true, nullsFirst: false });
      if (q.get("vehicle")) l = l.eq("vehicle_slug", q.get("vehicle"));
      if (q.get("kind")) l = l.eq("kind", q.get("kind"));
      const { data, error } = await l;
      if (error) return surErreur(error);

      const TYPES = [
        { id: "vignette", label: "Vignette", jours: 365 },
        { id: "assurance", label: "Assurance", jours: 365 },
        { id: "controle", label: "Contrôle technique", jours: 365 },
        { id: "vidange", label: "Vidange", jours: 180 },
        { id: "revision", label: "Révision", jours: 365 },
        { id: "filtres", label: "Filtres", jours: 365 },
        { id: "freins", label: "Freins", jours: 365 },
        { id: "pneus", label: "Pneus", jours: 365 },
        { id: "autre", label: "Autre", jours: 0 },
      ];

      const items = (data || []).map((r) => {
        const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles;
        const aujourdhui = new Date().toISOString().slice(0, 10);
        const jours = r.due_date
          ? Math.round((new Date(r.due_date + "T00:00:00") - new Date(aujourdhui + "T00:00:00")) / 86400000)
          : null;
        const preset = TYPES.find((k) => k.id === r.kind);
        return {
          ...r,
          vehicle_name: (v && v.name) || r.vehicle_slug,
          kind_label: (preset && preset.label) || r.label || r.kind,
          jours,
          statut: jours === null ? "inconnu" : jours < 0 ? "retard" : jours <= 30 ? "bientot" : "ok",
        };
      });

      return {
        items, kinds: TYPES,
        compte: {
          retard: items.filter((m) => m.statut === "retard").length,
          bientot: items.filter((m) => m.statut === "bientot").length,
          ok: items.filter((m) => m.statut === "ok").length,
        },
      };
    }

    if (seg[2] === "maintenance" && seg.length === 3 && methode === "POST") {
      const v = await lireVehicule(corps.vehicle_slug);
      if (!v) throw new Error("Véhicule inconnu");
      if (!estDate(corps.due_date)) throw new Error("Date d'échéance invalide (AAAA-MM-JJ)");
      const kind = normaliser(corps.kind) || "autre";
      const preset = [
        { id: "vignette", jours: 365 }, { id: "assurance", jours: 365 }, { id: "controle", jours: 365 },
        { id: "vidange", jours: 180 }, { id: "revision", jours: 365 }, { id: "filtres", jours: 365 },
        { id: "freins", jours: 365 }, { id: "pneus", jours: 365 }, { id: "autre", jours: 0 },
      ].find((k) => k.id === kind);
      const maintenant = new Date().toISOString();
      const { data, error } = await c
        .from("maintenance")
        .insert({
          vehicle_slug: corps.vehicle_slug, kind,
          label: (corps.label || "").slice(0, 80),
          due_date: corps.due_date,
          period_days: corps.period_days === undefined ? (preset ? preset.jours : 0) : Number(corps.period_days) || 0,
          period_km: Number(corps.period_km) || 0,
          notes: (corps.notes || "").slice(0, 500),
          created_at: maintenant, updated_at: maintenant,
        })
        .select().maybeSingle();
      if (error) return surErreur(error);
      return { ok: true, item: data };
    }

    if (seg[2] === "maintenance" && seg.length === 5 && seg[4] === "done" && methode === "POST") {
      const { error } = await c.rpc("mark_maintenance_done", {
        p_id: Number(seg[3]),
        p_cost: Number(corps.cost) || 0,
        p_km: Number(corps.km) || 0,
        p_note: corps.note === undefined ? null : String(corps.note).slice(0, 500),
      });
      if (error) return surErreur(error);
      return { ok: true };
    }

    if (seg[2] === "maintenance" && seg.length === 4) {
      const id = Number(seg[3]);
      if (methode === "PATCH") {
        if (corps.due_date !== undefined && !estDate(corps.due_date)) {
          throw new Error("Date d'échéance invalide (AAAA-MM-JJ)");
        }
        const modifs = {};
        if (corps.kind !== undefined) modifs.kind = normaliser(corps.kind) || "autre";
        if (corps.label !== undefined) modifs.label = String(corps.label).slice(0, 80);
        if (corps.due_date !== undefined) modifs.due_date = corps.due_date;
        if (corps.period_days !== undefined) modifs.period_days = Number(corps.period_days) || 0;
        if (corps.period_km !== undefined) modifs.period_km = Number(corps.period_km) || 0;
        if (corps.notes !== undefined) modifs.notes = String(corps.notes).slice(0, 500);
        modifs.updated_at = new Date().toISOString();
        const { data, error } = await c.from("maintenance").update(modifs).eq("id", id).select().maybeSingle();
        if (error) return surErreur(error);
        if (!data) throw new Error("Entrée introuvable");
        return { ok: true, item: data };
      }
      if (methode === "DELETE") {
        const { error } = await c.from("maintenance").delete().eq("id", id);
        if (error) return surErreur(error);
        return { ok: true };
      }
    }

    /* ---------------- pièces jointes & documents ---------------- */
    if (seg[3] === "attachments" && methode === "DELETE") {
      const { data, error } = await c.from("attachments").delete().eq("id", seg[4]).select("stored_name").maybeSingle();
      if (error) return surErreur(error);
      if (!data) throw new Error("Pièce jointe introuvable");
      await supprimerFichier(data.stored_name);
      return { ok: true };
    }

    if (seg[2] === "reservations" && seg[4] === "payments" && methode === "POST") {
      return ajouterPaiement(Number(seg[3]), corps);
    }

    if (seg[2] === "reservations" && seg[4] === "signature" && methode === "POST") {
      return enregistrerSignature(Number(seg[3]), corps, "onsite");
    }
    if (seg[2] === "reservations" && seg[4] === "signature" && methode === "DELETE") {
      const d = await chargerDossier(Number(seg[3]));
      if (!d) throw new Error("Réservation introuvable");
      await c.from("reservations").update({
        signature_data: "", signature_name: "", signature_mode: "",
        signature_signed_at: "", signature_status: "", signature_token: "",
        updated_at: new Date().toISOString(),
      }).eq("id", seg[3]);
      return { ok: true };
    }
    if (seg[2] === "reservations" && seg[4] === "signature" && seg[5] === "link" && methode === "POST") {
      const d = await chargerDossier(Number(seg[3]));
      if (!d) throw new Error("Réservation introuvable");
      const octets = new Uint8Array(24);
      crypto.getRandomValues(octets);
      const token = btoa(String.fromCharCode(...octets)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const maintenant = new Date().toISOString();
      await c.from("reservations").update({
        signature_token: token, signature_status: "pending",
        signature_requested_at: maintenant, updated_at: maintenant,
        contract_number: d.contract_number || d.ref,
      }).eq("id", seg[3]);
      /* Le lien est celui de la fonction de signature : le client n'a besoin
         ni d'un compte, ni d'un serveur. */
      const url = `${CFG.supabaseUrl}/functions/v1/signature/${token}`;
      return { token, url, status: "pending" };
    }

    if (seg[2] === "reservations" && (seg[4] === "contract" || seg[4] === "invoice")) {
      const { data, error } = await c.functions.invoke("document", {
        body: { id: Number(seg[3]), document: seg[4] === "invoice" ? "invoice" : "contract" },
      });
      if (error) throw new Error("Le document n'a pas pu être généré : " + error.message);
      return { __html: data, __type: "html" };
    }

    if (seg[2] === "reservations" && seg[4] === "attachments" && methode === "POST") {
      const { data, error } = await c.functions.invoke("upload", {
        body: { reservation_id: Number(seg[3]), kind: corps.kind, name: corps.name, files: corps.files },
      });
      if (error) throw new Error(error.message || "Envoi refusé");
      return data;
    }

    throw new Error("Route inconnue : " + chemin);
  }

  /* ------------------------------------------------------------------ */
  /* Utilitaires                                                        */
  /* ------------------------------------------------------------------ */
  function estDate(v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ""))) return false;
    const d = new Date(v + "T00:00:00");
    return !isNaN(d) && d.toISOString().slice(0, 10) === v;
  }

  const normaliser = (s) =>
    String(s ?? "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

  const liste = (brut) => {
    try {
      const v = typeof brut === "string" ? JSON.parse(brut || "[]") : brut;
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  };

  const enrichirVehicule = (v) => {
    const galerie = liste(v.gallery)
      .map((p) => (typeof p === "string" ? p : (p && (p.publicPath || p.storedName)) || ""))
      .filter(Boolean);
    return {
      ...v,
      active: !!v.active,
      en_service: v.en_service === undefined ? true : !!v.en_service,
      description: liste(v.description),
      ideal_for: liste(v.ideal_for),
      tiers: liste(v.tiers),
      gallery: galerie,
    };
  };

  async function lireVehicule(slug) {
    const { data, error } = await getClient().from("vehicles").select("*").eq("slug", slug).maybeSingle();
    if (error) return surErreur(error);
    return data;
  }

  const calculerTarif = (v, d1, d2, siege) => {
    let days = 0, daily = 0, seatTotal = 0, total = 0;
    if (v) {
      const ms = new Date(d2 + "T00:00:00") - new Date(d1 + "T00:00:00");
      days = Math.max(1, Math.round(ms / 86400000));
      daily = v.price_from || 0;
      for (const t of liste(v.tiers)) if (days >= t.days) daily = t.price;
      seatTotal = (Number(siège) || 0) * days;
      total = daily * days + seatTotal;
    }
    return { days, daily, seatTotal, total };
  };

  const CHAMPS_CLIENT = [
    "client_type", "last_name", "first_name", "birthdate", "phone", "email", "address",
    "licence_number", "licence_date", "cin", "cin_date", "passport", "passport_date",
    "entry_number", "entry_date", "nationality", "notes",
  ];

  function nettoyerClient(entree) {
    const out = {};
    for (const cle of CHAMPS_CLIENT) {
      if (!(cle in entree)) continue;
      let v = entree[cle];
      if (v === null || v === undefined) v = "";
      v = String(v).trim();
      if (cle.endsWith("_date") || cle === "birthdate") v = estDate(v) ? v : "";
      out[cle] = v.slice(0, 200);
    }
    if (out.client_type && ["particulier", "professionnel", "entreprise"].indexOf(out.client_type) < 0) {
      out.client_type = "particulier";
    }
    return out;
  }

  /* Les mêmes champs que DOSSIER_FIELDS côté serveur : c'est cette liste que
     l'écran envoie, il faut donc la reprendre à l'identique. */
  const CHAMPS_DOSSIER = [
    "created_by", "client_id", "commercial", "agency", "kms_depart", "kms_return", "distance_km",
    "delivery_type", "extra_fee_label", "extra_fee", "internal_notes",
    "driver2_first_name", "driver2_last_name", "driver2_phone", "driver2_licence", "driver2_licence_date",
    "d1_birthdate", "d1_nationality", "d1_address", "d1_cin", "d1_cin_date", "d1_passport_date",
    "driver2_birthdate", "driver2_nationality", "driver2_address", "driver2_cin", "driver2_cin_date",
    "driver2_passport_date", "contract_number", "invoice_number", "insurance", "payment_mode",
    "observations", "fuel_depart", "fuel_return", "notes", "status", "pickup", "ret",
    "pickup_date", "pickup_time", "return_date", "return_time",
  ];
  const CHAMPS_NUM = ["kms_depart", "kms_return", "distance_km", "extra_fee", "total_paid", "client_id"];
  const CHAMPS_JSON = ["options", "equipment"];

  async function modifierDossier(id, corps) {
    const c = getClient();
    const { data: avant, error: e0 } = await c.from("reservations").select("*").eq("id", id).maybeSingle();
    if (e0) return surErreur(e0);
    if (!avant) throw new Error("Réservation introuvable");

    const modifs = {};
    for (const cle of CHAMPS_DOSSIER) {
      if (!(cle in corps)) continue;
      if (cle.endsWith("_date") || cle === "birthdate") {
        if (!estDate(corps[cle])) continue; // une date invalide est ignorée, jamais écrite
        modifs[cle] = corps[cle];
      } else if (CHAMPS_NUM.indexOf(cle) >= 0) {
        modifs[cle] = Number(corps[cle]) || 0;
      } else if (CHAMPS_JSON.indexOf(cle) >= 0) {
        modifs[cle] = JSON.stringify(corps[cle] && typeof corps[cle] === "object" ? corps[cle] : {});
      } else {
        modifs[cle] = String(corps[cle] ?? "").slice(0, 1000);
      }
    }

    /* Statut et horodatage de confirmation restent cohérents entre eux. */
    if (corps.status && corps.status !== avant.status) {
      if (STATUTS_FERMES.indexOf(corps.status) >= 0 && !avant.confirmed_at) {
        modifs.confirmed_at = new Date().toISOString();
      }
      if (corps.status === "annulee") {
        await c.from("payments").delete().eq("reservation_id", id);
        modifs.total_paid = 0;
      }
    }

    if (!Object.keys(modifs).length) return { ok: true, reservation: await chargerDossier(id) };

    modifs.updated_at = new Date().toISOString();
    const { error } = await c.from("reservations").update(modifs).eq("id", id);
    if (error) return surErreur(error);
    return { ok: true, reservation: await chargerDossier(id) };
  }

  async function ajouterPaiement(reservationId, corps) {
    const c = getClient();
    const d = await chargerDossier(reservationId);
    if (!d) throw new Error("Réservation introuvable");
    if (!d.dossierOpen) throw new Error("Confirmez la réservation avant d'enregistrer un règlement.");
    const montant = Number(corps.amount) || 0;
    if (montant <= 0) throw new Error("Montant invalide");

    const { data, error } = await c
      .from("payments")
      .insert({
        reservation_id: reservationId,
        amount: montant,
        method: ["especes", "cb", "virement", "cheque"].indexOf(corps.method) >= 0 ? corps.method : "especes",
        paid_at: estDate(corps.paid_at) ? corps.paid_at : new Date().toISOString().slice(0, 10),
        note: String(corps.note || "").slice(0, 200),
        created_at: new Date().toISOString(),
      })
      .select();
    if (error) return surErreur(error);

    await c.rpc("recalc_paid", { p_reservation: reservationId });
    const { data: paiements } = await c
      .from("payments").select("*").eq("reservation_id", reservationId)
      .order("paid_at", { ascending: false }).order("id", { ascending: false });
    return { ok: true, payments: paiements || [], reservation: await chargerDossier(reservationId) };
  }

  async function enregistrerSignature(reservationId, corps, mode) {
    const c = getClient();
    const d = await chargerDossier(reservationId);
    if (!d) throw new Error("Réservation introuvable");
    if (!d.dossierOpen) throw new Error("Confirmez la réservation avant d'enregistrer une signature.");
    const nom = String(corps.name || "").trim().slice(0, 120);
    if (!nom) throw new Error("Indiquez le nom du signataire.");
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(corps.signature || "") || String(corps.signature).length > 2000000) {
      throw new Error("Signature invalide.");
    }
    const maintenant = new Date().toISOString();
    await c.from("reservations").update({
      signature_data: corps.signature, signature_name: nom, signature_mode: mode,
      signature_signed_at: maintenant, signature_status: "signed",
      signature_token: mode === "onsite" ? "" : d.signature_token,
      updated_at: maintenant,
    }).eq("id", reservationId);
    return { ok: true, signatureSignedAt: maintenant, signatureName: nom };
  }

  /* Le fichier stocké passe par l'Edge Function « upload » : c'est elle qui
     valide la signature binaire du fichier avant de l'accepter. */
  async function supprimerFichier(storedName) {
    try {
      const { error } = await getClient().functions.invoke("upload", {
        body: { action: "delete", stored_name: storedName },
      });
      if (error) throw error;
    } catch (e) {
      /* La ligne est déjà supprimée : un fichier orphelin est moins grave
         qu'un dossier bloqué pour l'agent. */
      console.warn("Suppression du fichier impossible :", e.message);
    }
  }

  /* Le rôle admin est la seule information réellement sensible : le savoir ne
     coûte rien, le divulguer n'accorde aucun droit supplémentaire (les règles
     RLS décident seules). */
  async function estAdmin(uid) {
    if (!uid) return false;
    const { data, error } = await getClient().from("admin_accounts").select("role").eq("id", uid).maybeSingle();
    if (error) return false;
    return !!data && data.role === "admin";
  }

  /* ------------------------------------------------------------------ */
  /* Véhicules : champs autorisés et types, identiques au serveur          */
  /* ------------------------------------------------------------------ */
  const CHAMPS_VEHICULE = [
    "slug", "name", "modele", "tagline", "matricule_ww", "matricule", "couleur",
    "kilometrage", "transmission", "energie", "fuel", "doors", "seats",
    "puissance_fiscale", "climatisation", "categorie", "date_circulation",
    "price_from", "deposit", "approx", "badge", "accent",
    "description", "ideal_for", "gallery", "tiers", "active", "en_service", "sort_order",
  ];
  const VEH_INT = ["doors", "seats", "price_from", "deposit", "approx", "kilometrage", "puissance_fiscale", "sort_order"];
  const VEH_BOOL = ["active", "en_service"];
  const VEH_JSON = ["description", "ideal_for", "gallery", "tiers"];

  /* Un chemin de photo n'est accepté que s'il est relatif et sans « .. » :
     ces valeurs finissent dans un attribut src. */
  const CHEMIN_SUR = /^(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._\-/]+$/;
  const cheminSur = (p) =>
    typeof p === "string" && p.length < 300 && !p.includes("://") && !p.startsWith("/") && CHEMIN_SUR.test(p);

  function nettoyerVehicule(entree) {
    const out = {};
    for (const cle of CHAMPS_VEHICULE) {
      if (entree[cle] === undefined) continue;
      let v = entree[cle];
      if (VEH_BOOL.indexOf(cle) >= 0) v = v === true || v === 1 || v === "1" || v === "true" ? 1 : 0;
      else if (VEH_INT.indexOf(cle) >= 0) v = parseInt(v, 10) || 0;
      else if (VEH_JSON.indexOf(cle) >= 0) v = JSON.stringify(Array.isArray(v) ? v : []);
      else out[cle] = String(v ?? "").trim().slice(0, cle === "accent" || cle === "description" ? 2000 : 300);
      if (VEH_BOOL.indexOf(cle) >= 0 || VEH_INT.indexOf(cle) >= 0 || VEH_JSON.indexOf(cle) >= 0) out[cle] = v;
    }
    return out;
  }

  /* Supprime une photo du stockage : elle n'appartient plus à la galerie. */
  async function effacerPhoto(chemin) {
    try {
      await getClient().functions.invoke("upload", { body: { action: "delete", stored_name: chemin } });
    } catch (e) {
      console.warn("Photo non supprimée :", e.message);
    }
  }

  /* Compose la galerie : ce qui est gardé + ce qui vient d'être envoyé.
     Tout fichier de l'ancienne galerie absent de la nouvelle est supprimé,
     que le client l'ait retiré explicitement ou non. */
  async function composerGalerie(corps, actuelles) {
    const garde = Array.isArray(corps.keepPhotos) ? corps.keepPhotos.filter(cheminSur) : null;
    const nouvelles = Array.isArray(corps.photos) ? corps.photos : [];
    const cheminsActuels = (actuelles || []).filter(Boolean);

    const cible = garde ? garde.slice(0, 20) : cheminsActuels.slice();
    const disparues = new Set([
      ...cheminsActuels.filter((p) => cible.indexOf(p) < 0),
      ...(Array.isArray(corps.removePhotos) ? corps.removePhotos : []),
    ]);
    for (const p of disparues) await effacerPhoto(p);

    const avertissements = [];
    if (corps.keepPhotos && garde.length !== corps.keepPhotos.length) {
      avertissements.push("certains chemins de photo ont été ignorés (format non autorisé)");
    }
    if (nouvelles.length) {
      const { data, error } = await getClient().functions.invoke("upload", { body: { photos: nouvelles.slice(0, 12) } });
      if (error) throw new Error(error.message || "Envoi des photos refusé");
      cible.push(...((data && data.paths) || []));
      for (const avert of ((data && data.warnings) || [])) avertissements.push(avert);
    }
    return { gallery: cible.slice(0, 12), errors: avertissements };
  }

  async function ecrireVehicule(corps, slug, nouveauSlug) {
    const modifs = nettoyerVehicule(corps);
    delete modifs.slug;
    delete modifs.gallery;

    const vehicle = await lireVehicule(slug);
    const galerie = await composerGalerie(corps, vehicle ? vehicle.gallery : []);

    const maintenant = new Date().toISOString();
    if (!vehicle) {
      const ligne = { ...modifs, slug, gallery: JSON.stringify(galerie.gallery), created_at: maintenant, updated_at: maintenant };
      const { data, error } = await getClient().from("vehicles").insert(ligne).select().maybeSingle();
      if (error) return { ok: false, error: message(error) };
      return { ok: true, vehicle: enrichirVehicule(data), warnings: galerie.errors };
    }

    modifs.gallery = JSON.stringify(galerie.gallery);
    modifs.updated_at = maintenant;
    if (nouveauSlug && nouveauSlug !== slug) modifs.slug = nouveauSlug;

    const { data, error } = await getClient().from("vehicles").update(modifs).eq("slug", slug).select().maybeSingle();
    if (error) return { ok: false, error: message(error) };

    /* Un renommage doit.trainner les réservations, les indisponibilités et
       les suivis : sinon ils resteraient pointés sur un slug disparu. */
    if (nouveauSlug && nouveauSlug !== slug) {
      for (const table of ["reservations", "blocked_dates", "maintenance"]) {
        await getClient().from(table).update({ vehicle_slug: nouveauSlug }).eq("vehicle_slug", slug);
      }
      await getClient().from("reservations").update({ vehicle_name: data.name }).eq("vehicle_slug", nouveauSlug);
    }
    return { ok: true, vehicle: enrichirVehicule(data), warnings: galerie.errors };
  }

  window.LCAdmin = {
    mode: MODE,
    /* En mode « api », LCAdmin.api renvoie une promesse rejetée : c'est le
       serveur Express qui répond, et admin.js utilise alors son propre fetch.
       L'adaptateur n'est donc actif qu'en mode Supabase. */
    api: async (chemin, opts = {}) => {
      if (MODE !== "supabase") throw new Error("Adaptateur inactif en mode « api ».");
      const methode = opts.method || "GET";
      const corps = opts.body ? JSON.parse(opts.body) : null;
      const resultat = await router(methode, chemin, corps, opts);
      /* Les documents sont renvoyés à part : ils s'affichent dans un onglet,
         pas dans le flux JSON de l'écran. */
      if (resultat && resultat.__html) {
        const fenetre = window.open("", "_blank", "noopener");
        if (fenetre) {
          fenetre.document.write(resultat.__html);
          fenetre.document.close();
        }
        return { ok: true };
      }
      return resultat;
    },
    estAdmin,
  };
})();

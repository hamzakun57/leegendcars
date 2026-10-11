/**
 * Connexion du back-office.
 *
 * Deux modes, comme le reste :
 *   - « supabase » : Supabase Auth (e-mail + mot de passe), session conservée
 *   - « api »      : le serveur Express et son ancien mécanisme par cookie
 *
 * Dans les deux cas, le formulaire ne demande qu'un e-mail et un mot de passe.
 */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const msg = (text, kind = "err") => {
    $("#msg").innerHTML = text ? `<div class="${kind}">${esc(text)}</div>` : "";
  };
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const CFG = window.LCAdminConfig || {};
  const viaSupabase = CFG.source === "supabase";

  let client = null;
  const getClient = () => {
    if (client) return client;
    if (!window.SupabaseJS) throw new Error("Client Supabase absent : lancez « npm run build ».");
    client = window.SupabaseJS.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "lc_admin_session" },
    });
    return client;
  };

  const form = $("#f");
  if (!form) return;

  /* Un agent qui a déjà une session valide n'a rien à ressaisir. */
  if (viaSupabase) {
    getClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data?.session) location.replace("/admin/");
      })
      .catch(() => {});
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg("");
    const bouton = form.querySelector('button[type="submit"]');
    const libelle = bouton ? bouton.textContent : "";
    if (bouton) bouton.disabled = true;

    const email = $("#u").value.trim();
    const password = $("#p").value;
    if (!email || !password) {
      if (bouton) bouton.disabled = false;
      return msg("Renseignez votre e-mail et votre mot de passe.");
    }

    try {
      if (viaSupabase) {
        const { data, error } = await getClient().auth.signInWithPassword({ email, password });
        if (error || !data?.user) {
          if (bouton) bouton.disabled = false;
          return msg("E-mail ou mot de passe incorrect.");
        }
        /* Connecté, mais peut-être pas administrateur : la page d'accueil
           vérifiera elle-même le rôle et refusera l'accès si besoin. */
        location.replace("/admin/");
      } else {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (bouton) bouton.disabled = false;
          return msg(data.error || "Identifiants incorrects");
        }
        location.href = "/admin";
      }
    } catch (err) {
      if (bouton) bouton.disabled = false;
      msg(err.message || "Connexion impossible.");
      if (bouton) bouton.textContent = libelle;
    }
  });
})();

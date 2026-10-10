const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));


const loginShell = (body) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Administration — Leegend Cars</title>
<link rel="stylesheet" href="/admin-assets/admin.css"></head>
<body><div class="wrap login">${body}</div></body></html>`;

export const loginPage = (needsSetup) =>
  loginShell(`
    <div class="login__card panel">
      <div class="brand"><span class="brand__mark">LC</span>Leegend <span>Cars</span></div>
      <h1>${needsSetup ? "Première connexion" : "Connexion"}</h1>
      <p class="sub">${needsSetup ? "Créez le compte administrateur de cet espace." : "Espace d'administration de la location."}</p>
      <div id="msg"></div>
      <form id="f" autocomplete="off">
        <label for="u">Identifiant</label>
        <input id="u" name="username" autocomplete="username" required autofocus>
        <label for="p">Mot de passe</label>
        <input id="p" name="password" type="password" autocomplete="${needsSetup ? "new-password" : "current-password"}" required>
        ${needsSetup ? '<label for="p2">Confirmer le mot de passe</label><input id="p2" type="password" autocomplete="new-password" required>' : ""}
        <button class="primary" style="width:100%;margin-top:20px" type="submit">
          ${needsSetup ? "Créer le compte" : "Se connecter"}
        </button>
      </form>
      <p class="faint" style="margin-top:20px;text-align:center">
        ${needsSetup
          ? "Mot de passe : 8 caractères minimum. Cette page ne sera plus accessible ensuite."
          : 'Session limitée à 12 heures. <a href="/" style="color:var(--red)">Retour au site</a>'}
      </p>
    </div>
    <script src="/admin-assets/login.js"></script>
  `);

const adminShell = () => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Administration — Leegend Cars</title><link rel="stylesheet" href="/admin-assets/admin.css"></head>
<body>
<header class="top"><div class="wrap">
  <div class="brand"><span class="brand__mark">LC</span>Leegend <span>Cars</span> <span class="pill">admin</span></div>
  <div class="row" style="margin-left:auto">
    <span class="faint" id="who"></span>
    <a class="btn ghost" href="/" target="_blank">Voir le site</a>
  </div>
</div></header>

<div class="shell">
  <nav class="side" id="side" aria-label="Menu principal">
    <div class="side__group">Pilotage</div>
    <a data-tab="res" class="on"><span class="ic">▤</span> Réservations <span class="badge" id="side-badge"></span></a>
    <a data-tab="cli"><span class="ic">☺</span> Clients</a>
    <div class="side__group"> exploitation</div>
    <a data-tab="veh"><span class="ic">▣</span> Flotte</a>
    <a data-tab="avail"><span class="ic">⊘</span> Indisponibilités</a>
    <div class="side__group">Compte</div>
    <a data-tab="set"><span class="ic">⚙</span> Réglages</a>
    <div class="side__foot">
      <button id="logout"><span class="ic">⏻</span> Déconnexion</button>
    </div>
  </nav>

  <main class="wrap">
    <div id="msg"></div>
    <div id="crumb" class="faint" style="margin:18px 0 -6px"></div>

    <section id="tab-res">
      <h1>Réservations</h1>
      <p class="sub">Les demandes envoyées depuis le site. Ouvrez une réservation confirmée pour accéder au dossier complet.</p>
      <div class="cards" id="stats"></div>
      <div class="toolbar">
        <select id="fstatus">
          <option value="">Tous les statuts</option>
          <option value="nouvelle">Nouvelle</option>
          <option value="confirmee">Confirmée</option>
          <option value="annulee">Annulée</option>
          <option value="livree">Livrée</option>
        </select>
        <button id="refresh">Actualiser</button>
        <button class="primary" id="rnew" style="margin-left:auto">+ Nouvelle réservation</button>
      </div>
      <div class="panel panel--table"><table>
        <thead><tr>
          <th>Réf. · reçue</th><th>Client</th><th>Téléphone</th>
          <th>Véhicule</th><th>Dates</th><th class="num">Total</th><th class="num">Reste</th><th>Statut</th><th></th>
        </tr></thead>
        <tbody id="rows"></tbody>
      </table><div id="rempty" class="empty hide">
        <b>Aucune réservation</b>Les demandes envoyées depuis le site apparaîtront ici.
      </div></div>
    </section>

    <section id="tab-cli" class="hide">
      <h1>Clients</h1>
      <p class="sub">La fiche client : identité, contact et documents. Sert à retrouver un conducteur sans le ressaisir.</p>
      <div class="toolbar">
        <input id="cq" placeholder="Rechercher : nom, téléphone, CIN, passeport…">
        <select id="ctype">
          <option value="">Tous les types</option>
          <option value="particulier">Particulier</option>
          <option value="professionnel">Professionnel</option>
          <option value="entreprise">Entreprise</option>
        </select>
        <button id="crefresh">Actualiser</button>
        <button class="primary" id="cnew" style="margin-left:auto">+ Nouveau client</button>
      </div>
      <div class="panel panel--table"><table>
        <thead><tr>
          <th>Nom</th><th>Type</th><th>Téléphone</th><th>Email</th>
          <th>Permis</th><th>CIN</th><th>Nationalité</th><th></th>
        </tr></thead>
        <tbody id="crows"></tbody>
      </table><div id="cempty" class="empty hide">
        <b>Aucun client enregistré</b>Créez une fiche pour ne plus ressaisir un conducteur.
      </div></div>
    </section>

    <section id="tab-veh" class="hide">
      <h1>Flotte</h1>
      <p class="sub">Ces véhicules sont servis à <code>/api/vehicles</code> et affichés sur le site public.</p>
      <div class="row" style="margin-bottom:14px">
        <button class="primary" id="new-veh">+ Nouveau véhicule</button>
      </div>
      <div id="veh-list"></div>
    </section>

    <section id="tab-avail" class="hide">
      <h1>Indisponibilités</h1>
      <p class="sub">Bloque une période pour un véhicule. Le prix ne s'affiche plus sur ces dates si la période bloque.</p>
      <div class="panel">
        <div class="grid3">
          <div><label>Véhicule</label><select id="bl-veh"></select></div>
          <div><label>Du</label><input id="bl-start" type="date"></div>
          <div><label>Au</label><input id="bl-end" type="date"></div>
        </div>
        <label>Motif (facultatif)</label>
        <input id="bl-reason" placeholder="Ex : entretien, location longue…">
        <div class="row" style="margin-top:14px"><button class="primary" id="bl-add">Bloquer</button></div>
      </div>
      <div class="panel"><table>
        <thead><tr><th>Véhicule</th><th>Du</th><th>Au</th><th>Motif</th><th></th></tr></thead>
        <tbody id="bl-rows"></tbody>
    </table></div>
    </section>

    <section id="tab-set" class="hide">
      <h1>Réglages</h1>
      <p class="sub">Changer le mot de passe de l'administrateur.</p>
      <div class="panel" style="max-width:420px">
        <label>Mot de passe actuel</label><input id="pw-cur" type="password" autocomplete="current-password">
        <label>Nouveau mot de passe</label><input id="pw-new" type="password" autocomplete="new-password">
        <div class="row" style="margin-top:14px"><button class="primary" id="pw-save">Enregistrer</button></div>
      </div>
    </section>

    <section id="tab-dos" class="hide">
      <div id="dos"></div>
    </section>

    <div class="sheet" id="sheet" hidden aria-hidden="true">
      <div class="sheet__scrim" data-sheet-close></div>
      <aside class="sheet__panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <header class="sheet__head">
          <b id="sheet-title"></b>
          <span class="faint" id="sheet-sub"></span>
          <button type="button" class="sheet__x" data-sheet-close aria-label="Fermer">✕</button>
        </header>
        <div class="sheet__body" id="sheet-body"></div>
        <footer class="sheet__foot" id="sheet-foot" hidden></footer>
      </aside>
    </div>
  </main>
</div>
<script src="/admin-assets/signature-pad.js"></script>
<script src="/admin-assets/admin.js"></script>
</body></html>`;

export { esc, adminShell };
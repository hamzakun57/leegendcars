import { COMPANY, logoSvg } from "./company.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const nf = (n) => (Number(n || 0)).toLocaleString("fr-FR");
const fmtDate = (iso, withTime) => {
  if (!iso) return "";
  const dt = new Date(String(iso).length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(dt)) return esc(iso);
  const base = dt.toLocaleDateString("fr-FR");
  return withTime && iso.length > 10 ? `${base} ${String(iso).slice(11, 16)}` : base;
};
/** Date au format du modèle : 2026-03-10, avec l'heure si elle est fournie. */
const fmtIso = (iso, heure) => {
  if (!iso) return "";
  const s = String(iso);
  if (s.length < 10) return esc(s);
  const jour = s.slice(0, 10);
  const h = heure || (s.length > 10 ? s.slice(11, 16) : "");
  return h ? `${jour} ${h}` : jour;
};
/** Date seule, au format du modèle : 2026-05-10. */
const fmtIsoDate = (iso) => (iso ? String(iso).slice(0, 10) : "");
/** Ligne « libellé : valeur » avec pointillés, comme le modèle. */
const line = (label, value) =>
  `<div class="ct-line"><span>${label}</span><b>${value ? esc(value) : ""}</b></div>`;
const val = (v) => (v ? esc(v) : "");

const FUEL = ["0", "1/4", "1/2", "3/4", "1"];

const EQUIPMENT_LABELS = [
  ["batterie", "Batterie"],
  ["outils", "Outils"],
  ["retroExt", "Retro-ext"],
  ["feux", "Feux"],
  ["galerie", "Galerie"],
  ["posteRadio", "Poste Radio"],
  ["pressuSecours", "Pressu Secours"],
  ["alarmeCigare", "Alarme Cigare"],
];

const CAR_TOP_VIEW = `<svg viewBox="0 0 120 56" class="ct-car" aria-hidden="true">
  <path d="M6 28 q0-8 10-9 l10-1 q8-9 20-9 h28 q12 0 20 9 l10 1 q10 1 10 9 q0 7-10 8 l-10 1 q-8 9-20 9 h-28 q-12 0-20-9 l-10-1 q-10-1-10-8Z"
        fill="none" stroke="#111" stroke-width="1.6"/>
  <rect x="38" y="14" width="44" height="9" rx="2" fill="none" stroke="#111" stroke-width="1.2"/>
  <rect x="38" y="33" width="44" height="9" rx="2" fill="none" stroke="#111" stroke-width="1.2"/>
  <rect x="14" y="20" width="16" height="16" rx="3" fill="none" stroke="#111" stroke-width="1.2"/>
  <rect x="90" y="20" width="16" height="16" rx="3" fill="none" stroke="#111" stroke-width="1.2"/>
</svg>`;

const FUEL_GAUGE = `<svg viewBox="0 0 240 58" class="ct-gauge" aria-hidden="true">
  <path d="M22 54 A96 96 0 0 1 218 54" fill="none" stroke="#111" stroke-width="1.6"/>
  <line x1="22" y1="54" x2="52" y2="54" stroke="#111" stroke-width="1.6"/>
  <line x1="218" y1="54" x2="188" y2="54" stroke="#111" stroke-width="1.6"/>
  <line x1="120" y1="54" x2="120" y2="34" stroke="#111" stroke-width="1.6"/>
  <circle cx="120" cy="54" r="4" fill="#111"/>
</svg>`;

/* Voiture vue de dessus, avec un point sur la jauge */
function gaugeWith(level) {
  const idx = Math.max(0, FUEL.indexOf(level || "")) ;
  const marks = FUEL.map((l, i) => {
    const cls = i === idx ? "on" : "";
    return `<span class="ct-fuel__mark ${cls}">${l}</span>`;
  }).join("");
  return `<div class="ct-fuel">${marks}</div>`;
}

function driverBox(title, drv) {
  const rows = [
    ["Nom complet :", drv.name],
    ["Né le :", drv.birthdate ? fmtDate(drv.birthdate) : ""],
    ["Nationalité :", drv.nationality],
    ["Adresse au Maroc :", drv.address],
    ["Téléphone :", drv.phone],
    ["Permis de conduire :", drv.licence],
    ["Délivré le :", drv.licence_date ? fmtDate(drv.licence_date) : ""],
    ["Passeport N° :", drv.passport],
    ["Délivré le :", drv.passport_date ? fmtDate(drv.passport_date) : ""],
    ["CIN N° :", drv.cin],
    ["Délivré le :", drv.cin_date ? fmtDate(drv.cin_date) : ""],
  ];
  return `<div class="ct-box">
    <div class="ct-box__title">${title}</div>
    ${rows.map(([l, v]) => line(l, v)).join("")}
  </div>`;
}

/* ------------------------------------------------------------------ CSS */
const CSS = `
@page { size: A4 portrait; margin: 8mm; }
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"DejaVu Sans",Arial,Helvetica,sans-serif;color:#111;background:#3a3a40;
  font-size:9.4pt;line-height:1.42;-webkit-print-color-adjust:exact;print-color-adjust:exact}

/* --- écran : vraies feuilles A4 centrées, identiques à l'impression --- */
@media screen{
  body{padding:0 0 24px}
  .ct-page{width:210mm;min-height:296mm;margin:12mm auto;background:#fff;
    padding:8mm 8mm 6mm;box-shadow:0 2px 14px rgba(0,0,0,.55);position:relative}
  .ct-page::before{content:"Page " attr(data-n);position:absolute;top:3mm;right:5mm;
    font:600 7pt system-ui,Arial,sans-serif;color:#bbb;letter-spacing:.08em;text-transform:uppercase}
  .ct-page + .ct-page{border-top:0;padding-top:8mm}
}

/* --- impression : une page = une feuille, rien ne doit se couper --- */
@media print{
  body{background:#fff}
  .ct-page{width:auto;min-height:0;margin:0;padding:0;box-shadow:none;page-break-after:always;break-after:page}
  .ct-page:last-child{page-break-after:auto;break-after:auto}
  .ct-page::before{display:none}
  .ct-box,.ct-row,.ct-sign,.ct-note,.ct-check,.ct-equip,.ct-articles h3{break-inside:avoid;page-break-inside:avoid}
}
.ct-page + .ct-page{border-top:6px solid #111}
@media print{.ct-page + .ct-page{padding-top:5mm}}

.ct-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:6px}
.ct-head__left{flex:1}
.ct-head__mid{text-align:center;width:120px}
.ct-head__right{flex:1;text-align:right;font-size:8pt;line-height:1.5}
.ct-title{font-weight:700;font-size:10.5pt}
.ct-number{border:1.4px solid #111;border-radius:3px;padding:5px 10px;font-weight:700;
  font-size:13pt;text-align:center;letter-spacing:.5px;margin-top:3px}
.ct-brand{font-weight:800;font-size:12pt;letter-spacing:.2px;margin-top:1px}
/* logo.jpg est un carré de 500 px très margé : on l'affiche en entier mais
   recadré sur son dessin, aux proportions du modèle. */
.ct-logo{display:block;position:relative;width:75px;height:53px;overflow:hidden;margin:0 auto 2px}
/* Le dessin est centré à 52,5 % de la hauteur de logov2.png : on décale le
   recadrage de la même valeur, sinon le bas du logo (« CARS ») est coupé. */
.ct-logo img{position:absolute;left:50%;top:47.5%;width:115px;height:115px;
  transform:translate(-50%,-50%)}

.ct-box{border:1.4px solid #111;border-radius:4px;padding:5px 7px;margin-bottom:6px}
.ct-box__title{text-align:center;font-weight:700;background:#ececec;border-radius:2px;
  padding:1px 0;margin-bottom:4px;font-size:9.6pt}
.ct-line{display:flex;gap:5px;align-items:baseline;font-size:9pt}
.ct-line span{flex:none}
.ct-line b{flex:1;font-weight:700;border-bottom:1px dotted #999;min-width:20px;
  padding:0 2px 1px;word-break:break-word}
.ct-line b:empty::after{content:""}
.ct-row{display:grid;gap:6px}
.ct-row--2{grid-template-columns:1fr 1fr}
.ct-row--main{grid-template-columns:1.15fr .85fr}

.ct-cars{display:flex;gap:12px;justify-content:space-around;margin:4px 0}
.ct-cars figure{margin:0;text-align:center}
.ct-cars figcaption{font-weight:700;font-size:9.4pt;margin-bottom:2px}
.ct-car{width:100%;max-width:190px;height:auto}
.ct-gauge{width:100%;max-width:230px;height:auto;display:block;margin:2px auto}
.ct-fuel{display:flex;justify-content:space-between;font-size:8.4pt;font-weight:700;margin-top:-6px;padding:0 6px}
.ct-fuel__mark{opacity:.32}
.ct-fuel__mark.on{opacity:1;text-decoration:underline}
.ct-gauge-row{display:flex;gap:8px;align-items:flex-end;margin-top:2px}
.ct-gauge-row .ct-gauge-wrap{flex:1 1 auto;min-width:0;max-width:186px;margin:0 auto}
.ct-gauge-row .ct-gauge{max-width:100%;margin:2px auto 0}
.ct-equip{flex:0 0 auto;width:118px;font-size:8pt;border:1px solid #111;border-radius:3px;
  padding:4px 6px;background:#fafafa}
.ct-equip b{display:block;margin-bottom:2px}
.ct-equip ul{list-style:none;display:grid;gap:1px}
.ct-equip li{display:flex;justify-content:space-between;gap:6px}
.ct-check{display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;font-size:9pt;margin:5px 0 2px}
.ct-check label{display:flex;align-items:center;gap:6px}
.ct-boxed{border:1px solid #999;font-weight:700;min-width:11px;height:11px;text-align:center;
  line-height:11px;font-size:8.4pt}
.ct-boxed.on{background:#111;color:#fff}
.ct-note{font-size:7.4pt;line-height:1.35;font-weight:700;padding:4px 6px;margin-bottom:0}
.ct-accept{font-size:8.4pt;margin-top:6px}
.ct-sign{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:8px}
.ct-sign div{font-size:9pt}
.ct-sign b{display:block;text-align:right;font-size:8.4pt}
.ct-sign .line{margin-top:34px;border-top:1px solid #111}
/* Tampon de l'agence : encadré sobre, le cachet lui-même est apposé à la main. */
.ct-sign .stamp{width:236px;margin-top:8px;border:0;display:grid;gap:0;text-align:center;
  color:#12286f;font-style:italic;line-height:1.25;font-size:8.6pt;letter-spacing:.02em}
.ct-sign .stamp b{font-size:13pt;font-weight:800;text-align:center;letter-spacing:.01em}
.ct-sign .stamp span{display:block;font-weight:600}
.ct-sign .stamp span:nth-child(2){font-size:8.6pt}
.ct-signature{margin-top:4px}
.ct-signature img{display:inline-block;max-width:190px;max-height:38px;object-fit:contain;
  vertical-align:middle}
.ct-signature span{display:block;font-size:7.4pt;color:#333;margin-top:1px}
.ct-signature--remote span::after{content:" (signature électronique)"}
.ct-foot{margin-top:8px;font-size:8pt;font-weight:700;text-align:center}

/* Page 1 : compactage pour tenir sur une seule page A4 */
.ct-p1{font-size:8.2pt;line-height:1.28}
.ct-p1 .ct-box{padding:3px 5px;margin-bottom:4px}
.ct-p1 .ct-box__title{margin-bottom:2px;padding:0;font-size:8.6pt}
.ct-p1 .ct-line{font-size:8pt}
.ct-p1 .ct-line b{padding-bottom:0}
.ct-p1 .ct-row{gap:5px}
.ct-p1 .ct-head{margin-bottom:4px}
.ct-p1 .ct-number{padding:3px 8px;font-size:11.5pt;margin-top:2px}
.ct-p1 .ct-brand{font-size:9.6pt}
.ct-p1 .ct-head__right{font-size:7.2pt;line-height:1.4}
.ct-p1 .ct-cars{gap:8px;margin:2px 0}
.ct-p1 .ct-cars figcaption{font-size:8.4pt;margin-bottom:1px}
.ct-p1 .ct-car{max-width:150px}
.ct-p1 .ct-gauge{max-width:100%;margin:1px auto}
.ct-p1 .ct-gauge-row .ct-gauge-wrap{max-width:150px}
.ct-p1 .ct-fuel{margin-top:-2px;font-size:7.6pt}
.ct-p1 .ct-equip{font-size:7.2pt;padding:3px 5px;line-height:1.3;width:104px}
.ct-p1 .ct-gauge-row{gap:6px}
.ct-p1 .ct-check{font-size:8.2pt;margin:4px 0 2px;gap:2px 8px}
.ct-p1 .ct-note{font-size:6.9pt;padding:3px 5px;margin-top:4px;line-height:1.32}
.ct-p1 .ct-accept{font-size:7.8pt;margin-top:4px}
.ct-p1 .ct-sign{margin-top:5px;gap:16px}
.ct-p1 .ct-sign .line{margin-top:20px}
.ct-p1 .ct-signature{margin-top:2px}
.ct-p1 .ct-signature img{max-width:220px;max-height:44px}
.ct-p1 .ct-signature span{font-size:7pt}
.ct-p1 .ct-sign--signed .line{margin-top:10px}
.ct-p1 .stamp{width:262px;font-size:8pt;margin-top:5px}
.ct-p1 .stamp b{font-size:11.5pt}
.ct-p1 .ct-foot{margin-top:4px;font-size:7.6pt}

.ct-articles{column-count:2;column-gap:8mm;font-size:7.5pt;line-height:1.36}
.ct-articles h3{font-size:8pt;font-weight:700;margin:0 0 1px;break-after:avoid}
.ct-articles h3:not(:first-child){margin-top:5px}
.ct-articles p{margin:0;text-indent:0}
.ct-articles .list{padding-left:9pt}
.ct-articles ol,.ct-articles ul{margin:0;padding-left:10pt}

.ct-bar{position:sticky;top:0;z-index:9;display:flex;gap:10px;align-items:center;flex-wrap:wrap;
  background:#111;color:#fff;padding:9px 14px;font-family:system-ui,Arial,sans-serif;font-size:13px}
.ct-bar button{background:#fff;color:#111;border:0;border-radius:6px;padding:7px 13px;
  font:600 13px system-ui,Arial,sans-serif;cursor:pointer}
.ct-bar a{color:#9ad;text-decoration:underline}
.ct-bar .ct-hint{flex:1;min-width:260px;font-size:12px;line-height:1.35;color:#c9c9d2}
@media print{ .ct-bar{display:none!important} }
`;

/* ------------------------------------------------------------- page 1 */
/* Signature client : image + mention de qui a signé, quand elle existe. */
function signatureBlock(r) {
  if (!r.signatureData) return "";
  const who = r.signatureName ? ` — ${r.signatureName}` : "";
  return `<div class="ct-signature${r.signatureMode === "remote" ? " ct-signature--remote" : ""}">
      <img src="${esc(r.signatureData)}" alt="Signature du client">
      <span>Signé le ${fmtDate(r.signatureSignedAt)}${esc(who)}</span>
    </div>`;
}

function page1(r, vehicle) {
  const options = [
    ["Poste radio", r.options.radio],
    ["GPS", r.options.gps],
    ["Siège bébé", r.options.babySeat],
    ["Climatiseur", r.options.climatiseur],
  ];

  const d1 = {
    name: `${r.first_name} ${r.last_name}`.trim(),
    birthdate: r.d1_birthdate, nationality: r.d1_nationality, address: r.d1_address,
    phone: `${r.country_code} ${r.phone}`.trim(),
    licence: r.licence_number, licence_date: r.licence_date,
    passport: r.passport, passport_date: r.d1_passport_date,
    cin: r.d1_cin, cin_date: r.d1_cin_date,
  };
  const d2 = {
    name: `${r.driver2_first_name} ${r.driver2_last_name}`.trim(),
    birthdate: r.driver2_birthdate, nationality: r.driver2_nationality, address: r.driver2_address,
    phone: r.driver2_phone,
    licence: r.driver2_licence, licence_date: r.driver2_licence_date,
    passport: "", passport_date: r.driver2_passport_date,
    cin: r.driver2_cin, cin_date: r.driver2_cin_date,
  };

  const equip = EQUIPMENT_LABELS.map(
    ([k, label]) => `<li><span>${label}</span><b>${r.equipment[k] ? "✓" : ""}</b></li>`
  ).join("");

  return `<section class="ct-page ct-p1" data-n="1 / 2">
    <header class="ct-head">
      <div class="ct-head__left">
        <div class="ct-title">Contrat de location n° :</div>
        <div class="ct-number">${esc(r.contractNumber)}</div>
      </div>
      <div class="ct-head__mid">
        ${logoSvg()}
        <div class="ct-brand">${esc(COMPANY.legalName)}</div>
      </div>
      <div class="ct-head__right">
        <div>Tél: ${esc(COMPANY.phone)}</div>
        <div>Email: ${esc(COMPANY.email)}</div>
        ${COMPANY.addressLines.map((l) => `<div>${esc(l)}</div>`).join("")}
      </div>
    </header>

    <div class="ct-row ct-row--2">
      <div class="ct-box">${line("Marque :", vehicle?.modele || vehicle?.name || r.vehicle_name)}</div>
      <div class="ct-box">${line("N° d'immatriculation :", vehicle?.matricule)}</div>
    </div>

    <div class="ct-row ct-row--2">
      ${driverBox("1<sup>er</sup> CONDUCTEUR", d1)}
      ${driverBox("2<sup>ème</sup> CONDUCTEUR", d2)}
    </div>

    <div class="ct-row ct-row--main">
      <div>
        <div class="ct-box">
          <div class="ct-cars">
            <figure><figcaption>DEPART</figcaption>${CAR_TOP_VIEW}</figure>
            <figure><figcaption>RETOUR</figcaption>${CAR_TOP_VIEW}</figure>
          </div>
          <div class="ct-gauge-row">
            <div class="ct-gauge-wrap">
              ${FUEL_GAUGE}
              ${gaugeWith(r.fuel_depart)}
            </div>
            <div class="ct-equip">
              <ul>${equip}</ul>
            </div>
          </div>
        </div>
        <div class="ct-box">
          ${line("Kms départ :", r.kms_depart ? nf(r.kms_depart) + " kms" : "")}
          ${line("Kms retour :", r.kms_return ? nf(r.kms_return) + " kms" : "")}
          ${line("Km parcourus :", r.kmDone ? nf(r.kmDone) + " kms" : "")}
        </div>
        <div class="ct-check">
          ${options.map(([label, on]) => `<label><span class="ct-boxed ${on ? "on" : ""}">${on ? "X" : ""}</span> ${label}</label>`).join("")}
        </div>
      </div>

      <div>
        <div class="ct-box">
          ${line("Départ :", fmtIso(r.pickup_date, r.pickup_time))}
          ${line("Retour :", `${fmtIso(r.return_date, r.return_time)}${r.days ? ` (${r.days}jrs)` : ""}`)}
          ${line("Lieu de livraison :", r.pickup)}
          ${line("Lieu de récupération :", r.ret)}
          ${line("Assurance :", r.insurance)}
          ${line("Observation :", r.observations)}
        </div>
        <div class="ct-box">
          ${line("Prix :", nf(r.total) + " dh")}
          ${line("Frais divers :", r.extra_fee ? `${nf(r.extra_fee)} dh` : "")}
        </div>
        <div class="ct-box">
          ${line("Total :", nf(r.totalTTC) + " dh")}
          ${line("Avance :", nf(r.totalPaid) + " dh")}
          ${line("Reste :", nf(Math.max(0, r.reste)) + " dh")}
          ${line("Mode de paiement :", r.paymentModeLabel)}
        </div>
        <div class="ct-box ct-note">
          - Je reconnais être seul responsable des violations du code de la route.<br>
          - J'autorise ${esc(COMPANY.legalName)} à débiter de mon compte bancaire via ma carte,
          les montants relatifs aux dégâts et frais causés au véhicule.
        </div>
      </div>
    </div>

    <p class="ct-accept">- J'ai lu et accepte les conditions stipulées au verso du présent contrat</p>

    <div class="ct-sign${r.signatureData ? " ct-sign--signed" : ""}">
      <div>
        Agent Loueur<br><b>Fait le: ${fmtIsoDate(r.created_at)}</b>
        <div class="stamp">
          <b>${esc(COMPANY.stamp.name)}</b>
          <span>${esc(COMPANY.stamp.activity)}</span>
          <span>${esc(COMPANY.addressOneLine)}</span>
          <span>Tél : ${esc(COMPANY.stampPhone)}</span>
        </div>
      </div>
      <div style="text-align:right">
        Conducteurs
        ${signatureBlock(r)}
        <div class="line"></div>
      </div>
    </div>
    <div class="ct-foot">${esc(COMPANY.legalLine(COMPANY.ice, COMPANY.rc))}</div>
  </section>`;
}

/* ------------------------------------------------------------- page 2 */
/* =========================================================================
   ⚠  À RELIRE SUR LE PDF D'ORIGINE AVANT UTILISATION CONTRATUELLE
   -------------------------------------------------------------------------
   model_contrat.pdf ne contient AUCUNE couche texte (polices sous-ensembles
   sans table ToUnicode) : le texte a donc été transcrit à partir du rendu
   image du document. Les titres des 11 articles et leur sens ont été respectés,
   mais plusieurs phrases étaient illisibles à cette résolution et ont été
   reconstituées. Les passages douteux sont signalés par [?] ci-dessous.
   Ces conditions sont des clauses juridiques : faites-les relire par un juriste.
   ========================================================================= */
const ARTICLES = [
  ["ARTICLE 1 : UTILISATION DU VEHICULE", [
    "a- La location est personnelle : elle n'est en aucun cas transmissible, sauf les personnes agréées par la société de location qui ont le droit d'utilisation du véhicule loué.",
    "b- Les conducteurs agréés agissant comme mandataires de la Sté de location, lesquels deviennent entièrement responsables des véhicules dès la prise en charge.",
    "c- Les locations s'interdisent d'une façon formelle et irrévocable :",
    ["a- Tout excès de vitesse ou conduite brutale.", "b- La participation à des rallyes, compétitions, concours et autres.", "c- Toute circulation en dehors des voies carrossables (mauvaises routes, pistes et passages difficiles)."],
    "d- L'utilisation du véhicule à des fins illicites (transport de personnes à titre onéreux, de marchandises prohibées ou de remorquages).",
    "e- La surcharge du véhicule par le transport de passagers au-delà de celui porté sur le contrat d'assurance.",
    "f- De franchir les frontières marocaines et de solliciter des documents douaniers.",
    "g- N'apporter aucune modification au véhicule.",
    "h- Ne laisser en aucun cas les titres de circulation dans celui-ci et utiliser à chaque arrêt les systèmes de fermeture.",
  ]],
  ["ARTICLE 2: ETAT DE LA VOITURE", [
    "1- La voiture est livrée au locataire en parfait état de marche, de carrosserie et de propreté, avec les accessoires normaux.",
    "2- Le véhicule sera rendu aux dates et heures prévues au recto dans le même état qu'à son départ ; à défaut, le locataire devra s'acquitter du montant de la remise en état immédiatement.",
    "3- Les cinq pneumatiques sont au départ en bon état. En cas de détérioration ou de disparition de l'un d'eux, le locataire s'engage à le remplacer immédiatement par un pneu de même dimension, de même marque et d'usure sensiblement égale. Toute destruction ou omission sera portée à la charge du client. [?]",
  ]],
  ["ARTICLE 3 : CARBURANT ET LUBRIFIANT", [
    "La fourniture du carburant est à la charge du locataire, qui doit vérifier en permanence le niveau d'huile et d'eau et effectuer, à intervalle régulier indiqué par le constructeur, la vidange du moteur, le graissage y compris la boîte de vitesses et le pont. Il justifiera de ses travaux par des factures correspondantes.",
    "Lors d'une voiture neuve, le locataire s'engage à faire effectuer les révisions obligatoires par un agent officiel de la marque du véhicule : elles lui seront remboursées sur justificatifs, sous peine de payer une indemnité pour usure anormale dû à sa négligence. Cette indemnité est de 5 000,00 dhs et plus. Le rapport d'expertise fait loi.",
  ]],
  ["ARTICLE 4 : ENTRETIEN ET REPARATIONS", [
    "A- Les réparations, échanges de pièces ou de pneumatiques résultant de l'usage normal sont à la charge de la société de location.",
    "B- Celles résultant d'un usage anormal, de négligence, d'une cause accidentelle ou indéterminée sont à la charge du locataire, qui doit s'acquitter du montant majoré d'indemnités d'immobilisation prévu à l'article 7 paragraphe C.",
    "C- Si le véhicule est immobilisé hors de la ville, ou si la société de location dispose d'un bureau, le locataire ne peut charger de ces travaux ou fournitures qu'un agent officiel de la marque du véhicule, avec facture détaillée ainsi que les pièces défectueuses remplacées.",
    "D- Soit pour l'immobilisation dans le cas de réparation due à l'usure normale.",
    "E- Soit celle résultant d'usure anormale : la responsabilité de la société de location ne pourra jamais être engagée en cas d'accident de personnes ou de choses ayant pu résulter en vice ou de défaut de construction ou de réparations antérieures.",
  ]],
  ["ARTICLE 5 : ASSURANCES", [
    "La locataire est garanti pour les risques suivants :",
    "1- Une assurance illimitée contre les tiers.",
    "2- Contre le vol et l'incendie du véhicule loué pendant toute la durée de la location. [?]",
    "3- La garantie est nulle en cas de vol du véhicule par un mandataire ou un préposé.",
    "4- Sont également couverts le conducteur et les personnes transportées (paragraphe e).",
    "5- Contre les dégâts de la voiture avec franchise selon le contrat d'assurance, la charge étant en cas d'accident ou d'endommagement du véhicule à la charge du locataire.",
    "6- Le locataire subroge l'office la société de location dans ses droits pour recours contre les tiers pour dégâts matériels.",
    "7- L'indemnité éventuellement obtenue sert d'abord au remboursement des dégâts matériels et des frais ayant pu rester à la charge du locataire ; le solde lui revient.",
    "8- Les assurances ci-dessus ne sont en vigueur que pour la durée de la location.",
    "9- Tout conducteur en état d'ivresse ou sous l'empire d'un état alcoolique, Tornis par les rapports des autorités, devient seul et unique responsable des dommages causés.",
    "10- Le locataire s'engage à déclarer à la société de location, sous 48 heures, immédiatement aux autorités tout accident, vol ou incendie, même partiel. Sa déclaration devra comporter obligatoirement les circonstances, le lieu, l'heure, le nom et l'adresse des témoins, ainsi que le numéro du P.V. des autorités.",
    "11- En aucun cas le locataire ne devra discuter de la responsabilité, ni transiger avec des tiers relativement à l'accident.",
  ]],
  ["ARTICLE 6 : LOCATION CAUTION PROLONGATION", [
    "Le prix de la location ainsi que la caution sont déterminés selon le tarif payable d'avance.",
    "La caution ne peut servir en aucun cas à une prolongation de location. La résiliation de cette caution ne sera jugée valable qu'en cas d'indisponibilité matérielle du locataire.",
    "En cas de prolongation de location, le locataire doit obtenir un accord écrit et faire parvenir en garantie le montant de la location supplémentaire 48 heures avant l'expiration de la location en cours, sous peine de s'exposer à des poursuites pour détournement et abus de confiance.",
    "Le retour du véhicule devra se faire aux heures ouvrables. Le locataire est formellement tenu de rendre ou de ne pas abandonner le véhicule.",
  ]],
  ["ARTICLE 7 : ANNULATION", [
    "A- La Sté de location se réserve le droit de mettre fin à tout moment et de refuser toute prolongation, en remboursant le montant des journées non utilisées.",
    "B- Toute annulation de la part du locataire est soumise à 50 % des frais de remboursement ; celui-ci se fera aux tarifs en vigueur selon les jours inutilisés.",
    "C- Sans l'accord écrit de la Sté de location, faute de quoi, le locataire sera débité de la location et des autres frais avec intérêt fixé à 20 % jusqu'à restitution du véhicule.",
  ]],
  ["ARTICLE 8: SOUS-LOCATION", [
    "La Sté de location, en cas d'indisponibilité dans son parc ou (pannes etc.…), aura recours à la sous-location aux mêmes tarifs et conditions convenus au contrat initial.",
  ]],
  ["ARTICLE 9 : DOCUMENTS DE LA VOITURE", [
    "Le locataire remettra à la Sté de location, dès le retour du véhicule, les circulations affectées à cette dernière, faute de quoi la location continuera à lui être facturée au prix initial jusqu'à production des deux règlements des frais dus.",
  ]],
  ["ARTICLE 10 : RESPONSABLE", [
    "Le locataire seul responsable des amendes, contraventions, procès-verbaux de poursuites doublées et autres établis contre lui en conséquence, il s'engage à rembourser à la société de location tous les frais de cette nature non payés en lieu et place.",
  ]],
  ["ARTICLE 11 : JURIDICTION", [
    "De convention expresse et en cas de contestation quelconque, les tribunaux seuls compétents. Les frais de timbres et d'enregistrements restent à la charge du locataire.",
  ]],
];

function articlesHtml() {
  return ARTICLES.map(([title, paras]) => {
    const body = paras.map((p) => {
      if (Array.isArray(p)) return `<ul class="list">${p.map((li) => `<li>${esc(li)}</li>`).join("")}</ul>`;
      return `<p>${esc(p)}</p>`;
    }).join("");
    return `<h3>${esc(title)}</h3>${body}`;
  }).join("");
}

function page2(r) {
  return `<section class="ct-page" data-n="2 / 2">
    <div class="ct-articles">${articlesHtml()}</div>
    ${signatureBlock(r)}
    <div class="ct-foot" style="margin-top:14px">${esc(COMPANY.legalLine(COMPANY.ice, COMPANY.rc))}</div>
  </section>`;
}

/* ------------------------------------------------------------- document */
export function contractHtml(r, vehicle, opts = {}) {
  const toolbar = opts.toolbar === false ? "" : `<div class="ct-bar">
    <button type="button" data-print>Enregistrer en PDF</button>
    <span class="ct-hint">Dans la fenêtre d'impression : <b>Destination « Enregistrer au format PDF »</b> ·
      <b>Format A4</b> · <b>Marges « Par défaut »</b> · <b>décochez « En-têtes et pieds de page »</b>.</span>
    <a href="/admin" target="_blank">Retour à l'admin</a>
  </div>`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Contrat ${esc(r.contractNumber)} — ${esc(vehicle?.name || r.vehicle_name || "")}</title>
<style>${CSS}</style>
<script src="/doc-assets/doc-print.js" defer></script>
</head>
<body>
  ${toolbar}
  ${page1(r, vehicle)}
  ${page2(r)}
</body></html>`;
}
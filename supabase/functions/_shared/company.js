/**
 * Identité qui apparaît sur le contrat.
 *
 * ⚠  Ces informations viennent du modèle NEW_MODEL.pdf. Elles font foi sur un
 *    document contractuel : vérifiez-les avant toute impression. Un seul
 *    endroit à modifier pour toute l'application.
 */
export const COMPANY = {
  /** Nom commercial imprimé sous le logo. */
  legalName: "Leegend cars",
  shortName: "Leegend cars",
  initials: "LC",

  /** Téléphone affiché en haut à droite du contrat. */
  phone: "0660819857",
  phoneTel: "+212660819857",
  /** Téléphone figurant dans le tampon de l'agence. */
  stampPhone: "06 28 39 49 47",

  email: "leegend.cars099@gmail.com",
  addressLines: ["10 Rue Ouarzazat Hassan Rabat", "90000"],
  addressOneLine: "10 Rue Ouarzazat Hassan - RABAT",

  ice: "00260576000034",
  rc: "174335",

  /** Tampon apposé par l'agence, en bas de la page 1. */
  stamp: {
    name: "KLEINE CAR SARL AU",
    activity: "Location de Voitures sans Chauffeurs",
  },

  /** Mention imprimée en bas de chaque page. */
  legalLine: (ice, rc) => `ICE: ${ice} - RC: ${rc}`,

  /** Logo utilisé en haut du contrat (fichier du site public, fond transparent). */
  logo: "/logov2.png",
  logoWord: "Leegend cars",
  logoHeight: 53,
};

/**
 * Logo du contrat. Sur NEW_MODEL.pdf, l'en-tête reprend l'illustration du site
 * au-dessus du nom commercial. logov2.png est un carré de 500 px dont le
 * dessin n'occupe que 58 % de la largeur : on l'affiche recadré dessus.
 */
export function logoSvg(height = COMPANY.logoHeight) {
  const cadre = Math.round(height * 1.415);
  const image = Math.round(height * 2.163);
  return `<span class="ct-logo" style="width:${cadre}px;height:${height}px">
      <img src="${COMPANY.logo}" alt="${COMPANY.logoWord}" style="width:${image}px;height:${image}px">
    </span>`;
}
/**
 * Fichiers : validation et stockage.
 *
 * La validation se fait sur la SIGNATURE BINAIRE du fichier, jamais sur son
 * nom ni sur le type déclaré par le navigateur — un fichier renommé en .jpg
 * n'est pas une image. C'est le même contrôle que celui du serveur
 * (server/uploads.js), et il est exécuté ici parce que c'est cette fonction
 * qui touche au stockage.
 */

export const BUCKET = "uploads";

/* Les chemins publics et les clés de stockage commencent tous deux par
   « uploads/ » : c'est ce qui permet à l'admin d'afficher /uploads/… sans
   changement et à la base de ne retenir que le nom du fichier.
   Conséquence à connaître : la clé contient déjà le nom du bucket, donc
   l'API de stockage attend /object/uploads/uploads/… . Ne pas « corriger » ce
   doublon d'un seul côté — l'envoi et la suppression doivent rester symétriques. */
const PREFIXE = "uploads/";

export const MAX_PHOTO = 5 * 1024 * 1024; // 5 Mo
export const MAX_DOC = 5 * 1024 * 1024; // 5 Mo
export const MAX_ENVOI = 4 * 1024 * 1024; // total par requête

const SIGNATURES = [
  { ext: ".jpg", mime: "image/jpeg", test: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: ".png",
    mime: "image/png",
    test: (b: Uint8Array) => {
      const t = [137, 80, 78, 71, 13, 10, 26, 10];
      return t.every((v, i) => b[i] === v);
    },
  },
  {
    ext: ".webp",
    mime: "image/webp",
    test: (b: Uint8Array) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP",
  },
];

function ascii(b: Uint8Array, debut: number, fin: number): string {
  let s = "";
  for (let i = debut; i < fin && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}

/** base64 -> octets. atob existe dans Deno comme dans Node. */
export function decoder(dataUrl: string): Uint8Array {
  const virgule = dataUrl.indexOf(",");
  const base64 = virgule >= 0 ? dataUrl.slice(virgule + 1) : dataUrl;
  /* atob lève un message anglais (« Failed to decode base64 ») qui remonte
     jusqu'à l'écran de l'agent. Le fichier est renvoyé tel quel, sans
     explication utile : on le dit en français et on nomme le coupable. */
  let binaire: string;
  try {
    binaire = atob(base64.replace(/\s/g, ""));
  } catch {
    throw new Error("image illisible : le fichier n'a pas pu être décodé");
  }
  const sortie = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) sortie[i] = binaire.charCodeAt(i);
  return sortie;
}

/** Taille réelle, en octets, d'un lot encodé en base64.
 *  Le remplissage final « = » compte pour rien : sans cette correction, un
 *  fichier est surestimé de deux octets et la garde « envoi trop lourd »
 *  finirait par refuser un envoi qui passe. */
export function tailleLot(dataUrls: unknown[]): number {
  return (dataUrls || []).reduce((total: number, d) => {
    const s = typeof d === "string" ? d : "";
    const i = s.indexOf(",");
    const base64 = (i >= 0 ? s.slice(i + 1) : s).replace(/\s/g, "");
    if (!base64) return total;
    const remplissage = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    return total + Math.floor((base64.length * 3) / 4) - remplissage;
  }, 0);
}

export type FichierValide = { nom: string; chemin: string; mime: string; taille: number; contenu: Uint8Array };

/**
 * Valide un fichier et lui attribue un nom inexploitable.
 * @param sousDossier dossier dans le bucket (« » ou « reservations »)
 */
export function valider(dataUrl: unknown, { max = MAX_DOC, allowPdf = false, sousDossier = "" } = {}): FichierValide {
  if (typeof dataUrl !== "string" || !dataUrl) throw new Error("fichier vide");

  const contenu = decoder(dataUrl);
  if (!contenu.length) throw new Error("fichier vide");
  if (contenu.length > max) {
    throw new Error(`fichier trop lourd (max ${Math.round(max / 1048576)} Mo par fichier)`);
  }

  const signature = SIGNATURES.find((s) => s.test(contenu));
  const estPdf = ascii(contenu, 0, 5) === "%PDF-";
  if (!signature && !(allowPdf && estPdf)) {
    throw new Error("format non supporté (JPEG, PNG, WebP" + (allowPdf ? " ou PDF" : "") + ")");
  }

  const ext = signature ? signature.ext : ".pdf";
  const mime = signature ? signature.mime : "application/pdf";
  const nom = `${Date.now().toString(36)}-${jeton(12)}${ext}`;
  const chemin = sousDossier ? `${BUCKET}/${sousDossier}/${nom}` : `${BUCKET}/${nom}`;
  return { nom, chemin, mime, taille: contenu.length, contenu };
}

function jeton(longueur: number): string {
  const octets = new Uint8Array(longueur);
  crypto.getRandomValues(octets);
  return Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
}

/** Envoie un fichier validé dans le bucket. */
export async function envoyer(client: any, fichier: FichierValide): Promise<FichierValide> {
  const { error } = await client.storage.from(BUCKET).upload(fichier.chemin, fichier.contenu, {
    contentType: fichier.mime,
    upsert: false,
  });
  if (error) throw new Error("Stockage refusé : " + error.message);
  return fichier;
}

/** Chemin public conservé en base et affiché dans l'admin. */
export const cheminPublic = (sousDossier: string, nom: string) =>
  sousDossier ? `${BUCKET}/${sousDossier}/${nom}` : `${BUCKET}/${nom}`;

/** Nom de fichier strictement vérifié : rien d'autre ne peut être supprimé. */
export function nomSure(nom: unknown): string | null {
  if (typeof nom !== "string") return null;
  const relatif = nom.startsWith(`${BUCKET}/`) ? nom.slice(BUCKET.length + 1) : nom;
  if (!/^(reservations\/)?[\w-]+\.(jpg|png|webp|pdf)$/.test(relatif)) return null;
  return `${BUCKET}/${relatif}`;
}

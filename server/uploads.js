import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, unlinkSync, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
/* Dossier à la racine du projet : servi tel quel par express.static, et hors du
   préfixe /server/ que le serveur bloque volontairement. */
export const UPLOAD_DIR = join(here, "..", "uploads");
const PUBLIC_PREFIX = "uploads/";

mkdirSync(UPLOAD_DIR, { recursive: true });

/* On ne se fie qu'à la signature binaire du fichier, pas au nom ni au type
   déclaré par le navigateur. */
const SIGNATURES = [
  { ext: ".jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: ".png", mime: "image/png", test: (b) => b.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  { ext: ".webp", mime: "image/webp", test: (b) => b.slice(0, 4).toString("ascii") === "RIFF" && b.slice(8, 12).toString("ascii") === "WEBP" },
];

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 Mo par photo
export const MAX_PHOTOS = 12;
/* Pièces jointes du dossier (permis, contrat…) : documents, formats plus larges. */
export const MAX_DOC_BYTES = 15 * 1024 * 1024; // 15 Mo
export const DOC_KINDS = ["piece", "contrat", "facture", "permis"];

/**
 * Enregistre une photo envoyée en base64 (data URL ou base64 nu).
 * @returns {string} le chemin public à stocker en base
 */
export function savePhoto(dataUrl) {
  return saveImage(dataUrl, MAX_PHOTO_BYTES);
}

/** Pièce jointe du dossier : accepte les images + PDF.
 *  Toutes les pièces d'une réservation vont dans uploads/reservations/ ;
 *  le type (contrat, facture, permis…) est une colonne en base, pas un dossier. */
export function saveDocument(dataUrl, kind = "piece") {
  return saveImage(dataUrl, MAX_DOC_BYTES, "reservations", true);
}

function saveImage(dataUrl, maxBytes, subdir = "", allowPdf = false) {
  if (typeof dataUrl !== "string" || !dataUrl) throw new Error("fichier vide");

  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;

  let buf;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    throw new Error("fichier illisible");
  }
  if (!buf.length) throw new Error("fichier vide");
  if (buf.length > maxBytes) {
    throw new Error(`fichier trop lourd (max ${Math.round(maxBytes / 1048576)} Mo)`);
  }

  const sig = SIGNATURES.find((s) => s.test(buf));
  const isPdf = buf.slice(0, 5).toString("ascii") === "%PDF-";
  if (!sig && !(allowPdf && isPdf)) {
    throw new Error("format non supporté (JPEG, PNG, WebP" + (allowPdf ? " ou PDF" : "") + ")");
  }

  const ext = sig ? sig.ext : ".pdf";
  const dir = subdir ? join(UPLOAD_DIR, subdir) : UPLOAD_DIR;
  if (subdir) mkdirSync(dir, { recursive: true });

  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}${ext}`;
  writeFileSync(join(dir, name), buf);
  return { storedName: name, dir, publicPath: (subdir ? `${PUBLIC_PREFIX}${subdir}/` : PUBLIC_PREFIX) + name, mime: sig?.mime || "application/pdf", size: buf.length };
}

/** Supprime une photo uploadée. Ne touche jamais aux images du dépôt (cars/…). */
export function deletePhoto(publicPath) {
  if (typeof publicPath !== "string") return false;
  if (!publicPath.startsWith(PUBLIC_PREFIX)) return false; // image d'origine : on la conserve
  return deleteStored(publicPath.slice(PUBLIC_PREFIX.length));
}

/** Supprime une pièce jointe du dossier (sous-dossier uploads/reservations). */
export function deleteStored(storedName) {
  if (typeof storedName !== "string" || !storedName) return false;
  const relative = storedName.startsWith(PUBLIC_PREFIX)
    ? storedName.slice(PUBLIC_PREFIX.length)
    : storedName;
  // Autorisé : un éventuel segment uploads/reservations + un nom de fichier strict
  if (!/^(reservations\/)?[\w-]+\.(jpg|png|webp|pdf)$/.test(relative)) return false;
  try {
    // Les pièces jointes sont rangées dans uploads/reservations/, les photos à la racine.
    const candidates = relative.includes("/")
      ? [join(UPLOAD_DIR, relative)]
      : [join(UPLOAD_DIR, "reservations", relative), join(UPLOAD_DIR, relative)];
    for (const full of candidates) {
      if (existsSync(full)) unlinkSync(full);
    }
    return true;
  } catch {
    return false;
  }
}
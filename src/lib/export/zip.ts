/**
 * UN RÉDACTEUR ZIP MINIMAL, PARTAGÉ PAR TOUS LES FORMATS OOXML.
 *
 * Un `.xlsx`, un `.pptx` et un `.docx` sont la même chose vue de loin : une
 * archive ZIP de fichiers XML. Ce module ne connaît que l'archive ; ce qu'on y
 * met est l'affaire de l'appelant.
 *
 * POURQUOI LA MÉTHODE « STORED ». On écrit un ZIP minimal en méthode « stored »
 * (aucune compression) : la compression demanderait DEFLATE, c'est-à-dire
 * exactement la librairie qu'on cherche à éviter. Le fichier est plus gros sur
 * le disque, jamais sur le réseau — il naît dans le navigateur et n'est envoyé
 * nulle part.
 *
 * POURQUOI PAS `CompressionStream`. Le navigateur sait bien deflater, mais son
 * API est asynchrone et ne produit pas d'en-tête gzip séparable proprement du
 * flux ; on y gagnerait des octets contre une fonction `async` qui contaminerait
 * chaque appelant, y compris les tests. Le troc n'en vaut pas la peine.
 */

/* ── CRC32 ───────────────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/* ── ZIP « stored » ──────────────────────────────────────────────────────── */

/** Une entrée de l'archive. Le nom est un chemin POSIX, sans `/` initial. */
export interface ZipFile {
  name: string;
  content: string;
}

interface ZipEntry {
  name: string;
  bytes: Uint8Array;
  crc: number;
  offset: number;
}

function u16(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

/**
 * Assemble l'archive.
 *
 * Les dates sont fixées à une valeur constante plutôt qu'à « maintenant » :
 * deux exports du même tableau produisent alors deux fichiers identiques
 * octet pour octet, ce qui rend les tests possibles.
 */
export function zipStored(files: readonly ZipFile[], mimeType: string): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const entries: ZipEntry[] = [];
  let offset = 0;

  const push = (data: number[] | Uint8Array): void => {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    chunks.push(bytes);
    offset += bytes.length;
  };

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const bytes = encoder.encode(file.content);
    const crc = crc32(bytes);
    entries.push({ name: file.name, bytes, crc, offset });

    push([
      0x50, 0x4b, 0x03, 0x04, // signature d'en-tête local
      ...u16(20), // version minimale
      ...u16(0), // pas de drapeau
      ...u16(0), // méthode 0 : stored
      ...u16(0), ...u16(0x21), // heure et date figées
      ...u32(crc),
      ...u32(bytes.length),
      ...u32(bytes.length),
      ...u16(nameBytes.length),
      ...u16(0),
    ]);
    push(nameBytes);
    push(bytes);
  }

  const centralStart = offset;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    push([
      0x50, 0x4b, 0x01, 0x02,
      ...u16(20), ...u16(20),
      ...u16(0), ...u16(0),
      ...u16(0), ...u16(0x21),
      ...u32(entry.crc),
      ...u32(entry.bytes.length),
      ...u32(entry.bytes.length),
      ...u16(nameBytes.length),
      ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0),
      ...u32(entry.offset),
    ]);
    push(nameBytes);
  }

  push([
    0x50, 0x4b, 0x05, 0x06,
    ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length),
    ...u32(offset - centralStart),
    ...u32(centralStart),
    ...u16(0),
  ]);

  return new Blob(chunks as BlobPart[], { type: mimeType });
}

/**
 * Échappe le texte destiné à un contenu ou à un attribut XML.
 *
 * Les quatre caractères sont traités d'un bloc parce que le même texte sert
 * ici et là : un nom d'entreprise contenant `&` ou `"` casserait le document
 * de façon silencieuse, et le tableur comme le diaporama refuseraient de
 * l'ouvrir sans jamais dire pourquoi.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

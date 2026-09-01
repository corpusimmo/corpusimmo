/**
 * LE JETON DE PARTAGE — la seule clé qui donne accès sans compte.
 *
 * `src/lib/history/estimations.ts` explique pourquoi le lien partageable
 * n'existe pas encore : « rien n'est stocké côté serveur, donc une URL
 * permanente serait une promesse que le rechargement casserait ». La base lève
 * l'obstacle, mais elle en crée un autre : une estimation atteignable par une
 * URL est atteignable par QUICONQUE a l'URL. Le jeton est donc la mesure de
 * sécurité, pas un détail de forme.
 *
 * TROIS PROPRIÉTÉS, ET AUCUNE N'EST NÉGOCIABLE
 *   1. TIRÉ AU HASARD CRYPTOGRAPHIQUE. `crypto.getRandomValues`, jamais
 *      `Math.random()` : le second est prédictible à partir de quelques
 *      tirages, et deviner un jeton reviendrait à lire l'estimation d'un
 *      inconnu.
 *   2. ASSEZ LONG. Dix-huit octets, soit 144 bits. Un identifiant de ligne
 *      séquentiel, ou même un `uuid` de la table, transformerait la base entière
 *      en catalogue énumérable.
 *   3. DISTINCT DE L'IDENTIFIANT DE LIGNE. Retirer un partage doit être
 *      possible sans casser les références internes : on efface le jeton, la
 *      ligne reste.
 *
 * `getRandomValues` ET `btoa` PLUTÔT QUE `node:crypto`, pour que ce module
 * fonctionne aussi dans le runtime Edge si une route de partage y bascule un
 * jour. Les deux sont standard côté Web et présents dans Node depuis la 18.
 */

/** 18 octets : un multiple de 3, donc un base64 sans remplissage à couper. */
const TOKEN_BYTES = 18;

/**
 * Un jeton de partage, en base64url : 24 caractères sûrs dans une URL, sans
 * `+`, `/` ni `=` qui demanderaient un échappement quelque part.
 */
export function newShareToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** La forme attendue d'un jeton, pour refuser une URL bricolée sans requête. */
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24}$/;

export function isShareToken(value: string): boolean {
  return SHARE_TOKEN_PATTERN.test(value);
}

/**
 * LA FORME D'UN RÉSULTAT D'ÉCRITURE.
 *
 * POURQUOI UN RÉSULTAT ET NON UNE EXCEPTION. Le dépôt a déjà tranché ailleurs,
 * et de la même façon : `ContactSyncOutcome` dans `src/lib/email/contacts.ts`
 * rend `{ synced: false, reason: "no_list" }` plutôt que de lever, parce qu'« une
 * panne de liste ne doit pas coûter à quelqu'un l'estimation qu'il vient de
 * demander ». Enregistrer un historique, un panier ou un consentement relève de
 * la même catégorie : c'est un service rendu en plus du service demandé.
 *
 * TROIS ISSUES, ET ELLES NE SE VALENT PAS
 *   `stored: true`             — écrit.
 *   `reason: "not_configured"` — il n'y a pas de base. Ce n'est PAS une panne :
 *                                c'est le contrat du dépôt (`.env` vide), et
 *                                l'appelant a un repli légitime, généralement le
 *                                navigateur ou le cookie signé.
 *   `reason: "failed"`         — il y a une base et elle a refusé. C'est une
 *                                panne, elle est journalisée, et l'appelant ne
 *                                doit surtout pas la traiter comme la
 *                                précédente : se rabattre silencieusement sur le
 *                                navigateur masquerait une base en train de
 *                                tomber.
 *
 * CE QUI N'EST PAS CONCERNÉ : la lecture du quota. Une base configurée mais
 * muette ne doit pas se traduire par « aucun déblocage compté », ce qui
 * ouvrirait la bibliothèque en grand. Voir `queries/unlocks.ts`, qui laisse
 * délibérément remonter l'erreur.
 */

export type WriteFailure =
  | { stored: false; reason: "not_configured" }
  | { stored: false; reason: "failed" };

export type WriteOutcome<T> = { stored: true; value: T } | WriteFailure;

export const NOT_CONFIGURED: WriteFailure = { stored: false, reason: "not_configured" };

/**
 * Journalise une panne d'écriture et la traduit en issue.
 *
 * Le message porte le nom de l'opération, jamais les données : une trace
 * d'application n'a pas à contenir l'adresse e-mail ni l'adresse postale de qui
 * que ce soit. C'est la même règle que `maskEmail` côté e-mails.
 */
export function writeFailed(operation: string, error: unknown): WriteFailure {
  const detail = error instanceof Error ? error.message : "erreur inconnue";
  console.error(`[db] ${operation} a échoué — ${detail}`);
  return { stored: false, reason: "failed" };
}

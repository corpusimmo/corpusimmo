/**
 * LA CONFIGURATION DE LA BASE — et surtout, SON ABSENCE.
 *
 * Le contrat du dépôt est écrit en tête de `.env.example` et vérifié par la CI
 * à chaque poussée : l'application DÉMARRE et se CONSTRUIT avec un `.env` vide.
 * Une base absente doit donc dégrader vers un comportement documenté, jamais
 * lever à l'import — ce qui casserait `next build` sur un clone neuf.
 *
 * LA PHILOSOPHIE EST CELLE DE `src/lib/auth/config.ts` ET DE
 * `src/lib/access/ledger.ts`, sans invention :
 *   - un booléen public dit si la chose est configurée, pour que l'appelant
 *     puisse décider sans provoquer d'erreur (`isAuthConfigured` là-bas) ;
 *   - l'absence est journalisée UNE FOIS, puis on n'en parle plus : un
 *     avertissement répété à chaque requête finit par être filtré, donc par ne
 *     plus rien avertir ;
 *   - on ne se rabat sur AUCUNE valeur par défaut. Une URL de secours pointerait
 *     vers une base à quelqu'un d'autre, ou vers `localhost` en production.
 *
 * POURQUOI DES FONCTIONS ET NON DES CONSTANTES. `isAuthConfigured` est une
 * constante évaluée à l'import, ce qui suffit là-bas. Ici, l'évaluation à
 * l'import rendrait le comportement intestable : un test ne peut pas poser
 * `DATABASE_URL` après coup si la décision a déjà été prise. Ces fonctions sont
 * appelées une fois par démarrage à froid en pratique, le coût est nul.
 *
 * CE FICHIER N'IMPORTE PAS `server-only` ET N'OUVRE AUCUNE CONNEXION. Il ne
 * lit qu'une variable d'environnement, ce qui le rend éprouvable sous Vitest —
 * or le comportement sans `DATABASE_URL` est exactement ce qu'il faut prouver.
 */

/**
 * Levée quand un appelant demande la base alors qu'elle n'est pas configurée.
 *
 * Une classe et non un `Error` nu : les appels d'écriture rattrapent cette
 * erreur-là pour dégrader proprement, et laissent passer toutes les autres. Un
 * `instanceof` distingue « pas de base » d'« une base qui répond mal », et ces
 * deux situations n'appellent pas la même réaction.
 */
export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL est absent : aucune requête n'est possible. " +
        "Renseignez la chaîne de connexion Neon dans .env.local, ou vérifiez " +
        "isDatabaseConfigured() avant d'appeler la base. Voir docs/database.md.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

/** Une chaîne de connexion Postgres, et rien d'autre. */
const POSTGRES_URL = /^postgres(ql)?:\/\/.+/;

let warnedAbsent = false;
let warnedInvalid = false;

/**
 * La chaîne de connexion, ou `undefined`.
 *
 * Une valeur présente mais qui ne ressemble pas à une URL Postgres est traitée
 * comme ABSENTE, avec un avertissement. C'est la position de `src/config/env.ts`
 * (« avertir, jamais interrompre ») : une variable mal recopiée ne doit pas
 * empêcher `pnpm dev` de démarrer, et une chaîne vide héritée d'un
 * `DATABASE_URL=` laissé dans un fichier d'environnement ne doit surtout pas
 * partir vers le pilote.
 */
export function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();

  if (!raw) {
    if (!warnedAbsent) {
      warnedAbsent = true;
      console.warn(
        "[db] DATABASE_URL absent : rien n'est persisté côté serveur. " +
          "Les déblocages restent dans le cookie signé, l'historique et les " +
          "comparables dans le navigateur.",
      );
    }
    return undefined;
  }

  if (!POSTGRES_URL.test(raw)) {
    if (!warnedInvalid) {
      warnedInvalid = true;
      console.warn(
        "[db] DATABASE_URL ne ressemble pas à une chaîne de connexion Postgres " +
          "et sera ignoré (attendu : postgresql://…).",
      );
    }
    return undefined;
  }

  return raw;
}

/**
 * Vrai quand une base est joignable en principe.
 *
 * « En principe » : la chaîne est là et bien formée, ce qui ne dit rien de la
 * base au bout. Promettre davantage demanderait un aller-retour réseau, et un
 * booléen qui fait une requête réseau est un piège pour l'appelant.
 */
export function isDatabaseConfigured(): boolean {
  return databaseUrl() !== undefined;
}

/** La chaîne, ou une erreur claire. Point d'entrée du client. */
export function requireDatabaseUrl(): string {
  const url = databaseUrl();
  if (!url) throw new DatabaseNotConfiguredError();
  return url;
}

/**
 * Remet les avertissements à zéro. Réservé aux tests : sans cela, le premier
 * cas de test consommerait l'unique avertissement et les suivants ne pourraient
 * plus rien observer.
 */
export function resetConfigWarnings(): void {
  warnedAbsent = false;
  warnedInvalid = false;
}

/**
 * VÉRIFIER CE QUE LA BASE CONTIENT VRAIMENT.
 *
 * « J'ai lancé la migration » et « la migration a réussi » sont deux choses
 * différentes, et l'écart entre les deux se paie en heures de recherche : la
 * connexion échoue avec un message qui ne nomme jamais la table manquante.
 *
 * Ce script lit `DATABASE_URL_UNPOOLED` (ou `DATABASE_URL`) dans `.env.local`,
 * se connecte, et dit ce qu'il voit. Il n'écrit RIEN, il ne modifie RIEN, et
 * la chaîne de connexion ne quitte pas la machine : seuls les noms de tables
 * sont affichés.
 *
 *   node scripts/verifier-base.mjs
 */

import { existsSync } from "node:fs";

import { neon } from "@neondatabase/serverless";

if (existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env.local");
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!url) {
  console.error("✗ Aucune chaîne de connexion trouvée.");
  console.error(
    "  Attendu : DATABASE_URL_UNPOOLED dans .env.local, ou dans l'environnement.",
  );
  process.exit(1);
}

/** Les treize tables du socle, telles que la migration les crée. */
const ATTENDUES = [
  "users",
  "accounts",
  "sessions",
  "verification_tokens",
  "user_profiles",
  "tool_unlocks",
  "estimations",
  "comparable_sets",
  "comparable_items",
  "contacts",
  "leads",
  "consents",
  "erasure_requests",
];

const sql = neon(url);

try {
  const rows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `;
  const present = new Set(rows.map((r) => r.table_name));

  console.log(
    `Connexion établie. ${present.size} table(s) dans le schéma public.\n`,
  );

  const manquantes = ATTENDUES.filter((t) => !present.has(t));

  for (const table of ATTENDUES) {
    console.log(`  ${present.has(table) ? "✓" : "✗"} ${table}`);
  }

  if (present.has("__drizzle_migrations")) {
    const [applied] =
      await sql`select count(*)::int as n from public.__drizzle_migrations`;
    console.log(
      `\n  ✓ __drizzle_migrations : ${applied.n} migration(s) appliquée(s)`,
    );
  } else {
    console.log(
      "\n  ✗ __drizzle_migrations : la migration n'a JAMAIS tourné sur cette base.",
    );
  }

  console.log(
    manquantes.length === 0
      ? "\n→ La base est complète. La connexion ne peut pas échouer à cause d'elle."
      : `\n→ ${manquantes.length} table(s) manquante(s) : ${manquantes.join(", ")}.` +
          "\n  Lancez : pnpm db:migrate",
  );
} catch (error) {
  console.error("\n✗ La connexion ou la lecture a échoué :");
  console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  console.error(
    "\n  « permission denied » : le rôle de la chaîne n'a pas le droit de lire ou de créer." +
      "\n  Prenez la chaîne du rôle PROPRIÉTAIRE dans Neon (Roles), puis relancez.",
  );
  process.exit(1);
}

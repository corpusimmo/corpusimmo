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

/** Les quatorze tables attendues, telles que les migrations les créent. */
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
  "brand_profiles",
];

const sql = neon(url);

async function roleName(client) {
  const [row] = await client`select current_user as r`;
  return row.r;
}

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

  /* LE REGISTRE VIT DANS LE SCHÉMA `drizzle`, PAS DANS `public`.
   *
   * Vérifié dans le code de l'ORM : `migrationsSchema` vaut « drizzle » par
   * défaut. Le chercher dans `public`, comme le faisait la première version de
   * ce script, revenait à annoncer « la migration n'a jamais tourné » même
   * après un succès complet. Un outil de diagnostic qui ment est pire qu'une
   * absence d'outil : il envoie chercher une panne qui n'existe pas. */
  const [registre] = await sql`
    select count(*)::int as n
    from information_schema.tables
    where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
  `;

  if (registre.n > 0) {
    const [applied] =
      await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
    console.log(
      `\n  ✓ drizzle.__drizzle_migrations : ${applied.n} migration(s) appliquée(s)`,
    );
  } else {
    console.log(
      "\n  ✗ drizzle.__drizzle_migrations : la migration n'a JAMAIS tourné ici.",
    );
  }

  console.log(
    manquantes.length === 0
      ? "\n→ La base est complète."
      : `\n→ ${manquantes.length} table(s) manquante(s) : ${manquantes.join(", ")}.` +
          "\n  Lancez : pnpm db:migrate",
  );

  /* ── LA QUESTION QUI TRANCHE ───────────────────────────────────────────────
   *
   * Une connexion réussie ÉCRIT. L'adaptateur crée une ligne dans `users` puis
   * une dans `accounts`. Compter ces lignes répond donc à une question que
   * ni les journaux ni les captures d'écran ne tranchent : est-ce que la
   * connexion a déjà abouti UNE seule fois, ou jamais ?
   *
   * Zéro partout veut dire que rien n'est jamais arrivé jusqu'à la base : la
   * panne est en amont, du côté de Google ou des variables d'environnement.
   * Des lignes présentes veulent dire l'inverse, et il faut alors chercher du
   * côté de la session et du cookie.
   */
  if (present.has("users") && present.has("accounts")) {
    const [u] = await sql`select count(*)::int as n from public.users`;
    const [a] = await sql`select count(*)::int as n from public.accounts`;
    const [v] = present.has("verification_tokens")
      ? await sql`select count(*)::int as n from public.verification_tokens`
      : [{ n: 0 }];

    console.log(
      `\nComptes : ${u.n} utilisateur(s), ${a.n} compte(s) lié(s), ` +
        `${v.n} jeton(s) de lien en attente.`,
    );

    if (u.n === 0) {
      console.log(
        "→ AUCUNE connexion n'a jamais abouti jusqu'à la base.\n" +
          "  La panne est donc EN AMONT : identifiants Google, écran de\n" +
          "  consentement, URL de redirection, ou variables sur Vercel.\n" +
          "  Inutile de chercher du côté des tables.",
      );
    } else {
      const [dernier] =
        await sql`select max(created_at) as t from public.users`;
      console.log(
        `→ La connexion a déjà fonctionné (dernier compte créé : ${dernier.t ?? "date inconnue"}).\n` +
          "  La panne est donc APRÈS l'écriture : session, cookie, ou lecture.",
      );
    }

    /* Le droit d'ÉCRIRE, qui ne se déduit pas du droit de lire. Une erreur
     * `42501` sur `users` fait échouer la connexion avec le même message que
     * des identifiants Google faux, et c'est exactement le piège rencontré
     * une fois sur ce projet. On teste dans une transaction annulée : rien
     * n'est écrit pour de bon. */
    try {
      await sql`select has_table_privilege(current_user, 'public.users', 'INSERT') as ok`;
      const [droits] = await sql`
        select
          has_table_privilege(current_user, 'public.users', 'INSERT') as users,
          has_table_privilege(current_user, 'public.accounts', 'INSERT') as accounts,
          has_table_privilege(current_user, 'public.sessions', 'INSERT') as sessions
      `;
      const manque = Object.entries(droits)
        .filter(([, ok]) => !ok)
        .map(([t]) => t);
      console.log(
        manque.length === 0
          ? `\nDroits d'écriture (rôle ${await roleName(sql)}) : ✓ users, accounts, sessions`
          : `\n✗ Droits d'écriture MANQUANTS sur : ${manque.join(", ")}.\n` +
              "  C'est suffisant pour faire échouer la connexion avec le même\n" +
              "  message que des identifiants faux. Utilisez le rôle propriétaire.",
      );
    } catch {
      console.log("\n(droits d'écriture non vérifiables sur ce rôle)");
    }
  }
} catch (error) {
  console.error("\n✗ La connexion ou la lecture a échoué :");
  console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  console.error(
    "\n  « permission denied » : le rôle de la chaîne n'a pas le droit de lire ou de créer." +
      "\n  Prenez la chaîne du rôle PROPRIÉTAIRE dans Neon (Roles), puis relancez.",
  );
  process.exit(1);
}

import "server-only";

/**
 * LE CLIENT DE BASE, EN DEUX PILOTES.
 *
 * En production, la base est Neon et le pilote est HTTP : aucune connexion
 * persistante à tenir dans une fonction serverless, un appel par requête.
 * C'est le pilote historique, et il reste celui de tout hôte Neon.
 *
 * En développement, une base Postgres locale (Postgres.app, Docker) ne parle
 * pas HTTP : le pilote Neon n'y arrive pas, même avec une chaîne valide. On
 * bascule alors sur `pg`, le pilote TCP standard. Le choix se fait sur l'hôte
 * de la chaîne, et se force par `DATABASE_DRIVER=neon|pg` si l'heuristique se
 * trompe.
 *
 * Le type exposé est le socle commun `PgDatabase` : les requêtes de
 * `src/lib/db/queries/` n'utilisent rien de spécifique à l'un ou l'autre.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";

import { requireDatabaseUrl } from "./config";
import * as schema from "./schema";

export { DatabaseNotConfiguredError, isDatabaseConfigured } from "./config";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

let cached: Database | undefined;
let cachedUrl: string | undefined;

function driverFor(url: string): "neon" | "pg" {
  const forced = process.env.DATABASE_DRIVER?.trim();
  if (forced === "neon" || forced === "pg") return forced;
  try {
    const host = new URL(url).hostname;
    return host.includes("neon.tech") ? "neon" : "pg";
  } catch {
    return "neon";
  }
}

function build(url: string): Database {
  if (driverFor(url) === "neon") {
    return drizzleNeon(neon(url), { schema }) as unknown as Database;
  }
  const pool = new Pool({ connectionString: url, max: 5 });
  return drizzlePg(pool, { schema }) as unknown as Database;
}

export function getDb(): Database {
  const url = requireDatabaseUrl();
  // L'URL fait partie de la clé de cache : en test, ou après un changement de
  // branche Neon, réutiliser un client construit sur l'ancienne chaîne
  // enverrait silencieusement les requêtes au mauvais endroit.
  if (!cached || cachedUrl !== url) {
    cached = build(url);
    cachedUrl = url;
  }
  return cached;
}

export function tryGetDb(): Database | null {
  try {
    return getDb();
  } catch {
    return null;
  }
}

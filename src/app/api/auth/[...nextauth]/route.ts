/**
 * Les points d'entrée d'Auth.js : autorisation, rappel, session, déconnexion.
 *
 * Montés inconditionnellement — Auth.js répond proprement quand aucun
 * fournisseur n'est configuré, et le laisser en place évite un 404 déroutant si
 * quelqu'un pose les variables sans redéployer la bonne version.
 */

import { handlers } from "@/lib/auth";

export const runtime = "nodejs";

export const { GET, POST } = handlers;

/**
 * L'ÉQUIPE DU CRM, LUE DANS `CRM_TEAM`.
 *
 * Forme : `Mathieu Guicheteau <mathieu@exemple.fr>, Gaël Colin <gael@exemple.fr>`.
 * Une adresse nue est acceptée aussi ; le prénom est alors la partie locale.
 *
 * Deux personnes, désignées par une variable, et pas par une table : voir
 * l'en-tête de `src/lib/db/schema/crm.ts`. Sans la variable, le CRM n'a
 * aucun membre et sa porte reste fermée à tout le monde, connecté ou non.
 *
 * Ce module ne touche ni à la base ni à la session : il est testable seul.
 */

export interface TeamMember {
  /** En minuscules, toujours. C'est la clé de comparaison. */
  email: string;
  name: string;
  firstName: string;
  initials: string;
}

const ENTRY = /^\s*(?:"?([^"<]*?)"?\s*)?<\s*([^>\s]+@[^>\s]+)\s*>\s*$/;

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function parseTeam(raw: string | undefined): TeamMember[] {
  if (!raw) return [];
  const members: TeamMember[] = [];
  for (const piece of raw.split(/[,;\n]/)) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const match = ENTRY.exec(trimmed);
    let email: string;
    let name: string;
    if (match) {
      email = (match[2] ?? "").toLowerCase();
      name = (match[1] ?? "").trim() || (email.split("@")[0] ?? email);
    } else if (trimmed.includes("@")) {
      email = trimmed.toLowerCase();
      name = email.split("@")[0] ?? email;
    } else {
      continue;
    }
    if (members.some((member) => member.email === email)) continue;
    members.push({
      email,
      name,
      firstName: name.split(/\s+/)[0] ?? name,
      initials: initialsOf(name),
    });
  }
  return members;
}

let cached: TeamMember[] | undefined;

export function teamMembers(): TeamMember[] {
  if (!cached) cached = parseTeam(process.env.CRM_TEAM);
  return cached;
}

export function findMember(email: string | null | undefined): TeamMember | null {
  if (!email) return null;
  const key = email.trim().toLowerCase();
  return teamMembers().find((member) => member.email === key) ?? null;
}

export function isTeamMember(email: string | null | undefined): boolean {
  return findMember(email) !== null;
}

/** Le prénom d'un membre, ou l'adresse telle quelle si elle n'en est pas un. */
export function memberLabel(email: string | null | undefined): string {
  if (!email) return "Personne";
  return findMember(email)?.firstName ?? email;
}

/** Pour les tests : oublie la valeur lue. */
export function resetTeamCache(): void {
  cached = undefined;
}

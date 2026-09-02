"use server";

/**
 * CE QU'ON RETIENT AVANT D'ENVOYER UN LIEN DE CONNEXION.
 *
 * La connexion par lien ne rapporte qu'une adresse : Auth.js crée un compte
 * sans nom, et l'espace accueille ensuite quelqu'un qu'il ne sait pas nommer.
 * Google, lui, donne le nom avec l'identité — la voie e-mail était donc la
 * seule à produire des comptes anonymes.
 *
 * OÙ LE NOM ATTEND. Ni dans l'URL du lien (une donnée personnelle n'a rien à
 * faire dans une adresse qui traîne dans une boîte aux lettres), ni dans un
 * cookie (le lien s'ouvre souvent sur un AUTRE appareil que celui qui l'a
 * demandé, et le cookie n'y serait pas). Il attend dans la table `contacts`,
 * qui est justement indexée par adresse e-mail, et il est recopié dans le
 * profil au moment où le compte est créé — voir `events.createUser` dans
 * `lib/auth/config.ts`.
 *
 * CE QUE ÇA N'EST PAS. Aucune demande commerciale n'est créée ici : ni
 * `leads`, ni consentement, ni liste de diffusion. Une fiche de contact porte
 * un nom et une adresse, rien d'autre, et elle existait déjà pour ça.
 */

import { readContactByEmail, upsertContact } from "@/lib/db";

/** Assez pour un nom composé, trop peu pour une phrase. */
const MAX_LENGTH = 60;

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_LENGTH);
}

/** Une adresse plausible. La preuve, elle, est le clic sur le lien. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function rememberIdentity(input: {
  email: string;
  firstName: string;
  lastName: string;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName);

  // Une action serveur est une route publique : rien de ce qui arrive ici
  // n'est cru sur parole. Un champ vide ou une adresse malformée ne lève pas,
  // elle n'écrit simplement rien — le formulaire, lui, a déjà refusé.
  if (!EMAIL.test(email) || !firstName || !lastName) return;

  // La fiche n'est pas écrasée quand elle existe déjà avec un nom : c'est
  // `upsertContact` qui le garantit (`coalesce`), et c'est ce qui évite qu'une
  // faute de frappe à la deuxième connexion remplace le nom de la première.
  const existing = await readContactByEmail(email);
  if (existing?.firstName && existing?.lastName) return;

  await upsertContact({ email, firstName, lastName });
}

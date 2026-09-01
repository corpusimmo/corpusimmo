"use server";

/**
 * LES ACTIONS DE L'ESPACE COMPTE.
 *
 * Effacer une estimation doit marcher de la même façon qu'elle vienne du
 * navigateur ou de la base. Sans ces actions, se connecter ferait PERDRE le
 * bouton « effacer » : la liste passerait côté serveur et les boutons locaux
 * n'agiraient plus sur rien. Une fonctionnalité qui disparaît quand on crée un
 * compte est exactement ce qu'il ne faut pas faire.
 *
 * CHAQUE ACTION REVÉRIFIE LA SESSION. Une action serveur est une route publique
 * comme une autre : l'identifiant ne peut pas venir de l'appelant, sous peine de
 * laisser n'importe qui effacer l'historique de n'importe qui. Les requêtes de
 * suppression portent d'ailleurs le propriétaire dans leur clause `where`, donc
 * même une erreur ici ne toucherait pas les lignes d'autrui.
 */

import { revalidatePath } from "next/cache";

import { currentUserId } from "@/lib/auth/current-user";
import { clearEstimations, forgetEstimation, upsertProfile } from "@/lib/db";

/** Borne de sûreté : un identifiant de ligne, rien d'autre. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function forgetEstimationAction(estimationId: string): Promise<void> {
  if (!UUID.test(estimationId)) return;
  const userId = await currentUserId();
  if (!userId) return;

  await forgetEstimation(estimationId, userId);
  revalidatePath("/mon-espace");
}

export async function clearEstimationsAction(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  await clearEstimations(userId);
  revalidatePath("/mon-espace");
}

/**
 * Enregistre le profil.
 *
 * Les trois champs sont envoyés tels qu'ils sont affichés, et un champ vide
 * VIDE bien la valeur en base : `upsertProfile` distingue « ne touche pas »
 * (`undefined`) de « efface » (`null`), et c'est la seconde intention qu'un
 * formulaire pré-rempli exprime quand on efface une case.
 *
 * Aucune validation de forme sur le téléphone : les formats français sont
 * nombreux, les internationaux davantage, et refuser un numéro correct au
 * motif qu'il ne rentre pas dans une expression régulière coûte plus cher que
 * d'accepter une saisie approximative sur un champ facultatif.
 */
export async function saveProfileAction(values: {
  firstName: string;
  lastName: string;
  phone: string;
}): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const trim = (value: string): string | null => {
    const clean = value.trim().slice(0, 120);
    return clean === "" ? null : clean;
  };

  await upsertProfile(userId, {
    firstName: trim(values.firstName),
    lastName: trim(values.lastName),
    phone: trim(values.phone),
  });
  revalidatePath("/mon-espace");
}

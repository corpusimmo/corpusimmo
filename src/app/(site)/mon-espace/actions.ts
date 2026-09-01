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
import { clearEstimations, forgetEstimation } from "@/lib/db";

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

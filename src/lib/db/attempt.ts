/**
 * Une lecture de base qui ne fait pas tomber la page.
 *
 * L'espace compte relit trois choses en base : les déblocages, l'historique
 * des estimations, le profil. Si l'une échoue (base injoignable, table
 * absente sur une branche, colonne renommée), la page entière tombait sur la
 * frontière d'erreur générique, avec un numéro de référence et rien d'autre.
 * Pour une panne de LECTURE, c'est disproportionné : rien n'est perdu, et le
 * reste de l'espace (accès signés par cookie, formulaire de profil) tient
 * sans la base.
 *
 * On rend donc la valeur de repli, on dit que la lecture a échoué, et on
 * journalise l'erreur côté serveur, où elle est utile. Le message d'origine
 * n'atteint jamais le navigateur : il peut contenir un nom de table ou un
 * fragment de requête, et ce n'est pas au visiteur de le lire.
 */
import { unstable_rethrow } from "next/navigation";

export interface Attempt<T> {
  value: T;
  /** Vrai quand la lecture a échoué et que `value` est le repli. */
  failed: boolean;
}

export async function attempt<T>(
  label: string,
  task: () => Promise<T>,
  fallback: T,
): Promise<Attempt<T>> {
  try {
    return { value: await task(), failed: false };
  } catch (error) {
    /*
     * CE QU'IL NE FAUT SURTOUT PAS RATTRAPER.
     *
     * Next ne signale pas tout par des valeurs de retour : il LÈVE pour
     * piloter le rendu. `redirect()`, `notFound()`, et surtout la bascule en
     * rendu dynamique quand une lecture touche `cookies()` ou `headers()` —
     * tout cela passe par des exceptions qui DOIVENT remonter.
     *
     * Les avaler ne produit pas une page dégradée : ça produit une page
     * cassée. Le rendu se poursuit dans un état que Next croit statique, le
     * flux se termine sans jamais émettre les métadonnées, et le navigateur,
     * qui les attend, bascule sur la frontière d'erreur et remplace toute la
     * page par « Quelque chose s'est mal passé ». Côté serveur, on ne voit
     * qu'un digest ; côté `curl`, la page paraît correcte, puisque le corps a
     * bien été envoyé. C'est exactement la panne que ce garde-fou, ajouté pour
     * protéger l'espace compte, avait fini par causer.
     *
     * `unstable_rethrow` est la fonction que Next expose pour ça : elle relance
     * ce qui lui appartient et laisse passer le reste. Le nom est instable, le
     * besoin ne l'est pas.
     */
    unstable_rethrow(error);

    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[db] ${label} : lecture impossible (${reason})`);
    return { value: fallback, failed: true };
  }
}

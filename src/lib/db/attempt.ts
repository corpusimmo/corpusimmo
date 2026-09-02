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
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[db] ${label} : lecture impossible (${reason})`);
    return { value: fallback, failed: true };
  }
}

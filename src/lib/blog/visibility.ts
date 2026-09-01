/**
 * L'INTERRUPTEUR du journal, et la seule ligne à changer le jour de l'ouverture.
 *
 * Le blog est construit avant d'être montré&nbsp;: les pages existent, le flux
 * existe, les articles sont écrits, mais rien n'est proposé à l'indexation. Ce
 * choix évite le pire scénario de référencement d'un domaine neuf, qui est de
 * faire découvrir à un moteur une rubrique vide, puis de lui demander de
 * revenir voir.
 *
 * Deux verrous, et il faut les deux pour être indexé&nbsp;:
 *   1. ce drapeau, posé à la main, qui dit « la rubrique est assumée »&nbsp;;
 *   2. l'existence d'au moins un article publié, vérifiée à la construction.
 *
 * Le second protège du premier&nbsp;: passer le drapeau à `true` un jour où
 * tout est encore en brouillon n'ouvre rien aux moteurs.
 *
 * Le jour de l'ouverture, voir `docs/blog.md`.
 */
export const BLOG_IS_PUBLIC = false;

export interface BlogRobots {
  index: boolean;
  follow: boolean;
}

/**
 * `follow` reste vrai même en `noindex`.
 *
 * Ne pas indexer une page ne justifie pas d'en couper les liens&nbsp;: un
 * moteur qui atterrit sur le journal pendant sa préparation doit tout de même
 * pouvoir repartir vers l'estimateur ou la carte.
 */
export function blogRobots(hasPublished: boolean): BlogRobots {
  return { index: BLOG_IS_PUBLIC && hasPublished, follow: true };
}

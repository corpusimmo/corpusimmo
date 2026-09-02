/**
 * CE QUI REND UNE ERREUR DE PRODUCTION DIAGNOSTICABLE.
 *
 * Next masque le message d'une erreur de composant serveur en production — à
 * raison : un message peut contenir un nom de table, un fragment de requête,
 * une valeur. Il ne laisse qu'un `digest`, un nombre. Le nombre identifie
 * l'erreur, il ne la décrit pas : « digest: 1516256009 » ne dit ni quoi, ni
 * où, ni pourquoi, et l'on se retrouve à relire du code en aveugle.
 *
 * `onRequestError` est le crochet prévu pour ça. Il tourne CÔTÉ SERVEUR, et
 * ce qu'il journalise n'atteint jamais le navigateur : la sécurité du masquage
 * est intacte, seul l'exploitant voit le détail, dans les journaux de la
 * plateforme où il a déjà accès à tout.
 *
 * On journalise le strict nécessaire à l'identification : la route, le
 * message, le digest, et la pile. Aucun corps de requête, aucun cookie,
 * aucune valeur de session.
 */

export function register() {
  // Rien à instrumenter au démarrage. La fonction doit exister pour que Next
  // charge ce module et prenne `onRequestError` en compte.
}

export function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routePath?: string; routeType?: string },
) {
  const detail =
    error instanceof Error
      ? {
          nom: error.name,
          message: error.message,
          digest: (error as Error & { digest?: string }).digest,
          pile: error.stack?.split("\n").slice(0, 8).join(" | "),
        }
      : { message: String(error) };

  console.error(
    `[erreur] ${request.method ?? "?"} ${request.path ?? context.routePath ?? "?"}` +
      ` (${context.routeType ?? "?"}) :`,
    JSON.stringify(detail),
  );
}

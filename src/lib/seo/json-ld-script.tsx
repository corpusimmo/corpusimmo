/**
 * Le rendu d'un document JSON-LD.
 *
 * Un composant serveur sans état, volontairement minuscule : il n'existe que
 * pour qu'aucune page n'ait à écrire elle-même `dangerouslySetInnerHTML`, et
 * donc qu'aucune ne puisse oublier l'échappement (voir `serializeJsonLd`).
 */

import { jsonLdDocument, serializeJsonLd, type JsonLdNode } from "./json-ld";

export function JsonLd({ nodes }: { nodes: readonly JsonLdNode[] }) {
  if (nodes.length === 0) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLdDocument(nodes)) }}
    />
  );
}

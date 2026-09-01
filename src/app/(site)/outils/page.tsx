import type { Metadata } from "next";

import { ToolLibrary } from "@/components/tools/tool-library";
import { toolCatalogue } from "@/data/tools-catalogue";
import { JsonLd } from "@/lib/seo/json-ld-script";
import { itemListNode } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { toolMetaDescription } from "@/lib/seo/tool-metadata";

/**
 * La description énumère SIX outils sur dix, et pas les dix.
 *
 * Une méta-description est coupée autour de 160 signes : la liste complète
 * serait tronquée en plein milieu d'un nom d'outil. Six suffisent à couvrir les
 * requêtes qui comptent, la fiche de chacun portant ensuite la sienne.
 */
export const metadata: Metadata = pageMetadata({
  title: "Outils de calcul immobilier",
  description:
    "Dix calculateurs métier, gratuits et consultables librement : rentabilité locative, " +
    "capacité d'emprunt, arbitrage fiscal, DCF, bilan promoteur, WAULT.",
  path: "/outils",
  socialTitle: "Dix outils de calcul immobilier, barèmes affichés",
});

export default function OutilsPage() {
  return (
    <div className="bg-canvas py-10 md:py-14">
      {/* Un sommaire se balise comme une liste : `ItemList` dit à un moteur
          que cette page mène à dix fiches, et lesquelles. Rien de plus, et
          surtout aucune note ni aucun avis, personne n'en ayant laissé. */}
      <JsonLd
        nodes={[
          itemListNode(
            "Les outils de calcul immobilier de CorpusImmo",
            toolCatalogue.map((tool) => ({
              name: tool.title,
              path: `/outils/${tool.id}`,
              description: toolMetaDescription(tool.summary),
            })),
          ),
        ]}
      />
      <div className="container-page">
        <header className="max-w-2xl">
          <p className="eyebrow">Bibliothèque</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
            Dix outils de calcul, ouverts
          </h1>
          <p className="mt-3 leading-relaxed text-ink-muted">
            Les mêmes calculs que les feuilles qu&apos;on se transmet entre professionnels, mais
            avec les barèmes affichés, modifiables, et datés. Rien à télécharger, rien à créer.
          </p>
        </header>

        <div className="mt-10">
          <ToolLibrary tools={toolCatalogue} />
        </div>
      </div>
    </div>
  );
}

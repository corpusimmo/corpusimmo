import type { Metadata } from "next";
import Link from "next/link";
import { CloudOff, Map, Table2, WifiOff } from "lucide-react";

import { Button, Card, CardContent } from "@/components/ui";
import { siteConfig } from "@/config/site";

/**
 * LA PAGE HORS LIGNE — ce que le service worker sert quand le réseau manque.
 *
 * Elle est pré-chargée à l'installation du service worker (`public/sw.js`), et
 * c'est la seule page du site dont l'existence en cache est garantie.
 *
 * ELLE NE DÉPEND D'AUCUN JAVASCRIPT, et c'est une contrainte, pas une
 * préférence. Rendue hors ligne, ses morceaux de script peuvent parfaitement
 * ne pas être dans le cache : la page s'affichera alors sans jamais
 * s'hydrater. Tout ce qu'elle propose doit donc marcher en HTML nu, ce qui
 * exclut le moindre `onClick` et impose des LIENS. Un bouton « Réessayer »
 * câblé en JavaScript serait, ici précisément, un bouton mort.
 *
 * Elle est statique, comme toute page de ce dépôt : rien n'y est lu de la
 * requête.
 */
export const metadata: Metadata = {
  title: "Hors connexion",
  description: "La connexion réseau est indisponible.",
  // Aucune valeur pour un moteur de recherche : c'est un écran de repli, pas
  // un contenu. L'indexer reviendrait à proposer « CorpusImmo hors connexion »
  // dans les résultats de recherche.
  robots: { index: false, follow: true },
};

const INDISPONIBLE = [
  {
    icon: Map,
    titre: "La carte et l'observatoire",
    texte: "Les mutations DVF sont demandées au serveur à chaque affichage.",
  },
  {
    icon: Table2,
    titre: "L'estimation",
    texte: "Le calcul compare votre bien aux ventes enregistrées autour de lui.",
  },
];

export default function HorsLignePage() {
  return (
    <div className="bg-canvas py-12 md:py-20">
      <div className="container-page">
        <article className="mx-auto flex max-w-2xl flex-col gap-8">
          <header className="flex flex-col gap-3">
            <p className="eyebrow flex items-center gap-2">
              <WifiOff aria-hidden="true" className="size-3.5" />
              Hors connexion
            </p>
            <h1 className="font-display text-4xl leading-tight text-ink">
              Pas de réseau pour le moment
            </h1>
            <p className="text-lg leading-relaxed text-ink-muted">
              {siteConfig.name} n&apos;arrive pas à joindre son serveur. Les pages que vous avez
              déjà consultées restent lisibles&nbsp;; celles qui reposent sur des données
              attendront le retour de la connexion.
            </p>
          </header>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl text-ink">Ce qui a besoin du réseau</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {INDISPONIBLE.map(({ icon: Icone, titre, texte }) => (
                <Card key={titre}>
                  <CardContent className="flex flex-col gap-2">
                    <span
                      aria-hidden="true"
                      className="grid size-9 place-items-center rounded-md bg-surface-2 text-ink-subtle"
                    >
                      <Icone className="size-4.5" />
                    </span>
                    <p className="text-sm font-semibold text-ink">{titre}</p>
                    <p className="text-sm leading-relaxed text-ink-muted">{texte}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CloudOff aria-hidden="true" className="size-4 text-ink-subtle" />
              Aucun chiffre n&apos;est conservé hors ligne
            </p>
            <p className="text-sm leading-relaxed text-ink-muted">
              {siteConfig.name} ne garde en mémoire que l&apos;habillage du site&nbsp;: ni prix, ni
              médiane, ni transaction. Un prix de marché servi depuis un cache serait un prix
              périmé présenté comme actuel, et ce n&apos;est pas une chose que ce service accepte
              d&apos;afficher.
            </p>
          </section>

          {/* Un lien, jamais un bouton : cette page peut ne pas être hydratée. */}
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/">Revenir à l&apos;accueil</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/outils">Voir les outils de calcul</Link>
            </Button>
          </div>
        </article>
      </div>
    </div>
  );
}

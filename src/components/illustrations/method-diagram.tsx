import type { ReactNode } from "react";

import { DiagramGroup, Pictogram, type DiagramProps } from "./frame";

/**
 * LA MÉTHODE PAR COMPARAISON, EN QUATRE TEMPS.
 *
 * Le schéma d’ouverture : celui qu’on montre à quelqu’un qui n’a jamais lu le
 * mot « comparable ». Il ne cherche pas l’exhaustivité, il cherche à faire
 * comprendre que le chiffre vient de VENTES, et pas d’un modèle.
 *
 * Ce qu’il montre est vrai et vérifiable dans `src/lib/valuation/` : les seuils
 * affichés (60 mois, ±30 %, plafond de 40 %, ajustements ±12 %) sont les
 * constantes réelles du moteur. Ce qu’il tait est dit dans la légende.
 *
 * FORME — quatre cartes HTML et quatre pictogrammes muets, pas un seul SVG.
 * La grille passe de quatre colonnes à deux puis à une, et le texte garde sa
 * taille à toutes les largeurs : c’est ce qu’un SVG fluide ne sait pas faire.
 */

const STEPS: ReadonlyArray<{
  title: string;
  body: ReactNode;
  art: ReactNode;
  legend?: ReactNode;
}> = [
  {
    title: "Le bien",
    body: "Un type, une surface, une adresse géocodée. Rien d’autre n’est demandé pour commencer.",
    art: <SubjectArt />,
  },
  {
    title: "Les ventes",
    body: (
      <>
        Les mutations DVF de moins de 60&nbsp;mois autour de l’adresse, de
        surface comparable à ±30&nbsp;%. Les autres sont écartées, et comptées.
      </>
    ),
    art: <SalesArt />,
    legend: (
      <>
        <LegendDot className="bg-accent" /> retenue <LegendCross /> écartée
      </>
    ),
  },
  {
    title: "La pondération",
    body: "Distance, récence, surface et typologie. Aucune vente ne pèse plus de 40 % du résultat.",
    art: <WeightsArt />,
    legend: "La verticale : le plafond de 40 %.",
  },
  {
    title: "La fourchette",
    body: (
      <>
        Le prix au m² pondéré, multiplié par la surface, puis des ajustements
        plafonnés à ±12&nbsp;%. Jamais un prix ferme.
      </>
    ),
    art: <BracketArt />,
    legend: (
      <span className="flex justify-between gap-2 whitespace-nowrap">
        <span>borne basse</span>
        <span>valeur centrale</span>
        <span>borne haute</span>
      </span>
    ),
  },
];

export function MethodDiagram({ className, caption = true }: DiagramProps) {
  return (
    <DiagramGroup
      className={className}
      title="La méthode par comparaison, en quatre étapes"
      description={
        "Étape 1, le bien : type, surface et adresse géocodée. Étape 2, les ventes DVF " +
        "retenues autour de cette adresse, les autres étant écartées. Étape 3, la pondération " +
        "de chaque vente retenue par sa distance, sa récence, sa surface et sa typologie, " +
        "aucune ne pouvant peser plus de 40 pour cent. Étape 4, la fourchette obtenue en " +
        "multipliant le prix au mètre carré pondéré par la surface du bien."
      }
      caption={
        caption ? (
          <>
            Schéma simplifié. Entre les étapes 2 et 3, le moteur écarte encore
            les prix au m<sup>2</sup> aberrants (bornes de Tukey à 1,5 fois
            l’écart interquartile, plus des garde-fous absolus), et l’étape 4
            applique des ajustements plafonnés à ±12&nbsp;% pour ce que DVF ne
            publie pas&nbsp;: état, étage, extérieur, stationnement. Sous 5
            ventes retenues, aucune fourchette n’est publiée.
          </>
        ) : null
      }
    >
      {/* Requête de CONTENEUR, pas de fenêtre : le schéma vit dans une colonne
          de 560 px sur l'accueil et dans une page de 700 px sur le résultat.
          Quatre cartes n'ont de place qu'au-delà de 64 rem de conteneur ; en
          dessous elles vont par deux, et par une sous 30 rem. */}
      <div className="@container">
        <ol className="grid gap-3 @[30rem]:grid-cols-2 @[64rem]:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-fg">
                  {index + 1}
                </span>
                <span className="font-display text-lg leading-tight text-ink">
                  {step.title}
                </span>
              </div>

              <div className="rounded-md bg-canvas px-3 pt-3 pb-2">
                {step.art}
                {step.legend ? (
                  <p className="mt-1.5 text-[11px] leading-snug text-ink-subtle">
                    {step.legend}
                  </p>
                ) : null}
              </div>

              <p className="text-sm leading-relaxed text-ink-muted">
                {step.body}
              </p>

              {/* La flèche vers l’étape suivante, sur la gouttière de 12 px, uniquement
                quand les quatre cartes sont en ligne : en grille ou en colonne,
                l’ordre se lit seul. */}
              {index < STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -right-[18px] z-10 hidden size-6 -translate-y-1/2 place-items-center rounded-full border border-border bg-canvas text-ink-subtle @[64rem]:grid"
                >
                  <svg
                    viewBox="0 0 12 12"
                    width="10"
                    height="10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 6h8M6 2l4 4-4 4" />
                  </svg>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </DiagramGroup>
  );
}

function LegendDot({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`mr-1 inline-block size-2 rounded-full ${className}`}
    />
  );
}

function LegendCross() {
  return (
    <span aria-hidden="true" className="ml-2 mr-1 inline-block text-ink-subtle">
      ×
    </span>
  );
}

/** Le rapport commun des quatre pictogrammes : un paysage large et bas. */
const ART = "0 0 160 96";

/**
 * Le bien étudié, dans la grammaire du logotype : un toit, deux murs, et la
 * ligne bronze qui sert de sol. Dessous, une cote : la surface est la seule
 * mesure que la méthode exige.
 */
function SubjectArt() {
  return (
    <Pictogram viewBox={ART}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M44 48 L80 18 L116 48"
          className="stroke-primary"
          strokeWidth="3"
        />
        <path
          d="M54 42 v30 M106 42 v30"
          className="stroke-primary"
          strokeWidth="3"
        />
        <path
          d="M72 72 v-16 h16 v16"
          className="stroke-primary"
          strokeWidth="2.5"
        />
        <path d="M34 74 h92" className="stroke-accent-rule" strokeWidth="3.5" />
        <path
          d="M54 88 h52 M54 84 v8 M106 84 v8"
          className="stroke-ink-subtle"
          strokeWidth="1.5"
        />
      </g>
    </Pictogram>
  );
}

/** Les ventes candidates : celles qu’on garde, celles qu’on écarte. */
const RETAINED = [
  [-24, -20],
  [16, -26],
  [30, 8],
  [-12, 26],
  [22, 26],
  [-32, 4],
] as const;

const REJECTED = [
  [40, -22],
  [-6, -36],
  [10, 38],
] as const;

function SalesArt() {
  const cx = 80;
  const cy = 48;
  return (
    <Pictogram viewBox={ART}>
      <circle
        cx={cx}
        cy={cy}
        r={40}
        fill="none"
        strokeDasharray="4 4"
        strokeWidth="1.5"
        className="stroke-border-strong"
      />
      {RETAINED.map(([dx, dy]) => (
        <circle
          key={`k${dx}${dy}`}
          cx={cx + dx}
          cy={cy + dy}
          r={5}
          className="fill-accent"
        />
      ))}
      {REJECTED.map(([dx, dy]) => (
        <g
          key={`r${dx}${dy}`}
          className="stroke-ink-subtle"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <line
            x1={cx + dx - 4}
            y1={cy + dy - 4}
            x2={cx + dx + 4}
            y2={cy + dy + 4}
          />
          <line
            x1={cx + dx + 4}
            y1={cy + dy - 4}
            x2={cx + dx - 4}
            y2={cy + dy + 4}
          />
        </g>
      ))}
      {/* Le bien étudié, au centre : un losange, pour ne jamais le confondre
          avec une vente. */}
      <path
        d={`M${cx} ${cy - 8} L${cx + 8} ${cy} L${cx} ${cy + 8} L${cx - 8} ${cy} Z`}
        className="fill-primary"
      />
    </Pictogram>
  );
}

/** Les poids, du plus lourd au plus léger, et le plafond qui coupe le premier. */
const WEIGHT_BARS = [0.4, 0.24, 0.15, 0.12, 0.09] as const;
const WEIGHT_SCALE = 300;
const WEIGHT_X = 22;

function WeightsArt() {
  const capX = WEIGHT_X + WEIGHT_SCALE * 0.4;
  return (
    <Pictogram viewBox={ART}>
      {WEIGHT_BARS.map((weight, i) => (
        <rect
          key={weight}
          x={WEIGHT_X}
          y={10 + i * 16}
          width={weight * WEIGHT_SCALE}
          height={11}
          rx={3}
          className={i === 0 ? "fill-accent-rule" : "fill-brand-300"}
        />
      ))}
      <line
        x1={capX}
        y1={4}
        x2={capX}
        y2={92}
        strokeDasharray="4 3"
        strokeWidth="1.5"
        className="stroke-ink-subtle"
      />
    </Pictogram>
  );
}

/** La fourchette : le composant signature du produit, réduit à son squelette. */
function BracketArt() {
  const low = 42;
  const high = 118;
  const mid = (low + high) / 2;
  const y = 50;
  return (
    <Pictogram viewBox={ART}>
      <rect
        x={14}
        y={y - 3}
        width={132}
        height={6}
        rx={3}
        className="fill-border-soft"
      />
      <rect
        x={low}
        y={y - 6}
        width={high - low}
        height={12}
        rx={6}
        className="fill-brand-200"
      />
      <rect
        x={low - 1.5}
        y={y - 16}
        width={3}
        height={32}
        rx={1.5}
        className="fill-primary"
      />
      <rect
        x={high - 1.5}
        y={y - 16}
        width={3}
        height={32}
        rx={1.5}
        className="fill-primary"
      />
      <circle
        cx={mid}
        cy={y}
        r={8}
        className="fill-primary stroke-surface"
        strokeWidth="3"
      />
    </Pictogram>
  );
}

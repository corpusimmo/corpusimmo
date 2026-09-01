import { ArrowRight, DiagramFigure, type DiagramProps } from "./frame";

/**
 * LA PONDÉRATION : MOYENNE GÉOMÉTRIQUE, PUIS PLAFOND DE DOMINANCE.
 *
 * Deux mécaniques que rien n’oblige à comprendre pour utiliser le produit, mais
 * que tout professionnel qui conteste un chiffre demandera. Le schéma existe
 * pour ne pas avoir à écrire une formule dans une page marketing.
 *
 * FIDÉLITÉ — exposants réels (`SCORE_EXPONENTS` : 0,35 / 0,25 / 0,25 / 0,15) et
 * plafond réel (`MAX_SINGLE_COMPARABLE_WEIGHT` = 0,4). Les deux exemples
 * chiffrés sont CALCULÉS, pas inventés :
 *
 *   0,86^0,35 × 0,74^0,25 × 0,55^0,25 × 0,70^0,15 = 0,72
 *   0,08^0,35 × 1,00^0,25 × 0,90^0,25 × 1,00^0,15 = 0,40
 *   la même ligne en moyenne ARITHMÉTIQUE pondérée donnerait 0,65
 *
 * C’est ce dernier écart qui justifie le choix : la vente lointaine mais récente
 * remonterait dans le classement avec une moyenne, elle ne remonte pas avec un
 * produit.
 */

const SUB_SCORES = [
  { label: "Distance", score: 0.86, exponent: "0,35" },
  { label: "Récence", score: 0.74, exponent: "0,25" },
  { label: "Surface", score: 0.55, exponent: "0,25" },
  { label: "Typologie", score: 0.7, exponent: "0,15" },
] as const;

const BAR_X = 142;
const BAR_W = 180;

/** Le même comparable, avant et après le plafond. La somme fait 100 des deux côtés. */
const BEFORE = [62, 14, 10, 8, 6] as const;
const AFTER = [40, 22, 16, 13, 9] as const;
const STACK_X = 150;
const STACK_W = 500;

export function WeightingDiagram({ className, caption = true }: DiagramProps) {
  return (
    <DiagramFigure
      className={className}
      viewBox="0 0 680 400"
      title="La pondération : moyenne géométrique et plafond de dominance"
      description={
        "En haut, quatre sous-scores compris entre 0 et 1 (distance, récence, surface, " +
        "typologie) sont combinés par une moyenne géométrique pondérée d’exposants 0,35, " +
        "0,25, 0,25 et 0,15, qui donne le poids du comparable. En bas, la répartition des " +
        "poids avant et après le plafond de 40 pour cent : le comparable dominant tombe de " +
        "62 à 40 pour cent et son excédent est redistribué sur les quatre autres."
      }
      caption={
        caption ? (
          <>
            La moyenne est géométrique, jamais arithmétique&nbsp;: un sous-score proche de zéro
            écrase le poids final au lieu d’être racheté par les autres. Le plafond de 40&nbsp;% est
            une exigence de secret statistique&nbsp;: sans lui, une « valeur de marché » pourrait
            n’être, en pratique, que le prix d’une seule vente. Les valeurs affichées sont un
            exemple&nbsp;; les exposants et le plafond, eux, sont ceux du moteur.
          </>
        ) : null
      }
    >
      {/* ================= Bloc 1 : la moyenne géométrique ================= */}
      <text x={16} y={26} fontSize="9.5" letterSpacing="1.1" className="fill-accent">
        MOYENNE GÉOMÉTRIQUE PONDÉRÉE
      </text>

      <text x={356} y={38} textAnchor="end" fontSize="9" className="fill-ink-subtle">
        sous-score
      </text>
      <text x={388} y={38} fontSize="9" textAnchor="middle" className="fill-ink-subtle">
        exposant
      </text>

      {SUB_SCORES.map((row, i) => {
        const y = 58 + i * 30;
        return (
          <g key={row.label}>
            <text x={132} y={y + 4} textAnchor="end" fontSize="11.5" className="fill-ink">
              {row.label}
            </text>
            <rect x={BAR_X} y={y - 5} width={BAR_W} height={10} rx={4} className="fill-border-soft" />
            <rect
              x={BAR_X}
              y={y - 5}
              width={BAR_W * row.score}
              height={10}
              rx={4}
              className="fill-brand-300"
            />
            <text x={330} y={y + 4} fontSize="10.5" className="fill-ink-muted">
              {row.score.toFixed(2).replace(".", ",")}
            </text>
            <rect x={364} y={y - 11} width={48} height={22} rx={5} className="fill-accent-soft" />
            <text
              x={388}
              y={y + 4}
              textAnchor="middle"
              fontSize="10"
              className="fill-accent-soft-fg"
            >
              {row.exponent}
            </text>
          </g>
        );
      })}

      {/* L’accolade qui rassemble les quatre lignes, puis la flèche vers le poids. */}
      <path
        d="M424 50 h10 v108 h-10"
        fill="none"
        strokeWidth="1.5"
        className="stroke-border-strong"
      />
      <ArrowRight x1={434} y={104} x2={470} />

      <rect
        x={478}
        y={72}
        width={186}
        height={64}
        rx={10}
        className="fill-surface stroke-border"
        strokeWidth="1"
      />
      <text x={571} y={96} textAnchor="middle" fontSize="10.5" className="fill-ink-muted">
        Poids du comparable
      </text>
      <text
        x={571}
        y={122}
        textAnchor="middle"
        fontSize="20"
        fontWeight="600"
        className="fill-ink"
      >
        0,72
      </text>

      {/* Le contre-exemple, qui est la vraie raison du choix de méthode. */}
      <rect x={8} y={168} width={664} height={44} rx={8} className="fill-surface-2" />
      <text x={20} y={186} fontSize="10.5" className="fill-ink-muted">
        Une vente à 4 km mais très récente&nbsp;: 0,65 en moyenne arithmétique, 0,40 en géométrique.
      </text>
      <text x={20} y={202} fontSize="10.5" className="fill-ink-muted">
        Un sous-score proche de zéro écrase le poids final. Il ne se rachète pas.
      </text>

      {/* ================= Bloc 2 : le plafond de dominance ================ */}
      <line x1={8} y1={228} x2={672} y2={228} className="stroke-border-soft" />
      <text x={16} y={252} fontSize="9.5" letterSpacing="1.1" className="fill-accent">
        PLAFOND DE DOMINANCE, 40 %
      </text>

      <Stack y={274} label="sans plafond" shares={BEFORE} highlightFirst="danger" />
      <Stack y={322} label="après plafonnement" shares={AFTER} highlightFirst="accent" />

      {/* La verticale des 40 % traverse les deux barres : c’est elle qui rend
          le déplacement lisible d’un seul coup d’œil. */}
      <line
        x1={STACK_X + STACK_W * 0.4}
        y1={264}
        x2={STACK_X + STACK_W * 0.4}
        y2={360}
        strokeDasharray="3 3"
        className="stroke-ink-subtle"
      />
      <text
        x={STACK_X + STACK_W * 0.4}
        y={260}
        textAnchor="middle"
        fontSize="10"
        className="fill-ink-muted"
      >
        40 %
      </text>

      <text x={STACK_X} y={382} fontSize="10.5" className="fill-ink-subtle">
        L’excédent est redistribué sur les autres comparables, jamais supprimé.
      </text>
    </DiagramFigure>
  );
}

function Stack({
  y,
  label,
  shares,
  highlightFirst,
}: {
  y: number;
  label: string;
  shares: readonly number[];
  highlightFirst: "danger" | "accent";
}) {
  let cursor = STACK_X;
  return (
    <g>
      <text x={140} y={y + 17} textAnchor="end" fontSize="11" className="fill-ink-muted">
        {label}
      </text>
      {shares.map((share, i) => {
        const width = (share / 100) * STACK_W;
        const x = cursor;
        cursor += width;
        const fill =
          i > 0
            ? "fill-brand-200"
            : highlightFirst === "danger"
              ? "fill-danger-soft"
              : "fill-accent-rule";
        return (
          <g key={`${label}${share}${i}`}>
            <rect x={x} y={y} width={width} height={26} className={fill} />
            <rect x={x} y={y} width={1.5} height={26} className="fill-surface" />
            <text
              x={x + width / 2}
              y={y + 17}
              textAnchor="middle"
              fontSize="9.5"
              className={i === 0 ? "fill-ink" : "fill-ink-muted"}
            >
              {share} %
            </text>
          </g>
        );
      })}
    </g>
  );
}

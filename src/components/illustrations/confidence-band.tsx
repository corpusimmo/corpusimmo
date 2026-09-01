import { DiagramFigure, type DiagramProps } from "./frame";

/**
 * COMMENT LIRE UNE FOURCHETTE ET UN SCORE DE CONFIANCE.
 *
 * Le schéma qui accompagne un résultat. Il répond à la seule question que pose
 * un utilisateur devant trois chiffres et une jauge : « pourquoi cette
 * fourchette-là, et pourquoi ce score-là ? »
 *
 * FIDÉLITÉ — la demi-largeur réelle vaut
 * 0,03 (base) + 0,50 × dispersion + 0,09 × rareté + 0,04 × ancienneté, bornée
 * entre ±5 % et ±22 % (`RANGE` dans `engine.ts`). Les seuils de niveau
 * (45 et 70) et les quatre plafonds durs viennent de `confidence.ts`.
 * La décomposition dessinée illustre une demi-largeur de 11 % ; les autres
 * chiffres sont les vrais.
 */

const AXIS_X1 = 60;
const AXIS_X2 = 620;
const AXIS_W = AXIS_X2 - AXIS_X1;

/** Décomposition d’exemple d’une demi-largeur de 11 %. */
const PARTS = [
  { label: "3 %", points: 3 },
  { label: "5 %", points: 5 },
  { label: "2 %", points: 2 },
  { label: "1 %", points: 1 },
] as const;
const PARTS_X1 = 210;
const PARTS_X2 = 470;

/** Les trois niveaux, aux seuils réels de `LEVEL_THRESHOLDS`. */
const ZONES = [
  { from: 0, to: 45, label: "faible", fill: "fill-danger-soft" },
  { from: 45, to: 70, label: "modérée", fill: "fill-warning-soft" },
  { from: 70, to: 100, label: "élevée", fill: "fill-success-soft" },
] as const;

const EXAMPLE_SCORE = 63;

function scoreX(score: number) {
  return AXIS_X1 + (score / 100) * AXIS_W;
}

export function ConfidenceBand({ className, caption = true }: DiagramProps) {
  const needleX = scoreX(EXAMPLE_SCORE);
  return (
    <DiagramFigure
      className={className}
      viewBox="0 0 680 352"
      title="Lire une fourchette et un score de confiance"
      description={
        "En haut, une fourchette d’estimation : borne basse, valeur centrale, borne haute. " +
        "Sa demi-largeur va de plus ou moins 5 pour cent à plus ou moins 22 pour cent et se " +
        "compose d’une base de 3 pour cent, de la dispersion des prix, de la rareté des " +
        "ventes et de leur ancienneté. En bas, le score de confiance sur 100, découpé en " +
        "trois niveaux : faible sous 45, modérée de 45 à 69, élevée à partir de 70."
      }
      caption={
        caption ? (
          <>
            La largeur de la fourchette est une propriété de la DONNÉE, pas une marge décorative
            de ±8&nbsp;%&nbsp;: un échantillon serré, récent et abondant gagne une fourchette
            étroite, un échantillon dispersé est honnêtement rapporté comme large. La
            décomposition dessinée est un exemple à ±11&nbsp;%&nbsp;; les bornes, les seuils de
            niveau et les plafonds sont ceux du moteur.
          </>
        ) : null
      }
    >
      {/* ==================== La fourchette ==================== */}
      <text x={16} y={28} fontSize="9.5" letterSpacing="1.1" className="fill-accent">
        LIRE UNE FOURCHETTE
      </text>

      <rect x={AXIS_X1} y={101} width={AXIS_W} height={6} rx={3} className="fill-border-soft" />
      <rect x={210} y={96} width={260} height={16} rx={8} className="fill-brand-200" />
      <rect x={208.5} y={88} width={2.5} height={32} className="fill-primary" />
      <rect x={468.5} y={88} width={2.5} height={32} className="fill-primary" />
      <circle cx={340} cy={104} r={9} className="fill-primary stroke-surface" strokeWidth="3" />

      <text x={210} y={78} textAnchor="middle" fontSize="10.5" className="fill-ink-muted">
        borne basse
      </text>
      <text x={340} y={72} textAnchor="middle" fontSize="11" fontWeight="600" className="fill-ink">
        valeur centrale
      </text>
      <text x={470} y={78} textAnchor="middle" fontSize="10.5" className="fill-ink-muted">
        borne haute
      </text>

      {/* La double flèche qui mesure la largeur. */}
      <g className="stroke-ink-subtle" strokeWidth="1.2">
        <line x1={216} y1={134} x2={464} y2={134} />
        <polygon points="210,134 218,130.6 218,137.4" className="fill-ink-subtle stroke-none" />
        <polygon points="470,134 462,130.6 462,137.4" className="fill-ink-subtle stroke-none" />
      </g>
      <text x={340} y={152} textAnchor="middle" fontSize="10.5" className="fill-ink-muted">
        de ±5 % à ±22 %, selon ce que vaut l’échantillon
      </text>

      {/* La décomposition de la demi-largeur. */}
      <Parts />
      <text x={340} y={200} textAnchor="middle" fontSize="10" className="fill-ink-subtle">
        base + dispersion + rareté + ancienneté
      </text>

      {/* ==================== Le score ==================== */}
      <line x1={8} y1={214} x2={672} y2={214} className="stroke-border-soft" />
      <text x={16} y={240} fontSize="9.5" letterSpacing="1.1" className="fill-accent">
        LIRE UN SCORE DE CONFIANCE
      </text>

      {ZONES.map((zone) => {
        const x1 = scoreX(zone.from) + (zone.from === 0 ? 0 : 2);
        const x2 = scoreX(zone.to) - (zone.to === 100 ? 0 : 2);
        return (
          <g key={zone.label}>
            <rect x={x1} y={264} width={x2 - x1} height={16} rx={3} className={zone.fill} />
            <text
              x={(x1 + x2) / 2}
              y={298}
              textAnchor="middle"
              fontSize="10.5"
              className="fill-ink-muted"
            >
              {zone.label}
            </text>
          </g>
        );
      })}

      {[0, 45, 70, 100].map((tick) => (
        <text
          key={tick}
          x={scoreX(tick)}
          y={257}
          textAnchor="middle"
          fontSize="9.5"
          className="fill-ink-subtle"
        >
          {tick}
        </text>
      ))}

      {/* L’aiguille : un score d’exemple, posé dans la zone « modérée ». */}
      <line x1={needleX} y1={262} x2={needleX} y2={286} strokeWidth="2" className="stroke-ink" />
      <text
        x={needleX}
        y={241}
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        className="fill-ink"
      >
        {EXAMPLE_SCORE} / 100
      </text>

      <text x={16} y={324} fontSize="10" className="fill-ink-subtle">
        Plafonds durs, que l’arithmétique ne peut pas franchir&nbsp;: 55 sous 6 ventes retenues,
      </text>
      <text x={16} y={340} fontSize="10" className="fill-ink-subtle">
        55 si les prix sont trop dispersés, 65 si l’échantillon est vieux, 60 en immobilier
        d’entreprise.
      </text>
    </DiagramFigure>
  );
}

function Parts() {
  const total = PARTS.reduce((sum, part) => sum + part.points, 0);
  const span = PARTS_X2 - PARTS_X1;
  let cursor = PARTS_X1;
  return (
    <g>
      {PARTS.map((part, i) => {
        const width = (part.points / total) * span;
        const x = cursor;
        cursor += width;
        return (
          <g key={part.label}>
            <rect
              x={x}
              y={168}
              width={width}
              height={14}
              className={i === 1 ? "fill-brand-300" : "fill-brand-100"}
            />
            <rect x={x} y={168} width={1.5} height={14} className="fill-surface" />
            <text
              x={x + width / 2}
              y={179}
              textAnchor="middle"
              fontSize="9"
              className="fill-ink-muted"
            >
              {part.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

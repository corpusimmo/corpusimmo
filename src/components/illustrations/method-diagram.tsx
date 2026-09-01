import type { ReactNode } from "react";

import { ArrowRight, DiagramFigure, type DiagramProps } from "./frame";

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
 */

/** Les quatre colonnes. Une seule source pour le dessin ET pour la description. */
const COLUMN_X = [6, 180, 354, 528] as const;
const COLUMN_W = 146;

export function MethodDiagram({ className, caption = true }: DiagramProps) {
  return (
    <DiagramFigure
      className={className}
      viewBox="0 0 680 250"
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
            Schéma simplifié. Entre les étapes 2 et 3, le moteur écarte encore les prix au
            m<sup>2</sup> aberrants (bornes de Tukey à 1,5 fois l’écart interquartile, plus des
            garde-fous absolus), et l’étape 4 applique des ajustements plafonnés à ±12&nbsp;% pour
            ce que DVF ne publie pas&nbsp;: état, étage, extérieur, stationnement. Sous 5 ventes
            retenues, aucune fourchette n’est publiée.
          </>
        ) : null
      }
    >
      {/* Les quatre panneaux, puis les trois flèches qui les relient. */}
      <Panel index={0} step="1" title="Le bien" lines={["Type, surface,", "adresse géocodée."]}>
        <Subject cx={COLUMN_X[0] + COLUMN_W / 2} cy={121} />
      </Panel>

      <Panel
        index={1}
        step="2"
        title="Les ventes"
        lines={["Ventes DVF de moins", "de 60 mois, surface", "à ±30 %."]}
      >
        <Sales cx={COLUMN_X[1] + COLUMN_W / 2} cy={121} />
      </Panel>

      <Panel
        index={2}
        step="3"
        title="La pondération"
        lines={["Distance, récence,", "surface, typologie."]}
      >
        <Weights x={COLUMN_X[2] + 18} />
      </Panel>

      <Panel
        index={3}
        step="4"
        title="La fourchette"
        lines={["Prix au m² pondéré", "× la surface, puis", "ajustements ±12 %."]}
      >
        <Bracket x={COLUMN_X[3] + 22} />
      </Panel>

      <ArrowRight x1={157} y={125} x2={175} />
      <ArrowRight x1={331} y={125} x2={349} />
      <ArrowRight x1={505} y={125} x2={523} />
    </DiagramFigure>
  );
}

function Panel({
  index,
  step,
  title,
  lines,
  children,
}: {
  index: number;
  step: string;
  title: string;
  lines: string[];
  children: ReactNode;
}) {
  const x = COLUMN_X[index] ?? 0;
  return (
    <g>
      <rect
        x={x}
        y={10}
        width={COLUMN_W}
        height={230}
        rx={10}
        className="fill-surface stroke-border"
        strokeWidth="1"
      />
      <circle cx={x + 24} cy={36} r={11} className="fill-accent-soft" />
      <text
        x={x + 24}
        y={36}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="600"
        className="fill-accent-soft-fg"
      >
        {step}
      </text>
      <text x={x + 42} y={40} fontSize="12" fontWeight="600" className="fill-ink">
        {title}
      </text>
      <line x1={x + 14} y1={56} x2={x + COLUMN_W - 14} y2={56} className="stroke-border-soft" />

      {children}

      {lines.map((line, i) => (
        <text key={line} x={x + 14} y={196 + i * 14} fontSize="10" className="fill-ink-subtle">
          {line}
        </text>
      ))}
    </g>
  );
}

/**
 * Le bien étudié, dessiné dans la grammaire du logotype : un toit, deux murs,
 * et la ligne bronze qui sert de sol. La marque se retrouve dans les schémas.
 */
function Subject({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path
        d={`M${cx - 19} ${cy - 2} L${cx} ${cy - 20} L${cx + 19} ${cy - 2}`}
        className="stroke-primary"
        strokeWidth="2"
      />
      <path
        d={`M${cx - 13} ${cy - 2} v20 M${cx + 13} ${cy - 2} v20`}
        className="stroke-primary"
        strokeWidth="2"
      />
      <path d={`M${cx - 24} ${cy + 24} h48`} className="stroke-accent-rule" strokeWidth="2.5" />
    </g>
  );
}

/** Les ventes candidates : celles qu’on garde, celles qu’on écarte. */
const RETAINED = [
  [-30, -22],
  [18, -30],
  [34, 10],
  [-14, 32],
  [26, 30],
  [-36, 6],
] as const;

const REJECTED = [
  [44, -24],
  [-8, -40],
  [12, 42],
] as const;

function Sales({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={46}
        fill="none"
        strokeDasharray="3 3"
        className="stroke-border-strong"
      />
      {RETAINED.map(([dx, dy]) => (
        <circle key={`k${dx}${dy}`} cx={cx + dx} cy={cy + dy} r={4.5} className="fill-accent" />
      ))}
      {REJECTED.map(([dx, dy]) => (
        <g key={`r${dx}${dy}`} className="stroke-ink-subtle" strokeWidth="1.4" strokeLinecap="round">
          <line x1={cx + dx - 3.4} y1={cy + dy - 3.4} x2={cx + dx + 3.4} y2={cy + dy + 3.4} />
          <line x1={cx + dx + 3.4} y1={cy + dy - 3.4} x2={cx + dx - 3.4} y2={cy + dy + 3.4} />
        </g>
      ))}
      {/* Le bien étudié, au centre : un losange, pour ne jamais le confondre
          avec une vente. */}
      <path
        d={`M${cx} ${cy - 7} L${cx + 7} ${cy} L${cx} ${cy + 7} L${cx - 7} ${cy} Z`}
        className="fill-primary"
      />
    </g>
  );
}

/** Les poids, du plus lourd au plus léger, et le plafond qui coupe le premier. */
const WEIGHT_BARS = [0.4, 0.24, 0.15, 0.12, 0.09] as const;
const WEIGHT_SCALE = 250;

function Weights({ x }: { x: number }) {
  const capX = x + WEIGHT_SCALE * 0.4;
  return (
    <g>
      {WEIGHT_BARS.map((weight, i) => (
        <rect
          key={weight}
          x={x}
          y={80 + i * 18}
          width={weight * WEIGHT_SCALE}
          height={10}
          rx={3}
          className={i === 0 ? "fill-accent-rule" : "fill-brand-300"}
        />
      ))}
      <line
        x1={capX}
        y1={72}
        x2={capX}
        y2={166}
        strokeDasharray="3 3"
        className="stroke-ink-subtle"
      />
      <text x={capX + 12} y={177} textAnchor="end" fontSize="9.5" className="fill-ink-subtle">
        plafond 40 %
      </text>
    </g>
  );
}

/** La fourchette : le composant signature du produit, réduit à son squelette. */
function Bracket({ x }: { x: number }) {
  const low = x + 22;
  const high = x + 80;
  const mid = (low + high) / 2;
  return (
    <g>
      <rect x={x} y={115} width={102} height={6} rx={3} className="fill-border-soft" />
      <rect x={low} y={113} width={high - low} height={10} rx={5} className="fill-brand-200" />
      <rect x={low - 1} y={108} width={2} height={20} className="fill-primary" />
      <rect x={high - 1} y={108} width={2} height={20} className="fill-primary" />
      <circle cx={mid} cy={118} r={6.5} className="fill-primary stroke-surface" strokeWidth="2.5" />
      <text x={mid} y={102} textAnchor="middle" fontSize="9.5" className="fill-ink-muted">
        valeur centrale
      </text>
      {/* Les deux bornes sont décalées d’une ligne : côte à côte, elles se
          touchent dans une colonne de 146 unités, et « bornebasse borne haute »
          se lit comme un seul mot. */}
      <text x={low} y={146} textAnchor="middle" fontSize="9.5" className="fill-ink-subtle">
        borne basse
      </text>
      <text x={high} y={162} textAnchor="middle" fontSize="9.5" className="fill-ink-subtle">
        borne haute
      </text>
    </g>
  );
}

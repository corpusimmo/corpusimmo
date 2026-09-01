import { DiagramFigure, type DiagramProps } from "./frame";

/**
 * LE BILAN PROMOTEUR, LU À L’ENVERS.
 *
 * La bonne question n’est pas « ce terrain vaut-il son prix ? » mais « combien
 * puis-je le payer pour que l’opération tienne ma marge ? ». Le schéma dessine
 * exactement cette lecture : on part du chiffre d’affaires, on retranche, et ce
 * qui reste au bout est la charge foncière admissible.
 *
 * La cascade descend de gauche à droite dans le RESTE : chaque barre commence
 * là où la précédente s’est arrêtée. C’est ce qui rend visible qu’aucun poste
 * n’est un coût « à côté » du terrain : ils se servent tous AVANT lui.
 *
 * Les pourcentages sont un exemple d’opération, pas une référence de marché.
 */

/** Poste par poste, en % du chiffre d’affaires. Le reste tombe pour le foncier. */
const STEPS = [
  { label: "Chiffre d’affaires prévisionnel", share: 100 },
  { label: "Coût de construction", share: 46 },
  { label: "Honoraires et études", share: 9 },
  { label: "Frais financiers", share: 5 },
  { label: "Frais de commercialisation", share: 5 },
  { label: "Marge visée", share: 12 },
] as const;

const LAND_SHARE = 100 - STEPS.slice(1).reduce((sum, step) => sum + step.share, 0);

const X0 = 220;
const X1 = 660;
const SCALE = (X1 - X0) / 100;

/** Ordonnée du haut de chaque barre. La dernière est décalée : c’est le résultat. */
const ROW_Y = [54, 94, 134, 174, 214, 254, 302] as const;
const BAR_H = 22;

export function DeveloperBalance({ className, caption = true }: DiagramProps) {
  // Le reste après chaque poste, qui donne les bornes de chaque barre.
  const remaining: number[] = [100];
  for (const step of STEPS.slice(1)) {
    remaining.push((remaining[remaining.length - 1] ?? 100) - step.share);
  }

  return (
    <DiagramFigure
      className={className}
      viewBox="0 0 680 372"
      title="Le bilan promoteur, lu du chiffre d’affaires vers la charge foncière"
      description={
        "Une cascade en pourcentage du chiffre d’affaires prévisionnel. On retranche " +
        "successivement 46 pour cent de coût de construction, 9 pour cent d’honoraires et " +
        "d’études, 5 pour cent de frais financiers, 5 pour cent de frais de commercialisation " +
        "et 12 pour cent de marge visée. Il reste 23 pour cent : c’est la charge foncière " +
        "admissible, c’est-à-dire le prix maximal que le terrain peut coûter."
      }
      caption={
        caption ? (
          <>
            Proportions d’exemple, sans valeur de référence&nbsp;: chaque opération a les siennes.
            Le modèle raisonne sur une opération unique et un phasage simple&nbsp;; il n’intègre ni
            la TVA sur marge, ni les participations d’urbanisme locales, ni le risque de recours
            contre le permis.
          </>
        ) : null
      }
    >
      <text x={16} y={30} fontSize="9.5" letterSpacing="1.1" className="fill-accent">
        ON PART DU CHIFFRE D’AFFAIRES, PAS DU PRIX DU TERRAIN
      </text>
      <text x={660} y={30} textAnchor="end" fontSize="9.5" className="fill-ink-subtle">
        en % du chiffre d’affaires
      </text>

      {STEPS.map((step, i) => {
        const y = ROW_Y[i] ?? 0;
        const before = remaining[i - 1] ?? 100;
        const after = remaining[i] ?? 100;
        const barX1 = i === 0 ? X0 : X0 + after * SCALE;
        const barX2 = i === 0 ? X1 : X0 + before * SCALE;
        return (
          <g key={step.label}>
            <text x={206} y={y + 15} textAnchor="end" fontSize="11.5" className="fill-ink">
              {step.label}
            </text>
            <rect
              x={barX1}
              y={y}
              width={barX2 - barX1}
              height={BAR_H}
              rx={3}
              className={i === 0 ? "fill-brand-200" : "fill-brand-100 stroke-border"}
              strokeWidth={i === 0 ? 0 : 1}
            />
            {i === 0 ? (
              <text x={X1 - 10} y={y + 15} textAnchor="end" fontSize="10.5" className="fill-ink-muted">
                100 %
              </text>
            ) : (
              <text x={barX1 - 8} y={y + 15} textAnchor="end" fontSize="10.5" className="fill-ink-muted">
                {step.share} %
              </text>
            )}
            {/* Le fil qui relie un poste au suivant : il montre que le reste se
                réduit, et jamais que les coûts s’additionnent ailleurs. */}
            <line
              x1={i === 0 ? X1 : barX1}
              y1={y + BAR_H}
              x2={i === 0 ? X1 : barX1}
              y2={ROW_Y[i + 1] ?? y}
              strokeDasharray="3 2"
              className="stroke-border-strong"
            />
          </g>
        );
      })}

      {/* Le résultat : la seule barre en bronze, la seule ancrée à zéro. */}
      <text x={206} y={ROW_Y[6] + 15} textAnchor="end" fontSize="11.5" fontWeight="600" className="fill-ink">
        Charge foncière admissible
      </text>
      <rect
        x={X0}
        y={ROW_Y[6]}
        width={LAND_SHARE * SCALE}
        height={BAR_H}
        rx={3}
        className="fill-accent-soft stroke-accent"
        strokeWidth="1.5"
      />
      <text
        x={X0 + LAND_SHARE * SCALE + 8}
        y={ROW_Y[6] + 15}
        fontSize="11"
        fontWeight="600"
        className="fill-accent-soft-fg"
      >
        {LAND_SHARE} %
      </text>
      <line
        x1={X0}
        y1={ROW_Y[6] + BAR_H + 12}
        x2={X0 + LAND_SHARE * SCALE}
        y2={ROW_Y[6] + BAR_H + 12}
        strokeWidth="2.5"
        className="stroke-accent-rule"
      />
      <text x={X0} y={ROW_Y[6] + BAR_H + 30} fontSize="10.5" className="fill-accent">
        ce qui reste pour le terrain
      </text>
    </DiagramFigure>
  );
}

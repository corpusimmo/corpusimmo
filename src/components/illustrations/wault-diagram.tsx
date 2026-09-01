import { DiagramFigure, type DiagramProps } from "./frame";

/**
 * LE WAULT, ET LE MUR D’ÉCHÉANCES QU’UNE MOYENNE PEUT CACHER.
 *
 * Une durée moyenne pondérée de six ans rassure. Le schéma montre qu’elle peut
 * décrire un portefeuille dont 42 % des loyers tombent dans trois ans : la
 * moyenne ne dit rien de la CONCENTRATION, et c’est la concentration qui fait
 * le risque locatif.
 *
 * Les chiffres sont un exemple cohérent, calculé et vérifiable :
 *   0,42×3 + 0,20×8 + 0,16×9 + 0,12×8 + 0,10×7 = 5,96 ans
 * arrondi à 6,0 ans dans le dessin.
 */

const AXIS_X = 214;
const YEAR_W = 43.6;
const MAX_YEAR = 10;

function yearX(year: number) {
  return AXIS_X + year * YEAR_W;
}

const LEASES = [
  { name: "Locataire A", share: 42, end: 3, thickness: 22 },
  { name: "Locataire B", share: 20, end: 8, thickness: 12 },
  { name: "Locataire C", share: 16, end: 9, thickness: 10 },
  { name: "Locataire D", share: 12, end: 8, thickness: 8 },
  { name: "Locataire E", share: 10, end: 7, thickness: 7 },
] as const;

const WAULT = 5.96;

/** L’échéancier reconstruit depuis les baux : c’est la même donnée, autrement. */
const WALL = [
  { year: 3, share: 42 },
  { year: 7, share: 10 },
  { year: 8, share: 32 },
  { year: 9, share: 16 },
] as const;

const BASELINE = 368;
const WALL_SCALE = 2;

export function WaultDiagram({ className, caption = true }: DiagramProps) {
  return (
    <DiagramFigure
      className={className}
      viewBox="0 0 680 392"
      title="Le WAULT et le mur d’échéances qu’une moyenne peut cacher"
      description={
        "En haut, cinq baux représentés par des barres dont l’épaisseur suit le poids du " +
        "locataire dans les loyers : le locataire A pèse 42 pour cent et son bail s’arrête " +
        "dans 3 ans, les quatre autres courent de 7 à 9 ans. La moyenne pondérée, le WAULT, " +
        "vaut 6,0 ans. En bas, l’échéancier réel montre que 42 pour cent des loyers arrivent " +
        "à échéance la même année, dans 3 ans."
      }
      caption={
        caption ? (
          <>
            Exemple illustratif. Le WAULT dessiné est celui jusqu’à la fin des baux&nbsp;; un
            portefeuille français se lit aussi jusqu’à la prochaine option de sortie triennale, qui
            raccourcit souvent la moyenne de plusieurs années. Le calcul suppose des loyers fixes
            et n’intègre ni franchises, ni paliers, ni loyers variables.
          </>
        ) : null
      }
    >
      <text x={16} y={30} fontSize="9.5" letterSpacing="1.1" className="fill-accent">
        LES BAUX, PONDÉRÉS PAR LEUR LOYER
      </text>

      {/* La verticale du WAULT traverse le bloc des baux : c’est la moyenne,
          posée au milieu de ce qu’elle résume. */}
      <line
        x1={yearX(WAULT)}
        y1={44}
        x2={yearX(WAULT)}
        y2={218}
        strokeDasharray="4 3"
        strokeWidth="1.5"
        className="stroke-ink"
      />
      <text
        x={yearX(WAULT)}
        y={38}
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        className="fill-ink"
      >
        WAULT 6,0 ans
      </text>

      {LEASES.map((lease, i) => {
        const y = 62 + i * 34;
        const end = yearX(lease.end);
        const dominant = i === 0;
        return (
          <g key={lease.name}>
            <text x={206} y={y + 4} textAnchor="end" fontSize="11" className="fill-ink">
              {lease.name}
            </text>
            <rect
              x={AXIS_X}
              y={y - lease.thickness / 2}
              width={end - AXIS_X}
              height={lease.thickness}
              rx={3}
              className={dominant ? "fill-accent-rule" : "fill-brand-200"}
            />
            <text
              x={end + 8}
              y={y + 4}
              fontSize="9.5"
              className={dominant ? "fill-accent" : "fill-ink-muted"}
            >
              {dominant ? `${lease.share} % des loyers` : `${lease.share} %`}
            </text>
          </g>
        );
      })}

      {/* L’axe du temps, partagé par les deux blocs : c’est ce partage qui fait
          la démonstration. La même abscisse, deux lectures. */}
      <line x1={AXIS_X} y1={226} x2={yearX(MAX_YEAR) + 6} y2={226} className="stroke-border-strong" />
      {Array.from({ length: MAX_YEAR + 1 }, (_, year) => year).map((year) => (
        <g key={year}>
          <line x1={yearX(year)} y1={226} x2={yearX(year)} y2={231} className="stroke-border-strong" />
          {year % 2 === 0 ? (
            <text
              x={yearX(year)}
              y={244}
              textAnchor="middle"
              fontSize="9.5"
              className="fill-ink-subtle"
            >
              {year}
            </text>
          ) : null}
        </g>
      ))}
      <text
        x={yearX(MAX_YEAR) + 6}
        y={262}
        textAnchor="end"
        fontSize="10"
        className="fill-ink-subtle"
      >
        années jusqu’à l’échéance
      </text>

      <text x={16} y={292} fontSize="9.5" letterSpacing="1.1" className="fill-accent">
        L’ÉCHÉANCIER RÉEL
      </text>
      <text x={206} y={330} textAnchor="end" fontSize="10" className="fill-ink-subtle">
        Part du loyer qui
      </text>
      <text x={206} y={344} textAnchor="end" fontSize="10" className="fill-ink-subtle">
        arrive à échéance
      </text>

      {WALL.map((column) => {
        const height = column.share * WALL_SCALE;
        const x = yearX(column.year);
        const wall = column.share >= 40;
        return (
          <g key={column.year}>
            {/* Le repère vertical s’arrête au-dessus de la valeur : il relie les
                deux lectures sans traverser le texte. */}
            <line
              x1={x}
              y1={232}
              x2={x}
              y2={BASELINE - height - 22}
              strokeDasharray="2 4"
              className="stroke-border"
            />
            <rect
              x={x - 15}
              y={BASELINE - height}
              width={30}
              height={height}
              rx={2}
              className={wall ? "fill-accent-rule" : "fill-brand-200"}
            />
            <text
              x={x}
              y={BASELINE - height - 8}
              textAnchor="middle"
              fontSize="10"
              fontWeight={wall ? 600 : 400}
              className={wall ? "fill-accent" : "fill-ink-muted"}
            >
              {column.share} %
            </text>
          </g>
        );
      })}

      <text
        x={yearX(3)}
        y={BASELINE - 42 * WALL_SCALE - 24}
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="600"
        className="fill-accent"
      >
        le mur d’échéances
      </text>

      <line x1={AXIS_X} y1={BASELINE} x2={yearX(MAX_YEAR) + 6} y2={BASELINE} className="stroke-border-strong" />
    </DiagramFigure>
  );
}

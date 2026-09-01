import { DiagramFigure, type DiagramProps } from "./frame";

/**
 * L’ESCALADE DE RAYON.
 *
 * Le moteur ne cherche pas dans un rayon fixe : il part de 500 m et n’élargit
 * que s’il n’a pas assez de matière. C’est la seule étape où l’utilisateur peut
 * voir que « pas de réponse » est une réponse possible, et le schéma doit le
 * dire aussi clairement que le reste.
 *
 * FIDÉLITÉ — tout ce qui est écrit ici sort de `src/lib/valuation/` :
 * `SEARCH_RADII_METERS` = [500, 1000, 2000, 5000], `TARGET_COMPARABLES` = 8,
 * `DENSE_MARKET_CANDIDATES` = 120, `MIN_COMPARABLES` = 5. Les nombres de ventes
 * par palier, eux, sont un EXEMPLE : ils dépendent du secteur, et la légende le
 * dit.
 */

/** Centre des cercles, et rayons DESSINÉS (non proportionnels aux mètres). */
const CX = 150;
const CY = 172;
const RINGS = [
  { radius: 32, label: "500 m" },
  { radius: 60, label: "1 km" },
  { radius: 96, label: "2 km" },
  { radius: 140, label: "5 km" },
] as const;

/** Le palier retenu dans l’exemple : celui qui atteint les 8 ventes. */
const STOP_AT = 2;

const ROWS = [
  { radius: "500 m", kept: "3", decision: "trop peu, on élargit" },
  { radius: "1 km", kept: "6", decision: "moins de 8, on élargit" },
  { radius: "2 km", kept: "9", decision: "on s’arrête ici" },
  { radius: "5 km", kept: "·", decision: "rayon non utilisé" },
] as const;

/** Ventes d’exemple : leur position sert à peupler les couronnes, rien de plus. */
const SALES = [
  [-18, -22],
  [26, -14],
  [-34, 20],
  [10, 30],
  [-56, -34],
  [62, 26],
  [-72, 38],
  [44, -58],
  [-20, 74],
  [80, -20],
  [-104, 26],
  [110, 52],
  [-46, -110],
] as const;

export function RadiusEscalation({ className, caption = true }: DiagramProps) {
  return (
    <DiagramFigure
      className={className}
      viewBox="0 0 680 330"
      title="L’escalade de rayon, de 500 mètres à 5 kilomètres"
      description={
        "Quatre cercles concentriques autour du bien : 500 mètres, 1 kilomètre, 2 kilomètres " +
        "et 5 kilomètres. Le moteur s’arrête au premier rayon qui produit assez de ventes " +
        "comparables. Dans cet exemple, 3 ventes à 500 mètres, 6 à 1 kilomètre, 9 à " +
        "2 kilomètres : la recherche s’arrête à 2 kilomètres et le rayon de 5 kilomètres " +
        "n’est jamais interrogé."
      }
      caption={
        caption ? (
          <>
            Les rayons ne sont pas dessinés à l’échelle et les nombres de ventes sont un exemple.
            Le seuil d’arrêt réel est de 8 ventes retenues, ramené à 5 quand le premier rayon
            rapporte déjà plus de 120 ventes candidates (marché dense&nbsp;: élargir échangerait de
            la proximité contre du volume). Si le dernier rayon lui-même reste sous 5 ventes
            retenues, le moteur ne publie aucun chiffre.
          </>
        ) : null
      }
    >
      {/* --- Les couronnes ---------------------------------------------- */}
      {RINGS.map((ring, i) => (
        <circle
          key={ring.label}
          cx={CX}
          cy={CY}
          r={ring.radius}
          fill="none"
          strokeWidth={i === STOP_AT ? 2.5 : 1}
          strokeDasharray={i === STOP_AT ? undefined : "4 4"}
          className={i === STOP_AT ? "stroke-accent-rule" : "stroke-border-strong"}
        />
      ))}

      {SALES.map(([dx, dy]) => {
        const inside = Math.hypot(dx, dy) <= 96;
        return (
          <circle
            key={`${dx}:${dy}`}
            cx={CX + dx}
            cy={CY + dy}
            r={inside ? 4.5 : 4}
            className={inside ? "fill-accent" : "fill-border-strong"}
          />
        );
      })}

      {/* Le bien étudié : un losange, jamais une vente. */}
      <path
        d={`M${CX} ${CY - 8} L${CX + 8} ${CY} L${CX} ${CY + 8} L${CX - 8} ${CY} Z`}
        className="fill-primary"
      />

      {/* Les libellés de couronne, posés sur la diagonale : c’est la seule
          direction où quatre étiquettes ne se marchent pas dessus. */}
      {RINGS.map((ring, i) => {
        const px = CX + ring.radius * 0.707;
        const py = CY - ring.radius * 0.707;
        return (
          <g key={`l${ring.label}`}>
            <circle cx={px} cy={py} r={2} className="fill-border-strong" />
            <text
              x={px + 7}
              y={py - 1}
              fontSize="11"
              fontWeight={i === STOP_AT ? 600 : 400}
              className={i === STOP_AT ? "fill-accent" : "fill-ink-subtle"}
            >
              {ring.label}
            </text>
          </g>
        );
      })}

      {/* --- Le tableau des paliers ------------------------------------- */}
      <text x={336} y={40} fontSize="9.5" letterSpacing="1.1" className="fill-accent">
        PALIER PAR PALIER
      </text>
      <line x1={320} y1={54} x2={672} y2={54} className="stroke-border" />
      <text x={336} y={70} fontSize="9.5" className="fill-ink-subtle">
        Rayon
      </text>
      <text x={452} y={70} fontSize="9.5" textAnchor="middle" className="fill-ink-subtle">
        Retenues
      </text>
      <text x={506} y={70} fontSize="9.5" className="fill-ink-subtle">
        Décision
      </text>

      {ROWS.map((row, i) => {
        const y = 100 + i * 40;
        const stopped = i === STOP_AT;
        const unused = i > STOP_AT;
        return (
          <g key={row.radius}>
            <line x1={320} y1={y - 20} x2={672} y2={y - 20} className="stroke-border-soft" />
            {stopped ? (
              <rect
                x={320}
                y={y - 20}
                width={352}
                height={40}
                rx={6}
                className="fill-accent-soft"
              />
            ) : null}
            <text
              x={336}
              y={y + 4}
              fontSize="12"
              fontWeight="600"
              className={unused ? "fill-ink-subtle" : "fill-ink"}
            >
              {row.radius}
            </text>
            <text
              x={452}
              y={y + 4}
              fontSize="12"
              textAnchor="middle"
              className={unused ? "fill-ink-subtle" : "fill-ink"}
            >
              {row.kept}
            </text>
            <text
              x={506}
              y={y + 4}
              fontSize="10.5"
              fontWeight={stopped ? 600 : 400}
              className={
                stopped ? "fill-accent-soft-fg" : unused ? "fill-ink-subtle" : "fill-ink-muted"
              }
            >
              {row.decision}
            </text>
          </g>
        );
      })}

      <line x1={320} y1={260} x2={672} y2={260} className="stroke-border-soft" />
      <text x={320} y={288} fontSize="10" className="fill-ink-subtle">
        Seuil d’arrêt&nbsp;: 8 ventes retenues. En marché dense
      </text>
      <text x={320} y={304} fontSize="10" className="fill-ink-subtle">
        (plus de 120 candidates dès 500 m), 5 retenues suffisent.
      </text>
    </DiagramFigure>
  );
}

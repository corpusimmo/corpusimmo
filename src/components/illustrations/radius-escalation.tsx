import { DiagramGroup, Pictogram, type DiagramProps } from "./frame";

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
 *
 * FORME — les couronnes sont un pictogramme, le tableau des paliers est un vrai
 * tableau HTML. À 360 px, le dessin prend toute la largeur et le tableau passe
 * dessous, sans qu’un seul mot ne rétrécisse.
 */

/** Centre des cercles, et rayons DESSINÉS (non proportionnels aux mètres). */
const CX = 160;
const CY = 160;
const RINGS = [
  { radius: 34, label: "500 m" },
  { radius: 64, label: "1 km" },
  { radius: 102, label: "2 km" },
  { radius: 150, label: "5 km" },
] as const;

/** Le palier retenu dans l’exemple : celui qui atteint les 8 ventes. */
const STOP_AT = 2;

const ROWS = [
  { radius: "500 m", kept: "3", decision: "trop peu, on élargit" },
  { radius: "1 km", kept: "6", decision: "moins de 8, on élargit" },
  { radius: "2 km", kept: "9", decision: "on s’arrête ici" },
  { radius: "5 km", kept: "·", decision: "rayon non interrogé" },
] as const;

/** Ventes d’exemple : leur position sert à peupler les couronnes, rien de plus. */
const SALES = [
  [-18, -24],
  [28, -14],
  [-36, 22],
  [10, 32],
  [-60, -36],
  [66, 28],
  [-76, 40],
  [46, -62],
  [-22, 80],
  [86, -20],
  [-112, 28],
  [118, 56],
  [-50, -118],
] as const;

export function RadiusEscalation({ className, caption = true }: DiagramProps) {
  return (
    <DiagramGroup
      className={className}
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
            Les rayons ne sont pas dessinés à l’échelle et les nombres de ventes
            sont un exemple. Le seuil d’arrêt réel est de 8 ventes retenues,
            ramené à 5 quand le premier rayon rapporte déjà plus de 120 ventes
            candidates (marché dense&nbsp;: élargir échangerait de la proximité
            contre du volume). Si le dernier rayon lui-même reste sous 5 ventes
            retenues, le moteur ne publie aucun chiffre.
          </>
        ) : null
      }
    >
      {/* Côte à côte seulement quand le CONTENEUR dépasse 40 rem : dans la
          colonne de l'accueil, le dessin prend toute la largeur et le tableau
          passe dessous, ce qui garde les couronnes lisibles. */}
      <div className="@container">
        <div className="grid items-center gap-5 @[40rem]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] @[40rem]:gap-8">
          <div className="mx-auto w-full max-w-[22rem] @[40rem]:max-w-none">
            <Pictogram viewBox="0 0 320 320">
              {RINGS.map((ring, i) => (
                <circle
                  key={ring.label}
                  cx={CX}
                  cy={CY}
                  r={ring.radius}
                  fill="none"
                  strokeWidth={i === STOP_AT ? 3 : 1.5}
                  strokeDasharray={i === STOP_AT ? undefined : "5 5"}
                  className={
                    i === STOP_AT
                      ? "stroke-accent-rule"
                      : "stroke-border-strong"
                  }
                />
              ))}

              {SALES.map(([dx, dy]) => {
                const inside = Math.hypot(dx, dy) <= 102;
                return (
                  <circle
                    key={`${dx}:${dy}`}
                    cx={CX + dx}
                    cy={CY + dy}
                    r={inside ? 5.5 : 4.5}
                    className={inside ? "fill-accent" : "fill-border-strong"}
                  />
                );
              })}

              {/* Le bien étudié : un losange, jamais une vente. */}
              <path
                d={`M${CX} ${CY - 9} L${CX + 9} ${CY} L${CX} ${CY + 9} L${CX - 9} ${CY} Z`}
                className="fill-primary"
              />

              {/* Les libellés de couronne, posés sur la diagonale : c’est la seule
                direction où quatre étiquettes ne se marchent pas dessus. Ils
                doublent le tableau, qui reste la source lisible. */}
              {RINGS.map((ring, i) => {
                const px = CX + ring.radius * 0.707;
                const py = CY - ring.radius * 0.707;
                return (
                  <g key={`l${ring.label}`}>
                    <circle
                      cx={px}
                      cy={py}
                      r={2.5}
                      className="fill-border-strong"
                    />
                    <text
                      x={px + 8}
                      y={py - 2}
                      fontSize="13"
                      fontWeight={i === STOP_AT ? 600 : 400}
                      className={
                        i === STOP_AT ? "fill-accent" : "fill-ink-subtle"
                      }
                    >
                      {ring.label}
                    </text>
                  </g>
                );
              })}
            </Pictogram>
          </div>

          <div className="min-w-0">
            <p className="eyebrow">Palier par palier</p>
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-subtle">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Rayon
                  </th>
                  <th scope="col" className="py-2 pr-3 text-center font-medium">
                    Retenues
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Décision
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => {
                  const stopped = i === STOP_AT;
                  const unused = i > STOP_AT;
                  return (
                    <tr
                      key={row.radius}
                      className={
                        "border-b border-border-soft " +
                        (stopped ? "bg-accent-soft" : "") +
                        (unused ? " text-ink-subtle" : " text-ink")
                      }
                    >
                      <td className="py-2.5 pr-3 pl-1 font-semibold tnum">
                        {row.radius}
                      </td>
                      <td className="py-2.5 pr-3 text-center tnum">
                        {row.kept}
                      </td>
                      <td
                        className={
                          "py-2.5 pr-1 " +
                          (stopped
                            ? "font-semibold text-accent-soft-fg"
                            : unused
                              ? ""
                              : "text-ink-muted")
                        }
                      >
                        {row.decision}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs leading-relaxed text-ink-subtle">
              Seuil d’arrêt&nbsp;: 8 ventes retenues. En marché dense (plus de
              120 candidates dès 500&nbsp;m), 5 retenues suffisent.
            </p>
          </div>
        </div>
      </div>
    </DiagramGroup>
  );
}

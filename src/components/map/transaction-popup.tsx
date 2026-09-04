"use client";

/**
 * Desktop detail card, anchored to the marker by a real `maplibregl.Popup` so
 * it tracks the point through pans, zooms and pitch changes.
 *
 * The React tree is portalled into the popup's DOM container: one popup at a
 * time, React keeps owning the content, and the map keeps owning the position.
 * (Mobile uses a bottom sheet instead — see `dvf-map.tsx`.)
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { Popup } from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { DvfTransaction } from "@/types/dvf";
import { TransactionCard } from "./transaction-card";

export interface TransactionPopupProps {
  map: MapLibreMap;
  transaction: DvfTransaction;
  distanceMeters?: number;
  isComparable?: boolean;
  onToggleComparable?: (transaction: DvfTransaction) => void;
  onClose: () => void;
  /** Densité d'affichage — jamais un univers. Voir `DvfMap`. */
  density?: "standard" | "dense";
}

export function TransactionPopup({
  map,
  transaction,
  distanceMeters,
  isComparable,
  onToggleComparable,
  onClose,
  density,
}: TransactionPopupProps) {
  const [container] = React.useState(() => {
    const node = document.createElement("div");
    // `overflow-y-auto` : voir la hauteur plafonnée plus bas. Sans lui, le
    // plafond couperait la fiche au lieu de la faire défiler.
    node.className = "w-[21rem] max-w-[80vw] overflow-y-auto overscroll-contain";
    return node;
  });
  const popupRef = React.useRef<Popup | null>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    const popup = new Popup({
      closeButton: false,
      // Closing on any map click would fight with marker-to-marker navigation.
      closeOnClick: false,
      closeOnMove: false,
      maxWidth: "none",
      offset: 18,
      focusAfterOpen: true,
    })
      .setDOMContent(container)
      .setLngLat([transaction.coordinates.lng, transaction.coordinates.lat])
      .addTo(map);

    popup.on("close", () => onCloseRef.current());
    popupRef.current = popup;

    /**
     * LA FICHE NE DOIT JAMAIS DÉPASSER LA CARTE.
     *
     * Une vente en multi-lots, avec ses diagnostics et son avertissement,
     * dépasse facilement six cents pixels. La racine de la carte porte
     * `overflow-hidden`, indispensable pour que les coins arrondis tiennent :
     * la fiche était donc COUPÉE en bas, sans barre de défilement et sans rien
     * qui signale qu'il manquait du texte. C'est le pire des deux mondes,
     * puisque l'avertissement sur le prix au m² d'une vente groupée est
     * précisément ce qu'il ne faut pas manquer.
     *
     * On plafonne donc la fiche à la hauteur visible de la carte, moins la
     * place du bec et des marges, et on la fait défiler à l'intérieur.
     * MapLibre garde par ailleurs sa logique de bascule au-dessus ou en
     * dessous du point ; les deux se complètent, l'une choisit le côté,
     * l'autre garantit que ça rentre.
     */
    const RESERVE = 96;
    const PLANCHER = 220;

    const ajusterHauteur = (): void => {
      const disponible = map.getContainer().clientHeight - RESERVE;
      container.style.maxHeight = `${Math.max(PLANCHER, disponible)}px`;
    };

    ajusterHauteur();
    const observateur = new ResizeObserver(ajusterHauteur);
    observateur.observe(map.getContainer());

    return () => {
      observateur.disconnect();
      popupRef.current = null;
      popup.remove();
    };
    // Re-creating the popup per transaction keeps MapLibre's anchor logic
    // (flip above/below the point) correct instead of dragging a stale anchor.
  }, [map, container, transaction.coordinates.lat, transaction.coordinates.lng]);

  return createPortal(
    <TransactionCard
      transaction={transaction}
      distanceMeters={distanceMeters}
      isComparable={isComparable}
      onToggleComparable={onToggleComparable}
      onClose={onClose}
      density={density}
    />,
    container,
  );
}

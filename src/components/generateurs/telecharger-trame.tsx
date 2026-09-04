"use client";

/**
 * LE BOUTON QUI PRODUIT LA TRAME.
 *
 * Tout se fait dans le navigateur : la trame est un assemblage de XML et de
 * ZIP, elle n'a besoin d'aucun serveur. Conséquence utile, et pas seulement
 * technique : le nom de l'entreprise, son logo et ses couleurs ne partent
 * nulle part pour fabriquer un document qui lui appartient.
 *
 * La charte est reçue en propriété plutôt que lue ici : c'est la page, côté
 * serveur, qui sait s'il y a une session et donc quelle charte s'applique.
 * Ce composant ne décide de rien, il rend ce qu'on lui donne.
 */

import * as React from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Charte } from "@/lib/brand/charte";
import { downloadBlob } from "@/lib/export/xlsx";
import { buildPptx } from "@/lib/export/pptx";
import type { DocumentKind } from "@/lib/generators/documents";

export function TelechargerTrame({
  kind,
  charte,
}: {
  kind: DocumentKind;
  charte: Charte;
}) {
  const [enCours, setEnCours] = React.useState(false);

  const produire = () => {
    setEnCours(true);
    try {
      const blob = buildPptx(kind, charte);
      const jour = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `corpusimmo-${kind.id}-${jour}.pptx`);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Button variant="secondary" size="sm" onClick={produire} disabled={enCours}>
      {enCours ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : (
        <Download aria-hidden className="size-4" />
      )}
      Télécharger la trame
    </Button>
  );
}

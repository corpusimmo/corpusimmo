"use client";

/**
 * PROPOSER LES COULEURS D'UNE CHARTE À PARTIR D'UN LOGO, SANS RIEN IMPOSER.
 *
 * Le calcul vit dans `@/lib/brand/couleurs`, qui ne connaît que des pixels.
 * Ce composant fait le reste : dessiner le logo hors écran, lire ses pixels,
 * MONTRER ce qui en sort, et attendre.
 *
 * ── RIEN NE S'APPLIQUE TOUT SEUL ───────────────────────────────────────────
 * Une extraction de couleurs est une hypothèse, pas une mesure. Elle se trompe
 * sur un logo à photo, sur un dégradé, sur une mascotte multicolore. Une charte
 * fausse posée en silence ressort ensuite sur chaque PDF envoyé à un mandant,
 * et personne ne saura d'où elle vient. D'où la prévisualisation, le bouton
 * explicite, et la saisie à la main toujours ouverte, y compris quand la
 * lecture du logo échoue.
 *
 * ── LE PIÈGE DU CANVAS ─────────────────────────────────────────────────────
 * Une image venue d'une autre origine SOUILLE le canvas : `getImageData` lève
 * alors une `SecurityError`, et rien ne le laisse deviner avant. On tente donc
 * d'abord un chargement en CORS, puis un chargement ordinaire, et si les pixels
 * restent illisibles on le DIT. Rester sur un « chargement… » perpétuel serait
 * la pire des réponses : l'utilisateur attendrait quelque chose qui ne viendra
 * jamais.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui";
import {
  encreLisible,
  normaliserHex,
  type Hex,
} from "@/lib/brand/charte";
import {
  proposerCouleurs,
  type CouleurCandidate,
  type Proposition,
} from "@/lib/brand/couleurs";

/**
 * Côté maximal analysé, en pixels.
 *
 * Au-delà, on lit des centaines de milliers de pixels pour un histogramme qui
 * ne bouge plus. 512 suffit à ce qu'un filet fin d'un logo vectoriel reste
 * représenté par plusieurs pixels.
 */
const COTE_MAXIMAL = 512;

/** Ce qu'on affiche quand une image SVG n'a pas de taille intrinsèque. */
const COTE_PAR_DEFAUT = 256;

type Etat =
  | { statut: "vide" }
  | { statut: "lecture" }
  | { statut: "lu"; proposition: Proposition }
  | { statut: "echec"; raison: "origine" | "chargement" };

/**
 * Charge une image, éventuellement en demandant le CORS.
 *
 * Le drapeau doit être posé AVANT `src` : le navigateur décide du mode de
 * requête au moment où l'URL est affectée, pas au chargement.
 */
function chargerImage(src: string, croisee: boolean): Promise<HTMLImageElement> {
  return new Promise((resoudre, rejeter) => {
    const image = new Image();
    if (croisee) image.crossOrigin = "anonymous";
    image.onload = () => resoudre(image);
    image.onerror = () => rejeter(new Error("chargement"));
    image.src = src;
  });
}

/** Dessine le logo hors écran et rend ses pixels, ou lève si le canvas est souillé. */
function lirePixels(image: HTMLImageElement): Uint8ClampedArray {
  const naturelle = Math.max(
    image.naturalWidth || COTE_PAR_DEFAUT,
    image.naturalHeight || COTE_PAR_DEFAUT,
  );
  const echelle = Math.min(1, COTE_MAXIMAL / naturelle);
  const largeur = Math.max(
    1,
    Math.round((image.naturalWidth || COTE_PAR_DEFAUT) * echelle),
  );
  const hauteur = Math.max(
    1,
    Math.round((image.naturalHeight || COTE_PAR_DEFAUT) * echelle),
  );

  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const contexte = canvas.getContext("2d", { willReadFrequently: true });
  if (!contexte) throw new Error("chargement");

  // Réduire en lissant fabriquerait exactement les teintes intermédiaires que
  // l'extraction passe son temps à écarter, et rendrait semi-transparents des
  // pixels pleins. Au plus proche voisin, on ne lit que des couleurs qui
  // existent réellement dans le fichier.
  contexte.imageSmoothingEnabled = false;
  contexte.drawImage(image, 0, 0, largeur, hauteur);

  return contexte.getImageData(0, 0, largeur, hauteur).data;
}

function Pastille({ couleur, libelle }: { couleur: Hex; libelle: string }) {
  const encre = encreLisible(couleur);
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="grid size-14 shrink-0 place-items-center rounded-sm border border-border text-xs font-medium"
        style={{ backgroundColor: couleur, color: encre }}
      >
        Texte
      </span>
      <span className="min-w-0 text-xs leading-relaxed text-ink-muted">
        <span className="block font-medium text-ink">{libelle}</span>
        <span className="block font-mono">{couleur}</span>
        {/* Ce qui décidera de la lisibilité des en-têtes de documents. */}
        <span className="block text-ink-subtle">
          {encre === "#ffffff"
            ? "Texte blanc lisible dessus"
            : "Texte noir lisible dessus"}
        </span>
      </span>
    </div>
  );
}

function Saisie({
  libelle,
  valeur,
  onChange,
}: {
  libelle: string;
  valeur: Hex | null;
  onChange: (couleur: Hex | null) => void;
}) {
  // Le champ texte garde la frappe en cours, qui n'est pas encore un
  // hexadécimal valable : normaliser à chaque touche empêcherait d'écrire.
  const [brouillon, setBrouillon] = React.useState(valeur ?? "");
  React.useEffect(() => setBrouillon(valeur ?? ""), [valeur]);

  return (
    <label className="flex items-center gap-2 text-xs text-ink-muted">
      <span className="w-24 shrink-0">{libelle}</span>
      <input
        type="color"
        aria-label={`${libelle}, nuancier`}
        value={valeur ?? "#ffffff"}
        onChange={(evenement) => onChange(normaliserHex(evenement.target.value))}
        className="size-9 shrink-0 rounded-sm border border-border bg-surface p-1"
      />
      <input
        type="text"
        inputMode="text"
        spellCheck={false}
        aria-label={`${libelle}, code hexadécimal`}
        placeholder="#1d4ed8"
        value={brouillon}
        onChange={(evenement) => {
          setBrouillon(evenement.target.value);
          onChange(normaliserHex(evenement.target.value));
        }}
        className="h-9 w-28 rounded-sm border border-border bg-surface px-2 font-mono text-xs text-ink"
      />
    </label>
  );
}

export interface LogoCouleursProps {
  /** Le fichier que l'utilisateur vient de déposer. Prioritaire sur `url`. */
  fichier?: File | null;
  /** L'URL d'un logo déjà enregistré. */
  url?: string | null;
  /** Appelé au clic sur « Appliquer », jamais avant. */
  onChoisir: (principale: Hex, secondaire: Hex | null) => void;
}

export function LogoCouleurs({ fichier, url, onChoisir }: LogoCouleursProps) {
  const [etat, setEtat] = React.useState<Etat>({ statut: "vide" });
  const [principale, setPrincipale] = React.useState<Hex | null>(null);
  const [secondaire, setSecondaire] = React.useState<Hex | null>(null);

  React.useEffect(() => {
    const source = fichier ? URL.createObjectURL(fichier) : (url ?? null);
    if (!source) {
      setEtat({ statut: "vide" });
      return;
    }

    let abandonne = false;
    setEtat({ statut: "lecture" });
    setPrincipale(null);
    setSecondaire(null);

    void (async () => {
      let image: HTMLImageElement;
      try {
        image = await chargerImage(source, !fichier);
      } catch {
        // Un serveur qui refuse le CORS fait échouer le chargement lui-même.
        // On retente sans, pour au moins AFFICHER le logo, quitte à ne pas
        // pouvoir en lire les pixels juste après.
        try {
          image = await chargerImage(source, false);
        } catch {
          if (!abandonne) setEtat({ statut: "echec", raison: "chargement" });
          return;
        }
      }
      if (abandonne) return;

      try {
        const proposition = proposerCouleurs(lirePixels(image));
        if (abandonne) return;
        setEtat({ statut: "lu", proposition });
        setPrincipale(proposition.principale);
        setSecondaire(proposition.secondaire);
      } catch {
        // `SecurityError` sur un canvas souillé, et rien d'autre de plausible
        // ici : le dessin lui-même ne lève pas.
        if (!abandonne) setEtat({ statut: "echec", raison: "origine" });
      }
    })();

    return () => {
      abandonne = true;
      if (fichier) URL.revokeObjectURL(source);
    };
  }, [fichier, url]);

  if (etat.statut === "vide") return null;

  if (etat.statut === "lecture") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
        <Loader2 aria-hidden="true" className="size-3 animate-spin" />
        Lecture des couleurs du logo…
      </p>
    );
  }

  const candidats: CouleurCandidate[] =
    etat.statut === "lu" ? etat.proposition.candidats : [];
  const muet = etat.statut === "lu" && etat.proposition.principale === null;

  return (
    <section className="flex flex-col gap-4 rounded-sm border border-border bg-surface-2 p-4">
      <div>
        <h3 className="text-sm font-medium text-ink">Couleurs du logo</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          {etat.statut === "echec" && etat.raison === "origine" ? (
            <>
              Ce logo est hébergé sur un autre domaine, qui n’autorise pas la
              lecture de ses pixels. Rien n’a pu être extrait. Téléversez le
              fichier, ou saisissez les couleurs ci-dessous.
            </>
          ) : etat.statut === "echec" ? (
            <>
              Ce fichier n’a pas pu être ouvert comme une image. Vérifiez le
              format, ou saisissez les couleurs ci-dessous.
            </>
          ) : muet ? (
            <>
              Aucune couleur de marque n’a été trouvée : ce logo est en noir et
              blanc, ou en gris. Le noir et le blanc sont du fond et du texte,
              pas une identité. Saisissez vos couleurs ci-dessous.
            </>
          ) : (
            <>
              Proposition, à vérifier avant de l’appliquer. Rien n’est
              enregistré tant que vous n’avez pas confirmé.
            </>
          )}
        </p>
      </div>

      {principale ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Pastille couleur={principale} libelle="Couleur principale" />
          {secondaire ? (
            <Pastille couleur={secondaire} libelle="Couleur secondaire" />
          ) : (
            <p className="self-center text-xs text-ink-subtle">
              Pas de seconde couleur. Les documents se contenteront de la
              principale, ce qui est un choix tenable.
            </p>
          )}
        </div>
      ) : null}

      {candidats.length > 1 ? (
        <div>
          <p className="text-xs text-ink-subtle">
            Autres couleurs relevées dans le logo :
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {candidats.slice(0, 6).map((candidat) => (
              <li key={candidat.hex} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPrincipale(candidat.hex)}
                  title={`${candidat.hex} sur ${Math.round(candidat.part * 100)} % de la surface colorée`}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-1 text-xs text-ink hover:border-border-strong"
                >
                  <span
                    aria-hidden="true"
                    className="size-3 rounded-full"
                    style={{ backgroundColor: candidat.hex }}
                  />
                  <span className="font-mono">{candidat.hex}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSecondaire(candidat.hex)}
                  className="rounded-full border border-border bg-surface px-2 py-1 text-[11px] text-ink-muted hover:border-border-strong"
                >
                  en 2<sup>e</sup>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Saisie
          libelle="Principale"
          valeur={principale}
          onChange={setPrincipale}
        />
        <Saisie
          libelle="Secondaire"
          valeur={secondaire}
          onChange={setSecondaire}
        />
        {secondaire ? (
          <button
            type="button"
            onClick={() => setSecondaire(null)}
            className="self-start text-xs text-ink-subtle underline underline-offset-2 hover:text-ink"
          >
            Retirer la seconde couleur
          </button>
        ) : null}
      </div>

      <div>
        <Button
          type="button"
          size="sm"
          disabled={!principale}
          onClick={() => {
            if (principale) onChoisir(principale, secondaire);
          }}
        >
          Appliquer ces couleurs
        </Button>
      </div>
    </section>
  );
}

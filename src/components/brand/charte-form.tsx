"use client";

/**
 * L'ÉCRAN DE LA CHARTE GRAPHIQUE.
 *
 * Ce que la personne dépose ici habille ensuite tous ses documents : export
 * PDF des comparables, trames PowerPoint, dossiers. C'est donc l'écran où il
 * faut MONTRER le résultat, pas seulement le saisir.
 *
 * TROIS PARTIS PRIS.
 *
 * 1. L'APERÇU EST LA PIÈCE PRINCIPALE, pas une décoration. Une charte se juge
 *    à l'œil, sur un en-tête de document, et pas sur deux carrés de couleur.
 *    L'aperçu affiche donc un bandeau réel, avec l'encre calculée : c'est là
 *    qu'on voit qu'un or clair rend le texte blanc illisible.
 *
 * 2. LE REPLI SE DIT. Tant que le nom ou la couleur principale manquent, les
 *    documents sortiront aux couleurs de CorpusImmo. L'écran l'annonce au lieu
 *    de laisser croire qu'un logo déposé suffit.
 *
 * 3. RIEN NE S'APPLIQUE TOUT SEUL. Les couleurs devinées depuis le logo
 *    remplissent les champs après un clic explicite, jamais à la volée : une
 *    charte fausse posée en silence est pire que pas de charte.
 */

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { encreLisible, normaliserHex, resoudreCharte } from "@/lib/brand/charte";
import { cn } from "@/lib/utils/cn";
import { LogoCouleurs } from "./logo-couleurs";

export interface CharteFormValues {
  companyName: string;
  website: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
}

type State =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string };

const CHAMPS: {
  cle: keyof CharteFormValues;
  label: string;
  aide?: string;
  type?: string;
  placeholder?: string;
}[] = [
  {
    cle: "companyName",
    label: "Nom de l'entreprise",
    aide: "Affiché en pied de chaque document.",
    placeholder: "Cabinet Dupont Immobilier",
  },
  {
    cle: "website",
    label: "Site internet",
    aide: "Facultatif. Le protocole est retiré à l'affichage.",
    placeholder: "cabinet-dupont.fr",
  },
  {
    cle: "logoUrl",
    label: "Adresse du logo",
    aide: "Une URL d'image. Le dépôt de fichier arrivera avec le stockage.",
    placeholder: "https://…/logo.png",
  },
];

export function CharteForm({
  initial,
  onSave,
}: {
  initial: CharteFormValues;
  onSave: (values: CharteFormValues) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [values, setValues] = React.useState<CharteFormValues>(initial);
  const [state, setState] = React.useState<State>({ status: "idle" });

  const set = (cle: keyof CharteFormValues, valeur: string) => {
    setValues((v) => ({ ...v, [cle]: valeur }));
    setState({ status: "idle" });
  };

  // L'aperçu passe par la MÊME résolution que les documents : c'est ce qui
  // garantit qu'il montre le repli quand il y aura repli, et non une version
  // optimiste de la saisie.
  const charte = resoudreCharte({
    entreprise: values.companyName,
    site: values.website,
    logo: values.logoUrl,
    principale: values.primaryColor,
    secondaire: values.secondaryColor,
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState({ status: "saving" });
    const result = await onSave(values);
    setState(
      result.ok
        ? { status: "saved" }
        : { status: "error", message: result.message ?? "Enregistrement impossible." },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {CHAMPS.map((champ) => (
            <label key={champ.cle} className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">{champ.label}</span>
              <input
                type={champ.type ?? "text"}
                value={values[champ.cle]}
                placeholder={champ.placeholder}
                onChange={(e) => set(champ.cle, e.target.value)}
                className="min-h-11 rounded-md border border-border bg-surface px-3 text-sm text-ink"
              />
              {champ.aide ? (
                <span className="text-xs text-ink-subtle">{champ.aide}</span>
              ) : null}
            </label>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <ChampCouleur
              label="Couleur principale"
              valeur={values.primaryColor}
              onChange={(v) => set("primaryColor", v)}
            />
            <ChampCouleur
              label="Couleur secondaire"
              valeur={values.secondaryColor}
              onChange={(v) => set("secondaryColor", v)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Apercu charte={charte} />
          <LogoCouleurs
            url={values.logoUrl || null}
            onChoisir={(principale, secondaire) => {
              set("primaryColor", principale);
              if (secondaire) set("secondaryColor", secondaire);
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={state.status === "saving"}>
          {state.status === "saving" ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : null}
          Enregistrer la charte
        </Button>

        {state.status === "saved" ? (
          <p className="flex items-center gap-1.5 text-sm text-success-soft-fg">
            <Check aria-hidden className="size-4" />
            Charte enregistrée.
          </p>
        ) : null}
        {state.status === "error" ? (
          <p className="text-sm text-warning-soft-fg" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Le champ de couleur double : un sélecteur natif et une saisie texte.
 *
 * Le sélecteur natif ne sait rendre qu'un `#rrggbb` valide, donc il ne peut
 * pas afficher un champ vide ni une saisie en cours. La saisie texte reste la
 * source de vérité, et le sélecteur ne sert qu'à choisir vite.
 */
function ChampCouleur({
  label,
  valeur,
  onChange,
}: {
  label: string;
  valeur: string;
  onChange: (v: string) => void;
}) {
  const hex = normaliserHex(valeur);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label}, sélecteur`}
          value={hex ?? "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="size-11 shrink-0 cursor-pointer rounded-md border border-border bg-surface p-1"
        />
        <input
          type="text"
          value={valeur}
          placeholder="#14293c"
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "min-h-11 w-full rounded-md border bg-surface px-3 font-mono text-sm text-ink",
            valeur && !hex ? "border-warning" : "border-border",
          )}
        />
      </span>
      {valeur && !hex ? (
        <span className="text-xs text-warning-soft-fg">
          Format attendu : #14293c
        </span>
      ) : null}
    </label>
  );
}

/** Le bandeau tel qu'il sortira sur un document. */
function Apercu({ charte }: { charte: ReturnType<typeof resoudreCharte> }) {
  const encre = encreLisible(charte.principale);
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ backgroundColor: charte.principale, color: encre }}
      >
        <span className="text-sm font-semibold">{charte.entreprise}</span>
        {charte.site ? (
          <span className="text-xs opacity-80">{charte.site}</span>
        ) : null}
      </div>
      {charte.secondaire ? (
        <div className="h-1" style={{ backgroundColor: charte.secondaire }} />
      ) : null}
      <p className="bg-surface px-4 py-3 text-xs leading-relaxed text-ink-muted">
        {charte.parDefaut ? (
          <>
            <span className="font-medium text-ink">
              Vos documents sortiront aux couleurs de CorpusImmo.
            </span>{" "}
            Renseignez au minimum un nom d’entreprise et une couleur principale
            pour utiliser la vôtre.
          </>
        ) : (
          <>
            Aperçu d’un en-tête de document. Le texte est
            {encre === "#ffffff" ? " blanc " : " noir "}
            parce que c’est celui qui se lit sur cette couleur.
          </>
        )}
      </p>
    </div>
  );
}

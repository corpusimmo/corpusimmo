"use client";

/**
 * Le moteur commun des dix outils en ligne.
 *
 * Il rend une `ToolSpec` : les sections de saisie à gauche, les résultats à
 * droite, et le recalcul est immédiat — pas de bouton « Calculer », parce que
 * l'intérêt d'un outil web sur un tableur est justement de voir bouger le
 * résultat pendant qu'on déplace un curseur.
 *
 * Les paramètres réglementaires sont dans un bloc dépliable, fermé par défaut :
 * visibles pour qui veut les vérifier, discrets pour qui veut juste un chiffre.
 * Les cacher tout à fait reviendrait à reproduire le défaut des tableurs qui
 * embarquent un barème périmé sans que personne ne s'en aperçoive.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, RotateCcw, SlidersHorizontal, Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui";
import { InfoBubble } from "./info-bubble";
import { getToolSpec } from "@/lib/tools/definitions";
import {
  fromISODate,
  isChoice,
  toISODate,
  type ToolChoice,
  type ToolField,
  type ToolTable,
} from "@/lib/tools/spec";
import type { ToolId } from "@/types/tool";

function formatValue(value: number | string, unit: string): string {
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) return "—";

  const nf = (max: number, min = 0) =>
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: max, minimumFractionDigits: min });

  switch (unit) {
    case "eur":
      return `${nf(Math.abs(value) < 100 ? 2 : 0).format(value)} €`;
    case "eurm2":
      return `${nf(0).format(value)} €/m²`;
    case "pct":
      return `${nf(2, 2).format(value)} %`;
    case "m2":
      return `${nf(0).format(value)} m²`;
    case "an":
    case "annees":
      return `${nf(2).format(value)} ans`;
    case "mois":
      return `${nf(0).format(value)} mois`;
    case "fois":
      return `${nf(2).format(value)} ×`;
    default:
      return nf(2).format(value);
  }
}

const UNIT_SUFFIX: Record<string, string> = {
  eur: "€",
  eurm2: "€/m²",
  pct: "%",
  m2: "m²",
  an: "ans",
  mois: "mois",
  nombre: "",
};

export function ToolRunner({ toolId }: { toolId: ToolId }) {
  // La spécification est résolue ICI, côté client, et non passée en props.
  // Elle contient des fonctions de calcul, et React refuse de sérialiser une
  // fonction à la frontière serveur → client : passer l'objet entier faisait
  // échouer le rendu de la page, sans que rien ne s'affiche.
  const spec = getToolSpec(toolId);

  const initialNumbers = useMemo(() => {
    const out: Record<string, number> = {};
    for (const section of spec.sections) {
      for (const field of section.fields) {
        if (!isChoice(field)) out[field.id] = field.value;
      }
    }
    for (const p of spec.params) out[p.id] = p.value;
    return out;
  }, [spec]);

  const initialChoices = useMemo(() => {
    const out: Record<string, string> = {};
    for (const section of spec.sections) {
      for (const field of section.fields) {
        if (isChoice(field)) out[field.id] = field.value;
      }
    }
    return out;
  }, [spec]);

  const initialTables = useMemo(() => {
    const out: Record<string, number[][]> = {};
    for (const table of spec.tables ?? []) out[table.id] = table.rows.map((r) => [...r]);
    return out;
  }, [spec]);

  const [tables, setTables] = useState(initialTables);
  const [values, setValues] = useState(initialNumbers);
  const [choices, setChoices] = useState(initialChoices);
  const [showParams, setShowParams] = useState(false);
  /** Vrai quand l'écran affiche une saisie retrouvée, pas les valeurs d'exemple. */
  const [restaure, setRestaure] = useState(false);

  const cle = `corpusimmo:outil:${toolId}`;

  /**
   * Empreinte de la FORME de l'outil : identifiants des champs, des choix et
   * des colonnes, plus leur unité.
   *
   * Une simulation enregistrée par une version précédente peut ne plus vouloir
   * dire la même chose. Le rent roll saisissait des durées en années ; il
   * saisit des dates. Relire l'ancien état donnait « 01/01/1970 » sur trois
   * lignes, sans que rien ne le signale — un résultat faux présenté comme une
   * simulation retrouvée. Si l'empreinte diffère, on repart de l'exemple.
   */
  const empreinte = useMemo(() => {
    const champs = spec.sections.flatMap((sec) =>
      sec.fields.map((f) => `${f.id}:${isChoice(f) ? "choix" : f.unit}`),
    );
    const colonnes = (spec.tables ?? []).flatMap((t) =>
      [t.id, ...t.columns.map((c) => `${c.id}:${c.unit}`)],
    );
    return [...champs, ...colonnes, ...spec.params.map((p) => p.id)].join("|");
  }, [spec]);

  const modifie = useMemo(() => {
    const memeNombres = Object.keys(initialNumbers).every(
      (k) => values[k] === initialNumbers[k],
    );
    const memeChoix = Object.keys(initialChoices).every(
      (k) => choices[k] === initialChoices[k],
    );
    const memeTables =
      JSON.stringify(tables) === JSON.stringify(initialTables);
    return !memeNombres || !memeChoix || !memeTables;
  }, [values, choices, tables, initialNumbers, initialChoices, initialTables]);

  // La relecture se fait APRÈS le montage, jamais pendant le rendu : le serveur
  // ne connaît pas le stockage local, et rendre autre chose que lui provoquerait
  // une divergence d'hydratation.
  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(cle);
      if (!brut) return;
      const enregistre: unknown = JSON.parse(brut);
      if (typeof enregistre !== "object" || enregistre === null) return;

      // Forme changée depuis l'enregistrement : on jette plutôt que d'afficher
      // des valeurs qui ne veulent plus rien dire.
      if ((enregistre as { empreinte?: string }).empreinte !== empreinte) {
        window.localStorage.removeItem(cle);
        return;
      }
      const { values: v, choices: c } = enregistre as {
        values?: Record<string, number>;
        choices?: Record<string, string>;
      };
      // On repart des valeurs par défaut et on écrase par ce qui a été retrouvé :
      // un champ ajouté au modèle depuis la dernière visite garde ainsi sa valeur
      // d'exemple au lieu de rester vide.
      const { tables: t } = enregistre as { tables?: Record<string, number[][]> };
      if (v) setValues((prev) => ({ ...prev, ...v }));
      if (c) setChoices((prev) => ({ ...prev, ...c }));
      if (t) setTables((prev) => ({ ...prev, ...t }));
      if (v || c || t) setRestaure(true);
    } catch {
      // Navigation privée, quota plein, données corrompues : on garde l'exemple.
    }
  }, [cle, empreinte]);

  useEffect(() => {
    if (!restaure && !modifie) return;
    try {
      window.localStorage.setItem(cle, JSON.stringify({ empreinte, values, choices, tables }));
    } catch {
      /* voir ci-dessus */
    }
  }, [cle, empreinte, values, choices, tables, restaure, modifie]);

  const oublier = useCallback(() => {
    setRestaure(false);
    try {
      window.localStorage.removeItem(cle);
    } catch {
      // Navigation privée ou stockage refusé : rien à effacer.
    }
  }, [cle]);

  /**
   * Remise à blanc : tout à zéro, une seule ligne vide par tableau.
   *
   * On garde les PARAMÈTRES réglementaires à leur valeur : mettre les
   * prélèvements sociaux à zéro ne vide pas un formulaire, ça produit un calcul
   * faux. Ce que l'utilisateur veut effacer, ce sont ses données, pas le droit
   * fiscal.
   */
  const vider = useCallback(() => {
    const zeros: Record<string, number> = {};
    for (const [id, valeur] of Object.entries(initialNumbers)) {
      zeros[id] = spec.params.some((p) => p.id === id) ? valeur : 0;
    }
    setValues(zeros);
    setChoices(
      Object.fromEntries(
        spec.sections.flatMap((sec) =>
          sec.fields.filter(isChoice).map((f) => [f.id, f.options[0]?.value ?? f.value]),
        ),
      ),
    );
    setTables(
      Object.fromEntries(
        (spec.tables ?? []).map((t) => [t.id, [t.columns.map(() => 0)]]),
      ),
    );
    oublier();
  }, [spec, initialNumbers, oublier]);

  const revenirALExemple = useCallback(() => {
    setValues(initialNumbers);
    setChoices(initialChoices);
    setTables(initialTables);
    oublier();
  }, [initialNumbers, initialChoices, initialTables, oublier]);

  /** Les identifiants des champs qui sont des dates, pour convertir à la volée. */
  const champsDate = useMemo(() => {
    const ids = new Set<string>();
    for (const section of spec.sections) {
      for (const field of section.fields) {
        if (!isChoice(field) && field.unit === "date") ids.add(field.id);
      }
    }
    return ids;
  }, [spec]);

  const setNumber = (id: string, raw: string) => {
    // Une saisie vide devient 0 plutôt que NaN : un champ qu'on vide pour le
    // retaper ne doit pas faire disparaître tous les résultats de la page.
    const parsed = champsDate.has(id) ? fromISODate(raw) : Number(raw.replace(",", "."));
    setValues((prev) => ({ ...prev, [id]: Number.isFinite(parsed) ? parsed : 0 }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      {/* ------------------------------------------------------ les saisies -- */}
      <div className="flex flex-col gap-5">
        {/* La remise à zéro est EN TÊTE, pas en bas de colonne : quelqu'un qui
            retrouve une simulation vieille de trois semaines veut repartir de
            zéro avant de lire quoi que ce soit, pas après avoir fait défiler
            quinze champs. */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
          <p className="min-w-0 text-sm text-ink-muted">
            {restaure ? (
              <>
                <span className="font-medium text-ink">Votre simulation précédente</span> a été
                retrouvée sur cet appareil.
              </>
            ) : (
              <>
                Les valeurs affichées sont un{" "}
                <span className="font-medium text-ink">cas d&apos;exemple</span>. Remplacez-les par
                les vôtres.
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={revenirALExemple}>
              <Undo2 className="size-4" aria-hidden />
              Revenir au cas d&apos;exemple
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={vider}>
              <RotateCcw className="size-4" aria-hidden />
              Tout effacer
            </Button>
          </div>
        </div>

        {spec.sections.map((section) => (
          <section
            key={section.title}
            className="rounded-xl border border-border bg-surface p-5 shadow-xs sm:p-6"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {section.title}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {section.fields.map((field) =>
                isChoice(field) ? (
                  <ChoiceInput
                    key={field.id}
                    field={field}
                    value={choices[field.id] ?? field.value}
                    onChange={(v) => setChoices((prev) => ({ ...prev, [field.id]: v }))}
                  />
                ) : (
                  <NumberInput
                    key={field.id}
                    field={field}
                    value={values[field.id] ?? field.value}
                    onChange={(v) => setNumber(field.id, v)}
                  />
                ),
              )}
            </div>
          </section>
        ))}

        {(spec.tables ?? []).map((table) => (
          <TableInput
            key={table.id}
            table={table}
            rows={tables[table.id] ?? []}
            onChange={(rows) => setTables((prev) => ({ ...prev, [table.id]: rows }))}
          />
        ))}

        {spec.params.length > 0 ? (
          <section className="rounded-xl border border-border bg-surface-2 p-5 shadow-xs sm:p-6">
            <button
              type="button"
              onClick={() => setShowParams((s) => !s)}
              aria-expanded={showParams}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <SlidersHorizontal className="size-4 text-ink-muted" aria-hidden />
                Paramètres réglementaires — millésime 2026
              </span>
              <ChevronDown
                className={`size-4 shrink-0 text-ink-muted transition-transform ${showParams ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Aucun taux n&apos;est enfoui dans une formule. Vérifiez-les avant tout engagement, et
              corrigez-les si la loi a bougé depuis.
            </p>
            {showParams ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {spec.params.map((p) => (
                  <NumberInput
                    key={p.id}
                    field={{ id: p.id, label: p.label, value: p.value, unit: p.unit, hint: p.hint }}
                    value={values[p.id] ?? p.value}
                    onChange={(v) => setNumber(p.id, v)}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

      </div>

      {/* ---------------------------------------------------- les résultats -- */}
      <div className="flex flex-col gap-5 lg:sticky lg:top-24">
        <div className="flex flex-col gap-4">
          {spec.headlines.map((h) => {
            const value = h.compute(values, choices, tables);
            return (
              <div
                key={h.label}
                className="rounded-xl border border-border bg-primary-soft p-5 text-center shadow-xs"
              >
                <p className="text-3xl font-semibold tabular-nums text-primary-soft-fg sm:text-4xl">
                  {formatValue(value, h.unit)}
                </p>
                <p className="mt-1 text-sm font-medium text-ink">{h.label}</p>
                {h.caption ? (
                  <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                    {h.caption(values, choices, tables)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Le détail du calcul
          </h2>
          <dl className="mt-4 flex flex-col">
            {spec.outputs.map((o) => (
              <div
                key={o.id}
                className="flex flex-col gap-0.5 border-b border-border-soft py-2 last:border-0"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <dt
                    className={`flex min-w-0 items-center gap-1.5 text-sm ${o.strong ? "font-semibold text-ink" : "text-ink-muted"}`}
                  >
                    {o.label}
                    {o.hint ? <InfoBubble label={o.label}>{o.hint}</InfoBubble> : null}
                  </dt>
                  <dd
                    className={`shrink-0 text-sm tabular-nums ${o.strong ? "font-semibold text-ink" : "text-ink"}`}
                  >
                    {formatValue(o.compute(values, choices, tables), o.unit)}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <p className="rounded-xl border border-border-soft bg-surface-2 p-4 text-xs leading-relaxed text-ink-muted">
          <span className="font-semibold text-ink">Ce que ce calcul ne fait pas.</span>{" "}
          {spec.caveat}
        </p>
      </div>
    </div>
  );
}

function NumberInput({
  field,
  value,
  onChange,
}: {
  field: ToolField;
  value: number;
  onChange: (raw: string) => void;
}) {
  const suffix = UNIT_SUFFIX[field.unit] ?? "";
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={`champ-${field.id}`}
        className="flex items-center gap-1.5 text-sm font-medium text-ink"
      >
        {field.label}
        {field.hint ? <InfoBubble label={field.label}>{field.hint}</InfoBubble> : null}
      </label>
      <div className="relative">
        <input
          id={`champ-${field.id}`}
          type={field.unit === "date" ? "date" : "number"}
          inputMode="decimal"
          value={field.unit === "date" ? toISODate(value) : Number.isFinite(value) ? value : 0}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-md border border-border bg-surface px-3 pr-12 text-sm tabular-nums text-ink shadow-xs outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
        />
        {suffix ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-subtle"
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ChoiceInput({
  field,
  value,
  onChange,
}: {
  field: ToolChoice;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <label
        htmlFor={`champ-${field.id}`}
        className="flex items-center gap-1.5 text-sm font-medium text-ink"
      >
        {field.label}
        {field.hint ? <InfoBubble label={field.label}>{field.hint}</InfoBubble> : null}
      </label>
      <select
        id={`champ-${field.id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink shadow-xs outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
      >
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Un tableau à lignes ajoutables — le rent roll, les comparables, les postes.
 *
 * Une ligne par entité, une colonne par donnée : on lit un locataire d'un seul
 * regard, au lieu de sauter entre « Locataire 1 — loyer » et « Locataire 2 —
 * loyer » dans une grille à deux colonnes.
 *
 * Sur petit écran, la mise en tableau devient illisible : chaque ligne bascule
 * alors en carte, avec ses libellés en toutes lettres. C'est le même état, deux
 * présentations — pas deux composants à maintenir.
 */
function TableInput({
  table,
  rows,
  onChange,
}: {
  table: ToolTable;
  rows: number[][];
  onChange: (rows: number[][]) => void;
}) {
  const min = table.min ?? 1;

  const setCell = (ligne: number, colonne: number, brut: string) => {
    const col = table.columns[colonne];
    const parsed =
      col?.unit === "date" ? fromISODate(brut) : Number(brut.replace(",", "."));
    onChange(
      rows.map((r, i) =>
        i === ligne ? r.map((v, j) => (j === colonne ? (Number.isFinite(parsed) ? parsed : 0) : v)) : r,
      ),
    );
  };

  const ajouter = () => onChange([...rows, table.columns.map((c) => c.value)]);

  /** Nom d'une ligne : son libellé déclaré, sinon son rang. */
  const nom = (i: number) =>
    table.rowLabels?.[i] ??
    (table.extraLabel ? `${table.extraLabel} ${i + 1 - (table.rowLabels?.length ?? 0)}` : String(i + 1));
  const retirer = (ligne: number) => onChange(rows.filter((_, i) => i !== ligne));

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          {table.title}
        </h2>
        <p className="text-xs text-ink-subtle">
          {rows.length} {rows.length > 1 ? "lignes" : "ligne"}
        </p>
      </div>
      {table.hint ? (
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{table.hint}</p>
      ) : null}

      {/* Tableau à partir de `sm`. */}
      <div className="mt-4 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="pb-2 pr-2 text-left text-xs font-medium text-ink-subtle">
                {table.rowLabels || table.extraLabel ? "Ligne" : "#"}
              </th>
              {table.columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className="pb-2 pr-2 text-left text-xs font-medium text-ink-subtle"
                >
                  {col.short ?? col.label}
                </th>
              ))}
              <th scope="col" className="pb-2">
                <span className="sr-only">Retirer</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ligne, i) => (
              <tr key={i}>
                <td className="max-w-[10rem] py-1 pr-2 text-xs text-ink-muted">{nom(i)}</td>
                {table.columns.map((col, j) => (
                  <td key={col.id} className="py-1 pr-2">
                    <CellInput
                      col={col}
                      value={ligne[j] ?? 0}
                      label={`${col.label} — ${nom(i)}`}
                      onChange={(brut) => setCell(i, j, brut)}
                    />
                  </td>
                ))}
                <td className="py-1">
                  <button
                    type="button"
                    onClick={() => retirer(i)}
                    disabled={rows.length <= min}
                    aria-label={`Retirer ${nom(i)}`}
                    className="grid size-9 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-danger disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartes en dessous de `sm`. */}
      <div className="mt-4 flex flex-col gap-3 sm:hidden">
        {rows.map((ligne, i) => (
          <div key={i} className="rounded-lg border border-border-soft bg-surface-2 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {nom(i)}
              </p>
              <button
                type="button"
                onClick={() => retirer(i)}
                disabled={rows.length <= min}
                aria-label={`Retirer ${nom(i)}`}
                className="grid size-8 place-items-center rounded-md text-ink-subtle hover:text-danger disabled:opacity-30"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-2.5">
              {table.columns.map((col, j) => (
                <label key={col.id} className="flex flex-col gap-1 text-sm text-ink">
                  {col.label}
                  <CellInput
                    col={col}
                    value={ligne[j] ?? 0}
                    label={col.label}
                    onChange={(brut) => setCell(i, j, brut)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Button type="button" variant="secondary" size="sm" onClick={ajouter}>
          <Plus className="size-4" aria-hidden />
          {table.addLabel}
        </Button>
      </div>
    </section>
  );
}

/** Une cellule de tableau : sélecteur de date, ou champ numérique. */
function CellInput({
  col,
  value,
  label,
  onChange,
}: {
  col: { unit: string };
  value: number;
  label: string;
  onChange: (brut: string) => void;
}) {
  const commun =
    "h-10 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-ink shadow-xs outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25";

  if (col.unit === "date") {
    return (
      <input
        type="date"
        aria-label={label}
        value={toISODate(value)}
        onChange={(e) => onChange(e.target.value)}
        className={commun}
      />
    );
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${commun} tabular-nums`}
    />
  );
}

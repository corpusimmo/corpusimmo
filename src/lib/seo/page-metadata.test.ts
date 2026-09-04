/**
 * L'AUDIT DES MÉTADONNÉES DE PAGE.
 *
 * Deux titres identiques sur deux pages, et Google en garde une : c'est la
 * faute la plus banale du référencement, la plus facile à commettre en
 * dupliquant un fichier, et celle qu'aucun outil ne signale. Ce test la rend
 * impossible.
 *
 * Il importe les modules de page eux-mêmes plutôt que de reconstituer leurs
 * métadonnées : ce qui est vérifié est donc exactement ce qui sera servi.
 * `/outils/[slug]/calculer` en est absent, parce qu'il lit des cookies par
 * `next/headers` et ne s'importe pas hors du rendu d'une requête ; ses
 * métadonnées passent par la même fabrique.
 */

import type { Metadata } from "next";
import { describe, expect, it } from "vitest";

import { metadata as home } from "@/app/(site)/page";
import { metadata as aPropos } from "@/app/(site)/a-propos/page";
import { metadata as estimer } from "@/app/(site)/estimer/page";
import { metadata as comparables } from "@/app/(site)/observatoire/comparables/page";
import { metadata as observatoire } from "@/app/(site)/observatoire/page";
import { metadata as transactions } from "@/app/(site)/observatoire/transactions/page";
import { metadata as outils } from "@/app/(site)/outils/page";
import { metadata as automatisation } from "@/app/(site)/solutions/automatisation/page";
import { metadata as formation } from "@/app/(site)/solutions/formation/page";
import { metadata as leads } from "@/app/(site)/solutions/leads-vendeurs/page";
import { metadata as solutions } from "@/app/(site)/solutions/page";

const PAGES: Record<string, Metadata> = {
  "/": home,
  "/a-propos": aPropos,
  "/estimer": estimer,
  "/observatoire": observatoire,
  "/observatoire/comparables": comparables,
  "/observatoire/transactions": transactions,
  "/outils": outils,
  "/solutions": solutions,
  "/solutions/automatisation": automatisation,
  "/solutions/formation": formation,
  "/solutions/leads-vendeurs": leads,
};

const entries = Object.entries(PAGES);

function titleOf(meta: Metadata): string {
  const { title } = meta;
  if (typeof title === "string") return title;
  if (title && typeof title === "object" && "absolute" in title)
    return String(title.absolute);
  return "";
}

describe("les métadonnées de page", () => {
  it("donnent un titre unique à chaque page", () => {
    const titles = entries.map(([, meta]) => titleOf(meta));
    expect(titles.filter((title) => title.length === 0)).toEqual([]);
    expect(
      new Set(titles).size,
      `titres en double : ${titles.join(" | ")}`,
    ).toBe(titles.length);
  });

  it("donnent une description unique à chaque page", () => {
    const descriptions = entries.map(([, meta]) =>
      String(meta.description ?? ""),
    );
    expect(descriptions.filter((text) => text.length === 0)).toEqual([]);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("écrivent des descriptions à la bonne longueur", () => {
    // La cible est 150 à 160 signes. La borne du test est un peu plus large,
    // parce qu'une phrase française honnête ne se coupe pas au signe près : ce
    // qu'on interdit, c'est l'extrait vide et l'extrait tronqué.
    for (const [path, meta] of entries) {
      const length = String(meta.description ?? "").length;
      const floor =
        meta.robots &&
        typeof meta.robots === "object" &&
        "index" in meta.robots &&
        meta.robots.index === false
          ? 100 // Une page hors index n'a pas d'extrait à remplir.
          : 140;
      expect(length, `${path} : ${length} signes`).toBeGreaterThanOrEqual(
        floor,
      );
      expect(length, `${path} : ${length} signes`).toBeLessThanOrEqual(170);
    }
  });

  it("n'écrivent jamais de tiret cadratin", () => {
    for (const [path, meta] of entries) {
      const text = `${titleOf(meta)} ${meta.description ?? ""} ${meta.openGraph?.title ?? ""}`;
      expect(text, `${path} porte un tiret cadratin`).not.toMatch(/[—–]/);
    }
  });

  it("posent une canonique, un Open Graph complet et une carte Twitter", () => {
    for (const [path, meta] of entries) {
      expect(meta.alternates?.canonical, `${path} sans canonique`).toBe(path);

      const og = meta.openGraph;
      expect(og, `${path} sans Open Graph`).toBeDefined();
      expect(og?.locale, `${path} sans locale`).toBe("fr_FR");
      expect(og?.siteName, `${path} sans siteName`).toBeTruthy();
      expect(og?.url, `${path} sans URL absolue`).toMatch(/^https?:\/\//);
      expect(og?.title, `${path} sans titre social`).toBeTruthy();
      expect(og?.description, `${path} sans description sociale`).toBeTruthy();

      expect(meta.twitter?.title, `${path} sans carte Twitter`).toBeTruthy();
    }
  });

  it("gardent hors index les pages qui doivent l'être", () => {
    for (const path of [
      "/observatoire/comparables",
      "/solutions",
      "/solutions/automatisation",
      "/solutions/formation",
      "/solutions/leads-vendeurs",
    ]) {
      const robots = PAGES[path]?.robots;
      expect(
        robots && typeof robots === "object" && "index" in robots
          ? robots.index
          : undefined,
        `${path} est redevenue indexable`,
      ).toBe(false);
    }
  });
});

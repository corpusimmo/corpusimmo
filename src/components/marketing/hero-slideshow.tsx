"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * LE DIAPORAMA DU HÉROS.
 *
 * Cinq vues urbaines en fondu enchaîné derrière le titre, sous un voile de
 * marine : le texte reste blanc et lisible quelle que soit l'image. Tout est
 * décoratif (`aria-hidden`), rien n'est cliquable, rien n'est annoncé.
 *
 * Ce qui est respecté :
 * - `prefers-reduced-motion` : le fondu ne démarre pas, la première image
 *   reste. Un fond qui bouge sans qu'on l'ait demandé est une gêne réelle.
 * - Le poids : seule la première image est prioritaire ; les autres se
 *   chargent en différé, et `next/image` les sert à la largeur de l'écran.
 * - Les images sont des illustrations générées (docs/images.md) : aucun bien
 *   ni aucune adresse réelle n'est reconnaissable.
 * - Aucune n'est reprise ailleurs sur l'accueil. Une vue qui passe en fond du
 *   héros PUIS en carte de typologie deux écrans plus bas se lit comme une
 *   banque d'images trop courte, ce qui est exactement l'impression qu'on
 *   cherche à éviter.
 */

const SLIDES = [
  "/illustrations/ville-rue-fenetre.webp",
  "/illustrations/ville-metropole-aerienne.webp",
  "/illustrations/ville-pont.webp",
  "/illustrations/ville-moyenne-aerienne.webp",
  "/illustrations/ville-quai.webp",
] as const;

const INTERVAL_MS = 6500;

export function HeroSlideshow() {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (query.matches) return;
    setAnimate(true);
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-20 overflow-hidden"
    >
      {SLIDES.map((src, i) => {
        const visible = i === index;
        // Sans animation, seule la première image est rendue : inutile de
        // charger quatre fichiers pour un fond qui ne changera jamais.
        if (!animate && i !== 0) return null;
        return (
          <Image
            key={src}
            src={src}
            alt=""
            fill
            priority={i === 0}
            sizes="100vw"
            className={
              "object-cover object-center transition-[opacity,transform] duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
              (visible ? "scale-100 opacity-100" : "scale-[1.04] opacity-0")
            }
          />
        );
      })}

      {/* Le voile : marine presque plein à gauche, sous le texte, qui s'ouvre
          vers la droite pour laisser l'image respirer derrière le relevé. */}
      <div className="absolute inset-0 bg-[linear-gradient(100deg,color-mix(in_srgb,var(--surface-inverted)_94%,transparent)_0%,color-mix(in_srgb,var(--surface-inverted)_82%,transparent)_45%,color-mix(in_srgb,var(--surface-inverted)_58%,transparent)_100%)]" />
      {/* Un fondu vers le canvas en bas : le panneau du corpus se pose sur
          une transition, pas sur une coupe. */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,color-mix(in_srgb,var(--surface-inverted)_35%,transparent))]" />
    </div>
  );
}

import Link from "next/link";

import { mainNav } from "@/config/navigation";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 py-20 text-center">
      <p className="eyebrow">Erreur 404</p>
      <h1 className="mt-3 font-display text-4xl leading-tight text-ink">Cette page n&apos;existe pas</h1>
      <p className="mt-4 max-w-md leading-relaxed text-ink-muted">
        Le lien est peut-être ancien, ou l&apos;adresse mal recopiée. Voici les cinq entrées du
        site.
      </p>

      <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
        {mainNav.map((entry) => (
          <li key={entry.href}>
            <Link href={entry.href} className="font-semibold text-primary underline">
              {entry.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

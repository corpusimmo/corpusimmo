"use client";

import Cal from "@calcom/embed-react";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * LE CALENDRIER CAL.COM, DANS LA PAGE.
 *
 * Le lien vient de `NEXT_PUBLIC_CAL_LINK`, au format « utilisateur/evenement ».
 * Sans lui, le composant ne rend rien et la page montre son repli. Une
 * instance auto-hébergée se désigne par `NEXT_PUBLIC_CAL_ORIGIN`
 * (par exemple http://localhost:3001) ; vide, c'est app.cal.com.
 *
 * On n'appelle PAS `getCalApi()` : ses commandes visent une iframe qui n'existe
 * pas encore au premier rendu et le SDK lève « iframe doesn't exist ». Tout
 * passe par `config`, lu à la création de l'iframe.
 */
const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK?.trim();
const CAL_ORIGIN = process.env.NEXT_PUBLIC_CAL_ORIGIN?.trim().replace(/\/$/, "");

export function BookingEmbed() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = host.current;
    if (!CAL_LINK || !node) return;
    if (node.querySelector("iframe")) {
      setReady(true);
      return;
    }
    const observer = new MutationObserver(() => {
      if (node.querySelector("iframe")) {
        setReady(true);
        observer.disconnect();
      }
    });
    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!CAL_LINK) return null;

  return (
    <div ref={host} className="panel relative min-h-[560px] overflow-hidden bg-surface p-0">
      {!ready ? (
        <div className="absolute inset-0 grid place-items-center text-ink-muted">
          <span className="inline-flex items-center gap-2 text-sm">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Chargement du calendrier
          </span>
        </div>
      ) : null}
      <Cal
        calLink={CAL_LINK}
        calOrigin={CAL_ORIGIN || undefined}
        embedJsUrl={CAL_ORIGIN ? `${CAL_ORIGIN}/embed/embed.js` : undefined}
        style={{ width: "100%", height: "100%", minHeight: 560, overflow: "scroll" }}
        config={{ layout: "month_view", theme: "light" }}
      />
    </div>
  );
}

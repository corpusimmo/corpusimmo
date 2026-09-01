"use client";

/**
 * LE TRANSPORT DE MESURE, et le seul endroit qui parle à `gtag`.
 *
 * Un seul point de passage, pour trois raisons :
 *   1. le consentement s'y vérifie une fois pour toutes. Aucun composant ne
 *      peut envoyer un événement en oubliant de demander ;
 *   2. le plan de marquage y est typé (`AnalyticsEvent`) : un événement
 *      inventé au fil de l'eau ne compile pas ;
 *   3. le jour où l'on remplace Google par autre chose, il y a UN fichier à
 *      réécrire, pas cinquante appels dispersés.
 *
 * SANS CONSENTEMENT, `track` NE FAIT RIEN et ne met rien en file d'attente. On
 * ne rejoue pas après coup ce qui s'est passé avant l'accord : ce serait
 * mesurer rétroactivement une navigation pendant laquelle la personne n'avait
 * rien accepté.
 *
 * `navigator.globalPrivacyControl` est traité comme un REFUS, quel que soit le
 * bandeau. C'est un signal que le navigateur envoie pour le compte de la
 * personne ; le respecter coûte quelques points de mesure et évite d'avoir à
 * expliquer un jour pourquoi on ne l'a pas fait.
 */

import { readConsent } from "@/lib/consent/consent";

import type { AnalyticsEvent } from "./events";

type GtagArgs =
  | [command: "js", value: Date]
  | [command: "config", targetId: string, config?: Record<string, unknown>]
  | [command: "event", name: string, params?: Record<string, unknown>]
  | [command: "consent", mode: "default" | "update", params: Record<string, unknown>]
  | [command: "set", params: Record<string, unknown>];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: GtagArgs) => void;
  }
  interface Navigator {
    /** Signal « ne me suivez pas », envoyé par le navigateur. Non standardisé. */
    globalPrivacyControl?: boolean;
  }
}

/** Le signal navigateur l'emporte sur le bandeau : il vaut refus. */
export function privacySignalRefuses(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.globalPrivacyControl === true;
}

export function analyticsAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (privacySignalRefuses()) return false;
  const consent = readConsent();
  return consent.status === "answered" && consent.choices.analytics;
}

/**
 * Envoie un événement du plan de marquage. Silencieux et sans effet tant que la
 * mesure n'est pas autorisée, ou tant que la balise n'est pas chargée.
 */
export function track(event: AnalyticsEvent): void {
  if (!analyticsAllowed()) return;
  window.gtag?.("event", event.name, event.params);
}

/** Bascule l'autorisation côté Google, sans recharger la page. */
export function pushConsentState(granted: boolean): void {
  if (typeof window === "undefined") return;
  window.gtag?.("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

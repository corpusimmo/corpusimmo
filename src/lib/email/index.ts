/**
 * Sélection du transporteur.
 *
 * `console` est le défaut et fonctionne toujours. Un fournisseur réel ne prend
 * la main que si son nom ET sa clé sont présents : un nom de fournisseur sans
 * clé qui retomberait silencieusement sur la console serait exactement la
 * dégradation muette que ce produit refuse ailleurs sur les prix. Il journalise
 * donc une fois, et dit pourquoi.
 */

import { env } from "@/config/env";

import { createBrevoMailer } from "./brevo";
import { createConsoleMailer } from "./console";
import { createResendMailer } from "./resend";
import type { EmailProvider, Mailer } from "./types";

export type {
  EmailMessage,
  EmailProvider,
  EmailSendResult,
  EmailTemplate,
  Mailer,
} from "./types";
export { maskEmail } from "./types";
export { renderEstimationReadyEmail } from "./templates/estimation-ready";
export { parseSender } from "./brevo";

let cached: Mailer | null = null;
let warned = false;

const FACTORIES: Record<
  Exclude<EmailProvider, "console">,
  (apiKey: string) => Mailer
> = {
  brevo: createBrevoMailer,
  resend: createResendMailer,
};

export function getMailer(): Mailer {
  if (cached) return cached;

  const requested = env.email.provider;

  if (requested !== "console") {
    const key = env.email.apiKey;
    if (key) {
      cached = FACTORIES[requested](key);
      return cached;
    }
    if (!warned) {
      warned = true;
      console.warn(
        `[email] EMAIL_PROVIDER=${requested} mais EMAIL_PROVIDER_KEY est absent : ` +
          "les e-mails seront seulement journalisés.",
      );
    }
  }

  cached = createConsoleMailer();
  return cached;
}

/** Quel transporteur est réellement actif — pour les journaux et les diagnostics. */
export function getMailerProvider(): EmailProvider {
  return getMailer().provider;
}

/** Aide de test. */
export function resetMailer(): void {
  cached = null;
  warned = false;
}

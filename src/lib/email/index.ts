/**
 * Mailer selection.
 *
 * `console` is the default and always works. `resend` takes over only when BOTH
 * `EMAIL_PROVIDER=resend` and `EMAIL_PROVIDER_KEY` are present — a provider name
 * without a key silently falling back would be exactly the kind of quiet
 * degradation this codebase refuses, so it logs once and says why.
 */

import { env } from "@/config/env";

import { createConsoleMailer } from "./console";
import { createResendMailer } from "./resend";
import type { Mailer } from "./types";

export type { EmailMessage, EmailSendResult, EmailTemplate, Mailer } from "./types";
export { maskEmail } from "./types";
export { renderEstimationReadyEmail } from "./templates/estimation-ready";

let cached: Mailer | null = null;
let warned = false;

export function getMailer(): Mailer {
  if (cached) return cached;

  if (env.email.provider === "resend") {
    const key = env.email.apiKey;
    if (key) {
      cached = createResendMailer(key);
      return cached;
    }
    if (!warned) {
      warned = true;
      console.warn(
        "[email] EMAIL_PROVIDER=resend mais EMAIL_PROVIDER_KEY est absent : " +
          "les e-mails seront seulement journalisés.",
      );
    }
  }

  cached = createConsoleMailer();
  return cached;
}

/** Which mailer is live — for the honest banner in the UI / health checks. */
export function getMailerProvider(): "console" | "resend" {
  return getMailer().provider;
}

/** Test helper. */
export function resetMailer(): void {
  cached = null;
  warned = false;
}

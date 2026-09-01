/**
 * Resend adapter — plain `fetch`, no SDK.
 *
 * The REST surface we need is a single POST; adding `resend` to package.json
 * would buy an extra dependency (and its transitive tree) for an object literal.
 * If a second provider ever shows up, it lands next to this file with the same
 * `Mailer` shape.
 */

import { env } from "@/config/env";

import { maskEmail, type EmailMessage, type EmailSendResult, type Mailer } from "./types";

const ENDPOINT = "https://api.resend.com/emails";
/** A hung SMTP relay must never hold a request handler open. */
const TIMEOUT_MS = 10_000;

interface ResendSuccess {
  id: string;
}

function isResendSuccess(value: unknown): value is ResendSuccess {
  return typeof value === "object" && value !== null && typeof (value as ResendSuccess).id === "string";
}

export function createResendMailer(apiKey: string): Mailer {
  return {
    provider: "resend",
    async send(message: EmailMessage): Promise<EmailSendResult> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: env.email.from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
            ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.error(
            `[email:resend] envoi refusé (${response.status}) pour ${maskEmail(message.to)} — ${detail.slice(0, 200)}`,
          );
          return {
            id: `resend_failed_${Date.now().toString(36)}`,
            delivered: false,
            provider: "resend",
            error: `HTTP ${response.status}`,
          };
        }

        const payload: unknown = await response.json().catch(() => null);
        const id = isResendSuccess(payload) ? payload.id : `resend_${Date.now().toString(36)}`;
        return { id, delivered: true, provider: "resend" };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "erreur inconnue";
        console.error(`[email:resend] envoi impossible pour ${maskEmail(message.to)} — ${reason}`);
        return {
          id: `resend_error_${Date.now().toString(36)}`,
          delivered: false,
          provider: "resend",
          error: reason,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

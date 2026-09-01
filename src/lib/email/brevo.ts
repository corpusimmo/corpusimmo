/**
 * Adaptateur transactionnel Brevo — `fetch` nu, sans SDK.
 *
 * La surface REST dont nous avons besoin tient en un POST. Ajouter le SDK
 * reviendrait à tirer un arbre de dépendances entier pour un objet littéral.
 *
 * POURQUOI BREVO PLUTÔT QUE RESEND — le raisonnement complet est dans
 * `docs/emails.md`. En une phrase : la séquence de relance et la liste de
 * contacts sont natives chez Brevo, elles seraient à construire ailleurs, et
 * l'éditeur est français avec un hébergement UE — ce qui compte quand la base
 * porte des consentements de vendeurs particuliers.
 */

import { env } from "@/config/env";

import { maskEmail, type EmailMessage, type EmailSendResult, type Mailer } from "./types";

const ENDPOINT = "https://api.brevo.com/v3/smtp/email";
/** Un relais qui ne répond pas ne doit jamais retenir un gestionnaire de requête. */
const TIMEOUT_MS = 10_000;

interface BrevoSuccess {
  messageId: string;
}

function isBrevoSuccess(value: unknown): value is BrevoSuccess {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as BrevoSuccess).messageId === "string"
  );
}

/**
 * `CorpusImmo <contact@corpusimmo.fr>` → `{ name, email }`.
 *
 * Brevo veut un expéditeur structuré là où Resend accepte la forme RFC 5322
 * d'une seule pièce. On analyse plutôt que de dupliquer la configuration : une
 * seule variable `EMAIL_FROM` doit servir les deux fournisseurs, sinon elles
 * divergeront le jour où l'une des deux sera modifiée.
 */
export function parseSender(from: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/.exec(from);
  if (match) {
    const name = match[1]?.replace(/^"|"$/g, "").trim();
    const email = match[2]?.trim() ?? "";
    return name ? { name, email } : { email };
  }
  return { email: from.trim() };
}

export function createBrevoMailer(apiKey: string): Mailer {
  return {
    provider: "brevo",
    async send(message: EmailMessage): Promise<EmailSendResult> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "api-key": apiKey,
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: parseSender(env.email.from),
            to: [{ email: message.to }],
            subject: message.subject,
            htmlContent: message.html,
            textContent: message.text,
            ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.error(
            `[email:brevo] envoi refusé (${response.status}) pour ${maskEmail(message.to)} — ${detail.slice(0, 200)}`,
          );
          return {
            id: `brevo_failed_${Date.now().toString(36)}`,
            delivered: false,
            provider: "brevo",
            error: `HTTP ${response.status}`,
          };
        }

        const payload: unknown = await response.json().catch(() => null);
        const id = isBrevoSuccess(payload) ? payload.messageId : `brevo_${Date.now().toString(36)}`;
        return { id, delivered: true, provider: "brevo" };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "erreur inconnue";
        console.error(`[email:brevo] envoi impossible pour ${maskEmail(message.to)} — ${reason}`);
        return {
          id: `brevo_error_${Date.now().toString(36)}`,
          delivered: false,
          provider: "brevo",
          error: reason,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

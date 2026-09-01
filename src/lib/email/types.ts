/**
 * Mailer contract (CONTRACTS §6).
 *
 * `send` NEVER rejects. A transactional e-mail is a side effect of a business
 * action; failing it must not fail the action. Callers inspect `delivered`.
 */

/**
 * Les fournisseurs implémentés.
 *
 * `console` n'est pas un bouchon : c'est le mode par défaut, et il journalise
 * réellement le message. `brevo` est le fournisseur retenu pour la production —
 * voir `docs/emails.md`. `resend` reste implémenté comme repli : il ne coûte
 * qu'un fichier, et une bascule de fournisseur ne doit jamais demander une
 * réécriture.
 */
export type EmailProvider = "console" | "resend" | "brevo";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface EmailSendResult {
  id: string;
  delivered: boolean;
  /** `console` when the message was only logged. */
  provider: EmailProvider;
  /** French, safe to surface in a server log. Never contains the address. */
  error?: string;
}

export interface Mailer {
  readonly provider: EmailProvider;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * `jean.dupont@exemple.fr` → `j***t@exemple.fr`.
 * Applied to every address that reaches a log line: an application log is not a
 * lawful place to store a contact e-mail in clear text.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length <= 2) return `${local.charAt(0)}***@${domain}`;
  return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`;
}

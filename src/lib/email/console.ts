/**
 * Default mailer: prints a readable summary to the terminal.
 *
 * It is not a no-op stub — during development it is the only way to see that the
 * "estimation prête" e-mail was actually triggered, with what subject and what
 * link. It prints the plain-text body (which contains no secret) and a MASKED
 * recipient, so a shared dev log never leaks a real address.
 */

import { maskEmail, type EmailMessage, type EmailSendResult, type Mailer } from "./types";

function indent(text: string): string {
  return text
    .trim()
    .split("\n")
    .map((line) => `  │ ${line}`)
    .join("\n");
}

export function createConsoleMailer(): Mailer {
  return {
    provider: "console",
    async send(message: EmailMessage): Promise<EmailSendResult> {
      const id = `console_${Date.now().toString(36)}`;
      console.info(
        [
          "",
          "  ┌─ [email:console] message non envoyé (aucun fournisseur configuré)",
          `  │ à       : ${maskEmail(message.to)}`,
          `  │ objet   : ${message.subject}`,
          "  │",
          indent(message.text),
          "  └─────────────────────────────────────────────────────────────",
          "",
        ].join("\n"),
      );
      // `delivered: false` is the honest answer: nothing left the machine.
      return { id, delivered: false, provider: "console" };
    },
  };
}

/**
 * « Votre document est prêt » — le message qui porte le lien de téléchargement.
 *
 * Il ne porte PAS le fichier. Voir `lib/magnets/token.ts` pour le pourquoi :
 * un lien signé se révoque et expire, une pièce jointe ni l'un ni l'autre.
 */

import { siteConfig } from "@/config/site";

import type { EmailTemplate } from "../types";

export interface MagnetReadyInput {
  firstName?: string;
  title: string;
  summary: string;
  /** URL absolue, jeton compris. */
  downloadUrl: string;
  /** Date d'expiration du lien, déjà calculée. */
  expiresAt: Date;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
}

export function renderMagnetReadyEmail(input: MagnetReadyInput): EmailTemplate {
  const { firstName, title, summary, downloadUrl, expiresAt } = input;
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  const validity = `Ce lien est valable jusqu'au ${formatDate(expiresAt)}.`;

  const subject = `${title} — votre lien de téléchargement`;

  const text = [
    greeting,
    "",
    `Voici le document que vous avez demandé : ${title}.`,
    summary,
    "",
    downloadUrl,
    "",
    validity,
    "",
    `— ${siteConfig.name}, ${siteConfig.signature}`,
    "",
    "Vous recevez ce message parce que vous avez demandé ce document sur " +
      `${siteConfig.url}. Pour toute question : ${siteConfig.contactEmail}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:24px;background:#f6f5f2;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#12233d">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2ded4;border-radius:12px">
    <tr><td style="padding:28px 28px 0">
      <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8a6a2f">${siteConfig.name}</p>
      <h1 style="margin:12px 0 0;font-family:Georgia,serif;font-size:24px;line-height:1.2;color:#12233d">${title}</h1>
    </td></tr>
    <tr><td style="padding:20px 28px 0">
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">${greeting}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a5a70">${summary}</p>
      <a href="${downloadUrl}" style="display:inline-block;background:#1b3349;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px">Télécharger le document</a>
      <p style="margin:16px 0 0;font-size:13px;color:#5c6b82">${validity}</p>
    </td></tr>
    <tr><td style="padding:24px 28px 28px">
      <hr style="border:none;border-top:1px solid #efece4;margin:0 0 16px">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#5c6b82">
        Vous recevez ce message parce que vous avez demandé ce document sur
        <a href="${siteConfig.url}" style="color:#8a6a2f">${siteConfig.name}</a>.
        Pour toute question : <a href="mailto:${siteConfig.contactEmail}" style="color:#8a6a2f">${siteConfig.contactEmail}</a>
      </p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}

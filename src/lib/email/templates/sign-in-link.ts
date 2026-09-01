/**
 * « Votre lien de connexion », le message qui remplace un mot de passe.
 *
 * POURQUOI UN LIEN ET PAS UN MOT DE PASSE. Un mot de passe se stocke, se fuit,
 * se réutilise ailleurs, et il faut le réinitialiser. Un lien à usage unique
 * vérifie l'adresse au passage, exactement comme le fait Google, et ne laisse
 * rien à protéger chez nous. C'est la même exigence que pour l'autre voie
 * d'entrée : ce que nous voulons est une ADRESSE PROUVÉE, pas un compte de plus.
 *
 * LE TON EST CELUI D'UN AVERTISSEMENT UTILE, pas d'une promotion. Ce message
 * arrive parfois chez quelqu'un qui n'a rien demandé, parce qu'une autre
 * personne a saisi son adresse par erreur ou par malice. Il doit donc dire, en
 * clair, que ne rien faire suffit.
 */

import { siteConfig } from "@/config/site";

import type { EmailTemplate } from "../types";

export interface SignInLinkInput {
  /** URL absolue, jeton compris. */
  url: string;
  /** Date d'expiration du lien, déjà calculée. */
  expiresAt: Date;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function renderSignInLinkEmail({ url, expiresAt }: SignInLinkInput): EmailTemplate {
  const validity = `Ce lien est valable jusqu'au ${formatDateTime(expiresAt)}, et une seule fois.`;
  const ignore =
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : " +
    "sans clic, il ne se passe rien, et aucun compte n'est créé.";

  const subject = `Votre lien de connexion à ${siteConfig.name}`;

  const text = [
    "Bonjour,",
    "",
    `Voici votre lien de connexion à ${siteConfig.name} :`,
    "",
    url,
    "",
    validity,
    "",
    ignore,
    "",
    `${siteConfig.name}, ${siteConfig.signature}`,
    "",
    `Pour toute question : ${siteConfig.contactEmail}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:24px;background:#f6f5f2;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#12233d">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2ded4;border-radius:12px">
    <tr><td style="padding:28px 28px 0">
      <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8a6a2f">${siteConfig.name}</p>
      <h1 style="margin:12px 0 0;font-family:Georgia,serif;font-size:24px;line-height:1.2;color:#12233d">Votre lien de connexion</h1>
    </td></tr>
    <tr><td style="padding:20px 28px 0">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Bonjour,</p>
      <a href="${url}" style="display:inline-block;background:#1b3349;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px">Me connecter</a>
      <p style="margin:16px 0 0;font-size:13px;color:#5c6b82">${validity}</p>
      <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#5c6b82">${ignore}</p>
    </td></tr>
    <tr><td style="padding:24px 28px 28px">
      <hr style="border:none;border-top:1px solid #efece4;margin:0 0 16px">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#5c6b82">
        Ce message a été demandé depuis
        <a href="${siteConfig.url}" style="color:#8a6a2f">${siteConfig.name}</a>.
        Pour toute question : <a href="mailto:${siteConfig.contactEmail}" style="color:#8a6a2f">${siteConfig.contactEmail}</a>
      </p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}

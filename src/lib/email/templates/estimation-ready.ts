/**
 * « Votre estimation est prête » — the only transactional e-mail of the MVP.
 *
 * COLOUR EXCEPTION (CONTRACTS §0.3): an e-mail client understands neither
 * Tailwind nor CSS custom properties. The hex values below are copied ONCE from
 * the brand ramp in `src/app/globals.css` and are confined to this file. Nothing
 * else in the codebase may hardcode a colour.
 *
 * Layout constraints of the medium: tables, inline styles, no flex/grid, max
 * 600px, and a `text` alternative that is genuinely readable on its own (many
 * recipients — and every spam filter — see only that one).
 */

import { disclaimers, siteConfig } from "@/config/site";
import { formatArea, formatPrice, formatPricePerSqm } from "@/lib/utils/format";
import type { ValuationResult } from "@/types/valuation";
import { PROPERTY_TYPE_LABELS } from "@/types/property";

import type { EmailTemplate } from "../types";

const BRAND = {
  primary: "#2145e6",
  primaryDark: "#131c4c",
  ink: "#0c1425",
  inkMuted: "#6b7793",
  border: "#e1e6f0",
  surface: "#ffffff",
  canvas: "#f6f8fc",
  soft: "#eff4ff",
} as const;

/** Minimal escaping — every interpolated value below is user- or DVF-sourced. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CONFIDENCE_LABELS = {
  low: "faible",
  moderate: "modérée",
  high: "élevée",
} as const;

export interface EstimationReadyInput {
  valuation: ValuationResult;
  firstName: string;
  /** Absolute URL of the result page. */
  estimationUrl: string;
  /** Absolute URL of the PDF. Optional: the button is dropped when absent. */
  pdfUrl?: string;
}

export function renderEstimationReadyEmail(input: EstimationReadyInput): EmailTemplate {
  const { valuation, firstName, estimationUrl, pdfUrl } = input;
  const address = valuation.subject.address.label;
  const typeLabel = PROPERTY_TYPE_LABELS[valuation.subject.type];
  const area = valuation.subject.features.livingArea;

  const hasValue = valuation.value !== undefined;
  const central = hasValue ? formatPrice(valuation.value?.central) : "—";
  const low = hasValue ? formatPrice(valuation.value?.low) : "—";
  const high = hasValue ? formatPrice(valuation.value?.high) : "—";
  const perSqm = formatPricePerSqm(valuation.pricePerSqm);
  const confidence = CONFIDENCE_LABELS[valuation.confidence.level];
  const retained = valuation.diagnostics.retained;

  const subject = hasValue
    ? `Votre estimation ${siteConfig.name} : ${low} – ${high}`
    : `Votre estimation ${siteConfig.name} est disponible`;

  const headline = hasValue
    ? `Entre ${low} et ${high}`
    : "Nous n'avons pas pu conclure sur une fourchette";

  const subline = hasValue
    ? `Valeur centrale estimée : ${central}${valuation.pricePerSqm ? ` — soit ${perSqm}` : ""}`
    : "Trop peu de ventes comparables ont été trouvées autour de votre bien.";

  // --- HTML ------------------------------------------------------------------
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(subline)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.canvas};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <tr><td style="background:${BRAND.primaryDark};padding:20px 28px;">
    <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:-0.2px;">${esc(siteConfig.name)}</span>
    <span style="color:#9db0f5;font-size:13px;"> &nbsp;·&nbsp; estimation immobilière</span>
  </td></tr>

  <tr><td style="padding:28px 28px 8px 28px;">
    <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${BRAND.ink};">Bonjour ${esc(firstName)},</p>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.6;color:${BRAND.inkMuted};">
      Votre estimation est prête. Elle a été calculée à partir des ventes réellement
      enregistrées autour de&nbsp;: <strong style="color:${BRAND.ink};">${esc(address)}</strong>.
    </p>
  </td></tr>

  <tr><td style="padding:0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.soft};border-radius:12px;">
      <tr><td style="padding:22px 24px;text-align:center;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${BRAND.primary};font-weight:700;">Fourchette estimée</div>
        <div style="margin-top:8px;font-size:26px;line-height:1.25;font-weight:800;color:${BRAND.primaryDark};">${esc(headline)}</div>
        <div style="margin-top:8px;font-size:14px;color:${BRAND.inkMuted};">${esc(subline)}</div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 28px 4px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:${BRAND.ink};">
      ${row("Bien", `${esc(typeLabel)}${area ? ` · ${esc(formatArea(area))}` : ""}`)}
      ${row("Confiance", `${esc(confidence)} (${valuation.confidence.score}/100)`)}
      ${row("Ventes comparables retenues", String(retained))}
    </table>
  </td></tr>

  <tr><td style="padding:24px 28px 8px 28px;" align="center">
    <a href="${esc(estimationUrl)}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 26px;border-radius:10px;">Voir mon estimation détaillée</a>
    ${
      pdfUrl
        ? `<div style="margin-top:12px;"><a href="${esc(pdfUrl)}" style="color:${BRAND.primary};font-size:14px;text-decoration:underline;">Télécharger le PDF</a></div>`
        : ""
    }
  </td></tr>

  <tr><td style="padding:20px 28px 26px 28px;">
    <p style="margin:0;font-size:11.5px;line-height:1.65;color:${BRAND.inkMuted};border-top:1px solid ${BRAND.border};padding-top:16px;">
      ${esc(disclaimers.long)}
    </p>
    <p style="margin:12px 0 0 0;font-size:11.5px;line-height:1.65;color:${BRAND.inkMuted};">
      ${esc(disclaimers.dvfSource)}
    </p>
  </td></tr>

  <tr><td style="background:${BRAND.canvas};padding:16px 28px;border-top:1px solid ${BRAND.border};">
    <p style="margin:0;font-size:11.5px;color:${BRAND.inkMuted};">
      Vous recevez cet e-mail parce que vous avez demandé une estimation sur ${esc(siteConfig.name)}.
      Pour toute question&nbsp;: ${esc(siteConfig.contactEmail)}
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  // --- Texte brut ------------------------------------------------------------
  const text = [
    `Bonjour ${firstName},`,
    "",
    `Votre estimation ${siteConfig.name} est prête.`,
    `Bien : ${typeLabel}${area ? ` — ${formatArea(area)}` : ""}`,
    `Adresse : ${address}`,
    "",
    hasValue ? `Fourchette estimée : ${low} – ${high}` : "Fourchette : non concluante",
    hasValue ? `Valeur centrale : ${central}` : "",
    valuation.pricePerSqm ? `Prix au m² retenu : ${perSqm}` : "",
    `Confiance : ${confidence} (${valuation.confidence.score}/100)`,
    `Ventes comparables retenues : ${retained}`,
    "",
    `Estimation détaillée : ${estimationUrl}`,
    pdfUrl ? `PDF : ${pdfUrl}` : "",
    "",
    "---",
    disclaimers.long,
    "",
    disclaimers.dvfSource,
    "",
    `Contact : ${siteConfig.contactEmail}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
}

function row(label: string, value: string): string {
  return `<tr>
        <td style="padding:7px 0;color:${BRAND.inkMuted};font-size:13.5px;">${esc(label)}</td>
        <td style="padding:7px 0;text-align:right;font-weight:600;font-size:13.5px;">${value}</td>
      </tr>`;
}

/**
 * Accès typé et validé paresseusement à l'environnement.
 *
 * Le point entier : l'application doit DÉMARRER et être utilisable avec un
 * `.env` vide. Une intégration absente dégrade vers un comportement documenté,
 * jamais vers une exception à l'import — ce qui casserait `next build` sur un
 * clone neuf, et c'est précisément ce que la CI vérifie à chaque push.
 */

import { z } from "zod";
import { resolveAppUrl } from "./app-url";
import { cleanEnv } from "@/lib/utils/env-value";

const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // --- Cartographie ---
  NEXT_PUBLIC_MAP_STYLE_URL: z.string().url().optional(),

  // --- Transactions ---
  DVF_PROVIDER: z.enum(["geodvf", "cerema"]).optional(),
  USE_MOCK_DVF: z.enum(["true", "false"]).optional(),

  // --- E-mail ---
  EMAIL_PROVIDER: z.enum(["console", "resend", "brevo"]).optional(),
  EMAIL_PROVIDER_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  /** Liste Brevo qui reçoit les inscrits à la lettre d'information. */
  BREVO_NEWSLETTER_LIST_ID: z.coerce.number().int().positive().optional(),
  /** Liste Brevo qui reçoit les contacts issus d'une estimation. */
  BREVO_LEADS_LIST_ID: z.coerce.number().int().positive().optional(),

  // --- Signature des liens de téléchargement ---
  DOWNLOAD_SIGNING_SECRET: z.string().min(32).optional(),
});

const parsed = schema.safeParse(process.env);

const raw = parsed.success ? parsed.data : ({} as z.infer<typeof schema>);

if (!parsed.success && process.env.NODE_ENV !== "production") {
  // Avertir, jamais interrompre : une variable optionnelle mal formée ne doit
  // pas empêcher `pnpm dev` de démarrer.
  console.warn(
    "[env] Certaines variables d'environnement sont invalides et seront ignorées :",
    parsed.error.issues.map((i) => i.path.join(".")).join(", "),
  );
}

const isProduction = process.env.NODE_ENV === "production";

/**
 * Le jeu de démonstration est une trappe de DÉVELOPPEMENT.
 *
 * Même si quelqu'un pose `USE_MOCK_DVF=true` sur la plateforme d'hébergement,
 * la production refuse de servir des prix fabriqués. Ce n'est pas une
 * précaution : c'est la première règle du produit.
 */
const useMockDvf = raw.USE_MOCK_DVF === "true" && !isProduction;

export const env = {
  appUrl: resolveAppUrl(),

  dvf: {
    provider: raw.DVF_PROVIDER ?? "geodvf",
    useMock: useMockDvf,
  },

  email: {
    provider: raw.EMAIL_PROVIDER ?? "console",
    apiKey: raw.EMAIL_PROVIDER_KEY,
    /**
     * L'expéditeur par défaut est la MÊME adresse que celle publiée sur le
     * site (`siteConfig.contactEmail`), et c'est délibéré.
     *
     * Une adresse d'envoi spécialisée — `estimation@`, `notifications@` — se
     * périme dès le deuxième type de message, et une adresse `no-reply@` est
     * pire : elle dégrade la délivrabilité et ferme la porte au moment précis
     * où quelqu'un a une question. Une seule adresse, relevée, qui reçoit les
     * réponses.
     */
    from: raw.EMAIL_FROM ?? "CorpusImmo <contact@corpusimmo.fr>",
    isConfigured:
      raw.EMAIL_PROVIDER !== undefined &&
      raw.EMAIL_PROVIDER !== "console" &&
      Boolean(raw.EMAIL_PROVIDER_KEY),
  },

  /**
   * Les listes marketing. Absentes, la synchronisation de contact est
   * simplement sautée — jamais devinée : écrire dans une liste au hasard
   * mélangerait des consentements qui ne se recouvrent pas.
   */
  contacts: {
    newsletterListId: raw.BREVO_NEWSLETTER_LIST_ID,
    leadsListId: raw.BREVO_LEADS_LIST_ID,
  },

  /**
   * Secret de signature des liens de téléchargement.
   *
   * Absent, aucun lien n'est émis et la route de téléchargement refuse tout.
   * On ne se rabat PAS sur un secret par défaut : un secret connu de tous ne
   * signe rien, et un lien signé avec lui serait forgeable par n'importe qui.
   */
  downloadSecret: raw.DOWNLOAD_SIGNING_SECRET,

  isProduction,
} as const;

/**
 * Configuration cartographique publique.
 *
 * `cleanEnv` et non `??` : une variable NEXT_PUBLIC absente est inlinée en
 * chaîne VIDE au build, ce que `??` ne rattrape pas. Voir `lib/utils/env-value.ts`.
 *
 * `undefined` signifie « pas de style imposé » — la carte construit alors le
 * sien, celui du produit. Cette variable ne sert qu'à basculer vers un
 * fournisseur tiers sans toucher au code.
 */
export const mapEnv = {
  styleUrl: cleanEnv(process.env.NEXT_PUBLIC_MAP_STYLE_URL),
} as const;

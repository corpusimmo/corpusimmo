/**
 * LE PLAN DE MARQUAGE, en un seul endroit.
 *
 * Un plan de marquage qui vit dans les composants finit toujours en trois
 * événements qui mesurent la même chose sous trois noms différents, et en un
 * rapport qu'on ne sait plus lire six mois plus tard. Ici, la liste est close
 * et typée : un événement qui n'y figure pas ne compile pas.
 *
 * CE QUI NE PART JAMAIS, ET C'EST UNE RÈGLE, PAS UNE PRÉCAUTION :
 *   · aucune adresse e-mail, aucun nom, aucun numéro de téléphone ;
 *   · aucune adresse postale, même partielle, même géocodée ;
 *   · aucun montant estimé, aucune surface.
 *
 * Ce qui part est délibérément grossier : un type de bien, un département, une
 * confiance arrondie. Un code de commune plus une surface plus un prix
 * suffirait à retrouver un bien ; un département plus un type de bien, non.
 * C'est ce qui permet de mesurer l'usage sans transformer un outil d'estimation
 * en fichier de prospects chez un tiers.
 *
 * Les noms sont en anglais parce que c'est la convention de GA4 et que les
 * rapports intégrés s'y accrochent. Les libellés lus par des humains, eux,
 * restent en français, dans l'interface.
 */

/** Tranche de confiance, pour ne pas transmettre un score au point près. */
export type ConfidenceBand = "faible" | "moyenne" | "forte";

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 70) return "forte";
  if (score >= 45) return "moyenne";
  return "faible";
}

/** Tranche d'effectif : « 6 comparables » est un chiffre, pas une identité. */
export function countBand(count: number): string {
  if (count === 0) return "0";
  if (count < 5) return "1-4";
  if (count < 15) return "5-14";
  if (count < 40) return "15-39";
  return "40+";
}

export type AnalyticsEvent =
  /* ------------------------------------------------------- navigation -- */
  | { name: "page_view"; params: { page_path: string; page_title: string } }
  | { name: "scroll_depth"; params: { percent: 25 | 50 | 75 | 100; page_path: string } }
  | { name: "outbound_click"; params: { domain: string } }
  | { name: "cta_click"; params: { cta: string; location: string } }

  /* ------------------------------------------------------ estimation -- */
  | { name: "estimation_started"; params: { usage: string } }
  | { name: "estimation_step"; params: { step_index: number; step_name: string } }
  | {
      name: "estimation_completed";
      params: {
        property_type: string;
        department: string;
        confidence: ConfidenceBand;
        comparables: string;
        concluded: boolean;
      };
    }
  | { name: "estimation_failed"; params: { reason: string } }
  | { name: "estimation_pdf"; params: { property_type: string } }
  | { name: "estimation_restarted"; params: Record<string, never> }

  /* ----------------------------------------------------------- outils -- */
  | { name: "tool_view"; params: { tool_id: string } }
  | { name: "tool_unlock_attempt"; params: { tool_id: string } }
  | { name: "tool_unlocked"; params: { tool_id: string; newsletter: boolean } }
  | { name: "tool_unlock_refused"; params: { tool_id: string; reason: string } }
  | { name: "tool_reopened"; params: { tool_id: string } }
  | { name: "tool_saved"; params: { tool_id: string } }
  | { name: "tool_unsaved"; params: { tool_id: string } }
  | { name: "tool_computed"; params: { tool_id: string } }
  | { name: "quota_exhausted"; params: { tool_id: string } }
  | { name: "preview_opened"; params: { tool_id: string; tab: string } }

  /* ------------------------------------------------ carte et données -- */
  | { name: "map_search"; params: { department: string } }
  | { name: "map_filter"; params: { filter: string; value: string } }
  | { name: "transaction_opened"; params: { property_type: string; department: string } }
  | { name: "comparable_added"; params: { property_type: string } }
  | { name: "comparable_removed"; params: { property_type: string } }
  | { name: "observatory_search"; params: { department: string } }

  /* -------------------------------------------------------- contacts -- */
  | { name: "newsletter_subscribed"; params: { source: string } }
  | { name: "lead_submitted"; params: { intent: string; department: string } }
  | { name: "login_started"; params: { provider: string } }

  /* ------------------------------------------------ espace et compte -- */
  | { name: "account_space_viewed"; params: { unlocked: string; saved: string } }
  | { name: "estimation_history_cleared"; params: Record<string, never> }

  /* ------------------------------------------------------------- PWA -- */
  | { name: "pwa_prompt_shown"; params: { platform: string } }
  | { name: "pwa_installed"; params: { platform: string } }
  | { name: "pwa_prompt_dismissed"; params: { platform: string } };

export type AnalyticsEventName = AnalyticsEvent["name"];

/**
 * Le département depuis un code INSEE de commune ou un code postal.
 * Corse et outre-mer compris : `2A004` donne `2A`, `97411` donne `974`.
 */
export function departmentOf(codeOrPostcode: string | undefined): string {
  if (!codeOrPostcode) return "inconnu";
  const code = codeOrPostcode.trim().toUpperCase();
  if (code.startsWith("2A") || code.startsWith("2B")) return code.slice(0, 2);
  if (code.startsWith("97") || code.startsWith("98")) return code.slice(0, 3);
  return code.slice(0, 2) || "inconnu";
}

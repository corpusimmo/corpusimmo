/**
 * LES SIX DOCUMENTS COMMERCIAUX, ET CE QUI LES SÉPARE.
 *
 * Ce fichier est la source unique de vérité du générateur. Tout le reste —
 * la page de présentation, les formulaires, les trames, le moteur de rendu —
 * le lit. Deux définitions concurrentes finiraient par diverger, et ce qui
 * divergerait ici n'est pas cosmétique : c'est le niveau de confidentialité
 * d'un document envoyé à des tiers.
 *
 * ── POURQUOI CE N'EST PAS UNE SIMPLE LISTE DE MODÈLES ──────────────────────
 * Ces documents sont couramment confondus, y compris par des professionnels
 * expérimentés, parce qu'ils se ressemblent en surface : des pages, un bien,
 * des chiffres. Ils diffèrent en réalité sur trois axes qui n'ont rien de
 * décoratif — l'AUDIENCE, le moment dans la négociation, et surtout ce qu'on a
 * le DROIT d'y écrire.
 *
 * Le cas qui commande tout le reste est le couple teaser / mémorandum. Un
 * teaser circule AVANT tout engagement de confidentialité : il doit intéresser
 * sans permettre d'identifier l'actif. Un teaser qui laisse fuir l'adresse ou
 * le nom du propriétaire est une faute professionnelle — le vendeur apprend sa
 * mise en vente par un tiers. Le mémorandum, lui, part APRÈS signature d'un
 * accord de confidentialité, et nomme tout.
 *
 * D'où `forbiddenFields` : sur un document anonyme, certains champs ne sont
 * pas « décochés par défaut », ils sont INTERDITS. Une case décochée se
 * recoche par inadvertance ; un champ absent du formulaire ne fuit pas.
 *
 * ── CE QUE LE GÉNÉRATEUR NE FERA JAMAIS ────────────────────────────────────
 * Aucun chiffre publié ici ne viendra d'un modèle de langage. Les comparables,
 * les médianes, l'évolution, le zonage et l'environnement sont calculés par
 * nos moteurs et injectés tels quels ; la rédaction ne fait que les habiller.
 * C'est la même règle que le reste du site — et sur un avis de valeur, qui
 * engage la signature d'un professionnel, une valeur hallucinée serait une
 * faute grave.
 */

/** Ce qui distingue vraiment les documents entre eux. */
export type Confidentiality =
  /** Diffusable largement : l'actif ne doit pas être identifiable. */
  | "anonyme"
  /** Nominatif, mais destiné à circuler : rien de confidentiel. */
  | "nominatif"
  /** Ne part qu'après signature d'un accord de confidentialité. */
  | "sous-nda";

/** Champs sensibles dont la présence dépend du type de document. */
export type SensitiveField =
  | "adresse"
  | "proprietaire"
  | "prix"
  | "baux"
  | "locataires"
  | "diagnostics";

export const SENSITIVE_FIELD_LABELS: Record<SensitiveField, string> = {
  adresse: "Adresse exacte",
  proprietaire: "Identité du propriétaire",
  prix: "Prix ou valeur",
  baux: "Baux et rent roll",
  locataires: "Identité des locataires",
  diagnostics: "Diagnostics et audits",
};

export interface DocumentSection {
  id: string;
  label: string;
  /** Vrai quand la section est cochée à l'ouverture du formulaire. */
  defaultOn: boolean;
  /**
   * Vrai quand la section est alimentée par NOS données plutôt que par la
   * saisie ou la rédaction. C'est ce qui sépare ce produit d'un habillage de
   * modèle de langage, et l'interface doit le montrer.
   */
  computed?: boolean;
}

export interface DocumentKind {
  id: string;
  /** Le nom du métier, pas un nom d'interface. */
  label: string;
  /** À qui ça s'adresse, en une ligne. */
  audience: string;
  /** À quel moment ça sert, en une ligne. */
  moment: string;
  /** Volume habituel, en pages. */
  pages: string;
  confidentiality: Confidentiality;
  /**
   * L'erreur classique sur ce document. Affichée telle quelle : c'est la
   * phrase qui évite la confusion, plus utile qu'une définition.
   */
  pitfall: string;
  /** Ce avec quoi on le confond, et pourquoi ce n'est pas la même chose. */
  notToConfuse?: string;
  /** Champs que le formulaire ne proposera PAS pour ce type. */
  forbiddenFields: readonly SensitiveField[];
  sections: readonly DocumentSection[];
  /** Le générateur complet est-il ouvert, ou seulement la trame ? */
  availability: "trame" | "complet";
}

/* ── Sections réutilisées ────────────────────────────────────────────────── */

const S = {
  synthese: { id: "synthese", label: "Synthèse", defaultOn: true },
  bien: { id: "bien", label: "Description du bien", defaultOn: true },
  localisation: { id: "localisation", label: "Localisation et accès", defaultOn: true },
  marche: {
    id: "marche",
    label: "Contexte de marché",
    defaultOn: true,
    computed: true,
  },
  comparables: {
    id: "comparables",
    label: "Ventes comparables (DVF)",
    defaultOn: true,
    computed: true,
  },
  environnement: {
    id: "environnement",
    label: "Environnement et zonage",
    defaultOn: false,
    computed: true,
  },
  valeur: { id: "valeur", label: "Fourchette de valeur", defaultOn: true },
  methode: { id: "methode", label: "Méthode retenue", defaultOn: true },
  baux: { id: "baux", label: "Baux et revenus", defaultOn: true },
  technique: { id: "technique", label: "État technique", defaultOn: false },
  juridique: { id: "juridique", label: "Situation juridique", defaultOn: false },
  fiscal: { id: "fiscal", label: "Régime fiscal", defaultOn: false },
  agence: { id: "agence", label: "Présentation de l'agence", defaultOn: true },
  references: { id: "references", label: "Références et mandats", defaultOn: true },
  plan: { id: "plan", label: "Plan de commercialisation", defaultOn: true },
  honoraires: { id: "honoraires", label: "Honoraires", defaultOn: false },
  offre: { id: "offre", label: "Modalités de l'offre", defaultOn: true },
  annexes: { id: "annexes", label: "Annexes", defaultOn: false },
} as const satisfies Record<string, DocumentSection>;

/* ── Le catalogue ────────────────────────────────────────────────────────── */

export const DOCUMENT_KINDS: readonly DocumentKind[] = [
  {
    id: "teaser",
    label: "Teaser",
    audience: "Le marché large, avant tout engagement",
    moment: "Premier contact, pour susciter une demande d'information",
    pages: "1 à 2 pages",
    confidentiality: "anonyme",
    pitfall:
      "Un teaser doit intéresser sans permettre d'identifier l'actif. L'adresse exacte et le nom du propriétaire n'y figurent jamais : le vendeur ne doit pas apprendre sa mise en vente par un tiers.",
    notToConfuse:
      "Ce n'est pas une plaquette raccourcie : c'est un document anonyme par construction.",
    forbiddenFields: ["adresse", "proprietaire", "locataires", "diagnostics"],
    sections: [S.synthese, S.bien, S.localisation, S.marche, S.offre],
    availability: "trame",
  },
  {
    id: "memorandum",
    label: "Mémorandum d'information",
    audience: "Les candidats ayant signé un accord de confidentialité",
    moment: "Après le teaser, pour instruire une offre",
    pages: "20 à 60 pages",
    confidentiality: "sous-nda",
    pitfall:
      "Tout y est nommé : baux, revenus, technique, juridique. Il ne se diffuse donc qu'après signature, et sa liste de destinataires se tient.",
    notToConfuse:
      "Ce n'est pas un dossier de présentation étoffé : le niveau de détail engage la responsabilité de celui qui le transmet.",
    forbiddenFields: [],
    sections: [
      S.synthese,
      S.bien,
      S.localisation,
      S.marche,
      S.comparables,
      S.baux,
      S.technique,
      S.juridique,
      S.fiscal,
      S.environnement,
      S.offre,
      S.annexes,
    ],
    availability: "trame",
  },
  {
    id: "avis-de-valeur",
    label: "Avis de valeur",
    audience: "Un mandant : propriétaire, notaire, dirigeant",
    moment: "Avant la mise en vente, ou pour un arbitrage",
    pages: "3 à 8 pages",
    confidentiality: "nominatif",
    pitfall:
      "Un avis de valeur n'est PAS une expertise. Il est signé par un professionnel qui en répond, et ne tient compte ni de l'état intérieur ni du contexte de la vente s'il n'a pas visité.",
    notToConfuse:
      "L'expertise en évaluation immobilière obéit à une charte et à des qualifications propres. Le mot compte.",
    forbiddenFields: [],
    sections: [
      S.synthese,
      S.bien,
      S.localisation,
      S.marche,
      S.comparables,
      S.environnement,
      S.methode,
      S.valeur,
      S.annexes,
    ],
    availability: "trame",
  },
  {
    id: "dossier-presentation",
    label: "Dossier de présentation",
    audience: "Les acquéreurs d'un bien déjà commercialisé",
    moment: "Pendant la commercialisation",
    pages: "6 à 15 pages",
    confidentiality: "nominatif",
    pitfall:
      "Commercial, mais vérifiable : chaque chiffre avancé doit pouvoir être justifié en rendez-vous. C'est là que se joue la crédibilité du mandat.",
    forbiddenFields: ["proprietaire"],
    sections: [
      S.synthese,
      S.bien,
      S.localisation,
      S.marche,
      S.comparables,
      S.environnement,
      S.baux,
      S.offre,
      S.annexes,
    ],
    availability: "trame",
  },
  {
    id: "pitch-mandat",
    label: "Pitch de mandat",
    audience: "Un propriétaire qu'il s'agit de convaincre",
    moment: "Avant la signature du mandat",
    pages: "5 à 10 pages",
    confidentiality: "nominatif",
    pitfall:
      "Ce document parle de VOUS, pas du bien : méthode, références, plan de commercialisation. L'erreur courante est d'y recopier la plaquette du bien.",
    forbiddenFields: ["baux", "locataires", "diagnostics"],
    sections: [
      S.agence,
      S.references,
      S.marche,
      S.comparables,
      S.plan,
      S.honoraires,
    ],
    availability: "trame",
  },
  {
    id: "etude-de-marche",
    label: "Étude de marché",
    audience: "Un client, un comité d'investissement, ou vous-même",
    moment: "En amont d'une décision, ou en annexe d'un autre document",
    pages: "5 à 20 pages",
    confidentiality: "nominatif",
    pitfall:
      "Une étude de marché ne vaut que par ses sources. Chaque chiffre doit porter son origine et sa date : sans cela, c'est une opinion mise en pages.",
    forbiddenFields: ["proprietaire", "locataires"],
    sections: [
      S.synthese,
      S.marche,
      S.comparables,
      S.environnement,
      S.annexes,
    ],
    availability: "trame",
  },
] as const;

export function documentKind(id: string): DocumentKind | undefined {
  return DOCUMENT_KINDS.find((kind) => kind.id === id);
}

export const CONFIDENTIALITY_LABELS: Record<
  Confidentiality,
  { label: string; help: string }
> = {
  anonyme: {
    label: "Anonyme",
    help: "L'actif ne doit pas être identifiable : les champs qui le trahiraient ne sont pas proposés.",
  },
  nominatif: {
    label: "Nominatif",
    help: "Le bien est nommé. Rien de confidentiel n'y figure pour autant.",
  },
  "sous-nda": {
    label: "Sous accord de confidentialité",
    help: "Ne se transmet qu'après signature. Tenez la liste de vos destinataires.",
  },
};

/**
 * Les sections effectivement proposées, une fois retirées celles qu'un champ
 * interdit vide de sa substance.
 *
 * Exemple : sur un teaser, « Baux et revenus » n'a pas de sens puisque les
 * locataires ne peuvent pas être nommés. La règle est appliquée ICI, une fois,
 * plutôt que répétée dans chaque formulaire.
 */
export function sectionsFor(kind: DocumentKind): readonly DocumentSection[] {
  const blocked = new Set(kind.forbiddenFields);
  return kind.sections.filter((section) => {
    if (section.id === "baux" && (blocked.has("baux") || blocked.has("locataires"))) {
      return false;
    }
    return true;
  });
}

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

/**
 * LA FORME QUE PREND LE CONTENU D'UNE SECTION.
 *
 * Ce n'est pas de la décoration, c'est de l'information sur la section : un
 * rent roll est un tableau et le sera toujours, une clause de confidentialité
 * est un bloc de texte dense, des photographies veulent une pleine page. La
 * trame livrait jusqu'ici la MÊME diapositive quarante fois, seul le titre du
 * bandeau changeant, ce qui laissait au professionnel exactement le travail
 * qu'on prétendait lui épargner.
 *
 * Le gabarit vit ici, avec la section, et non dans le module qui fabrique le
 * `.pptx` : c'est une propriété du métier, pas du format. Le jour où l'on
 * produira du `.docx` ou du PDF, il servira sans être réécrit.
 */
export type Gabarit =
  /** Un intertitre et une zone de rédaction. Le cas par défaut. */
  | "texte"
  /** Deux volets côte à côte, chacun avec son sous-titre. */
  | "colonnes"
  /** Un vrai tableau, avec sa ligne d'en-tête nommée. */
  | "tableau"
  /** Trois ou quatre indicateurs en pavés. */
  | "chiffres"
  /** Une grande réserve d'image et sa légende. */
  | "image"
  /** Un bloc dense en petit corps : clauses, limites, avertissements. */
  | "legal";

export interface DocumentSection {
  id: string;
  label: string;
  /** Vrai quand la section est cochée à l'ouverture du formulaire. */
  defaultOn: boolean;
  /** La forme du contenu. `texte` quand ce n'est pas précisé. */
  gabarit?: Gabarit;
  /** Gabarit `tableau` : l'en-tête réel des colonnes, dans l'ordre. */
  colonnes?: readonly string[];
  /** Gabarit `chiffres` : les indicateurs à poser, dans l'ordre. */
  indicateurs?: readonly string[];
  /** Gabarit `colonnes` : les deux sous-titres. */
  volets?: readonly [string, string];
  /**
   * CE QU'ON ATTEND DANS CETTE SECTION, en une phrase.
   *
   * Va sur la PAGE DE NOTES de la diapositive, jamais sur la diapositive
   * elle-même. Un texte d'aide posé sur la page est un texte d'aide qu'on
   * oublie d'effacer, et qui part chez le client.
   */
  attendu?: string;
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

/**
 * LE VOCABULAIRE ET L'ORDRE SONT CEUX DE LA PRATIQUE FRANÇAISE.
 *
 * Ce ne sont pas des rubriques inventées : ce sont celles qu'attend un
 * investisseur, un notaire ou un comité d'engagement, dans l'ordre où ils les
 * lisent. Deux conséquences pratiques.
 *
 * L'ORDRE EST UNE INFORMATION. Un mémorandum s'ouvre sur son avertissement de
 * confidentialité et non sur l'actif ; un avis de valeur pose les BASES ET
 * LIMITES de la mission avant de décrire quoi que ce soit, parce que c'est ce
 * qui borne la responsabilité de celui qui signe. Déplacer ces sections en
 * annexe transformerait un document professionnel en plaquette.
 *
 * `computed` MARQUE CE QUE NOS MOTEURS ALIMENTENT. C'est la frontière du
 * produit : ces sections arrivent remplies de valeurs vérifiées, les autres
 * viennent du formulaire et des pièces jointes. Une section calculée ne se
 * rédige pas, elle se contrôle.
 */
const S = {
  /* Cadre et responsabilité */
  avertissement: { id: "avertissement", label: "Avertissement et confidentialité", defaultOn: true },
  mission: { id: "mission", label: "Objet et contexte de la mission", defaultOn: true },
  bases: { id: "bases", label: "Bases et limites de l'avis", defaultOn: true },
  perimetre: { id: "perimetre", label: "Objet et périmètre de l'étude", defaultOn: true },
  methodologie: { id: "methodologie", label: "Méthodologie et sources", defaultOn: true },

  /* L'actif */
  synthese: { id: "synthese", label: "Synthèse de l'opportunité", defaultOn: true },
  designation: { id: "designation", label: "Désignation du bien", defaultOn: true },
  bien: { id: "bien", label: "Description de l'actif", defaultOn: true },
  prestations: { id: "prestations", label: "Prestations et équipements", defaultOn: false },
  photos: { id: "photos", label: "Photographies et plans", defaultOn: true },
  localisation: { id: "localisation", label: "Situation géographique et accessibilité", defaultOn: true },

  /* Ce que nos moteurs alimentent */
  environnement: {
    id: "environnement",
    label: "Environnement, transports et commodités",
    defaultOn: true,
    computed: true,
  },
  urbanisme: { id: "urbanisme", label: "Situation urbanistique et zonage", defaultOn: false, computed: true },
  risques: { id: "risques", label: "Risques et contraintes du site", defaultOn: false, computed: true },
  marche: { id: "marche", label: "Analyse du marché local", defaultOn: true, computed: true },
  comparables: { id: "comparables", label: "Références de comparaison (DVF)", defaultOn: true, computed: true },
  offreDemande: { id: "offre-demande", label: "Offre, demande et absorption", defaultOn: true, computed: true },
  valeurs: { id: "valeurs", label: "Prix, loyers et rendements", defaultOn: true, computed: true },

  /* Exploitation et finance */
  locative: { id: "locative", label: "Situation locative et occupation", defaultOn: true },
  baux: { id: "baux", label: "Baux, rent roll et échéancier", defaultOn: true },
  financier: { id: "financier", label: "Analyse financière et flux", defaultOn: true },
  charges: { id: "charges", label: "Charges et travaux à venir", defaultOn: false },
  fiscal: { id: "fiscal", label: "Régime fiscal", defaultOn: false },

  /* Diligences */
  technique: { id: "technique", label: "État technique et diagnostics", defaultOn: false },
  juridique: { id: "juridique", label: "Situation juridique et administrative", defaultOn: false },

  /* Conclusion */
  methode: { id: "methode", label: "Méthodes d'évaluation retenues", defaultOn: true },
  valeur: { id: "valeur", label: "Valeur retenue et fourchette", defaultOn: true },
  conclusion: { id: "conclusion", label: "Conclusion et signature", defaultOn: true },
  syntheseMarche: { id: "synthese-marche", label: "Synthèse, forces et faiblesses", defaultOn: true },

  /* Commercialisation */
  besoin: { id: "besoin", label: "Compréhension du besoin", defaultOn: true },
  agence: { id: "agence", label: "Présentation du cabinet et de l'équipe", defaultOn: true },
  references: { id: "references", label: "Références et transactions récentes", defaultOn: true },
  positionnement: { id: "positionnement", label: "Positionnement prix conseillé", defaultOn: true },
  plan: { id: "plan", label: "Stratégie et plan de commercialisation", defaultOn: true },
  moyens: { id: "moyens", label: "Moyens de diffusion et marketing", defaultOn: true },
  reporting: { id: "reporting", label: "Reporting et suivi du mandat", defaultOn: false },
  honoraires: { id: "honoraires", label: "Honoraires et conditions", defaultOn: false },
  calendrier: { id: "calendrier", label: "Calendrier", defaultOn: false },

  /* Sortie */
  conditions: { id: "conditions", label: "Conditions financières", defaultOn: true },
  offre: { id: "offre", label: "Modalités de la consultation", defaultOn: true },
  contact: { id: "contact", label: "Contact", defaultOn: true },
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
    sections: [
      S.synthese,
      S.bien,
      S.localisation,
      S.marche,
      S.valeurs,
      S.offre,
      S.contact,
    ],
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
      S.avertissement,
      S.synthese,
      S.designation,
      S.bien,
      S.photos,
      S.localisation,
      S.environnement,
      S.marche,
      S.comparables,
      S.locative,
      S.baux,
      S.financier,
      S.charges,
      S.technique,
      S.juridique,
      S.urbanisme,
      S.risques,
      S.fiscal,
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
      S.mission,
      S.bases,
      S.designation,
      S.localisation,
      S.bien,
      S.locative,
      S.urbanisme,
      S.risques,
      S.marche,
      S.comparables,
      S.methode,
      S.valeur,
      S.conclusion,
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
      S.localisation,
      S.bien,
      S.photos,
      S.prestations,
      S.environnement,
      S.locative,
      S.marche,
      S.comparables,
      S.conditions,
      S.contact,
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
      S.besoin,
      S.agence,
      S.references,
      S.marche,
      S.comparables,
      S.positionnement,
      S.plan,
      S.moyens,
      S.reporting,
      S.calendrier,
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
      S.perimetre,
      S.methodologie,
      S.localisation,
      S.environnement,
      S.offreDemande,
      S.valeurs,
      S.marche,
      S.comparables,
      S.urbanisme,
      S.syntheseMarche,
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
    if (
      (section.id === "baux" || section.id === "locative") &&
      (blocked.has("baux") || blocked.has("locataires"))
    ) {
      return false;
    }
    if (section.id === "photos" && blocked.has("adresse")) {
      // Une façade photographiée identifie l'actif aussi sûrement qu'une
      // adresse : sur un document anonyme, la section n'a pas lieu d'être.
      return false;
    }
    if (section.id === "technique" && blocked.has("diagnostics")) return false;
    return true;
  });
}

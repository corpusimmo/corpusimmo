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
  avertissement: {
    id: "avertissement",
    label: "Avertissement et confidentialité",
    defaultOn: true,
    gabarit: "legal",
    attendu:
      "La clause de confidentialité et la limitation de responsabilité, dans les termes de votre cabinet. Dites que le document ne vaut ni offre ni engagement, et à qui il ne doit pas être transmis.",
  },
  mission: {
    id: "mission",
    label: "Objet et contexte de la mission",
    defaultOn: true,
    attendu:
      "Qui commande, pour quel usage, à quelle date de valeur, et sur quel périmètre. L'usage compte : une valeur pour un partage ne se rédige pas comme une valeur pour une mise en vente.",
  },
  bases: {
    id: "bases",
    label: "Bases et limites de l'avis",
    defaultOn: true,
    gabarit: "legal",
    attendu:
      "Les hypothèses retenues, les pièces reçues, ce que vous n'avez PAS vérifié, et les limites qui en découlent. C'est cette section qui borne votre responsabilité : elle se rédige avant les autres, pas après.",
  },
  perimetre: {
    id: "perimetre",
    label: "Objet et périmètre de l'étude",
    defaultOn: true,
    attendu:
      "Le territoire couvert, les segments retenus, la période observée, et ce qui est explicitement hors champ.",
  },
  methodologie: {
    id: "methodologie",
    label: "Méthodologie et sources",
    defaultOn: true,
    volets: ["Méthodes employées", "Sources et millésimes"],
    gabarit: "colonnes",
    attendu:
      "Les méthodes et les sources, DVF comprise, avec leur millésime. Une source sans date se retourne contre celui qui la cite.",
  },

  /* L'actif */
  synthese: {
    id: "synthese",
    label: "Synthèse de l'opportunité",
    defaultOn: true,
    gabarit: "chiffres",
    indicateurs: ["Typologie", "Surface", "Secteur", "Disponibilité"],
    attendu:
      "Les quatre repères qu'un investisseur lit en premier, puis trois lignes qui disent pourquoi ce dossier mérite la suite. Rien qui identifie l'actif si le document est anonyme.",
  },
  designation: {
    id: "designation",
    label: "Désignation du bien",
    defaultOn: true,
    attendu:
      "L'identification cadastrale et juridique : références de parcelle, lots, tantièmes, nature. C'est la section que reprendra le notaire.",
  },
  bien: {
    id: "bien",
    label: "Description de l'actif",
    defaultOn: true,
    gabarit: "colonnes",
    volets: ["Descriptif", "Points forts"],
    attendu:
      "À gauche ce qui est vérifiable et se mesure, à droite ce qui se plaide. Ne mélangez pas les deux : un comité d'engagement fait le tri lui-même, et il le fait à votre défaveur.",
  },
  prestations: {
    id: "prestations",
    label: "Prestations et équipements",
    defaultOn: false,
    gabarit: "colonnes",
    volets: ["Équipements", "État et entretien"],
    attendu:
      "Chauffage, ascenseur, sécurité, réseaux, stationnement, et leur état réel avec l'année de la dernière intervention.",
  },
  photos: {
    id: "photos",
    label: "Photographies et plans",
    defaultOn: true,
    gabarit: "image",
    attendu:
      "Une vue par page, légendée. Sur un document anonyme, écartez toute prise de vue où une plaque de rue, une enseigne ou un numéro reste lisible.",
  },
  localisation: {
    id: "localisation",
    label: "Situation géographique et accessibilité",
    defaultOn: true,
    gabarit: "image",
    attendu:
      "Un plan de situation et une vue du quartier. Sur un teaser, restez à l'échelle du secteur : un plan trop zoomé désigne l'immeuble.",
  },

  /* Ce que nos moteurs alimentent */
  environnement: {
    id: "environnement",
    label: "Environnement, transports et commodités",
    defaultOn: true,
    computed: true,
    gabarit: "colonnes",
    volets: ["Transports et accès", "Commodités et services"],
    attendu:
      "Alimenté par nos moteurs : arrêts, lignes et temps d'accès d'un côté, équipements et services de l'autre. À contrôler, pas à rédiger.",
  },
  urbanisme: {
    id: "urbanisme",
    label: "Situation urbanistique et zonage",
    defaultOn: false,
    computed: true,
    attendu:
      "Zonage applicable, servitudes repérées, droits à construire résiduels. Calculé, puis confirmé par une lecture du règlement de la commune.",
  },
  risques: {
    id: "risques",
    label: "Risques et contraintes du site",
    defaultOn: false,
    computed: true,
    gabarit: "tableau",
    colonnes: ["Aléa", "Niveau", "Source", "Conséquence pour l'actif"],
    attendu:
      "Repris de Géorisques. La colonne de droite est la vôtre : un aléa sans conséquence énoncée n'informe personne et inquiète tout le monde.",
  },
  marche: {
    id: "marche",
    label: "Analyse du marché local",
    defaultOn: true,
    computed: true,
    gabarit: "chiffres",
    indicateurs: [
      "Médiane au m²",
      "Ventes sur 12 mois",
      "Évolution annuelle",
      "Dispersion",
    ],
    attendu:
      "Calculé sur les mutations enregistrées. Dites toujours sur combien de ventes porte la médiane : une médiane sur onze ventes n'a pas le poids d'une médiane sur six cents.",
  },
  comparables: {
    id: "comparables",
    label: "Références de comparaison (DVF)",
    defaultOn: true,
    computed: true,
    gabarit: "tableau",
    colonnes: ["Date", "Adresse", "Type", "Surface", "Prix", "€/m²"],
    attendu:
      "Les ventes retenues, telles qu'enregistrées. Ajoutez sous le tableau ce que vous avez ÉCARTÉ et pourquoi : c'est ce qui rend l'avis contrôlable.",
  },
  offreDemande: {
    id: "offre-demande",
    label: "Offre, demande et absorption",
    defaultOn: true,
    computed: true,
    gabarit: "chiffres",
    indicateurs: [
      "Offre disponible",
      "Ventes sur 12 mois",
      "Délai d'absorption",
      "Tension",
    ],
    attendu:
      "Le rapport entre ce qui est à vendre et ce qui se vend. C'est cette section qui justifie un délai de commercialisation annoncé.",
  },
  valeurs: {
    id: "valeurs",
    label: "Prix, loyers et rendements",
    defaultOn: true,
    computed: true,
    gabarit: "tableau",
    colonnes: ["Segment", "Prix au m²", "Loyer au m²/an", "Rendement"],
    attendu:
      "Une ligne par segment observé. Précisez si les loyers sont hors droit de bail et hors charges : sans cela le rendement n'est pas comparable.",
  },

  /* Exploitation et finance */
  locative: {
    id: "locative",
    label: "Situation locative et occupation",
    defaultOn: true,
    attendu:
      "Occupé ou libre, taux d'occupation, vacance et son ancienneté. Un immeuble loué et le même immeuble vide ne se valorisent pas de la même façon.",
  },
  baux: {
    id: "baux",
    label: "Baux, rent roll et échéancier",
    defaultOn: true,
    gabarit: "tableau",
    colonnes: [
      "Locataire",
      "Surface",
      "Loyer annuel",
      "Échéance",
      "Indexation",
    ],
    attendu:
      "Le rent roll, ligne par ligne, plus les échéances triennales. C'est la pièce la plus lue d'un mémorandum, et la plus vérifiée.",
  },
  financier: {
    id: "financier",
    label: "Analyse financière et flux",
    defaultOn: true,
    gabarit: "tableau",
    colonnes: ["Poste", "N-1", "N", "N+1"],
    attendu:
      "Revenus, charges, résultat d'exploitation, et les flux projetés avec leurs hypothèses écrites en dessous. Une projection sans hypothèses affichées ne vaut rien.",
  },
  charges: {
    id: "charges",
    label: "Charges et travaux à venir",
    defaultOn: false,
    gabarit: "tableau",
    colonnes: ["Poste", "Montant annuel", "Récupérable", "Échéance"],
    attendu:
      "Charges d'exploitation et travaux votés ou prévisibles. Distinguez le récupérable du non récupérable : c'est ce qui sépare le loyer facial du revenu net.",
  },
  fiscal: {
    id: "fiscal",
    label: "Régime fiscal",
    defaultOn: false,
    attendu:
      "Régime applicable, TVA, droits d'enregistrement, dispositifs en cours. Renvoyez au conseil du client : on expose, on ne conseille pas.",
  },

  /* Diligences */
  technique: {
    id: "technique",
    label: "État technique et diagnostics",
    defaultOn: false,
    gabarit: "tableau",
    colonnes: ["Diagnostic", "Date", "Résultat", "Validité"],
    attendu:
      "Les diagnostics au dossier, avec leur date et leur validité. Un diagnostic périmé se signale comme périmé, il ne se tait pas.",
  },
  juridique: {
    id: "juridique",
    label: "Situation juridique et administrative",
    defaultOn: false,
    attendu:
      "Propriété, servitudes, copropriété, procédures en cours, autorisations. Ce qui est en litige se dit ici, pas en annexe.",
  },

  /* Conclusion */
  methode: {
    id: "methode",
    label: "Méthodes d'évaluation retenues",
    defaultOn: true,
    gabarit: "colonnes",
    volets: ["Méthode retenue", "Pourquoi elle s'applique ici"],
    attendu:
      "Comparaison, capitalisation, bilan promoteur : dites laquelle vous retenez ET pourquoi les autres ont été écartées sur ce bien précis.",
  },
  valeur: {
    id: "valeur",
    label: "Valeur retenue et fourchette",
    defaultOn: true,
    gabarit: "chiffres",
    indicateurs: [
      "Valeur retenue",
      "Fourchette basse",
      "Fourchette haute",
      "Au m² retenu",
    ],
    attendu:
      "La valeur, sa fourchette, et la date de valeur. Une fourchette large est honnête quand le marché est mince : c'est le texte qui l'explique, pas la fourchette qui se resserre.",
  },
  conclusion: {
    id: "conclusion",
    label: "Conclusion et signature",
    defaultOn: true,
    attendu:
      "Le rappel de la valeur, la date, le nom, la qualité et la signature de celui qui engage sa responsabilité. Sans qualité affichée, l'avis ne vaut rien.",
  },
  syntheseMarche: {
    id: "synthese-marche",
    label: "Synthèse, forces et faiblesses",
    defaultOn: true,
    gabarit: "colonnes",
    volets: ["Forces", "Faiblesses"],
    attendu:
      "Deux colonnes honnêtes. Un dossier sans faiblesse énoncée se lit comme un dossier mal instruit.",
  },

  /* Commercialisation */
  besoin: {
    id: "besoin",
    label: "Compréhension du besoin",
    defaultOn: true,
    attendu:
      "Ce que le client vous a dit, reformulé dans ses mots. C'est la page qui décide de la suite : elle prouve que vous avez écouté avant de proposer.",
  },
  agence: {
    id: "agence",
    label: "Présentation du cabinet et de l'équipe",
    defaultOn: true,
    gabarit: "colonnes",
    volets: ["Le cabinet", "L'équipe dédiée"],
    attendu:
      "Qui vous êtes, et surtout QUI travaillera sur ce mandat, avec son rôle. Une plaquette d'agence sans visage se lit comme une plaquette d'agence.",
  },
  references: {
    id: "references",
    label: "Références et transactions récentes",
    defaultOn: true,
    gabarit: "tableau",
    colonnes: ["Bien", "Secteur", "Surface", "Délai de vente", "Année"],
    attendu:
      "Vos ventes comparables à celle-ci. Le délai est la colonne qui convainc : un prix obtenu sans le temps qu'il a fallu ne prouve rien.",
  },
  positionnement: {
    id: "positionnement",
    label: "Positionnement prix conseillé",
    defaultOn: true,
    gabarit: "chiffres",
    indicateurs: [
      "Prix conseillé",
      "Fourchette",
      "Au m²",
      "Délai visé",
    ],
    attendu:
      "Le prix que vous conseillez, appuyé sur la section des comparables. Si le client vise plus haut, écrivez-le ici avec la conséquence sur le délai.",
  },
  plan: {
    id: "plan",
    label: "Stratégie et plan de commercialisation",
    defaultOn: true,
    attendu:
      "La cible d'acquéreurs, l'ordre d'approche, et le déroulé prévu semaine par semaine.",
  },
  moyens: {
    id: "moyens",
    label: "Moyens de diffusion et marketing",
    defaultOn: true,
    gabarit: "colonnes",
    volets: ["Diffusion", "Supports et marketing"],
    attendu:
      "Où l'annonce paraît, sous quelle forme, et ce que vous produisez vous-même. Chiffrez ce qui est chiffrable.",
  },
  reporting: {
    id: "reporting",
    label: "Reporting et suivi du mandat",
    defaultOn: false,
    attendu:
      "À quelle fréquence, sous quelle forme, et ce que le compte rendu contient. Un engagement de reporting est ce qui distingue un mandat d'une promesse.",
  },
  honoraires: {
    id: "honoraires",
    label: "Honoraires et conditions",
    defaultOn: false,
    gabarit: "tableau",
    colonnes: ["Prestation", "Assiette", "Taux", "Montant"],
    attendu:
      "Ce qui est dû, sur quelle assiette, à quel moment, et qui le paie. Toute ambiguïté ici se paie plus tard.",
  },
  calendrier: {
    id: "calendrier",
    label: "Calendrier",
    defaultOn: false,
    gabarit: "tableau",
    colonnes: ["Étape", "Responsable", "Échéance"],
    attendu:
      "Les jalons jusqu'à la signature, avec un responsable nommé pour chacun. Une étape sans responsable ne se tient pas.",
  },

  /* Sortie */
  conditions: {
    id: "conditions",
    label: "Conditions financières",
    defaultOn: true,
    attendu:
      "Prix ou fourchette attendue, modalités, conditions particulières, et ce qui reste à négocier.",
  },
  offre: {
    id: "offre",
    label: "Modalités de la consultation",
    defaultOn: true,
    attendu:
      "Comment remettre une offre, sous quel format, à quelle date limite, et ce qu'elle doit contenir pour être examinée.",
  },
  contact: {
    id: "contact",
    label: "Contact",
    defaultOn: true,
    attendu:
      "Un interlocuteur nommé, sa ligne directe et son adresse. Un contact générique fait perdre les deux jours qui comptent.",
  },
  annexes: {
    id: "annexes",
    label: "Annexes",
    defaultOn: false,
    attendu:
      "La liste des pièces jointes, numérotées, avec leur date. L'annexe qu'on ne peut pas nommer n'est pas jointe.",
  },
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

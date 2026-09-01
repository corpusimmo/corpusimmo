/**
 * UNE seule navigation, pour tout le site.
 *
 * Le menu trie par INTENTION — estimer, explorer, calculer, déléguer — et
 * jamais par audience. Il n'y a pas d'onglet « Particuliers » ni
 * « Professionnels », et il n'y en aura pas : la majorité du site est partagée
 * (la carte, l'observatoire, les outils), et deux menus couperaient le maillage
 * interne en deux grappes faiblement reliées — exactement ce qu'un domaine neuf
 * ne peut pas se permettre.
 *
 * Résidentiel et professionnel existent bien, mais comme FILTRES à l'intérieur
 * des outils : une bifurcation en première étape de l'estimateur, une case à
 * cocher sur la carte, une facette dans la bibliothèque d'outils. Jamais comme
 * une branche de navigation.
 *
 * `status` dit au lecteur ce qui est réel, et l'interface l'affiche :
 *   live    → réellement implémenté, sur données réelles
 *   beta    → implémenté, volontairement partiel
 *   preview → interface crédible, moteur non construit
 */

export type ModuleStatus = "live" | "beta" | "preview";

export const MODULE_STATUS_LABELS: Record<ModuleStatus, string> = {
  live: "Disponible",
  beta: "Bêta",
  preview: "Bientôt disponible",
};

export interface NavItem {
  label: string;
  href: string;
  status?: ModuleStatus;
  description?: string;
}

export interface NavEntry extends NavItem {
  /** Sous-entrées affichées en méga-menu. */
  children?: NavItem[];
}

/* ------------------------------------------------------------------ menu -- */

export const mainNav: NavEntry[] = [
  {
    label: "Estimer",
    href: "/estimer",
    status: "live",
    description: "Logement ou local professionnel, à partir des ventes réelles",
  },
  {
    label: "Carte des ventes",
    href: "/carte",
    status: "live",
    description: "Toutes les mutations DVF, en accès libre",
  },
  {
    label: "Observatoire",
    href: "/observatoire",
    status: "beta",
    description: "La même donnée, augmentée : indicateurs, séries, comparables",
    children: [
      {
        label: "Baromètre du marché",
        href: "/observatoire",
        status: "beta",
        description: "Prix, volumes et tendances par secteur",
      },
      {
        label: "Rechercher une transaction",
        href: "/observatoire/transactions",
        status: "live",
        description: "Recherche tabulaire des ventes enregistrées",
      },
      {
        label: "Prix par commune",
        href: "/prix-immobilier",
        status: "live",
        description: "Le prix au m² dans cent communes, sur les ventes enregistrées",
      },
      {
        label: "Mes comparables",
        href: "/observatoire/comparables",
        status: "live",
        description: "La sélection qui alimente une valorisation",
      },
    ],
  },
  {
    label: "Outils",
    href: "/outils",
    status: "live",
    description: "Dix calculateurs métier, gratuits, ouverts une fois connecté",
  },
];

/**
 * LES SOLUTIONS, écrites mais pas encore publiées.
 *
 * Les trois pages existent et se tiennent, mais l'offre n'est pas ouverte : les
 * annoncer dans le menu reviendrait à vendre un rendez-vous qu'on ne peut pas
 * encore honorer, ce que ce site s'interdit ailleurs sur les prix.
 *
 * L'entrée est conservée ici, prête à remonter dans `mainNav` le jour où
 * l'offre existe. La retirer complètement obligerait à la réécrire de mémoire.
 */
export const unpublishedNav: NavEntry[] = [
  {
    label: "Solutions",
    href: "/solutions",
    status: "preview",
    description: "Automatisation, formation et leads pour les professionnels",
    children: [
      {
        label: "Automatisation sur mesure",
        href: "/solutions/automatisation",
        status: "preview",
        description: "Qualification, relances, reporting",
      },
      {
        label: "Formation IA immobilier",
        href: "/solutions/formation",
        status: "preview",
        description: "Par des analystes qui ont fait le métier",
      },
      {
        label: "Leads vendeurs",
        href: "/solutions/leads-vendeurs",
        status: "preview",
        description: "Des vendeurs qualifiés de votre secteur",
      },
    ],
  },
];

/** Entrées secondaires : pied de page et menu de débordement. */
export const secondaryNav: NavItem[] = [
  { label: "À propos", href: "/a-propos" },
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Confidentialité", href: "/confidentialite" },
  { label: "Cookies", href: "/cookies" },
];

/** Le CTA persistant du header. */
export const primaryCta = { label: "Estimer un bien", href: "/estimer" } as const;

/** Version à plat, pour le contrôle de liens et la recherche. */
export const mainNavFlat: NavItem[] = mainNav.flatMap((entry) => [
  { label: entry.label, href: entry.href, status: entry.status, description: entry.description },
  ...(entry.children ?? []),
]);

/* ------------------------------------------------ taxonomie des outils -- */

/**
 * Une bibliothèque, pas des sections. Un outil porte plusieurs axes à la fois —
 * un DCF sert en bureaux comme en commerce, en valorisation comme en
 * acquisition. En faire des rubriques de navigation reviendrait à construire
 * des demi-pages vides.
 */
export const toolAssetTypes = [
  { id: "residentiel", label: "Résidentiel" },
  { id: "bureaux", label: "Bureaux" },
  { id: "commerce", label: "Commerce" },
  { id: "industriel", label: "Industriel et logistique" },
  { id: "terrain", label: "Terrain et promotion" },
  { id: "tous-actifs", label: "Tous actifs" },
] as const;

export const toolUsages = [
  { id: "valorisation", label: "Valorisation" },
  { id: "acquisition", label: "Acquisition" },
  { id: "financement", label: "Financement" },
  { id: "gestion", label: "Gestion" },
  { id: "fiscalite", label: "Fiscalité et montage" },
] as const;

export type ToolAssetType = (typeof toolAssetTypes)[number]["id"];
export type ToolUsage = (typeof toolUsages)[number]["id"];

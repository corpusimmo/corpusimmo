# Le CRM de l'équipe

Section `/crm`, réservée aux adresses listées dans `CRM_TEAM`. Deux personnes
aujourd'hui : Mathieu et Gaël. Une connexion au site (Google ou lien par
courriel) avec l'une de ces adresses ouvre la porte. Tout le reste voit une
redirection.

## Ce qu'il contient

| Page | Ce qu'elle fait |
| --- | --- |
| `/crm` | Tableau de bord : compteurs, derniers contacts, tâches du jour. |
| `/crm/contacts` | Liste filtrable (recherche, étape, responsable, étiquette). Étape et responsable se changent en ligne. |
| `/crm/contacts/[id]` | La fiche : coordonnées, étape, étiquettes, réponses de qualification, demandes du site, opportunités, tâches, fil de notes. |
| `/crm/contacts/nouveau` | Création manuelle. Une adresse suffit. |
| `/crm/pipeline` | Les opportunités par colonne, avec le total de chaque colonne. |
| `/crm/taches` | Toutes les tâches ouvertes, filtrables par personne. |

## Les tables

`contacts` reçoit sept colonnes : `company`, `stage`, `owner_email`, `origin`,
`tags`, `fields`, `last_activity_at`. Trois tables s'y rattachent, en cascade :
`crm_notes`, `crm_tasks`, `crm_deals`. Le détail et les raisons sont dans
`src/lib/db/schema/crm.ts`. Migration : `drizzle/0002_crm_equipe.sql`.

L'équipe n'est pas en base. `CRM_TEAM` porte les adresses et les noms, et les
colonnes `*_email` s'y réfèrent.

## Ce qui alimente le CRM

1. **Les formulaires du site.** `POST /api/leads` écrivait déjà dans `contacts`
   et `leads` : ces fiches apparaissent telles quelles, origine `site`.
2. **La machine à lead magnets** (dépôt séparé `corpusimmo-leadmagnets`, mode
   `webhook`). Elle poste sur `POST /api/crm/webhook` avec
   `Authorization: Bearer <CRM_WEBHOOK_SECRET>`. Trois messages : `contact`
   (upsert par adresse, étiquettes fusionnées, champs fusionnés), `note`
   (posée dans le fil, type « Machine »), `lookup` (relecture pour reconnaître
   un visiteur déjà venu).
3. **Cal.com.** `POST /api/crm/calcom`, signé par `X-Cal-Signature-256` avec
   `CALCOM_WEBHOOK_SECRET`. Chaque réservation, déplacement ou annulation pose
   une note « Rendez-vous » sur la fiche, créée si besoin, avec l'étiquette
   `rendez-vous`.

## Variables

```
CRM_TEAM=Mathieu Guicheteau <…>, Gaël Colin <…>
CRM_WEBHOOK_SECRET=<chaîne longue et aléatoire>
CALCOM_WEBHOOK_SECRET=<le secret saisi dans le webhook Cal.com>
```

À poser sur Vercel, puis appliquer `drizzle/0002_crm_equipe.sql` sur Neon
(`pnpm db:migrate` avec `DATABASE_URL_UNPOOLED`, ou coller le SQL dans la
console Neon).

## En local

Postgres.app sur `localhost:5432`, base `corpusimmo`, `DATABASE_URL=postgresql://localhost:5432/corpusimmo`.
Le client bascule sur le pilote `pg` pour tout hôte qui n'est pas Neon
(`src/lib/db/client.ts`). `pnpm db:migrate` applique les migrations.

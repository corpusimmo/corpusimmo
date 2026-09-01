# Aimants — les documents remis contre une adresse e-mail

Ce répertoire est **hors de `public/`**, et c'est la seule chose importante à
retenir : un fichier posé dans `public/` serait servi directement par le CDN,
sans jamais passer par la vérification du jeton signé.

Le seul chemin vers un octet d'ici est
`GET /api/ressources/[slug]/telechargement?t=<jeton>`, qui revérifie à chaque
requête la signature, l'expiration et le document visé.

## Ajouter un document

1. Déposer le fichier ici.
2. Déclarer une entrée dans `src/lib/magnets/catalogue.ts` — `slug`, `title`,
   `summary`, `fileName`, `contentType`, `weight`.
3. C'est tout. La porte (`/api/ressources/[slug]/acces`) et le téléchargement
   fonctionnent dès que l'entrée existe.

Le catalogue est **vide** aujourd'hui : les matrices Excel sont en cours de
révision et aucune n'est versionnée. Le mécanisme ne promet donc rien qu'il ne
puisse livrer.

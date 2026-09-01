# E-mails et liste de contacts

## Le choix : Brevo

| | Brevo | Resend |
|---|---|---|
| Séquence de relance à plusieurs e-mails | automation native, éditable sans déploiement | à construire : ordonnanceur + machine à états |
| Liste de contacts, segmentation | c'est le produit | Audiences, plus récent |
| Désinscription, outillage RGPD | natif | à câbler |
| Hébergement | société française, données UE | région UE disponible |
| Palier gratuit | 300 e-mails/jour, contacts illimités | 3 000/mois, 100/jour |
| Confort de développement | correct | meilleur |

Ce qui tranche : `docs/strategie-commerciale.md` prévoit une **séquence de neuf
e-mails** et pose que la liste est le seul actif réel au lancement. Ce n'est pas
un besoin transactionnel, c'est de l'automation marketing — et les objets
d'e-mail doivent pouvoir être réécrits sans redéployer le site. Sur une base de
contacts vendeurs français portant des consentements horodatés, l'hébergement UE
d'un éditeur français est en plus un argument commercial.

**Resend reste implémenté** (`src/lib/email/resend.ts`) et fonctionnel. Il ne
coûte qu'un fichier, et une bascule de fournisseur ne doit jamais demander une
réécriture.

## Les deux moitiés, séparées à dessein

| Module | Rôle |
|---|---|
| `src/lib/email/brevo.ts` | envoie **un** message à **une** adresse |
| `src/lib/email/contacts.ts` | inscrit durablement une personne dans une **liste** |

Envoyer un e-mail transactionnel à quelqu'un n'a jamais valu accord pour lui en
envoyer d'autres. Mélanger les deux chemins est la façon la plus courante de
transformer une base propre en base illégale — d'où deux modules, et
`syncContact` qui refuse tout sans `marketing: true`.

## L'adresse d'expédition

Une seule adresse, la **même que celle publiée sur le site** :

```
CorpusImmo <contact@corpus.immo>
```

Trois raisons de ne pas la spécialiser :

- **`estimation@` se périme au deuxième type de message.** Le lien d'un aimant,
  la lettre d'information et une réponse commerciale partiraient tous d'une
  adresse qui annonce autre chose.
- **`no-reply@` est un mauvais calcul.** Les filtres s'en méfient — donc la
  délivrabilité baisse — et l'adresse ferme la porte au moment précis où
  quelqu'un a une question à poser. Une réponse à un e-mail d'estimation est
  exactement le contact qu'on cherche à obtenir.
- **La cohérence se voit.** Le pied de page, les mentions légales et
  l'expéditeur affichent la même chose. C'est un signal de sérieux gratuit.

La condition est que la boîte soit **relevée**. Une adresse qui reçoit et que
personne ne lit est un `no-reply@` qui s'ignore.

### Quand la séparer

Le jour où les envois marketing prennent du volume, on isole leur réputation sur
un sous-domaine — `news.corpus.immo` — pour qu'une vague de plaintes sur une
campagne n'abîme pas la messagerie de l'entreprise. Pas avant : au lancement,
une adresse en sous-domaine fait surtout bizarre à la lecture, sans rien
protéger qui existe encore.

## Ce qu'il faut créer chez Brevo

1. **Un compte**, et le domaine `corpus.immo` **authentifié** (SPF, DKIM,
   DMARC). Sans authentification de domaine, les envois partent en indésirables
   et la réputation du domaine se dégrade dès les premiers messages.
2. **Une clé d'API** → `EMAIL_PROVIDER_KEY`, avec `EMAIL_PROVIDER=brevo`.
3. **Deux listes**, dont les identifiants numériques vont dans
   `BREVO_NEWSLETTER_LIST_ID` et `BREVO_LEADS_LIST_ID` :
   · *Lettre d'information* — inscriptions volontaires depuis le pied de page ;
   · *Estimations* — contacts issus du parcours, qui ont coché la case marketing.
4. **Les attributs personnalisés**, à créer AVANT le premier envoi : Brevo
   refuse un attribut inconnu au lieu de l'ignorer.

| Attribut | Type | Contenu |
|---|---|---|
| `PRENOM` | texte | |
| `NOM` | texte | |
| `SOURCE` | texte | `estimation`, `newsletter`, `aimant:<slug>` |
| `CONSENT_DATE` | texte | horodatage ISO, produit par le serveur |
| `CONSENT_MARKETING` | texte | `oui` / `non` |
| `CONSENT_PRO` | texte | `oui` / `non` |
| `VILLE` | texte | |
| `TYPE_BIEN` | texte | |

`CONSENT_DATE` en texte et non en date : c'est un horodatage à la seconde qui
doit se produire tel quel en cas de réclamation, pas une date à reformater.

## La règle du consentement, appliquée dans le code

- **Aucune inscription sans accord explicite.** `syncContact` sort immédiatement
  si `marketing !== true`. Il n'y a pas de branche « par défaut on inscrit ».
- **La liste doit être nommée.** Sans identifiant configuré, on saute.
- **La date vient du serveur.** Un horodatage fourni par le navigateur ne
  prouverait rien.
- **Trois accords distincts** dans le parcours d'estimation, dont un seul est
  requis — recevoir son estimation. Une case décochée est un refus, et le
  serveur la traite comme tel.

## La livraison des aimants

**Jamais de pièce jointe.** Une pièce jointe dégrade la délivrabilité, bute sur
les limites de taille, gonfle le coût d'envoi, et surtout ne se révoque pas.

Le mécanisme, dans `src/lib/magnets/` :

1. `POST /api/ressources/[slug]/acces` — la personne laisse une adresse. Un
   jeton HMAC est émis, liant **le document**, **l'adresse** et une **expiration
   à sept jours**, puis envoyé par e-mail.
2. `GET /api/ressources/[slug]/telechargement?t=…` — le jeton est revérifié à
   chaque requête : signature d'abord, puis expiration, puis document visé.

L'ordre des contrôles n'est pas indifférent : se prononcer sur le contenu d'une
charge non authentifiée reviendrait à faire confiance à ce qu'un attaquant vient
d'écrire. Sept tests couvrent la forge, l'expiration, le mauvais document et le
mauvais secret.

Les fichiers vivent dans `content/aimants/`, **hors de `public/`** : un fichier
posé dans `public/` serait servi par le CDN sans jamais passer par cette
vérification.

**Le raccourci de la personne connectée.** L'aller-retour par e-mail n'a qu'un
rôle : prouver que l'adresse appartient à celui qui la saisit. Quand Google l'a
déjà prouvé, le lien est rendu directement — mais uniquement pour l'adresse de
la session, jamais pour celle tapée dans le champ.

## Ce qui n'est pas fait

- **Le catalogue d'aimants est vide.** Les matrices Excel sont en révision ;
  le mécanisme ne promet rien qu'il ne puisse livrer.
- **Pas de double opt-in.** L'inscription se fait sur une case explicitement
  cochée. Le double opt-in est un réglage côté Brevo, à activer si vous le
  souhaitez — il coûte des inscrits et gagne en qualité de liste.
- **Le retrait du consentement n'est pas branché** côté application : il passe
  par le lien de désinscription de Brevo. À reprendre le jour où une base
  applicative existera.

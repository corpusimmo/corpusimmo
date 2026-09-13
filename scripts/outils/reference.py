"""
LA RÉFÉRENCE EXCEL DE CHAQUE SIMULATEUR.

Pour chaque matrice, écrit `src/lib/tools/outils/reference/<outil>.json` : la
valeur de chaque cellule non vide des onglets de calcul, TELLE QU'EXCEL L'A
CALCULÉE et enregistrée dans le fichier. Les tests des simulateurs en ligne
comparent leurs résultats à ces valeurs, sur l'exemple livré dans le classeur.

POURQUOI PAS UN MOTEUR DE FORMULES. Aucun n'est installé ici, et en écrire un
reviendrait à tester le simulateur contre un second simulateur. Le seul arbitre
qui vaille est Excel, et Excel a déjà rendu son verdict dans le fichier : il
suffit de le lire.

La limite est assumée : la référence couvre le cas d'exemple, pas toutes les
branches. Les autres branches sont testées par des cas construits à la main
dans chaque fichier de test, formule par formule.

    python3 scripts/outils/reference.py
"""

import datetime
import json
from pathlib import Path

import openpyxl

RACINE = Path(__file__).resolve().parents[2]
MATRICES = RACINE / "public/outils/matrices"
SORTIE = RACINE / "src/lib/tools/outils/reference"

CLASSEURS = {
    "calculateur-rentabilite-locative.xlsx": "rentabilite-locative",
    "tableau-amortissement-et-comparateur-de-prets.xlsx": "pret-amortissement",
    "capacite-emprunt-et-bilan-patrimonial.xlsx": "capacite-emprunt",
    "arbitrage-fiscal-nu-lmnp-sci-is.xlsx": "arbitrage-fiscal",
    "chiffrage-de-travaux-par-lot.xlsx": "chiffrage-travaux",
    "rent-roll-et-wault.xlsx": "wault",
    "avis-de-valeur-par-comparaison.xlsx": "avis-de-valeur",
    "net-vendeur-honoraires-et-qualification.xlsx": "net-vendeur",
    "dcf-valorisation.xlsx": "dcf",
}

# La prose ne se teste pas.
ONGLETS_EXCLUS = {"mode d'emploi", "méthode"}


def serialiser(valeur):
    if isinstance(valeur, (datetime.datetime, datetime.date)):
        return valeur.isoformat()
    return valeur


def main() -> None:
    SORTIE.mkdir(parents=True, exist_ok=True)
    for fichier, outil in CLASSEURS.items():
        wb = openpyxl.load_workbook(MATRICES / fichier, data_only=True)
        onglets = {}
        for ws in wb.worksheets:
            if ws.title.strip().lower() in ONGLETS_EXCLUS:
                continue
            cellules = {}
            for ligne in ws.iter_rows():
                for c in ligne:
                    if c.value is None:
                        continue
                    # Les longs commentaires ne servent à aucun test et
                    # alourdiraient le fichier : on ne garde que les nombres,
                    # les dates et les textes courts (libellés, « OK »).
                    if isinstance(c.value, str) and len(c.value) > 80:
                        continue
                    cellules[c.coordinate] = serialiser(c.value)
            onglets[ws.title] = cellules
        (SORTIE / f"{outil}.json").write_text(
            json.dumps(onglets, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
        )
        print(f"  {outil} : {sum(len(v) for v in onglets.values())} cellules")


if __name__ == "__main__":
    main()

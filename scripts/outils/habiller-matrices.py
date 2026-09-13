"""
HABILLER LES MATRICES AUX COULEURS DE CORPUSIMMO.

Lit les classeurs tels que livrés (`data/matrices-livrees/`) et écrit leur
version habillée dans `public/outils/matrices/`, celle que le site sert :

  · la palette bleu nuit devient la palette violette du site ;
  · les onglets prennent les couleurs de la marque ;
  · le logo — signe, nom et www.corpus.immo — est apposé en haut à droite de
    chaque onglet ;
  · le bandeau de tête cite www.corpus.immo ;
  · les textes qui parlaient de « cellules bleues » parlent de cellules
    violettes, sans quoi le mode d'emploi contredirait l'écran.

POURQUOI LE XML, ET PAS OPENPYXL. Relu puis réécrit par openpyxl, un classeur
perd ses validations de données étendues — les listes déroulantes qui pointent
vers l'onglet Paramètres — et openpyxl le dit lui-même à la lecture. Un
classeur dont le choix du régime fiscal n'est plus une liste est un classeur
cassé. On touche donc au fichier comme Excel le range : on ouvre l'archive, on
remplace des couleurs dans `styles.xml`, on ajoute un dessin par onglet, et on
laisse tout le reste octet pour octet.

LES FORMULES ET LES VALEURS NE BOUGENT PAS. Seuls les styles, les textes
d'aide et les dessins changent : les valeurs calculées qu'Excel a enregistrées
restent celles contre lesquelles les simulateurs en ligne sont testés.

    python3 scripts/outils/habiller-matrices.py
"""

import io
import re
import zipfile
from pathlib import Path

from PIL import Image

RACINE = Path(__file__).resolve().parents[2]
SOURCE = RACINE / "data/matrices-livrees"
SORTIE = RACINE / "public/outils/matrices"
LOGO = RACINE / "scripts/assets/logo-classeur.png"

# ── Palette ─────────────────────────────────────────────────────────────────

# Couleurs de REMPLISSAGE : bandeaux de section, cellules à saisir, résultats.
FONDS = {
    "FF0E1A33": "FF4B3D7C",  # bandeau bleu nuit → violet profond (--brand-800)
    "FFE8F0FE": "FFF1EEF8",  # cellule à saisir → violet pâle (--primary-soft)
    "FFF5F9FF": "FFF8F6FC",  # résultat mis en avant → violet très pâle
    # Classeur DCF, palette Office d'origine.
    "FF44546A": "FF4B3D7C",
    "FF8497B0": "FF8B7CC4",
    "FFDDEBF7": "FFF1EEF8",
    "FF5B9BD5": "FF6C5AB0",
    "FF9BC2E6": "FFC9C0E6",
}

# Couleurs de TEXTE : titres et chiffres en bleu nuit, saisies en bleu vif.
ENCRES = {
    "FF0E1A33": "FF2F2650",  # encre bleu nuit → encre violet sombre (--brand-900)
    "FF0000FF": "FF6C5AB0",  # saisie bleue du DCF → violet d'action (--primary)
}

ONGLETS = {
    "FF3B6EF6": "FF6C5AB0",
    "FF2350C8": "FF4B3D7C",
    "FF0B8578": "FF8B7CC4",
    "FFB08C4E": "FF495669",
    "FF5A6B8C": "FF8A93A6",
}

# Remplacements de texte, du plus long au plus court pour ne pas en couper un.
TEXTES = [
    ("  ·  corpus.immo  ·  ", "  ·  www.corpus.immo  ·  "),
    ("cellules BLEUES", "cellules VIOLETTES"),
    ("Bleu = à saisir", "Violet = à saisir"),
    ("Bandeau bleu nuit", "Bandeau violet"),
    ("texte bleu nuit", "texte violet sombre"),
    ("Fond bleu très pâle", "Fond violet très pâle"),
    ("Fond bleu pâle", "Fond violet pâle"),
    ("Fond bleu clair", "Fond violet clair"),
    ("Fond bleu ciel", "Fond violet clair"),
    ("régler est bleu", "régler est violet"),
    ("blocs bleus", "blocs violets"),
    ("colonnes bleues", "colonnes violettes"),
    ("colonne bleue", "colonne violette"),
    ("lignes bleues", "lignes violettes"),
    ("ligne bleue", "ligne violette"),
    ("valeurs bleues", "valeurs violettes"),
    ("valeur bleue", "valeur violette"),
    ("Cellules bleues", "Cellules violettes"),
    ("cellules bleues", "cellules violettes"),
    ("Cellule bleue", "Cellule violette"),
    ("cellule bleue", "cellule violette"),
    # Le titre du DCF porte deux tirets cadratins : la règle du site les
    # proscrit dans tout texte publié, et ce classeur l'est.
    ("MATRICE DCF IMMOBILIER — MODÈLE RÉUTILISABLE", "MATRICE DCF IMMOBILIER : MODÈLE RÉUTILISABLE"),
    ("Tout le reste est calculé — ne rien écraser.", "Tout le reste est calculé, ne rien écraser."),
]

# ── Le logo ─────────────────────────────────────────────────────────────────

# Taille d'affichage dans Excel, en pixels. Le fichier est au double.
LOGO_HAUTEUR_PX = 44
EMU_PAR_PX = 9525


def logo_png() -> tuple[bytes, int, int]:
    image = Image.open(LOGO)
    image = image.crop(image.getbbox())
    tampon = io.BytesIO()
    image.save(tampon, "PNG", optimize=True)
    largeur = round(image.width * LOGO_HAUTEUR_PX / image.height)
    return tampon.getvalue(), largeur, LOGO_HAUTEUR_PX


def largeur_colonnes_px(sheet_xml: str, jusqu_a: int) -> float:
    """Largeur cumulée des colonnes 1..jusqu_a, en pixels (Calibri 11)."""
    defaut = re.search(r'defaultColWidth="([\d.]+)"', sheet_xml)
    largeur_defaut = float(defaut.group(1)) if defaut else 8.43
    largeurs = {}
    for m in re.finditer(r"<col\b[^>]*>", sheet_xml):
        balise = m.group(0)
        mini = int(re.search(r'min="(\d+)"', balise).group(1))
        maxi = int(re.search(r'max="(\d+)"', balise).group(1))
        w = float(re.search(r'width="([\d.]+)"', balise).group(1))
        for k in range(mini, maxi + 1):
            largeurs[k] = w
    total = 0.0
    for k in range(1, jusqu_a + 1):
        w = largeurs.get(k, largeur_defaut)
        total += int(w * 7 + 5)  # conversion usuelle caractères → pixels
    return total


def derniere_colonne(sheet_xml: str) -> int:
    m = re.search(r'<dimension ref="[A-Z]+\d+:([A-Z]+)\d+"', sheet_xml)
    if not m:
        return 4
    n = 0
    for ch in m.group(1):
        n = n * 26 + (ord(ch) - 64)
    return n


def hauteur_lignes_px(sheet_xml: str, jusqu_a: int) -> float:
    """Hauteur cumulée des lignes 1..jusqu_a, en pixels."""
    defaut = re.search(r'defaultRowHeight="([\d.]+)"', sheet_xml)
    h_defaut = float(defaut.group(1)) if defaut else 15.0
    hauteurs = {int(m.group(1)): float(m.group(2)) for m in re.finditer(r'<row r="(\d+)"[^>]*?\bht="([\d.]+)"', sheet_xml)}
    return sum(hauteurs.get(k, h_defaut) for k in range(1, jusqu_a + 1)) * 96 / 72


# LÀ OÙ LE COIN HAUT DROIT N'EST PAS LIBRE. L'onglet DCF porte son tableau de
# flux dès la deuxième ligne, sur toute la largeur : le logo y masquait les
# en-têtes des périodes. Il descend à côté de la légende, sous les contrôles.
POSITIONS = {
    ("dcf-valorisation.xlsx", "1"): {"colonne": 6, "ligne": 40},
}


def dessin(largeur_px: int, hauteur_px: int, x_px: float, y_px: float) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<xdr:absoluteAnchor>'
        f'<xdr:pos x="{int(x_px * EMU_PAR_PX)}" y="{int(y_px * EMU_PAR_PX)}"/>'
        f'<xdr:ext cx="{largeur_px * EMU_PAR_PX}" cy="{hauteur_px * EMU_PAR_PX}"/>'
        '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo CorpusImmo" descr="CorpusImmo, www.corpus.immo"/>'
        '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>'
        '<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>'
        f'<xdr:spPr><a:xfrm><a:off x="{int(x_px * EMU_PAR_PX)}" y="{int(y_px * EMU_PAR_PX)}"/>'
        f'<a:ext cx="{largeur_px * EMU_PAR_PX}" cy="{hauteur_px * EMU_PAR_PX}"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>'
        '<xdr:clientData/></xdr:absoluteAnchor></xdr:wsDr>'
    )


# L'ordre des éléments d'une feuille est imposé par le schéma : <drawing> vient
# avant ceux-ci. Le placer après l'un d'eux rend le fichier illisible pour Excel.
APRES_DESSIN = ("<legacyDrawing", "<legacyDrawingHF", "<drawingHF", "<picture", "<oleObjects", "<controls", "<webPublishItems", "<tableParts", "<extLst")


def inserer_balise_dessin(sheet_xml: str, rid: str) -> str:
    positions = [sheet_xml.find(b) for b in APRES_DESSIN if sheet_xml.find(b) != -1]
    balise = f'<drawing r:id="{rid}"/>'
    if positions:
        i = min(positions)
        return sheet_xml[:i] + balise + sheet_xml[i:]
    return sheet_xml.replace("</worksheet>", balise + "</worksheet>")


def remplacer_couleurs(styles: str) -> str:
    def dans(balise: str, table: dict[str, str], texte: str) -> str:
        def sub(m: re.Match) -> str:
            bloc = m.group(0)
            for ancien, nouveau in table.items():
                bloc = bloc.replace(f'rgb="{ancien}"', f'rgb="{nouveau}"')
            return bloc
        return re.sub(rf"<{balise}\b[^>]*?(?:/>|>.*?</{balise}>)", sub, texte, flags=re.S)

    styles = dans("fill", FONDS, styles)
    styles = dans("font", ENCRES, styles)
    return styles


def habiller(nom: str, png: bytes, logo_l: int, logo_h: int) -> None:
    with zipfile.ZipFile(SOURCE / nom) as z:
        parties = {info.filename: z.read(info.filename) for info in z.infolist()}
        ordre = [info.filename for info in z.infolist()]

    parties["xl/styles.xml"] = remplacer_couleurs(parties["xl/styles.xml"].decode()).encode()

    for chemin in list(parties):
        if chemin == "xl/sharedStrings.xml" or chemin.startswith("xl/worksheets/sheet"):
            texte = parties[chemin].decode()
            for ancien, nouveau in TEXTES:
                texte = texte.replace(ancien, nouveau)
            parties[chemin] = texte.encode()

    parties["xl/media/logo-corpusimmo.png"] = png
    ordre.append("xl/media/logo-corpusimmo.png")

    types = parties["[Content_Types].xml"].decode()
    if 'Extension="png"' not in types:
        types = types.replace("<Default ", '<Default Extension="png" ContentType="image/png"/><Default ', 1)

    feuilles = sorted(
        (c for c in parties if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", c)),
        key=lambda c: int(re.search(r"(\d+)", c.rsplit("/", 1)[1]).group(1)),
    )
    for chemin in feuilles:
        numero = re.search(r"sheet(\d+)\.xml", chemin).group(1)
        xml = parties[chemin].decode()
        for ancien, nouveau in ONGLETS.items():
            xml = xml.replace(f'<tabColor rgb="{ancien}"', f'<tabColor rgb="{nouveau}"')
        if "<drawing " in xml:
            parties[chemin] = xml.encode()
            continue

        # Le logo s'aligne sur le bord droit de la zone utilisée, sous la
        # première ligne : c'est la zone de titre, blanche, de chaque onglet.
        position = POSITIONS.get((nom, numero))
        if position:
            x = largeur_colonnes_px(xml, position["colonne"] - 1) + 8
            y = hauteur_lignes_px(xml, position["ligne"] - 1) + 4
        else:
            droite = largeur_colonnes_px(xml, derniere_colonne(xml))
            ligne1 = re.search(r'<row r="1"[^>]*\bht="([\d.]+)"', xml)
            y = (float(ligne1.group(1)) * 96 / 72 if ligne1 else 20) + 6
            x = max(8.0, droite - logo_l - 8)

        rels_chemin = f"xl/worksheets/_rels/sheet{numero}.xml.rels"
        if rels_chemin in parties:
            rels = parties[rels_chemin].decode()
            existants = [int(n) for n in re.findall(r'Id="rId(\d+)"', rels)]
            rid = f"rId{max(existants, default=0) + 1}"
            rels = rels.replace(
                "</Relationships>",
                f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing{numero}.xml"/></Relationships>',
            )
        else:
            rid = "rId1"
            rels = (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing{numero}.xml"/>'
                "</Relationships>"
            )
            ordre.append(rels_chemin)
        parties[rels_chemin] = rels.encode()

        racine = re.search(r"<worksheet\b[^>]*>", xml).group(0)
        if "xmlns:r=" not in racine:
            xml = xml.replace(
                "<worksheet ",
                '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ',
                1,
            )
        parties[chemin] = inserer_balise_dessin(xml, rid).encode()

        dessin_chemin = f"xl/drawings/drawing{numero}.xml"
        parties[dessin_chemin] = dessin(logo_l, logo_h, x, y).encode()
        parties[f"xl/drawings/_rels/drawing{numero}.xml.rels"] = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo-corpusimmo.png"/>'
            "</Relationships>"
        ).encode()
        ordre += [dessin_chemin, f"xl/drawings/_rels/drawing{numero}.xml.rels"]
        types = types.replace(
            "</Types>",
            f'<Override PartName="/{dessin_chemin}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>',
        )

    parties["[Content_Types].xml"] = types.encode()

    SORTIE.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(SORTIE / nom, "w", zipfile.ZIP_DEFLATED) as z:
        vus = set()
        for chemin in ordre:
            if chemin in vus or chemin not in parties:
                continue
            vus.add(chemin)
            z.writestr(chemin, parties[chemin])
    print(f"  {nom} : {len(feuilles)} onglets habillés")


def main() -> None:
    png, largeur, hauteur = logo_png()
    for source in sorted(SOURCE.glob("*.xlsx")):
        habiller(source.name, png, largeur, hauteur)


if __name__ == "__main__":
    main()

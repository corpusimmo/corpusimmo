// Rasterise les pages d'un PDF en PNG, à la résolution demandée.
//
// Pourquoi Swift : PDFKit est livré avec macOS. Ni Poppler, ni ImageMagick,
// ni Ghostscript ne sont installés sur la machine, et aucun ne mérite de
// l'être pour dix aperçus par an.
//
//   swift pdf-en-png.swift fichier.pdf dossier-sortie [échelle]
import Foundation
import PDFKit
import AppKit

let args = CommandLine.arguments
guard args.count >= 3, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
  FileHandle.standardError.write("usage : pdf-en-png.swift fichier.pdf sortie [échelle]\n".data(using: .utf8)!)
  exit(1)
}
let sortie = URL(fileURLWithPath: args[2])
let echelle = args.count > 3 ? CGFloat(Double(args[3]) ?? 2) : 2

for i in 0..<doc.pageCount {
  guard let page = doc.page(at: i) else { continue }
  let cadre = page.bounds(for: .mediaBox)
  let largeur = Int(cadre.width * echelle)
  let hauteur = Int(cadre.height * echelle)
  guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: largeur, pixelsHigh: hauteur,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
    let ctx = NSGraphicsContext(bitmapImageRep: rep) else { continue }
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = ctx
  ctx.cgContext.setFillColor(NSColor.white.cgColor)
  ctx.cgContext.fill(CGRect(x: 0, y: 0, width: largeur, height: hauteur))
  ctx.cgContext.scaleBy(x: echelle, y: echelle)
  page.draw(with: .mediaBox, to: ctx.cgContext)
  NSGraphicsContext.restoreGraphicsState()
  let png = rep.representation(using: .png, properties: [:])!
  let chemin = sortie.appendingPathComponent(String(format: "page-%02d.png", i + 1))
  try! png.write(to: chemin)
  print(chemin.path)
}

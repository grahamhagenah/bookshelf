// Draws the landing page's cover wall into one JPEG.
// Layout matches cover-wall.tsx: 112px tiles (2:3), 16px gaps, every other
// tile nudged down 32px, 2px corners.
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let dir = CommandLine.arguments[1]
let output = CommandLine.arguments[2]
let scale = Double(CommandLine.arguments[3]) ?? 1.0
let quality = Double(CommandLine.arguments.count > 4 ? CommandLine.arguments[4] : "0.7") ?? 0.7

struct Layout: Decodable { let cols: Int; let rows: Int; let tiles: [String] }
let layout = try JSONDecoder().decode(
  Layout.self, from: Data(contentsOf: URL(fileURLWithPath: "\(dir)/layout.json")))

let tileW = 112.0, tileH = 168.0, gap = 16.0, nudge = 32.0, radius = 2.0
let width = (Double(layout.cols) * tileW + Double(layout.cols - 1) * gap) * scale
let height = (Double(layout.rows) * tileH + Double(layout.rows - 1) * gap + nudge) * scale

let rgb = CGColorSpace(name: CGColorSpace.sRGB)!
guard let ctx = CGContext(
  data: nil, width: Int(width), height: Int(height), bitsPerComponent: 8,
  bytesPerRow: 0, space: rgb, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
else { fatalError("no context") }

// Page background, then tiles; CoreGraphics' origin is bottom-left
ctx.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1))
ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
ctx.interpolationQuality = .high

for (i, name) in layout.tiles.enumerated() {
  let col = i % layout.cols, row = i / layout.cols
  let x = Double(col) * (tileW + gap)
  let y = Double(row) * (tileH + gap) + (i % 2 == 1 ? nudge : 0)
  let rect = CGRect(
    x: x * scale, y: height - (y + tileH) * scale, width: tileW * scale, height: tileH * scale)
  let path = CGPath(
    roundedRect: rect, cornerWidth: radius * scale, cornerHeight: radius * scale, transform: nil)

  ctx.saveGState()
  ctx.addPath(path)
  ctx.clip()
  // Placeholder tone (stone-200) under every tile
  ctx.setFillColor(CGColor(srgbRed: 0.906, green: 0.898, blue: 0.894, alpha: 1))
  ctx.fill(rect)
  let url = URL(fileURLWithPath: "\(dir)/covers/\(name)") as CFURL
  if let source = CGImageSourceCreateWithURL(url, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil), image.width > 1
  {
    // object-fit: cover
    let imgRatio = Double(image.width) / Double(image.height)
    let boxRatio = rect.width / rect.height
    var draw = rect
    if imgRatio > boxRatio {
      draw.size.width = rect.height * imgRatio
      draw.origin.x -= (draw.width - rect.width) / 2
    } else {
      draw.size.height = rect.width / imgRatio
      draw.origin.y -= (draw.height - rect.height) / 2
    }
    ctx.draw(image, in: draw)
  }
  ctx.restoreGState()
}

guard let result = ctx.makeImage(),
  let dest = CGImageDestinationCreateWithURL(
    URL(fileURLWithPath: output) as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
else { fatalError("no output") }
CGImageDestinationAddImage(
  dest, result, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
CGImageDestinationFinalize(dest)
print("wrote \(Int(width))x\(Int(height))")

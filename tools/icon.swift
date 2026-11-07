import AppKit
let S: CGFloat = 512
let img = NSImage(size: NSSize(width: S, height: S))
img.lockFocus()
NSColor(red: 0.62, green: 0.29, blue: 0.21, alpha: 1).setFill()
NSBezierPath(roundedRect: NSRect(x: 0, y: 0, width: S, height: S), xRadius: 96, yRadius: 96).fill()
// arch outline
let arch = NSBezierPath()
arch.move(to: NSPoint(x: 150, y: 90)); arch.line(to: NSPoint(x: 150, y: 300))
arch.appendArc(withCenter: NSPoint(x: 256, y: 300), radius: 106, startAngle: 180, endAngle: 0, clockwise: true)
arch.line(to: NSPoint(x: 362, y: 90))
NSColor(white: 1, alpha: 0.9).setStroke(); arch.lineWidth = 14; arch.stroke()
let font = NSFont(name: "Didot", size: 150) ?? NSFont.systemFont(ofSize: 150, weight: .semibold)
let str = NSAttributedString(string: "94", attributes: [.font: font, .foregroundColor: NSColor.white])
let sz = str.size(); str.draw(at: NSPoint(x: (S - sz.width) / 2, y: 120))
img.unlockFocus()
for (name, px) in [("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)] {
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  img.draw(in: NSRect(x: 0, y: 0, width: px, height: px))
  NSGraphicsContext.current = nil
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1] + "/" + name))
}

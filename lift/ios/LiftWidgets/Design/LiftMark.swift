import SwiftUI

/// The barbell from Lift's app icon, as a shape: a bar with end caps and two plates a side. The proportions are the
/// icon's (1024 pt artwork, the barbell spanning 724 × 300 pt), so it reads as the same mark at any size.
nonisolated struct BarbellShape: Shape {
    /// Width over height of the mark.
    static let aspectRatio: CGFloat = 724 / 300

    /// The bar, its end caps and the plates, in the icon's points with the mark's origin at (150, 362).
    private static let parts: [CGRect] = [
        CGRect(x: 0, y: 128, width: 724, height: 44),  // bar
        CGRect(x: 0, y: 109, width: 40, height: 81),  // left cap
        CGRect(x: 684, y: 109, width: 40, height: 81),  // right cap
        CGRect(x: 100, y: 0, width: 70, height: 300),  // left outer plate
        CGRect(x: 180, y: 40, width: 52, height: 220),  // left inner plate
        CGRect(x: 492, y: 40, width: 52, height: 220),  // right inner plate
        CGRect(x: 554, y: 0, width: 70, height: 300),  // right outer plate
    ]

    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width / 724, rect.height / 300)
        let origin = CGPoint(x: rect.midX - 362 * scale, y: rect.midY - 150 * scale)
        var path = Path()
        for part in Self.parts {
            let scaled = CGRect(
                x: origin.x + part.minX * scale,
                y: origin.y + part.minY * scale,
                width: part.width * scale,
                height: part.height * scale
            )
            // Plates and caps are rounded to a quarter of their width; the bar is square-ended.
            let corner = part.height > 50 ? part.width * 0.25 * scale : 0
            path.addRoundedRect(in: scaled, cornerSize: CGSize(width: corner, height: corner))
        }
        return path
    }
}

/// Lift's app icon in small: the dark barbell on an amber rounded square.
struct LiftBadge: View {
    var size: CGFloat = 22

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.26, style: .continuous)
            .fill(WidgetColors.accent)
            .overlay {
                BarbellShape()
                    .fill(WidgetColors.ink)
                    .padding(size * 0.16)
            }
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

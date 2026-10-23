import SwiftUI

/// A barbell, as a shape: the Dynamic Island's workout glyph, a bar with end caps and two plates a side. The
/// proportions come from the old Lift icon (1024 pt artwork, the barbell spanning 724 × 300 pt).
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

/// The Coach mark from the app icon (src/app/icon.svg): a "C" ring and the dot, in the icon's 32 pt artwork.
nonisolated struct CoachRingShape: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width, rect.height) / 32
        let origin = CGPoint(x: rect.midX - 16 * scale, y: rect.midY - 16 * scale)
        // The arc of radius 7.6 around (16, 16), from (21.09, 10.35) the long way round to (21.09, 21.65).
        var ring = Path()
        ring.addArc(
            center: CGPoint(x: 16, y: 16), radius: 7.6,
            startAngle: .degrees(-48), endAngle: .degrees(48), clockwise: true
        )
        return ring
            .strokedPath(StrokeStyle(lineWidth: 3, lineCap: .round))
            .applying(CGAffineTransform(scaleX: scale, y: scale).translatedBy(x: origin.x / scale, y: origin.y / scale))
    }
}

/// The dot beside the ring, in the same 32 pt artwork.
nonisolated struct CoachDotShape: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width, rect.height) / 32
        let center = CGPoint(x: rect.midX + 7.6 * scale, y: rect.midY)
        let r = 1.9 * scale
        return Path(ellipseIn: CGRect(x: center.x - r, y: center.y - r, width: 2 * r, height: 2 * r))
    }
}

/// The app icon in small: the white ring and orange dot on a dark rounded square.
struct CoachBadge: View {
    var size: CGFloat = 22

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.235, style: .continuous)
            .fill(WidgetColors.iconTile)
            .overlay {
                ZStack {
                    CoachRingShape().fill(.white)
                    CoachDotShape().fill(WidgetColors.accent)
                }
            }
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

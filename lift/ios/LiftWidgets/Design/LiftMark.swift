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

/// The app icon's progress ring (Design/AppIcon.svg), in its 32 pt artwork: a ring of radius 8 around the centre,
/// filled counter-clockwise from 12 o'clock round to (23.6, 18.5), where the dot sits.
nonisolated struct CoachRing {
    static let radius: CGFloat = 8
    static let lineWidth: CGFloat = 3.2
    static let dotRadius: CGFloat = 1.25
    /// The arc's start and end, in degrees clockwise from 3 o'clock (y down): 12 o'clock and the dot.
    static let start: Double = -90
    static let end: Double = 18.2

    /// Maps the 32 pt artwork into `rect`, centred.
    static func transform(in rect: CGRect) -> CGAffineTransform {
        let scale = min(rect.width, rect.height) / 32
        return CGAffineTransform(translationX: rect.midX - 16 * scale, y: rect.midY - 16 * scale)
            .scaledBy(x: scale, y: scale)
    }
}

/// The full ring, drawn faintly behind the filled arc.
nonisolated struct CoachRingTrack: Shape {
    func path(in rect: CGRect) -> Path {
        Path(ellipseIn: CGRect(x: 8, y: 8, width: 16, height: 16))
            .strokedPath(StrokeStyle(lineWidth: CoachRing.lineWidth))
            .applying(CoachRing.transform(in: rect))
    }
}

/// The filled arc: from 12 o'clock the long way round, through 9 and 6 o'clock, to the dot.
nonisolated struct CoachRingArc: Shape {
    func path(in rect: CGRect) -> Path {
        var arc = Path()
        // In y-down coordinates `clockwise: true` draws counter-clockwise on screen.
        arc.addArc(
            center: CGPoint(x: 16, y: 16), radius: CoachRing.radius,
            startAngle: .degrees(CoachRing.start), endAngle: .degrees(CoachRing.end), clockwise: true
        )
        return arc
            .strokedPath(StrokeStyle(lineWidth: CoachRing.lineWidth, lineCap: .round))
            .applying(CoachRing.transform(in: rect))
    }
}

/// The dot at the arc's end.
nonisolated struct CoachRingDot: Shape {
    func path(in rect: CGRect) -> Path {
        let r = CoachRing.dotRadius
        return Path(ellipseIn: CGRect(x: 23.6 - r, y: 18.5 - r, width: 2 * r, height: 2 * r))
            .applying(CoachRing.transform(in: rect))
    }
}

/// The app icon in small: the orange progress ring on the dark rounded square.
struct CoachBadge: View {
    var size: CGFloat = 22

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.235, style: .continuous)
            .fill(WidgetColors.iconTile)
            .overlay {
                ZStack {
                    CoachRingTrack().fill(.white.opacity(0.14))
                    CoachRingArc().fill(WidgetColors.accent)
                    CoachRingDot().fill(.white)
                }
            }
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

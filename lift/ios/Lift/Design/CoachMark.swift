import KoboTokens
import SwiftUI

/// Coach's mark without its tile: the progress ring of the app icon (Design/AppIcon.svg), its arc in the accent
/// from 12 o'clock the long way round to a dot, over a faint track. For the chat's greeting and its Thought row.
struct CoachMark: View {
    @Environment(\.koboTheme) private var theme
    var size: CGFloat = Size.iconLg

    var body: some View {
        ZStack {
            CoachMarkTrack().fill(theme.palette.textPrimary.opacity(0.12))
            CoachMarkArc().fill(theme.palette.accent)
            CoachMarkDot().fill(theme.palette.textPrimary)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// The ring's drawing in the icon's 32 pt artwork: radius 8 around the centre, a 3.2 pt stroke, the dot at (23.6, 18.5).
nonisolated private enum CoachMarkGeometry {
    static let lineWidth: CGFloat = 3.2

    static func transform(in rect: CGRect) -> CGAffineTransform {
        // The ring spans 19.2 pt of the 32 pt artwork; scale it to fill the frame.
        let scale = min(rect.width, rect.height) / 19.2
        return CGAffineTransform(translationX: rect.midX - 16 * scale, y: rect.midY - 16 * scale)
            .scaledBy(x: scale, y: scale)
    }
}

nonisolated private struct CoachMarkTrack: Shape {
    func path(in rect: CGRect) -> Path {
        Path(ellipseIn: CGRect(x: 8, y: 8, width: 16, height: 16))
            .strokedPath(StrokeStyle(lineWidth: CoachMarkGeometry.lineWidth))
            .applying(CoachMarkGeometry.transform(in: rect))
    }
}

nonisolated private struct CoachMarkArc: Shape {
    func path(in rect: CGRect) -> Path {
        var arc = Path()
        // In y-down coordinates `clockwise: true` draws counter-clockwise on screen.
        arc.addArc(
            center: CGPoint(x: 16, y: 16), radius: 8,
            startAngle: .degrees(-90), endAngle: .degrees(18.2), clockwise: true
        )
        return arc.strokedPath(StrokeStyle(lineWidth: CoachMarkGeometry.lineWidth, lineCap: .round))
            .applying(CoachMarkGeometry.transform(in: rect))
    }
}

nonisolated private struct CoachMarkDot: Shape {
    func path(in rect: CGRect) -> Path {
        Path(ellipseIn: CGRect(x: 23.6 - 1.25, y: 18.5 - 1.25, width: 2.5, height: 2.5))
            .applying(CoachMarkGeometry.transform(in: rect))
    }
}

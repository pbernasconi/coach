import CraftTokens
import SwiftUI

/// The drawing shared by `ProgressRing` and `CountdownRing`: a full track and a rounded arc from 12 o'clock.
/// It fits the largest square it is offered.
struct RingStroke: View {
    let progress: Double
    let lineWidth: CGFloat
    let color: Color
    let trackColor: Color

    init(progress: Double, lineWidth: CGFloat, color: Color, trackColor: Color) {
        self.progress = progress
        self.lineWidth = lineWidth
        self.color = color
        self.trackColor = trackColor
    }

    var body: some View {
        ZStack {
            Circle()
                .inset(by: lineWidth / 2)
                .stroke(trackColor, lineWidth: lineWidth)
            Circle()
                .inset(by: lineWidth / 2)
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                // A round cap on an empty arc would still draw a dot.
                .opacity(progress > 0 ? 1 : 0)
        }
        .aspectRatio(1, contentMode: .fit)
    }
}

/// How a ring is coloured: by tone (resolved against the theme) or by an explicit colour.
enum RingTint {
    case tone(Tone)
    case color(Color)

    func resolve(in palette: Palette) -> Color {
        switch self {
        case .tone(.accent): palette.accent
        case .tone(let tone): palette.status(tone).ink
        case .color(let color): color
        }
    }
}

import Foundation
import KoboTokens
import SwiftUI

/// The lines under a stacked bar chart that name its marks: the dashed reference ("avg 4:40") and the dot under marked
/// bars ("Strength days"). Decorative for VoiceOver: the chart's summary reads the numbers.
struct StackedBarLegend: View {
    @Environment(\.koboTheme) private var theme
    let reference: String?
    let markLabel: String?
    let dot: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            if let reference, !reference.isEmpty {
                Label {
                    Text(verbatim: reference)
                } icon: {
                    DashSwatch()
                        .stroke(
                            theme.palette.textSecondary,
                            style: StrokeStyle(lineWidth: Size.hairline * 2, dash: [Space.xs / 2, Space.xs / 2])
                        )
                        .frame(width: dot * 3, height: dot)
                }
            }
            if let markLabel {
                Label {
                    Text(verbatim: markLabel)
                } icon: {
                    Circle().fill(theme.palette.textPrimary).frame(width: dot, height: dot)
                }
            }
        }
        .font(theme.font(.caption))
        .foregroundStyle(theme.palette.textSecondary)
        .accessibilityHidden(true)
    }
}

/// A short horizontal line for the dashed-reference swatch.
private nonisolated struct DashSwatch: Shape {
    func path(in rect: CGRect) -> Path {
        Path { path in
            path.move(to: CGPoint(x: rect.minX, y: rect.midY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        }
    }
}

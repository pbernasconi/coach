import KoboComponents
import KoboTokens
import SwiftUI

/// The rest after an exercise's last set, as the last row of that exercise's set grid: "Rest 0:36 / 3:00", with the
/// row's soft accent wash filling from the left as the rest goes by. The rest belongs to the lift just done (its rest
/// time, its recovery), so it closes that lift's sets rather than sitting in the next exercise's first set. It shows
/// only while that rest runs, so the exercise stays short the rest of the time.
struct ExerciseRestRow: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var badgeWidth = SetGridWidth.badge
    let rest: RestTimer

    var body: some View {
        HStack(spacing: Space.sm) {
            Image(systemName: "timer")
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(theme.palette.accentText)
                .frame(width: badgeWidth, alignment: .leading)  // in the Set column, like a set's badge
                .accessibilityHidden(true)
            Text("Rest \(rest.elapsedText) / \(rest.totalText)")
                .font(theme.font(.subheadline).weight(.bold).monospacedDigit())
                .foregroundStyle(theme.palette.accentText)
                .contentTransition(.numericText(value: Double(rest.elapsed)))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, SetGridWidth.inset)
        .frame(maxWidth: .infinity, minHeight: Size.minTouch, alignment: .leading)
        .background(alignment: .leading) {
            GeometryReader { proxy in
                theme.palette.accentSoft
                    .frame(width: proxy.size.width * progress)
                    .koboAnimation(.state, value: rest.elapsed)
            }
        }
        .background(theme.palette.accentSoft.opacity(RestingRow.washOpacity))
        .overlay(alignment: .top) { Separator() }  // edge to edge of the card, like the set rows
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Rest"))
        .accessibilityValue(Text("Rested \(rest.elapsedText) of \(rest.totalText)"))
        .accessibilityAddTraits(.updatesFrequently)
    }

    /// The share of the rest gone by, from 0 to 1.
    private var progress: CGFloat {
        rest.total > 0 ? min(1, CGFloat(rest.elapsed) / CGFloat(rest.total)) : 0
    }
}

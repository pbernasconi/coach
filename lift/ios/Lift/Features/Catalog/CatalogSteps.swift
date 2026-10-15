import KoboComponents
import KoboTokens
import SwiftUI

/// The dataset's steps for one rep, numbered.
struct CatalogSteps: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .subheadline) private var badge: CGFloat = 20
    let steps: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            // Fixed text from the catalog; the offset is a stable identity and the step number.
            ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                    Text(verbatim: "\(index + 1)")
                        .font(theme.font(.caption).weight(.bold).monospacedDigit())
                        .foregroundStyle(theme.palette.onAccent)
                        .frame(minWidth: badge, minHeight: badge)
                        .background(theme.palette.accent, in: Circle())
                        .accessibilityLabel(Text("Step \(index + 1)"))
                    Text(verbatim: step)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

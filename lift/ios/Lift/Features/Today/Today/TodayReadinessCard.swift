import KoboComponents
import KoboTokens
import SwiftUI

/// The readiness verdict: a toned dot with its label ("Take it easy"), the server's one sentence, and the flags that
/// led to it as small lines. The label always says what the colour does.
struct TodayReadinessCard: View {
    @Environment(\.koboTheme) private var theme
    let readiness: HealthReadiness

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack(spacing: Space.sm) {
                Circle()
                    .fill(theme.palette.status(tone).ink)
                    .frame(width: Space.md, height: Space.md)
                    .accessibilityHidden(true)
                Text(verbatim: readiness.label)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
            }
            Text(verbatim: readiness.text)
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if !readiness.flags.isEmpty {
                VStack(alignment: .leading, spacing: Space.xs) {
                    ForEach(Array(readiness.flags.enumerated()), id: \.offset) { _, flag in
                        Label {
                            Text(verbatim: flag).fixedSize(horizontal: false, vertical: true)
                        } icon: {
                            Image(systemName: "exclamationmark.circle").foregroundStyle(theme.palette.status(tone).ink)
                        }
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textSecondary)
                    }
                }
                .padding(.top, Space.xxs)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .koboCard()
        .accessibilityElement(children: .combine)
    }

    /// The verdict's tone: ready green, one flag amber, take it easy red, not enough data grey.
    private var tone: Tone {
        switch readiness.status {
        case "good": .success
        case "ok": .warning
        case "low": .danger
        default: .neutral
        }
    }
}

import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// Every step of a planned workout, as the web's step list: a zone mark, the length, the kind and cue, the target. A
/// repeat shows "6 ×" over its own steps, indented.
struct PlannedStepList: View {
    @Environment(\.koboTheme) private var theme
    let steps: [PlannedStep]

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            ForEach(Array(steps.enumerated()), id: \.offset) { _, step in
                if step.kind == "repeat" {
                    VStack(alignment: .leading, spacing: Space.xxs) {
                        Text(verbatim: step.label)
                            .font(theme.font(.caption).weight(.semibold))
                            .foregroundStyle(theme.palette.textSecondary)
                        VStack(alignment: .leading, spacing: Space.xxs) {
                            ForEach(Array((step.steps ?? []).enumerated()), id: \.offset) { _, inner in
                                row(inner)
                            }
                        }
                        .padding(.leading, Space.md)
                        .overlay(alignment: .leading) {
                            Rectangle().fill(theme.palette.separator).frame(width: Size.hairline * 2)
                        }
                    }
                } else {
                    row(step)
                }
            }
        }
    }

    private func row(_ step: PlannedStep) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
            RoundedRectangle(cornerRadius: Size.hairline * 2)
                .fill(PlannedZone.color(step.zone ?? "Z1", palette: theme.palette))
                .frame(width: Space.sm, height: Space.sm + Space.xxs)
            Text(verbatim: step.length ?? "")
                .font(theme.font(.subheadline).monospacedDigit())
                .foregroundStyle(theme.palette.textPrimary)
                .frame(minWidth: Space.xxxl * 2, alignment: .leading)
            Text(verbatim: step.label)
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(verbatim: step.target ?? "")
                .font(theme.font(.subheadline).monospacedDigit())
                .foregroundStyle(theme.palette.textPrimary)
                .multilineTextAlignment(.trailing)
        }
        .accessibilityElement(children: .combine)
    }
}

/// The Coach zones Z1–Z5 as the strip's levels and their colours (cool to hot, as Kobo's zone bars).
nonisolated enum PlannedZone {
    /// "Z1"…"Z5" to 0…4; anything else is 0.
    static func level(_ zone: String) -> Int {
        Int(zone.dropFirst()).map { min(max($0 - 1, 0), 4) } ?? 0
    }

    @MainActor static func color(_ zone: String, palette: Palette) -> Color {
        let ramp = [palette.neutral.ink, palette.info.ink, palette.success.ink, palette.warning.ink, palette.danger.ink]
        return ramp[level(zone)]
    }
}

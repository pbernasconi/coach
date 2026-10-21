import KoboComponents
import KoboTokens
import SwiftUI

/// Hard sets per muscle this week on one scale, the 10–20 band shaded and the 4-week average as a tick: arms first,
/// then the other muscles. Each row reads the server's sentence.
struct LiftMusclesView: View {
    @Environment(\.koboTheme) private var theme
    let muscles: LiftMuscles

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            Text(verbatim: muscles.title)
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(theme.palette.textPrimary)
            LiftCaption(text: muscles.caption)
            VStack(alignment: .leading, spacing: Space.sm) {
                ForEach(muscles.arms + muscles.other) { muscle in
                    LiftMuscleRow(muscle: muscle, band: muscles.band, scaleMax: muscles.scaleMax)
                }
            }
            .koboCard()
        }
    }
}

private struct LiftMuscleRow: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    /// The name and count column, so every bar starts at one edge; it grows with the text size.
    @ScaledMetric(relativeTo: .subheadline) private var labelWidth = Size.thumbnail * 2
    let muscle: LiftMuscle
    let band: LiftBand
    let scaleMax: Double

    var body: some View {
        let layout =
            dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Space.xs))
            : AnyLayout(HStackLayout(spacing: Space.md))
        layout {
            HStack(spacing: Space.xs) {
                Text(verbatim: muscle.name)
                    .foregroundStyle(theme.palette.textPrimary)
                Spacer(minLength: Space.xs)
                Text(verbatim: muscle.weekText)
                    .monospacedDigit()
                    .foregroundStyle(theme.palette.textSecondary)
            }
            .font(theme.font(.subheadline))
            .frame(maxWidth: dynamicTypeSize.isAccessibilitySize ? .infinity : labelWidth, alignment: .leading)
            BandBar(
                value: muscle.week,
                scaleMax: scaleMax,
                band: band.min...max(band.min, band.max),
                tick: muscle.avg,
                tone: muscle.status == "below" ? .warning : .accent
            )
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: muscle.label))
    }
}

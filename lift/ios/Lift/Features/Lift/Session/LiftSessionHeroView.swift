import KoboComponents
import KoboTokens
import SwiftUI

/// The session's hero: day and start, title, state, note, the sets ring and the muscles worked, then the stats. The
/// "Sets" stat is left out, because the ring already shows sets logged against planned. Every text is the server's.
struct LiftSessionHeroView: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let hero: LiftSessionHero

    var body: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            WorkoutHeader(
                sport: .strength,
                kicker: hero.kicker,
                title: hero.title,
                status: WorkoutStatus(sessionState: hero.state),
                statusLabel: hero.stateLabel
            ) {
                if let note = hero.note {
                    Text(verbatim: note)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            ringAndMuscles
            LazyVGrid(columns: columns, alignment: .leading, spacing: Space.sm) {
                ForEach(hero.shownStats) { stat in
                    StatTile(verbatim: stat.label, value: stat.value) {
                        if let detail = stat.detail {
                            Text(verbatim: detail)
                                .font(theme.font(.caption))
                                .foregroundStyle(theme.palette.textSecondary)
                        }
                    }
                }
            }
        }
    }

    /// The ring beside the muscle bars; stacked at accessibility sizes.
    @ViewBuilder private var ringAndMuscles: some View {
        let layout =
            dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Space.lg))
            : AnyLayout(HStackLayout(alignment: .top, spacing: Space.lg))
        layout {
            LiftSessionRing(ring: hero.ring)
            if !hero.muscles.isEmpty {
                LiftSessionMuscleBars(muscles: hero.muscles)
            }
        }
        .koboCard()
    }

    private var columns: [GridItem] {
        let count = dynamicTypeSize.isAccessibilitySize ? 1 : 2
        return Array(repeating: GridItem(.flexible(), spacing: Space.sm, alignment: .top), count: count)
    }
}

/// Sets logged against sets planned, with the server's "11/12" in the middle and its caption under the ring.
private struct LiftSessionRing: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .headline) private var side = Size.thumbnail * 1.6
    let ring: LiftRing

    var body: some View {
        VStack(spacing: Space.xs) {
            ProgressRing(
                progress: ring.progress,
                tone: ring.progress >= 1 ? .success : .accent,
                verbatimAccessibilityLabel: "\(ring.text) \(ring.caption)"
            ) {
                Text(verbatim: ring.text)
                    .font(theme.font(.headline).monospacedDigit())
                    .foregroundStyle(theme.palette.textPrimary)
                    .minimumScaleFactor(0.6)
            }
            .frame(width: side, height: side)
            Text(verbatim: ring.caption)
                .font(theme.font(.caption))
                .foregroundStyle(theme.palette.textSecondary)
        }
    }
}

/// Hard sets per muscle in this session, the biggest first, each as a bar against the first.
private struct LiftSessionMuscleBars: View {
    @Environment(\.koboTheme) private var theme
    let muscles: [LiftSessionMuscle]

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            ForEach(muscles) { muscle in
                VStack(alignment: .leading, spacing: Space.xxs) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(verbatim: muscle.name)
                            .foregroundStyle(theme.palette.textPrimary)
                        Spacer(minLength: Space.sm)
                        Text(verbatim: muscle.setsText)
                            .monospacedDigit()
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                    .font(theme.font(.footnote))
                    InlineProgress(value: muscle.relative, accessibilityLabel: "Sets")
                        .accessibilityHidden(true)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text(verbatim: muscle.name))
                .accessibilityValue(Text("\(muscle.setsText) sets"))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension LiftSessionHero {
    /// The stats under the ring: every stat but "Sets", which the ring shows.
    var shownStats: [LiftStat] {
        stats.filter { $0.id != "sets" }
    }
}

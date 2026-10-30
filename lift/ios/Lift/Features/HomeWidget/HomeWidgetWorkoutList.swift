import SwiftUI

/// Today's workouts on the widget: a row each (the sport's icon, the title, the time and length, a tick once done), or
/// the day's empty text centred. Compiled into the app and LiftWidgets.
struct HomeWidgetWorkoutList: View {
    let snapshot: HomeWidgetSnapshot?
    var notice: String?
    /// The most rows shown; the rest are counted under them.
    var limit: Int
    /// Medium: each row opens its own workout. Small widgets take one tap target only.
    var linksRows: Bool

    var body: some View {
        if let snapshot, !snapshot.workouts.isEmpty {
            if linksRows {
                rows(snapshot.workouts)
            } else if let next = Self.ordered(snapshot.workouts).first {
                HomeWidgetWorkoutTile(workout: next)
            }
        } else {
            Text(verbatim: emptyText)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    /// The first workout still to do, then the done ones from the latest: what a one-workout face shows first.
    nonisolated static func ordered(_ workouts: [HomeWidgetSnapshot.Workout]) -> [HomeWidgetSnapshot.Workout] {
        workouts.filter { !$0.isDone } + workouts.filter(\.isDone).reversed()
    }

    private var emptyText: String {
        guard let snapshot else { return notice ?? String(localized: "Open Coach to connect") }
        return snapshot.emptyText ?? notice ?? String(localized: "No workouts for today")
    }

    private func rows(_ workouts: [HomeWidgetSnapshot.Workout]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(workouts.prefix(limit)) { workout in
                Link(destination: HomeWidgetSnapshot.link(for: workout) ?? Self.fallbackURL) {
                    HomeWidgetWorkoutRow(workout: workout)
                }
            }
            if workouts.count > limit {
                Text("+\(workouts.count - limit) more today")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(.leading, 32)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private static let fallbackURL = URL(filePath: "/")
}

/// One workout in a row: the icon, the title and, on the right, its time or a tick.
struct HomeWidgetWorkoutRow: View {
    let workout: HomeWidgetSnapshot.Workout

    @Environment(\.colorScheme) private var scheme

    var body: some View {
        HStack(spacing: 8) {
            HomeWidgetSportIcon(sport: workout.sport, size: 24)
            Text(verbatim: workout.title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(workout.isDone ? .secondary : .primary)
                .lineLimit(1)
            Spacer(minLength: 6)
            Text(verbatim: workout.detail)
                .font(.caption)
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .layoutPriority(1)
            if workout.isDone {
                Image(systemName: "checkmark.circle.fill")
                    .font(.subheadline)
                    .foregroundStyle(HomeWidgetColors.done(scheme))
                    .accessibilityLabel(Text("Done"))
            }
        }
    }
}

/// The small widget's workout: the icon over the title and its time.
struct HomeWidgetWorkoutTile: View {
    let workout: HomeWidgetSnapshot.Workout

    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                HomeWidgetSportIcon(sport: workout.sport, size: 20)
                if workout.isDone {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.footnote)
                        .foregroundStyle(HomeWidgetColors.done(scheme))
                        .accessibilityLabel(Text("Done"))
                }
            }
            Text(verbatim: workout.title)
                .font(.footnote.weight(.semibold))
                .lineLimit(2)
            Text(verbatim: workout.detail)
                .font(.caption2)
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A sport's SF Symbol, white on a circle of the sport's colour.
struct HomeWidgetSportIcon: View {
    let sport: String
    var size: CGFloat

    @Environment(\.colorScheme) private var scheme

    var body: some View {
        Image(systemName: HomeWidgetColors.sportSymbol(sport))
            .font(.system(size: size * 0.5, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Circle().fill(HomeWidgetColors.sport(sport, scheme)))
            .accessibilityHidden(true)
    }
}

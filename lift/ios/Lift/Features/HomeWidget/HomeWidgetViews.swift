import SwiftUI

// The Coach Home Screen widget's faces, without their container (the widget adds the system's margins and background;
// the demo gallery draws its own). Compiled into the app and LiftWidgets. `snapshot` nil: Coach has nothing to show
// yet, and `notice` says why.

/// Medium: fitness, form and fatigue across the top, today's workouts under them.
struct HomeWidgetMediumView: View {
    let snapshot: HomeWidgetSnapshot?
    var notice: String?

    var body: some View {
        VStack(spacing: 0) {
            ZStack(alignment: .topTrailing) {
                HomeWidgetLoadRow(load: snapshot?.load, numberSize: 30)
                    .frame(maxWidth: .infinity)
                CoachBadge(size: 20)
            }
            Spacer(minLength: 6)
            HomeWidgetWorkoutList(snapshot: snapshot, notice: notice, limit: 2, linksRows: true)
            Spacer(minLength: 0)
        }
    }
}

/// Small: the three numbers, then the first workout still to do (or the last one done).
struct HomeWidgetSmallView: View {
    let snapshot: HomeWidgetSnapshot?
    var notice: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HomeWidgetLoadRow(load: snapshot?.load, numberSize: 22, spacing: 8)
                .frame(maxWidth: .infinity)
            Spacer(minLength: 6)
            HomeWidgetWorkoutList(snapshot: snapshot, notice: notice, limit: 1, linksRows: false)
            Spacer(minLength: 0)
        }
    }
}

/// Lock Screen: the three numbers, then the next workout.
struct HomeWidgetRectangularView: View {
    let snapshot: HomeWidgetSnapshot?
    var notice: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HomeWidgetLoadRow(load: snapshot?.load, numberSize: 17, spacing: 10)
            Text(verbatim: nextLine)
                .font(.caption)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var nextLine: String {
        guard let snapshot else { return notice ?? String(localized: "Open Coach to connect") }
        guard let next = HomeWidgetWorkoutList.ordered(snapshot.workouts).first else {
            return snapshot.emptyText ?? String(localized: "No workouts for today")
        }
        return next.isDone ? String(localized: "\(next.title) ✓") : "\(next.title) · \(next.detail)"
    }
}

/// Fitness, form and fatigue side by side, each number over its name in its colour.
struct HomeWidgetLoadRow: View {
    let load: HomeWidgetSnapshot.Load?
    var numberSize: CGFloat = 30
    var spacing: CGFloat = 20

    @Environment(\.colorScheme) private var scheme

    var body: some View {
        HStack(alignment: .top, spacing: spacing) {
            stat(load?.fitness, "Fitness", HomeWidgetColors.fitness(scheme))
            stat(load?.form, "Form", HomeWidgetColors.form(scheme))
            stat(load?.fatigue, "Fatigue", HomeWidgetColors.fatigue(scheme))
        }
    }

    /// "19", or "−4" with a true minus sign.
    nonisolated static func text(_ value: Int) -> String {
        value < 0 ? "\u{2212}\(-value)" : "\(value)"
    }

    private func stat(_ value: Int?, _ label: LocalizedStringKey, _ color: Color) -> some View {
        VStack(spacing: -1) {
            Text(verbatim: value.map(Self.text) ?? "–")
                .font(.system(size: numberSize, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(label)
                .font(.system(size: max(11, numberSize * 0.42), weight: .medium))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .foregroundStyle(color)
        .accessibilityElement(children: .combine)
    }
}

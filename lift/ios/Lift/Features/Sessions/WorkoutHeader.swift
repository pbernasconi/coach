import KoboComponents
import KoboTokens
import SwiftUI

/// Where a workout stands, the same words and marks on every workout page (planned, done, a Lift session).
nonisolated enum WorkoutStatus: Equatable, Sendable {
    case planned
    case today
    case inProgress
    case done
    case partlyDone
    case notDone

    /// From the server's plan state (`planned | today | done | missed | skipped`) and compliance (`partial`, `off`).
    init(planState state: String, compliance: String?) {
        switch state {
        case "done": self = compliance == "partial" || compliance == "off" ? .partlyDone : .done
        case "missed", "skipped": self = .notDone
        case "today": self = .today
        default: self = .planned
        }
    }

    /// From a Lift session's state (`planned | inProgress | done`).
    init(sessionState state: String) {
        switch state {
        case "done": self = .done
        case "inProgress": self = .inProgress
        default: self = .planned
        }
    }

    var tone: Tone {
        switch self {
        case .planned: .neutral
        case .today, .inProgress: .accent
        case .done: .success
        case .partlyDone: .warning
        case .notDone: .danger
        }
    }

    var symbol: String {
        switch self {
        case .planned: "circle.dashed"
        case .today: "clock.fill"
        case .inProgress: "play.circle.fill"
        case .done, .partlyDone: "checkmark.circle.fill"
        case .notDone: "xmark.circle.fill"
        }
    }
}

/// The top of every workout page: the sport's icon large in a tile, beside a line of what and when ("Ride · Wednesday,
/// October 21 · 07:00"), the title, and under it the status pill and any tags. `detail` holds what a page adds under
/// it (a place, a note).
/// A page that shows its status another way passes no `status`, and then no pill shows.
struct WorkoutHeader<Detail: View>: View {
    @Environment(\.koboTheme) private var theme
    let sport: Sport
    let kicker: String
    let title: String
    let status: WorkoutStatus?
    let statusLabel: String
    var tags: [String] = []
    @ViewBuilder var detail: () -> Detail
    @ScaledMetric(relativeTo: .title) private var tileSize = Size.thumbnail

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            // The sport leads, large, in its colour, so a ride reads as a ride at a glance.
            HStack(alignment: .top, spacing: Space.md) {
                sport.icon
                    .font(.system(size: tileSize * SportTile.iconShare, weight: .semibold))
                    .frame(width: tileSize, height: tileSize)
                    .background(
                        sport.color.opacity(SportTile.fillOpacity),
                        in: .rect(cornerRadius: Radius.md, style: .continuous)
                    )
                // The status sits under the title beside the tile, not on a row of its own under it.
                VStack(alignment: .leading, spacing: Space.xxs) {
                    Text(verbatim: kicker)
                        .font(theme.font(.subheadline).weight(.semibold))
                        .foregroundStyle(theme.palette.textSecondary)
                    Text(verbatim: title)
                        .font(theme.font(.title))
                        .foregroundStyle(theme.palette.textPrimary)
                        .accessibilityAddTraits(.isHeader)
                    if status != nil || !tags.isEmpty {
                        FlowLayout(spacing: Space.xs) {
                            if let status {
                                StatusPill(verbatim: statusLabel, tone: status.tone, symbol: status.symbol)
                            }
                            ForEach(tags, id: \.self) { tag in
                                KoboTag(verbatim: tag, tone: .neutral)
                            }
                        }
                        .padding(.top, Space.xs)
                    }
                }
            }
            detail()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The header's sport tile: how much of it the icon fills, and how much of the sport's colour tints it (maths
/// constants, not colours).
nonisolated enum SportTile {
    static let iconShare: CGFloat = 0.5
    static let fillOpacity: Double = 0.16
}

extension WorkoutHeader where Detail == EmptyView {
    init(
        sport: Sport,
        kicker: String,
        title: String,
        status: WorkoutStatus?,
        statusLabel: String,
        tags: [String] = []
    ) {
        self.init(
            sport: sport,
            kicker: kicker,
            title: title,
            status: status,
            statusLabel: statusLabel,
            tags: tags,
            detail: { EmptyView() }
        )
    }
}

extension View {
    /// The older and newer workouts in one "…" menu in the bar, the same on every workout page: the bar keeps Back and
    /// one quiet button, with no arrows. A planned workout not done yet adds Move and Delete (`plan`); one done or not
    /// done by hand adds Mark done or Not done (`done`). Nothing shows when there is none of these.
    func workoutNeighbours(
        older: String,
        newer: String,
        canGoOlder: Bool,
        canGoNewer: Bool,
        onOlder: @escaping () -> Void,
        onNewer: @escaping () -> Void,
        plan: WorkoutPlanMenu? = nil,
        done: WorkoutDoneMenu? = nil
    ) -> some View {
        modifier(
            WorkoutNeighbours(
                older: older,
                newer: newer,
                canGoOlder: canGoOlder,
                canGoNewer: canGoNewer,
                onOlder: onOlder,
                onNewer: onNewer,
                plan: plan,
                done: done
            )
        )
    }
}

/// "Move to another day" and "Delete workout" in the bar's "…" of a planned workout not done yet.
struct WorkoutPlanMenu {
    let onMove: () -> Void
    let onDelete: () -> Void
}

/// "Mark done" (or "Not done" once marked by hand) in the bar's "…" of a planned workout, so the page keeps one
/// big action at most.
struct WorkoutDoneMenu {
    let isDone: Bool
    let isRunning: Bool
    let onToggle: (Bool) -> Void
}

private struct WorkoutNeighbours: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let older: String
    let newer: String
    let canGoOlder: Bool
    let canGoNewer: Bool
    let onOlder: () -> Void
    let onNewer: () -> Void
    let plan: WorkoutPlanMenu?
    let done: WorkoutDoneMenu?

    func body(content: Content) -> some View {
        content.toolbar {
            if canGoOlder || canGoNewer || plan != nil || done != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if let done {
                            Group {
                                if done.isDone {
                                    Button("Not done", systemImage: "arrow.uturn.backward") { done.onToggle(false) }
                                } else {
                                    Button("Mark done", systemImage: "checkmark") { done.onToggle(true) }
                                }
                            }
                            .disabled(done.isRunning)
                        }
                        if let plan {
                            Button("Move to another day", systemImage: "calendar", action: plan.onMove)
                            Button("Delete workout", systemImage: "trash", role: .destructive, action: plan.onDelete)
                        }
                        if canGoOlder || canGoNewer {
                            Section {
                                Button(newer, systemImage: "arrow.up", action: onNewer)
                                    .disabled(!canGoNewer)
                                Button(older, systemImage: "arrow.down", action: onOlder)
                                    .disabled(!canGoOlder)
                            }
                        }
                    } label: {
                        Label("More", systemImage: "ellipsis")
                    }
                    .tint(theme.palette.textPrimary)
                }
            }
        }
    }
}

extension View {
    /// The bar of a workout page, as Apple's own apps: no title while the page's header shows, then the title fades in
    /// once the page scrolls `after` points (the header has gone under the bar). Put it on the page's `ScrollView`.
    func workoutBarTitle(_ title: String?, after: CGFloat = WorkoutBarTitle.defaultReveal) -> some View {
        modifier(WorkoutBarTitle(title: title, after: after))
    }
}

struct WorkoutBarTitle: ViewModifier {
    /// About the height of the kicker and the title.
    static let defaultReveal: CGFloat = 90

    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let title: String?
    let after: CGFloat
    @State private var isShown = false

    func body(content: Content) -> some View {
        content
            .navigationBarTitleDisplayMode(.inline)
            .onScrollGeometryChange(for: Bool.self) { geometry in
                geometry.contentOffset.y + geometry.contentInsets.top > after
            } action: { _, shown in
                withAnimation(Motion.fastSpatial.animation(reduceMotion: reduceMotion)) { isShown = shown }
            }
            .toolbar {
                ToolbarItem(placement: .principal) {
                    if let title {
                        Text(verbatim: title)
                            .font(theme.font(.headline))
                            .foregroundStyle(theme.palette.textPrimary)
                            .lineLimit(1)
                            .opacity(isShown ? 1 : 0)
                            .offset(y: isShown ? 0 : Space.sm)
                            .accessibilityHidden(!isShown)
                    }
                }
            }
    }
}

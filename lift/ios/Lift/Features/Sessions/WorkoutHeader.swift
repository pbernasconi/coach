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

/// The top of every workout page: the sport's icon with a line of what and when ("Ride · Wednesday, October 21 ·
/// 07:00"), the title, then the status pill and any tags. `detail` holds what a page adds under it (a place, a note).
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

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Label {
                Text(verbatim: kicker)
            } icon: {
                sport.icon
            }
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
                .padding(.top, Space.xxs)
            }
            detail()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
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
    /// The older and newer arrows of a workout page in the bar, in ink, the same on every workout page.
    func workoutNeighbours(
        older: String,
        newer: String,
        canGoOlder: Bool,
        canGoNewer: Bool,
        onOlder: @escaping () -> Void,
        onNewer: @escaping () -> Void
    ) -> some View {
        modifier(
            WorkoutNeighbours(
                older: older,
                newer: newer,
                canGoOlder: canGoOlder,
                canGoNewer: canGoNewer,
                onOlder: onOlder,
                onNewer: onNewer
            )
        )
    }
}

private struct WorkoutNeighbours: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let older: String
    let newer: String
    let canGoOlder: Bool
    let canGoNewer: Bool
    let onOlder: () -> Void
    let onNewer: () -> Void

    func body(content: Content) -> some View {
        content.toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button(older, systemImage: "chevron.left", action: onOlder)
                    .disabled(!canGoOlder)
                    .tint(theme.palette.textPrimary)
                Button(newer, systemImage: "chevron.right", action: onNewer)
                    .disabled(!canGoNewer)
                    .tint(theme.palette.textPrimary)
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

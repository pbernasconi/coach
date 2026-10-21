import KoboComponents
import KoboTokens
import SwiftUI

/// Upcoming sessions, then the logged ones newest first: the first `shown`, the rest folded. Every row opens its
/// session. Weekly volume sits under the list.
struct LiftSessionsView: View {
    let sessions: LiftSessions
    let isExpanded: Bool
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            LiftCaption(text: sessions.caption)
            if !sessions.upcoming.isEmpty {
                ListSection("Coming up") {
                    ForEach(sessions.upcoming) { session in
                        ListRow(
                            verbatim: session.title,
                            subtitle: session.detail,
                            action: { send(.sessionTapped(session.sessionId)) }
                        ) {
                            Image(systemName: "calendar").accessibilityHidden(true)
                        } trailing: {
                            if let badge = session.badge { KoboTag(verbatim: badge, tone: .accent) }
                        }
                    }
                }
            }
            let shown = Array(sessions.logged.prefix(sessions.shown))
            let older = Array(sessions.logged.dropFirst(sessions.shown))
            if !shown.isEmpty {
                ListSection("Logged") {
                    ForEach(shown) { LiftLoggedRow(session: $0, send: send) }
                }
            }
            if !older.isEmpty {
                Collapsible(
                    "Older sessions",
                    subtitle: "\(older.count)",
                    isExpanded: .action(isExpanded) { send(.olderSessionsExpandedChanged($0)) }
                ) {
                    ListSection {
                        ForEach(older) { LiftLoggedRow(session: $0, send: send) }
                    } header: {
                        EmptyView()
                    }
                }
            }
            Button("Weekly volume", systemImage: "chart.bar") { send(.weeklyTapped) }
                .buttonStyle(.kobo(.secondary, width: .full))
        }
    }
}

/// One logged session: a date block, the title, the meta line, its PRs, and the volume with a bar against the largest
/// session.
private struct LiftLoggedRow: View {
    @Environment(\.koboTheme) private var theme
    let session: LiftLoggedSession
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        Button {
            send(.sessionTapped(session.sessionId))
        } label: {
            HStack(alignment: .top, spacing: Space.md) {
                VStack(spacing: 0) {
                    Text(verbatim: session.weekdayText).font(theme.font(.caption))
                    Text(verbatim: session.dayText).font(theme.font(.title2).monospacedDigit())
                    Text(verbatim: session.monthText).font(theme.font(.caption))
                }
                .foregroundStyle(theme.palette.textSecondary)
                .frame(minWidth: Size.minTouch)
                VStack(alignment: .leading, spacing: Space.xs) {
                    Text(verbatim: session.title)
                        .font(theme.font(.headline))
                        .foregroundStyle(theme.palette.textPrimary)
                    Text(verbatim: session.meta)
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                    if let pr = session.prText {
                        Label {
                            Text(verbatim: pr)
                        } icon: {
                            Image(systemName: "trophy.fill").accessibilityHidden(true)
                        }
                        .font(theme.font(.footnote).weight(.semibold))
                        .foregroundStyle(theme.palette.success.ink)
                    }
                    HStack(spacing: Space.sm) {
                        LiftRelativeBar(fraction: session.relative)
                        Text(verbatim: "\(session.volumeText) \(session.volumeUnit)")
                            .font(theme.font(.footnote).monospacedDigit())
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .multilineTextAlignment(.leading)
            .padding(.horizontal, Space.cardInset)
            .padding(.vertical, Space.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.pressFeedback(.highlight))
        .overlay(alignment: .top) { Separator(leadingInset: Space.cardInset) }
        .accessibilityElement(children: .combine)
    }
}

/// A thin bar filled to `fraction` (0–1) of its width, for a volume against the largest one. Decorative: the text next
/// to it reads the number.
struct LiftRelativeBar: View {
    @Environment(\.koboTheme) private var theme
    let fraction: Double

    var body: some View {
        Capsule()
            .fill(theme.palette.surfaceSunken)
            .frame(height: Space.xs)
            .overlay(alignment: .leading) {
                GeometryReader { proxy in
                    Capsule()
                        .fill(theme.palette.accent)
                        .frame(width: proxy.size.width * min(max(fraction, 0), 1))
                }
            }
            .frame(maxWidth: .infinity)
            .accessibilityHidden(true)
    }
}

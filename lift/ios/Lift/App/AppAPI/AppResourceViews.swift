import KoboComponents
import KoboPatterns
import KoboTokens
import LiftSync
import SwiftUI

/// The page body of one App API screen: Kobo's `LoadableView` with the one "Connect Lift to Coach" empty state every
/// coach screen shares, and the freshness line above the loaded content. Pull to refresh belongs on the scroll view
/// around it (`appRefreshable`).
///
///     AppResourcePage(state.today, onRetry: { send(.retryTapped) }, onConnect: { send(.connectTapped) }) { today in
///         TodaySections(today: today)
///     }
struct AppResourcePage<Value: Equatable & Sendable, Loaded: View>: View {
    private let state: AppResourceState<Value>
    private let onRetry: () -> Void
    private let onConnect: (() -> Void)?
    private let loaded: (Value) -> Loaded

    /// - Parameter onConnect: "Open Settings" under the not-connected state (switch to Settings → Sync); none when nil.
    init(
        _ state: AppResourceState<Value>,
        onRetry: @escaping () -> Void,
        onConnect: (() -> Void)? = nil,
        @ViewBuilder loaded: @escaping (Value) -> Loaded
    ) {
        self.state = state
        self.onRetry = onRetry
        self.onConnect = onConnect
        self.loaded = loaded
    }

    var body: some View {
        LoadableView(state.content, onRetry: onRetry) { value in
            VStack(alignment: .leading, spacing: Space.section) {
                if let freshness = state.freshness { AppFreshnessLine(freshness: freshness) }
                loaded(value)
            }
        } empty: {
            AppNotConnectedView(onConnect: onConnect)
        }
    }
}

/// The one not-connected state of every coach screen: what is missing and the way to Settings → Sync.
struct AppNotConnectedView: View {
    let onConnect: (() -> Void)?

    var body: some View {
        EmptyState(
            symbol: "link.badge.plus",
            title: "Connect Lift to Coach",
            message: "Your coach's plan and numbers show here once Lift syncs. Connect it in Settings, under Sync."
        ) {
            if let onConnect {
                Button("Open Settings", systemImage: "gearshape", action: onConnect)
                    .buttonStyle(.kobo(.primary))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Space.xxl)
    }
}

/// "Updated 1:05 PM", or "Offline · updated 1:05 PM" with the offline glyph.
struct AppFreshnessLine: View {
    @Environment(\.koboTheme) private var theme
    let freshness: AppFreshness

    var body: some View {
        Label {
            Text(verbatim: freshness.text)
        } icon: {
            Image(systemName: freshness.isOffline ? "wifi.slash" : "checkmark.icloud")
                .accessibilityHidden(true)
        }
        .font(theme.font(.caption))
        .foregroundStyle(freshness.isOffline ? theme.palette.textSecondary : theme.palette.textTertiary)
    }
}

/// One `{ok}` section of an App API page: its title, then the content, or a quiet card when the server could not load
/// that part (the rest of the page still shows).
///
///     AppSectionView("Body", section: today.body) { body in TodayBodyCard(body: body) }
struct AppSectionView<Value: Decodable & Equatable & Sendable, Content: View>: View {
    private let title: LocalizedStringKey?
    private let section: AppSection<Value>
    private let content: (Value) -> Content

    init(_ title: LocalizedStringKey?, section: AppSection<Value>, @ViewBuilder content: @escaping (Value) -> Content) {
        self.title = title
        self.section = section
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            if let title { SectionHeader(title) }
            switch section {
            case .ok(let value):
                content(value)
            case .failed:
                SectionEmptyCard(
                    "Could not load this part",
                    caption: "Coach had a problem with it. Pull down to try again.",
                    systemImage: "exclamationmark.triangle"
                )
            }
        }
    }
}

extension View {
    /// Pull to refresh for an App API page, with Kobo's haptic.
    func appRefreshable(_ action: @escaping @Sendable () async -> Void) -> some View {
        koboRefreshable(action)
    }
}

extension AppTone {
    /// The Kobo tone for a server tone: good green, warn amber, bad red, up green, down red, neutral grey.
    var kobo: Tone {
        switch self {
        case .good, .up: .success
        case .warn: .warning
        case .bad, .down: .danger
        case .neutral: .neutral
        }
    }
}

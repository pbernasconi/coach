import KoboComponents
import KoboPatterns
import KoboTokens
import LiftSync
import SwiftUI

/// The page body of one App API screen: Kobo's `LoadableView` with the one "Connect this iPhone to Coach" empty state every
/// coach screen shares, and the freshness line above the loaded content. While it loads it shows `placeholder`, a
/// skeleton in the page's own layout (`.skeletonPage()`: invisible for a fast load, then a quiet breath); without one,
/// the generic `AppPageSkeleton`. Pull to refresh belongs on the scroll view around it (`appRefreshable`).
///
///     AppResourcePage(state.today, onRetry: { send(.retryTapped) }, onConnect: { send(.connectTapped) }) { today in
///         TodaySections(today: today)
///     } placeholder: {
///         TodaySkeleton()
///     }
struct AppResourcePage<Value: Equatable & Sendable, Loaded: View, Placeholder: View>: View {
    private let state: AppResourceState<Value>
    private let onRetry: () -> Void
    private let onConnect: (() -> Void)?
    private let showsFreshness: Bool
    private let loaded: (Value) -> Loaded
    private let placeholder: Placeholder

    /// - Parameters:
    ///   - onConnect: "Open Settings" under the not-connected state (switch to Settings → Sync); none when nil.
    ///   - showsFreshness: the "Updated 1:05 PM" line; a page whose data does not change hides it (the offline line
    ///     still shows).
    init(
        _ state: AppResourceState<Value>,
        onRetry: @escaping () -> Void,
        onConnect: (() -> Void)? = nil,
        showsFreshness: Bool = true,
        @ViewBuilder loaded: @escaping (Value) -> Loaded,
        @ViewBuilder placeholder: () -> Placeholder
    ) {
        self.state = state
        self.onRetry = onRetry
        self.onConnect = onConnect
        self.showsFreshness = showsFreshness
        self.loaded = loaded
        self.placeholder = placeholder()
    }

    var body: some View {
        LoadableView(state.content, onRetry: onRetry) { value in
            VStack(alignment: .leading, spacing: Space.section) {
                if let freshness = state.freshness, showsFreshness || freshness.isOffline {
                    AppFreshnessLine(freshness: freshness)
                }
                loaded(value)
            }
        } placeholder: {
            placeholder
        } empty: {
            AppNotConnectedView(needsReconnect: state.needsReconnect, onConnect: onConnect)
        }
    }
}

extension AppResourcePage where Placeholder == AppPageSkeleton {
    /// A page with the generic skeleton while it loads.
    init(
        _ state: AppResourceState<Value>,
        onRetry: @escaping () -> Void,
        onConnect: (() -> Void)? = nil,
        showsFreshness: Bool = true,
        @ViewBuilder loaded: @escaping (Value) -> Loaded
    ) {
        self.init(
            state,
            onRetry: onRetry,
            onConnect: onConnect,
            showsFreshness: showsFreshness,
            loaded: loaded,
            placeholder: { AppPageSkeleton() }
        )
    }
}

/// The one not-connected state of every coach screen: what is missing and the way to Settings → Sync.
struct AppNotConnectedView: View {
    /// The coach refused the stored token: ask to connect again rather than for the first time.
    var needsReconnect = false
    let onConnect: (() -> Void)?

    var body: some View {
        EmptyState(
            symbol: needsReconnect ? "arrow.triangle.2.circlepath" : "link.badge.plus",
            title: needsReconnect ? "Connect this iPhone to Coach again" : "Connect this iPhone to Coach",
            message: needsReconnect
                ? "Coach did not accept this iPhone's sync token. Connect again in Settings, under Sync."
                : "Your coach's plan and numbers show here once this iPhone syncs. Connect it in Settings, under Sync."
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

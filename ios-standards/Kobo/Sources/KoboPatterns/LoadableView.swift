import Foundation
import KoboComponents
import KoboTokens
import SwiftUI

/// A retry button's title and action, handed to a `LoadableView`'s failed slot.
public struct LoadableRetry {
    public let label: Text
    public let action: () -> Void

    /// A retry with a localized title.
    public init(_ label: LocalizedStringKey, action: @escaping () -> Void) {
        self.init(label: Text(label), action: action)
    }

    /// A retry whose title is shown as is.
    public init(verbatim label: String, action: @escaping () -> Void) {
        self.init(label: Text(verbatim: label), action: action)
    }

    init(label: Text, action: @escaping () -> Void) {
        self.label = label
        self.action = action
    }
}

extension Loadable {
    /// A failure with localized copy, resolved from the app's bundle now. `Loadable` stores the resolved strings so it
    /// stays `Equatable`, `Sendable` and testable without SwiftUI; use `.failed(message:retryLabel:)` for runtime copy.
    ///
    ///     state.workouts = .failed("Couldn't load your workouts.", retryLabel: "Reload")
    public nonisolated static func failed(
        _ message: LocalizedStringResource,
        retryLabel: LocalizedStringResource? = nil
    ) -> Loadable {
        .failed(message: String(localized: message), retryLabel: retryLabel.map { String(localized: $0) })
    }
}

/// Renders a `Loadable` with one slot per phase, cross-fading between phases on `Motion.crossfade`
/// (instant with Reduce Motion). Changes inside `.loaded` do not fade. The standard slots are Kobo's own states, so
/// they follow the theme: `LoadingState` (a spinner that says so when a wait runs long), `LoadableEmptyView` (an
/// `EmptyState`) and `LoadableFailedView` (an `ErrorState`-style failure that VoiceOver announces).
///
///     LoadableView(state.workouts, onRetry: { send(.retryTapped) }) { rows in
///         WorkoutList(rows: rows)
///     } placeholder: {
///         WorkoutList.skeleton
///     } empty: {
///         LoadableEmptyView("No workouts yet", systemImage: "dumbbell")
///     }
public struct LoadableView<Value: Equatable & Sendable, Loaded: View, Placeholder: View, Empty: View, Failed: View>:
    View
{
    private let state: Loadable<Value>
    private let onRetry: (() -> Void)?
    private let loaded: (Value) -> Loaded
    private let placeholder: Placeholder
    private let empty: Empty
    private let failed: (String, LoadableRetry?) -> Failed

    /// Every slot custom. `failed` receives the message and a retry (nil without `onRetry`).
    public init(
        _ state: Loadable<Value>,
        onRetry: (() -> Void)? = nil,
        @ViewBuilder loaded: @escaping (Value) -> Loaded,
        @ViewBuilder placeholder: () -> Placeholder,
        @ViewBuilder empty: () -> Empty,
        @ViewBuilder failed: @escaping (_ message: String, _ retry: LoadableRetry?) -> Failed
    ) {
        self.state = state
        self.onRetry = onRetry
        self.loaded = loaded
        self.placeholder = placeholder()
        self.empty = empty()
        self.failed = failed
    }

    public var body: some View {
        ZStack {
            switch state {
            case .loading:
                placeholder.transition(.opacity)
            case .empty:
                empty.transition(.opacity)
            case .loaded(let value):
                loaded(value).transition(.opacity)
            case .failed(let message, let retryLabel):
                failed(message, retry(label: retryLabel)).transition(.opacity)
            }
        }
        .koboAnimation(.crossfade, value: state.phase)
    }

    private func retry(label: String?) -> LoadableRetry? {
        guard let onRetry else { return nil }
        return LoadableRetry(
            label: label.map { Text(verbatim: $0) } ?? Text("Try again", bundle: .module),
            action: onRetry
        )
    }
}

extension LoadableView where Failed == LoadableFailedView {
    /// Custom loaded, placeholder and empty slots; the standard failure view.
    public init(
        _ state: Loadable<Value>,
        onRetry: (() -> Void)? = nil,
        @ViewBuilder loaded: @escaping (Value) -> Loaded,
        @ViewBuilder placeholder: () -> Placeholder,
        @ViewBuilder empty: () -> Empty
    ) {
        self.init(state, onRetry: onRetry, loaded: loaded, placeholder: placeholder, empty: empty) { message, retry in
            LoadableFailedView(message: message, retry: retry)
        }
    }
}

extension LoadableView where Placeholder == LoadingState, Failed == LoadableFailedView {
    /// Custom loaded and empty slots; a `LoadingState` spinner while loading and the standard failure view.
    public init(
        _ state: Loadable<Value>,
        onRetry: (() -> Void)? = nil,
        @ViewBuilder loaded: @escaping (Value) -> Loaded,
        @ViewBuilder empty: () -> Empty
    ) {
        self.init(state, onRetry: onRetry, loaded: loaded, placeholder: { LoadingState() }, empty: empty)
    }
}

extension LoadableView
where Placeholder == LoadingState, Empty == LoadableEmptyView, Failed == LoadableFailedView {
    /// Only the loaded slot custom; standard spinner, empty and failure views.
    public init(
        _ state: Loadable<Value>,
        emptyTitle: LocalizedStringKey,
        emptySystemImage: String = "tray",
        onRetry: (() -> Void)? = nil,
        @ViewBuilder loaded: @escaping (Value) -> Loaded
    ) {
        self.init(state, onRetry: onRetry, loaded: loaded) {
            LoadableEmptyView(emptyTitle, systemImage: emptySystemImage)
        }
    }
}

/// The standard failure view: the danger art, "Couldn't load", the message and, when given, a retry button. VoiceOver
/// announces the title and message when it appears.
public struct LoadableFailedView: View {
    private let message: String
    private let retry: LoadableRetry?

    public init(message: String, retry: LoadableRetry?) {
        self.message = message
        self.retry = retry
    }

    public var body: some View {
        let title = String(localized: "Couldn't load", bundle: .module)
        EmptyState(verbatim: title, message: message) {
            EmptyStateArt(systemImage: "exclamationmark.triangle.fill", tone: .danger)
        } actions: {
            if let retry {
                Button(action: retry.action) { retry.label }
                    .buttonStyle(.kobo(.primary))
            }
        }
        .onAppear { AccessibilityNotification.Announcement(title + ". " + message).post() }
    }
}

/// The standard empty view: an `EmptyState` with an icon, a title and an optional message.
public struct LoadableEmptyView: View {
    private enum Copy {
        case localized(LocalizedStringKey, message: LocalizedStringKey?)
        case verbatim(String, message: String?)
    }

    private let copy: Copy
    private let systemImage: String

    /// An empty view with localized copy.
    public init(_ title: LocalizedStringKey, systemImage: String = "tray", message: LocalizedStringKey? = nil) {
        self.copy = .localized(title, message: message)
        self.systemImage = systemImage
    }

    /// An empty view whose copy is shown as is (a search term, user data).
    public init(verbatim title: String, systemImage: String = "tray", message: String? = nil) {
        self.copy = .verbatim(title, message: message)
        self.systemImage = systemImage
    }

    public var body: some View {
        switch copy {
        case .localized(let title, let message):
            EmptyState(symbol: systemImage, title: title, message: message)
        case .verbatim(let title, let message):
            EmptyState(symbol: systemImage, verbatim: title, message: message)
        }
    }
}

#if DEBUG
    private struct LoadableViewPreview: View {
        let state: Loadable<[String]>

        var body: some View {
            LoadableView(state, emptyTitle: "No workouts yet", emptySystemImage: "dumbbell", onRetry: {}) { names in
                VStack(alignment: .leading, spacing: Space.sm) {
                    ForEach(Array(names.enumerated()), id: \.offset) { _, name in
                        Text(name)
                    }
                }
            }
            .frame(maxWidth: .infinity, minHeight: Size.thumbnail * 3)
        }
    }

    #Preview("Phases") {
        let fixtures: [(String, Loadable<[String]>)] = [
            ("Loading", .loading),
            ("Empty", .empty),
            ("Loaded", .loaded(["Push day", "Pull day"])),
            ("Failed", .failed("The server did not answer.", retryLabel: "Reload")),
        ]
        StateGallery(fixtures) { state in
            LoadableViewPreview(state: state)
        }
    }

    #Preview("Dark") { LoadableViewPreview(state: .failed(message: "Offline")).preferredColorScheme(.dark) }
    #Preview("AX3") { LoadableViewPreview(state: .empty).dynamicTypeSize(.accessibility3) }
#endif

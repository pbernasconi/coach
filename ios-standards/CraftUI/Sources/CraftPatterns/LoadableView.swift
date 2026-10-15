import CraftTokens
import Foundation
import SwiftUI

/// A retry button's title and action, handed to a `LoadableView`'s failed slot.
public struct LoadableRetry {
    public let label: String
    public let action: () -> Void

    public init(label: String, action: @escaping () -> Void) {
        self.label = label
        self.action = action
    }
}

/// Renders a `Loadable` with one slot per phase, cross-fading between phases on `Motion.crossfade`
/// (instant with Reduce Motion). Changes inside `.loaded` do not fade.
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
        .craftAnimation(.crossfade, value: state.phase)
    }

    private func retry(label: String?) -> LoadableRetry? {
        guard let onRetry else { return nil }
        return LoadableRetry(label: label ?? String(localized: "Try again"), action: onRetry)
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

extension LoadableView where Placeholder == ProgressView<EmptyView, EmptyView>, Failed == LoadableFailedView {
    /// Custom loaded and empty slots; a spinner while loading and the standard failure view.
    public init(
        _ state: Loadable<Value>,
        onRetry: (() -> Void)? = nil,
        @ViewBuilder loaded: @escaping (Value) -> Loaded,
        @ViewBuilder empty: () -> Empty
    ) {
        self.init(state, onRetry: onRetry, loaded: loaded, placeholder: { ProgressView() }, empty: empty)
    }
}

extension LoadableView
where Placeholder == ProgressView<EmptyView, EmptyView>, Empty == LoadableEmptyView, Failed == LoadableFailedView {
    /// Only the loaded slot custom; standard spinner, empty and failure views.
    public init(
        _ state: Loadable<Value>,
        emptyTitle: String,
        emptySystemImage: String = "tray",
        onRetry: (() -> Void)? = nil,
        @ViewBuilder loaded: @escaping (Value) -> Loaded
    ) {
        self.init(state, onRetry: onRetry, loaded: loaded) {
            LoadableEmptyView(emptyTitle, systemImage: emptySystemImage)
        }
    }
}

/// The standard failure view: the message and, when given, a retry button.
public struct LoadableFailedView: View {
    private let message: String
    private let retry: LoadableRetry?

    public init(message: String, retry: LoadableRetry?) {
        self.message = message
        self.retry = retry
    }

    public var body: some View {
        ContentUnavailableView {
            Label(String(localized: "Couldn't load"), systemImage: "exclamationmark.triangle")
        } description: {
            Text(message)
        } actions: {
            if let retry {
                Button(retry.label, action: retry.action)
                    .buttonStyle(.glassProminent)
            }
        }
    }
}

/// The standard empty view: an icon, a title and an optional message.
public struct LoadableEmptyView: View {
    private let title: String
    private let systemImage: String
    private let message: String?

    public init(_ title: String, systemImage: String = "tray", message: String? = nil) {
        self.title = title
        self.systemImage = systemImage
        self.message = message
    }

    public var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: systemImage)
        } description: {
            if let message { Text(message) }
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
            ("Failed", .failed(message: "The server did not answer.", retryLabel: "Reload")),
        ]
        StateGallery(fixtures) { state in
            LoadableViewPreview(state: state)
        }
    }

    #Preview("Dark") { LoadableViewPreview(state: .failed(message: "Offline")).preferredColorScheme(.dark) }
    #Preview("AX3") { LoadableViewPreview(state: .empty).dynamicTypeSize(.accessibility3) }
#endif

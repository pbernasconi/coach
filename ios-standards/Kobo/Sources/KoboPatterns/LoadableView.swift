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
    ///     state.notes = .failed("Couldn't load your notes.", retryLabel: "Reload")
    public nonisolated static func failed(
        _ message: LocalizedStringResource,
        retryLabel: LocalizedStringResource? = nil
    ) -> Loadable {
        .failed(message: String(localized: message), retryLabel: retryLabel.map { String(localized: $0) })
    }
}

/// Renders a `Loadable` with one slot per phase, cross-fading between phases on `Motion.crossfade`
/// (instant with Reduce Motion). Changes inside `.loaded` do not fade. The standard slots are Kobo's own states, so
/// they follow the theme: `LoadingState` (a quiet spinner that says so when a wait runs long), `LoadableEmptyView` (an
/// `EmptyState`) and `LoadableFailedView` (an `ErrorState`-style failure that VoiceOver announces).
///
/// The placeholder follows `LoadingGrace`: give it `.skeletonPage()` (or use `LoadingState`), and it stays invisible
/// for `Motion.Duration.loadingGrace`, so a fast load goes straight to the content; once it shows, it stays at least
/// `Motion.Duration.placeholderHold`, so it never flashes. When content replaces a placeholder that showed, VoiceOver
/// hears that the layout changed.
///
///     LoadableView(state.notes, onRetry: { send(.retryTapped) }) { rows in
///         NoteList(rows: rows)
///     } placeholder: {
///         NoteList.skeleton
///     } empty: {
///         LoadableEmptyView("No notes yet", systemImage: "note.text")
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
    private let clock: any Clock<Duration>
    @State private var grace = LoadingGrace.waiting

    /// Every slot custom. `failed` receives the message and a retry (nil without `onRetry`).
    ///
    /// - Parameter clock: the time source of the placeholder's grace and hold; tests pass a manual clock.
    public init(
        _ state: Loadable<Value>,
        onRetry: (() -> Void)? = nil,
        clock: any Clock<Duration> = ContinuousClock(),
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
        self.clock = clock
    }

    public var body: some View {
        ZStack {
            if shownPhase == .loading {
                placeholder.transition(.opacity)
            } else {
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
        }
        .koboAnimation(.crossfade, value: shownPhase)
        .task(id: isTiming) {
            guard isTiming else { return }
            grace = .waiting
            await LoadingGrace.timer(clock: clock) { grace = $0 }
        }
        .onChange(of: shownPhase) { old, new in
            guard old == .loading, new == .loaded || new == .empty, grace.isVisible else { return }
            AccessibilityNotification.LayoutChanged().post()
        }
    }

    /// The phase on screen: the placeholder stays through its hold, even once the value is ready.
    private var shownPhase: Loadable<Value>.Phase {
        grace.holdsContent ? .loading : state.phase
    }

    /// The grace and hold run while loading, and while a placeholder that showed finishes its hold.
    private var isTiming: Bool {
        state.phase == .loading || grace.holdsContent
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

#if DEBUG
    private struct LoadableViewPreview: View {
        let state: Loadable<[String]>

        var body: some View {
            LoadableView(state, emptyTitle: "No notes yet", emptySystemImage: "note.text", onRetry: {}) { names in
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
            ("Loaded", .loaded(["Grocery list", "Reading notes"])),
            ("Failed", .failed("The server did not answer.", retryLabel: "Reload")),
        ]
        StateGallery(fixtures) { state in
            LoadableViewPreview(state: state)
        }
    }

    #Preview("Dark") { LoadableViewPreview(state: .failed(message: "Offline")).preferredColorScheme(.dark) }
    #Preview("AX3") { LoadableViewPreview(state: .empty).dynamicTypeSize(.accessibility3) }
#endif

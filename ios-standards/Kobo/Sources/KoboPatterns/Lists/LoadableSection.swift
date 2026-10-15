import KoboComponents
import KoboTokens
import SwiftUI

/// One section that loads inside a screen that is already showing (a "Recent" list under a ready header). The same
/// phases as `LoadableView`, at section height: ghost rows in a `ListSection` while loading, the content when loaded,
/// a text-only `SectionState` when empty, and a `SectionState` with a quiet "Try again" when the read failed (spoken to
/// VoiceOver). A failed read never reads as empty. Phases cross-fade on `Motion.crossfade`; changes inside `.loaded`
/// do not fade. Put the section's title above it, so the title stays in every phase.
///
///     SectionHeader("Recent")
///     LoadableSection(state.recent, emptyTitle: "No projects yet", onRetry: { send(.retryRecent) }) { rows in
///         ListSection { ForEach(rows) { ListRow(verbatim: $0.name, action: { open($0) }) } }
///     }
public struct LoadableSection<Value: Equatable & Sendable, Content: View>: View {
    private let state: Loadable<Value>
    private let skeletonRows: Int
    private let emptyTitle: LocalizedStringKey
    private let emptyMessage: LocalizedStringKey?
    private let isRetrying: Bool
    private let onRetry: (() -> Void)?
    private let content: (Value) -> Content

    /// - Parameters:
    ///   - skeletonRows: the ghost rows while loading.
    ///   - isRetrying: a retry of a failed read is running; the link spins in place.
    ///   - onRetry: shows "Try again" under a failure; `nil` shows the message alone.
    public init(
        _ state: Loadable<Value>,
        skeletonRows: Int = 3,
        emptyTitle: LocalizedStringKey,
        emptyMessage: LocalizedStringKey? = nil,
        isRetrying: Bool = false,
        onRetry: (() -> Void)? = nil,
        @ViewBuilder content: @escaping (Value) -> Content
    ) {
        self.state = state
        self.skeletonRows = skeletonRows
        self.emptyTitle = emptyTitle
        self.emptyMessage = emptyMessage
        self.isRetrying = isRetrying
        self.onRetry = onRetry
        self.content = content
    }

    public var body: some View {
        ZStack(alignment: .topLeading) {
            switch state {
            case .loading:
                ListSection { ListRowSkeleton(rows: skeletonRows) }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(Text("Loading", bundle: .module))
                    .transition(.opacity)
            case .loaded(let value):
                content(value).transition(.opacity)
            case .empty:
                SectionState(emptyTitle, message: emptyMessage)
                    .padding(.horizontal, Space.lg)
                    .transition(.opacity)
            case .failed(let message, let retryLabel):
                SectionState(
                    verbatim: message,
                    retryLabel: retryLabel,
                    isRetrying: isRetrying,
                    announces: true,
                    onRetry: onRetry
                )
                .padding(.horizontal, Space.lg)
                .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .koboAnimation(.crossfade, value: state.phase)
    }
}

#if DEBUG
    private struct LoadableSectionPreview: View {
        let state: Loadable<[String]>

        var body: some View {
            LoadableSection(state, skeletonRows: 2, emptyTitle: "No projects yet", onRetry: {}) { names in
                ListSection {
                    ForEach(Array(names.enumerated()), id: \.offset) { _, name in
                        ListRow(verbatim: name, action: {})
                    }
                }
            }
        }
    }

    private struct LoadableSectionGallery: View {
        var body: some View {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.xxl) {
                    LoadableSectionPreview(state: .loading)
                    LoadableSectionPreview(state: .loaded(["Garden plan", "Kitchen remodel"]))
                    LoadableSectionPreview(state: .empty)
                    LoadableSectionPreview(state: .failed(message: "Couldn't load recent projects."))
                }
                .pageGutter()
            }
            .screenCanvas()
        }
    }

    #Preview("Loadable section") { LoadableSectionGallery() }
    #Preview("Loadable section · dark, Amber") {
        LoadableSectionGallery().koboTheme(.amber).preferredColorScheme(.dark)
    }
    #Preview("Loadable section · AX3") { LoadableSectionGallery().dynamicTypeSize(.accessibility3) }
#endif

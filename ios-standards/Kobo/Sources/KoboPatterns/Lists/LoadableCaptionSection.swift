import KoboComponents
import KoboTokens
import SwiftUI

/// A read rendered inside a card the caller owns (a "Last trip" preview in a `.koboCard()`). The content shows when
/// loaded; every other phase is a small caption: ghost bars while loading, the empty caption, or the failure with a
/// quiet "Try again" (`SectionState`). A failed read never reads as empty. `LoadableSection` is the variant that draws
/// its own `ListSection`.
///
///     VStack(alignment: .leading) {
///         Text("Last trip").font(.headline)
///         LoadableCaptionSection(state.last, emptyCaption: "No trips yet", onRetry: retry) { trip in
///             TripSummary(trip)
///         }
///     }
///     .koboCard()
public struct LoadableCaptionSection<Value: Equatable & Sendable, Content: View>: View {
    @Environment(\.koboTheme) private var theme
    private let state: Loadable<Value>
    private let skeletonRows: Int
    private let emptyCaption: LocalizedStringKey
    private let isRetrying: Bool
    private let onRetry: (() -> Void)?
    private let content: (Value) -> Content

    /// - Parameters:
    ///   - skeletonRows: the ghost bars while loading.
    ///   - emptyCaption: the caption of a settled read with nothing to show.
    public init(
        _ state: Loadable<Value>,
        skeletonRows: Int = 2,
        emptyCaption: LocalizedStringKey,
        isRetrying: Bool = false,
        onRetry: (() -> Void)? = nil,
        @ViewBuilder content: @escaping (Value) -> Content
    ) {
        self.state = state
        self.skeletonRows = skeletonRows
        self.emptyCaption = emptyCaption
        self.isRetrying = isRetrying
        self.onRetry = onRetry
        self.content = content
    }

    public var body: some View {
        switch state {
        case .loaded(let value):
            content(value)
        case .loading:
            bars.modifier(CaptionRhythm())
        case .empty:
            Text(emptyCaption)
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
                .modifier(CaptionRhythm())
        case .failed(let message, let retryLabel):
            SectionState(
                verbatim: message,
                retryLabel: retryLabel,
                isRetrying: isRetrying,
                announces: true,
                onRetry: onRetry
            )
            .modifier(CaptionRhythm())
        }
    }

    private var bars: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            ForEach(SkeletonSlot.slots(skeletonRows)) { slot in
                Skeleton(.line).frame(width: SkeletonSlot.titleWidth(slot.id))
            }
        }
        .skeletonBreath()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Loading", bundle: .module))
    }
}

/// The vertical rhythm every caption phase shares, so the card does not jump between phases.
private struct CaptionRhythm: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.vertical, Space.md)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#if DEBUG
    private struct LoadableCaptionSectionGallery: View {
        private let states: [Loadable<String>] = [
            .loading, .loaded("Lisbon · 4 days"), .empty, .failed(message: "Offline"),
        ]

        var body: some View {
            ScrollView {
                VStack(spacing: Space.lg) {
                    ForEach(Array(states.enumerated()), id: \.offset) { _, state in
                        LoadableCaptionSection(state, emptyCaption: "No trips yet", onRetry: {}) { text in
                            Text(verbatim: text).padding(.vertical, Space.md)
                        }
                        .koboCard()
                    }
                }
                .pageGutter()
            }
            .screenCanvas()
        }
    }

    #Preview("Loadable caption section") { LoadableCaptionSectionGallery() }
    #Preview("Loadable caption section · dark, Amber") {
        LoadableCaptionSectionGallery().koboTheme(.amber).preferredColorScheme(.dark)
    }
    #Preview("Loadable caption section · AX3") { LoadableCaptionSectionGallery().dynamicTypeSize(.accessibility3) }
#endif

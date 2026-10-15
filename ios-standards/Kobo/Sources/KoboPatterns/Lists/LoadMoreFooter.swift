import KoboComponents
import KoboTokens
import SwiftUI

/// How a `LoadMoreFooter` asks for the next page.
public enum LoadMoreTrigger: Sendable, Equatable, CaseIterable {
    /// A "Load more" button: the person decides.
    case button
    /// Loads as soon as the footer scrolls into view (infinite scroll). A failure still waits for "Try again".
    case automatic
}

/// The footer of a paged list: "Showing 20 of 54", then what `LoadMoreFooterModel` allows. "Load more" and "Try again"
/// keep their width and spin in place while the page loads; the rows stay through a failure; an exhausted list shows
/// the count alone. The count rolls to the new total when a page lands.
///
///     LazyVStack { rows; LoadMoreFooter(state.footer, onLoadMore: { send(.loadMore) }) }
public struct LoadMoreFooter: View {
    @Environment(\.koboTheme) private var theme
    private let model: LoadMoreFooterModel
    private let trigger: LoadMoreTrigger
    private let onLoadMore: () -> Void

    /// - Parameter onLoadMore: loads the next page; also runs for "Try again".
    public init(_ model: LoadMoreFooterModel, trigger: LoadMoreTrigger = .button, onLoadMore: @escaping () -> Void) {
        self.model = model
        self.trigger = trigger
        self.onLoadMore = onLoadMore
    }

    public var body: some View {
        VStack(spacing: Space.sm) {
            if model.showsCount {
                countLine
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
                    .monospacedDigit()
                    .contentTransition(.numericText(value: Double(model.loadedCount)))
                    .koboAnimation(.navigate, value: model.loadedCount)
            }
            control
        }
        .multilineTextAlignment(.center)
        .padding(.vertical, Space.xxl)
        .frame(maxWidth: .infinity)
        .onAppear {
            if trigger == .automatic && model.phase == .idle { onLoadMore() }
        }
    }

    private var countLine: Text {
        guard let total = model.totalCount else {
            return Text("Showing \(model.loadedCount)", bundle: .module)
        }
        return Text("Showing \(model.loadedCount) of \(total)", bundle: .module)
    }

    @ViewBuilder private var control: some View {
        switch model.phase {
        case .idle, .loading:
            if trigger == .button || model.phase == .loading {
                Button(action: onLoadMore) { Text("Load more", bundle: .module) }
                    .buttonStyle(.kobo(.secondary, size: .compact, isLoading: model.phase == .loading))
            }
        case .failed:
            Text("Couldn't load more", bundle: .module)
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textPrimary)
                .announceOnRisingEdge(String(localized: "Couldn't load more", bundle: .module))
            Button(action: onLoadMore) { Text("Try again", bundle: .module) }
                .buttonStyle(.kobo(.secondary, size: .compact))
        case .exhausted:
            EmptyView()
        }
    }
}

#if DEBUG
    private struct LoadMoreFooterPreview: View {
        @State private var model = LoadMoreFooterModel(loadedCount: 20, totalCount: 54)

        var body: some View {
            ScrollView {
                VStack(spacing: 0) {
                    LoadMoreFooter(model) { model = model.loadStarted() }
                    HStack {
                        Button("Land page") {
                            model = model.pageLoaded(loadedCount: model.loadedCount + 20, hasMore: true)
                        }
                        Button("Fail") { model = model.loadFailed() }
                    }
                    LoadMoreFooter(LoadMoreFooterModel(loadedCount: 54, totalCount: 54, phase: .exhausted)) {}
                    LoadMoreFooter(LoadMoreFooterModel(loadedCount: 40, phase: .failed)) {}
                }
                .pageGutter()
            }
            .screenCanvas()
        }
    }

    #Preview("Load more footer") { LoadMoreFooterPreview() }
    #Preview("Load more footer · dark, Lift") { LoadMoreFooterPreview().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Load more footer · AX3") { LoadMoreFooterPreview().dynamicTypeSize(.accessibility3) }
#endif

import Foundation

/// The state of a paged list's footer: how many rows are loaded, the total when the server sends one, and the phase
/// of the next page. A pure value the screen keeps in its state and moves with the three events below.
///
///     state.footer = state.footer.loadStarted()
///     state.footer = state.footer.pageLoaded(loadedCount: rows.count, totalCount: page.total, hasMore: page.hasMore)
///     state.footer = state.footer.loadFailed()
nonisolated public struct LoadMoreFooterModel: Equatable, Sendable {
    /// What the footer offers.
    public enum Phase: Equatable, Sendable, CaseIterable {
        /// More pages exist: "Load more" (or an automatic load when the footer appears).
        case idle
        /// The next page is loading: the button spins in place.
        case loading
        /// The last page load failed: the rows stay, a short line and "Try again" show.
        case failed
        /// Every page is loaded: the count alone, or nothing.
        case exhausted
    }

    public private(set) var loadedCount: Int
    /// `nil` when the server sends no total; the count line then names the loaded rows only.
    public private(set) var totalCount: Int?
    public private(set) var phase: Phase

    public init(loadedCount: Int = 0, totalCount: Int? = nil, phase: Phase = .idle) {
        self.loadedCount = max(loadedCount, 0)
        self.totalCount = totalCount.map { max($0, 0) }
        self.phase = phase
    }

    /// A load or a retry can start now.
    public var canLoadMore: Bool { phase == .idle || phase == .failed }

    /// The count line shows ("Showing 20 of 54").
    public var showsCount: Bool { loadedCount > 0 }

    /// A load started. Ignored while loading or once exhausted, so a double tap never loads two pages.
    public func loadStarted() -> LoadMoreFooterModel {
        guard canLoadMore else { return self }
        var next = self
        next.phase = .loading
        return next
    }

    /// A page landed. `hasMore` false, or a total that is reached, exhausts the list.
    public func pageLoaded(loadedCount: Int, totalCount: Int? = nil, hasMore: Bool) -> LoadMoreFooterModel {
        let total = totalCount ?? self.totalCount
        let count = max(loadedCount, 0)
        let reachedTotal = total.map { count >= $0 } ?? false
        return LoadMoreFooterModel(
            loadedCount: count,
            totalCount: total,
            phase: hasMore && !reachedTotal ? .idle : .exhausted
        )
    }

    /// The page load failed. Only a running load can fail.
    public func loadFailed() -> LoadMoreFooterModel {
        guard phase == .loading else { return self }
        var next = self
        next.phase = .failed
        return next
    }
}

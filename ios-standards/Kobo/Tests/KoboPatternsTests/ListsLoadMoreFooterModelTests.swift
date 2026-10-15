import Testing

@testable import KoboPatterns

@Suite struct ListsLoadMoreFooterModelTests {
    @Test func aLoadSpinsThenLandsIdleWhileMorePagesExist() {
        let loading = LoadMoreFooterModel(loadedCount: 20, totalCount: 54).loadStarted()
        #expect(loading.phase == .loading)
        #expect(!loading.canLoadMore)
        let landed = loading.pageLoaded(loadedCount: 40, hasMore: true)
        #expect(landed == LoadMoreFooterModel(loadedCount: 40, totalCount: 54, phase: .idle))
    }

    @Test func theLastPageOrTheTotalExhaustsTheList() {
        let base = LoadMoreFooterModel(loadedCount: 40, totalCount: 54).loadStarted()
        #expect(base.pageLoaded(loadedCount: 54, hasMore: true).phase == .exhausted)
        #expect(base.pageLoaded(loadedCount: 50, hasMore: false).phase == .exhausted)
        #expect(LoadMoreFooterModel().pageLoaded(loadedCount: 10, hasMore: true).phase == .idle)
    }

    @Test func aFailureKeepsTheRowsAndOffersARetry() {
        let failed = LoadMoreFooterModel(loadedCount: 20).loadStarted().loadFailed()
        #expect(failed.phase == .failed)
        #expect(failed.loadedCount == 20)
        #expect(failed.canLoadMore)
        #expect(failed.loadStarted().phase == .loading)
    }

    @Test func extraEventsChangeNothing() {
        let loading = LoadMoreFooterModel(loadedCount: 20).loadStarted()
        #expect(loading.loadStarted() == loading)
        let exhausted = LoadMoreFooterModel(loadedCount: 5, phase: .exhausted)
        #expect(exhausted.loadStarted() == exhausted)
        #expect(LoadMoreFooterModel().loadFailed() == LoadMoreFooterModel())
    }

    @Test func countsNeverGoNegativeAndAnEmptyListShowsNoCount() {
        #expect(
            LoadMoreFooterModel(loadedCount: -2, totalCount: -1) == LoadMoreFooterModel(loadedCount: 0, totalCount: 0)
        )
        #expect(!LoadMoreFooterModel().showsCount)
        #expect(LoadMoreFooterModel(loadedCount: 1).showsCount)
    }

    @Test func onlyLoadedContentAcceptsARefresh() {
        #expect(Loadable<Int>.Phase.loaded.acceptsRefresh)
        #expect(!Loadable<Int>.Phase.loading.acceptsRefresh)
        #expect(!Loadable<Int>.Phase.failed.acceptsRefresh)
        #expect(Loadable<Int>.Phase.empty.isSettled)
        #expect(!Loadable<Int>.Phase.loading.isSettled)
    }
}

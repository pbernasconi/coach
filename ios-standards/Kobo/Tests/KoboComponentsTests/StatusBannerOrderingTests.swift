import Testing

@testable import KoboComponents

@Suite struct StatusBannerOrderingTests {
    private func entries(_ pairs: [(String, BannerPriority)]) -> [BannerEntry<String>] {
        pairs.map { BannerEntry(id: $0.0, priority: $0.1) }
    }

    @Test func higherPrioritiesSitHigher() {
        let queue = entries([("update", .low), ("offline", .high), ("outage", .critical), ("tip", .normal)])
        #expect(BannerOrdering.arrange(queue, maxVisible: 4) == ["outage", "offline", "tip", "update"])
    }

    @Test func tiesKeepTheOrderGiven() {
        let queue = entries([("a", .normal), ("b", .normal), ("c", .high), ("d", .normal)])
        #expect(BannerOrdering.arrange(queue, maxVisible: 4) == ["c", "a", "b", "d"])
    }

    @Test func onlyTheTopBannersShowAndTheRestWait() {
        let queue = entries([("a", .low), ("b", .critical), ("c", .normal)])
        #expect(BannerOrdering.arrange(queue, maxVisible: 2) == ["b", "c"])
        #expect(BannerOrdering.waitingCount(queue, maxVisible: 2) == 1)
        #expect(BannerOrdering.waitingCount(queue, maxVisible: 5) == 0)
    }

    @Test func aDismissedBannerLetsTheNextOneUp() {
        let before = entries([("a", .low), ("b", .critical), ("c", .normal)])
        let after = before.filter { $0.id != "b" }
        #expect(BannerOrdering.arrange(after, maxVisible: 2) == ["c", "a"])
    }

    @Test func aZeroOrNegativeLimitShowsNothing() {
        let queue = entries([("a", .low)])
        #expect(BannerOrdering.arrange(queue, maxVisible: 0).isEmpty)
        #expect(BannerOrdering.arrange(queue, maxVisible: -1).isEmpty)
        #expect(BannerOrdering.waitingCount(queue, maxVisible: -1) == 1)
    }

    @Test func prioritiesAreOrdered() {
        #expect(BannerPriority.allCases == BannerPriority.allCases.sorted())
        #expect(BannerPriority.low < .critical)
    }
}

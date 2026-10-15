import Testing

@testable import KoboComponents

@Suite struct StatusOfflineBannerPhaseTests {
    private let offline = OfflineBannerPhase().connectivityChanged(isOffline: true)

    @Test func aShortDropClosesSilently() {
        #expect(offline.presence == .offline)
        #expect(offline.connectivityChanged(isOffline: false) == OfflineBannerPhase())
    }

    @Test func aLongDropSaysBackOnline() {
        let back = offline.longDropReached().connectivityChanged(isOffline: false)
        #expect(back.presence == .backOnline)
        #expect(OfflineBannerPhase.longDropAfter == .seconds(2))
    }

    @Test func aNewDropDuringBackOnlineShowsOfflineAndCountsFromItsOwnStart() {
        let back = offline.longDropReached().connectivityChanged(isOffline: false)
        let again = back.connectivityChanged(isOffline: true)
        #expect(again == OfflineBannerPhase(.offline))
        #expect(again.connectivityChanged(isOffline: false) == OfflineBannerPhase())
    }

    @Test func backOnlineClosesAfterItsHoldAndLateTimersChangeNothing() {
        let back = offline.longDropReached().connectivityChanged(isOffline: false)
        #expect(back.holdEnded() == OfflineBannerPhase())
        #expect(offline.holdEnded() == offline)
        #expect(OfflineBannerPhase().longDropReached() == OfflineBannerPhase())
        #expect(OfflineBannerPhase.backOnlineHold == .milliseconds(1_500))
    }

    @Test func repeatedOfflineReportsKeepTheLongDrop() {
        let long = offline.longDropReached()
        #expect(long.connectivityChanged(isOffline: true) == long)
        #expect(OfflineBannerPhase().connectivityChanged(isOffline: false) == OfflineBannerPhase())
    }

    @Test func thePendingTimerFollowsThePresence() {
        #expect(OfflineBannerPhase().pendingTimer == nil)
        #expect(offline.pendingTimer == OfflineBannerPhase.longDropAfter)
        #expect(offline.longDropReached().pendingTimer == nil)
        let back = offline.longDropReached().connectivityChanged(isOffline: false)
        #expect(back.pendingTimer == OfflineBannerPhase.backOnlineHold)
        #expect(offline.timerFired() == offline.longDropReached())
        #expect(back.timerFired() == OfflineBannerPhase())
    }
}

import Testing

@testable import KoboComponents

@Suite struct UtilitiesLogicTests {
    @Test func aNewMessageSpeaksAndARepeatStaysQuiet() {
        let first = AnnouncementEdge.step(announced: nil, message: "Offline")
        #expect(first == .init(speak: "Offline", announced: "Offline"))
        let repeated = AnnouncementEdge.step(announced: first.announced, message: "Offline")
        #expect(repeated.speak == nil)
        let changed = AnnouncementEdge.step(announced: repeated.announced, message: "Back online")
        #expect(changed.speak == "Back online")
    }

    @Test func aClearedMessageSpeaksAgainWhenItReturns() {
        let cleared = AnnouncementEdge.step(announced: "Offline", message: nil)
        #expect(cleared == .init(speak: nil, announced: nil))
        #expect(AnnouncementEdge.step(announced: cleared.announced, message: "Offline").speak == "Offline")
        #expect(AnnouncementEdge.step(announced: "Offline", message: "").announced == nil)
    }

    @Test func masksNeverHoldMoreThanTheTail() {
        #expect(MaskedValueText.text(prefix: nil, tail: "1234", mask: "••", tailSeparator: "") == "••1234")
        #expect(MaskedValueText.text(prefix: "$", tail: nil, mask: "•••", tailSeparator: "") == "$•••")
        #expect(MaskedValueText.text(prefix: nil, tail: "", mask: "••", tailSeparator: " ") == "••")
        #expect(MaskedValueText.text(prefix: nil, tail: "42", mask: "••", tailSeparator: " ") == "•• 42")
        #expect(MaskedValueText.tail(of: "4242424242424242", count: 4) == "4242")
        #expect(MaskedValueText.tail(of: "12", count: 4) == "12")
        #expect(MaskedValueText.tail(of: "12", count: -1).isEmpty)
    }

    @Test func onlyARegularWidthPadIsWide() {
        #expect(TabletLayout.isWideWindow(isPad: true, isRegularWidth: true))
        #expect(!TabletLayout.isWideWindow(isPad: true, isRegularWidth: false))
        #expect(!TabletLayout.isWideWindow(isPad: false, isRegularWidth: true))
        #expect(!TabletLayout.isWideWindow(isPad: false, isRegularWidth: false))
    }
}

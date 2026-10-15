import Foundation
import Testing

@testable import KoboComponents

@Suite struct OverlaysSheetLogicTests {
    @Test func fittedUsesTheMeasuredHeightOrMediumUntilMeasured() {
        #expect(SheetSizing.resolved([.fitted], fittedHeight: nil) == [.medium])
        #expect(SheetSizing.resolved([.fitted], fittedHeight: 0) == [.medium])
        #expect(SheetSizing.resolved([.fitted], fittedHeight: 320) == [.height(320)])
        #expect(SheetSizing.resolved([.fitted, .large], fittedHeight: 320) == [.height(320), .large])
    }

    @Test func detentsKeepTheCallerOrderWithoutRepeats() {
        #expect(SheetSizing.resolved([.large, .medium, .large], fittedHeight: nil) == [.large, .medium])
        // An unmeasured fitted detent and an explicit medium are the same system detent.
        #expect(SheetSizing.resolved([.fitted, .medium], fittedHeight: nil) == [.medium])
    }

    @Test func anEmptyListMeansLarge() {
        #expect(SheetSizing.resolved([], fittedHeight: 200) == [.large])
    }

    @Test func fractionsAreClampedAndBadHeightsFallBackToMedium() {
        #expect(SheetSizing.resolved([.fraction(0.02)], fittedHeight: nil) == [.fraction(SheetSizing.minimumFraction)])
        #expect(SheetSizing.resolved([.fraction(1.4)], fittedHeight: nil) == [.fraction(1)])
        #expect(SheetSizing.resolved([.fraction(0.4)], fittedHeight: nil) == [.fraction(0.4)])
        #expect(SheetSizing.resolved([.height(-10)], fittedHeight: nil) == [.medium])
        #expect(SheetSizing.resolved([.height(240)], fittedHeight: nil) == [.height(240)])
    }

    @Test func fittedHeightIsCappedByTheOfferedHeight() {
        #expect(SheetSizing.fittedHeight(ideal: 320, offered: 800) == 320)
        #expect(SheetSizing.fittedHeight(ideal: 1200, offered: 800) == 800)
        #expect(SheetSizing.fittedHeight(ideal: 320, offered: nil) == 320)
        #expect(SheetSizing.fittedHeight(ideal: 320, offered: .infinity) == 320)
    }

    @Test func measurementsSumAndRoundUpOnceTheContentIsMeasured() {
        var parts = SheetMeasurements()
        #expect(parts.fittedHeight == nil)
        parts.header = 76.5
        #expect(parts.fittedHeight == nil)
        parts.content = 200.2
        parts.footer = 66
        #expect(parts.fittedHeight == 343)
    }

    @Test func aCloseWithoutChangesClosesAtOnce() {
        var closeGuard = UnsavedChangesGuard()
        let closesNow = closeGuard.requestClose(hasChanges: false)
        #expect(closesNow)
        #expect(!closeGuard.isConfirmingDiscard)
    }

    @Test func aCloseWithChangesAsksFirst() {
        var closeGuard = UnsavedChangesGuard()
        let closesNow = closeGuard.requestClose(hasChanges: true)
        #expect(!closesNow)
        #expect(closeGuard.isConfirmingDiscard)
        closeGuard.confirmationAnswered()
        #expect(!closeGuard.isConfirmingDiscard)
    }
}

import Foundation
import Testing

@testable import KoboPatterns

@Suite struct FlowsStepProgressTests {
    @Test func currentIsClampedToTheFlow() {
        #expect(StepProgress(0, of: 4).current == 1)
        #expect(StepProgress(9, of: 4).current == 4)
        #expect(StepProgress(2, of: 0).total == 1)
        #expect(StepProgress(2, of: 0).current == 1)
        #expect(StepProgress(7, of: nil).current == 7)
    }

    @Test func segmentsFillUpToAndIncludingTheCurrentStep() {
        let progress = StepProgress(2, of: 4)
        #expect(progress.segmentCount == 4)
        #expect((0..<4).map(progress.isFilled) == [true, true, false, false])
        #expect(progress.isCurrent(1))
        #expect(!progress.isCurrent(0))
        #expect(progress.fraction == 0.5)
        #expect(!progress.isLast)
        #expect(StepProgress(4, of: 4).isLast)
    }

    /// An unknown total draws one empty track and claims nothing.
    @Test func anUnknownTotalIsOneEmptyTrack() {
        let progress = StepProgress(3, of: nil)
        #expect(progress.segmentCount == 1)
        #expect(!progress.isFilled(0))
        #expect(progress.fraction == 0)
        #expect(!progress.isLast)
    }

    @Test func advancingStaysInsideTheFlow() {
        #expect(StepProgress(1, of: 3).advanced(by: 1) == StepProgress(2, of: 3))
        #expect(StepProgress(3, of: 3).advanced(by: 1) == StepProgress(3, of: 3))
        #expect(StepProgress(1, of: 3).advanced(by: -1) == StepProgress(1, of: 3))
    }

    @Test func thePositionDecidesTheExitAndTheBack() {
        #expect(FlowStepPosition.first.showsExit && !FlowStepPosition.first.showsBack)
        #expect(!FlowStepPosition.later.showsExit && FlowStepPosition.later.showsBack)
        #expect(FlowStepPosition.laterInModal.showsExit && FlowStepPosition.laterInModal.showsBack)
    }

    @Test func aScreenPlacesTheExitOnce() {
        #expect(FlowExitPlacement.placement(position: .first, hasExit: true, isInstalledAbove: false) == .exit)
        #expect(FlowExitPlacement.placement(position: .first, hasExit: true, isInstalledAbove: true) == .none)
        #expect(FlowExitPlacement.placement(position: .later, hasExit: true, isInstalledAbove: false) == .none)
        #expect(
            FlowExitPlacement.placement(position: .laterInModal, hasExit: true, isInstalledAbove: false)
                == .exitKeepingBack
        )
        #expect(FlowExitPlacement.placement(position: .first, hasExit: false, isInstalledAbove: false) == .none)
    }

    /// Never two back controls: the system chevron hides on the first step with a ✕ and whenever the step draws its own.
    @Test func theSystemBackHidesWhenTheStepOwnsTheWayOut() {
        #expect(FlowExitPlacement.hidesSystemBack(.exit, hasCustomBack: false))
        #expect(!FlowExitPlacement.hidesSystemBack(.exitKeepingBack, hasCustomBack: false))
        #expect(!FlowExitPlacement.hidesSystemBack(.none, hasCustomBack: false))
        #expect(FlowExitPlacement.hidesSystemBack(.none, hasCustomBack: true))
    }

    @Test func theExitAsksOnlyWithUnsavedProgress() {
        #expect(FlowExitDecision.onTap(hasUnsavedProgress: false) == .leave)
        #expect(FlowExitDecision.onTap(hasUnsavedProgress: true) == .confirm)
    }

    @Test func aLongBannerIsCappedAndTheHintShowsOnlyWhenItHelps() {
        #expect(FlowFooterLayout.bannerCap(stepHeight: 0) == nil)
        #expect(FlowFooterLayout.bannerCap(stepHeight: 801) == 320)
        #expect(FlowFooterLayout.bannerHeight(contentHeight: 120, cap: 320) == 120)
        #expect(FlowFooterLayout.bannerHeight(contentHeight: 900, cap: 320) == 320)
        #expect(FlowFooterLayout.bannerHeight(contentHeight: -4, cap: 320) == 0)
        #expect(FlowFooterLayout.showsHint(hasHint: true, isEnabled: false, isLoading: false))
        #expect(!FlowFooterLayout.showsHint(hasHint: true, isEnabled: true, isLoading: false))
        #expect(!FlowFooterLayout.showsHint(hasHint: true, isEnabled: false, isLoading: true))
        #expect(!FlowFooterLayout.showsHint(hasHint: false, isEnabled: false, isLoading: false))
    }
}

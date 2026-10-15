import Foundation
import Testing

@testable import KoboComponents

private struct Destination: Identifiable, Equatable {
    let id: String
    var payload = 0
}

private enum Step: Equatable {
    case moveDay, pushWeek
}

@Suite struct OverlaysPresentationTests {
    private let picker = Destination(id: "picker")
    private let editor = Destination(id: "editor")

    @Test func aSwipeTellsTheCallerWhoStillHoldsTheItem() {
        var presentation = ItemSheetPresentation<Destination>()
        presentation.presented = editor
        presentation.sheetDidAppear(editor.id)
        presentation.presented = nil
        let notifies = presentation.sheetDidDismiss(current: editor)
        #expect(notifies)
    }

    @Test func aClearTheCallerStartsOnlyClosesTheSheet() {
        var presentation = ItemSheetPresentation<Destination>()
        presentation.sheetDidAppear(editor.id)
        presentation.presented = nil
        let notifies = presentation.sheetDidDismiss(current: nil)
        #expect(!notifies)
    }

    @Test func aSwapClosesSilentlyAndALaterSwipeTellsTheCaller() {
        var presentation = ItemSheetPresentation<Destination>()
        presentation.sheetDidAppear(picker.id)
        presentation.presented = editor
        let swapNotifies = presentation.sheetDidDismiss(current: editor)
        #expect(!swapNotifies)
        presentation.sheetDidAppear(editor.id)
        presentation.presented = nil
        let notifies = presentation.sheetDidDismiss(current: editor)
        #expect(notifies)
    }

    @Test func aSheetThatNeverAppearedTellsNobody() {
        var presentation = ItemSheetPresentation<Destination>()
        let notifies = presentation.sheetDidDismiss(current: editor)
        #expect(!notifies)
    }

    @Test func theSheetRendersTheNewestPayloadForTheSameIdentity() {
        let updated = Destination(id: editor.id, payload: 2)
        #expect(ItemSheetPresentation.latest(editor, current: updated) == updated)
        #expect(ItemSheetPresentation.latest(editor, current: picker) == editor)
        #expect(ItemSheetPresentation.latest(editor, current: nil) == editor)
    }

    @Test func aChosenActionWaitsForTheCloseAndRunsOnce() {
        var pending = PendingSheetAction<Step>()
        #expect(!pending.isWaiting)
        pending.choose(.moveDay)
        #expect(pending.isWaiting)
        let first = pending.sheetDidClose()
        #expect(first == .moveDay)
        let second = pending.sheetDidClose()
        #expect(second == nil)
        #expect(!pending.isWaiting)
    }

    @Test func aLaterChoiceReplacesAnEarlierOneAndCancelForgetsIt() {
        var pending = PendingSheetAction<Step>()
        pending.choose(.moveDay)
        pending.choose(.pushWeek)
        #expect(pending.pending == .pushWeek)
        pending.cancel()
        let chosen = pending.sheetDidClose()
        #expect(chosen == nil)
    }

    @Test func runAfterCloseRunsTheActionBeforeOnDidClose() {
        var log: [String] = []
        var pending = PendingSheetAction<() -> Void>()
        pending.choose { log.append("action") }
        #expect(log.isEmpty)
        pending.runAfterClose { log.append("didClose") }
        #expect(log == ["action", "didClose"])
        pending.runAfterClose { log.append("didClose") }
        #expect(log == ["action", "didClose", "didClose"])
    }

    @Test func destructiveItemsGoLastInTheirOwnGroup() {
        let roles: [(String, ActionSheetRole)] = [
            ("move", .standard), ("remove", .destructive), ("push", .standard), ("clear", .destructive),
        ]
        let groups = ActionSheetRules.grouped(roles) { $0.1 }
        #expect(groups.standard.map(\.0) == ["move", "push"])
        #expect(groups.destructive.map(\.0) == ["remove", "clear"])
    }

    @Test func theIconColumnShowsWhenAnyItemHasAnIcon() {
        #expect(ActionSheetRules.showsIconColumn([nil, "trash"]))
        #expect(!ActionSheetRules.showsIconColumn([nil, nil]))
        #expect(!ActionSheetRules.showsIconColumn([]))
    }

    @Test func duplicateIDsAreReportedOnceAndSorted() {
        #expect(ActionSheetRules.duplicateIDs(["b", "a", "b", "a", "b", "c"]) == ["a", "b"])
        #expect(ActionSheetRules.duplicateIDs(["a", "b"]).isEmpty)
    }
}

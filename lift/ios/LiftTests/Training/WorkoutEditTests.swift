import Foundation
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// The pencil's Edit sheet on a planned workout (APP-API.md, "Edit a workout"). Made-up values only (TEST-8).
@MainActor
@Suite struct WorkoutEditTests {
    let coachPlan = FakeCoachPlan([])
    static let ref = WorkoutDetail.planRef("p2")

    /// A ride still to do, with its Edit form; `edit` false leaves the form out (an older server).
    static func body(state: String = "planned", edit: Bool = true) -> Data {
        let form = """
            { "sport": "ride", "date": "2026-03-05", "startTime": "07:00", "title": "Tempo ride", "duration": 60,
              "distanceKm": null, "tss": null, "effort": "moderate", "description": "Steady.", "bank": null,
              "level": 0, "otherSteps": false, "stepsMinutes": null, "stepsTss": null,
              "efforts": [
                { "id": "easy", "label": "Easy", "if": 0.65 }, { "id": "moderate", "label": "Moderate", "if": 0.75 }
              ],
              "bankOptions": [{ "id": "tempo", "name": "Tempo", "levels": ["3×20 min Z3", "3×25 min Z3"] }] }
            """
        return Data(
            """
            { "ref": "plan-p2", "state": "planned", "title": "Tempo ride", "activity": null, "feedback": null,
              "plan": { "id": "p2", "date": "2026-03-05", "title": "Tempo ride", "sport": "ride",
                "subtitle": "Ride · Thursday, March 5 · 07:00", "state": "\(state)", "stateLabel": "Planned",
                "compliance": null, "adapted": false, "hero": [], "workout": null, "intensity": "Moderate",
                "notes": "Steady.", "liftSessionId": null, "done": null, "exercises": [],
                "edit": \(edit ? form : "null") } }
            """.utf8
        )
    }

    func loaded(_ body: Data = body()) async -> ActivityDetailViewModel {
        let data = RoutedAppData([WorkoutDetail.path(Self.ref): .success(body)])
        let vm = ActivityDetailViewModel(
            ref: Self.ref,
            seed: nil,
            data: data,
            starter: nil,
            coachPlan: coachPlan,
            router: RecordingNavigator(),
            tabs: RecordingTabs(),
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
        await vm.run()
        return vm
    }

    @Test func editTappedOpensTheSheetFilledIn() async throws {
        let vm = await loaded()
        #expect(vm.state.canEdit)
        vm.send(.editTapped)
        let draft = try #require(vm.state.editDraft)
        #expect(draft.title == "Tempo ride")
        #expect(draft.day == LocalDay(year: 2026, month: 3, day: 5))
        #expect(draft.startMinute == 7 * 60)
        #expect(draft.durationText == "1:00")
        #expect(draft.autoTss == 56)  // an hour at Moderate's IF
        #expect(!draft.hasChanges)
    }

    @Test func noPencilForADoneWorkoutOrAnOlderServer() async {
        let done = await loaded(Self.body(state: "done"))
        #expect(!done.state.canEdit)
        done.send(.editTapped)
        #expect(done.state.destination == nil)
        let older = await loaded(Self.body(edit: false))
        #expect(!older.state.canEdit)
    }

    @Test func editChangedKeepsWhatWasTyped() async throws {
        let vm = await loaded()
        vm.send(.editTapped)
        var draft = try #require(vm.state.editDraft)
        draft.title = "Long tempo"
        draft.durationText = "1:30"
        vm.send(.editChanged(draft))
        #expect(vm.state.editDraft?.title == "Long tempo")
        #expect(vm.state.editDraft?.autoTss == 84)
        #expect(vm.state.editDraft?.hasChanges == true)
    }

    @Test func editSaveTappedSavesMovesAndCloses() async throws {
        let vm = await loaded()
        vm.send(.editTapped)
        var draft = try #require(vm.state.editDraft)
        let saturday = LocalDay(year: 2026, month: 3, day: 7)
        draft.day = saturday
        draft.bank = "tempo"
        draft.level = 1
        draft.tssText = "70"
        vm.send(.editChanged(draft))

        await vm.send(.editSaveTapped)?.value

        #expect(vm.state.destination == nil)
        #expect(coachPlan.edits == [.move(id: "p2", to: saturday)])
        let saved = try #require(coachPlan.updates.first)
        #expect(saved.date == "2026-03-07")
        #expect(saved.bank == "tempo")
        #expect(saved.level == 1)
        #expect(saved.tss == 70)
        #expect(saved.duration == 60)
        #expect(saved.startTime == "07:00")
    }

    @Test func aFieldTheServerWouldRefuseSaysSoAndSendsNothing() async throws {
        let vm = await loaded()
        vm.send(.editTapped)
        var draft = try #require(vm.state.editDraft)
        draft.durationText = "an hour"
        vm.send(.editChanged(draft))

        #expect(vm.send(.editSaveTapped) == nil)

        #expect(coachPlan.updates.isEmpty)
        #expect(vm.state.editDraft?.error == WorkoutEditDraft.EditProblem.duration.message)
    }

    @Test func aRefusedSaveKeepsTheSheetAndSaysWhy() async throws {
        let vm = await loaded()
        coachPlan.editError = .rejected(status: 409)
        vm.send(.editTapped)

        await vm.send(.editSaveTapped)?.value

        #expect(vm.state.editDraft?.isSaving == false)
        #expect(vm.state.editDraft?.error == String(localized: "A done workout stays as it is."))
        #expect(coachPlan.edits.isEmpty)  // the same day: nothing moves
    }

    @Test func aNewBankWorkoutLeavesTheTssToTheServer() async throws {
        let vm = await loaded()
        vm.send(.editTapped)
        var draft = try #require(vm.state.editDraft)
        draft.bank = "tempo"
        #expect(draft.hasSteps)
        #expect(draft.autoTss == nil)
        #expect(draft.levels.count == 2)
        draft.startMinute = nil
        guard case .success(let edit) = draft.edit else {
            Issue.record("the draft should read")
            return
        }
        #expect(edit.startTime == nil)
    }
}

import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// One test per Action case, plus `run()` and the parsing → review mapping (TEST-2). No sleeps, no real time
/// (TEST-3). The writes are in `ImportNotesWriteTests`.
@MainActor
@Suite struct ImportNotesViewModelTests {
    @Test func runReadsTheNoteWhenTheRequestAsks() async throws {
        let harness = try await ImportHarness.make()
        let vm = harness.viewModel(text: ImportSample.note, readsOnOpen: true)

        await vm.run()

        let review = try #require(vm.state.review)
        #expect(review.candidates.map(\.session.title) == ["Workout A", "Workout B"])
        #expect(review.newExercises.map(\.name) == ["Landmine rotation"])
    }

    @Test func runWaitsForThePasteStepOtherwise() async throws {
        let harness = try await ImportHarness.make()
        let vm = harness.viewModel(text: ImportHarness.note)

        await vm.run()

        #expect(vm.state == ImportNotesState(text: ImportHarness.note, step: .paste(.editing)))
    }

    @Test func textChangedKeepsTheTextAndClearsAFailure() async throws {
        let harness = try await ImportHarness.make()
        let vm = harness.viewModel(text: "  ")
        vm.send(.continueTapped)
        #expect(vm.state.step == .paste(.failed(.emptyText)))

        let task = vm.send(.textChanged("Workout A - Oct 6"))

        #expect(task == nil)
        #expect(vm.state == ImportNotesState(text: "Workout A - Oct 6", step: .paste(.editing)))
    }

    @Test func pasteTappedReplacesTheTextWithTheClipboard() async throws {
        let harness = try await ImportHarness.make(clipboard: ImportHarness.note)
        let vm = harness.viewModel(text: "old text")

        vm.send(.pasteTapped)

        #expect(vm.state == ImportNotesState(text: ImportHarness.note, step: .paste(.editing)))
        #expect(harness.pasteboard.reads == 1)
    }

    @Test func pasteTappedWithAnEmptyClipboardSaysSo() async throws {
        let harness = try await ImportHarness.make(clipboard: " \n")
        let vm = harness.viewModel(text: "kept")

        vm.send(.pasteTapped)

        #expect(vm.state == ImportNotesState(text: "kept", step: .paste(.failed(.clipboardEmpty))))
    }

    @Test func continueTappedWithBlankTextFailsWithoutReading() async throws {
        let harness = try await ImportHarness.make()
        let vm = harness.viewModel(text: " \n\t")

        let task = vm.send(.continueTapped)

        #expect(task == nil)
        #expect(vm.state.step == .paste(.failed(.emptyText)))
    }

    @Test func continueTappedWithNoWorkoutTitlesFindsNothing() async throws {
        let harness = try await ImportHarness.make()
        let vm = harness.viewModel(text: "Squats felt good\n- [x] 5 x 60kg")

        await vm.send(.continueTapped)?.value

        #expect(vm.state.step == .paste(.failed(.nothingParsed)))
    }

    @Test func continueTappedMapsTheParsedWorkoutsToTheReview() async throws {
        let harness = try await ImportHarness.make()
        let vm = harness.viewModel(text: ImportHarness.note)

        let task = vm.send(.continueTapped)
        #expect(vm.state.step == .paste(.reading))
        #expect(vm.send(.continueTapped) == nil)  // a double tap reads once
        await task?.value

        let review = try #require(vm.state.review)
        let days = DayCalendar(calendar: SessionBuilder.calendar)
        #expect(review.days.map(\.id) == [ImportHarness.dayA, ImportHarness.dayB])
        #expect(
            review.days.map(\.title) == [
                days.shortTitle(of: ImportHarness.dayA), days.shortTitle(of: ImportHarness.dayB),
            ]
        )
        let first = try #require(review.days.first?.sessions.first)
        #expect(first.exerciseCount == 2)
        #expect(first.setCount == 4)
        #expect(first.loggedSetCount == 3)
        #expect(first.newExerciseNames == ["Landmine rotation"])
        #expect(review.candidates.allSatisfy { $0.isIncluded && !$0.isDuplicate })
        #expect(review.includedSetCount == 6)
        #expect(review.issues == [ImportIssue(line: 1, kind: .outsideSession, text: "Gym notebook")])
    }

    @Test func continueTappedMarksSameDaySameTitleAsAlreadyImported() async throws {
        let harness = try await ImportHarness.make()
        _ = try await harness.store.sessions.createSession(
            on: ImportHarness.dayB,
            title: "workout b ",
            unit: .kg,
            templateID: nil
        )
        _ = try await harness.store.sessions.createSession(
            on: ImportHarness.dayA,
            title: "Workout C",
            unit: .kg,
            templateID: nil
        )
        let vm = harness.viewModel(text: ImportHarness.note)

        await vm.send(.continueTapped)?.value

        let review = try #require(vm.state.review)
        #expect(review.candidates.map(\.isDuplicate) == [false, true])
        #expect(review.candidates.map(\.isIncluded) == [true, false])
        #expect(review.included.map(\.session.title) == ["Workout A"])
        #expect(ImportText.candidateDetail(review.candidates[1]).hasSuffix("Already imported"))
    }

    @Test func sessionToggledIncludesAndExcludes() async throws {
        let harness = try await ImportHarness.make()
        let vm = harness.viewModel(text: ImportHarness.note)
        await vm.send(.continueTapped)?.value
        let id = try #require(vm.state.review?.candidates.first?.id)

        vm.send(.sessionToggled(id))
        #expect(vm.state.review?.included.map(\.session.title) == ["Workout B"])
        #expect(vm.state.review?.newExercises.isEmpty == true)
        #expect(vm.state.review?.includedSetCount == 2)

        vm.send(.sessionToggled(id))
        #expect(vm.state.review?.included.count == 2)
    }

    @Test func backTappedReturnsToTheTextUnchanged() async throws {
        let harness = try await ImportHarness.make()
        let vm = harness.viewModel(text: ImportHarness.note)
        await vm.send(.continueTapped)?.value

        let task = vm.send(.backTapped)

        #expect(task == nil)
        #expect(vm.state == ImportNotesState(text: ImportHarness.note, step: .paste(.editing)))
    }

    @Test func doneTappedClosesTheFlow() async throws {
        let harness = try await ImportHarness.make()
        let vm = harness.viewModel()

        #expect(vm.send(.doneTapped) == nil)

        #expect(harness.flow.dismissed == 1)
    }

    @Test func exitTappedClosesTheFlow() async throws {
        let harness = try await ImportHarness.make()
        let vm = harness.viewModel(text: ImportHarness.note)

        #expect(vm.send(.exitTapped) == nil)

        #expect(harness.flow.dismissed == 1)
        #expect(harness.flow.presented == 0)
    }
}

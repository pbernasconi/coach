import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The lift sheet Actions on the Week screen: each change applies at once and offers Undo (product rule).
/// One test per Action case (TEST-2); writes are awaited through `send(...)?.value` (TEST-3).
@MainActor
@Suite struct WeekLiftSheetTests {
    let monday = Fixtures.monday
    let calendar = SessionBuilder.calendar
    let router = RecordingNavigator()

    var days: DayCalendar { DayCalendar(calendar: calendar) }
    var friday: LocalDay { monday.adding(days: 4) }
    var done: SessionDetail { SessionBuilder.session(id: 1, on: monday, done: 3, planned: 0) }
    var planned: SessionDetail { SessionBuilder.session(id: 2, on: friday, title: "Upper A", done: 0, planned: 3) }

    func date(_ day: LocalDay) -> Date {
        day.startDate(in: calendar) ?? .distantPast
    }

    func loaded(rescheduleError: AppError? = nil, undoError: AppError? = nil) async
        -> (WeekViewModel, FakeSessionRepository)
    {
        let repository = FakeSessionRepository(
            emissions: [[done, planned]],
            rescheduleError: rescheduleError,
            undoError: undoError
        )
        let vm = WeekViewModel(
            sessions: repository,
            templates: FakeTemplateRepository(),
            plans: FakeWorkoutPlanRepository(),
            router: router,
            now: SessionBuilder.now,
            calendar: calendar,
            unit: .kg
        )
        await vm.run()
        return (vm, repository)
    }

    // MARK: - Opening

    @Test func sessionOptionsTappedOpensTheLiftSheetForAPlannedSession() async {
        let (vm, _) = await loaded()

        let task = vm.send(.sessionOptionsTapped(planned.id))

        #expect(task == nil)
        let ref = WeekSessionRef(id: planned.id, title: "Upper A", dayTitle: days.longTitle(of: friday))
        #expect(vm.state.destination == .options(ref))
    }

    @Test func sessionOptionsTappedIgnoresADoneSession() async {
        let (vm, _) = await loaded()

        vm.send(.sessionOptionsTapped(done.id))

        #expect(vm.state.destination == nil)
    }

    @Test func moveTappedOpensTheDayPickerWithinTheStrip() async {
        let (vm, _) = await loaded()
        vm.send(.sessionOptionsTapped(planned.id))

        vm.send(.moveTapped(planned.id))

        let move = WeekMove(
            id: planned.id,
            title: "Upper A",
            dayTitle: days.longTitle(of: friday),
            current: date(friday),
            first: date(monday.adding(days: -28)),
            last: date(monday.adding(days: 34))
        )
        #expect(vm.state.destination == .move(move))
    }

    @Test func destinationDismissedClosesTheSheet() async {
        let (vm, _) = await loaded()
        vm.send(.sessionOptionsTapped(planned.id))

        vm.send(.destinationDismissed)

        #expect(vm.state.destination == nil)
    }

    // MARK: - Changes

    @Test func moveDayPickedMovesAtOnceAndOffersUndo() async {
        let (vm, repository) = await loaded()
        let wednesday = monday.adding(days: 2)
        vm.send(.moveTapped(planned.id))

        await vm.send(.moveDayPicked(planned.id, date(wednesday)))?.value

        #expect(vm.state.destination == nil)
        #expect(repository.rescheduled == [.init(sessionID: planned.id, action: .move(to: wednesday))])
        let undo = RescheduleUndo(sessionID: planned.id, previousDay: friday)
        let message = String(localized: "Moved to \(days.shortTitle(of: wednesday))")
        #expect(vm.state.toast == WeekToast(id: 1, message: message, undo: .reschedule(undo)))
    }

    @Test func moveDayPickedOnTheSameDayOnlyCloses() async {
        let (vm, repository) = await loaded()
        vm.send(.moveTapped(planned.id))

        let task = vm.send(.moveDayPicked(planned.id, date(friday)))

        #expect(task == nil)
        #expect(vm.state.destination == nil)
        #expect(repository.rescheduled.isEmpty)
    }

    @Test func pushToNextWeekTappedPushesOnceAndOffersUndo() async {
        let (vm, repository) = await loaded()

        let first = vm.send(.pushToNextWeekTapped(planned.id))
        let second = vm.send(.pushToNextWeekTapped(planned.id))  // a double tap is ignored
        await first?.value

        #expect(second == nil)
        #expect(repository.rescheduled == [.init(sessionID: planned.id, action: .pushToNextWeek)])
        let undo = RescheduleUndo(sessionID: planned.id, previousDay: friday)
        #expect(
            vm.state.toast
                == WeekToast(id: 1, message: String(localized: "Pushed to next week"), undo: .reschedule(undo))
        )
    }

    @Test func removeTappedRemovesAtOnceAndOffersUndo() async {
        let (vm, repository) = await loaded()

        await vm.send(.removeTapped(planned.id))?.value

        #expect(repository.rescheduled == [.init(sessionID: planned.id, action: .remove)])
        #expect(vm.state.toast?.message == String(localized: "Removed Upper A"))
        #expect(vm.state.toast?.undo == .reschedule(RescheduleUndo(sessionID: planned.id, previousDay: friday)))
    }

    @Test func aFailedChangeShowsAToastWithoutUndo() async {
        let (vm, _) = await loaded(rescheduleError: AppError(.unknown))

        await vm.send(.removeTapped(planned.id))?.value

        #expect(vm.state.toast?.message == String(localized: "The workout could not be changed"))
        #expect(vm.state.toast?.undo == nil)
    }

    // MARK: - Undo

    @Test func undoTappedPutsTheSessionBack() async {
        let (vm, repository) = await loaded()
        await vm.send(.removeTapped(planned.id))?.value
        guard case .reschedule(let undo)? = vm.state.toast?.undo else {
            Issue.record("expected an undo")
            return
        }

        await vm.send(.undoTapped(undo))?.value

        #expect(repository.undone == [undo])
        #expect(vm.state.toast?.id == 1)  // no new toast after a successful undo
    }

    @Test func aFailedUndoSaysSo() async {
        let (vm, _) = await loaded(undoError: AppError(.unknown))
        let undo = RescheduleUndo(sessionID: planned.id, previousDay: friday)

        await vm.send(.undoTapped(undo))?.value

        #expect(
            vm.state.toast == WeekToast(id: 1, message: String(localized: "The change could not be undone"), undo: nil)
        )
    }
}

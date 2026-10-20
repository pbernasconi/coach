import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// One test per Action case, plus `run()` (TEST-2). No sleeps, no real time (TEST-3).
/// `SessionBuilder.now` is Monday 2026-03-02, the first day of its week.
@MainActor
@Suite struct WeekViewModelTests {
    let monday = Fixtures.monday
    let calendar = SessionBuilder.calendar
    let router = RecordingNavigator()

    func makeViewModel(_ repository: FakeSessionRepository) -> WeekViewModel {
        WeekViewModel(
            sessions: repository,
            templates: FakeTemplateRepository(),
            plans: FakeWorkoutPlanRepository(),
            router: router,
            now: SessionBuilder.now,
            calendar: calendar,
            units: InMemoryUnitSettings(.kg),
            coachPlan: DisabledCoachPlan()
        )
    }

    func date(_ day: LocalDay) -> Date {
        day.startDate(in: calendar) ?? .distantPast
    }

    func title(_ day: LocalDay) -> String {
        WeekLayout(days: DayCalendar(calendar: calendar), today: monday).title(of: day)
    }

    /// A loaded view model over a done Monday session (id 1) and a planned Friday session (id 2).
    func loadedWeek(_ repository: FakeSessionRepository? = nil) async -> (WeekViewModel, FakeSessionRepository) {
        let repository = repository ?? FakeSessionRepository(emissions: [weekSessions])
        let vm = makeViewModel(repository)
        await vm.run()
        return (vm, repository)
    }

    var done: SessionDetail { SessionBuilder.session(id: 1, on: monday, done: 3, planned: 0) }
    var planned: SessionDetail {
        SessionBuilder.session(id: 2, on: monday.adding(days: 4), title: "Upper A", done: 0, planned: 3)
    }
    var weekSessions: [SessionDetail] { [done, planned] }

    // MARK: - run

    /// The loaded week's days, or none.
    func days(_ vm: WeekViewModel) -> [WeekDaySection] {
        guard case .loaded(let days) = vm.state.sessions else { return [] }
        return days
    }

    @Test func runShowsAllSevenDaysWithTheirSessionsAndTodaySelected() async {
        let nextWeek = SessionBuilder.session(id: 3, on: monday.adding(days: 8), done: 0, planned: 3)
        let repository = FakeSessionRepository(emissions: [weekSessions + [nextWeek]])
        let (vm, _) = await loadedWeek(repository)

        #expect(repository.requestedRanges == [monday.adding(days: -28)...monday.adding(days: 34)])
        let week = days(vm)
        #expect(week.map(\.id) == (0..<7).map { monday.adding(days: $0) })
        let sessions: [[SessionSummary]] = [
            [SessionSummary(detail: done)], [], [], [], [SessionSummary(detail: planned)], [], [],
        ]
        #expect(week.map(\.sessions) == sessions)
        #expect(week.map(\.isSelected) == [true, false, false, false, false, false, false])
        #expect(week.map(\.isToday) == [true, false, false, false, false, false, false])
        let calendarDays = DayCalendar(calendar: calendar)
        #expect(week[0].title == title(monday))
        #expect(week[0].weekday == calendarDays.weekdayTitle(of: monday))
        #expect(week[4].dayNumber == calendarDays.dayNumber(of: monday.adding(days: 4)))
        let expectedDays = [
            WeekDay(date: date(monday), status: .done),
            WeekDay(date: date(monday.adding(days: 4)), status: .planned),
            WeekDay(date: date(monday.adding(days: 8)), status: .planned),
        ]
        #expect(vm.state.strip == WeekStrip(today: date(monday), selected: date(monday), days: expectedDays))
        #expect(title(monday).hasPrefix("Today"))
    }

    @Test func runShowsAWeekWithNothingPlannedAsSevenRestDays() async {
        let nextWeek = SessionBuilder.session(id: 3, on: monday.adding(days: 8), done: 0, planned: 3)
        let (vm, _) = await loadedWeek(FakeSessionRepository(emissions: [[], [nextWeek]]))

        #expect(days(vm).count == 7)
        #expect(days(vm).allSatisfy { $0.sessions.isEmpty })
        #expect(vm.state.strip?.days == [WeekDay(date: date(monday.adding(days: 8)), status: .planned)])
    }

    // MARK: - Selection

    @Test func daySelectedMovesTheHighlightAndKeepsTheWeek() async {
        let (vm, _) = await loadedWeek()
        let friday = monday.adding(days: 4)

        let task = vm.send(.daySelected(date(friday).addingTimeInterval(3_600)))

        #expect(task == nil)
        #expect(vm.state.strip?.selected == date(friday))
        #expect(days(vm).map(\.isSelected) == [false, false, false, false, true, false, false])
    }

    @Test func dayTappedSelectsThatRestDay() async {
        let (vm, _) = await loadedWeek()
        let wednesday = monday.adding(days: 2)

        let task = vm.send(.dayTapped(wednesday))

        #expect(task == nil)
        #expect(vm.state.strip?.selected == date(wednesday))
        #expect(vm.state.weekOffset == 0)
        #expect(days(vm).first(where: \.isSelected)?.id == wednesday)
    }

    @Test func weekChangedShowsThatWeekAndSelectsItsFirstDay() async {
        let nextMonday = monday.adding(days: 7)
        let nextWeek = SessionBuilder.session(id: 3, on: monday.adding(days: 9), done: 0, planned: 3)
        let (vm, _) = await loadedWeek(FakeSessionRepository(emissions: [weekSessions + [nextWeek]]))

        vm.send(.weekChanged(1))

        #expect(vm.state.weekOffset == 1)
        #expect(vm.state.strip?.selected == date(nextMonday))
        #expect(days(vm).first?.id == nextMonday)
        #expect(days(vm)[2].sessions.map(\.id) == [nextWeek.id])

        vm.send(.weekChanged(0))

        #expect(vm.state.strip?.selected == date(monday))
    }

    @Test func weekChangedBeforeRunOnlyMovesThePage() {
        let vm = makeViewModel(FakeSessionRepository(emissions: []))

        vm.send(.weekChanged(-1))

        #expect(vm.state.weekOffset == -1)
        #expect(vm.state.strip == nil)
    }

    // MARK: - Navigation

    @Test func sessionTappedOpensTheWorkout() async {
        let (vm, _) = await loadedWeek()
        let before = vm.state

        let task = vm.send(.sessionTapped(done.id))

        #expect(task == nil)
        #expect(router.opened == [.workout(done.id)])
        #expect(vm.state == before)
    }
}
